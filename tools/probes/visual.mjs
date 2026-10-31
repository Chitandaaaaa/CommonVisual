/* CommonVisual · visual 页探针（v2 契约版；原 anatomy 页，2026-10-31 移入 docs/）
   ------------------------------------------------------------
   test-cases.html 4.8–4.13（4.12 / 4.13 于 2026-11-01 随页去 tab 改版改写：
   tab 全拆 → 小二级标题堆叠、动态常播）+ 2.14 的 visual 半截（cv.params.v1 持久化）+ 蓝图 W8。
   调试台锚点（theme.js SCHEMA，2026-11-01 拆 tab 后顺延）：
   03-card→sub-03-5 · 05-packet→sub-05-4 · 07-calc→sub-07-3（08 / 09 不变）。
   W 真值（2026-11-01 拆 tab 改版后重测）：.toc 152×367 r12；.demo 884×230 r14。
   */
export async function check(pg) {
  const out = [];
  const ok = (name, cond, detail) => out.push({ name, pass: !!cond, detail: detail || '' });

  /* 4.8 / 4.9 / 4.10 章节齐全、目录对齐、切换交互
     （2026-10-31 拆自旧 4.10：数量与编号 / 目录 / 点击切换各自独立判）*/
  {
    const d = await pg.evaluate(() => {
      const q = (s, r) => [...(r || document).querySelectorAll(s)];
      const secs = q('.sec').map(s => ({ id: s.id, no: (q('.sec-no', s)[0] || { textContent: '' }).textContent }));
      const toc = q('.toc a').map(a => (a.getAttribute('href') || '').slice(1));
      return { secs, toc };
    });
    const noSeq = d.secs.map(s => s.no);
    const continuous = noSeq.every((n, i) => n === String(i + 1).padStart(2, '0'));
    ok('4.8 章节数与编号连续', d.secs.length === 13 && continuous,
      `sec=${d.secs.length} 编号连续=${continuous}`);
    /* 目录锚点是 #sec-NN；本页是单章视图，点击 = 切到第 NN 节（无真实锚元素）*/
    const tocOk = d.toc.length === d.secs.length &&
      d.toc.every((id, i) => id === 'sec-' + d.secs[i].no);
    ok('4.9 目录对齐', tocOk, `目录=${d.toc.length}/13`);
    let clickOk = true;
    if (tocOk && d.toc.length > 1) {
      /* 点第 7 项目：第 7 节显示、其余隐藏、hash 重写 */
      await pg.evaluate(() => {
        document.querySelectorAll('.toc a')[6].click();
      });
      await pg.waitForTimeout(300);
      clickOk = await pg.evaluate(() => {
        const vis = [...document.querySelectorAll('.sec')]
          .filter(s => s.style.display !== 'none');
        return vis.length === 1 && vis[0].querySelector('.sec-no').textContent === '07' &&
          location.hash === '#sec-07';
      });
      /* 回到第 1 节，后续断言（4.11 / W8 / 4.12）默认状态不受影响 */
      await pg.evaluate(() => { document.querySelectorAll('.toc a')[0].click(); });
      await pg.waitForTimeout(300);
    }
    ok('4.10 章节切换交互', clickOk, `切换显示+hash=${clickOk}`);
  }

  /* 4.11 每节示例都能挂载（01–12 节每节有非空画布；13 施工约定无画布豁免）*/
  {
    const d = await pg.evaluate(() => {
      const q = (s, r) => [...(r || document).querySelectorAll(s)];
      return q('.sec').map(s => ({
        id: s.id,
        svg: q('svg', s).filter(v => v.childNodes.length > 0).length
      }));
    });
    const bad = d.filter(x => x.id !== 'rules' && x.svg === 0);
    ok('4.11 每节示例都能挂载', bad.length === 0,
      bad.length ? `无画布节=${bad.map(x => x.id).join(',')}` : `01–12 节均有 svg`);
  }

  /* W8 目录 / 示例盒尺寸 */
  {
    const d = await pg.evaluate(() => {
      const toc = document.querySelector('.toc');
      const demo = document.querySelector('.demo');
      const cs = (el) => el && getComputedStyle(el).borderTopLeftRadius;
      return {
        toc: toc ? [toc.offsetWidth, toc.offsetHeight, cs(toc)] : null,
        demo: demo ? [demo.offsetWidth, demo.offsetHeight, cs(demo)] : null
      };
    });
    ok('W8 目录 152×367 r12 · 示例盒 884×230 r14',
      d.toc && d.demo && d.toc[0] === 152 && d.toc[1] === 367 && d.toc[2] === '12px' &&
      d.demo[0] === 884 && d.demo[1] === 230 && d.demo[2] === '14px',
      `toc=${d.toc} demo=${d.demo}`);
  }

  /* 4.12 / 4.13（2026-11-01 随页去 tab 改版改写）：
     4.12 tab 拆净 + 动态子块常驻（03 / 05 的「动态」子块各有非空 svg、rAF 在跑）；
     4.13 参数变更 → 动态容器整体重建（打标节点脱离文档）、rAF 不增 */
  {
    await pg.evaluate(() => {
      window.__rafLast = new Map();
      const orig = window.requestAnimationFrame.bind(window);
      window.requestAnimationFrame = (cb) => orig((ts) => {
        window.__rafLast.set(cb, performance.now());
        cb(ts);
      });
    });
    await pg.waitForTimeout(400);                     /* 等几帧：让现有循环都从包装器过一遍 */
    const dynSvgCount = (secId) => pg.evaluate((id) => {
      const q = (s, r) => [...(r || document).querySelectorAll(s)];
      const sec = document.getElementById(id);
      if (!sec) return 0;
      const h3 = q('h3', sec).find(x => /动态/.test(x.textContent));
      const box = h3 && h3.closest('.sub-hd') ? h3.closest('.sub-hd').nextElementSibling : null;
      return box ? q('svg', box).filter(v => v.childNodes.length > 0).length : 0;
    }, secId);
    const tabs = await pg.evaluate(() => document.querySelectorAll('.tab').length);
    const n03 = await dynSvgCount('card');
    const n05 = await dynSvgCount('packet');
    /* 活跃 rAF 循环计数：规范页多节同时在动（03 两个场景 + 05 四模式 + 07/09 各一），
       只判下限与守恒 —— 重建前后旧的停了新的才起，计数不增。 */
    const loops = () => pg.evaluate(() => {
      const now = performance.now();
      let n = 0;
      for (const [, t] of window.__rafLast) if (now - t < 500) n++;
      return n;
    });
    const n0 = await loops();
    ok('4.12 tab 拆净、动态子块常驻',
      tabs === 0 && n03 >= 1 && n05 >= 2 && n0 >= 4,
      `tab=${tabs} 03动态svg=${n03} 05动态svg=${n05} rAF≈${n0}`);

    /* 4.13：给 05-packet 改一键 → 05 动态容器整体重建；重建前后 rAF 不增 */
    await pg.evaluate(() => {
      const sec = document.getElementById('packet');
      const h3 = [...sec.querySelectorAll('h3')].find(x => /动态/.test(x.textContent));
      const svg = h3.closest('.sub-hd').nextElementSibling.querySelector('svg');
      svg.setAttribute('data-probe-mark', '1');
    });
    await pg.evaluate(() => { CV.params.set('05-packet', 'packLead', 0.3); });
    await pg.waitForTimeout(700);                     /* 计数窗是 500ms：等旧循环的心跳老化出窗，否则取消的旧循环还在计数里 */
    const r = await pg.evaluate(() => {
      const m = document.querySelector('svg[data-probe-mark]');
      return { rebuilt: !m || !m.isConnected };
    });
    const n1 = await loops();
    await pg.evaluate(() => { CV.params.reset(); });
    await pg.waitForTimeout(200);
    ok('4.13 参数变更 → 动态子块重建', r.rebuilt && n1 <= n0,
      `重建=${r.rebuilt} rAF ${n0}→${n1}`);
  }

  /* 2.14-visual 参数持久化（cv.params.v1）*/
  {
    const r1 = await pg.evaluate(() => {
      CV.params.set('05-packet', 'packDur', 2.5);
      return { ls: localStorage.getItem('cv.params.v1'), now: CV.params.get('05-packet', 'packDur') };
    });
    await pg.reload({ waitUntil: 'load' });
    await pg.waitForTimeout(400);
    const r2 = await pg.evaluate(() => CV.params.get('05-packet', 'packDur'));
    await pg.evaluate(() => CV.params.reset());
    await pg.waitForTimeout(200);
    const r3 = await pg.evaluate(() => ({
      v: CV.params.get('05-packet', 'packDur'),
      ls: localStorage.getItem('cv.params.v1')
    }));
    ok('2.14-visual 参数持久化',
      r1.ls && JSON.parse(r1.ls)['05-packet'] && JSON.parse(r1.ls)['05-packet'].packDur === 2.5 &&
      r1.now === 2.5 && r2 === 2.5 && r3.v === 1.5 && !r3.ls,
      `set→${r1.now} reload→${r2} reset→${r3.v}`);
  }

  return out;
}
