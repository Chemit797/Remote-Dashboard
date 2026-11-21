/* VEM T1 progress and sample records. */
(() => {
  "use strict";
  const live = Boolean(document.querySelector('meta[name="vem-scorer-live"]'));
  const fileEntry = location.protocol === "file:";
  const raw = "https://raw.githubusercontent.com/Chemit797/Remote-Dashboard/vem-scorer-feed/progress.json";
  const api = "https://api.github.com/repos/Chemit797/Remote-Dashboard/contents/progress.json?ref=vem-scorer-feed";
  const cacheKey = "26vem-scorer-public-v1";
  const jobLabels = {waiting:"等待排程", running:"运行中", succeeded:"已完成", failed:"曾失败", interrupted:"已中断", unknown:"待核实", cancelled:"已取消"};
  const cellLabels = {valid:"有分", na:"不适用或缺分", failed:"失败"};
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
        !s.jobs || !Object.keys(jobLabels).every(k => amount(s.jobs[k] ?? (k === "cancelled" ? 0 : null)))) throw Error("快照格式不完整");
    if (s.operations) {
      const o=s.operations;
      if (!amount(o.methods) || !amount(o.seeds) || typeof o.review_ready !== "boolean" ||
          !o.audit || !["regression_pass","batches","probes"].every(k=>amount(o.audit[k])) ||
          !o.groups || !Object.keys(familyNames).every(k=>["methods","valid","na","failed"].every(f=>amount(o.groups[k]?.[f]))) ||
          !o.issues || !Object.keys(issueNames).every(k=>amount(o.issues[k])) ||
          !o.steps || !Object.keys(stageNames).filter(k=>k !== "repair" || o.steps.repair).every(k=>o.steps[k] && Object.hasOwn(jobLabels,o.steps[k].job) &&
              ["planned","cells","batches","registered","sealed","accepted"].every(f=>amount(o.steps[k][f]))))
        throw Error("进度快照不完整");
    }
    validateSamples(s.samples,s);
    return s;
  }

  const views = {overview:"运行总览", samples:"样本记录", methods:"方法与基线", validation:"测试与评分", issues:"异常与记录"};
  const spanNames = {"1D":"向后预测 1 天", "2D":"向后预测 2 天", "1DL":"较晚阶段向后预测 1 天"};
  const spanExamples = {"1D":"例如第 8.5 天 → 第 9.5 天", "2D":"例如第 8.5 天 → 第 10.5 天", "1DL":"第 10.5 天 → 第 11.5 天"};
  const familyNames = {reference:"参照方法", proportion:"预测细胞类型比例", expression:"预测类型内表达变化", dispersion:"调整表达离散度", combination:"组合方法", other:"其他方法"};
  const issueNames = {permission:"测试规则不允许使用所需的历史数据", coverage:"所需细胞类别在两个阶段缺少观测", compartments:"可用细胞类别不足两类", paired_prior:"缺少可用的成对参考阶段", visible_days:"可见阶段不足两个", other:"其他未出分原因"};
  const stageNames = {single:"单配方首轮", repair:"首轮配方补评", combo:"组合配方", replay:"原计划补评"};
  const dateFmt = new Intl.DateTimeFormat("zh-CN", {timeZone:"Asia/Shanghai",month:"numeric",day:"numeric",hour:"2-digit",minute:"2-digit",hourCycle:"h23"});
  const shortDate = v => v ? dateFmt.format(new Date(v)) : "未登记时间";
  const viewLink = view => "#/scorer" + (view === "overview" ? "" : "/" + view);
  const viewFromHash = () => {
    const slug = location.hash.split("?")[0].split("/")[2];
    return Object.hasOwn(views,slug) ? slug : "overview";
  };

  function shell() {
    const jump = fileEntry ? '<a class="btn primary" href="http://127.0.0.1:18765/#/scorer">打开 5090 实时明细 ↗</a>' : "";
    return `<article class="scorer" id="scorer-board"><header class="sc-head"><div><h1>T1 评分器</h1>
      <p class="sub">目标是用已知胚龄的表达数据，判断哪些方法值得用来预测第 12.5 天。</p></div>
      <div class="sc-actions">${jump}<button type="button" class="btn" data-action="refresh">检查更新</button></div></header>
      <p id="sc-fresh" role="status" class="sc-fresh">正在读取评分进度…</p>
      <nav class="sc-tabs" aria-label="评分看板栏目">${Object.entries(views).map(([key,label]) =>
        `<a data-view="${key}" href="${viewLink(key)}">${label}</a>`).join("")}</nav>
      <div id="sc-summary"></div><div id="sc-sample-panel" hidden></div><div id="sc-private"></div></article>`;
  }

  function stepStatus(step) {
    if (step.accepted === step.batches && step.cells === step.planned) return "已验收";
    if (step.job === "cancelled") return "已取消";
    if (step.job === "failed" || step.job === "interrupted") return jobLabels[step.job];
    if (step.job === "running") return "执行中";
    if (step.job === "succeeded") return "等待验收核对";
    if (step.job === "waiting") return "等待排程";
    return "状态待核实";
  }

  function healthLine(s) {
    const counts = s.jobs;
    return `运行中 ${counts.running} 个 · 等待排程 ${counts.waiting} 个` +
      (counts.interrupted ? ` · 已中断 ${counts.interrupted} 个` : "") +
      (counts.unknown ? ` · 状态待核实 ${counts.unknown} 个` : "");
  }

  function runOverview(s) {
    const op = s.operations;
    let title = phases[s.phase], next = s.next_scheduled ? `下次排程为北京时间 ${shortDate(s.next_scheduled)}。` : "正在等待下一份排程或验收记录。";
    if (op) {
      const key = Object.keys(stageNames).find(k => op.steps[k] && !["已验收", "已取消"].includes(stepStatus(op.steps[k])));
      if (key) {
        const step = op.steps[key], status = stepStatus(step);
        title = status === "等待排程" ? `${stageNames[key]}等待开始` : `${stageNames[key]} · ${status}`;
        next = `${step.cells} / ${step.planned} 次评估已验收。` + (key === "repair" ? "沿用首轮已封存的预测，每项补做 4 个抽样种子。" : "") + (step.due ? `排程时间为北京时间 ${shortDate(step.due)}。` : "");
      } else {
        title = op.frozen ? "复核已批准，候选方案已冻结" : op.review_ready ? "多种子结果已汇总，待人工复核" : "现行批次已验收，等待后续安排";
        next = op.review_ready ? "审阅总表已就绪，可对照不同数据来源和种子的结果。" : "人工复核需要已核验的汇总表。";
      }
    }
    const metrics = [[s.cells, "已验收评估"], [s.valid, "算出分数"], [s.na, "不适用或缺分"], [s.failed, "评估失败"]];
    const stageBlock = op ? `<section class="sc-box sc-block"><h2>从评分到复核</h2><p class="sc-lead">只在收到正式评估结果后计入验收数。排程按北京时间显示。</p>
      <ol class="sc-steps">${Object.entries(stageNames).filter(([key])=>op.steps[key] && op.steps[key].job !== "cancelled").map(([key,name]) => {
        const st = op.steps[key], status = stepStatus(st);
        return `<li><div class="sc-line"><h3>${name}</h3><span class="sc-status" data-tone="${status === "已验收" ? "good" : ["失败","曾失败","已中断"].includes(status) ? "alert" : "neutral"}">${status}</span></div>
          <p><strong>${st.cells} / ${st.planned}</strong> 次评估已验收</p><small>${st.registered}/${st.batches} 批已登记 · ${st.sealed} 批已封存 · ${st.accepted} 批已验收</small>
          ${st.due ? `<small>排程 ${shortDate(st.due)}</small>` : ""}</li>`;
      }).join("")}<li><div class="sc-line"><h3>人工复核</h3><span class="sc-status">${op.frozen ? "已批准冻结" : op.review_ready ? "待确认" : "等待汇总"}</span></div>
        <p>${op.review_ready ? "审阅总表已就绪" : "汇总后再判断候选"}</p>${op.review_due ? `<small>计划复核 ${shortDate(op.review_due)}</small>` : ""}</li></ol>
      ${Object.keys(op.steps).some(k=>op.steps[k].job==="cancelled") ? '<p class="sc-small">'+Object.keys(op.steps).filter(k=>op.steps[k].job==="cancelled").map(k=>stageNames[k]).join("、")+'的旧排程已取消。</p>' : ""}</section>` : "";
    return `<div class="sc-overview-head"><section class="sc-brief"><p class="sc-eyebrow">最近一次采集</p><h2>${title}</h2><p>${next}</p><small>${healthLine(s)}</small></section>
      <section class="sc-box sc-coverage"><h2>已记录的评估结果</h2><div class="sc-metrics">${metrics.map(([v,l])=>`<div><strong>${v}</strong><span>${l}</span></div>`).join("")}</div>
      <p class="sc-small">${s.scored_beds} 组测试数据已有评估记录${op ? ` · ${op.methods} 个配方 · ${op.seeds} 个抽样种子` : ""}。<a href="${viewLink("issues")}">查看缺分和失败原因</a></p></section></div>
      ${samplePreview(s)}${stageBlock}${coverage(s)}<p class="sc-deadline">比赛最终截止为北京时间 11 月 26 日 19:59。<a href="https://virtualembryo.ai/challenge/timeline">赛事时间线 ↗</a></p>`;
  }

  function coverage(s) {
    return `<section class="sc-box sc-block"><h2>不同预测时段，各有多少次评估算出了分数？</h2>
      <p class="sc-lead">一项配方在一组测试数据上，用一个抽样种子评估一次。下表各项都是次数。</p>
      <div class="sc-horizons">${s.spans.map(g=>`<div class="sc-horizon"><div><h3>${spanNames[g.span]} <small>${g.span}</small></h3>
        <p>${spanExamples[g.span]} · ${g.beds} 组数据</p></div><div><strong>${g.valid+g.na+g.failed} 次评估</strong>
        <p><b>${g.valid} 次有分</b> · ${g.na} 次不适用或缺分 · ${g.failed} 次失败</p></div></div>`).join("")}</div></section>`;
  }

  function methodFamilies(s) {
    const op = s.operations;
    const rows = op ? Object.entries(familyNames).filter(([key]) => op.groups[key].methods > 0 || key === "combination").map(([key,name]) => {
      const g = op.groups[key], n = g.valid + g.na + g.failed;
      return `<tr><th scope="row">${name}</th><td>${g.methods}</td><td>${n}</td><td>${g.valid}</td><td>${g.na}</td><td>${g.failed}</td></tr>`;
    }).join("") : "";
    return `<section class="sc-box sc-block"><h2>每类方法评了多少次</h2><p class="sc-lead">只统计已有验收记录的配方。组合方法完成验收后会出现在计数中。</p>
      ${op ? `<div class="sc-scroll"><table class="sc-family"><thead><tr><th>方法类别</th><th>配方数</th><th>评估次数</th><th>有分</th><th>缺分</th><th>失败</th></tr></thead><tbody>${rows}</tbody></table></div>` : '<p>这份早期快照只包含评估总数。</p>'}</section>
      <section class="sc-box sc-block"><h2>与什么比较？</h2><p>参照配方 S00 直接复制最后一个已知阶段的细胞表达。把其他配方与同一组数据、同一抽样种子的 S00 相比，才能看出改变方法带来了多少分。</p>
      <p class="sc-formula">相对基线的变化 Δ = 配方总分 − S00 总分</p><p class="sc-small">例如 Δ 为 +2，表示比复制多拿了 2 分。各组数据各有自己的评分尺度。</p>
      <p class="sc-small"><a href="${viewLink("samples")}">查看逐个配方的样本记录 ↗</a></p></section>`;
  }

  function validation(s) {
    const audit = s.operations?.audit;
    const metrics = [["DES",25,"差异基因","上调和下调的基因选对了多少"],["DCS",25,"变化排序","各基因变化的先后排序有多接近"],
      ["MMD",30,"细胞群分布","预测细胞群的整体表达分布有多接近真实细胞群"],["CSS",20,"基因间结构","基因之间共同变化的关系保留了多少"]];
    return `<section class="sc-box sc-block"><h2>一次测试怎么做？</h2><p class="sc-lead">每组测试数据称为一张“床”。例如在官方两天测试中，用胚胎第 8.5 天的表达预测第 10.5 天。</p>
      <ol class="sc-walk"><li><b>留出答案</b><span>配方只能读允许的早期数据，第 10.5 天的真实表达交给评分器。</span></li>
      <li><b>封存预测</b><span>为目标阶段生成细胞表达，核对访问记录，再封存预测文件。</span></li>
      <li><b>按同一把尺比较</b><span>在同一测试数据和种子上分别计算配方与 S00 的四项分数。</span></li></ol>
      <p class="sc-note">目前 ${s.beds} 组数据中，${s.test_beds} 组是正式预测任务 T1-TEST。最后可见的是第 10.5 天，目标第 12.5 天没有公开答案。</p></section>
      <section class="sc-box sc-block"><h2>四项分数怎么看？</h2><div class="sc-measures">${metrics.map(([k,w,label,hint])=>`<div><b>${label} <small>${k}</small></b><strong>${w}%</strong><p>${hint}</p></div>`).join("")}</div>
      <p class="sc-small">每项先按本组数据的参考值换算，再按权重相加。先用一天跨度检查数据来源的参考价值，再用两天跨度和多个种子检查结果是否稳定。</p></section>
      ${audit ? `<section class="sc-box sc-block"><h2>首轮评分器核对</h2><p>${audit.regression_pass} / ${audit.batches} 批精确复现固定参考预测的得分，${audit.probes} 次尝试读取隐藏答案的检查均被拦截。</p></section>` : ""}`;
  }

  function exceptions(s) {
    const op=s.operations;
    const items=op ? Object.entries(op.issues).filter(([,v])=>v>0).sort((a,b)=>b[1]-a[1]) : [];
    return `<div class="sc-overview-head"><section class="sc-box sc-block"><h2>${s.na} 次评估不适用或缺分</h2><p class="sc-lead">配方缺少允许使用的数据或计算条件时，记录为 NA。零分会保留为有效分数。</p>
      ${items.length ? `<ul class="sc-reasons">${items.map(([key,v])=>`<li><span>${issueNames[key]}</span><b>${v} 次</b></li>`).join("")}</ul>` : ""}</section>
      <section class="sc-box sc-block"><h2>${s.failed} 次评估失败</h2><p><a href="${viewLink("samples")}?status=failed">查看失败的样本记录 ↗</a></p>
      <h3>后台作业</h3><div class="sc-job-count">${Object.entries(jobLabels).map(([k,l])=>`<span>${l} <b>${s.jobs[k] ?? 0}</b></span>`).join("")}</div>
      <p class="sc-small">一个作业可能处理多次评估。作业数包含早期尝试和已结束的运行。</p></section></div>`;
  }

  function drawSummary(s,view) {
    const draw = {overview:runOverview, samples:()=>"", methods:methodFamilies, validation, issues:exceptions};
    return draw[view](s);
  }

  function defaultSampleFilters() {
    return {query:"", bed:"", seed:"", status:"", order:"recent", open:new Set(), pages:new Map()};
  }

  function readSampleFilters() {
    const ui=defaultSampleFilters(), [path,search]=location.hash.split("?");
    const id=path.split("/")[3], params=new URLSearchParams(search);
    ui.query=params.get("q") || "";
    ui.bed=params.get("bed") || "";
    ui.seed=params.get("seed") || "";
    if (Object.hasOwn(cellLabels,params.get("status"))) ui.status=params.get("status");
    if (["id","score"].includes(params.get("order"))) ui.order=params.get("order");
    for (const value of params.getAll("open")) if (/^S\d+$/.test(value)) ui.open.add(value);
    if (/^S\d+$/.test(id)) { ui.query=id; ui.open.add(id); }
    return ui;
  }

  function saveSampleFilters(state) {
    const ui=state.sampleUI, params=new URLSearchParams();
    const direct=/^S\d+$/.test(ui.query) && ui.open.has(ui.query) ? ui.query : "";
    if (ui.query && !direct) params.set("q",ui.query);
    for (const key of ["bed","seed","status"]) if (ui[key]) params.set(key,ui[key]);
    if (ui.order!=="recent") params.set("order",ui.order);
    for (const value of ui.open) if (value!==direct) params.append("open",value);
    const path=direct ? sampleLink(direct) : viewLink("samples");
    const hash=params.size ? path+"?"+params : path;
    if (location.hash!==hash) history.replaceState(history.state,"",hash);
    state.sampleRoute=hash;
  }

  function validateSamples(register, counts) {
    if (!register) return;
    if (!["status","total","full"].includes(register.mode) || !register.beds || !register.batches ||
        !Array.isArray(register.recipes) || register.recipes.length !== counts.operations?.methods)
      throw Error("样本目录不完整");
    const statuses={valid:0,na:0,failed:0}, ids=new Set(), keys=new Set();
    for (const recipe of register.recipes) {
      if (!/^S\d+$/.test(recipe.id) || ids.has(recipe.id) || !Array.isArray(recipe.cases) || !recipe.cases.length)
        throw Error("配方记录无效");
      ids.add(recipe.id);
      for (const row of recipe.cases) {
        const key=[recipe.id,row.bed,row.seed].join("/");
        if (keys.has(key) || !Object.hasOwn(register.beds,row.bed) || !Object.hasOwn(register.batches,row.batch) ||
            !Object.hasOwn(statuses,row.status) || !Number.isInteger(row.seed) || row.seed<0)
          throw Error("评估记录无效");
        keys.add(key);
        statuses[row.status]++;
        if (register.mode!=="status" && row.status==="valid" && !Number.isFinite(row.total))
          throw Error("样本总分缺失");
        if (register.mode==="full" && (!Array.isArray(row.skills) || row.skills.length!==4))
          throw Error("样本分项缺失");
      }
    }
    if (keys.size!==counts.cells || Object.keys(statuses).some(k=>statuses[k]!==counts[k]))
      throw Error("样本与总览的评估次数不一致");
  }

  function sampleLink(id) {
    return viewLink("samples") + "/" + encodeURIComponent(id);
  }

  function samplePreview(summary) {
    const records=summary.samples?.recipes || [];
    const examples=["S00","S24","S32"].map(id=>records.find(r=>r.id===id)).filter(Boolean);
    return `<section class="sc-box sc-block sc-sample-entry"><div><h2>样本记录</h2>
      <p class="sc-lead">每个已评配方占一行。展开可查看它在哪些数据和种子上接受了评估。</p></div>
      <a class="btn primary" href="${viewLink("samples")}">查看${records.length ? "全部 "+records.length+" 个配方" : "样本记录"} ↗</a>
      ${examples.length ? `<div class="sc-quick-records">${examples.map(r=>`<a href="${sampleLink(r.id)}">${text(r.id)} · ${text(r.name)}</a>`).join("")}</div>` : ""}</section>`;
  }

  function sampleOptions(values, selected) {
    return values.map(([value,label])=>`<option value="${text(value)}"${String(value)===selected ? " selected" : ""}>${text(label)}</option>`).join("");
  }

  function sampleSettings(register, ui) {
    const seedValues=[...new Set(register.recipes.flatMap(r=>r.cases.map(c=>c.seed)))].sort((a,b)=>a-b);
    const orders=[["recent","最近验收在前"],["id","配方编号"]];
    if (register.mode!=="status") orders.push(["score","本组总分从高到低"]);
    return `<label>测试数据<select data-sample-filter="bed"><option value="">全部测试数据</option>
      ${sampleOptions(Object.entries(register.beds).map(([id,b])=>[id,`${id} · ${b.source}${b.subset ? " · "+b.subset : ""}`]),ui.bed)}</select></label>
      <label>抽样种子<select data-sample-filter="seed"><option value="">全部种子</option>
      ${sampleOptions(seedValues.map(s=>[s,s]),ui.seed)}</select></label>
      <label>评估结果<select data-sample-filter="status"><option value="">全部结果</option>
      ${sampleOptions(Object.entries(cellLabels),ui.status)}</select></label>
      <label>排列顺序<select data-sample-filter="order">${sampleOptions(orders,ui.order)}</select></label>`;
  }

  const samplePageSize=10;

  function sampleDetail(register, recipe, cases, pageIndex=0) {
    const totals=register.mode!=="status", full=register.mode==="full";
    const metricHead=totals ? "<th>总分</th><th>比 S00</th>" : "";
    const metrics=["DES","DCS","MMD","CSS"];
    const skillsHead=full ? metrics.map(k=>`<th>${k}</th>`).join("") : "";
    const pages=Math.ceil(cases.length/samplePageSize), page=Math.min(pageIndex,pages-1);
    const start=page*samplePageSize, end=Math.min(start+samplePageSize,cases.length);
    const body=cases.slice(start,end).map(row=>{
      const b=register.beds[row.bed];
      const causes={...issueNames,tolerance:"数值检查超出容差",check_failed:"评估校验失败"};
      const values=totals ? `<td class="sr-score" data-label="总分">${number(row.total)}</td><td data-label="比 S00">${number(row.delta,true)}</td>` : "";
      const skills=full ? row.skills.map((v,i)=>`<td data-label="${metrics[i]}">${number(v)}</td>`).join("") : "";
      return `<tr data-bed="${text(row.bed)}" data-seed="${row.seed}"><th scope="row" class="sr-bed">${text(b.source)}${b.subset ? " · "+text(b.subset) : ""}
        <small>E${text(b.last)} → E${text(b.target)} · ${text(row.bed)}</small></th>
        <td data-label="种子">${row.seed}</td><td data-label="结果"><span class="sc-status" data-tone="${row.status==="valid" ? "good" : row.status==="failed" ? "alert" : "neutral"}">${text(cellLabels[row.status])}</span></td>${values}${skills}
        <td class="sr-reason" data-label="原因">${row.cause ? text(causes[row.cause] || "见评估记录") : "—"}</td>
        <td class="sr-batch" data-label="批次">${text(row.batch)}<small>${stamp(register.batches[row.batch])}</small></td></tr>`;
    }).join("");
    const nav=pages>1 ? `<div class="sr-page"><span>第 ${start+1}–${end} 条，共 ${cases.length} 条</span>
      <button type="button" class="btn" data-sample-page="${page-1}"${page===0 ? " disabled" : ""}>上一页</button>
      <button type="button" class="btn" data-sample-page="${page+1}"${end===cases.length ? " disabled" : ""}>下一页</button></div>` : "";
    return `<div class="sr-details"><div class="sr-detail-heading"><b>${text(recipe.id)} 的逐次评估</b>
      <a href="${sampleLink(recipe.id)}">这条记录的链接 ↗</a></div>
      <div class="sc-scroll" tabindex="0" aria-label="${text(recipe.id)} 逐次评估，可横向滚动"><table class="sr-cases">
      <thead><tr><th>测试数据</th><th>种子</th><th>结果</th>${metricHead}${skillsHead}<th>缺分或失败原因</th><th>批次 / 验收时间（北京）</th></tr></thead>
      <tbody>${body}</tbody></table></div>${nav}</div>`;
  }

  function matchingSamples(register, ui) {
    const query=ui.query.trim().toLowerCase();
    const result=[];
    for (const recipe of register.recipes) {
      const name=(recipe.id+" "+recipe.name+" "+(familyNames[recipe.group]||"")).toLowerCase();
      const cases=recipe.cases.filter(c=>
        (!ui.bed || c.bed===ui.bed) && (!ui.seed || String(c.seed)===ui.seed) && (!ui.status || c.status===ui.status) &&
        (!query || name.includes(query) || (c.bed+" "+register.beds[c.bed].source+" "+c.batch).toLowerCase().includes(query)));
      if (!cases.length) continue;
      // Put the official time windows first, then the other sources in stable order.
      cases.sort((a,b)=>Number(b.bed.startsWith("T1-OFF-"))-Number(a.bed.startsWith("T1-OFF-")) ||
        a.bed.localeCompare(b.bed,"en",{numeric:true}) || a.seed-b.seed);
      const n={valid:0,na:0,failed:0};
      let latest=0;
      for (const c of cases) {
        n[c.status]++;
        latest=Math.max(latest,Date.parse(register.batches[c.batch]) || 0);
      }
      const ref=cases.find(c=>c.bed===(ui.bed || "T1-OFF-2D") && c.seed===Number(ui.seed || 0));
      result.push({recipe,cases,n,latest,ref});
    }
    const byId=(a,b)=>a.recipe.id.localeCompare(b.recipe.id,"en",{numeric:true});
    return result.sort((a,b)=>{
      if (ui.order==="recent" && a.latest!==b.latest) return b.latest-a.latest;
      if (ui.order==="score") {
        const left=a.ref?.total ?? -Infinity, right=b.ref?.total ?? -Infinity;
        if (left!==right) return right-left;
      }
      return byId(a,b);
    });
  }

  function listSamples(state) {
    const panel=state.root.querySelector("#sc-sample-panel"), register=state.summary?.samples;
    if (!register || !panel.querySelector("#sr-list")) return;
    const ui=state.sampleUI, matches=matchingSamples(register,ui);
    state.visibleSamples=new Map(matches.map(item=>[item.recipe.id,item]));
    const count=matches.reduce((n,item)=>n+item.cases.length,0);
    panel.querySelector("#sr-count").textContent=`${matches.length} 个配方 · ${count} 次评估`;
    const showScore=register.mode!=="status";
    const bed=ui.bed || "T1-OFF-2D", seed=Number(ui.seed || 0), setting=register.beds[bed];
    panel.querySelector("#sr-reference").textContent=showScore && setting
      ? `列表总分取 ${setting.source} · E${setting.last} → E${setting.target}（${bed}），种子 ${seed}。更换测试数据和种子即可比较其他条件。`
      : "";
    panel.querySelector("#sr-list").innerHTML=matches.map(({recipe,cases,n,latest,ref})=>{
      const open=ui.open.has(recipe.id);
      const score=ref?.status==="valid" ? number(ref.total)+" 分" : ref ? cellLabels[ref.status] : "—";
      const delta=ref?.delta!=null ? "比 S00 "+number(ref.delta,true) : "该条件下的结果";
      return `<details class="sr-record${showScore ? " with-score" : ""}" data-sample-id="${text(recipe.id)}"${open ? " open" : ""}>
        <summary><span class="sr-name"><b>${text(recipe.id)}</b> ${text(recipe.name)}<small>${text(familyNames[recipe.group] || "其他方法")}</small></span>
        ${showScore ? `<span class="sr-ref">${score}<small>${delta}</small></span>` : ""}
        <span class="sr-counts">${cases.length} 次评估 <small>${n.valid} 有分 · ${n.na} 缺分 · ${n.failed} 失败</small></span>
        <span class="sr-time">最近验收 <small>${latest ? shortDate(latest) : "时间未登记"}</small></span></summary>
        <div data-sample-body>${open ? sampleDetail(register,recipe,cases,ui.pages.get(recipe.id)) : ""}</div></details>`;
    }).join("") || '<p class="sc-note">没有匹配的样本记录。可以更换关键词或清除筛选。</p>';
  }

  function displaySamples(state) {
    const panel=state.root.querySelector("#sc-sample-panel");
    panel.hidden=state.view!=="samples";
    if (panel.hidden) return;
    const register=state.summary?.samples;
    if (!register) {
      panel.innerHTML='<section class="sc-box sc-block"><h2>样本记录</h2><p>本份快照尚无逐条记录，页面会检查下一份快照。</p></section>';
      return;
    }
    const ui=state.sampleUI;
    if (!panel.querySelector("#sr-list")) {
      panel.innerHTML=`<section class="sc-box sc-block"><h2>样本记录</h2>
        <p class="sc-lead">每行是一种预测方法。点开配方后，每条记录对应一组测试数据和一个抽样种子。<span data-sample-scope></span></p>
        <div class="sc-filters sr-tools"><label>搜索样本<input type="search" data-sample-query placeholder="如 S32、官方或数据编号" autocomplete="off"></label>
        <div class="sr-selects"></div><button type="button" class="btn" data-clear-samples>清除筛选</button></div>
        <p id="sr-count" aria-live="polite"></p><p id="sr-reference" class="sc-small"></p><div id="sr-list"></div></section>`;
      panel.querySelector("[data-sample-query]").value=ui.query;
    }
    panel.querySelector("[data-sample-scope]").textContent={
      status:"公开页显示有分、缺分或失败及原因。具体分值可在 5090 实时页查看。",
      total:"有分的记录列出总分和同一条件下与 S00 的分差。",
      full:"展开可看开发总分、与复制基线 S00 的分差及四项分数。"
    }[register.mode];
    const selects=panel.querySelector(".sr-selects"), options=sampleSettings(register,ui);
    if (state.sampleOptionKey!==options || !selects.children.length) selects.innerHTML=options;
    state.sampleOptionKey=options;
    listSamples(state);
  }

  function filters(state) {
    const b = state.payload.beds, rows = state.payload.rows;
    const options = {span:["1D","2D","1DL"], bed:b.filter(x => x.span !== "TEST").map(x => x.id),
      recipe:[...new Set(rows.map(x => x.recipe))].sort(), seed:[...new Set(rows.map(x => x.seed))].sort((a,b) => a-b),
      status:Object.keys(cellLabels)};
    const labels = {span:"预测时段", bed:"测试数据", recipe:"配方", seed:"抽样种子", status:"结果"};
    return '<div class="sc-filters">' + Object.entries(options).map(([key,values]) =>
      '<label>' + labels[key] + '<select data-filter="' + key + '"><option value="">全部</option>' +
      values.map(v => '<option value="' + text(v) + '"' + (state.filters[key] === String(v) ? ' selected' : '') + '>' +
        text(key === "status" ? cellLabels[v] : key === "span" ? spanNames[v] + "（" + v + "）" : v) + '</option>').join("") + '</select></label>').join("") +
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

  function compareMethods(state) {
    const p = state.payload;
    const beds = p.beds.filter(b => b.span !== "TEST" && p.rows.some(r => r.bed === b.id));
    if (!beds.length) return "";
    let bed = beds.find(b => b.id === state.compareBed) || beds.find(b=>b.id === "T1-OFF-2D") || beds[0];
    state.compareBed = bed.id;
    const seeds = [...new Set(p.rows.filter(r=>r.bed===bed.id).map(r=>r.seed))].sort((a,b)=>a-b);
    if (!seeds.includes(state.compareSeed)) state.compareSeed=seeds[0];
    const options=(values,chosen) => values.map(([value,label])=>`<option value="${text(value)}"${value===chosen ? " selected" : ""}>${text(label)}</option>`).join("");
    const rows = p.rows.filter(r=>r.bed===bed.id && r.seed===state.compareSeed).sort((a,b) =>
      (Number(b.status==="valid")-Number(a.status==="valid")) ||
      ((b.total ?? -Infinity)-(a.total ?? -Infinity)) || a.recipe.localeCompare(b.recipe));
    const base = rows.find(r=>r.recipe==="S00" && r.status==="valid");
    const sections = rows.map(r=>{
      const delta = r.status==="valid" && base ? r.total-base.total : null;
      return `<tr><th scope="row"><small>${text(r.recipe)}</small> ${text(p.methods?.[r.recipe] || r.recipe)}</th>
        <td>${text(cellLabels[r.status])}</td><td>${number(r.total)}</td><td class="${delta>0?"sc-gain":""}">${number(delta,true)}</td>
        <td><button type="button" class="btn" data-case="${text(r.recipe)}" aria-label="查看 ${text(r.recipe)} 的分项和原因">明细</button></td></tr>`;
    }).join("");
    const names = beds.map(b=>[b.id,`${b.source}${b.subset ? " · "+b.subset : ""} / ${b.id}`]);
    return `<section class="sc-box sc-block"><h2>在同一组数据上，哪些配方比复制更好？</h2>
      <div class="sc-filters"><label>测试数据<select data-compare="bed">${options(names,bed.id)}</select></label>
      <label>抽样种子<select data-compare="seed">${options(seeds.map(s=>[s,s]),state.compareSeed)}</select></label></div>
      <p class="sc-small">${text(bed.source)} · ${text(bed.id)} · ${text(spanNames[bed.span])}。
       ${base ? `本组 S00 复制基线为 <b>${number(base.total)}</b> 分。` : "本组尚无可比的 S00 基线。"} 配方按本组总分排序。</p>
      <div class="sc-scroll"><table class="sc-ranking"><thead><tr><th>配方</th><th>结果</th><th>总分</th><th>相对 S00</th><th>记录</th></tr></thead>
      <tbody>${sections}</tbody></table></div></section>`;
  }

  function drawPrivate(state) {
    const p=state.payload, details=state.root.querySelector("#sc-private");
    let html="";
    if (state.view==="overview") {
      const active=p.jobs.filter(j=>["waiting","running","interrupted"].includes(j.status));
      const recent=p.jobs.filter(j=>["succeeded","failed"].includes(j.status)).sort((a,b)=>(Date.parse(b.at)||0)-(Date.parse(a.at)||0)).slice(0,3);
      const names={"vemsc-scorer-20261121-fix-replay01":"首轮配方补评（种子 1–4）","vemsc-scorer-20261122-combopanel01":"组合配方首轮","vemsc-scorer-20261123-seedreview01":"多种子复评与汇总",
                   "vemsc-scorer-20261121-optionalpanel01":"较晚阶段与补充测试","vemsc-scorer-20261121-wildpanel2d01":"两天跨度测试",
                   "vemsc-scorer-20261121-wildpanel1d01":"一天跨度测试"};
      const item=j=>`<li><span>${text(names[j.id] || j.id)}</span><span>${text(jobLabels[j.status])} · ${stamp(j.due || j.at)}</span></li>`;
      html=`<section class="sc-box sc-block"><h2>服务器作业动态</h2><div class="sc-overview-head"><div><h3>当前作业</h3>
        ${active.length ? '<ul class="sc-reasons">'+active.map(item).join("")+'</ul>' : '<p>当前没有运行或等待的作业。</p>'}</div><div><h3>最近结束</h3>
        <ul class="sc-reasons">${recent.map(item).join("")}</ul></div></div></section>`;
    } else if (state.view==="methods") {
      html = `<div id="sc-compare">${compareMethods(state)}</div><section class="sc-box sc-results"><h2>逐次评估记录</h2>
        <p class="sc-small">四项展示换算后的分数。空分显示为横线，实际零分显示为 0.00。</p>
        ${filters(state)}<div id="sc-rows">${drawTable(state)}</div></section>` + historicalScores(p.history);
    } else if (state.view==="validation") {
      const beds = p.beds.map(b => {
        const stages = b.frames.filter(f => f.role === "visible").map(f => "E"+f.stage).join("、");
        return `<tr><th scope="row">${text(b.id)}</th><td>${text(b.source)}${b.subset ? " · "+text(b.subset) : ""}${b.control ? "（对照）" : ""}</td>
          <td>${text(stages)}</td><td>E${text(b.target)}${b.span==="TEST" ? " · 无公开答案" : ""}</td><td>${text(b.genes)}</td><td>${text(b.seeds)}</td></tr>`;
      }).join("");
      html = `<section id="sc-beds" class="sc-box sc-block"><h2>测试数据目录</h2><div class="sc-scroll"><table><thead><tr>
        <th>数据编号</th><th>来源</th><th>可见阶段</th><th>目标阶段</th><th>基因数</th><th>可用种子数</th></tr></thead><tbody>${beds}</tbody></table></div></section>`;
    } else if (state.view==="issues") {
      const fail = p.rows.filter(r=>r.status==="failed");
      const incl = ["vemsc-scorer-20261122-combopanel01", "vemsc-scorer-20261123-seedreview01"];
      const scheduleName = ["组合配方", "多种子复评"];
      const order = [...p.jobs].sort((a,b)=>(Date.parse(b.at)||0)-(Date.parse(a.at)||0));
      const jobRows = order.map(j=>`<tr><th scope="row">${text(incl.includes(j.id) ? scheduleName[incl.indexOf(j.id)]+" · "+j.id : j.id)}</th>
        <td>${text(jobLabels[j.status])}</td><td>${stamp(j.at)}</td><td>${stamp(j.due)}</td></tr>`).join("");
      const explain=r=>r.batch==="wild_2d_controls_20261121_01" && r.bed==="T1-TOMEWHOLE-2D" && r.recipe==="S33" && r.seed===0 && r.reason.includes("1.0002874133925454e-05")
        ? "数值检查未通过。转为 float32 后，边际误差略超原先设定的 0.00001 容差。" : "";
      html = `<section class="sc-box sc-block"><h2>失败的评估记录</h2>${fail.length ? `<ul class="sc-fail-list">${fail.map(r=>`<li><strong>${text(r.bed)} · ${text(r.recipe)} · 种子 ${text(r.seed)}</strong><p>${explain(r)}</p><p>${text(r.reason || "原记录未填写失败原因")}</p></li>`).join("")}</ul>` : "<p>当前没有标记为失败的评估。</p>"}</section>
        <section id="sc-jobs" class="sc-box sc-block"><h2>作业记录</h2><div class="sc-scroll"><table><thead><tr><th>作业</th><th>实际状态</th><th>状态时间（北京）</th><th>计划开始（北京）</th></tr></thead><tbody>${jobRows}</tbody></table></div></section>
        <details id="sc-sources"><summary>评估表来源与校验</summary><ul>${p.sources.map(s=>`<li>${text(s.id)} · ${text(s.cells)} 次评估<br><code>SHA256 ${text(s.sha256)}</code></li>`).join("")}</ul></details>`;
    }
    const priorOpen = Array.from(details.querySelectorAll("details[open]"), d=>d.id);
    details.innerHTML=html;
    for (const section of details.querySelectorAll("details")) section.open=priorOpen.includes(section.id);
  }

  function historicalScores(history) {
    if (!history) return '<p class="sc-small">当前未能读取历史官方验证记录。</p>';
    const rows=[...history.items].sort((a,b)=>(b.score ?? -Infinity)-(a.score ?? -Infinity));
    const statusText={scored:"已评分",reported_scored:"记录为已评分，待核对",submitted_unresolved:"已登记，反馈待核对"};
    return `<details id="sc-history"><summary>历史官方验证记录 · ${rows.length} 条</summary>
      <p class="sc-small">索引采集于 ${stamp(history.as_of)}（北京）。这里列出 T1 验证榜的历史反馈。当前开发评估见上方配方表。</p>
      <div class="sc-scroll"><table><thead><tr><th>登记文件名</th><th>官方验证分</th><th>记录状态</th><th>上传文件身份</th><th>内部记录号</th></tr></thead>
      <tbody>${rows.map(r=>`<tr><th scope="row">${text(r.file)}</th><td>${number(r.score)}</td><td>${text(statusText[r.state] || r.state)}</td><td>${r.exact ? "上传字节已核实" : "上传字节未核实"}</td><td>${text(r.id)}</td></tr>`).join("")}</tbody></table></div></details>`;
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
      "（北京）" + (stale ? " · 距今 " + Math.floor(minutes) + " 分钟" : "") +
      (live ? " · 每 15 秒检查" : " · 每 15 分钟发布");
  }

  function show(state, summary, source) {
    if (!summary.samples && state.summary?.samples) return;
    if (state.summary && Date.parse(summary.collected_at) < Date.parse(state.summary.collected_at)) return;
    state.summary = summary;
    state.source = source;
    const key = JSON.stringify({...summary, collected_at:null});
    if (state.summaryKey !== key) {
      state.root.querySelector("#sc-summary").innerHTML = drawSummary(summary,state.view);
      displaySamples(state);
    }
    state.summaryKey = key;
    freshness(state);
  }

  async function getJSON(url, signal, githubAPI = false) {
    const response = await fetch(url, {signal, cache:"no-store", credentials:"omit", referrerPolicy:"no-referrer",
      headers:githubAPI ? {Accept:"application/vnd.github.raw+json"} : {}});
    if (!response.ok) throw Error(String(response.status));
    return await response.json();
  }

  function showLive(state, data) {
    checkSummary(data.summary);
    if (!Array.isArray(data.rows) || !Array.isArray(data.jobs) || !Array.isArray(data.beds) || !Array.isArray(data.sources)) throw Error("明细不完整");
    state.payload = data;
    state.error = Boolean(data.collection_error);
    show(state, data.summary, "5090 实时");
    const key = JSON.stringify([data.sources,data.jobs,data.beds,data.methods,data.history?.as_of]);
    if (state.privateKey !== key) drawPrivate(state);
    state.privateKey = key;
  }

  async function refresh(state) {
    if (current !== state || state.busy) return;
    state.busy = true;
    const btn = state.root.querySelector('[data-action="refresh"]');
    btn.disabled = true;
    try {
      if (live) {
        const data = await getJSON("/api/live", AbortSignal.any([state.abort.signal, AbortSignal.timeout(25000)]));
        if (current !== state) return;
        showLive(state, data);
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
    const state = {root, abort:new AbortController(), filters:allFilters(), page:0, error:false, view:viewFromHash(),sampleUI:defaultSampleFilters()};
    current = state;
    const selectView = () => {
      state.view = viewFromHash();
      if (state.view==="samples") {
        if (state.sampleRoute!==location.hash) {
          state.sampleUI=readSampleFilters();
          state.sampleRoute=location.hash;
          const query=root.querySelector("[data-sample-query]");
          if (query) query.value=state.sampleUI.query;
        }
      }
      for (const a of root.querySelectorAll("[data-view]")) {
        if (a.dataset.view === state.view) a.setAttribute("aria-current","page");
        else a.removeAttribute("aria-current");
      }
      const summaryPanel=root.querySelector("#sc-summary"), privatePanel=root.querySelector("#sc-private");
      if (live && state.view === "methods") root.insertBefore(privatePanel,summaryPanel);
      else root.insertBefore(summaryPanel,privatePanel);
      if (state.summary) summaryPanel.innerHTML = drawSummary(state.summary,state.view);
      displaySamples(state);
      if (state.payload) drawPrivate(state);
    };
    selectView();
    if (live) window.addEventListener("hashchange",selectView,{signal:state.abort.signal});
    if (!live) {
      try { show(state,checkSummary(window.VEMScorerSeed),"随页快照"); } catch (_) {}
      try { show(state,checkSummary(JSON.parse(localStorage.getItem(cacheKey))),"上次公开快照"); } catch (_) {}
    } else {
      const first = document.getElementById("sc-initial");
      if (first) {
        try { showLive(state,JSON.parse(first.textContent)); } catch (_) {}
      }
    }
    root.addEventListener("input", e=>{
      if (!e.target.matches("[data-sample-query]")) return;
      state.sampleUI.query=e.target.value;
      state.sampleUI.pages.clear();
      saveSampleFilters(state);
      listSamples(state);
    });
    root.addEventListener("toggle",e=>{
      const row=e.target;
      if (state.view!=="samples" || !row.matches?.("details[data-sample-id]") || !root.contains(row)) return;
      const id=row.dataset.sampleId, body=row.querySelector("[data-sample-body]");
      if (!row.open) {
        state.sampleUI.open.delete(id);
      } else {
        state.sampleUI.open.add(id);
        const item=state.visibleSamples?.get(id);
        if (item && !body.firstElementChild)
          body.innerHTML=sampleDetail(state.summary.samples,item.recipe,item.cases,state.sampleUI.pages.get(id));
      }
      saveSampleFilters(state);
    },true);
    root.addEventListener("change", e => {
      if (e.target.dataset.sampleFilter) {
        state.sampleUI[e.target.dataset.sampleFilter]=e.target.value;
        state.sampleUI.pages.clear();
        saveSampleFilters(state);
        listSamples(state);
        return;
      }
      if (e.target.dataset.compare) {
        if (e.target.dataset.compare === "bed") state.compareBed=e.target.value;
        else state.compareSeed=Number(e.target.value);
        root.querySelector("#sc-compare").innerHTML=compareMethods(state);
        root.querySelector('[data-compare="'+e.target.dataset.compare+'"]')?.focus({preventScroll:true});
        return;
      }
      if (!e.target.dataset.filter) return;
      state.filters[e.target.dataset.filter] = e.target.value;
      state.page = 0;
      root.querySelector("#sc-rows").innerHTML = drawTable(state);
    });
    root.addEventListener("click", e => {
      const pageButton=e.target.closest("button[data-sample-page]");
      if (pageButton) {
        const row=pageButton.closest("[data-sample-id]"), id=row.dataset.sampleId;
        const item=state.visibleSamples.get(id), page=Number(pageButton.dataset.samplePage);
        state.sampleUI.pages.set(id,page);
        row.querySelector("[data-sample-body]").innerHTML=sampleDetail(state.summary.samples,item.recipe,item.cases,page);
        row.querySelector(".sc-scroll").focus({preventScroll:true});
        row.querySelector(".sr-detail-heading").scrollIntoView({block:"center"});
        return;
      }
      if (e.target.closest("[data-clear-samples]")) {
        state.sampleUI=defaultSampleFilters();
        saveSampleFilters(state);
        root.querySelector("[data-sample-query]").value="";
        state.sampleOptionKey=null;
        displaySamples(state);
        return;
      }
      const record=e.target.closest("button[data-case]");
      if (record) {
        state.filters={...allFilters(),bed:state.compareBed, seed:String(state.compareSeed),recipe:record.dataset.case};
        state.page=0;
        drawPrivate(state);
        const table=root.querySelector("#sc-rows .sc-scroll");
        table.focus({preventScroll:true});
        table.scrollIntoView({block:"center"});
        return;
      }
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
    if (!state.payload) refresh(state);
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
