/* ============================================================
   CommonVisual · 参数调试台（仅规范页 docs/visual.html 加载）
   ------------------------------------------------------------
   把 CV.params 注册表变成可见 / 可调 / 可锁 / 可记录的界面：
     · 右侧整高抽屉（固定浮层），收起后只剩右下角 ⚙ 按钮，不挡内容
     · 默认只显示「当前章节」的动效参数组，跟着切节走（点 ⚙ 时不会看到满屏别的章）
     · 当前章节没有参数 → 空态列出可跳的二级章节，点一下直接跳过去
     · 每组标题「定位 05.3 ↗」跳到正文对应二级标题（不是整节顶部）
     · 改值 → CV.params.set → 触发各章节 onChange 实时重画
     · 重置全部 → 回到 tokens 基线
     · 导出日志 → 下载 JSON 变更记录
     · 保存到代码 → 写入 tokens.js（本地服务下直接落盘），固化当前值为代码基线
   纯运行时工具，不动任何页面行为；默认值仍来自代码。
   ============================================================ */
(function (CV) {
  'use strict';
  if (!CV || !CV.params) return;
  var P = CV.params, SCHEMA = P.schema();

  /* ── 章节映射：SCHEMA 键前缀 '05' ↔ 正文 .sec-no '05' ── */
  var app = document.querySelector('#app') || document.body;
  var secByNo = {};
  [].slice.call(app.querySelectorAll('.sec')).forEach(function (s) {
    var no = s.querySelector('.sec-no');
    if (no) secByNo[no.textContent.trim()] = s;
  });
  function sectionOf(key) { return secByNo[key.slice(0, 2)]; }
  /* 二级标题锚点 'sub-05-3' → 编号 '05.3'（面板上显示的「定位到哪一节」） */
  function anchorNo(id) {
    var m = /^sub-(\d{2})-(\d+)$/.exec(id || '');
    return m ? m[1] + '.' + m[2] : '';
  }
  /* 当前显示的节号：单章视图下同一时刻只有一节是 is-active */
  function curSecNo() {
    var s = app.querySelector('.sec.is-active');
    var n = s && s.querySelector('.sec-no');
    return n ? n.textContent.trim() : null;
  }

  /* ── 定位：跳到某个参数组对应的「二级章节」──
     单章视图下二级标题只在它所属那一节显示，所以必须先切节再滚，
     否则 getElementById 拿到的是 display:none 的元素（rect 全 0，滚过去等于没滚）。
     showSection 自己会 scrollTo(0,0)，而 html 设了 scroll-behavior:smooth ——
     紧接着再发起一次平滑滚动会被前一段顶掉，落点飘；隔一帧等布局落定再滚。 */
  function goTo(sec) {
    var no = sec.slice(0, 2);
    var anchorId = (SCHEMA[sec] && SCHEMA[sec].anchor) || '';
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
    /* 作用域条：默认「只显示当前章节」，右边那个按钮是回退开关（跨节对照调时才用）。
       当前章节没有参数时，条上直接写明，正文区给一排跳转入口。 */
    '<div class="pd-scope">' +
      '<span class="pd-scope-name"></span>' +
      '<button class="pd-scope-all" title="显示全部章节的参数（含不属于任何一节的「全局播放」）">' +
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
  var rows = [];                 /* { sec, key, range, num, sync } */
  var log = [];                  /* { t, section, key, from, to } */
  var groups = [];               /* { el, sec, no, spec, setOpen, state } —— 供按节显隐 */
  var scopeAll = false;          /* false = 只显示当前章节（默认） */

  /* ── 构建每一行 ── */
  function buildRow(sec, key, spec) {
    var row = document.createElement('div');
    row.className = 'pp-row';
    var val = P.get(sec, key);
    row.innerHTML =
      '<label class="pp-label">' + spec.label + '</label>' +
      '<input class="pp-range" type="range" min="' + spec.min + '" max="' + spec.max +
        '" step="' + spec.step + '" value="' + val + '">' +
      '<input class="pp-num" type="number" min="' + spec.min + '" max="' + spec.max +
        '" step="' + spec.step + '" value="' + val + '">' +
      '<span class="pp-unit">' + spec.unit + '</span>' +
      '<button class="pp-reset" title="重置此项">↺</button>';

    var range = row.querySelector('.pp-range');
    var num = row.querySelector('.pp-num');
    var last = val;

    function apply(v, commit) {
      v = parseFloat(v);
      if (isNaN(v)) return;
      if (v < spec.min) v = spec.min;
      if (v > spec.max) v = spec.max;
      range.value = v; num.value = v;
      P.set(sec, key, v);                 /* 触发章节 onChange → 实时重画 */
      if (commit) { log.push({ t: Date.now(), section: sec, key: key, from: last, to: v }); last = v; bumpLog(); }
    }
    range.addEventListener('input',  function () { apply(range.value, false); });
    range.addEventListener('change', function () { apply(range.value, true); });
    num.addEventListener('input',    function () { apply(num.value, false); });
    num.addEventListener('change',   function () { apply(num.value, true); });
    row.querySelector('.pp-reset').addEventListener('click', function () {
      var before = P.get(sec, key);
      P.reset(sec, key);
      var after = P.get(sec, key);
      range.value = after; num.value = after; last = after;
      log.push({ t: Date.now(), section: sec, key: key, from: before, to: after }); bumpLog();
    });

    rows.push({ sec: sec, key: key, range: range, num: num, sync: function () {
      var v = P.get(sec, key); range.value = v; num.value = v; last = v;
    } });
    return row;
  }

  /* ── 构建手风琴分组 ── */
  function buildGroup(sec, spec) {
    var grp = document.createElement('div');
    grp.className = 'pp-group';
    grp.setAttribute('data-no', sec.slice(0, 2));

    /* 跨页组（如 prims）没有对应正文章节：不给「定位」，默认常开 */
    var anchored = !!sectionOf(sec);
    var aId = spec.anchor || '';
    var aNo = anchorNo(aId);
    var locTx = aNo ? '定位 ' + aNo : '定位该节';

    var head = document.createElement('button');
    head.className = 'pp-group-head';
    head.innerHTML =
      '<span class="pp-group-title">' + spec.label + '</span>' +
      (anchored
        ? '<span class="pp-locate" title="' + (aNo
            ? '跳到正文二级标题 ' + aNo + '（不是整节顶部）'
            : '跳到正文该节') + '">' + locTx + ' ↗</span>'
        : '<span class="pp-tag">跨页</span>') +
      '<span class="pp-chev">▸</span>';

    var gbody = document.createElement('div');
    gbody.className = 'pp-group-body';
    if (spec.groups) {
      /* 组内再分小节（如 05 的「耗时 / 特效」）：只有声明了 groups 的组才分，其余照旧平铺 */
      spec.groups.forEach(function (g) {
        var sub = document.createElement('div');
        sub.className = 'pp-sub';
        var sh = document.createElement('div');
        sh.className = 'pp-sub-hd';
        sh.textContent = g.label;
        sub.appendChild(sh);
        g.keys.forEach(function (k) {
          if (spec.keys[k]) sub.appendChild(buildRow(sec, k, spec.keys[k]));
        });
        gbody.appendChild(sub);
      });
    } else {
      var ks = spec.keys;
      Object.keys(ks).forEach(function (k) { gbody.appendChild(buildRow(sec, k, ks[k])); });
    }

    grp.appendChild(head); grp.appendChild(gbody);

    var state = { open: false, touched: false };
    function setOpen(v) {
      state.open = v;
      grp.classList.toggle('open', v);
      head.querySelector('.pp-chev').textContent = v ? '▾' : '▸';
    }
    /* 点标题：切换展开（记为手动操作，之后滚动联动不再强行改它） */
    head.addEventListener('click', function (e) {
      if (e.target.classList.contains('pp-locate')) return;   /* 定位单独处理 */
      state.touched = true;
      setOpen(!state.open);
    });
    /* 定位 ↗：切到该节 → 滚到该组对应的「二级标题」（SCHEMA.anchor），
       没有 anchor 才回退到整节顶部 */
    var locate = head.querySelector('.pp-locate');
    if (locate) locate.addEventListener('click', function (e) {
      e.stopPropagation();
      goTo(sec);
    });

    /* 跨页组没有正文锚点：默认展开，且不受滚动联动影响 */
    if (!anchored) { state.touched = true; setOpen(true); }

    grp._setOpen = setOpen;
    grp._state = state;
    return grp;
  }

  Object.keys(SCHEMA).forEach(function (sec) {
    var g = buildGroup(sec, SCHEMA[sec]);
    groups.push({
      el: g, sec: sec, no: sec.slice(0, 2), spec: SCHEMA[sec],
      setOpen: g._setOpen, state: g._state
    });
    body.appendChild(g);
  });

  /* ── 空态：本节没有可调参数时，给一排「跳到那个二级章节」的入口 ──
     只显示当前章节之后，02/04/06/07/10~13 这些节打开抽屉是空的；
     光写一句「本节无参数」等于把人赶走，所以直接把可跳的地方列出来。 */
  var empty = document.createElement('div');
  empty.className = 'pd-empty';
  empty.style.display = 'none';
  (function buildEmpty() {
    var t = document.createElement('div');
    t.className = 'pd-empty-t';
    t.textContent = '本节没有可调的动效参数。跳到下面任一一节：';
    empty.appendChild(t);
    Object.keys(SCHEMA).forEach(function (sec) {
      var sp = SCHEMA[sec];
      if (!sp.anchor) return;                 /* 没有正文锚点的（global）不给跳转 */
      var b = document.createElement('button');
      b.className = 'pd-jump';
      b.innerHTML = '<i>' + anchorNo(sp.anchor) + '</i>' +
        '<span>' + sp.label + '</span><em>↗</em>';
      b.title = '跳到正文二级标题 ' + anchorNo(sp.anchor);
      b.addEventListener('click', function () { goTo(sec); });
      empty.appendChild(b);
    });
    var n = document.createElement('div');
    n.className = 'pd-empty-n';
    n.textContent = '「全局播放」不属于任何一节，切「全部章节」可调。';
    empty.appendChild(n);
  })();
  body.appendChild(empty);

  /* ── 按「当前章节」显隐分组 ── */
  var scopeNameEl = scopeName;
  var lastNo = null;
  function renderScope() {
    var no = curSecNo();
    var isNew = (no !== lastNo);
    lastNo = no;
    var hit = null, any = false;
    groups.forEach(function (g) {
      /* 全部模式下 global（no='gl'）也显示；本节模式下它不属于任何一节，隐藏 */
      var show = scopeAll || (no && g.no === no);
      g.el.style.display = show ? '' : 'none';
      if (!show) return;
      any = true;
      if (g.no === no) hit = g;
    });
    /* 刚切到新节：把本节的组自动摊开（切节是新上下文，摊开是预期）。
       用户手动收起后不再强行改 —— 除非又切了一次节。 */
    if (!scopeAll && isNew && hit) hit.setOpen(true);
    empty.style.display = any ? 'none' : '';
    scopeNameEl.textContent = scopeAll
      ? '全部章节'
      : ((no ? no + ' · ' : '') + (hit ? hit.spec.label : '本节无可调参数'));
    if (scopeAll && hit) body.scrollTop = Math.max(0, hit.el.offsetTop - 6);
  }

  function onSectionChange() {
    if (curSecNo() === lastNo) return;
    renderScope();
  }

  /* 切节联动：anatomy.js 的 showSection 会调 CV._sectionChanged（右侧二级导航重建也挂在这）。
     这里包一层而不是直接赋值 —— 直接赋值会把导航的重建逻辑顶掉。 */
  (function hookSection() {
    var prev = window.CV._sectionChanged;
    window.CV._sectionChanged = function (no) {
      if (prev) { try { prev(no); } catch (e) { /* 导航重建挂了也不能挡着切节 */ } }
      onSectionChange();
    };
    /* 兜底：不依赖钩子名与加载顺序，直接看哪节被标成 is-active。
       只观察 .sec 自身（不 subtree）—— 节内 svg 每帧改 style 会把回调刷爆。 */
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
      ? '只看当前章节的动效参数'
      : '显示全部章节的参数（含不属于任何一节的「全局播放」）';
    renderScope();
  });

  /* ── 日志计数 ── */
  function bumpLog() { logCount.textContent = log.length + ' 条变更'; }

  /* ── 开 / 收起 ──
     默认开不取决于「屏够不够宽」，而取决于「抽屉会不会压到正文」：
     正文 940 居中，右边缘在 (W + 940) / 2；抽屉 340 贴右边，左边缘在 W - 340。
     不重叠要 W ≥ 1620 —— 低于这个数就默认收起，只留右下角齿轮。
     （原来写的 1280 会让 1280~1620 之间的窗口把每节的「桌面/窄屏」开关压在抽屉底下。） */
  var DOCK_FIT = 1620;
  /* 默认收起：让右侧的「二级导航」作为默认右栏可见；
     需要调参时再点 ⚙ 打开（打开时右侧导航自动让位）。 */
  var open = false;
  function apply() {
    dock.style.display = open ? 'flex' : 'none';
    fab.style.display = open ? 'none' : 'flex';
    if (open) sync();                        /* 打开时先把当前节展开 */
  }
  fab.addEventListener('click', function () { open = true; apply(); });
  dock.querySelector('.pd-close').addEventListener('click', function () { open = false; apply(); });

  /* ── 联动：切节由 renderScope 负责换组（单章视图，滚动不改变当前节）；
     这里只处理「每次打开抽屉」—— 打开即摊开本节那一组。 ── */
  var ticking = false;
  function sync() {
    if (!open) return;
    lastNo = null;                     /* 每次打开都算新上下文，把本节组摊开 */
    renderScope();
  }
  window.addEventListener('scroll', function () {
    if (!ticking) { ticking = true; requestAnimationFrame(function () { ticking = false; onSectionChange(); }); }
  }, { passive: true });
  window.addEventListener('resize', function () {
    if (window.innerWidth < DOCK_FIT) open = false;            /* 变窄就收起，避免压住正文 */
    apply();
  });

  /* ── 重置全部 ── */
  dock.querySelector('.pd-reset-all').addEventListener('click', function () {
    P.reset();                              /* 触发 onChange section:'*' */
    rows.forEach(function (r) { r.sync(); });
    log.push({ t: Date.now(), section: '(全部)', key: '(全部)', from: '—', to: '基线' });
    bumpLog();
  });

  /* ── 导出日志 ── */
  dock.querySelector('.pd-export').addEventListener('click', function () {
    var blob = new Blob([JSON.stringify(log, null, 2)], { type: 'application/json' });
    download(blob, 'cv-params-log.json');
  });

  /* ── 保存到代码（生成 defaults.js → 直接写回 assets/theme/defaults.js） ── */
  var saveBtn = dock.querySelector('.pd-save');
  saveBtn.addEventListener('click', function () {
    var txt = '/* CommonVisual · 参数默认值（可提交）\n' +
      '   由规范页「保存到代码」写入：把当前（含运行时调过的）参数固化为代码基线。\n' +
      '   必须在 kit.js 之前加载，kit.js 会读 window.CV_PARAM_DEFAULTS 覆盖内置默认值。 */\n' +
      P.exportTokens();
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

  /* 初始一律收起（见上面 open 的说明）：DOCK_FIT 只在 resize 变窄时用来强制收起，
     不参与初始判定 —— 否则右侧二级导航永远被抽屉挤掉。 */
  renderScope();                       /* 先定好当前节，再谈开合 */
  apply();
})(window.CV = window.CV || {});
