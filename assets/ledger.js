/* ============================================================
   CommonVisual · 规范总账（单源：00 章渲染 + 探针 ledger.mjs 同源）
   ------------------------------------------------------------
   每行 = { id, t 类型, name 中文名, en 英文名·入口, val 当前值,
            sec 跳章, kw 跳子节关键词, pages 页面范围, chk 检查型 }。
   t：'D' 动效（参数 / 编排节奏）｜'Y' 样式（几何 / 颜色 / 字号 / 曲线）。
   val：{ p:['组','键'], u:'单位' } → 现读 CV.params；字符串 → 静态真值。
   pages：8 = 全部原语页；数组 = 指定页；'demo' = 仅规范页演示（无原语页）。
   chk：link 改值可量 Δ ｜ unit 函数级 fixture 断言 ｜ truth 页面 DOM 真值
        ｜ src 源码消费检查（5.1 兜底）。
   覆盖判据：每个可改的东西必须有一行、入口列填得出 —— 填不出不许入表；
   清单加一行 = 00 章多一行 + 探针多一条 case 骨架。
   2026-11-02 B3 起色值行改 LIVE（期望从 spec.js 表现取，账本不再存 hex 副本）。
   2026-11-02 定稿：109 行（动效 41 + 样式 68）；涟漪定稿关闭不显示，不入表。
   ============================================================ */
