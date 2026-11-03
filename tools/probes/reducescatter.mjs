/* CommonVisual · reducescatter 页探针（v2 契约版；本页旧版探针的移植 + 3.50/3.51/3.53）
   ------------------------------------------------------------
   test-cases.html 3.46–3.54（2026-10-31 拆分重排：旧 3.45 拆为 3.50 不变式 +
   3.51 结束帧，其余顺延；2026-11-01 补 3.54 第 1 轮齐弹）。旧页未挂 getCh：
   终态与扫描与旧版一致；3.51 的「第 1 轮合并结束」刻度用
   OLD.reducescatter.afterMerge1=438（TOTAL 21.25s，2026-10-30 实测）；
   v2 挂 getCh 后用 win.r1merge 现算（紫条续记：−20 提前量已废）。
   2026-11-01 齐弹拍板：第 1 轮 2 段同刻落位，seat1 窗 1.05→0.55，
   总长 21.15→20.65；3.54 在刷新后干净采样（ghost 透明度跨 seek 不回零）。
   同日弹跳收编包 A：seat1/seat2 改 of popDur 行（k=1 同值 0.55），
   包淡出从写死 0.55 改读规范 packFade 0.6；ghost 弹跳秒=落位行秒。
   同日包 B 串行律：抵达→淡出 0.60→停 0.50→弹——落位字幕段=三相合一
   （win 另立 r1fade/r1dly 相键，弹跳起点=dly.e），3.54 采样锚点随迁；
   每轮 +1.1、TOTAL 20.65→22.85。
   全页断言共用同一次扫描（步 30，60→1000），不再逐条 seek。
   真值（2026-10-30 旧页 1440×900；2026-11-01 齐弹后复核）：
     scrub 0   : 32 个 .slot-tx，card0 顶排 A B C D，calc 全隐
     合并段    : calc 会亮（>0.5）；全程任一卡 Σ 块 ≤ 2（无整份 Σ 中间态）
     afterMerge1: card0 被换出的列（2、3）已空，留下列是 Σᴀ²/Σʙ²
     齐弹帧    : r1fly.e+0.15 处可见 ghost=8（4 卡 × 2 段同刻；错峰口径下只有 4）
     scrub 1000: 4 个 calc 全隐；每卡 1 块 Σᴀ⁴，四个下标 = A B C D
   */
import { seek, scan, commonChecks, sc, OLD } from './_common.mjs';

