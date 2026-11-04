/* ============================================================
   src/dev/verify.mjs · ⑧验证：无头冲烟（docs/实现/00 §5）
   ------------------------------------------------------------
   同一进程起静态服务 + 无头 Chrome（⑧防冷启动教训）；
   逐页收集报错、等待 __CV_READY、校验步数/行数/总时长，
   播放 1.5s 触发逐帧渲染路径。退出码非 0 即失败。
   浏览器：env CV_CHROME 指定可执行文件；否则 channel:'chrome'，
   再退 playwright 内置 chromium。
   ============================================================ */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const pw = require('playwright-core');

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]) === '/' ? 'index.html' : req.url.split('?')[0]);
  fs.readFile(p, (err, data) => {
    if (err) { res.writeHead(404); res.end('not found'); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream' });
    res.end(data);
  });
});
await new Promise(r => server.listen(8123, '127.0.0.1', r));

let browser;
/* 与 tools/browser.mjs 同一套已验证经验：平台候选路径 → channel 兜底；
   必须 --no-proxy-server（环境有系统代理，localhost 也会被拦） */
const exe = (function () {
  if (process.env.CV_CHROME) return process.env.CV_CHROME;
  const home = process.env.USERPROFILE || process.env.HOME;
  const cands = [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    home && path.join(home, 'AppData', 'Local', 'Google', 'Chrome', 'Application', 'chrome.exe'),
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
    home && path.join(home, 'AppData', 'Local', 'Microsoft', 'Edge', 'Application', 'msedge.exe')
  ].filter(Boolean);
  for (const c of cands) { if (fs.existsSync(c)) return c; }
  return null;
})();
browser = await pw.chromium.launch({
  executablePath: exe || undefined,
  channel: exe ? undefined : 'chrome',
  args: ['--no-proxy-server', '--force-device-scale-factor=1']
});
console.log('browser ok: ' + (exe || 'channel:chrome'));
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await context.newPage();

const PAGES = ['gather', 'scatter', 'broadcast', 'allgather', 'reduce', 'allreduce', 'reducescatter', 'alltoall'];
const results = [];
for (const id of PAGES) {
  const page = await context.newPage();   // 每页新开，前页崩溃不连坐
  const errors = [];
  const onErr = e => errors.push('pageerror: ' + e.message);
  const onConsole = m => { if (m.type() === 'error') errors.push('console: ' + m.text()); };
  page.on('pageerror', onErr);
  page.on('console', onConsole);
  let ok = true, info = {};
  try {
    console.log('· ' + id + ' 加载中…');
    await page.goto(`http://127.0.0.1:8123/${id}.html`, { waitUntil: 'load', timeout: 20000 });
    await page.waitForFunction(() => window.__CV_READY === true, { timeout: 15000 });
    info = await page.evaluate(() => ({
      total: window.__CV.total, steps: window.__CV.steps,
      gearRows: window.__CV.gearRows, rows: window.__CV.rows
    }));
    await page.waitForTimeout(1500);   // 播放 1.5s，触发逐帧渲染路径
    if (!(info.total > 0 && info.steps >= 4 && info.rows > 0)) {
      ok = false; errors.push('断言失败：total/steps/rows 异常 ' + JSON.stringify(info));
    }
  } catch (e) {
    ok = false; errors.push('加载失败: ' + e.message.split('\n')[0]);
  }
  page.off('pageerror', onErr);
  page.off('console', onConsole);
  await page.close();
  results.push({ id, ok, info, errors });
}

console.log('page            ok    steps  gear  rows   total    errors');
let fail = 0;
for (const r of results) {
  if (!r.ok) fail++;
  console.log(
    r.id.padEnd(15) + (r.ok ? 'yes ' : 'NO  ') + '  ' +
    String(r.info.steps ?? '-').padEnd(6) + String(r.info.gearRows ?? '-').padEnd(5) +
    String(r.info.rows ?? '-').padEnd(6) + String(r.info.total != null ? r.info.total.toFixed(2) : '-').padEnd(8) +
    (r.errors.length ? r.errors[0].slice(0, 120) : '')
  );
  r.errors.slice(1).forEach(e => console.log('   · ' + e.slice(0, 150)));
}
console.log(fail === 0 ? '\n全部通过（8 页）' : `\n${fail} 页失败`);
await browser.close();
server.close();
process.exit(fail === 0 ? 0 : 1);
