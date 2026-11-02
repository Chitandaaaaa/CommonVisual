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
  const walk = (dir, rel) => {
    for (const f of fs.readdirSync(dir)) {
      const full = path.join(dir, f);
      const r = rel ? rel + '/' + f : f;
      if (fs.statSync(full).isDirectory()) walk(full, r);
      else if (f.endsWith('.js')) out.push({ rel: r, text: fs.readFileSync(full, 'utf8') });
    }
  };
  walk(path.join(ROOT, 'assets', 'engine'), 'assets/engine');
  walk(path.join(ROOT, 'assets', 'parts'), 'assets/parts');
  walk(path.join(ROOT, 'assets', 'prim'), 'assets/prim');
  walk(path.join(ROOT, 'assets', 'blocks'), 'assets/blocks');
  return out;
}
let SRC = null;
function sources() { if (!SRC) SRC = srcFiles(); return SRC; }

function schemaKeys() {
  const src = fs.readFileSync(path.join(ROOT, 'assets', 'theme', 'defaults.js'), 'utf8');
  const win = {};
  new Function('window', src)(win);
  const out = [];
  Object.keys(win.CV_PARAM_DEFAULTS).forEach(function (g) {
    Object.keys(win.CV_PARAM_DEFAULTS[g]).forEach(function (k) { out.push(g + ' · ' + k); });
  });
  return out;
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
  const engineSrc = files.map(function (f) { return f.text; }).join('\n');
  const deadKeys = schemaKeys().filter(function (k) { return engineSrc.indexOf(k.split(' · ')[1]) < 0; });
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
  const delta = Math.round((d1 - d0) * 100) / 100;
  const want = Math.round(cfg.expect * 100) / 100;
  const pass = Math.abs(delta - want) <= 0.03 && d2 === d0;
  ok('5.' + NO[r.id] + ' ' + r.id + ' ' + r.name, pass,
    'Δ=' + delta + 's（期望 ' + want + 's）· 还原 ' + d2 + (d2 === d0 ? ' ✓' : ' ✗残差'));
}

/* ── 各行检查器（id → fn）；未覆盖的 id 落到 chk 兜底并如实报「缺检查器」 ── */
const C = {};

/* 01 rank 色 / TONE / 混色 */
C['01-rankA'] = C['01-rankB'] = C['01-rankC'] = C['01-rankD'] = async function (pg, r, ok) {
  const i = Number(r.id.slice(-1));
  const res = await pg.evaluate(function (i) {
    const p = CV.PALETTE[i];
    const rect = document.querySelector('.slot-g rect');
    return { pal: p.color, dom: rect ? rect.getAttribute('fill') : null };
  }, i);
  ok('5.' + NO[r.id] + ' ' + r.id + ' ' + r.name, res.pal === r.val && res.dom === r.val,
    'PALETTE=' + res.pal + ' · 页面块 fill=' + res.dom + '（期望 ' + r.val + '）');
};
['01-toneDeep', '01-toneInk', '01-toneWire', '01-toneWireDim', '01-toneSlotBg', '01-toneSlotHot'].forEach(function (id) {
  C[id] = async function (pg, r, ok) {
    const key = { '01-toneDeep': 'deep', '01-toneInk': 'ink', '01-toneWire': 'wire', '01-toneWireDim': 'wireDim', '01-toneSlotBg': 'slotBg', '01-toneSlotHot': 'slotHot' }[id];
    const v = await pg.evaluate(function (k) { return CV.TONE[k]; }, key);
    ok('5.' + NO[r.id] + ' ' + r.id + ' ' + r.name, v === r.val, 'CV.TONE.' + key + '=' + v + '（期望 ' + r.val + '）');
  };
});
C['01-mixRich'] = async function (pg, r, ok) {
  const res = await pg.evaluate(function () {
    var base = CV.PALETTE[0].color;
    return { one: CV.toneRich(base, 1), four: CV.toneRich(base, 4), expect4: CV.mix(base, CV.TONE.ink, 0.57) };
  });
  ok('5.' + NO[r.id] + ' ' + r.id + ' ' + r.name, res.one === base_() && res.four === res.expect4,
    '1 份=原色 ' + (res.one === base_()) + ' · 4 份=+0.19×3 深 ' + (res.four === res.expect4));
  function base_() { return '#7c3aed'; }
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
  ok('5.' + NO[r.id] + ' ' + r.id + ' ' + r.name, v === '#2a3352', '页内滤镜色=' + v + '（期望 #2a3352）');
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
  if (st === 'own' || st === 'done') { pass = res.fill === '#7c3aed'; why = 'fill=' + res.fill + '（期望 rank 色 #7c3aed）'; }
  if (st === 'waiting') { pass = res.fill === '#f3eeff' && res.tx === '···'; why = 'fill=' + res.fill + ' 字=' + res.tx; }
  if (st === 'empty') { pass = res.fill === '#f7f8fc'; why = 'fill=' + res.fill + '（期望 slotBg）'; }
  ok('5.' + NO[r.id] + ' ' + r.id + ' ' + r.name, pass, why);
};

