/* CommonVisual · reduce 页探针（v2 契约版，可在旧页自检）
   ------------------------------------------------------------
   testing.html 3.20–3.26。旧页 reduce 未挂 getCh：自检用 OLD.reduce
   实测刻度表（3 段合并中点 316/551/785、merge1 结束 364，TOTAL 24.75s，
   2026-10-30 实测）；v2 挂 getCh 后按字幕锚点（/相加|合并|折/ 的步骤
   窗口）现算采样点，不再读旧表。
   真值（2026-10-30 旧页 1440×900）：merge1 中点 calc=1、目标卡
   Σᴀ²…；merge1 结束 [ΣA2,ΣB2,ΣC2,ΣD2]、源卡清空；终态 ΣAx4。
   */
import { seek, scan, commonChecks, OLD } from './_common.mjs';

export async function check(pg) {
  const out = [];
  const ok = (name, cond, detail) => out.push({ name, pass: !!cond, detail: detail || '' });

  const common = await commonChecks(pg, {
    page: 'reduce', v2: false, gear: false, chAvail: false,
    edges: [{ letter: null }, { letter: null }, { letter: null }],
    uniform: '#7c3aed',
    keep: () => [0, 1, 2, 3],
    oldFlight: 190                                    /* 第 1 趟飞行中点（旧页实测） */
  });
  out.push(...common.res);

  const byCard = (s, r) => s.slots.filter(x => x.card === r).sort((a, b) => a.y - b.y || a.x - b.x);

  /* 采样点：v2 走字幕锚点，旧页走实测表 */
  async function mergePoints() {
    const s = await scan(pg);
    if (s.ch) {
      const t = s.ch.t, txt = s.ch.text;
      const pts = [];
      for (let k = 0; k < t.length; k++) {
        if (!/相加|合并|折/.test(txt[k])) continue;
        const a = t[k], b = k + 1 < t.length ? t[k + 1] : 1;
        for (const f of [0.3, 0.55, 0.8]) {
          pts.push({ sc: Math.round((a + (b - a) * f) * 1000), end: Math.round((b - 0.02) * 1000) });
        }
        if (pts.length === 3) { pts.firstEnd = Math.round((b - 0.02) * 1000); break; }
      }
      return { pts, firstEnd: pts.length ? pts[2].end : 900 };
    }
    const O = OLD.reduce;
    return {
      pts: O.mergeMid.map(x => ({ sc: x, end: x })),
      firstEnd: O.afterMerge1
    };
  }

  /* 3.20 挂载四张卡 */
  ok('3.20 挂载四张卡', common.t0.cards.length === 4, `cards=${common.t0.cards.length}`);

  /* 3.21 初始态四卡各一段 */
  {
    const t0 = common.t0;
    const one = [0, 1, 2, 3].map(r => byCard(t0, r).filter(x => x.l));
    ok('3.21 初始态四卡各一段', one.every(l => l.length === 1) &&
      one.map(l => l[0].l).join() === 'A,B,C,D',
      one.map(l => l[0] && l[0].l).join(','));
  }

  /* 3.22 / 3.23 / 3.24 合并段共用一轮采样 */
  {
    const { pts, firstEnd } = await mergePoints();
    let accOk = true, accD = '', calcMax = 0;
    for (const p of pts) {
      await seek(pg, p.sc, 280);
      const s = await scan(pg);
      const c0data = byCard(s, 0).filter(x => x.l);
      if (c0data.length !== 4) { accOk = false; accD = `@${p.sc} 累加器 ${c0data.length} 块`; }
      calcMax = Math.max(calcMax, ...s.calc);
    }
    ok('3.22 累加器恒 4 块（不攒堆）', accOk, accD || `采样 ${pts.length} 点均 4 块`);
    ok('3.24 中段出现计算框', calcMax > 0.5, `calc max=${calcMax.toFixed(2)} @${pts.length}点`);

    await seek(pg, firstEnd, 500);
    const sE = await scan(pg);
    const c0 = byCard(sE, 0);
    const sig2 = c0.every(x => x.l === 'Σ' && /^Σ[A-D]2$/.test(x.t));
    const src1 = byCard(sE, 1).every(x => !x.l);
    ok('3.23 每份到达就折进 Σ（源卡同拍清空）', sig2 && src1,
      `c0=[${c0.map(x => x.t || '·')}] src1空=${src1}`);
  }

  /* 3.25 / 3.26 终态 */
  {
    await seek(pg, 1000, 1100);
    const s = await scan(pg);
    const c0 = byCard(s, 0);
    ok('3.25 终态累加器是 Σ',
      c0.filter(x => x.l).length === 4 && c0.every(x => /^Σ[A-D]4$/.test(x.t)),
      c0.map(x => x.t || '·').join(','));
    const rest = [1, 2, 3].every(r => byCard(s, r).every(x => !x.l));
    ok('3.26 终态源卡清空', rest, '卡1/2/3 无数据块');
  }

  return out;
}
