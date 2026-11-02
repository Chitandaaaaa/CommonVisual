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
        rankA:       { label: 'rank A · 紫',    kind: 'color', sink: 'both', def: '#7c3aed' },
        rankB:       { label: 'rank B · 青',    kind: 'color', sink: 'both', def: '#0891b2' },
        rankC:       { label: 'rank C · 绿',    kind: 'color', sink: 'both', def: '#059669' },
        rankD:       { label: 'rank D · 橙',    kind: 'color', sink: 'both', def: '#d97706' },
        toneDeep:    { label: 'Σ 合满终点色',   kind: 'color', sink: 'both', def: '#4c1d95' },
        toneInk:     { label: '越加越浓终点',   kind: 'color', def: '#190d33' },
        toneWire:    { label: '连线闲置',       kind: 'color', def: '#c3cadb' },
        toneWireDim: { label: '网格 / 描边灰',  kind: 'color', def: '#8b93aa' },
        toneSlotBg:  { label: '空槽底',         kind: 'color', def: '#f7f8fc' },
        toneSlotHot: { label: '接收中占位底',   kind: 'color', def: '#f3eeff' },
        flood:       { label: '滤镜投影色',     kind: 'color', def: '#2a3352' }
      }
    },
    '02-slot': {
      label: '数据块·过渡',
      anchor: 'sub-02-1',
      keys: {
        slotCross: { label: '变色过渡', unit: 's', def: 0.3, min: 0, max: 1.5, step: 0.05, sink: 'css' }
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
        cardDur:  { label: '卡片伸缩', unit: 's', def: 0.8,  min: 0.3, max: 3,   step: 0.05 },
        blockDur: { label: '单块时长', unit: 's', def: 0.4,  min: 0.1, max: 1.5, step: 0.05 },
        blockGap: { label: '块间隔',   unit: 's', def: 0.15, min: 0,   max: 0.6, step: 0.01 },
        rowLull:  { label: '长够→放块', unit: 's', def: 0.3,  min: 0,   max: 1,   step: 0.05 },
        rowPause: { label: '撤完→收卡', unit: 's', def: 0.25, min: 0,   max: 1,   step: 0.05 }
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
        packDur:    { label: '飞行时长', unit: 's',  def: 1.5, min: 0.3, max: 4,   step: 0.1 },
        packFade:   { label: '送达淡出', unit: 's',  def: 0.6, min: 0,   max: 3,   step: 0.05 },
        packLead:   { label: '起步让出', unit: '',   def: 0.16, min: 0,  max: 0.5, step: 0.01 },
        trailDist:  { label: '拖尾退后', unit: 'px', def: 24,  min: 8,   max: 60,  step: 1 },
        trailScale: { label: '拖尾浓度', unit: '×',  def: 1,   min: 0,   max: 2,   step: 0.05 }
      }
    },
    '04-wire': {
      label: '连线·过渡',
      anchor: 'sub-04-1',
      keys: {
        wireFade: { label: '点亮 / 回灰', unit: 's', def: 0.3, min: 0, max: 1.5, step: 0.05, sink: 'css' }
      }
    },
    '07-calc': {
      label: '方框动态',
      anchor: 'sub-07-3',   /* 07 的第 3 个 h3 =「动态 · 方框长出与收回」（2026-11-01 拆 tab 后顺延） */
      groups: [
        { label: '耗时', keys: ['growDur', 'holdDur', 'shrinkDur'] },
        { label: '衔接', keys: ['calcFade'] }
      ],
      keys: {
        growDur:   { label: '卡片伸长', unit: 's', def: 0.75, min: 0.1, max: 2, step: 0.05 },
        holdDur:   { label: '方框展示', unit: 's', def: 0.95, min: 0.2, max: 4, step: 0.05 },
        shrinkDur: { label: '卡片缩回', unit: 's', def: 0.7,  min: 0.1, max: 2, step: 0.05 },
        calcFade:  { label: '方框过渡', unit: 's', def: 0.35, min: 0,   max: 1.5, step: 0.05 }
      }
    },
    '08-seat': {
      label: '落位弹跳',
      anchor: 'sub-08-1',
      groups: [
        { label: '耗时', keys: ['popDur', 'ringDur'] },
        { label: '节奏', keys: ['seatGap', 'popStagger'] }
      ],
      keys: {
        popDur:     { label: '弹跳时长', unit: 's', def: 0.55, min: 0.1, max: 1.5, step: 0.05, sink: 'both' },
        ringDur:    { label: '涟漪时长', unit: 's', def: 1.05, min: 0.2, max: 3,   step: 0.05, sink: 'css' },
        seatGap:    { label: '多块错峰', unit: 's', def: 0.5,  min: 0,    max: 0.8, step: 0.01 },
        popStagger: { label: '同批错峰', unit: 's', def: 0.12, min: 0,    max: 0.4, step: 0.01 }
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
        fuseDur:    { label: '单次融合',   unit: 's',  def: 0.42, min: 0.15, max: 1.2, step: 0.01 },
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
    orch: {
      label: '编排·衔接',
      anchor: 'sub-00-1',   /* 00 章总表（2026-11-02 收编：原「编排级定数」纸面清单入册） */
      groups: [
        { label: '衔接', keys: ['dimDur', 'revealDur'] },
        { label: '飞行', keys: ['takeoffFade'] },
        { label: '余辉', keys: ['trailChoreo', 'trailFam', 'trailReduce', 'trailATA'] },
        { label: '时序', keys: ['seatDelay'] }
      ],
      keys: {
        dimDur:      { label: '变暗/复原', unit: 's', def: 0.3,  min: 0.1, max: 1,   step: 0.05, sink: 'css' },
        revealDur:   { label: '显形时长', unit: 's', def: 0.32, min: 0.1, max: 1,   step: 0.02, sink: 'css' },
        takeoffFade: { label: '起飞渐显', unit: '',  def: 0.08, min: 0.02, max: 0.5, step: 0.01 },
        trailChoreo: { label: '余辉·单流', unit: '', def: 0.4,  min: 0,   max: 1,   step: 0.01 },
        trailFam:    { label: '余辉·家族', unit: '', def: 0.45, min: 0,   max: 1,   step: 0.01 },
        trailReduce: { label: '余辉·归约族', unit: '', def: 0.42, min: 0,  max: 1,   step: 0.01 },
        trailATA:    { label: '余辉·全换', unit: '', def: 0.3,  min: 0,   max: 1,   step: 0.01 },
        seatDelay:   { label: '落位延迟', unit: 's', def: 0.5,  min: 0,    max: 1.5, step: 0.05 }
      }
    },
    global: {
      label: '全局播放',
      keys: {
        pageSpeed: { label: '播放速度', unit: '×', def: 1, min: 0.3, max: 2.5, step: 0.1 }
      }
    }
  };
})(window.CV = window.CV || {});
