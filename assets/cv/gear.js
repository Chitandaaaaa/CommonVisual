/* ============================================================
   CommonVisual · 原语页「时序配置」齿轮（右上角）
   ------------------------------------------------------------
   每一行 = 时间轴上的一个动作，**行首的编号就是进度条的第几段**，
   所以「我在调哪一段」永远能对得上。

   两种取值方式，界面上直接分得开：

     有规范值   packDur 1.50   [1.00] ×   1.50s   ↺
                → 秒数 = 规范值 × 倍数。规范页一改，这里跟着变
     无规范值   自定义          [0.70] s   0.70s   ↺
                → 规范里没这个概念（比如「说明」「落位延迟」），直接填秒

   为什么有规范值的只能填倍数：规范是唯一来源。页面能表达的只是
   「我比规范慢多少」，不能自己另写一套秒数，否则规范页一改就悄悄对不上。
   而规范没约定的动作本来就没有锚点，硬给倍数只会得到「0 × 倍数 = 永远 0」。

   改完立刻重排（控件 / 字幕 / 舞台），并当场写进 localStorage 的
   cv.page.<page>.v1 —— 所以刷新、关页都不会丢，改完的数字会亮一下「已存本机」。

   但 localStorage 只活在这一台浏览器里。要进仓库、要让别人也看到，
   点「保存到代码」写入 assets/cv/pages.js（assets/cv/ 里的代码基线文件；
   用 node tools/serve.mjs 打开时直接覆盖，静态服务下才退回下载）。
   读取优先级：pages.js 基线 ← localStorage 临时改动。
   ↺ 回到基线（有规范值的回 ×1，自定秒回页面默认）。

   两层编号：大步 = 进度条的一段（组头标「3–5」这种范围）；
   组内小步共用这一段，不再复读编号，只用虚线挂在组下面。
   ============================================================ */
