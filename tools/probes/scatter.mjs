/* CommonVisual · scatter 页探针（v2 契约版，可在旧页自检）
   ------------------------------------------------------------
   test-cases.html 3.9–3.14（2026-10-31 拆分重排顺延，原 3.8–3.13）。窗口全部由 getCh 现算（旧页 scatter 已挂）。
   真值（2026-10-30 旧页 1440×900）：scatter 与 gather 同套坐标、
   角色反转 —— 源卡 0 四段逐段腾空，三趟后只剩 A。
   */
import { seek, scan, commonChecks, sc, PAL } from './_common.mjs';

export async function check(pg) {
  const out = [];
  const ok = (name, cond, detail) => out.push({ name, pass: !!cond, detail: detail || '' });

  const common = await commonChecks(pg, {
    page: 'scatter', v2: false, gear: true, chAvail: true,
    edges: [{ letter: 'B' }, { letter: 'C' }, { letter: 'D' }],
    keep: (l) => {
      const hit = PAL.filter(p => p.letter === l)[0];
      const keep = [0];
      if (hit && hit.r !== 0) keep.push(hit.r);
      return keep;
    }
  });
  out.push(...common.res);
  const ch = common.ch;
  const T = ch.total;
  const W = ch.win;

  const byCard = (s, r) => s.slots.filter(x => x.card === r).sort((a, b) => a.y - b.y || a.x - b.x);

  /* 3.9 挂载四张卡 */
  ok('3.9 挂载四张卡', common.t0.cards.length === 4, `cards=${common.t0.cards.length}`);

  /* 3.10 初始态只有卡 0 有数据（接收位就绪前不可见）*/
  {
    const t0 = common.t0;
    const c0 = byCard(t0, 0);
    const rest = [1, 2, 3].map(r => byCard(t0, r)[0]);
    ok('3.10 初始态只有卡 0 有数据',
      c0.length === 4 && c0.map(x => x.l).join() === 'A,B,C,D' &&
      rest.every(x => x && x.op === 0 && !x.l),
      `c0=[${c0.map(x => x.l)}] rest=[${rest.map(x => x && x.op)}]`);
  }

  /* 3.11 同一时刻只有一个包在途 */
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
    ok('3.11 同一时刻只有一个包在途',
      maxOv === 1 && s.pkts.filter(x => x.o > 0.01).length === 1,
      `窗口最大重叠=${maxOv}`);
  }

  /* 3.12 源卡逐段腾空 */
  {
    const w1 = W.send1;
    await seek(pg, sc((w1.s + w1.travelEnd) / 2, T), 300);
    const s1 = await scan(pg);
    const c0a = byCard(s1, 0);
    const col1Gone = !c0a[1].l && c0a[0].l === 'A';
    await seek(pg, sc(w3mid(W, T), T), 300);
    const s3 = await scan(pg);
    const c0b = byCard(s3, 0);
    const onlyA = c0b.filter(x => x.l).length === 1 && c0b[0].l === 'A';
    ok('3.12 源卡逐段腾空', col1Gone && onlyA,
      `send1后=[${c0a.map(x => x.l || '·')}] send3后=[${c0b.map(x => x.l || '·')}]`);
  }

  /* 3.13 / 3.14 终态 */
  {
    await seek(pg, 1000, 1000);
    const s = await scan(pg);
    const data = s.slots.filter(x => x.l);
    const c0 = byCard(s, 0);
    ok('3.13 终态四卡各一段',
      data.length === 4 && [0, 1, 2, 3].every(r => byCard(s, r).filter(x => x.l).length === 1),
      `合计=${data.length}`);
    ok('3.14 终态卡 0 只留 A',
      c0.filter(x => x.l).length === 1 && c0.filter(x => x.l)[0].l === 'A',
      `c0=[${c0.map(x => x.l || '·')}]`);
  }

  return out;
}

/* 第 3 趟飞行中点（秒） */
function w3mid(W, T) {
  const w = W.send3;
  return (w.s + w.travelEnd) / 2;
}
