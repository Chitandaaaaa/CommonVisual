/* reducescatter · 相加后切分：recursive halving 两轮，边换段边折算，
   每卡只留自己编号那一段。全程没有「先合成整份 Σ 再切开」的中间态。
   family:'split' —— 时间轴由 split 动词按规范值算出，剧本只给 14 段文案。 */
CV.scene('reducescatter', (function () {
  var T = CV.cap(CV.PALETTE);
  var rk = T.rk, seg = T.seg, whole = T.whole;

  return {
    id: 'reducescatter',
    aria: 'Reduce-Scatter 通信过程动画：recursive halving 两轮互换段并逐段折算，每卡只留自己那段',
    preset: 'grid',
    family: 'split',
    gear: true,

    /* 逐动作解说的静止行文案（docs/steps.html） */
    narr: {
      rest: {
        intro: '四张四槽卡各 4 格 A B C D；8 条直连灰色',
        tail: 'r0 只剩 ΣA⁴、r1 只剩 ΣB⁴、r2 只剩 ΣC⁴、r3 只剩 ΣD⁴'
      }
    },

    cards: [
      { rank: 0, badgeText: '4 段' },
      { rank: 1, badgeText: '4 段' },
      { rank: 2, badgeText: '4 段' },
      { rank: 3, badgeText: '4 段' }
    ],
    legend: { at: 'grid' },

    keepCards: 'all',

    geo: CV.geo({
      preset: 'grid',
      desktop: {
        humpH: 22, humpV: 40, areaPad: 12, rowGap: 12, calcGap: 10, preWiden: 25,
        calc: { w: 56, h: 22, fs: 11.5, tipFs: 10.5, tipText: 'sum · avg · max · min' }
      },
      narrow: {
        humpH: 18, humpV: 40, areaPad: 11, rowGap: 8, calcGap: 7, preWiden: 13,
        calc: { w: 40, h: 16, fs: 9, tipFs: 8, tipText: 'sum · avg' }
      }
    }),

    captions: [
      rk(0) + rk(1) + rk(2) + rk(3) + ' 各持一整份 ' + whole() + '，四段各 1 份，待逐段相加',
      '开场先预留：四卡同时「一排变两排」—— 卡片先长高，第二排空位再逐块亮出（整页只做一次）',
      '第 1 轮 传递：同列互换 —— ' + rk(0) + '↔' + rk(2) + '、' + rk(1) + '↔' + rk(3) + '，各把对方要的两段送出',
      '落位：收下的两段依次弹进第二排',
      '要算了：卡片先长一层把位置让出来，「计算」方框再浮出 —— 先长空间、再填内容',
      '合并：两段依次折进上排，这两段加到 2 份 —— 过半就亮出 Σᴀ²（下标列字母、上标份数）',
      '这一轮算完：方框退回，卡片落回两排 —— 第二排留着给下一轮',
      '第二轮只换一段：第二轮用不上的那一个空位先撤掉（从右往左），留下要用的那格',
      '第 2 轮 传递：同行互换 —— ' + rk(0) + '↔' + rk(1) + '、' + rk(2) + '↔' + rk(3) + '，交出最后一段、收下对方那段',
      '落位：这一轮每卡只收一段',
      '再算一次：方框重新浮出来，这一段是四份相加',
      '合并：折进上排，这一段凑满四份 —— 上标跳到 4（Σᴀ⁴）',
      '收场：先把方框收掉，第二排空位再逐块撤走，卡片收回单排 —— 每卡只留自己编号那一段',
      '每张卡只留一段的和：' + rk(0) + ' 留 ' + seg(0) + '，' + rk(1) + ' 留 ' + seg(1) + '，四卡拼起来才是整份结果'
    ],
    shorts: [
      '四卡各持一整份 ' + whole(),
      '四卡同时长出第二排',
      '第 1 轮 同列互换',
      '收下两段，依次落位',
      '浮出计算框',
      '折进上排，各段 Σᴀ²',
      '收起计算框，第二排留着',
      '撤掉多余的空位',
      '第 2 轮 同行互换',
      '收下一段，落位',
      '再浮出计算框',
      '折进 → 凑满 4 份',
      '撤掉第二排，卡片收回单排',
      '四卡各留一段，拼起来才是整份'
    ],

    finale: '每卡一段 Σ，四卡拼起来才是整份结果'
  };
})());
