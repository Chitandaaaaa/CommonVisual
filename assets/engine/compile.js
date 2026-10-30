/* ============================================================
   CommonVisual v2 · L3 引擎 · 编译（剧本 → 帧计划）
   ------------------------------------------------------------
   两种时间轴：
   ① choreo（gather/scatter/broadcast/allgather 用）：
      剧本列节拍（wait / move / copy），move|copy 自动展开成
      传递 → 落位延迟 → 落位弹跳 → 间隔 四段；有规范值的段走
      规范值 × 页面倍数，倍数可被齿轮改（cv.page.<页>.v1）。
   ② family（reduce/allreduce/reducescatter/alltoall 用）：
      各自的动词（sum/split/move）按规范值 + 编排秒算出显式分段表，
      剧本只给每段的文案；rows 由动词自己构造，同样接时序齿轮。

   两条路径的齿轮行都出自 CV.timeRow：有规范值的段给倍数输入
   （规范改了全站跟），没约定的段直接填秒；覆盖存 cv.page.<页>.v1。

   产物：{ total, steps, win, rows, beats, family }
   组件不知道任何原语；这一层只认识节拍与秒。
   ============================================================ */
(function (CV) {
  'use strict';

  /* ── 每页时序覆盖：代码基线（CV_PAGE_DEFAULTS）← localStorage 临时改动 ── */
  var PAGE_LS = 'cv.page.';
  CV.pageOvRaw = function (page) {
    try { return JSON.parse(localStorage.getItem(PAGE_LS + page + '.v1')) || {}; }
    catch (e) { return {}; }
  };
  CV.pageOvRead = function (page) {
    var out = {};
    var base = (window.CV_PAGE_DEFAULTS || {})[page];
    if (base) Object.keys(base).forEach(function (k) { out[k] = base[k]; });
    var raw = CV.pageOvRaw(page);
    Object.keys(raw).forEach(function (k) { out[k] = raw[k]; });
    return out;
  };
  CV.pageOvSave = function (page, ov) {
    try { localStorage.setItem(PAGE_LS + page + '.v1', JSON.stringify(ov)); } catch (e) {}
  };
  CV.pageOvClear = function (page) {
    try { localStorage.removeItem(PAGE_LS + page + '.v1'); } catch (e) {}
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
  };

  /* ── 一次传递的四段（规范值走倍数，编排秒直接填） ── */
  var SEAT_PARTS = [
    /* 「传递」= 数据包组件自己的整段：飞行（packDur）+ 送达淡出（packFade） */
    { key: 'travel', label: '传递',     of: ['packDur', 'packFade'], specLabel: '数据包' },
    /* 包停在箭头尖 → 弹跳开始之间的呼吸（页面自定） */
    { key: 'delay',  label: '落位延迟', sec: 0.5 },
    { key: 'pop',    label: '落位弹跳', of: 'popDur' },
    /* 这一趟结束后到下一趟之间停多久（页面编排） */
    { key: 'hold',   label: '间隔',     sec: 1 }
  ];

  /* ══════════ choreo：节拍表 → 时间轴（与旧引擎同一套数） ══════════ */
  CV.choreo = function (page, segs) {
    var speed = (CV.params && CV.params.get('global', 'pageSpeed')) || 1;
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
        var parts = SEAT_PARTS.map(function (p) {
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
          s: total, e: total + run, parts: parts,
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
          label: '数据传递' + (tNos.length > 1 ? ' ×' + tNos.length : ''),
          noTxt: noText(tNos),
          note: '每趟共用这一组',
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
      tl.raw = true;               /* 家庭页不乘 pageSpeed（与现页面一致） */
      return tl;
    }

    var segs = scene.beats.map(function (b) {
      if (b.kind === 'wait') {
        return { id: b.id, kind: 'wait', label: b.label || '说明', sec: b.sec, text: b.text, short: b.short };
      }
      return { id: b.id, kind: 'transfer', label: b.label, text: b.text, short: b.short };
    });
    var ch = CV.choreo(page, segs);
    ch.beats = scene.beats;
    ch.family = null;
    return ch;
  };
})(window.CV = window.CV || {});
