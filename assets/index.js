/* ============================================================
   CommonVisual · 首页交互
   ------------------------------------------------------------
   1) 悬停某个节点 → 高亮它参与的那几条关系线（线会「流动」）
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
  /* 节点 id → 它参与的关系 key（与 conn 的 data-k 对应） */
  var REL = {
    'n-broadcast':     ['broadcast'],
    'n-scatter':       ['scatter'],
    'n-gather':        ['gather'],
    'n-allgather':     ['gather', 'allgather'],
    'n-reduce':        ['reduce'],
    'n-allreduce':     ['reduce', 'allreduce'],
    'n-reducescatter': ['allreduce', 'reducescatter'],
    'n-alltoall':      ['reducescatter']
  };

  function highlight(id) {
    var keys = REL[id] || [];
    nodes.forEach(function (n) {
      n.classList.toggle('is-lit', n.id === id);
    });
    conns.forEach(function (c) {
      var k = c.getAttribute('data-k');
      c.classList.toggle('is-lit', keys.indexOf(k) >= 0);
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
