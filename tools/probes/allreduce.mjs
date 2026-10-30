/* CommonVisual · allreduce 页探针（v2 契约版，可在旧页自检）
   ------------------------------------------------------------
   testing.html 3.39–3.45（2026-10-31 拆分重排顺延，原 3.34–3.40；
   3.42/3.43 采样锚点紫条续记——时序标准定稿后改 win 现算）。
   旧页未挂 getCh：自检用 OLD.allreduce
   实测刻度（TOTAL 21.52s；第1/2轮飞行中点 225/544；第1轮合并结束
   455；两轮计算框中点 367/688 —— 2026-10-30 实测）。v2 挂 getCh 后
   按字幕锚点（/第 1 轮|第 2 轮/、/相加|合并|折/）现算。
   真值（2026-10-30 旧页）：第1轮飞行中点 4 条在飞线配对 {0-1,2-3}；
   第1轮合并结束每卡上排 4 块全是 Σᴀ²（口径按实现修正，不是「2 块」）；
   终态 16 块全 Σᴀ⁴、无残留原始块。
   */
import { seek, scan, commonChecks, OLD } from './_common.mjs';

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

export async function check(pg) {
  const out = [];
  const ok = (name, cond, detail) => out.push({ name, pass: !!cond, detail: detail || '' });

  const common = await commonChecks(pg, {
    page: 'allreduce', v2: false, gear: false, chAvail: false,
    edges: [{ letter: null }, { letter: null }, { letter: null }, { letter: null },
      { letter: null }, { letter: null }, { letter: null }, { letter: null }],
    uniform: null,                                   /* 在飞边色 = 发端段的混色，逐边现读现比 */
    keep: () => [0, 1, 2, 3],
    oldFlight: OLD.allreduce.r1Fly
  });
  out.push(...common.res);

  const byCard = (s, r) => s.slots.filter(x => x.card === r).sort((a, b) => a.y - b.y || a.x - b.x);

  /* 采样刻度：v2 走字幕锚点，旧页走实测表 */
  async function anchors() {
    const s = await scan(pg);
    if (s.ch) {
      const t = s.ch.t, txt = s.ch.text;
      const roundAt = (re) => {
        for (let k = 0; k < t.length; k++) {
          if (re.test(txt[k])) {
            const b = k + 1 < t.length ? t[k + 1] : 1;
            return Math.round((t[k] + (b - t[k]) * 0.45) * 1000);
          }
        }
        return null;
      };
      const merges = [];
      let after1 = null;
      for (let k = 0; k < t.length && merges.length < 2; k++) {
        if (/相加|合并|折/.test(txt[k])) {
          const b = k + 1 < t.length ? t[k + 1] : 1;
          merges.push(Math.round((t[k] + (b - t[k]) * 0.55) * 1000));
          if (merges.length === 1) after1 = Math.round((b - 0.02) * 1000);
        }
      }
      return { r1: roundAt(/第 1 轮/), r2: roundAt(/第 2 轮/), calcMid: merges, after1 };
    }
    const O = OLD.allreduce;
    return { r1: O.r1Fly, r2: O.r2Fly, calcMid: O.calcMid, after1: O.afterR1Merge };
  }
  const A = await anchors();

  /* 3.39 挂载四张卡 */
  ok('3.39 挂载四张卡', common.t0.cards.length === 4, `cards=${common.t0.cards.length}`);

  /* 3.40 初始态四卡各一整份（allreduce 的起点是整份 ABCD —— 口径已按
     实现修正：testing.html 原写「各 1 块」是 allgather 的起点）*/
  {
    const t0 = common.t0;
    const whole = [0, 1, 2, 3].map(r => byCard(t0, r).filter(x => x.l));
    ok('3.40 初始态四卡各一整份', whole.every(l => l.length === 4) &&
      whole.every(l => l.map(x => x.l).join() === 'A,B,C,D'),
      whole.map(l => l.length + '块').join(','));
  }

  /* 3.41 横向配对先于纵向 */
  {
    const H = ['0-1', '2-3'], V = ['0-2', '1-3'];
    await seek(pg, A.r1, 300);
    const s1 = await scan(pg);
    const got1 = [...new Set(s1.wires.filter(x => x.sw === '2.6').map(x => wirePair(s1, x).join('-')))].sort();
    await seek(pg, A.r2, 300);
    const s2 = await scan(pg);
    const got2 = [...new Set(s2.wires.filter(x => x.sw === '2.6').map(x => wirePair(s2, x).join('-')))].sort();
    ok('3.41 横向配对先于纵向',
      JSON.stringify(got1) === JSON.stringify(H) && JSON.stringify(got2) === JSON.stringify(V),
      `第1轮=[${got1}] 第2轮=[${got2}]`);
  }

  /* 3.42 横向轮后：每卡上排 4 块全是 2 份 Σᴀ²（口径按实现修正）
     〔紫条续记：采样锚点被字幕第 0 段「逐段待相加」误匹配、采到开场帧；
       时序标准定稿后改 win.r0merge 现算〕 */
  {
    await seek(pg, A.after1, 500);
    const s = await scan(pg);
    const rows = [0, 1, 2, 3].map(r => byCard(s, r).filter(x => x.l));
    const ok37 = rows.every(l => l.length === 4 && l.every(x => /^Σ[A-D]2$/.test(x.t)));
    ok('3.42 横向轮后每卡 4 块全 Σᴀ²', ok37,
      rows.map(l => l.length + '块[' + l.map(x => x.t).join('') + ']').join(' '));
  }

  /* 3.43 两轮合并段各出现计算框
     〔紫条续记：同 3.42 的锚点误匹配（两轮中点被算到开场段）；
       时序标准定稿后窗口改用 win 现算〕 */
  {
    let max1 = 0, max2 = 0;
    const mids = A.calcMid;
    if (mids.length >= 2) {
      await seek(pg, mids[0], 300);
      max1 = Math.max(0, ...(await scan(pg)).calc);
      await seek(pg, mids[1], 300);
      max2 = Math.max(0, ...(await scan(pg)).calc);
    }
    ok('3.43 中段出现计算框（两轮）', max1 > 0.5 && max2 > 0.5,
      `轮1=${max1.toFixed(2)} 轮2=${max2.toFixed(2)}`);
  }

  /* 3.44 / 3.45 终态 */
  {
    await seek(pg, 1000, 1100);
    const s = await scan(pg);
    const data = s.slots.filter(x => x.l);
    ok('3.44 终态每卡四块全是 Σᴀ⁴',
      data.length === 16 && [0, 1, 2, 3].every(r =>
        byCard(s, r).filter(x => x.l).length === 4) &&
      data.every(x => /^Σ[A-D]4$/.test(x.t)),
      `合计=${data.length} 样例=${data[0] && data[0].t}`);
    const raw = s.slots.some(x => /^[A-D]$/.test(x.t) || (x.l && /^[A-D]$/.test(x.l)));
    ok('3.45 终态没有残留原始块', !raw, raw ? '仍有 A/B/C/D 块' : '无 A/B/C/D');
  }

  return out;
}
