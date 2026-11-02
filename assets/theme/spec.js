/* ============================================================
   CommonVisual · L0 参数总线 · 规范表（SCHEMA 单源）
   ------------------------------------------------------------
   全站唯一一张参数表：每个「舞台可见物」的可调参数一行。
   谁读它：
     · theme.js   params store 按它播种（def → defaults.js → localStorage）
     · 面板       调试台 / 齿轮「外观」tab 按它出控件
     · ledger.js  规范总账的 D/Y 行是它的视图
     · 探针       05 组按 pages 过滤逐页核对
   取值读法只允许 CV.spec(键名)（theme.js，表外键抛错）；
   消费端禁止 || 字面量兜底——默认值只有表能给（docs/参数总线方案.md §2.2）。

   入表门槛（缺一不许入表；字段随批次补齐，见方案 §2.1）：
     label / def / min / max / step / unit 现有；
     kind：'num'（默认）| 'color'（面板出取色器，值是 #rrggbb 字符串）；
     sink：'js'（默认，只有 JS 读）| 'css'（store 写成 :root 的 --cv-<键>，CSS 只读 var()）
           | 'both'；
     scope pages chk read 属 B3–B4 增量。
   收录边界：只收舞台可见物与动态过程；悬停聚焦 / hover 高亮这类交互反馈
   不是「过程」，不入表（stage-page.css 里保留字面量，5.1d 只扫过程选择器）。
   ============================================================ */
