/* ============================================================
   CommonVisual · 首页交互
   ------------------------------------------------------------
   1) 悬停某个节点 → 只高亮「从该节点射出」的关系线（向右 / 向下的出边），
      不点亮射入它的上 / 左箭头（每条线在 HTML 里用 data-from 标明源头）
   2) 点击「待实现」的节点 → 温和提示，不跳转
   3) 键盘可达：Tab 走节点，Enter/Space 触发
   ============================================================ */
(function () {
  'use strict';

  var $  = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  var tree = $('#tree');
  if (!tree) return;

  var nodes = $$('.node', tree);
  var conns = $$('.conn', tree);

  /* ───────────── 1. 悬停高亮关系线 ───────────── */
  /* 每条连线在 HTML 上都用 data-from 标明了「源头节点」，
     只有从该节点射出的线（向右 / 向下）才高亮；射入它的上 / 左箭头不动。 */
  function highlight(id) {
    nodes.forEach(function (n) {
      n.classList.toggle('is-lit', n.id === id);
    });
    conns.forEach(function (c) {
      c.classList.toggle('is-lit', c.getAttribute('data-from') === id);
    });
  }

  function clearHighlight() {
    nodes.forEach(function (n) { n.classList.remove('is-lit'); });
    conns.forEach(function (c) { c.classList.remove('is-lit'); });
  }

  nodes.forEach(function (n) {
    n.addEventListener('mouseenter', function () { highlight(n.id); });
    n.addEventListener('mouseleave', clearHighlight);
    n.addEventListener('focus', function () { highlight(n.id); });
    n.addEventListener('blur', clearHighlight);
  });

  /* ───────────── 2. 「待实现」节点的点击反馈 ───────────── */
  var tip = document.createElement('div');
  tip.className = 'toast';
  tip.setAttribute('role', 'status');
  tip.setAttribute('aria-live', 'polite');
  document.body.appendChild(tip);
  var tipTimer = null;

  function showToast(msg) {
    tip.textContent = msg;
    tip.classList.add('is-on');
    clearTimeout(tipTimer);
    tipTimer = setTimeout(function () { tip.classList.remove('is-on'); }, 2400);
  }

  $$('.node-planned', tree).forEach(function (n) {
    n.setAttribute('tabindex', '0');
    n.setAttribute('role', 'button');
    var name = n.querySelector('.node-en').textContent;
    n.addEventListener('click', function () {
      showToast(name + ' 还在开发中');
    });
    n.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        n.click();
      }
    });
  });

  /* ───────────── 3. 树进入视口时重播连线动画 ───────────── */
  if ('IntersectionObserver' in window) {
    var played = false;
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting || played) return;
        played = true;
        io.disconnect();
        conns.forEach(function (c) {
          var ln = c.querySelector('.ln'), fl = c.querySelector('.fl'), hd = c.querySelector('.hd');
          [ln, fl, hd].forEach(function (n) {
            if (!n) return;
            n.style.animation = 'none';
            void n.getBoundingClientRect();
            n.style.animation = '';
          });
        });
      });
    }, { threshold: .15 });
    io.observe(tree);
  }
})();
