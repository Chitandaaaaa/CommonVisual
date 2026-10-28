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

   改完立刻重排（控件 / 字幕 / 舞台），值存在
   localStorage 的 cv.page.<page>.v1；↺ 回到规范值或页面默认秒。
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

    var rowsBox, totalEl;

    function ov() { return CV.pageOvRead(page); }

    /* 改一行：写 localStorage → 页面重算时间轴 → 只刷新秒数列（不重建 DOM，否则失焦） */
    function apply(store, val) {
      var v = ov();
      if (val == null) delete v[store]; else v[store] = val;
      CV.pageOvSave(page, v);
      onChange();
      syncSecs();
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

    function rowEl(r, noTxt) {
      var isSpec = r.mode === 'spec';
      var row = el('div', 'gear-row' + (isSpec ? ' is-spec' : ' abs'));
      row.setAttribute('data-key', r.key);
      row.setAttribute('data-mode', r.mode);

      /* ① 步骤号：与进度条第几段一一对应 */
      row.appendChild(el('span', 'gear-no', noTxt));

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
        '编号＝进度条第几段 · 有规范值调倍数 · 自定义填秒'));

      rowsBox = el('div', 'gear-body');
      (ch.rows || []).forEach(function (r) {
        if (r.type === 'group') {
          var g = el('div', 'gear-grp');
          var gh = el('div', 'gear-grp-hd');
          gh.appendChild(el('span', 'gear-no gear-no-grp', r.noTxt));
          gh.appendChild(el('span', 'gear-grp-lb', r.label));
          gh.appendChild(el('span', 'gear-grp-note', r.note));
          g.appendChild(gh);
          r.rows.forEach(function (rr) { g.appendChild(rowEl(rr, r.noTxt)); });
          rowsBox.appendChild(g);
        } else {
          rowsBox.appendChild(rowEl(r, String(r.no)));
        }
      });
      pop.appendChild(rowsBox);

      var ft = el('div', 'gear-ft');
      var t = el('span', 'gear-total');
      t.appendChild(document.createTextNode('一轮 '));
      totalEl = el('b', null, fmt(ch.total));
      t.appendChild(totalEl);
      ft.appendChild(t);

      var reset = el('button', 'gear-btn-sm', '全部重置');
      reset.type = 'button';
      reset.addEventListener('click', function () {
        CV.pageOvClear(page);
        onChange();
        render();
      });
      ft.appendChild(reset);

      var copy = el('button', 'gear-btn-sm gear-btn-ghost', '复制配置');
      copy.type = 'button';
      copy.title = '把当前倍数 / 自定秒复制成 JSON';
      copy.addEventListener('click', function () {
        var txt = JSON.stringify(ov(), null, 2);
        try {
          navigator.clipboard.writeText(txt);
          copy.textContent = '已复制';
          setTimeout(function () { copy.textContent = '复制配置'; }, 1200);
        } catch (e) {
          window.prompt('复制下面的配置：', txt);
        }
      });
      ft.appendChild(copy);
      pop.appendChild(ft);
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