(function (CV) {
  'use strict';
  CV.SPEC = {
    '01-color': {
      label: '数据色板',
      anchor: 'sub-01-1',
      groups: [
        { label: 'rank 四色', keys: ['rankA', 'rankB', 'rankC', 'rankD'] },
        { label: '语义色', keys: ['toneDeep', 'toneInk', 'toneWire', 'toneWireDim', 'toneSlotBg', 'toneSlotHot', 'flood'] }
      ],
      keys: {
        rankA:       { label: 'rank A · 紫',    kind: 'color', sink: 'both', def: '#7c3aed', chk: 'truth', read: 'CV.PALETTE[0].color + 初始槽 fill' },
        rankB:       { label: 'rank B · 青',    kind: 'color', sink: 'both', def: '#0891b2', chk: 'truth', read: 'CV.PALETTE[1].color + 初始槽 fill' },
        rankC:       { label: 'rank C · 绿',    kind: 'color', sink: 'both', def: '#059669', chk: 'truth', read: 'CV.PALETTE[2].color + 初始槽 fill' },
        rankD:       { label: 'rank D · 橙',    kind: 'color', sink: 'both', def: '#d97706', chk: 'truth', read: 'CV.PALETTE[3].color + 初始槽 fill' },
        toneDeep:    { label: 'Σ 合满终点色',   kind: 'color', sink: 'both', def: '#4c1d95', chk: 'truth', read: 'CV.TONE.deep' },
        toneInk:     { label: '越加越浓终点',   kind: 'color', def: '#190d33', chk: 'truth', read: 'CV.TONE.ink' },
        toneWire:    { label: '连线闲置',       kind: 'color', def: '#c3cadb', chk: 'truth', read: 'CV.TONE.wire' },
        toneWireDim: { label: '网格 / 描边灰',  kind: 'color', def: '#8b93aa', chk: 'truth', read: 'CV.TONE.wireDim' },
        toneSlotBg:  { label: '空槽底',         kind: 'color', def: '#f7f8fc', chk: 'truth', read: 'CV.TONE.slotBg' },
        toneSlotHot: { label: '接收中占位底',   kind: 'color', def: '#f3eeff', chk: 'truth', read: 'CV.TONE.slotHot' },
        flood:       { label: '滤镜投影色',     kind: 'color', def: '#2a3352', chk: 'truth', read: 'stage defs feDropShadow@flood-color' }
      }
    },
    '02-slot': {
      label: '数据块·过渡',
      anchor: 'sub-02-1',
      keys: {
        slotCross: { label: '变色过渡', unit: 's', def: 0.5, min: 0, max: 1.5, step: 0.05, sink: 'css', chk: 'css', read: '#stage [data-l] rect@transition-duration' }
      }
    },
    '03-card': {
      label: '卡片动态',
      anchor: 'sub-03-5',   /* 03 的第 5 个 h3 =「动态 · 卡片长高与数据块增减」（2026-11-01 拆 tab 后顺延） */
      groups: [
        { label: '耗时', keys: ['cardDur', 'blockDur'] },
        { label: '节奏', keys: ['blockGap', 'rowLull', 'rowPause'] }
      ],
      keys: {
        cardDur:  { label: '卡片伸缩', unit: 's', def: 0.8,  min: 0.3, max: 3,   step: 0.05, chk: 'link' },
        blockDur: { label: '单块时长', unit: 's', def: 0.4,  min: 0.1, max: 1.5, step: 0.05, chk: 'link' },
        blockGap: { label: '块间隔',   unit: 's', def: 0.15, min: 0,   max: 0.6, step: 0.01, chk: 'link' },
        rowLull:  { label: '长够→放块', unit: 's', def: 0.3,  min: 0,   max: 1,   step: 0.05, chk: 'link' },
        rowPause: { label: '撤完→收卡', unit: 's', def: 0.25, min: 0,   max: 1,   step: 0.05, chk: 'link' }
      }
    },
    '05-packet': {
      label: '数据包·动态',
      anchor: 'sub-05-4',   /* 05 的第 4 个 h3 =「动态 · 数据包怎么飞」（2026-11-01 拆 tab 后顺延） */
      groups: [
        { label: '耗时', keys: ['packDur', 'packFade'] },
        { label: '特效', keys: ['packLead', 'trailDist', 'trailScale'] }
      ],
      keys: {
        packDur:    { label: '飞行时长', unit: 's',  def: 1.5, min: 0.3, max: 4,   step: 0.1, chk: 'link' },
        packFade:   { label: '送达淡出', unit: 's',  def: 0.6, min: 0,   max: 3,   step: 0.05, chk: 'link' },
        packLead:   { label: '起步让出', unit: '',   def: 0.16, min: 0,  max: 0.5, step: 0.01, chk: 'unit' },
        trailDist:  { label: '拖尾退后', unit: 'px', def: 24,  min: 8,   max: 60,  step: 1, chk: 'unit' },
        trailScale: { label: '拖尾浓度', unit: '×',  def: 1,   min: 0,   max: 2,   step: 0.05, chk: 'unit' }
      }
    },
    '04-wire': {
      label: '连线·笔画',
      anchor: 'sub-04-1',
      /* 2026-11-03 入册：线宽 / 虚线 / 余辉透明度此前散在 move·sum·split 三处
         各写一遍字符串（同一组 2.6+'9 7' 抄了三份），规范表一个键都没有，
         齿轮面板调不到，改一处漏两处。现全部收进本组，唯一画笔 CV.wire.paint()。 */
      groups: [
        { label: '过渡', keys: ['wireFade'] },
        { label: '线宽', keys: ['wireW', 'wireWLit', 'wireWGlow', 'wireWMuted'] },
        { label: '虚线', keys: ['wireDashOn', 'wireDashOff', 'wireDashLitOn'] },
        { label: '透明度', keys: ['wireOpIdle', 'wireGlowOp', 'wireRestOp', 'wireDoneOp'] }
      ],
      keys: {
        wireFade:   { label: '点亮 / 回灰', unit: 's', def: 0.3, min: 0, max: 1.5, step: 0.05, sink: 'css', chk: 'css', read: '.wire@transition-duration' },
        wireW:      { label: '闲置',        unit: 'px', def: 2,   min: 0.5, max: 6, step: 0.1, chk: 'unit' },
        wireWLit:   { label: '点亮',        unit: 'px', def: 2.6, min: 0.5, max: 6, step: 0.1, chk: 'unit' },
        wireWGlow:  { label: '余辉 / 收尾', unit: 'px', def: 1.8, min: 0.5, max: 6, step: 0.1, chk: 'unit' },
        /* 全换的交叉线密，闲置态单独细一档（原 all-to-all 写死 1.4） */
        wireWMuted: { label: '全换·闲置',   unit: 'px', def: 1.4, min: 0.5, max: 6, step: 0.1, chk: 'unit' },
        wireDashOn:    { label: '实线段',   unit: 'px', def: 8, min: 2, max: 24, step: 0.5, chk: 'unit' },
        wireDashOff:   { label: '间隔',     unit: 'px', def: 7, min: 2, max: 24, step: 0.5, chk: 'unit' },
        wireDashLitOn: { label: '点亮实线段', unit: 'px', def: 9, min: 2, max: 24, step: 0.5, chk: 'unit' },
        wireOpIdle: { label: '闲置',        unit: '',  def: 1,    min: 0, max: 1, step: 0.02, chk: 'unit' },
        wireGlowOp: { label: '余辉',        unit: '',  def: 0.42, min: 0, max: 1, step: 0.02, chk: 'unit' },
        /* 本轮传完、整轮未完：线已退灰但比闲置弱一点，提示「这条用过一次」 */
        wireRestOp: { label: '收轮（退灰）', unit: '',  def: 0.75, min: 0, max: 1, step: 0.02, chk: 'unit' },
        wireDoneOp: { label: '收尾（全灰）', unit: '', def: 0.26, min: 0, max: 1, step: 0.02, chk: 'unit' }
      }
    },
    '07-calc': {
      label: '方框动态',
      anchor: 'sub-07-3',   /* 07 的第 3 个 h3 =「动态 · 方框长出与收回」（2026-11-01 拆 tab 后顺延） */
      groups: [
        { label: '耗时', keys: ['growDur', 'holdDur', 'shrinkDur'] },
        { label: '衔接', keys: ['calcFade', 'shrinkFade'] }
      ],
      keys: {
        growDur:   { label: '卡片伸长', unit: 's', def: 0.75, min: 0.1, max: 2, step: 0.05, chk: 'link' },
        holdDur:   { label: '方框展示', unit: 's', def: 0.95, min: 0.2, max: 4, step: 0.05, chk: 'link' },
        shrinkDur: { label: '卡片缩回', unit: 's', def: 0.7,  min: 0.1, max: 2, step: 0.05, chk: 'link' },
        calcFade:  { label: '方框过渡', unit: 's', def: 0.35, min: 0,   max: 1.5, step: 0.05, chk: 'link' },
        shrinkFade:{ label: '收场淡出比例', unit: '', def: 0.45, min: 0.1, max: 0.9, step: 0.01, chk: 'unit', read: '07 章 fixture：先淡后缩的分段点' }
      }
    },
    '08-seat': {
      label: '落位弹跳',
      anchor: 'sub-08-1',
      groups: [
        { label: '耗时', keys: ['popDur'] },
        { label: '节奏', keys: ['seatGap', 'popStagger'] }
      ],
      keys: {
        popDur:     { label: '弹跳时长', unit: 's', def: 0.55, min: 0.1, max: 1.5, step: 0.05, sink: 'both' , chk: 'link' },
        seatGap:    { label: '多块错峰', unit: 's', def: 0.5,  min: 0,    max: 0.8, step: 0.01, chk: 'link' },
        popStagger: { label: '同批错峰', unit: 's', def: 0.12, min: 0,    max: 0.4, step: 0.01, chk: 'link' }
      }
    },
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
        fuseDur:    { label: '单次融合',   unit: 's',  def: 0.42, min: 0.15, max: 1.2, step: 0.01, chk: 'link' },
        mergeGap:   { label: '多列错峰',   unit: 's',  def: 0.5,  min: 0,    max: 1.2, step: 0.05, chk: 'link' },
        fuseWake:   { label: '唤醒结束',   unit: '',   def: 0.16, min: 0.02, max: 0.5, step: 0.01, chk: 'unit' },
        fuseRise:   { label: '上浮结束',   unit: '',   def: 0.72, min: 0.3,  max: 0.98, step: 0.01, chk: 'unit' },
        fuseFade:   { label: '淡出起点',   unit: '',   def: 0.45, min: 0.1,  max: 0.9, step: 0.01, chk: 'unit' },
        fuseSwap:   { label: '换 Σ 时刻',  unit: '',   def: 0.78, min: 0.4,  max: 1,   step: 0.01, chk: 'unit' },
        fuseShrink: { label: '终了缩放',   unit: '×',  def: 0.36, min: 0.05, max: 1,   step: 0.01, chk: 'unit' },
        fuseGloss:  { label: '白光强度',   unit: '',   def: 0.9,  min: 0,    max: 1.5, step: 0.05, chk: 'unit' },
        fuseTrail:  { label: '拖尾退后',   unit: 'px', def: 18,   min: 0,    max: 40,  step: 1, chk: 'unit' }
      }
    },
    orch: {
      label: '编排·衔接',
      anchor: 'sub-00-1',   /* 00 章总表（2026-11-02 收编：原「编排级定数」纸面清单入册） */
      groups: [
        { label: '衔接', keys: ['dimDur', 'revealDur'] },
        { label: '飞行', keys: ['takeoffFade', 'trailRatio'] },
        { label: '时序', keys: ['seatDelay'] }
      ],
      keys: {
        dimDur:      { label: '变暗/复原', unit: 's', def: 0.3,  min: 0.1, max: 1,   step: 0.05, sink: 'css', chk: 'link' },
        revealDur:   { label: '显形时长', unit: 's', def: 0.32, min: 0.1, max: 1,   step: 0.02, sink: 'css', chk: 'link' },
        takeoffFade: { label: '起飞渐显', unit: '',  def: 0.08, min: 0.02, max: 0.5, step: 0.01, chk: 'link' },
        /* 余辉比率：抵达后线保留数据色的时长 = 飞行时长 × 此值，随后回灰。
           2026-11-03 之前按族拆成四个键（单流 0.40 / 家族 0.45 / 归约族 0.42 /
           全换 0.30），四个名字都叫「余辉」却各调各的——统一成一个。 */
        trailRatio:  { label: '余辉比率', unit: '',  def: 0.4,  min: 0,   max: 1,   step: 0.01, chk: 'link' },
        seatDelay:   { label: '落位延迟', unit: 's', def: 0.5,  min: 0,    max: 1.5, step: 0.05, chk: 'link' }
      }
    },
    geo: {
      label: '舞台几何 · 曲线',
      /* 无 anchor：跨章骨架（02/03 尺寸 + 预设坐标 + 弧线车道），改值重建舞台（api.reload） */
      groups: [
        { label: '桌面骨架', keys: ['dtViewW','dtViewH','dtCardW','dtCardH','dtSlotSw','dtSlotSh','dtSlotGap','dtHdr','dtTitleFs','dtBadgeFs'] },
        { label: '窄屏骨架', keys: ['nrViewW','nrViewH','nrCardW','nrCardH','nrSlotSw','nrSlotSh','nrSlotGap','nrHdr','nrTitleFs','nrBadgeFs'] },
        { label: 'col34 坐标（左1右3）', keys: ['c34dtTx','c34dtTy','c34dtSx','c34dtSy1','c34dtSy2','c34dtSy3','c34dtLy','c34nrTx','c34nrTy','c34nrSx','c34nrSy1','c34nrSy2','c34nrSy3','c34nrLy'] },
        { label: 'grid 坐标（2×2）', keys: ['grdtX','grdtY','grdtDx','grdtDy','grdtLy','grnrX','grnrY','grnrDx','grnrDy','grnrLy'] },
        { label: '曲线 / 车道', keys: ['arcK','humpH','humpV'] }
      ],
      keys: {
        dtViewW: { label: '桌面·画布宽', unit: 'px', def: 1130, min: 900, max: 1400, step: 10, chk: 'truth', read: 'GEO 派生（账本 02/03 章行实测）' },
        dtViewH: { label: '桌面·画布高', unit: 'px', def: 680, min: 520, max: 820, step: 10, chk: 'truth', read: 'GEO 派生（账本 02/03 章行实测）' },
        dtCardW: { label: '桌面·卡宽', unit: 'px', def: 300, min: 220, max: 380, step: 2, chk: 'truth', read: 'GEO 派生（账本 02/03 章行实测）' },
        dtCardH: { label: '桌面·卡高', unit: 'px', def: 170, min: 130, max: 220, step: 2, chk: 'truth', read: 'GEO 派生（账本 02/03 章行实测）' },
        dtSlotSw: { label: '桌面·槽宽', unit: 'px', def: 46, min: 34, max: 60, step: 1, chk: 'truth', read: 'GEO 派生（账本 02/03 章行实测）' },
        dtSlotSh: { label: '桌面·槽高', unit: 'px', def: 46, min: 34, max: 60, step: 1, chk: 'truth', read: 'GEO 派生（账本 02/03 章行实测）' },
        dtSlotGap: { label: '桌面·槽距', unit: 'px', def: 12, min: 6, max: 20, step: 1, chk: 'truth', read: 'GEO 派生（账本 02/03 章行实测）' },
        dtHdr: { label: '桌面·卡头高', unit: 'px', def: 36, min: 26, max: 48, step: 1, chk: 'truth', read: 'GEO 派生（账本 02/03 章行实测）' },
        dtTitleFs: { label: '桌面·标题字号', unit: 'px', def: 15, min: 10, max: 20, step: 0.5, chk: 'truth', read: 'GEO 派生（账本 02/03 章行实测）' },
        dtBadgeFs: { label: '桌面·徽章字号', unit: 'px', def: 10, min: 6, max: 14, step: 0.5, chk: 'truth', read: 'GEO 派生（账本 02/03 章行实测）' },
        nrViewW: { label: '窄屏·画布宽', unit: 'px', def: 380, min: 320, max: 460, step: 5, chk: 'truth', read: 'GEO 派生（账本 02/03 章行实测）' },
        nrViewH: { label: '窄屏·画布高', unit: 'px', def: 720, min: 600, max: 860, step: 5, chk: 'truth', read: 'GEO 派生（账本 02/03 章行实测）' },
        nrCardW: { label: '窄屏·卡宽', unit: 'px', def: 146, min: 110, max: 190, step: 2, chk: 'truth', read: 'GEO 派生（账本 02/03 章行实测）' },
        nrCardH: { label: '窄屏·卡高', unit: 'px', def: 126, min: 96, max: 170, step: 2, chk: 'truth', read: 'GEO 派生（账本 02/03 章行实测）' },
        nrSlotSw: { label: '窄屏·槽宽', unit: 'px', def: 25, min: 18, max: 34, step: 1, chk: 'truth', read: 'GEO 派生（账本 02/03 章行实测）' },
        nrSlotSh: { label: '窄屏·槽高', unit: 'px', def: 25, min: 18, max: 34, step: 1, chk: 'truth', read: 'GEO 派生（账本 02/03 章行实测）' },
        nrSlotGap: { label: '窄屏·槽距', unit: 'px', def: 5, min: 2, max: 12, step: 1, chk: 'truth', read: 'GEO 派生（账本 02/03 章行实测）' },
        nrHdr: { label: '窄屏·卡头高', unit: 'px', def: 28, min: 20, max: 38, step: 1, chk: 'truth', read: 'GEO 派生（账本 02/03 章行实测）' },
        nrTitleFs: { label: '窄屏·标题字号', unit: 'px', def: 12.5, min: 9, max: 17, step: 0.5, chk: 'truth', read: 'GEO 派生（账本 02/03 章行实测）' },
        nrBadgeFs: { label: '窄屏·徽章字号', unit: 'px', def: 8.5, min: 6, max: 12, step: 0.5, chk: 'truth', read: 'GEO 派生（账本 02/03 章行实测）' },
        c34dtTx: { label: 'col34·桌面 目标卡x', unit: 'px', def: 10, min: 0, max: 200, step: 2, chk: 'truth', read: 'preset 坐标派生（卡位）' },
        c34dtTy: { label: 'col34·桌面 目标卡y', unit: 'px', def: 255, min: 120, max: 420, step: 5, chk: 'truth', read: 'preset 坐标派生（卡位）' },
        c34dtSx: { label: 'col34·桌面 源列x', unit: 'px', def: 820, min: 640, max: 1000, step: 5, chk: 'truth', read: 'preset 坐标派生（卡位）' },
        c34dtSy1: { label: 'col34·桌面 源1y', unit: 'px', def: 50, min: 20, max: 120, step: 5, chk: 'truth', read: 'preset 坐标派生（卡位）' },
        c34dtSy2: { label: 'col34·桌面 源2y', unit: 'px', def: 255, min: 160, max: 360, step: 5, chk: 'truth', read: 'preset 坐标派生（卡位）' },
        c34dtSy3: { label: 'col34·桌面 源3y', unit: 'px', def: 460, min: 380, max: 600, step: 5, chk: 'truth', read: 'preset 坐标派生（卡位）' },
        c34dtLy: { label: 'col34·桌面 图例y', unit: 'px', def: 50, min: 10, max: 120, step: 2, chk: 'truth', read: 'preset 坐标派生（卡位）' },
        c34nrTx: { label: 'col34·窄屏 目标卡x', unit: 'px', def: 6, min: 0, max: 60, step: 2, chk: 'truth', read: 'preset 坐标派生（卡位）' },
        c34nrTy: { label: 'col34·窄屏 目标卡y', unit: 'px', def: 297, min: 160, max: 420, step: 5, chk: 'truth', read: 'preset 坐标派生（卡位）' },
        c34nrSx: { label: 'col34·窄屏 源列x', unit: 'px', def: 226, min: 160, max: 300, step: 2, chk: 'truth', read: 'preset 坐标派生（卡位）' },
        c34nrSy1: { label: 'col34·窄屏 源1y', unit: 'px', def: 40, min: 10, max: 100, step: 5, chk: 'truth', read: 'preset 坐标派生（卡位）' },
        c34nrSy2: { label: 'col34·窄屏 源2y', unit: 'px', def: 297, min: 180, max: 420, step: 5, chk: 'truth', read: 'preset 坐标派生（卡位）' },
        c34nrSy3: { label: 'col34·窄屏 源3y', unit: 'px', def: 554, min: 420, max: 660, step: 5, chk: 'truth', read: 'preset 坐标派生（卡位）' },
        c34nrLy: { label: 'col34·窄屏 图例y', unit: 'px', def: 40, min: 10, max: 120, step: 2, chk: 'truth', read: 'preset 坐标派生（卡位）' },
        grdtX: { label: 'grid·桌面 原点x', unit: 'px', def: 175, min: 60, max: 320, step: 5, chk: 'truth', read: 'preset 坐标派生（卡位）' },
        grdtY: { label: 'grid·桌面 原点y', unit: 'px', def: 136, min: 60, max: 240, step: 5, chk: 'truth', read: 'preset 坐标派生（卡位）' },
        grdtDx: { label: 'grid·桌面 列距', unit: 'px', def: 480, min: 380, max: 620, step: 5, chk: 'truth', read: 'preset 坐标派生（卡位）' },
        grdtDy: { label: 'grid·桌面 行距', unit: 'px', def: 330, min: 240, max: 460, step: 5, chk: 'truth', read: 'preset 坐标派生（卡位）' },
        grdtLy: { label: 'grid·桌面 图例y', unit: 'px', def: 17, min: 5, max: 60, step: 1, chk: 'truth', read: 'preset 坐标派生（卡位）' },
        grnrX: { label: 'grid·窄屏 原点x', unit: 'px', def: 8, min: 0, max: 40, step: 2, chk: 'truth', read: 'preset 坐标派生（卡位）' },
        grnrY: { label: 'grid·窄屏 原点y', unit: 'px', def: 185, min: 90, max: 280, step: 5, chk: 'truth', read: 'preset 坐标派生（卡位）' },
        grnrDx: { label: 'grid·窄屏 列距', unit: 'px', def: 218, min: 160, max: 280, step: 2, chk: 'truth', read: 'preset 坐标派生（卡位）' },
        grnrDy: { label: 'grid·窄屏 行距', unit: 'px', def: 300, min: 220, max: 400, step: 5, chk: 'truth', read: 'preset 坐标派生（卡位）' },
        grnrLy: { label: 'grid·窄屏 图例y', unit: 'px', def: 113, min: 40, max: 200, step: 1, chk: 'truth', read: 'preset 坐标派生（卡位）' },
        arcK: { label: '弧线曲率', unit: '', def: 0.42, min: 0.2, max: 0.6, step: 0.01, chk: 'truth', read: '连线 path 控制点（42% 弦长）' },
        humpH: { label: '车道偏移·横', unit: 'px', def: 22, min: 6, max: 60, step: 1, chk: 'truth', read: 'allreduce 横向互换车道（hump）' },
        humpV: { label: '车道偏移·纵', unit: 'px', def: 54, min: 20, max: 120, step: 2, chk: 'truth', read: 'allreduce 纵向互换车道（hump）' }
      }
    },
    global: {
      label: '全局播放',
      keys: {
        pageSpeed: { label: '播放速度', unit: '×', def: 1, min: 0.3, max: 2.5, step: 0.1, chk: 'link' }
      }
    }
  };
})(window.CV = window.CV || {});
