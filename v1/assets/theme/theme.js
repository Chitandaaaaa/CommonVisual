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

  /* ---------- 规范取值：按**键名**在全站规范表里找（页面不用记住它在哪一章）。
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

  /* ---------- 色板：从表现读（01-color 组），store 改值时原地刷新 ----------
     PALETTE / TONE 的引用在全站共用（S.data、表块、演示页），只改对象里的
     color 字段，不换对象——改色不重分配。 */
  CV.PALETTE = [
    { r: 0, letter: 'A', color: '' },
    { r: 1, letter: 'B', color: '' },
    { r: 2, letter: 'C', color: '' },
    { r: 3, letter: 'D', color: '' }
  ];
  CV.TONE = {};
  (function () {
    function apply() {
      CV.PALETTE[0].color = CV.spec('rankA');
      CV.PALETTE[1].color = CV.spec('rankB');
      CV.PALETTE[2].color = CV.spec('rankC');
      CV.PALETTE[3].color = CV.spec('rankD');
      CV.TONE.deep    = CV.spec('toneDeep');
      CV.TONE.ink     = CV.spec('toneInk');
      CV.TONE.wire    = CV.spec('toneWire');
      CV.TONE.wireDim = CV.spec('toneWireDim');
      CV.TONE.slotBg  = CV.spec('toneSlotBg');
      CV.TONE.slotHot = CV.spec('toneSlotHot');
      CV.TONE.flood   = CV.spec('flood');
    }
    apply();
    CV.params.onChange(function (ch) {
      if (ch.section === '01-color' || ch.section === '*') apply();
    });
  })();

  /* 段 s 合了 n 份之后的颜色：1 份原色 → 4 份深紫（allreduce/reducescatter 用） */
  CV.toneFor = function (s, n, deep) {
    var P = CV.PALETTE, k = (Math.max(1, Math.min(P.length, n)) - 1) / (P.length - 1);
    return CV.mix(P[s].color, deep || CV.TONE.deep, k);
  };

  /* reduce 页的「越加越浓」：以 ink 为终点，步进 0.19/份 */
  CV.toneRich = function (base, n) { return CV.mix(base, CV.TONE.ink, 0.19 * (n - 1)); };

  /* ---------- CSS 侧落地：sink='css'|'both' 的键全部写成 :root 的 --cv-<键> ----------
     时长键（unit 's'）带单位写入；stage-page.css 舞台过渡只读 var()，不再写裸秒。
     改值实时同步，不用 reload。 */
  (function () {
    function apply() {
      var s = document.documentElement.style;
      var sc = CV.SPEC;
      Object.keys(sc).forEach(function (g) {
        var ks = sc[g].keys;
        Object.keys(ks).forEach(function (k) {
          var d = ks[k];
          if (d.sink !== 'css' && d.sink !== 'both') return;
          var v = CV.params.get(g, k);
          s.setProperty('--cv-' + k, (d.unit === 's') ? v + 's' : String(v));
        });
      });
    }
    apply();
    CV.params.onChange(function (ch) { apply(); });
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
