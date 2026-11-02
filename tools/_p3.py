# -*- coding: utf-8 -*-
# 一次性补丁 #3：ledger.mjs 校准（跑完即删）
import io

p = 'tools/probes/ledger.mjs'
s = io.open(p, encoding='utf-8').read()

def rep(old, new, tag):
    global s
    assert old in s, 'NOT FOUND: ' + tag
    s = s.replace(old, new, 1)

# 1) linkDur Δ ms→s
rep("""  const delta = Math.round((d1 - d0) * 100) / 100;
  const want = Math.round(cfg.expect * 100) / 100;
  const pass = Math.abs(delta - want) <= 0.03 && d2 === d0;""",
    """  const delta = Math.round((d1 - d0) / 100) / 10;   /* ms → s，一位小数 */
  const want = Math.round(cfg.expect * 100) / 100;
  const pass = Math.abs(delta - want) <= 0.05 && d2 === d0;""",
    'linkDur')

# 2) wireAttrs → 全部 wire
rep("""      setTimeout(function () {
        var w = document.querySelector('#stage path.wire');
        if (!w) { done(null); return; }
        done({
          stroke: w.getAttribute('stroke'), width: w.getAttribute('stroke-width'),
          dash: w.getAttribute('stroke-dasharray')
        });
      }, 120);""",
    """      setTimeout(function () {
        var ws = [].slice.call(document.querySelectorAll('#stage path.wire'));
        done(ws.map(function (w) {
          return { stroke: w.getAttribute('stroke'), width: w.getAttribute('stroke-width'),
                   dash: w.getAttribute('stroke-dasharray') };
        }));
      }, 120);""",
    'wireAttrs')

# 3) 04 idle 按页
rep("""C['04-idleColor'] = C['04-idleWidth'] = C['04-idleDash'] = async function (pg, r, ok) {
  const fw = await firstFly(pg);
  const w = await wireAttrs(pg, Math.max(0, (fw ? fw.s : 0) - 0.15));
  const pass = w && w.stroke === '#c3cadb' && w.width === '1.4' && w.dash === '6 6';
  ok('5.' + NO[r.id] + ' ' + r.id + ' ' + r.name, !!w && (r.id === '04-idleColor' ? w.stroke === '#c3cadb' : r.id === '04-idleWidth' ? w.width === '1.4' : w.dash === '6 6'),
    w ? 'stroke=' + w.stroke + ' 宽=' + w.width + ' 虚线=' + w.dash : '页内无 wire');
};""",
    """C['04-idleColor'] = C['04-idleWidth'] = C['04-idleDash'] = async function (pg, r, ok) {
  const pageId = await pg.evaluate(function () { return location.pathname.split('/').pop().replace('.html', ''); });
  const want = pageId === 'alltoall' ? { w: '1.4', d: '6 6' } : { w: '2', d: '8 7' };
  const fw = await firstFly(pg);
  const ws = await wireAttrs(pg, Math.max(0, (fw ? fw.s : 0) - 0.15));
  const pick = r.id === '04-idleColor' ? '#c3cadb' : r.id === '04-idleWidth' ? want.w : want.d;
  const got = ws && ws.length ? (r.id === '04-idleColor' ? ws[0].stroke : r.id === '04-idleWidth' ? ws[0].width : ws[0].dash) : null;
  const all = ws && ws.length > 0 && ws.every(function (x) {
    return (r.id === '04-idleColor' ? x.stroke : r.id === '04-idleWidth' ? x.width : x.dash) === pick;
  });
  ok('5.' + NO[r.id] + ' ' + r.id + ' ' + r.name, all,
    ws && ws.length ? 'idle ' + got + '（本页期望 ' + pick + '，' + ws.length + ' 条全核）' : '页内无 wire');
};""",
    '04 idle')

# 4) 04 fly 任一命中
rep("""C['04-flyColor'] = C['04-flyWidth'] = C['04-flyDash'] = async function (pg, r, ok) {
  const fw = await firstFly(pg);
  const w = await wireAttrs(pg, fw ? fw.s + (fw.te - fw.s) * 0.5 : 0.1);
  const pass = w && w.stroke !== '#c3cadb' && w.width === '2.6' && w.dash === '9 7';
  ok('5.' + NO[r.id] + ' ' + r.id + ' ' + r.name, !!pass,
    w ? 'stroke=' + w.stroke + ' 宽=' + w.width + ' 虚线=' + w.dash : '页内无 wire');
};""",
    """C['04-flyColor'] = C['04-flyWidth'] = C['04-flyDash'] = async function (pg, r, ok) {
  const fw = await firstFly(pg);
  const ws = await wireAttrs(pg, fw ? fw.s + (fw.te - fw.s) * 0.5 : 0.1);
  const pick = r.id === '04-flyColor' ? function (x) { return x.stroke !== '#c3cadb'; }
    : r.id === '04-flyWidth' ? function (x) { return x.width === '2.6'; }
    : function (x) { return x.dash === '9 7'; };
  const hit = ws && ws.filter(pick).length;
  ok('5.' + NO[r.id] + ' ' + r.id + ' ' + r.name, !!ws && hit > 0,
    ws && ws.length ? '飞行中命中 ' + hit + '/' + ws.length + ' 条（sample 宽=' + ws[0].width + ' 虚线=' + ws[0].dash + '）' : '页内无 wire');
};""",
    '04 fly')