(function (root) {
  'use strict';
  var P8 = ['gather', 'scatter', 'broadcast', 'allgather', 'reduce', 'allreduce', 'reducescatter', 'alltoall'];
  var P3 = ['reduce', 'allreduce', 'reducescatter'];           /* 融合 / Σ 族 */
  var CHOREO = ['gather', 'scatter', 'broadcast'];
  var P7M = ['gather', 'scatter', 'broadcast', 'allgather', 'reduce', 'allreduce', 'reducescatter'];   /* alltoall 双向直连无箭头（§04 定案豁免） */

  var LIVE = function (g, k, u) { return { p: [g, k], u: u || '' }; };

  var GROUPS = [
    { g: '01 · 完整数据', rows: [
      { id: '01-rankA',   t: 'Y', name: 'rank 色 A',      en: 'spec:rankA（PALETTE[0]）',    val: LIVE('01-color', 'rankA'),       sec: '01', kw: '', pages: P8, chk: 'truth' },
      { id: '01-rankB',   t: 'Y', name: 'rank 色 B',      en: 'spec:rankB（PALETTE[1]）',    val: LIVE('01-color', 'rankB'),       sec: '01', kw: '', pages: P8, chk: 'truth' },
      { id: '01-rankC',   t: 'Y', name: 'rank 色 C',      en: 'spec:rankC（PALETTE[2]）',    val: LIVE('01-color', 'rankC'),       sec: '01', kw: '', pages: P8, chk: 'truth' },
      { id: '01-rankD',   t: 'Y', name: 'rank 色 D',      en: 'spec:rankD（PALETTE[3]）',    val: LIVE('01-color', 'rankD'),       sec: '01', kw: '', pages: P8, chk: 'truth' },
      { id: '01-toneDeep',   t: 'Y', name: 'TONE deep（Σ 终点色）',   en: 'spec:toneDeep（CV.TONE.deep）',    val: LIVE('01-color', 'toneDeep'),    sec: '01', kw: '', pages: P8, chk: 'unit' },
      { id: '01-toneInk',    t: 'Y', name: 'TONE ink（越加越浓终点）', en: 'spec:toneInk（CV.TONE.ink）',      val: LIVE('01-color', 'toneInk'),     sec: '01', kw: '', pages: P8, chk: 'unit' },
      { id: '01-toneWire',   t: 'Y', name: 'TONE wire（连线闲置）',   en: 'spec:toneWire（CV.TONE.wire）',    val: LIVE('01-color', 'toneWire'),    sec: '01', kw: '', pages: P8, chk: 'unit' },
      { id: '01-toneWireDim',t: 'Y', name: 'TONE wireDim（网格灰）',  en: 'spec:toneWireDim（CV.TONE.wireDim）', val: LIVE('01-color', 'toneWireDim'), sec: '01', kw: '', pages: P8, chk: 'unit' },
      { id: '01-toneSlotBg', t: 'Y', name: 'TONE slotBg（空槽）',     en: 'spec:toneSlotBg（CV.TONE.slotBg）', val: LIVE('01-color', 'toneSlotBg'),  sec: '01', kw: '', pages: P8, chk: 'unit' },
      { id: '01-toneSlotHot',t: 'Y', name: 'TONE slotHot（接收中）',  en: 'spec:toneSlotHot（CV.TONE.slotHot）', val: LIVE('01-color', 'toneSlotHot'), sec: '01', kw: '', pages: P8, chk: 'unit' },
      { id: '01-mixRich',  t: 'Y', name: '归约混色公式',            en: 'CV.toneRich · theme.js',  val: '1 份原色 → 每份 +0.19 深 → 4 份 deep', sec: '01', kw: '', pages: P3, chk: 'unit' },
      { id: '01-frameRx',  t: 'Y', name: '整份虚线框圆角',          en: 'blocks/legend.js', val: 'rx 14', sec: '01', kw: '', pages: P8, chk: 'src' },
      { id: '01-frameBg',  t: 'Y', name: '整份虚线框底白',          en: 'blocks/legend.js', val: '白 72%', sec: '01', kw: '', pages: P8, chk: 'src' },
      { id: '01-frameStroke', t: 'Y', name: '整份虚线框描边',       en: 'blocks/legend.js', val: '#c1cadf 1.5', sec: '01', kw: '', pages: P8, chk: 'src' },
      { id: '01-frameDash',   t: 'Y', name: '整份虚线框虚线节距',  en: 'blocks/legend.js', val: '4 3', sec: '01', kw: '', pages: P8, chk: 'src' },
      { id: '01-framePad',    t: 'Y', name: '整份虚线框内边距',    en: 'blocks/legend.js', val: '0.24 × 块宽', sec: '01', kw: '', pages: P8, chk: 'src' },
      { id: '01-flood',    t: 'Y', name: '滤镜 flood 色（全站一份）', en: 'spec:flood（parts/stage.js 三滤镜）', val: LIVE('01-color', 'flood'), sec: '01', kw: '', pages: P8, chk: 'truth' }
    ] },
    { g: '02 · 数据块', rows: [
      { id: '02-size',    t: 'Y', name: '块尺寸（桌面 / 窄屏）', en: 'drawSlot · GEO', val: '46 / 25', sec: '02', kw: '', pages: P8, chk: 'truth' },
      { id: '02-rx',      t: 'Y', name: '块圆角',               en: 'drawSlot · legend.js', val: 'rx 8', sec: '02', kw: '', pages: P8, chk: 'truth' },
      { id: '02-own',     t: 'Y', name: '四态 own（数据色）',    en: 'move.js 四态机 · setSlot', val: '数据色实心', sec: '02', kw: '', pages: P8, chk: 'truth' },
      { id: '02-done',    t: 'Y', name: '四态 done（与 own 同渲染）', en: 'move.js 四态机', val: '数据色实心（语义区分）', sec: '02', kw: '', pages: P8, chk: 'truth' },
      { id: '02-waiting', t: 'Y', name: '四态 waiting',          en: 'move.js 四态机 · setSlot', val: '#f3eeff +「···」', sec: '02', kw: '', pages: P8, chk: 'truth' },
      { id: '02-empty',   t: 'Y', name: '四态 empty',            en: 'move.js 四态机 · setSlot', val: '#f7f8fc + 虚线', sec: '02', kw: '', pages: P8, chk: 'truth' },
      { id: '02-letterFs',t: 'Y', name: '块内字母字号',          en: 'setSlot', val: '0.33 × 块高（15 / 8）', sec: '02', kw: '', pages: P8, chk: 'truth' },
      { id: '02-cross',   t: 'D', name: '槽位变色过渡',          en: 'slotCross · 02-slot 组', val: LIVE('02-slot', 'slotCross', 's'), sec: '02', kw: '动态', pages: P8, chk: 'css' }
    ] },
    { g: '03 · rank 卡片', rows: [
      { id: '03-cardDur',  t: 'D', name: '卡片伸缩',   en: 'cardDur', val: LIVE('03-card', 'cardDur', 's'), sec: '03', kw: '动态', pages: P8, chk: 'link' },
      { id: '03-blockDur', t: 'D', name: '单块时长',   en: 'blockDur', val: LIVE('03-card', 'blockDur', 's'), sec: '03', kw: '动态', pages: P8, chk: 'link' },
      { id: '03-blockGap', t: 'D', name: '块间隔',     en: 'blockGap', val: LIVE('03-card', 'blockGap', 's'), sec: '03', kw: '动态', pages: P8, chk: 'link' },
      { id: '03-rowLull',  t: 'D', name: '长够→放块',  en: 'rowLull', val: LIVE('03-card', 'rowLull', 's'), sec: '03', kw: '动态', pages: P8, chk: 'link' },
      { id: '03-rowPause', t: 'D', name: '撤完→收卡',  en: 'rowPause', val: LIVE('03-card', 'rowPause', 's'), sec: '03', kw: '动态', pages: P8, chk: 'link' },
      { id: '03-size',     t: 'Y', name: '卡片尺寸（桌面 / 窄屏）', en: 'drawCard · GEO', val: '300×170 / 146×126', sec: '03', kw: '', pages: P8, chk: 'truth' },
      { id: '03-hdr',      t: 'Y', name: '卡头高',     en: 'drawCard', val: '36 / 28', sec: '03', kw: '', pages: P8, chk: 'truth' },
      { id: '03-titleFs',  t: 'Y', name: '标题字号',   en: 'drawCard · SVG 属性', val: '15 / 12.5', sec: '03', kw: '', pages: P8, chk: 'truth' },
      { id: '03-badgeSize',t: 'Y', name: '徽章尺寸',   en: 'badgeGeo · drawCard', val: '30×18 / 28×18', sec: '03', kw: '徽章', pages: P8, chk: 'truth' },
      { id: '03-badgeFormula', t: 'Y', name: '徽章有文字宽度公式', en: 'badgeGeo', val: 'max(30, 字数×字号×0.6+18)', sec: '03', kw: '徽章', pages: P8, chk: 'unit' },
      { id: '03-badgeFs',  t: 'Y', name: '徽章字号',   en: 'drawCard · SVG 属性', val: '10 / 8.5', sec: '03', kw: '徽章', pages: P8, chk: 'truth' },
      { id: '03-badgeRight', t: 'Y', name: '徽章右距卡边', en: 'badgeGeo', val: '14', sec: '03', kw: '徽章', pages: P8, chk: 'truth' },
      { id: '03-badgeRx',  t: 'Y', name: '徽章圆角',   en: 'badgeGeo', val: '6', sec: '03', kw: '徽章', pages: P8, chk: 'truth' },
      { id: '03-badgeBg',  t: 'Y', name: '徽章底色',   en: 'badgeGeo', val: '26% 白', sec: '03', kw: '徽章', pages: P8, chk: 'truth' },
      { id: '03-badgeText',t: 'Y', name: '徽章文字色', en: 'badgeGeo', val: '白 mono', sec: '03', kw: '徽章', pages: P8, chk: 'truth' },
      { id: '03-dimOp',    t: 'Y', name: '发送中变暗（透明度）', en: 'CV.beat.dim', val: '.6（传播中唯一全卡信号）', sec: '03', kw: '', pages: P8, chk: 'unit' },
      { id: '03-target',   t: 'Y', name: '目标卡描边', en: 'drawCard · target', val: 'dst 加深', sec: '03', kw: '', pages: P8, chk: 'truth' }
    ] },
    { g: '04 · 连线与箭头', rows: [
      { id: '04-idleColor', t: 'Y', name: '闲置线颜色',   en: 'spec:toneWire（verbs 绘制）', val: LIVE('01-color', 'toneWire'), sec: '04', kw: '', pages: P8, chk: 'truth' },
      { id: '04-idleWidth', t: 'Y', name: '闲置线宽度',   en: 'spec:wireW（CV.wire.paint）· 全换 wireWMuted', val: '2（全站统一）', sec: '04', kw: '', pages: P8, chk: 'truth' },
      { id: '04-idleDash',  t: 'Y', name: '闲置线虚线',   en: 'spec:wireDashOn/Off（CV.wire.paint）', val: '8 7（全站统一）', sec: '04', kw: '', pages: P8, chk: 'truth' },
      { id: '04-wireFade',  t: 'D', name: '点亮 / 回灰过渡', en: 'wireFade · 04-wire 组', val: LIVE('04-wire', 'wireFade', 's'), sec: '04', kw: '动态', pages: P8, chk: 'css' },
      { id: '04-flyColor',  t: 'Y', name: '飞行线颜色',   en: 'verbs 绘制', val: '数据色', sec: '04', kw: '', pages: P8, chk: 'truth' },
      { id: '04-flyWidth',  t: 'Y', name: '飞行线宽度',   en: 'spec:wireWLit（CV.wire.paint）', val: '2.6', sec: '04', kw: '', pages: P8, chk: 'truth' },
      { id: '04-flyDash',   t: 'Y', name: '飞行线虚线',   en: 'spec:wireDashLitOn / wireDashOff', val: '9 7', sec: '04', kw: '', pages: P8, chk: 'truth' },
      { id: '04-glowColor', t: 'Y', name: '余辉线颜色',   en: 'verbs 绘制', val: '数据色 · 淡', sec: '04', kw: '', pages: P8, chk: 'truth' },
      { id: '04-glowWidth', t: 'Y', name: '余辉线宽度 / 亮度', en: 'spec:wireWGlow / wireGlowOp / wireRestOp / wireDoneOp', val: '1.8 · 0.42 / 0.75 / 0.26', sec: '04', kw: '', pages: P8, chk: 'truth' },
      { id: '04-markerShape', t: 'Y', name: '箭头形状',   en: 'payload.marker', val: '三停箭头（defs 一份）', sec: '04', kw: '', pages: P7M, chk: 'truth' },
      { id: '04-markerSize',  t: 'Y', name: '箭头尺寸',   en: 'payload.marker', val: 'markerWidth × refX 现值', sec: '04', kw: '', pages: P7M, chk: 'truth' },
      { id: '04-markerFollow',t: 'Y', name: '箭头逐帧随色', en: 'payload.marker · fill', val: '随飞行数据色', sec: '04', kw: '', pages: P7M, chk: 'truth' }
    ] },
    { g: '05 · 数据包', rows: [
      { id: '05-packDur',   t: 'D', name: '飞行时长',   en: 'packDur', val: LIVE('05-packet', 'packDur', 's'), sec: '05', kw: '动态', pages: ['gather', 'scatter', 'broadcast', 'allgather'], chk: 'link' },
      { id: '05-packFade',  t: 'D', name: '送达淡出',   en: 'packFade', val: LIVE('05-packet', 'packFade', 's'), sec: '05', kw: '动态', pages: P8, chk: 'link' },
      { id: '05-packLead',  t: 'D', name: '起步让出',   en: 'packLead', val: LIVE('05-packet', 'packLead', ''), sec: '05', kw: '动态', pages: P8, chk: 'unit' },
      { id: '05-trailDist', t: 'D', name: '拖尾退后',   en: 'trailDist', val: LIVE('05-packet', 'trailDist', 'px'), sec: '05', kw: '动态', pages: P8, chk: 'unit' },
      { id: '05-trailScale',t: 'D', name: '拖尾浓度',   en: 'trailScale', val: LIVE('05-packet', 'trailScale', '×'), sec: '05', kw: '动态', pages: P8, chk: 'unit' },
      { id: '05-body',      t: 'Y', name: '包主体尺寸', en: 'CV.drawPacket', val: '24×24', sec: '05', kw: '', pages: P8, chk: 'truth' },
      { id: '05-board',     t: 'Y', name: '整份包底板（白底收成一份）', en: 'CV.drawPacket / payload.batch', val: '多块收成一个包', sec: '05', kw: '', pages: P8, chk: 'truth' },
      { id: '05-boardW',    t: 'Y', name: '底板宽公式', en: 'payload.batch', val: '4 块 = 101（4×20 + 3×3 + 两侧 6）', sec: '05', kw: '', pages: P8, chk: 'unit' }
    ] },
    { g: '06 · 控制条', rows: [
      { id: '06-scrub',  t: 'Y', name: 'scrub 刻度', en: 'parts/chrome.js', val: '0–1000', sec: '06', kw: '', pages: P8, chk: 'truth' },
      { id: '06-buttons',t: 'Y', name: '按钮组',     en: 'parts/chrome.js', val: '播放 / 上下步 / 循环', sec: '06', kw: '', pages: P8, chk: 'truth' }
    ] },
    { g: '07 · 计算方框', rows: [
      { id: '07-growDur',   t: 'D', name: '卡片伸长', en: 'growDur', val: LIVE('07-calc', 'growDur', 's'), sec: '07', kw: '动态', pages: P3, chk: 'link' },
      { id: '07-holdDur',   t: 'D', name: '方框展示', en: 'holdDur', val: LIVE('07-calc', 'holdDur', 's'), sec: '07', kw: '动态', pages: P3, chk: 'link' },
      { id: '07-shrinkDur', t: 'D', name: '卡片缩回', en: 'shrinkDur', val: LIVE('07-calc', 'shrinkDur', 's'), sec: '07', kw: '动态', pages: P3, chk: 'link' },
      { id: '07-calcFade',  t: 'D', name: '方框过渡', en: 'calcFade', val: LIVE('07-calc', 'calcFade', 's'), sec: '07', kw: '动态', pages: P3, chk: 'link' },
      { id: '07-gap1', t: 'D', name: '长够→亮框衔接（演示编排）', en: 'anatomy · 07 章演示', val: '.25s（未入调试台）', sec: '07', kw: '动态', pages: 'demo', chk: 'src' },
      { id: '07-gap2', t: 'D', name: '灭完→缩回衔接（演示编排）', en: 'anatomy · 07 章演示', val: '.2s（未入调试台）', sec: '07', kw: '动态', pages: 'demo', chk: 'src' },
      { id: '07-chipSize', t: 'Y', name: '方框尺寸', en: 'sum / split 方框段', val: '56×22', sec: '07', kw: '', pages: P3, chk: 'truth' },
      { id: '07-chipFs',   t: 'Y', name: '方框字号', en: 'sum / split 方框段', val: '11.5', sec: '07', kw: '', pages: P3, chk: 'truth' },
      { id: '07-chipTip',  t: 'Y', name: '方框提示词', en: 'sum / split 方框段', val: 'sum · avg · max · min', sec: '07', kw: '', pages: P3, chk: 'truth' }
    ] },
    { g: '08 · 落位弹跳', rows: [
      { id: '08-popDur',    t: 'D', name: '弹跳时长', en: 'popDur', val: LIVE('08-seat', 'popDur', 's'), sec: '08', kw: '', pages: P8, chk: 'link' },
      { id: '08-seatGap',   t: 'D', name: '多块错峰', en: 'seatGap', val: LIVE('08-seat', 'seatGap', 's'), sec: '08', kw: '', pages: P8, chk: 'link' },
      { id: '08-popStagger',t: 'D', name: '同批错峰', en: 'popStagger', val: LIVE('08-seat', 'popStagger', 's'), sec: '08', kw: '', pages: ['allreduce'], chk: 'link', note: '退役（2026-11-03 齐弹拍板）：无页面消费，Δ 恒 0，参数保留备用' },
      { id: '08-curve',     t: 'Y', name: '弹跳曲线（全站单源）', en: 'CV.POP_CURVE · beat.js', val: '0% .35 → 55% 1.16 → 100% 1 · 缓动 1.45', sec: '08', kw: '', pages: P8, chk: 'unit' },
      { id: '08-ring',      t: 'Y', name: '涟漪开关', en: 'CV.SHOW_RING', val: 'false（定稿不显示）', sec: '08', kw: '', pages: P8, chk: 'truth' }
    ] },
    { g: '09 · 融合', rows: [
      { id: '09-fuseDur',    t: 'D', name: '单次融合',   en: 'fuseDur', val: LIVE('09-merge', 'fuseDur', 's'), sec: '09', kw: '', pages: P3, chk: 'link' },
      { id: '09-mergeGap',   t: 'D', name: '多列错峰',   en: 'mergeGap', val: LIVE('09-merge', 'mergeGap', 's'), sec: '09', kw: '', pages: P3, chk: 'link' },
      { id: '09-fuseWake',   t: 'D', name: '唤醒结束',   en: 'fuseWake', val: LIVE('09-merge', 'fuseWake', ''), sec: '09', kw: '', pages: P3, chk: 'unit' },
      { id: '09-fuseRise',   t: 'D', name: '上浮结束',   en: 'fuseRise', val: LIVE('09-merge', 'fuseRise', ''), sec: '09', kw: '', pages: P3, chk: 'unit' },
      { id: '09-fuseFade',   t: 'D', name: '淡出起点',   en: 'fuseFade', val: LIVE('09-merge', 'fuseFade', ''), sec: '09', kw: '', pages: P3, chk: 'unit' },
      { id: '09-fuseSwap',   t: 'D', name: '换 Σ 时刻',  en: 'fuseSwap', val: LIVE('09-merge', 'fuseSwap', ''), sec: '09', kw: '', pages: P3, chk: 'unit' },
      { id: '09-fuseShrink', t: 'D', name: '终了缩放',   en: 'fuseShrink', val: LIVE('09-merge', 'fuseShrink', '×'), sec: '09', kw: '', pages: P3, chk: 'unit' },
      { id: '09-fuseGloss',  t: 'D', name: '白光强度',   en: 'fuseGloss', val: LIVE('09-merge', 'fuseGloss', ''), sec: '09', kw: '', pages: P3, chk: 'unit' },
      { id: '09-fuseTrail',  t: 'D', name: '拖尾退后',   en: 'fuseTrail', val: LIVE('09-merge', 'fuseTrail', 'px'), sec: '09', kw: '', pages: P3, chk: 'unit' },
      { id: '09-sigma',      t: 'Y', name: '结果块 Σ 主字符', en: 'setSlot / createMerge', val: 'letter = Σ', sec: '09', kw: '', pages: P3, chk: 'truth' },
      { id: '09-sigmaSub',   t: 'Y', name: '结果块下标 = 列字母', en: 'setSlot / createMerge', val: 'sub = 列字母', sec: '09', kw: '', pages: P3, chk: 'truth' },
      { id: '09-sigmaSup',   t: 'Y', name: '结果块上标 = 份数（每折 +1）', en: 'setSlot / createMerge', val: 'count 2/3/4 → ² ³ ⁴', sec: '09', kw: '', pages: P3, chk: 'truth' },
      { id: '09-sigmaColor', t: 'Y', name: '结果色混色', en: 'CV.toneRich', val: '(份数−1)/3 → deep', sec: '09', kw: '', pages: P3, chk: 'truth' },
      { id: '09-gloss',      t: 'Y', name: '白光三停渐变', en: 'createMerge', val: '两端透明 · 只动 gradientTransform', sec: '09', kw: '', pages: P3, chk: 'truth' },
      { id: '09-ghost',      t: 'Y', name: '折进拖尾残影', en: 'createMerge', val: '两块 · 缩放 .8 / .6', sec: '09', kw: '', pages: P3, chk: 'truth' }
    ] },
    { g: '10 · 聚焦', rows: [
      { id: '10-dataL',    t: 'Y', name: '聚焦高亮（data-l）',  en: 'CV.chrome.focus', val: '数据块挂 data-l', sec: '10', kw: '', pages: P8, chk: 'truth' },
      { id: '10-dataCard', t: 'Y', name: '置灰（data-card）',   en: 'CV.chrome.focus', val: '卡片挂 data-card → 变灰', sec: '10', kw: '', pages: P8, chk: 'truth' }
    ] },
    { g: '11 · 舞台分层', rows: [
      { id: '11-layers', t: 'Y', name: '层叠次序', en: 'engine/stage', val: '卡 < 块 < 连线 < 包 < 标签', sec: '11', kw: '', pages: P8, chk: 'truth' }
    ] },
    { g: '编排 · 衔接（跨页 · orch 组）', rows: [
      { id: 'OR-dimDur',    t: 'D', name: '变暗 / 复原时长', en: 'dimDur · orch 组', val: LIVE('orch', 'dimDur', 's'), sec: '03', kw: '', pages: ['gather'], chk: 'link' },
      { id: 'OR-revealDur', t: 'D', name: '显形时长', en: 'revealDur · orch 组', val: LIVE('orch', 'revealDur', 's'), sec: '03', kw: '', pages: CHOREO, chk: 'link' },
      { id: 'OR-wireLit',   t: 'D', name: '点亮时长（解说层）', en: 'narration.js · css .wire', val: '0.30s', sec: '04', kw: '', pages: P8, chk: 'src' },
      { id: 'OR-recv',      t: 'D', name: '转接收位（解说层）', en: 'narration.js', val: '0.30s', sec: '02', kw: '', pages: P8, chk: 'src' },
      { id: 'OR-takeoff',   t: 'D', name: '起飞渐显', en: 'takeoffFade · orch 组', val: LIVE('orch', 'takeoffFade', ''), sec: '05', kw: '动态', pages: P8, chk: 'link' },
      /* 余辉比率：2026-11-03 前按族拆四条（单流 40 / 家族 45 / 归约族 42 / 全换 30），
         四个名字都叫「余辉」却各调各的，统一成一条。 */
      { id: 'OR-trailRatio', t: 'D', name: '余辉比率', en: 'trailRatio · orch 组', val: LIVE('orch', 'trailRatio', ''), sec: '04', kw: '', pages: P8, chk: 'link' },
      { id: 'OR-seatDelay', t: 'D', name: '落位延迟', en: 'seatDelay · orch 组', val: LIVE('orch', 'seatDelay', 's'), sec: '08', kw: '', pages: P8, chk: 'link' }
    ] },
    { g: '全局', rows: [
      { id: 'GL-speed',  t: 'D', name: '播放速度', en: 'pageSpeed · global', val: LIVE('global', 'pageSpeed', '×'), sec: '00', kw: '', pages: P8, chk: 'link' },
      { id: 'GL-bp',     t: 'Y', name: '断点 860', en: '引擎舞台层', val: '< 860 用窄屏', sec: '03', kw: '', pages: P8, chk: 'truth' },
      { id: 'GL-narrow', t: 'Y', name: '窄屏重建（按当前进度重绘）', en: '引擎舞台层', val: '切换重建 · 进度保持', sec: '03', kw: '', pages: P8, chk: 'truth' }
    ] }
  ];

  var total = 0;
  GROUPS.forEach(function (g) { total += g.rows.length; });

  root.CV_LEDGER = {
    updated: '2026-11-02',
    groups: GROUPS,
    total: total,
    all: function () {
      var out = [];
      GROUPS.forEach(function (g) { g.rows.forEach(function (r) { out.push(r); }); });
      return out;
    },
    forPage: function (page) {
      var inP8 = P8.indexOf(page) >= 0;
      return this.all().filter(function (r) {
        if (r.pages === 'demo') return false;
        if (r.pages === 8 || r.pages === P8) return inP8;   /* 「全部原语页」不含 index / docs */
        return Array.isArray(r.pages) && r.pages.indexOf(page) >= 0;
      });
    }
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.CV_LEDGER;
})(typeof window !== 'undefined' ? window : globalThis);
