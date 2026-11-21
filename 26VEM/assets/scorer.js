/* 26VEM scoring progress. The public site reads only the aggregate feed. */
(() => {
  "use strict";
  const live = Boolean(document.querySelector('meta[name="vem-scorer-live"]'));
  const fileEntry = location.protocol === "file:";
  const raw = "https://raw.githubusercontent.com/Chemit797/Remote-Dashboard/vem-scorer-feed/progress.json";
  const api = "https://api.github.com/repos/Chemit797/Remote-Dashboard/contents/progress.json?ref=vem-scorer-feed";
  const cacheKey = "26vem-scorer-public-v1";
  const jobLabels = {waiting:"等待排程", running:"运行中", succeeded:"已完成", failed:"曾失败", interrupted:"已中断", unknown:"待核实"};
  const cellLabels = {valid:"有效", na:"NA", failed:"失败"};
  const phases = {seed0:"单配方 · seed 0", combinations:"组合配方 · seed 0", replays:"补充技术种子", review:"多种子汇总 · 待复核"};
  const timeFormat = new Intl.DateTimeFormat("zh-CN", {timeZone:"Asia/Shanghai", year:"numeric",
    month:"2-digit", day:"2-digit", hour:"2-digit", minute:"2-digit", second:"2-digit", hourCycle:"h23"});
  const text = value => String(value ?? "").replace(/[&<>"']/g, c =>
    ({"&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;"}[c]));
  const stamp = value => value && Number.isFinite(Date.parse(value)) ? timeFormat.format(new Date(value)) : "—";
  const number = (value, signed = false) => value == null ? "—" :
    (signed && value > 0 ? "+" : "") + Number(value).toFixed(2);
  const allFilters = () => ({bed:"", span:"", recipe:"", seed:"", status:""});
  let current = null;
  const pageSize = 24;

  function checkSummary(s) {
    const amount = v => Number.isSafeInteger(v) && v >= 0;
    if (!s || s.schema !== 1 || !Number.isFinite(Date.parse(s.collected_at)) ||
        !Object.hasOwn(phases,s.phase) || !["beds","scored_beds","test_beds","cells","valid","na","failed"].every(k => amount(s[k])) ||
        s.cells !== s.valid + s.na + s.failed || !Array.isArray(s.spans) || s.spans.length !== 3 ||
        !["1D","2D","1DL"].every((span, i) => s.spans[i].span === span &&
            ["beds","valid","na","failed"].every(k => amount(s.spans[i][k]))) ||
        !s.jobs || !Object.keys(jobLabels).every(k => amount(s.jobs[k]))) throw Error("快照格式不完整");
    return s;
  }

  function shell() {
    const jump = fileEntry ? '<a class="btn primary" href="http://127.0.0.1:18765/#/scorer">打开 5090 实时明细 ↗</a>' : "";
    return '<article class="scorer" id="scorer-board"><header class="sc-head"><div><p class="kicker">Virtual Embryo · T1 时间预测</p>' +
      '<h1>T1 评分器</h1><p class="sub">' +
      (live ? "5090 实时明细，每 15 秒读取已验收的结果和作业状态。" : "5090 每 15 分钟发布进度，页面每分钟检查更新。") +
      '</p></div><div class="sc-actions">' + jump +
      '<button type="button" class="btn" data-action="refresh">检查更新</button></div></header>' +
      '<p id="sc-fresh" role="status" class="sc-fresh">正在读取评分进度…</p><div id="sc-summary"></div>' +
      '<div id="sc-private"></div><section class="sc-guide"><h2>怎么看这些分数</h2><p><b>1D / 2D</b> 是从最后可见胚龄向后预测 1 天或 2 天。例如 E8.5 → E9.5 是 1D，E8.5 → E10.5 是 2D。<b>1DL</b> 是较晚的一天，本次为 E10.5 → E11.5。</p>' +
      '<p>对于有答案的测试床，预测先按各床自己的基准换算成四项分数，再加权得到总分。DES 看差异基因（25%），DCS 看变化排序（25%），MMD 看细胞群分布（30%），CSS 看基因间结构（20%）。同一床、同一种子上，Δ 是配方总分减去复制最后可见阶段的 S00 总分，正数表示优于复制。</p>' +
      '<p>当前用 1D 确定各来源的参考权重，再用 2D 和多个技术种子判断哪些配方值得带到 E12.5。T1-TEST 有输入、没有公开答案，只能做格式检查和最终预测。本页展示开发评估。</p></section>' +
      '</article>';
  }

  function drawSummary(s) {
    const statusBar = g => {
      const total = g.valid + g.na + g.failed || 1;
      return '<div class="sc-bar" aria-hidden="true">' + Object.keys(cellLabels).map(k =>
        '<i class="sc-' + k + '" style="width:' + (100 * g[k] / total) + '%"></i>').join("") + '</div>';
    };
    const metrics = [["测试床",s.beds,s.scored_beds + " 张已评分 · " + s.test_beds + " 张无答案"],
      ["评估格",s.cells,"每格为一个床、配方与种子的组合"],["有效分数",s.valid,"可与同床基线比较"],
      ["NA / 失败",s.na + " / " + s.failed,"NA 表示不适用或缺少可比得分"]];
    return '<div class="sc-metrics">' + metrics.map(([label,value,hint]) => '<div><span>' + label +
      '</span><strong>' + value + '</strong><small>' + hint + '</small></div>').join("") + '</div>' +
      '<div class="sc-two"><section class="sc-box"><h2>按预测跨度</h2><div class="sc-span-table"><div class="sc-span-row sc-th">' +
      '<span>跨度 / 床数</span><span>评估格</span><span>有效</span><span>NA</span><span>失败</span></div>' +
      s.spans.map(g => '<div class="sc-span-row"><b>' + g.span + ' <small>· ' + g.beds + ' 床</small></b>' +
        statusBar(g) + '<span>' + g.valid + '</span><span>' + g.na + '</span><span>' + g.failed + '</span></div>').join("") +
      '</div></section><section class="sc-box"><h2>评分作业</h2><p class="sc-stage">' + phases[s.phase] + '</p>' +
      '<div class="sc-job-count">' + Object.entries(jobLabels).filter(([k]) => s.jobs[k] > 0 || k === "running" || k === "waiting")
        .map(([k,label]) => '<span>' + label + ' <b>' + s.jobs[k] + '</b></span>').join("") + '</div>' +
      '<p class="sc-small">含历史作业。' + (s.next_scheduled ? '下次排程（北京） ' + stamp(s.next_scheduled) : '当前没有已核实的等待排程。') + '</p></section></div>';
  }

  function filters(state) {
    const b = state.payload.beds, rows = state.payload.rows;
    const options = {span:["1D","2D","1DL"], bed:b.filter(x => x.span !== "TEST").map(x => x.id),
      recipe:[...new Set(rows.map(x => x.recipe))].sort(), seed:[...new Set(rows.map(x => x.seed))].sort((a,b) => a-b),
      status:Object.keys(cellLabels)};
    const labels = {span:"跨度", bed:"测试床", recipe:"配方", seed:"种子", status:"结果"};
    return '<div class="sc-filters">' + Object.entries(options).map(([key,values]) =>
      '<label>' + labels[key] + '<select data-filter="' + key + '"><option value="">全部</option>' +
      values.map(v => '<option value="' + text(v) + '"' + (state.filters[key] === String(v) ? ' selected' : '') + '>' +
        text((key === "status" ? cellLabels[v] : v)) + '</option>').join("") + '</select></label>').join("") +
      '<button class="btn" data-action="clear">清除筛选</button></div>';
  }

  function drawTable(state) {
    const {rows, beds} = state.payload;
    const spanByBed = Object.fromEntries(beds.map(b => [b.id,b.span]));
    const selected = rows.filter(r => Object.entries(state.filters).every(([k,v]) =>
      !v || String(k === "span" ? spanByBed[r.bed] : r[k]) === v));
    const pages = Math.max(1, Math.ceil(selected.length / pageSize));
    state.page = Math.min(state.page, pages - 1);
    const body = selected.slice(state.page * pageSize, (state.page + 1) * pageSize).map(r => {
      const score = r.status === "valid";
      return '<tr><td>' + text(r.bed) + '</td><td>' + text(r.recipe) + '</td><td>' + text(r.seed) +
        '</td><td>' + text(cellLabels[r.status]) + '</td><td><strong>' + number(score ? r.total : null) + '</strong></td><td>' +
        number(score ? r.delta : null,true) + '</td>' + r.skills.map(n => '<td>' + number(n) + '</td>').join("") +
        '<td class="sc-reason">' + text(r.reason || (r.anchor === "valid" ? "—" : r.anchor)) + '</td></tr>';
    }).join("");
    return '<div class="sc-pages"><span>匹配 ' + selected.length + ' 格 · 第 ' + (state.page + 1) + ' / ' + pages + ' 页</span>' +
      '<button data-action="prev" class="btn"' + (state.page === 0 ? ' disabled' : '') + '>上一页</button>' +
      '<button data-action="next" class="btn"' + (state.page + 1 >= pages ? ' disabled' : '') + '>下一页</button></div>' +
      '<div class="sc-scroll" tabindex="0" aria-label="可左右滚动的分数表"><table><thead><tr>' +
      ["测试床","配方","种子","结果","总分","Δ vs S00","DES","DCS","MMD","CSS","原因"].map(k => '<th scope="col">' + k + '</th>').join("") +
      '</tr></thead><tbody>' + (body || '<tr><td colspan="11">没有符合这些条件的评估格。</td></tr>') + '</tbody></table></div>';
  }

  function drawPrivate(state) {
    const p = state.payload;
    const bedRows = p.beds.map(b => {
      const stages = b.frames.filter(f => f.role === "visible").map(f => 'E' + f.stage).join("、");
      return '<tr><td>' + text(b.id) + '</td><td>' + text(b.source) + (b.subset ? ' · ' + text(b.subset) : '') +
        (b.control ? '（对照）' : '') + '</td><td>' + text(stages) + '</td><td>E' + text(b.target) +
        (b.span === "TEST" ? ' · 无答案' : '') + '</td><td>' + text(b.genes) + '</td><td>' + text(b.seeds) + '</td></tr>';
    }).join("");
    const jobRows = p.jobs.map(j => '<tr><td>' + text(j.id) + '</td><td>' + text(jobLabels[j.status]) +
      '</td><td>' + stamp(j.due || j.at) + '</td></tr>').join("");
    const details = state.root.querySelector("#sc-private");
    const opened = new Set(Array.from(details.querySelectorAll("details[open]"), d => d.id));
    details.innerHTML = '<section class="sc-box sc-results"><h2>逐格评分明细</h2>' +
      '<p class="sc-small">四项展示各自换算后的分数。缺分显示为横线，实际零分显示为 0.00。</p>' + filters(state) +
      '<div id="sc-rows">' + drawTable(state) + '</div></section>' +
      '<details id="sc-beds"><summary>测试床目录 · ' + p.beds.length + ' 张</summary><div class="sc-scroll"><table>' +
      '<thead><tr><th>床编号</th><th>来源</th><th>可见阶段</th><th>目标</th><th>基因</th><th>种子</th></tr></thead><tbody>' + bedRows + '</tbody></table></div></details>' +
      '<details id="sc-jobs"><summary>作业记录 · ' + p.jobs.length + ' 个</summary><div class="sc-scroll"><table><thead><tr>' +
      '<th>作业</th><th>状态</th><th>排程或状态时间（北京）</th></tr></thead><tbody>' + jobRows + '</tbody></table></div></details>' +
      '<details id="sc-sources"><summary>数据来源与校验</summary><ul>' + p.sources.map(s => '<li>' + text(s.id) +
        ' · ' + text(s.cells) + ' 格<br><code>SHA256 ' + text(s.sha256) + '</code></li>').join("") + '</ul></details>';
    for (const d of details.querySelectorAll("details")) d.open = opened.has(d.id);
  }

  function freshness(state) {
    const el = state.root.querySelector("#sc-fresh");
    const s = state.summary;
    if (!s) {
      el.textContent = state.error ? "暂时无法取得快照，请稍后检查更新。" : "正在读取评分进度…";
      return;
    }
    const minutes = Math.max(0,(Date.now() - Date.parse(s.collected_at)) / 60000);
    const stale = minutes > (live ? 1 : 35);
    el.classList.toggle("sc-stale", Boolean(stale || state.error));
    const label = state.error ? "更新失败，保留上次数据" : state.source;
    el.textContent = (stale ? "数据已过期 · " : "") + label + " · 采集于 " + stamp(s.collected_at) +
      "（北京）" + (stale ? " · 距今 " + Math.floor(minutes) + " 分钟" : "");
  }

  function show(state, summary, source) {
    if (state.summary && Date.parse(summary.collected_at) < Date.parse(state.summary.collected_at)) return;
    state.summary = summary;
    state.source = source;
    const key = JSON.stringify({...summary, collected_at:null});
    if (state.summaryKey !== key) state.root.querySelector("#sc-summary").innerHTML = drawSummary(summary);
    state.summaryKey = key;
    freshness(state);
  }

  async function getJSON(url, signal, githubAPI = false) {
    const response = await fetch(url, {signal, cache:"no-store", credentials:"omit", referrerPolicy:"no-referrer",
      headers:githubAPI ? {Accept:"application/vnd.github.raw+json"} : {}});
    if (!response.ok) throw Error(String(response.status));
    return await response.json();
  }

  async function refresh(state) {
    if (current !== state || state.busy) return;
    state.busy = true;
    const btn = state.root.querySelector('[data-action="refresh"]');
    btn.disabled = true;
    try {
      if (live) {
        const data = await getJSON("/api/live", AbortSignal.any([state.abort.signal, AbortSignal.timeout(8500)]));
        checkSummary(data.summary);
        if (!Array.isArray(data.rows) || !Array.isArray(data.jobs) || !Array.isArray(data.beds) || !Array.isArray(data.sources)) throw Error("明细不完整");
        if (current !== state) return;
        state.payload = data;
        state.error = Boolean(data.collection_error);
        show(state, data.summary, "5090 实时");
        const key = JSON.stringify([data.sources,data.jobs,data.beds]);
        if (state.privateKey !== key) drawPrivate(state);
        state.privateKey = key;
      } else {
        const nonce = "&t=" + Math.floor(Date.now() / 60000);
        let latest;
        try {
          latest = checkSummary(await getJSON(raw + nonce.replace("&","?"), AbortSignal.any([state.abort.signal, AbortSignal.timeout(6500)])));
        } catch (e) {
          if (state.abort.signal.aborted) return;
          latest = checkSummary(await getJSON(api + nonce, AbortSignal.any([state.abort.signal, AbortSignal.timeout(8500)]), true));
        }
        if (current !== state) return;
        state.error = false;
        show(state, latest, "GitHub 公开快照");
        try { localStorage.setItem(cacheKey, JSON.stringify(state.summary)); } catch (_) {}
      }
    } catch (_) {
      if (current === state) state.error = true;
    } finally {
      if (current === state) {
        state.busy = false;
        btn.disabled = false;
        freshness(state);
      }
    }
  }

  function mount() {
    const root = document.getElementById("scorer-board");
    const state = {root, abort:new AbortController(), filters:allFilters(), page:0, error:false};
    current = state;
    if (!live) {
      try { show(state,checkSummary(window.VEMScorerSeed),"随页快照"); } catch (_) {}
      try { show(state,checkSummary(JSON.parse(localStorage.getItem(cacheKey))),"上次公开快照"); } catch (_) {}
    }
    root.addEventListener("change", e => {
      if (!e.target.dataset.filter) return;
      state.filters[e.target.dataset.filter] = e.target.value;
      state.page = 0;
      root.querySelector("#sc-rows").innerHTML = drawTable(state);
    });
    root.addEventListener("click", e => {
      const action = e.target.closest("button[data-action]")?.dataset.action;
      if (action === "refresh") return void refresh(state);
      if (action === "clear") {
        state.filters = allFilters(); state.page = 0; drawPrivate(state);
      }
      if (action === "prev" || action === "next") {
        state.page += action === "prev" ? -1 : 1;
        root.querySelector("#sc-rows").innerHTML = drawTable(state);
      }
    });
    refresh(state);
    state.timer = setInterval(() => refresh(state), live ? 15000 : 60000);
    state.age = setInterval(() => freshness(state), 10000);
  }

  function stop() {
    if (!current) return;
    current.abort.abort();
    clearInterval(current.timer); clearInterval(current.age);
    current = null;
  }
  window.VEMScorer = {shell, mount, stop};
})();
