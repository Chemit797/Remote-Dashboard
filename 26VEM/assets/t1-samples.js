/* One T1 sample register for earlier S recipes and accepted A iterations. */
(() => {
  "use strict";
  const {esc,num,signed,count,stamp,site,states,causes,metricInfo,tag,sub,row,grid,lead,note,examTitle,stat}=window.VEMBook;
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
      const byBed=new Map();
      for(const c of latest(observations)){
        if(!byBed.has(c.bed))byBed.set(c.bed,[]);
        byBed.get(c.bed).push(c);
      }
      const last=observations.reduce((a,b)=>newest(b,a)<0?b:a);
      matches.push({...item,observations,byBed,last});
    }
    const inResults=beds.filter(k=>matches.some(item=>item.byBed.has(k)));
    const preset=u.columns==="all"?beds:u.columns==="current"?priority:u.columns==="agreed"?agreed:main;
    const shown=preset.filter(k=>beds.includes(k));
    const compact=u.columns==="main"||!u.columns;
    const displayedBeds=u.bed||u.batch||(compact&&q&&inResults.length&&!inResults.some(k=>main.includes(k)))?inResults:shown;
    const scoreBed=u.bed||displayedBeds[0];
    const forSort=item=>stat(item.byBed.get(scoreBed)||[]).score??-Infinity;
    matches.sort((a,b)=>(u.order==="oldest"?newest(b.last,a.last):u.order==="id"?0:
      u.order==="score"?forSort(b)-forSort(a):newest(a.last,b.last))||byId(a.id,b.id));
    return {d,u,beds,displayedBeds,matches,items,batches:[...batches.values()].sort((a,b)=>time(b.at)-time(a.at)||byId(b.id,a.id)),seeds:[...seeds].sort((a,b)=>a-b),scoreBed,compact};
  }

  function statusCell(c){return tag(states[c.status],c.status==="valid"?"visible":c.status==="failed"?"bad":"neutral");}

  function scoreCell(cases=[]){
    const a=stat(cases);
    if(!a.n)return '<span class="bk-dim">未评</span>';
    const coverage=sub(`${a.ok}/${a.n} 有分`);
    if(!a.ok)return `${a.failed?tag("失败","bad"):tag("NA","neutral")}${coverage}`;
    return `<b>${num(a.score)}</b>${coverage}${Number.isFinite(a.delta)?sub("Δ S00 "+signed(a.delta)):""}`;
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
    const {d,u,displayedBeds,beds,matches,items,batches,seeds,scoreBed,compact}=models(s);
    const records=matches.reduce((n,item)=>n+item.observations.length,0);
    const total=[...items.values()].reduce((n,item)=>n+item.records.length,0);
    const pages=Math.max(1,Math.ceil(matches.length/pageSize));
    const page=Math.min(Math.max(0,Math.trunc(Number(u.page)||0)),pages-1);
    const start=page*pageSize,end=Math.min(matches.length,start+pageSize);
    const open=u.open||new Set();
    const ranks=compact&&displayedBeds.length===main.length&&displayedBeds.every((id,i)=>id===main[i])&&!u.bed&&!u.batch;
    const heads=compact?["配方 / 最近验收",ranks?"排名床成绩":"考场成绩","评估条数"]:["配方 / 系列","最近验收",...displayedBeds.map(id=>{
      const bed=d.samples.beds[id];
      return `<span data-bed="${esc(id)}" title="${esc(bed.source+' · '+id)}">${esc(bedLabels[id]||id.replace(/^T1-/,""))}</span>${sub(esc(`E${bed.last} → E${bed.target}`))}`;
    }),"评估条数"];
    const rows=matches.slice(start,end).flatMap(item=>{
      const {id,name,last,byBed,observations}=item, expanded=open.has(id);
      const label=`<button type="button" class="bk-open" data-all-open="${esc(id)}" aria-label="${expanded?"收起":"展开"} ${esc(id)}" aria-expanded="${expanded}"${expanded?` aria-controls="bk-all-detail-${esc(id)}"`:""}><b>${expanded?"▾":"▸"} ${esc(id)}</b>${name?`<span>${esc(name)}</span>`:""}</button>${sub(esc(seriesLabels[series(id)]))}`;
      const time=stamp(last.at), meta=`<small class="bk-sample-time" title="${esc(time+'（北京时间） · '+last.batch)}">${esc(time.slice(5,16))}</small>`;
      const combined=compact?`<div class="bk-sample-scores">${displayedBeds.map(b=>`<div data-bed="${esc(b)}" title="${esc(d.samples.beds[b].source+' · '+b)}">${sub(esc(bedLabels[b]||b))}${scoreCell(byBed.get(b))}</div>`).join("")}</div>`:"";
      const a=row(label+(compact?meta:""),compact?[combined,count(observations.length)]:[time+sub(esc(last.batch)),...displayedBeds.map(b=>scoreCell(byBed.get(b))),count(observations.length)],`data-recipe="${esc(id)}" class="${expanded?"open":""}"`);
      const narrowed=!!(u.bed||u.batch)||(compact&&!ranks);
      return expanded?[a,`<tr class="bk-detail-row"><td colspan="${heads.length}"><div class="bk-detail" id="bk-all-detail-${esc(id)}">${detailFor(d,item,beds,{scoped:narrowed,openAttempts:!!(u.bed||u.batch)})}</div></td></tr>`]:[a];
    });
    const controls=`<div class="bk-tools bk-all-primary"><label>搜索样本<input type="search" data-all-search aria-label="搜索样本" placeholder="配方、考场、来源或批次" value="${esc(u.q||"")}"></label></div>
      <details class="bk-sample-filters" data-board-disclosure="sample-filters"${[u.bed,u.series,u.batch,u.seed,u.status].some(Boolean)||u.order!=="recent"||!compact?" open":""}><summary>筛选与对比</summary>
      <div class="bk-tools bk-all-tools">
      ${select("显示方式","columns",[["main","简表"],["agreed","横向对比 · 原定六床"],["current","横向对比 · 候选八床"],["all",`横向对比 · 历史全部 ${beds.length} 床`]],u.columns||"main",!!(u.bed||u.batch))}
      ${select("配方系列","series",[["","全部配方"],["A","A · 持续迭代"],["S","S · 11 月 21 日复核"]],u.series)}
      ${select("考场","bed",[["","所有有记录的考场"],...beds.map(b=>[b,b+" · "+d.samples.beds[b].source+(d.samples.beds[b].subset?"｜"+d.samples.beds[b].subset:"")])],u.bed)}
      ${select("抽样种子","seed",[["","所有种子"],...seeds.map(seed=>[seed,String(seed)])],u.seed)}
      ${select("评估结果","status",[["","全部结果"],...Object.entries(states)],u.status)}
      ${select("批次","batch",[["","全部批次"],...batches.map(b=>[b.id,b.id+" · "+stamp(b.at)])],u.batch)}
      ${select("排列顺序","order",[["recent","最近验收在前"],["oldest","最早验收在前"],["score","第一个显示的考场分数 ↓"],["id","配方编号"]],u.order||"recent")}
      <button class="btn" type="button" data-all-clear>清除筛选</button></div></details>`;
    const pagination=pages>1?`<div class="bk-pages bk-all-pages" aria-label="样本分页">
      <button class="btn" type="button" data-all-page="${Math.max(page-1,0)}"${page===0?" disabled":""}>上一页</button>
      <span>第 ${count(start+1)}–${count(end)} 个配方 · ${count(page+1)} / ${count(pages)} 页</span>
      <button class="btn" type="button" data-all-page="${Math.min(page+1,pages-1)}"${page===pages-1?" disabled":""}>下一页</button></div>`:"";
    const source=s.sampleSource?note(esc(s.sampleSource)):"";
    const latestBatch=batches[0];
    return lead("每行一个配方。平时看两张排名床，点配方可展开原定六床和历次评估。")+
      `<p class="bk-note">${latestBatch?`最新验收：${stamp(latestBatch.at)}（北京时间） · ${esc(latestBatch.id)} · `:""}<a href="${site}/samples/archive">历史复核原表 ↗</a></p>${source}
      <div class="bk-card bk-register bk-all-register">${controls}${bedGuide(d,beds)}
      ${u.bed||u.batch?note("这里显示所选考场或批次的成绩。") : ""}
      <p id="bk-all-count" aria-live="polite">显示 ${count(matches.length)} / ${count(items.size)} 个配方 · ${count(records)} / ${count(total)} 条评估${u.order==="score"&&scoreBed?" · 按 "+esc(scoreBed)+" 排序":""}</p>
      <div id="bk-all-matrix">${rows.length?grid("T1 全部样本成绩",heads,rows,"bk-matrix bk-all-table"+(compact?" bk-sample-summary":" bk-freeze")):'<p class="bk-empty">没有匹配的样本。请更换关键词或清除筛选。</p>'}</div>
      ${pagination}${!compact&&displayedBeds.length>3?'<p class="bk-note bk-swipe">横向滑动查看其余考场，配方编号留在左侧。</p>':""}</div>`;
  }

  function detail(s,id){
    const m=models(s), item=m.matches.find(r=>r.id===id);
    return item?detailFor(m.d,item,m.beds):"";
  }

  window.VEMT1Samples={render,detail};
})();
