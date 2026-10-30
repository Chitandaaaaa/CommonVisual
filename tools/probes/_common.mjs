/* ============================================================
   CommonVisual v2 · 探针公共层
   ------------------------------------------------------------
   第 2 组全站通用 20 条（2.1–2.21，2026-10-31 拆分重排）+ 蓝图 §09 的
   V1–V8 几何断言，做成 commonChecks(pg, cfg) 供 8 个原语页复用；
   页面专属断言（第 3 组）在各页探针里追加。

   配对规则（verify.mjs）：页面 <p>.html ↔ tools/probes/<p>.mjs，
   文件名同名即自动配对（v1 已删，探针统一放 tools/probes/）。

   DOM 约定（旧页 kit 与 v2 parts 同构，选择器共用）：
     .gpu-card[data-card] > .card-base / .card-bar / .gpu-title /
       .card-badge-bg / .dst-badge
     #lChips .slot-g[data-l?] > rect + .slot-tx（data-l 只在有数据时存在）
     #lWires .wire[data-l?]（marker-end 指 defs 里的 marker id）
     #lFx .pkt[data-l]（整份包带 .batch）、.ring（落位涟漪，常关）
     .calc-wrap（计算框，opacity 由 JS 逐帧写 style）
   槽位归属卡片一律按「几何包含」判定：槽画在 #lChips 层，
   不在卡片 g 里，closest() 拿不到。

   时间轴窗口：getCh() 可用时所有刻度现算（choreo 的 win 键沿用
   PLAN 的 id：intro/pre/send1…、r0…、fly1/merge1…）。v1 已删，
   各页一律走 getCh，不再读旧表。

   期望值出处（2026-10-30 在旧页 1440×900 各量 2 次一致）：
     V1 卡 300×170 rx14；V2 槽 46×46 rx8 Δx58；V3 四色
     #7c3aed #0891b2 #059669 #d97706；V4 空槽 #f7f8fc（接收中
     #f3eeff）；V5 头 36、角标高 18（角色徽章宽 dst30/src28，
     文字徽章 36 —— 蓝图写的「36×18」只对文字徽章成立，已勘误）；
     V6 空闲线 #c3cadb + dash 8 7（alltoall 例外 6 6）；V7 字号
     槽15/标题15/角标10；V8 字幕 rank chip 实色底白字。
   ============================================================ */

export const PAL = [
  { r: 0, letter: 'A', color: '#7c3aed' },
  { r: 1, letter: 'B', color: '#0891b2' },
  { r: 2, letter: 'C', color: '#059669' },
  { r: 3, letter: 'D', color: '#d97706' }
];
export const LCOLOR = Object.fromEntries(PAL.map(p => [p.letter, p.color]));

/* 八原语规范名（对照表 layout.js 的 PRIMS 序；静态页探针共用） */
export const PRIMS = [
  { key: 'gather', en: 'Gather', cn: '收集', dir: 'N → 1' },
  { key: 'scatter', en: 'Scatter', cn: '分散', dir: '1 → N' },
  { key: 'broadcast', en: 'Broadcast', cn: '广播', dir: '1 → N' },
  { key: 'reduce', en: 'Reduce', cn: '归约', dir: 'N → 1' },
  { key: 'reducescatter', en: 'Reduce-Scatter', cn: '归约分散', dir: 'N → N' },
  { key: 'allgather', en: 'All-Gather', cn: '全收集', dir: 'N → N' },
  { key: 'allreduce', en: 'All-Reduce', cn: '全归约', dir: 'N → N' },
  { key: 'alltoall', en: 'All-to-All', cn: '全互换', dir: 'N → N' }
];
/* 首页原语树的节点序（index.html 的树形布局序，与对照表序不同是设计使然） */
export const TREE_ORDER = ['broadcast', 'scatter', 'gather', 'allgather',
  'reduce', 'allreduce', 'reducescatter', 'alltoall'];

const DEG = 1e-6;

/* seek 到进度条刻度（0..1000）并等状态稳定。刻度先除 1000 再喂 controls.seek。 */
export async function seek(pg, v, ms = 250) {
  await pg.evaluate((vv) => {
    const a = window.CV.lastMount;
    a.controls.setPlaying(false);
    a.controls.seek(vv / 1000);
  }, v);
  await pg.waitForTimeout(ms);
}

/* 一次求值拿全舞台快照：卡片 / 槽（几何归属到卡）/ 线 / 包 / 计算框 /
   进度条 / 字幕 / 时间轴。页面探针与 2.x 共用，避免重复 seek。
   颜色统一归一成 #rrggbb（allreduce/reducescatter 的块色走 CV.mix，
   输出是 rgb() 串，直接比字符串会误报）。 */
