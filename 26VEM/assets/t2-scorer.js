/* T2 score register and scorer evidence, shared by the local dashboard and Pages. */
(() => {
  "use strict";
  const {esc, count, num, signed, stamp, tag, note, grid, row, sub, jobs} = window.VEMBook;
  const pair = (passed, total) => `${count(passed)} / ${count(total)}`;
  const boards = {T2A: "胚胎插值", T2B: "心脏外推"};
  const beds = {
    T2A: [
      ["T2A-STEREO-1", "VED-020 · Stereo-seq 胚胎三维重建图谱", "重复 1：E7.5、E8.0 → E7.75", "总分", ["V"]],
      ["T2A-STEREO-2", "VED-020 · Stereo-seq 胚胎三维重建图谱", "重复 2：E7.5、E8.0 → E7.75", "总分", ["V"]],
      ["T2A-PS", "VED-001 · Pijuan-Sala 早期全胚胎图谱", "E7.5、E8.0 → E7.75", "表达分", ["V", "T"]],
      ["T2A-MESP1", "VED-002 · Mesp1 早期心脏谱系图谱", "E7.5、E8.25 → E7.75", "表达分", ["V", "T"]],
      ["T2A-OFF", "官方验证 · 全胚胎", "E7.25、E8.0 → E7.5", "总分", ["V", "T"]],
    ],
    T2B: [
      ["T2B-FENG", "VED-012 · Feng 分心腔单细胞图谱", "CD1：E9.5、E10.5 → E12.5", "表达分", ["V", "T"]],
      ["T2B-QIU", "VED-007 · Qiu 产前细胞核图谱", "E9.5、E10.5 → E12.5", "表达分", ["V", "T"]],
      ["T2B-TOME", "VED-003 · TOME E9.5–E13.5 全胚胎图谱", "E9.5、E10.5 → E12.5", "表达分", ["V", "T"]],
      ["T2B-OFF", "官方验证 · 心脏外推", "E8.75、E9.5 → E10.5", "总分", ["V", "T"]],
    ],
  };
  const scoreStates = {
    scored: "有分", partial: "部分有分", expression_only: "仅表达分",
    failed: "失败", not_applicable: "不适用", not_run: "未运行", na: "不适用", pending: "待验收",
  };
  const phases = {baseline: "基线", screen: "初筛", full: "五种子全评", replay: "复评"};
  const groupFields = {expression_change: "表达变化", state_distribution: "状态分布", shape_size: "形状与大小", local_organization: "局部组织"};
  const skillFields = {de_score: "差异基因", de_direction: "变化方向", mmd_u: "表达分布", variogram: "变异函数", d2_shape: "形状距离", occupancy_dice: "占据重合", scale_log_ratio: "尺度差", neighborhood_mmd: "邻域分布"};
  const time = x => x && stamp(x) !== "—" ? `<time datetime="${esc(x)}">${esc(stamp(x))}</time>` : "—";
  const status = (value, map) => tag(map[value] || "待核实", ["accepted", "scored", "succeeded"].includes(value) ? "visible" : ["failed", "interrupted"].includes(value) ? "bad" : "");
  const localHref = "http://127.0.0.1:18765/#/scorer/t2";
  const publicURL = "https://raw.githubusercontent.com/Chemit797/Remote-Dashboard/refs/heads/vem-scorer-feed/progress.json";
  const apiURL = "https://api.github.com/repos/Chemit797/Remote-Dashboard/contents/progress.json?ref=vem-scorer-feed";
  const cacheKey = "26vem-t2-iterations-1";
  const perPage = 12;
  let current;

  function bedGuide(board) {
    const definition = ([id, name, stages, type, modes]) => `<div><dt>${esc(id)}</dt><dd>${esc(name)} · ${esc(stages)}<br>${esc(type)} · ${esc(modes.join(" / "))}</dd></div>`;
    const defs = beds[board];
    return `<div class="bk-card bk-agreed-beds"><h3>${esc(board)} 的考场</h3>
      <div class="bk-bed-definitions">
        <div><h4>野床 · ${defs.length - 1} 张</h4><dl>${defs.slice(0, -1).map(definition).join("")}</dl></div>
        <div><h4>官床 · 单独观察</h4><dl>${definition(defs.at(-1))}</dl></div>
        <div><h4>最终 TEST · 只做格式检查</h4><dl><div><dt>${esc(board)}-TEST</dt><dd>${board === "T2A" ? "全胚胎 E7.75 插值" : "心脏 E12.5 外推"}，本地没有隐藏真值分数。</dd></div></dl></div>
      </div>${note("V / T 是同一张床上的两种评分参考。种子 0–4 用于评分取样。")}</div>`;
  }

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

  function frozenEvidence() {
    const data = window.VEMT2ScorerData;
    if (data?.version !== 1) return '<p role="status">未能读取 T2 评分器复核快照。</p>';
    const {core, coverage, boards, metricGroups, sources} = data;
    return `<section class="bk-section" aria-labelledby="t2-frozen-title">
      <header class="bk-section-head"><h2 id="t2-frozen-title">评分器验收与口径</h2></header>
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
    </section>`;
  }

  function render() {
    const handoff = "../../virtualembryo_biocosmosX/reports/vem_scorer/t2/closeout_20261122/RUNBOOK.md";
    return `<article id="t2-scorer-board" aria-labelledby="t2-scorer-title">
      <header class="bk-header">
        <h1 id="t2-scorer-title">T2 时空预测评分看板</h1>
        ${location.protocol === "file:" ? `<a class="btn" href="${handoff}" target="_blank" rel="noopener">5090 评分操作手册 ↗</a>` : ""}
      </header>
      <div class="bk-status" id="t2-feed-status" role="status"><span>正在读取 T2 迭代记录…</span></div>
      <div id="t2-feed-errors"></div>
      <p class="bk-intro">查看 5090 的本地迭代进度、验收分数和逐条评分样本。时间均为北京时间。</p>
      <div class="bk-actions">
        <label for="t2-board-picker">评分板</label>
        <select id="t2-board-picker" data-t2-board>${Object.entries(boards).map(([id, title]) => `<option value="${id}">${id} ${esc(title)}</option>`).join("")}</select>
        <button type="button" class="btn small" data-t2-refresh>刷新记录</button>
      </div>
      <div id="t2-live-view"></div>
      ${frozenEvidence()}
    </article>`;
  }

  function batchLabel(batch) {
    const linked = batch.status === "accepted" && batch.methods.length;
    return `${linked ? `<button type="button" class="btn small" data-t2-jump="${esc(batch.id)}" data-t2-target="${batch.phase === "baseline" ? "baseline" : "samples"}" aria-label="查看 ${esc(batch.id)} 的评分记录">${esc(batch.id)}</button>` : esc(batch.id)}${sub(esc(phases[batch.phase] || "批次"))}`;
  }
  const batchName = batch => batch.id === "v2-history" ? "旧版 v2 基线 · 家族投票" : `${batch.id} · ${phases[batch.phase] || "批次"}`;

  function jobsSection(s, batches) {
    batches = batches.filter(batch => batch.id !== "v2-history");
    const reg = new Map(batches.map(batch => [batch.id, batch]));
    const liveJobs = (s.private?.jobs || []).filter(job => job.board === s.board);
    const linked = new Set(liveJobs.map(job => job.batch));
    const events = liveJobs.map(job => ({job, batch: reg.get(job.batch)}));
    events.push(...batches.filter(batch => !linked.has(batch.id)).map(batch => ({batch})));
    const active = job => ["waiting", "running"].includes(job?.status);
    const moment = ({job, batch}) => Date.parse(job?.ended_at || job?.started_at || batch?.at || "") || 0;
    events.sort((a, b) => Number(active(b.job) || active(b.batch)) - Number(active(a.job) || active(a.batch)) || moment(b) - moment(a));
    const {items, nav} = page(s, events, "events", 10);
    const batchStatus = { ...jobs, accepted: "已验收" };
    return `<section class="bk-section" aria-labelledby="t2-activity-title">
      <header class="bk-section-head"><h2 id="t2-activity-title">迭代进度</h2></header>
      <p class="bk-lead">5090 的本地批次先运行评分，验收通过后才进入分数表。${s.live ? "作业状态和验收状态分别显示。" : "公开页按快照更新；查看具体作业请打开本机实时看板。"}</p>
      <div class="bk-totals">
        ${s.live ? `<div><b>${s.data ? count(events.filter(({job, batch}) => active(job || batch)).length) : "—"}</b><small>运行或等待</small></div>` : ""}
        <div><b>${s.data ? count(batches.filter(batch => batch.status === "accepted").length) : "—"}</b><small>已验收批次</small></div>
        <div><b>${s.data ? count(batches.flatMap(batch => batch.methods).length) : "—"}</b><small>批次内方案记录</small></div>
        <div><b>${s.data ? count(batches.flatMap(batch => batch.methods).reduce((n, method) => n + method.scores.length, 0)) : "—"}</b><small>评分样本（含无分记录）</small></div>
      </div>
      ${items.length ? `<div class="bk-card">${grid(`${s.board} 作业与评分验收`, ["批次", ...(s.live ? ["5090 作业", "作业状态"] : []), "批次状态", "记录时间"], items.map(({job, batch}) => row(
        batch ? batchLabel(batch) : esc(job.batch || "—"),
        [...(s.live ? [job ? `<code>${esc(job.id)}</code>` : "—", job ? status(job.status, jobs) : "—"] : []),
         batch ? status(batch.status, batchStatus) : "待验收", time(batch?.at || job?.ended_at || job?.started_at)]
      )))}${nav}</div>` : `<p class="bk-lead">${s.data ? "当前接入的来源尚无新迭代回执。可在基线对照查看历史成绩。" : "尚未取得迭代数据。"}</p>`}
    </section>`;
  }

  function page(s, rows, key, size = perPage) {
    const pages = Math.max(1, Math.ceil(rows.length / size));
    const current = Math.max(0, Math.min(s.ui.pages.get(key) || 0, pages - 1));
    s.ui.pages.set(key, current);
    const button = (label, next, disabled) => `<button type="button" class="btn small" data-t2-page="${esc(key)}" data-t2-next="${next}" ${disabled ? "disabled" : ""}>${label}</button>`;
    return {items: rows.slice(current * size, (current + 1) * size), nav: pages > 1 ? `<div class="bk-pages" aria-label="分页">${button("上一页", current - 1, !current)}<span>${current + 1} / ${count(pages)} 页 · 共 ${count(rows.length)} 条</span>${button("下一页", current + 1, current === pages - 1)}</div>` : ""};
  }

  function scoreValue(score, expr) {
    return expr ? score.expr_half : score.total;
  }

  function bedScore(samples, [id, , , type, modes]) {
    const records = samples.filter(score => score.bed === id);
    if (!records.length) return "—";
    const anchors = records.filter(score => score.calibration === "official" && score.status === "scored" && Number.isFinite(score.total));
    const anchor = anchors.length ? sub(anchors.map(score => `官方锚点 ${num(score.total)}`).join(" / ")) : "";
    const cells = records.filter(score => score.calibration !== "official");
    if (!cells.length) return anchor || "—";
    const scored = cells.filter(score => score.status === "scored" && Number.isFinite(scoreValue(score, type === "表达分")));
    const seeds = new Set(cells.map(score => score.seed));
    const matched = [...seeds].every(seed => modes.every(mode => scored.filter(s => s.seed === seed && s.mode === mode).length === 1));
    if (!matched || scored.length !== cells.length || modes.length * seeds.size !== cells.length) {
      const bad = cells.filter(score => score.status === "failed").length;
      return sub(`${count(scored.length)} / ${count(cells.length)} 有分${bad ? ` · ${count(bad)} 失败` : ""}`) + anchor;
    }
    return `<b>${num(scored.reduce((sum, score) => sum + scoreValue(score, type === "表达分"), 0) / scored.length)}</b>${sub(`${type} · ${count(seeds.size)} 种子`)}${anchor}`;
  }

  function sampleDetails(s, key, batch, method) {
    const order = beds[s.board].map(([id]) => id);
    const scores = method.scores.slice().sort((a, b) => order.indexOf(a.bed) - order.indexOf(b.bed) || a.seed - b.seed || String(a.mode).localeCompare(String(b.mode)));
    const detailsKey = `detail:${key}`;
    const {items, nav} = page(s, scores, detailsKey, 40);
    const isExpr = score => beds[s.board].find(([id]) => id === score.bed)?.[3] === "表达分" || score.modality === "expression_only";
    const heads = ["考场", "评分参考", "种子", "结果", "成绩", ...Object.values(groupFields)];
    const rows = items.map(score => {
      const expr = isExpr(score), value = scoreValue(score, expr);
      return row(esc(score.bed), [
        esc(score.mode) + sub(score.calibration === "official" ? "官方锚点" : score.calibration === "empirical" ? "本床锚点" : ""),
        esc(score.seed), status(score.status, scoreStates), num(value) + (Number.isFinite(value) ? sub(expr ? "表达分" : "总分") : ""),
        ...Object.keys(groupFields).map(name => num(score.groups?.[name]))
      ], "", heads.slice(1));
    });
    const skills = items.filter(score => Object.values(score.skills || {}).some(Number.isFinite));
    const skillHeads = ["考场", "评分参考", "种子", ...Object.values(skillFields)];
    const skillRows = skills.map(score => row(esc(score.bed), [esc(score.mode), esc(score.seed), ...Object.keys(skillFields).map(name => num(score.skills?.[name]))], "", skillHeads.slice(1)));
    return `<div class="bk-detail" id="${esc(key)}">
      <div class="bk-detail-head"><h4>${esc(method.id)} · ${esc(batch.id)}</h4><p>验收 ${time(batch.at)} · ${status(method.status, scoreStates)}</p></div>
      <p>共 ${count(scores.length)} 条评分样本。表达床没有三维分，空白项显示为「—」。</p>
      ${rows.length ? grid(`${method.id} 逐种子评分`, heads, rows, "bk-cases") : ""}${nav}
      ${skillRows.length ? `<details class="bk-disclosure" data-t2-metrics="${esc(key)}"${s.ui.metrics.has(key) ? " open" : ""}><summary>查看八项换算分</summary>${grid(`${method.id} 八项换算分`, skillHeads, skillRows, "bk-cases")}</details>` : ""}
    </div>`;
  }

  function scoresSection(s, batches, kind) {
    const baseline = kind === "baseline", title = baseline ? "基线对照" : "样本记录";
    const defs = beds[s.board];
    const batchList = batches.filter(batch => (!baseline || batch.phase === "baseline") && batch.status === "accepted" && batch.methods.length);
    const records = batchList.flatMap(batch => batch.methods.map(method => ({ batch, method })));
    const query = s.ui.q.trim().toLowerCase();
    const filtered = baseline ? records : records.filter(({batch, method}) => (!s.ui.batch || batch.id === s.ui.batch) && (!query || `${method.id} ${batchName(batch)}`.toLowerCase().includes(query)));
    const {items, nav} = page(s, filtered, kind);
    const heads = ["方案 / 批次", "野床均分", ...defs.map(([id, , , type]) => `<span data-bed="${esc(id)}">${esc(id)}</span>${sub(`${id.endsWith("-OFF") ? "官床 · " : ""}${type}`)}`)];
    const rows = items.map(({batch, method}) => {
      const key = `t2-${s.board}-${kind}-${encodeURIComponent(batch.id)}-${encodeURIComponent(method.id)}`;
      const open = s.ui.open.has(key);
      const identity = `<button type="button" class="bk-open" data-t2-open="${esc(key)}" aria-expanded="${open}"><b>${esc(method.id)}</b><span>${esc(batchName(batch))} · ${count(method.scores.length)} 条</span></button>${sub(`${time(batch.at)} ${status(method.status, scoreStates)}`)}`;
      const values = [Number.isFinite(method.broad) ? `<b class="bk-rank-mean">${num(method.broad)}</b>` : "—", ...defs.map(def => bedScore(method.scores, def))];
      return row(identity, values, "data-recipe") + (open ? `<tr class="bk-detail-row"><td colspan="${heads.length}">${sampleDetails(s, key, batch, method)}</td></tr>` : "");
    });
    const filters = baseline || !batchList.length ? "" : `<div class="bk-iteration-picker">
      <label>方案 / 批次 <input type="search" data-t2-search value="${esc(s.ui.q)}" placeholder="输入编号"></label>
      <label>批次 <select data-t2-batch><option value="">全部批次</option>${batchList.map(batch => `<option value="${esc(batch.id)}"${batch.id === s.ui.batch ? " selected" : ""}>${esc(batchName(batch))}</option>`).join("")}</select></label>
    </div>`;
    return `<section class="bk-section bk-score-register" aria-labelledby="t2-${kind}-title">
      <header class="bk-section-head"><h2 id="t2-${kind}-title" tabindex="-1">${title}</h2>${s.data ? `<span>${count(filtered.length)} / ${count(records.length)} 条方案记录</span>` : ""}</header>
      <p class="bk-lead">${baseline ? "旧版 v2 基线保留逐床成绩，沿用家族投票口径。T2A 当前五种子复评按四张野床等权汇总，官床单列。" : "点击方案查看本批次的全部考场、参考、种子与分项；同一方案的不同批次分别保留。"}</p>
      ${filters}
      ${grid(`${s.board} ${title}`, heads, rows.length ? rows : [`<tr><td colspan="${heads.length}" class="bk-empty">${s.data ? (records.length ? "没有匹配的方案。" : "暂无已验收记录。") : "尚未取得迭代数据。"}</td></tr>`], "bk-aligned-score bk-freeze bk-matrix", {attrs:` style="--bk-bed-count:${defs.length}"`, columns:`<colgroup><col class="bk-col-recipe"><col class="bk-col-mean">${defs.map(() => "<col>").join("")}</colgroup>`})}${nav}
    </section>`;
  }

  const $ = (s, selector) => s.root.querySelector(selector);
  const resetUi = () => ({q: "", batch: "", pages: new Map(), open: new Set(), metrics: new Set()});

  function draw(s, focus) {
    const view = $(s, "#t2-live-view");
    const scroll = [...view.querySelectorAll(".bk-scroll")].filter(el => !el.closest(".bk-detail")).map(el => el.scrollLeft);
    const active = document.activeElement;
    if (!focus && view.contains(active)) {
      for (const attr of ["data-t2-search", "data-t2-batch", "data-t2-open", "data-t2-page"]) {
        if (active.hasAttribute(attr)) {
          focus = `[${attr}="${CSS.escape(active.getAttribute(attr))}"]`;
          if (attr === "data-t2-page") focus += `[data-t2-next="${CSS.escape(active.dataset.t2Next)}"]`;
          break;
        }
      }
    }
    const selection = active?.matches("[data-t2-search]") ? [active.selectionStart, active.selectionEnd] : null;
    const batches = (s.data?.boards.find(board => board.id === s.board)?.batches || []).slice().sort((a,b) => (Date.parse(b.at) || 0) - (Date.parse(a.at) || 0));
    view.innerHTML = jobsSection(s, batches) + bedGuide(s.board) + scoresSection(s, batches, "baseline") + scoresSection(s, batches, "samples");
    [...view.querySelectorAll(".bk-scroll")].filter(el => !el.closest(".bk-detail")).forEach((el, i) => { el.scrollLeft = scroll[i] || 0; });
    if (focus) {
      const target = view.querySelector(focus);
      target?.focus({preventScroll: true});
      if (selection && target?.matches("[data-t2-search]")) target.setSelectionRange(...selection);
    }
  }

  function paintStatus(s) {
    const el = $(s, "#t2-feed-status");
    const stale = s.data && Date.now() - Date.parse(s.data.collected_at) > (s.live ? 90_000 : 35 * 60_000);
    const latest = s.data?.boards.find(board => board.id === s.board)?.batches.filter(batch => batch.status === "accepted" && batch.at)
      .reduce((at, batch) => Date.parse(batch.at) > (Date.parse(at) || 0) ? batch.at : at, null);
    const source = s.label || (s.live ? "5090 实时" : "公开快照");
    const sampled = s.data ? `${source} · 采集 ${time(s.data.collected_at)}${stale ? " · 数据已过期" : ""}` : `${source} · ${s.error || s.loaded ? "未取得 T2 数据" : "正在读取"}`;
    const markup = `<span>${sampled}</span>${latest ? `<span>本板最近验收 ${time(latest)}</span>` : ""}${s.error ? `<span>本次更新失败${s.data ? "，保留上次数据" : ""}</span>` : ""}${s.live ? "" : `<span><a href="${localHref}">本机实时看板 ↗</a></span>`}`;
    if (s.statusMarkup !== markup) {el.innerHTML = markup; s.statusMarkup = markup;}
    const errors = s.private?.errors || [];
    const errorMarkup = errors.length ? `<details class="bk-disclosure"><summary>${count(errors.length)} 条采集异常</summary><ul>${errors.map(error => `<li>${esc(error)}</li>`).join("")}</ul></details>` : "";
    if (s.errorMarkup !== errorMarkup) {$(s, "#t2-feed-errors").innerHTML = errorMarkup; s.errorMarkup = errorMarkup;}
  }

  function readPayload(s, payload, label) {
    const data = payload?.summary?.t2_iterations ?? payload?.t2_iterations ?? payload;
    if (data?.schema !== 1 || !Array.isArray(data.boards) || !Number.isFinite(Date.parse(data.collected_at)) || data.boards.some(board => !Array.isArray(board.batches) || board.batches.some(batch => !Array.isArray(batch.methods) || batch.methods.some(method => !Array.isArray(method.scores))))) return false;
    if (s.data && Date.parse(data.collected_at) < Date.parse(s.data.collected_at)) return true;
    const privateData = s.live ? payload.t2_private : null;
    const revision = JSON.stringify([data.boards, privateData]);
    s.data = data; s.private = privateData; s.label = label;
    if (s.revision !== revision) {s.revision = revision; draw(s);}
    return true;
  }

  async function refresh(s) {
    if (!s.endpoint || s.busy) return;
    s.busy = true;
    try {
      const signal = AbortSignal.any([s.abort.signal, AbortSignal.timeout(12_000)]);
      const load = async (url, headers) => {
        const response = await fetch(url, {cache: "no-store", credentials: "omit", referrerPolicy: "no-referrer", signal, headers});
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json();
      };
      let payload;
      if (s.live || s.endpoint !== publicURL) {
        payload = await load(s.endpoint);
      } else {
        const tick = Math.floor(Date.now() / 60_000);
        try {payload = await load(`${publicURL}?t=${tick}`);}
        catch (_) {payload = await load(`${apiURL}&t=${tick}`, {Accept: "application/vnd.github.raw+json"});}
      }
      if (current !== s) return;
      if (!readPayload(s, payload, s.live ? "5090 实时" : "GitHub 公开快照")) throw new Error("T2 feed missing");
      s.error = !!payload.collection_error;
      if (!s.live) {
        try {localStorage.setItem(cacheKey, JSON.stringify(s.data));} catch (_) {}
      }
    } catch (_) {
      if (current === s) s.error = true;
    } finally {
      s.busy = false; s.loaded = true;
      if (current === s) paintStatus(s);
    }
  }

  function mount({live = !!document.querySelector('meta[name="vem-scorer-live"]'), endpoint = live ? "/api/live" : publicURL, initial} = {}) {
    stop();
    const root = document.getElementById("t2-scorer-board");
    if (!root) return;
    const ui = {T2A: resetUi(), T2B: resetUi()};
    const s = current = {root, live, endpoint, board: "T2A", ui: ui.T2A, abort: new AbortController()};
    const listeners = {signal: s.abort.signal};
    draw(s);
    if (live) {
      try {
        const payload = initial ?? JSON.parse(document.getElementById("sc-initial").textContent);
        readPayload(s, payload, "5090 实时");
        s.error = !!payload.collection_error;
      } catch (_) {}
    } else {
      readPayload(s, initial ?? window.VEMT2IterationsSeed ?? window.VEMScorerSeed, "随页快照");
      try {readPayload(s, JSON.parse(localStorage.getItem(cacheKey)), "上次公开快照");} catch (_) {}
    }
    paintStatus(s);
    root.addEventListener("input", e => {
      if (!e.target.matches("[data-t2-search]")) return;
      s.ui.q = e.target.value; s.ui.pages.set("samples", 0); draw(s);
    }, listeners);
    root.addEventListener("change", e => {
      if (e.target.matches("[data-t2-board]") && Object.hasOwn(boards, e.target.value)) {
        s.board = e.target.value; s.ui = ui[s.board]; draw(s); paintStatus(s);
      } else if (e.target.matches("[data-t2-batch]")) {
        s.ui.batch = e.target.value; s.ui.pages.set("samples", 0); draw(s);
      }
    }, listeners);
    root.addEventListener("click", e => {
      if (e.target.closest("[data-t2-refresh]")) {void refresh(s); return;}
      const jump = e.target.closest("[data-t2-jump]");
      if (jump) {
        if (jump.dataset.t2Target === "samples") {
          s.ui.q = ""; s.ui.batch = jump.dataset.t2Jump; s.ui.pages.set("samples", 0); draw(s);
        }
        const target = $(s, `#t2-${CSS.escape(jump.dataset.t2Target)}-title`);
        target.closest("section").scrollIntoView(); target.focus({preventScroll: true});
        return;
      }
      const open = e.target.closest("[data-t2-open]");
      if (open) {
        const key = open.dataset.t2Open;
        if (s.ui.open.has(key)) s.ui.open.delete(key); else s.ui.open.add(key);
        draw(s);
        return;
      }
      const pager = e.target.closest("[data-t2-page]");
      if (pager) {
        const key = pager.dataset.t2Page;
        s.ui.pages.set(key, Number(pager.dataset.t2Next));
        draw(s, `[data-t2-page="${CSS.escape(key)}"]:not(:disabled)`);
      }
    }, listeners);
    root.addEventListener("toggle", e => {
      const key = e.target.dataset?.t2Metrics;
      if (key && e.target.isConnected) {
        if (e.target.open) s.ui.metrics.add(key); else s.ui.metrics.delete(key);
      }
    }, {...listeners, capture: true});
    void refresh(s);
    s.tick = setInterval(() => void refresh(s), live ? 15_000 : 60_000);
    s.age = setInterval(() => paintStatus(s), 15_000);
  }

  function stop() {
    if (!current) return;
    current.abort.abort(); clearInterval(current.tick); clearInterval(current.age); current = null;
  }

  window.VEMT2Scorer = {render, mount, stop};
})();
