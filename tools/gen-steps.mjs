#!/usr/bin/env node
/* ============================================================
   CommonVisual · steps.html 手写稿生成器（统一批次 #11①）
   ------------------------------------------------------------
   职责：把 docs/steps.html 4–11 节手写稿的「时间列」与引擎现值对齐，
   手抄退役——引擎改时序后跑一次本工具，稿子跟变。

   做法：
   1. 开 docs/steps.html，取已求值的 PAGES（结构 + 人工文案的宿主）；
   2. 开 8 个原语页，取引擎真值：
      · 解说 = CV.narrate(scene, ch) 的组表（label / s / e / rows）；
      · 齿轮 = ch.rows（组头 noTxt / 顶层行号 no 由 CV.numberGearRows 现算）。
   3. 按「组序 + 组内行序」一一对齐，只改数字：
      · 每步头尾（· X 秒 / span）、每行 [开始, 结束]、p.dur；
      · gear 表的行号（noTxt / no）与时长；行名与「来源」列人工文案
        保留，与引擎行名不同只警告不改。
   4. 组数 / 行数对不上的页标 NEEDS-MANUAL，该页原样保留并报告——
      说明引擎加了/拆了步，需要人工对稿（文案归人，数字归机器）。

   用法：
     node tools/gen-steps.mjs            # 对齐并写回（marker 区内）
     node tools/gen-steps.mjs --check    # 只报告漂移，不写（退出码 1 = 有漂移）

   结构约定：docs/steps.html 的 PAGES 数组夹在 gen-steps:begin / end
   两个 marker 注释之间；块外的 helper（fmt 等）归人工。首次运行会把
   helper 生成的数据物化为字面量，此后 helper 即死代码（可删）。
   ============================================================ */
import http from 'node:http';
import { launchBrowser } from './browser.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const STEPS_FILE = path.join(ROOT, 'docs', 'steps.html');
const PAGES = ['gather', 'scatter', 'broadcast', 'allgather', 'reduce', 'allreduce', 'reducescatter', 'alltoall'];
const CHECK = process.argv.includes('--check');

const BEGIN = '/* ==== gen-steps:begin';
const END = '/* ==== gen-steps:end ==== */';

