/* ============================================================
   CommonVisual v2 · L2 播放器（X1 chrome.bar / X2 track / X3 cap / X4 focus / X5 gear）
   ------------------------------------------------------------
   控制与聚焦，与原语无关：只认 steps（{t, text} 数组）和 duration。
   全局只有一个 rAF（在 controls 里）；组件不保管时间。
   字幕内联彩色标签的文案助手也在这里（rk / seg / whole / sig）。
   ============================================================ */
(function (CV) {
  'use strict';
  var $ = CV.$, h = CV.h, clamp = CV.clamp;

  /* ── 字幕文本助手：rank / 段 / 整份 / Σ（字幕里内联彩色 chip） ── */
  CV.cap = function (data) {
    return {
      rk: function (n) { return '<em class="rk r' + n + '">rank' + n + '</em>'; },
      seg: function (n) { return '<em class="c' + data[n].letter + '">' + data[n].letter + '</em>'; },
      whole: function () {
        return data.map(function (d) { return '<em class="c' + d.letter + '">' + d.letter + '</em>'; }).join('');
      },
      sig: '<em class="sig">Σ</em>'
    };
  };
  CV.primText = CV.cap;

  /* ══════════ X1/X2/X3 控制条：播放/步进/键盘 + 分段进度条 + 字幕 ══════════ */

  var ICON_PLAY  = '<svg viewBox="0 0 24 24" width="25" height="25" fill="currentColor"><path d="M7 4.5v15L20 12z"/></svg>';
  var ICON_PAUSE = '<svg viewBox="0 0 24 24" width="25" height="25" fill="currentColor"><path d="M7 5h3.6v14H7zM13.4 5H17v14h-3.6z"/></svg>';

  /**
   * @param {Array}  o.steps      [{ t: 0~1, text: html, short? }]
   * @param {Number} o.duration   一轮播放时长（ms）
   * @param {Function} o.onFrame  时间变化回调（重绘舞台）
   * @param {Element} o.root      可选：容器实例（规范页 demo）不注册全局键盘
   * @param {Boolean} o.autoplay  缺省：整页实例播、容器实例不播
   */
  CV.chrome = CV.chrome || {};

  CV.chrome.bar = function (o) {
    var steps = o.steps;
    var duration = o.duration || 9000;
    var onFrame = o.onFrame || function () {};
    var root = o.root || document;
    var isPage = root === document;

    /* 页面里是 id，容器里用类名 —— 同一套组件的两种挂法 */
    function q(sel, cls) { return root.querySelector(sel) || (cls && root.querySelector(cls)); }
    var elPlay = q('#play', '.play');
    var elPrev = q('#prev', '.prev');
    var elNext = q('#next', '.next');
    var elScrub = q('#scrub', '.scrub');
    var elSegs = q('#segs', '.segs');
    var elCap = q('#capText', '.cap-text');

    var t = 0, playing = false, rafId = null, lastTs = 0;
    var segFills = [];

    function stepEnd(i) { return i + 1 < steps.length ? steps[i + 1].t : 1; }

    /* 分段条宽度 = 该段真实时长（steps[i].t 已按秒归一化，视觉位置与时间等价） */
    function tToV(v) { return clamp(v, 0, 1); }
    function vToT(x) { return clamp(x, 0, 1); }

    function buildSegs() {
      var box = elSegs;
      if (!box) return;
      box.innerHTML = '';
      segFills = steps.map(function (s, i) {
        var fill = h('i', '', h('div', 'seg', box));
        var span = stepEnd(i) - s.t;
        box.lastChild.style.flexGrow = String(Math.max(span, 0.001));
        return fill;
      });
    }

    function paintChrome(v) {
      var sc = elScrub;
      if (sc && document.activeElement !== sc) sc.value = String(Math.round(tToV(v) * 1000));

      steps.forEach(function (s, i) {
        var fill = segFills[i];
        if (!fill) return;
        var end = stepEnd(i);
        var r = v <= s.t ? 0 : (v >= end ? 1 : (v - s.t) / (end - s.t));
        fill.style.width = (r * 100).toFixed(2) + '%';
      });

      var si = 0;
      for (var i = 0; i < steps.length; i++) if (v >= steps[i].t) si = i;
      var cap = elCap;
      if (cap) {
        var st = steps[si];
        var narrow = window.innerWidth < 860;
        cap.innerHTML = (narrow && st.short) ? st.short : st.text;
      }
    }

    function setPlaying(v) {
      playing = v;
      var btn = elPlay;
      if (btn) {
        btn.innerHTML = v ? ICON_PAUSE : ICON_PLAY;
        btn.setAttribute('aria-label', v ? '暂停' : '播放');
        btn.setAttribute('title', v ? '暂停' : '播放');
      }
      if (v) { lastTs = performance.now(); rafId = requestAnimationFrame(tick); }
      else if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
    }

    function tick(ts) {
      if (!playing) return;
      var dt = Math.min(ts - lastTs, 80);
      lastTs = ts;
      t += dt / duration;
      if (t >= 1) t = 0;                 /* 循环播放 */
      onFrame(t);
      paintChrome(t);
      rafId = requestAnimationFrame(tick);
    }

    function seek(v) {
      t = clamp(v, 0, 1);
      onFrame(t);
      paintChrome(t);
    }

    /* 时序改了就重排：保留「播到第几毫秒」，改了某段时长位置才有物理意义 */
    function retime(newSteps, newDur) {
      var ms = t * duration;
      steps = newSteps;
      duration = newDur || duration;
      t = clamp(duration ? ms / duration : 0, 0, 1);
      buildSegs();
      onFrame(t);
      paintChrome(t);
    }

    function bind() {
      var play = elPlay, prev = elPrev, next = elNext, scrub = elScrub;

      if (play) play.addEventListener('click', function () { setPlaying(!playing); });

      if (prev) prev.addEventListener('click', function () {
        setPlaying(false);
        var i = 0;
        for (var k = 0; k < steps.length; k++) if (steps[k].t <= t + 0.001) i = k;
        seek(i > 0 ? steps[i - 1].t + 0.005 : 0);
      });

      if (next) next.addEventListener('click', function () {
        setPlaying(false);
        var target = 1;
        for (var k = 0; k < steps.length; k++) {
          if (steps[k].t > t + 0.004) { target = steps[k].t + 0.005; break; }
        }
        seek(target);
      });

      if (scrub) scrub.addEventListener('input', function (e) {
        setPlaying(false);
        seek(vToT(e.target.value / 1000));
      });

      if (!isPage) return;
      document.addEventListener('keydown', function (e) {
        if (/^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName)) return;
        if (e.code === 'Space') { e.preventDefault(); setPlaying(!playing); }
        if (e.code === 'ArrowRight') { e.preventDefault(); if (next) next.click(); }
        if (e.code === 'ArrowLeft') { e.preventDefault(); if (prev) prev.click(); }
        if (e.code === 'KeyR') { setPlaying(false); seek(0); }
      });
    }

    buildSegs();
    bind();
    paintChrome(0);
    if (o.autoplay != null ? o.autoplay : isPage) setPlaying(true);

    return {
      seek: seek,
      retime: retime,
      setPlaying: setPlaying,
      toggle: function () { setPlaying(!playing); },
      isPlaying: function () { return playing; },
      t: function () { return t; },
      get duration() { return duration; },
      tToV: tToV,
      vToT: vToT,
      paintChrome: paintChrome,
      destroy: function () { setPlaying(false); }
    };
  };
  CV.createControls = CV.chrome.bar;

  /* ══════════ X4 聚焦：悬停高亮 + 点击钉住，其余褪色 ══════════ */

  CV.chrome.focus = function (svg, o) {
    var hover = '';
    var pinned = '';
    var applied = '\u0000';
    var keep = o.keepCards || function () { return []; };

    function active() { return hover || pinned; }

    function render(force) {
      var letter = active();

      if (force || letter !== applied) {
        applied = letter;
        if (letter) svg.setAttribute('data-focus', letter);
        else svg.removeAttribute('data-focus');

        var kept = letter ? keep(letter) : [];
        CV.$$('[data-card]', svg).forEach(function (g) {
          var k = Number(g.getAttribute('data-card'));
          if (!letter || kept.indexOf(k) >= 0) g.removeAttribute('data-dim');
          else g.setAttribute('data-dim', '1');
        });
      }

      if (pinned) svg.setAttribute('data-pinned', pinned);
      else svg.removeAttribute('data-pinned');
    }

    function letterOf(e) {
      var hit = e.target.closest ? e.target.closest('[data-l]') : null;
      return hit ? hit.getAttribute('data-l') : '';
    }

    svg.addEventListener('pointerover', function (e) {
      var l = letterOf(e);
      if (l === hover) return;
      hover = l;
      render();
    });

    svg.addEventListener('pointerleave', function () {
      if (!hover) return;
      hover = '';
      render();
    });

    svg.addEventListener('click', function (e) {
      var l = letterOf(e);
      if (!l) return;
      pinned = (pinned === l) ? '' : l;
      render(true);
    });

    return {
      refresh: function () { render(true); },
      current: active,
      pinned: function () { return pinned; }
    };
  };
  CV.attachFocus = CV.chrome.focus;

  /* ══════════ X5 时序齿轮（右上角） ══════════ */

  var GEAR_ICON =
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
  CV.chrome.gear = function (o) {
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
    btn.innerHTML = GEAR_ICON + '<span class="gear-txt">时序</span>';

    var pop = el('div', 'gear-pop');
    pop.hidden = true;
    pop.setAttribute('role', 'dialog');
    pop.setAttribute('aria-label', '时序配置');

    hd.appendChild(btn);
    document.body.appendChild(pop);

    var rowsBox, totalEl, savedEl;

    function ovRaw() { return CV.pageOvRaw(page); }
    function ovAll() { return CV.pageOvRead(page); }

    function apply(store, val) {
      var v = ovRaw();
      if (val == null) delete v[store]; else v[store] = val;
      CV.pageOvSave(page, v);
      onChange();
      syncSecs();
      flash(val == null ? '已恢复' : '已存本机');
    }

    var flashTimer = null;
    function flash(txt) {
      if (!savedEl) return;
      savedEl.textContent = txt;
      savedEl.classList.add('on');
      clearTimeout(flashTimer);
      flashTimer = setTimeout(function () { savedEl.classList.remove('on'); }, 1500);
    }

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

      var no = el('span', 'gear-no' + (isSub ? ' gear-no-sub' : ''), isSub ? '' : noTxt);
      row.appendChild(no);
      row.appendChild(el('span', 'gear-lb', r.label));

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

      if (isSpec) {
        row.appendChild(el('span', 'gear-sec', fmt(r.sec)));
      }

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

      pop.appendChild(el('div', 'gear-tip',
        '编号＝进度条第几段 · 有规范值调倍数 · 自定义填秒 · 改完自动存到本机'));

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

      var reset = el('button', 'gear-btn-sm gear-btn-ghost', '全部重置');
      reset.type = 'button';
      reset.title = '清掉本机的全部改动，回到代码基线';
      reset.addEventListener('click', function (e) {
        e.stopPropagation();
        CV.pageOvClear(page);
        onChange();
        render();
      });
      ft.appendChild(reset);

      var save = el('button', 'gear-btn-sm', '保存到代码');
      save.type = 'button';
      save.title = '写入基线文件：把这一页当前的值固化成代码基线';
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

    function exportPage(cb) {
      var all = {};
      var src = window.CV_PAGE_DEFAULTS || {};
      Object.keys(src).forEach(function (k) { all[k] = src[k]; });
      all[page] = ovAll();
      var txt = '/* CommonVisual v2 · 每页时序基线（可提交） */\n' +
        'window.CV_PAGE_DEFAULTS = ' + JSON.stringify(all, null, 2) + ';\n';
      CV.saveFile('assets/scenes/pages-base.js', txt, function (ok, why) {
        if (ok) {
          flash('已写入基线');
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
  CV.gear = CV.chrome.gear;
})(window.CV = window.CV || {});