export async function scan(pg) {
  return pg.evaluate(() => {
    const norm = (c) => {
      if (!c) return c;
      const m = /^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/.exec(c);
      if (!m) return c;
      const h = (x) => (+x).toString(16).padStart(2, '0');
      return '#' + h(m[1]) + h(m[2]) + h(m[3]);
    };
    const d = document;
    const q = (s, r) => [...(r || d).querySelectorAll(s)];
    const cards = q('#lCards .gpu-card').map(g => {
      const b = g.querySelector('.card-base');
      const bar = g.querySelector('.card-bar');
      const bd = g.querySelector('.card-badge-bg');
      const bt = g.querySelector('.dst-badge');
      const m = bar ? /^M\s*(-?[\d.]+)\s*(-?[\d.]+)/.exec(bar.getAttribute('d')) : null;
      return {
        k: +g.getAttribute('data-card'),
        dim: g.hasAttribute('data-dim'),
        op: g.getAttribute('opacity') == null ? 1 : +g.getAttribute('opacity'),
        x: +b.getAttribute('x'), y: +b.getAttribute('y'),
        w: +b.getAttribute('width'), h: +b.getAttribute('height'), rx: +b.getAttribute('rx'),
        barY: m ? +m[2] : null,
        badgeW: bd ? +bd.getAttribute('width') : 0,
        badgeH: bd ? +bd.getAttribute('height') : 0,
        tfs: +(g.querySelector('.gpu-title') || { getAttribute: () => 0 }).getAttribute('font-size'),
        bfs: bt ? +bt.getAttribute('font-size') : 0,
        bt: bt ? bt.textContent : ''
      };
    });
    const slots = q('#lChips .slot-g').map(g => {
      const r = g.querySelector('rect');
      return {
        l: g.getAttribute('data-l'),
        op: g.style.opacity === '' ? 1 : +g.style.opacity,
        t: g.querySelector('.slot-tx').textContent,
        fs: +g.querySelector('.slot-tx').getAttribute('font-size'),
        fill: norm(r.getAttribute('fill')),
        dash: r.getAttribute('stroke-dasharray'),
        x: +r.getAttribute('x'), y: +r.getAttribute('y'),
        w: +r.getAttribute('width'), h: +r.getAttribute('height'), rx: +r.getAttribute('rx'),
        card: -1
      };
    });
    for (const s of slots) {
      for (const c of cards) {
        /* 容差说明：reduce 系页面第二排的隐藏空槽几何上会伸出卡片底边
           几个像素（槽高 46 + 排距 12 > 卡片为两排让出的空间），所以
           y 方向用「槽中心落在卡内 + 底边 12px 容差」，别用严格包含。 */
        if (s.x >= c.x - 2 && s.x + s.w <= c.x + c.w + 2 &&
            s.y + s.h / 2 >= c.y - 2 && s.y + s.h / 2 <= c.y + c.h + 12) {
          s.card = c.k; break;
        }
      }
    }
    const wires = q('#lWires .wire').map(p => ({
      st: norm(p.getAttribute('stroke')),
      sw: p.getAttribute('stroke-width'),
      dash: p.getAttribute('stroke-dasharray'),
      op: p.getAttribute('opacity'),
      me: p.getAttribute('marker-end'),
      l: p.getAttribute('data-l'),
      d: p.getAttribute('d')
    }));
    const cap = d.querySelector('#capText');
    const rk = cap && cap.querySelector('.rk');
    const rcs = rk && getComputedStyle(rk);
    const M = window.CV && window.CV.lastMount;
    const ch = M && typeof M.getCh === 'function' ? M.getCh() : null;
    return {
      vb: d.querySelector('#stage').getAttribute('viewBox'),
      dur: M ? M.controls.duration : null,
      playing: M ? M.controls.isPlaying() : null,
      cards, slots, wires,
      markers: q('defs marker').map(m => m.id),
      pkts: q('#lFx .pkt').map(p => ({
        o: +p.getAttribute('opacity'),
        l: p.getAttribute('data-l'),
        batch: (p.getAttribute('class') || '').indexOf('batch') >= 0
      })),
      rings: q('#lFx .ring').length,
      segs: q('#segs .seg').map(i => +i.style.flexGrow),
      calc: q('.calc-wrap').map(c => +(c.style.opacity || c.getAttribute('opacity') || 0)),
      cap: cap ? cap.innerHTML : '',
      rkBg: rcs && rcs.backgroundColor, rkColor: rcs && rcs.color,
      scrub: d.querySelector('#scrub') ? +d.querySelector('#scrub').value : -1,
      ch: ch && {
        total: ch.total,
        t: ch.steps.map(s => s.t),
        text: ch.steps.map(s => s.text),
        short: ch.steps.map(s => (s.short == null ? null : s.short)),
        win: ch.win,
        winKind: Object.fromEntries(Object.keys(ch.win).map(k => [k, ch.win[k].kind])),
        rows: (ch.rows || []).map(r => r.type === 'group'
          ? { g: 1, no: r.noTxt, n: (r.rows || []).length }
          : { g: 0, no: String(r.no), n: 1 })
      }
    };
  });
}

