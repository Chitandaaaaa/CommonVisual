/* ============================================================
   CommonVisual · All-Gather（全收集）动态演示
   ------------------------------------------------------------
   和 gather 的差别：gather 只有 rank0 收齐；All-Gather 是
   **每张卡**都收齐全部 4 段 —— 四张卡地位平等、同步长大。

   拓扑用 2×2 网格：网格的四条边天然构成一个环
   （rank0 → rank1 → rank3 → rank2 → rank0，顺时针），
   4 条连线零交叉，也正是 NCCL ring all-gather 的形状。

   每轮每张卡把「本轮刚拿到的那段」发给顺时针下一家：
     第 1 轮各发自己的段，第 2 轮发第 1 轮收到的，第 3 轮发第 2 轮收到的
   转 3 圈之后，每张卡集齐 A B C D。

   槽位固定：第 k 个 rank 持有第 k 段，所以每张卡的第 k 个槽位
   永远是同一段数据 —— 三轮之后四张卡长得一模一样。

   All-Gather 是**复制**，源卡送出的那份自己还留着
   （这点和 reduce 相反：reduce 消耗数据）。
   ============================================================ */
(function () {
  'use strict';

  var $ = CV.$, el = CV.el, clamp = CV.clamp;

  /* ══════════════════════════════════════════════════════════
     ① 数据：rank i 一开始持有第 i 段
     ══════════════════════════════════════════════════════════ */
  var DATA = [
    { letter: 'A', color: '#7c3aed' },
    { letter: 'B', color: '#0891b2' },
    { letter: 'C', color: '#059669' },
    { letter: 'D', color: '#d97706' }
  ];
  var RANKS = [0, 1, 2, 3];
  var PARTS = DATA.length;

  /* ══════════════════════════════════════════════════════════
     ② 时间轴（一律用秒）＋ 路由
     ══════════════════════════════════════════════════════════ */
  var T = {
    init: 0.9,    /* 开场：四卡各持一段，槽位已经预留好 */
    fly:  1.2,    /* 单程飞行 */
    pop:  0.6,    /* 落位弹跳（算在本轮里） */
    gap:  0.5     /* 轮间停顿 */
  };
  var ROUNDS = 3;
  var CYCLE = T.fly + T.pop + T.gap;
  var TOTAL = T.init + CYCLE * ROUNDS - T.gap + 0.6;
  function N(sec) { return sec / TOTAL; }

  /* 顺时针环：左上 → 右上 → 右下 → 左下 */
  var RING = [0, 1, 3, 2];

  var ROUTE = { rounds: [] };
  (function () {
    var carried = [0, 1, 2, 3];        /* 每张卡「刚拿到的那段」 */
    for (var r = 0; r < ROUNDS; r++) {
      var list = [];
      for (var k = 0; k < 4; k++) {
        var from = RING[k], to = RING[(k + 1) % 4];
        list.push({ from: from, to: to, letter: carried[from], round: r });
      }
      var nxt = carried.slice();
      list.forEach(function (f) { nxt[f.to] = f.letter; });
      carried = nxt;
      ROUTE.rounds.push(list);
    }
  })();

  /* 每条流的时间点 */
  ROUTE.rounds.forEach(function (list, r) {
    var s = T.init + r * CYCLE;
    list.forEach(function (f) {
      f.start = s;
      f.arrive = s + T.fly;
      f.popEnd = s + T.fly + T.pop;
    });
  });

  /* IN[r][q] = rank r 在第 q 轮收到的那段，以及时间点 */
  var IN = [[], [], [], []];
  ROUTE.rounds.forEach(function (list, q) {
    list.forEach(function (f) {
      IN[f.to][q] = { letter: f.letter, start: f.start, arrive: f.arrive, popEnd: f.popEnd };
    });
  });

  /* ══════════════════════════════════════════════════════════
     ③ 文案
     ══════════════════════════════════════════════════════════ */
  function rk(n) { return '<em class="rk r' + n + '">rank' + n + '</em>'; }
  function seg(n) { return '<em class="c' + DATA[n].letter + '">' + DATA[n].letter + '</em>'; }
  function whole() { return seg(0) + seg(1) + seg(2) + seg(3); }

  var STEPS = [
    { t: 0, text: rk(0) + rk(1) + rk(2) + rk(3) + ' 各持一段 ' + whole() }
  ];
  ROUTE.rounds.forEach(function (list, q) {
    STEPS.push({ t: N(list[0].start), text: '第 ' + (q + 1) + ' 轮：顺时针各发一份' });
  });
  STEPS.push({ t: N(TOTAL - 0.6), text: '四张卡都集齐 ' + whole() });

  /* ══════════════════════════════════════════════════════════
     ④ 几何：2×2 网格
     卡片位置由行列决定：r 的列 = r & 1，行 = r >> 1
     （0 左上 / 1 右上 / 2 左下 / 3 右下，正好和顺时针环对上）

     画布尺寸、卡片尺寸、槽位尺寸、字号**必须和 gather/scatter/
     broadcast/reduce 完全一致** —— 否则 SVG 等比缩放后卡片会变样。
     所以 view 直接沿用 1130×680（窄屏 380×720），网格自己排进去。
     ══════════════════════════════════════════════════════════ */
  var GEO = {
    desktop: {
      view: { w: 1130, h: 680 },
      card: { w: 300, h: 170 },
      /* 列间距 180、行间距 160：两条环边的通道宽度接近，画面不偏 */
      grid: { x: 175, y: 136, dx: 480, dy: 330 },
      legendY: 17,
      slot: { sw: 46, sh: 46, gap: 12 },
      hdr: 36,
      title: 15, badge: 10
    },
    narrow: {
      view: { w: 380, h: 720 },
      card: { w: 146, h: 126 },
      grid: { x: 8, y: 185, dx: 218, dy: 300 },
      legendY: 113,
      slot: { sw: 25, sh: 25, gap: 5 },
      hdr: 28,
      title: 12.5, badge: 8.5
    }
  };

  /* ══════════════════════════════════════════════════════════
     舞台
     ══════════════════════════════════════════════════════════ */
  var svg = $('#stage');
  var layer = {
    bg:     $('#lBg'),
    cards:  $('#lCards'),
    chips:  $('#lChips'),
    wires:  $('#lWires'),
    fx:     $('#lFx'),
    labels: $('#lLabels')
  };

  var L = GEO.desktop;
  var cards = {}, chips = {}, wires = {}, pkts = {};

  var focus = CV.attachFocus(svg, {
    /* 每张卡最后都有全部 4 段，聚焦任何一段都不该让卡褪色 */
    keepCards: function () { return RANKS; }
  });

  function cardGeo(r) {
    return {
      x: L.grid.x + (r & 1) * L.grid.dx,
      y: L.grid.y + (r >> 1) * L.grid.dy,
      w: L.card.w, h: L.card.h
    };
  }

  /* 两张卡之间的连线端点：横向相邻走左右边，纵向相邻走上下边 */
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

  /* 连线用三次贝塞尔，两端切线顺着连线方向 */
  function wirePath(e) {
    var dx = e.tx - e.sx, dy = e.ty - e.sy;
    return 'M ' + e.sx + ' ' + e.sy +
           ' C ' + (e.sx + dx * 0.42) + ' ' + (e.sy + dy * 0.42) + ', ' +
                 (e.tx - dx * 0.42) + ' ' + (e.ty - dy * 0.42) + ', ' +
                 e.tx + ' ' + e.ty;
  }

  function buildStage() {
    var v = L.view;
    svg.setAttribute('viewBox', '0 0 ' + v.w + ' ' + v.h);

    ['bg', 'cards', 'wires', 'chips', 'fx', 'labels'].forEach(function (k) {
      layer[k].innerHTML = '';
    });
    cards = {}; chips = {}; wires = {}; pkts = {};

    var defs = svg.querySelector('defs');

    CV.drawGrid(layer.bg, v);

    /* 图例：一份数据 = 四段 */
    CV.drawLegend(layer.bg, {
      x: L.grid.x + 7, y: L.legendY + 7,
      slot: L.slot, items: DATA
    });

    /* 卡片：四张平等，徽章显示已收到的段数 */
    RANKS.forEach(function (r) {
      cards[r] = CV.drawCard(layer.cards, {
        key: r, geo: cardGeo(r), color: DATA[r].color,
        title: 'rank ' + r,
        badgeText: '1/4',
        hdr: L.hdr, titleSize: L.title, badgeSize: L.badge
      });
    });

    /* 缓冲槽：每张卡固定四个位置，按 A B C D 排 */
    var c0 = L.slot;
    var totalW = PARTS * c0.sw + (PARTS - 1) * c0.gap;
    /* 落位公式与 gather 目标卡完全一致（同样减掉底部 16 的留白），
       这样四张卡里的数据块和其它页是同一套基线 */
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

    /* 箭头：按段分 4 个，同一段在各轮里颜色相同 */
    for (var i = 0; i < PARTS; i++) CV.drawMarker(defs, 'ah' + i);

    /* 连线：每轮四条边 */
    ROUTE.rounds.forEach(function (list, q) {
      list.forEach(function (f) {
        var e = edgeEnds(cards[f.from].geo, cards[f.to].geo);
        var w = CV.drawWire(layer.wires, { d: wirePath(e), markerId: 'ah' + f.letter });
        wires[q + '_' + f.from] = {
          path: w.path, len: w.len,
          marker: defs.querySelector('#ah' + f.letter + ' path'),
          sx: e.sx, sy: e.sy, tx: e.tx, ty: e.ty
        };
      });
    });

    /* 数据包：每条流一个（不能按段共用 —— 后面的轮次未激活时
       会把同一个包对象的 opacity 置 0，把前一轮正在飞的那个也抹掉） */
    ROUTE.rounds.forEach(function (list, q) {
      list.forEach(function (f) {
        pkts[q + '_' + f.from] = CV.drawPacket(layer.fx, {
          letter: DATA[f.letter].letter, color: DATA[f.letter].color
        });
      });
    });

    focus.refresh();
  }

  /* ══════════════════════════════════════════════════════════
     渲染
     ══════════════════════════════════════════════════════════ */
  var seen = {};

  /* 某个槽位在当前时刻的状态：own 自己那份 / done 已收到 /
     waiting 正在路上 / empty 还空着 */
  function slotState(r, i, sec) {
    if (i === r) return 'own';
    for (var q = 0; q < ROUNDS; q++) {
      var e = IN[r][q];
      if (!e || e.letter !== i) continue;
      if (sec >= e.popEnd) return 'done';
      if (sec >= e.start) return 'waiting';
      return 'empty';
    }
    return 'empty';
  }

  function paint(t) {
    var sec = t * TOTAL;

    /* —— 槽位 —— */
    RANKS.forEach(function (r) {
      chips[r].forEach(function (s, i) {
        var st = slotState(r, i, sec);

        if (st === 'own' || st === 'done') {
          CV.setSlot(s, { letter: DATA[i].letter, color: DATA[i].color }, {});
        } else if (st === 'waiting') {
          CV.setSlot(s, null, { active: true });
        } else {
          CV.setSlot(s, null, {});
        }

        /* 落位弹跳：数据一到就弹一下（与 gather 同一套 CSS 动画） */
        var key = 'p' + r + i;
        if (st === 'done') {
          if (!seen[key]) {
            seen[key] = 1;
            CV.spawnPulse(layer.fx, s);
          }
        } else if (st !== 'own') {
          delete seen[key];
        }
      });
    });

    /* —— 徽章：已收到几段 —— */
    var got = 1;
    ROUTE.rounds.forEach(function (list, q) {
      if (sec >= list[0].popEnd) got++;
    });
    var bt = got + '/' + PARTS;
    RANKS.forEach(function (r) {
      if (cards[r].badgeTx.textContent !== bt) cards[r].badgeTx.textContent = bt;
    });

    /* —— 连线 & 数据包 —— */
    ROUTE.rounds.forEach(function (list, q) {
      list.forEach(function (f) {
        var w = wires[q + '_' + f.from], p = pkts[q + '_' + f.from];
        var color = DATA[f.letter].color;
        var active = sec >= f.start && sec < f.arrive;

        if (active) {
          var e = CV.easeInOutQuad((sec - f.start) / (f.arrive - f.start));
          CV.placePacket(p, w, e);
          w.path.setAttribute('stroke', color);
          w.path.setAttribute('stroke-width', '2.6');
          w.path.setAttribute('stroke-dasharray', '9 7');
          w.path.setAttribute('opacity', '1');
          w.marker.setAttribute('fill', color);
        } else if (sec >= f.arrive) {
          p.g.setAttribute('opacity', '0');
          w.path.setAttribute('stroke', color);
          w.path.setAttribute('stroke-width', '1.8');
          w.path.setAttribute('stroke-dasharray', '8 7');
          w.path.setAttribute('opacity', '.45');
          w.marker.setAttribute('fill', color);
        } else {
          p.g.setAttribute('opacity', '0');
          w.path.setAttribute('stroke', '#c3cadb');
          w.path.setAttribute('stroke-width', '2');
          w.path.setAttribute('stroke-dasharray', '8 7');
          w.path.setAttribute('opacity', '1');
          w.marker.setAttribute('fill', '#c3cadb');
        }
      });
    });
  }

  /* ══════════════════════════════════════════════════════════
     启动
     ══════════════════════════════════════════════════════════ */
  var controls = CV.createControls({
    steps: STEPS,
    duration: TOTAL * 1000,
    onFrame: paint
  });

  var lastMode = null;
  function syncLayout(force) {
    var mode = window.innerWidth < 860 ? 'narrow' : 'desktop';
    if (!force && mode === lastMode) return;
    lastMode = mode;
    L = GEO[mode];
    seen = {};
    buildStage();
    paint(controls.t());
  }

  syncLayout(true);
  controls.paintChrome(controls.t());

  var rzTimer = null;
  window.addEventListener('resize', function () {
    clearTimeout(rzTimer);
    rzTimer = setTimeout(function () { syncLayout(false); }, 160);
  });
})();
