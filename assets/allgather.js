/* ============================================================
   CommonVisual · All-Gather（全收集）动态演示
   ------------------------------------------------------------
   四张卡地位平等，每轮把「刚拿到的那段」发给顺时针下一家，
   转 3 圈后每卡集齐 A B C D。All-Gather 是复制（源卡送出后自己还留着）。

   拓扑：2×2 网格的四条边天然成环（0→1→3→2→0），零交叉。

   只声明数据 / 时间轴 / 文案 / 几何位置 / 落位规则；
   舞台与布局生命周期由 assets/cv/primitive.js 统一接管。
   ============================================================ */
(function () {
  'use strict';

  var DATA = CV.PALETTE;
  var RANKS = [0, 1, 2, 3];
  var PARTS = DATA.length;
  var ROUNDS = 3;

  /* ── ③ 文案 ── */
  var X = CV.primText(DATA);
  var rk = X.rk, whole = X.whole;

  /* ── ② 环路由：谁在第几轮把哪一段发给谁 ──
     这里只定「发什么」（与时间无关），秒数全在 buildTime 里 ——
     改时序只动时间轴，路由不用跟着重算。 */
  var RING = [0, 1, 3, 2];   /* 顺时针环：左上 → 右上 → 右下 → 左下 */

  var ROUNDS_FLOWS = (function () {
    var carried = [0, 1, 2, 3];
    var out = [];
    for (var r = 0; r < ROUNDS; r++) {
      var list = [];
      for (var k = 0; k < 4; k++) {
        var from = RING[k], to = RING[(k + 1) % 4];
        list.push({ from: from, to: to, letter: carried[from], round: r });
      }
      var nxt = carried.slice();
      list.forEach(function (f) { nxt[f.to] = f.letter; });
      carried = nxt;
      out.push(list);
    }
    return out;
  })();

  /* ── ① 时序：一轮 = 一个 transfer ──
     每轮四条边**同时**发（各发各的那段），所以一轮就是时间轴上的一个 transfer 段，
     自动展开成 传递 → 落位延迟 → 落位弹跳 → 间隔 四段；三轮共用同一组倍数。
     收尾给 0.6s，让「集齐」这一句停得住。 */
  function buildTime() {
    var segs = [
      { id: 'init', kind: 'wait', label: '说明', sec: 0.9,
        text: rk(0) + rk(1) + rk(2) + rk(3) + ' 各持一段 ' + whole() }
    ];
    for (var q = 0; q < ROUNDS; q++) {
      segs.push({
        id: 'r' + q, kind: 'transfer', label: '第 ' + (q + 1) + ' 轮',
        text: '第 ' + (q + 1) + ' 轮：顺时针各发一份'
      });
    }
    segs.push({ id: 'tail', kind: 'wait', label: '收尾', sec: 0.6,
                text: '四张卡都集齐 ' + whole() });

    var CH = CV.choreo('allgather', segs);
    var W = CH.win;

    /* 把窗口挂回流对象：同一轮的四条边共用同一个窗口对象（f.w）。
       f.w 每次 retime 都会被换掉，所以 paint 一律现读 f.w，不缓存秒数。 */
    ROUNDS_FLOWS.forEach(function (list, q) {
      var w = W['r' + q];
      list.forEach(function (f) { f.w = w; });
    });

    return { CH: CH, win: W };
  }

  var TM = buildTime();

  /* 环上 4 条边是固定的：每轮复用同一条线，只是携带的字母不同。
     —— 所以「边」才是画线的单位，不是「某一轮的某条流」。
     同一条边重复画 4 条会互相盖住（下层染了色、上层的灰线压在上面），
     箭头若按字母建则会被别的轮次改色，这两个都是由此而来的错。 */
  var EDGES = RING.map(function (from, k) {
    var to = RING[(k + 1) % 4];
    var runs = [];
    ROUNDS_FLOWS.forEach(function (list) {
      list.forEach(function (f) { if (f.from === from && f.to === to) runs.push(f); });
    });
    return { from: from, to: to, runs: runs };
  });
  var EIDX = {};
  EDGES.forEach(function (ed, i) { EIDX[ed.from + '_' + ed.to] = i; });

  /* IN[r][q] = rank r 第 q 轮收到的**那条流**（段号 = f.letter） */
  var IN = [[], [], [], []];
  ROUNDS_FLOWS.forEach(function (list, q) {
    list.forEach(function (f) { IN[f.to][q] = f; });
  });

  /* ── ④ 几何：2×2 网格（列=r&1，行=r>>1）── */
  var GEO = CV.geo({
    desktop: { grid: { x: 175, y: 136, dx: 480, dy: 330 }, legendY: 17 },
    narrow:  { grid: { x: 8,   y: 185, dx: 218, dy: 300 }, legendY: 113 }
  });

  var seen = {};

  function cardGeo(L, r) {
    return { x: L.grid.x + (r & 1) * L.grid.dx, y: L.grid.y + (r >> 1) * L.grid.dy, w: L.card.w, h: L.card.h };
  }

  function edgeEnds(a, b) {
    var ac = { x: a.x + a.w / 2, y: a.y + a.h / 2 };
    var bc = { x: b.x + b.w / 2, y: b.y + b.h / 2 };
    var dx = bc.x - ac.x, dy = bc.y - ac.y;
    if (Math.abs(dx) >= Math.abs(dy)) {
      var s = dx < 0 ? -1 : 1;
      return { sx: ac.x + s * a.w / 2, sy: ac.y, tx: bc.x - s * b.w / 2, ty: bc.y };
    }
    var t = dy < 0 ? -1 : 1;
    return { sx: ac.x, sy: ac.y + t * a.h / 2, tx: bc.x, ty: bc.y - t * b.h / 2 };
  }

  function wirePath(e) {
    var dx = e.tx - e.sx, dy = e.ty - e.sy;
    return 'M ' + e.sx + ' ' + e.sy +
           ' C ' + (e.sx + dx * 0.42) + ' ' + (e.sy + dy * 0.42) + ', ' +
                 (e.tx - dx * 0.42) + ' ' + (e.ty - dy * 0.42) + ', ' +
                 e.tx + ' ' + e.ty;
  }

  var mount = CV.primitive({
    data: DATA,
    geo: GEO,
    steps: TM.CH.steps,
    duration: TM.CH.total * 1000,

    /* 齿轮改了倍数 → 重算时序，返回新的 steps / 时长给控件重排 */
    retime: function () {
      TM = buildTime();
      return { steps: TM.CH.steps, duration: TM.CH.total * 1000 };
    },

    keepCards: function () { return RANKS; },

    onReset: function () { seen = {}; },

    build: function (S) {
      var L = S.L, layer = S.layers, cards = S.cards, chips = S.chips, wires = S.wires, pkts = S.pkts;
      var defs = S.defs;

      CV.drawLegend(layer.bg, { x: L.grid.x + 7, y: L.legendY + 7, slot: L.slot, items: DATA });

      RANKS.forEach(function (r) {
        cards[r] = CV.drawCard(layer.cards, {
          key: r, geo: cardGeo(L, r), color: DATA[r].color,
          title: 'rank ' + r, badgeText: '1/4',
          hdr: L.hdr, titleSize: L.title, badgeSize: L.badge
        });
      });

      var c0 = L.slot;
      var totalW = PARTS * c0.sw + (PARTS - 1) * c0.gap;
      var areaY = L.hdr, areaH = L.card.h - L.hdr - 16;

      RANKS.forEach(function (r) {
        var geo = cards[r].geo;
        var x0 = geo.x + (geo.w - totalW) / 2;
        var y = geo.y + areaY + (areaH - c0.sh) / 2;
        var list = [];
        for (var i = 0; i < PARTS; i++) {
          list.push(CV.drawSlot(layer.chips, x0 + i * (c0.sw + c0.gap), y, c0.sw, c0.sh));
        }
        chips[r] = list;
      });

      /* 箭头按「边」建 4 个（不是按字母）：同一条边每一轮携带的字母都不同，
         箭头颜色只能跟着「这条边现在跑第几轮」走；按字母建的话，
         字母跑到别的边上去了，箭头就会被那条边改色。 */
      EDGES.forEach(function (ed, i) { CV.drawMarker(defs, 'ae' + i); });

      /* 一条边只画一条线，不按轮次重复画（否则下层的彩线会被上层的灰线压住） */
      EDGES.forEach(function (ed, i) {
        var e = edgeEnds(cards[ed.from].geo, cards[ed.to].geo);
        var w = CV.drawWire(layer.wires, { d: wirePath(e), markerId: 'ae' + i });
        wires['e' + i] = {
          path: w.path, len: w.len,
          marker: defs.querySelector('#ae' + i + ' path'),
          sx: e.sx, sy: e.sy, tx: e.tx, ty: e.ty
        };
      });

      /* 数据包：每条流一个（不能按段共用） */
      ROUNDS_FLOWS.forEach(function (list, q) {
        list.forEach(function (f) {
          pkts[q + '_' + f.from] = CV.drawPacket(layer.fx, {
            letter: DATA[f.letter].letter, color: DATA[f.letter].color
          });
        });
      });
    },

    paint: function (S, t) {
      var layer = S.layers, cards = S.cards, chips = S.chips, wires = S.wires, pkts = S.pkts;
      var sec = t * S.durSec;

      /* 槽位状态：own 自己那份 / done 已收到 / waiting 在路上 / empty 空着
         到达 ≠ 落位：数据在「落位」这一段的起点（seatStart）才真正进槽。 */
      function slotState(r, i) {
        if (i === r) return 'own';
        for (var q = 0; q < ROUNDS; q++) {
          var f = IN[r][q];
          if (!f || f.letter !== i) continue;
          if (sec >= f.w.seatStart) return 'done';
          if (sec >= f.w.s) return 'waiting';
          return 'empty';
        }
        return 'empty';
      }

      RANKS.forEach(function (r) {
        chips[r].forEach(function (s, i) {
          var st = slotState(r, i);
          if (st === 'own' || st === 'done') {
            CV.setSlot(s, { letter: DATA[i].letter, color: DATA[i].color }, {});
          } else if (st === 'waiting') {
            CV.setSlot(s, null, { active: true });
          } else {
            CV.setSlot(s, null, {});
          }
        });
      });

      /* 徽章：已收到几段 */
      var got = 1;
      ROUNDS_FLOWS.forEach(function (list) { if (sec >= list[0].w.seatStart) got++; });
      var bt = got + '/' + PARTS;
      RANKS.forEach(function (r) {
        if (cards[r].badgeTx.textContent !== bt) cards[r].badgeTx.textContent = bt;
      });

      /* —— 连线：一条边一条线，颜色跟着「这条边现在跑到第几轮」——
         轮次在时间上不重叠，所以任意时刻一条边至多被一个轮次占用，
         取「最后一个已经开始的那轮」就是它此刻的状态。 */
      EDGES.forEach(function (ed, i) {
        var w = wires['e' + i], cur = null;
        ed.runs.forEach(function (f) { if (sec >= f.w.s) cur = f; });

        if (!cur) {
          w.path.setAttribute('stroke', '#c3cadb');
          w.path.setAttribute('stroke-width', '2');
          w.path.setAttribute('stroke-dasharray', '8 7');
          w.path.setAttribute('opacity', '1');
          w.marker.setAttribute('fill', '#c3cadb');
          return;
        }

        var color = DATA[cur.letter].color;
        var flying = sec < cur.w.travelEnd;
        w.path.setAttribute('stroke', color);
        w.path.setAttribute('stroke-width', flying ? '2.6' : '1.8');
        w.path.setAttribute('stroke-dasharray', flying ? '9 7' : '8 7');
        w.path.setAttribute('opacity', flying ? '1' : '.45');
        w.marker.setAttribute('fill', color);
      });

      /* —— 数据包：每条流各一个（不能跨轮次共用一个对象，包的字母和颜色
         是画出来的时候定死的，一条边每轮带的东西不一样） —— */
      ROUNDS_FLOWS.forEach(function (list, q) {
        list.forEach(function (f) {
          var w = wires['e' + EIDX[f.from + '_' + f.to]];
          var p = pkts[q + '_' + f.from];
          var fw = f.w;

          if (sec >= fw.s && sec < fw.travelEnd) {
            var e = CV.easeInOutQuad((sec - fw.s) / (fw.travelEnd - fw.s));
            CV.placePacket(p, w, e);
          } else if (sec >= fw.travelEnd && sec < fw.fadeEnd) {
            /* 到达箭头尖：原地淡掉（这一段同时就是「停留」） */
            CV.placePacket(p, w, 1);
            CV.pktFadeOut(p, sec - fw.travelEnd, fw.fadeSec);
          } else {
            p.g.setAttribute('opacity', '0');
          }
        });
      });

      /* —— 落位弹跳：一轮四块是**同时**到的，但落位要一块一块弹 ——
         第 gi 块的时刻 = seatStart + gi×seatGap（规范 08），本轮第一块不延后。
         用「时刻」比 sec 而不是 setTimeout 排队：进度条能来回拖。 */
      ROUNDS_FLOWS.forEach(function (list, q) {
        list.forEach(function (f, gi) {
          var key = 'q' + q + '_' + f.from;
          var at = CV.seatAt(gi, f.w.seatStart);
          if (sec >= at && !seen[key]) {
            seen[key] = 1;
            CV.spawnPulse(layer.fx, chips[f.to][f.letter], DATA[f.letter].color, f.w.popSec);
          } else if (sec < at && seen[key]) {
            delete seen[key];
          }
        });
      });
    }
  });

  /* 调试 / 探针钩子：取本页当前真实的时间轴（改过倍数之后也是最新的） */
  mount.getCh = function () { return TM.CH; };

  /* 右上角齿轮：本页每一步的耗时（有规范值的调倍数，没规范值的直接填秒） */
  if (CV.gear) {
    CV.gear({
      page: 'allgather',
      name: 'All-Gather 时序',
      getCh: mount.getCh,
      onChange: function () { mount.reload(); }
    });
  }
})();
