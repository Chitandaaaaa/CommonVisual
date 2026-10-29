/* ============================================================
   CommonVisual · 参数调试台（仅规范页 anatomy.html 加载）
   ------------------------------------------------------------
   把 CV.params 注册表变成可见 / 可调 / 可锁 / 可记录的界面：
     · 右侧整高抽屉（固定浮层），收起后只剩右下角 ⚙ 按钮，不挡内容
     · 每个章节一个手风琴分组；滚到哪节哪节自动展开（手动开的保持展开）
     · 每组标题带「定位 ↗」跳回正文对应章节
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
  var rows = [];                 /* { sec, key, range, num, sync } */
  var log = [];                  /* { t, section, key, from, to } */

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

    var head = document.createElement('button');
    head.className = 'pp-group-head';
    head.innerHTML =
      '<span class="pp-group-title">' + spec.label + '</span>' +
      (anchored ? '<span class="pp-locate" title="定位到正文该节">定位 ↗</span>' : '<span class="pp-tag">跨页</span>') +
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
    /* 定位 ↗：优先滚到该组对应的「二级标题」（SCHEMA.anchor），
       没有 anchor 才回退到整节（沿用 TOC 的 -12 偏移） */
    var locate = head.querySelector('.pp-locate');
    if (locate) locate.addEventListener('click', function (e) {
      e.stopPropagation();
      var secNo = sec.slice(0, 2);
      if (window.CV && window.CV.showSection) window.CV.showSection(secNo);  /* 先切到该节，让锚点可见 */
      var anchorId = SCHEMA[sec] && SCHEMA[sec].anchor;
      var el = anchorId ? document.getElementById(anchorId) : sectionOf(sec);
      if (el) {
        var top = el.getBoundingClientRect().top + window.pageYOffset - 12;
        window.scrollTo({ top: top, behavior: 'smooth' });
      }
    });

    /* 跨页组没有正文锚点：默认展开，且不受滚动联动影响 */
    if (!anchored) { state.touched = true; setOpen(true); }

    grp._setOpen = setOpen;
    grp._state = state;
    return grp;
  }

  Object.keys(SCHEMA).forEach(function (sec) {
    body.appendChild(buildGroup(sec, SCHEMA[sec]));
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

  /* ── 滚动联动：滚到哪节，哪节自动展开（手动开/关的保持原状）── */
  var ticking = false;
  function sync() {
    if (!open) return;
    var y = window.pageYOffset + window.innerHeight * 0.32;   /* 沿用 TOC 的 32% 判定线 */
    var cur = null, list = [].slice.call(app.querySelectorAll('.sec'));
    list.forEach(function (s) {
      if (s.getBoundingClientRect().top + window.pageYOffset <= y) cur = s;
    });
    var max = document.documentElement.scrollHeight - window.innerHeight;
    if (window.pageYOffset >= max - 2) cur = list[list.length - 1];   /* 兜底：末节顶不到判定线 */
    if (!cur) return;
    var no = cur.querySelector('.sec-no'); if (!no) return;
    var grp = body.querySelector('.pp-group[data-no="' + no.textContent.trim() + '"]');
    if (!grp) return;
    if (!grp._state.touched) grp._setOpen(true);              /* 仅自动展开「没被手动碰过」的组 */
    body.scrollTop = grp.offsetTop - 6;                       /* 把当前组滚进抽屉视野 */
  }
  window.addEventListener('scroll', function () {
    if (!ticking) { ticking = true; requestAnimationFrame(function () { ticking = false; sync(); }); }
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

  /* ── 保存到代码（生成 tokens.js → 直接写回 assets/cv/tokens.js） ── */
  var saveBtn = dock.querySelector('.pd-save');
  saveBtn.addEventListener('click', function () {
    var txt = '/* CommonVisual · 参数默认值（可提交）\n' +
      '   由规范页「保存到代码」写入：把当前（含运行时调过的）参数固化为代码基线。\n' +
      '   必须在 kit.js 之前加载，kit.js 会读 window.CV_PARAM_DEFAULTS 覆盖内置默认值。 */\n' +
      P.exportTokens();
    saveBtn.disabled = true;
    saveBtn.textContent = '写入中…';
    CV.saveFile('assets/cv/tokens.js', txt, function (ok, why) {
      saveBtn.disabled = false;
      saveBtn.textContent = ok ? '已写入' : '已下载';
      saveBtn.title = ok
        ? '已写入 assets/cv/tokens.js'
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

  apply();   /* 初始：宽屏开，窄屏收起 */
})(window.CV = window.CV || {});
