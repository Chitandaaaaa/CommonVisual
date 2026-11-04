/* ============================================================
   src/assets/spec.js · ④参数 的逐字转录（SCHEMA 单源）
   ------------------------------------------------------------
   本文件是 docs/规范/03-参数.md 的转录；冲突时以文档为准，
   或在 docs/实现/01-符合性守则.md 登记偏差。
   读取只经 CV.spec(键)，表外键抛错；消费端禁 || 字面量兜底。
   ============================================================ */
(function (CV) {
  'use strict';

  function k(label, def, unit, min, max, step, kind) {
    return { label: label, def: def, unit: unit || '', min: min, max: max, step: step, kind: kind || 'num' };
  }

  CV.SPEC = {
    color: { label: '数据色板', keys: {
      rankA: k('rank A · 紫', '#7c3aed', '', null, null, null, 'color'),
      rankB: k('rank B · 青', '#0891b2', '', null, null, null, 'color'),
      rankC: k('rank C · 绿', '#059669', '', null, null, null, 'color'),
      rankD: k('rank D · 橙', '#d97706', '', null, null, null, 'color'),
      toneDeep: k('Σ 合满终点色', '#4c1d95', '', null, null, null, 'color'),
      toneInk: k('越加越浓终点', '#190d33', '', null, null, null, 'color'),
      toneWire: k('连线闲置', '#c3cadb', '', null, null, null, 'color'),
      toneWireDim: k('网格 / 描边灰', '#8b93aa', '', null, null, null, 'color'),
      toneSlotBg: k('空槽底', '#f7f8fc', '', null, null, null, 'color'),
      toneSlotHot: k('接收位紫底', '#f3eeff', '', null, null, null, 'color'),
      flood: k('滤镜投影色', '#2a3352', '', null, null, null, 'color')
    }},
    slot: { label: '数据块·过渡', keys: {
      slotCross: k('变色过渡', 0.5, 's', 0, 1.5, 0.05)
    }},
    card: { label: '卡片动态', keys: {
      cardDur: k('卡片伸缩', 0.8, 's', 0.3, 3, 0.05),
      blockDur: k('单块时长', 0.4, 's', 0.1, 1.5, 0.05),
      blockGap: k('块间隔', 0.15, 's', 0, 0.6, 0.01),
      rowLull: k('长够→放块', 0.3, 's', 0, 1, 0.05),
      rowPause: k('撤完→收卡', 0.25, 's', 0, 1, 0.05)
    }},
    packet: { label: '数据包·动态', keys: {
      packDur: k('飞行时长', 1.5, 's', 0.3, 4, 0.1),
      packFade: k('送达淡出', 0.6, 's', 0, 3, 0.05),
      packLead: k('起步让出', 0.16, '', 0, 0.5, 0.01),
      trailDist: k('拖尾退后', 24, 'px', 8, 60, 1),
      trailScale: k('拖尾浓度', 1, '×', 0, 2, 0.05)
    }},
    wire: { label: '连线·笔画', keys: {
      wireFade: k('点亮 / 回灰', 0.3, 's', 0, 1.5, 0.05),
      wireW: k('闲置线宽', 2, 'px', 0.5, 6, 0.1),
      wireWLit: k('点亮线宽', 2.6, 'px', 0.5, 6, 0.1),
      wireWGlow: k('余辉 / 收尾线宽', 1.8, 'px', 0.5, 6, 0.1),
      wireWMuted: k('全换·闲置线宽', 1.4, 'px', 0.5, 6, 0.1),
      wireDashOn: k('闲置虚线实段', 8, 'px', 2, 24, 0.5),
      wireDashOff: k('闲置虚线间隔', 7, 'px', 2, 24, 0.5),
      wireDashLitOn: k('点亮虚线实段', 9, 'px', 2, 24, 0.5),
      wireOpIdle: k('闲置不透明度', 1, '', 0, 1, 0.02),
      wireGlowOp: k('余辉不透明度', 0.42, '', 0, 1, 0.02),
      wireRestOp: k('收轮（退灰）', 0.75, '', 0, 1, 0.02),
      wireDoneOp: k('收尾（全灰）', 0.26, '', 0, 1, 0.02)
    }},
    calc: { label: '方框动态', keys: {
      growDur: k('卡片伸长', 0.75, 's', 0.1, 2, 0.05),
      holdDur: k('方框展示（下限）', 0.95, 's', 0.2, 4, 0.05),
      shrinkDur: k('卡片缩回', 0.7, 's', 0.1, 2, 0.05),
      calcFade: k('方框过渡', 0.35, 's', 0, 1.5, 0.05),
      shrinkFade: k('收场淡出比例', 0.45, '', 0.1, 0.9, 0.01)
    }},
    seat: { label: '落位弹跳', keys: {
      popDur: k('弹跳时长', 0.55, 's', 0.1, 1.5, 0.05),
      seatGap: k('多块错峰', 0.5, 's', 0, 0.8, 0.01),
      popStagger: k('同批错峰（退役备用）', 0.12, 's', 0, 0.4, 0.01)
    }},
    merge: { label: '融合·动态', keys: {
      fuseDur: k('单次融合', 0.42, 's', 0.15, 1.2, 0.01),
      mergeGap: k('多段错峰', 0.5, 's', 0, 1.2, 0.05),
      fuseWake: k('唤醒结束', 0.16, '', 0.02, 0.5, 0.01),
      fuseRise: k('上浮结束', 0.72, '', 0.3, 0.98, 0.01),
      fuseFade: k('淡出起点', 0.45, '', 0.1, 0.9, 0.01),
      fuseSwap: k('换 Σ 时刻', 0.78, '', 0.4, 1, 0.01),
      fuseShrink: k('终了缩放', 0.36, '×', 0.05, 1, 0.01),
      fuseGloss: k('白光强度', 0.9, '', 0, 1.5, 0.05),
      fuseTrail: k('拖尾退后', 18, 'px', 0, 40, 1)
    }},
    orch: { label: '编排·衔接', keys: {
      dimDur: k('变暗 / 复原 / 转接收位', 0.3, 's', 0.1, 1, 0.05),
      revealDur: k('显形时长', 0.32, 's', 0.1, 1, 0.02),
      takeoffFade: k('起飞渐显（行程比例）', 0.08, '', 0.02, 0.5, 0.01),
      trailRatio: k('余辉比率', 0.4, '', 0, 1, 0.01),
      seatDelay: k('落位延迟', 0.5, 's', 0, 1.5, 0.05)
    }},
    geo: { label: '舞台几何', keys: {
      dtViewW: k('桌面·画布宽', 1130, 'px', 900, 1400, 10),
      dtViewH: k('桌面·画布高', 680, 'px', 520, 820, 10),
      dtCardW: k('桌面·卡宽', 300, 'px', 220, 380, 2),
      dtCardH: k('桌面·卡高', 170, 'px', 130, 220, 2),
      dtSlotSw: k('桌面·槽宽', 46, 'px', 34, 60, 1),
      dtSlotSh: k('桌面·槽高', 46, 'px', 34, 60, 1),
      dtSlotGap: k('桌面·槽距', 12, 'px', 6, 20, 1),
      dtHdr: k('桌面·卡头高', 36, 'px', 26, 48, 1),
      dtTitleFs: k('桌面·标题字号', 15, 'px', 10, 20, 0.5),
      dtBadgeFs: k('桌面·徽章字号', 10, 'px', 6, 14, 0.5),
      c34dtTx: k('col34·目标卡x', 10, 'px', 0, 200, 2),
      c34dtTy: k('col34·目标卡y', 255, 'px', 120, 420, 5),
      c34dtSx: k('col34·源列x', 820, 'px', 640, 1000, 5),
      c34dtSy1: k('col34·源1y', 50, 'px', 20, 120, 5),
      c34dtSy2: k('col34·源2y', 255, 'px', 160, 360, 5),
      c34dtSy3: k('col34·源3y', 460, 'px', 380, 600, 5),
      c34dtLy: k('col34·图例y', 50, 'px', 10, 120, 2),
      grdtX: k('grid·原点x', 175, 'px', 60, 320, 5),
      grdtY: k('grid·原点y', 136, 'px', 60, 240, 5),
      grdtDx: k('grid·列距', 480, 'px', 380, 620, 5),
      grdtDy: k('grid·行距', 330, 'px', 240, 460, 5),
      grdtLy: k('grid·图例y', 17, 'px', 5, 60, 1),
      arcK: k('弧线曲率', 0.42, '', 0.2, 0.6, 0.01),
      humpH: k('车道偏移·横', 22, 'px', 6, 60, 1),
      humpV: k('车道偏移·纵', 54, 'px', 20, 120, 2)
    }},
    global: { label: '全局播放', keys: {
      pageSpeed: k('播放速度', 1, '×', 0.3, 2.5, 0.1)
    }}
  };

  /* 扁平索引 + 读取入口（页内覆盖 → localStorage → 默认） */
  var FLAT = {};
  Object.keys(CV.SPEC).forEach(function (g) {
    Object.keys(CV.SPEC[g].keys).forEach(function (key) {
      if (FLAT[key]) throw new Error('spec: 重复键 ' + key);
      FLAT[key] = CV.SPEC[g].keys[key];
    });
  });
  CV.SPEC_FLAT = FLAT;

  var OV_KEY = 'cv.spec.v1';
  var ov = {};
  try { ov = JSON.parse(localStorage.getItem(OV_KEY)) || {}; } catch (e) { ov = {}; }

  CV.spec = function (key) {
    var d = FLAT[key];
    if (!d) throw new Error('spec: 表外键「' + key + '」——先补 docs/规范/03-参数.md');
    return (typeof ov[key] === 'number' || typeof ov[key] === 'string') ? ov[key] : d.def;
  };
  CV.specSet = function (key, v) {
    if (!FLAT[key]) throw new Error('spec: 表外键 ' + key);
    if (v === null || v === undefined) delete ov[key]; else ov[key] = v;
    try { localStorage.setItem(OV_KEY, JSON.stringify(ov)); } catch (e) {}
  };
  CV.specReset = function () {
    ov = {};
    try { localStorage.removeItem(OV_KEY); } catch (e) {}
  };
})(window.CV = window.CV || {});