/* 由秒算进度条刻度 */
export const sc = (sec, total) => Math.max(0, Math.min(1000, Math.round(sec / total * 1000)));

function near(a, b, eps) { return Math.abs(a - b) <= (eps == null ? 1e-4 : eps); }

/* ── 全站通用 20 条 + V1–V8 ──────────────────────────────
   cfg = {
     page      页面键（localStorage / 齿轮用）
     v2        保留兼容位：v1 已删，2.18–2.21 恒跑（不再按 URL 判定）
     gear      是否齿轮页（2.13 / 2.14，及 2.4 / 2.16 的改倍数半截）
     edges     2.11：与 #lWires .wire DOM 序一致的流列表；letter=null 表示整份流
     noMarkers 双向直连边无箭头（alltoall）：要求 marker 数为 0
     uniform   整份流的统一源色（broadcast/reduce/allreduce/reducescatter）
     idleDash  V6 空闲线 dash（默认 '8 7'；alltoall '6 6'）
     idleSw    V6 空闲线宽（默认 '2'；alltoall '1.4'）
     keep      2.12：keep(letter) → 保留的卡号数组（聚焦不灰化的卡）
     oldFlight 旧页无 getCh 时 2.11 的飞行中点刻度（v2 走 getCh 现算）
   }
   getCh 是否可用不用配置：scan() 现场探测，有就走现算窗口，没有就 SKIP。
   返回 { res, t0, ch }：res 已带 2.x/V 断言；t0 是刻度 0 的快照，
   ch 是归一化的时间轴（页面探针复用，避免重复 seek）。 */
