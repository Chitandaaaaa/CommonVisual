/* CommonVisual · prepost 页探针（v2 契约版；原 layout 页，2026-10-31 移入 docs/ 并更名 prepost）
   ------------------------------------------------------------
   test-cases.html 4.5–4.7 + 蓝图 W5/W6 + 2.7 的跨页对照半截。
   口径（2026-10-30 按旧页实测修正 4.7）：index 与 prepost 的原语
   「集合与中文名」逐字一致；顺序两处本就不同（index=树序、
   prepost=对照表序），只比集合不比顺序。
   W 真值（2026-10-30 实测待自检确认）：.cell 20×20 r5 字10；.row 358×46 r12。
   */
import { PRIMS } from './_common.mjs';

export async function check(pg) {
  const out = [];
  const ok = (name, cond, detail) => out.push({ name, pass: !!cond, detail: detail || '' });

  const d = await pg.evaluate(() => {
    const q = (s, r) => [...(r || document).querySelectorAll(s)];
    const prims = q('.prim').map(p => ({
      id: p.id,
      sides: q('.side', p).map(sd => q('.row', sd).map(row => ({
        empty: /is-empty/.test(row.className),
        cells: q('.cell', row).map(c => ({
          t: c.textContent,
          hasSub: !!c.querySelector('sub'),
          w: c.offsetWidth, h: c.offsetHeight, r: getComputedStyle(c).borderTopLeftRadius,
          fs: getComputedStyle(c).fontSize
        }))
      })))
    }));
    const row0 = q('.row')[0];
    const rcs = row0 && getComputedStyle(row0);
    return {
      prims,
      rail: q('.rail a').map(a => a.textContent),
      undef: document.body.textContent.indexOf('undefined') >= 0,
      rowSize: row0 ? [row0.offsetWidth, row0.offsetHeight, rcs.borderTopLeftRadius] : null
    };
  });

  /* 4.5 对照表完整（8 行都在；格数随数据形状 1–4 不等，但不允许 0 格或 undefined）*/
  {
    let ok45 = d.prims.length === 8 && !d.undef, d45 = `prim=${d.prims.length} undef=${d.undef}`;
    outer:
    for (const p of d.prims) {
      if (p.sides.length !== 2) { ok45 = false; d45 = `${p.id}: side=${p.sides.length}`; break; }
      for (const side of p.sides) {
        if (side.length !== 4) { ok45 = false; d45 = `${p.id}: row=${side.length}`; break outer; }
        for (const row of side) {
          const want = row.empty ? 1 : 1;
          if (row.cells.length < want) { ok45 = false; d45 = `${p.id}: cells=${row.cells.length}`; break outer; }
          if (row.empty && row.cells.length !== 1) { ok45 = false; d45 = `${p.id}: 空行 ${row.cells.length} 格`; break outer; }
        }
      }
    }
    ok('4.5 对照表完整', ok45, d45);
  }

  /* 4.6 标记写法统一（A / A:0 / - 三种；Σ 不带下标）*/
  {
    let ok46 = true, d46 = '';
    for (const p of d.prims) {
      for (const side of p.sides) {
        for (const row of side) {
          for (const c of row.cells) {
            const base = c.t.replace(/[0-9]+$/, '');
            const valid = c.t === '' || /^[A-D]\d?$/.test(c.t) || base === 'Σ';
            if (!valid || (base === 'Σ' && c.hasSub)) {
              ok46 = false; d46 = `怪写法「${c.t}」sub=${c.hasSub}`; break;
            }
          }
        }
      }
    }
    ok('4.6 标记写法统一', ok46, d46 || 'A / A:0 / - / Σ(无下标)');
  }

  /* 4.7 表头顺序与 index 一致（口径：比集合与中文名，不比顺序）*/
  {
    const railEn = d.rail;
    const selfUrl = pg.url();                     /* 记下自身绝对 URL：跳去 index 后按它回来（相对路径会以 index 为基准解析错） */
    await pg.goto(new URL('../index.html', selfUrl).href, { waitUntil: 'load' }).catch(() => {});
    await pg.waitForTimeout(300);
    const idx = await pg.evaluate(() =>
      [...document.querySelectorAll('.node')].map(a => ({
        en: a.querySelector('.node-en').textContent,
        cn: a.querySelector('.node-cn').textContent
      })));
    await pg.goto(selfUrl, { waitUntil: 'load' }).catch(() => {});
    await pg.waitForTimeout(300);
    const canonEn = PRIMS.map(p => p.en).sort().join();
    const setEq = [...new Set(idx.map(x => x.en))].sort().join() === canonEn &&
      [...new Set(railEn)].sort().join() === canonEn;
    ok('4.7 两处原语集合与中文名一致', setEq && railEn.length === 8 && idx.length === 8,
      `rail=${railEn.length} index=${idx.length}`);
  }

  /* W5 / W6 几何基线 */
  {
    const firstRow = d.prims[0] && d.prims[0].sides[0] && d.prims[0].sides[0][0];
    const cells = firstRow && firstRow.cells[0];
    ok('W5 单元格 28×28 rx7 字11.5', cells && cells.w === 28 && cells.h === 28 &&
      cells.r === '7px' && cells.fs === '11.5px',
      cells ? `${cells.w}x${cells.h} r=${cells.r} fs=${cells.fs}` : '无');
    ok('W6 rank 行 358×46 rx12', d.rowSize && d.rowSize[0] === 358 && d.rowSize[1] === 46 &&
      d.rowSize[2] === '12px', d.rowSize ? d.rowSize.join(',') : '无');
  }

  return out;
}
