/* Render the accepted T2 scorer snapshot in both Pages and the offline site. */
(() => {
  "use strict";
  const {esc, count, num, tag, note} = window.VEMBook;
  const pair = (passed, total) => `${count(passed)} / ${count(total)}`;

  function boardCard(board) {
    const {mock, records} = board;
    const stages = values => values.map(stage => tag(stage, "visible")).join("");
    const reportDir = "../../virtualembryo_biocosmosX/reports/vem_scorer/t2/review_20261122/";
    const localRanking = location.protocol === "file:"
      ? `<a href="${reportDir}${esc(board.id)}/RANKING.md" class="btn small" target="_blank" rel="noopener">本地复核排名 ↗</a>` : "";
    return `<article class="bk-card t2-board" data-board="${esc(board.id)}">
      <h3>${esc(board.id)} · ${esc(board.title)}</h3>
      <dl>
        <dt>官床可见阶段</dt><dd class="t2-phase">${stages(board.visible)}</dd>
        <dt>验证目标</dt><dd>${tag(board.validationTarget, "answer")}</dd>
        <dt>TEST 可见阶段</dt><dd class="t2-phase">${stages(board.testVisible)}</dd>
        <dt>最终 TEST 目标</dt><dd>${tag(board.testTarget, "unseen")} · ${pair(board.dryrunsPassed, board.dryrunsExpected)} 次格式检查通过</dd>
        <dt>考场</dt><dd>${count(board.officialBeds)} 官床 · ${count(board.externalBeds)} 野床 · ${count(board.testBeds)} TEST</dd>
        <dt>工作集覆盖</dt><dd>${pair(board.worksetsCovered, board.worksetsExpected)}</dd>
        <dt>评估记录</dt><dd>${count(records.full)} 条有总分 · ${count(records.expressionOnly)} 条仅表达分 · ${count(records.notApplicable)} 条不适用 · ${count(records.notRun)} 条未运行</dd>
        <dt>留一族模拟考</dt><dd>判对 ${pair(mock.correct, mock.judged)} · 作出判断 ${pair(mock.judged, mock.eligible)}</dd>
      </dl>${localRanking}
    </article>`;
  }

  function render() {
    const data = window.VEMT2ScorerData;
    if (data?.version !== 1) return '<h1>时空预测评分看板</h1><p role="status">未能读取 T2 复核快照。请刷新页面。</p>';
    const {core, coverage, boards, metricGroups, sources} = data;
    const handoff = "../../virtualembryo_biocosmosX/reports/vem_scorer/t2/closeout_20261122/RUNBOOK.md";
    const localRunbook = location.protocol === "file:"
      ? `<div class="bk-actions"><a class="btn" href="${handoff}" target="_blank" rel="noopener">5090 评分操作手册 ↗</a></div>` : "";
    return `<article id="t2-scorer-board" aria-labelledby="t2-scorer-title">
      <header class="bk-header">
        <h1 id="t2-scorer-title">时空预测评分看板</h1>
        ${localRunbook}
      </header>
      <div class="bk-status"><span>开发评估快照 · <time datetime="${esc(data.asOf)}">${esc(data.asOf)}</time>（北京时间）</span><span>评分核心 ${esc(core.version)} 已冻结</span></div>
      <p class="bk-intro">查看胚胎插值和心脏外推的开发验证。最终 TEST 的真值隐藏，当前记录的是内存中的格式检查。</p>
      <div class="bk-totals" aria-label="T2 验收摘要">
        <div><b>${pair(core.anchorsMatched, core.anchorsTotal)}</b><small>公开锚点精确复现</small></div>
        <div><b>${pair(coverage.worksetsCovered, coverage.worksetsExpected)}</b><small>评分工作集已核验</small></div>
        <div><b>${count(coverage.referenceControls)}</b><small>复制参考对照均为 ${esc(coverage.referenceScore)} 分</small></div>
        <div><b>${pair(coverage.dryrunsPassed, coverage.dryrunsExpected)}</b><small>TEST 格式检查通过</small></div>
      </div>
      <section class="bk-section" aria-labelledby="t2-boards-title">
        <header class="bk-section-head"><h2 id="t2-boards-title">两块开发板</h2></header>
        <p class="bk-lead">共 ${count(coverage.officialBeds)} 张官床、${count(coverage.externalBeds)} 张野床、${count(coverage.testBeds)} 张 TEST 床。</p>
        <div class="bk-two">${boards.map(boardCard).join("")}</div>
      </section>
      <section class="bk-section" aria-labelledby="t2-metrics-title">
        <header class="bk-section-head"><h2 id="t2-metrics-title">评分口径</h2></header>
        <div class="bk-card">
          <div class="bk-four">${metricGroups.map(group => `<div><b>${esc(group.title)} · ${esc(group.weight)}%</b><small>${esc(group.metrics.join(" / "))}</small></div>`).join("")}</div>
          ${note("NFS 换算分低于 50 时，形状组乘以 NFS 换算分 / 50。缺少三维坐标的考场只计两组表达分项。")}
        </div>
        <p class="bk-lead">核心通过 ${esc(core.grade)} 级验收。${pair(core.historyWithinTolerance, core.historyTotal)} 份历史预测总分误差在 ±${esc(core.tolerance)} 分内，最大绝对差为 ${num(core.maxDelta, 5)}。${pair(core.gatesMatched, core.gatesTotal)} 组冻结回归对照的分项和总分与历史回执吻合。ODS 采用${core.ods === "legacy" ? "旧版" : esc(core.ods)}。</p>
        <details class="bk-disclosure"><summary>快照来源与校验指纹</summary>
          <ul class="t2-sources">${sources.map(source => `<li>${esc(source.label)}<code>SHA-256 ${esc(source.sha256)}</code></li>`).join("")}</ul>
        </details>
      </section>
    </article>`;
  }

  window.VEMT2Scorer = {render};
})();
