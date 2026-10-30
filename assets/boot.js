/* ============================================================
   CommonVisual v2 · 装配层（boot）
   ------------------------------------------------------------
   页面薄壳的唯一逻辑：CV.boot('gather')。
   建页壳（页头 / 舞台 / 控制条）→ 挂页角关系导航（读 registry）→
   让导演挂载剧本 → 需要时挂时序齿轮。
   ============================================================ */
(function (CV) {
  'use strict';
  var h = CV.h;

  /* ── 剧本注册表：scenes/*.js 用 CV.scene('id', {...}) 声明 ── */
  var REG = {};
  CV.scene = function (id, def) {
    if (def) REG[id] = def;
    else return REG[id];
  };

  function buildBar() {
    var footer = h('footer', 'bar', document.body);
    var stack = h('div', 'bar-stack', footer);
    var cap = h('div', 'caption', stack, '<span class="cap-text" id="capText"></span>');
    var panel = h('div', 'bar-panel', stack);
    var track = h('div', 'track', panel);
    h('div', 'segs', track).id = 'segs';
    var scrub = document.createElement('input');
    scrub.type = 'range'; scrub.id = 'scrub';
    scrub.min = '0'; scrub.max = '1000'; scrub.value = '0';
    scrub.setAttribute('aria-label', '播放进度');
    track.appendChild(scrub);
    var ctrls = h('div', 'ctrls', panel);
    function btn(id, label, icon) {
      var b = document.createElement('button');
      b.className = 'ic ' + (id === 'play' ? 'ic-main' : 'ic-step');
      b.id = id; b.setAttribute('aria-label', label); b.title = label;
      b.innerHTML = icon;
      ctrls.appendChild(b);
    }
    btn('prev', '上一步',
      '<svg viewBox="0 0 24 24" width="26" height="26" fill="currentColor"><path d="M6 5h2.4v14H6zM19 5v14l-9.6-7z"/></svg>');
    btn('play', '播放',
      '<svg viewBox="0 0 24 24" width="25" height="25" fill="currentColor"><path d="M7 4.5v15L20 12z"/></svg>');
    btn('next', '下一步',
      '<svg viewBox="0 0 24 24" width="26" height="26" fill="currentColor"><path d="M15.6 5H18v14h-2.4zM5 5l9.6 7L5 19z"/></svg>');
  }

  CV.boot = function (id) {
    var reg = CV.registryById(id);

    /* 静态页（index/layout/algorithms/anatomy）：分发到各自的页面装配器 */
    if (!CV.scene(id)) {
      if (CV.pages && CV.pages[id]) return CV.pages[id](reg);
      throw new Error('CV.boot: 未注册的页面 ' + id);
    }
    var scene = CV.scene(id);
    if (!reg) throw new Error('CV.boot: registry 缺少 ' + id);

    document.title = reg.en + ' · 动态演示';
    document.body.setAttribute('data-rel', id);

    /* 页头：h1 先占位，nav.mini 再把它包进关系网格 */
    var hd = h('header', 'hd', document.body);
    var h1 = document.createElement('h1');
    h1.textContent = reg.en;
    hd.appendChild(h1);

    /* 舞台（stagewrap + stagebox + svg 六层 + 公共 defs） */
    var stage = CV.stage.mount();
    stage.svg.setAttribute('aria-label', scene.aria || reg.en + ' 通信过程动画');

    /* 控制条 */
    buildBar();

    /* 页角关系导航（registry 的 rel 边 → down/side） */
    if (CV.nav && CV.nav.mini) CV.nav.mini(hd, h1, id);

    /* 导演挂载 */
    var api = CV.director.mount(scene);

    /* 时序齿轮：八页原语都接（scene.gear 声明；family 页的行由各自动词给出） */
    if (scene.gear && CV.chrome.gear) {
      CV.chrome.gear({
        page: id,
        name: reg.en + ' 时序',
        getCh: api.getCh,
        onChange: function () { api.reload(); }
      });
    }

    return api;
  };
})(window.CV = window.CV || {});
