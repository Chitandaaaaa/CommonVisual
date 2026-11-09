/* ============================================================
   CommonVisual · 参数调试台抽屉（仅规范页 docs/visual.html 加载）
   ------------------------------------------------------------
   行渲染交给共享渲染核 blocks/paramCore.js（pc-* 样式由核注入），
   本文件只做「壳」：
     · 右侧整高抽屉（固定浮层），收起后只剩右下角 ⚙，不挡内容
     · 默认只显示「当前章节」的参数组，跟着切节走；「全部章节」回退开关
     · 每组标题「定位 05.3 ↗」跳到正文对应二级标题
     · 锁（默认锁定）由核渲染；这里不做二级锁
     · 改值 → 核内 CV.params.set → CSS sink / 各章 onChange 实时重画
     · 重置全部 / 导出日志 / 保存到代码（CV.paramCore.siteFileText）
   ============================================================ */
(function (CV) {
  'use strict';
  if (!CV || !CV.params || !CV.paramCore) return;
  var P = CV.params;

  var app = document.querySelector('#app') || document.body;
  var secByNo = {};
  [].slice.call(app.querySelectorAll('.sec')).forEach(function (s) {
    var no = s.querySelector('.sec-no');
    if (no) secByNo[no.textContent.trim()] = s;
  });
  function sectionOf(key) { return secByNo[key.slice(0, 2)]; }
  function anchorNo(id) {
    var m = /^sub-(\d{2})-(\d+)$/.exec(id || '');
    return m ? m[1] + '.' + m[2] : '';
  }
  function curSecNo() {
    var s = app.querySelector('.sec.is-active');
    var n = s && s.querySelector('.sec-no');
    return n ? n.textContent.trim() : null;
  }
  function goTo(sec) {
    var no = sec.slice(0, 2);
    var anchorId = (CV.SPEC[sec] && CV.SPEC[sec].anchor) || '';
    if (window.CV && window.CV.showSection) window.CV.showSection(no);
    var el = (anchorId && document.getElementById(anchorId)) || sectionOf(sec);
    if (!el) return;
    setTimeout(function () {
      var top = el.getBoundingClientRect().top + window.pageYOffset - 12;
      window.scrollTo({ top: top, behavior: 'smooth' });
      history.replaceState(null, '', '#' + (anchorId || ('sec-' + no)));
    }, 60);
  }

  /* ── 收起态：右下角悬浮按钮 ── */
  var fab = document.createElement('button');
  fab.className = 'param-fab';
  fab.textContent = '⚙';
  fab.title = '参数调试台';
  fab.setAttribute('aria-label', '打开参数调试台');
  document.body.appendChild(fab);

  /* ── 抽屉容器 ── */
  var dock = document.createElement('aside');
  dock.className = 'param-dock';
  dock.innerHTML =
    '<div class="pd-head">' +
      '<span class="pd-title">参数调试台</span>' +
      '<button class="pd-close" title="收起">✕</button>' +
    '</div>' +
    '<div class="pd-scope">' +
      '<span class="pd-scope-name"></span>' +
      '<button class="pd-scope-all" title="显示全部章节的参数（含跨章的「舞台几何」「全局播放」）">' +
        '全部章节</button>' +
    '</div>' +
    '<div class="pd-body"></div>' +
    '<div class="pd-foot">' +
      '<span class="pd-logcount">0 条变更</span>' +
      '<button class="pd-reset-all">重置全部</button>' +
      '<button class="pd-save">保存到代码</button>' +
      '<button class="pd-export">导出日志</button>' +
    '</div>';
  document.body.appendChild(dock);

  var body = dock.querySelector('.pd-body');
  var logCount = dock.querySelector('.pd-logcount');
  var scopeName = dock.querySelector('.pd-scope-name');
  var scopeAllBtn = dock.querySelector('.pd-scope-all');
  var log = [];                  /* { t, section, key, from, to } */
  var scopeAll = false;          /* false = 只显示当前章节（默认） */
  var touched = {};              /* sec → 用户手动开合过（联动不再强行摊开） */

  /* ── 渲染核（行 / 分组 / 锁都在核里）── */
  var core = CV.paramCore({ log: log, onLog: bumpLog });
  body.appendChild(core.el);

  /* 壳附加物：每组头部的「定位 ↗」（跳正文二级标题） */
  var groups = core.groups.map(function (g) {
    var no = g.sec.slice(0, 2);
    var aId = g.spec.anchor || '';
    var aNo = anchorNo(aId);
    var anchored = !!sectionOf(g.sec);
    if (anchored && aNo) {
      var head = g.el.querySelector('.pc-group-head');
      var loc = document.createElement('span');
      loc.className = 'pp-locate';
      loc.textContent = '定位 ' + aNo + ' ↗';
      loc.title = '跳到正文二级标题 ' + aNo + '（不是整节顶部）';
      loc.addEventListener('click', function (e) { e.stopPropagation(); goTo(g.sec); });
      head.querySelector('.pc-chev').insertAdjacentElement('beforebegin', loc);
    }
    /* 跨章组没有正文锚点：默认展开 */
    if (!anchored) { touched[g.sec] = true; g.setOpen(true); }
    return { el: g.el, sec: g.sec, no: no, spec: g.spec, setOpen: g.setOpen, anchored: anchored };
  });

  /* ── 空态：本节没有可调参数时，给一排「跳到那个二级章节」的入口 ── */
  var empty = document.createElement('div');
  empty.className = 'pd-empty';
  empty.style.display = 'none';
  (function buildEmpty() {
    var t = document.createElement('div');
    t.className = 'pd-empty-t';
    t.textContent = '本节没有可调的参数。跳到下面任一一节：';
    empty.appendChild(t);
    groups.forEach(function (g) {
      if (!g.spec.anchor) return;
      var b = document.createElement('button');
      b.className = 'pd-jump';
      b.innerHTML = '<i>' + anchorNo(g.spec.anchor) + '</i>' +
        '<span>' + g.spec.label + '</span><em>↗</em>';
      b.title = '跳到正文二级标题 ' + anchorNo(g.spec.anchor);
      b.addEventListener('click', function () { goTo(g.sec); });
      empty.appendChild(b);
    });
    var n = document.createElement('div');
    n.className = 'pd-empty-n';
    n.textContent = '跨章的「舞台几何」「全局播放」切「全部章节」可见。';
    empty.appendChild(n);
  })();
  body.appendChild(empty);

  /* ── 按「当前章节」显隐分组 ── */
  var lastNo = null;
  function renderScope() {
    var no = curSecNo();
    var isNew = (no !== lastNo);
    lastNo = no;
    var hit = null, any = false;
    groups.forEach(function (g) {
      var show = scopeAll || (no && g.no === no);
      g.el.style.display = show ? '' : 'none';
      if (!show) return;
      any = true;
      if (g.no === no) hit = g;
    });
    if (!scopeAll && isNew && hit && !touched[hit.sec]) hit.setOpen(true);
    empty.style.display = any ? 'none' : '';
    scopeName.textContent = scopeAll
      ? '全部章节'
      : ((no ? no + ' · ' : '') + (hit ? hit.spec.label : '本节无可调参数'));
    if (scopeAll && hit) body.scrollTop = Math.max(0, hit.el.offsetTop - 6);
  }

  function onSectionChange() {
    if (curSecNo() === lastNo) return;
    renderScope();
  }
  (function hookSection() {
    var prev = window.CV._sectionChanged;
    window.CV._sectionChanged = function (no) {
      if (prev) { try { prev(no); } catch (e) { /* 导航重建挂了也不能挡着切节 */ } }
      onSectionChange();
    };
    if (window.MutationObserver) {
      var mo = new MutationObserver(onSectionChange);
      [].slice.call(app.querySelectorAll('.sec')).forEach(function (s) {
        mo.observe(s, { attributes: true, attributeFilter: ['class', 'style'] });
      });
    }
  })();

  scopeAllBtn.addEventListener('click', function () {
    scopeAll = !scopeAll;
    scopeAllBtn.textContent = scopeAll ? '仅当前节' : '全部章节';
    scopeAllBtn.title = scopeAll
      ? '只看当前章节的参数'
      : '显示全部章节的参数（含跨章的「舞台几何」「全局播放」）';
    renderScope();
  });

  /* ── 日志计数 ── */
  function bumpLog() { logCount.textContent = log.length + ' 条变更'; }

  /* ── 开 / 收起 ──
     正文 940 居中，右边缘 (W + 940) / 2；抽屉 340 贴右，左缘 W - 340。
     不重叠要 W ≥ 1620，低于就收起（否则压住「桌面/窄屏」开关）。 */
  var DOCK_FIT = 1620;
  var open = false;
  function apply() {
    dock.style.display = open ? 'flex' : 'none';
    fab.style.display = open ? 'none' : 'flex';
    if (open) { lastNo = null; renderScope(); }
  }
  fab.addEventListener('click', function () { open = true; apply(); });
  dock.querySelector('.pd-close').addEventListener('click', function () { open = false; apply(); });

  var ticking = false;
  window.addEventListener('scroll', function () {
    if (!ticking) { ticking = true; requestAnimationFrame(function () { ticking = false; onSectionChange(); }); }
  }, { passive: true });
  window.addEventListener('resize', function () {
    if (window.innerWidth < DOCK_FIT) open = false;
    apply();
  });

  /* ── 重置全部 ── */
  dock.querySelector('.pd-reset-all').addEventListener('click', function () {
    P.reset();                              /* 触发 onChange section:'*' */
    core.sync();
    log.push({ t: Date.now(), section: '(全部)', key: '(全部)', from: '—', to: '基线' });
    bumpLog();
  });

  /* ── 导出日志 ── */
  dock.querySelector('.pd-export').addEventListener('click', function () {
    var blob = new Blob([JSON.stringify(log, null, 2)], { type: 'application/json' });
    download(blob, 'cv-params-log.json');
  });

  /* ── 保存到代码（核给文本 → 直写 / 下载）── */
  var saveBtn = dock.querySelector('.pd-save');
  saveBtn.addEventListener('click', function () {
    var txt = CV.paramCore.siteFileText();
    saveBtn.disabled = true;
    saveBtn.textContent = '写入中…';
    CV.saveFile('assets/theme/defaults.js', txt, function (ok, why) {
      saveBtn.disabled = false;
      saveBtn.textContent = ok ? '已写入' : '已下载';
      saveBtn.title = ok
        ? '已写入 assets/theme/defaults.js'
        : (why === 'file'
            ? '双击打开时浏览器不能写盘，已下载到「下载」文件夹；用 node tools/serve.mjs 启动可直写'
            : '当前服务不支持写盘（python -m http.server 没有 POST），已下载；用 node tools/serve.mjs 启动可直写');
      setTimeout(function () { saveBtn.textContent = '保存到代码'; }, 1800);
    });
  });

  function download(blob, name) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  renderScope();                       /* 先定好当前节，再谈开合 */
  apply();
})(window.CV = window.CV || {});
