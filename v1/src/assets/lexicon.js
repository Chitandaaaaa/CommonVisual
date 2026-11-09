/* ============================================================
   src/assets/lexicon.js · ⑤文案 的逐字转录（词表 + 命名）
   ------------------------------------------------------------
   本文件是 docs/规范/04-文案.md 的转录；表外动作抛错。
   生成器（compile/narrate）只许用这里的词拼句子。
   ============================================================ */
(function (CV) {
  'use strict';

  /* ── 动作词表（⑤§1 全集 23 词）── 键 = 编译层动作 kind */
  CV.LEX = {
    dim: '变暗', restore: '复原', hole: '交空', reveal: '显形',
    toRecv: '转接收位', light: '点亮', takeoff: '起飞', fly: '飞行',
    arrive: '抵达', fade: '淡出', trail: '余辉', land: '落位',
    pop: '弹跳', grow: '长高', blocksIn: '逐块出现', blocksOut: '逐块撤',
    boxIn: '计算框·浮现', boxOut: '计算框·淡出', merge: '折进',
    shrink: '收层', recede: '收回', narrow: '收窄', rest: '静止'
  };

  CV.LEX.word = function (kind) {
    if (!CV.LEX[kind]) throw new Error('lexicon: 表外动作「' + kind + '」—— 先补 docs/规范/04-文案.md §1');
    return CV.LEX[kind];
  };

  /* ── 颜色词（④ rankA–D 的文字名）── */
  CV.COLOR_WORD = { A: '紫色', B: '青色', C: '绿色', D: '橙色' };

  /* ── 卡名写法（⑤§3）──
     单槽卡：r<rank>/单槽卡（不写槽号）。
     四槽卡：版面只有一张宽卡 → 「四槽卡[-槽号]」；
             grid 或多张宽卡 → 「r<rank>/四槽卡[-槽号]」。 */
  CV.cardName = function (scene, r) {
    var n = scene.rows[r];
    if (n === 1) return 'r' + r + '/单槽卡';
    var manyWide = CV.FACTS[scene.id].rows.filter(function (x) { return x > 1; }).length > 1;
    return (scene.preset === 'grid' || manyWide) ? 'r' + r + '/四槽卡' : '四槽卡';
  };
  CV.slotName = function (scene, r, i) {
    if (scene.rows[r] === 1) return CV.cardName(scene, r);
    return CV.cardName(scene, r) + '-' + (i + 1);
  };
  /* 第二排槽（家族页下排）：命名加「下排-序」 */
  CV.row2Name = function (scene, r, i) {
    return CV.cardName(scene, r) + ' 下排-' + (i + 1);
  };
  CV.wireName = function (scene, w) { return w.label; };
  CV.packetName = function (scene, p) {
    return p.kind === 'whole' ? '整份包' : (p.kind === 'slice' ? '分片包 ' + p.ch + CV.SUB[p.idx] : '单体包 ' + p.ch);
  };

  /* 上标/下标字符（Σ 份数、分片下标用） */
  CV.SUP = { 1: '¹', 2: '²', 3: '³', 4: '⁴' };
  CV.SUB = { 0: '₀', 1: '₁', 2: '₂', 3: '₃' };
})(window.CV = window.CV || {});
