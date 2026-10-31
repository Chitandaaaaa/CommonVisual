/* CommonVisual · broadcast 页探针（v2 契约版，可在旧页自检）
   ------------------------------------------------------------
   test-cases.html 3.15–3.21（2026-10-31 拆分重排：旧 3.16 拆为 3.17+3.18，后续顺延）。
   窗口全部由 getCh 现算（旧页 broadcast 已挂）。
   真值（2026-10-30 旧页 1440×900）：
     scrub 0   : 卡0 [A B C D]，其余 12 槽全隐藏；包为 .pkt.batch
     飞行中点  : 接收卡 4 槽全显、全 '···'（#f3eeff）
     scrub 1000: 16 槽全 [A B C D]
   */
import { seek, scan, commonChecks, sc, PAL } from './_common.mjs';

export async function check(pg) {
  const out = [];
  const ok = (name, cond, detail) => out.push({ name, pass: !!cond, detail: detail || '' });

  const common = await commonChecks(pg, {
    page: 'broadcast', v2: false, gear: true, chAvail: true,
    edges: [{ letter: null }, { letter: null }, { letter: null }],
    uniform: PAL[0].color,                       /* 整份流 = 统一源色（rank0 紫），不按目标分色 */
    keep: () => PAL.map(p => p.r)                /* 人人拿整份，聚焦不灰化任何卡 */
  });
  out.push(...common.res);
  const ch = common.ch;
  const T = ch.total;
  const W = ch.win;

  const byCard = (s, r) => s.slots.filter(x => x.card === r).sort((a, b) => a.y - b.y || a.x - b.x);

  /* 3.15 挂载四张卡 */
  ok('3.15 挂载四张卡', common.t0.cards.length === 4, `cards=${common.t0.cards.length}`);

  /* 3.16 初始态只有卡 0 有数据（其余卡 4 格未显形）*/
  {
    const t0 = common.t0;
    const c0 = byCard(t0, 0);
    const hidden = [1, 2, 3].every(r => {
      const list = byCard(t0, r);
      return list.length === 4 && list.every(x => x.op === 0 && !x.l);
    });
    ok('3.16 初始态只有卡 0 有数据',
      c0.length === 4 && c0.map(x => x.l).join() === 'A,B,C,D' && hidden,
      `c0=[${c0.map(x => x.l)}]`);
  }

  /* 3.17 / 3.18 三次广播依次进行 + 整份流以批包飞行
     （2026-10-31 拆自旧 3.16：串行不变式与批包语义各自独立判）*/
  {
    const fls = ['send1', 'send2', 'send3'].map(k => W[k]);
    let maxOv = 0;
    for (let i = 0; i < 200; i++) {
      const t = i / 199 * T;
      let n = 0;
      for (const w of fls) if (t >= w.s && t < w.fadeEnd) n++;
      maxOv = Math.max(maxOv, n);
    }
    const mid = sc((fls[0].s + fls[0].travelEnd) / 2, T);
    await seek(pg, mid, 250);
    const s = await scan(pg);
    const vis = s.pkts.filter(x => x.o > 0.01);
    const batch = vis.every(x => x.batch);
    ok('3.17 三次广播依次进行', maxOv === 1 && vis.length === 1,
      `最大重叠=${maxOv} 可见=${vis.length}`);
    ok('3.18 整份流以批包飞行', batch && s.pkts.length === 3,
      `批包=${batch} 总包=${s.pkts.length}`);
  }

  /* 3.19 接收卡收到前是空槽（可见、全空、不是「无元素」）*/
  {
    const w = W.send1;
    await seek(pg, sc((w.s + w.travelEnd) / 2, T), 300);
    const s = await scan(pg);
    const c1 = byCard(s, 1);
    ok('3.19 接收卡收到前是空槽',
      c1.length === 4 && c1.every(x => x.op === 1 && !x.l && x.t === '···'),
      `c1=[${c1.map(x => x.t || '·')}] op=[${c1.map(x => x.op)}]`);
  }

  /* 3.20 / 3.21 终态 */
  {
    await seek(pg, 1000, 1000);
    const s = await scan(pg);
    const all = [0, 1, 2, 3].map(r => byCard(s, r));
    const same = all.every(list => list.length === 4 && list.map(x => x.l).join() === 'A,B,C,D');
    ok('3.20 终态四卡内容全同', same,
      all.map(list => list.map(x => x.l).join('')).join(' | '));
    ok('3.21 终态发端不被清空', all[0].length === 4 && all[0].every(x => x.l),
      `c0=${all[0].length} 块`);
  }

  return out;
}
