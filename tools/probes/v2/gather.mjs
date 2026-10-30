/* CommonVisual · gather 页探针（v2 契约版，可在旧页自检）
   ------------------------------------------------------------
   testing.html 3.1–3.8（2026-10-31 拆分重排：旧 3.2 拆为 3.2+3.3，后续顺延）。
   窗口全部由 getCh 现算（旧页 gather 已挂）。
   真值（2026-10-30 旧页 1440×900 两次一致）：
     scrub 0   : 目标卡 4 槽 [A 显形 | 3 隐藏]，源卡 B/C/D 各 1
     scrub 58  : 预留段后目标卡 4 槽全显、只有 3 空
     scrub 144 : send1 飞行中点，card1 opacity .6，B 边着色
     scrub 1000: 目标卡 [A B C D]，源卡保留
   */
import { seek, scan, commonChecks, sc, PAL, LCOLOR } from './_common.mjs';

export async function check(pg) {
  const out = [];
  const ok = (name, cond, detail) => out.push({ name, pass: !!cond, detail: detail || '' });

  const common = await commonChecks(pg, {
    page: 'gather', v2: false, gear: true, chAvail: true,
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

  /* 3.1 挂载四张卡 */
  ok('3.1 挂载四张卡', common.t0.cards.length === 4, `cards=${common.t0.cards.length}`);

  /* 3.2 初始态源卡各一段（2026-10-31 拆自旧 3.2）*/
  {
    const t0 = common.t0;
    const c1 = byCard(t0, 1), c2 = byCard(t0, 2), c3 = byCard(t0, 3);
    ok('3.2 初始态源卡各一段',
      c1.length === 1 && c2.length === 1 && c3.length === 1 &&
      c1[0].l === 'B' && c2[0].l === 'C' && c3[0].l === 'D',
      `c1=${c1[0] && c1[0].l} c2=${c2[0] && c2[0].l} c3=${c3[0] && c3[0].l}`);
  }

  /* 3.3 初始态目标卡已有 A，另 3 格未显形（拆自旧 3.2）*/
  {
    const t0 = common.t0;
    const c0 = byCard(t0, 0);
    ok('3.3 初始态目标卡已有 A',
      c0.length === 4 && c0[0].l === 'A' && c0[0].op === 1 &&
      c0[1].op === 0 && c0[2].op === 0 && c0[3].op === 0 && !c0[1].l && !c0[2].l && !c0[3].l,
      `c0=[${c0.map(s => s.l + (s.op ? '' : '(隐)'))}]`);
  }

  /* 3.4 预留后显形 3 个空槽 */
  {
    const mid = sc((W.pre.s + Math.min(W.pre.e, W.send1.s)) / 2, T);
    await seek(pg, mid, 350);
    const s = await scan(pg);
    const c0 = byCard(s, 0);
    ok('3.4 预留后显形 3 个空槽',
      c0.length === 4 && c0.every(x => x.op === 1) && c0[0].l === 'A' &&
      !c0[1].l && !c0[2].l && !c0[3].l,
      `c0=[${c0.map(x => x.l || '·')}] op=[${c0.map(x => x.op)}]`);
  }

  /* 3.5 同一时刻只有一个包在途：窗口解析 + 三个飞行中点抽样 */
  {
    const fls = ['send1', 'send2', 'send3'].map(k => W[k]);
    let maxOv = 0;
    const pts = [];
    for (let i = 0; i < 200; i++) {
      const t = i / 199 * T;
      let n = 0;
      for (const w of fls) if (t >= w.s && t < w.fadeEnd) n++;
      maxOv = Math.max(maxOv, n);
    }
    for (const w of fls) pts.push(sc((w.s + w.travelEnd) / 2, T));
    let sampled = 0, worst = 0;
    for (const p of pts) {
      await seek(pg, p, 250);
      const s = await scan(pg);
      const vis = s.pkts.filter(x => x.o > 0.01).length;
      worst = Math.max(worst, vis);
      sampled++;
    }
    ok('3.5 同一时刻只有一个包在途', maxOv === 1 && worst === 1,
      `窗口最大重叠=${maxOv} 抽样(${sampled})最大=${worst}`);
  }

  /* 3.6 传递中源卡变暗 0.6 */
  {
    const w = W.send1;
    const midFly = sc((w.s + w.travelEnd) / 2, T);
    await seek(pg, midFly, 300);
    const s1 = await scan(pg);
    const dark = s1.cards.filter(c => c.k === 1)[0].op;
    const after = sc(w.travelEnd + (w.fadeEnd - w.travelEnd) / 2, T);
    await seek(pg, after, 300);
    const s2 = await scan(pg);
    const back = s2.cards.filter(c => c.k === 1)[0].op;
    ok('3.6 传递中源卡变暗 0.6', Math.abs(dark - 0.6) < 0.01 && back === 1,
      `飞行中=${dark} 区间外=${back}`);
  }

  /* 3.7 / 3.8 终态 */
  {
    await seek(pg, 1000, 1000);
    const s = await scan(pg);
    const c0 = byCard(s, 0), c1 = byCard(s, 1), c2 = byCard(s, 2), c3 = byCard(s, 3);
    ok('3.7 终态目标卡集齐四段',
      c0.length === 4 && c0.map(x => x.l).join() === 'A,B,C,D',
      c0.map(x => x.l).join(','));
    ok('3.8 终态源卡保留',
      c1.length === 1 && c1[0].l === 'B' && c2.length === 1 && c2[0].l === 'C' &&
      c3.length === 1 && c3[0].l === 'D',
      `c1=${c1[0] && c1[0].l} c2=${c2[0] && c2[0].l} c3=${c3[0] && c3[0].l}`);
  }

  return out;
}
