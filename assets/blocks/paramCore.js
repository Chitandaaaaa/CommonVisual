/* ============================================================
   CommonVisual · 参数面板渲染核（一个核、两个壳）
   ------------------------------------------------------------
   把 spec.js 的表渲染成可调面板：数值行（滑杆+数字）、颜色行（取色器+hex）、
   手风琴分组。两个壳共用：
     · 规范页抽屉（blocks/paramEditor.js，docs/visual.html）
     · 原语页齿轮「外观」tab（parts/chrome.js）
   自带样式注入（<style id="cv-param-core">，幂等），壳页面无需各自带 CSS。

   锁（B5 定稿）：所有行默认只读——能看当前值，不能改；面板顶部一个
   「解锁编辑」总开关。锁只门禁 UI：锁上 ≠ 回基线（解锁期间的改动仍走
   三级链继续生效），不持久化（每次重开面板回锁），探针不走 UI 不受影响。

   纯渲染核，不知道壳的存在：壳负责开合、日志、保存出口、章节联动。
   ============================================================ */
(function (CV) {
  'use strict';
  if (!CV || !CV.params) return;
  var P = CV.params;

  /* ── 样式：注入一次（幂等）。前缀 pc-，避免与壳自身的样式互相牵动 ── */
  var STYLE_ID = 'cv-param-core';
  function injectStyle() {
    if (document.getElementById(STYLE_ID)) return;
    var s = document.createElement('style');
    s.id = STYLE_ID;
    s.textContent =
      '.pc-panel{font-family:var(--sans,system-ui,sans-serif)}' +
      '.pc-lockbar{display:flex;align-items:center;gap:8px;padding:8px 10px;margin:0 0 6px;' +
        'border:1px solid var(--line,#e5e8f1);border-radius:8px;background:var(--panel,#fff)}' +
      '.pc-lockbar .pc-lock-tip{font-size:10.5px;color:var(--tx-3,#939bb2);line-height:1.35}' +
      '.pc-lockbar b{font-size:11.5px;color:var(--tx,#161b2e)}' +
      '.pc-lockbar input{accent-color:var(--accent,#6d28d9)}' +
      '.pc-group{border:1px solid var(--line,#e5e8f1);border-radius:10px;margin:0 0 8px;background:var(--panel,#fff)}' +
      '.pc-group-head{display:flex;align-items:center;gap:8px;width:100%;padding:8px 10px;border:0;background:none;' +
        'cursor:pointer;text-align:left;font:inherit}' +
      '.pc-group-title{font-weight:600;font-size:12px;color:var(--tx,#161b2e)}' +
      '.pc-group-tag{font-size:9.5px;color:var(--tx-3,#939bb2);border:1px solid var(--line,#e5e8f1);' +
        'border-radius:4px;padding:0 4px}' +
      '.pc-chev{margin-left:auto;color:var(--tx-3,#939bb2);font-size:11px}' +
      '.pc-group-body{display:none;padding:2px 10px 8px}' +
      '.pc-group.open .pc-group-body{display:block}' +
      '.pc-sub{margin:4px 0 2px;font-size:10px;color:var(--tx-3,#939bb2)}' +
      '.pc-row{display:grid;grid-template-columns:1fr 92px 58px 16px 20px;align-items:center;gap:6px;padding:3px 0}' +
      '.pc-label{font-size:11px;color:var(--tx-2,#5f6780);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
      '.pc-range{width:92px;accent-color:var(--accent,#6d28d9)}' +
      '.pc-num,.pc-hex{width:58px;padding:2px 4px;font-family:var(--mono,ui-monospace,monospace);font-size:11px;' +
        'border:1px solid var(--line,#e5e8f1);border-radius:6px;color:var(--tx,#161b2e);background:#fff;text-align:right}' +
      '.pc-color{width:92px;height:22px;padding:0;border:1px solid var(--line,#e5e8f1);border-radius:6px;background:#fff;cursor:pointer}' +
      '.pc-row-color{grid-template-columns:1fr 92px 70px 16px 20px}' +
      '.pc-unit{font-family:var(--mono,ui-monospace,monospace);font-size:9.5px;color:var(--tx-3,#939bb2);text-align:center}' +
      '.pc-reset{border:1px solid var(--line,#e5e8f1);background:#fff;border-radius:6px;color:var(--tx-2,#5f6780);' +
        'cursor:pointer;font-size:11px;line-height:1;padding:2px 0}' +
      '.pc-row.locked .pc-range,.pc-row.locked .pc-num,.pc-row.locked .pc-color,' +
      '.pc-row.locked .pc-hex,.pc-row.locked .pc-reset{opacity:.45;pointer-events:none}' +
      '.pc-row.locked .pc-label{color:var(--tx-3,#939bb2)}';
    document.head.appendChild(s);
  }

  /* ── 行 ── */
  function buildRow(host, sec, key, spec, ctx) {
    var row = document.createElement('div');
    row.className = 'pc-row' + (spec.kind === 'color' ? ' pc-row-color' : '');
    var val = P.get(sec, key);
    var isColor = spec.kind === 'color';
    row.innerHTML =
      '<label class="pc-label">' + spec.label + '</label>' +
      (isColor
        ? '<input class="pc-color" type="color" value="' + val + '">' +
          '<input class="pc-hex" type="text" maxlength="7" spellcheck="false" value="' + val + '">'
        : '<input class="pc-range" type="range" min="' + spec.min + '" max="' + spec.max +
          '" step="' + spec.step + '" value="' + val + '">' +
          '<input class="pc-num" type="number" min="' + spec.min + '" max="' + spec.max +
          '" step="' + spec.step + '" value="' + val + '">') +
      '<span class="pc-unit">' + (spec.unit || '') + '</span>' +
      '<button class="pc-reset" title="重置此项">↺</button>';

    var a = row.querySelector(isColor ? '.pc-color' : '.pc-range');
    var b = row.querySelector(isColor ? '.pc-hex' : '.pc-num');
    var last = val;

    function clampNum(v) {
      v = parseFloat(v);
      if (isNaN(v)) return null;
      if (v < spec.min) v = spec.min;
      if (v > spec.max) v = spec.max;
      return v;
    }
    function apply(v, commit) {
      if (isColor) {
        v = String(v || '').trim().toLowerCase();
        if (!/^#[0-9a-f]{6}$/.test(v)) return;
      } else {
        v = clampNum(v);
        if (v == null) return;
      }
      a.value = v; b.value = v;
      P.set(sec, key, v);                       /* onChange → CSS sink / boot reload 各壳自接 */
      if (commit && ctx.log) { ctx.log.push({ t: Date.now(), section: sec, key: key, from: last, to: v }); if (ctx.onLog) ctx.onLog(); }
      last = v;
    }
    a.addEventListener('input',  function () { apply(a.value, false); });
    a.addEventListener('change', function () { apply(a.value, true); });
    b.addEventListener(isColor ? 'change' : 'input', function () { apply(b.value, true); });
    row.querySelector('.pc-reset').addEventListener('click', function () {
      var before = P.get(sec, key);
      P.reset(sec, key);
      var after = P.get(sec, key);
      a.value = after; b.value = after; last = after;
      if (ctx.log) { ctx.log.push({ t: Date.now(), section: sec, key: key, from: before, to: after }); if (ctx.onLog) ctx.onLog(); }
    });

    ctx.rows.push({ sec: sec, key: key, sync: function () {
      var v = P.get(sec, key); a.value = v; b.value = v; last = v;
    } });
    host.appendChild(row);
    return row;
  }

  /* ── 分组（手风琴）── */
  function buildGroup(host, sec, spec, ctx) {
    var grp = document.createElement('div');
    grp.className = 'pc-group';

    var head = document.createElement('button');
    head.type = 'button';
    head.className = 'pc-group-head';
    head.innerHTML =
      '<span class="pc-group-title">' + spec.label + '</span>' +
      (spec.anchor ? '' : '<span class="pc-group-tag">跨章</span>') +
      '<span class="pc-chev">▸</span>';
    var gbody = document.createElement('div');
    gbody.className = 'pc-group-body';

    if (spec.groups) {
      spec.groups.forEach(function (g) {
        var sub = document.createElement('div');
        sub.className = 'pc-sub';
        sub.textContent = g.label;
        gbody.appendChild(sub);
        g.keys.forEach(function (k) { buildRow(gbody, sec, k, spec.keys[k], ctx); });
      });
    } else {
      Object.keys(spec.keys).forEach(function (k) { buildRow(gbody, sec, k, spec.keys[k], ctx); });
    }

    var chev = head.querySelector('.pc-chev');
    function setOpen(v) {
      grp.classList.toggle('open', v);
      chev.textContent = v ? '▾' : '▸';
    }
    head.addEventListener('click', function () { setOpen(!grp.classList.contains('open')); });
    grp.appendChild(head); grp.appendChild(gbody);
    grp._setOpen = setOpen;
    host.appendChild(grp);
    return grp;
  }

  /* ── 面板：锁条 + 全部分组 ──
     opts: { log?: []（给变更日志；不传则不记）, onLog?: fn, onUnlock?: fn(v) }
     返回 { el, rows, groups, sync, setLocked, isLocked } */
  CV.paramCore = function (opts) {
    opts = opts || {};
    injectStyle();
    var ctx = { log: opts.log || null, onLog: opts.onLog || null, rows: [] };

    var el = document.createElement('div');
    el.className = 'pc-panel';

    /* 锁条：默认锁定。锁只门禁 UI，不回滚数据；不持久化（每次建面板回锁）。 */
    var locked = true;
    var bar = document.createElement('div');
    bar.className = 'pc-lockbar';
    bar.innerHTML =
      '<label style="display:flex;align-items:center;gap:6px;cursor:pointer">' +
        '<input type="checkbox" class="pc-lock-ck"><b>解锁编辑</b></label>' +
      '<span class="pc-lock-tip">默认只读，防误触。锁上不回滚改动——要回基线用每行的 ↺ 或「重置全部」。</span>';
    var ck = bar.querySelector('.pc-lock-ck');
    function applyLock() {
      [].slice.call(el.querySelectorAll('.pc-row')).forEach(function (row) {
        row.classList.toggle('locked', locked);
      });
    }
    ck.addEventListener('change', function () {
      locked = !ck.checked;
      applyLock();
      if (opts.onUnlock) opts.onUnlock(!locked);
    });
    el.appendChild(bar);

    var groups = [];
    var SCHEMA = CV.SPEC;
    Object.keys(SCHEMA).forEach(function (sec) {
      var grp = buildGroup(el, sec, SCHEMA[sec], ctx);
      groups.push({ el: grp, sec: sec, spec: SCHEMA[sec], setOpen: grp._setOpen });
    });

    applyLock();
    return {
      el: el,
      rows: ctx.rows,
      groups: groups,
      sync: function () { ctx.rows.forEach(function (r) { r.sync(); }); },
      setLocked: function (v) { locked = v; ck.checked = !v; applyLock(); },
      isLocked: function () { return locked; }
    };
  };

  /* 「保存到代码」的 defaults.js 文本：全站壳（抽屉 / 齿轮外观 tab）共用一份 */
  CV.paramCore.siteFileText = function () {
    return '/* CommonVisual · 参数默认值（可提交基线）\n' +
      '   由调试台「保存到代码」直接写入本文件：把当前（含运行时调过的）参数固化为代码基线。\n' +
      '   必须在 spec.js 之后、theme.js 之前加载，theme.js 读 window.CV_PARAM_DEFAULTS 覆盖出厂值。 */\n' +
      P.exportTokens();
  };
})(window.CV = window.CV || {});
