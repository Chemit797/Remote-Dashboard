/* Shared file/Pages/live controller for the VEM T1 scorebook. */
(() => {
  "use strict";
  const {esc,num,signed,average,count,stamp,site,sections,states,jobs,causes,groups,metricInfo,mainBeds,tag,link,sub,col,row,box,grid,note,lead,source,examTitle,slice,stat,cell,chosen}=window.VEMBook, book=window.VEMBook;
  const live=!!document.querySelector('meta[name="vem-scorer-live"]'), file=location.protocol==="file:";
  const rawURL="https://raw.githubusercontent.com/Chemit797/Remote-Dashboard/vem-scorer-feed/progress.json";
  const apiURL="https://api.github.com/repos/Chemit797/Remote-Dashboard/contents/progress.json?ref=vem-scorer-feed";
  const cache="26vem-v31-scorebook-1", perPage=10;
  const deadline=Date.parse("2026-11-26T19:59:00+08:00");
  let current;
  const $=(s,sel)=>s.root.querySelector(sel);
  function shell() {
    return `<article class="scorebook" id="scorer-board"><header class="bk-header">
      <div><span class="bk-kicker">VIRTUAL EMBRYO &nbsp;/&nbsp; T1</span><h1>时间外推评分看板</h1></div>
      <div class="bk-actions">${file?'<a class="btn" href="http://127.0.0.1:18765/#/scorer">5090 实时看板 ↗</a>':""}<button class="btn" type="button" data-refresh>检查更新</button></div></header>
      <div class="bk-status"><span id="bk-fresh" role="status">正在读取评分快照…</span><a id="bk-coverage" href="${site}/samples"></a><span id="bk-deadline"></span><span id="bk-decision"></span></div>
      <p class="bk-intro">用已知胚龄模拟一次预测：把晚期细胞表达藏起来，看哪种方法比直接复制早期数据更准。下面都是本地开发分，历史原件的官网回执单独列出。</p>
      <nav class="bk-nav" aria-label="评分看板栏目"><span>跳到</span>${Object.entries(sections).map(([k,l],i)=>`<a href="${site}/${k}" data-jump="${k}"><small>0${i+1}</small> ${l}</a>`).join("")}</nav>
      <div id="bk-content" aria-busy="true">正在载入成绩和考场…</div></article>`;
  }
  function check(data){
    if(!data||!data.board||data.board.version!==1||data.samples?.mode!=="full"||!Number.isFinite(Date.parse(data.collected_at)))
      throw Error("快照缺少复核表");
    const reg=data.samples,b=data.board;
    if(reg.recipes.length!==data.operations.methods||b.exams.length!==data.beds||b.batches.reduce((n,x)=>n+x.kept,0)!==data.cells)throw Error("复核范围不一致");
    const seen=new Set(), tall={valid:0,na:0,failed:0};
    for(const r of reg.recipes){
      if(!/^S\d+$/.test(r.id)||!Object.hasOwn(b.methods,r.id))throw Error("找不到配方登记");
      for(const c of r.cases){
        const k=r.id+"/"+c.bed+"/"+c.seed;
        if(seen.has(k)||!Object.hasOwn(tall,c.status)||!Object.hasOwn(reg.beds,c.bed)||!Object.hasOwn(reg.batches,c.batch)||
          !Number.isInteger(c.seed)||c.seed<0||c.skills?.length!==4||c.raw?.length!==4||
          (c.status==="valid"&&(!Number.isFinite(c.total)||!c.skills.every(Number.isFinite))))throw Error("样本明细不一致");
        seen.add(k);tall[c.status]++;
      }
    }
    if(seen.size!==data.cells||Object.keys(tall).some(k=>tall[k]!==data[k]))throw Error("评估次数不一致");
    return data;
  }
  const defaults=()=>({q:"",bed:"",seed:"",status:"",order:"recent",scope:"main",open:new Set(),pages:new Map()});
  function route() {
    const [path,query=""]=location.hash.split("?"),[,base,slug="",id=""]=path.split("/");
    const section=base==="scorer"?(sections[slug]?slug:({baselines:"methods",cv:"validation",progress:"issues",live:"activity"})[slug]||""):"";
    const ui=defaults(),p=new URLSearchParams(query);
    if(section==="samples"){
      ui.q=p.get("q")||"";ui.bed=p.get("bed")||"";
      if(/^[0-9]+$/.test(p.get("seed")??""))ui.seed=p.get("seed");
      if(Object.hasOwn(states,p.get("status")))ui.status=p.get("status");
      if(["id","score"].includes(p.get("order")))ui.order=p.get("order");
      if(["1D","2D","1DL","all","official"].includes(p.get("scope")))ui.scope=p.get("scope");
      for(const k of p.getAll("open"))if(/^S\d+$/.test(k))ui.open.add(k);
      if(/^S\d+$/.test(id)){ui.q=id;ui.open.add(id);}
    }
    return {section,ui};
  }
  function saveRoute(s){
    const u=s.ui,p=new URLSearchParams(),direct=/^S\d+$/.test(u.q)&&u.open.has(u.q)?u.q:"";
    if(u.q&&!direct)p.set("q",u.q);
    for(const key of ["bed","seed","status"])if(u[key])p.set(key,u[key]);
    if(u.scope!=="main")p.set("scope",u.scope);
    if(u.order!=="recent")p.set("order",u.order);
    for(const id of u.open)if(id!==direct)p.append("open",id);
    const url=(direct?link(direct):site+"/samples")+(p.size?"?"+p:"");
    if(location.hash!==url)history.replaceState(history.state,"",url);
    s.section="samples"; mark(s);
  }
  function mark(s){for(const a of s.root.querySelectorAll("[data-jump]"))
    if(a.dataset.jump===s.section)a.setAttribute("aria-current","location");else a.removeAttribute("aria-current");}
  function jump(s){
    mark(s);
    if(!s.data)return;
    const target=s.section?$(s,"#bk-"+s.section):s.root;
    if(target)requestAnimationFrame(()=>{if(current!==s)return;
      if(!s.section&&s.root.closest("#scorer-panel")){window.scrollTo({top:0,behavior:"instant"});return;}
      if(s.section==="samples"&&s.ui.open.size){const id=[...s.ui.open][0],row=$(s,'tr[data-recipe="'+id+'"]'),pane=$(s,"#bk-matrix>.bk-scroll");
        if(row&&pane)pane.scrollTop+=row.getBoundingClientRect().top-pane.getBoundingClientRect().top-(pane.querySelector("thead")?.offsetHeight||0)-1;}
      target.scrollIntoView({block:"start",behavior:"instant"});});
  }
  function navigate(){if(!current)return;const s=current,{section,ui}=route();s.section=section;s.ui=ui;
    if(s.data)drawSampleShell(s);jump(s);}
  const option=(v,l,val)=>`<option value="${esc(v)}" ${String(v)===val?"selected":""}>${esc(l)}</option>`;
  const field=(label,key,values,sel)=>`<label>${label}<select aria-label="${label}" data-filter="${key}">${values.map(([v,l])=>option(v,l,sel)).join("")}</select></label>`;
  function drawSampleShell(s){
    const u=s.ui, reg=s.data.samples;
    $(s,"[data-section-body=samples]").innerHTML=lead("这里的“样本”是一次参评的方法配方。每行一个配方，每列一个考场。大字是种子平均总分，Δ 是比同场、同种子复制基线 S00 高或低多少分。点击配方编号可查每个种子的原始记录。")+
      `<div class="bk-card bk-register"><div class="bk-tools"><label>搜索样本<input type="search" aria-label="搜索样本" placeholder="配方、名称、数据来源" value="${esc(u.q)}" data-search></label>
      ${field("并排考场","scope",[["main","常看五场"],["official","全部官方考场"],["1D","向后一天"],["2D","向后两天"],["1DL","较晚的一天"],["all","全部有答案考场"]],u.scope)}
      ${field("测试数据","bed",[["","全部测试数据"],...Object.keys(reg.beds).map(k=>[k,k+" · "+source(s.data,k)])],u.bed)}
      ${field("抽样种子","seed",[["","所有种子（均值）"],...[...new Set(reg.recipes.flatMap(r=>r.cases.map(c=>c.seed)))].sort((a,b)=>a-b).map(v=>[v,String(v)])],u.seed)}
      ${field("评估结果","status",[["","全部结果"],...Object.entries(states)],u.status)}
      ${field("排列顺序","order",[["recent","最近验收在前"],["score","所选考场分数 ↓"],["id","配方编号"]],u.order)}
      <button type="button" class="btn" data-clear>清除筛选</button></div><p id="bk-count" aria-live="polite"></p>
      <div id="bk-matrix"></div><p class="bk-note bk-swipe">向右滑看其余考场；最左边的配方编号会留在原位。</p></div>`;
    renderMatrix(s);
  }
  function columns(s) {
    const u=s.ui,beds=s.data.samples.beds;
    if(u.bed&&Object.hasOwn(beds,u.bed))return [u.bed];
    return u.scope==="main"?mainBeds.filter(b=>beds[b]):Object.keys(beds).filter(k=>u.scope==="all"||(u.scope==="official"?k.startsWith("T1-OFF-"):beds[k].span===u.scope));
  }
  function matches(s) {
    const {data:d,ui:u}=s,reg=d.samples, q=u.q.trim().toLowerCase(), list=[];
    for(const r of reg.recipes){
      const name=(r.id+" "+r.name+" "+groups[r.group]+" "+chosen(d,r.id)).toLowerCase();
      const cases=r.cases.filter(c=>(!u.status||c.status===u.status)&&(!u.bed||c.bed===u.bed)&&(u.seed===""||String(c.seed)===u.seed)&&
        (!q||name.includes(q)||(c.bed+" "+source(d,c.bed)+" "+c.batch).toLowerCase().includes(q)));
      if(!cases.length)continue;
      const latest=Math.max(...cases.map(c=>Date.parse(reg.batches[c.batch])||0));
      const compare=columns(s), sortBed=u.bed||(compare.includes("T1-OFF-2D")?"T1-OFF-2D":compare[0]);
      list.push({r,cases,latest,score:stat(cases.filter(c=>c.bed===sortBed)).score});
    }
    return list.sort((a,b)=>(u.order==="recent"&&b.latest-a.latest)||(u.order==="score"&&((b.score??-Infinity)-(a.score??-Infinity)))||a.r.id.localeCompare(b.r.id,"en",{numeric:true}));
  }
  function decision(s,id) {
    const d=s.data.board.methods[id],role=chosen(s.data,id);
    return (role?tag(role,id==="S00"?"neutral":"visible"):"")+
      (d.votes!=null?`<span class="bk-verdict">${d.direction>0?"倾向该配方":d.direction<0?"倾向对照":"分不出"}${sub("比 "+esc(d.versus)+" · "+signed(d.votes,1)+" 票")}</span>`:"");
  }
  function renderMatrix(s) {
    const u=s.ui, d=s.data,beds=columns(s), result=matches(s), total=result.reduce((n,x)=>n+x.cases.length,0),target=$(s,"#bk-matrix");
    s.items=new Map(result.map(x=>[x.r.id,x]));
    $(s,"#bk-count").textContent=`${result.length} 个配方 · ${count(total)} 条评估｜并排显示 ${beds.length} 个考场${u.order==="score"?" · 按 "+(u.bed||(beds.includes("T1-OFF-2D")?"T1-OFF-2D":beds[0]))+" 排序":""}`;
    const heads=["编号 / 配方","类型 / 最近验收",...beds.map(k=>examTitle(d,k)),"有分 / 记录","复核判定"];
    const scroll=target.querySelector(".bk-scroll"),left=scroll?.scrollLeft||0,top=scroll?.scrollTop||0;
    const rows=result.flatMap(({r,cases,latest})=>{
      const id=r.id,open=u.open.has(id),role=groups[r.group]||"其他", n=stat(cases);
      const h=`<button type="button" class="bk-open" aria-label="${esc(open?"收起 ":"展开 ")+esc(id)}" aria-expanded="${open}" aria-controls="bk-detail-${id}" data-open="${id}"><b>${open?"▾":"▸"} ${esc(id)}</b><span>${esc(r.name)}</span></button>`;
      const a=row(h,[esc(role)+sub(stamp(latest).slice(5,16)),...beds.map(b=>cell(stat(cases.filter(c=>c.bed===b)))),
        `${n.ok} / ${n.n}${sub(n.not+" 缺分 · "+n.failed+" 失败")}`,decision(s,id)],`data-recipe="${id}" class="${open?"open":""}"`);
      return open?[a,`<tr class="bk-detail-row"><td colspan="${heads.length}"><div id="bk-detail-${id}" class="bk-detail" data-detail="${id}">${detail(s,r,cases)}</div></td></tr>`]:[a];
    });
    target.innerHTML=result.length?grid("样本成绩横向比较",heads,rows,"bk-matrix bk-freeze"):'<p class="bk-empty">没有匹配的样本记录。请更换关键词或清除筛选。</p>';
    const next=target.querySelector(".bk-scroll");if(next){next.scrollLeft=left;next.scrollTop=top;}
  }
  function detail(s,r,cases){
    const d=s.data,u=s.ui,id=r.id, b=d.board, same=columns(s).filter(bed=>cases.some(c=>c.bed===bed));
    const byBed=new Map();for(const c of cases){if(!byBed.has(c.bed))byBed.set(c.bed,[]);byBed.get(c.bed).push(c);}
    const used=same.map(k=>stat(byBed.get(k)));
    const matrix=grid(id+" 各考场分项",["换算分",...same.map(k=>examTitle(d,k))],
      ["总分",...metricInfo.map(x=>x[0])].map((key,i)=>row(key,used.map(st=>num(i?st.skills[i-1]:st.score)))));
    const order=["T1-OFF-2D",...mainBeds,...Object.keys(d.samples.beds)];
    const seq=[...cases].sort((a,b)=>order.indexOf(a.bed)-order.indexOf(b.bed)||a.seed-b.seed);
    const page=Math.min(u.pages.get(id)||0,Math.ceil(seq.length/perPage)-1),start=page*perPage;
    const caseRows=seq.slice(start,start+perPage).map(c=>row(examTitle(d,c.bed)+sub(esc(c.bed)),[c.seed,tag(states[c.status],c.status==="valid"?"visible":c.status==="failed"?"bad":"neutral"),
      num(c.total),signed(c.delta),...c.skills.map((v,i)=>num(v)+sub(c.raw[i]==null?"—":num(c.raw[i],5))),
      esc(c.cause?causes[c.cause]||"评估校验失败":"—"),esc(c.batch)+sub(stamp(d.samples.batches[c.batch]))],`data-bed="${c.bed}" data-seed="${c.seed}"`,
      ["种子","结果","开发总分","比 S00",...metricInfo.map(m=>m[0]),"原因","批次 / 验收"]));
    const pages=seq.length>perPage?`<div class="bk-pages"><button type="button" class="btn" data-page-for="${id}" data-case-page="${page-1}" ${page?"":"disabled"}>上一页</button><span>第 ${start+1}–${Math.min(start+perPage,seq.length)} 条 / ${seq.length}</span><button type="button" class="btn" data-page-for="${id}" data-case-page="${page+1}" ${start+perPage<seq.length?"":"disabled"}>下一页</button></div>`:"";
    const filter=Object.fromEntries(["bed","seed","status","scope"].filter(k=>u[k]!==""&&(k!=="scope"||u.scope!=="main")).map(k=>[k,u[k]]));
    const components="<h5>考场 × 四项分数</h5>"+matrix;
    const individual="<h5>逐个种子核对</h5>"+note("每个分项上方是换算分，下方是原始指标值。NA 和失败均保留为空分。")+
      grid(id+" 逐种子评估",["测试数据","种子","结果","开发总分","比 S00",...metricInfo.map(m=>m[0]+"<small>换算 / 原始</small>"),"原因","批次 / 验收（北京）"],caseRows,"bk-cases")+pages;
    return `<div class="bk-detail-head"><h4>${id} · ${esc(r.name)}</h4><a href="${esc(link(id,filter))}">这条记录的链接 ↗</a></div>
      <p>父配方：${b.methods[id].parent?esc(b.methods[id].parent):"无（复制基线）"}　${decision(s,id)}</p>${u.seed!==""?individual+components:components+individual}`;
  }
  function privateEvidence(s){
    const p=s.payload;
    if(!p?.history)return "";
    const list=[...p.history.items].sort((a,b)=>(b.score??-1)-(a.score??-1));
    return `<details class="bk-disclosure"><summary>5090 · 历史官方验证登记（${list.length} 条）</summary>${note("索引采集于 "+stamp(p.history.as_of)+"。独立上传分别保留，内部记录号不等于官方 ID。")}
      ${grid("历史官方验证登记",["登记文件","官网分","记录状态","上传字节身份","内部记录号"],list.map(x=>row(esc(x.file),[num(x.score),esc(x.state),x.exact?"已核实":"未核实",esc(x.id)])))}</details>`;
  }
  function overview(s){
    const d=s.data,b=d.board;
    $(s,"#bk-coverage").textContent=`${d.operations.methods} 个配方 · ${d.scored_beds} 个有答案考场 · ${count(d.cells)} 条样本记录 ↗`;
    $(s,"#bk-decision").textContent=`复核${b.frozen?"已冻结":"待确认"} · ${b.steady}（稳） / ${b.bold}（搏）`;
    const html={methods:book.baselines(d)+privateEvidence(s),samples:"",activity:book.activity(d),pipeline:book.pipeline(d),validation:book.validation(d),metrics:book.metrics(d),issues:book.progress(d)};
    const content=$(s,"#bk-content"), prior=new Set([...content.querySelectorAll("details[open]")].map(x=>x.querySelector("summary")?.textContent));
    content.innerHTML=Object.entries(sections).map(([k,l],i)=>`<section class="bk-section" id="bk-${k}" aria-labelledby="bk-title-${k}">
      <header class="bk-section-head"><span>0${i+1}</span><h2 id="bk-title-${k}">${l}</h2></header><div data-section-body="${k}">${html[k]}</div></section>`).join("");
    for(const el of content.querySelectorAll("details"))if(prior.has(el.querySelector("summary")?.textContent))el.open=true;
    $(s,"#bk-signal").innerHTML=book.signal(d,s.signalId);
    drawSampleShell(s);content.setAttribute("aria-busy","false");
  }
  function fresh(s){
    const x=$(s,"#bk-fresh"),d=s.data;
    if(!d){x.textContent=s.error?"未取得可验证的复核快照。请再检查更新。":"正在读取评分快照…";return;}
    const mins=Math.max(0,Math.floor((Date.now()-Date.parse(d.collected_at))/60000));
    const stale=mins>(live?1:35);x.classList.toggle("stale",stale||s.error);
    x.textContent=`${s.error?s.source+"（更新未连接）":s.source} · ${stamp(d.collected_at)}（北京时间） · ${stale?"已过期 "+mins+" 分钟":live?"15 秒检查":"每 15 分钟发布"}`;
    const minutes=Math.ceil((deadline-Date.now())/60000),days=Math.floor(minutes/1440),hours=Math.floor((minutes%1440)/60);
    $(s,"#bk-deadline").textContent=(minutes>0?`距截止 ${days} 天 ${hours} 小时`:"已过截止时间")+" · 11/26 19:59 北京";
  }
  function show(s,data,source,payload=null){
    check(data);
    if(s.data&&Date.parse(data.collected_at)<Date.parse(s.data.collected_at))return;
    const old=s.data;s.data=data;s.source=source;if(payload)s.payload=payload;
    const key=JSON.stringify([data.board.review,data.board.frozen,data.board.jobs,data.cells,data.samples.batches,data.board.master,payload?.history?.as_of]);
    if(s.key!==key){
      const focus=document.activeElement,wasSearch=focus?.hasAttribute("data-search"),selection=wasSearch?[focus.selectionStart,focus.selectionEnd]:null;
      const scroll=$(s,"#bk-matrix .bk-scroll"),xy=scroll?[scroll.scrollLeft,scroll.scrollTop]:null;
      overview(s);s.key=key;
      if(wasSearch){const search=$(s,"[data-search]");search.focus({preventScroll:true});search.setSelectionRange(...selection);}
      if(xy){const next=$(s,"#bk-matrix .bk-scroll");if(next){next.scrollLeft=xy[0];next.scrollTop=xy[1];}}
    }
    fresh(s);if(!old)jump(s);
  }
  async function refresh(s){
    if(s.busy||s!==current)return;
    s.busy=true;const button=$(s,"[data-refresh]");button.disabled=true;
    const load=async(url,api=false)=>{const response=await fetch(url,{cache:"no-store",credentials:"omit",referrerPolicy:"no-referrer",
      signal:AbortSignal.any([s.abort.signal,AbortSignal.timeout(live?20000:9000)]),headers:api?{Accept:"application/vnd.github.raw+json"}:{}});
      if(!response.ok)throw Error(String(response.status));return response.json();};
    try{
      let p,d;if(live){p=await load("/api/live");if(p.collection_error)throw Error("采集失败");d=check(p.summary);}
      else {const tag=String(Math.floor(Date.now()/60000));try{d=check(await load(rawURL+"?t="+tag));}
        catch(e){if(s.abort.signal.aborted)return;d=check(await load(apiURL+"&t="+tag,true));}}
      if(s!==current)return;s.error=false;show(s,d,live?"5090 实时":"GitHub 公开快照",p);
      if(!live)try{localStorage.setItem(cache,JSON.stringify(s.data));}catch(_){}
    }catch(_){if(s===current)s.error=true;}
    finally{if(s===current){s.busy=false;button.disabled=false;fresh(s);}}
  }
  function toggleRow(s,id) {
    const u=s.ui; if(u.open.has(id))u.open.delete(id);else u.open.add(id);
    const ypos=$(s,'[data-open="'+id+'"]')?.getBoundingClientRect().top;
    saveRoute(s);renderMatrix(s);
    const btn=$(s,'[data-open="'+id+'"]');if(btn){
      btn.focus({preventScroll:true});const top=btn.getBoundingClientRect().top;
      if(Number.isFinite(ypos)&&Math.abs(top-ypos)>2)window.scrollBy(0,top-ypos);
    }
  }
  function mount(){
    const root=document.getElementById("scorer-board");if(!root)return;
    const initial=route(), s=current={root,abort:new AbortController(),ui:initial.ui,section:initial.section,signalId:"S32",error:false,busy:false};
    mark(s);
    if(live){
      try{const p=JSON.parse(document.getElementById("sc-initial").textContent);s.error=!!p.collection_error;show(s,p.summary,"5090 实时",p);}catch(_){}
      window.addEventListener("hashchange",navigate,{signal:s.abort.signal});
    }else{
      try{show(s,window.VEMScorerSeed,"随页快照");}catch(_){}
      try{show(s,JSON.parse(localStorage.getItem(cache)),"上次公开快照");}catch(_){}
    }
    root.addEventListener("input",e=>{if(!e.target.matches("[data-search]"))return;s.ui.q=e.target.value;s.ui.pages.clear();saveRoute(s);renderMatrix(s);});
    root.addEventListener("change",e=>{
      if(e.target.matches("[data-signal]")){s.signalId=e.target.value;$(s,"#bk-signal").innerHTML=book.signal(s.data,s.signalId);$(s,"[data-signal]").focus({preventScroll:true});return;}
      const key=e.target.dataset.filter;if(!key)return;s.ui[key]=e.target.value;if(key==="scope"&&s.ui.bed){s.ui.bed="";$(s,'[data-filter="bed"]').value="";}
      s.ui.pages.clear();saveRoute(s);renderMatrix(s);
    });
    root.addEventListener("click",e=>{
      const a=e.target.closest("a[data-jump]");if(a&&a.hash===location.hash){e.preventDefault();jump(s);return;}
      if(e.target.closest("[data-refresh]")){refresh(s);return;}
      if(e.target.closest("[data-clear]")){s.ui=defaults();saveRoute(s);drawSampleShell(s);return;}
      const btn=e.target.closest("button[data-case-page]");if(btn){const id=btn.dataset.pageFor,record=s.items.get(id);
        s.ui.pages.set(id,Number(btn.dataset.casePage));const el=$(s,'[data-detail="'+id+'"]');el.innerHTML=detail(s,record.r,record.cases);
        el.querySelector(".bk-cases")?.closest(".bk-scroll")?.focus({preventScroll:true});return;}
      const tr=e.target.closest("tr[data-recipe]");if(tr&&!e.target.closest("a"))toggleRow(s,tr.dataset.recipe);
    });
    if(!live||!s.data)refresh(s);
    s.tick=setInterval(()=>refresh(s),live?15000:60000);s.age=setInterval(()=>fresh(s),10000);
  }
  function stop(){if(current){current.abort.abort();clearInterval(current.tick);clearInterval(current.age);current=null;}}
  window.VEMScorer={shell,mount,stop,navigate};
})();