export async function commonChecks(pg, cfg) {
  const res = [];
  const ok = (name, cond, detail) => res.push({ name, pass: !!cond, detail: detail || '' });

  /* ── 2.1 / 2.2 挂载（2026-10-31 拆分：对象存在与时长/段生成分判）── */
  const M = await pg.evaluate(() => {
    const a = window.CV && window.CV.lastMount;
    return a ? { dur: a.controls.duration, segs: document.querySelectorAll('#segs .seg').length } : null;
  });
  ok('2.1 挂载对象存在', !!M, M ? 'lastMount 就绪' : 'CV.lastMount 缺失');
  ok('2.2 时长与段生成', !!M && typeof M.dur === 'number' && M.dur > 0 && M.segs > 0,
    M ? `dur=${M.dur} segs=${M.segs}` : '');

  /* 先把进度条按回 0 再做初始快照：页面挂载后自动播放，不按回去的话
     t0 会撞上开场动画（卡片长高 / 颜色混合），几何断言全部失真。 */
  await seek(pg, 0, 700);
  const s0 = await scan(pg);
  const ch = s0.ch;

  /* ── 2.18–2.21 共享层 API 契约（v1 已删，全站恒为 v2，恒跑）
     2026-10-31 拆自旧 2.15：API 存在 / 控件方法 / 图层与 DOM / registry 各自独立判 ── */
  const isV2 = true;
  if (isV2 || cfg.v2) {
    const api = await pg.evaluate(() => {
      const a = window.CV && window.CV.lastMount;
      const c = a && a.controls;
      const reg = window.CV && window.CV.registry;
      return {
        cv: !!window.CV, mount: !!a, ch: !!(a && typeof a.getCh === 'function'),
        ctl: !!c && ['seek', 't', 'setPlaying', 'isPlaying', 'retime', 'paintChrome']
          .every(k => typeof c[k] === 'function') && typeof c.duration === 'number',
        layers: ['lBg', 'lCards', 'lChips', 'lWires', 'lFx', 'lLabels']
          .every(id => !!document.getElementById(id)),
        dom: ['stage', 'segs', 'scrub', 'play', 'prev', 'next', 'capText']
          .every(id => !!document.getElementById(id)),
        reg: Array.isArray(reg) ? {
          n: reg.length,
          sorted: reg.every((e, i) => i === 0 || String(reg[i - 1].id) <= String(e.id)),
          full: reg.every(e => ['id', 'en', 'cn', 'dir', 'pre', 'post', 'rel', 'verbs']
            .every(k => k in e))
        } : null
      };
    });
    ok('2.18 共享层 API 存在', api.cv && api.mount && api.ch,
      `cv=${api.cv} mount=${api.mount} getCh=${api.ch}`);
    ok('2.19 控件方法签名', api.ctl, `controls 六方法+duration=${api.ctl}`);
    ok('2.20 图层与 DOM 齐全', api.layers && api.dom, `layers=${api.layers} dom=${api.dom}`);
    ok('2.21 registry 契约', !!api.reg && api.reg.n >= 8 && api.reg.sorted && api.reg.full,
      api.reg ? `n=${api.reg.n} sorted=${api.reg.sorted} full=${api.reg.full}` : 'registry 缺失');
  }

  /* ── V1–V8（几何基线，刻度 0 一次快照全量）── */
  const cs = s0.cards;
  ok('V1 卡片 300×170 rx14', cs.length > 0 && cs.every(c => c.w === 300 && c.h === 170 && c.rx === 14),
    cs.map(c => `${c.w}x${c.h}r${c.rx}`).join(' '));
  const rows = new Map();
  for (const s of s0.slots) {
    const k = s.card + '|' + s.y;
    if (!rows.has(k)) rows.set(k, []);
    rows.get(k).push(s);
  }
  let v2ok = s0.slots.length > 0, v2d = '';
  for (const list of rows.values()) {
    list.sort((a, b) => a.x - b.x);
    for (const s of list) if (!(s.w === 46 && s.h === 46 && s.rx === 8)) { v2ok = false; v2d = `${s.w}x${s.h}r${s.rx}`; }
    for (let i = 1; i < list.length; i++) if (list[i].x - list[i - 1].x !== 58) { v2ok = false; v2d = `Δx=${list[i].x - list[i - 1].x}`; }
  }
  ok('V2 槽 46×46 rx8 Δx58', v2ok, v2d);
  const dataFills = [...new Set(s0.slots.filter(s => s.l).map(s => s.fill))];
  const want4 = PAL.map(p => p.color).sort().join(',');
  ok('V3 四条数据色', dataFills.length === 4 && [...dataFills].sort().join(',') === want4,
    dataFills.join(' '));
  const emptyFills = [...new Set(s0.slots.filter(s => !s.l && (s.dash === '4 3' || s.fill === '#f3eeff')).map(s => s.fill))];
  ok('V4 空槽底色两态', emptyFills.length >= 1 && emptyFills.every(f => f === '#f7f8fc' || f === '#f3eeff'),
    emptyFills.join(' ') || '无空槽');
  ok('V5 头高 36 · 角标高 18', cs.every(c => c.barY != null && near(c.barY - c.y, 36, 0.5)) &&
    cs.every(c => c.badgeH === 18), cs.map(c => `h${c.barY - c.y}/b${c.badgeH}`).join(' '));
  ok('V6 空闲线 ' + (cfg.idleDash || '8 7') + ' #' + 'c3cadb',
    s0.wires.length > 0 && s0.wires.every(w => w.st === '#c3cadb' &&
      w.dash === (cfg.idleDash || '8 7') && w.sw === (cfg.idleSw || '2')),
    s0.wires.map(w => `${w.st}/${w.dash}/${w.sw}`).join(' '));
  ok('V7 字号 槽15 标题15 角标10',
    s0.slots.every(s => s.fs === 15) && cs.every(c => c.tfs === 15 && c.bfs === 10),
    `slot${s0.slots[0] && s0.slots[0].fs} title${cs[0] && cs[0].tfs} badge${cs[0] && cs[0].bfs}`);
  ok('V8 字幕 rank chip 实色底白字',
    s0.rkBg && s0.rkBg !== 'rgba(0, 0, 0, 0)' && s0.rkColor === 'rgb(255, 255, 255)',
    `${s0.rkBg} / ${s0.rkColor}`);

  /* ── 2.3 段数 = 步骤数 ── */
  if (ch) {
    ok('2.3 段数=步骤数', s0.segs.length === ch.t.length, `segs=${s0.segs.length} steps=${ch.t.length}`);
  } else {
    ok('2.3 段数=步骤数', true, 'SKIP(本页无 getCh，v2 复检)');
  }

  /* ── 2.4 段宽 = 真实时长 ── */
  if (ch) {
    const spans = ch.t.map((t, i) => (i + 1 < ch.t.length ? ch.t[i + 1] - t : 1 - t));
    const prop = s0.segs.every((g, i) => near(g, spans[i], Math.max(spans[i], 0.01) * 0.02 + 1e-4));
    const even = new Set(s0.segs.map(g => Math.round(g * 1000))).size === 1;
    ok('2.4 段宽=真实时长（等宽即失败）', prop && !even && spans.length === s0.segs.length,
      `flex=[${s0.segs.map(x => x.toFixed(3))}] span=[${spans.map(x => x.toFixed(3))}]`);
  } else {
    ok('2.4 段宽=真实时长（等宽即失败）', true, 'SKIP(本页无 getCh，v2 复检)');
  }

  /* ── 2.5 字幕跟随时间（桌面半截；窄屏半截在 2.15 里一起跑）── */
  let midStep = null;
  if (ch) {
    midStep = 2 < ch.t.length ? 2 : ch.t.length - 1;
    const mid = sc(((ch.t[midStep] + (midStep + 1 < ch.t.length ? ch.t[midStep + 1] : 1)) / 2) * ch.total, ch.total);
    await seek(pg, mid, 300);
    const s = await scan(pg);
    ok('2.5 字幕跟随时间（桌面全文）', s.cap === ch.text[midStep],
      `step${midStep}: ${s.cap.slice(0, 40)}…`);
  }

  /* ── 2.6 / 2.7 / 2.8 播放控制（2026-10-31 拆自旧 2.5：切换 / 跳段 / 复位各自独立判）── */
  {
    await seek(pg, 0, 200);
    await pg.click('#play');
    await pg.waitForTimeout(120);
    let st = await pg.evaluate(() => {
      const a = window.CV.lastMount;
      return { label: document.querySelector('#play').getAttribute('aria-label'), on: a.controls.isPlaying(), t: a.controls.t() };
    });
    const playOk = st.label === '暂停' && st.on === true;
    await pg.click('#play');
    await pg.waitForTimeout(120);
    st = await pg.evaluate(() => {
      const a = window.CV.lastMount;
      return { label: document.querySelector('#play').getAttribute('aria-label'), on: a.controls.isPlaying(), t: a.controls.t() };
    });
    const pauseOk = st.label === '播放' && st.on === false;
    /* next / prev：停在下一步起点 +0.005 */
    await seek(pg, ch ? sc(ch.t[Math.min(2, ch.t.length - 1)] * ch.total + 0.01, ch.total) : 100, 200);
    const before = await pg.evaluate(() => window.CV.lastMount.controls.t());
    await pg.click('#next');
    await pg.waitForTimeout(150);
    const afterN = await pg.evaluate(() => window.CV.lastMount.controls.t());
    await pg.click('#prev');
    await pg.waitForTimeout(150);
    const afterP = await pg.evaluate(() => window.CV.lastMount.controls.t());
    let stepOk = afterN > before && afterP < afterN;
    if (ch) {
      let k = 0;
      for (let i = 0; i < ch.t.length; i++) if (ch.t[i] <= before + 0.004) k = i;
      const want = k + 1 < ch.t.length ? ch.t[k + 1] + 0.005 : 1;
      stepOk = stepOk && near(afterN, want, 0.002);
    }
    await pg.keyboard.press('KeyR');
    await pg.waitForTimeout(150);
    const stR = await pg.evaluate(() => {
      const a = window.CV.lastMount;
      return { t: a.controls.t(), on: a.controls.isPlaying() };
    });
    ok('2.6 播放/暂停切换', playOk && pauseOk, `play=${playOk} pause=${pauseOk}`);
    ok('2.7 上一步/下一步各跳一段', stepOk,
      `next=${afterN.toFixed(3)} prev=${afterP.toFixed(3)}`);
    ok('2.8 R 键复位', stR.t === 0 && stR.on === false, `t=${stR.t} playing=${stR.on}`);
  }

  /* ── 2.9 循环回绕干净 ── */
  {
    await seek(pg, 0, 800);
    const a = await scan(pg);
    const sig = (x) => JSON.stringify({
      cap: x.cap, chips: x.slots.map(s => s.l), cardOp: x.cards.map(c => c.op),
      pkt: x.pkts.map(p => p.o), calc: x.calc.map(o => +o.toFixed(2))
    });
    const base = sig(a);
    await pg.evaluate(() => { const c = window.CV.lastMount.controls; c.seek(0.999); c.setPlaying(true); });
    await pg.waitForFunction(() => window.CV.lastMount.controls.t() < 0.5, null, { timeout: 3000 })
      .catch(() => {});
    await pg.evaluate(() => window.CV.lastMount.controls.setPlaying(false));
    await pg.waitForTimeout(900);
    const b = await scan(pg);
    ok('2.9 循环回绕干净', sig(b) === base,
      sig(b) === base ? 'wrapped' : `base=${base.slice(0, 90)} got=${sig(b).slice(0, 90)}`);
  }

  /* ── 2.10 终态无残留元素 ── */
  {
    await seek(pg, 1000, 1200);
    const s = await scan(pg);
    const vis = s.pkts.filter(p => p.o > 0.01).length;
    ok('2.10 终态无残留元素', vis === 0 && s.rings === 0, `pkt可见=${vis} ring=${s.rings}`);
  }

  /* ── 2.11 连线与箭头一对一 + 流语义 ── */
  {
    await seek(pg, 0, 400);
    const s = await scan(pg);
    const nW = s.wires.length, nM = s.markers.length;
    const uniqM = new Set(s.markers).size === nM;
    const meList = s.wires.map(w => w.me).filter(Boolean);
    const meUniq = new Set(meList).size === meList.length;
    const meResolves = meList.every(u => {
      const m = /^url\(#(.+)\)$/.exec(u);
      return m && s.markers.indexOf(m[1]) >= 0;
    });
    const countOk = cfg.edges
      ? (nW === cfg.edges.length &&
         (cfg.noMarkers ? nM === 0 : nM === cfg.edges.length))
      : nW > 0;
    ok('2.11a 连线与 marker 一对一', countOk && uniqM && meUniq && meResolves,
      `wire=${nW} marker=${nM} uniq=${uniqM}/${meUniq}/${meResolves}`);
    /* 流语义：字母流 data-l = 字母；整份流无 data-l */
    let semOk = true, semD = '';
    if (cfg.edges) {
      s.wires.forEach((w, i) => {
        const want = cfg.edges[i] && cfg.edges[i].letter;
        if ((w.l || null) !== (want || null)) { semOk = false; semD += ` w${i}:l=${w.l}≠${want}`; }
      });
    }
    ok('2.11b 边色随流语义', semOk, semD || '字母流=字母 / 整份流=无 data-l');
    /* 飞行中点：在飞边的颜色 */
    let flyOk = true, flyD = '无采样点';
    if (ch) {
      const tr = Object.keys(ch.win).filter(k => ch.winKind[k] === 'transfer');
      if (tr.length) {
        const w0 = ch.win[tr[0]];
        const mid = sc((w0.s + (w0.travelEnd != null ? w0.travelEnd : (w0.s + w0.e) / 2)) / 2, ch.total);
        await seek(pg, mid, 300);
        const f = await scan(pg);
        const act = f.wires.filter(x => x.sw === '2.6');
        flyOk = act.length > 0;
        for (const x of act) {
          const want = cfg.uniform || (x.l && LCOLOR[x.l]);
          if (want && x.st !== want) { flyOk = false; flyD = `${x.l}:${x.st}≠${want}`; }
        }
        flyD = flyOk ? `${act.length}条在飞` : flyD;
      }
    } else if (cfg.oldFlight != null) {
      await seek(pg, cfg.oldFlight, 300);
      const f = await scan(pg);
      const act = f.wires.filter(x => x.sw === '2.6');
      flyOk = act.length > 0;
      for (const x of act) {
        const want = cfg.uniform || (x.l && LCOLOR[x.l]);
        if (want && x.st !== want) { flyOk = false; flyD = `${x.l}:${x.st}≠${want}`; }
      }
      flyD = flyOk ? `${act.length}条在飞` : flyD;
    }
    ok('2.11c 在飞边色=流色', flyOk, flyD);
  }

  /* ── 2.16 时序不重叠、无空档 ── */
  if (ch) {
    let ok13 = true, d13 = '';
    for (let i = 0; i + 1 < ch.t.length; i++) {
      if (!(ch.t[i + 1] >= ch.t[i] - DEG)) { ok13 = false; d13 = `step${i} 倒挂`; break; }
    }
    const lastT = ch.t[ch.t.length - 1];
    ok('2.16 时序不重叠无空档', ok13 && lastT < 1 && lastT > 0,
      (d13 || `last t=${lastT.toFixed(4)} <1`) + (cfg.gear ? '（改倍数后半截见 2.16b）' : ''));
  } else {
    ok('2.16 时序不重叠无空档', true, 'SKIP(本页无 getCh，v2 复检)');
  }

  /* ── 2.12 聚焦 hover 与钉住 ── */
  {
    await seek(pg, 0, 300);
    const tgt = await pg.evaluate(() => {
      const el = document.querySelector('#lChips .slot-g[data-l="B"]');
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    });
    if (!tgt) {
      ok('2.9 聚焦 hover 与钉住', false, '找不到 data-l=B 的数据块');
    } else {
      await pg.mouse.move(tgt.x, tgt.y);
      await pg.waitForTimeout(150);
      const hov = await pg.evaluate(() => {
        const st = document.querySelector('#stage');
        return {
          focus: st.getAttribute('data-focus'),
          dim: [...document.querySelectorAll('#lCards .gpu-card')]
            .map(g => g.hasAttribute('data-dim') ? +g.getAttribute('data-card') : null)
            .filter(x => x != null)
        };
      });
      const kept = cfg.keep ? cfg.keep('B') : PAL.map(p => p.r);
      const wantDim = PAL.map(p => p.r).filter(r => kept.indexOf(r) < 0);
      const hovOk = hov.focus === 'B' &&
        wantDim.every(r => hov.dim.indexOf(r) >= 0) &&
        kept.every(r => hov.dim.indexOf(r) < 0);
      await pg.mouse.click(tgt.x, tgt.y);
      await pg.waitForTimeout(150);
      const pin1 = await pg.evaluate(() => document.querySelector('#stage').getAttribute('data-pinned'));
      await pg.mouse.move(4, 4);
      await pg.waitForTimeout(150);
      const pin2 = await pg.evaluate(() => ({
        pinned: document.querySelector('#stage').getAttribute('data-pinned'),
        focus: document.querySelector('#stage').getAttribute('data-focus')
      }));
      await pg.mouse.click(tgt.x, tgt.y);
      await pg.waitForTimeout(150);
      const pin3 = await pg.evaluate(() => ({
        pinned: document.querySelector('#stage').getAttribute('data-pinned'),
        focus: document.querySelector('#stage').getAttribute('data-focus')
      }));
      const pinOk = pin1 === 'B' && pin2.pinned === 'B' && pin2.focus === 'B' &&
        pin3.pinned == null;
      ok('2.12 聚焦 hover 与钉住', hovOk && pinOk,
        `hover=${hov.focus} dim=[${hov.dim}] want=[${wantDim}] pin=${pin1}/${pin2.pinned}/${pin3.pinned}`);
      /* 收尾：把状态清干净（移出鼠标已在 4,4；若 pin3 仍挂着再点一次取消） */
      if (pin3.pinned) { await pg.mouse.click(tgt.x, tgt.y); await pg.mouse.move(4, 4); }
    }
  }

  /* ── 齿轮三件：2.13 改倍数生效、2.16b 改后仍连续、2.14 持久化 ── */
  if (cfg.gear) {
    const dur0 = s0.dur;
    await pg.click('.gear-btn');
    await pg.waitForTimeout(200);
    const panel = await pg.evaluate(() => {
      const pop = document.querySelector('.gear-pop');
      if (!pop || pop.hidden) return null;
      const steps = [...pop.querySelectorAll('.gear-body > .gear-step')];
      const rows = steps.map(st => {
        const grp = st.querySelector('.gear-grp');
        if (grp) {
          return {
            g: 1,
            no: grp.querySelector('.gear-no-grp').textContent,
            subs: [...grp.querySelectorAll('.gear-grp-body .gear-row')].map(r => r.getAttribute('data-key'))
          };
        }
        const row = st.querySelector('.gear-row');
        return { g: 0, no: row.querySelector('.gear-no').textContent, key: row.getAttribute('data-key') };
      });
      return { rows, hasResetAll: !!pop.querySelector('.gear-btn-ghost') };
    });
    /* 覆盖率：大步组并起来 = 1..段数，transfer 的四个小步并成一组不重复计段 */
    let cover = 0, coverOk = !!panel;
    if (panel && ch) {
      const n = ch.t.length;
      for (const r of panel.rows) {
        const m = /^(\d+)[–-](\d+)$/.exec(r.no);
        if (r.g) { if (!m) coverOk = false; else cover += (+m[2] - +m[1] + 1); }
        else if (/^\d+$/.test(r.no)) cover += 1;
        else coverOk = false;
      }
      coverOk = coverOk && cover === n;
    }
    const grp4 = panel && panel.rows.some(r => r.g && r.subs.length === 4 &&
      r.subs.join() === 'travel,delay,pop,hold');
    ok('2.13a 面板大步并成段（不重复计段）', !!panel && coverOk && grp4,
      panel ? `cover=${cover}/${ch ? ch.t.length : '?'} grp4=${grp4}` : '面板未打开');

    /* travel 倍数 ×2：总时长变、段数不变、该段变宽、时序仍连续 */
    const before = await scan(pg);
    await pg.evaluate(() => {
      const inp = [...document.querySelectorAll('.gear-pop .gear-row[data-key="travel"] .gear-k')][0] ||
        [...document.querySelectorAll('.gear-pop .gear-grp-body .gear-k')][0];
      inp.value = '2';
      inp.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await pg.waitForTimeout(500);
    const doubled = await scan(pg);
    const spans0 = ch.t.map((t, i) => (i + 1 < ch.t.length ? ch.t[i + 1] - t : 1 - t));
    const spans1 = doubled.ch.t.map((t, i) => (i + 1 < ch.t.length ? doubled.ch.t[i + 1] - t : 1 - t));
    const prop1 = doubled.segs.every((g, i) => near(g, spans1[i], Math.max(spans1[i], 0.01) * 0.02 + 1e-4));
    const contig1 = spans1.every(x => x > 0) && doubled.ch.t[0] === 0;
    const grewSpans = spans1.some((x, i) => x > spans0[i] + 1e-6);
    ok('2.13b 倍数×2 生效', doubled.ch && doubled.dur > before.dur &&
      doubled.segs.length === before.segs.length && prop1 && contig1 && grewSpans,
      `dur ${before.dur}→${doubled.dur} segs=${doubled.segs.length} grew=${grewSpans}`);
    ok('2.16b 改倍数后时序仍连续', doubled.ch && contig1 &&
      doubled.ch.t[doubled.ch.t.length - 1] < 1,
      `last=${doubled.ch ? doubled.ch.t[doubled.ch.t.length - 1].toFixed(4) : '?'}`);
    /* ↺ 回基线（2.11 的「↺ 能回基线」半截） */
    await pg.evaluate(() => {
      const btn = [...document.querySelectorAll('.gear-pop .gear-row[data-key="travel"] .gear-rs')][0] ||
        [...document.querySelectorAll('.gear-pop .gear-grp-body .gear-rs')][0];
      btn.click();
    });
    await pg.waitForTimeout(500);
    const back = await scan(pg);
    ok('2.13c ↺ 回基线', back.dur === dur0 && back.segs.length === before.segs.length,
      `dur=${back.dur} (want ${dur0})`);
    await pg.keyboard.press('Escape');

    /* 2.14 持久化：LS 有记录 → 刷新仍生效 → 清掉回基线 */
    const lsKey = 'cv.page.' + cfg.page + '.v1';
    await pg.evaluate((k) => localStorage.setItem(k, JSON.stringify({ travel: 2 })), lsKey);
    await pg.reload({ waitUntil: 'load' });
    await pg.waitForFunction(() => window.CV && window.CV.lastMount && window.CV.lastMount.controls,
      null, { timeout: 8000 }).catch(() => {});
    await pg.waitForTimeout(300);
    const persisted = await pg.evaluate((k) => ({
      raw: localStorage.getItem(k),
      dur: window.CV.lastMount.controls.duration
    }), lsKey);
    await pg.evaluate((k) => localStorage.removeItem(k), lsKey);
    await pg.reload({ waitUntil: 'load' });
    await pg.waitForFunction(() => window.CV && window.CV.lastMount && window.CV.lastMount.controls,
      null, { timeout: 8000 }).catch(() => {});
    await pg.waitForTimeout(300);
    const cleared = await pg.evaluate(() => window.CV.lastMount.controls.duration);
    ok('2.14 参数持久化', persisted.raw && JSON.parse(persisted.raw).travel === 2 &&
      persisted.dur > dur0 && cleared === dur0,
      `ls=${!!persisted.raw} dur ${dur0}→${persisted.dur}→${cleared}`);
  }

  /* ── 2.15 窄屏断点重排（+ 2.5 窄屏短版半截）── */
  {
    await pg.setViewportSize({ width: 859, height: 820 });
    await pg.waitForTimeout(900);
    if (ch && midStep != null) {
      const mid = sc(((ch.t[midStep] + (midStep + 1 < ch.t.length ? ch.t[midStep + 1] : 1)) / 2) * ch.total, ch.total);
      await seek(pg, mid, 400);
    }
    const sN = await scan(pg);
    const narrowOk = sN.vb === '0 0 380 720' &&
      sN.slots.every(sl => sl.w === 25 && sl.h === 25);
    let shortOk = true, shortD = '无短版';
    if (ch) {
      const k = midStep != null ? midStep : 2;
      shortOk = sN.cap === (ch.short[k] != null ? ch.short[k] : ch.text[k]);
      shortD = ch.short[k] != null ? 'short 生效' : '本段无 short，显示全文';
    }
    await pg.setViewportSize({ width: 861, height: 820 });
    await pg.waitForTimeout(900);
    const sD = await scan(pg);
    const backOk = sD.vb === '0 0 1130 680';
    ok('2.15 窄屏断点重排', narrowOk && backOk,
      `narrow=${sN.vb} slot=${sN.slots[0] ? sN.slots[0].w : '?'} back=${sD.vb}`);
    if (ch) ok('2.5b 窄屏字幕切短版', shortOk, `${shortD}: ${sN.cap.slice(0, 40)}…`);
    await pg.setViewportSize({ width: 1440, height: 900 });
    await pg.waitForTimeout(600);
  }

  return { res, t0: s0, ch };
}

/* 旧页无 getCh 的四页（reduce/allreduce/reducescatter/alltoall）自检用的
   采样刻度表 —— 全部 2026-10-30 在旧页实测（页探针内注明换算）。
   v2 就位后这些页挂了 getCh，探针自动切到现算，不再读本表。 */
export const OLD = {
  reduce: { total: 24.75, mergeMid: [316, 551, 785], afterMerge1: 364 },
  allreduce: { total: 21.52, r1Fly: 225, r2Fly: 544, afterR1Merge: 455, calcMid: [367, 688] },
  alltoall: { total: 14.65, stepMid: [94, 326, 558, 790], afterStep0: 270 },
  reducescatter: { total: 21.25, afterMerge1: 438 }
};

/* 便捷：把几条断言合并输出 */
export function pushAll(out, items) { for (const it of items) out.push(it); return out; }