export async function check(pg) {
  const out = [];
  const ok = (name, cond, detail) => out.push({ name, pass: !!cond, detail: detail || '' });

  const common = await commonChecks(pg, {
    page: 'reducescatter', v2: false, gear: true, chAvail: true,
    /* 面板结构：两轮各一组（第1轮 3–7 / 第2轮 9–13），无 choreo 四小步组；
       2.14 的持久化键用 slim（卡片收窄）——本页唯一走倍数的规范值行，
       ×2 后总时长变长（其余行都是编排秒，键得带 .sec 后缀） */
    grp4: false, gearKey: 'slim',
    edges: [{ letter: null }, { letter: null }, { letter: null }, { letter: null },
      { letter: null }, { letter: null }, { letter: null }, { letter: null }],
    uniform: null,
    keep: () => [0, 1, 2, 3],
    oldFlight: 250                                    /* 第 1 轮飞行中点（旧页实测） */
  });
  out.push(...common.res);

  const byCard = (s, r) => s.slots.filter(x => x.card === r).sort((a, b) => a.y - b.y || a.x - b.x);

  /* 3.46 挂载四张卡 */
  ok('3.46 挂载四张卡', common.t0.cards.length === 4, `cards=${common.t0.cards.length}`);

  /* 3.47 / 3.48 初始态：32 个槽位标签，card0 顶排 A B C D */
  {
    const t0 = common.t0;
    ok('3.47 初始态 32 个槽位标签', t0.slots.length === 32, `n=${t0.slots.length}`);
    const c0 = byCard(t0, 0).filter(x => x.l);
    ok('3.48 card0 顶排 A B C D', c0.length === 4 && c0.map(x => x.l).join() === 'A,B,C,D',
      c0.map(x => x.l).join(','));
  }

  /* 3.49 / 3.50 / 3.51 共用一次扫描 */
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
    ok('3.49 中段计算框会亮起', maxCalc > 0.5,
      `max=${maxCalc.toFixed(2)} @${sweep.reduce((a, b) => (b.calc > a.calc ? b : a)).v}`);

    /* 3.50 全程无整份 Σ 中间态（2026-10-31 拆自旧 3.45①；v2 已过）：
       任一帧任一卡的 Σ 块 ≤ 2 —— 递归减半是边换段边折算，四列齐 Σ 的
       「先合成整份」中间态不存在。 */
    const over = sweep.filter(f => Math.max(...f.sigPerCard) > 2);
    ok('3.50 全程无整份 Σ 中间态', over.length === 0, `超2块帧=${over.length}`);

    /* 3.51 第 1 轮合并结束的帧状态（拆自旧 3.45②）：
       被换出的列已空，留下列是 2 份 Σᴀ²。
       〔2026-11-01 采样改 win.r1merge.e 现算、不减提前量（时序标准定稿，
         见 assets/rounds.js 头注释）；旧 −20 刻度按旧页标定，已废〕 */
    const s = await scan(pg);
    let aEnd;
    if (s.ch && s.ch.win && s.ch.win.r1merge) {
      aEnd = Math.round((s.ch.win.r1merge.e / s.ch.total) * 1000);
    } else {
      aEnd = OLD.reducescatter.afterMerge1;
    }
    await seek(pg, aEnd, 350);
    const sE = await scan(pg);
    const top0 = byCard(sE, 0).slice(0, 4);           /* 同卡先按 y 分排：前 4 = 顶排 */
    const swapped = !top0[2].l && !top0[3].l;
    const kept = /^Σ[A]2$/.test(top0[0].t) && /^Σ[B]2$/.test(top0[1].t);
    ok('3.51 第 1 轮合并结束的帧状态', swapped && kept,
      `@${aEnd}: c0顶排=[${top0.map(x => x.t || '·')}]`);
  }

  /* 3.52 / 3.53 终态 */
  {
    await seek(pg, 1000, 1100);
    const s = await scan(pg);
    ok('3.52 终态计算框全隐',
      s.calc.length === 4 && Math.max(0, ...s.calc) < 0.05,
      `n=${s.calc.length} max=${Math.max(0, ...s.calc).toFixed(3)}`);
    const blocks = s.slots.filter(x => x.l);
    const per = [0, 1, 2, 3].map(r => byCard(s, r).filter(x => x.l));
    const subs = blocks.map(x => /^Σ([A-D])4$/.exec(x.t)).filter(Boolean).map(m => m[1]);
    const distinct = new Set(subs).size === 4;
    ok('3.53 终态每卡一段、合起来是 Σ',
      blocks.length === 4 && per.every(l => l.length === 1) &&
      new Set(blocks.map(x => x.t)).size === 4 && distinct,
      `blocks=[${blocks.map(x => x.t)}] subs=${subs.join('')}`);
  }

  /* 3.54 第 1 轮两段同刻齐弹（2026-11-01 拍板：同飞同弹）。
     ghost 透明度跨 seek 不回零 → 刷新后干净采样：弹跳起点（win.r1dly.e，
     串行律后=淡出+延迟完）+0.15 处 8 个 ghost 全部可见。 */
  {
    await pg.reload({ waitUntil: 'load' });
    await pg.waitForFunction(() => window.CV && window.CV.lastMount && window.CV.lastMount.controls,
      null, { timeout: 8000 }).catch(() => {});
    const ch = common.ch;
    const w = ch && ch.win && (ch.win.r1dly || ch.win.r1fly);
    let vis = -1, atS = '';
    if (w) {
      const at = sc(w.e + 0.15, ch.total);
      await seek(pg, at, 300);
      vis = await pg.evaluate(() =>
        [...document.querySelectorAll('.ghost-g')]
          .filter(g => parseFloat(g.getAttribute('opacity') || '0') > 0.05).length);
      atS = `@${at}`;
    }
    ok('3.54 第 1 轮两段同刻齐弹', vis === 8, `${atS}: 可见 ghost=${vis} (want 8)`);
  }

  /* 3.54b 折进目标 = 全局列（2026-11-03 修 3.12 bug 的防复发断言）。
     r1 折进中段：每个 fuse 飞行块的 x 必须落在「本卡收到的列」中心上
     （fuse 全程 x = 目标列中心，beat.fuse 的 o.x）——旧 bug 用本卡接收
     序号当列号，r2/r3 的 C/D 块飞去 A/B 列融合。 */
  {
    const ch = common.ch;
    const w = ch && ch.win && ch.win.r1merge;
    let pass = false, atS = '', d = '';
    if (w) {
      const at = sc(w.s + (w.e - w.s) * 0.25, ch.total);
      await seek(pg, at, 300);
      atS = `@${at}`;
      const res = await pg.evaluate(() => {
        const chc = CV.lastMount.getCh();
        const round = (v) => Math.round(v * 10) / 10;
        /* 槽位归属卡片按几何包含（与 _common.scan 同法）：卡框 .gpu-card[data-card] */
        const cards = [...document.querySelectorAll('.gpu-card[data-card]')].map(g => {
          const b = g.getBoundingClientRect();
          return { r: +g.getAttribute('data-card'), b };
        });
        const slots = [...document.querySelectorAll('#lChips .slot-g')].map(g => {
          const b = g.getBoundingClientRect();
          return { x: b.left + b.width / 2, y: b.top + b.height / 2, cx: b.left + b.width / 2 };
        });
        const byCard = [];
        slots.forEach(sl => {
          const hit = cards.find(c => sl.x >= c.b.left && sl.x <= c.b.right && sl.y >= c.b.top && sl.y <= c.b.bottom);
          if (hit) (byCard[hit.r] = byCard[hit.r] || []).push(sl);
        });
        byCard.forEach(list => list.sort((a, b) => a.y - b.y || a.x - b.x));
        const want = new Set();
        for (let r = 0; r < 4; r++) {
          (chc.RECV[0][r] || []).forEach(c => {
            const sl = (byCard[r] || [])[c];
            if (sl) want.add(round(sl.cx));
          });
        }
        const fuseXs = [...document.querySelectorAll('#lFx .fuse')].map(g => {
          const b = g.getBoundingClientRect();
          return round(b.left + b.width / 2);
        });
        return { want: [...want], fuseXs };
      });
      const bad = res.fuseXs.filter(x => !res.want.some(wx => Math.abs(wx - x) <= 2));
      pass = (res.fuseXs.length === 4 || res.fuseXs.length === 8) && bad.length === 0;
      d = `fuse=${res.fuseXs.length} (want 4|8) · 越列=${bad.length ? bad.join(',') : '0'} · 期望列中心=[${res.want.join(', ')}]`;
    }
    ok('3.54b 折进块对准本卡收到的列', pass, d || (atS + ' 窗口不可用'));
  }

  return out;
}
