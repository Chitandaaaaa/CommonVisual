/* ============================================================
   CommonVisual · 浏览器与 playwright-core 装载（verify/probe 共用）
   ------------------------------------------------------------
   不写死任何一台机器的路径。解析链（命中即停）：
     playwright-core：
       1. 环境变量 CV_PLAYWRIGHT_CORE（指向包目录或 index.mjs 均可）
       2. <仓库>/node_modules/playwright-core   （npm i 之后就有）
       3. `npm root -g` 下的 playwright-core
       4. 遗留路径（原作者机器，保底）
     浏览器可执行文件：
       1. 环境变量 CV_CHROME
       2. 按平台扫 Chrome 常见安装位 → Edge 兜底
       3. 都没有 → 让 playwright 用 channel 自己找（chrome → msedge）
   找不到时打印清晰指引再抛错，不吞掉。
   ============================================================ */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function firstFile(candidates) {
  for (const c of candidates) {
    if (!c) continue;
    try { if (fs.statSync(c).isFile()) return c; } catch { /* 不存在，下一个 */ }
  }
  return null;
}

/* 动态装 playwright-core，返回其命名空间（含 .launch） */
export async function loadChromium() {
  const dirs = [];
  if (process.env.CV_PLAYWRIGHT_CORE) dirs.push(process.env.CV_PLAYWRIGHT_CORE);
  dirs.push(path.join(ROOT, 'node_modules', 'playwright-core'));
  try {
    const gr = execFileSync('npm', ['root', '-g'], { encoding: 'utf8' }).trim();
    if (gr) dirs.push(path.join(gr, 'playwright-core'));
  } catch { /* npm 不在 PATH，跳过 */ }
  dirs.push('/Users/lxm/.workbuddy/binaries/node/workspace/node_modules/playwright-core');

  const files = [];
  for (const d of dirs) {
    files.push(d);
    files.push(path.join(d, 'index.mjs'));
    files.push(path.join(d, 'index.js'));
  }
  const hit = firstFile(files);
  if (!hit) {
    console.error([
      '找不到 playwright-core。任选其一：',
      '  1. 仓库根目录 npm i （推荐，package.json 已带）',
      '  2. 设环境变量 CV_PLAYWRIGHT_CORE 指向已装的 playwright-core 目录',
    ].join('\n'));
    throw new Error('playwright-core 未找到');
  }
  const mod = await import(pathToFileURL(hit).href);
  return mod.chromium || mod.default?.chromium || mod;
}

/* 浏览器可执行文件：环境变量 → 平台候选 → null（交给 channel 兜底） */
export function findBrowserExe() {
  if (process.env.CV_CHROME) return process.env.CV_CHROME;
  const home = os.homedir();
  const byPlatform = process.platform === 'win32' ? [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    path.join(home, 'AppData', 'Local', 'Google', 'Chrome', 'Application', 'chrome.exe'),
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    path.join(home, 'AppData', 'Local', 'Microsoft', 'Edge', 'Application', 'msedge.exe')
  ] : process.platform === 'darwin' ? [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge'
  ] : [
    '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium', '/usr/bin/chromium-browser'
  ];
  return firstFile(byPlatform);
}

/* 统一启动入口：verify.mjs / probe.mjs 都从这里拿 browser */
export async function launchBrowser() {
  const chromium = await loadChromium();
  const args = ['--no-proxy-server', '--force-device-scale-factor=1'];
  const exe = findBrowserExe();
  if (exe) return chromium.launch({ executablePath: exe, args });
  for (const channel of ['chrome', 'msedge']) {
    try { return await chromium.launch({ channel, args }); } catch { /* 下一个 */ }
  }
  try { return await chromium.launch({ args }); } catch { /* 可能自带内核 */ }
  console.error([
    '找不到可用的 Chrome / Edge。任选其一：',
    '  1. 安装 Chrome 或 Edge（常规路径即可被自动找到）',
    '  2. 设环境变量 CV_CHROME 指向浏览器可执行文件',
  ].join('\n'));
  throw new Error('没有可用的浏览器');
}
