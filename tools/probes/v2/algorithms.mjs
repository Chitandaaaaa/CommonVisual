/* CommonVisual · algorithms 页探针（v2 契约版，可在旧页自检）
   ------------------------------------------------------------
   testing.html 4.8–4.9 + 蓝图 W7。
   真值（2026-10-30 待自检确认）：表宽 884、表头 11.5px 大写。
   */
import { PRIMS } from './_common.mjs';

export async function check(pg) {
  const out = [];
  const ok = (name, cond, detail) => out.push({ name, pass: !!cond, detail: detail || '' });

  const d = await pg.evaluate(() => {
    const q = (s, r) => [...(r || document).querySelectorAll(s)];
    const mtx = q('.mtx .mtx-row').map(r => ({
      k: q('.mtx-name', r)[0] && q('.mtx-name', r)[0].textContent,
      cells: q('.d', r).length
    }));
    const pick = q('#pick tbody tr').map(tr => tr.querySelector('td b') && tr.querySelector('td b').textContent);
    const tbl = q('#pick table.tbl')[0] || q('table.tbl')[0];
    const th = tbl && tbl.querySelector('th');
    const thcs = th && getComputedStyle(th);
    const cards = q('.algo-card').map(c => ({
      h3: !!c.querySelector('h3'),
      one: (c.querySelector('.one') || { textContent: '' }).textContent.trim().length,
      dd: q('dd', c).filter(x => x.textContent.trim().length > 0).length
    }));
    return {
      mtx, pick, cards,
      tblW: tbl ? tbl.getBoundingClientRect().width : 0,
      thFs: thcs ? thcs.fontSize : '',
      thUp: thcs ? thcs.textTransform : ''
    };
  });

  /* 4.8 原语集合与对照表一致 */
  {
    const canon = PRIMS.map(p => p.en).sort().join();
    const got = [...new Set(d.mtx.map(r => r.k))].sort().join();
    ok('4.8 原语集合与对照表一致', got === canon && d.mtx.length === 8,
      `矩阵=[${d.mtx.map(r => r.k).join(',')}]`);
  }

  /* 4.9 骨架与实现两层不混（每个原语都有矩阵行 + 常用实现行；骨架卡非空）*/
  {
    const canon = PRIMS.map(p => p.en);
    const inMtx = canon.every(k => d.mtx.some(r => r.k === k && r.cells === 6));
    const inPick = canon.every(k => d.pick.indexOf(k) >= 0);
    const cardsOk = d.cards.length === 8 && d.cards.every(c => c.h3 && c.one > 0 && c.dd >= 3);
    ok('4.9 骨架与实现两层不混', inMtx && inPick && cardsOk,
      `矩阵全=${inMtx} 实现全=${inPick} 骨架卡=${d.cards.length}张`);
  }

  /* W7 表格 884 宽 · 表头 11.5 大写 */
  ok('W7 表格 884 宽 · 表头 11.5px',
    Math.abs(d.tblW - 884) <= 1 && d.thFs === '11.5px',
    `w=${d.tblW} fs=${d.thFs} tt=${d.thUp}`);

  return out;
}
