#!/usr/bin/env node
/* 新旧页对照采样器：同一组刻度上对比两版页面的可见状态。
   用法: node tools/compare.mjs <page>   （对比根页面 与 v2/ 同名页） */
import { chromium } from '/Users/lxm/.workbuddy/binaries/node/workspace/node_modules/playwright-core/index.mjs';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = '/Users/lxm/dev/workspace/github/CommonVisual';
const page = process.argv[2] || 'gather';
const SCRUBS = [0, 120, 250, 380, 500, 630, 760, 880, 1000];
const PORT = 9510 + Math.floor(Math.random() * 60);
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
const server = http.createServer((req, res) => {
  const f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  fs.readFile(f, (e, b) => { if (e) { res.writeHead(404); res.end('nf'); return; } res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'text/plain' }); res.end(b); });
});
await new Promise(r => server.listen(PORT, '127.0.0.1', r));
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: ['--no-proxy-server', '--force-device-scale-factor=1'] });

const SAMPLE = () => {
  const S = window.CV.lastMount.S;
  function slotInfo(g) {
    const rect = g.querySelector('.slot-bg');
    return [
      g.getAttribute('data-l') || '',
      rect.getAttribute('fill') || '',
      Math.round(rect.x.baseVal.value), Math.round(rect.y.baseVal.value),
      g.style.opacity || ''
    ];
  }
  /* 槽位一律从 DOM 读（新旧页内部结构不同，DOM 是共同契约） */
  const chips = [...document.querySelectorAll('#lChips .slot-g')].map(slotInfo)
    .sort((a, b) => (a[3] - b[3]) || (a[2] - b[2]));
  const ghosts = [...document.querySelectorAll('#lFx .ghost-g')].map(g => {
    const o = parseFloat(g.getAttribute('opacity') || '0');
    const tr = (g.getAttribute('transform') || '').replace(/-?[\d.]+/g, m => String(Math.round(parseFloat(m) * 100) / 100));
    return [String(Math.round(o * 1e4) / 1e4), tr];
  }).sort();
  const cards = {};
  Object.keys(S.cards).forEach(k => {
    const c = S.cards[k];
    cards[k] = [
      c.g.getAttribute('opacity'),
      Math.round(c.geo.x * 100) / 100, Math.round(c.geo.y * 100) / 100,
      Math.round(c.geo.w * 10) / 10, Math.round(c.geo.h * 10) / 10,
      c.badgeTx ? c.badgeTx.textContent : ''
    ];
  });
  const pkts = Object.keys(S.pkts).map(k => {
    const o = parseFloat(S.pkts[k].g.getAttribute('opacity') || '0');
    return Math.round(o * 1e5) / 1e5;
  }).sort();
  const wires = Object.keys(S.wires).map(k => {
    const w = S.wires[k];
    return [w.path.getAttribute('stroke'), w.path.getAttribute('opacity')];
  }).sort();
  let calc = null;
  const cw = document.querySelector('.calc-wrap');
  if (cw) calc = cw.style.opacity;
  return {
    cap: document.getElementById('capText').textContent,
    cards, chips, ghosts, pkts, wires, calc
  };
};

async function samplePage(file) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  const pg = await ctx.newPage();
  await pg.goto(`http://127.0.0.1:${PORT}/${file}`, { waitUntil: 'load' });
  await pg.waitForFunction(() => window.CV && window.CV.lastMount && window.CV.lastMount.controls, null, { timeout: 8000 }).catch(() => {});
  await pg.waitForTimeout(200);
  const out = {};
  for (const v of SCRUBS) {
    await pg.evaluate((vv) => { const a = window.CV.lastMount; a.controls.setPlaying(false); a.controls.seek(vv / 1000); }, v);
    await pg.waitForTimeout(60);
    out[v] = await pg.evaluate(SAMPLE);
  }
  await ctx.close();
  return out;
}

const oldS = await samplePage(page + '.html');
const newS = await samplePage('v2/' + page + '.html');

let diffs = 0;
for (const v of SCRUBS) {
  const a = JSON.stringify(oldS[v]);
  const b = JSON.stringify(newS[v]);
  if (a !== b) {
    diffs++;
    const A = JSON.parse(a), B = JSON.parse(b);
    const keys = new Set([...Object.keys(A), ...Object.keys(B)]);
    console.log(`\n== scrub ${v} ==`);
    for (const k of keys) {
      const av = JSON.stringify(A[k]), bv = JSON.stringify(B[k]);
      if (av !== bv) console.log(`  ${k}:\n    old: ${av}\n    new: ${bv}`);
    }
  }
}
console.log(`\n==== ${page}: ${SCRUBS.length} 个刻度，${diffs} 个刻度有差异 ====`);
await browser.close();
server.close();
