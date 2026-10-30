/* CommonVisual · reduce 页探针（v2 契约版，可在旧页自检）
   ------------------------------------------------------------
   testing.html 3.22–3.29（2026-10-31 拆分重排：旧 3.21→3.23 口径定案「四卡各一整份」、
   旧 3.23 拆为 3.25+3.26、旧 3.25→3.28 口径定案「终态 4 块 ΣAx4」，其余顺延）。
   旧页 reduce 未挂 getCh：自检用 OLD.reduce
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

  /* 3.22 挂载四张卡 */
  ok('3.22 挂载四张卡', common.t0.cards.length === 4, `cards=${common.t0.cards.length}`);

  /* 3.23 初始态四卡各一整份（2026-10-31 口径定案：reduce 每人持全量，
     与 allreduce 旧 3.35 同款；旧页口径「各 1 块」是 allgather 的起点）*/
  {
    const t0 = common.t0;
    const whole = [0, 1, 2, 3].map(r => byCard(t0, r).filter(x => x.l));
    ok('3.23 初始态四卡各一整份', whole.every(l => l.length === 4) &&
      whole.every(l => l.map(x => x.l).join() === 'A,B,C,D'),
      whole.map(l => l.length + '块').join(','));
  }

  /* 3.24 / 3.25 / 3.27 合并段共用一轮采样（旧 3.22/3.23/3.24）*/
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
    ok('3.24 累加器恒 4 格不攒堆', accOk, accD || `采样 ${pts.length} 点均 4 格`);
    ok('3.27 中段出现计算框', calcMax > 0.5, `calc max=${calcMax.toFixed(2)} @${pts.length}点`);

    await seek(pg, firstEnd, 500);
    const sE = await scan(pg);
    const c0 = byCard(sE, 0).filter(x => x.l);
    /* 3.25 每份到达就折进 Σ²（2026-10-31 拆自旧 3.23；只扫带字母的槽，
       v2 常设预留空槽非缺陷）；3.26 源卡同拍清空 */
    const sig2 = c0.length === 4 && c0.every(x => x.l === 'Σ' && /^Σ[A-D]2$/.test(x.t));
    const src1 = byCard(sE, 1).every(x => !x.l);
    ok('3.25 每份到达就折进 Σ²', sig2,
      `c0=[${c0.map(x => x.t || '·')}]`);
    ok('3.26 源卡同拍清空', src1, `src1空=${src1}`);
  }

  /* 3.28 / 3.29 终态 */
  {
    await seek(pg, 1000, 1100);
    const s = await scan(pg);
    const c0 = byCard(s, 0).filter(x => x.l);
    /* 3.28 终态累加器是 Σ（2026-10-31 口径定案：v2 终态 4 块 ΣAx4；只扫带字母的槽）*/
    ok('3.28 终态累加器是 Σ',
      c0.length === 4 && c0.every(x => /^Σ[A-D]4$/.test(x.t)),
      c0.map(x => x.t || '·').join(','));
    const rest = [1, 2, 3].every(r => byCard(s, r).every(x => !x.l));
    ok('3.29 终态源卡清空', rest, '卡1/2/3 无数据块');
  }

  return out;
}
