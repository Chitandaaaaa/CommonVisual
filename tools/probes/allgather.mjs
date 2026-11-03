/* CommonVisual · allgather 页探针（v2 契约版，可在旧页自检）
   ------------------------------------------------------------
   test-cases.html 3.30–3.39（2026-10-31 拆分重排：旧 3.30 补拆清单行 → 3.33+3.34、旧 3.31 拆为 3.35+3.36，后续顺延；
   2026-11-01 补 3.39 同轮齐弹）。
   窗口由 getCh 现算（win 键按时序标准 r1/r2/r3，见 assets/rounds.js 头注释）。
   真值（2026-10-30 旧页 1440×900 两次一致；2026-11-01 齐弹拍板后 pop 段
   缩回单颗，轮长 5.65→4.15、总长 18.45→13.95，下列 scrub 落点复核仍等价）：
     每轮飞行中点：4 条边同时高亮（各带不同字母）、4 个包同飞 ——
     「每轮四条边同时发」是实现的口径，轮与轮严格串行（scrub 140 实测）。
     落位齐弹：r1 seatStart=3.50，四块同刻起弹（scrub 265 实测 .slot-pop=4）。
     scrub 332: 每卡 2 块、徽章 2/4；632: 3 块 3/4；1000: 16 块 4/4。
   */
import { seek, scan, commonChecks, sc, PAL } from './_common.mjs';

