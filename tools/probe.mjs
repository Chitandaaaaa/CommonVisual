#!/usr/bin/env node
/* ============================================================
   CommonVisual · 几何探针（纯求值，不出图）
   ------------------------------------------------------------
   一次 Chrome 启动，对单个页面跑若干 "scrub:JS表达式"：
     node tools/probe.mjs reducescatter 0:"CV.lastMount.S.cards[0].base.getAttribute('height')" 1000:"..."
   表达式里可直接用：CV.lastMount（api）、CV.lastMount.S（运行时状态）、document。
   返回 JSON 字符串。报错会回显 PROBLEMS（控制台 error / pageerror）。
   ============================================================ */
import { chromium } from '/Users/lxm/.workbuddy/binaries/node/workspace/node_modules/playwright-core/index.mjs';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const [rawPage, ...rest] = process.argv.slice(2);
const norm = (p) => (p.includes('.') ? p : p + '.html');
const pageFile = norm(rawPage || '');
if (!pageFile) { console.error('用法: node tools/probe.mjs <page.html> <scrub:expr> [...]'); process.exit(2); }

const PORT = 9200 + Math.floor(Math.random() * 90);
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css' };
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

const browser = await chromium.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  args: ['--no-proxy-server', '--force-device-scale-factor=1']
});
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
const pg = await ctx.newPage();
const errs = [];
pg.on('pageerror', e => errs.push('PAGEERROR ' + e.message));
pg.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
await pg.goto(`http://127.0.0.1:${PORT}/${pageFile}`, { waitUntil: 'load' });
// 等挂载完成（CV.lastMount 是异步设置的），避免取到 undefined
await pg.waitForFunction(() => window.CV && window.CV.lastMount && window.CV.lastMount.controls, null, { timeout: 8000 }).catch(() => {});
await pg.waitForTimeout(150);

for (const arg of rest) {
  const i = arg.indexOf(':');
  const v = Number(arg.slice(0, i));
  const expr = arg.slice(i + 1);
  const out = await pg.evaluate(async ([vv, ex]) => {
    const api = window.CV && window.CV.lastMount;
    api.controls.setPlaying(false);
    api.controls.seek(vv / 1000);
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    try { return JSON.stringify(new Function('return (' + ex + ')')()); }
    catch (e) { return 'EVAL ERROR ' + e.message; }
  }, [v, expr]);
  console.log(v, out);
}
if (errs.length) console.log('PROBLEMS:', errs.slice(0, 6));
await browser.close();
server.close();
