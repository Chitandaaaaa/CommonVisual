/* CommonVisual · alltoall 页探针（v2 契约版，可在旧页自检）
   ------------------------------------------------------------
   test-cases.html 3.54–3.60（2026-10-31 拆分重排：旧 3.51 拆为 3.57+3.58，其余顺延）。
   旧页未挂 getCh：自检用 OLD.alltoall 实测刻度
   （TOTAL 14.65s；4 步飞行中点 94/326/558/790；第 0 步收完 270 ——
   2026-10-30 实测）。v2 飞行中点从 rounds 现算（start+fly/2）——
   2026-11-01 包 B 串行律（抵达→淡出→延迟→落位）后字幕段中点会漂进
   延迟相，不能再用；TOTAL 14.70→19.10。
   真值（2026-10-30 旧页 1440×900）：
     scrub 0   : 每卡 8 槽 = 上排 4（本卡字母+片号下标）+ 下排 4 空
     步中点    : 恰 3 个包在飞（发端=其余三卡）；共 12 包
     步 0 收完 : card0 徽章 4/4、其余 0/4；各卡上排第 0 片已清空
     scrub 1000: 上排全空、下排各 4 块（16 块），块内容含片号区分
   槽位行序：同一卡内按 y 排序，前 4 = 上排（待发），后 4 = 下排（已收）。
   */
import { seek, scan, commonChecks, OLD, PAL } from './_common.mjs';

