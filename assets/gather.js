/* ============================================================
   CommonVisual · Gather（收集）动态演示
   ------------------------------------------------------------
   只声明本原语特有的东西：数据 / 每一步干什么 / 文案 / 几何 / 落位规则。
   舞台、布局切换、resize、控件启动由 assets/cv/primitive.js 统一接管。
   ============================================================ */
(function () {
  'use strict';

  var DATA = CV.PALETTE;

  var T = CV.primText(DATA);
  var rk = T.rk, seg = T.seg;

  /* ── ① 时序：逐步写清楚「这一步干什么」──
     两种取值方式，一眼能分开：
       有规范约定（传递飞多久 / 落位弹多久）→ of + 倍数，秒数 = 规范值 × 倍数
       规范没约定（说明/预留/落位延迟/每趟之间的停留/收尾）→ sec 直接写秒
     transfer 会自动展开成 传递 → 落位延迟 → 落位弹跳 → 间隔 四段：
     传递 = 数据包整段（飞 + 送达淡出），落位是它之后的独立一步（串行，不重叠）。 */
  function buildTime() {
    var CH = CV.choreo('gather', [
      { id: 'intro', kind: 'wait', label: '说明', sec: 0.6,
        text: rk(0) + ' ' + rk(1) + ' ' + rk(2) + ' ' + rk(3) + ' 分别持有 ' +
              seg(0) + ' ' + seg(1) + ' ' + seg(2) + ' ' + seg(3) },

      { id: 'pre', kind: 'wait', label: '预留缓冲', sec: 0.6,
        text: rk(0) + ' 预留 <b>4 份</b> 缓冲' },

      { id: 'send1', kind: 'transfer', label: 'B 传递',
        text: rk(1) + ' 发送 ' + seg(1) },
      { id: 'send2', kind: 'transfer', label: 'C 传递',
        text: rk(2) + ' 发送 ' + seg(2) },
      { id: 'send3', kind: 'transfer', label: 'D 传递',
        text: rk(3) + ' 发送 ' + seg(3) },

      { id: 'tail', kind: 'wait', label: '收尾', sec: 1,
        text: rk(0) + ' 集齐 ' + seg(0) + ' ' + seg(1) + ' ' + seg(2) + ' ' + seg(3) }
    ]);

    var W = CH.win;
    return {
      CH: CH,
      ROUTE: {
        target: 0,
        preallocAt: W.pre.s,        /* 预留缓冲开始时，空槽才显形 */
        flows: [
          { from: 1, w: W.send1 },
          { from: 2, w: W.send2 },
          { from: 3, w: W.send3 }
        ]
      }
    };
  }

  var TM = buildTime();

  /* ── ④ 几何：只写位置，公共尺寸来自 CV.GEO_BASE ── */
  var GEO = CV.geo({
    desktop: { target: { x: 10,  y: 255 }, source: { x: 820, ys: [50, 255, 460] }, legendY: 50 },
    narrow:  { target: { x: 6,   y: 297 }, source: { x: 226, ys: [40, 297, 554] }, legendY: 40 }
  });

  var slotOfRank = {};
  DATA.forEach(function (d, i) { slotOfRank[d.r] = i; });

  var popSeen = {};

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

    keepCards: function (letter) {
      var hit = DATA.filter(function (d) { return d.letter === letter; })[0];
      if (!hit) return [];
      var keep = [TM.ROUTE.target];
      if (hit.r !== TM.ROUTE.target) keep.push(hit.r);
      return keep;
    },

    onReset: function () { popSeen = {}; },

    build: function (S) {
      var L = S.L, layer = S.layers, cards = S.cards, chips = S.chips, wires = S.wires, pkts = S.pkts;
      var defs = S.defs;
      var ROUTE = TM.ROUTE;

      /* 图例 */
      CV.drawLegend(layer.bg, { x: L.target.x + 7, y: L.legendY + 7, slot: L.slot, items: DATA });

      /* 箭头 */
      ROUTE.flows.forEach(function (f) {
        var m = CV.drawMarker(defs, 'ah' + f.from, DATA[slotOfRank[f.from]].letter);
        wires[f.from] = { markerPath: m.path };
      });

      /* 卡片 */
      DATA.forEach(function (d) {
        var isTarget = d.r === ROUTE.target;
        var geo = {
          x: isTarget ? L.target.x : L.source.x,
          y: isTarget ? L.target.y : L.source.ys[d.r - 1],
          w: L.card.w, h: L.card.h
        };
        cards[d.r] = CV.drawCard(layer.cards, {
          key: d.r, geo: geo, color: d.color,
          title: 'rank ' + d.r,
          role: isTarget ? 'dst' : 'src',
          target: isTarget,
          hdr: L.hdr, titleSize: L.title, badgeSize: L.badge
        });
      });

      /* 缓冲槽：目标卡横排铺满，源卡只有一个（与目标卡首格同列） */
      var c0 = L.slot;
      var totalW = DATA.length * c0.sw + (DATA.length - 1) * c0.gap;
      var areaY = L.hdr, areaH = L.card.h - L.hdr - 16;

      DATA.forEach(function (d) {
        var geo = cards[d.r].geo;
        var list = [];
        if (d.r === ROUTE.target) {
          var y0 = geo.y + areaY + (areaH - c0.sh) / 2;
          var x0 = geo.x + (geo.w - totalW) / 2;
          for (var i = 0; i < DATA.length; i++) {
            list.push(CV.drawSlot(layer.chips, x0 + i * (c0.sw + c0.gap), y0, c0.sw, c0.sh));
          }
        } else {
          var y = geo.y + areaY + (areaH - c0.sh) / 2;
          var x = geo.x + (geo.w - totalW) / 2;
          list.push(CV.drawSlot(layer.chips, x, y, c0.sw, c0.sh));
        }
        chips[d.r] = list;
      });

      /* 连线：源卡左边缘 → 目标卡右边缘 */
      var dst = cards[ROUTE.target].geo;
      ROUTE.flows.forEach(function (f) {
        var src = cards[f.from].geo;
        var sx = src.x, sy = src.y + src.h / 2;
        var tx = dst.x + dst.w + 4;
        var ty = dst.y + dst.h * (0.28 + 0.22 * (slotOfRank[f.from] - 1));
        var span = sx - tx;
        var d = 'M ' + sx + ' ' + sy +
                ' C ' + (sx - span * 0.42) + ' ' + sy + ', ' + (tx + span * 0.42) + ' ' + ty +
                ', ' + tx + ' ' + ty;
        var w = CV.drawWire(layer.wires, {
          d: d, letter: DATA[slotOfRank[f.from]].letter, markerId: 'ah' + f.from
        });
        wires[f.from] = { path: w.path, len: w.len, marker: wires[f.from].markerPath };
      });

      /* 数据包 */
      ROUTE.flows.forEach(function (f) {
        var d = DATA[slotOfRank[f.from]];
        pkts[f.from] = CV.drawPacket(layer.fx, { letter: d.letter, color: d.color });
      });
    },

    paint: function (S, t) {
      var layer = S.layers, cards = S.cards, chips = S.chips, wires = S.wires, pkts = S.pkts;
      var ROUTE = TM.ROUTE;
      /* 全部按「墙钟秒」判断：到达、淡出、落位各自是独立的一段，不再靠比例猜 */
      var sec = t * S.durSec;

      /* 已落位几份、正在等哪一份（到达 ≠ 落位：数据在弹跳那一刻才进槽） */
      var count = 1, activeRank = -1;
      ROUTE.flows.forEach(function (f) {
        if (sec >= f.w.seatStart) count += 1;
        else if (sec >= f.w.s) activeRank = f.from;
      });

      /* —— 槽位 —— */
      DATA.forEach(function (d) {
        chips[d.r].forEach(function (s, i) {
          var data = null, active = false, hidden = false;

          if (d.r === ROUTE.target) {
            if (i < count) data = DATA[i];
            else if (i === slotOfRank[activeRank]) {
              active = true;
              hidden = sec < ROUTE.preallocAt;
            } else {
              hidden = sec < ROUTE.preallocAt;
            }
          } else if (i === 0) {
            data = d;
          }

          CV.setSlot(s, data, { active: active, hidden: hidden });
        });

        var sending = ROUTE.flows.some(function (f) {
          return f.from === d.r && sec >= f.w.s && sec < f.w.travelEnd;
        });
        cards[d.r].g.setAttribute('opacity', sending ? '.6' : '1');
      });

      /* —— 连线 & 数据包 ——
         四段严格串行：飞 → 淡（送达淡出，包原地消失）→ 等（落位延迟）→ 落位（弹跳）。
         淡出和弹跳不再重叠：包淡完了才轮到槽位弹一下。 */
      ROUTE.flows.forEach(function (f) {
        var w = wires[f.from], p = pkts[f.from], fw = f.w;
        var color = DATA[slotOfRank[f.from]].color;
        var flying = sec >= fw.s && sec < fw.travelEnd;
        var fading = sec >= fw.travelEnd && sec < fw.fadeEnd;
        var parked = sec >= fw.fadeEnd && sec < fw.seatStart;
        var landed = sec >= fw.seatStart;

        if (flying) {
          var e = CV.easeInOutQuad((sec - fw.s) / (fw.travelEnd - fw.s));
          CV.placePacket(p, w, e);
          w.path.setAttribute('stroke', color);
          w.path.setAttribute('stroke-width', '2.6');
          w.path.setAttribute('stroke-dasharray', '9 7');
          w.path.setAttribute('opacity', '1');
          w.marker.setAttribute('fill', color);
        } else if (fading) {
          /* 已经到达箭头尖：不动了，原地把自己淡掉（时长 = 这一段的 fadeSec）。
             淡的这段就是「停留」，不再额外等一段。 */
          CV.placePacket(p, w, 1);
          CV.pktFadeOut(p, sec - fw.travelEnd, fw.fadeSec);
          w.path.setAttribute('stroke', color);
          w.path.setAttribute('stroke-width', '1.8');
          w.path.setAttribute('stroke-dasharray', '8 7');
          w.path.setAttribute('stroke-dashoffset', '0');
          w.path.setAttribute('opacity', '.4');
          w.marker.setAttribute('fill', color);
        } else if (parked || landed) {
          /* 包上一段已经淡没了：这一步只有槽位在动 */
          p.g.setAttribute('opacity', '0');
          w.path.setAttribute('stroke', color);
          w.path.setAttribute('stroke-width', '1.8');
          w.path.setAttribute('stroke-dasharray', '8 7');
          w.path.setAttribute('stroke-dashoffset', '0');
          w.path.setAttribute('opacity', '.4');
          w.marker.setAttribute('fill', color);
        } else {
          p.g.setAttribute('opacity', '0');
          w.path.setAttribute('stroke', '#c3cadb');
          w.path.setAttribute('stroke-width', '2');
          w.path.setAttribute('stroke-dasharray', '8 7');
          w.path.setAttribute('stroke-dashoffset', '0');
          w.path.setAttribute('opacity', '1');
          w.marker.setAttribute('fill', '#c3cadb');
        }
      });

      /* —— 落位弹跳：在「落位」这一段开始时触发，时长同样取这一段的秒数 —— */
      ROUTE.flows.forEach(function (f) {
        var key = 'p' + f.from;
        var s = chips[ROUTE.target][slotOfRank[f.from]];
        if (sec >= f.w.seatStart && !popSeen[key]) {
          popSeen[key] = 1;
          CV.spawnPulse(layer.fx, s, DATA[slotOfRank[f.from]].color, f.w.popSec);
        } else if (sec < f.w.seatStart && popSeen[key]) {
          delete popSeen[key];
        }
      });
    }
  });

  /* 调试 / 探针钩子：取本页当前真实的时间轴（改过倍数之后也是最新的） */
  mount.getCh = function () { return TM.CH; };

  /* 右上角齿轮：本页每一步的耗时（有规范值的调倍数，没规范值的直接填秒） */
  if (CV.gear) {
    CV.gear({
      page: 'gather',
      name: 'Gather 时序',
      getCh: mount.getCh,
      onChange: function () { mount.reload(); }
    });
  }
})();
