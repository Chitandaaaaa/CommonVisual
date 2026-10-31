/* CommonVisual · visual 页探针（v2 契约版；原 anatomy 页，2026-10-31 移入 docs/）
   ------------------------------------------------------------
   test-cases.html 4.8–4.13（2026-10-31 原 4.12–4.17 随页退役顺延，更早拆分史见 git）
   + 2.14 的 visual 半截（cv.params.v1 持久化）+ 蓝图 W8。
   口径（2026-10-30 按旧页实测修正，现 4.12）：本页只有 03 节有「动态」
   tab 组（一排变两排 ↔ 两排变一排）；07 的动态是自动播放、无 tab。
   探针按「存在动态 tab 就考」写，若给 07 也加了 tab 会自动被考。
   W 真值（2026-10-30 待自检确认）：.toc 152×367 r12；.demo 884×230 r14。
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

  /* 4.12 / 4.13 动态 tab 切换内容真的变；切回复原、旧 rAF 已停
     （2026-10-31 拆自旧 4.12：变化与复原+rAF 守恒各自独立判）*/
  {
    await pg.evaluate(() => {
      window.__rafLast = new Map();
      const orig = window.requestAnimationFrame.bind(window);
      window.requestAnimationFrame = (cb) => orig((ts) => {
        window.__rafLast.set(cb, performance.now());
        cb(ts);
      });
    });
    const tab = await pg.evaluate(() => {
      const q = (s, r) => [...(r || document).querySelectorAll(s)];
      for (const hd of q('.sub-hd')) {
        const h3 = hd.querySelector('h3');
        if (!h3 || !/动态/.test(h3.textContent)) continue;
        const tab = hd.querySelector('.tab');
        if (!tab || tab.querySelectorAll('button').length < 2) continue;
        /* DOM 节点没法跨 evaluate 拿回来，打标记再用选择器点 */
        hd.setAttribute('data-probe-dyn', '1');
        return { where: h3.textContent, n: tab.querySelectorAll('button').length };
      }
      return null;
    });
    if (!tab) {
      ok('4.12 tab 切换内容真的变', false, '没找到动态 tab 组');
      ok('4.13 切回复原、rAF 不增', false, '没找到动态 tab 组');
    } else {
      const fp = () => pg.evaluate(() => {
        const hd = document.querySelector('[data-probe-dyn]');
        const box = hd && hd.nextElementSibling;
        return box ? { n: box.innerHTML.length, svg: box.querySelectorAll('svg').length } : null;
      });
      /* 活跃 rAF 循环计数：规范页多节同时在动，无法点名某一个回调，
         但「切 tab 前后循环数守恒（旧的停了新的才起）」是可判的 ——
         若旧循环不停，切过去后计数会 +1。 */
      const loops = () => pg.evaluate(() => {
        const now = performance.now();
        let n = 0;
        for (const [, t] of window.__rafLast) if (now - t < 500) n++;
        return n;
      });
      const f0 = await fp();
      await pg.waitForTimeout(300);                     /* 等一帧：让现有循环都从包装器过一遍 */
      const n0 = await loops();
      const clickTab = (nth) => pg.evaluate((n) => {
        const btn = document.querySelectorAll('[data-probe-dyn] .tab button')[n];
        btn.click();                                    /* 考的就是 onclick 处理器 */
      }, nth);
      await clickTab(1);
      await pg.waitForTimeout(700);
      const f1 = await fp();
      const n1 = await loops();
      await clickTab(0);
      await pg.waitForTimeout(700);
      const f2 = await fp();
      const n2 = await loops();
      const changed = f0 && f1 && (f0.n !== f1.n || f0.svg !== f1.svg);
      const restored = f0 && f2 && f0.svg === f2.svg;
      const noLeak = n1 <= n0 && n2 <= n0;
      ok('4.12 tab 切换内容真的变', changed,
        `${tab.where} svg ${f0 && f0.svg}→${f1 && f1.svg}`);
      ok('4.13 切回复原、rAF 不增', restored && noLeak,
        `复原=${restored} rAF ${n0}→${n1}→${n2} svg ${f2 && f2.svg}`);
    }
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
