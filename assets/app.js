/* ============================================================
   CommonVisual · Gather 可视化
   动画引擎 + 页面逻辑
   ============================================================ */
(function () {
  'use strict';

  /* ---------- 数据模型 ---------- */
  const RANKS = [
    { r: 0, letter: 'A', color: '#7c3aed', soft: '#ede9fe', role: '收集者 · dst',      kind: 'collector' },
    { r: 1, letter: 'B', color: '#0ea5e9', soft: '#e0f2fe', role: '贡献者 · src',      kind: 'contributor' },
    { r: 2, letter: 'C', color: '#10b981', soft: '#d9f7ee', role: '贡献者 · src',      kind: 'contributor' },
    { r: 3, letter: 'D', color: '#f59e0b', soft: '#fdf0d5', role: '贡献者 · src',      kind: 'contributor' }
  ];

  const PRIMS = [
    { name: 'Broadcast', cn: '广播',   send: '1 人发',  recv: '全体收', vol: '不变',   cls: 'vol-flat', sem: '复制', scene: 'rank 0 广播模型参数' },
    { name: 'Scatter',   cn: '分散',   send: '1 人发',  recv: '全体收', vol: '不变',   cls: 'vol-flat', sem: '切分', scene: '大 batch 切成 N 份下发' },
    { name: 'Gather',    cn: '收集',   send: '全体发',  recv: '1 人收', vol: '膨胀',   cls: 'vol-up',   sem: '拼接', scene: '各卡结果汇总到 rank 0' },
    { name: 'All-Gather',cn: '全收集', send: '全体发',  recv: '全体收', vol: '膨胀',   cls: 'vol-up',   sem: '拼接', scene: 'SP unshard 还原完整序列' },
    { name: 'Reduce',    cn: '归约',   send: '全体发',  recv: '1 人收', vol: '压缩',   cls: 'vol-down', sem: '汇总', scene: '梯度归约到 rank 0' },
    { name: 'All-Reduce',cn: '全归约', send: '全体发',  recv: '全体收', vol: '不变',   cls: 'vol-flat', sem: '汇总', scene: 'CFG 正负 prompt 结果合并' },
    { name: 'Reduce-Scatter', cn: '归约分散', send: '全体发', recv: '全体收', vol: '不变', cls: 'vol-flat', sem: '汇总切分', scene: 'FSDP 权重分片' },
    { name: 'All-to-All',cn: '全交换', send: '全体发',  recv: '全体收', vol: '不变',   cls: 'vol-flat', sem: '洗牌', scene: 'SP Ulysses 序列 ↔ 头交换' }
  ];

  /* ---------- 时间轴（归一化 0→1） ---------- */
  const T = {
    init:  [0.00, 0.10],
    alloc: [0.10, 0.20],
    xfers: [
      { from: 1, to: 0, start: 0.20, end: 0.38 },
      { from: 2, to: 0, start: 0.38, end: 0.56 },
      { from: 3, to: 0, start: 0.56, end: 0.74 }
    ],
    done:  [0.74, 1.00]
  };

  const STEPS = [
    { t: 0.00, title: '初始状态：各卡各持一段',
      desc: '4 张 GPU 各自持有 1 段本地数据（A / B / C / D），彼此不可见。rank 0 作为目标卡，此时缓冲区里只有它自己那份 A。',
      tag: 't = 0.00' },
    { t: 0.11, title: 'rank 0 预分配接收缓冲区',
      desc: 'dst 需要一块能装下 4 段数据的输出缓冲。先把空间预留出来，再逐段填入——这就是「操作后」里 rank 0 缓冲区变成 4 段的原因。',
      tag: 't = 0.11' },
    { t: 0.21, title: 'rank 1 → rank 0：发送 B',
      desc: 'rank 1 把自己的那段数据沿互联总线发给 rank 0。数据落地后 rank 0 的缓冲区变成 [A│B]，而 rank 1 手里那份 B 仍然保留。',
      tag: 't = 0.21' },
    { t: 0.39, title: 'rank 2 → rank 0：发送 C',
      desc: '第二轮点对点传输。N−1 个贡献者依次（或并行）把自己那一份发给 dst，共 3 次发送，每次搬运 1 段数据。',
      tag: 't = 0.39' },
    { t: 0.57, title: 'rank 3 → rank 0：发送 D',
      desc: '最后一段数据送达。rank 0 按 rank 顺序把各段拼进同一块连续缓冲，缓冲区达到满载 4 段。',
      tag: 't = 0.57' },
    { t: 0.76, title: '拼接完成：rank 0 拿到完整结果',
      desc: 'Gather 结束。rank 0 的缓冲区是 [A│B│C│D]，其余三卡完全不变——它们既没有被清空，也没有拿到副本。',
      tag: 't = 0.76' }
  ];

  /* ---------- 舞台几何 ---------- */
  /* 宽屏：dst 在左，3 个源卡竖排在右，连线经中间总线汇聚
     窄屏：dst 在上，3 个源卡横排在下方，链路自上而下          */
  const GEO_WIDE = {
    mode: 'wide',
    col0: { x: 55,  y: 160, w: 270, h: 200 },
    col1: { x: 690, y: 40,  w: 250, h: 140 },
    col2: { x: 690, y: 190, w: 250, h: 140 },
    col3: { x: 690, y: 340, w: 250, h: 140 },
    busX: 505
  };
  const GEO_TALL = {
    mode: 'tall',
    col0: { x: 100, y: 20,  w: 340, h: 170 },
    col1: { x: 10,  y: 300, w: 160, h: 150 },
    col2: { x: 190, y: 300, w: 160, h: 150 },
    col3: { x: 370, y: 300, w: 160, h: 150 }
  };
  let GEO = GEO_WIDE;
  const SVG_VIEW = { wide: { w: 1000, h: 520 }, tall: { w: 540, h: 480 } };

  const SVG_NS = 'http://www.w3.org/2000/svg';
  const $  = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));

  function el(tag, attrs, parent) {
    const n = document.createElementNS(SVG_NS, tag);
    if (attrs) for (const k in attrs) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  }
  function h(tag, cls, html, parent) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    if (parent) parent.appendChild(n);
    return n;
  }
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  /* ============================================================
     1. 构建舞台
     ============================================================ */
  const svg      = $('#stageSvg');
  const layerBg  = $('#layerBg');
  const layerCards  = $('#layerCards');
  const layerWires  = $('#layerWires');
  const layerChips  = $('#layerChips');
  const layerPackets= $('#layerPackets');
  const layerLabels = $('#layerLabels');

  const cardRefs = {};   // rank -> {g, slots:[{g,rect,text}], occ}
  const wireRefs = {};   // "from>to" -> {path, len}
  const packetRefs = {}; // from -> g

  function buildStage() {
    const view = SVG_VIEW[GEO.mode];
    svg.setAttribute('viewBox', `0 0 ${view.w} ${view.h}`);
    const isTall = GEO.mode === 'tall';

    /* 清空旧的层内容（保留 defs） */
    [layerBg, layerCards, layerWires, layerChips, layerPackets, layerLabels].forEach(l => { l.innerHTML = ''; });
    Object.keys(cardRefs).forEach(k => delete cardRefs[k]);
    Object.keys(wireRefs).forEach(k => delete wireRefs[k]);
    Object.keys(packetRefs).forEach(k => delete packetRefs[k]);

    /* 背景板 + 网格 */
    el('rect', { x: 0, y: 0, width: view.w, height: view.h, fill: 'url(#gradBg)' }, layerBg);
    el('rect', { x: 0, y: 0, width: view.w, height: view.h, fill: 'url(#gridPat)', opacity: '.75' }, layerBg);

    /* 互联总线（宽屏：竖直中轴；窄屏：横向汇聚带） */
    const bus = el('g', {}, layerBg);
    let busLabelX, busLabelY;
    if (!isTall) {
      el('rect', { x: GEO.busX - 9, y: 96, width: 18, height: 328, rx: 9, fill: '#e6e9f4' }, bus);
      el('rect', { x: GEO.busX - 3, y: 104, width: 6, height: 312, rx: 3, fill: '#c9cee4' }, bus);
      busLabelX = GEO.busX; busLabelY = 452;
    } else {
      el('rect', { x: 60, y: 226, width: 420, height: 18, rx: 9, fill: '#e6e9f4' }, bus);
      el('rect', { x: 64, y: 232, width: 412, height: 6, rx: 3, fill: '#c9cee4' }, bus);
      busLabelX = 270; busLabelY = 276;
    }
    el('text', {
      x: busLabelX, y: busLabelY, 'text-anchor': 'middle',
      'font-family': 'ui-monospace, monospace', 'font-size': '11', fill: '#9aa2bd',
      'letter-spacing': '1.2'
    }, bus).textContent = 'GPU 互联总线 · NVLink / PCIe';

    /* 卡片 */
    RANKS.forEach(rank => {
      const geo = rank.r === 0 ? GEO.col0 : GEO[`col${rank.r}`];
      const g = el('g', {}, layerCards);
      const isDst = rank.r === 0;
      const compact = isTall && !isDst;

      /* 卡片底 */
      el('rect', {
        x: geo.x, y: geo.y, width: geo.w, height: geo.h, rx: 18,
        fill: '#ffffff', stroke: isDst ? '#c9b6f7' : '#e5e8f0',
        'stroke-width': isDst ? 2 : 1, filter: 'url(#softShadow)'
      }, g);
      el('rect', { x: geo.x, y: geo.y, width: geo.w, height: 5, rx: 2.5, fill: rank.color }, g);

      /* 标题 */
      el('text', {
        x: geo.x + 22, y: geo.y + (isDst ? 42 : 38),
        'font-family': '-apple-system, system-ui, sans-serif', 'font-size': isDst ? 21 : 19,
        'font-weight': 700, fill: '#1a1f36'
      }, g).textContent = 'GPU ' + rank.r;
      el('text', {
        x: geo.x + 22, y: geo.y + (isDst ? 62 : 58),
        'font-family': '-apple-system, system-ui, sans-serif', 'font-size': 12, fill: '#8b93aa'
      }, g).textContent = rank.role;

      /* 徽章 */
      const badge = el('g', {}, g);
      el('rect', { x: geo.x + geo.w - 66, y: geo.y + 22, width: 46, height: 22, rx: 7, fill: rank.soft }, badge);
      el('text', {
        x: geo.x + geo.w - 43, y: geo.y + 37, 'text-anchor': 'middle',
        'font-family': 'ui-monospace, monospace', 'font-size': 11, 'font-weight': 700, fill: rank.color
      }, badge).textContent = 'rank ' + rank.r;

      /* 缓冲槽 */
      const slots = [];
      const slotY = geo.y + (isDst ? 92 : 66);
      const slotW = compact ? 40 : 44;
      const slotH = compact ? 36 : 40;
      const count = isDst ? 4 : 1;
      for (let i = 0; i < count; i++) {
        const sx = geo.x + 22 + i * (slotW + 8);
        const sg = el('g', {}, g);
        const rect = el('rect', {
          x: sx, y: slotY, width: slotW, height: slotH, rx: 9,
          fill: '#f6f7fb', stroke: '#dfe3ee', 'stroke-width': 1.5,
          'stroke-dasharray': '5 4'
        }, sg);
        const text = el('text', {
          x: sx + slotW / 2, y: slotY + slotH * 0.65, 'text-anchor': 'middle',
          'font-family': 'ui-monospace, monospace', 'font-size': compact ? 14 : 16,
          'font-weight': 700, fill: '#c2c8da'
        }, sg);
        slots.push({ g: sg, rect, text });
      }

      /* 占用说明 */
      const occ = el('text', {
        x: geo.x + 22, y: geo.y + geo.h - 16,
        'font-family': '-apple-system, system-ui, sans-serif', 'font-size': compact ? 11 : 12, fill: '#8b93aa'
      }, g);
      occ.textContent = isDst ? '缓冲区 1 / 4 段' : (compact ? '本段 1 段 · 不变' : '本段 1 段 · 保持不变');

      cardRefs[rank.r] = { g, slots, occ, geo, isDst, rank, slotY, slotW, slotH };
    });

    /* 箭头 marker */
    const defs = svg.querySelector('defs');
    if (!defs.querySelector('#arrowHead')) {
      const marker = el('marker', {
        id: 'arrowHead', viewBox: '0 0 10 10', refX: 8, refY: 5,
        markerWidth: 6, markerHeight: 6, orient: 'auto-start-reverse'
      }, defs);
      el('path', { d: 'M0,0 L10,5 L0,10 z', fill: '#b9c0d6' }, marker);
    }

    /* 连线 */
    [1, 2, 3].forEach(r => {
      const src = cardRefs[r].geo;
      const dst = cardRefs[0].geo;
      let d;
      if (!isTall) {
        /* 宽屏：源卡左边缘 → 竖直总线 → dst 右边缘 */
        const sx = src.x, sy = src.y + src.h / 2;
        const dx = dst.x + dst.w;
        const dy = dst.y + cardRefs[0].slotY + cardRefs[0].slotH / 2;
        const bx = GEO.busX;
        d = `M ${sx} ${sy} C ${sx - 70} ${sy}, ${bx + 55} ${sy}, ${bx} ${sy}` +
            ` L ${bx} ${dy}` +
            ` C ${bx - 55} ${dy}, ${dx + 65} ${dy}, ${dx} ${dy}`;
      } else {
        /* 窄屏：源卡上边缘 → 横向总线 → dst 下边缘 */
        const sx = src.x + src.w / 2, sy = src.y;
        const dx = dst.x + dst.w * (0.25 + 0.25 * (r - 1));
        const dy = dst.y + dst.h;
        d = `M ${sx} ${sy} C ${sx} ${sy - 40}, ${dx} ${dy + 70}, ${dx} ${dy}`;
      }
      const p = el('path', {
        d, fill: 'none', stroke: '#d5dae8', 'stroke-width': 2.4,
        'stroke-linecap': 'round', 'stroke-linejoin': 'round',
        'stroke-dasharray': '9 9', 'marker-end': 'url(#arrowHead)'
      }, layerWires);
      wireRefs[r + '>0'] = { path: p, len: p.getTotalLength() };
    });

    /* 数据包（飞行中的小块） */
    [1, 2, 3].forEach(r => {
      const rank = RANKS[r];
      const g = el('g', { opacity: 0 }, layerPackets);
      el('rect', { x: -13, y: -13, width: 26, height: 26, rx: 7, fill: rank.color, filter: 'url(#packetGlow)' }, g);
      el('text', {
        x: 0, y: 5, 'text-anchor': 'middle',
        'font-family': 'ui-monospace, monospace', 'font-size': 13, 'font-weight': 700, fill: '#fff'
      }, g).textContent = rank.letter;
      packetRefs[r] = g;
    });

    /* 标注 */
    const ann = el('g', {}, layerLabels);
    const annText = el('text', {
      x: isTall ? 270 : GEO.busX, y: isTall ? 205 : 82, 'text-anchor': 'middle',
      'font-family': '-apple-system, system-ui, sans-serif', 'font-size': 12.5, 'font-weight': 600, fill: '#6d28d9'
    }, ann);
    annText.textContent = '';
    cardRefs.__ann = annText;
  }

  /* ---------- 舞台布局随断点切换 ---------- */
  let lastMode = null;
  function syncLayout(force) {
    const mode = window.innerWidth < 780 ? 'tall' : 'wide';
    if (!force && mode === lastMode) return;
    lastMode = mode;
    GEO = mode === 'tall' ? GEO_TALL : GEO_WIDE;
    buildStage();
    paint(t);
  }

  /* ============================================================
     2. 时间轴 → 画面状态
     ============================================================ */
  function paint(t) {
    /* —— 进度条 / 百分比 —— */
    const pct = Math.round(t * 100);
    $('#progFill').style.width = pct + '%';
    $('#progNum').textContent = pct + '%';
    $('#scrub').value = Math.round(t * 1000);

    /* —— rank 0 缓冲区 —— */
    /* count = 已落地的段数；activeSlot = 正在接收的槽位下标 */
    let count = 1;
    let activeSlot = -1;
    T.xfers.forEach(x => {
      if (t >= x.end) count += 1;
      else if (t >= x.start) activeSlot = count;
    });

    const dstCells = $('#dstCells');
    if (dstCells.children.length !== 4) {
      dstCells.innerHTML = '';
      for (let i = 0; i < 4; i++) h('div', 'dst-cell', '', dstCells);
    }
    Array.from(dstCells.children).forEach((c, i) => {
      c.className = 'dst-cell';
      if (i < count) {
        c.classList.add('is-filled');
        c.style.background = RANKS[i].color;
        c.textContent = RANKS[i].letter;
      } else if (i === activeSlot) {
        c.classList.add('is-active');
        c.textContent = '?';
      } else {
        c.textContent = '';
      }
    });
    $('#dstCount').textContent = count + ' / 4 段';
    $('#dstBytes').textContent = count + '×';
    $('#dstNote').textContent =
      count === 1 ? 'rank 0 尚未开始接收' :
      count < 4  ? '已收到 ' + (count - 1) + ' 份贡献者数据' :
                   '完整结果 [A│B│C│D] 已就绪';

    /* —— 卡片槽位 —— */
    RANKS.forEach(rank => {
      const ref = cardRefs[rank.r];
      const ownLetter = rank.letter;
      ref.slots.forEach((s, i) => {
        let fill = null;
        if (rank.r === 0) {
          if (i < count) fill = RANKS[i];
          else if (i === activeSlot) {
            s.rect.setAttribute('fill', '#f3eeff');
            s.rect.setAttribute('stroke', '#8b5cf6');
            s.rect.setAttribute('stroke-dasharray', 'none');
            s.text.setAttribute('fill', '#8b5cf6');
            s.text.textContent = '…';
            return;
          }
        } else if (i === 0) {
          fill = rank;
        }
        if (fill) {
          s.rect.setAttribute('fill', fill.color);
          s.rect.setAttribute('stroke', 'none');
          s.rect.setAttribute('stroke-dasharray', 'none');
          s.text.setAttribute('fill', '#fff');
          s.text.textContent = fill.letter;
        } else {
          s.rect.setAttribute('fill', '#f6f7fb');
          s.rect.setAttribute('stroke', '#dfe3ee');
          s.rect.setAttribute('stroke-dasharray', '5 4');
          s.text.setAttribute('fill', '#c2c8da');
          s.text.textContent = '';
        }
      });

      if (rank.r === 0) {
        ref.occ.textContent = '缓冲区 ' + count + ' / 4 段' + (count === 4 ? ' · 完整' : '');
        ref.g.style.opacity = (t >= T.done[0] || (t >= T.alloc[0] && t < T.done[0])) ? '1' : '.96';
      } else {
        const sending = T.xfers.some(x => x.from === rank.r && t >= x.start && t < x.end);
        ref.occ.textContent = sending ? '发送中…（本地仍保留）' : '本段 1 段 · 保持不变';
      }
    });

    /* —— 连线 & 数据包 —— */
    T.xfers.forEach(x => {
      const w = wireRefs[x.from + '>0'];
      const pk = packetRefs[x.from];
      const active = t >= x.start && t < x.end;
      const done = t >= x.end;

      if (active) {
        const p = (t - x.start) / (x.end - x.start);
        const e = p < .5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2; // easeInOutQuad
        const pt = w.path.getPointAtLength(e * w.len);
        pk.setAttribute('opacity', '1');
        pk.setAttribute('transform', `translate(${pt.x} ${pt.y}) scale(${1.12 - .12 * e})`);
        w.path.setAttribute('stroke', RANKS[x.from].color);
        w.path.setAttribute('stroke-width', '3.2');
        w.path.setAttribute('stroke-dashoffset', String(-e * 90));
        w.path.setAttribute('opacity', '1');
        w.path.setAttribute('marker-end', 'none');
      } else if (done) {
        pk.setAttribute('opacity', '0');
        w.path.setAttribute('stroke', RANKS[x.from].color);
        w.path.setAttribute('stroke-width', '2.2');
        w.path.setAttribute('stroke-dasharray', 'none');
        w.path.setAttribute('opacity', '.42');
        w.path.setAttribute('marker-end', 'url(#arrowHead)');
        w.path.setAttribute('stroke-dashoffset', '0');
      } else {
        pk.setAttribute('opacity', '0');
        w.path.setAttribute('stroke', '#d5dae8');
        w.path.setAttribute('stroke-width', '2.4');
        w.path.setAttribute('stroke-dasharray', '9 9');
        w.path.setAttribute('opacity', '1');
        w.path.setAttribute('marker-end', 'url(#arrowHead)');
        w.path.setAttribute('stroke-dashoffset', '0');
      }
    });

    /* —— 标注 —— */
    const ann = cardRefs.__ann;
    if (t < T.alloc[0]) {
      ann.textContent = '各卡各持 1 段';
      ann.setAttribute('fill', '#8b93aa');
    } else if (t < T.done[0]) {
      const x = T.xfers.find(x => t >= x.start && t < x.end);
      ann.textContent = x ? 'rank ' + x.from + ' → rank 0' : '';
      ann.setAttribute('fill', '#6d28d9');
    } else {
      ann.textContent = '收集完成 [A│B│C│D]';
      ann.setAttribute('fill', '#059669');
    }

    /* —— 步骤文案 —— */
    let si = 0;
    for (let i = 0; i < STEPS.length; i++) if (t >= STEPS[i].t) si = i;
    $('#capStep').textContent = String(si).padStart(2, '0');
    $('#capTitle').textContent = STEPS[si].title;
    $('#capDesc').textContent = STEPS[si].desc;
    $$('#stepList .step-item').forEach((it, i) => it.classList.toggle('is-active', i === si));

    /* —— 流向列表 —— */
    $$('#flowList .flow-item').forEach((it, i) => {
      const x = T.xfers[i];
      const active = t >= x.start && t < x.end;
      const done = t >= x.end;
      it.classList.toggle('is-active', active);
      it.classList.toggle('is-done', done);
      $('.flow-state', it).textContent = active ? '传输中' : done ? '已送达' : '等待中';
    });
  }

  /* ============================================================
     3. 播放控制
     ============================================================ */
  const DURATION = 8000;
  let t = 0, playing = false, lastTs = 0, rafId = null, speed = 1, loopOn = false;

  function setPlaying(v) {
    playing = v;
    $('#playLabel').textContent = v ? '暂停' : '播放';
    $('#btnPlay').firstElementChild.innerHTML = v
      ? '<path d="M7 5h4v14H7zM13 5h4v14h-4z"/>'
      : '<path d="M8 5v14l11-7z"/>';
    if (v) { lastTs = performance.now(); rafId = requestAnimationFrame(tick); }
    else if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
  }

  function tick(ts) {
    if (!playing) return;
    const dt = Math.min(ts - lastTs, 80);
    lastTs = ts;
    t += (dt / DURATION) * speed;
    if (t >= 1) {
      if (loopOn) { t = 0; }
      else { t = 1; paint(t); setPlaying(false); return; }
    }
    paint(t);
    rafId = requestAnimationFrame(tick);
  }

  function seek(v) {
    t = Math.max(0, Math.min(1, v));
    paint(t);
  }

  /* ============================================================
     4. 静态面板
     ============================================================ */
  function renderCompare() {
    const before = $('#beforePanel'), after = $('#afterPanel');

    const mkRow = (rank, slots, note) => {
      const row = h('div', 'cmp-row', '', null);
      const l = h('div', 'cmp-rank', '', row);
      h('b', '', '', l).textContent = 'GPU ' + rank.r;
      if (rank.r === 0) h('span', 'tag-dst', 'dst', l);
      const buf = h('div', 'cmp-buffer', '', row);
      slots.forEach(s => {
        if (s) {
          const c = h('div', 'cmp-cell' + (s.new ? ' cmp-cell-dst-new' : ''), '', buf);
          c.style.background = s.color;
          c.textContent = s.letter;
          c.style.animationDelay = (s.delay || 0) + 'ms';
        } else {
          h('div', 'cmp-cell cmp-cell-empty', '·', buf);
        }
      });
      if (note) {
        const n = h('div', 'cmp-note', note, row);
        n.style.gridColumn = '2';
      }
      return row;
    };

    /* 操作前 */
    before.innerHTML = '';
    RANKS.forEach(rank => {
      const slots = [];
      if (rank.r === 0) {
        slots.push({ letter: 'A', color: RANKS[0].color });
        slots.push(null, null, null);
        before.appendChild(mkRow(rank, slots, '只持有自己那一份，缓冲仅 1 段'));
      } else {
        slots.push({ letter: rank.letter, color: rank.color });
        before.appendChild(mkRow(rank, slots, null));
      }
    });

    /* 操作后 */
    after.innerHTML = '';
    RANKS.forEach(rank => {
      const slots = [];
      if (rank.r === 0) {
        slots.push({ letter: 'A', color: RANKS[0].color });
        slots.push({ letter: 'B', color: RANKS[1].color, new: true, delay: 120 });
        slots.push({ letter: 'C', color: RANKS[2].color, new: true, delay: 240 });
        slots.push({ letter: 'D', color: RANKS[3].color, new: true, delay: 360 });
        after.appendChild(mkRow(rank, slots, '拼好的完整结果：4 段数据'));
      } else {
        slots.push({ letter: rank.letter, color: rank.color });
        after.appendChild(mkRow(rank, slots, '不变：数据未被搬走，也没有拿到副本'));
      }
    });
  }

  function renderNav() {
    const ul = $('#primNav');
    PRIMS.forEach(p => {
      const li = h('li', '', '', ul);
      const active = p.name === 'Gather';
      li.classList.add(active ? 'is-active' : 'is-soon');
      const a = h(active ? 'span' : 'a', '', '', li);
      a.textContent = p.name;
      if (!active) a.title = '尚未实现';
    });
  }

  function renderTable() {
    const tb = $('#primTableBody');
    PRIMS.forEach(p => {
      const tr = h('tr', '', '', tb);
      if (p.name === 'Gather') tr.classList.add('is-current');
      const c1 = h('td', '', '', tr);
      h('div', 'prim-name', '', c1).innerHTML = p.name + '<small>' + p.cn + '</small>';
      h('td', 'arrow-cell', p.send, tr);
      h('td', 'arrow-cell', p.recv, tr);
      const c4 = h('td', '', '', tr);
      h('span', 'vol-pill ' + p.cls, p.vol, c4);
      h('td', '', p.sem, tr);
      h('td', '', p.scene, tr);
    });
  }

  function renderSteps() {
    const ol = $('#stepList');
    STEPS.forEach((s, i) => {
      const li = h('li', 'step-item', '', ol);
      li.dataset.idx = i;
      h('h3', '', '', li).textContent = s.title;
      h('p', '', '', li).textContent = s.desc;
      h('span', 'step-tag', '', li).textContent = s.tag;
      li.addEventListener('click', () => {
        seek(s.t + 0.005);
        if (playing) setPlaying(false);
      });
    });
  }

  function renderFlow() {
    const ul = $('#flowList');
    [1, 2, 3].forEach(r => {
      const li = h('li', 'flow-item', '', ul);
      const dot = h('span', 'flow-dot', '', li);
      dot.style.background = RANKS[r].color;
      h('span', '', 'rank ' + r + ' → rank 0', li);
      h('span', 'flow-state', '等待中', li);
    });
  }

  /* ============================================================
     5. 代码高亮
     ============================================================ */
  const PY_CODE =
