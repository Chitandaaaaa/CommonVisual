/* ============================================================
   src/assets/chrome.js · ⑦呈现：齿轮面板（时序 / 逐动作解说 / 外观）
   ------------------------------------------------------------
   只读 compile/narrate 的产物展示，只写 spec 覆盖值；
   高亮 [开始,结束)、瞬时行亮 0.15s、同刻齐亮、跟随 ±20px 死区、
   手动滚动暂停跟随 2s（⑦§3.3）。
   ============================================================ */
(function (CV) {
  'use strict';

  function fmt(v) { return (Math.round(v * 100) / 100).toFixed(2); }

  CV.chrome = function (ctx) {
    var panel = document.getElementById('cvPanel');
    var tab = 'seq';
    var follow = true;
    var followPauseUntil = 0;
    var lastHitKey = '';

    panel.innerHTML =
      '<div class="cv-tabs">' +
      '<button data-tab="seq">时序</button>' +
      '<button data-tab="narr">逐动作解说</button>' +
      '<button data-tab="skin">外观</button>' +
      '<button id="cvFollow" class="cv-follow">跟随播放 · 开</button></div>' +
      '<div class="cv-body" id="cvBody"></div>';

    var body = panel.querySelector('#cvBody');
    var followBtn = panel.querySelector('#cvFollow');
    followBtn.addEventListener('click', function () {
      follow = !follow;
      followBtn.textContent = follow ? '跟随播放 · 开' : '跟随播放 · 关';
    });
    panel.querySelectorAll('button[data-tab]').forEach(function (b) {
      b.addEventListener('click', function () {
        tab = b.getAttribute('data-tab');
        panel.querySelectorAll('button[data-tab]').forEach(function (x) {
          x.classList.toggle('on', x === b);
        });
        render();
      });
    });
    panel.querySelector('button[data-tab="seq"]').classList.add('on');

    body.addEventListener('wheel', function () { followPauseUntil = Date.now() + 2000; }, { passive: true });

    /* ── 时序页签：相行表（⑥相目录的编译实例）── */
    function renderSeq() {
      var h = '<table class="cv-gr"><thead><tr><th>行号</th><th>行名</th><th>时长</th><th>来源</th></tr></thead><tbody>';
      ctx.T.gear.forEach(function (g) {
        h += '<tr' + (g.head ? ' class="hd"' : '') + '><td>' + g.no + '</td><td>' + g.label +
             '</td><td>' + (g.dur || '') + '</td><td>' + (g.src || '') + '</td></tr>';
      });
      h += '</tbody></table><div class="cv-tip">总时长 ' + fmt(ctx.T.total) + 's（默认参数）</div>';
      body.innerHTML = h;
    }

    /* ── 逐动作解说页签：五行列 + 同刻合并（⑦§3.2）── */
    function renderNarr() {
      var h = '<table class="cv-na"><colgroup><col class="c1"><col class="c2"><col class="c3"><col><col class="c5"></colgroup>' +
        '<thead><tr><th>编号</th><th>开始</th><th>结束</th><th>解说</th><th>结果</th></tr></thead><tbody>';
      ctx.T.steps.forEach(function (st, si) {
        h += '<tr class="grp"><td colspan="5">' + st.label +
             ' <span class="gs">' + fmt(st.s) + ' → ' + fmt(st.e) + '</span></td></tr>';
        var rows = st.rows, i = 0;
        while (i < rows.length) {
          var j = i;
          while (j + 1 < rows.length && rows[j + 1][0] === rows[i][0]) j++;
          var span = j - i + 1;
          for (var k = i; k <= j; k++) {
            var r = rows[k];
            h += '<tr data-si="' + si + '" data-ri="' + k + '"' + (r[2] === '画面 · 静止' ? ' class="rest"' : '') + '>';
            h += '<td class="no">' + (si + 1) + '.' + (k + 1) + '</td>';
            if (k === i) {
              h += '<td class="t' + (span > 1 ? ' sim' : '') + '" rowspan="' + span + '">' + fmt(r[0]) +
                   (span > 1 ? '<span class="same">同刻 ×' + span + '</span>' : '') + '</td>';
            }
            h += '<td class="t' + (r[1] === null ? ' blank' : '') + '">' + (r[1] === null ? '' : fmt(r[1])) + '</td>';
            h += '<td class="what">' + r[2] + '</td><td class="res">' + r[3] + '</td></tr>';
          }
          i = j + 1;
        }
      });
      h += '</tbody></table><div class="cv-tip">结束留空＝瞬时 · 高亮＝正在播 · 滚动即暂停跟随 2 秒</div>';
      body.innerHTML = h;
    }

    /* ── 高亮与跟随（⑦§3.3）── */
    function highlight() {
      if (tab !== 'narr' || panel.classList.contains('hidden')) return;
      var t = ctx.getT();
      var trs = body.querySelectorAll('tr[data-si]');
      var hit = [];
      trs.forEach(function (tr) {
        var st = ctx.T.steps[Number(tr.getAttribute('data-si'))];
        var r = st.rows[Number(tr.getAttribute('data-ri'))];
        var on = t >= r[0] - 1e-4 && (r[1] === null ? t < r[0] + 0.15 : t < r[1]);
        tr.classList.toggle('on', on);
        if (on) hit.push(tr);
      });
      var key = hit.length ? hit[0].getAttribute('data-si') + '.' + hit[0].getAttribute('data-ri') : '';
      if (key !== lastHitKey && follow && Date.now() > followPauseUntil && hit.length) {
        lastHitKey = key;
        var tr = hit[0];
        var target = tr.offsetTop - body.clientHeight / 2 + tr.clientHeight / 2;
        if (Math.abs(target - body.scrollTop) > 20) {   /* ±20px 死区 */
          body.scrollTop = target;
        }
      }
    }
    setInterval(highlight, 100);

    /* ── 外观页签：④参数调试台（精简版，D3）── */
    function renderSkin() {
      var h = '<div class="cv-skin">';
      Object.keys(CV.SPEC).forEach(function (g) {
        if (g === 'geo') return;   /* 改几何需重建舞台，二期收编 */
        h += '<h4>' + CV.SPEC[g].label + '</h4>';
        Object.keys(CV.SPEC[g].keys).forEach(function (key) {
          var d = CV.SPEC[g].keys[key];
          var cur = CV.spec(key);
          if (d.kind === 'color') {
            h += '<label>' + d.label + '<input type="color" value="' + cur + '" data-key="' + key + '"></label>';
          } else {
            h += '<label>' + d.label + ' <span>' + fmt(Number(cur)) + d.unit + '</span>' +
                 '<input type="range" min="' + d.min + '" max="' + d.max + '" step="' + d.step +
                 '" value="' + cur + '" data-key="' + key + '"></label>';
          }
        });
      });
      h += '<button id="cvReset">恢复默认</button>' +
           '<div class="cv-tip">改动存 localStorage，刷新页面生效（D3 精简版）</div></div>';
      body.innerHTML = h;
      body.querySelectorAll('input[data-key]').forEach(function (inp) {
        inp.addEventListener('change', function () {
          var v = inp.type === 'color' ? inp.value : Number(inp.value);
          CV.specSet(inp.getAttribute('data-key'), v);
        });
      });
      var reset = body.querySelector('#cvReset');
      reset.addEventListener('click', function () { CV.specReset(); renderSkin(); });
    }

    function render() {
      if (tab === 'seq') renderSeq();
      else if (tab === 'narr') renderNarr();
      else renderSkin();
    }
    return { render: render };
  };
})(window.CV = window.CV || {});
