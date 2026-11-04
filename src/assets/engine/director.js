/* ============================================================
   src/assets/engine/director.js · ⑦呈现：挂载 + t 的纯函数分发
   ------------------------------------------------------------
   一切画面状态 = f(t)：state = 基态 + 顺放 ≤t 的事件，
   连续量按 t 采样 tween。组件不持定时器（00-实现总纲 §2）。
   播放 / seek / 循环只是 t 的推进方式；scrub 0–1000 由这里换算。
   ============================================================ */
(function (CV) {
  'use strict';

  CV.scene = function (id, def) { CV.scenes = CV.scenes || {}; CV.scenes[id] = def; };

  var EPS = 1e-4;
  function sp(k) { return CV.spec(k); }
  function lerp(a, b, u) { return a + (b - a) * u; }
  function clamp01(u) { return u < 0 ? 0 : (u > 1 ? 1 : u); }

  /* ── 基态（facts.pre 解码 + 全 idle）── */
  function baseState(scene) {
    var F = CV.FACTS[scene.id];
    var S = { cards: {}, slots: {}, wires: {} };
    for (var r = 0; r < 4; r++) {
      S.cards[r] = { dim: 1, glow: false, rows: 1, row1: null, calc: false };
      for (var i = 0; i < 4; i++) {
        var code = (F.pre[r] && F.pre[r][i] != null) ? F.pre[r][i] : '.';
        S.slots[r + ',0,' + i] = CV.slotDecode(code);
        S.slots[r + ',1,' + i] = { type: 'hidden' };
      }
    }
    return S;
  }

  function sampleTweens(T, t) {
    var out = { cardOp: {}, slotOp: {}, pop: {}, grow: {}, box: {}, pktFade: {} };
    T.tweens.forEach(function (w) {
      var u = clamp01((t - w.t0) / Math.max(1e-6, w.t1 - w.t0));
      if (t < w.t0 - EPS) return;
      var v;
      switch (w.kind) {
        case 'cardOp': case 'box': case 'pktFade':
        case 'slotOp':
          v = lerp(w.data.from, w.data.to, u);
          break;
        case 'grow':
          v = lerp(w.data.h0, w.data.h1, u);
          break;
        case 'pop':
          v = CV.popAt(u); break;
        case 'fly': return;   /* 单独处理 */
      }
      var bucket = out[w.kind];
      var key = w.kind === 'grow'
        ? w.who.r
        : (w.who.pkt != null ? 'p' + w.who.pkt : (w.who.r + ',' + (w.who.ri != null ? w.who.ri + ',' + w.who.i : '')));
      if (w.kind === 'grow') {
        /* 取该卡最近一次生效的 grow（后写覆盖） */
        bucket[key] = { v: v, t0: w.t0, t1: w.t1, data: w.data };
      } else if (w.kind === 'pop') {
        (bucket[key] = bucket[key] || []).push({ v: v, t0: w.t0, t1: w.t1 });
      } else {
        bucket[key] = v;   /* 后写覆盖：同键多段取进行中/最近段 */
        if (t > w.t1 + EPS && w.kind !== 'slotOp') bucket[key] = w.data.to;
        if (w.kind === 'slotOp' && t > w.t1 + EPS) bucket[key] = w.data.to;
      }
    });
    return out;
  }

  CV.boot = function (id) {
    var scene = CV.scenes[id];
    if (!scene) throw new Error('boot: 未注册剧本 ' + id);
    var F = CV.FACTS[id];
    var app = document.getElementById('app');
    if (!app) throw new Error('boot: 页面缺 #app');

    /* ── 骨架 ── */
    app.innerHTML =
      '<header class="cv-hd"><div><h1>' + scene.cn + '</h1>' +
      '<div class="cv-sub">' + F.en + ' · ' + F.dir + '</div></div></header>' +
      '<div class="cv-stage-wrap"><svg id="cv-stage" viewBox="0 0 ' + sp('dtViewW') + ' ' + sp('dtViewH') + '">' +
      '<defs><filter id="cvSh" x="-20%" y="-20%" width="150%" height="160%">' +
      '<feDropShadow dx="0" dy="2" stdDeviation="4" flood-color="' + sp('flood') + '" flood-opacity="0.14"/>' +
      '</filter></defs>' +
      '<g id="lBg"></g><g id="lWires"></g><g id="lCards"></g><g id="lPkt"></g><g id="lLegend"></g>' +
      '</svg></div>' +
      '<div class="cv-ctl"><button id="cvPlay">⏸ 暂停</button>' +
      '<input id="cvScrub" type="range" min="0" max="1000" step="1" value="0">' +
      '<span id="cvTime" class="cv-time">0.00 / --</span></div>' +
      '<button id="cvGear" class="cv-gear-btn" title="齿轮面板">⚙</button>' +
      '<div id="cvPanel" class="cv-panel hidden"></div>';

    var svg = document.getElementById('cv-stage');
    var layers = {
      bg: svg.querySelector('#lBg'), wires: svg.querySelector('#lWires'),
      cards: svg.querySelector('#lCards'), pkt: svg.querySelector('#lPkt'),
      legend: svg.querySelector('#lLegend')
    };

    /* 背景网格（③）：toneWireDim 细网格 */
    (function grid() {
      var step = sp('dtSlotGap') * 4;
      var g = CV.svgEl('g', { stroke: sp('toneWireDim'), 'stroke-opacity': 0.18 }, layers.bg);
      for (var x = step; x < sp('dtViewW'); x += step) {
        CV.svgEl('line', { x1: x, y1: 0, x2: x, y2: sp('dtViewH') }, g);
      }
      for (var y = step; y < sp('dtViewH'); y += step) {
        CV.svgEl('line', { x1: 0, y1: y, x2: sp('dtViewW'), y2: y }, g);
      }
    })();

    /* ── 编译 ── */
    var cardsGeo = CV.layoutCards(scene);
    if (id === 'allreduce' || id === 'reducescatter') CV.compilePrepLanes(scene, cardsGeo);
    var T = CV.compile(scene);
    var N = CV.narrate(T);

    /* ── 零件挂载 ── */
    var cardHandles = {}, wireHandles = {}, pktHandles = {};
    for (var r = 0; r < 4; r++) {
      cardHandles[r] = CV.card(layers.cards, {
        geo: cardsGeo[r], color: CV.spec('rank' + 'ABCD'[r]),
        title: 'rank ' + r, badge: (scene.badges || [])[r] || '',
        rows: scene.rows[r], maxRows: 2, glow: (scene.glow || []).indexOf(r) >= 0
      });
      cardHandles[r].setGeo(cardsGeo[r].x, cardsGeo[r].y, cardsGeo[r].w, CV.cardH(1, false));
    }
    T.wires.forEach(function (w) {
      wireHandles[w.id] = CV.wire(svg.querySelector('defs'), layers.wires,
        { id: w.id, path: w.path, muted: w.muted, hasArrow: w.hasArrow });
      wireHandles[w.id].set('idle');
    });
    T.packets.forEach(function (p) {
      pktHandles[p.id] = CV.packet(layers.pkt, p);
      pktHandles[p.id].hide();
    });
    CV.legend(layers.legend, CV.legendPos(scene));

    /* ── 状态机 ── */
    var evIdx = 0;
    function stateAt(t) {
      var S = baseState(scene);
      while (evIdx < T.events.length && T.events[evIdx].t <= t + EPS) { T.events[evIdx].fn(S); evIdx++; }
      return S;
    }

    /* ── 渲染 f(t) ── */
    var lastSlotSig = {}, lastWireSig = {};
    var wireColor = {};
    var hoverKeep = null;

    function render(t) {
      evIdx = 0;
      var S = stateAt(t);
      var TW = sampleTweens(T, t);

      for (var r = 0; r < 4; r++) {
        var c = S.cards[r], h = cardHandles[r];
        var dimmed = hoverKeep && hoverKeep.indexOf(r) < 0;
        h.setOpacity(TW.cardOp[r] != null ? TW.cardOp[r] : 1);
        if (dimmed) h.setOpacity(0.35);
        /* 高度：grow tween（最近一次） */
        var gw = TW.grow[r];
        if (gw) h.setH(gw.v); else h.setH(CV.cardH(1, false));
        h.setGlow(c.glow && !dimmed);
        h.setRow1(c.row1);
        h.setCalc(c.calc);
        h.setCalcOp(TW.box[r] != null ? TW.box[r] : (c.calc ? 1 : 0));
        for (var ri = 0; ri < 2; ri++) {
          for (var i = 0; i < 4; i++) {
            var st = S.slots[r + ',' + ri + ',' + i];
            var sig = st.type + '|' + (st.ch || '') + (st.idx != null ? st.idx : '') + (st.n || '');
            var key = r + ',' + ri + ',' + i;
            if (lastSlotSig[key] !== sig) { h.setSlot(ri, i, st); lastSlotSig[key] = sig; }
            var op = st.type === 'hidden' ? 0
              : (TW.slotOp[key] != null ? TW.slotOp[key] : 1);
            h.setSlotOp(ri, i, op);
            var pops = TW.pop[key];
            if (pops && pops.length) {
              var active = pops[pops.length - 1];
              var u = clamp01((t - active.t0) / Math.max(1e-6, active.t1 - active.t0));
              h.setSlotScale(ri, i, (t >= active.t0 && t <= active.t1 + EPS) ? active.v.k : 1);
            }
          }
        }
      }
      Object.keys(S.wires).forEach(function (wid) {
        var w = S.wires[wid];
        if (w.color) wireColor[wid] = w.color;
        var sig = w.st + '|' + (wireColor[wid] || '');
        if (lastWireSig[wid] !== sig) {
          wireHandles[wid].set(w.st, wireColor[wid]);
          lastWireSig[wid] = sig;
        }
      });
      /* 数据包：fly + pktFade + 残影 */
      T.tweens.forEach(function (w) {
        if (w.kind !== 'fly') return;
        var ph = pktHandles[w.who.pkt];
        if (t < w.t0 - EPS || t > w.t1 + sp('packFade') + 0.01) { ph.hide(); return; }
        var q = clamp01((t - w.t0) / Math.max(1e-6, w.t1 - w.t0));
        var eq = w.data.ease ? CV.flightEase(q) : q;
        var pos = w.data.path.at(eq);
        var takeoffFrac = sp('takeoffFade');
        var op = q < takeoffFrac ? q / takeoffFrac : 1;
        var pf = TW.pktFade['p' + w.who.pkt];
        if (pf != null) op *= pf;
        ph.setMain(pos.x, pos.y, op);
        var dist = sp('trailDist');
        for (var gk = 0; gk < 2; gk++) {
          var qg = eq - (gk + 1) * dist / w.data.path.len;
          if (qg > 0.001 && op > 0.05) {
            var gp = w.data.path.at(qg);
            ph.setGhost(gk, gp.x, gp.y, (gk === 0 ? 0.35 : 0.16) * sp('trailScale') * op);
          } else ph.setGhost(gk, 0, 0, 0);
        }
      });
    }

    /* ── 控件（⑦§1）：播放/暂停、scrub 0–1000、循环 ── */
    var playing = true, tCur = 0, lastTick = null;
    var playBtn = document.getElementById('cvPlay');
    var scrub = document.getElementById('cvScrub');
    var timeEl = document.getElementById('cvTime');
    function setScrub(t) {
      scrub.value = Math.round(1000 * t / T.total);
      timeEl.textContent = t.toFixed(2) + ' / ' + T.total.toFixed(2);
    }
    function tick(ts) {
      if (lastTick != null && playing) {
        tCur += (ts - lastTick) / 1000 * sp('pageSpeed');
        if (tCur >= T.total) tCur = 0;   /* 循环（⑦§1） */
        render(tCur); setScrub(tCur);
      }
      lastTick = ts;
      requestAnimationFrame(tick);
    }
    playBtn.addEventListener('click', function () {
      playing = !playing;
      playBtn.textContent = playing ? '⏸ 暂停' : '▶ 播放';
    });
    scrub.addEventListener('input', function () {
      tCur = Number(scrub.value) / 1000 * T.total;   /* 0–1000 刻度在此换算 */
      render(tCur); setScrub(tCur);
    });

    /* ── 悬停聚焦（⑦§2，D4 通用规则）── */
    layers.cards.addEventListener('mouseover', function (e) {
      var g = e.target.closest('g[data-card]');
      if (!g) return;
      var r = Number(g.getAttribute('data-card'));
      hoverKeep = (scene.glow || []).length === 1 ? [r, scene.glow[0]] : [r];
    });
    layers.cards.addEventListener('mouseout', function (e) {
      if (!e.target.closest('g[data-card]')) return;
      hoverKeep = null;
    });

    /* ── 齿轮面板 ── */
    var gearBtn = document.getElementById('cvGear');
    var panel = document.getElementById('cvPanel');
    var chrome = CV.chrome({
      scene: scene, T: T, narr: N,
      seek: function (t) { tCur = t; render(t); setScrub(t); },
      getT: function () { return tCur; }
    });
    gearBtn.addEventListener('click', function () {
      panel.classList.toggle('hidden');
      if (!panel.classList.contains('hidden')) chrome.render();
    });

    render(0);
    requestAnimationFrame(tick);

    window.__CV = {
      id: id, total: T.total, steps: T.steps.length,
      gearRows: T.gear.length, rows: N.flat.length, T: T
    };
    window.__CV_READY = true;
  };
})(window.CV = window.CV || {});