export async function check(pg) {
  const out = [];
  const ok = (name, cond, detail) => out.push({ name, pass: !!cond, detail: detail || '' });

  const common = await commonChecks(pg, {
    page: 'alltoall', v2: false, gear: false, chAvail: false,
    edges: [{ letter: null }, { letter: null }, { letter: null },
      { letter: null }, { letter: null }, { letter: null }],
    noMarkers: true,                                  /* 双向直连边不画箭头 */
    uniform: null,
    idleDash: '8 7', idleSw: '1.4',                   /* 2026-11-03 统一：虚线回规范 8 7，宽度仍走 wireWMuted 1.4 */
    keep: () => [0, 1, 2, 3],
    oldFlight: OLD.alltoall.stepMid[0]
  });
  out.push(...common.res);

  const rows = (s, r) => {
    const list = s.slots.filter(x => x.card === r).sort((a, b) => a.y - b.y || a.x - b.x);
    const up = list.slice(0, 4), dn = list.slice(4, 8);
    return { up, dn };
  };

  async function stepMids() {
    const s = await scan(pg);
    if (s.ch) {
      /* 飞行中点从 rounds 现算（start + fly/2）——字幕段中点在串行律
         （包 B：抵达→淡出→延迟→落位）后会漂进延迟相，包已不可见 */
      const rd = await pg.evaluate(() => {
        const c = window.CV.lastMount.getCh();
        return { rs: c.rounds.map(r => ({ s: r.start, fly: r.arrive - r.start,
                                          done: r.done })), total: c.total };
      });
      const mids = rd.rs.map((r, q) => ({
        mid: Math.round((r.s + r.fly / 2) / rd.total * 1000),
        q, after: Math.round((r.done - 0.02) / rd.total * 1000)
      }));
      if (mids.length === 4) return mids;
    }
    return OLD.alltoall.stepMid.map((x, q) => ({
      mid: x, q, after: q === 0 ? OLD.alltoall.afterStep0 : null
    }));
  }

  /* 3.54 挂载四张卡 */
  ok('3.54 挂载四张卡', common.t0.cards.length === 4, `cards=${common.t0.cards.length}`);

  /* 3.55 初始态上排四片、下排看不见（2026-11-03 加预留缓冲步：显形前整排隐藏） */
  {
    const t0 = common.t0;
    let ok49 = true, d49 = '';
    for (let r = 0; r < 4; r++) {
      const { up, dn } = rows(t0, r);
      const upOk = up.length === 4 && up.every((x, j) => x.l === PAL[r].letter && x.op === 1 &&
        new RegExp('^' + PAL[r].letter + j + '$').test(x.t));
      const dnOk = dn.length === 4 && dn.every(x => !x.l && x.op === 0);
      if (!upOk || !dnOk) { ok49 = false; d49 = `卡${r}: up=[${up.map(x => x.t)}] dn可见=${dn.filter(x => x.op > 0).length}`; break; }
    }
    ok('3.55 初始态上排四片、下排看不见', ok49, d49 || '4 卡 × (上 4 片 + 下 4 藏)');
  }

  /* 3.55b 预留缓冲后下排显形（4 空格可见，与全站预留步同态） */
  {
    const at = await pg.evaluate(() => {
      const c = window.CV.lastMount.getCh();
      return Math.round((c.win.open.e - 0.05) / c.total * 1000);
    });
    await seek(pg, at, 300);
    const s = await scan(pg);
    let ok50 = true, d50 = '';
    for (let r = 0; r < 4; r++) {
      const { dn } = rows(s, r);
      const dnOk = dn.length === 4 && dn.every(x => !x.l && x.op === 1);
      if (!dnOk) { ok50 = false; d50 = `卡${r}: dn可见=${dn.filter(x => x.op === 1).length}`; break; }
    }
    ok('3.55b 预留缓冲后下排显形', ok50, d50 || '4 卡下排 4 空格可见');
  }

  /* 3.56 每步 3 个包同发同一目标；全页 12 条流 */
  {
    const steps = await stepMids();
    const all12 = common.t0.pkts.length === 12;
    let ok50 = all12 && steps.length === 4, d50 = `包总数=${common.t0.pkts.length}`;
    for (const st of steps) {
      await seek(pg, st.mid, 280);
      const s = await scan(pg);
      const vis = s.pkts.filter(x => x.o > 0.01);
      const wantLetters = PAL.map(p => p.letter).filter((_, i) => i !== st.q).sort().join();
      const gotLetters = vis.map(x => x.l).sort().join();
      if (vis.length !== 3 || gotLetters !== wantLetters) {
        ok50 = false;
        d50 += ` 步${st.q}: 可见=${vis.length}[${gotLetters}]≠3[${wantLetters}]`;
        break;
      }
    }
    ok('3.56 每步 3 包同发同一目标', ok50, d50);
  }

  /* 3.57 / 3.58 上排逐片清空；徽章翻转（2026-10-31 拆自旧 3.51，同一帧采样；
     描述按已实现范围收窄：只验第 0 步之后一帧，逐步推进登记在 test-cases.html 待处理区③）*/
  {
    const steps = await stepMids();
    await seek(pg, steps[0].after || OLD.alltoall.afterStep0, 500);
    const s = await scan(pg);
    const badges = s.cards.sort((a, b) => a.k - b.k).map(c => c.bt);
    ok('3.58 徽章翻转', badges[0] === '4/4' && badges.slice(1).every(b => b === '0/4'),
      `徽章=[${badges}]`);
    const cleared = [0, 1, 2, 3].every(r => !rows(s, r).up[0].l);
    ok('3.57 上排逐片清空', cleared, `上排第0片全清=${cleared}`);
  }

  /* 3.59 / 3.60 终态 */
  {
    await seek(pg, 1000, 1100);
    const s = await scan(pg);
    let ok52 = true, d52 = '';
    for (let r = 0; r < 4; r++) {
      const { up, dn } = rows(s, r);
      if (up.some(x => x.l) || dn.filter(x => x.l).length !== 4) {
        ok52 = false;
        d52 = `卡${r}: 上=${up.filter(x => x.l).length} 下=${dn.filter(x => x.l).length}`;
        break;
      }
    }
    const total = s.slots.filter(x => x.l).length;
    ok('3.59 终态上排空、下排四块', ok52 && total === 16, (d52 || '') + ` 合计=${total}`);
    const distinct = [0, 1, 2, 3].every(r => {
      const letters = rows(s, r).dn.filter(x => x.l).map(x => x.l);
      return new Set(letters).size === 4;
    });
    const sig = [0, 1, 2, 3].map(r => rows(s, r).dn.map(x => x.t).join());
    const noDup = new Set(sig).size === 4;
    ok('3.60 终态四块来源互不相同', distinct && noDup,
      `${sig.join(' | ')} 各卡4源=${distinct} 无两卡全同=${noDup}`);
  }

  return out;
}
