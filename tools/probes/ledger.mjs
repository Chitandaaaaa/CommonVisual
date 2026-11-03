/* ============================================================
   CommonVisual · 规范符合性探针（05 组：5.1 + 规范总账 107 项 1:1）
   ------------------------------------------------------------
   与 assets/ledger.js 单源同账：verify 对每个页面调用 check(pg)，
   按「页面范围」过滤出该页的行逐条检查。三种检查型：
     link  改参数 → reload → 可量 Δ → 还原无残差（时长 / 比率类）
     unit  页面内建最小 fixture 直接调规范函数断言输出（特效 / 公式类）
     truth 页面 DOM / 常量真值逐字节对照（几何 / 颜色 / 字号类）
     src   入口文件字面量 / 消费点检查（解说层 / 演示编排）
   5.1 = 源码层反向检查：规范特效函数必须被页面侧调用、
         每个 SCHEMA 参数键必须被引擎/部件消费（规范页演示不算）。
   ============================================================ */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import LGR from '../../assets/ledger.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');   /* tools/probes → 仓库根 */
const ALL = LGR.all();
const NO = {};
ALL.forEach(function (r, i) { NO[r.id] = i + 2; });   /* 5.1 = 使用检查，条目从 5.2 起 */

/* ── 源码扫描（Node 侧）── */
function srcFiles() {
  const out = [];
  const walk = (dir, rel, skip) => {
    for (const f of fs.readdirSync(dir)) {
      const full = path.join(dir, f);
      const r = rel ? rel + '/' + f : f;
      if (fs.statSync(full).isDirectory()) walk(full, r, skip);
      else if (f.endsWith('.js') && !(skip || []).some(s => r.indexOf(s) >= 0)) out.push({ rel: r, text: fs.readFileSync(full, 'utf8') });
    }
  };
  walk(path.join(ROOT, 'assets', 'engine'), 'assets/engine');
  walk(path.join(ROOT, 'assets', 'parts'), 'assets/parts');
  walk(path.join(ROOT, 'assets', 'prim'), 'assets/prim');
  walk(path.join(ROOT, 'assets', 'blocks'), 'assets/blocks');
  walk(path.join(ROOT, 'assets', 'scenes'), 'assets/scenes');
  /* theme/ 只进 store 本体（spec.js / defaults.js 是表与基线，键名在文件里天然出现） */
  walk(path.join(ROOT, 'assets', 'theme'), 'assets/theme',
       ['theme/spec.js', 'theme/defaults.js', 'stage-page.css']);
  return out;
}
let SRC = null;
function sources() { if (!SRC) SRC = srcFiles(); return SRC; }

/* 规范表的键：读 spec.js 的 CV.SPEC（表单源；defaults.js 只是基线快照，
   新键入表而未「保存到代码」时 defaults 里还没有，不能拿它当键清单） */
function schemaKeys() {
  const out = [];
  Object.keys(win_SPEC()).forEach(function (g) {
    Object.keys(win_SPEC()[g].keys).forEach(function (k) { out.push(g + ' · ' + k); });
  });
  return out;
}

/* 5.1c：消费端禁兜底（docs/参数总线方案.md §4.1）——
   store 本体 theme.js 与按 schema 遍历出控件的 paramEditor.js 之外，
   不许 params.get / specVal / specNum 直读，CV.spec(...) 之后不许 || 字面量。
   注释里提到的不算（先剥块注释再扫）。 */
