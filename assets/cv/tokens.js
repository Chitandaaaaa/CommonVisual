/* CommonVisual · 参数默认值（可提交）
   由规范页「保存到代码」直接写入本文件：把当前（含运行时调过的）参数固化为代码基线。
   必须在 kit.js 之前加载，kit.js 会读 window.CV_PARAM_DEFAULTS 覆盖内置默认值。 */
window.CV_PARAM_DEFAULTS = {
  "03-card": {
    "cardDur": 0.8,
    "blockDur": 0.4,
    "blockGap": 0.15
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
    "shrinkDur": 0.7
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
  "global": {
    "pageSpeed": 1
  }
};