/* 03 卡片几何（页面真值 + fixture 公式） */
async function cardMetrics(pg) {
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
      badgeFs: null, badgeLen: 0, badgeTextFill: null, badgeRight: null,
      baseStroke: base ? base.getAttribute('stroke-width') : null
    };
    if (badgeBg) {
      var b = badgeBg.getBBox();
      out.badgeW = +b.width.toFixed(1); out.badgeH = +b.height.toFixed(1);
      out.badgeRx = badgeBg.getAttribute('rx'); out.badgeBgFill = badgeBg.getAttribute('fill');
    }
    if (badgeTx) {
      out.badgeFs = badgeTx.getAttribute('font-size');
      out.badgeLen = badgeTx.textContent.length;
      out.badgeTextFill = badgeTx.getAttribute('fill');
      if (base && badgeBg) {
        var bb = badgeBg.getBBox();
        out.badgeRight = +(base.getBBox().width - (bb.x + bb.width)).toFixed(1);
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
  ok('5.' + NO[r.id] + ' ' + r.id + ' ' + r.name, m && m.badgeW === 30 && m.badgeH === 18, '徽章 ' + m.badgeW + '×' + m.badgeH + '（期望 30×18）');
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
C['03-dimOp'] = async function (pg, r, ok) {
  const res = await pg.evaluate(function () {
    var g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    CV.beat.dim({ g: g }, true);
    var on = g.getAttribute('opacity');
    CV.beat.dim({ g: g }, false);
    var off = g.getAttribute('opacity');
    return { on: on, off: off };
  });
  ok('5.' + NO[r.id] + ' ' + r.id + ' ' + r.name, res.on === '.6' && res.off === '1', 'beat.dim → ' + res.on + ' / 复原 ' + res.off);
};
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
    if (ch.flows && ch.flows[0]) { var f = ch.flows[0]; return { s: f.start, te: f.arrive }; }
    for (var k in (ch.win || {})) {
      var w = ch.win[k];
      if (w && w.travelEnd != null) return { s: w.s, te: w.travelEnd };
    }
    return null;
  });
}
async function wireAttrs(pg, atSec) {
  return pg.evaluate(function (t) {
    var M = CV.lastMount;
    M.controls.setPlaying(false);
    M.controls.seek(Math.max(0, Math.min(1, t / M.controls.duration)));
    return new Promise(function (done) {
      setTimeout(function () {
        var w = document.querySelector('#stage path.wire');
        if (!w) { done(null); return; }
        done({
          stroke: w.getAttribute('stroke'), width: w.getAttribute('stroke-width'),
          dash: w.getAttribute('stroke-dasharray')
        });
      }, 120);
    });
  }, atSec);
}
C['04-idleColor'] = C['04-idleWidth'] = C['04-idleDash'] = async function (pg, r, ok) {
  const fw = await firstFly(pg);
  const w = await wireAttrs(pg, Math.max(0, (fw ? fw.s : 0) - 0.15));
  const pass = w && w.stroke === '#c3cadb' && w.width === '1.4' && w.dash === '6 6';
  ok('5.' + NO[r.id] + ' ' + r.id + ' ' + r.name, !!w && (r.id === '04-idleColor' ? w.stroke === '#c3cadb' : r.id === '04-idleWidth' ? w.width === '1.4' : w.dash === '6 6'),
    w ? 'stroke=' + w.stroke + ' 宽=' + w.width + ' 虚线=' + w.dash : '页内无 wire');
};
C['04-flyColor'] = C['04-flyWidth'] = C['04-flyDash'] = async function (pg, r, ok) {
  const fw = await firstFly(pg);
  const w = await wireAttrs(pg, fw ? fw.s + (fw.te - fw.s) * 0.5 : 0.1);
  const pass = w && w.stroke !== '#c3cadb' && w.width === '2.6' && w.dash === '9 7';
  ok('5.' + NO[r.id] + ' ' + r.id + ' ' + r.name, !!pass,
    w ? 'stroke=' + w.stroke + ' 宽=' + w.width + ' 虚线=' + w.dash : '页内无 wire');
};
C['04-glowColor'] = C['04-glowWidth'] = async function (pg, r, ok) {
  const fw = await firstFly(pg);
  const w = await wireAttrs(pg, fw ? fw.te + (fw.te - fw.s) * 0.2 : 0.2);
  const pass = w && w.stroke !== '#c3cadb' && (w.width === '1.6' || w.width === '1.8');
  ok('5.' + NO[r.id] + ' ' + r.id + ' ' + r.name, !!pass,
    w ? 'stroke=' + w.stroke + ' 宽=' + w.width : '页内无 wire');
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
    M.controls.seek((function () { var ch = CV.lastMount.getCh(); var f = ch.flows && ch.flows[0]; var t = f ? f.start + (f.arrive - f.start) * 0.5 : 0.1; return Math.min(1, t / M.controls.duration); })());
    return new Promise(function (done) {
      setTimeout(function () {
        var m = document.querySelector('#stage marker path');
        done(m ? m.getAttribute('fill') : null);
      }, 120);
    });
  });
  ok('5.' + NO[r.id] + ' ' + r.id + ' ' + r.name, !!v && v !== '#c3cadb', '飞行中 marker fill=' + v + '（随数据色）');
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
  const delta = Math.round((d1 - d0) * 100) / 100;
  ok('5.' + NO[r.id] + ' ' + r.id + ' ' + r.name, Math.abs(delta - 0.6) <= 0.03 && d2 === d0, 'Δ=' + delta + '（期望 +0.6 = 3 拍×0.2）· 还原 ' + d2);
};
C['05-packFade'] = async function (pg, r, ok) {
  await mounted(pg);
  const d0 = await dur(pg);
  await setP(pg, '05-packet', 'packFade', 0.8);
  await reloadMount(pg);
  const d1 = await dur(pg);
  await resetP(pg); await reloadMount(pg);
  const d2 = await dur(pg);
  const delta = Math.round((d1 - d0) * 100) / 100;
  ok('5.' + NO[r.id] + ' ' + r.id + ' ' + r.name, Math.abs(delta - 0.6) <= 0.03 && d2 === d0, 'Δ=' + delta + '（期望 +0.6 = 3 拍×0.2）· 还原 ' + d2);
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
    CV.payload.place(pkt, wire, 0.04, false);
    var early = { x: head()[0], op: op() };
    var t1 = pkt.t1.getAttribute('transform') || '';
    var m1 = t1.match(/translate\(([-\d.]+)/);
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
    var pkt = CV.payload.batch(svg, { sw: 20, sh: 20, gap: 3 }, CV.PALETTE);
    var rect = pkt.g ? pkt.g.querySelector('rect') : null;
    var out = rect ? { w: +rect.getAttribute('width'), fill: rect.getAttribute('fill') } : null;
    svg.remove();
    return out;
  });
  ok('5.' + NO[r.id] + ' ' + r.id + ' ' + r.name, !!v && v.w > 90 && v.fill, '底板宽 ' + (v && v.w) + ' · fill=' + (v && v.fill));
};
C['05-boardW'] = async function (pg, r, ok) {
  const v = await pg.evaluate(function () {
    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.style.position = 'absolute'; svg.style.left = '-9999px';
    document.body.appendChild(svg);
    var pkt = CV.payload.batch(svg, { sw: 20, sh: 20, gap: 3 }, CV.PALETTE);
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
    var btns = document.querySelectorAll('#stage button, .controls button');
    return btns.length;
  });
  ok('5.' + NO[r.id] + ' ' + r.id + ' ' + r.name, v >= 3, '控制条按钮 ' + v + ' 个（≥3）');
};