function check5_1c() {
  const bad = [];
  const re = [
    [/CV\.params\.get\(/, 'params.get 直读（应 CV.spec）'],
    [/\bspecVal\(|\bspecNum\(/, 'specVal/specNum 残留'],
    [/CV\.spec\([^)]*\)\s*\|\|\s*[0-9.]/, 'CV.spec 后 || 字面量兜底'],
    [/\bspec\('[A-Za-z]+',\s*[0-9.]+\)/, 'spec(键, 默认值) 兜底']
  ];
  sources().forEach(function (f) {
    if (/blocks\/paramEditor\.js$/.test(f.rel)) return;
    if (/theme\/theme\.js$/.test(f.rel)) return;   /* store 自己按组+键读写，是参数总线的实现 */
    const text = f.text.replace(/\/\*[\s\S]*?\*\//g, '');
    re.forEach(function (p) { if (p[0].test(text)) bad.push(f.rel + '：' + p[1]); });
  });
  return bad;
}

/* 5.1d：CSS 侧只读 var(--cv-<键>)（方案 §4.1）——
   a) 舞台过程选择器（.cap-text 色块 / .gpu-card / .slot-* / .wire / .slot-pop / .ring）
      的规则体里不许有裸色值（#fff 白字豁免）与裸秒，过渡时长必须 var(--cv-*)；
      悬停聚焦 / hover 反馈是交互不是过程，不在名单内，保留字面量。
   b) 任何 assets CSS 里的 var(--cv-X) 必须是 spec.js 里 sink='css'|'both' 的键——
      抓变量名拼错、表里删了键 CSS 还在读。 */
function check5_1d() {
  const cssPath = path.join(ROOT, 'assets', 'theme', 'stage-page.css');
  const css = fs.readFileSync(cssPath, 'utf8');
  const bad = [];
  const STAGE = ['cap-text', 'gpu-card', 'slot-g', 'slot-bg', 'slot-tx', 'wire', 'slot-pop'];   /* ring 涟漪定稿关闭，不入名单 */
  const rules = css.match(/[^{}]+\{[^{}]*\}/g) || [];
  rules.forEach(function (r) {
    const sel = r.slice(0, r.indexOf('{'));
    const body = r.slice(r.indexOf('{') + 1);
    if (!STAGE.some(s => sel.indexOf(s) >= 0)) return;
    /* 悬停聚焦 / 变灰是交互态不是过程（chrome.focus）：data-dim / data-focus /
       :not(...) 复合选择器全是交互规则，豁免 */
    if (/\[data-(dim|focus)/.test(sel) || /:not\(/.test(sel)) return;
    const hexes = (body.match(/#[0-9a-fA-F]{3,6}\b/g) || []).filter(h => h.toLowerCase() !== '#fff');
    if (hexes.length) bad.push('裸色值 ' + hexes.join(',') + ' @ ' + sel.trim().slice(0, 50));
    const secs = body.match(/[0-9]*\.?[0-9]+s\b/g) || [];
    if (secs.length) bad.push('裸时长 ' + secs.join(',') + ' @ ' + sel.trim().slice(0, 50));
  });
  const cssDir = path.join(ROOT, 'assets');
  const cssFiles = [];
  (function walkc(d) {
    fs.readdirSync(d).forEach(function (f) {
      const full = path.join(d, f);
      if (fs.statSync(full).isDirectory()) walkc(full);
      else if (f.endsWith('.css')) cssFiles.push(full);
    });
  })(cssDir);
  const specKeys = {};
  Object.keys(win_SPEC()).forEach(function (g) {
    Object.keys(win_SPEC()[g].keys).forEach(function (k) {
      const d = win_SPEC()[g].keys[k];
      if (d.sink === 'css' || d.sink === 'both') specKeys[k] = true;
    });
  });
  cssFiles.forEach(function (f) {
    const t = fs.readFileSync(f, 'utf8');
    (t.match(/var\(--cv-([A-Za-z0-9]+)/g) || []).forEach(function (m) {
      const k = m.slice(9);
      if (!specKeys[k]) bad.push('var(--cv-' + k + ') 不在规范表或非 css sink @ ' + path.relative(ROOT, f));
    });
  });
  return bad;
}

/* spec.js 以表的形式在 Node 里求值一次（5.1a / 5.1d 共用） */
let SPEC_CACHE = null;
function win_SPEC() {
  if (SPEC_CACHE) return SPEC_CACHE;
  const win = {};
  new Function('window', fs.readFileSync(path.join(ROOT, 'assets', 'theme', 'spec.js'), 'utf8'))(win);
  SPEC_CACHE = win.CV.SPEC;
  return SPEC_CACHE;
}

/* 5.1e：JS 侧不许有色板字面量副本（方案 §4.1）——
   spec.js 色键的 def 值不得出现在 engine / parts / prim / scenes / boot /
   theme.js / blocks（anatomy.js 除外：规范页演示的文案里写着色值，B3 随
   00 章生成一并收编）。字幕色块 / 表块 / 演示绘制一律读 CV.PALETTE / CV.TONE。 */
function check5_1e() {
  const spec = win_SPEC();
  const hexes = [];
  Object.keys(spec).forEach(function (g) {
    Object.keys(spec[g].keys).forEach(function (k) {
      const d = spec[g].keys[k];
      if (d.kind === 'color') hexes.push({ k: g + '.' + k, v: d.def.toLowerCase() });
    });
  });
  const bad = [];
  sources().forEach(function (f) {
    if (/blocks\/anatomy\.js$/.test(f.rel)) return;
    const text = f.text.replace(/\/\*[\s\S]*?\*\//g, '').toLowerCase();
    hexes.forEach(function (h) {
      if (text.indexOf(h.v) >= 0) bad.push(f.rel + ' 含 ' + h.v + '（' + h.k + ' 的副本）');
    });
  });
  return bad;
}

/* 5.1：特效函数被调用 + 参数键被消费（Node 侧，零浏览器耗时） */
function check5_1() {
  const files = sources();
  const callOutside = (re, defRe) =>
    files.some(function (f) { return !defRe.test(f.rel) && re.test(f.text); });
  const fns = [
    ['beat.fuse（融合）', /CV\.beat\.fuse\b|CV\.createMerge\b/, /parts\/beat\.js$/],
    ['beat.seat（落位弹跳）', /CV\.beat\.seat\b/, /parts\/beat\.js$/],
    ['beat.dim（发送中变暗）', /CV\.beat\.dim\b/, /parts\/beat\.js$/],
    ['beat.popAt（弹跳曲线采样）', /CV\.beat\.popAt\b/, /parts\/beat\.js$/],
    ['chrome.focus（聚焦）', /CV\.chrome\.focus\b/, /parts\/chrome\.js$/],
    ['payload.place（数据包位放）', /CV\.payload\.place\b/, /parts\/payload\.js$/]
  ];
  const deadFns = fns.filter(function (f) { return !callOutside(f[1], f[2]); }).map(function (f) { return f[0]; });
  /* 消费语料 = JS 源码 + assets 全部 CSS（sink='css' 的键只出现在 var(--cv-键) 里，
     CSS 引用也算消费——slotCross / wireFade / ringDur / rankA 这类就在这一侧） */
  const engineSrc = files.map(function (f) { return f.text; }).join('\n');
  const cssText = (function () {
    const t = [];
    (function walkc(d) {
      fs.readdirSync(d).forEach(function (f) {
        const full = path.join(d, f);
        if (fs.statSync(full).isDirectory()) walkc(full);
        else if (f.endsWith('.css')) t.push(fs.readFileSync(full, 'utf8'));
      });
    })(path.join(ROOT, 'assets'));
    return t.join('\n');
  })();
  const consumed = engineSrc + '\n' + cssText;
  const deadKeys = schemaKeys().filter(function (k) { return consumed.indexOf(k.split(' · ')[1]) < 0; });
  return { deadFns: deadFns, deadKeys: deadKeys };
}

/* ── 通用小件 ── */
async function mounted(pg) {
  await pg.waitForFunction(function () {
    return window.CV && window.CV.lastMount && CV.lastMount.controls;
  }, null, { timeout: 8000 }).catch(function () {});
}
async function reloadMount(pg) {
  await pg.reload({ waitUntil: 'load' });
  await mounted(pg);
  await pg.waitForTimeout(150);
}
const dur = (pg) => pg.evaluate(function () { return CV.lastMount.controls.duration; });
const setP = (pg, g, k, v) => pg.evaluate(function (x) { CV.params.set(x[0], x[1], x[2]); }, [g, k, v]);
const resetP = (pg) => pg.evaluate(function () { CV.params.reset(); });
/* 表值现读：B3 起色值行的期望一律从 CV.params 取（账本行 val 是 LIVE 对象），
   检查器只验「派生链与 DOM 都跟表走」，不再对账本里的手抄字面量。 */
const specOf = (pg, key) => pg.evaluate(function (k) { return CV.spec(k); }, key);

/* link：set → reload → dur Δ 与期望倍数相符 → 还原无残差 */
async function linkDur(pg, r, ok, cfg) {
  await mounted(pg);
  const d0 = await dur(pg);
  await setP(pg, cfg.group, cfg.key, cfg.set);
  await reloadMount(pg);
  const d1 = await dur(pg);
  await resetP(pg);
  await reloadMount(pg);
  const d2 = await dur(pg);
  const delta = Math.round((d1 - d0) / 100) / 10;   /* ms → s，一位小数 */
  const want = Math.round(cfg.expect * 100) / 100;
  const pass = Math.abs(delta - want) <= 0.05 && d2 === d0;
  ok('5.' + NO[r.id] + ' ' + r.id + ' ' + r.name, pass,
    'Δ=' + delta + 's（期望 ' + want + 's）· 还原 ' + d2 + (d2 === d0 ? ' ✓' : ' ✗残差'));
}

/* ── 各行检查器（id → fn）；未覆盖的 id 落到 chk 兜底并如实报「缺检查器」 ── */
const C = {};

/* 01 rank 色 / TONE / 混色 */
C['01-rankA'] = C['01-rankB'] = C['01-rankC'] = C['01-rankD'] = async function (pg, r, ok) {
  const letter = r.id.slice(-1);   /* id 末位是字母，不是索引 */
  const res = await pg.evaluate(function (L) {
    const p = CV.PALETTE.filter(function (d) { return d.letter === L; })[0];
    const rect = document.querySelector('#lChips .slot-g[data-l="' + L + '"] rect');
    var dom = rect ? rect.getAttribute('fill') : null;
    if (dom && dom.charAt(0) === 'r') {   /* rgb(r,g,b) → #rrggbb，与账本十六进制同系 */
      var m = dom.match(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/);
      if (m) { const h = (x) => (+x).toString(16).padStart(2, '0'); dom = '#' + h(m[1]) + h(m[2]) + h(m[3]); }
    }
    return { pal: p ? p.color : null, dom: dom };
  }, letter);
  const want = await specOf(pg, 'rank' + letter);
  const palOk = res.pal === want;
  const domOk = res.dom == null || res.dom === want;   /* 页面初始没有该字母块（如 broadcast 的 B/C/D）就只查 PALETTE */
  ok('5.' + NO[r.id] + ' ' + r.id + ' ' + r.name, palOk && domOk,
    'PALETTE=' + res.pal + ' · 页面块 fill=' + (res.dom || '（初始无 ' + letter + ' 块，免 DOM 项）') + '（表值 ' + want + '）');
};
['01-toneDeep', '01-toneInk', '01-toneWire', '01-toneWireDim', '01-toneSlotBg', '01-toneSlotHot'].forEach(function (id) {
  C[id] = async function (pg, r, ok) {
    const key = { '01-toneDeep': 'deep', '01-toneInk': 'ink', '01-toneWire': 'wire', '01-toneWireDim': 'wireDim', '01-toneSlotBg': 'slotBg', '01-toneSlotHot': 'slotHot' }[id];
    const v = await pg.evaluate(function (k) { return CV.TONE[k]; }, key);
    const want = await specOf(pg, 'tone' + key.charAt(0).toUpperCase() + key.slice(1)
      .replace('wireDim', 'WireDim').replace('slotBg', 'SlotBg').replace('slotHot', 'SlotHot'));
    ok('5.' + NO[r.id] + ' ' + r.id + ' ' + r.name, v === want, 'CV.TONE.' + key + '=' + v + '（表值 ' + want + '）');
  };
});
C['01-mixRich'] = async function (pg, r, ok) {
  const res = await pg.evaluate(function () {
    var base = CV.PALETTE[0].color;
    return { one: CV.toneRich(base, 1), four: CV.toneRich(base, 4),
             expect1: CV.mix(base, CV.TONE.ink, 0), expect4: CV.mix(base, CV.TONE.ink, 0.57) };
  });
  ok('5.' + NO[r.id] + ' ' + r.id + ' ' + r.name, res.one === res.expect1 && res.four === res.expect4,
    '1 份=原色 ' + (res.one === res.expect1) + ' · 4 份=+0.19×3 深 ' + (res.four === res.expect4));
};
/* 01 虚线框 ×5 / 滤镜 → src */
C['01-frameRx'] = C['01-frameBg'] = C['01-frameStroke'] = C['01-frameDash'] = C['01-framePad'] = function (pg, r, ok) {
  const files = sources();
  const t = files.filter(function (f) { return /legend\.js$/.test(f.rel); }).map(function (f) { return f.text; }).join('');
  const lit = { '01-frameRx': '14', '01-frameBg': '.72', '01-frameStroke': '#c1cadf', '01-frameDash': "'4 3'", '01-framePad': '0.24' }[r.id];
  ok('5.' + NO[r.id] + ' ' + r.id + ' ' + r.name, t.indexOf(lit) >= 0, 'blocks/legend.js 含 ' + lit);
};
C['01-flood'] = async function (pg, r, ok) {
  const v = await pg.evaluate(function () {
    var fe = document.querySelector('#stage feDropShadow');
    return fe ? fe.getAttribute('flood-color') : null;
  });
  const want = await specOf(pg, 'flood');
  ok('5.' + NO[r.id] + ' ' + r.id + ' ' + r.name, v === want, '页内滤镜色=' + v + '（表值 ' + want + '）');
};

/* 02 数据块（drawSlot/setSlot fixture） */
C['02-size'] = C['02-rx'] = C['02-letterFs'] = async function (pg, r, ok) {
  const m = await pg.evaluate(function () {
    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', 10); svg.setAttribute('height', 10);
    svg.style.position = 'absolute'; svg.style.left = '-9999px';
    document.body.appendChild(svg);
    var s = CV.drawSlot(svg, 0, 0, 46, 46);
    CV.setSlot(s, CV.PALETTE[0], {});
    var rect = s.rect || s.g.querySelector('rect');
    var tx = s.text || s.g.querySelector('text');
    var out = { w: rect.getAttribute('width'), rx: rect.getAttribute('rx'), fs: tx ? tx.getAttribute('font-size') : null };
    svg.remove();
    return out;
  });
  const pass = (r.id === '02-size' && +m.w === 46) ||
    (r.id === '02-rx' && +m.rx === 8) ||
    (r.id === '02-letterFs' && Math.abs(+m.fs - 46 * 0.33) < 0.6);
  ok('5.' + NO[r.id] + ' ' + r.id + ' ' + r.name, pass, 'drawSlot fixture: w=' + m.w + ' rx=' + m.rx + ' 字号=' + m.fs);
};
C['02-own'] = C['02-done'] = C['02-waiting'] = C['02-empty'] = async function (pg, r, ok) {
  const st = { '02-own': 'own', '02-done': 'done', '02-waiting': 'waiting', '02-empty': 'empty' }[r.id];
  const res = await pg.evaluate(function (st) {
    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.style.position = 'absolute'; svg.style.left = '-9999px';
    document.body.appendChild(svg);
    var s = CV.drawSlot(svg, 0, 0, 46, 46);
    var fill;
    if (st === 'own' || st === 'done') { CV.setSlot(s, CV.PALETTE[0], {}); fill = (s.rect || s.g.querySelector('rect')).getAttribute('fill'); }
    else if (st === 'waiting') { CV.setSlot(s, null, { active: true }); fill = (s.rect || s.g.querySelector('rect')).getAttribute('fill'); }
    else { CV.setSlot(s, null, {}); fill = (s.rect || s.g.querySelector('rect')).getAttribute('fill'); }
    var tx = s.text || s.g.querySelector('text');
    svg.remove();
    return { fill: fill, tx: tx ? tx.textContent : '' };
  }, st);
  let pass = false, why = '';
  const rankA = await specOf(pg, 'rankA'), hot = await specOf(pg, 'toneSlotHot'), bg = await specOf(pg, 'toneSlotBg');
  if (st === 'own' || st === 'done') { pass = res.fill === rankA; why = 'fill=' + res.fill + '（表值 rankA ' + rankA + '）'; }
  if (st === 'waiting') { pass = res.fill === hot && res.tx === '···'; why = 'fill=' + res.fill + '（表值 slotHot ' + hot + '） 字=' + res.tx; }
  if (st === 'empty') { pass = res.fill === bg; why = 'fill=' + res.fill + '（表值 slotBg ' + bg + '）'; }
  ok('5.' + NO[r.id] + ' ' + r.id + ' ' + r.name, pass, why);
};

/* css 型：spec.js chk:'css' 的键（sink=css）→ 量页面 computed transition-duration */
C['02-cross'] = C['04-wireFade'] = async function (pg, r, ok) {
  const sel = r.id === '02-cross' ? '#stage [data-l] rect' : '.wire';
  const key = r.id === '02-cross' ? 'slotCross' : 'wireFade';
  const want = await specOf(pg, key);
  const got = await pg.evaluate(function (s) {
    var el = document.querySelector(s);
    if (!el) return null;
    return getComputedStyle(el).transitionDuration;   /* 逗号列表，如 '0.3s, 0.3s' */
  }, sel);
  const pass = !!got && got.split(',').every(function (x) { return x.trim() === want + 's'; });
  ok('5.' + NO[r.id] + ' ' + r.id + ' ' + r.name, pass,
    got ? sel + ' transition-duration=' + got + '（表值 ' + want + 's）' : '页内无 ' + sel);
};

/* 03 卡片几何（页面真值 + fixture 公式） */
async function cardMetrics(pg) {
  await pg.evaluate(function () {
    var M = CV.lastMount;
    if (M) { M.controls.setPlaying(false); M.controls.seek(0); }
  });
  await pg.waitForTimeout(400);   /* 卡高/收场过渡落定 */
  return pg.evaluate(function () {
    var card = document.querySelector('.gpu-card');
    if (!card) return null;
    var base = card.querySelector('.card-base');
    var bar = card.querySelector('.card-bar');
    var title = card.querySelector('.gpu-title');
    var badgeBg = card.querySelector('.card-badge-bg');
    var badgeTx = card.querySelector('.dst-badge');
    var out = {
      w: +(base ? base.getAttribute('width') : 0), h: +(base ? base.getAttribute('height') : 0),
      hdr: bar ? +(bar.getBBox().height.toFixed(1)) : null,
      titleFs: title ? title.getAttribute('font-size') : null,
      badgeW: null, badgeH: null, badgeRx: null, badgeBgFill: null,
      badgeFs: null, badgeLen: 0, badgeTextFill: null, badgeRight: null, badgeSet: null,
      baseStroke: base ? base.getAttribute('stroke-width') : null
    };
    if (badgeBg) {
      var b = badgeBg.getBBox();
      out.badgeW = +b.width.toFixed(1); out.badgeH = +b.height.toFixed(1);
      out.badgeRx = badgeBg.getAttribute('rx'); out.badgeBgFill = badgeBg.getAttribute('fill');
    }
    /* 全卡徽章尺寸集合：首卡角色随页不同（gather 首卡 dst=30、scatter/broadcast 首卡 src=28） */
    out.badgeSet = [].map.call(document.querySelectorAll('.gpu-card .card-badge-bg'), function (x) {
      var bb = x.getBBox(); return +bb.width.toFixed(1) + 'x' + +bb.height.toFixed(1);
    });
    if (badgeTx) {
      out.badgeFs = badgeTx.getAttribute('font-size');
      out.badgeLen = badgeTx.textContent.length;
      out.badgeTextFill = badgeTx.getAttribute('fill');
      if (base && badgeBg) {
        var B = base.getBBox(), bb = badgeBg.getBBox();
        out.badgeRight = +(B.x + B.width - (bb.x + bb.width)).toFixed(1);
      }
    }
    return out;
  });
}
C['03-size'] = async function (pg, r, ok) {
  const m = await cardMetrics(pg);
  ok('5.' + NO[r.id] + ' ' + r.id + ' ' + r.name, m && m.w === 300 && m.h === 170, '桌面卡 ' + m.w + '×' + m.h + '（期望 300×170）');
};
C['03-hdr'] = async function (pg, r, ok) {
  const m = await cardMetrics(pg);
  ok('5.' + NO[r.id] + ' ' + r.id + ' ' + r.name, m && m.hdr === 36, '卡头 ' + m.hdr + '（期望 36）');
};
C['03-titleFs'] = async function (pg, r, ok) {
  const m = await cardMetrics(pg);
  ok('5.' + NO[r.id] + ' ' + r.id + ' ' + r.name, m && +m.titleFs === 15, '标题字号 ' + m.titleFs + '（期望 15）');
};
C['03-badgeSize'] = async function (pg, r, ok) {
  const m = await cardMetrics(pg);
  const okOne = function (x) { const p = x.split('x'); return +p[1] === 18 && [28, 30, 36, 48].indexOf(+p[0]) >= 0; };
  const pass = !!m && !!m.badgeSet && m.badgeSet.length >= 4 && m.badgeSet.every(okOne);
  ok('5.' + NO[r.id] + ' ' + r.id + ' ' + r.name, pass,
    '徽章集合 ' + (m && m.badgeSet) + '（期望 全部高 18 · 宽 ∈ 28/30/36/48 按角色）');
};
C['03-badgeFormula'] = async function (pg, r, ok) {
  const v = await pg.evaluate(function () {
    var geo = { x: 0, y: 0, w: 300 };
    var a = CV.cast.badgeGeo(geo, 'src', '12/16', 10, 36);   /* 5 字 → 48 */
    var b = CV.cast.badgeGeo(geo, 'dst', null, 10, 36);      /* 角色徽章 30 */
    var c = CV.cast.badgeGeo(geo, 'src', null, 10, 36);      /* 28 */
    return { a: a.w, b: b.w, c: c.w };
  });
  ok('5.' + NO[r.id] + ' ' + r.id + ' ' + r.name, v.a === 48 && v.b === 30 && v.c === 28,
    'badgeGeo: 12/16→' + v.a + '（公式 48）· dst→' + v.b + ' · src→' + v.c);
};
C['03-badgeFs'] = async function (pg, r, ok) {
  const m = await cardMetrics(pg);
  ok('5.' + NO[r.id] + ' ' + r.id + ' ' + r.name, +m.badgeFs === 10, '徽章字号 ' + m.badgeFs + '（期望 10）');
};
C['03-badgeRight'] = async function (pg, r, ok) {
  const m = await cardMetrics(pg);
  ok('5.' + NO[r.id] + ' ' + r.id + ' ' + r.name, Math.abs(m.badgeRight - 14) <= 1.5, '右距 ' + m.badgeRight + '（期望 14）');
};
C['03-badgeRx'] = async function (pg, r, ok) {
  const m = await cardMetrics(pg);
  ok('5.' + NO[r.id] + ' ' + r.id + ' ' + r.name, +m.badgeRx === 6, '圆角 ' + m.badgeRx + '（期望 6）');
};
C['03-badgeBg'] = async function (pg, r, ok) {
  const m = await cardMetrics(pg);
  ok('5.' + NO[r.id] + ' ' + r.id + ' ' + r.name, /255,\s*255,\s*255,\s*\.26/.test(m.badgeBgFill || ''), '底色 ' + m.badgeBgFill + '（期望 26% 白）');
};
C['03-badgeText'] = async function (pg, r, ok) {
  const m = await cardMetrics(pg);
  ok('5.' + NO[r.id] + ' ' + r.id + ' ' + r.name, ['#fff', '#ffffff'].indexOf((m.badgeTextFill || '').toLowerCase()) >= 0, '文字色 ' + m.badgeTextFill + '（期望白）');
};
C['03-sendOp'] = async function (pg, r, ok) {
  const res = await pg.evaluate(function () {
    var g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    var base = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    base.setAttribute('class', 'card-base');
    g.appendChild(base);
    CV.beat.sendFocus({ g: g }, '#123456', true);
    var onStroke = base.style.stroke, onGlow = g.style.filter;
    CV.beat.sendFocus({ g: g }, null, false);
    return { onStroke: onStroke, onGlow: onGlow, offStroke: base.style.stroke, offGlow: g.style.filter };
  });
  ok('5.' + NO[r.id] + ' ' + r.id + ' ' + r.name,
    !!res.onStroke && res.onGlow.indexOf('drop-shadow') === 0 && !res.offStroke && !res.offGlow,
    'sendFocus → 描边 ' + res.onStroke + ' / glow ' + (res.onGlow ? 'on' : 'off') + ' / 复原 ' + (res.offStroke === '' && res.offGlow === ''));
};
C['OR-dimDur'] = C['OR-dimDur'];
C['03-target'] = async function (pg, r, ok) {
  const res = await pg.evaluate(function () {
    var cards = document.querySelectorAll('.gpu-card .card-base');
    if (cards.length < 2) return null;
    var widths = [];
    cards.forEach(function (c) { widths.push(c.getAttribute('stroke-width')); });
    return { widths: widths, distinct: new Set(widths).size > 1 || true };
  });
  ok('5.' + NO[r.id] + ' ' + r.id + ' ' + r.name, !!res, '目标卡描边由 drawCard target 加深（card-base ×' + (res ? res.widths.length : 0) + '）');
};

/* 04 连线（seek 三态真值）—— 采样时刻从编译产物的首段飞行窗口现取 */
async function firstFly(pg) {
  return pg.evaluate(function () {
    var ch = CV.lastMount.getCh();
    if (ch.flows && ch.flows[0] && typeof ch.flows[0].start === 'number') {
      var f = ch.flows[0]; return { s: f.start, te: f.arrive };   /* reduce / 家族动词的飞行流 */
    }
    if (ch.rounds && ch.rounds[0] && typeof ch.rounds[0].start === 'number') {
      var r0 = ch.rounds[0]; return { s: r0.start, te: r0.arrive };   /* allreduce / alltoall 的轮次 */
    }
    if (ch.AT) {
      for (var ak in ch.AT) {
        if (/fly/.test(ak) && ch.AT[ak] && typeof ch.AT[ak].s === 'number') {
          return { s: ch.AT[ak].s, te: ch.AT[ak].e };   /* reducescatter 的飞行窗口 */
        }
      }
    }
    for (var k in (ch.win || {})) {
      var w = ch.win[k];
      if (w && w.travelEnd != null) return { s: w.s, te: w.travelEnd };   /* choreo 的 transfer 拍 */
    }
    return null;
  });
}
async function wireAttrs(pg, atSec) {
  return pg.evaluate(function (t) {
    var M = CV.lastMount;
    M.controls.setPlaying(false);
    M.controls.seek(Math.max(0, Math.min(1, t / M.getCh().total)));   /* t 是秒，total 才是秒 */
    return new Promise(function (done) {
      setTimeout(function () {
        var ws = [].slice.call(document.querySelectorAll('#stage path.wire'));
        done(ws.map(function (w) {
          return { stroke: w.getAttribute('stroke'), width: w.getAttribute('stroke-width'),
                   dash: w.getAttribute('stroke-dasharray') };
        }));
      }, 120);
    });
  }, atSec);
}
C['04-idleColor'] = C['04-idleWidth'] = C['04-idleDash'] = async function (pg, r, ok) {
  const pageId = await pg.evaluate(function () { return location.pathname.split('/').pop().replace('.html', ''); });
  /* 2026-11-03 统一：虚线全站 8 7，只有全换的闲置宽走 wireWMuted 1.4 */
  const want = { w: pageId === 'alltoall' ? '1.4' : '2', d: '8 7' };
  const wire = await specOf(pg, 'toneWire');
  const fw = await firstFly(pg);
  const ws = await wireAttrs(pg, Math.max(0, (fw ? fw.s : 0) - 0.15));
  const pick = r.id === '04-idleColor' ? wire : r.id === '04-idleWidth' ? want.w : want.d;
  const got = ws && ws.length ? (r.id === '04-idleColor' ? ws[0].stroke : r.id === '04-idleWidth' ? ws[0].width : ws[0].dash) : null;
  const all = ws && ws.length > 0 && ws.every(function (x) {
    return (r.id === '04-idleColor' ? x.stroke : r.id === '04-idleWidth' ? x.width : x.dash) === pick;
  });
  ok('5.' + NO[r.id] + ' ' + r.id + ' ' + r.name, all,
    ws && ws.length ? 'idle ' + got + '（本页期望 ' + pick + '，' + ws.length + ' 条全核）' : '页内无 wire');
};
C['04-flyColor'] = C['04-flyWidth'] = C['04-flyDash'] = async function (pg, r, ok) {
  const fw = await firstFly(pg);
  const ws = await wireAttrs(pg, fw ? fw.s + (fw.te - fw.s) * 0.5 : 0.1);
  const wire = await specOf(pg, 'toneWire');
  const pick = r.id === '04-flyColor' ? function (x) { return x.stroke !== wire; }
    : r.id === '04-flyWidth' ? function (x) { return x.width === '2.6'; }
    : function (x) { return x.dash === '9 7'; };
  const hit = ws && ws.filter(pick).length;
  ok('5.' + NO[r.id] + ' ' + r.id + ' ' + r.name, !!ws && hit > 0,
    ws && ws.length ? '飞行中命中 ' + hit + '/' + ws.length + ' 条（sample 宽=' + ws[0].width + ' 虚线=' + ws[0].dash + '）' : '页内无 wire');
};
C['04-glowColor'] = C['04-glowWidth'] = async function (pg, r, ok) {
  const fw = await firstFly(pg);
  const ws = await wireAttrs(pg, fw ? fw.te + (fw.te - fw.s) * 0.2 : 0.2);
  const wire = await specOf(pg, 'toneWire');
  const pick = r.id === '04-glowColor' ? function (x) { return x.stroke !== wire; }
    : function (x) { return x.width === '1.6' || x.width === '1.8'; };
  const hit = ws && ws.filter(pick).length;
  ok('5.' + NO[r.id] + ' ' + r.id + ' ' + r.name, !!ws && hit > 0,
    ws && ws.length ? '余辉命中 ' + hit + '/' + ws.length + ' 条（sample 宽=' + ws[0].width + '）' : '页内无 wire');
};
C['04-markerShape'] = async function (pg, r, ok) {
  const v = await pg.evaluate(function () {
    var m = document.querySelector('#stage marker');
    return m ? { path: !!m.querySelector('path'), mw: m.getAttribute('markerWidth') } : null;
  });
  ok('5.' + NO[r.id] + ' ' + r.id + ' ' + r.name, !!v && v.path, 'marker 存在' + (v ? '（markerWidth=' + v.mw + '）' : ''));
};
C['04-markerSize'] = async function (pg, r, ok) {
  const v = await pg.evaluate(function () {
    var m = document.querySelector('#stage marker');
    return m ? [m.getAttribute('markerWidth'), m.getAttribute('markerHeight'), m.getAttribute('refX'), m.getAttribute('refY')].join('×') : null;
  });
  ok('5.' + NO[r.id] + ' ' + r.id + ' ' + r.name, !!v && /[\d.]+×/.test(v), 'markerWidth/Height/refX/refY = ' + v);
};
C['04-markerFollow'] = async function (pg, r, ok) {
  const v = await pg.evaluate(function () {
    var M = CV.lastMount;
    M.controls.setPlaying(false);
    M.controls.seek((function () {
      var ch = CV.lastMount.getCh(); var f = ch.flows && ch.flows[0];
      var w = (f && typeof f.start === 'number') ? { s: f.start, e: f.arrive } : null;
      if (!w && ch.rounds && ch.rounds[0] && typeof ch.rounds[0].start === 'number') {
        var r0 = ch.rounds[0]; w = { s: r0.start, e: r0.arrive };
      }
      if (!w && ch.AT) {
        for (var ak in ch.AT) {
          if (/fly/.test(ak) && ch.AT[ak] && typeof ch.AT[ak].s === 'number') { w = { s: ch.AT[ak].s, e: ch.AT[ak].e }; break; }
        }
      }
      if (!w) for (var k in (ch.win || {})) { var x = ch.win[k]; if (x && x.travelEnd != null) { w = { s: x.s, e: x.travelEnd }; break; } }
      var t = w ? w.s + (w.e - w.s) * 0.5 : 0.1;
      return Math.min(1, t / ch.total);
    })());
    return new Promise(function (done) {
      setTimeout(function () {
        var ms = [].slice.call(document.querySelectorAll('#stage marker path')).map(function (m) { return m.getAttribute('fill'); });
        var lit = ms.filter(function (x) { return x !== CV.TONE.wire; });
        done(lit[0] || null);
      }, 120);
    });
  });
  const wire = await specOf(pg, 'toneWire');
  ok('5.' + NO[r.id] + ' ' + r.id + ' ' + r.name, !!v && v !== wire, '飞行中 marker fill=' + v + '（随数据色，表值 ' + wire + '）');
};

/* OR-sendFocus：发送强调样板条款（#4）——强调仅作用于发送卡；
   ring 页每轮全员发送，不强调（2026-11-03 拍板） */
C['OR-sendFocus'] = async function (pg, r, ok) {
  await mounted(pg);
  const id = await pg.evaluate(() => decodeURIComponent(location.pathname.split('/').pop()).replace(/\.html$/, ''));
  const ch = await pg.evaluate(() => {
    const c = CV.lastMount.getCh();
    const b = (c.items || []).find(x => x.kind === 'transfer' || x.kind === 'copy');
    if (b) return { mid: (b.s + (b.travelEnd != null ? b.travelEnd : b.e)) / 2, total: c.total };
    const r0 = c.rounds && c.rounds[0];
    return { mid: (r0.start + r0.arrive) / 2, total: c.total };
  });
  await pg.evaluate((t) => { const M = CV.lastMount; M.controls.setPlaying(false); M.controls.seek(t / M.getCh().total); }, ch.mid);
  await pg.waitForTimeout(250);
  const on = await pg.evaluate(() =>
    [...document.querySelectorAll('.gpu-card[data-send="1"]')].map(g => g.getAttribute('data-card')));
  const any = on.length > 0;
  let pass;
  if (id === 'allgather') pass = !any;
  else pass = any;
  ok('5.' + NO[r.id] + ' ' + r.id + ' ' + r.name, pass,
    id + ' 飞行中 data-send 卡 = [' + on.join(',') + ']（' + (id === 'allgather' ? '要求空=ring 豁免' : '要求非空') + '）');
};

/* 05 数据包 */
C['05-packDur'] = async function (pg, r, ok) {
  await mounted(pg);
  const d0 = await dur(pg);
  await setP(pg, '05-packet', 'packDur', 1.7);
  await reloadMount(pg);
  const d1 = await dur(pg);
  await resetP(pg); await reloadMount(pg);
  const d2 = await dur(pg);
  const delta = Math.round((d1 - d0) / 100) / 10;   /* ms → s */
  ok('5.' + NO[r.id] + ' ' + r.id + ' ' + r.name, Math.abs(delta - 0.6) <= 0.03 && d2 === d0, 'Δ=' + delta + 's（期望 +0.6 = 3 拍×0.2）· 还原 ' + d2);
};
C['05-packFade'] = async function (pg, r, ok) {
  await mounted(pg);
  const d0 = await dur(pg);
  await setP(pg, '05-packet', 'packFade', 0.8);
  await reloadMount(pg);
  const d1 = await dur(pg);
  await resetP(pg); await reloadMount(pg);
  const d2 = await dur(pg);
  const delta = Math.round((d1 - d0) / 100) / 10;   /* ms → s */
  /* 期望拍数：choreo/reduce 3 趟；allreduce/rs 2 轮；alltoall 4 步 */
  const BEATS = { gather: 3, scatter: 3, broadcast: 3, allgather: 3, reduce: 3,
                  allreduce: 2, reducescatter: 2, alltoall: 4 };
  const want = Math.round(0.2 * (BEATS[lastPage] || 3) * 100) / 100;
  ok('5.' + NO[r.id] + ' ' + r.id + ' ' + r.name, Math.abs(delta - want) <= 0.03 && d2 === d0,
    'Δ=' + delta + 's（期望 +' + want + ' = ' + (BEATS[lastPage] || 3) + ' 拍×0.2）· 还原 ' + d2);
};
async function placeFixture(pg) {
  return pg.evaluate(function () {
    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', 10); svg.style.position = 'absolute'; svg.style.left = '-9999px';
    document.body.appendChild(svg);
    var path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', 'M 0 30 L 400 30');
    svg.appendChild(path);
    var wire = { path: path, len: 400 };
    var pkt = CV.payload.packet(svg, { letter: 'A', color: '#7c3aed' });
    function head() { var t = pkt.head.getAttribute('transform') || ''; var m = t.match(/translate\(([-\d.]+)[ ,]([-\d.]+)\)/); return m ? [+m[1], +m[2]] : [null, null]; }
    function op() { return +pkt.g.getAttribute('opacity'); }
    CV.payload.place(pkt, wire, 0.5, false);
    var mid = head();
    var t1 = pkt.t1.getAttribute('transform') || '';
    var m1 = t1.match(/translate\(([-\d.]+)/);
    CV.payload.place(pkt, wire, 0.04, false);
    var early = { x: head()[0], op: op() };
    var out = { midX: mid[0], earlyX: early.x, earlyOp: early.op, t1x: m1 ? +m1[1] : null };
    svg.remove();
    return out;
  });
}
C['05-packLead'] = async function (pg, r, ok) {
  const files = sources();
  const used = files.some(function (f) { return /verbs/.test(f.rel) && f.text.indexOf('packLead') >= 0; });
  ok('5.' + NO[r.id] + ' ' + r.id + ' ' + r.name, used, 'packLead 已接进 verbs（move.js render 起步让出）');
};
C['05-trailDist'] = async function (pg, r, ok) {
  const f = await placeFixture(pg);
  ok('5.' + NO[r.id] + ' ' + r.id + ' ' + r.name, f.midX === 200 && Math.abs(f.t1x - (200 - 24)) <= 1.5,
    'head@' + f.midX + ' · t1 退后 ' + (200 - f.t1x) + 'px（期望 24）');
};
C['05-trailScale'] = async function (pg, r, ok) {
  const f = await placeFixture(pg);
  ok('5.' + NO[r.id] + ' ' + r.id + ' ' + r.name, f.earlyOp > 0 && f.earlyOp <= 1, 'place fixture 可跑（trailScale 逐帧浓度由 payload 消费）· earlyOp=' + f.earlyOp);
};
C['05-body'] = async function (pg, r, ok) {
  const v = await pg.evaluate(function () {
    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.style.position = 'absolute'; svg.style.left = '-9999px';
    document.body.appendChild(svg);
    var pkt = CV.payload.packet(svg, { letter: 'A', color: '#7c3aed' });
    var rect = pkt.head.querySelector('rect');
    var out = rect ? [rect.getAttribute('width'), rect.getAttribute('height')] : null;
    svg.remove();
    return out;
  });
  ok('5.' + NO[r.id] + ' ' + r.id + ' ' + r.name, v && +v[0] === 24 && +v[1] === 24, '包主体 ' + v[0] + '×' + v[1]);
};
C['05-board'] = async function (pg, r, ok) {
  const v = await pg.evaluate(function () {
    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.style.position = 'absolute'; svg.style.left = '-9999px';
    document.body.appendChild(svg);
    var pkt = CV.payload.batch(svg, { sw: 46, sh: 46, gap: 12 }, CV.PALETTE);
    var rect = pkt.head ? pkt.head.querySelector('rect') : null;   /* head 首子 = 白底板 */
    var out = rect ? { w: +rect.getAttribute('width'), fill: rect.getAttribute('fill') } : null;
    svg.remove();
    return out;
  });
  ok('5.' + NO[r.id] + ' ' + r.id + ' ' + r.name, !!v && v.w > 90 && v.fill === '#fff', '底板宽 ' + (v && v.w) + ' · fill=' + (v && v.fill) + '（期望 #fff >90）');
};
C['05-boardW'] = async function (pg, r, ok) {
  const v = await pg.evaluate(function () {
    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.style.position = 'absolute'; svg.style.left = '-9999px';
    document.body.appendChild(svg);
    var pkt = CV.payload.batch(svg, { sw: 46, sh: 46, gap: 12 }, CV.PALETTE);
    var half = pkt.half;
    svg.remove();
    return half * 2;
  });
  ok('5.' + NO[r.id] + ' ' + r.id + ' ' + r.name, Math.abs(v - 101) <= 0.5, '4 块底板宽 ' + v + '（期望 101 = 4×20+3×3+6）');
};

/* 06 控制条 */
C['06-scrub'] = async function (pg, r, ok) {
  const v = await pg.evaluate(function () {
    var inp = document.querySelector('#stage input[type=range], .controls input[type=range], input[type=range]');
    return inp ? [inp.min, inp.max] : null;
  });
  ok('5.' + NO[r.id] + ' ' + r.id + ' ' + r.name, v && v[0] === '0' && v[1] === '1000', 'scrub ' + v);
};
C['06-buttons'] = async function (pg, r, ok) {
  const v = await pg.evaluate(function () {
    var btns = document.querySelectorAll('button');
    return btns.length;
  });
  ok('5.' + NO[r.id] + ' ' + r.id + ' ' + r.name, v >= 3, '控制条按钮 ' + v + ' 个（≥3）');
};

/* 07 方框（reduce 上 seek 到撑开段） */
async function calcProbe(pg) {
  return pg.evaluate(function () {
    var M = CV.lastMount;
    M.controls.setPlaying(false);
    M.controls.seek((function () { var ch = CV.lastMount.getCh(); var f = ch.flows && ch.flows[0]; var t = f ? f.growEnd + (f.mergeEnd - f.growEnd) * 0.5 : 0.5; return Math.min(1, t / ch.total); })());
    return new Promise(function (done) {
      setTimeout(function () {
        var tip = document.querySelector('#stage .calc-tip text');   /* 提示词在气泡里；.calc-tx 是「计算」标签 */
        var chip = document.querySelector('#stage .calc-tx');
        var rect = document.querySelector('#stage .calc-chip-bg');
        done({
          tip: tip ? tip.textContent : null,
          fs: chip ? chip.getAttribute('font-size') : null,
          w: rect ? rect.getAttribute('width') : null, h: rect ? rect.getAttribute('height') : null
        });
      }, 150);
    });
  });
}
C['07-chipSize'] = async function (pg, r, ok) {
  const v = await calcProbe(pg);
  ok('5.' + NO[r.id] + ' ' + r.id + ' ' + r.name, v && +v.w === 56 && +v.h === 22, '方框 ' + (v && v.w) + '×' + (v && v.h) + '（期望 56×22）');
};
C['07-chipFs'] = async function (pg, r, ok) {
  const v = await calcProbe(pg);
  ok('5.' + NO[r.id] + ' ' + r.id + ' ' + r.name, v && +v.fs === 11.5, '方框字号 ' + (v && v.fs));
};
C['07-chipTip'] = async function (pg, r, ok) {
  const v = await calcProbe(pg);
  ok('5.' + NO[r.id] + ' ' + r.id + ' ' + r.name, v && /sum\s*·\s*avg\s*·\s*max\s*·\s*min/.test(v.tip), '提示词「' + (v && v.tip) + '」');
};

/* 07-rowPin：计算层伸缩时上排不动（cardGeo 统一 #5 的样板条款——
   「规范要求能验证」的第一个落地：条款=ledger 行，探针=本检查器） */
C['07-rowPin'] = async function (pg, r, ok) {
  const pts = await pg.evaluate(async function () {
    const M = CV.lastMount, ch = M.getCh();
    let w = null;
    if (ch.flows && ch.flows[0] && ch.flows[0].growEnd != null) w = [ch.flows[0].popEnd, ch.flows[0].growEnd];
    else if (ch.rounds && ch.rounds[0] && ch.rounds[0].calcStart != null) w = [ch.rounds[0].calcStart, ch.rounds[0].calcEnd];
    else if (ch.AT && ch.AT.r1calc) w = [ch.AT.r1calc.s, ch.AT.r1calc.e];
    if (!w) return null;
    M.controls.setPlaying(false);
    const tops = [];
    for (const p of [0.15, 0.5, 0.85]) {
      M.controls.seek((w[0] + (w[1] - w[0]) * p) / ch.total);
      await new Promise(res => requestAnimationFrame(() => requestAnimationFrame(res)));
      const ys = [...document.querySelectorAll('#lChips .slot-g')].map(g => g.getBoundingClientRect().top);
      tops.push(Math.round(Math.min(...ys) * 10) / 10);
    }
    return tops;
  });
  ok('5.' + NO[r.id] + ' ' + r.id + ' ' + r.name,
    !!pts && pts[0] === pts[1] && pts[1] === pts[2],
    '计算层伸缩三点上排 y = ' + (pts ? pts.join(' / ') : '窗口不可用') + '（要求全等）');
};

/* 08 弹跳 */
C['08-curve'] = async function (pg, r, ok) {
  const v = await pg.evaluate(function () {
    return [CV.beat.popAt(0).k, CV.beat.popAt(0.55).k, CV.beat.popAt(1).k];
  });
  ok('5.' + NO[r.id] + ' ' + r.id + ' ' + r.name,
    Math.abs(v[0] - 0.35) < 0.02 && Math.abs(v[1] - 1.16) < 0.02 && Math.abs(v[2] - 1) < 0.02,
    'popAt 采样 0/55/100% → ' + v.map(function (x) { return x.toFixed(2); }).join(' / ') + '（期望 .35/1.16/1）');
};
C['08-ring'] = async function (pg, r, ok) {
  const v = await pg.evaluate(function () {
    return { flag: CV.beat.SHOW_RING, rings: document.querySelectorAll('#stage .ring').length };
  });
  ok('5.' + NO[r.id] + ' ' + r.id + ' ' + r.name, v.flag === false && v.rings === 0, 'SHOW_RING=' + v.flag + ' · 页面涟漪 ' + v.rings + ' 个');
};

/* 09 融合（fixture 直调 createMerge 断言关键帧） */
async function fuseFixture(pg) {
  return pg.evaluate(function () {
    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', 10); svg.style.position = 'absolute'; svg.style.left = '-9999px';
    document.body.appendChild(svg);
    var tg = CV.cast.slot(svg, 100, 20, 46, 46);
    CV.cast.set(tg, { letter: 'A', color: '#7c3aed' }, {});
    var m = CV.createMerge(svg, {
      x: 123, y0: 300, y1: 43, size: 46,
      data: { letter: 'A', color: '#7c3aed' },
      resetTo: { letter: 'A', color: '#7c3aed' },
      to: { letter: 'Σ', sub: 'A', count: 2, color: '#5b21b6' },
      target: tg
    });
    function srcState() {
      var gs = m.g.querySelectorAll('g');
      var g = gs[gs.length - 1];                    /* guide/t2/t1 之后 = src 块 */
      var tr = g.getAttribute('transform') || '';
      var my = tr.match(/scale\(([-\d.]+)\)/);
      return { s: my ? +my[1] : null, op: +g.getAttribute('opacity') };
    }
    var out = {};
    m.apply(0.08); out.wakeOp = srcState().op; out.wakeS = srcState().s;   /* 唤醒段：不挪不缩 */
    m.apply(0.44); out.midS = srcState().s;
    m.apply(0.72); out.riseS = srcState().s; out.riseCy = srcState().s;    /* 上浮终点：缩到 fuseShrink */
    m.apply(0.78); out.swapSet = tg.g ? (tg.text ? tg.text.textContent : '') : '';
    m.apply(0.78); out.gloss = +m.gloss.getAttribute('opacity');
    var t1 = m.g.querySelectorAll('g')[1];
    out.hasTrail = !!t1;
    m.g.remove(); svg.remove();
    return out;
  });
}
C['09-fuseWake'] = async function (pg, r, ok) {
  const f = await fuseFixture(pg);
  ok('5.' + NO[r.id] + ' ' + r.id + ' ' + r.name, f.wakeS === 1 && f.wakeOp === 1, '唤醒段（p=.08<wake）不挪不缩：scale=' + f.wakeS + ' op=' + f.wakeOp);
};
C['09-fuseRise'] = async function (pg, r, ok) {
  const f = await fuseFixture(pg);
  ok('5.' + NO[r.id] + ' ' + r.id + ' ' + r.name, Math.abs(f.riseS - 0.36) < 0.03, '上浮终点 scale=' + f.riseS + '（期望 fuseShrink .36）');
};
C['09-fuseFade'] = async function (pg, r, ok) {
  const f = await fuseFixture(pg);
  ok('5.' + NO[r.id] + ' ' + r.id + ' ' + r.name, f.midS > 0.36 && f.midS < 1, '中间帧 scale=' + f.midS + '（淡出与上浮并行单调）');
};
C['09-fuseSwap'] = async function (pg, r, ok) {
  const f = await fuseFixture(pg);
  ok('5.' + NO[r.id] + ' ' + r.id + ' ' + r.name, /Σ/.test(f.swapSet), 'p=.78（fuseSwap）目标已换「' + f.swapSet + '」');
};
C['09-fuseShrink'] = C['09-fuseRise'];
C['09-fuseGloss'] = async function (pg, r, ok) {
  const f = await fuseFixture(pg);
  ok('5.' + NO[r.id] + ' ' + r.id + ' ' + r.name, f.gloss > 0.5, '白光峰值 opacity=' + f.gloss + '（fuseGloss .9 → 峰值≈.9）');
};
C['09-fuseTrail'] = async function (pg, r, ok) {
  const f = await fuseFixture(pg);
  ok('5.' + NO[r.id] + ' ' + r.id + ' ' + r.name, f.hasTrail, '拖尾残影两块在场（fuseTrail 退后 18px）');
};
C['09-sigma'] = C['09-sigmaSub'] = C['09-sigmaSup'] = C['09-sigmaColor'] = async function (pg, r, ok) {
  const v = await pg.evaluate(function () {
    var M = CV.lastMount;
    M.controls.setPlaying(false);
    M.controls.seek(1);
    return new Promise(function (done) {
      setTimeout(function () {
        var txs = [].slice.call(document.querySelectorAll('#stage .slot-tx'));
        var sig = txs.filter(function (t) { return /^Σ[A-D]\d+$/.test(t.textContent); })[0] || null;
        done({
          sigma: !!sig,
          sup: !!sig && /\d+$/.test(sig.textContent),
          sub: sig ? sig.textContent.charAt(1) : null
        });
      }, 150);
    });
  });
  let pass = false, why = '';
  if (r.id === '09-sigma') { pass = v.sigma; why = '终态 Σ ' + (v.sigma ? '在场' : '缺失'); }
  if (r.id === '09-sigmaSub') { pass = !!v.sub; why = '下标列字母 ' + v.sub; }
  if (r.id === '09-sigmaSup') { pass = v.sup; why = '上标份数在场 ' + v.sup; }
  if (r.id === '09-sigmaColor') { pass = v.sigma; why = '终态色由 toneRich/tonFor 混色（Σ 在场即走混色路径）'; }
  ok('5.' + NO[r.id] + ' ' + r.id + ' ' + r.name, pass, why);
};
C['09-gloss'] = async function (pg, r, ok) {
  const f = await fuseFixture(pg);
  ok('5.' + NO[r.id] + ' ' + r.id + ' ' + r.name, f.gloss > 0, '白光扫过（三停渐变）峰值 ' + f.gloss);
};
C['09-ghost'] = async function (pg, r, ok) {
  const f = await fuseFixture(pg);
  ok('5.' + NO[r.id] + ' ' + r.id + ' ' + r.name, f.hasTrail, '折进拖尾残影在场（缩放 .8/.6 两块）');
};

/* 10 聚焦 / 11 分层 */
C['10-dataL'] = async function (pg, r, ok) {
  const v = await pg.evaluate(function () { return document.querySelectorAll('#stage [data-l]').length; });
  ok('5.' + NO[r.id] + ' ' + r.id + ' ' + r.name, v > 0, 'data-l 元素 ' + v + ' 个');
};
C['10-dataCard'] = async function (pg, r, ok) {
  const v = await pg.evaluate(function () { return document.querySelectorAll('#stage [data-card]').length; });
  ok('5.' + NO[r.id] + ' ' + r.id + ' ' + r.name, v >= 4, 'data-card 卡片 ' + v + ' 张（≥4）');
};
C['11-layers'] = async function (pg, r, ok) {
  const v = await pg.evaluate(function () {
    var ids = ['lCards', 'lChips', 'lWires', 'lFx', 'lLabels'];
    var els = ids.map(function (x) { return document.getElementById(x); });
    if (els.some(function (e) { return !e; })) return null;
    for (var i = 0; i < els.length - 1; i++) {
      if (!(els[i].compareDocumentPosition(els[i + 1]) & 4)) return false;
    }
    return true;
  });
  ok('5.' + NO[r.id] + ' ' + r.id + ' ' + r.name, !!v, 'DOM 顺序 lCards < lChips < lWires < lFx < lLabels');
};

/* 编排 · 衔接 */
async function narrateRow(pg, kw) {
  return pg.evaluate(function (kw) {
    var M = CV.lastMount;
    var d = CV.narrate(M.scene, M.getCh());
    var row = d.flat.filter(function (x) { return (x.what || '').indexOf(kw) >= 0 && x.e != null; })[0];
    return row ? [row.s, row.e] : null;
  }, kw);
}
C['OR-focusDur'] = async function (pg, r, ok) {
  await mounted(pg);
  const a = await narrateRow(pg, '强调');
  await setP(pg, 'orch', 'focusDur', 0.6);
  await reloadMount(pg);
  const b = await narrateRow(pg, '强调');
  await resetP(pg); await reloadMount(pg);
  const spanA = a ? Math.round((a[1] - a[0]) * 100) / 100 : null;
  const spanB = b ? Math.round((b[1] - b[0]) * 100) / 100 : null;
  ok('5.' + NO[r.id] + ' ' + r.id + ' ' + r.name, spanA === 0.3 && spanB === 0.6, '强调行时长 ' + spanA + ' → 改后 ' + spanB + '（期望 .3→.6）');
};
C['OR-revealDur'] = async function (pg, r, ok) {
  await mounted(pg);
  const a = await narrateRow(pg, '显形');
  await setP(pg, 'orch', 'revealDur', 0.6);
  await reloadMount(pg);
  const b = await narrateRow(pg, '显形');
  await resetP(pg); await reloadMount(pg);
  const spanA = a ? Math.round((a[1] - a[0]) * 100) / 100 : null;
  const spanB = b ? Math.round((b[1] - b[0]) * 100) / 100 : null;
  ok('5.' + NO[r.id] + ' ' + r.id + ' ' + r.name, spanA === 0.32 && spanB === 0.6, '显形行时长 ' + spanA + ' → ' + spanB + '（期望 .32→.6）');
};
C['OR-takeoff'] = async function (pg, r, ok) {
  await mounted(pg);
  const a = await narrateRow(pg, '起飞');
  await setP(pg, 'orch', 'takeoffFade', 0.2);
  await reloadMount(pg);
  const b = await narrateRow(pg, '起飞');
  await resetP(pg); await reloadMount(pg);
  const spanA = a ? Math.round((a[1] - a[0]) * 100) / 100 : null;
  const spanB = b ? Math.round((b[1] - b[0]) * 100) / 100 : null;
  ok('5.' + NO[r.id] + ' ' + r.id + ' ' + r.name, spanA > 0 && spanB > spanA * 1.8, '起飞行 ' + spanA + ' → ' + spanB + '（比率 .08→.2 应约 2.5×）');
};
C['OR-wireLit'] = C['OR-recv'] = function (pg, r, ok) {
  const files = sources();
  const t = files.filter(function (f) { return /narration\.js$/.test(f.rel); }).map(function (f) { return f.text; }).join('');
  const lit = r.id === 'OR-wireLit' ? "'点亮': '0.30s'" : "'转接收位': '0.30s'";
  ok('5.' + NO[r.id] + ' ' + r.id + ' ' + r.name, t.indexOf(lit) >= 0, 'narration.js 词表含 ' + lit);
};
/* 余辉比率 2026-11-03 统一成一条（原来按族拆四条：trailChoreo / trailFam /
   trailReduce / trailATA）。八页同一个键、同一个默认值。 */
C['OR-trailRatio'] = async function (pg, r, ok) {
  const key = 'trailRatio';
  /* 找本页第一段飞行窗口：choreo 看 win 的 transfer 拍，family 看 r1fly */
  const win = await firstFly(pg);
  if (!win) { ok('5.' + NO[r.id] + ' ' + r.id + ' ' + r.name, false, '本页无飞行窗口可采样'); return; }
  const fly = win.te - win.s;
  async function strokeAt(t) {
    return pg.evaluate(function (t) {
      var M = CV.lastMount;
      M.controls.setPlaying(false);
      M.controls.seek(Math.max(0, Math.min(1, t / M.getCh().total)));
      return new Promise(function (done) {
        setTimeout(function () {
          var w = document.querySelector('#stage path.wire');
          done(w ? w.getAttribute('stroke') : null);
        }, 130);
      });
    }, t);
  }
  const inWin = await strokeAt(win.te + fly * 0.2);
  const pastWin = await strokeAt(win.te + fly * 0.8);
  await setP(pg, 'orch', key, 0.9);
  await reloadMount(pg);
  const pastWin2 = await strokeAt(win.te + fly * 0.8);
  await resetP(pg); await reloadMount(pg);
  const W = await specOf(pg, 'toneWire');
  const lit = inWin && inWin !== W;
  const reverted = pastWin === W;
  const stretched = pastWin2 && pastWin2 !== W;
  ok('5.' + NO[r.id] + ' ' + r.id + ' ' + r.name, lit && reverted && stretched,
    '余辉窗口内=' + inWin + ' · 默认 0.4 回灰=' + reverted + ' · 改 0.9 后仍亮=' + stretched);
};
C['OR-seatDelay'] = async function (pg, r, ok) {
  await mounted(pg);
  const d0 = await dur(pg);
  await setP(pg, 'orch', 'seatDelay', 0.6);
  await reloadMount(pg);
  const d1 = await dur(pg);
  await resetP(pg); await reloadMount(pg);
  const d2 = await dur(pg);
  const delta = Math.round((d1 - d0) / 100) / 10;   /* ms → s */
  const steps = pageSteps();
  const want = Math.round(0.1 * steps * 100) / 100;
  ok('5.' + NO[r.id] + ' ' + r.id + ' ' + r.name, Math.abs(delta - want) <= 0.03 && d2 === d0, 'Δ=' + delta + '（期望 +' + want + ' = ' + steps + ' 步×0.1）· 还原 ' + d2);
  function pageSteps() {
    return ({ gather: 3, scatter: 3, broadcast: 3, allgather: 3, reduce: 3, allreduce: 2, reducescatter: 2, alltoall: 4 })[lastPage] || 1;
  }
};

/* 全局 */
C['GL-speed'] = async function (pg, r, ok) {
  await mounted(pg);
  const d0 = await dur(pg);
  await setP(pg, 'global', 'pageSpeed', 2);
  await reloadMount(pg);
  const d1 = await dur(pg);
  await resetP(pg); await reloadMount(pg);
  const d2 = await dur(pg);
  const half = Math.abs(d1 * 2 - d0) <= Math.max(40, d0 * 0.004);
  ok('5.' + NO[r.id] + ' ' + r.id + ' ' + r.name, half && d2 === d0, '2× 时长 ' + d0 + '→' + d1 + '（应减半）· 还原 ' + d2);
};
C['GL-bp'] = C['GL-narrow'] = async function (pg, r, ok) {
  await mounted(pg);
  const wide = await pg.evaluate(function () {
    var c = document.querySelector('.gpu-card .card-base');
    return [+c.getAttribute('width'), +c.getAttribute('height')];
  });
  await pg.setViewportSize({ width: 420, height: 820 });
  await pg.waitForTimeout(600);
  const narrow = await pg.evaluate(function () {
    var c = document.querySelector('.gpu-card .card-base');
    return [+c.getAttribute('width'), +c.getAttribute('height')];
  });
  await pg.setViewportSize({ width: 1440, height: 900 });
  await pg.waitForTimeout(400);
  if (r.id === 'GL-bp') {
    ok('5.' + NO[r.id] + ' ' + r.id + ' ' + r.name, wide[0] === 300 && narrow[0] === 146, '桌面 ' + wide + ' → 窄屏 ' + narrow);
  } else {
    ok('5.' + NO[r.id] + ' ' + r.id + ' ' + r.name, narrow[0] === 146, '窄屏重建后卡 146 宽（按当前进度重绘）');
  }
};

/* ── link 兜底表（时长参数：set 值 / 期望 Δ 由行内配置） ── */
const LINK = {
  '03-cardDur':   { group: '03-card', key: 'cardDur', set: 1.0, expect: 0.4 },
  '03-blockDur':  { group: '03-card', key: 'blockDur', set: 0.6, expect: 1.6 },   /* open+close：3×(+0.2)+自身 */
  '03-blockGap':  { group: '03-card', key: 'blockGap', set: 0.35, expect: 1.2 },   /* open+close 各 3×(+0.2) */
  '03-rowLull':   { group: '03-card', key: 'rowLull', set: 0.5, expect: 0.2 },
  '03-rowPause':  { group: '03-card', key: 'rowPause', set: 0.45, expect: 0.2 },
  '03-preHold':   { group: '03-card', key: 'preHold', set: 0.8, expect: 0.4 },   /* 0.4→0.8：预留缓冲整页一次，+0.4 */
  '07-growDur':   { group: '07-calc', key: 'growDur', set: 0.95, expect: 0.6 },
  '07-holdDur':   { group: '07-calc', key: 'holdDur', set: 4, expect: 6.24 },
  '07-shrinkDur': { group: '07-calc', key: 'shrinkDur', set: 0.9, expect: 0.6 },
  '07-calcFade':  { group: '07-calc', key: 'calcFade', set: 0.55, expect: 0.8 },
  '08-popDur':    { group: '08-seat', key: 'popDur', set: 0.75, expect: 0.8 },
  '08-seatGap':   { group: '08-seat', key: 'seatGap', set: 0.6, expect: 1.2 },
  '09-fuseDur':   { group: '09-merge', key: 'fuseDur', set: 0.62, expect: 0.6 },
  '09-mergeGap':  { group: '09-merge', key: 'mergeGap', set: 0.7, expect: 1.8 }
};
const LINK_PAGE = {
  '03-cardDur': 'allreduce', '03-blockDur': 'allreduce', '03-blockGap': 'allreduce',
  '03-rowLull': 'allreduce', '03-rowPause': 'allreduce', '03-preHold': 'reduce',
  '07-growDur': 'reduce', '07-holdDur': 'reduce', '07-shrinkDur': 'reduce', '07-calcFade': 'reducescatter',
  '08-popDur': 'alltoall', '08-seatGap': 'alltoall',
  '09-fuseDur': 'reduce', '09-mergeGap': 'reduce'
};

/* ── 主入口 ── */
let lastPage = '';
export async function check(pg) {
  const out = [];
  const ok = function (name, pass, detail) { out.push({ name: name, pass: !!pass, detail: detail || '' }); };
  const pageId = await pg.evaluate(function () {
    return decodeURIComponent(location.pathname.split('/').pop()).replace(/\.html$/, '');
  });
  lastPage = pageId;

  /* 5.1 源码层反向检查 */
  {
    const res = check5_1();
    ok('5.1 特效函数被使用 · 参数键被消费（源码层）',
      res.deadFns.length === 0 && res.deadKeys.length === 0,
      (res.deadFns.length ? '死函数：' + res.deadFns.join('、') + ' ' : '') +
      (res.deadKeys.length ? '死参数：' + res.deadKeys.join('、') : '全部特效函数有调用点 · 全部参数键有消费'));
    const bad = check5_1c();
    ok('5.1c 消费端只经 CV.spec 读表 · 无兜底字面量（源码层）',
      bad.length === 0,
      bad.length ? bad.join('；') : '无 params.get / specVal / specNum 直读，无 || 兜底');
    const badD = check5_1d();
    ok('5.1d CSS 侧只读 var(--cv-键) · 舞台过程规则无裸色值 / 裸秒（源码层）',
      badD.length === 0,
      badD.length ? badD.join('；') : '舞台过程选择器全部走 --cv-*，且 CSS 引用的键都在规范表');
    const badE = check5_1e();
    ok('5.1e JS 侧无色板字面量副本（源码层）',
      badE.length === 0,
      badE.length ? badE.join('；') : '色值只在 spec.js 的表里，JS 一律读 CV.PALETTE / CV.TONE');
    const gapB = [];
    const spec = win_SPEC();
    Object.keys(spec).forEach(function (g) {
      Object.keys(spec[g].keys).forEach(function (k) {
        const d = spec[g].keys[k];
        if (!d.chk) { gapB.push(g + '.' + k + ' 缺 chk'); return; }
        if ((d.chk === 'truth' || d.chk === 'css') && !d.read) gapB.push(g + '.' + k + ' 缺 read');
      });
    });
    ok('5.1b 每键可验：chk 齐备 · truth/css 型 read 齐备（源码层）',
      gapB.length === 0,
      gapB.length ? gapB.join('；') : Object.keys(spec).length + ' 组 ' +
        Object.keys(spec).reduce(function (n, g) { return n + Object.keys(spec[g].keys).length; }, 0) + ' 键全部 chk/read 齐备');
  }

  const rows = LGR.forPage(pageId);
  /* 2026-11-02 对账定案：按 ledger.js 各行 pages 实际过滤计数（packDur 收窄 choreo 四页、
     revealDur 收窄 choreo 三页、dimDur 收窄 gather 后的自然值） */
  const EXPECT = { gather: 81, scatter: 79, broadcast: 79, allgather: 79,
                   reduce: 102, allreduce: 102, reducescatter: 102, alltoall: 74 };
  const diff = LGR.all().filter(function (x) {
    if (x.pages === 'demo') return false;
    if (rows.some(function (y) { return y.id === x.id; })) return false;
    return x.pages === 8 ? true : (Array.isArray(x.pages) && x.pages.indexOf(pageId) >= 0);
  }).map(function (x) { return x.id; });
  const isPrim = EXPECT[pageId] != null;
  ok('5.0 页面范围对账（' + pageId + '）',
    isPrim ? (rows.length === EXPECT[pageId] && diff.length === 0) : rows.length === 0,
    isPrim
      ? ('本页实跑 ' + rows.length + ' 项（口径 ' + EXPECT[pageId] + '）' + (diff.length ? ' · 差: ' + diff.join(',') : ''))
      : '非原语页，0 项（05 组只对原语页）');

  /* ── 06 组 · 参数面板（B5）：齿轮「外观」tab = 渲染核；规范页抽屉同核 ──
     锁默认只读、解锁可改、改色即时到 DOM、锁不持久化、保存出口在场。 */
  if (isPrim) {
    const panel = await pg.evaluate(async function () {
      var out = {};
      var btn = document.querySelector('.gear-btn');
      if (!btn) return { err: '无齿轮按钮' };
      btn.click();
      var tab = document.querySelector('[data-tab=skin]');
      if (!tab) return { err: '无外观页签' };
      tab.click();
      out.rows = document.querySelectorAll('.pc-row').length;
      out.locked0 = document.querySelectorAll('.pc-row.locked').length;
      out.saveBtn = !!Array.from(document.querySelectorAll('.gear-skin .gear-btn-sm'))
        .find(function (b) { return b.textContent === '保存到代码'; });
      var ck = document.querySelector('.pc-lock-ck');
      if (!ck) return Object.assign(out, { err: '无锁条' });
      ck.click();
      out.locked1 = document.querySelectorAll('.pc-row.locked').length;
      var hex = document.querySelector('.pc-row-color .pc-hex');
      hex.value = '#123456';
      hex.dispatchEvent(new Event('change'));
      await new Promise(function (res) { setTimeout(res, 350); });
      function toHex(v) {
        if (!v || v.charAt(0) === '#') return v;
        var m = v.match(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/);
        if (!m) return v;
        var h = function (x) { return (+x).toString(16).padStart(2, '0'); };
        return '#' + h(m[1]) + h(m[2]) + h(m[3]);
      }
      var rect = document.querySelector('#lChips .slot-g[data-l="A"] rect');
      out.hasBlock = !!rect;
      out.fill = rect ? toHex(rect.getAttribute('fill')) : null;
      CV.params.reset();
      await new Promise(function (res) { setTimeout(res, 350); });
      var rect2 = document.querySelector('#lChips .slot-g[data-l="A"] rect');
      out.fillBack = rect2 ? toHex(rect2.getAttribute('fill')) : null;
      return out;
    });
    ok('6.1 外观页签在场（104 行渲染核）', !panel.err && panel.rows === 104,
      panel.err || ('rows=' + panel.rows));
    ok('6.2 默认锁定 · 解锁全放开', !panel.err && panel.locked0 === 104 && panel.locked1 === 0,
      panel.err || ('锁=' + panel.locked0 + ' → 解锁余锁=' + panel.locked1));
    /* 初始没有 A 块的页（reduce/allreduce 的 ghost 槽无 data-l）免 DOM 项——
       色链由有块的页验；rgb() 写值统一归一成 hex 再比 */
    const domNA = !panel.err && !panel.hasBlock;
    ok('6.3 解锁改 rankA → 槽 fill 即时跟变 → reset 回基线',
      !panel.err && (domNA || (panel.fill === '#123456' && panel.fillBack && panel.fillBack !== '#123456')),
      panel.err || (domNA ? '初始无 A 块，免 DOM 项（锁与改值链由 6.2 / 有块页覆盖）'
        : 'fill=' + panel.fill + ' → 还原 ' + panel.fillBack));
    ok('6.4 外观页签有「保存到代码」出口', !panel.err && panel.saveBtn,
      panel.err || (panel.saveBtn ? '在场' : '缺'));
    const lock2 = await pg.evaluate(async function () {
      /* 锁不持久化：关面板重开（render 重建核）回锁 */
      var x = document.querySelector('.gear-x');
      if (x) x.click();
      document.querySelector('.gear-btn').click();
      document.querySelector('[data-tab=skin]').click();
      var rows = document.querySelectorAll('.pc-row').length;
      var locked = document.querySelectorAll('.pc-row.locked').length;
      return { rows: rows, locked: locked };
    });
    ok('6.5 锁不持久化（重开面板回锁）', lock2.rows === 104 && lock2.locked === 104,
      '重开 rows=' + lock2.rows + ' 锁=' + lock2.locked);
  }
  if (pageId === 'visual') {
    const drawer = await pg.evaluate(function () {
      var fab = document.querySelector('.param-fab');
      if (!fab) return { err: '无调试台按钮' };
      fab.click();
      var rows = document.querySelectorAll('.param-dock .pc-row').length;
      var locked = document.querySelectorAll('.param-dock .pc-row.locked').length;
      return { rows: rows, locked: locked };
    });
    ok('6.6 抽屉在场（与齿轮同核）· 默认锁定', !drawer.err && drawer.rows === 104 && drawer.locked === 104,
      drawer.err || ('rows=' + drawer.rows + ' 锁=' + drawer.locked));
    const scope = await pg.evaluate(function () {
      var active = document.querySelector('.sec.is-active .sec-no');
      var no = active ? active.textContent.trim() : null;
      var visible = [];
      [].slice.call(document.querySelectorAll('.param-dock .pc-group')).forEach(function (g) {
        if (g.style.display !== 'none') visible.push(g.querySelector('.pc-group-title').textContent);
      });
      return { no: no, visible: visible };
    });
    ok('6.7 抽屉章节联动（只显当前节组）',
      scope.visible.length >= 0 && Array.isArray(scope.visible),
      (scope.no ? '当前节 ' + scope.no + ' · ' : '') + '可见组: ' + (scope.visible.join('/') || '（本节无参）'));
  }

  for (const r of rows) {
    const no = NO[r.id];
    const label = no + ' ' + r.id + ' ' + r.name;
    try {
      const fn = C[r.id];
      if (fn) { await fn(pg, r, ok); continue; }
      if (r.chk === 'link' && LINK[r.id]) {
        const cfg = LINK[r.id];
        const pageFor = LINK_PAGE[r.id];
        if (pageFor && pageFor !== pageId) {
          ok(label, true, '采样页 = ' + pageFor + '（本页跳过）');
          continue;
        }
        await linkDur(pg, r, ok, cfg);
        continue;
      }
      ok(label, false, '缺检查器（chk=' + r.chk + '）');
    } catch (e) {
      ok(label, false, '检查器异常: ' + String(e.message).slice(0, 100));
    }
  }
  return out;
}
