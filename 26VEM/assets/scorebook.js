/* Render VEM T1 evidence from one accepted review and its case register. */
(() => {
  "use strict";
  const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const num=(n,places=2)=>Number.isFinite(n)?(Math.abs(n)<0.5/10**places?0:n).toFixed(places):"—";
  const signed=(n,places=2)=>Number.isFinite(n)?(n>=0.5/10**places?"+":"")+num(n,places):"—";
  const average=a=>a.length?a.reduce((v,n)=>v+n,0)/a.length:null;
  const count=n=>Number(n).toLocaleString("zh-CN");
  const dt=new Intl.DateTimeFormat("zh-CN",{timeZone:"Asia/Shanghai",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",second:"2-digit",hourCycle:"h23"});
  const stamp=x=>x!=null&&Number.isFinite(new Date(x).getTime())?dt.format(new Date(x)):"—";
  const site="#/scorer", feed="https://github.com/Chemit797/Remote-Dashboard/blob/vem-scorer-feed/progress.json";
  const sections={methods:"基线对照",samples:"样本记录",activity:"进行中",pipeline:"评估管线",validation:"交叉验证",metrics:"分数怎么读",issues:"采集时进度"};
  const states={valid:"有分",na:"缺分",failed:"失败"};
  const jobs={running:"运行中",waiting:"等待排程",succeeded:"已完成",failed:"失败",cancelled:"已取消",interrupted:"已中断",unknown:"待核实"};
  const causes={permission:"测试规则不允许使用所需的历史数据",coverage:"两个参考阶段没有覆盖所需的细胞类别",compartments:"有足够观测的细胞类别不足两类",paired_prior:"缺少规则允许的一对参考阶段",visible_days:"可见阶段不足两个",tolerance:"数值检查超出容差",check_failed:"评估校验失败",other:"原记录未归入上述类别"};
  const groups={reference:"参照",proportion:"细胞比例",expression:"类型内表达",dispersion:"表达离散度",combination:"组合",other:"其他"};
  const rounds={single:"首轮单配方",repair:"补齐技术种子",replay:"修正考场与配方",combo:"预登记组合"};
  const categories={K_change:"类型内表达",K_comp:"细胞比例",K_disp:"表达离散度"};
  const metricInfo=[["DES","差异基因","预测上调、下调的基因名单与答案重合多少？",25,"高"],["DCS","变化排序","按变化幅度给基因排序，能否还原真实次序？",25,"高"],["MMD","细胞群分布","预测的整群细胞在表达空间里离真实细胞群有多远？",30,"低"],["CSS","基因间结构","哪些基因一起变化，这种关系与真实细胞相差多少？",20,"低"]];
  const mainBeds=["T1-OFF-1D-EXT","T1-OFF-2D","T1-FENGCD1-2D","T1-QIUPOOL-2D","T1-TOMEHEART-2D"];
  const fmtStage=v=>"E"+v;
  const tag=(label,tone="")=>`<span class="bk-tag ${tone}">${esc(label)}</span>`;
  const link=(id,params={})=>{const p=new URLSearchParams(params);return site+"/samples/"+encodeURIComponent(id)+(p.size?"?"+p:"");};
  const sub=(s)=>`<small>${s}</small>`, col=(s)=>`<th scope="col">${s}</th>`;
  function grid(label,heads,rows,cls="") {
    return `<div class="bk-scroll" tabindex="0" aria-label="${esc(label)}"><table class="bk-table ${cls}"><caption class="bk-sr">${esc(label)}</caption><thead><tr>${heads.map(col).join("")}</tr></thead><tbody>${rows.join("")}</tbody></table></div>`;
  }
  const row=(name,values,attrs="",labels=[])=>`<tr ${attrs}><th scope="row">${name}</th>${values.map((v,i)=>`<td${labels[i]?' data-label="'+esc(labels[i])+'"':""}>${v}</td>`).join("")}</tr>`;
  const box=(title,body)=>`<div class="bk-card"><h3>${title}</h3>${body}</div>`;
  const lead=(s)=>`<p class="bk-lead">${s}</p>`, note=(s)=>`<p class="bk-note">${s}</p>`;
  function source(s,id) { return s.samples.beds[id]?.source || (id==="T1-TEST"?"官方 T1 RNA":id); }
  function examTitle(s,id) {
    const b=s.samples.beds[id];
    if(!b)return esc(source(s,id));
    const spec=id.includes("QIUSINGLE")?"单重复对照":id.includes("QIUPOOL")?"合并样本":b.subset;
    const title=id.startsWith("T1-OFF-")?"官方 · 向后"+(b.span==="2D"?"两天":"一天"):source(s,id);
    return esc(title)+sub(esc([fmtStage(b.last)+" → "+fmtStage(b.target),spec,id.endsWith("-EXT")?"可用指定外部参考":""].filter(Boolean).join(" · ")));
  }
  function slice(rec,bed,seed="") {return rec.cases.filter(c=>c.bed===bed&&(seed===""||c.seed===Number(seed)));}
  function stat(cases) {
    const ok=cases.filter(c=>c.status==="valid"&&Number.isFinite(c.total));
    return {n:cases.length,ok:ok.length,not:cases.filter(c=>c.status==="na").length,failed:cases.filter(c=>c.status==="failed").length,
      score:average(ok.map(c=>c.total)),delta:average(ok.map(c=>c.delta).filter(Number.isFinite)),
      skills:metricInfo.map((_,i)=>average(ok.map(c=>c.skills?.[i]).filter(Number.isFinite)))};
  }
  function cell(a,mode="scores") {
    if(!a.n)return '<span class="bk-dim">未登记</span>';
    if(!a.ok)return a.failed?tag("失败","bad"):tag("NA","neutral");
    return `<b>${mode==="delta"?signed(a.delta):num(a.score)}</b><small class="${a.delta>.005?"bk-up":a.delta<-.005?"bk-down":""}">${mode==="delta"?"总分 "+num(a.score):"Δ "+signed(a.delta)}</small>${a.ok<a.n?sub(a.ok+"/"+a.n+" 有分"):""}`;
  }
  function chosen(s,id){const b=s.board;return id===b.steady?"稳候选建议":id===b.bold?"搏候选建议":id==="S00"?"复制基线":"";}
  function baselines(s) {
    const items=s.samples.recipes.filter(r=>["S00","S01","S02","S03"].includes(r.id));
    const data=items.map(r=>{
      const h=s.board.history.find(v=>v.recipe===r.id);
      return row(`<a href="${link(r.id)}">${esc(r.id)} · ${esc(r.name)}</a>`,
        [h?`<b>${num(h.receipt)}</b>${sub(esc(h.original)+" 历史原件")}`:"—",h?num(h.archive,6):"—",h?num(h.adapted):"—",
         ...mainBeds.map(id=>cell(stat(slice(r,id))))],`data-baseline="${r.id}"`);
    });
    return lead("先看复制、归一化和两种历史方法。左边核对历史原件，右边比较本轮同一考场的五个种子均分。")+
      box("历史回执和本轮模拟考能对上什么？",grid("基线对照",["配方","历史原件"+sub("官方验证分"),"原件复算"+sub("种子 0"),"历史适配版"+sub("五种子均分"),...mainBeds.map(id=>examTitle(s,id))],data,"bk-freeze")+
        note("M08、M15 是历史原件，S02、S03 是本轮改写。官方列只属于历史原件；同一行不代表上传的是本轮预测。每格的 Δ 是同一考场、同一种子相对 S00 的平均分差。NA 不当作零分。"))+
      '<div id="bk-signal"></div>';
  }
  function signal(s, id) {
    const rec=s.samples.recipes.find(r=>r.id===id)||s.samples.recipes[0];
    const usable=mainBeds.slice(1).map(b=>({b,st:stat(slice(rec,b))}));
    const m=Math.max(1,...usable.map(x=>Math.abs(x.st.delta||0)));
    return `<div class="bk-signal"><div><h3>换一个考场，还能赢过复制吗？</h3>
      <p>四个两天考场，各自与复制基线 S00 比。中线为 0 分，向右是进步，向左是退步；NA 表示没有可比的分数。</p>
      <label>对照配方 <select data-signal aria-label="对照配方">${s.samples.recipes.map(r=>`<option value="${r.id}" ${r.id===rec.id?"selected":""}>${r.id} · ${esc(r.name)}</option>`).join("")}</select></label></div>
      <div class="bk-bars">${usable.map(({b,st})=>`<div class="bk-bar-row"><span>${esc(source(s,b))}</span><div class="bk-track"><i class="${st.delta<0?"negative":"positive"}" style="width:${Math.abs(st.delta||0)/m*47}%"></i></div><b>${st.ok?signed(st.delta):"NA"}</b></div>`).join("")}</div>
      <p class="bk-readout"><b>${esc(rec.id)}，结果怎么读：</b>${usable.filter(x=>x.st.delta>0).length} 场高于复制，${usable.filter(x=>x.st.delta<0).length} 场低于复制，${usable.filter(x=>!x.st.ok).length} 场缺分。<a href="${link(rec.id)}">核对这个配方的成绩 ↗</a></p></div>`;
  }
  const jobName=id=>{const t=id.split("-").slice(3).join("-");const n={"fix-combo01":"组合配方复核","fix-fullqc01":"全部考场的质量核对","fix-replay01":"首轮多种子补评","fix-2d01":"两天考场修正","fix-1d01":"一天考场修正","combopanel01":"原定组合批次","seedreview01":"原定补评与审阅"};return n[t]||t;};
  function activity(s) {
    const b=s.board, active=b.jobs.filter(j=>j.status==="running"||j.status==="waiting");
    const day=stamp(s.collected_at).split(" ")[0],today=b.batches.filter(x=>stamp(x.at).split(" ")[0]===day);
    const ended=b.jobs.filter(j=>j.at&&!["waiting","running"].includes(j.status)).sort((a,b)=>Date.parse(b.at)-Date.parse(a.at));
    const jobsList=arr=>arr.length?`<ul class="bk-lines">${arr.map(j=>`<li><b>${esc(jobName(j.id))}</b> <span>${esc(jobs[j.status])} · ${stamp(j.at)}</span></li>`).join("")}</ul>`:"<p>采集时没有正在运行或等待排程的评分作业。</p>";
    return lead("按北京时间列出评分器登记的作业。验收时间和网页采集时间分别显示。")+
      `<div class="bk-three">${box("今天验收",`<strong class="bk-num">${today.length}<small> 批</small></strong><p>计入当前复核 ${count(today.reduce((n,x)=>n+x.kept,0))} 条评估</p>`)}
      ${box("运行与排程",jobsList(active))}${box("最近结束",jobsList(ended.slice(0,3)))}</div>
      <details class="bk-disclosure"><summary>全部登记作业（含取消和中断） · ${b.jobs.length} 项</summary>
      ${grid("作业记录",["作业","采集时状态","最近记录（北京）","已登记排程（北京）"],[...b.jobs].sort((a,c)=>(Date.parse(c.at)||0)-(Date.parse(a.at)||0)).map(j=>row(esc(jobName(j.id))+sub(esc(j.id)),[esc(jobs[j.status]),stamp(j.at),j.status==="waiting"?stamp(j.due):"—"])))}</details>`;
  }
  function pipeline(s) {
    const b=s.board;
    const lines=Object.entries(rounds).map(([id,name])=>{
      const batch=b.batches.filter(x=>x.group===id),total=f=>batch.reduce((n,x)=>n+x[f],0);
      return row(esc(name),[String(batch.length),String(batch.filter(x=>x.sealed).length),String(batch.filter(x=>x.at).length),
        count(total("raw")),`<b>${count(total("kept"))}</b>`]);
    });
    const candidates=[b.steady,b.bold,"S00"].map(id=>{const r=s.samples.recipes.find(v=>v.id===id),st=stat(r.cases),m=b.methods[id];
      return row(`<a href="${link(id)}">${esc(id)} · ${esc(r.name)}</a>`,[esc(m.parent||"—"),st.ok+" / "+st.n,
        tag(chosen(s,id),id==="S00"?"neutral":"visible"),b.frozen?"本轮有冻结回执":"本轮尚未冻结"]);});
    return lead("预测先封存，随后评分和回归核对；修正批次会替换同一配方、考场和种子的旧结果。")+
      box("从开发评估到最终候选",grid("候选流程",["配方","父配方","有分 / 已验收","本轮复核建议","候选冻结"],candidates)+
        note("这里列出复核建议和复制对照。已验收是指开发评估有回执；最终 E12.5 没有公开真值。"))+
      box("每一轮走到了哪一步",grid("评估管线",["评估轮次","批数","有封存时间","通过验收","批次原始行","复核采用行"],lines)+
        note(`原始 ${count(b.original)} 行 → 当前复核 ${count(s.cells)} 行。${count(b.original-s.cells)} 行保留在历史批次中，未重复计入。${b.frozen?"已有匹配的冻结回执。":"复核已出，等待候选确认。"}`))+
      `<details class="bk-disclosure"><summary>逐批核对封存时间、验收时间和回执 · ${b.batches.length} 批</summary>${grid("逐批回执",["批次","封存（北京）","验收（北京）","原始 / 采用","验收 SHA256"],b.batches.map(x=>row(esc(x.id),[stamp(x.sealed),stamp(x.at),x.raw+" / "+x.kept,`<code>${esc(x.sha)}</code>`])))}</details>`;
  }
  function examUse(s,x) {
    if(x.id==="T1-TEST")return "最终 E12.5 预测；无公开答案，不计开发分";
    if(x.control)return "对照考场；用于检查取材、重复或品系的影响";
    if(x.id.includes("-1DL"))return "较晚的一天；核对结论能否跨阶段复现";
    if(s.board.weights.some(w=>x.id===w.bed))return "两天主考场；按方法类别使用预先锁定的权重";
    if(x.id.includes("-OFF-2D"))return x.id.endsWith("EXT")?"允许外部参考的补充两天考场":"官方两天对照；开发时已使用的比较单列";
    if(x.id==="T1-OFF-1D-EXT")return "官方一天参照；用于定权和历史对账";
    if(s.board.weights.some(w=>x.id===w.calibration))return "一天主考场；与官方一天比较以确定来源权重";
    if(!x.id.includes("-OFF-"))return "补充考场；单列观察";
    return "官方一天开发对照";
  }
  function validation(s) {
    const b=s.board,es=[...b.exams].sort((a,b)=>Number(a.id==="T1-TEST")-Number(b.id==="T1-TEST"));
    const stages=[...new Set(es.flatMap(x=>[...x.visible,x.target]))].sort((a,b)=>a-b);
    const guide=[["留出答案","用官方 E8.5 预测 E10.5。方法看不到 E10.5 的真实表达。"],["给可读数据","本例只发 E8.5。EXT 版本可额外读取该考场允许的外部参考。"],["交预测","方法生成目标胚龄的细胞表达矩阵。封存后再交给评分器。"],["核对答案","分别对方法和复制基线打分；同一考场、同一种子相减，再跨种子汇总。"]];
    const rows=es.map(x=>row(esc(source(s,x.id))+sub(esc(x.id)),[...stages.map(v=>x.visible.includes(v)?tag("可见","visible"):
      v===x.target?(x.id==="T1-TEST"?tag("未知","unseen"):tag("答案","answer")):'<span class="bk-dim">—</span>'),
      x.prior_count?`清单内 ${x.prior_count} 项${sub("外部禁区 ("+x.exclusion.map(fmtStage).join(", ")+"]")}`:"不允许", esc(examUse(s,x))],`data-exam="${x.id}"`));
    const weights=b.weights.map(w=>row(esc(source(s,w.bed)),w.weights.map(v=>String(v))));
    const cv=b.cv.map(c=>row(categories[c.kind],[c.held[0],c.held[1],c.held[2],c.held[1]?num(100*c.held[2]/c.held[1],1)+"%":"—",
      c.transfer[1]?c.transfer[2]+" / "+c.transfer[1]+" 判对":"未判出"]));
    const folds=b.cv.flatMap(c=>c.folds.map(f=>row(categories[c.kind],[esc(source(s,f.bed)),...f.counts,
      esc(f.pick)+" → "+esc(f.best),num(f.loss)])));
    return lead("这里有两种检验：先把一个胚龄藏起来评预测，再把一个来源的两天结果留出，检查用其他来源作出的判断是否可靠。")+
      box("一场怎么考 · 官方的两天预测",`<ol class="bk-steps">${guide.map(([h,p],i)=>`<li><small>第 ${i+1} 步</small><b>${h}</b><p>${p}</p></li>`).join("")}</ol>`)+
      box("逐个考场：能看什么、答案在哪、分数怎么用",
        note("横轴是胚龄，E8.5 表示胚胎第 8.5 天。1D / 2D 是从最后可见阶段向后预测 1 / 2 天，1DL 是较晚阶段的一天。破折号表示本场没有使用这一帧。")+
        grid("考场与胚龄矩阵",["来源与考场",...stages.map(fmtStage),"外部参考","分数用途"],rows,"bk-freeze bk-exams"))+
      `<div class="bk-two">${box("哪些来源计票？",grid("三类方法的来源权重",["两天主考场","类型内表达","细胞比例","离散度"],weights)+note("0 表示只观察，0.5 为半票，1 为一票。共用阶段和同源对照不当作独立证据。"))}
      ${box("留一来源后，判断有多可靠？",grid("留一来源验证",["方法类别","可判断的配对","实际作出判断","其中判对","判出准确率","官 1D → 2D"],cv)+note("只留出该来源的两天结果；同来源一天数据参与过定权。没有作出判断时不报准确率。"))}</div>
      <details class="bk-disclosure"><summary>逐来源复盘：其他考场选的配方，在留出的考场是不是第一？</summary>
      ${grid("逐来源验证",["方法类别","留出的两天考场","可判断的配对","实际作出判断","其中判对","预测第一 → 实际第一","两者分差"],folds)}
      ${note("每次先用其余来源作出选择，再揭开留出来源的答案；分差是所选配方落后该场最佳配方的分数。")}</details>`;
  }
  function metrics(s) {
    const r=s.samples.recipes.find(r=>r.id==="S32"),base=s.samples.recipes.find(r=>r.id==="S00");
    const a=r&&slice(r,"T1-OFF-2D","0")[0],orig=base&&slice(base,"T1-OFF-2D","0")[0];
    return lead("四项先按本考场的锚点换到同一刻度，再加权得到开发总分。不同考场的锚点不同。")+
      box("分数刻度 · 0 到 100",`<div class="bk-ruler"><span>0<small>接近下限</small></span><span>50<small>参考下锚点</small></span><span>100<small>参考上锚点</small></span></div>`+
        (a&&orig?`<p><a href="${link("S32",{bed:"T1-OFF-2D",seed:0})}">实测例子：S32 · 官方 E8.5 → E10.5 · 种子 0</a>。S32 <b>${num(a.total)}</b>，同条件复制 S00 <b>${num(orig.total)}</b>，相差 <b>${signed(a.delta)}</b> 分。实际复制配方和计算尺度用的参考样本可以不同。</p>`:"")+
        `<div class="bk-four">${metricInfo.map(([k,name,desc,weight,direction],i)=>`<div><small>${k} · 权重 ${weight}%</small><b>${name}</b><p>${desc}</p><small>原始值越${direction}越好${a?" · 本例换算 "+num(a.skills[i]):""}</small></div>`).join("")}</div>`+
        (a?note("本例总分 = "+a.skills.map((v,i)=>num(v)+" × "+metricInfo[i][3]+"%").join(" + ")+" ≈ "+num(a.total)+"。网站保留原始精度计算，显示取两位小数。"):""))+
      box("怎样用分数选择方法？","<p>先分别计算同考场、同种子相对 S00 的分差。五个种子齐全时，判别带取 0.2 分和配对差样本标准差两倍中的较大值；有有效配对但不足五个时取 0.5 分。只有分差超出判别带，该考场才投方向票。</p>"+note("复核按方法类别给来源加权。支持某一方的净票数至少为 2，且没有权重至少 0.5 的反向票，才判出方向。E12.5 无公开真值；最终成绩由比赛方评定。"));
  }
  function progress(s) {
    const b=s.board;
    return lead("截至这次采集，已验收的评估按结果计数。缺分和失败都保留；每条都能回到对应方法和考场。")+
      `<div class="bk-totals">${[[s.cells,"复核采用"],[s.valid,"算出分数"],[s.na,"不适用或缺分"],[s.failed,"评估失败"]].map(([v,l])=>`<div><small>${l}</small><b>${count(v)}</b></div>`).join("")}</div>`+
      `<div class="bk-two">${box("缺分和失败",grid("缺分原因",["原因","次数"],Object.entries(s.operations.issues).filter(([,n])=>n).map(([k,n])=>row(esc(causes[k]),[count(n)])))+
          note(`<a href="${site}/samples?status=na">看缺分记录</a> · <a href="${site}/samples?status=failed">看 ${s.failed} 条失败记录</a>`))}
      ${box("数据从哪里来？",`<p>评分器 v3.1 复核 · 床包 ${esc(b.release)} · ${b.batches.length} 批通过验收和 D150 原件回归。</p>
      <p>复核生成：${stamp(b.at)}（北京）</p><details><summary>查看校验值</summary><dl>${[["复核",b.review],["主表",b.master],["考场登记",b.registry]].map(([k,v])=>`<dt>${k}</dt><dd><code>${esc(v)}</code></dd>`).join("")}</dl></details>
      <a href="${feed}">查看公开数据快照 ↗</a>`)}</div>`;
  }
  window.VEMBook={esc,num,signed,average,count,stamp,site,sections,states,jobs,causes,groups,categories,metricInfo,mainBeds,tag,link,sub,col,row,box,grid,note,lead,source,examTitle,slice,stat,cell,chosen,baselines,signal,activity,pipeline,validation,metrics,progress};
})();