`import torch
import torch.distributed as dist

def gather_to_rank0(tensors, dst=0):
    """把每个 rank 上的 1 段数据收拢到 dst。"""
    rank = dist.get_rank()

    # 只有 dst 需要准备接收列表，其余 rank 传 None
    gather_list = None
    if rank == dst:
        gather_list = [torch.empty_like(t) for t in tensors]

    dist.gather(
        tensor=tensors[rank],
        gather_list=gather_list,
        dst=dst,
    )

    return gather_list`;

  const NCCL_CODE =
`import torch.distributed as dist

# NCCL 后端未开放 dist.gather，常用点对点手写等价语义
pg   = dist.group.WORLD
rank = dist.get_rank()
world = dist.get_world_size()

if rank == 0:
    recv_bufs = [torch.empty_like(t) for t in local_buffers]
    for src in range(world):          # 含自己那份 A
        dist.recv(recv_bufs[src], src=src, group=pg)
    full = torch.cat(recv_bufs, dim=0)   # [A|B|C|D]
else:
    dist.send(local_buffers[rank], dst=0, group=pg)`;

  function highlight(code) {
    const s = esc(code);
    /* 一次性扫描：字符串 / 注释 / 数字 / 关键字 / 函数名，避免二次替换破坏已生成的 span */
    const KEYWORDS = 'import|from|def|return|if|else|elif|for|in|while|with|as|not|and|or|None|True|False|class|lambda|pass';
    const re = new RegExp(
      '("""[\\s\\S]*?"""|"(?:[^"\\\\\\n]|\\\\.)*"|\'(?:[^\'\\\\\\n]|\\\\.)*\')' + // 1 字符串
      '|(#.*$)' +                                                              // 2 注释
      '|\\b(\\d+(?:\\.\\d+)?)\\b' +                                              // 3 数字
      '|\\b(' + KEYWORDS + ')\\b' +                                            // 4 关键字
      '|\\b([A-Za-z_][A-Za-z0-9_]*)(?=\\()',                                    // 5/6 函数名
      'gm'
    );
    return s.replace(re, function (m, str, com, num, kw, fn) {
      if (str) return '<span class="tok-str">' + str + '</span>';
      if (com) return '<span class="tok-com">' + com + '</span>';
      if (num) return '<span class="tok-num">' + num + '</span>';
      if (kw)  return '<span class="tok-kw">' + kw + '</span>';
      if (fn)  return '<span class="tok-fn">' + fn + '</span>';
      return m;
    });
  }

  /* ============================================================
     6. 绑定
     ============================================================ */
  function bind() {
    $('#btnPlay').addEventListener('click', () => setPlaying(!playing));
    $('#btnReset').addEventListener('click', () => { setPlaying(false); seek(0); });
    $('#btnPrev').addEventListener('click', () => {
      setPlaying(false);
      let i = 0;
      for (let k = 0; k < STEPS.length; k++) if (STEPS[k].t <= t + 0.001) i = k;
      seek(i > 0 ? STEPS[i - 1].t + 0.005 : 0);
    });
    $('#btnNext').addEventListener('click', () => {
      setPlaying(false);
      let target = 1;
      for (let k = 0; k < STEPS.length; k++) if (STEPS[k].t > t + 0.004) { target = STEPS[k].t + 0.005; break; }
      seek(target);
    });
    $('#speed').addEventListener('change', e => { speed = parseFloat(e.target.value); });
    $('#loopChk').addEventListener('change', e => { loopOn = e.target.checked; });
    $('#scrub').addEventListener('input', e => { setPlaying(false); seek(e.target.value / 1000); });

    $('#heroPlay').addEventListener('click', () => {
      document.getElementById('demo').scrollIntoView({ behavior: 'smooth', block: 'start' });
      seek(0);
      setTimeout(() => setPlaying(true), 380);
    });
    $('#heroReset').addEventListener('click', () => { setPlaying(false); seek(0); });

    /* 复制按钮 */
    const texts = { py: PY_CODE, nccl: NCCL_CODE };
    ['#copyBtn', '#copyBtn2'].forEach(sel => {
      const btn = $(sel);
      btn.addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(texts[btn.dataset.code]);
          btn.textContent = '已复制';
          btn.classList.add('is-copied');
          setTimeout(() => { btn.textContent = '复制'; btn.classList.remove('is-copied'); }, 1600);
        } catch (e) { btn.textContent = '复制失败'; }
      });
    });

    /* 键盘快捷键 */
    document.addEventListener('keydown', e => {
      if (/^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName)) return;
      if (e.code === 'Space') { e.preventDefault(); setPlaying(!playing); }
      if (e.code === 'ArrowRight') { e.preventDefault(); $('#btnNext').click(); }
      if (e.code === 'ArrowLeft')  { e.preventDefault(); $('#btnPrev').click(); }
    });
  }

  /* ============================================================
     7. 启动
     ============================================================ */
  syncLayout(true);
  renderCompare();
  renderNav();
  renderTable();
  renderSteps();
  renderFlow();
  $('#pyCode').innerHTML = highlight(PY_CODE);
  $('#ncclCode').innerHTML = highlight(NCCL_CODE);
  bind();
  paint(0);

  /* 视口变化时重排舞台 */
  let rzTimer = null;
  window.addEventListener('resize', () => {
    clearTimeout(rzTimer);
    rzTimer = setTimeout(() => syncLayout(false), 160);
  });
})();