const server = http.createServer((req, res) => {
  const u = decodeURIComponent((req.url || '/').split('?')[0]);
  const f = path.join(ROOT, u === '/' ? 'index.html' : u);
  fs.readFile(f, (e, b) => {
    if (e) { res.writeHead(404); res.end('nf'); return; }
    res.writeHead(200, { 'Content-Type': { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css' }[path.extname(f)] || 'application/octet-stream' });
    res.end(b);
  });
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const PORT = server.address().port;

const browser = await launchBrowser();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });

async function open(file, waitMount) {
  const pg = await ctx.newPage();
  await pg.goto(`http://127.0.0.1:${PORT}/${file}`, { waitUntil: 'load' });
  if (waitMount) {
    await pg.waitForFunction(() => window.CV && window.CV.lastMount && window.CV.lastMount.getCh,
      null, { timeout: 8000 }).catch(() => {});
    await pg.waitForTimeout(120);
  }
  return pg;
}

const r2 = (v) => Math.round(v * 100) / 100;

/* ── 引擎真值：8 页解说组表 + 齿轮行（展平，带行号语义） ── */
const truth = {};
for (const id of PAGES) {
  const pg = await open(id + '.html', true);
  truth[id] = await pg.evaluate(() => {
    const r2 = (v) => Math.round(v * 100) / 100;
    const M = window.CV.lastMount;
    const ch = M.getCh();
    const d = CV.narrate(M.scene, ch);
    const gear = [];
    (ch.rows || []).forEach(function (r) {
      if (r && r.type === 'group') {
        gear.push({ kind: 'group', noTxt: r.noTxt || '', label: r.label || '' });
        (r.rows || []).forEach(x => gear.push({ kind: 'sub', label: x.label, sec: x.sec }));
      } else if (r) {
        gear.push({ kind: 'row', no: (typeof r.no === 'number' ? r.no : null), label: r.label, sec: r.sec });
      }
    });
    return {
      total: r2(d.total),
      groups: d.groups.map(g => ({
        label: g.label, s: r2(g.s), e: r2(g.e),
        rows: g.rows.map(x => [r2(x[0]), (x[1] === null || x[1] === '' || x[1] === undefined) ? '' : r2(x[1])])
      })),
      gear
    };
  });
  await pg.close();
}

/* ── 现稿：docs/steps.html 已求值的 PAGES ── */
const sp = await open('docs/steps.html', false);
const cur = await sp.evaluate(() => window.PAGES);
await sp.close();
await browser.close();
server.close();

/* ── 对齐：只补数字，文案与结构保留 ── */
let drift = false, manualAny = false;
const report = [];
const patched = cur.map(p => {
  const t = truth[p.id];
  const out = JSON.parse(JSON.stringify(p));
  const probs = [], warns = [];
  if (!t) { probs.push('引擎真值缺失'); }
  else {
    if (Math.abs(p.dur - t.total) > 0.005) { out.dur = t.total; probs.push(`dur ${p.dur} → ${t.total}`); }

    /* 解说组表 */
    if (p.steps.length !== t.groups.length) {
      probs.push(`组数 ${p.steps.length} ≠ 引擎 ${t.groups.length}（NEEDS-MANUAL）`);
    } else {
      out.steps = p.steps.map((st, gi) => {
        const g = t.groups[gi];
        const o = { t: st.t, span: st.span, rows: st.rows.map(r => r.slice()) };
        if (/ · [\d.]+ 秒$/.test(o.t)) {
          const want = ' · ' + r2(g.e - g.s).toFixed(2) + ' 秒';
          if (!o.t.endsWith(want)) { o.t = o.t.replace(/ · [\d.]+ 秒$/, want); probs.push(`step${gi + 1} 时长 → ${want}`); }
        }
        const wantSpan = g.s.toFixed(2) + ' → ' + g.e.toFixed(2);
        if (o.span !== wantSpan) { o.span = wantSpan; probs.push(`step${gi + 1} span → ${wantSpan}`); }
        if (o.t.indexOf(g.label) < 0) warns.push(`step${gi + 1} 组名稿「${o.t}」≠引擎「${g.label}」`);
        if (st.rows.length !== g.rows.length) {
          probs.push(`step${gi + 1} 行数 ${st.rows.length} ≠ 引擎 ${g.rows.length}（NEEDS-MANUAL）`);
          return st;   /* 行数不齐：该步整体保留原样 */
        }
        o.rows = st.rows.map((r, ri) => {
          const row = r.slice();
          if (Math.abs((row[0] || 0) - g.rows[ri][0]) > 0.005) { row[0] = g.rows[ri][0]; probs.push(`step${gi + 1}.${ri + 1} 开始 → ${row[0]}`); }
          const we = g.rows[ri][1], ce = row[1] === '' ? '' : row[1];
          const bad = (we === '') ? (ce !== '') : (ce === '' || Math.abs(ce - we) > 0.005);
          if (bad) { row[1] = we; probs.push(`step${gi + 1}.${ri + 1} 结束 → ${we === '' ? "''" : we}`); }
          return row;
        });
        return o;
      });
    }

    /* gear 表：展平后按序对齐（顶层行有行号，组内行没有） */
    const pat = p.gear.map(a => a[1].indexOf('发送数据') === 0 ? 'group' : (a[0] === '' ? 'sub' : 'row'));
    const engPat = t.gear.map(e => e.kind);
    if (pat.join() !== engPat.join() || pat.length !== engPat.length) {
      probs.push(`gear 结构 稿[${pat}]≠引擎[${engPat}]（NEEDS-MANUAL）`);
    } else {
      out.gear = p.gear.map((a, i) => {
        const e = t.gear[i], row = a.slice();
        if (e.kind === 'group') {
          if (row[0] !== e.noTxt) { row[0] = e.noTxt; probs.push(`gear${i + 1} 组行号 → ${e.noTxt}`); }
          if (row[1] !== e.label) warns.push(`gear${i + 1} 组名稿「${row[1]}」≠引擎「${e.label}」`);
        } else if (e.kind === 'row') {
          const wantNo = String(e.no);
          if (row[0] !== wantNo) { row[0] = wantNo; probs.push(`gear${i + 1} 行号 → ${wantNo}`); }
          if (row[1] !== e.label) warns.push(`gear${i + 1} 行名稿「${row[1]}」≠引擎「${e.label}」`);
          const wantSec = e.sec.toFixed(2) + 's';
          if (row[2] !== wantSec) { row[2] = wantSec; probs.push(`gear${i + 1} 时长 → ${wantSec}`); }
        } else {
          const glyph = (i + 1 >= t.gear.length || t.gear[i + 1].kind !== 'sub') ? '└' : '├';
          const want = glyph + ' ' + e.label;
          if (row[1] !== want) {
            if (row[1].replace(/^[├└] /, '') === e.label) { row[1] = want; probs.push(`gear${i + 1} 树枝线 → ${want}`); }
            else warns.push(`gear${i + 1} 行名稿「${row[1]}」≠引擎「${e.label}」`);
          }
          const wantSec = e.sec.toFixed(2) + 's';
          if (row[2] !== wantSec) { row[2] = wantSec; probs.push(`gear${i + 1} 时长 → ${wantSec}`); }
        }
        return row;
      });
    }
  }
  if (probs.length) { drift = true; if (probs.some(x => x.includes('NEEDS-MANUAL'))) manualAny = true; }
  if (probs.length || warns.length) report.push({ id: p.id, probs, warns });
  return out;
});

/* ── 报告 ── */
for (const r of report) {
  const manual = r.probs.some(x => x.includes('NEEDS-MANUAL'));
  console.log(`[${r.id}]` + (manual ? ' ⚠ NEEDS-MANUAL（该页原样保留）' : ''));
  r.probs.forEach(x => console.log('   漂移 ' + x));
  r.warns.forEach(x => console.log('   警告 ' + x));
}
if (!report.length) console.log('[gen-steps] 8 页全部与引擎现值一致，零漂移');

/* ── 写回 ── */
if (!CHECK) {
  const src = fs.readFileSync(STEPS_FILE, 'utf8');
  const bi = src.indexOf(BEGIN), ei = src.indexOf(END);
  if (bi < 0 || ei < 0 || ei < bi) { console.error('steps.html 缺 gen-steps marker，无法写回'); process.exit(2); }
  fs.writeFileSync(STEPS_FILE,
    src.slice(0, bi) + BEGIN + ' ==== 本块由 tools/gen-steps.mjs 管理：时间列/时长/dur/gear 数字；文案与结构人工维护 ==== */\n'
    + serialize(patched) + '\n' + END + src.slice(ei + END.length));
  console.log('[gen-steps] 已写回 docs/steps.html（marker 区内）' + (manualAny ? '（含 NEEDS-MANUAL 页，其数据未动）' : ''));
}

process.exit(CHECK && drift ? 1 : 0);

/* ── PAGES 序列化（稳定格式；秒值两位小数，瞬时 = ''） ── */
function serialize(pages) {
  const S = JSON.stringify;
  const num = (v) => (typeof v === 'number') ? String(r2(v)) : "''";
  const lines = ['var PAGES = ['];
  pages.forEach((p, pi) => {
    const groups = p.gear.filter(g => g[1].indexOf('发送数据') === 0).length;
    lines.push(`  { id: ${S(p.id)}, cn: ${S(p.cn)}, en: ${S(p.en)}, dir: ${S(p.dir)}, dur: ${p.dur.toFixed(2)},`);
    lines.push(`    board: ${S(p.board)},`);
    lines.push(`    wire: ${S(p.wire)},`);
    lines.push(`    gear: [`);
    p.gear.forEach(g => lines.push(`      [${g.map(x => S(x)).join(', ')}],`));
    lines.push(`    ],`);
    lines.push(`    gearRows: ${p.gear.length - groups},`);
    lines.push(`    steps: [`);
    p.steps.forEach((st, si) => {
      lines.push(`      { t: ${S(st.t)}, span: ${S(st.span)}, rows: [`);
      st.rows.forEach(r => lines.push(`        [${num(r[0])}, ${num(r[1])}, ${S(r[2])}, ${S(r[3])}],`));
      lines.push(`      ]${si < p.steps.length - 1 ? '},' : '}'}`);
    });
    lines.push(`    ]`);
    lines.push(`  }${pi < pages.length - 1 ? ',' : ''}`);
  });
  lines.push('];');
  return lines.join('\n');
}
