#!/usr/bin/env node
/* ============================================================
   CommonVisual · 本地开发服务
   ------------------------------------------------------------
   比 `python -m http.server` 多做一件事：接受页面的写盘请求。

   规范页「参数调试台」和原语页「时序」面板里的「保存到代码」，
   会 POST /__cv/save 到这里，直接覆盖
     assets/cv/tokens.js   （规范参数基线）
     assets/cv/pages.js    （每页时序基线）
   —— 不再下载到「下载」文件夹，也不用自己挪文件。

   用法：
     node tools/serve.mjs          # http://127.0.0.1:8000/
     node tools/serve.mjs 8080     # 换端口

   只监听 127.0.0.1，且只允许写上面两个白名单文件。
   ============================================================ */
import http from 'node:http';
import { readFile, writeFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.argv[2] || process.env.PORT || 8000);
const HOST = '127.0.0.1';

/* 白名单：页面只能写这两个基线文件，别的一律 403 */
const WRITABLE = new Set([
  'assets/cv/tokens.js',
  'assets/cv/pages.js',
  'v2/assets/theme/defaults.js',
  'v2/assets/scenes/pages-base.js'
]);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.md': 'text/markdown; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.map': 'application/json; charset=utf-8'
};

function send(res, code, body, headers) {
  res.writeHead(code, Object.assign({ 'Cache-Control': 'no-store' }, headers || {}));
  res.end(body);
}
function json(res, code, obj) {
  send(res, code, JSON.stringify(obj), { 'Content-Type': 'application/json; charset=utf-8' });
}

/* 读请求体，上限 2 MB —— 两个基线文件最大也就几十 KB，超过必然是搞错了 */
function body(req) {
  return new Promise((resolve, reject) => {
    let s = '', n = 0;
    req.on('data', (c) => {
      n += c.length;
      if (n > 2 * 1024 * 1024) { reject(new Error('body too large')); req.destroy(); return; }
      s += c;
    });
    req.on('end', () => resolve(s));
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', 'http://' + HOST);

  /* ── 写盘：页面「保存到代码」唯一入口 ── */
  if (req.method === 'POST' && url.pathname === '/__cv/save') {
    let data;
    try { data = JSON.parse(await body(req)); }
    catch (e) { return json(res, 400, { ok: false, error: '请求体不是合法 JSON' }); }

    const rel = path.normalize(String(data.file || '')).replace(/\\/g, '/');
    if (!WRITABLE.has(rel)) {
      return json(res, 403, { ok: false, error: '不允许写这个文件：' + rel });
    }
    if (typeof data.content !== 'string') {
      return json(res, 400, { ok: false, error: 'content 必须是字符串' });
    }

    const full = path.join(ROOT, rel);
    if (!full.startsWith(ROOT + path.sep)) {
      return json(res, 403, { ok: false, error: '路径越界' });
    }
    try {
      await writeFile(full, data.content, 'utf8');
      const n = Buffer.byteLength(data.content, 'utf8');
      console.log('[save] %s  %d B  %s', rel, n, new Date().toLocaleTimeString());
      return json(res, 200, { ok: true, file: rel, bytes: n });
    } catch (e) {
      console.error('[save] 失败', rel, e.message);
      return json(res, 500, { ok: false, error: e.message });
    }
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return send(res, 405, 'Method Not Allowed', { 'Content-Type': 'text/plain; charset=utf-8' });
  }

  /* ── 静态文件 ── */
  let p;
  try { p = decodeURIComponent(url.pathname); }
  catch (e) { return send(res, 400, 'Bad Request'); }
  if (p.endsWith('/')) p += 'index.html';

  const full = path.join(ROOT, path.normalize(p));
  if (!full.startsWith(ROOT + path.sep)) return send(res, 403, 'Forbidden');

  try {
    const st = await stat(full);
    if (!st.isFile()) throw new Error('not a file');
    const buf = await readFile(full);
    send(res, 200, req.method === 'HEAD' ? '' : buf, {
      'Content-Type': MIME[path.extname(full).toLowerCase()] || 'application/octet-stream',
      'Content-Length': buf.length
    });
  } catch (e) {
    send(res, 404, 'Not Found', { 'Content-Type': 'text/plain; charset=utf-8' });
  }
});

server.listen(PORT, HOST, () => {
  console.log('CommonVisual  http://%s:%d/', HOST, PORT);
  console.log('「保存到代码」会直接写入 assets/cv/tokens.js / pages.js');
});
server.on('error', (e) => {
  if (e.code === 'EADDRINUSE') {
    console.error('端口 %d 被占用了，换一个：node tools/serve.mjs %d', PORT, PORT + 1);
  } else {
    console.error(e.message);
  }
  process.exit(1);
});
