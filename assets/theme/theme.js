/* ============================================================
   CommonVisual v2 · L0 参数总线 · 令牌 + store
   ------------------------------------------------------------
   四色数据板、深紫 Σ、连线灰等色值令牌在这里；可调参数的**表**在
   spec.js（CV.SPEC），本文件只做 store（播种 / 读写 / 重置 / 监听）
   与 CSS 侧落地。任何文件不许自己写一份色值或时长——要用，从这里取。

   取值优先级（后者覆盖前者）：
     ① spec.js 的 def（出厂值）
     ② window.CV_PARAM_DEFAULTS（defaults.js 基线，规范页「保存到代码」固化，可提交）
     ③ localStorage 的运行时调试覆盖（清缓存即回基线）
   加载顺序：defaults.js → spec.js → theme.js
   ============================================================ */
(function (CV) {
  'use strict';

  /* ---------- 数据色板：A/B/C/D 与 rank 同色（全站一致） ---------- */
  CV.PALETTE = [
    { r: 0, letter: 'A', color: '#7c3aed' },
    { r: 1, letter: 'B', color: '#0891b2' },
    { r: 2, letter: 'C', color: '#059669' },
    { r: 3, letter: 'D', color: '#d97706' }
  ];

  CV.TONE = {
    deep:   '#4c1d95',   /* Σ 合满 4 份的终点色 */
    ink:    '#190d33',   /* reduce 页越加越浓的插值终点 */
    wire:   '#c3cadb',   /* 连线闲置色（V6 基线以这里为准，不是 #8b93aa） */
    wireDim:'#8b93aa',   /* index 页网格 / 整份包描边一族的灰 */
    slotBg: '#f7f8fc',   /* 空槽底色 */
    slotHot:'#f3eeff'    /* 接收中占位底色 */
  };

  /* 段 s 合了 n 份之后的颜色：1 份原色 → 4 份深紫（allreduce/reducescatter 用） */
  CV.toneFor = function (s, n, deep) {
    var P = CV.PALETTE, k = (Math.max(1, Math.min(P.length, n)) - 1) / (P.length - 1);
    return CV.mix(P[s].color, deep || CV.TONE.deep, k);
  };

  /* reduce 页的「越加越浓」：以 ink 为终点，步进 0.19/份 */
  CV.toneRich = function (base, n) { return CV.mix(base, CV.TONE.ink, 0.19 * (n - 1)); };

  /* ---------- 参数 store：按 spec.js 的 CV.SPEC 播种，三级取值见文件头 ---------- */
  CV.params = (function () {
    var LS_KEY = 'cv.params.v1';

    if (!CV.SPEC) throw new Error('theme.js: 规范表 CV.SPEC 未加载（spec.js 必须在 theme.js 之前）');
    var SCHEMA = CV.SPEC;

    var listeners = [];
    var values = {};
    var baseline = {};

    function seed() {
      var tok = (typeof window !== 'undefined' && window.CV_PARAM_DEFAULTS) || {};
      Object.keys(SCHEMA).forEach(function (sec) {
        values[sec] = {};
        baseline[sec] = {};
        Object.keys(SCHEMA[sec].keys).forEach(function (k) {
          var def = SCHEMA[sec].keys[k].def;
          if (tok[sec] && tok[sec][k] !== undefined) def = tok[sec][k];
          values[sec][k] = def;
          baseline[sec][k] = def;
        });
      });
      try {
        var raw = localStorage.getItem(LS_KEY);
        if (raw) {
          var over = JSON.parse(raw);
          Object.keys(over).forEach(function (sec) {
            if (values[sec]) Object.keys(over[sec]).forEach(function (k) {
              if (values[sec][k] !== undefined) values[sec][k] = over[sec][k];
            });
          });
        }
      } catch (e) {}
    }

    function persist() {
      try { localStorage.setItem(LS_KEY, JSON.stringify(values)); } catch (e) {}
    }

    function emit(ch) { listeners.forEach(function (fn) { try { fn(ch); } catch (e) {} }); }

    function get(sec, k) {
      return values[sec] && values[sec][k] !== undefined ? values[sec][k] : undefined;
    }
    function set(sec, k, v) {
      if (!(values[sec] && values[sec][k] !== undefined)) return;
      var from = values[sec][k];
      values[sec][k] = v;
      persist();
      emit({ section: sec, key: k, from: from, to: v });
    }
    function reset(sec, k) {
      if (sec && k) {
        if (values[sec] && values[sec][k] !== undefined) {
          var from = values[sec][k];
          values[sec][k] = (baseline[sec] && baseline[sec][k] !== undefined)
            ? baseline[sec][k] : SCHEMA[sec].keys[k].def;
          persist();
          emit({ section: sec, key: k, from: from, to: values[sec][k] });
        }
      } else if (sec) {
        Object.keys(SCHEMA[sec].keys).forEach(function (kk) { reset(sec, kk); });
      } else {
        try { localStorage.removeItem(LS_KEY); } catch (e) {}
        seed();
        emit({ section: '*', key: '*', from: null, to: null });
      }
    }
    function onChange(fn) { if (typeof fn === 'function') listeners.push(fn); }
    function schema() { return SCHEMA; }
    function raw() { return values; }
    function exportTokens() {
      return 'window.CV_PARAM_DEFAULTS = ' + JSON.stringify(values, null, 2) + ';\n';
    }

    seed();
    return { get: get, set: set, reset: reset, onChange: onChange,
             schema: schema, raw: raw, exportTokens: exportTokens };
  })();

  /* 规范取值：按**键名**在全站规范表里找（页面不用记住它在哪一章）。
     表外键直接抛错——默认值只允许表给，消费端禁止 || 字面量兜底
     （docs/参数总线方案.md §2.2；5.1c 静态检查守这条）。 */
  CV.specGroup = function (key) {
    var sc = CV.SPEC;
    for (var g in sc) if (sc[g].keys && sc[g].keys[key]) return g;
    return null;
  };
  CV.spec = function (key) {
    var g = CV.specGroup(key);
    if (!g) throw new Error('CV.spec: 规范表无此键「' + key + '」');
    return CV.params.get(g, key);
  };

  /* ---------- orch 组的 CSS 侧落地：过渡时长走自定义属性 ----------
     stage-page.css 里 .gpu-card / .slot-g 的 transition 读这两个变量；
     调试台改 dimDur / revealDur 后这里同步重设，不用 reload。 */
  (function () {
    function apply() {
      var s = document.documentElement.style;
      s.setProperty('--cv-dim', CV.spec('dimDur') + 's');
      s.setProperty('--cv-reveal', CV.spec('revealDur') + 's');
    }
    apply();
    CV.params.onChange(function (ch) {
      if (ch.section === 'orch' || ch.section === '*') apply();
    });
  })();

  /* ---------- 保存基线文件：优先直写磁盘（本地服务的 /__cv/save） ---------- */
  CV.saveFile = function (file, text, done) {
    done = done || function () {};

    function download(reason) {
      var blob = new Blob([text], { type: 'text/javascript;charset=utf-8' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url; a.download = file.split('/').pop();
      document.body.appendChild(a); a.click();
      document.body.removeChild(a);
      setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
      done(false, reason);
    }

    if (!/^https?:$/.test(location.protocol)) { download('file'); return; }

    fetch('/__cv/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ file: file, content: text })
    }).then(function (r) {
      return r.json().catch(function () { return null; }).then(function (j) {
        if (r.ok && j && j.ok) done(true, 'ok');
        else download('endpoint');
      });
    }).catch(function () { download('network'); });
  };
})(window.CV = window.CV || {});