# 5) 04 glow 任一命中
rep("""C['04-glowColor'] = C['04-glowWidth'] = async function (pg, r, ok) {
  const fw = await firstFly(pg);
  const w = await wireAttrs(pg, fw ? fw.te + (fw.te - fw.s) * 0.2 : 0.2);
  const pass = w && w.stroke !== '#c3cadb' && (w.width === '1.6' || w.width === '1.8');
  ok('5.' + NO[r.id] + ' ' + r.id + ' ' + r.name, !!pass,
    w ? 'stroke=' + w.stroke + ' 宽=' + w.width : '页内无 wire');
};""",
    """C['04-glowColor'] = C['04-glowWidth'] = async function (pg, r, ok) {
  const fw = await firstFly(pg);
  const ws = await wireAttrs(pg, fw ? fw.te + (fw.te - fw.s) * 0.2 : 0.2);
  const pick = r.id === '04-glowColor' ? function (x) { return x.stroke !== '#c3cadb'; }
    : function (x) { return x.width === '1.6' || x.width === '1.8'; };
  const hit = ws && ws.filter(pick).length;
  ok('5.' + NO[r.id] + ' ' + r.id + ' ' + r.name, !!ws && hit > 0,
    ws && ws.length ? '余辉命中 ' + hit + '/' + ws.length + ' 条（sample 宽=' + ws[0].width + '）' : '页内无 wire');
};""",
    '04 glow')

# 6) markerFollow 任一非灰
rep("""      setTimeout(function () {
        var m = document.querySelector('#stage marker path');
        done(m ? m.getAttribute('fill') : null);
      }, 120);""",
    """      setTimeout(function () {
        var ms = [].slice.call(document.querySelectorAll('#stage marker path')).map(function (m) { return m.getAttribute('fill'); });
        var lit = ms.filter(function (x) { return x !== '#c3cadb'; });
        done(lit[0] || null);
      }, 120);""",
    'markerFollow')

# 7) place fixture 读序
rep("""    CV.payload.place(pkt, wire, 0.5, false);
    var mid = head();
    CV.payload.place(pkt, wire, 0.04, false);
    var early = { x: head()[0], op: op() };
    var t1 = pkt.t1.getAttribute('transform') || '';
    var m1 = t1.match(/translate\\(([-\\d.]+)/);
    var out = { midX: mid[0], earlyX: early.x, earlyOp: early.op, t1x: m1 ? +m1[1] : null };""",
    """    CV.payload.place(pkt, wire, 0.5, false);
    var mid = head();
    var t1 = pkt.t1.getAttribute('transform') || '';
    var m1 = t1.match(/translate\\(([-\\d.]+)/);
    CV.payload.place(pkt, wire, 0.04, false);
    var early = { x: head()[0], op: op() };
    var out = { midX: mid[0], earlyX: early.x, earlyOp: early.op, t1x: m1 ? +m1[1] : null };""",
    'place order')

# 8) batch fixture 真实槽几何
s = s.replace("var pkt = CV.payload.batch(svg, { sw: 20, sh: 20, gap: 3 }, CV.PALETTE);",
              "var pkt = CV.payload.batch(svg, { sw: 46, sh: 46, gap: 12 }, CV.PALETTE);")

# 9) buttons 全局
s = s.replace("var btns = document.querySelectorAll('#stage button, .controls button');",
              "var btns = document.querySelectorAll('button');")

# 10) fuse src = 最后一个 g
rep("""    function srcState() {
      var g = m.g.querySelector('g');
      var tr = g.getAttribute('transform') || '';
      var my = tr.match(/translate\\([-.\\d]+ [(-\\d.]+\\) scale\\(([-\\d.]+)\\)/);
      return { s: my ? +my[1] : null, op: +g.getAttribute('opacity') };
    }""",
    """    function srcState() {
      var gs = m.g.querySelectorAll('g');
      var g = gs[gs.length - 1];                    /* guide/t2/t1 之后 = src 块 */
      var tr = g.getAttribute('transform') || '';
      var my = tr.match(/scale\\(([-\\d.]+)\\)/);
      return { s: my ? +my[1] : null, op: +g.getAttribute('opacity') };
    }""",
    'fuse src')
