/* ============================================================
   CommonVisual · 绘制原语
   卡片 / 数据块 / 连线 / 数据包 / 图例 / 落位脉冲
   全部只依赖参数，不含任何原语特有的时间轴逻辑
   ============================================================ */
(function (CV) {
  'use strict';
  var el = CV.el;

  /* ---------- 参数注册表：把关键动效参数从字面量变成可实时调 / 锁 / 跨页的配置 ----------
     结构：SCHEMA[section].keys[key] = { label, unit, def, min, max, step }
     加载顺序（后者覆盖前者）：
       ① 代码内置 def（本处 SCHEMA）
       ② tokens.js 的 window.CV_PARAM_DEFAULTS（可提交、固化基线，kit 之前加载）
       ③ localStorage 的运行时调试覆盖（调试时实时生效，清缓存即恢复基线）
     面板（paramEditor.js，仅规范页）改的是 ③；「保存到代码」把当前值写进 ② 固化。
     各章节的 draw 函数通过 CV.params.get(section, key) 取值，从而支持实时重画与跨页生效。
     后续新增参数只需在此 SCHEMA 加一项；原语页重构后统一消费此处键值。 */
  CV.params = (function () {
    var LS_KEY = 'cv.params.v1';

    var SCHEMA = {
      /* 卡片动态组件规范（03 那一节的 rank 卡片长高 / 数据块增减）。
         属于规范的只有「这个组件自己要花掉的时间」和「块之间的节奏」：
         · cardDur  卡片上下变宽（与收回）一次花多少时间
         · blockDur 单个数据块出现 / 消失的时长
         · blockGap 相邻两块之间的间隔（块间留白，读出「一个一个来」而不挤在一起）
         更细的「长够之后再放块 / 撤完之后再收卡」那段衔接是页面编排，
         不在规范里、不进调试台（固定 0.3 / 0.25 秒）。 */
      '03-card': {
        label: '卡片动态',
        anchor: 'sub-03-2',
        groups: [
          { label: '耗时', keys: ['cardDur', 'blockDur'] },
          { label: '节奏', keys: ['blockGap'] }
        ],
        keys: {
          cardDur:  { label: '卡片伸缩', unit: 's', def: 1.3,  min: 0.3, max: 3,   step: 0.05 },
          blockDur: { label: '单块时长', unit: 's', def: 0.55, min: 0.1, max: 1.5, step: 0.05 },
          blockGap: { label: '块间隔',   unit: 's', def: 0.15, min: 0,   max: 0.6, step: 0.01 }
        }
      },
      /* 数据包组件规范：规范页 05 定的数，所有页面照这个实现（唯一来源）
         groups 只负责「面板上怎么分组」（按定义顺序），keys 仍是扁平索引，get/set 路径不变。
         耗时 = 这个组件自己要花掉多少时间；特效 = 不改时长、只改观感的量。 */
      '05-packet': {
        label: '数据包·动态',
        anchor: 'sub-05-3',
        groups: [
          { label: '耗时', keys: ['packDur', 'packFade'] },
          { label: '特效', keys: ['packLead', 'trailDist', 'trailScale'] }
        ],
        keys: {
          packDur:    { label: '飞行时长', unit: 's',  def: 1.5, min: 0.3, max: 4,   step: 0.1 },
          /* 包飞到终点后原地淡掉 —— 这段既是「淡出」也是「停留」，
             不再单列一个「落点停留」：停留不是额外等一段，就是淡出的过程。 */
          packFade:   { label: '送达淡出', unit: 's',  def: 0.6, min: 0,   max: 3,   step: 0.05 },
          packLead:   { label: '起步让出', unit: '',   def: 0.16, min: 0,  max: 0.5, step: 0.01 },
          trailDist:  { label: '拖尾退后', unit: 'px', def: 24,  min: 8,   max: 60,  step: 1 },
          trailScale: { label: '拖尾浓度', unit: '×',  def: 1,   min: 0,   max: 2,   step: 0.05 }
        }
      },
      /* 落位组件规范（08 那一节的 .slot-pop）。
         属于规范的只有两件「这个组件自己的事」：一次弹多久、一批里多个块怎么错开。
         · popDur   一次弹跳的时长
         · seatGap  同一批多个块依次落位时，相邻两块错开多久（0 = 齐刷刷一起弹）
         到达终点到开始弹跳之间的「落位延迟」**不是规范值** ——
         那是每页自己排的节奏，在页面齿轮里直接填秒，不走这里。 */
      '08-seat': {
        label: '落位弹跳',
        anchor: 'sub-08-1',
        groups: [
          { label: '耗时', keys: ['popDur'] },
          { label: '节奏', keys: ['seatGap'] }
        ],
        keys: {
          popDur:  { label: '弹跳时长', unit: 's', def: 0.55, min: 0.1, max: 1.5, step: 0.05 },
          /* 一批块「一个一个落」的错峰量。它不是「两趟传递之间停多久」——
             那个是页面编排，在齿轮里填秒；这里管的是同一批内部的先后。
             默认 .5s：四块一批就是 1.5s 的先后，读得出「一个接一个」而不拖沓。 */
          seatGap: { label: '多块错峰', unit: 's', def: 0.5,  min: 0,    max: 0.8, step: 0.01 }
        }
      },
      /* 融合组件规范：09 那一节的 createMerge。
         一次融合 = 唤醒 → 上浮 → 注入，位移↑ / 缩放↓ / 透明度↓ 三个量全单调；
         和「落位弹跳」相反（那个是 无→有，靠过冲），所以参数不能共用。

         只有「一次融合多长时间」是组件耗时，多列依次融合时错开多久也是组件自己的节奏
         （mergeGap，和 08 的 seatGap 同一层级）；「这一趟折完到下一趟开始」才是页面编排。
         关键帧是归一化进度（0~1），改它等于改这条曲线的形状，不是改时长。 */
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
          /* 多列（多段）依次融合时，相邻两列错开多久。
             0 = 四列一齐折进去；给个小数才读得出「一列一列来」。
             默认 .5s ≥ fuseDur(.42)，所以是严格串行：一列折完才轮到下一列，
             不会两列同时在飞（同时飞就读不出「逐段折进累加器」了）。 */
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
      /* 全局播放：不改变任何组件规范，只改「同一套时间轴播多快」 */
      global: {
        label: '全局播放',
        keys: {
          pageSpeed: { label: '播放速度', unit: '×', def: 1, min: 0.3, max: 2.5, step: 0.1 }
        }
      }
    };

    var listeners = [];
    var values = {};
    var baseline = {};      /* 代码基线（tokens.js 覆盖后的值）—— ↺ 回的是这里，不是内置 def */

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
    /* 重置：单参 / 单节 / 全部（全部先清 localStorage 再 seed，回到 tokens 基线） */
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
        /* 这里不要再 persist：values 现在就是代码基线本身，
           写回 localStorage 等于把基线复制成一份「临时改动」，
           下次改 tokens.js 反而被这份旧副本盖住。 */
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

  /* ---------- 保存基线文件：优先直写磁盘 ----------
     浏览器自己不能改文件。以前「保存到代码」只能下载一份 pages.js，
     还得手动挪回 assets/cv/ —— 点了没反应、多出一个下载文件，像失败了。

     本地服务（tools/serve.mjs）开了写盘端点，这里先走它：文件当场被覆盖，
     刷新别人也能看到。用 python -m http.server / 双击 html 打开时没有这个端点，
     才退回下载，并把原因说清楚（别默默丢一个文件进「下载」文件夹）。 */
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
        else download('endpoint');       /* 静态服务没有写盘能力（501/404） */
      });
    }).catch(function () { download('network'); });
  };

  /* ---------- 徽章几何：drawCard 与 resizeCard 共用 ----------
     「src」三个字母挤在 22×14 的小框里，文字几乎贴着边框。
     这里把框放大到 28×18，并让文字的垂直位置按新框高重算。
     传 text 则按文字长度算宽度（all-gather 用「1/4」这种进度徽章）。 */
  function badgeGeo(geo, role, text, size, hdr) {
    var h = 18, w;
    if (text) w = Math.max(30, Math.round(text.length * size * 0.60) + 18);
    else w = role === 'dst' ? 30 : 28;
    return {
      w: w, h: h,
      x: geo.x + geo.w - 14 - w,
      y: geo.y + (hdr - h) / 2
    };
  }

  /* ---------- 卡片：白底 + 彩色标题条 + 角色徽章 ---------- */
  CV.drawCard = function (parent, o) {
    var geo = o.geo, r = o.radius == null ? 14 : o.radius;
    var hdr = o.hdr, isTarget = !!o.target;

    var g = el('g', { class: 'gpu-card', 'data-card': o.key }, parent);

    var base = el('rect', {
      class: 'card-base',
      x: geo.x, y: geo.y, width: geo.w, height: geo.h, rx: r,
      fill: '#fff', stroke: isTarget ? '#c9b6f7' : '#e3e7f0',
      'stroke-width': isTarget ? 1.8 : 1, filter: 'url(#fCard)'
    }, g);

    /* 标题条：上两角随卡片圆角，下边平直 */
    var bar = el('path', {
      class: 'card-bar',
      d: 'M ' + geo.x + ' ' + (geo.y + hdr) +
         ' L ' + geo.x + ' ' + (geo.y + r) +
         ' A ' + r + ' ' + r + ' 0 0 1 ' + (geo.x + r) + ' ' + geo.y +
         ' L ' + (geo.x + geo.w - r) + ' ' + geo.y +
         ' A ' + r + ' ' + r + ' 0 0 1 ' + (geo.x + geo.w) + ' ' + (geo.y + r) +
         ' L ' + (geo.x + geo.w) + ' ' + (geo.y + hdr) + ' Z',
      fill: o.color
    }, g);

    var title = el('text', {
      class: 'gpu-title', x: geo.x + 16, y: geo.y + hdr * 0.68,
      'text-anchor': 'start', 'font-size': o.titleSize, fill: '#fff'
    }, g);
    title.textContent = o.title;

    var badgeBg = null, badgeTx = null;
    if (o.role || o.badgeText) {
      var bg = badgeGeo(geo, o.role, o.badgeText, o.badgeSize, hdr);
      badgeBg = el('rect', {
        class: 'card-badge-bg',
        x: bg.x, y: bg.y, width: bg.w, height: bg.h, rx: 6,
        fill: 'rgba(255,255,255,.26)'
      }, g);
      badgeTx = el('text', {
        class: 'dst-badge', x: bg.x + bg.w / 2, y: bg.y + bg.h / 2 + o.badgeSize * 0.25,
        'text-anchor': 'middle', 'font-size': o.badgeSize, fill: '#fff'
      }, g);
      badgeTx.textContent = o.badgeText || o.role;
    }

    return { g: g, geo: geo, base: base, bar: bar, title: title, badgeBg: badgeBg, badgeTx: badgeTx,
             radius: r, hdr: hdr, role: o.role, badgeText: o.badgeText, badgeSize: o.badgeSize };
  };

  /* ---------- 卡片尺寸变化时重画 ----------
     白底矩形、彩色标题条、标题文字、角色徽章都要跟着新的 geo 走。
     用于「卡片随时间轴长高」这类场景（reduce 的目标卡要预留第二排缓冲）。 */
  CV.resizeCard = function (card, geo) {
    var r = card.radius, hdr = card.hdr, g = card.geo;

    card.base.setAttribute('x', geo.x);
    card.base.setAttribute('y', geo.y);
    card.base.setAttribute('width', geo.w);
    card.base.setAttribute('height', geo.h);

    card.bar.setAttribute('d',
      'M ' + geo.x + ' ' + (geo.y + hdr) +
      ' L ' + geo.x + ' ' + (geo.y + r) +
      ' A ' + r + ' ' + r + ' 0 0 1 ' + (geo.x + r) + ' ' + geo.y +
      ' L ' + (geo.x + geo.w - r) + ' ' + geo.y +
      ' A ' + r + ' ' + r + ' 0 0 1 ' + (geo.x + geo.w) + ' ' + (geo.y + r) +
      ' L ' + (geo.x + geo.w) + ' ' + (geo.y + hdr) + ' Z');

    card.title.setAttribute('x', geo.x + 16);
    card.title.setAttribute('y', geo.y + hdr * 0.68);

    if (card.badgeBg) {
      var bg = badgeGeo(geo, card.role, card.badgeText, card.badgeSize, hdr);
      card.badgeBg.setAttribute('x', bg.x);
      card.badgeBg.setAttribute('y', bg.y);
      card.badgeBg.setAttribute('width', bg.w);
      card.badgeBg.setAttribute('height', bg.h);
      card.badgeTx.setAttribute('x', bg.x + bg.w / 2);
      card.badgeTx.setAttribute('y', bg.y + bg.h / 2 + card.badgeSize * 0.25);
    }

    g.x = geo.x; g.y = geo.y; g.w = geo.w; g.h = geo.h;
  };

  /* ---------- 数据块（缓冲槽） ---------- */
  CV.drawSlot = function (parent, x, y, w, h) {
    var g = el('g', { class: 'slot-g' }, parent);
    var rect = el('rect', {
      class: 'slot-bg', x: x, y: y, width: w, height: h, rx: 8,
      fill: '#f7f8fc', stroke: '#d5dae8', 'stroke-width': 1.3, 'stroke-dasharray': '4 3'
    }, g);
    var text = el('text', {
      class: 'slot-tx', x: x + w / 2, y: y + h / 2, 'text-anchor': 'middle',
      'dominant-baseline': 'central',
      /* 字母 = 0.33 × 块高 —— 46 → 15 / 25 → 8。请勿在 CSS 里再钉字号：
         .slot-tx 一旦写死 font-size 就会盖掉这条属性，窄屏 25 的块里会顶着 15 的字 */
      'font-size': Math.round(h * 0.33), fill: '#b9c0d2'
    }, g);
    return { g: g, rect: rect, text: text, x: x, y: y, w: w, h: h, cx: x + w / 2, cy: y + h / 2 };
  };

  /* 三种状态：有数据 / 传输中占位 / 空
     data.sub 可选：给数据块加一个右下角小下标（all-to-all 用它标第几片） */
  CV.setSlot = function (s, data, opt) {
    opt = opt || {};
    if (data) {
      s.rect.setAttribute('fill', data.color);
      s.rect.setAttribute('stroke', 'none');
      s.rect.setAttribute('stroke-dasharray', 'none');
      s.text.setAttribute('fill', '#fff');
      s.text.textContent = data.letter;
      if (data.sub != null) {
        var sp = el('tspan', { 'font-size': '0.62em', dy: '0.34em' }, s.text);
        sp.textContent = data.sub;
      }
      if (s.g.getAttribute('data-l') !== data.letter) s.g.setAttribute('data-l', data.letter);
    } else if (opt.active) {
      s.rect.setAttribute('fill', '#f3eeff');
      s.rect.setAttribute('stroke', '#a78bfa');
      s.rect.setAttribute('stroke-dasharray', 'none');
      s.text.setAttribute('fill', '#a78bfa');
      s.text.textContent = '···';
      if (s.g.hasAttribute('data-l')) s.g.removeAttribute('data-l');
    } else {
      s.rect.setAttribute('fill', '#f7f8fc');
      s.rect.setAttribute('stroke', '#d5dae8');
      s.rect.setAttribute('stroke-dasharray', '4 3');
      s.text.setAttribute('fill', '#b9c0d2');
      s.text.textContent = '';
      if (s.g.hasAttribute('data-l')) s.g.removeAttribute('data-l');
    }
    /* 预留中的空位可以先隐藏（数据块淡入用） */
    s.g.style.opacity = opt.hidden ? '0' : '';
  };

  /* ---------- 箭头 marker（放在 defs 里，每个数据流一个） ---------- */
  CV.drawMarker = function (defs, id, letter) {
    var mk = el('marker', {
      id: id, viewBox: '0 0 8 8', refX: 8, refY: 4,
      markerWidth: 5.5, markerHeight: 5.5, orient: 'auto'
    }, defs);
    var attrs = { class: 'arw', d: 'M0,0 L8,4 L0,8 Z', fill: '#c3cadb' };
    if (letter) attrs['data-l'] = letter;
    var p = el('path', attrs, mk);
    return { marker: mk, path: p };
  };

  /* ---------- 连线 ---------- */
  /* letter 可省略：broadcast 这类「整份数据」的流不对应单一字母，不该参与聚焦灰化
     markerId 也可省略：all-to-all 的边是双向直连，画箭头反而会指错方向 */
  CV.drawWire = function (parent, o) {
    var attrs = {
      class: 'wire', d: o.d, fill: 'none',
      stroke: '#c3cadb', 'stroke-width': 2,
      'stroke-linecap': 'round', 'stroke-dasharray': '8 7'
    };
    if (o.markerId) attrs['marker-end'] = 'url(#' + o.markerId + ')';
    if (o.letter) attrs['data-l'] = o.letter;
    var p = el('path', attrs, parent);
    return { path: p, len: p.getTotalLength() };
  };

  /* 拖尾浓度倍数：规范 05 的 trailScale（默认 1 = 原有 .55/.28 与 .48/.24） */
  function trailK() {
    var s = CV.params && CV.params.get('05-packet', 'trailScale');
    return (typeof s === 'number') ? s : 1;
  }

  /* ---------- 飞行中的数据包：主体 + 两段拖尾 ---------- */
  CV.drawPacket = function (parent, o) {
    var k = trailK();
    var g = el('g', { class: 'pkt', 'data-l': o.letter, opacity: 0 }, parent);
    var t2 = el('g', { opacity: .28 * k }, g);
    el('rect', { x: -8, y: -8, width: 16, height: 16, rx: 4.5, fill: o.color, filter: 'url(#fTrail)' }, t2);
    var t1 = el('g', { opacity: .55 * k }, g);
    el('rect', { x: -10, y: -10, width: 20, height: 20, rx: 5.5, fill: o.color, filter: 'url(#fTrail)' }, t1);
    var head = el('g', {}, g);
    el('rect', { x: -12, y: -12, width: 24, height: 24, rx: 6.5, fill: o.color, filter: 'url(#fGlow)' }, head);
    el('text', { class: 'pkt-tx', x: 0, y: 4.5, 'text-anchor': 'middle' }, head).textContent = o.letter;
    return { g: g, head: head, t1: t1, t2: t2 };
  };

  /* ---------- 整份数据包：「一份」数据的缩略条 ----------
     结构与 drawPacket 一致（g / head / t1 / t2），可直接交给 placePacket。
     用于 broadcast / reduce 这类以「整份数据」为单位移动的原语。
     half = 主体半宽，用于算起步偏移，避免大包从卡片边缘起步时压住卡片内容。 */
  CV.drawPacketBatch = function (parent, slot, items) {
    var m  = Math.round(slot.sw * 0.44);              /* 正方形边长，与槽位块同一形状语言 */
    var mg = Math.max(2, Math.round(slot.gap * 0.25));
    var rx = Math.max(3, Math.round(m * 0.25));
    var total = items.length * m + (items.length - 1) * mg;
    var pad = Math.round(m * 0.30);

    var g = el('g', { class: 'pkt batch', opacity: 0 }, parent);

    /* 每个小方块各自带 data-l，悬停时才跟着一起高亮 / 变灰。
       withText：只有主体带字母，拖尾是模糊影，带字会糊。 */
    function blocks(host, extra, withText) {
      items.forEach(function (d, i) {
        var bg = el('g', { 'data-l': d.letter }, host);
        var bx = -total / 2 + i * (m + mg);
        var attrs = { x: bx, y: -m / 2, width: m, height: m, rx: rx, fill: d.color };
        if (extra) attrs.filter = extra;
        el('rect', attrs, bg);
        if (withText) {
          var tx = el('text', {
            class: 'pkt-tx', x: bx + m / 2, y: 0,
            'text-anchor': 'middle', 'dominant-baseline': 'central'
          }, bg);
          /* .pkt-tx 的 CSS 固定 13px 是按 24px 方块调的，这里块更小，
             用内联 style 覆盖字号（style 优先级高于类） */
          tx.style.fontSize = Math.max(7, Math.round(m * 0.55)) + 'px';
          tx.textContent = d.letter;
        }
      });
    }

    /* 拖尾：只画色块，不画底板，否则白色底板叠在一起会糊成一片 */
    var k = trailK();
    var t2 = el('g', { opacity: .24 * k }, g);
    var t1 = el('g', { opacity: .48 * k }, g);
    blocks(t2, 'url(#fTrail)');
    blocks(t1, 'url(#fTrail)');

    /* 主体：白底板把几段收成「一份」 */
    var head = el('g', {}, g);
    el('rect', {
      x: -total / 2 - pad, y: -m / 2 - pad,
      width: total + pad * 2, height: m + pad * 2,
      rx: Math.round((m + pad * 2) * 0.32),
      fill: '#fff', 'fill-opacity': .97, filter: 'url(#fGlow)'
    }, head);
    blocks(head, null, true);

    return { g: g, head: head, t1: t1, t2: t2, half: total / 2 + pad };
  };

  /* 把数据包放到路径的 e（0~1）处
     rev = true 时沿路径反向走（线是按 a→b 画的，流却从 b→a） */
  CV.placePacket = function (pkt, wire, e, rev) {
    var Lp = wire.len;
    var pos = rev ? 1 - e : e;
    var at = pos * Lp;
    var pt = wire.path.getPointAtLength(at);
    /* 入场渐显：前 8% 行程把 opacity 从 0 推到 1。
       注意 e 是**缓动后**的进度，起步慢 —— 1.5s 的飞行里这段约 0.3s，不是 0.12s。
       必须写在 JS 里：交给 CSS transition 会和「到达后逐帧淡出」抢同一个属性，
       淡出那段就被过渡拖成「先停住、最后突然消失」。 */
    pkt.g.setAttribute('opacity', String(e <= 0 ? 0 : Math.min(1, e / 0.08)));
    pkt.head.setAttribute('transform', 'translate(' + pt.x + ' ' + pt.y + ')');
    /* 拖尾永远在「来路」上，所以反向走时要往后加而不是减。
       拖尾退后距离 = 参数 trailDist（默认 24），远端按原比例 46/24 跟随；默认即原值，不改任何页面观感。 */
    var step = rev ? 1 : -1;
    var near = (CV.params && CV.params.get('05-packet', 'trailDist')) || 24;
    var far = near * (46 / 24);
    var a = wire.path.getPointAtLength(Math.max(0, Math.min(Lp, at + step * near)));
    var b = wire.path.getPointAtLength(Math.max(0, Math.min(Lp, at + step * far)));
    pkt.t1.setAttribute('transform', 'translate(' + a.x + ' ' + a.y + ') scale(.8)');
    pkt.t2.setAttribute('transform', 'translate(' + b.x + ' ' + b.y + ') scale(.6)');
    /* 拖尾随行进方向略微拉长，速度感更足 */
    wire.path.setAttribute('stroke-dashoffset', String(-e * 110));
  };

  /* 送达后淡出：包停在终点，透明度按「已过秒数 / 淡出时长」线性降到 0。
     默认时长取规范 05 的 packFade（飞 1.5s 之后淡 .6s —— 这一段同时就是「停留」，
     包原地消失，没有额外的停留段）。packFade = 0 时等价于一步隐藏。

     durSec 可选：页面把「数据包」当成一整段（飞 + 淡）给了倍数时，
     淡出也得跟着那个倍数走，此时传入自己算好的墙钟秒数，就不再乘 pageSpeed
     （传进来的已经是最终秒）。不传则按规范 packFade / pageSpeed。 */
  CV.pktFadeOut = function (pkt, elapsedSec, durSec) {
    var d;
    if (typeof durSec === 'number') {
      d = durSec;
    } else {
      var sp = (CV.params && CV.params.get('global', 'pageSpeed')) || 1;
      d = ((CV.params && CV.params.get('05-packet', 'packFade')) || 0) / (sp > 0 ? sp : 1);
    }
    if (!(d > 0)) { pkt.g.setAttribute('opacity', '0'); return; }
    var o = 1 - elapsedSec / d;
    pkt.g.setAttribute('opacity', o <= 0 ? '0' : String(Math.round(o * 100) / 100));
  };

  /* ---------- 图例：一整份数据 = 若干个数据块拼成 ---------- */
  CV.drawLegend = function (parent, o) {
    var c = o.slot;
    var pad = Math.round(c.sw * 0.24);
    var n = o.items.length;
    var totalW = n * c.sw + (n - 1) * c.gap;
    var bw = totalW + pad * 2;
    var bh = c.sh + pad * 2;

    var g = el('g', { class: 'whole' }, parent);

    el('rect', {
      x: o.x, y: o.y, width: bw, height: bh, rx: 14,
      fill: '#ffffff', 'fill-opacity': .72,
      stroke: '#c1cadf', 'stroke-width': 1.5, 'stroke-dasharray': '4 3'
    }, g);

    var blocks = [];
    for (var i = 0; i < n; i++) {
      var bx = o.x + pad + i * (c.sw + c.gap);
      var by = o.y + pad;
      var seg = el('g', { 'data-l': o.items[i].letter }, g);
      el('rect', { x: bx, y: by, width: c.sw, height: c.sh, rx: 8, fill: o.items[i].color }, seg);
      el('text', {
        class: 'slot-tx', x: bx + c.sw / 2, y: by + c.sh / 2,
        /* 与 drawSlot 同一条规则：字母随块高，别让 CSS 决定 */
        'font-size': Math.round(c.sh * 0.33),
        'text-anchor': 'middle', 'dominant-baseline': 'central', fill: '#fff'
      }, seg).textContent = o.items[i].letter;
      blocks.push(seg);
    }
    return { g: g, blocks: blocks, box: { x: o.x, y: o.y, w: bw, h: bh } };
  };

  /* ---------- 计算方框：一枚小方牌 + 悬停说明 ----------
     reduce 的目标卡在归约时会临时往下长高，方框卡在第二排下面。
     整体用局部坐标绘制（方牌以原点为中心、上沿 y=0），
     每帧只改外层 transform —— 卡片长高时方牌要跟着走。 */
  CV.drawCalc = function (parent, o) {
    var g = el('g', { class: 'calc-wrap', 'data-on': '0' }, parent);
    g.style.transition = 'none';   /* 显隐由 JS 逐帧写，别让 CSS 过渡插一脚 */

    var chip = el('g', { class: 'calc-chip' }, g);
    el('rect', {
      class: 'calc-chip-bg',
      x: -o.w / 2, y: 0, width: o.w, height: o.h,
      rx: Math.round(o.h * 0.30),
      fill: '#fbfaff', stroke: '#d7d2ea', 'stroke-width': 1.2
    }, chip);
    el('text', {
      class: 'calc-tx', x: 0, y: o.h / 2,
      'text-anchor': 'middle', 'dominant-baseline': 'central',
      'font-size': o.fs, fill: '#6a5f8a'
    }, chip).textContent = '计算';

    /* 悬停提示：贴在方牌下沿的深色气泡 —— 白底配白卡会糊在一起。
       宽度不写死：按文案实测长度 + 左右各 tipPad，字号或文案改了也不会挤到边。
       先摆 rect 再摆 text 保证 z 序，尺寸量完再回填到 rect 上。 */
    var tip = el('g', { class: 'calc-tip' }, g);
    var th = o.h + 6, ty = o.h + 8;
    var trect = el('rect', {
      x: 0, y: ty, width: 0, height: th,
      rx: Math.round(th * 0.34),
      fill: '#363b4e', 'fill-opacity': .96, filter: 'url(#fGlow)'
    }, tip);
    var ttx = el('text', {
      x: 0, y: ty + th / 2,
      'text-anchor': 'middle', 'dominant-baseline': 'central',
      'font-size': o.tipFs, fill: '#fff', 'font-family': 'var(--mono)'
    }, tip);
    ttx.textContent = o.tipText;

    var pad = o.tipPad == null ? 12 : o.tipPad;
    var len = 0;
    try { len = ttx.getComputedTextLength(); } catch (e) { len = 0; }
    if (!len) len = (o.tipText || '').length * o.tipFs * 0.6;   /* 还没上屏时的兜底 */
    var tw = o.tipW || Math.round(len + pad * 2);
    trect.setAttribute('x', -tw / 2);
    trect.setAttribute('width', tw);

    return { wrap: g, chip: chip, tip: tip, w: o.w, h: o.h, tipW: tw, tipH: th };
  };

  /* ---------- 落位脉冲：色块弹跳（涟漪环可选） ---------- */
  CV.SHOW_RING = false;      /* 涟漪扩散环开关，置 true 可恢复 */

  CV.spawnPulse = function (popLayer, slot, color, durSec) {
    /* 弹跳时长取规范 08 的 popDur（默认 .55 = 改造前 CSS 里的值）。
       页面若按自己的倍数改过，就把算好的秒数传进来，两边保持同一个数。 */
    var d = (typeof durSec === 'number' && durSec >= 0) ? durSec
                                                        : ((CV.params && CV.params.get('08-seat', 'popDur')) || 0.55);
    slot.g.style.animationDuration = d + 's';
    slot.g.classList.remove('slot-pop');
    /* SVG 元素没有 offsetWidth，必须用 getBoundingClientRect 强制回流，
       否则第二次起「删-加 class」被合并，动画不会重播 */
    void slot.g.getBoundingClientRect();
    slot.g.classList.add('slot-pop');

    if (!CV.SHOW_RING) return;

    var ring = el('circle', {
      class: 'ring', cx: slot.cx, cy: slot.cy, r: Math.round(slot.w / 2),
      stroke: color, opacity: .8
    }, popLayer);
    setTimeout(function () {
      if (ring.parentNode) ring.parentNode.removeChild(ring);
    }, 1100);
  };

  /* 一批块依次落位：第 i 个的时刻 = base + i × 规范 seatGap。
     页面用它逐帧比 sec，**不要**用 setTimeout 排 —— 进度条能来回拖，定时器拖不回来。
     返回秒；调用方记住「第 i 个已经弹过没有」，退回去时删掉标记就会重播。 */
  CV.seatAt = function (i, base) {
    var g = CV.params ? CV.params.get('08-seat', 'seatGap') : undefined;
    if (typeof g !== 'number') g = 0.5;
    return base + i * Math.max(0, g);
  };

  /* ---------- 融合：下排的块被上排「吸」走 ----------
     和落位弹跳（.slot-pop）是两件相反的事，别混用：
       落位 = 无 → 有，靠 scale(.35) → 1.16 → 1 的**过冲**给手感；
       融合 = 有 → 无，位移向上、缩放变小、不透明度变低，三个量**全单调**，
              一次回头都没有；目标块自己一点不缩放，只被一道白光扫过。

     o = { x, y0, y1, size, data, target, to }
       x      列中心
       y0     源块中心（下排）      y1  目标块中心（上排）
       data   源块数据 { letter, color }
       target CV.drawSlot 返回的目标块句柄（白光盖在它上面）
       to     融合后目标的数据 { letter: 'Σ', color: 更深的色 }
     返回 { apply(p), reset(), g }，p ∈ [0,1] 由调用方的时间轴推。 */
  var mergeSeq = 0;
  CV.createMerge = function (parent, o) {
    var id = 'fGloss' + (++mergeSeq);
    var size = o.size, half = size / 2, x = o.x, y0 = o.y0, y1 = o.y1;
    var base = o.data.color, tg = o.target;

    var svg = parent.ownerSVGElement || parent;
    var defs = svg.querySelector('defs');
    if (!defs) defs = el('defs', {}, svg);

    /* 白光：三停渐变，靠 gradientTransform 平移扫过。
       不用 clipPath —— 两端全透明，天然不会扫出块外。 */
    var grad = el('linearGradient', { id: id, x1: '0', y1: '0', x2: '1', y2: '0' }, defs);
    el('stop', { offset: '.15', 'stop-color': '#fff', 'stop-opacity': '0' }, grad);
    el('stop', { offset: '.5', 'stop-color': '#fff', 'stop-opacity': '.70' }, grad);
    el('stop', { offset: '.85', 'stop-color': '#fff', 'stop-opacity': '0' }, grad);

    var root = el('g', { class: 'fuse' }, parent);

    /* 轨道线：被吸上去的这一路，亮一下就走 */
    var guide = el('line', {
      x1: x, y1: y1 + half, x2: x, y2: y0 - half,
      stroke: '#c9b6f7', 'stroke-width': 1.2, 'stroke-dasharray': '3 4'
    }, root);
    guide.style.opacity = '0';

    /* 两块残影：跟在后面（下方），缩放 .8 / .6 —— 与飞行数据包同一套语言，
       读起来才像「被吸走」，而不是「跳了一下」 */
    function ghost() {
      var g = el('g', {}, root);
      el('rect', {
        x: 0, y: 0, width: size, height: size, rx: 8,
        fill: base, filter: 'url(#fTrail)'
      }, g);
      g.setAttribute('opacity', '0');
      return g;
    }
    var t2 = ghost(), t1 = ghost();

    var src = CV.drawSlot(root, 0, 0, size, size);
    CV.setSlot(src, o.data, {});
    /* 舞台样式里 .slot-g 带 opacity 过渡，逐帧写会拖尾，这里关掉；
       它还带 transform-box: fill-box / transform-origin: center ——
       transform 属性会改成绕「块自身中心」生效，平移整体偏 (half − half·s)，
       块会歪到目标格的右下角。这里要的是绕画布原点，必须显式盖回来。 */
    [src.g, t1, t2].forEach(function (g) {
      g.style.transition = 'none';
      g.style.transformBox = 'view-box';
      g.style.transformOrigin = '0 0';
    });

    /* 白光画在最后 = 压在目标块上面 */
    var gloss = el('rect', {
      x: tg.x, y: tg.y, width: tg.w, height: tg.h, rx: 8,
      fill: 'url(#' + id + ')', 'pointer-events': 'none'
    }, parent);
    gloss.setAttribute('opacity', '0');

    function put(node, cx, cy, s) {
      node.setAttribute('transform',
        'translate(' + (cx - half * s).toFixed(2) + ' ' + (cy - half * s).toFixed(2) +
        ') scale(' + s.toFixed(3) + ')');
    }
    function cl(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }

    var merged = false;

    /* 规范值每帧现取：规范页拖滑杆时，这条曲线要立刻变形，不必重建整节。
       参数之间有先后关系，先夹一次 —— 否则把「上浮结束」拖到「唤醒结束」前面，
       除出来的分母是 0 或负数，块会瞬间跳位。 */
    function knobs() {
      function g(k, d) {
        var v = CV.params ? CV.params.get('09-merge', k) : undefined;
        return typeof v === 'number' ? v : d;
      }
      var wake = Math.max(.02, g('fuseWake', .16));
      var rise = Math.min(.98, Math.max(wake + .04, g('fuseRise', .72)));
      var swap = Math.min(1, Math.max(wake + .08, g('fuseSwap', .78)));
      var fade = Math.min(swap - .03, Math.max(0, g('fuseFade', .45)));
      return {
        wake: wake, rise: rise, swap: swap, fade: fade,
        shrink: Math.min(1, Math.max(0, g('fuseShrink', .36))),
        gloss:  Math.max(0, g('fuseGloss', .9)),
        trail:  Math.max(0, g('fuseTrail', 18))
      };
    }

    function apply(p) {
      p = cl(p);
      var K = knobs();
      var wake = cl(p / K.wake);                                            /* ① 唤醒 */
      var rise = CV.easeInOutQuad(cl((p - K.wake) / (K.rise - K.wake)));    /* ② 上浮 */
      var op   = 1 - CV.easeInOutQuad(cl((p - K.fade) / Math.max(.02, K.swap - K.fade)));
      var s    = 1 - (1 - K.shrink) * rise;                                 /* 1 → 终了缩放，单调 */
      var cy   = y0 + (y1 - y0) * rise;

      /* ① 唤醒：只改颜色与描边，块一步都不挪 */
      var lit = CV.mix(base, '#ffffff', .30 * wake);
      src.rect.setAttribute('fill', lit);
      src.rect.setAttribute('stroke', wake > .02 ? lit : '#d5dae8');
      src.rect.setAttribute('stroke-dasharray', wake > .02 ? 'none' : '4 3');

      /* ② 上浮 ＋ 缩小 ＋ 淡出：三个量一起单调，没有任何回弹 */
      put(src.g, x, cy, s);
      src.g.setAttribute('opacity', op.toFixed(3));

      /* 拖尾：等块真的动起来才出现（跟着 rise 开门，不是跟着 p），
         快贴到目标时先退场 —— 静止时挂在块底下像一块多余的影子，定格帧里更像脏点 */
      var gate = cl((rise - .05) / .12) * (1 - cl((p - Math.max(.1, K.fade - .03)) / .20));
      var to = op * (1 - rise * .5) * gate;
      put(t1, x, cy + K.trail, s * .8);
      t1.setAttribute('opacity', (to * .40).toFixed(3));
      put(t2, x, cy + K.trail * 1.67, s * .6);
      t2.setAttribute('opacity', (to * .20).toFixed(3));

      guide.style.opacity = (cl(p / .18) * (1 - cl((p - .60) / .30)) * .9).toFixed(3);

      /* ③ 注入：白光在淡出开始后扫过，换 Σ 那一刻达到峰值 */
      var gs = Math.max(K.fade, K.swap - .23);
      var ge = Math.min(1, K.swap + .22);
      var gp = cl((p - gs) / Math.max(.02, ge - gs));
      gloss.setAttribute('opacity', Math.min(1, Math.sin(Math.PI * gp) * K.gloss).toFixed(3));
      grad.setAttribute('gradientTransform', 'translate(' + (-1 + 2 * gp).toFixed(3) + ' 0)');

      if (p >= K.swap && !merged) { merged = true; CV.setSlot(tg, o.to, {}); }
    }

    function reset() {
      merged = false;
      CV.setSlot(tg, o.data, {});
      apply(0);
    }

    apply(0);
    return { g: root, apply: apply, reset: reset, gloss: gloss };
  };

  /* ---------- 背景网格 ---------- */
  CV.drawGrid = function (parent, v) {
    el('rect', { x: 0, y: 0, width: v.w, height: v.h, fill: 'url(#gGrid)' }, parent);
  };
})(window.CV = window.CV || {});
