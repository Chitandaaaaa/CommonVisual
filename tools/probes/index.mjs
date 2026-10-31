/* CommonVisual · index 页探针（v2 契约版，可在旧页自检）
   ------------------------------------------------------------
   test-cases.html 4.1–4.4 + 蓝图 W1–W4。纯 DOM + fetch，不依赖 CV.lastMount。
   口径（2026-10-30 按旧页实测修正）：节点顺序按原语树序
   （broadcast→scatter→gather→allgather→reduce→allreduce→reducescatter→
   alltoall），不与对照表序比 —— 两处顺序本就不同，4.1 已改口径。
   W 真值（2026-10-30 实测，1440×900）：节点 256×64 r14；rank 点 5×5、
   相邻间距 8（点 5 + 间隙 3）；conn-v svg 20×34、conn-h 76×20；8 节点 8 连线。
   */
import { PRIMS, TREE_ORDER } from './_common.mjs';

export async function check(pg) {
  const out = [];
  const ok = (name, cond, detail) => out.push({ name, pass: !!cond, detail: detail || '' });

  const data = await pg.evaluate(() => {
    const q = (s, r) => [...(r || document).querySelectorAll(s)];
    const nodes = q('.node').map(a => ({
      id: a.id, href: a.getAttribute('href'),
      en: q('.node-en', a)[0] && q('.node-en', a)[0].textContent,
      cn: q('.node-cn', a)[0] && q('.node-cn', a)[0].textContent,
      dir: q('.node-dir', a)[0] && q('.node-dir', a)[0].textContent,
      w: a.offsetWidth, h: a.offsetHeight,
      r: getComputedStyle(a).borderTopLeftRadius
    }));
    const n0 = nodes[0] && document.getElementById(nodes[0].id);
    const dots = n0 ? q('.ranks i', n0) : [];
    return {
      nodes,
      conns: q('.conn').map(c => ({
        svg: (() => { const s = c.querySelector('svg'); return s ? [s.getAttribute('width'), s.getAttribute('height')] : null; })(),
        cls: c.className
      })),
      docs: q('.hero-alt a').map(a => a.getAttribute('href')),
      btn: (q('.btn')[0] || { getAttribute: () => null }).getAttribute('href'),
      dot: dots.length >= 2 ? [dots[0].offsetWidth, dots[0].offsetHeight, dots[1].offsetLeft - dots[0].offsetLeft] : null
    };
  });

  /* 4.1 八个入口齐全（中文名与原语一致；树序 = 原语树序，不比对照表序）*/
  {
    const canon = TREE_ORDER.map(k => PRIMS.filter(p => p.key === k)[0]);
    const orderOk = data.nodes.length === 8 &&
      data.nodes.every((n, i) => n.en === canon[i].en && n.cn === canon[i].cn);
    ok('4.1 八个入口齐全', orderOk,
      orderOk ? '树序 = broadcast…alltoall' :
        `got=[${data.nodes.map(n => n.en).join(',')}]`);
  }

  /* 4.2 链接都指向存在的页面 */
  {
    const hrefs = data.nodes.map(n => n.href);
    const nonEmpty = hrefs.every(h => h && h.length > 0);
    const stats = [];
    for (const h of hrefs) {
      stats.push(await pg.evaluate(async (u) => {
        try { return (await fetch(u)).status; } catch (e) { return 0; }
      }, h));
    }
    ok('4.2 链接都指向存在的页面', nonEmpty && stats.every(s => s === 200),
      stats.join(','));
  }

  /* 4.3 树形连线与方向标注 */
  {
    const dirs = {};
    for (const p of PRIMS) dirs[p.en] = p.dir;
    const dirOk = data.nodes.every(n => n.dir === dirs[n.en]);
    ok('4.3 树形连线与方向标注',
      data.conns.length === 8 && dirOk,
      `conn=${data.conns.length} dir错=${data.nodes.filter(n => n.dir !== dirs[n.en]).map(n => n.en).join(',') || '无'}`);
    ok('W4 图规模 8 节点 8 连线', data.nodes.length === 8 && data.conns.length === 8,
      `node=${data.nodes.length} conn=${data.conns.length}`);
  }

  /* 4.4 两个文档入口可达（2026-10-31 hero 收为两条：docs/prepost.html · docs/visual.html）*/
  {
    const links = data.docs.concat(data.btn ? [data.btn] : []);
    const stats = [];
    for (const h of links) {
      stats.push(await pg.evaluate(async (u) => {
        try { return (await fetch(u)).status; } catch (e) { return 0; }
      }, h));
    }
    ok('4.4 两个文档入口可达',
      data.docs.length === 2 && stats.every(s => s === 200),
      `${data.docs.join(' ')} → ${stats.join(',')}`);
  }

  /* W1–W3 几何基线 */
  {
    const n = data.nodes[0];
    ok('W1 节点卡 282×64 rx14', n && n.w === 282 && n.h === 64 && n.r === '14px',
      n ? `${n.w}x${n.h} r=${n.r}` : '无节点');
    ok('W2 rank 点 5×5 间距 3(Δ8)', data.dot && data.dot[0] === 5 && data.dot[1] === 5 && data.dot[2] === 8,
      data.dot ? data.dot.join(',') : '无');
    const vs = data.conns.filter(c => /conn-v/.test(c.cls)).map(c => c.svg.join('x'));
    const hs = data.conns.filter(c => /conn-h/.test(c.cls)).map(c => c.svg.join('x'));
    ok('W3 连线尺寸 竖20×34 横76×20',
      vs.length === 6 && hs.length === 2 && vs.every(x => x === '20x34') && hs.every(x => x === '76x20'),
      `v=[${[...new Set(vs)]}] h=[${[...new Set(hs)]}]`);
  }

  /* 2.17 跨页可达：index → 8 个原语页逐个真跳 → relmap 返回都在 */
  {
    let okAll = true, d14 = [];
    for (const n of data.nodes) {
      const abs = new URL(n.href, pg.url()).href;   /* pg.goto 只吃绝对 URL */
      await pg.goto(abs, { waitUntil: 'load' }).catch(() => {});
      await pg.waitForTimeout(350);
      const rel = await pg.evaluate(() => {
        const a = document.querySelector('.relmap .rel-now');
        return a ? a.getAttribute('href') : null;
      });
      if (!rel || !/(^|\/)index\.html$/.test(rel)) { okAll = false; d14.push(`${n.en}:返回=${rel}`); }
    }
    ok('2.17 跨页可达', okAll, okAll ? '8 页进出都通' : d14.join(' '));
    await pg.goto(new URL('index.html', pg.url()).href, { waitUntil: 'load' }).catch(() => {});
  }

  return out;
}
