/* One T1 sample register for earlier S recipes and accepted A iterations. */
(() => {
  "use strict";
  const {esc,num,signed,count,stamp,site,states,causes,metricInfo,tag,sub,row,grid,lead,note,examTitle,stat,average}=window.VEMBook;
  const pageSize=12;
  const bedGroups=[
    {title:"日常迭代 · 两张主床", labels:{"T1-FENGCD1-2D":"主床 1 · CD1","T1-TOMEHEART-2D":"主床 2 · 心脏区域"}},
    {title:"原定六床 · 官方数据底线", labels:{"T1-OFF-1D-EXT":"底线 · 一天 EXT","T1-OFF-2D-EXT":"底线 · 两天 EXT"}},
    {title:"原定六床 · 只展示", labels:{"T1-QIUPOOL-2D":"展示 · 合并样本","T1-QIUSINGLE-2D":"展示 · 单重复"}},
    {title:"候选额外复核 · 不计入排名", labels:{"T1-TOMEWHOLE-2D":"额外 · 全胚胎","T1-FENGB6-2D":"额外 · C57BL/6N"}},
  ];
  const bedLabels=Object.assign({},...bedGroups.map(g=>g.labels));
  const priority=Object.keys(bedLabels), main=Object.keys(bedGroups[0].labels);
  const agreed=bedGroups.slice(0,3).flatMap(g=>Object.keys(g.labels));
  const role=b=>main.includes(b)?"计排名":b.startsWith("T1-OFF-")&&agreed.includes(b)?"底线，不计排名":agreed.includes(b)?"只展示":priority.includes(b)?"额外复核":"历史对照";
  const seriesLabels={A:"持续迭代",S:"11 月 21 日复核"};
  const time=x=>Date.parse(x)||0;
  const byId=(a,b)=>a.localeCompare(b,"en",{numeric:true});
  const newest=(a,b)=>time(b.at)-time(a.at)||byId(b.batch,a.batch);
  const series=id=>id[0];
  const recipeId=/^[AS]\d+$/;
  const metricNames=metricInfo.map(m=>m[0]);
  const rawFor=(r,i)=>Array.isArray(r.raw)&&Number.isFinite(r.raw[i])?sub("原始 "+num(r.raw[i],5)):"";

  function latest(records) {
    // Each recorded batch remains in details; a repeated seed contributes once to the mean.
    const cases=new Map();
    for(const c of records){
      const key=c.bed+"/"+c.seed, old=cases.get(key);
      if(!old||newest(c,old)<0)cases.set(key,c);
    }
    return [...cases.values()];
  }

  function summarize(records){
    const byBed=new Map();
    for(const c of latest(records)){
      if(!byBed.has(c.bed))byBed.set(c.bed,[]);
      byBed.get(c.bed).push(c);
    }
    return byBed;
  }

  function rankMean(byBed){
    const pair=main.map(b=>byBed.get(b)||[]);
    return pair.every(cs=>cs.length===5&&[0,1,2,3,4].every(seed=>cs.some(c=>c.seed===seed&&c.status==="valid"&&Number.isFinite(c.total))))
      ?average(pair.map(cs=>stat(cs).score)):null;
  }

  function models(s) {
    const d=s.data, reg=d.samples, u=s.all||{};
    const current=s.sampleCurrent instanceof Map?[...s.sampleCurrent.entries()]:Object.entries(s.sampleCurrent||{});
    const batchTimes=new Map((s.sampleBatches||[]).map(b=>[b.id,b.accepted_at]));
    const items=new Map(), batches=new Map(), seeds=new Set(), seenBeds=new Set();
    const collect=(id,name,record,at,batch)=>{
      if(!recipeId.test(id)||!Object.hasOwn(reg.beds,record.bed)||!Object.hasOwn(states,record.status)||
         !Number.isInteger(record.seed)||!Array.isArray(record.skills)||record.skills.length!==4)return;
      if(!items.has(id))items.set(id,{id,name,records:[]});
      items.get(id).records.push({...record,batch,at});
      batches.set(batch,{id:batch,at});
      seeds.add(record.seed);seenBeds.add(record.bed);
    };
    for(const r of reg.recipes)for(const c of r.cases)collect(r.id,r.name,c,reg.batches[c.batch],c.batch);
    for(const [batch,rows] of current)for(const c of rows)collect(c.recipe,"",c,batchTimes.get(batch),batch);

    const beds=[...new Set([...priority,...Object.keys(reg.beds)])].filter(k=>seenBeds.has(k));
    const q=(u.q||"").trim().toLowerCase();
    const matches=[];
    for(const item of items.values()){
      if(u.series&&series(item.id)!==u.series)continue;
      const label=(item.id+" "+item.name+" "+seriesLabels[series(item.id)]).toLowerCase();
      const nameMatch=!q||label.includes(q);
      const observations=item.records.filter(c=>{
        const b=reg.beds[c.bed];
        return (!u.bed||c.bed===u.bed)&&(u.seed==null||u.seed===""||String(c.seed)===String(u.seed))&&
          (!u.batch||c.batch===u.batch)&&(!u.status||c.status===u.status)&&
          (nameMatch||[c.bed,b.source,b.subset,c.batch].join(" ").toLowerCase().includes(q));
      });
      if(!observations.length)continue;
      const byBed=summarize(observations);
      const last=observations.reduce((a,b)=>newest(b,a)<0?b:a);
      matches.push({...item,observations,byBed,last});
    }
    const inResults=beds.filter(k=>matches.some(item=>item.byBed.has(k)));
    const preset=u.columns==="all"?beds:u.columns==="current"?priority:u.columns==="compact"?main:agreed;
    const shown=preset.filter(k=>beds.includes(k));
    const scoped=!!(u.bed||u.batch)||(!!q&&inResults.length>0&&!inResults.some(k=>shown.includes(k)));
    const compact=u.columns==="compact"||scoped;
    const displayedBeds=scoped?inResults:shown;
    const scoreBed=scoped?displayedBeds[0]:null;
    const forSort=item=>(scoreBed?stat(item.byBed.get(scoreBed)||[]).score:rankMean(item.byBed))??-Infinity;
    matches.sort((a,b)=>(u.order==="oldest"?newest(b.last,a.last):u.order==="id"?0:
      u.order==="score"?forSort(b)-forSort(a):newest(a.last,b.last))||byId(a.id,b.id));
    return {d,u,beds,displayedBeds,matches,items,batches:[...batches.values()].sort((a,b)=>time(b.at)-time(a.at)||byId(b.id,a.id)),seeds:[...seeds].sort((a,b)=>a-b),scoreBed,compact,scoped};
  }

  function statusCell(c){return tag(states[c.status],c.status==="valid"?"visible":c.status==="failed"?"bad":"neutral");}

  function scoreCell(cases=[]){
    const a=stat(cases);
    if(!a.n)return '<span class="bk-dim">未评</span>';
    const coverage=sub(`${a.ok}/${a.n} 有分`);
    if(!a.ok)return `${a.failed?tag("失败","bad"):tag("NA","neutral")}${coverage}`;
    return `<b>${num(a.score)}</b>${coverage}${Number.isFinite(a.delta)?sub("Δ S00 "+signed(a.delta)):""}`;
  }

  const compactHeads=["配方 / 最近验收","两张排名床成绩","评估条数"];
  function alignedHeads(d,beds){
    return ["配方 / 最近验收","两主床均分"+sub("两床等权"),...beds.map(id=>{
      const b=d.samples.beds[id];
      return `<span data-bed="${esc(id)}">${esc(id)}</span>${sub(esc(role(id)))}${sub(esc(`E${b.last} → E${b.target}`))}`;
    })];
  }

  function alignedGrid(title,heads,rows){
    const beds=heads.length-2;
    return grid(title,heads,rows,"bk-aligned-score bk-freeze",{
      attrs:` style="--bk-bed-count:${beds}"`,columns:`<colgroup><col class="bk-col-recipe"><col class="bk-col-mean">${"<col>".repeat(beds)}</colgroup>`});
  }

  const rankCell=byBed=>`<b class="bk-rank-mean">${num(rankMean(byBed))}</b>`;
  const identityMeta=(last,n)=>last?`<small>${esc(stamp(last.at).slice(5,16))}（北京） · ${count(n)} 条</small>`:`<small>${count(n)} 条评估</small>`;

  function baselines(s){
    const d=s.data, u=s.all, reg=d.samples;
    const layout=u.columns==="all"?Object.keys(reg.beds):u.columns==="current"?priority:u.columns==="compact"?main:agreed;
    const beds=[...new Set([...priority.filter(id=>layout.includes(id)),...layout])].filter(id=>Object.hasOwn(reg.beds,id));
    const compact=u.columns==="compact";
    const items=reg.recipes.filter(r=>["S00","S01","S02","S03"].includes(r.id));
    const rows=items.map(r=>{
      const records=r.cases.map(c=>({...c,at:reg.batches[c.batch]})), byBed=summarize(records);
      const last=records.reduce((a,c)=>!a||newest(c,a)<0?c:a,null);
      const label=`<a href="${site}/samples?view=all&q=${esc(r.id)}&open=${esc(r.id)}"><b>${esc(r.id)}</b> · ${esc(r.name)}</a>`;
      return row(label+identityMeta(last,records.length),compact?[combinedScores(beds,byBed),count(records.length)]:[rankCell(byBed),...beds.map(b=>scoreCell(byBed.get(b)))],`data-baseline="${esc(r.id)}"`);
    });
    return lead(compact?"基线与样本使用同一套两主床简表。":"基线与样本使用同一套本地成绩列。先看两主床均分，再看各床成绩。")+
      `<div class="bk-card bk-register bk-score-register" id="bk-baseline-matrix">${compact?grid("基线对照",compactHeads,rows,"bk-sample-summary"):alignedGrid("基线对照",alignedHeads(d,beds),rows)}</div>`+
      window.VEMBook.baselineHistory(d)+'<details class="bk-disclosure" data-board-disclosure="baseline-archive-signal"><summary>历史复核 · 各考场相对 S00 的分差</summary><div id="bk-signal"></div></details>';
  }

  function combinedScores(beds,byBed){
    return `<div class="bk-sample-scores">${beds.map(b=>`<div data-bed="${esc(b)}">${sub(esc(b))}${scoreCell(byBed.get(b))}</div>`).join("")}</div>`;
  }

  function agreedBeds(d){
    const exams=new Map(d.board.exams.map(b=>[b.id,b]));
    const titles=["排名 · 两张主床","底线 · 官方数据本地验证","只展示 · 不计排名"];
    const panels=bedGroups.slice(0,3).map(({labels},i)=>`<div><h4>${titles[i]}</h4><dl>${Object.keys(labels).map(id=>{
      const b=d.samples.beds[id], e=exams.get(id);
      if(!b||!e)return "";
      const context=id.includes("QIUSINGLE")?"心脏子集 · 单重复":id.includes("QIUPOOL")?"心脏子集 · 合并样本":b.subset;
      return `<div data-bed-definition="${esc(id)}"><dt>${esc(id)}</dt><dd>${esc([b.source,context].filter(Boolean).join("｜"))}</dd><dd>可见 ${esc(e.visible.map(x=>"E"+x).join("、"))} → 预测 E${esc(e.target)}</dd></div>`;
    }).join("")}</dl></div>`).join("");
    return `<div class="bk-card bk-agreed-beds" id="bk-agreed-beds"><h3>原定六床</h3><div class="bk-bed-definitions">${panels}</div>
      <p class="bk-note">两主床各有五个种子的成绩才算均分。两张底线共用同一份官方 E10.5 答案，前三名须逐床不低于复制基线 S00；EXT 表示允许指定外部参考。</p></div>`;
  }

  function detailFor(d,item,bedOrder,{scoped=false,openAttempts=false}={}){
    const {id,name,byBed,observations}=item;
    const summaryBeds=(scoped?bedOrder.filter(b=>byBed.has(b)):agreed).filter(b=>Object.hasOwn(d.samples.beds,b));
    const summary=grid(id+" 考场成绩",["考场","总分"],summaryBeds.map(b=>
      row(`<b>${esc(bedLabels[b]||b)}</b><div class="bk-bed-source">${examTitle(d,b)}${sub(esc(b))}</div>`,[scoreCell(byBed.get(b))],`data-summary-bed="${esc(b)}"`)),"bk-bed-summary");
    const cases=[...observations].sort((a,b)=>bedOrder.indexOf(a.bed)-bedOrder.indexOf(b.bed)||a.seed-b.seed||newest(a,b));
    const haveRaw=cases.some(c=>c.raw?.some(Number.isFinite));
    const haveDelta=cases.some(c=>Number.isFinite(c.delta));
    const haveCause=cases.some(c=>Object.hasOwn(causes,c.cause));
    const heads=["考场 / 条件","种子","结果","开发总分",...metricNames,
      ...(haveDelta?["比 S00"]:[]),...(haveCause?["原因"]:[]),"批次 / 验收（北京）"];
    const detailRows=cases.map(c=>row(examTitle(d,c.bed)+sub(esc(c.bed)),[count(c.seed),statusCell(c),num(c.total),
      ...c.skills.map((v,i)=>num(v)+rawFor(c,i)),...(haveDelta?[signed(c.delta)]:[]),...(haveCause?[esc(causes[c.cause]||"—")]:[]),
      esc(c.batch)+sub(stamp(c.at))],`data-all-case="${esc(c.bed)}" data-seed="${c.seed}"`,heads.slice(1)));
    return `<div class="bk-detail-head"><h4>${esc(id)}${name?" · "+esc(name):""}</h4><span>${count(cases.length)} 条评估</span></div>
      <h5>${scoped?"筛选结果":"原定六床"}</h5>${summary}
      <details class="bk-sample-attempts" data-board-disclosure="sample-attempts-${esc(id)}"${openAttempts?" open":""}>
        <summary>逐种子与批次（${count(cases.length)} 条）</summary>
        ${note("这里保留所有匹配记录，含补充、历史床、四项分数、失败和复测。"+(haveRaw?"旧记录也显示可用的原始指标。":""))}
        ${grid(id+" 逐种子评估",heads,detailRows,"bk-cases")}</details>`;
  }

  const select=(label,key,values,selected,disabled=false)=>`<label>${esc(label)}<select aria-label="${esc(label)}" data-all-filter="${key}"${disabled?" disabled":""}>${
    values.map(([v,l])=>`<option value="${esc(v)}"${String(v)===String(selected??"")?" selected":""}>${esc(l)}</option>`).join("")}</select></label>`;

  function bedGuide(d,beds){
    const list=ids=>`<ul>${ids.map(id=>`<li>${examTitle(d,id)}${sub(esc(id))}</li>`).join("")}</ul>`;
    const groups=bedGroups.map(({title,labels})=>`<div><h5>${esc(title)}</h5>${list(Object.keys(labels).filter(id=>beds.includes(id)))}</div>`).join("");
    const old=beds.filter(id=>!priority.includes(id));
    return `<details class="bk-bed-guide" data-board-disclosure="bed-guide"><summary>成绩怎么读</summary>
      <p>配方 / 系列：预测方案的编号，A 是持续迭代，S 是 11 月 21 日复核。最近验收：所选记录里该配方最新验收的时间（北京）与批次。</p>
      <p>考场分数：在筛选范围内，每个种子取最近一次验收，再算有分均值。5/5 有分表示 5 个种子都得分；Δ S00 是同考场同种子相对复制基线的分差。</p>
      <p>评估条数：考场 × 种子 × 批次的记录数，包含缺分、失败与复测。点配方查全部明细。</p>
      <p>原定六床＝两张排名主床、两张底线、两张只展示。只有主床计排名：两床都从 E10.5 预测 E12.5，各跑五个种子，两床等权。</p>
      <p>两张底线用同一套官方 T1 数据、同一个 E10.5 答案：一天床能看 E8.5 和 E9.5，两天床只看 E8.5。EXT 表示允许指定外部参考，仍是本地评分。</p>
      <p>候选复核另外留有两张诊断床的记录。T1-TEST 只做格式检查，没有分数列。</p>
      <div class="bk-bed-groups">${groups}</div>
      ${old.length?`<details data-board-disclosure="old-beds"><summary>另 ${count(old.length)} 张历史复核与补充床</summary>${list(old)}</details>`:""}</details>`;
  }

  function render(s){
    const {d,u,displayedBeds,beds,matches,items,batches,seeds,scoreBed,compact,scoped}=models(s);
    const records=matches.reduce((n,item)=>n+item.observations.length,0);
    const total=[...items.values()].reduce((n,item)=>n+item.records.length,0);
    const pages=Math.max(1,Math.ceil(matches.length/pageSize));
    const selected=s.anchorRecipe?matches.findIndex(item=>item.id===s.anchorRecipe):-1;
    const page=selected>=0?Math.floor(selected/pageSize):Math.min(Math.max(0,Math.trunc(Number(u.page)||0)),pages-1);
    const start=page*pageSize,end=Math.min(matches.length,start+pageSize);
    const open=u.open||new Set();
    const heads=compact?(scoped?[compactHeads[0],"考场成绩",compactHeads[2]]:compactHeads):alignedHeads(d,displayedBeds);
    const rows=matches.slice(start,end).flatMap(item=>{
      const {id,name,last,byBed,observations}=item, expanded=open.has(id);
      const label=`<button type="button" class="bk-open" data-all-open="${esc(id)}" aria-label="${expanded?"收起":"展开"} ${esc(id)}" aria-expanded="${expanded}"${expanded?` aria-controls="bk-all-detail-${esc(id)}"`:""}><b>${expanded?"▾":"▸"} ${esc(id)}</b>${name?`<span>${esc(name)}</span>`:""}</button>${sub(esc(seriesLabels[series(id)]))}`;
      const a=row(label+identityMeta(last,observations.length),compact?[combinedScores(displayedBeds,byBed),count(observations.length)]:[rankCell(byBed),...displayedBeds.map(b=>scoreCell(byBed.get(b)))],`data-recipe="${esc(id)}" class="${expanded?"open":""}"`);
      return expanded?[a,`<tr class="bk-detail-row"><td colspan="${heads.length}"><div class="bk-detail" id="bk-all-detail-${esc(id)}">${detailFor(d,item,beds,{scoped,openAttempts:!!(u.bed||u.batch)})}</div></td></tr>`]:[a];
    });
    const controls=`<div class="bk-tools bk-all-primary"><label>搜索样本<input type="search" data-all-search aria-label="搜索样本" placeholder="配方、考场、来源或批次" value="${esc(u.q||"")}"></label></div>
      <details class="bk-sample-filters" data-board-disclosure="sample-filters"${[u.bed,u.series,u.batch,u.seed,u.status].some(Boolean)||u.order!=="recent"||["compact","current","all"].includes(u.columns)?" open":""}><summary>筛选与对比</summary>
      <div class="bk-tools bk-all-tools">
      ${select("显示方式","columns",[["main","原定六床（默认）"],["compact","简表 · 两主床"],["current","候选复核 · 八床"],["all",`历史全部 ${beds.length} 床`]],u.columns==="agreed"?"main":u.columns||"main",!!(u.bed||u.batch))}
      ${select("配方系列","series",[["","全部配方"],["A","A · 持续迭代"],["S","S · 11 月 21 日复核"]],u.series)}
      ${select("考场","bed",[["","所有有记录的考场"],...beds.map(b=>[b,b+" · "+d.samples.beds[b].source+(d.samples.beds[b].subset?"｜"+d.samples.beds[b].subset:"")])],u.bed)}
      ${select("抽样种子","seed",[["","所有种子"],...seeds.map(seed=>[seed,String(seed)])],u.seed)}
      ${select("评估结果","status",[["","全部结果"],...Object.entries(states)],u.status)}
      ${select("批次","batch",[["","全部批次"],...batches.map(b=>[b.id,b.id+" · "+stamp(b.at)])],u.batch)}
      ${select("排列顺序","order",[["recent","最近验收在前"],["oldest","最早验收在前"],["score",scoreBed?"首个筛选考场成绩 ↓":"两主床均分 ↓"],["id","配方编号"]],u.order||"recent")}
      <button class="btn" type="button" data-all-clear>清除筛选</button></div></details>`;
    const pagination=pages>1?`<div class="bk-pages bk-all-pages" aria-label="样本分页">
      <button class="btn" type="button" data-all-page="${Math.max(page-1,0)}"${page===0?" disabled":""}>上一页</button>
      <span>第 ${count(start+1)}–${count(end)} 个配方 · ${count(page+1)} / ${count(pages)} 页</span>
      <button class="btn" type="button" data-all-page="${Math.min(page+1,pages-1)}"${page===pages-1?" disabled":""}>下一页</button></div>`:"";
    const source=s.sampleSource?note(esc(s.sampleSource)):"";
    const latestBatch=batches[0];
    return lead((scoped?"每行一个配方，只显示所选考场或批次。":"每行一个配方，与上面的基线对照同列。")+"点配方可查逐种子、四项分数和历史批次。")+agreedBeds(d)+
      `<p class="bk-note">${latestBatch?`最新验收：${stamp(latestBatch.at)}（北京时间） · ${esc(latestBatch.id)} · `:""}<a href="${site}/samples/archive">历史复核原表 ↗</a></p>${source}
      <div class="bk-card bk-register bk-all-register bk-score-register">${controls}${bedGuide(d,beds)}
      ${u.bed||u.batch?note("这里显示所选考场或批次的成绩。") : ""}
      <p id="bk-all-count" aria-live="polite">显示 ${count(matches.length)} / ${count(items.size)} 个配方 · ${count(records)} / ${count(total)} 条评估${u.order==="score"?" · 按 "+esc(scoreBed||"两主床均分")+" 排序":""}</p>
      <div id="bk-all-matrix" data-sample-page="${page}">${rows.length?(compact?grid("T1 全部样本成绩",heads,rows,"bk-sample-summary"):alignedGrid("T1 全部样本成绩",heads,rows)):'<p class="bk-empty">没有匹配的样本。请更换关键词或清除筛选。</p>'}</div>
      ${pagination}${!compact&&displayedBeds.length>3?'<p class="bk-note bk-swipe">横向滑动查看其余考场，配方编号留在左侧。</p>':""}</div>`;
  }

  function detail(s,id){
    const m=models(s), item=m.matches.find(r=>r.id===id);
    return item?detailFor(m.d,item,m.beds):"";
  }

  window.VEMT1Samples={render,detail,baselines};
})();
