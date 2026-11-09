/* CommonVisual · 参数默认值（可提交基线）
   由规范页「保存到代码」直接写入本文件：把当前（含运行时调过的）参数固化为代码基线。
   必须在 theme.js 之前加载，theme.js 读 window.CV_PARAM_DEFAULTS 覆盖内置默认值。 */
window.CV_PARAM_DEFAULTS = {
  "03-card": {
    "cardDur": 0.8,
    "blockDur": 0.4,
    "blockGap": 0.15,
    "rowLull": 0.3,
    "rowPause": 0.25,
    "preHold": 0.4
  },
  "04-wire": {
    "wireW": 2,
    "wireWLit": 2.6,
    "wireWGlow": 1.8,
    "wireWMuted": 1.4,
    "wireDashOn": 8,
    "wireDashOff": 7,
    "wireDashLitOn": 9,
    "wireOpIdle": 1,
    "wireGlowOp": 0.42,
    "wireRestOp": 0.75,
    "wireDoneOp": 0.26
  },
  "05-packet": {
    "packDur": 1.5,
    "packFade": 0.6,
    "packLead": 0.16,
    "trailDist": 24,
    "trailScale": 1
  },
  "07-calc": {
    "growDur": 0.75,
    "holdDur": 0.95,
    "shrinkDur": 0.7,
    "calcFade": 0.35
  },
  "08-seat": {
    "popDur": 0.55,
    "seatGap": 0.5
  },
  "09-merge": {
    "fuseDur": 0.42,
    "mergeGap": 0.5,
    "fuseWake": 0.16,
    "fuseRise": 0.72,
    "fuseFade": 0.45,
    "fuseSwap": 0.78,
    "fuseShrink": 0.36,
    "fuseGloss": 0.9,
    "fuseTrail": 18
  },
  "orch": {
    "focusDur": 0.3,
    "revealDur": 0.32,
    "takeoffFade": 0.08,
    "trailRatio": 0.4,
    "seatDelay": 0.5
  },
  "global": {
    "pageSpeed": 1
  }
};
