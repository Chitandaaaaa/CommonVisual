/* CommonVisual · reducescatter 页面探针（verify.mjs 自动加载）
   ------------------------------------------------------------
   约定：export async function check(pg) -> [{ name, pass, detail }]
   pg 是 Playwright 的 page，内部用 window.CV.lastMount 取控件与状态。
   只断言「结构上一定成立」的事，避免盯像素；像素交给截图。

   真值探测（2026-10-30，1440×900）：
     scrub 0   : 16 个 .slot-tx（每卡顶排 4 个），card0 顶排 = A B C D；.calc-wrap 全隐
     scrub 480 : 4 个 .calc-wrap 全部可见（合并段：计算框亮）
     scrub 1000: 4 个 .calc-wrap 全部隐藏（收窄：计算框淡出）
   */
const op = `(${'(x)=>+(x.getAttribute("opacity")||x.style.opacity||0)'})`;

async function seek(pg, v) {
  await pg.evaluate((vv) => { const a = window.CV.lastMount; a.controls.setPlaying(false); a.controls.seek(vv / 1000); }, v);
  await pg.waitForTimeout(250);
}

export async function check(pg) {
  const out = [];
  const ok = (name, cond, detail) => out.push({ name, pass: !!cond, detail: detail || '' });

  // 1) 挂载 + 4 张卡（S.cards 是按 rank 存的对象，不是数组）
  const mount = await pg.evaluate(() => {
    const a = window.CV && window.CV.lastMount;
    return a ? { cards: Object.keys(a.S.cards).length } : null;
  });
  ok('mount:4 cards', mount && mount.cards === 4, mount ? `cards=${mount.cards}` : 'no mount');

  // 2) 初始态：32 个标签（每卡顶排 4 + 接收排 4），card0 顶排 = A B C D
  await seek(pg, 0);
  const init = await pg.evaluate(() => {
    const tx = [...document.querySelectorAll('#lChips .slot-tx')].map(t => t.textContent);
    return { n: tx.length, c0: tx.slice(0, 4) };
  });
  ok('init: 32 slot labels', init.n === 32, `n=${init.n}`);
  ok('init: card0 = A B C D', JSON.stringify(init.c0) === JSON.stringify(['A', 'B', 'C', 'D']), init.c0.join(''));

  // 3) 合并段：计算框亮
  await seek(pg, 480);
  const mid = await pg.evaluate((opSrc) => {
    const op = eval(opSrc);
    const c = [...document.querySelectorAll('.calc-wrap')].map(op);
    return { n: c.length, max: Math.max(0, ...c) };
  }, op);
  ok('merge: calc boxes visible', mid.n === 4 && mid.max > 0.5, `n=${mid.n} max=${mid.max}`);

  // 4) 终态：计算框收起
  await seek(pg, 1000);
  const end = await pg.evaluate((opSrc) => {
    const op = eval(opSrc);
    const c = [...document.querySelectorAll('.calc-wrap')].map(op);
    return { n: c.length, max: Math.max(0, ...c) };
  }, op);
  ok('final: calc boxes hidden', end.n === 4 && end.max < 0.05, `n=${end.n} max=${end.max}`);

  return out;
}