(function (CV) {
  'use strict';

  var GEAR =
    '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" ' +
    'stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<circle cx="12" cy="12" r="3.1"/>' +
    '<path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 ' +
    '1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 8.9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 ' +
    '0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 ' +
    '9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 8.9 4.6a1.65 1.65 0 0 0 ' +
    '1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 ' +
    '1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>';

  function el(tag, cls, txt) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (txt != null) e.textContent = txt;
    return e;
  }

  function fmt(v) {
    var n = Math.round((v || 0) * 100) / 100;
    return n.toFixed(2) + 's';
  }

  function trim(v) {
    return String(Math.round((v || 0) * 1000) / 1000);
  }

  /* o = { page, getCh(), onChange(), name } */
  CV.gear = function (o) {
    o = o || {};
    var page = o.page;
    var getCh = o.getCh;
    var onChange = o.onChange || function () {};
    var hd = document.querySelector('.hd');
    if (!page || typeof getCh !== 'function' || !hd) return null;

    var btn = el('button', 'gear-btn');
    btn.type = 'button';
    btn.title = '时序配置 · 每一步的耗时';
    btn.setAttribute('aria-label', '时序配置');
    btn.innerHTML = GEAR + '<span class="gear-txt">时序</span>';

    var pop = el('div', 'gear-pop');
    pop.hidden = true;
    pop.setAttribute('role', 'dialog');
    pop.setAttribute('aria-label', '时序配置');

    hd.appendChild(btn);
    document.body.appendChild(pop);

    var rowsBox, totalEl, savedEl;

    function ovRaw() { return CV.pageOvRaw(page); }
    function ovAll() { return CV.pageOvRead(page); }

    /* 改一行：写 localStorage → 页面重算时间轴 → 只刷新秒数列（不重建 DOM，否则失焦） */
    function apply(store, val) {
      var v = ovRaw();
      if (val == null) delete v[store]; else v[store] = val;
      CV.pageOvSave(page, v);
      onChange();
      syncSecs();
      flash(val == null ? '已恢复' : '已存本机');
    }

    /* 存下来这件事必须看得见：不然改完不知道有没有生效，
       以为「没保存」，转头就去点复制（还得自己找地方贴） */
    var flashTimer = null;
    function flash(txt) {
      if (!savedEl) return;
      savedEl.textContent = txt;
      savedEl.classList.add('on');
      clearTimeout(flashTimer);
      flashTimer = setTimeout(function () { savedEl.classList.remove('on'); }, 1500);
    }

    /* 把每段的结果秒数从当前时间轴取回来（两种模式统一读这里） */
    function secMap() {
      var map = {};
      (getCh().rows || []).forEach(function (r) {
        if (r.type === 'group') {
          (r.rows || []).forEach(function (x) { map[x.key] = x.sec; });
        } else {
          map[r.key] = r.sec;
        }
      });
      return map;
    }

    function syncSecs() {
      if (!rowsBox) return;
      var map = secMap();
      var cells = rowsBox.querySelectorAll('.gear-sec');
      for (var i = 0; i < cells.length; i++) {
        var row = cells[i].parentNode;
        var sec = map[row.getAttribute('data-key')];
        if (typeof sec === 'number') cells[i].textContent = fmt(sec);
      }
      if (totalEl) totalEl.textContent = fmt(getCh().total);
    }

    function rowEl(r, noTxt, isSub) {
      var isSpec = r.mode === 'spec';
      var row = el('div', 'gear-row' + (isSpec ? ' is-spec' : ' abs') + (isSub ? ' sub' : ''));
      row.setAttribute('data-key', r.key);
      row.setAttribute('data-mode', r.mode);

      /* ① 步骤号：与进度条第几段一一对应。
         组内的小步共用同一段（标在组头上），这里只占位留对齐，不复读「3–5」。 */
      var no = el('span', 'gear-no' + (isSub ? ' gear-no-sub' : ''), isSub ? '' : noTxt);
      row.appendChild(no);

      /* ② 动作名 */
      row.appendChild(el('span', 'gear-lb', r.label));

      /* ③ 取值依据：规范键 + 规范值 / 自定义
         一段可能由多个规范键拼成（传递 = packDur + packFade），
         此时显示合计 + 一个总名（「数据包」），细节放进 title —— 否则这一格挤不下。 */
      var spec = el('span', 'gear-spec');
      if (isSpec) {
        var one = typeof r.of === 'string';
        var box1 = el('i', null, one ? r.of : (r.specLabel || r.of.join('+')));
        spec.appendChild(box1);
        spec.appendChild(document.createTextNode(' ' + fmt(r.spec)));
        spec.title = one
          ? '规范页约定的值：' + r.of + ' = ' + fmt(r.spec)
          : '规范页约定的值：' + (r.subs || []).map(function (x) {
              return x.key + ' ' + fmt(x.spec);
            }).join(' + ') + ' = ' + fmt(r.spec);
      } else {
        spec.textContent = '自定义';
        spec.title = '规范里没有约定这一步的时长，直接填秒';
      }
      row.appendChild(spec);

      /* ④ 输入：有规范值 → 倍数；无规范值 → 秒 */
      var box = el('span', 'gear-ipt');
      var inp = el('input', 'gear-k');
      inp.type = 'number';
      if (isSpec) {
        inp.min = '0'; inp.max = '4'; inp.step = '0.05';
        inp.value = trim(r.k);
        inp.setAttribute('aria-label', r.label + ' 倍数');
      } else {
        inp.min = '0'; inp.max = '8'; inp.step = '0.05';
        inp.value = trim(r.sec);
        inp.setAttribute('aria-label', r.label + ' 秒数');
      }
      box.appendChild(inp);
      box.appendChild(el('span', 'gear-unit', isSpec ? '×' : 's'));
      row.appendChild(box);

      /* ⑤ 结果秒数（无规范值的行，输入本身就是秒，这一格就不重复了） */
      if (isSpec) {
        row.appendChild(el('span', 'gear-sec', fmt(r.sec)));
      }

      /* ⑥ 重置 */
      var rs = el('button', 'gear-rs', '↺');
      rs.type = 'button';
      rs.title = isSpec ? '回到规范值（×1）' : '回到页面默认秒';
      rs.setAttribute('aria-label', r.label + ' 重置');
      row.appendChild(rs);

      inp.addEventListener('input', function () {
        var v = parseFloat(inp.value);
        if (isFinite(v) && v >= 0) apply(r.store, v);
      });
      rs.addEventListener('click', function () {
        var back = isSpec ? 1 : r.def;
        inp.value = trim(back);
        apply(r.store, null);
        if (!isSpec) syncSecs();
      });
      return row;
    }

    function render() {
      var ch = getCh();
      pop.innerHTML = '';

      var head = el('div', 'gear-hd');
      head.appendChild(el('b', 'gear-title', o.name || page));

      var x = el('button', 'gear-x', '×');
      x.type = 'button';
      x.setAttribute('aria-label', '关闭');
      x.addEventListener('click', function () { toggle(false); });
      head.appendChild(x);
      pop.appendChild(head);

      /* 规则只讲一次，不在每行重复 */
      pop.appendChild(el('div', 'gear-tip',
        '编号＝进度条第几段 · 有规范值调倍数 · 自定义填秒 · 改完自动存到本机'));

      /* 两层结构：
         大步（gear-step）= 进度条上的一段，段与段之间留白 + 实线；
         小步（gear-grp-body 里的行）= 同一段内部的四件事，虚线分隔并挂在竖线上。
         两者视觉必须不同 —— 否则「3–5 传递 / 落位延迟 / …」读起来像五段并列的步骤。 */
      rowsBox = el('div', 'gear-body');
      (ch.rows || []).forEach(function (r) {
        var step = el('div', 'gear-step' + (r.type === 'group' ? ' is-grp' : ''));
        if (r.type === 'group') {
          var g = el('div', 'gear-grp');
          var gh = el('div', 'gear-grp-hd');
          gh.appendChild(el('span', 'gear-no gear-no-grp', r.noTxt));
          gh.appendChild(el('span', 'gear-grp-lb', r.label));
          gh.appendChild(el('span', 'gear-grp-note', r.note));
          g.appendChild(gh);
          var gb = el('div', 'gear-grp-body');
          r.rows.forEach(function (rr) { gb.appendChild(rowEl(rr, '', true)); });
          g.appendChild(gb);
          step.appendChild(g);
        } else {
          step.appendChild(rowEl(r, String(r.no), false));
        }
        rowsBox.appendChild(step);
      });
      pop.appendChild(rowsBox);

      var ft = el('div', 'gear-ft');
      var t = el('span', 'gear-total');
      t.appendChild(document.createTextNode('一轮 '));
      totalEl = el('b', null, fmt(ch.total));
      t.appendChild(totalEl);
      savedEl = el('span', 'gear-saved');
      t.appendChild(savedEl);
      ft.appendChild(t);

      /* 主按钮是「保存到代码」：localStorage 只在这台机器上有效，
         要让改动进仓库（别人也能看到、换浏览器也不丢），只能走代码基线。
         重置是破坏性动作，退成次要样式。 */
      var reset = el('button', 'gear-btn-sm gear-btn-ghost', '全部重置');
      reset.type = 'button';
      reset.title = '清掉本机的全部改动，回到代码基线';
      reset.addEventListener('click', function (e) {
        /* 必须拦住冒泡：render() 会把这个按钮本身换掉，
           等事件走到 document 时它已经脱离 DOM，contains 判定为「点在外面」→ 面板自己关掉 */
        e.stopPropagation();
        CV.pageOvClear(page);
        onChange();
        render();
      });
      ft.appendChild(reset);

      var save = el('button', 'gear-btn-sm', '保存到代码');
      save.type = 'button';
      save.title = '写入 assets/cv/pages.js：把这一页当前的值固化成代码基线';
      save.addEventListener('click', function () {
        save.disabled = true;
        save.textContent = '写入中…';
        exportPage(function (ok) {
          save.disabled = false;
          save.textContent = ok ? '已写入' : '已下载';
          setTimeout(function () { save.textContent = '保存到代码'; }, 1600);
        });
      });
      ft.appendChild(save);
      pop.appendChild(ft);
    }

    /* 生成 pages.js：保留其它页已有的基线，只替换本页 */
    function exportPage(cb) {
      var all = {};
      var src = window.CV_PAGE_DEFAULTS || {};
      Object.keys(src).forEach(function (k) { all[k] = src[k]; });
      all[page] = ovAll();
      var txt = '/* CommonVisual · 每页时序基线（可提交）\n' +
        '   ------------------------------------------------------------\n' +
        '   由原语页右上角「时序」面板的「保存到代码」写入：把调好的倍数 / 自定秒固化成基线。\n' +
        '   primitive.js 的 CV.pageOvRead 先读这里，再叠浏览器里的临时改动（localStorage）。\n' +
        '   必须在 primitive.js / 各页脚本之前加载。 */\n' +
        'window.CV_PAGE_DEFAULTS = ' + JSON.stringify(all, null, 2) + ';\n';

      CV.saveFile('assets/cv/pages.js', txt, function (ok, why) {
        if (ok) {
          flash('已写入 pages.js');
        } else {
          flash(why === 'file' ? '本机文件不能写盘 · 已下载' : '服务不支持写盘 · 已下载');
        }
        if (cb) cb(ok);
      });
    }

    function place() {
      var b = btn.getBoundingClientRect();
      pop.style.top = Math.round(b.bottom + 10) + 'px';
      pop.style.right = Math.max(12, Math.round(window.innerWidth - b.right)) + 'px';
    }

    function toggle(next) {
      var want = (next == null) ? pop.hidden : next;
      pop.hidden = !want;
      btn.classList.toggle('on', want);
      if (want) { render(); place(); }
    }

    btn.addEventListener('click', function (e) { e.stopPropagation(); toggle(); });
    document.addEventListener('click', function (e) {
      if (!pop.hidden && !pop.contains(e.target) && e.target !== btn && !btn.contains(e.target)) {
        toggle(false);
      }
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !pop.hidden) toggle(false);
    });
    window.addEventListener('resize', function () { if (!pop.hidden) place(); });

    return { open: function () { toggle(true); }, close: function () { toggle(false); },
             rerender: function () { if (!pop.hidden) render(); } };
  };
})(window.CV = window.CV || {});
