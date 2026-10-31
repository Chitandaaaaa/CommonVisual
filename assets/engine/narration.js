/* ============================================================
   CommonVisual v2 · L3 引擎 · 逐动作解说（词表 + 生成器）
   ------------------------------------------------------------
   规范：docs/steps.html。齿轮面板「逐动作解说」页签的数据源。
   三条铁律（steps.html §12）：
   ① 时间只算一次 —— 全部行的时间点从编译产物（CH）现取，
      不手写秒数；齿轮改倍数后重编译，区间跟着重算。
   ② 词表唯一 —— 谓语只允许 CV.NARR_LEX 里的动作词，
      生成器拼出表外动作直接抛错（想加动作先补词表）。
   ③ 闭合断言 —— 每行 结束 ≥ 开始；每步最后一行的结束 = 步末；
      全片最后一行的结束 = 动画总时长。开发期直接报错。
   句式固定：主体 · 动作（括号里是补充），结果列只放对象。
   ============================================================ */
(function (CV) {
  'use strict';

  /* ── 词表（steps.html §02.5）。value 只是给文档面板参考的规范/编排秒，参与校验的只有键。 ── */
  CV.NARR_LEX = {
    '变暗': '0.30s', '复原': '0.30s', '交空': '瞬时', '显形': '0.32s',
    '转接收位': '0.30s', '点亮': '0.30s', '起飞': '行程前 8%', '飞行': '按编排',
    '抵达': '瞬时', '淡出': '0.60s（split 0.55）', '余辉': '瞬时',
    '落位': '瞬时', '弹跳': '0.55s', '长高': '0.80s / 0.75s',
    '逐块出现': '0.40s/块 隔 0.15', '逐块撤': '0.40s/块 隔 0.15',
    '浮现': '0.35–0.38s', '折进': '0.42s/段 错峰 0.50',
    '收层': '0.38s（合计 shrinkDur 0.70）', '收窄': '0.40s',
    '收回': '0.80s', '静止': '按步'
  };

  var EPS = 1e-4;
  var SUP = { 2: '²', 3: '³', 4: '⁴' };
  var CW = { A: '紫色', B: '青色', C: '绿色', D: '橙色' };

  function spec(k, d) { var v = CV.specVal(k); return (typeof v === 'number' && v > 0) ? v : d; }

  /* ── 校验：词表 + 闭合。出错抛 Error（verify 的 problems 会回显）。 ── */
  function validate(out) {
    out.groups.forEach(function (g) {
      var rows = g.rows;
      if (!rows.length) throw new Error('narration: 「' + g.label + '」没有行');
      for (var i = 0; i < rows.length; i++) {
        var r = rows[i];
        if (r[1] !== null && r[1] < r[0] - EPS) {
          throw new Error('narration: ' + g.label + ' 行「' + r[2] + '」结束 ' + r[1] + ' < 开始 ' + r[0]);
        }
        var stem = String(r[2]).split(' · ')[1] || '';
        var paren = stem.indexOf('（');
        if (paren >= 0) stem = stem.slice(0, paren);
        /* 复合动作「淡出 → 收层」：每一段都得在词表里 */
        var bad = stem.split('→').map(function (x) { return x.trim(); })
          .filter(function (x) { return x && !CV.NARR_LEX[x]; });
        if (bad.length) {
          throw new Error('narration: 表外动作「' + bad.join('、') + '」（' + r[2] + '）—— 先补 CV.NARR_LEX');
        }
        if (i > 0 && r[0] < rows[i - 1][0] - EPS) {
          throw new Error('narration: ' + g.label + ' 行序倒挂 @' + r[2]);
        }
      }
      var last = rows[rows.length - 1];
      var lastEnd = (last[1] === null ? last[0] : last[1]);
      if (Math.abs(lastEnd - g.e) > 1e-3) {
        throw new Error('narration: 「' + g.label + '」末行结束 ' + lastEnd + ' ≠ 步末 ' + g.e);
      }
    });
    var lg = out.groups[out.groups.length - 1];
    if (Math.abs(lg.e - out.total) > 1e-3) {
      throw new Error('narration: 末步结束 ' + lg.e + ' ≠ 总时长 ' + out.total);
    }
  }

  /* ── 名字助手（steps.html §02.1：同形态多张时加 r<rank>/ 前缀）── */
  function slotN(scene, r) { return (scene.rows && scene.rows[r]) || 4; }
  function manyWide(scene) {
    var n = 0;
    Object.keys(scene.rows).forEach(function (k) { if (slotN(scene, Number(k)) > 1) n++; });
    return n;
  }
  function cardName(scene, r) {
    if (slotN(scene, r) === 1) return 'r' + r + '/单槽卡';
    return (scene.preset === 'grid' || manyWide(scene) > 1) ? 'r' + r + '/四槽卡' : '四槽卡';
  }
  function slotName(scene, r, i) {
    if (slotN(scene, r) === 1) return cardName(scene, r);
    return (scene.preset === 'grid' || manyWide(scene) > 1)
      ? 'r' + r + '/四槽卡-' + (i + 1) : '四槽卡-' + (i + 1);
  }
  /* 一排↔两排的规范秒（预留 / 收场共用） */
  function rowSpan4() { return CV.rowSpan(4); }

  /* 一组 = { label, s, e, rows: [[s, e|null, what, res], …] } */
  function G(label, s, e, rows) { return { label: label, s: s, e: e, rows: rows }; }
  function rest(s, e, text) { return [s, e, '画面 · 静止', text]; }

  /* ══════════ choreo：gather / scatter / broadcast / allgather ══════════ */
  /* CH.items 与 scene.beats 同序同长；transfer 段边界在 item 上（travelEnd/fadeEnd/seatStart/seatEnd） */
  function buildChoreo(scene, CH) {
    var out = [];
    var ord = 0;   /* 第几趟传递（弧线编号） */
    scene.beats.forEach(function (b, i) {
      var it = CH.items[i];
      var no = out.length + 1;
      if (b.kind === 'wait') {
        var rows = [];
        if (scene.preAt === b.id) {
          /* 显形（.slot-g opacity 过渡 0.32s）：gather 是目标卡的 2–4 格，
             scatter / broadcast 是接收方整张卡的空槽 */
          if (scene.overlay === 'gather') {
            for (var si = 1; si < slotN(scene, scene.target); si++) {
              rows.push([it.s, it.s + 0.32, slotName(scene, scene.target, si) + ' · 显形', '空格']);
            }
          } else {
            Object.keys(scene.rows).forEach(function (rk) {
              var r = Number(rk);
              if (r === scene.target) return;   /* 主角（gather 目的地 / scatter·broadcast 源）不显形 */
              var n = slotN(scene, r);
              rows.push([it.s, it.s + 0.32,
                cardName(scene, r) + ' · 显形' + (n > 1 ? '（' + n + ' 格）' : ''),
                n > 1 ? n + ' 个空格' : '空格']);
            });
          }
          rows.push(rest(it.s + 0.32, it.e, scene.narr.rest[b.id]));
        } else {
          rows = [rest(it.s, it.e, scene.narr.rest[b.id])];
        }
        out.push(G('第 ' + no + ' 步 · ' + b.label, it.s, it.e, rows));
        return;
      }

      /* move / copy */
      var s = it.s, tE = it.travelEnd, fE = it.fadeEnd, sS = it.seatStart, sE = it.seatEnd;
      var take = 0.08 * (tE - s);            /* 起飞＝行程前 8% */
      var fade = fE - tE;                    /* 送达淡出 = packFade × 倍数 */
      var rows = [];

      if (scene.overlay === 'ring') {
        /* allgather：一轮四包并发，按聚合写 */
        ord += 1;
        var recv = b.flows.map(function (f) {
          return 'r' + f.to[0] + ' 收 ' + f.letter;
        }).join('、');
        var popD = spec('popDur', 0.55);
        rows.push([s, null, '待收槽 · 转接收位', '紫底 ···（每卡 1 格）']);
        rows.push([s, s + 0.30, '4 条环边 · 点亮', '各自的数据色']);
        rows.push([s, s + take, '单体包 · 起飞（4 个）', '各自环边起点']);
        rows.push([s + take, tE, '单体包 · 飞行', '沿环边']);
        rows.push([tE, null, '单体包 · 抵达', '箭头尖']);
        rows.push([tE, tE + fade, '单体包 · 淡出', '透明']);
        rows.push([tE, null, '4 条环边 · 余辉', '45% 数据色']);
        rows.push([sS, null, '四张卡 · 落位', recv]);
        rows.push([sS, sS + popD, '四张卡 · 弹跳', '4 块错峰 0.50 依次落定']);
        rows.push(rest(sS + popD, it.e,
          ord + 1 >= scene.parts ? '四张卡都集齐 A B C D' : '四张卡各 ' + (ord + 1) + ' 块'));
      } else {
        ord += 1;
        var f = b.flows[0];
        var wire = '弧线 ' + ord;
        var isCopy = b.kind === 'copy';
        var pkt = isCopy ? '整份包' : '单体包 ' + f.letter;
        var cw = isCopy ? CW.A : CW[f.letter];
        var src = isCopy ? cardName(scene, f.from[0])
          : (scene.overlay === 'gather' ? cardName(scene, f.from[0]) : slotName(scene, f.from[0], f.from[1]));
        var slot = scene.overlay === 'gather' ? slotName(scene, f.to[0], f.to[1]) : cardName(scene, f.to[0]);

        if (scene.overlay === 'gather') rows.push([s, s + 0.30, src + ' · 变暗', '60% 不透明']);
        if (scene.overlay === 'scatter') rows.push([s, null, src + ' · 交空', '空格']);
        rows.push([s, s + 0.30, wire + ' · 点亮', cw + '虚线']);
        rows.push([s, s + 0.30, slot + ' · 转接收位' + (isCopy ? '（4 格）' : ''), '紫底 ···']);
        rows.push([s, s + take, pkt + ' · 起飞', wire + ' 起点']);
        rows.push([s + take, tE, pkt + ' · 飞行', '沿' + wire]);
        rows.push([tE, null, pkt + ' · 抵达', '箭头尖']);
        rows.push([tE, tE + fade, pkt + ' · 淡出', '透明']);
        rows.push([tE, null, wire + ' · 余辉', '40% ' + cw]);
        if (scene.overlay === 'gather') rows.push([tE, tE + 0.30, src + ' · 复原', '100%']);
        rows.push(rest(fE, sS, slot + ' 保持接收位'));
        rows.push([sS, null, slot + ' · 落位' + (isCopy ? '（4 格）' : ''),
          isCopy ? '数据块 A B C D' : '数据块 ' + f.letter]);
        rows.push([sS, sE, slot + ' · 弹跳', isCopy ? '4 格同时落定' : '落定']);
        rows.push(rest(sE, it.e, scene.narr.rest[b.id]));
      }
      out.push(G('第 ' + no + ' 步 · ' + b.label, it.s, it.e, rows));
    });
    return out;
  }

  /* ══════════ reduce（sum · accumulate）══════════ */
  /* CH.TM 各段秒 + CH.flows[].{start,arrive,popEnd,growEnd,mergeEnd,end} */
  function buildReduce(scene, CH) {
    var out = [], TM = CH.TM;
    var RS = rowSpan4();
    var GROW = spec('growDur', 0.75), MGAP = spec('mergeGap', 0.5),
        SHRINK = spec('shrinkDur', 0.7);

    out.push(G('第 1 步 · 说明', 0, TM.init, [rest(0, TM.init, scene.narr.rest.intro)]));

    var p = TM.init, rows = [[p, p + RS.cardDur, '四槽卡 · 长高', '一排变两排（卡高多一层）']];
    for (var k = 0; k < 4; k++) {
      var b0 = p + RS.cardDur + 0.3 + k * RS.step;
      rows.push([b0, b0 + RS.blockDur, '第二排-' + (k + 1) + ' · 显形',
        k === 0 ? '接收位（紫底 ···）' : '接收位']);
    }
    out.push(G('第 2 步 · 预留缓冲', p, p + TM.prealloc, rows));

    CH.flows.forEach(function (f, k) {
      var src = 'r' + f.from + '/四槽卡', w = '弧线 ' + (k + 1);
      var sup = SUP[k + 2] || '^' + (k + 2);
      var s = f.start, take = 0.08 * TM.fly, fade = spec('packFade', 0.6);
      var rows = [
        [s, null, src + ' · 交空（4 格）', '空格'],
        [s, s + 0.30, w + ' · 点亮', '数据色'],
        [s, s + take, '整份包 · 起飞', w + ' 起点'],
        [s + take, f.arrive, '整份包 · 飞行', '沿' + w],
        [f.arrive, null, '整份包 · 抵达', '箭头尖'],
        [f.arrive, f.popEnd, '第二排 · 落位', '4 块同时弹出'],
        [f.arrive, f.arrive + fade, '整份包 · 淡出', '透明'],
        [f.arrive, null, w + ' · 余辉', '45% 数据色'],
        [f.popEnd, f.growEnd, '双排卡 · 长高', '腾出计算层'],
        /* 方框在长高层内淡入：0.35→0.85 进度（与 sum.overlayReduce 的 chipA 同一口径） */
        [f.popEnd + 0.35 * GROW, f.popEnd + 0.85 * GROW, '计算框 · 浮现', 'sum · avg · max · min'],
        [f.growEnd, f.mergeEnd, '四段 · 折进（错峰 ' + MGAP + '）',
          'ΣA' + sup + ' ΣB' + sup + ' ΣC' + sup + ' ΣD' + sup],
        /* 收回层：前 45% 是方框淡出，之后卡片缩回（与 sum.overlayReduce 的 FADE 同一口径） */
        [f.mergeEnd, f.mergeEnd + 0.45 * SHRINK, '计算框 · 淡出', '透明'],
        [f.mergeEnd + 0.45 * SHRINK, f.end, '计算态卡 · 收层', '退回双排卡']
      ];
      out.push(G('第 ' + (k + 3) + ' 步 · r' + f.from + ' 的整份', s, f.end, rows));
    });

    var c = CH.COLLAPSE_AT;
    out.push(G('第 6 步 · 收场', c, CH.total, [
      [c, c + RS.blocks, '第二排 · 逐块撤（从右往左）', '4 个接收位撤掉'],
      [c + RS.blocks + 0.25, c + RS.close, '四槽卡 · 收回', '单排卡'],
      rest(c + RS.close, CH.total, scene.narr.rest.collapse)
    ]));
    return out;
  }

  /* ══════════ allreduce（sum · exchange）══════════ */
  /* CH.rounds[].{start,arrive,popStart,popEnd,calcStart,calcEnd,mergeStart,mergeEnd,end} */
  function buildAllreduce(scene, CH) {
    var out = [], TM = CH.TM, R = CH.rounds;
    var RS = rowSpan4();
    var MGAP = spec('mergeGap', 0.5);

    function expandRows(x, end) {
      var rows = [[x, x + RS.cardDur, '四张四槽卡 · 长高（同时）', '一排变两排']];
      for (var k = 0; k < 4; k++) {
        var b0 = x + RS.cardDur + 0.3 + k * RS.step;
        rows.push([b0, b0 + RS.blockDur, '第二排-' + (k + 1) + ' · 显形',
          k === 0 ? '接收位（紫底 ···）' : '接收位']);
      }
      if (scene.narr.rest.expand) {
        rows.push(rest(x + RS.open, end, scene.narr.rest.expand));
      }
      return rows;
    }
    function roundRows(r, q) {
      var take = 0.08 * TM.fly, fade = spec('packFade', 0.6);
      var parts = Math.pow(2, q + 1);
      return [
        [r.start, r.start + 0.30, '两条直连 · 点亮（两对同时）', '数据色'],
        [r.start, r.start + take, '整份包 · 起飞（4 个）', '各连线起点'],
        [r.start + take, r.arrive, '整份包 · 飞行', '沿直连'],
        [r.arrive, null, '整份包 · 抵达', '对方卡边缘'],
        [r.arrive, r.arrive + fade, '整份包 · 淡出', '透明'],
        [r.arrive, null, '两条直连 · 余辉', '42% 数据色'],
        [r.popStart, r.popEnd, '第二排 · 落位（4 块错峰 ' + TM.stag + '）', '每卡各收 4 块'],
        [r.calcStart, r.calcEnd, '双排卡 · 长高', '腾出计算层'],
        [r.calcEnd, r.mergeStart, '计算框 · 浮现', 'sum · avg · max · min'],
        [r.mergeStart, r.mergeEnd, '四段 · 折进（错峰 ' + MGAP + '）',
          '四段各 ' + parts + ' 份 → Σ' + (SUP[parts] || parts)],
        [r.mergeEnd, r.end, '计算框 · 淡出 → 收层', '退回双排卡']
      ];
    }

    out.push(G('第 1 步 · 说明', 0, CH.EXPAND_AT, [rest(0, CH.EXPAND_AT, scene.narr.rest.intro)]));
    out.push(G('第 2 步 · 预留两排', CH.EXPAND_AT, R[0].start, expandRows(CH.EXPAND_AT, R[0].start)));
    out.push(G('第 3 步 · 第 1 轮（横向互换）', R[0].start, R[0].end, roundRows(R[0], 0)));
    out.push(G('第 4 步 · 轮间停顿', R[0].end, R[1].start,
      [rest(R[0].end, R[1].start, scene.narr.rest.gap)]));
    out.push(G('第 5 步 · 第 2 轮（纵向互换）', R[1].start, R[1].end, roundRows(R[1], 1)));
    out.push(G('第 6 步 · 终点展示', R[1].end, CH.COLLAPSE_AT,
      [rest(R[1].end, CH.COLLAPSE_AT, scene.narr.rest.fin)]));

    var c = CH.COLLAPSE_AT;
    out.push(G('第 7 步 · 收场', c, CH.total, [
      [c, c + RS.blocks, '第二排 · 逐块撤（从右往左）', '4 个接收位撤掉'],
      [c + RS.blocks + 0.25, c + RS.close, '四张卡 · 收回', '单排卡'],
      rest(c + RS.close, CH.total, scene.narr.rest.collapse)
    ]));
    return out;
  }

  /* ══════════ reducescatter（split）══════════ */
  /* CH.AT 各窗口 + EMIT/RECV 路由 */
  function buildRs(scene, CH) {
    var out = [], AT = CH.AT, SEATG = CH.SEATG, MGAP = CH.MGAP;
    var RS = rowSpan4();
    var GROW = spec('growDur', 0.75), DATA = CV.PALETTE;

    function emitText(q) {
      /* 按发送集合把四张卡归组：r0/r1 交 C D，r2/r3 交 A B */
      var seen = {}, order = [];
      CH.EMIT[q].forEach(function (list, r) {
        var key = list.join(',');
        if (!seen[key]) { seen[key] = []; order.push(key); }
        seen[key].push(r);
      });
      return order.map(function (key) {
        return 'r' + seen[key].join('/r') + ' 交 ' +
          key.split(',').map(function (i) { return DATA[+i].letter; }).join(' ');
      }).join('，');
    }

    out.push(G('第 1 步 · 说明', 0, AT.intro.e, [rest(0, AT.intro.e, scene.narr.rest.intro)]));

    var p = AT.reserve.s, rows = [[p, p + RS.cardDur, '四张四槽卡 · 长高（同时）', '一排变两排']];
    for (var k = 0; k < 4; k++) {
      var b0 = p + RS.cardDur + 0.3 + k * RS.step;
      rows.push([b0, b0 + RS.blockDur, '第二排-' + (k + 1) + ' · 显形',
        k === 0 ? '接收位（紫底 ···）' : '接收位']);
    }
    out.push(G('第 2 步 · 预留两排', p, AT.reserve.e, rows));

    function roundRows(q, fly, seat, calc, merge) {
      var n = CH.RECV[q][0].length;
      var take = 0.08 * (fly.e - fly.s);
      return [
        [fly.s, null, '四张卡 · 交空（各 ' + CH.EMIT[q][0].length + ' 格）', emitText(q)],
        [fly.s, fly.s + 0.30, '四条直连 · 点亮', '数据色'],
        [fly.s, fly.s + take, '单体包 · 起飞（' + 4 * CH.EMIT[q][0].length + ' 个）', '各直连起点'],
        [fly.s + take, fly.e, '单体包 · 飞行', '沿直连'],
        [fly.e, null, '单体包 · 抵达', '对端卡边缘'],
        [fly.e, fly.e + 0.55, '单体包 · 淡出', '透明'],      /* split 硬编码 0.55 */
        [fly.e, null, '四条直连 · 余辉', '42% 数据色'],
        [fly.e, seat.e, '第二排 · 落位（' + n + ' 段错峰 ' + SEATG + '）', '每卡收 ' + n + ' 块'],
        [calc.s, calc.s + GROW, '双排卡 · 长高', '腾出计算层'],
        [calc.s + GROW, calc.e, '计算框 · 浮现', 'sum · avg · max · min'],
        [merge.s, merge.e, (n > 1 ? n + ' 段 · 折进（错峰 ' + MGAP + '）' : '这一段 · 折进'),
          n > 1 ? '这两段各合 2 份 → Σ²' : '凑满 4 份 → Σ⁴']
      ];
    }

    var r1 = roundRows(0, AT.fly1, AT.seat1, AT.calc1, AT.merge1);
    r1.push([AT.down1.s, AT.down1.e, '计算框 · 淡出 → 收层', '退回双排卡（第二排留着）']);
    out.push(G('第 3 步 · 第 1 轮（同列互换）', AT.fly1.s, AT.down1.e, r1));

    out.push(G('第 4 步 · 收窄', AT.slim.s, AT.slim.e,
      [[AT.slim.s, AT.slim.e, '第二排 · 收窄', '每卡撤掉这一轮用不上的那格']]));

    var r2 = roundRows(1, AT.fly2, AT.seat2, AT.calc2, AT.merge2);
    out.push(G('第 5 步 · 第 2 轮（同行互换）', AT.fly2.s, AT.merge2.e, r2));

    var w = AT.shrink.s;
    out.push(G('第 6 步 · 收场', w, CH.total, [
      [w, w + CH.CALC_DOWN, '计算框 · 淡出 → 收层', '退回双排卡'],
      [w + CH.CALC_DOWN, w + CH.CALC_DOWN + RS.blocks, '第二排 · 逐块撤（从右往左）', '接收位撤光'],
      [w + CH.CALC_DOWN + RS.blocks + 0.25, w + CH.CALC_DOWN + RS.close, '四张卡 · 收回', '单排卡'],
      rest(AT.tail.s, CH.total, scene.narr.rest.tail)
    ]));
    return out;
  }

  /* ══════════ alltoall（move 家族）══════════ */
  /* CH.rounds[].{start,arrive,done}，落位窗口 = done − arrive */
  function buildAtoa(scene, CH) {
    var out = [], R = CH.rounds, P4 = scene.parts || 4;
    var SEATG = CV.dur('seatGap');

    out.push(G('第 1 步 · 说明', 0, R[0].start, [rest(0, R[0].start, scene.narr.rest.intro)]));

    R.forEach(function (r, q) {
      var take = 0.08 * (r.arrive - r.start);
      var rows = [
        [r.start, null, '四张卡 · 交空（上排-' + (q + 1) + '）', '空格（4 张同时）'],
        [r.start, null, 'r' + q + ' 下排 · 转接收位', '紫底 ···'],
        [r.start, r.start + 0.30, '三条直连 · 点亮', '数据色'],
        [r.start, r.start + take, '单体包 · 起飞（3 个）', '各直连起点'],
        [r.start + take, r.arrive, '单体包 · 飞行', '沿直连'],
        [r.arrive, null, '单体包 · 抵达', 'r' + q + ' 卡边缘'],
        [r.arrive, r.arrive + spec('packFade', 0.6), '单体包 · 淡出', '透明'],
        [r.arrive, null, '三条直连 · 余辉', '30% 数据色'],
        [r.arrive, r.done, '下排 · 落位（4 块错峰 ' + SEATG + '）',
          'A' + q + ' B' + q + ' C' + q + ' D' + q],
        [r.arrive + (P4 - 1) * SEATG, r.done, '下排-4 · 弹跳', '最后一块落定']
      ];
      var end = r.done;
      if (q < P4 - 1) {
        end = R[q + 1].start;
        rows.push(rest(r.done, end, '四张卡上排少 1 片，下排有 ' + (q + 1) + ' 块'));
      }
      out.push(G('第 ' + (q + 2) + ' 步 · 第 ' + (q + 1) + ' 片互换', r.start, end, rows));
    });

    out.push(G('第 6 步 · 收尾', CH.win.tail.s, CH.total,
      [rest(CH.win.tail.s, CH.total, scene.narr.rest.tail)]));
    return out;
  }

  /* ══════════ 入口 ══════════ */
  /* CV.narrate(scene, CH) → { total, groups, flat }；flat = 展平的行（含组号）。
     任何形状对不上就抛 Error —— 调用方（齿轮面板 / 探针）让报错显形。 */
  CV.narrate = function (scene, CH) {
    if (!scene || !CH) throw new Error('narrate: 需要 scene 与编译产物 CH');
    if (!scene.narr) throw new Error('narrate: scene.' + scene.id + ' 缺 narr（静止行文案）');
    var groups;
    if (!scene.family) groups = buildChoreo(scene, CH);
    else if (scene.family === 'sum') groups = scene.sumType === 'exchange'
      ? buildAllreduce(scene, CH) : buildReduce(scene, CH);
    else if (scene.family === 'split') groups = buildRs(scene, CH);
    else if (scene.family === 'alltoall') groups = buildAtoa(scene, CH);
    else throw new Error('narrate: 未知 family ' + scene.family);

    var out = { total: CH.total, groups: groups, flat: [] };
    groups.forEach(function (g, gi) {
      g.rows.forEach(function (r, ri) {
        out.flat.push({ g: gi, ri: ri, s: r[0], e: r[1], what: r[2], res: r[3] });
      });
    });
    validate(out);
    return out;
  };
})(window.CV = window.CV || {});
