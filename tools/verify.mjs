#!/usr/bin/env node
/* ============================================================
   CommonVisual · 一次验证（合并 probe + 最小截图集）
   ------------------------------------------------------------
   把散落在 /tmp 的 cv-shot / cv-probe / cv-smoke 收成一份：
   一次 Chrome 启动，对每个页面依次做：
     1) 控制台 / 页面报错收集（PROBLEMS）
     2) 几何探针（可选：tools/probes/<page>.mjs 的 check()）
     3) 最小截图集（初始 / 飞行中点 / 终态 / 窄屏），存到 --out

   用法：
     node tools/verify.mjs reducescatter
     node tools/verify.mjs reduce allreduce --frames=0,480,1000
     node tools/verify.mjs reducescatter --no-shot        # 只查报错+探针
     node tools/verify.mjs reduce --frames=0@900,500@900,1000@1200

   约定（来自 AGENTS.md）：
     - scrub 是进度条刻度 0..1000；内部除 1000 喂给 controls.seek
     - 终态延时给足（默认 1200ms），避免截到过渡中间态
     - 默认桌面 1440×900，窄屏 420×820
   ============================================================ */
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { launchBrowser } from './browser.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PROBE_DIR = path.join(ROOT, 'tools', 'probes');

// ---- 解析参数 ----
const argv = process.argv.slice(2);
const norm = (p) => (p.includes('.') ? p : p + '.html');
const pages = [];
let frames = ['0', '500', '1000'];
let noShot = false;
let outDir = path.join(os.tmpdir(), 'cv-verify');
let forcePort = 0;
for (const a of argv) {
  if (a.startsWith('--frames=')) frames = a.slice(9).split(',');
  else if (a === '--no-shot') noShot = true;
  else if (a.startsWith('--out=')) outDir = a.slice(6);
  else if (a.startsWith('--port=')) forcePort = Number(a.slice(7));
  else if (!a.startsWith('--')) pages.push(norm(a));
}
if (!pages.length) { console.error('用法: node tools/verify.mjs <page.html> [...] [--frames=0,500,1000] [--no-shot] [--out=DIR]'); process.exit(2); }

const PORT = forcePort || (9100 + Math.floor(Math.random() * 90));
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.md': 'text/markdown' };

const server = http.createServer((req, res) => {
  const u = decodeURIComponent((req.url || '/').split('?')[0]);
  const f = path.join(ROOT, u === '/' ? 'index.html' : u);
  fs.readFile(f, (e, b) => {
    if (e) { res.writeHead(404); res.end('nf'); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' });
    res.end(b);
  });
});
await new Promise(r => server.listen(PORT, '127.0.0.1', r));

const browser = await launchBrowser();

async function loadPage(width, height) {
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 });
  const pg = await ctx.newPage();
  const errs = [];
  pg.on('pageerror', e => errs.push('PAGEERROR ' + e.message));
  pg.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') { const t = m.text(); if (/Failed to load resource/.test(t)) return; errs.push(m.type() + ': ' + t); } });
  return { ctx, pg, errs };
}

async function runProbeModule(page, mod) {
  // mod.check(pg, api) -> [{ name, pass, detail }]
  if (!mod || typeof mod.check !== 'function') return null;
  try { return await mod.check(page); }
  catch (e) { return [{ name: 'probe-throw', pass: false, detail: e.message }]; }
}

