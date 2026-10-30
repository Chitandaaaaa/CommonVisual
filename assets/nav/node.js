/* ============================================================
   CommonVisual v2 · L2 关系 · nav.node（N1 节点卡 / N4 方向标 / N5 rank 点阵）
   ------------------------------------------------------------
   首页树的一个节点：256×64 卡片，上排 rank 点阵 + 英文名，
   下排中文名 + 方向标。数据全部来自 registry。
   ============================================================ */
(function (CV) {
  'use strict';

  CV.nav = CV.nav || {};

  CV.nav.node = function (reg) {
    var a = document.createElement('a');
    a.className = 'node';
    a.id = 'n-' + reg.id;
    a.href = reg.id + '.html';

    var top = document.createElement('span');
    top.className = 'node-top';

    var ranks = document.createElement('span');
    ranks.className = 'ranks';
    ranks.setAttribute('aria-hidden', 'true');
    for (var i = 0; i < 4; i++) {
      var dot = document.createElement('i');
      if ((reg.ranks || []).indexOf(i) >= 0) {
        dot.className = 'on';
        dot.style.setProperty('--c', 'var(--c' + i + ')');
      }
      ranks.appendChild(dot);
    }
    top.appendChild(ranks);

    var en = document.createElement('span');
    en.className = 'node-en';
    en.textContent = reg.en;
    top.appendChild(en);

    var bot = document.createElement('span');
    bot.className = 'node-bot';
    var cn = document.createElement('span');
    cn.className = 'node-cn';
    cn.textContent = reg.cn;
    var dir = document.createElement('span');
    dir.className = 'node-dir';
    dir.textContent = reg.dir;
    bot.appendChild(cn);
    bot.appendChild(dir);

    a.appendChild(top);
    a.appendChild(bot);
    return a;
  };

  /* N3 树连线：竖 20×34 / 横 76×20，描边生长 + 流光三条 path */
  CV.nav.edge = function (edge, fromId, delaySec) {
    var vert = edge.axis === 'v';
    var div = document.createElement('div');
    div.className = 'conn ' + (vert ? 'conn-v' : 'conn-h');
    div.setAttribute('data-k', edge.from);
    div.setAttribute('data-from', fromId);
    div.style.setProperty('--d', delaySec.toFixed(3) + 's');
    div.setAttribute('aria-hidden', 'true');
    div.innerHTML = vert
      ? '<svg viewBox="0 0 20 34" width="20" height="34"><path class="ln" pathLength="1" d="M10 3V21"/><path class="fl" d="M10 3V21"/><path class="hd" d="M5.5 17 10 25 14.5 17"/></svg>'
      : '<svg viewBox="0 0 76 20" width="76" height="20"><path class="ln" pathLength="1" d="M4 10H58"/><path class="fl" d="M4 10H58"/><path class="hd" d="M54 5 62 10 54 15"/></svg>';
    return div;
  };
})(window.CV = window.CV || {});
