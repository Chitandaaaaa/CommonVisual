/* ============================================================
   CommonVisual · 原语页公用骨架（primitives runtime）
   ------------------------------------------------------------
   8 个原语页（gather/scatter/broadcast/reduce/allgather/
   allreduce/reducescatter/alltoall）此前各自复制了一整套：
   舞台取节点、清层、viewBox、两套几何切换、860 断点、resize
   防抖、createControls 启动、focus 刷新 —— 逐字重复。

   本文件把这套「纯机械骨架」收成一份，页面只声明自己的：
     data   数据（默认 CV.PALETTE）
     geo    几何（CV.geo({...})，只写各自的位置差异）
     steps  字幕步骤
     duration 总时长（默认 9000ms）
     keepCards  悬停聚焦保留哪几张卡（可选）
     onReset 每轮重建前的重置（可选，清页面自己的 seen/log）
     build(S)   建舞台（画图例/卡/槽/线/包）
     paint(S,t) 每帧（t ∈ 0..1）

   S 是运行时状态：{ svg, layers:{bg,cards,chips,wires,fx,labels},
   defs, L(当前几何), mode, cards, chips, wires, pkts }。
   cards/chips/wires/pkts 是**同一个对象、每轮就地清空**，页面
   可安全持有引用；L 只在切断点时替换，每帧请读 S.L。

   不改任何绘制原语本身（那些仍在 kit.js），只消除重复胶水。
   ============================================================ */