async function verifyOne(pageFile) {
  const name = pageFile.split('/').pop().replace('.html', '');
  const { ctx, pg, errs } = await loadPage(1440, 900);
  const url = `http://127.0.0.1:${PORT}/${pageFile}`;
  await pg.goto(url, { waitUntil: 'load' });
  // 等挂载完成（CV.lastMount 是异步设置的）
  await pg.waitForFunction(() => window.CV && window.CV.lastMount && window.CV.lastMount.controls, null, { timeout: 8000 }).catch(() => {});
  await pg.waitForTimeout(150);

  const meta = await pg.evaluate(() => {
    const api = window.CV && window.CV.lastMount;
    return {
      href: location.href,
      title: document.title,
      dur: api ? api.controls.duration : null,
      svg: document.querySelectorAll('svg').length
    };
  });
  console.log(`\n=== ${pageFile} ===  ${meta.href}  「${meta.title}」  dur=${meta.dur} svg=${meta.svg}`);

  // 探针模块（可选）
  let probeResults = null;
  const probePath = path.join(PROBE_DIR, name + '.mjs');
  if (fs.existsSync(probePath)) {
    const mod = await import(pathToFileURL(probePath).href);
    probeResults = await runProbeModule(pg, mod);
    if (probeResults) for (const r of probeResults) console.log(`  probe ${r.pass ? 'PASS' : 'FAIL'}  ${r.name}  ${r.detail || ''}`);
  }

  // 最小截图集
  const shots = [];
  if (!noShot) {
    fs.mkdirSync(outDir, { recursive: true });
    const hasCV = await pg.evaluate(() => !!window.CV);
    if (!hasCV) console.log(`  ⚠ 页面无 CV，疑似停在错误页：${pg.url()} —— 截图照出，但多半是废帧（8813 模式），先查探针的跨页跳转`);
    for (const fr of frames) {
      const [v, d] = fr.split('@').map(Number);
      const delay = (d || (v === 1000 ? 1200 : 900));
      await pg.evaluate((vv) => { const api = window.CV && window.CV.lastMount; if (api) { api.controls.setPlaying(false); api.controls.seek(vv / 1000); } }, v);   /* 静态页无 lastMount：不出图只截图 */
      await pg.waitForTimeout(delay);
      const out = path.join(outDir, `${name}-${v}.png`);
      await pg.screenshot({ path: out });
      shots.push({ v, out, size: fs.statSync(out).size });
      console.log(`  shot  scrub=${v}  -> ${out} (${fs.statSync(out).size}B)`);
    }
    // 窄屏：固定初始态
    await ctx.close();
    const n = await loadPage(420, 820);
    await n.pg.goto(url, { waitUntil: 'load' });
    await n.pg.waitForFunction(() => window.CV && window.CV.lastMount && window.CV.lastMount.controls, null, { timeout: 8000 }).catch(() => {});
    await n.pg.waitForTimeout(150);
    await n.pg.evaluate(() => { const api = window.CV.lastMount; if (api) { api.controls.setPlaying(false); api.controls.seek(0); } });
    await n.pg.waitForTimeout(900);
    const nout = path.join(outDir, `${name}-narrow.png`);
    await n.pg.screenshot({ path: nout });
    shots.push({ v: 'narrow', out: nout, size: fs.statSync(nout).size });
    console.log(`  shot  narrow   -> ${nout} (${fs.statSync(nout).size}B)`);
    await n.ctx.close();

    // 废帧检测：相邻两张字节数完全相同 = 同一画面
    for (let i = 1; i < shots.length; i++) if (shots[i].size === shots[i - 1].size) console.log(`  ⚠ 废帧？ ${shots[i - 1].out} 与 ${shots[i].out} 字节数相同`);
  }

  if (errs.length) console.log(`PROBLEMS(${errs.length}):`, errs.slice(0, 8));
  const probeFail = probeResults ? probeResults.filter(r => !r.pass).length : 0;
  const ok = errs.length === 0 && probeFail === 0;
  console.log(`RESULT: ${ok ? 'OK' : 'ISSUES'}  errors=${errs.length} probeFail=${probeFail}`);
  await ctx.close();
  return { pageFile, ok, errors: errs.length, probeFail };
}

const results = [];
for (const p of pages) results.push(await verifyOne(p));

await browser.close();
server.close();

const bad = results.filter(r => !r.ok);
console.log(`\n==== 汇总：${results.length} 页，通过 ${results.length - bad.length}，有问题 ${bad.length} ====`);
if (bad.length) { for (const r of bad) console.log(`  ✗ ${r.pageFile}  errors=${r.errors} probeFail=${r.probeFail}`); process.exit(1); }
