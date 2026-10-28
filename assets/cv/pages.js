/* CommonVisual · 每页时序基线（可提交）
   ------------------------------------------------------------
   由原语页右上角「时序」面板的「保存到代码」导出：把调好的倍数 / 自定秒固化成基线。
   primitive.js 的 CV.pageOvRead 先读这里，再叠浏览器里的临时改动（localStorage）。
   必须在 primitive.js / 各页脚本之前加载。

   键名与页面齿轮一一对应：
     intro.sec / pre.sec / tail.sec …   自定秒（该项目规范里没有锚点）
     travel / pop                       倍数（规范值 × 这个数）
     delay.sec / hold.sec               每趟传递内部的落位延迟 / 间隔
   缺省（不写某一页）就等于全部用代码里的默认值，不必每页都列。 */
window.CV_PAGE_DEFAULTS = {};
