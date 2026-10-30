/* CommonVisual · reducescatter 页探针（v2 契约版；本页旧版探针的移植 + 3.45/3.47）
   ------------------------------------------------------------
   testing.html 3.41–3.47。旧页未挂 getCh：终态与扫描与旧版一致；
   3.45 的「第 1 轮合并结束」刻度用 OLD.reducescatter.afterMerge1=438
   （TOTAL 21.25s，2026-10-30 实测）；v2 挂 getCh 后用 win.merge1 现算。
   全页断言共用同一次扫描（步 30，60→1000），不再逐条 seek。
   真值（2026-10-30 旧页 1440×900）：
     scrub 0   : 32 个 .slot-tx，card0 顶排 A B C D，calc 全隐
     合并段    : calc 会亮（>0.5）；全程任一卡 Σ 块 ≤ 2（无整份 Σ 中间态）
     afterMerge1: card0 被换出的列（2、3）已空，留下列是 Σᴀ²/Σʙ²
     scrub 1000: 4 个 calc 全隐；每卡 1 块 Σᴀ⁴，四个下标 = A B C D
   */
import { seek, scan, commonChecks, OLD } from './_common.mjs';

export async function check(pg) {
  const out = [];
  const ok = (name, cond, detail) => out.push({ name, pass: !!cond, detail: detail || '' });

  const common = await commonChecks(pg, {
    page: 'reducescatter', v2: false, gear: false, chAvail: false,
    edges: [{ letter: null }, { letter: null }, { letter: null }, { letter: null },
      { letter: null }, { letter: null }, { letter: null }, { letter: null }],
    uniform: null,
    keep: () => [0, 1, 2, 3],
    oldFlight: 250                                    /* 第 1 轮飞行中点（旧页实测） */
  });
  out.push(...common.res);

  const byCard = (s, r) => s.slots.filter(x => x.card === r).sort((a, b) => a.y - b.y || a.x - b.x);

  /* 3.41 挂载四张卡 */
  ok('3.41 挂载四张卡', common.t0.cards.length === 4, `cards=${common.t0.cards.length}`);

  /* 3.42 / 3.43 初始态：32 个槽位标签，card0 顶排 A B C D */
  {
    const t0 = common.t0;
    ok('3.42 初始态 32 个槽位标签', t0.slots.length === 32, `n=${t0.slots.length}`);
    const c0 = byCard(t0, 0).filter(x => x.l);
    ok('3.43 card0 顶排 A B C D', c0.length === 4 && c0.map(x => x.l).join() === 'A,B,C,D',
      c0.map(x => x.l).join(','));
  }

  /* 3.44 / 3.45 共用一次扫描 */
  {
    const sweep = [];
    for (let v = 60; v <= 1000; v += 30) {
      await seek(pg, v, 200);
      const s = await scan(pg);
      sweep.push({
        v,
        calc: Math.max(0, ...s.calc, 0),
        sigPerCard: [0, 1, 2, 3].map(r => byCard(s, r).filter(x => x.l === 'Σ').length),
        sig4: s.slots.some(x => /^Σ[A-D]4$/.test(x.t))
      });
    }
    const maxCalc = Math.max(...sweep.map(f => f.calc));
    ok('3.44 中段计算框会亮起', maxCalc > 0.5,
      `max=${maxCalc.toFixed(2)} @${sweep.reduce((a, b) => (b.calc > a.calc ? b : a)).v}`);

    /* 3.45 全程无整份 Σ 中间态：
       ① 任一帧任一卡的 Σ 块 ≤ 2（递归减半是边换段边折算，四列齐 Σ 的
          「先合成整份」中间态不存在）；
       ② 第 1 轮合并结束帧：被换出的列已空，留下列是 2 份 Σᴀ²。 */
    const over = sweep.filter(f => Math.max(...f.sigPerCard) > 2);
    const s = await scan(pg);
    let aEnd;
    if (s.ch && s.ch.win && s.ch.win.merge1) {
      aEnd = Math.round((s.ch.win.merge1.e / s.ch.total) * 1000) - 20;
    } else {
      aEnd = OLD.reducescatter.afterMerge1;
    }
    await seek(pg, aEnd, 350);
    const sE = await scan(pg);
    const top0 = byCard(sE, 0).slice(0, 4);           /* 同卡先按 y 分排：前 4 = 顶排 */
    const swapped = !top0[2].l && !top0[3].l;
    const kept = /^Σ[A]2$/.test(top0[0].t) && /^Σ[B]2$/.test(top0[1].t);
    ok('3.45 全程无整份 Σ 中间态',
      over.length === 0 && swapped && kept,
      `超2块帧=${over.length} @${aEnd}: c0顶排=[${top0.map(x => x.t || '·')}]`);
  }

  /* 3.46 / 3.47 终态 */
  {
    await seek(pg, 1000, 1100);
    const s = await scan(pg);
    ok('3.46 终态计算框全隐',
      s.calc.length === 4 && Math.max(0, ...s.calc) < 0.05,
      `n=${s.calc.length} max=${Math.max(0, ...s.calc).toFixed(3)}`);
    const blocks = s.slots.filter(x => x.l);
    const per = [0, 1, 2, 3].map(r => byCard(s, r).filter(x => x.l));
    const subs = blocks.map(x => /^Σ([A-D])4$/.exec(x.t)).filter(Boolean).map(m => m[1]);
    const distinct = new Set(subs).size === 4;
    ok('3.47 终态每卡一段、合起来是 Σ',
      blocks.length === 4 && per.every(l => l.length === 1) &&
      new Set(blocks.map(x => x.t)).size === 4 && distinct,
      `blocks=[${blocks.map(x => x.t)}] subs=${subs.join('')}`);
  }

  return out;
}
