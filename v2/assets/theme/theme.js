/* ============================================================
   CommonVisual v2 · L0 令牌
   ------------------------------------------------------------
   全站唯一的价值来源：四色数据板、深紫 Σ、连线灰、几何常量，
   以及「组件规范」参数表（03-card / 05-packet / 07-calc / 08-seat /
   09-merge / global）。任何文件不许自己写一份色值或时长——
   要用，从这里取。

   取值优先级（后者覆盖前者）：
     ① 本文件的内置 def
     ② window.CV_PARAM_DEFAULTS（规范页「保存到代码」固化，可提交）
     ③ localStorage 的运行时调试覆盖（清缓存即回基线）
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

  /* ---------- 组件规范参数表（原 kit.js 的 CV.params，原样收编） ---------- */
  CV.params = (function () {
    var LS_KEY = 'cv.params.v1';

    var SCHEMA = {
      '03-card': {
        label: '卡片动态',
        anchor: 'sub-03-2',
        groups: [
          { label: '耗时', keys: ['cardDur', 'blockDur'] },
          { label: '节奏', keys: ['blockGap'] }
        ],
        keys: {
          cardDur:  { label: '卡片伸缩', unit: 's', def: 0.8,  min: 0.3, max: 3,   step: 0.05 },
          blockDur: { label: '单块时长', unit: 's', def: 0.4,  min: 0.1, max: 1.5, step: 0.05 },
          blockGap: { label: '块间隔',   unit: 's', def: 0.15, min: 0,   max: 0.6, step: 0.01 }
        }
      },
      '05-packet': {
        label: '数据包·动态',
        anchor: 'sub-05-3',
        groups: [
          { label: '耗时', keys: ['packDur', 'packFade'] },
          { label: '特效', keys: ['packLead', 'trailDist', 'trailScale'] }
        ],
        keys: {
          packDur:    { label: '飞行时长', unit: 's',  def: 1.5, min: 0.3, max: 4,   step: 0.1 },
          packFade:   { label: '送达淡出', unit: 's',  def: 0.6, min: 0,   max: 3,   step: 0.05 },
          packLead:   { label: '起步让出', unit: '',   def: 0.16, min: 0,  max: 0.5, step: 0.01 },
          trailDist:  { label: '拖尾退后', unit: 'px', def: 24,  min: 8,   max: 60,  step: 1 },
          trailScale: { label: '拖尾浓度', unit: '×',  def: 1,   min: 0,   max: 2,   step: 0.05 }
        }
      },
      '07-calc': {
        label: '方框动态',
        anchor: 'sub-07-2',
        groups: [
          { label: '耗时', keys: ['growDur', 'holdDur', 'shrinkDur'] }
        ],
        keys: {
          growDur:   { label: '卡片伸长', unit: 's', def: 0.75, min: 0.1, max: 2, step: 0.05 },
          holdDur:   { label: '方框展示', unit: 's', def: 0.95, min: 0.2, max: 4, step: 0.05 },
          shrinkDur: { label: '卡片缩回', unit: 's', def: 0.7,  min: 0.1, max: 2, step: 0.05 }
        }
      },
      '08-seat': {
        label: '落位弹跳',
        anchor: 'sub-08-1',
        groups: [
          { label: '耗时', keys: ['popDur'] },
          { label: '节奏', keys: ['seatGap'] }
        ],
        keys: {
          popDur:  { label: '弹跳时长', unit: 's', def: 0.55, min: 0.1, max: 1.5, step: 0.05 },
          seatGap: { label: '多块错峰', unit: 's', def: 0.5,  min: 0,    max: 0.8, step: 0.01 }
        }
      },
      '09-merge': {
        label: '融合·动态',
        anchor: 'sub-09-1',
        groups: [
          { label: '耗时', keys: ['fuseDur'] },
          { label: '节奏', keys: ['mergeGap'] },
          { label: '关键帧', keys: ['fuseWake', 'fuseRise', 'fuseFade', 'fuseSwap'] },
          { label: '特效', keys: ['fuseShrink', 'fuseGloss', 'fuseTrail'] }
        ],
        keys: {
          fuseDur:    { label: '单次融合',   unit: 's',  def: 0.42, min: 0.15, max: 1.2, step: 0.01 },
          mergeGap:   { label: '多列错峰',   unit: 's',  def: 0.5,  min: 0,    max: 1.2, step: 0.05 },
          fuseWake:   { label: '唤醒结束',   unit: '',   def: 0.16, min: 0.02, max: 0.5, step: 0.01 },
          fuseRise:   { label: '上浮结束',   unit: '',   def: 0.72, min: 0.3,  max: 0.98, step: 0.01 },
          fuseFade:   { label: '淡出起点',   unit: '',   def: 0.45, min: 0.1,  max: 0.9, step: 0.01 },
          fuseSwap:   { label: '换 Σ 时刻',  unit: '',   def: 0.78, min: 0.4,  max: 1,   step: 0.01 },
          fuseShrink: { label: '终了缩放',   unit: '×',  def: 0.36, min: 0.05, max: 1,   step: 0.01 },
          fuseGloss:  { label: '白光强度',   unit: '',   def: 0.9,  min: 0,    max: 1.5, step: 0.05 },
          fuseTrail:  { label: '拖尾退后',   unit: 'px', def: 18,   min: 0,    max: 40,  step: 1 }
        }
      },
      global: {
        label: '全局播放',
        keys: {
          pageSpeed: { label: '播放速度', unit: '×', def: 1, min: 0.3, max: 2.5, step: 0.1 }
        }
      }
    };

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

  /* 规范取值：按**键名**在全站规范里找（页面不用记住它在哪一章） */
  CV.specGroup = function (key) {
    var sc = CV.params.schema();
    for (var g in sc) if (sc[g].keys && sc[g].keys[key]) return g;
    return null;
  };
  CV.specVal = function (key) {
    var g = CV.specGroup(key);
    var v = g ? CV.params.get(g, key) : 0;
    return (typeof v === 'number') ? v : 0;
  };
  CV.specNum = function (key, d) {
    var v = CV.specVal(key);
    return v > 0 ? v : d;
  };
  CV.pack = function (k) { return CV.params.get('05-packet', k); };

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
