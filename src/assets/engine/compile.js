/* ============================================================
   src/assets/engine/compile.js · ⑥过程 的实现（剧本 → 时间轴）
   ------------------------------------------------------------
   治理文档：docs/规范/05-过程.md。展开为
     events（瞬时状态事件）/ tweens（连续量）/ steps（解说分节+行）
     / gear（时序相行）/ packets（运动体清单）/ wires（连线几何）。
   顺序律（⑥§4）由构造保证：相链一律串行取上一相的结束时刻。
   编排秒集中在 ORCH 与 scene.orch，逐条注明⑥出处（01守则 §1.2）。
   已知偏差 D2：⑥§6.5 快照值与公式链不一致，按公式链实现。
   ============================================================ */
(function (CV) {
  'use strict';

  function sp(k) { return CV.spec(k); }
  function fmt(v) { return (Math.round(v * 100) / 100).toFixed(2); }

  /* ── 编排秒（⑥逐页表「编排秒」栏）── */
  var ORCH = {
    roundRest: { choreo: 1.00, family: 0.55, ata: 0.40 },
    tail: { gather: 2.00, scatter: 2.00, broadcast: 2.00, allgather: 0.60, alltoall: 0.60 },
    stay: { reduce: 2.00, allreduce: 0.95, reducescatter: 2.00 },
    flight: { reduce: 1.70, allreduce: 1.10, reducescatter: 1.70, alltoall: 0.95 }
  };

  /* ── 时间轴容器与助手 ── */
  function TL() { return { steps: [], events: [], tweens: [], gear: [], packets: [], wires: [], lanes: {}, wirePaths: {}, total: 0 }; }
  function step(T, label, s, e, src) {
    var st = { label: label, s: s, e: e, src: src || '', rows: [] };
    T.steps.push(st); return st;
  }
  function row(st, s, e, what, res) { st.rows.push([s, e, what, res]); }
  function restRow(st, s, e, text) { row(st, s, e, '画面 · 静止', text); }
  function ev(T, t, fn) { T.events.push({ t: t, fn: fn }); }
  function tw(T, kind, who, t0, t1, data) { T.tweens.push({ kind: kind, who: who, t0: t0, t1: t1, data: data || {} }); }
  function gear(T, no, label, dur, src, head) { T.gear.push({ no: no, label: label, dur: dur, src: src, head: !!head }); }
  function pk(T, o) { o.id = 'p' + T.packets.length; T.packets.push(o); return o.id; }

  function setSlot(r, ri, i, patch) {
    return function (S) { var c = S.slots[r + ',' + ri + ',' + i]; for (var k in patch) c[k] = patch[k]; };
  }
  function setWire(wid, st, color) {
    return function (S) { S.wires[wid] = { st: st, color: color }; };
  }
  function setCard(r, patch) {
    return function (S) { for (var k in patch) S.cards[r][k] = patch[k]; };
  }
  function colorOf(r) { return sp('rank' + 'ABCD'[r]); }

  /* ── 几何：编译期路径计算（③公式，消费 geom）── */
  function slotCenter(scene, cards, r, ri, i, calc) {
    var rel = CV.slotPos({ w: cards[r].w }, scene.rows[r], ri, i, scene.rows[r]);
    return {
      x: cards[r].x + rel.x + sp('dtSlotSw') / 2,
      y: cards[r].y + rel.y + (ri === 1 && calc ? CV.layerH() : 0) + sp('dtSlotSh') / 2
    };
  }
  function spreadT(scene, cards, k) {
    var step = sp('dtSlotSh') * 0.7 / cards[0].h;
    return 0.5 + (k - 2) * step;   /* k = 流序号 1..3 */
  }
  /* 流的飞行路径：col34 走 S 弧（散点在宽卡侧），grid 走直连 */
  function flowPath(scene, cards, flow, k) {
    var fc = cards[flow.from], tc = cards[flow.to];
    if (scene.preset === 'col34') {
      var wideSide = scene.rows[flow.from] > 1 ? 'from' : 'to';
      var a, b;
      if (wideSide === 'from') {
        a = CV.edgePoint(fc, fc.x < tc.x ? 'right' : 'left', spreadT(scene, cards, k));
        b = CV.edgePoint(tc, fc.x < tc.x ? 'left' : 'right');
      } else {
        a = CV.edgePoint(fc, fc.x < tc.x ? 'right' : 'left');
        b = CV.edgePoint(tc, fc.x < tc.x ? 'left' : 'right', spreadT(scene, cards, k));
      }
      return CV.arcPath(a, b);
    }
    var ends = CV.gridEnds(cards, flow.from, flow.to);
    var start = (flow.from === flow.pair[0]) ? ends[0] : ends[1];
    var end = (start === ends[0]) ? ends[1] : ends[0];
    return CV.line(start, end);
  }

  /* ══════════ 开场：说明 + 预留缓冲（⑥6.x 逐页）══════════ */
  function introOpen(T, scene, cards) {
    var s1 = step(T, '说明', 0, scene.orch.intro, '编排秒');
    restRow(s1, 0, scene.orch.intro, scene.rest.intro);
    gear(T, '1', '说明', fmt(scene.orch.intro) + 's', '编排秒');
    var t = scene.orch.intro;

    var growCards = scene.growCards || null;
    var s2 = step(T, '预留缓冲', t, 0, growCards ? '开场公式' : '编排秒');
    var t2 = t;
    if (growCards) {
      growCards.forEach(function (r) {
        var h0 = CV.cardH(1, false), h1 = CV.cardH(2, false);
        tw(T, 'grow', { r: r }, t2, t2 + sp('cardDur'), { h0: h0, h1: h1 });
        row(s2, t2, t2 + sp('cardDur'), CV.cardName(scene, r) + ' · 长高' + (growCards.length > 1 ? '（同时）' : ''), '一排变两排');
      });
      t2 += sp('cardDur') + sp('rowLull');
      var j = 0;
      growCards.forEach(function (r) {
        for (var i = 0; i < 4; i++) {
          var t0 = t2 + j * (sp('blockDur') + sp('blockGap'));
          ev(T, t0, setSlot(r, 1, i, { type: 'empty' }));
          tw(T, 'slotOp', { r: r, ri: 1, i: i }, t0, t0 + sp('blockDur'), { from: 0, to: 1 });
          if (r === growCards[0]) {
            row(s2, t0, t0 + sp('blockDur'), '第二排-' + (i + 1) + ' · 显形', '接收位（紫底 ···）');
          }
          j++;
        }
      });
      t2 += 3 * (sp('blockDur') + sp('blockGap')) + sp('blockDur');
      if (scene.id === 'allreduce') {
        restRow(s2, t2, t2 + 0.25, scene.rest.open);
        t2 += 0.25;   /* ⑥6.6 预留缓冲 = 开场公式 + 0.25（编排秒） */
      }
    } else {
      var perCard = {};
      scene.hiddenSlots.forEach(function (h) {
        ev(T, t2, setSlot(h.r, h.ri, h.i, { type: 'empty' }));
        tw(T, 'slotOp', { r: h.r, ri: h.ri, i: h.i }, t2, t2 + sp('revealDur'), { from: 0, to: 1 });
        var key = h.r + ',' + h.ri;
        (perCard[key] = perCard[key] || []).push(h);
      });
      Object.keys(perCard).forEach(function (key) {
        var hs = perCard[key], h = hs[0];
        var name = h.ri === 1 ? CV.cardName(scene, h.r) + ' 下排' : CV.slotName(scene, h.r, h.i);
        var many = hs.length > 1 && (h.ri === 1 || scene.rows[h.r] > 1);
        row(s2, t2, t2 + sp('revealDur'), name + ' · 显形' + (many ? '（' + hs.length + ' 格）' : ''),
            h.ri === 1 ? '4 个空格' : '空格');
      });
      t2 += sp('revealDur');
      /* 编排窗补足到⑥的 open 秒（尾接静止行，⑥6.x 各页） */
      var openEnd = t + scene.orch.open;
      restRow(s2, t2, openEnd, scene.rest.open);
      t2 = openEnd;
    }
    s2.e = t2;
    gear(T, '2', '预留缓冲', fmt(t2 - t) + 's', growCards ? '开场公式' : '编排秒');
    return t2;
  }

  /* ══════════ 传递相链（⑥§5 标准相序）══════════ */
  /* o = { s, st, from, to, wid, wireLabel, pktId, pktLabel, letter, path, flight,
           hole, dim, toRecv, land, seatType, landLabel, popLabel, landRes, arriveRes } */
  function transfer(T, scene, o) {
    var s = o.s, st = o.st;
    var flight = o.flight;
    var takeoffSec = flight * sp('takeoffFade');
    var fadeEnd = s + flight + sp('packFade');
    var landT = fadeEnd + sp('seatDelay');
    var lastLand = o.seatType === 'stagger' ? landT + (o.land.length - 1) * sp('seatGap') : landT;
    var popEnd = lastLand + sp('popDur');
    var color = colorOf(o.from);

    if (o.hole) o.hole.forEach(function (h) { ev(T, s, setSlot(h.r, h.ri, h.i, { type: 'empty' })); });
    if (o.dim) tw(T, 'cardOp', { r: o.from }, s, s + sp('dimDur'), { from: 1, to: 0.6 });
    ev(T, s, setWire(o.wid, 'lit', color));
    o.toRecv.forEach(function (h) {
      ev(T, s, setSlot(h.r, h.ri, h.i, { type: 'recv' }));
      tw(T, 'slotOp', { r: h.r, ri: h.ri, i: h.i }, s, s + sp('dimDur'), { from: 0, to: 1 });
    });
    tw(T, 'fly', { pkt: o.pktId }, s, s + flight, { path: o.path, ease: true });

    ev(T, s + flight, setWire(o.wid, 'glow', color));
    tw(T, 'pktFade', { pkt: o.pktId }, s + flight, fadeEnd, { from: 1, to: 0 });
    ev(T, fadeEnd + flight * sp('trailRatio'), setWire(o.wid, 'rest'));
    if (o.dim) tw(T, 'cardOp', { r: o.from }, s + flight, s + flight + sp('dimDur'), { from: 0.6, to: 1 });

    /* 行（⑤句式；同刻组内动作同刻开始） */
    if (o.hole) {
      row(st, s, null, CV.cardName(scene, o.from) + ' · 交空' + (o.hole.length > 1 ? '（' + o.hole.length + ' 格）' : ''), '空格');
    }
    if (o.dim) row(st, s, s + sp('dimDur'), CV.cardName(scene, o.from) + ' · 变暗', '半透明');
    row(st, s, s + sp('wireFade'), o.wireLabel + ' · 点亮', CV.COLOR_WORD[o.letter] + '虚线');
    (function () {
      var byCard = {};
      o.toRecv.forEach(function (h) { (byCard[h.r] = byCard[h.r] || []).push(h); });
      Object.keys(byCard).forEach(function (r) {
        var hs = byCard[r], h = hs[0];
        row(st, s, s + sp('dimDur'),
          (h.ri === 1 ? CV.cardName(scene, h.r) + ' 下排' : CV.slotName(scene, h.r, h.i)) +
          ' · 转接收位' + (hs.length > 1 ? '（' + hs.length + ' 格）' : ''), '紫底 ···');
      });
    })();
    row(st, s, s + takeoffSec, o.pktLabel + ' · 起飞', o.wireLabel + ' 起点');
    row(st, s + takeoffSec, s + flight, o.pktLabel + ' · 飞行', '沿' + o.wireLabel);
    row(st, s + flight, null, o.pktLabel + ' · 抵达', o.arriveRes || '箭头尖');
    row(st, s + flight, fadeEnd, o.pktLabel + ' · 淡出', '透明');
    row(st, s + flight, null, o.wireLabel + ' · 余辉', '保留数据色');
    if (o.dim) row(st, s + flight, s + flight + sp('dimDur'), CV.cardName(scene, o.from) + ' · 复原', '恢复');
    row(st, fadeEnd, landT, '画面 · 静止', '保持接收位');

    o.land.forEach(function (L, j) {
      var lt = o.seatType === 'stagger' ? landT + j * sp('seatGap') : landT;
      ev(T, lt, setSlot(L.r, L.ri, L.i, L.state));
      tw(T, 'pop', { r: L.r, ri: L.ri, i: L.i }, lt, lt + sp('popDur'));
    });
    row(st, landT, null, o.landLabel, o.landRes || '数据块 ' + o.land.map(function (L) { return L.state.ch; }).join(' '));
    row(st, lastLand, popEnd, o.popLabel, o.seatType === 'stagger' ? '最后一块落定' : '落定');
    return popEnd;
  }

  /* ══════════ 计算相链（⑥§5）：长高→浮现→折进→框灭→收层 ══════════ */
  function calcChain(T, scene, cards, targets, round, t0, segs) {
    var st = T.steps[T.steps.length - 1];
    var t = t0;
    targets.forEach(function (r) {
      var h0 = CV.cardH(2, false), h1 = CV.cardH(2, true);
      tw(T, 'grow', { r: r }, t, t + sp('growDur'), { h0: h0, h1: h1 });
      ev(T, t, setCard(r, { calc: true }));
      row(st, t, t + sp('growDur'), CV.cardName(scene, r) + ' · 长高', '腾出计算层');
    });
    t += sp('growDur');
    targets.forEach(function (r) {
      tw(T, 'box', { r: r }, t, t + sp('calcFade'), { from: 0, to: 1 });
      row(st, t, t + sp('calcFade'), '计算框 · 浮现', 'sum · avg · max · min');
    });
    t += sp('calcFade');
    var natural = sp('fuseDur') + (segs - 1) * sp('mergeGap');
    var win = Math.max(natural, sp('holdDur'));
    var sup = CV.SUP[round + 1];
    targets.forEach(function (r) {
      for (var i = 0; i < segs; i++) {
        var s0 = t + i * sp('mergeGap');
        var fid = pk(T, { color: colorOf(r), kind: 'sum', sumN: round, sub: 'ABCD'[i] });
        var p1 = slotCenter(scene, cards, r, 1, i, true);
        var p0 = slotCenter(scene, cards, r, 0, i, true);
        tw(T, 'fly', { pkt: fid }, s0, s0 + sp('fuseDur'), { path: CV.line(p1, p0), ease: false });
        ev(T, s0, setSlot(r, 1, i, { type: 'empty' }));
        ev(T, s0 + sp('fuseDur'), setSlot(r, 0, i, { type: 'sum', n: round + 1, sub: 'ABCD'[i] }));
      }
      row(st, t, t + natural, segs + ' 段 · 折进（错峰）', 'Σ' + 'ABCD'.slice(0, segs) + sup);
    });
    t += win;
    /* 计算结束（⑥§4.6：方框先灭 → 卡片再缩回）；按相分组保证行序 */
    targets.forEach(function (r) {
      tw(T, 'box', { r: r }, t, t + sp('calcFade'), { from: 1, to: 0 });
      row(st, t, t + sp('calcFade'), '计算框 · 淡出', '透明');
    });
    var downT = t + sp('calcFade');
    targets.forEach(function (r) {
      var h0 = CV.cardH(2, true), h1 = CV.cardH(2, false);
      tw(T, 'grow', { r: r }, downT, downT + sp('shrinkDur'), { h0: h0, h1: h1 });
      ev(T, downT + sp('shrinkDur'), setCard(r, { calc: false }));
      row(st, downT, downT + sp('shrinkDur'), '计算态卡 · 收层', '退回双排卡');
    });
    return downT + sp('shrinkDur');
  }

  /* ══════════ 收场（⑥§4.6 唯一顺序）══════════ */
  function collapse(T, scene, withdrawSets, stay) {
    var t = T.steps[T.steps.length - 1].e;   /* 收场接在最后一步末尾（不用 T.total） */
    var st = step(T, '收场', t, 0, '收场公式 + 停驻');
    var t2 = t;
    var first = withdrawSets[0];
    var maxN = 0;
    withdrawSets.forEach(function (w) {
      maxN = Math.max(maxN, w.slots.length);
      w.slots.forEach(function (i, k) {
        var t0 = t2 + k * (sp('blockDur') + sp('blockGap'));
        ev(T, t0, setSlot(w.r, 1, i, { type: 'hidden' }));
        tw(T, 'slotOp', { r: w.r, ri: 1, i: i }, t0, t0 + sp('blockDur'), { from: 1, to: 0 });
      });
    });
    var wDur = (maxN - 1) * (sp('blockDur') + sp('blockGap')) + sp('blockDur');
    row(st, t2, t2 + wDur, '第二排 · 逐块撤（从右往左）', '接收位撤光');
    t2 += wDur + sp('rowPause');
    var recedeEnd = t2 + sp('cardDur');
    tw(T, 'grow', { r: 'all' }, t2, recedeEnd, { h0: CV.cardH(2, false), h1: CV.cardH(1, false) });
    row(st, t2, recedeEnd, scene.id === 'reduce' ? '四槽卡 · 收回' : '四张卡 · 收回', '单排卡');
    t2 = recedeEnd + stay;
    restRow(st, recedeEnd, t2, scene.rest.tail);
    st.e = t2;
    gear(T, '末', '完成（收场）', fmt(t2 - t) + 's', '收场公式 + 停驻');
    T.total = t2;
  }

  /* ══════════ 页型：choreo（gather / scatter / broadcast）══════════ */
  function buildChoreo(T, scene, cards) {
    var t = introOpen(T, scene, cards);
    for (var k = 1; k <= 3; k++) {
      var flow = scene.flows[k - 1];
      var s = t;
      var pkt = pk(T, { color: colorOf(flow.from), kind: flow.kind, ch: flow.ch, letters: flow.letters });
      var st = step(T, '第 ' + (k + 1) + ' 步 · ' + flow.label, s, 0, '组内相 + 编排合成');
      var land = flow.land.map(function (L) { return { r: L.r, ri: 0, i: L.i, state: CV.slotDecode(L.code) }; });
      var single = land.length === 1;
      var popEnd = transfer(T, scene, {
        s: s, st: st, from: flow.from, to: flow.to, wid: flow.wire, wireLabel: flow.wireLabel,
        pktId: pkt, pktLabel: CV.packetName(scene, { kind: flow.kind, ch: flow.ch }),
        letter: flow.letter, path: flowPath(scene, cards, flow, k), flight: sp('packDur'),
        hole: flow.hole, dim: scene.id === 'gather', toRecv: flow.toRecv,
        land: land, seatType: flow.kind === 'whole' ? 'whole' : 'single',
        landLabel: single ? CV.slotName(scene, land[0].r, land[0].i) + ' · 落位'
                          : CV.cardName(scene, land[0].r) + ' · 落位（4 格）',
        popLabel: single ? CV.slotName(scene, land[0].r, land[0].i) + ' · 弹跳'
                         : CV.cardName(scene, land[0].r) + ' · 弹跳',
        landRes: single ? '数据块 ' + flow.ch : '数据块 A B C D'
      });
      var end = popEnd + ORCH.roundRest.choreo;
      restRow(st, popEnd, end, scene.rest['r' + k]);
      st.e = end;
      if (k === 1) {
        gear(T, '3–5', '发送数据 ×3', '', '组 · 每趟共用这一组', true);
        gear(T, '', '├ 飞行（数据包）', '', 'packDur + packFade');
        gear(T, '', '├ 落位延迟', '', 'seatDelay');
        gear(T, '', '├ 落位弹跳（' + (scene.id === 'broadcast' ? '整包' : '单颗') + '）', '', 'popDur');
        gear(T, '', '└ 轮歇', fmt(ORCH.roundRest.choreo) + 's', '编排秒');
      }
      t = end;
    }
    var stT = step(T, '完成', t, t + ORCH.tail[scene.id], '编排秒');
    restRow(stT, t, t + ORCH.tail[scene.id], scene.rest.tail);
    gear(T, '6', '完成', fmt(ORCH.tail[scene.id]) + 's', '编排秒');
    T.total = t + ORCH.tail[scene.id];
  }

  /* ══════════ 页型：allgather（环上轮转，②环形）══════════ */
  function directedLine(cards, from, to) {
    var ends = CV.gridEnds(cards, from, to);
    var a = cards[from], b = cards[to];
    var fromFirst;
    if (Math.abs(a.x - b.x) >= Math.abs(a.y - b.y)) fromFirst = a.x < b.x;
    else if (Math.abs(a.x - b.x) < 1) fromFirst = a.y < b.y;
    else fromFirst = true;   /* 对角：中心线，方向无视觉差 */
    var start = fromFirst ? ends[0] : ends[1];
    var end = fromFirst ? ends[1] : ends[0];
    return CV.line(start, end);
  }
  function buildAllgather(T, scene, cards) {
    var RING = [0, 1, 3, 2];
    function prevOnRing(r) { return RING[(RING.indexOf(r) + 3) % 4]; }
    var edgeColor = { w01: 0, w13: 1, w32: 3, w20: 2 };
    var t = introOpen(T, scene, cards);
    for (var k = 1; k <= 3; k++) {
      var s = t;
      var st = step(T, '第 ' + (k + 1) + ' 步 · 第 ' + k + ' 轮', s, 0, '组内相 + 编排合成');
      Object.keys(edgeColor).forEach(function (w) { ev(T, s, setWire(w, 'lit', colorOf(edgeColor[w]))); });
      row(st, s, s + sp('wireFade'), '4 条环边 · 点亮', '各自的数据色');
      RING.forEach(function (r) {
        var to = RING[(RING.indexOf(r) + 1) % 4];
        var p = r;
        for (var b = 0; b < k - 1; b++) p = prevOnRing(p);
        var ch = 'ABCD'[p];
        var pkt = pk(T, { color: colorOf(r), kind: 'single', ch: ch });
        tw(T, 'fly', { pkt: pkt }, s, s + sp('packDur'), { path: directedLine(cards, r, to), ease: true });
      });
      row(st, s, s + sp('packDur') * sp('takeoffFade'), '单体包 · 起飞（4 个）', '各环边起点');
      row(st, s + sp('packDur') * sp('takeoffFade'), s + sp('packDur'), '单体包 · 飞行', '沿环边');
      var fadeEnd = s + sp('packDur') + sp('packFade');
      row(st, s + sp('packDur'), null, '单体包 · 抵达', '箭头尖');
      row(st, s + sp('packDur'), fadeEnd, '单体包 · 淡出', '透明');
      row(st, s + sp('packDur'), null, '4 条环边 · 余辉', '保留数据色');
      ev(T, fadeEnd + sp('packDur') * sp('trailRatio'), function (S) {
        ['w01', 'w13', 'w32', 'w20'].forEach(function (w) { S.wires[w] = { st: 'rest' }; });
      });
      var landT = fadeEnd + sp('seatDelay');
      row(st, fadeEnd, landT, '画面 · 静止', '保持接收位');
      RING.forEach(function (r) {
        var to = RING[(RING.indexOf(r) + 1) % 4];
        var p = r;
        for (var b = 0; b < k - 1; b++) p = prevOnRing(p);
        ev(T, landT, setSlot(to, 0, k, { type: 'block', ch: 'ABCD'[p] }));
        tw(T, 'pop', { r: to, ri: 0, i: k }, landT, landT + sp('popDur'));
      });
      var popEnd = landT + sp('popDur');
      row(st, landT, null, '四张卡 · 落位（齐弹）', scene.recvLists[k - 1]);
      row(st, landT, popEnd, '四张卡 · 弹跳', '4 块同时落定');
      /* ⑥6.4：每轮 4.15s 含轮歇（第 3 轮的轮歇后直接进完成 0.60） */
      var end = popEnd + ORCH.roundRest.choreo;
      restRow(st, popEnd, end, k < 3 ? ('四张卡各 ' + (k + 1) + ' 块') : '四张卡都集齐 A B C D');
      st.e = end;
      if (k === 1) {
        gear(T, '3–5', '发送数据 ×3', '', '组 · 每轮共用这一组', true);
        gear(T, '', '├ 飞行（数据包）', '', 'packDur + packFade');
        gear(T, '', '├ 落位延迟', '', 'seatDelay');
        gear(T, '', '├ 落位弹跳（齐弹）', '', 'popDur');
        gear(T, '', '└ 轮歇', fmt(ORCH.roundRest.choreo) + 's', '编排秒');
      }
      t = end;
    }
    var stT = step(T, '完成', t, t + ORCH.tail.allgather, '编排秒');
    restRow(stT, t, t + ORCH.tail.allgather, scene.rest.tail);
    gear(T, '6', '完成', fmt(ORCH.tail.allgather) + 's', '编排秒');
    T.total = t + ORCH.tail.allgather;
  }

  /* ══════════ 页型：reduce（链式 + 计算相链）══════════ */
  function buildReduce(T, scene, cards) {
    var t = introOpen(T, scene, cards);
    for (var k = 1; k <= 3; k++) {
      var s = t, from = k;
      var pkt = pk(T, { color: colorOf(from), kind: 'whole', letters: ['A', 'B', 'C', 'D'] });
      var st = step(T, '第 ' + (k + 1) + ' 步 · r' + k + ' 的整份', s, 0, '组内相 + 编排合成');
      var hole = [0, 1, 2, 3].map(function (i) { return { r: from, ri: 0, i: i }; });
      var toRecv = [0, 1, 2, 3].map(function (i) { return { r: 0, ri: 1, i: i }; });
      var land = [0, 1, 2, 3].map(function (i) {
        return { r: 0, ri: 1, i: i, state: { type: 'block', ch: 'ABCD'[i] } };
      });
      var popEnd = transfer(T, scene, {
        s: s, st: st, from: from, to: 0, wid: 'w' + (k - 1), wireLabel: '弧线 ' + k,
        pktId: pkt, pktLabel: '整份包', letter: 'A',
        path: flowPath(scene, cards, { from: from, to: 0, pair: [from, 0] }, k),
        flight: ORCH.flight.reduce, hole: hole, toRecv: toRecv,
        land: land, seatType: 'whole',
        landLabel: '第二排 · 落位（整包）', landRes: '4 块同时弹出',
        popLabel: '第二排 · 弹跳'
      });
      var t2 = calcChain(T, scene, cards, [0], k, popEnd, 4);
      var end = t2 + (k < 3 ? ORCH.roundRest.family : 0);
      if (k < 3) restRow(st, t2, end, '上一份已折进累加器（Σ 更浓一档），下一份还没起飞');
      st.e = end;
      if (k === 1) {
        gear(T, '3–9', '发送数据 ×3', '', '组 · 每趟共用这一组', true);
        gear(T, '', '├ 飞行（数据包）', '', '编排 1.70 + packFade');
        gear(T, '', '├ 落位延迟', '', 'seatDelay');
        gear(T, '', '├ 落位弹跳（整包）', '', 'popDur');
        gear(T, '', '├ 计算开始', '', 'growDur + calcFade');
        gear(T, '', '├ 计算中', '', 'max(逐段和, holdDur)');
        gear(T, '', '└ 计算结束', '', 'calcFade + shrinkDur');
      }
      t = end;
    }
    collapse(T, scene, [{ r: 0, slots: [3, 2, 1, 0] }], ORCH.stay.reduce);
  }

  /* ══════════ 页型：allreduce（倍增互换 + 齐弹 + 计算）══════════ */
  function buildExchange(T, scene, cards) {
    var all4 = [0, 1, 2, 3];
    var t = introOpen(T, scene, cards);
    for (var k = 1; k <= 2; k++) {
      var round = k;   /* 惰性回调捕获本轮号（var k 循环结束后 = 3，直接引用会越界） */
      var s = t;
      var st = step(T, '第 ' + (k + 1) + ' 步 · 第 ' + k + ' 轮（' + (k === 1 ? '横向' : '纵向') + '互换）', s, 0, '组内相 + 编排合成');
      var pairs = CV.FACTS.allreduce.rounds.edges[k - 1];
      var wname = k === 1 ? '两条横向直连' : '两条纵向直连';
      pairs.forEach(function (pair, pi) {
        ev(T, s, setWire(scene.wireIds[k - 1][pi], 'lit', colorOf(pair[0])));
      });
      pairs.forEach(function (pair, pi) {
        [pair[0], pair[1]].forEach(function (from) {
          var pkt = pk(T, { color: colorOf(from), kind: 'whole', letters: ['A', 'B', 'C', 'D'] });
          var lane = scene.lanePaths[k - 1][pi][from === pair[0] ? 0 : 1];
          tw(T, 'fly', { pkt: pkt }, s, s + ORCH.flight.allreduce, { path: lane, ease: true });
        });
      });
      var flight = ORCH.flight.allreduce;
      row(st, s, s + sp('wireFade'), wname + ' · 点亮（两对同时）', '数据色');
      row(st, s, s + flight * sp('takeoffFade'), '整份包 · 起飞（4 个）', '各车道起点');
      row(st, s + flight * sp('takeoffFade'), s + flight, '整份包 · 飞行', '沿车道');
      var fadeEnd = s + flight + sp('packFade');
      row(st, s + flight, null, '整份包 · 抵达', '对方卡边缘');
      row(st, s + flight, fadeEnd, '整份包 · 淡出', '透明');
      row(st, s + flight, null, wname + ' · 余辉', '保留数据色');
      ev(T, fadeEnd + flight * sp('trailRatio'), function (S) {
        scene.wireIds[round - 1].forEach(function (w) { S.wires[w] = { st: 'rest' }; });
      });
      var landT = fadeEnd + sp('seatDelay');
      row(st, fadeEnd, landT, '画面 · 静止', '第二排保持接收位');
      all4.forEach(function (r) {
        for (var i = 0; i < 4; i++) {
          ev(T, landT, setSlot(r, 1, i, { type: 'block', ch: 'ABCD'[i] }));
          tw(T, 'pop', { r: r, ri: 1, i: i }, landT, landT + sp('popDur'));
        }
      });
      var popEnd = landT + sp('popDur');
      row(st, landT, null, '第二排 · 落位（齐弹）', '每卡各收 4 块');
      row(st, landT, popEnd, '第二排 · 弹跳', '落定');
      var t2 = calcChain(T, scene, cards, all4, k, popEnd, 4);
      var end = t2 + (k < 2 ? ORCH.roundRest.family : 0);
      if (k < 2) restRow(st, t2, end, '四张双排卡上排各 4 块 Σ²（色调更浓）');
      st.e = end;
      if (k === 1) {
        gear(T, '3–9', '发送数据 ×2', '', '组 · 两轮共用这一组', true);
        gear(T, '', '├ 飞行（数据包）', '', '编排 1.10 + packFade');
        gear(T, '', '├ 落位延迟', '', 'seatDelay');
        gear(T, '', '├ 落位弹跳（齐弹）', '', 'popDur');
        gear(T, '', '├ 计算开始', '', 'growDur + calcFade');
        gear(T, '', '├ 计算中', '', 'max(逐段和, holdDur)');
        gear(T, '', '└ 计算结束', '', 'calcFade + shrinkDur');
      }
      t = end;
    }
    collapse(T, scene, all4.map(function (r) { return { r: r, slots: [3, 2, 1, 0] }; }), ORCH.stay.allreduce);
  }

  /* ══════════ 页型：reducescatter（递归减半 + 收窄）══════════ */
  function buildRs(T, scene, cards) {
    var all4 = [0, 1, 2, 3];
    var t = introOpen(T, scene, cards);
    for (var k = 1; k <= 2; k++) {
      var round = k;   /* 惰性回调捕获本轮号（同 buildExchange） */
      var s = t;
      var st = step(T, '第 ' + (k + 1) + ' 步 · 第 ' + k + ' 轮（' + (k === 1 ? '同列' : '同行') + '互换）', s, 0, '组内相 + 编排合成');
      var pairs = CV.FACTS.reducescatter.rounds.edges[k - 1];
      var wname = k === 1 ? '两条纵向直连' : '两条横向直连';
      var nSend = k === 1 ? 2 : 1;
      pairs.forEach(function (pair, pi) {
        var wid = scene.wireIds[k - 1][pi];
        ev(T, s, setWire(wid, 'lit', colorOf(pair[0])));
        [pair[0], pair[1]].forEach(function (from) {
          var to = (from === pair[0]) ? pair[1] : pair[0];
          var ends = CV.gridEnds(cards, pair[0], pair[1]);
          var start = (from === pair[0]) ? ends[0] : ends[1];
          var dst = (start === ends[0]) ? ends[1] : ends[0];
          scene.rsSend[k][from].forEach(function (si) {
            var pkt = pk(T, { color: colorOf(from), kind: 'sum', sumN: k, sub: 'ABCD'[si] });
            tw(T, 'fly', { pkt: pkt }, s, s + ORCH.flight.reducescatter, { path: CV.line(start, dst), ease: true });
          });
          scene.rsSend[k][from].forEach(function (si) {
            ev(T, s, setSlot(from, 0, si, { type: 'empty' }));
          });
        });
      });
      var flight = ORCH.flight.reducescatter;
      row(st, s, null, '四张卡 · 交空（各 ' + nSend + ' 格）', '交出' + (k === 1 ? '一半' : '最后一段'));
      row(st, s, s + sp('wireFade'), wname + ' · 点亮', '数据色');
      row(st, s, s + flight * sp('takeoffFade'), '单体包 · 起飞（' + (nSend === 2 ? 8 : 4) + ' 个）', '各直连起点');
      row(st, s + flight * sp('takeoffFade'), s + flight, '单体包 · 飞行', '沿直连');
      var fadeEnd = s + flight + sp('packFade');
      row(st, s + flight, null, '单体包 · 抵达', '对端卡边缘');
      row(st, s + flight, fadeEnd, '单体包 · 淡出', '透明');
      row(st, s + flight, null, '直连 · 余辉', '保留数据色');
      ev(T, fadeEnd + flight * sp('trailRatio'), function (S) {
        scene.wireIds[round - 1].forEach(function (w) { S.wires[w] = { st: 'rest' }; });
      });
      var landT = fadeEnd + sp('seatDelay');
      row(st, fadeEnd, landT, '画面 · 静止', '第二排保持接收位');
      all4.forEach(function (r) {
        scene.rsKeep[r].forEach(function (i) {
          ev(T, landT, setSlot(r, 1, i, { type: 'sum', n: k, sub: 'ABCD'[i] }));
          tw(T, 'pop', { r: r, ri: 1, i: i }, landT, landT + sp('popDur'));
        });
      });
      var popEnd = landT + sp('popDur');
      row(st, landT, null, '第二排 · 落位（' + (k === 1 ? '2 段同时' : '1 段') + '）', k === 1 ? '每卡收 2 块' : '每卡只收 1 块');
      row(st, landT, popEnd, '第二排 · 弹跳', '落定');
      var t2 = calcChain(T, scene, cards, all4, k, popEnd, k === 1 ? 2 : 1);
      var end = t2;
      if (k === 1) {
        /* 卡片收窄（⑥6.7 特有：每卡撤掉下一轮用不上的那格） */
        var t3 = end + sp('blockDur');
        all4.forEach(function (r) {
          var rm = r < 2 ? 3 : 0;
          ev(T, end, setSlot(r, 1, rm, { type: 'hidden' }));
          ev(T, end, setCard(r, { row1: r < 2 ? [0, 1, 2] : [1, 2, 3] }));
        });
        row(st, end, t3, '第二排 · 收窄', '每卡撤掉这一轮用不上的那格');
        gear(T, '9', '卡片收窄', fmt(sp('blockDur')) + 's', 'blockDur');
        end = t3;
      }
      st.e = end;
      if (k === 1) {
        gear(T, '3–8', '发送数据 · 第 1 轮', '', '组 · 这一轮的六个相', true);
        gear(T, '', '├ 飞行（数据包）', '', '编排 1.70 + packFade');
        gear(T, '', '├ 落位延迟', '', 'seatDelay');
        gear(T, '', '├ 落位弹跳（齐弹）', '', 'popDur');
        gear(T, '', '├ 计算开始', '', 'growDur + calcFade');
        gear(T, '', '├ 计算中', '', 'max(逐段和, holdDur)');
        gear(T, '', '└ 计算结束', '', 'calcFade + shrinkDur');
      }
      t = end;
    }
    collapse(T, scene, [
      { r: 0, slots: [2, 1, 0] }, { r: 1, slots: [2, 1, 0] },
      { r: 2, slots: [3, 2, 1] }, { r: 3, slots: [3, 2, 1] }
    ], ORCH.stay.reducescatter);
  }

  /* ══════════ 页型：alltoall（按目的地分步 + 错峰落位）══════════ */
  function buildAtoa(T, scene, cards) {
    var t = introOpen(T, scene, cards);
    for (var q = 0; q < 4; q++) {
      var s = t;
      var st = step(T, '第 ' + (q + 2) + ' 步 · 第 ' + (q + 1) + ' 片互换', s, 0, '组内相 + 编排合成');
      var edges = CV.FACTS.alltoall.rounds.edges[q];
      var flight = ORCH.flight.alltoall;
      edges.forEach(function (e) {
        var wid = 'w' + Math.min(e[0], e[1]) + Math.max(e[0], e[1]);
        ev(T, s, setWire(wid, 'lit', colorOf(e[0])));
        ev(T, s, setSlot(e[0], 0, q, { type: 'empty' }));
        var pkt = pk(T, { color: colorOf(e[0]), kind: 'slice', ch: 'ABCD'[e[0]], idx: q });
        tw(T, 'fly', { pkt: pkt }, s, s + flight, { path: directedLine(cards, e[0], e[1]), ease: true });
      });
      for (var i = 0; i < 4; i++) {
        ev(T, s, setSlot(q, 1, i, { type: 'recv' }));
        tw(T, 'slotOp', { r: q, ri: 1, i: i }, s, s + sp('dimDur'), { from: 0, to: 1 });
      }
      row(st, s, null, '四张卡 · 交空（上排-' + (q + 1) + '）', '空格（4 张同时）');
      row(st, s, s + sp('dimDur'), 'r' + q + ' 下排 · 转接收位（4 格）', '紫底 ···');
      row(st, s, s + sp('wireFade'), '三条直连 · 点亮', '数据色');
      row(st, s, s + flight * sp('takeoffFade'), '分片包 · 起飞（3 个）', '各直连起点');
      row(st, s + flight * sp('takeoffFade'), s + flight, '分片包 · 飞行', '沿直连');
      var fadeEnd = s + flight + sp('packFade');
      row(st, s + flight, null, '分片包 · 抵达', 'r' + q + ' 卡边缘');
      row(st, s + flight, fadeEnd, '分片包 · 淡出', '透明');
      row(st, s + flight, null, '三条直连 · 余辉', '保留数据色');
      ev(T, fadeEnd + flight * sp('trailRatio'), function (S) {
        edges.forEach(function (e) {
          S.wires['w' + Math.min(e[0], e[1]) + Math.max(e[0], e[1])] = { st: 'rest' };
        });
      });
      var landT = fadeEnd + sp('seatDelay');
      row(st, fadeEnd, landT, '画面 · 静止', '下排保持接收位');
      for (var j = 0; j < 4; j++) {
        var lt = landT + j * sp('seatGap');
        ev(T, lt, setSlot(q, 1, j, { type: 'slice', ch: 'ABCD'[j], idx: q }));
        tw(T, 'pop', { r: q, ri: 1, i: j }, lt, lt + sp('popDur'));
      }
      var popEnd = landT + 3 * sp('seatGap') + sp('popDur');
      row(st, landT, null, '下排 · 落位（4 块错峰）',
          'A' + CV.SUB[q] + ' B' + CV.SUB[q] + ' C' + CV.SUB[q] + ' D' + CV.SUB[q]);
      row(st, landT + 3 * sp('seatGap'), popEnd, '下排-4 · 弹跳', '最后一块落定');
      var end = popEnd + (q < 3 ? ORCH.roundRest.ata : 0);
      if (q < 3) restRow(st, popEnd, end, '四张卡上排少 1 片，下排有 ' + (q + 1) + ' 块');
      st.e = end;
      if (q === 0) {
        gear(T, '3–6', '发送数据 ×4', '', '组 · 每步共用这一组', true);
        gear(T, '', '├ 飞行（数据包）', '', '编排 0.95 + packFade');
        gear(T, '', '├ 落位延迟', '', 'seatDelay');
        gear(T, '', '├ 落位弹跳（错峰）', '', 'popDur + 3×seatGap');
        gear(T, '', '└ 轮歇', fmt(ORCH.roundRest.ata) + 's', '编排秒');
      }
      t = end;
    }
    var stT = step(T, '收尾', t, t + ORCH.tail.alltoall, '编排秒');
    restRow(stT, t, t + ORCH.tail.alltoall, scene.rest.tail);
    gear(T, '7', '完成', fmt(ORCH.tail.alltoall) + 's', '编排秒');
    T.total = t + ORCH.tail.alltoall;
  }

  /* ══════════ 入口 ══════════ */
  CV.compile = function (scene) {
    var T = TL();
    var cards = CV.layoutCards(scene);
    T.cards = cards;

    /* 连线：显示路径 + 飞行路径（剧本给声明，几何在这里算） */
    (function buildWires() {
      var defs = scene.wireDefs;
      defs.forEach(function (d) {
        var path, lanes = null;
        if (d.type === 'arc') {
          var fc = cards[d.from], tc = cards[d.to];
          path = CV.arcPath(CV.edgePoint(fc, fc.x < tc.x ? 'right' : 'left'),
                            CV.edgePoint(tc, fc.x < tc.x ? 'left' : 'right'));
        } else {
          var ends = CV.gridEnds(cards, d.pair[0], d.pair[1]);
          path = (d.type === 'diag') ? CV.line(ends[0], ends[1]) : CV.line(ends[0], ends[1]);
          if (d.lane) {
            var horiz = Math.abs(cards[d.pair[0]].x - cards[d.pair[1]].x) > Math.abs(cards[d.pair[0]].y - cards[d.pair[1]].y);
            var off = horiz ? sp('humpH') : sp('humpV');
            lanes = [CV.lanePath(ends[0], ends[1], off), CV.lanePath(ends[1], ends[0], off)];
          }
        }
        T.wires.push({ id: d.id, label: d.label, path: path, muted: !!d.muted, hasArrow: d.type === 'arc' });
        if (lanes) T.lanes[d.id] = lanes;
        T.wirePaths[d.id] = path;
      });
      /* 直连类页：为每个有向流补飞行路径（方向取决于发送方） */
      if (scene.flightFlows) {
        scene.flightFlows.forEach(function (f) {
          var ends = CV.gridEnds(cards, f.pair[0], f.pair[1]);
          var start = (f.from === f.pair[0]) ? ends[0] : ends[1];
          var dst = (start === ends[0]) ? ends[1] : ends[0];
          T.wirePaths[f.id] = CV.line(start, dst);
        });
      }
    })();

    var builders = {
      gather: buildChoreo, scatter: buildChoreo, broadcast: buildChoreo,
      allgather: buildAllgather, reduce: buildReduce, allreduce: buildExchange,
      reducescatter: buildRs, alltoall: buildAtoa
    };
    builders[scene.id](T, scene, cards);

    T.events.sort(function (a, b) { return a.t - b.t; });
    /* 步间无缝：每步起点 = 上一步终点（时间轴不重叠不留洞） */
    for (var si = 1; si < T.steps.length; si++) {
      if (Math.abs(T.steps[si].s - T.steps[si - 1].e) > 1e-3) {
        throw new Error('compile: 步「' + T.steps[si].label + '」起点 ' +
          T.steps[si].s + ' ≠ 上步末 ' + T.steps[si - 1].e);
      }
    }
    T.steps.forEach(function (st) {
      if (!(st.e >= st.s)) throw new Error('compile: 步「' + st.label + '」区间非法');
      if (!st.rows.length) throw new Error('compile: 步「' + st.label + '」没有行');
      var last = st.rows[st.rows.length - 1];
      var lastEnd = last[1] === null ? last[0] : last[1];
      if (Math.abs(lastEnd - st.e) > 1e-3) {
        throw new Error('compile: 步「' + st.label + '」末行结束 ' + lastEnd + ' ≠ 步末 ' + st.e);
      }
      for (var i = 1; i < st.rows.length; i++) {
        if (st.rows[i][0] < st.rows[i - 1][0] - 1e-3) {
          throw new Error('compile: 步「' + st.label + '」行序倒挂 @' + st.rows[i][2]);
        }
      }
    });
    if (Math.abs(T.steps[T.steps.length - 1].e - T.total) > 1e-3) {
      throw new Error('compile: 末步结束 ≠ 总时长（' + T.steps[T.steps.length - 1].e + ' vs ' + T.total + '）');
    }
    return T;
  };

  /* ══════════ allreduce/rs 的 lanePaths 预计算（供 builder 取用）══════════ */
  CV.compilePrepLanes = function (scene, cards) {
    scene.lanePaths = [];
    scene.wireIds = [];
    CV.FACTS[scene.id].rounds.edges.forEach(function (roundPairs) {
      var ids = [], lanes = [];
      roundPairs.forEach(function (pair) {
        var id = 'x' + pair[0] + pair[1];
        ids.push(id);
        var ends = CV.gridEnds(cards, pair[0], pair[1]);
        var horiz = Math.abs(cards[pair[0]].x - cards[pair[1]].x) > Math.abs(cards[pair[0]].y - cards[pair[1]].y);
        var off = horiz ? CV.spec('humpH') : CV.spec('humpV');
        lanes.push([CV.lanePath(ends[0], ends[1], off), CV.lanePath(ends[1], ends[0], off)]);
        /* 同一对在多轮复用时共用同一 id（rs 两轮对不同对，不冲突） */
      });
      scene.wireIds.push(ids);
      scene.lanePaths.push(lanes);
    });
  };
})(window.CV = window.CV || {});