(function (CV) {
  'use strict';

  var $ = CV.$;

  /* ── 共用调色板：A/B/C/D 与 rank 同色（全站一致）── */
  CV.PALETTE = [
    { r: 0, letter: 'A', color: '#7c3aed' },
    { r: 1, letter: 'B', color: '#0891b2' },
    { r: 2, letter: 'C', color: '#059669' },
    { r: 3, letter: 'D', color: '#d97706' }
  ];

  /* ── 共用几何基线：8 页的卡片/槽位/字号/画布尺寸完全一致 ──
     页面只需补位置（target/source/grid/legendY…），common 尺寸别抄。 */
  CV.GEO_BASE = {
    desktop: {
      view: { w: 1130, h: 680 },
      card: { w: 300, h: 170 },
      slot: { sw: 46, sh: 46, gap: 12 },
      hdr: 36, title: 15, badge: 10
    },
    narrow: {
      view: { w: 380, h: 720 },
      card: { w: 146, h: 126 },
      slot: { sw: 25, sh: 25, gap: 5 },
      hdr: 28, title: 12.5, badge: 8.5
    }
  };

  /* 深合并两套几何：base 打底，overrides 覆盖（嵌套一层展开，不递归） */
  function mergeMode(base, ov) {
    var out = {};
    Object.keys(base).forEach(function (k) { out[k] = base[k]; });
    if (ov) Object.keys(ov).forEach(function (k) {
      var bv = base[k], ovv = ov[k];
      if (bv && ovv && typeof bv === 'object' && typeof ovv === 'object' &&
          !Array.isArray(bv) && !Array.isArray(ovv)) {
        var merged = {};
        Object.keys(bv).forEach(function (x) { merged[x] = bv[x]; });
        Object.keys(ovv).forEach(function (x) { merged[x] = ovv[x]; });
        out[k] = merged;
      } else {
        out[k] = ovv;
      }
    });
    return out;
  }

  /* 页面用：CV.geo({ desktop:{target:{...}}, narrow:{...} }) */
  CV.geo = function (overrides) {
    overrides = overrides || {};
    return {
      desktop: mergeMode(CV.GEO_BASE.desktop, overrides.desktop),
      narrow:  mergeMode(CV.GEO_BASE.narrow,  overrides.narrow)
    };
  };

  /* ── 字幕文本 helper：rank / 段 / 整份 ── */
  function mkText(data) {
    return {
      rk: function (n) { return '<em class="rk r' + n + '">rank' + n + '</em>'; },
      seg: function (n) { return '<em class="c' + data[n].letter + '">' + data[n].letter + '</em>'; },
      whole: function () {
        return data.map(function (d) { return '<em class="c' + d.letter + '">' + d.letter + '</em>'; }).join('');
      }
    };
  }

  /* ══════════════════════════════════════════════════════════
     挂载：接管舞台与布局生命周期，回调页面 build/paint
     ══════════════════════════════════════════════════════════ */
  CV.primitive = function (cfg) {
    var svg = $('#stage');
    var layers = {
      bg:     $('#lBg'),
      cards:  $('#lCards'),
      chips:  $('#lChips'),
      wires:  $('#lWires'),
      fx:     $('#lFx'),
      labels: $('#lLabels')
    };

    var S = {
      svg: svg,
      layers: layers,
      defs: svg.querySelector('defs'),
      L: null,
      mode: null,
      cards: {},
      chips: {},
      wires: {},
      pkts: {}
    };

    var focus = cfg.keepCards ? CV.attachFocus(svg, { keepCards: cfg.keepCards }) : null;

    /* 就地清空（不换对象引用，页面持有的引用保持有效） */
    function clearMaps() {
      ['cards', 'chips', 'wires', 'pkts'].forEach(function (k) {
        var o = S[k];
        Object.keys(o).forEach(function (x) { delete o[x]; });
      });
    }

    function buildStage() {
      var v = S.L.view;
      svg.setAttribute('viewBox', '0 0 ' + v.w + ' ' + v.h);
      Object.keys(layers).forEach(function (k) { layers[k].innerHTML = ''; });
      /* 旧 marker 也要清（只清 marker，别动 html 里那套 gGrid 网格 pattern）：
         marker 靠 id 引用，重复 build（resize / 改参数 / 换几何）会堆出第二套
         同名 id，而 url(#…) 解析的是文档里第一个 —— 页面拿到新的 marker 元素、
         线却指着旧的那个，于是改了颜色看不出变化。 */
      if (S.defs) {
        [].slice.call(S.defs.querySelectorAll('marker')).forEach(function (m) {
          m.parentNode.removeChild(m);
        });
      }
      clearMaps();
      CV.drawGrid(layers.bg, v);
      if (cfg.onReset) cfg.onReset();
      cfg.build(S);
      if (focus) focus.refresh();
    }

    /* 全局播放速度（global.pageSpeed，默认 1 = 原速）：
       只改「同一套时间轴播多快」，不改任何组件规范与几何。 */
    var speed = (CV.params && CV.params.get('global', 'pageSpeed')) || 1;
    if (!(speed > 0)) speed = 1;
    var duration = Math.round((cfg.duration || 9000) / speed);
    S.durSec = duration / 1000;      /* 页面算「离落地过了几秒」时用（pktFade 用） */
    S.speed = speed;

    var controls = CV.createControls({
      steps: cfg.steps,
      duration: duration,
      onFrame: function (t) { cfg.paint(S, t); }
    });

    var lastMode = null;
    function syncLayout(force) {
      var mode = window.innerWidth < 860 ? 'narrow' : 'desktop';
      if (!force && mode === lastMode) return;
      lastMode = mode;
      S.mode = mode;
      S.L = cfg.geo[mode];
      buildStage();
      cfg.paint(S, controls.t());
    }

    syncLayout(true);
    controls.paintChrome(controls.t());

    var rzTimer = null;
    window.addEventListener('resize', function () {
      clearTimeout(rzTimer);
      rzTimer = setTimeout(function () { syncLayout(false); }, 160);
    });

    var api = { S: S, controls: controls, text: mkText(cfg.data || CV.PALETTE) };

    /* 时序改了（页面齿轮调了倍数）→ 页面重算时间轴 → 重排控件 → 重建舞台。
       顺序不能反：控件要先拿到新 steps / duration，paint 才知道该画哪一帧。 */
    function reload() {
      var r = cfg.retime ? cfg.retime(S) : null;
      if (r && r.duration) {
        duration = Math.round(r.duration / speed);
        S.durSec = duration / 1000;
        controls.retime(r.steps, duration);
      }
      buildStage();
      cfg.paint(S, controls.t());
      controls.paintChrome(controls.t());
    }
    api.reload = reload;

    CV.lastMount = api;   /* 便于调试 / 探针取本次挂载的控件与状态 */
    return api;
  };

  /* ── 组件规范取值：页面照规范实现，不自己写数 ──
     CV.pack('packDur') → 规范页 05 定的「飞行时长」
     CV.specVal('popDur') → 按**键名**在全站规范里找，页面不用记住它在哪一章 */
  CV.pack = function (k) { return CV.params.get('05-packet', k); };

  function specGroup(key) {
    var sc = CV.params.schema();
    for (var g in sc) if (sc[g].keys && sc[g].keys[key]) return g;
    return null;
  }
  CV.specGroup = specGroup;
  CV.specVal = function (key) {
    var g = specGroup(key);
    var v = g ? CV.params.get(g, key) : 0;
    return (typeof v === 'number') ? v : 0;
  };

  /* ══════════════════════════════════════════════════════════
     显式时序表：每一步「干什么」写出来，不再用算式拼
     ------------------------------------------------------------
     页面只列步骤，每一步给一个**取值方式**，只有两种：

       有规范值 → 写 of（规范键）+ 可选 k（本页倍数）
                  该段秒数 = 规范值 × 倍数     ← 规范一改，全站跟着变
       无规范值 → 写 sec（秒）
                  该段秒数 = 本页自己填的秒数  ← 规范里没有这个概念

     kind:'transfer' 自动展开成四段（「一次传递其实是两件事：先把包送完，再落位」）：
       传递(规范·数据包整段) → 落位延迟(自定秒) → 落位弹跳(规范) → 间隔(自定秒)

     「传递」= 数据包组件自己的全部耗时（packDur 飞 + packFade 淡），共用一个倍数；
     淡出不是和弹跳并行的另一条动效 —— 包淡完了才轮到落位（串行）。

     只有「组件自身的行为」才走规范：包飞多久+淡多久、弹多久(popDur)。
     两趟之间停多久、每页收尾等多久，是**这一页的编排节奏**，规范里没有这个概念，
     所以一律填秒（「停留」已经并进送达淡出，不再是独立的一段）。

     每个 step 的序号就是进度条第几段 —— 齿轮面板里标的「第 N 步」与进度条一一对应。
     页面倍数/自定秒都存在 localStorage 的 cv.page.<page>.v1。
     ══════════════════════════════════════════════════════════ */
  var SEAT_PARTS = [
    /* 「传递」= 数据包组件自己干完的整段：飞行 + 送达淡出。
       淡出不是在旁边并行的另一件事 —— 包飞到箭头尖、原地淡掉，
       淡完这一趟的「包」就结束了，接下来才轮到落位（串行，不重叠）。 */
    { key: 'travel', label: '传递',     of: ['packDur', 'packFade'], specLabel: '数据包' },
    { key: 'delay',  label: '落位延迟', sec: 0 },
    { key: 'pop',    label: '落位弹跳', of: 'popDur' },
    /* 页面自己的编排节奏：这一趟结束后到下一趟开始之间停多久（不是组件规范） */
    { key: 'hold',   label: '间隔',     sec: 1 }
  ];

  var PAGE_LS = 'cv.page.';
  CV.pageOvRead = function (page) {
    try { return JSON.parse(localStorage.getItem(PAGE_LS + page + '.v1')) || {}; }
    catch (e) { return {}; }
  };
  CV.pageOvSave = function (page, ov) {
    try { localStorage.setItem(PAGE_LS + page + '.v1', JSON.stringify(ov)); } catch (e) {}
  };
  CV.pageOvClear = function (page) {
    try { localStorage.removeItem(PAGE_LS + page + '.v1'); } catch (e) {}
  };

  CV.choreo = function (page, segs) {
    var ov = CV.pageOvRead(page);
    var speed = (CV.params && CV.params.get('global', 'pageSpeed')) || 1;
    if (!(speed > 0)) speed = 1;

    function num(v) { return (typeof v === 'number' && isFinite(v) && v >= 0) ? v : null; }

    /* 一段怎么取值：of → 规范值 × 倍数；否则 → 本页自填秒数。
       of 可以是一组键（传递 = packDur + packFade）：一个倍数管整段，
       subs 留着给页面拆「飞到哪一刻」（travelEnd），齿轮上则只显示合计。
       store 是它在 localStorage 里的键（自定秒加 .sec 后缀，避免与倍数撞车）。 */
    function part(p) {
      if (p.of) {
        var keys = Object.prototype.toString.call(p.of) === '[object Array]' ? p.of : [p.of];
        var k = num(ov[p.key]);
        if (k == null) k = (p.k == null ? 1 : p.k);
        var subs = [], spec = 0, sec = 0;
        keys.forEach(function (kk) {
          var v = CV.specVal(kk);
          subs.push({ key: kk, spec: v, sec: v * k });
          spec += v; sec += v * k;
        });
        return { key: p.key, label: p.label, mode: 'spec', of: p.of, ofList: keys,
                 specLabel: keys.length > 1 ? (p.specLabel || keys.join('+')) : keys[0],
                 spec: Math.round(spec * 1000) / 1000,
                 k: k, sec: Math.round(sec * 1000) / 1000,
                 subs: subs, store: p.key, def: 1 };
      }
      var s = num(ov[p.key + '.sec']);
      if (s == null) s = (p.sec == null ? 0 : p.sec);
      return { key: p.key, label: p.label, mode: 'abs',
               sec: s, store: p.key + '.sec', def: (p.sec == null ? 0 : p.sec) };
    }

    function noText(arr) {
      return arr.length > 1 ? arr[0] + '–' + arr[arr.length - 1] : String(arr[0]);
    }

    var items = [], total = 0, no = 0;

    segs.forEach(function (sg) {
      no += 1;                      /* 步骤号 = 进度条第几段，顺序完全一致 */
      if (sg.kind === 'transfer') {
        var run = 0;
        var parts = SEAT_PARTS.map(function (p) {
          var o = part(p);
          o.no = no;
          o.s = total + run;
          run += o.sec;
          o.e = total + run;
          return o;
        });
        /* 「传递」这一段内部还能拆两步：先飞到箭头尖，再原地淡掉（送达淡出）。
           飞到哪一刻由 packDur 决定，淡多久由 packFade 决定，两者共用一个倍数。 */
        var p0 = parts[0];
        var flySec = (p0.subs && p0.subs.length) ? p0.subs[0].sec : p0.sec;
        items.push({
          id: sg.id, kind: 'transfer', no: no, text: sg.text, short: sg.short,
          s: total, e: total + run, parts: parts,
          travelEnd: p0.s + flySec,                  /* 飞到箭头尖（包还在） */
          fadeEnd:   p0.e,                           /* 淡完（包消失）= 传递段结束 */
          seatStart: p0.e + parts[1].sec,            /* 开始落位：延迟结束，弹跳起点 */
          seatEnd:   p0.e + parts[1].sec + parts[2].sec
        });
        total += run;
      } else {
        var w = part({ key: sg.id, label: sg.label, of: sg.of, sec: sg.sec, k: sg.k });
        w.no = no;
        w.s = total;
        items.push({ id: sg.id, kind: 'wait', no: no, text: sg.text, short: sg.short,
                     s: total, e: total + w.sec, sec: w.sec, row: w });
        total += w.sec;
      }
    });

    /* ── 齿轮面板的行：按步骤顺序排，transfer 的一组放在它第一次出现的那个位置 ── */
    var rows = [], grouped = false;
    var transfers = items.filter(function (it) { return it.kind === 'transfer'; });
    var tNos = transfers.map(function (it) { return it.no; });

    items.forEach(function (it) {
      if (it.kind === 'transfer') {
        if (grouped) return;        /* 多趟共用同一组倍数，只出一组 */
        grouped = true;
        rows.push({
          type: 'group',
          label: '数据传递' + (tNos.length > 1 ? ' ×' + tNos.length : ''),
          noTxt: noText(tNos),
          note: '每趟共用这一组',
          rows: it.parts
        });      } else {
        rows.push(it.row);
      }
    });

    /* 归一化字幕 steps（喂 controls）+ 墙钟窗口（喂 paint，已按 pageSpeed 缩放） */
    var steps = [], win = {};
    items.forEach(function (it) {
      steps.push({ t: total ? it.s / total : 0, text: it.text, short: it.short });
      var w = { s: it.s / speed, e: it.e / speed, kind: it.kind };
      if (it.kind === 'transfer') {
        w.travelEnd = it.travelEnd / speed;
        w.fadeEnd   = it.fadeEnd / speed;
        w.fadeSec   = (it.fadeEnd - it.travelEnd) / speed;
        w.seatStart = it.seatStart / speed;
        w.seatEnd   = it.seatEnd / speed;
        w.popSec    = (it.seatEnd - it.seatStart) / speed;
      }
      win[it.id] = w;
      it.win = w;
    });

    return {
      page: page,
      total: total,          /* 规范秒（未缩放） */
      speed: speed,
      steps: steps,
      win: win,
      items: items,
      rows: rows,            /* 齿轮面板用 */
      at: function (sec) { return total ? sec / total : 0; }
    };
  };

  /* ── 规范时间轴：段用「秒」声明，t 与总时长都是算出来的 ──
     segs = [{ sec, text, short }]，返回 { total(秒), steps(带 t), at(sec)→0..1 }
     controls 按 Δt 分配进度条宽度 → 每段宽度 = 该段真实秒数。 */
  CV.timeline = function (segs) {
    var total = 0;
    segs.forEach(function (s) { total += s.sec; });
    var acc = 0;
    var steps = segs.map(function (s) {
      var st = { t: total ? acc / total : 0, text: s.text };
      if (s.short) st.short = s.short;
      acc += s.sec;
      return st;
    });
    return {
      total: total,
      steps: steps,
      at: function (sec) { return total ? sec / total : 0; }
    };
  };

  /* ── 滑行时长可随线长变：规范给的是「基准线长下飞 packDur」，
     线更长就飞更久（速度恒定，这正是虚线长短不同时间可以不同的原因）。
     refLen 省略 → 直接返回 packDur。 */
  CV.packFly = function (len, refLen) {
    var d = CV.pack('packDur');
    return (refLen > 0 && len > 0) ? d * len / refLen : d;
  };

  /* 供页面直接取用（不经过 mount 也能拿到文本 helper） */
  CV.primText = mkText;
})(window.CV = window.CV || {});