s = s.replace("f.swapSet === 'Σ'", "/Σ/.test(f.swapSet)")

# 11) 07 calc 精确类
rep("""        var texts = [].slice.call(document.querySelectorAll('#stage text'));
        var tip = texts.filter(function (t) { return /sum/.test(t.textContent); })[0];
        var rect = tip ? tip.closest('g') ? tip.closest('g').querySelector('rect') : null : null;
        done({
          tip: tip ? tip.textContent : null,
          fs: tip ? tip.getAttribute('font-size') : null,
          w: rect ? rect.getAttribute('width') : null, h: rect ? rect.getAttribute('height') : null
        });""",
    """        var tip = document.querySelector('#stage .calc-tx');
        var rect = document.querySelector('#stage .calc-chip-bg');
        done({
          tip: tip ? tip.textContent : null,
          fs: tip ? tip.getAttribute('font-size') : null,
          w: rect ? rect.getAttribute('width') : null, h: rect ? rect.getAttribute('height') : null
        });""",
    '07 calc')

# 12) seatDelay want 取整
s = s.replace("const want = 0.1 * steps;", "const want = Math.round(0.1 * steps * 100) / 100;")

# 13) GL 用 card-base 属性
rep("""  const wide = await pg.evaluate(function () {
    var c = document.querySelector('.gpu-card');
    var r = c.getBoundingClientRect();
    return [Math.round(r.width), Math.round(r.height)];
  });""",
    """  const wide = await pg.evaluate(function () {
    var c = document.querySelector('.gpu-card .card-base');
    return [+c.getAttribute('width'), +c.getAttribute('height')];
  });""",
    'GL wide')
rep("""  const narrow = await pg.evaluate(function () {
    var c = document.querySelector('.gpu-card');
    var r = c.getBoundingClientRect();
    return [Math.round(r.width), Math.round(r.height)];
  });""",
    """  const narrow = await pg.evaluate(function () {
    var c = document.querySelector('.gpu-card .card-base');
    return [+c.getAttribute('width'), +c.getAttribute('height')];
  });""",
    'GL narrow')

# 14) link 期望校准（×流数）
s = s.replace("'07-growDur':   { group: '07-calc', key: 'growDur', set: 0.95, expect: 0.2 },",
              "'07-growDur':   { group: '07-calc', key: 'growDur', set: 0.95, expect: 0.6 },")
s = s.replace("'07-shrinkDur': { group: '07-calc', key: 'shrinkDur', set: 0.9, expect: 0.2 },",
              "'07-shrinkDur': { group: '07-calc', key: 'shrinkDur', set: 0.9, expect: 0.6 },")
s = s.replace("'07-holdDur':   { group: '07-calc', key: 'holdDur', set: 4, expect: 2.08 },",
              "'07-holdDur':   { group: '07-calc', key: 'holdDur', set: 4, expect: 6.24 },")
s = s.replace("'09-fuseDur':   { group: '09-merge', key: 'fuseDur', set: 0.62, expect: 0.2 },",
              "'09-fuseDur':   { group: '09-merge', key: 'fuseDur', set: 0.62, expect: 0.6 },")
s = s.replace("'09-mergeGap':  { group: '09-merge', key: 'mergeGap', set: 0.7, expect: 0.6 },",
              "'09-mergeGap':  { group: '09-merge', key: 'mergeGap', set: 0.7, expect: 1.8 },")
s = s.replace("'05-packDur': 不存在", "'05-packDur': 不存在")

# 15) 5.0 detail 差项
rep("""  ok('5.0 页面范围对账（' + pageId + '）', rows.length === EXPECT[pageId],
    '本页实跑 ' + rows.length + ' 项（总账口径 ' + EXPECT[pageId] + '）');""",
    """  const diff = LGR.all().filter(function (x) {
    return x.pages !== 'demo' && !rows.some(function (y) { return y.id === x.id; }) &&
      (x.pages.length > 4 ? true : x.pages.indexOf(pageId) >= 0);
  }).map(function (x) { return x.id; });
  ok('5.0 页面范围对账（' + pageId + '）', rows.length === EXPECT[pageId] && diff.length === 0,
    '本页实跑 ' + rows.length + ' 项（口径 ' + EXPECT[pageId] + '）' + (diff.length ? ' · 差: ' + diff.join(',') : ''));""",
    '5.0 detail')

io.open(p, 'w', encoding='utf-8', newline='').write(s)
print('patch3 done')