export async function check(pg) {
  const out = [];
  const ok = (name, cond, detail) => out.push({ name, pass: !!cond, detail: detail || '' });

  const common = await commonChecks(pg, {
    page: 'allgather', v2: false, gear: true, chAvail: true,
    edges: [{ letter: null }, { letter: null }, { letter: null }, { letter: null }],
    keep: () => PAL.map(p => p.r)
  });
  out.push(...common.res);
  const ch = common.ch;
  const T = ch.total;

  const byCard = (s, r) => s.slots.filter(x => x.card === r).sort((a, b) => a.y - b.y || a.x - b.x);
  const rounds = ['r1', 'r2', 'r3'].map(k => ch.win[k]).filter(Boolean);

  /* 卡片中心（由快照卡框算），用于把连线端点判到卡 */
  function cardCenterOf(s, r) {
    const c = s.cards.filter(x => x.k === r)[0];
    return { x: c.x + c.w / 2, y: c.y + c.h / 2 };
  }
  /* 连线的两个端点连的是哪两张卡：起点/终点取线 d 的首尾坐标，找最近卡边 */
  function wirePair(s, w) {
    const m = /^M\s*(-?[\d.]+)\s*(-?[\d.]+)/.exec(w.d);
    const tail = /(-?[\d.]+)\s+(-?[\d.]+)\s*$/.exec(w.d);
    if (!m || !tail) return null;
    const p1 = { x: +m[1], y: +m[2] }, p2 = { x: +tail[1], y: +tail[2] };
    function nearest(p) {
      let best = null, bd = 1e9;
      for (const c of s.cards) {
        const cx = c.x + c.w / 2, cy = c.y + c.h / 2;
        const dd = (p.x - cx) * (p.x - cx) + (p.y - cy) * (p.y - cy);
        if (dd < bd) { bd = dd; best = c.k; }
      }
      return best;
    }
    return [nearest(p1), nearest(p2)].sort((a, b) => a - b);
  }

  /* 3.30 挂载四张卡 */
  ok('3.30 挂载四张卡', common.t0.cards.length === 4, `cards=${common.t0.cards.length}`);

  /* 3.31 初始态四卡各一段 */
  {
    const t0 = common.t0;
    const one = [0, 1, 2, 3].map(r => byCard(t0, r).filter(x => x.l));
    ok('3.31 初始态四卡各一段', one.every(l => l.length === 1) &&
      one.map(l => l[0].l).join() === 'A,B,C,D',
      one.map(l => l[0] && l[0].l).join(','));
  }

  /* 3.31b 空槽预留前看不见、预留缓冲后显形（2026-11-03 加预留步，与全站同态） */
  {
    const hidden0 = byCard(common.t0, 1).filter(x => !x.l && x.op === 0).length;
    const at = await pg.evaluate(() => {
      const c = window.CV.lastMount.getCh();
      return Math.round((c.win.open.e - 0.05) / c.total * 1000);
    });
    await seek(pg, at, 300);
    const s = await scan(pg);
    const shown = byCard(s, 1).filter(x => !x.l && x.op === 1).length;
    ok('3.31b 空槽预留前看不见、预留后显形', hidden0 === 3 && shown === 3,
      `初始隐藏=${hidden0}/3 · 显形=${shown}/3`);
  }

  /* 3.32 轮次为 3 轮 */
  ok('3.32 轮次为 3 轮', rounds.length === 3, `transfer 窗口=${rounds.length}`);

  /* 3.33 / 3.34 环序 0→1→3→2→0；每轮四边齐动、轮间串行
     （口径已按实现修正：不是「同时只有一条边」，而是「同轮四边齐发」；
       2026-10-31 清单补拆行，原 3.30a/b）*/
  {
    const WANT = [[0, 1], [1, 3], [2, 3], [0, 2]].map(p => p.sort((a, b) => a - b).join('-')).sort();
    let pairsOk = false, seqD = '', serialOk = true, serialD = '';
    for (let q = 0; q < rounds.length; q++) {
      const w = rounds[q];
      await seek(pg, sc((w.s + w.travelEnd) / 2, T), 300);
      const s = await scan(pg);
      const act = s.wires.filter(x => x.sw === '2.6');
      const pairs = act.map(x => wirePair(s, x)).filter(Boolean);
      const got = pairs.map(p => p.join('-')).sort();
      if (q === 0) { pairsOk = JSON.stringify(got) === JSON.stringify(WANT); seqD = got.join(' '); }
      if (act.length !== 4) { serialOk = false; serialD = `轮${q} 高亮 ${act.length} 条`; }
      /* 轮间空档：hold 段中点不该有任何「在飞」的边 */
      await seek(pg, sc(w.travelEnd + (w.seatStart - w.travelEnd) / 2, T), 250);
      const s2 = await scan(pg);
      if (s2.wires.filter(x => x.sw === '2.6').length !== 0) {
        serialOk = false; serialD += ` 轮${q}空档仍有在飞边`;
      }
    }
    ok('3.33 环序 0→1→3→2→0', pairsOk, seqD);
    ok('3.34 每轮四边齐动、轮间串行', serialOk, serialD || '3 轮抽样均 4 条/0 条');
  }

  /* 3.35 / 3.36 块数逐轮递增；徽章同步（2026-10-31 拆自旧 3.31，共用同一采样循环）*/
  {
    let ok35 = true, d35 = '', ok36 = true, d36 = '';
    for (let q = 0; q < rounds.length; q++) {
      const w = rounds[q];
      await seek(pg, sc(w.seatEnd + Math.min(0.4, (w.e - w.seatEnd) / 2), T), 350);
      const s = await scan(pg);
      const want = q + 2;
      const counts = [0, 1, 2, 3].map(r => byCard(s, r).filter(x => x.l).length);
      const badges = s.cards.map(c => c.bt);
      if (!counts.every(n => n === want)) { ok35 = false; d35 = `轮${q}: 块=[${counts}] 期望 ${want}`; }
      if (!badges.every(b => b === want + '/4')) { ok36 = false; d36 = `轮${q}: 徽章=[${badges}] 期望 ${want}/4`; }
      if (!ok35 && !ok36) break;
    }
    ok('3.35 块数逐轮递增', ok35, d35 || '2→3→4');
    ok('3.36 徽章同步', ok36, d36 || '1/4→2/4→3/4→4/4');
  }

  /* 3.37 / 3.38 终态 */
  {
    await seek(pg, 1000, 1000);
    const s = await scan(pg);
    const all = [0, 1, 2, 3].map(r => byCard(s, r));
    ok('3.37 终态四卡各四块',
      all.every(l => l.length === 4) && s.slots.filter(x => x.l).length === 16,
      `合计=${s.slots.filter(x => x.l).length}`);
    ok('3.38 终态四卡内容相同',
      all.every(l => l.map(x => x.l).join() === 'A,B,C,D'),
      all.map(l => l.map(x => x.l).join('')).join(' | '));
  }

  /* 3.39 同轮四块同刻齐弹（2026-11-01 拍板：同飞同弹，弹跳不拉错峰窗口）。
     slot-pop class 跨 seek 不摘，前面用例已污染 → 刷新后干净采样：
     r1 seatStart+0.2s 处四块全部带弹跳 class（错峰口径下此刻只有第 1 块）。 */
  {
    await pg.reload({ waitUntil: 'load' });
    await pg.waitForFunction(() => window.CV && window.CV.lastMount && window.CV.lastMount.controls,
      null, { timeout: 8000 }).catch(() => {});
    const w = rounds[0];
    await seek(pg, sc(w.seatStart + 0.2, T), 300);
    const n = await pg.evaluate(() => document.querySelectorAll('.slot-pop').length);
    ok('3.39 同轮四块同刻齐弹', n === 4, `弹跳中槽=${n} (want 4)`);
  }

  return out;
}
