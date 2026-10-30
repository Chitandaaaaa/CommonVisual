#!/usr/bin/env node
/* CommonVisual · 架构依赖扫描
   产出「文件 → 文件」的真实依赖边（不是靠人肉记忆）：
     1. HTML → JS/CSS 引用（script src / link href）
     2. JS  → JS 依赖：通过 CV 命名空间成员的定义处与使用处配对
     3. JS  → 全局数据依赖：window.CV_PARAM_DEFAULTS / window.CV_PAGE_DEFAULTS
     4. CSS → CSS：@import + 共享类/变量归属
   用法：node tools/arch.mjs [--json]
*/
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const rel = p => relative(ROOT, p);

function walk(dir, out = []) {
  for (const n of readdirSync(dir)) {
    if (n.startsWith('.') || n === 'node_modules') continue;
    const p = join(dir, n);
    const s = statSync(p);
    if (s.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

const files = walk(ROOT).filter(p => /\.(html|js|css|mjs)$/.test(p) && !p.includes('/tools/'));
const htmls = files.filter(p => p.endsWith('.html'));
const jsFiles = files.filter(p => p.endsWith('.js'));
const cssFiles = files.filter(p => p.endsWith('.css'));
const read = p => readFileSync(p, 'utf8');

/* ---------- 1. 定义归属：CV 成员名 → 文件 ---------- */
const owner = new Map();      // "drawCard" -> assets/cv/kit.js
const defined = new Map();    // file -> Set(names)
for (const f of jsFiles) {
  const src = read(f);
  const names = new Set();
  for (const m of src.matchAll(/\bCV\.([A-Za-z_$][\w$]*)\s*=/g)) names.add(m[1]);
  for (const m of src.matchAll(/\bCV\.([A-Za-z_$][\w$]*)\s*=\s*function/g)) names.add(m[1]);
  defined.set(rel(f), names);
  for (const n of names) if (!owner.has(n)) owner.set(n, rel(f));
}

/* ---------- 2. 使用归属：文件 → 依赖的 CV 成员 ---------- */
const jsEdges = new Map();    // from -> Map(to -> Set(members))
const globals = new Map();    // file -> Set(globalDataNames)
const membersByFile = new Map();

for (const f of jsFiles) {
  const src = read(f).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  const from = rel(f);
  const mine = defined.get(from) || new Set();
  const used = new Set();
  for (const m of src.matchAll(/\bCV\.([A-Za-z_$][\w$]*)/g)) {
    const n = m[1];
    if (mine.has(n)) continue;
    if (!owner.has(n)) continue;
    const to = owner.get(n);
    if (to === from) continue;
    used.add(n);
    if (!jsEdges.has(from)) jsEdges.set(from, new Map());
    const e = jsEdges.get(from);
    if (!e.has(to)) e.set(to, new Set());
    e.get(to).add(n);
  }
  membersByFile.set(from, used);
  const g = new Set();
  for (const m of src.matchAll(/window\.(CV_[A-Z_]+)/g)) g.add(m[1]);
  if (g.size) globals.set(from, g);
}

/* ---------- 3. HTML 引用 ---------- */
const htmlRefs = new Map();
for (const f of htmls) {
  const src = read(f);
  const refs = [];
  for (const m of src.matchAll(/(?:src|href)="(assets\/[^"]+)"/g)) refs.push(m[1]);
  htmlRefs.set(rel(f), refs);
}

/* ---------- 4. CSS 依赖 ---------- */
const cssEdges = new Map();
const cssVars = new Map();    // var name -> Set(defining css files)
for (const f of cssFiles) {
  const src = read(f);
  for (const m of src.matchAll(/@import\s+(?:url\()?["']([^"']+)["']/g)) {
    if (!cssEdges.has(rel(f))) cssEdges.set(rel(f), new Set());
    cssEdges.get(rel(f)).add(m[1]);
  }
}
for (const f of cssFiles) {
  const src = read(f);
  for (const m of src.matchAll(/(--[\w-]+)\s*:/g)) {
    if (!cssVars.has(m[1])) cssVars.set(m[1], new Set());
    cssVars.get(m[1]).add(rel(f));
  }
}
const cssVarUse = new Map();  // file -> Set(vars) NOT defined in itself
const cssVarShared = new Map(); // var -> files defining it (dup detection)
for (const [v, set] of cssVars) if (set.size > 1) cssVarShared.set(v, [...set].sort());
for (const f of cssFiles) {
  const src = read(f);
  const used = new Set();
  for (const m of src.matchAll(/var\((--[\w-]+)/g)) {
    const v = m[1];
    const defs = cssVars.get(v);
    if (!defs || defs.has(rel(f))) continue;   // 本文件自己定义了就不算跨文件
    used.add(v + ' ← ' + [...defs].join(' + '));
  }
  if (used.size) cssVarUse.set(rel(f), used);
}

/* ---------- 输出 ---------- */
const out = {
  owner: Object.fromEntries([...owner].sort()),
  defined: Object.fromEntries([...defined].map(([k, v]) => [k, [...v].sort()])),
  jsEdges: [...jsEdges].map(([from, m]) => ({
    from,
    to: [...m].map(([t, s]) => ({ file: t, members: [...s].sort() }))
  })),
  globals: Object.fromEntries([...globals].map(([k, v]) => [k, [...v]])),
  htmlRefs: Object.fromEntries(htmlRefs),
  cssEdges: Object.fromEntries([...cssEdges].map(([k, v]) => [k, [...v]])),
  cssVarUse: Object.fromEntries([...cssVarUse].map(([k, v]) => [k, [...v].sort()])),
  cssVarShared: Object.fromEntries([...cssVarShared].sort())
};

if (process.argv.includes('--json')) {
  console.log(JSON.stringify(out, null, 2));
} else {
  console.log('## HTML → 资源');
  for (const [h, r] of htmlRefs) console.log(`  ${h}: ${r.join(', ')}`);
  console.log('\n## JS 依赖边（A 使用 B 定义的 CV.*）');
  for (const { from, to } of out.jsEdges) {
    for (const t of to) console.log(`  ${from} → ${t.file}  [${t.members.join(' ')}]`);
  }
  console.log('\n## 全局数据依赖');
  for (const [f, g] of Object.entries(out.globals)) console.log(`  ${f}: ${g.join(', ')}`);
  console.log('\n## CSS → CSS');
  for (const [f, d] of Object.entries(out.cssEdges)) console.log(`  ${f} @import ${d.join(', ')}`);
  console.log('\n## CSS 跨文件变量（本文件未定义、靠别的文件提供）');
  for (const [f, d] of Object.entries(out.cssVarUse)) console.log(`  ${f}: ${d.join(' | ')}`);
  console.log('\n## CSS 同名变量多份定义（改主题色要改几处）');
  for (const [v, d] of Object.entries(out.cssVarShared)) console.log(`  ${v}: ${d.join(' , ')}`);
  console.log('\n## 每个文件的对外 API 数量');
  for (const [f, n] of Object.entries(out.defined)) console.log(`  ${f}: ${n.length}`);
}