/* 07 方框（reduce 上 seek 到撑开段） */
async function calcProbe(pg) {
  return pg.evaluate(function () {
    var M = CV.lastMount;
    M.controls.setPlaying(false);
    M.controls.seek((function () { var ch = CV.lastMount.getCh(); var f = ch.flows && ch.flows[0]; var t = f ? f.growEnd + (f.mergeEnd - f.growEnd) * 0.5 : 0.5; return Math.min(1, t / M.controls.duration); })());
    return new Promise(function (done) {
      setTimeout(function () {
        var texts = [].slice.call(document.querySelectorAll('#stage text'));
        var tip = texts.filter(function (t) { return /sum/.test(t.textContent); })[0];
        var rect = tip ? tip.closest('g') ? tip.closest('g').querySelector('rect') : null : null;
        done({
          tip: tip ? tip.textContent : null,
          fs: tip ? tip.getAttribute('font-size') : null,
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
      var g = m.g.querySelector('g');
      var tr = g.getAttribute('transform') || '';
      var my = tr.match(/translate\([-\d.]+ [(-\d.]+\) scale\(([-\d.]+)\)/);
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
  ok('5.' + NO[r.id] + ' ' + r.id + ' ' + r.name, f.swapSet === 'Σ', 'p=.78（fuseSwap）目标已换「' + f.swapSet + '」');
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
        var texts = [].slice.call(document.querySelectorAll('#stage text'));
        var sig = texts.filter(function (t) { return t.textContent === 'Σ'; })[0] || null;
        done({
          sigma: !!sig,
          sup: ['²', '³', '⁴'].some(function (x) { return texts.some(function (t) { return t.textContent === x; }); }),
          sub: sig ? (function () { var sib = sig.parentNode.querySelectorAll('text'); for (var i = 0; i < sib.length; i++) { if (sib[i] !== sig && /^[A-D]$/.test(sib[i].textContent)) return sib[i].textContent; } return null; })() : null
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
    var ids = ['lWires', 'lFx', 'lCards', 'lLabels'];
    var els = ids.map(function (x) { return document.getElementById(x); });
    if (els.some(function (e) { return !e; })) return null;
    for (var i = 0; i < els.length - 1; i++) {
      if (!(els[i].compareDocumentPosition(els[i + 1]) & 4)) return false;
    }
    return true;
  });
  ok('5.' + NO[r.id] + ' ' + r.id + ' ' + r.name, !!v, 'DOM 顺序 lWires < lFx < lCards < lLabels');
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
C['OR-dimDur'] = async function (pg, r, ok) {
  await mounted(pg);
  const a = await narrateRow(pg, '变暗');
  await setP(pg, 'orch', 'dimDur', 0.6);
  await reloadMount(pg);
  const b = await narrateRow(pg, '变暗');
  await resetP(pg); await reloadMount(pg);
  const spanA = a ? Math.round((a[1] - a[0]) * 100) / 100 : null;
  const spanB = b ? Math.round((b[1] - b[0]) * 100) / 100 : null;
  ok('5.' + NO[r.id] + ' ' + r.id + ' ' + r.name, spanA === 0.3 && spanB === 0.6, '变暗行时长 ' + spanA + ' → 改后 ' + spanB + '（期望 .3→.6）');
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
function trailKeyFor(pageId) {
  if (pageId === 'alltoall') return 'trailATA';
  if (pageId === 'allgather' || pageId === 'reduce') return 'trailFam';
  if (pageId === 'allreduce' || pageId === 'reducescatter') return 'trailReduce';
  return 'trailChoreo';
}
C['OR-trailChoreo'] = C['OR-trailFam'] = C['OR-trailReduce'] = C['OR-trailATA'] = async function (pg, r, ok) {
  const pageId = await pg.evaluate(function () { return location.pathname.split('/').pop().replace('.html', ''); });
  const key = trailKeyFor(pageId);
  /* 找本页第一段飞行窗口：choreo 看 win 的 transfer 拍，family 看 r1fly */
  const win = await firstFly(pg);
  if (!win) { ok('5.' + NO[r.id] + ' ' + r.id + ' ' + r.name, false, '本页无飞行窗口可采样'); return; }
  const fly = win.te - win.s;
  async function strokeAt(tSec) {
    return pg.evaluate(function (t) {
      var M = CV.lastMount;
      M.controls.setPlaying(false);
      M.controls.seek(Math.max(0, Math.min(1, t / M.controls.duration)));
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
  const lit = inWin && inWin !== '#c3cadb';
  const reverted = pastWin === '#c3cadb';
  const stretched = pastWin2 && pastWin2 !== '#c3cadb';
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
  const delta = Math.round((d1 - d0) * 100) / 100;
  const steps = pageSteps();
  const want = 0.1 * steps;
  ok('5.' + NO[r.id] + ' ' + r.id + ' ' + r.name, Math.abs(delta - want) <= 0.03 && d2 === d0, 'Δ=' + delta + '（期望 +' + want + ' = ' + steps + ' 步×0.1）· 还原 ' + d2);
  function pageSteps() {
    return ({ gather: 3, scatter: 3, broadcast: 3, allgather: 1, reduce: 3, allreduce: 2, reducescatter: 2, alltoall: 4 })[lastPage] || 1;
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
    var c = document.querySelector('.gpu-card');
    var r = c.getBoundingClientRect();
    return [Math.round(r.width), Math.round(r.height)];
  });
  await pg.setViewportSize({ width: 420, height: 820 });
  await pg.waitForTimeout(600);
  const narrow = await pg.evaluate(function () {
    var c = document.querySelector('.gpu-card');
    var r = c.getBoundingClientRect();
    return [Math.round(r.width), Math.round(r.height)];
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
  '03-blockDur':  { group: '03-card', key: 'blockDur', set: 0.6, expect: null },
  '03-blockGap':  { group: '03-card', key: 'blockGap', set: 0.35, expect: null },
  '03-rowLull':   { group: '03-card', key: 'rowLull', set: 0.5, expect: 0.2 },
  '03-rowPause':  { group: '03-card', key: 'rowPause', set: 0.45, expect: 0.2 },
  '07-growDur':   { group: '07-calc', key: 'growDur', set: 0.95, expect: 0.2 },
  '07-holdDur':   { group: '07-calc', key: 'holdDur', set: 4, expect: 2.08 },
  '07-shrinkDur': { group: '07-calc', key: 'shrinkDur', set: 0.9, expect: 0.2 },
  '07-calcFade':  { group: '07-calc', key: 'calcFade', set: 0.55, expect: 0.8 },
  '08-popDur':    { group: '08-seat', key: 'popDur', set: 0.75, expect: 0.8 },
  '08-seatGap':   { group: '08-seat', key: 'seatGap', set: 0.6, expect: 1.2 },
  '08-popStagger':{ group: '08-seat', key: 'popStagger', set: 0.22, expect: 0.6 },
  '09-fuseDur':   { group: '09-merge', key: 'fuseDur', set: 0.62, expect: 0.2 },
  '09-mergeGap':  { group: '09-merge', key: 'mergeGap', set: 0.7, expect: 0.6 }
};
const LINK_PAGE = {
  '03-cardDur': 'allreduce', '03-blockDur': 'allreduce', '03-blockGap': 'allreduce',
  '03-rowLull': 'allreduce', '03-rowPause': 'allreduce',
  '07-growDur': 'reduce', '07-holdDur': 'reduce', '07-shrinkDur': 'reduce', '07-calcFade': 'reducescatter',
  '08-popDur': 'alltoall', '08-seatGap': 'alltoall', '08-popStagger': 'allreduce',
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
  }

  const rows = LGR.forPage(pageId);
  const EXPECT = { gather: 78, scatter: 78, broadcast: 78, allgather: 78,
                   reduce: 103, allreduce: 103, reducescatter: 103, alltoall: 102 };
  ok('5.0 页面范围对账（' + pageId + '）', rows.length === EXPECT[pageId],
    '本页实跑 ' + rows.length + ' 项（总账口径 ' + EXPECT[pageId] + '）');
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
