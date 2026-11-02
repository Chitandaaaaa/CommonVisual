/* ============================================================
   CommonVisual v2 · L3 动词 · move（搬运）
   ------------------------------------------------------------
   一段数据从源槽飞到目标槽。源槽留不留是剧本的槽位状态，不是动词属性：
   · gather   keep（源保留）      · scatter  起飞即清空
   · allgather 环上四条边同轮并发 · alltoall 每步三条流发往同一目标（家族模式）
   四段严格串行：飞 → 淡（送达淡出）→ 等（落位延迟）→ 落位（弹跳）。
   ============================================================ */
(function (CV) {
  'use strict';
  var verbs = (window.CV = window.CV).verbs = CV.verbs || {};
  verbs.move = verbs.move || {};

  var DATA = null;   /* 由 director 注入（S.data 同一引用） */

  function P(i) { return DATA[i]; }

  /* ══════════ 建场：marker / 连线 / 数据包 ══════════ */

  /* wireStyle：
     gather   源卡左边缘 → 目标卡右缘（目标在左，落点按槽位分布）
     scatter  源卡右边缘 → 目标卡左边缘（目标在右，起点按槽位分布）——broadcast 同几何
     ring     2×2 环上四条边（剧本给 scene.wires）
     line     alltoall 的直线中心交叉（家族 build 自己画） */
  verbs.move.build = function (S, scene) {
    DATA = S.data;
    S.trailKey = scene.family === 'alltoall' ? 'trailATA' : 'trailChoreo';   /* 余辉比率按族 */
    var style = scene.wireStyle;
    if (!style || style === 'line') return;      /* line 由家族 build 负责 */

    var layer = S.layers.wires, defs = S.defs;

    function mkWire(key, d, letter, markerId) {
      var m = letter ? verbs.move._mk(defs, markerId, letter) : (markerId ? verbs.move._mk(defs, markerId, null) : null);
      var w = CV.payload.link(layer, { d: d, letter: letter || null, markerId: markerId || null });
      S.wires[key] = {
        path: w.path, len: w.len,
        marker: markerId ? defs.querySelector('#' + markerId + ' path') : null
      };
    }

    if (style === 'ring') {
      (scene.wires || []).forEach(function (wd, i) {
        var id = 'ae' + i;
        CV.payload.marker(defs, id);            /* 箭头按「边」建：每轮字母不同，颜色逐帧跟 */
        var e = CV.sideEnds(S.cards[wd.a].geo, S.cards[wd.b].geo);
        var w = CV.payload.link(layer, { d: CV.arcPath(e.sx, e.sy, e.tx, e.ty), markerId: id });
        S.wires[wd.key || 'e' + i] = {
          path: w.path, len: w.len,
          marker: defs.querySelector('#' + id + ' path'),
          sx: e.sx, sy: e.sy, tx: e.tx, ty: e.ty
        };
      });
      /* 数据包：每条流一个（跨轮次不能共用，字母颜色建的时候定死） */
      scene.beats.forEach(function (b) {
        if (b.kind !== 'move') return;
        b.flows.forEach(function (f, fi) {
          S.pkts[b.id + '.' + fi] = CV.payload.packet(S.layers.fx, {
            letter: f.letter, color: P(f.color).color
          });
        });
      });
      return;
    }

    /* gather / scatter（broadcast 复用 scatter 几何但包是整份、箭头不带字母） */
    scene.beats.forEach(function (b) {
      if (b.kind !== 'move' && b.kind !== 'copy') return;
      b.flows.forEach(function (f, fi) {
        var key = b.id + '.' + fi;
        var a = S.cards[f.from[0]].geo, c = S.cards[f.to[0]].geo;
        var sx, sy, tx, ty;
        if (style === 'gather') {
          sx = a.x; sy = a.y + a.h / 2;
          tx = c.x + c.w + 4;
          ty = c.y + c.h * (0.28 + 0.22 * (f.to[1] - 1));
        } else {
          sx = a.x + a.w + 4;
          sy = a.y + a.h * (0.28 + 0.22 * (f.to[0] - 1));
          tx = c.x; ty = c.y + c.h / 2;
        }
        var markerId = 'ah' + fi + '_' + b.id;
        var letter = b.kind === 'copy' ? null : f.letter;
        CV.payload.marker(defs, markerId, letter || undefined);
        var d = CV.arcPath(sx, sy, tx, ty);
        var w = CV.payload.link(layer, { d: d, letter: letter || null, markerId: markerId });
        S.wires[key] = {
          path: w.path, len: w.len,
          marker: defs.querySelector('#' + markerId + ' path')
        };
        S.pkts[key] = b.kind === 'copy'
          ? CV.payload.batch(S.layers.fx, S.L.slot, S.data)
          : CV.payload.packet(S.layers.fx, { letter: f.letter, color: P(f.color).color });
      });
    });
  };
  verbs.move._mk = function (defs, id, letter) { return CV.payload.marker(defs, id, letter); };

  /* ══════════ 逐帧：连线四段状态 + 包飞行 ══════════ */
  /* beat.flows[i] 与建场时的 key 一一对应；rev = 沿路径反向（线按 a→b 画、流从 b→a） */

  verbs.move.render = function (S, beat, w, sec) {
    var colorOf = function (f) { return P(f.color).color; };
    /* ring 页的连线样式由 ringWires 统一管（边被多轮复用），这里只管包 */
    var styleWires = S.wireStyle !== 'ring';

    beat.flows.forEach(function (f, fi) {
      var key = beat.id + '.' + fi;
      var wire = S.wires[f.wire || key], p = S.pkts[key];
      if (!wire || !p) return;
      var color = f.whole != null ? P(f.whole).color : colorOf(f);
      var rev = !!f.rev;
      var flying = sec >= w.s && sec < w.travelEnd;
      var fading = sec >= w.travelEnd && sec < w.fadeEnd;
      var parked = sec >= w.fadeEnd && sec < w.seatStart;

      /* 余辉计时回灰（orch·trailChoreo / trailATA）：抵达后保留数据色
         ratio×飞行时长，然后回灰（idleWire）—— 比率不再是无上限的常亮 */
      var glowWin = (w.travelEnd - w.s) * (CV.spec(S.trailKey));
      var glowing = sec - w.travelEnd <= glowWin;
      if (flying) {
        var e = CV.easeInOutQuad((sec - w.s) / (w.travelEnd - w.s));
        /* 起步让出：整份包按半宽几何让出（封顶 0.32）；单色/曲线包按规范
           packLead（封顶 18/路径长）—— 2026-11-02 前引擎未消费该参数，此接。 */
        var lead = 0;
        if (p.half && wire.len > 0) {
          lead = Math.min(0.32, p.half / wire.len);
        } else {
          lead = Math.min(18 / (wire.len || 1), CV.spec('packLead'));
        }
        if (lead > 0) {
          e = lead + e * (1 - lead);
        }
        CV.payload.place(p, wire, e, rev);
        if (styleWires) {
          wire.path.setAttribute('stroke', color);
          wire.path.setAttribute('stroke-width', '2.6');
          wire.path.setAttribute('stroke-dasharray', '9 7');
          wire.path.setAttribute('opacity', '1');
          if (wire.marker) wire.marker.setAttribute('fill', color);
        }
      } else if (fading) {
        /* 已到箭头尖：不动了，原地把自己淡掉（这一段同时就是「停留」） */
        CV.payload.place(p, wire, 1, rev);
        CV.payload.fadeOut(p, sec - w.travelEnd, w.fadeSec);
        if (styleWires) glowing ? afterGlow(wire, color, '.4') : idleWire(wire);
      } else if (parked || sec >= w.seatStart) {
        p.g.setAttribute('opacity', '0');
        if (styleWires) glowing ? afterGlow(wire, color, '.4') : idleWire(wire);
      } else {
        p.g.setAttribute('opacity', '0');
        if (styleWires) idleWire(wire);
      }
    });
  };

  function afterGlow(wire, color, op) {
    wire.path.setAttribute('stroke', color);
    wire.path.setAttribute('stroke-width', '1.8');
    wire.path.setAttribute('stroke-dasharray', '8 7');
    wire.path.setAttribute('stroke-dashoffset', '0');
    wire.path.setAttribute('opacity', op);
    if (wire.marker) wire.marker.setAttribute('fill', color);
  }
  function idleWire(wire) {
    wire.path.setAttribute('stroke', '#c3cadb');
    wire.path.setAttribute('stroke-width', '2');
    wire.path.setAttribute('stroke-dasharray', '8 7');
    wire.path.setAttribute('stroke-dashoffset', '0');
    wire.path.setAttribute('opacity', '1');
    if (wire.marker) wire.marker.setAttribute('fill', '#c3cadb');
  }

  /* allgather 的边：一条边一条线，颜色跟着「这条边现在跑到第几轮」
     （轮次时间不重叠，取最后一个已开始的轮次就是它此刻的状态） */
  verbs.move.ringWires = function (S, scene, CH, sec) {
    (scene.wires || []).forEach(function (wd, i) {
      var wire = S.wires[wd.key || 'e' + i];
      var cur = null;
      scene.beats.forEach(function (b) {
        if (b.kind !== 'move') return;
        b.flows.forEach(function (f) {
          if ((f.wire || '') === (wd.key || 'e' + i) && sec >= CH.win[b.id].s) cur = { f: f, w: CH.win[b.id] };
        });
      });
      if (!cur) { idleWire(wire); return; }
      var color = P(cur.f.color).color;
      var flying = sec < cur.w.travelEnd;
      /* 余辉计时回灰（orch·trailChoreo）：与 move.render 同一套——抵达后保留
         数据色 ratio×飞行时长，然后回灰；此前 ring 是常亮到下一轮（漏接） */
      var glowWinR = (cur.w.travelEnd - cur.w.s) * (CV.spec(S.trailKey));
      if (flying) {
        wire.path.setAttribute('stroke', color);
        wire.path.setAttribute('stroke-width', '2.6');
        wire.path.setAttribute('stroke-dasharray', '9 7');
        wire.path.setAttribute('stroke-opacity', '1');
        wire.path.setAttribute('opacity', '1');
        wire.marker.setAttribute('fill', color);
      } else if (sec < cur.w.travelEnd + glowWinR) {
        wire.path.setAttribute('stroke', color);
        wire.path.setAttribute('stroke-width', '1.8');
        wire.path.setAttribute('stroke-dasharray', '8 7');
        wire.path.setAttribute('stroke-opacity', '1');
        wire.path.setAttribute('opacity', '.45');
        wire.marker.setAttribute('fill', color);
      } else {
        idleWire(wire);
        wire.path.setAttribute('stroke-opacity', '1');
      }
    });
  };

  /* ══════════ 编舞覆盖层：槽位状态（每页一种读法，由 scene.overlay 选） ══════════ */

  var popSeen = null;
  function seen() { return popSeen; }
  verbs.move.resetSeen = function () { popSeen = {}; };
  verbs.move.seenMap = function () {
    if (!popSeen) popSeen = {};
    return popSeen;
  };

  /* —— gather：目标卡 4 格，count 从 1 起跳（A 一开始就在）；在飞的那格显示占位 —— */
  /* 发送中变暗（方案 A 全站生效）：本卡作为发出方、其包尚在飞行 → 暗，否则复原。
     choreo 页看 scene.beats 的 move/copy 窗口；alltoall 看 CH.flows 分步。 */
  verbs.move.dimCards = function (S, scene, CH, sec) {
    Object.keys(S.cards).forEach(function (rk) {
      var r = Number(rk);
      var sending = false;
      (scene.beats || []).forEach(function (b) {
        if (b.kind !== 'move' && b.kind !== 'copy') return;
        var w = CH.win[b.id];
        if (!w) return;
        b.flows.forEach(function (f) {
          if (Number(String(f.from)[0]) === r && sec >= w.s && sec < w.travelEnd) sending = true;
        });
      });
      (CH.flows || []).forEach(function (list, q2) {
        var rd2 = (CH.rounds || [])[q2];
        if (!rd2) return;
        if (sec >= rd2.start && sec < rd2.arrive &&
            list.some(function (fl) { return fl.from === r; })) sending = true;
      });
      CV.beat.dim(S.cards[r], sending);
    });
  };

  verbs.move.overlayGather = function (S, scene, CH, sec) {
    var seenM = verbs.move.seenMap();
    var preAt = scene.preAt ? CH.win[scene.preAt].s : 0;

    var count = 1, active = null;
    scene.beats.forEach(function (b) {
      if (b.kind !== 'move') return;
      var w = CH.win[b.id];
      b.flows.forEach(function (f) {
        if (sec >= w.seatStart) count += 1;
        else if (sec >= w.s) active = f;
      });
    });

    Object.keys(S.chips).forEach(function (rk) {
      var r = Number(rk);
      var isTarget = scene.target === r;
      S.chips[r].forEach(function (s, i) {
        var data = null, act = false, hidden = false;
        if (isTarget) {
          if (i < count) data = DATA[i];
          else if (active && i === active.to[1]) { act = true; hidden = sec < preAt; }
          else hidden = sec < preAt;
        } else if (i === 0) {
          data = DATA[r];
        }
        CV.cast.set(s, data, { active: act, hidden: hidden });
      });
    });

    /* 卡片透明度：发送中 .6，其余每帧写回 1（与旧页同一条写入路径） */
    verbs.move.dimCards(S, scene, CH, sec);   /* 方案 A：发送中变暗全站生效 */
    Object.keys(S.cards).forEach(function (rk) {
      var r = Number(rk);
    });

    /* 落位弹跳（时刻比较，能跟进度条回拖） */
    scene.beats.forEach(function (b) {
      if (b.kind !== 'move') return;
      var w = CH.win[b.id];
      b.flows.forEach(function (f, fi) {
        var key = 'p' + b.id + '_' + fi;
        var slot = S.chips[f.to[0]][f.to[1]];
        if (sec >= w.seatStart && !seenM[key]) {
          seenM[key] = 1;
          CV.beat.seat(S.layers.fx, slot, P(f.color).color, w.popSec);
        } else if (sec < w.seatStart && seenM[key]) {
          delete seenM[key];
        }
      });
    });
  };

  /* —— scatter：源卡逐段腾空；目标卡就绪前隐藏 → 在飞占位 → 落位 —— */
  verbs.move.overlayScatter = function (S, scene, CH, sec) {
    verbs.move.dimCards(S, scene, CH, sec);   /* 方案 A：发送中变暗全站生效 */
    var seenM = verbs.move.seenMap();
    var readyAt = scene.preAt ? CH.win[scene.preAt].s : 0;
    var source = scene.target;   /* scatter 的 target 字段存的是「源」rank */

    /* 源卡：A 留在自己这里，其余一旦起飞就腾空 */
    var flows = [];
    scene.beats.forEach(function (b) {
      if (b.kind === 'move') b.flows.forEach(function (f) { flows.push({ f: f, w: CH.win[b.id] }); });
    });

    Object.keys(S.chips).forEach(function (rk) {
      var r = Number(rk);
      if (r === source) {
        S.chips[r].forEach(function (s, i) {
          if (i === 0) { CV.cast.set(s, DATA[0], {}); return; }
          var hit = null;
          flows.forEach(function (x) { if (x.f.from[0] === r && x.f.from[1] === i) hit = x; });
          CV.cast.set(s, hit && sec >= hit.w.s ? null : DATA[i], {});
        });
        return;
      }
      var hit = null;
      flows.forEach(function (x) { if (x.f.to[0] === r) hit = x; });
      var w = hit ? hit.w : null;
      var inFlight = w && sec >= w.s && sec < w.seatStart;
      var got = w && sec >= w.seatStart;
      CV.cast.set(S.chips[r][0], got ? DATA[r] : null, {
        active: inFlight,
        hidden: sec < readyAt
      });
    });

    scene.beats.forEach(function (b) {
      if (b.kind !== 'move') return;
      var w = CH.win[b.id];
      b.flows.forEach(function (f, fi) {
        var key = 'p' + b.id + '_' + fi;
        var slot = S.chips[f.to[0]][0];
        if (sec >= w.seatStart && !seenM[key]) {
          seenM[key] = 1;
          CV.beat.seat(S.layers.fx, slot, P(f.color).color, w.popSec);
        } else if (sec < w.seatStart && seenM[key]) {
          delete seenM[key];
        }
      });
    });
  };

  /* —— allgather：own / done / waiting / empty 四态；徽章 n/4；一批四块逐个弹 —— */
  verbs.move.overlayRing = function (S, scene, CH, sec) {
    verbs.move.dimCards(S, scene, CH, sec);   /* 方案 A：发送中变暗全站生效 */
    var seenM = verbs.move.seenMap();
    var ROUNDS = scene.rounds || 3;

    /* 剧本里 letter 是字母（'A'），引擎内部统一换成段下标 */
    function idxOf(letter) {
      for (var i = 0; i < DATA.length; i++) if (DATA[i].letter === letter) return i;
      return -1;
    }

    /* IN[r][q] = rank r 第 q 轮收到的流（带段下标）；q 是轮次，不是 beats 下标 */
    var IN = [[], [], [], []];
    var qi = 0;
    scene.beats.forEach(function (b) {
      if (b.kind !== 'move') return;
      b.flows.forEach(function (f) { IN[f.to[0]][qi] = { f: f, b: b, idx: idxOf(f.letter) }; });
      qi += 1;
    });

    function slotState(r, i) {
      if (i === r) return 'own';
      for (var q = 0; q < ROUNDS; q++) {
        var x = IN[r][q];
        if (!x || x.idx !== i) continue;
        var w = CH.win[x.b.id];
        if (sec >= w.seatStart) return 'done';
        if (sec >= w.s) return 'waiting';
        return 'empty';
      }
      return 'empty';
    }

    Object.keys(S.chips).forEach(function (rk) {
      var r = Number(rk);
      S.chips[r].forEach(function (s, i) {
        var st = slotState(r, i);
        if (st === 'own' || st === 'done') {
          CV.cast.set(s, { letter: DATA[i].letter, color: DATA[i].color }, {});
        } else if (st === 'waiting') {
          CV.cast.set(s, null, { active: true });
        } else {
          CV.cast.set(s, null, {});
        }
      });
    });

    /* 徽章：已收到几段（含自己那段的 1） */
    var got = 1;
    scene.beats.forEach(function (b) {
      if (b.kind === 'move' && sec >= CH.win[b.id].seatStart) got += 1;
    });
    var bt = got + '/' + (scene.parts || 4);
    Object.keys(S.cards).forEach(function (rk) {
      var c = S.cards[rk];
      if (c.badgeTx.textContent !== bt) c.badgeTx.textContent = bt;
    });

    verbs.move.ringWires(S, scene, CH, sec);

    /* 数据包按流飞行；同轮四包同飞同弹（2026-11-01 拍板，规范 08 双口径）：
       起弹时刻统一 = seatStart，不再按流下标错峰（错峰口径留给顺序到达的页） */
    scene.beats.forEach(function (b) {
      if (b.kind !== 'move') return;
      var w = CH.win[b.id];
      b.flows.forEach(function (f, fi) {
        var key = 'p' + b.id + '_' + fi;
        var at = w.seatStart;
        if (sec >= at && !seenM[key]) {
          seenM[key] = 1;
          /* 单颗弹跳时长 = popOne（popDur 分量）；若哪页声明 stagger 使
             popSec 变成整段窗口，这里仍取单颗分量 */
          CV.beat.seat(S.layers.fx, S.chips[f.to[0]][idxOf(f.letter)], P(f.color).color, w.popOne || w.popSec);
        } else if (sec < at && seenM[key]) {
          delete seenM[key];
        }
      });
    });
  };

  verbs.move.overlays = {
    gather: verbs.move.overlayGather,
    scatter: verbs.move.overlayScatter,
    ring: verbs.move.overlayRing
  };

  /* ══════════ 家族：alltoall ══════════
     每步整步做完（含块位错峰落位）才进下一步；12 条流按目的地分 4 步。 */

  verbs.move.timeline = function (scene) {
    var P4 = scene.parts || 4;
    /* 齿轮行：说明/收尾独立，一步的三段四步共用。落位窗口是 of 行
       （单颗 popDur + 3×seatGap 顺序到达错峰，分量全来自规范 08），
       k 杆整窗缩放，动画的错峰间隔与单颗秒都从这行的分量现取——
       不是写死字面量（P4 全站恒 4；改 parts 时 of 数组要跟着拼）。 */
    var rIntro = CV.timeRow(scene.id, { key: 'intro', label: '说明', sec: 0.9 });
    var rFly   = CV.timeRow(scene.id, { key: 'fly', label: '飞行', sec: 0.95 });
    var rFade  = CV.timeRow(scene.id, { key: 'fade', label: '送达淡出', of: 'packFade' });
    var rDly   = CV.timeRow(scene.id, { key: 'delay', label: '落位延迟', sec: CV.spec('seatDelay') });
    var rSeat  = CV.timeRow(scene.id, { key: 'seat', label: '落位窗口',
      of: ['popDur', 'seatGap', 'seatGap', 'seatGap'], specLabel: '弹跳+错峰' });
    var rGap   = CV.timeRow(scene.id, { key: 'gap', label: '步间停顿', sec: 0.4 });
    var rTail  = CV.timeRow(scene.id, { key: 'tail', label: '收尾', sec: 0.6 });
    rIntro.no = 1; rTail.no = P4 + 3;

    var TM = { init: rIntro.sec, fly: rFly.sec, gap: rGap.sec,
               fade: rFade.sec, delay: rDly.sec };
    /* 顺序到达错峰（规范 08 双口径）：第 i 块比第 i−1 块晚 seatGap×k 起跳，
       最后一块弹跳收尾 == 窗口末（of 分量之和 == 行秒，恒自洽）。
       串行律（steps 2.6）：抵达→淡出完→停 0.5→才开始落位（包 B 拍板，全站一致）。 */
    var SEATK = rSeat.subs[1].sec;    /* seatGap × k */
    var POPK  = rSeat.subs[0].sec;    /* popDur × k（单颗动画秒） */
    var STAG = (P4 - 1) * SEATK;

    var R = [];
    for (var q = 0; q < P4; q++) {
      var start = (q === 0) ? TM.init : (R[q - 1].done + TM.gap);
      var arrive = start + TM.fly;
      var fadeEnd = arrive + TM.fade;
      var seatBase = fadeEnd + TM.delay;
      R.push({ q: q, start: start, arrive: arrive,
               fadeEnd: fadeEnd, seatBase: seatBase, done: seatBase + rSeat.sec });
    }
    var TOTAL = R[P4 - 1].done + rTail.sec;

    var caps = scene.captions;
    var PLAN = [{ id: 'intro', s: 0, e: TM.init, text: caps[0] }];
    R.forEach(function (rd, q) {
      PLAN.push({ id: 'r' + (q + 1), s: rd.start, e: rd.done, text: caps[q + 1] });
    });
    PLAN.push({ id: 'tail', s: TOTAL - 0.6, e: TOTAL, text: caps[P4 + 1] });

    var steps = [], win = {};
    PLAN.forEach(function (p) {
      steps.push({ t: p.s / TOTAL, text: p.text, short: scene.shorts ? scene.shorts[steps.length] : undefined });
      win[p.id] = { s: p.s, e: p.e, kind: 'seg' };
    });

    return {
      total: TOTAL, steps: steps, win: win,
      rows: [rIntro,
        { type: 'group', label: '发送一步 ×' + P4, noTxt: '2–' + (P4 + 3), note: '每步共用这一组',
          rows: [rFly, rFade, rDly, rSeat, rGap] },
        rTail],
      rounds: R,
      seat: rSeat,   /* 落位窗口行（of 分量），narration 与 overlay 从这里取错峰/单颗秒 */
      flows: R.map(function (rd) {
        var list = [];
        for (var s = 0; s < P4; s++) if (s !== rd.q) list.push({ from: s, to: rd.q, seg: rd.q });
        return list;
      }),
      at: function (sec) { return TOTAL ? sec / TOTAL : 0; }
    };
  };

  verbs.move.buildAlltoall = function (S, scene) {
    S.trailKey = 'trailATA';
    DATA = S.data;
    var L = S.L, defs = S.defs;
    var P4 = scene.parts || 4;
    var c0 = L.slot;
    var totalW = P4 * c0.sw + (P4 - 1) * c0.gap;
    var blockH = c0.sh * 2 + L.rowGap;
    var areaY = L.hdr, areaH = L.card.h - L.hdr - 16;
    var padTop = (areaH - blockH) / 2;

    S.extra.upRow = {};
    S.extra.downRow = {};

    Object.keys(S.cards).forEach(function (rk) {
      var r = Number(rk);
      var geo = S.cards[r].geo;
      var x0 = geo.x + (geo.w - totalW) / 2;
      var yUp = geo.y + areaY + padTop;
      var yDn = yUp + c0.sh + L.rowGap;
      var up = [], dn = [];
      for (var i = 0; i < P4; i++) {
        up.push(CV.cast.slot(S.layers.chips, x0 + i * (c0.sw + c0.gap), yUp, c0.sw, c0.sh));
        dn.push(CV.cast.slot(S.layers.chips, x0 + i * (c0.sw + c0.gap), yDn, c0.sw, c0.sh));
      }
      S.extra.upRow[r] = up;
      S.extra.downRow[r] = dn;
    });

    /* 六条无箭头直线：横向边落在两排缓冲之间的空白带居中处 */
    (scene.wires || []).forEach(function (wd) {
      var ga = S.cards[wd.a].geo, gb = S.cards[wd.b].geo;
      var wireY = ga.y + areaY + padTop + c0.sh + L.rowGap / 2;
      var e = CV.hitEnds(ga, gb, wireY);
      var w = CV.payload.link(S.layers.wires, { d: CV.linePath(e) });
      S.wires[wd.a + '_' + wd.b] = { path: w.path, len: w.len, sx: e.sx, sy: e.sy, tx: e.tx, ty: e.ty };
    });

    /* 数据包：每条流一个（12 个），字母/颜色是发送方的 */
    var tl = S.CH;
    tl.flows.forEach(function (list, q) {
      list.forEach(function (f) {
        S.pkts[q + '_' + f.from] = CV.payload.packet(S.layers.fx, {
          letter: DATA[f.from].letter, color: DATA[f.from].color
        });
      });
    });
  };

  verbs.move.overlayAlltoall = function (S, scene, CH, sec) {
    var seenM = verbs.move.seenMap();
    var R = CH.rounds;
    var P4 = scene.parts || 4;
    var SEATK = CH.seat.subs[1].sec;   /* 错峰间隔 = seatGap × k（落位行分量） */
    var POPK  = CH.seat.subs[0].sec;   /* 单颗弹跳秒 = popDur × k */
    var L = S.L;
    var c0 = L.slot;
    var totalW = P4 * c0.sw + (P4 - 1) * c0.gap;
    var blockH = c0.sh * 2 + L.rowGap;
    var areaY = L.hdr, areaH = L.card.h - L.hdr - 16;
    var padTop = (areaH - blockH) / 2;

    verbs.move.dimCards(S, scene, CH, sec);   /* 方案 A：发送中变暗全站生效 */
    Object.keys(S.cards).forEach(function (rk) {
      var r = Number(rk);
      /* 徽章看下排（结果排）：轮到自己当接收方才 0/4 → 4/4 */
      var bt = (sec >= R[r].arrive ? P4 : 0) + '/' + P4;
      if (S.cards[r].badgeTx.textContent !== bt) S.cards[r].badgeTx.textContent = bt;

      /* 上排：第 j 步开始那一刻发出第 j 片 */
      S.extra.upRow[r].forEach(function (s, j) {
        if (sec >= R[j].start) CV.cast.set(s, null, {});
        else CV.cast.set(s, { letter: DATA[r].letter, color: DATA[r].color, sub: j }, {});
      });

      /* 下排：轮到自己当接收方的第 r 步才一次填满，一块一块落（串行律：
         淡出+延迟完才从 seatBase 起落，块间仍按 seatGap×k 错峰） */
      S.extra.downRow[r].forEach(function (s, i) {
        var at = CV.seatAt(i, R[r].seatBase, SEATK);
        if (sec < at) {
          CV.cast.set(s, null, sec >= R[r].start ? { active: true } : {});
          delete seenM['d' + r + i];
        } else {
          CV.cast.set(s, { letter: DATA[i].letter, color: DATA[i].color, sub: r }, {});
          var key = 'd' + r + i;
          if (!seenM[key]) { seenM[key] = 1; CV.beat.seat(S.layers.fx, s, null, POPK); }
        }
      });

      /* 行几何跟卡片走（这页卡片不长高，只在对齐时写一次即可，但逐帧写也无害） */
      var geo = S.cards[r].geo;
      var x0 = geo.x + (geo.w - totalW) / 2;
      var yUp = geo.y + areaY + padTop;
      var yDn = yUp + c0.sh + L.rowGap;
      S.extra.upRow[r].forEach(function (s, i) {
        var nx = x0 + i * (c0.sw + c0.gap);
        if (s.x !== nx) { s.rect.setAttribute('x', nx); s.text.setAttribute('x', nx + s.w / 2); s.x = nx; s.cx = nx + s.w / 2; }
        if (s.y !== yUp) { s.rect.setAttribute('y', yUp); s.text.setAttribute('y', yUp + s.h / 2); s.y = yUp; s.cy = yUp + s.h / 2; }
      });
      S.extra.downRow[r].forEach(function (s, i) {
        var nx = x0 + i * (c0.sw + c0.gap);
        if (s.x !== nx) { s.rect.setAttribute('x', nx); s.text.setAttribute('x', nx + s.w / 2); s.x = nx; s.cx = nx + s.w / 2; }
        if (s.y !== yDn) { s.rect.setAttribute('y', yDn); s.text.setAttribute('y', yDn + s.h / 2); s.y = yDn; s.cy = yDn + s.h / 2; }
      });
    });

    /* 先统一退灰（必须在流之前，否则后一步会把前一步刚点亮的线抹掉） */
    (scene.wires || []).forEach(function (wd) {
      var w = S.wires[wd.a + '_' + wd.b];
      w.path.setAttribute('stroke', '#c3cadb');
      w.path.setAttribute('stroke-width', '1.4');
      w.path.setAttribute('stroke-dasharray', '6 6');
      w.path.setAttribute('opacity', '.9');
    });

    CH.flows.forEach(function (list, q) {
      var rd = R[q];
      var active = sec >= rd.start && sec < rd.arrive;
      var arrived = sec >= rd.arrive;

      list.forEach(function (f) {
        var wire = S.wires[Math.min(f.from, f.to) + '_' + Math.max(f.from, f.to)];
        var p = S.pkts[q + '_' + f.from];
        var col = DATA[f.from].color;
        var rev = f.from > f.to;

        if (active) {
          var e = CV.easeInOutQuad((sec - rd.start) / (rd.arrive - rd.start));
          CV.payload.place(p, wire, e, rev);
          wire.path.setAttribute('stroke', col);
          wire.path.setAttribute('stroke-width', '2.6');
          wire.path.setAttribute('stroke-dasharray', '9 7');
          wire.path.setAttribute('opacity', '1');
        } else if (arrived) {
          /* 先摆到终点再淡出：拖进度条直接跳到「已到达」时，包不能停在原点。
             余辉计时回灰（orch·trailATA）：抵达后保留数据色 ratio×飞行时长 */
          CV.payload.place(p, wire, 1, rev);
          CV.payload.fadeOut(p, sec - rd.arrive);
          var glowWinA = (rd.arrive - rd.start) * CV.spec('trailATA');
          var glowingA = sec - rd.arrive <= glowWinA;
          wire.path.setAttribute('stroke', glowingA ? col : '#c3cadb');
          wire.path.setAttribute('stroke-width', glowingA ? '1.6' : '1.4');
          wire.path.setAttribute('stroke-dasharray', '6 6');
          wire.path.setAttribute('opacity', glowingA ? '.3' : '.9');
        } else {
          p.g.setAttribute('opacity', '0');
        }
      });
    });
  };
})(window.CV = window.CV || {});
