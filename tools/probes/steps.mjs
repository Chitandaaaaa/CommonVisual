/* ============================================================
   CommonVisual · docs/steps.html 探针（2026-11-01 新增）
   ------------------------------------------------------------
   test-cases.html 4.14–4.17。steps.html 是纯静态规范稿：
   8 个原语小节的解说表由文末 PAGES 手写数据在打开时生成，
   不加载引擎 —— 所以分两层查：
     · 4.14 / 4.15 / 4.16 只查稿子自身（章节目录、表内时间
       自洽、总览与各节一致），不需要任何挂载；
     · 4.17 是主闸门：开 8 个原语页取 narrate 现值，与稿内
       表 1:1 对步数 / 行数 / 总秒 / 每行起止（±0.005）。文案
       语义不比（引擎为准，稿是转写）。这条抓的就是手写稿
       向编译产物的漂移 —— 首例即 allgather 13.95 → 18.45
       （轮末静止段每轮 +1.5s，稿没跟上，2026-11-01 已同步）。
   本页无 CV.lastMount（dur=null 属静态页预期，勿按 AGENTS #12
   误判假通过）；4.17 挂 8 个子页，本条约 20 秒。
   ============================================================ */
export async function check(pg) {
  const out = [];
  const ok = (name, cond, detail) => out.push({ name, pass: !!cond, detail: detail || '' });

  const d = await pg.evaluate(() => {
    const q = (s, r) => [...(r || document).querySelectorAll(s)];
    const secs = q('#pages > section').map(sec => {
      const meta = (sec.querySelector('.sechead .meta') || {}).textContent || '';
      const mm = meta.match(/(\d+) 步 · (\d+) 节 · ([\d.]+) 秒/);
      const ph = sec.querySelector('.pghead');
      /* pghead 的三个 .tag 各自独立（dir / 时长 / 步·节），不能拼接后正则——
         'N → 1' + '15.65 秒' 会粘成 'N → 115.65 秒'，贪婪数字串把时长吃成 115.65 */
      const tags = ph ? [...ph.querySelectorAll('.tag')].map(t => t.textContent.trim()) : [];
      const phm = (tags.length >= 3 && /\d/.test(tags[1] || '')) ? {
        dur: parseFloat(tags[1]),
        steps: +((tags[2].match(/(\d+) 步/) || [])[1] || 0),
        rows: +((tags[2].match(/(\d+) 节/) || [])[1] || 0)
      } : null;
      const grps = q('table.na tr.grp', sec).map(tr => {
        const m = ((tr.querySelector('.gs') || {}).textContent || '').match(/([\d.]+) → ([\d.]+)/);
        return m ? [+m[1], +m[2]] : null;
      });
      const rows = [];
      q('table.na tbody tr', sec).forEach(tr => {
        if (/grp/.test(tr.className)) return;
        const tds = q('td', tr);
        const hasStart = tds.length === 5;           /* 开始格带 rowspan 时后续同刻行只有 4 格 */
        const startTd = hasStart ? tds[1] : null;
        const endTd = tds[hasStart ? 2 : 1];
        rows.push({
          no: tds[0].textContent.trim(),
          rowspan: startTd ? (+startTd.getAttribute('rowspan') || 1) : 0,
          s: startTd ? parseFloat(startTd.textContent) : null,
          e: /blank/.test(endTd.className) ? '' : parseFloat(endTd.textContent)
        });
      });
      /* 同刻继承：开始格只出现在每组同刻首行，其余继承前值 */
      let cur = NaN;
      for (const r of rows) { if (r.s !== null && !isNaN(r.s)) cur = r.s; else r.s = cur; }
      return { id: sec.id,
        cn: ph ? ((ph.querySelector('.zh') || {}).textContent || '') : '',
        dir: ph ? ((ph.querySelector('.tag') || {}).textContent || '') : '',
        meta: mm && { steps: +mm[1], rows: +mm[2], dur: +mm[3] },
        ph: phm,
        grps, rows };
    });
    return {
      secs,
      total: q('section').length,
      toc: q('#toc a').map(a => ({ href: a.getAttribute('href') || '' })),
      ov: q('#overview tbody tr').map(tr => q('td', tr).map(td => td.textContent.trim()))
    };
  });

  /* ── 4.14 章节与目录对齐 ── */
  {
    const ids = d.secs.map(s => s.id);
    const wantIds = ['gather', 'scatter', 'broadcast', 'allgather',
      'reduce', 'allreduce', 'reducescatter', 'alltoall'].map(k => 'p-' + k);
    const anchorsOk = await pg.evaluate(() =>
      [...document.querySelectorAll('#toc a')].every(a =>
        !!document.getElementById(decodeURIComponent((a.getAttribute('href') || '').slice(1)))));
    ok('4.14 章节与目录对齐',
      ids.join() === wantIds.join() && d.total === 13 && d.toc.length === 10 &&
      d.secs.every(s => s.meta && s.ph) && anchorsOk,
      `节=${d.secs.length}/13 toc=${d.toc.length}/10 meta缺=${d.secs.filter(s => !s.meta).length} 锚点可达=${anchorsOk}`);
  }

  /* ── 4.15 解说表时间自洽（稿内自查，不需要引擎）── */
  {
    let ok15 = true, d15 = '';
    outer:
    for (const sec of d.secs) {
      const { grps, rows, meta } = sec;
      const badRow = rows.find(r => r.s === null || isNaN(r.s) ||
        (r.e !== '' && (isNaN(r.e) || r.e < r.s - 1e-9)));
      if (badRow) { ok15 = false; d15 = `${sec.id} 行 ${badRow.no} s=${badRow.s} e=${badRow.e}`; break; }
      if (grps.some(g => !g)) { ok15 = false; d15 = `${sec.id} span 解析失败`; break; }
      if (grps.length !== meta.steps || rows.length !== meta.rows) {
        ok15 = false; d15 = `${sec.id} 表内 grp=${grps.length} row=${rows.length} vs meta ${meta.steps}步${meta.rows}节`; break;
      }
      if (Math.abs(grps[0][0]) > 1e-9 || Math.abs(grps[grps.length - 1][1] - meta.dur) > 5e-3) {
        ok15 = false; d15 = `${sec.id} 首组始=${grps[0][0]} 末组终=${grps[grps.length - 1][1]} vs meta ${meta.dur}`; break;
      }
      /* 组间只禁重叠不要求无缝：alltoall 的「步间停顿」是 rounds.js 声明的
         合法相，稿内组 span 是工作窗、停顿不占格 —— 组间允许间隙 */
      const ov = grps.findIndex((g, i) => i && g[0] < grps[i - 1][1] - 5e-3);
      if (ov > 0) { ok15 = false; d15 = `${sec.id} 第 ${ov + 1} 组与上一组重叠`; break; }
      /* 同刻合并：开始格 rowspan = 连续同开始行数 */
      for (let i = 0; i < rows.length; i++) {
        if (!rows[i].rowspan) continue;
        let n = 1;
        while (i + n < rows.length && !rows[i + n].rowspan) n++;
        if (rows[i].rowspan !== n) { ok15 = false; d15 = `${sec.id} 行 ${rows[i].no} rowspan=${rows[i].rowspan} 实际同刻 ${n}`; break outer; }
        i += n - 1;
      }
      /* 编号 i.k 连续：相邻行要么 k+1 要么换组 i+1 且 k=1 */
      for (let i = 1; i < rows.length; i++) {
        const a = rows[i - 1].no.match(/^(\d+)\.(\d+)$/), b = rows[i].no.match(/^(\d+)\.(\d+)$/);
        if (!a || !b ||
          !(+b[1] === +a[1] && +b[2] === +a[2] + 1) &&
          !(+b[1] === +a[1] + 1 && +b[2] === 1)) {
          ok15 = false; d15 = `${sec.id} 编号 ${rows[i - 1].no} → ${rows[i].no} 不连续`; break outer;
        }
      }
    }
    ok('4.15 解说表时间自洽', ok15, d15 || '8 表全部：s≤e · 组首尾相接 · 末组=meta秒 · 同刻rowspan · 编号连续');
  }

  /* ── 4.16 总览与各节一致 ── */
  {
    let ok16 = d.ov.length === 8, d16 = `ov=${d.ov.length}`;
    if (ok16) for (const tr of d.ov) {
      const cn = tr[0], dir = tr[1], dur = parseFloat(tr[3]);
      const sm = (tr[4] || '').match(/(\d+) 步 \/ (\d+) 节/);
      const sec = d.secs.find(s => s.cn === cn);
      if (!sec || !sec.meta || !sm || sec.dir !== dir || sec.ph.dur !== sec.meta.dur ||
          sec.meta.steps !== +sm[1] || sec.meta.rows !== +sm[2] ||
          Math.abs(sec.meta.dur - dur) > 5e-3) {
        ok16 = false; d16 = `「${cn}」总览行与节不一致`; break;
      }
    }
    ok('4.16 总览与各节一致', ok16, d16);
  }

  /* ── 4.17 与引擎对账（8 个原语页各挂一次取 narrate 现值）── */
  {
    const eng = [];
    for (const sec of d.secs) {
      const id = sec.id.replace(/^p-/, '');
      const sub = await pg.context().newPage();
      try {
        await sub.goto(new URL('../' + id + '.html', pg.url()).href, { waitUntil: 'load' });
        await sub.waitForFunction(
          () => window.CV && window.CV.lastMount && typeof window.CV.lastMount.getCh === 'function',
          null, { timeout: 8000 }).catch(() => {});
        const v = await sub.evaluate(() => {
          const M = window.CV && window.CV.lastMount;
          if (!M || !M.scene || !M.getCh) return null;
          const d = CV.narrate(M.scene, M.getCh());
          return { g: d.groups.length, n: d.flat.length,
            total: Math.round(d.total * 100) / 100,
            /* e=0 与 e='' 同为「瞬时」记法（narration.js 两种生成器并存），统一成 '' */
            t: d.flat.map(r => [Math.round(r.s * 100) / 100, (!r.e || r.e === '') ? '' : Math.round(r.e * 100) / 100]) };
        });
        eng.push({ id, v, err: v ? '' : 'narrate 不可用' });
      } catch (e) {
        eng.push({ id, v: null, err: e.message });
      }
      await sub.close();
    }
    let ok17 = true, d17 = '';
    for (let i = 0; i < d.secs.length; i++) {
      const sec = d.secs[i], v = eng[i] && eng[i].v;
      if (!v) { ok17 = false; d17 = `${sec.id} 引擎取值失败：${eng[i].err}`; break; }
      if (v.g !== sec.meta.steps || v.n !== sec.meta.rows ||
          Math.abs(v.total - sec.meta.dur) > 5e-3) {
        ok17 = false; d17 = `${sec.id} 稿 ${sec.meta.steps}步${sec.meta.rows}节${sec.meta.dur}s vs 引擎 ${v.g}步${v.n}节${v.total}s`; break;
      }
      const bt = [];
      for (let k = 0; k < v.t.length && bt.length < 3; k++) {
        const a = sec.rows[k], b = v.t[k];
        if (!a) { bt.push(`行 ${k + 1} 稿侧缺失`); break; }
        if (Math.abs(a.s - b[0]) > 5e-3 ||
            (b[1] === '' ? (a.e !== '') : (a.e === '' || Math.abs(a.e - b[1]) > 5e-3))) {
          bt.push(`行${a.no}: 稿${a.s}/${a.e === '' ? '·' : a.e} vs 引擎${b[0]}/${b[1] === '' ? '·' : b[1]}`);
        }
      }
      if (bt.length) { ok17 = false; d17 = `${sec.id} ${bt.join(' · ')}`; break; }
    }
    ok('4.17 与引擎对账（8页 步/节/秒/每行起止）', ok17,
      d17 || eng.map(e => `${e.id.replace(/^p-/, '')}=${e.v.total}s`).join(' '));
  }

  return out;
}
