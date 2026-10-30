/* ============================================================
   CommonVisual v2 · L2 节拍（B1 beat.seat / B2 beat.fuse / B3 settle / B4 dim）
   ------------------------------------------------------------
   一次动作的表现层：
   · seat   落位弹跳（无→有，靠过冲给手感；涟漪环已废弃）
   · fuse   两份合成一份（含计算框伴生块）：位移↑缩放↓透明度↓全单调
   · calc   计算方框（fuse 的伴生块，离开合并就没有意义，不单独成件）
   ============================================================ */
(function (CV) {
  'use strict';
  var el = CV.el;

  /* ---------- B1 落位弹跳：色块弹跳（涟漪环可选，默认关） ---------- */
  CV.beat = CV.beat || {};

  CV.beat.SHOW_RING = false;

  CV.beat.seat = function (popLayer, slot, color, durSec) {
    /* 弹跳时长取规范 08 的 popDur；页面按自己倍数算好秒就传进来 */
    var d = (typeof durSec === 'number' && durSec >= 0) ? durSec
                                                        : ((CV.params && CV.params.get('08-seat', 'popDur')) || 0.55);
    slot.g.style.animationDuration = d + 's';
    slot.g.classList.remove('slot-pop');
    /* SVG 无 offsetWidth，用 getBoundingClientRect 强制回流，否则删-加 class 被合并不重播 */
    void slot.g.getBoundingClientRect();
    slot.g.classList.add('slot-pop');

    if (!CV.beat.SHOW_RING) return;

    var ring = el('circle', {
      class: 'ring', cx: slot.cx, cy: slot.cy, r: Math.round(slot.w / 2),
      stroke: color, opacity: .8
    }, popLayer);
    setTimeout(function () {
      if (ring.parentNode) ring.parentNode.removeChild(ring);
    }, 1100);
  };
  CV.spawnPulse = CV.beat.seat;

  /* ---------- 计算方框：一枚小方牌 + 悬停说明（fuse 的伴生块） ----------
     整体局部坐标绘制（方牌以原点为中心、上沿 y=0），每帧只改外层 transform。 */
  CV.beat.calc = function (parent, o) {
    var g = el('g', { class: 'calc-wrap', 'data-on': '0' }, parent);
    g.style.transition = 'none';   /* 显隐由 JS 逐帧写，别让 CSS 过渡插一脚 */

    var chip = el('g', { class: 'calc-chip' }, g);
    el('rect', {
      class: 'calc-chip-bg',
      x: -o.w / 2, y: 0, width: o.w, height: o.h,
      rx: Math.round(o.h * 0.30),
      fill: '#fbfaff', stroke: '#d7d2ea', 'stroke-width': 1.2
    }, chip);
    el('text', {
      class: 'calc-tx', x: 0, y: o.h / 2,
      'text-anchor': 'middle', 'dominant-baseline': 'central',
      'font-size': o.fs, fill: '#6a5f8a'
    }, chip).textContent = '计算';

    /* 悬停提示：贴在方牌下沿的深色气泡；宽度按文案实测算 */
    var tip = el('g', { class: 'calc-tip' }, g);
    var th = o.h + 6, ty = o.h + 8;
    var trect = el('rect', {
      x: 0, y: ty, width: 0, height: th,
      rx: Math.round(th * 0.34),
      fill: '#363b4e', 'fill-opacity': .96, filter: 'url(#fGlow)'
    }, tip);
    var ttx = el('text', {
      x: 0, y: ty + th / 2,
      'text-anchor': 'middle', 'dominant-baseline': 'central',
      'font-size': o.tipFs, fill: '#fff', 'font-family': 'var(--mono)'
    }, tip);
    ttx.textContent = o.tipText;

    var pad = o.tipPad == null ? 12 : o.tipPad;
    var len = 0;
    try { len = ttx.getComputedTextLength(); } catch (e) { len = 0; }
    if (!len) len = (o.tipText || '').length * o.tipFs * 0.6;
    var tw = o.tipW || Math.round(len + pad * 2);
    trect.setAttribute('x', -tw / 2);
    trect.setAttribute('width', tw);

    return { wrap: g, chip: chip, tip: tip, w: o.w, h: o.h, tipW: tw, tipH: th };
  };
  CV.drawCalc = CV.beat.calc;

  /* ---------- B2 融合：下排的块被上排「吸」走 ----------
     与落位弹跳相反：位移↑、缩放↓、透明度↓三个量全单调，一次回头都没有；
     目标块自己不缩放，只被一道白光扫过。
     o = { x, y0, y1, size, data, target, to }，返回 { apply(p), reset(), g }。 */
  var mergeSeq = 0;
  CV.beat.fuse = function (parent, o) {
    var id = 'fGloss' + (++mergeSeq);
    var size = o.size, half = size / 2, x = o.x, y0 = o.y0, y1 = o.y1;
    var base = o.data.color, tg = o.target;

    var svg = parent.ownerSVGElement || parent;
    var defs = svg.querySelector('defs');
    if (!defs) defs = el('defs', {}, svg);

    /* 白光：三停渐变，靠 gradientTransform 平移扫过（两端全透明，天然不出块外） */
    var grad = el('linearGradient', { id: id, x1: '0', y1: '0', x2: '1', y2: '0' }, defs);
    el('stop', { offset: '.15', 'stop-color': '#fff', 'stop-opacity': '0' }, grad);
    el('stop', { offset: '.5', 'stop-color': '#fff', 'stop-opacity': '.70' }, grad);
    el('stop', { offset: '.85', 'stop-color': '#fff', 'stop-opacity': '0' }, grad);

    var root = el('g', { class: 'fuse' }, parent);

    /* 轨道线：被吸上去的这一路，亮一下就走 */
    var guide = el('line', {
      x1: x, y1: y1 + half, x2: x, y2: y0 - half,
      stroke: '#c9b6f7', 'stroke-width': 1.2, 'stroke-dasharray': '3 4'
    }, root);
    guide.style.opacity = '0';

    /* 两块残影：缩放 .8 / .6 —— 与飞行包同一套语言 */
    function ghost() {
      var g = el('g', {}, root);
      el('rect', {
        x: 0, y: 0, width: size, height: size, rx: 8,
        fill: base, filter: 'url(#fTrail)'
      }, g);
      g.setAttribute('opacity', '0');
      return g;
    }
    var t2 = ghost(), t1 = ghost();

    var src = CV.cast.slot(root, 0, 0, size, size);
    CV.cast.set(src, o.data, {});
    /* 舞台样式里 .slot-g 带 opacity 过渡 + transform-box: fill-box，
       逐帧写会拖尾、绕块自身中心会歪 —— 这里显式盖回来 */
    [src.g, t1, t2].forEach(function (g) {
      g.style.transition = 'none';
      g.style.transformBox = 'view-box';
      g.style.transformOrigin = '0 0';
    });

    /* 白光画在最后 = 压在目标块上面 */
    var gloss = el('rect', {
      x: tg.x, y: tg.y, width: tg.w, height: tg.h, rx: 8,
      fill: 'url(#' + id + ')', 'pointer-events': 'none'
    }, parent);
    gloss.setAttribute('opacity', '0');

    function put(node, cx, cy, s) {
      node.setAttribute('transform',
        'translate(' + (cx - half * s).toFixed(2) + ' ' + (cy - half * s).toFixed(2) +
        ') scale(' + s.toFixed(3) + ')');
    }
    function cl(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }

    var merged = false;

    /* 规范值每帧现取（规范页拖滑杆立刻变形）；参数有先后关系，先夹一次 */
    function knobs() {
      function g(k, d) {
        var v = CV.params ? CV.params.get('09-merge', k) : undefined;
        return typeof v === 'number' ? v : d;
      }
      var wake = Math.max(.02, g('fuseWake', .16));
      var rise = Math.min(.98, Math.max(wake + .04, g('fuseRise', .72)));
      var swap = Math.min(1, Math.max(wake + .08, g('fuseSwap', .78)));
      var fade = Math.min(swap - .03, Math.max(0, g('fuseFade', .45)));
      return {
        wake: wake, rise: rise, swap: swap, fade: fade,
        shrink: Math.min(1, Math.max(0, g('fuseShrink', .36))),
        gloss:  Math.max(0, g('fuseGloss', .9)),
        trail:  Math.max(0, g('fuseTrail', 18))
      };
    }

    function apply(p) {
      p = cl(p);
      var K = knobs();
      var wake = cl(p / K.wake);
      var rise = CV.easeInOutQuad(cl((p - K.wake) / (K.rise - K.wake)));
      var op   = 1 - CV.easeInOutQuad(cl((p - K.fade) / Math.max(.02, K.swap - K.fade)));
      var s    = 1 - (1 - K.shrink) * rise;
      var cy   = y0 + (y1 - y0) * rise;

      /* ① 唤醒：只改颜色与描边，块一步都不挪 */
      var lit = CV.mix(base, '#ffffff', .30 * wake);
      src.rect.setAttribute('fill', lit);
      src.rect.setAttribute('stroke', wake > .02 ? lit : '#d5dae8');
      src.rect.setAttribute('stroke-dasharray', wake > .02 ? 'none' : '4 3');

      /* ② 上浮 ＋ 缩小 ＋ 淡出：三个量一起单调，没有任何回弹 */
      put(src.g, x, cy, s);
      src.g.setAttribute('opacity', op.toFixed(3));

      /* 拖尾：跟着 rise 开门，快贴到目标时先退场 */
      var gate = cl((rise - .05) / .12) * (1 - cl((p - Math.max(.1, K.fade - .03)) / .20));
      var to = op * (1 - rise * .5) * gate;
      put(t1, x, cy + K.trail, s * .8);
      t1.setAttribute('opacity', (to * .40).toFixed(3));
      put(t2, x, cy + K.trail * 1.67, s * .6);
      t2.setAttribute('opacity', (to * .20).toFixed(3));

      guide.style.opacity = (cl(p / .18) * (1 - cl((p - .60) / .30)) * .9).toFixed(3);

      /* ③ 注入：白光在淡出开始后扫过，换 Σ 那一刻达到峰值 */
      var gs = Math.max(K.fade, K.swap - .23);
      var ge = Math.min(1, K.swap + .22);
      var gp = cl((p - gs) / Math.max(.02, ge - gs));
      gloss.setAttribute('opacity', Math.min(1, Math.sin(Math.PI * gp) * K.gloss).toFixed(3));
      grad.setAttribute('gradientTransform', 'translate(' + (-1 + 2 * gp).toFixed(3) + ' 0)');

      if (p >= K.swap && !merged) { merged = true; CV.cast.set(tg, o.to, {}); }
    }

    function reset() {
      merged = false;
      CV.cast.set(tg, o.data, {});
      apply(0);
    }

    apply(0);
    return { g: root, apply: apply, reset: reset, gloss: gloss };
  };
  CV.createMerge = CV.beat.fuse;

  /* ---------- B4 dim：正在发送的卡变暗（传播中的唯一可视信号） ---------- */
  CV.beat.dim = function (card, on) {
    card.g.setAttribute('opacity', on ? '.6' : '1');
  };
})(window.CV = window.CV || {});
