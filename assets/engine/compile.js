/* ============================================================
   CommonVisual v2 · L3 引擎 · 编译（剧本 → 帧计划）
   ------------------------------------------------------------
   两种时间轴：
   ① choreo（gather/scatter/broadcast/allgather 用）：
      剧本列节拍（wait / move / copy），move|copy 自动展开成
      飞行（含淡出）→ 落位延迟 → 落位弹跳 → 轮歇 四段；有规范值的段走
      规范值 × 页面倍数，倍数可被齿轮改（cv.cfg.page.v1，页名为键）。
   ② family（reduce/allreduce/reducescatter/alltoall 用）：
      各自的动词（sum/split/move）按规范值 + 编排秒算出显式分段表，
      剧本只给每段的文案；rows 由动词自己构造，同样接时序齿轮。

   两条路径的齿轮行都出自 CV.timeRow：有规范值的段给倍数输入
   （规范改了全站跟），没约定的段直接填秒；覆盖存 cv.cfg.page.v1（单一键，页名为键）。

   产物：{ total, steps, win, rows, beats, family }
   组件不知道任何原语；这一层只认识节拍与秒。
   ============================================================ */
(function (CV) {
  'use strict';

  /* ── 每页时序覆盖：pages-base.js 基线 ← localStorage（单一键，全页合一） ──
     链与全站同构：代码基线文件 ← LS 覆盖；只是 scope 是「页」，键带页名。 */
  var PAGE_LS = 'cv.cfg.page.v1';
  function pageOvAll() {
    try { return JSON.parse(localStorage.getItem(PAGE_LS)) || {}; }
    catch (e) { return {}; }
  }
  function pageOvWrite(all) {
    try { localStorage.setItem(PAGE_LS, JSON.stringify(all)); } catch (e) {}
  }
  CV.pageOvRaw = function (page) { return pageOvAll()[page] || {}; };
  CV.pageOvRead = function (page) {
    var out = {};
    var base = (window.CV_PAGE_DEFAULTS || {})[page];
    if (base) Object.keys(base).forEach(function (k) { out[k] = base[k]; });
    var raw = CV.pageOvRaw(page);
    Object.keys(raw).forEach(function (k) { out[k] = raw[k]; });
    return out;
  };
  CV.pageOvSave = function (page, ov) {
    var all = pageOvAll();
    if (ov && Object.keys(ov).length) all[page] = ov; else delete all[page];
    pageOvWrite(all);
  };
  CV.pageOvClear = function (page) {
    var all = pageOvAll();
    delete all[page];
    pageOvWrite(all);
  };

  /* ── 一行齿轮数据（choreo 与 family 动词共用）──
     p = { key, label, of?, specLabel?, k?, sec? }：
     · 给了 of → 规范行：秒 = 规范值 × 倍数，倍数存 ov[key]
     · 否则 → 自定义行：直接填秒，存 ov[key + '.sec']，def = 代码基线 */
  CV.timeRow = function (page, p) {
    var ov = CV.pageOvRead(page);
    function num(v) { return (typeof v === 'number' && isFinite(v) && v >= 0) ? v : null; }
    if (p.of) {
      var keys = Object.prototype.toString.call(p.of) === '[object Array]' ? p.of : [p.of];
      var k = num(ov[p.key]);
      if (k == null) k = (p.k == null ? 1 : p.k);
      var subs = [], spec = 0, sec = 0;
      keys.forEach(function (kk) {
        var v = CV.spec(kk);
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
  };

  /* ── 一次传递的四段（规范值走倍数，编排秒直接填） ──
     行名全站统一（2026-11-03 拍板）：飞行（含淡出）/ 落位延迟 /
     落位弹跳（括注按 scene.seatPop：单颗|整包|齐弹）/ 轮歇。 */
  var SEAT_PARTS = [
    /* 「飞行」= 数据包组件自己的整段：飞行（packDur）+ 送达淡出（packFade） */
    { key: 'travel', label: '飞行（数据包）', of: ['packDur', 'packFade'], specLabel: '数据包' },
    /* 包停在箭头尖 → 弹跳开始之间的呼吸（页面自定） */
    { key: 'delay',  label: '落位延迟', sec: CV.spec('seatDelay') },
    { key: 'pop',    label: '落位弹跳', of: 'popDur' },
    /* 这一趟结束后到下一趟之间停多久（页面编排） */
    { key: 'hold',   label: '轮歇',     sec: 1 }
  ];
  function popLabel(seatPop) {
    return '落位弹跳' + (seatPop ? '（' + seatPop + '）' : '');
  }

  /* ══════════ choreo：节拍表 → 时间轴（与旧引擎同一套数） ══════════ */
  CV.choreo = function (page, segs) {
    var speed = CV.spec('pageSpeed');
    if (!(speed > 0)) speed = 1;

    function part(p) { return CV.timeRow(page, p); }

    function noText(arr) {
      return arr.length > 1 ? arr[0] + '–' + arr[arr.length - 1] : String(arr[0]);
    }

    var items = [], total = 0, no = 0;

    segs.forEach(function (sg) {
      no += 1;
      if (sg.kind === 'transfer') {
        var run = 0;
        /* 一拍内 n 块错峰落位（beat 声明 stagger: n）：pop 段如实扩成
           popDur + (n−1)×seatGap——SEAT_PARTS 隐含「每趟只落一块」。
           走 of 数组：面板仍按规范值显示、仍调同一根倍数杆；不传 stagger
           照旧。当前无页面声明 stagger（同飞批齐弹，2026-11-01 拍板），
           机制留给将来顺序到达的拍。 */
        var srcs = SEAT_PARTS;
        if (sg.stagger > 1) {
          var ofL = ['popDur'];
          for (var spi = 1; spi < sg.stagger; spi++) ofL.push('seatGap');
          srcs = SEAT_PARTS.slice();
          srcs[2] = { key: 'pop', label: popLabel(sg.seatPop), specLabel: '弹跳+错峰', of: ofL };
        } else if (sg.seatPop) {
          srcs = SEAT_PARTS.slice();
          srcs[2] = { key: 'pop', label: popLabel(sg.seatPop), of: 'popDur' };
        }
        var parts = srcs.map(function (p) {
          var o = part(p);
          o.no = no;
          o.s = total + run;
          run += o.sec;
          o.e = total + run;
          return o;
        });
        var p0 = parts[0];
        var flySec = (p0.subs && p0.subs.length) ? p0.subs[0].sec : p0.sec;
        items.push({
          id: sg.id, kind: 'transfer', no: no, text: sg.text, short: sg.short,
          s: total, e: total + run, parts: parts, note: sg.note,
          travelEnd: p0.s + flySec,
          fadeEnd:   p0.e,
          seatStart: p0.e + parts[1].sec,
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

    /* 齿轮面板的行：transfer 的一组放在第一次出现的位置 */
    var rows = [], grouped = false;
    var transfers = items.filter(function (it) { return it.kind === 'transfer'; });
    var tNos = transfers.map(function (it) { return it.no; });

    items.forEach(function (it) {
      if (it.kind === 'transfer') {
        if (grouped) return;
        grouped = true;
        rows.push({
          type: 'group',
          label: '发送数据' + (tNos.length > 1 ? ' ×' + tNos.length : ''),
          noTxt: noText(tNos),
          note: it.note || '每趟共用这一组',
          rows: it.parts
        });
      } else {
        rows.push(it.row);
      }
    });

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
        /* 单颗弹跳时长（popDur 分量）：错峰页 popSec 是整段窗口，别拿来当
           单颗动画时长；单块页两者相等 */
        w.popOne    = ((it.parts[2].subs && it.parts[2].subs.length)
                          ? it.parts[2].subs[0].sec : it.parts[2].sec) / speed;
      }
      win[it.id] = w;
      it.win = w;
    });

    return {
      page: page,
      total: total,
      speed: speed,
      steps: steps,
      win: win,
      items: items,
      rows: rows,
      at: function (sec) { return total ? sec / total : 0; }
    };
  };

  /* ══════════ 编译入口 ══════════
     scene.gear !== false 且剧本是 wait/transfer 节拍 → choreo 路径；
     scene.family 在（sum/split/move 动词各自声明 timeline）→ family 路径。 */
  CV.engine = CV.engine || {};

  CV.engine.compile = function (scene) {
    var page = scene.id;

    /* alltoall 家族的 timeline 挂在 move 动词上，其余家族挂各自的动词 */
    var fam = scene.family === 'alltoall' ? CV.verbs.move : CV.verbs[scene.family];
    if (scene.family && fam && fam.timeline) {
      var tl = fam.timeline(scene);
      tl.family = scene.family;
      tl.page = page;
      tl.rows = tl.rows || [];
      tl.raw = true;               /* family 页时长在下面自除 pageSpeed（不再豁免） */

      /* family 页也吃 pageSpeed（2026-11-02，用户拍板「所有特效都按规范来」）：
         编译末对整棵时间轴做时间变换（行秒 / 锚点 / 画面窗口同除 speed），
         与 choreo 页（choreo() 内同款变换）同一口径。speed=1 时零操作。 */
      var speed = CV.spec('pageSpeed');
      if (speed > 0 && speed !== 1) {
        /* 锚点（COLLAPSE_AT / EXPAND_AT）与窗口时长键同除 —— 漏一个就会出现
           「窗口在缩放系、锚点在原系」的混系错位（narrate 闭合断言当场抓过） */
        var TF = { s: 1, e: 1, sec: 1, start: 1, end: 1, arrive: 1, popStart: 1, popEnd: 1,
                   growEnd: 1, mergeEnd: 1, mergeStart: 1, calcStart: 1, calcEnd: 1,
                   fadeEnd: 1, seatStart: 1, seatEnd: 1, seatBase: 1, done: 1,
                   travelEnd: 1, fadeSec: 1, stag: 1,
                   COLLAPSE_AT: 1, EXPAND_AT: 1, POP_SPAN: 1,
                   POP: 1, SEATG: 1, FUSE: 1, MGAP: 1,
                   CALC_UP: 1, CALC_DOWN: 1, CALC_FADE: 1,
                   init: 1, prealloc: 1, fly: 1, land: 1, pop: 1,
                   growCalc: 1, merge: 1, calcDown: 1, gap: 1,
                   grow: 1, shrink: 1, collapse: 1 };
        var seen = [];   /* split.js 的 AT/win 共享同一窗口对象 —— 同一引用只缩一次 */
        (function walk(o) {
          if (!o || typeof o !== 'object') return;
          if (seen.indexOf(o) >= 0) return;
          seen.push(o);
          if (Array.isArray(o)) { o.forEach(walk); return; }
          Object.keys(o).forEach(function (k) {
            var v = o[k];
            if (typeof v === 'number' && TF[k]) o[k] = v / speed;
            else if (v && typeof v === 'object') walk(v);
          });
        })(tl);
        if (typeof tl.total === 'number') tl.total = tl.total / speed;
        /* at() 闭包里是旧 total，缩放后按新 total 重绑 */
        var T2 = tl.total;
        tl.at = function (sec) { return T2 ? sec / T2 : 0; };
      }
      tl.speed = speed;   /* narration 自算跨度要与 CH 同系（speed=1 时零操作） */
      return tl;
    }

    var segs = scene.beats.map(function (b) {
      if (b.kind === 'wait') {
        return { id: b.id, kind: 'wait', label: b.label || '说明', sec: b.sec, text: b.text, short: b.short };
      }
      return { id: b.id, kind: 'transfer', label: b.label, text: b.text, short: b.short,
               stagger: b.stagger, note: b.note, seatPop: scene.seatPop };
    });
    var ch = CV.choreo(page, segs);
    ch.beats = scene.beats;
    ch.family = null;
    return ch;
  };
})(window.CV = window.CV || {});
