'use strict';
(() => {
const D=window.VEM_DATA, main=document.getElementById('main');
if(!D){main.textContent='研究数据未载入，请刷新页面。';return;}
const E=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const N=(n,d=0)=>n==null||!Number.isFinite(+n)?'—':(+n).toLocaleString('zh-CN',{maximumFractionDigits:d,minimumFractionDigits:d});
const num=n=>n==null?'—':N(n,3), date=s=>s?new Date(s).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai',hour12:false}):'尚无快照';
const taskName=id=>D.tasks.find(x=>x.id===id)?.name||id;
const topics={history:'工程与历史',official:'官方数据',heart:'心脏结构',prior:'先验与观测',transfer:'跨来源比较',metrics:'评分与迁移'};
const state={analysis:{q:'',task:'',topic:''},knowledge:{q:'',task:'',status:'',axis:'official',page:0},external:{q:'',task:''},genes:{q:'',axis:''},neighbour:{q:'',stage:'',type:'',cut:'0.01',only:'hit',page:0},pairs:{q:'',task:'',page:0},metrics:{q:'',representation:'',task:'',page:0}};
let route=[],clockHandle=null,neighbourPromise=null;
const tag=(text,type='neutral')=>`<span class="tag ${E(type)}">${E(text)}</span>`;
const statusTag=s=>tag(s,s==='观测一致'?'good':s==='结果混合'?'mixed':s==='面板未覆盖'?'bad':'neutral');
const badge=(text,type='')=>`<span class="badge ${type}">${E(text)}</span>`;
const stats=items=>`<div class="stats">${items.map(([l,v,n])=>`<div class="stat"><div class="stat-label">${E(l)}</div><div class="stat-value">${v}</div><div class="stat-note">${E(n)}</div></div>`).join('')}</div>`;
const head=(k,t,desc='')=>`<div class="page-head"><div class="kicker">${E(k)}</div><h1>${E(t)}</h1><p class="sub">${E(desc)}</p></div>`;
const section=(title,link='',label='查看全部')=>`<div class="section-head"><h2>${E(title)}</h2>${link?`<a href="${E(link)}">${E(label)} ↗</a>`:''}</div>`;
const crumbs=items=>`<div class="breadcrumb"><a href="#/overview">总览</a>${items.map(([text,path])=>`<span>/</span>${path?`<a href="${E(path)}">${E(text)}</a>`:`<span>${E(text)}</span>`}`).join('')}</div>`;
const opts=(values,selected,all='全部')=>`<option value="">${all}</option>`+values.map(x=>{const [v,l]=Array.isArray(x)?x:[x,x];return `<option value="${E(v)}" ${v===selected?'selected':''}>${E(l)}</option>`;}).join('');
const field=(label,id,body,grow=false)=>`<div class="field${grow?' grow':''}"><label for="${id}">${E(label)}</label>${body}</div>`;
const search=(id,value,placeholder)=>`<input type="search" id="${id}" value="${E(value)}" placeholder="${E(placeholder)}" autocomplete="off">`;
const select=(id,values,value,all)=>`<select id="${id}">${opts(values,value,all)}</select>`;
const empty=t=>`<div class="empty">${E(t)}<p class="quiet">可清空搜索或放宽筛选条件。</p></div>`;
const table=(headers,rows,classes=[])=>`<div class="table-wrap"><table><thead><tr>${headers.map((h,i)=>`<th scope="col" class="${classes[i]||''}">${E(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr>${r.map((cell,i)=>`<td class="${classes[i]||''}">${cell}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
const pager=(key,total,page,size)=>`<div class="pagination"><span>共 ${N(total)} 条${total?` · 第 ${page+1} / ${Math.ceil(total/size)} 页`:''}</span><div><button class="btn small" data-page="${key}" data-step="-1" ${page===0?'disabled':''}>上一页</button> <button class="btn small" data-page="${key}" data-step="1" ${(page+1)*size>=total?'disabled':''}>下一页</button></div></div>`;
const chips=(values,key,value,all='全部')=>`<div class="chips"><button class="chip ${!value?'active':''}" data-chip="${key}" data-value="">${all}</button>${values.map(([v,l])=>`<button class="chip ${value===v?'active':''}" data-chip="${key}" data-value="${E(v)}">${E(l)}</button>`).join('')}</div>`;
const readerFor=id=>D.readers.find(r=>r.analysis_id===id);
const analysisCard=a=>{const r=readerFor(a.analysis_id);return `<a class="card analysis-card" href="#/analysis/${a.analysis_id}"><div class="card-number">${a.analysis_id} · ${E(r.group)}</div><h3>${E(r.title)}</h3><p>${E(r.sections.slice(0,3).map(s=>s.title).join(' · '))}</p><span class="quiet">查看原页面 →</span></a>`;};
const taskCard=t=>`<a class="card task-card ${t.kind}" href="#/task/${t.id}"><div class="card-number">${E(t.name)}</div><strong class="task-target">${E(t.target)}</strong><p>${E(t.modality)}</p><span class="quiet">${N(t.genes)} 基因 · 最终目标 ↗</span></a>`;
const sourceBox=a=>`<div class="source-box"><p>证据：${E(a.evidence_status)} · 核对快照 ${D.version}</p>${a.remote_compute_root?`<p>5090 计算根：<code>${E(a.remote_compute_root)}</code></p>`:''}<p>5090阅读入口：<code>${E(a.remote_reader.startsWith('../')?D.remote_root+'/team/'+a.remote_reader.slice(3):D.remote_hub+'/'+a.remote_reader)}</code></p><p>公开页面展示汇总与原文阅读，不会运行5090代码或连接私有文件。</p></div>`;

function countdown(){
 const box=document.getElementById('countdown');if(!box)return;
 const ms=Date.parse(D.deadline.countdown_target)-Date.now();
 if(ms<=0){box.innerHTML='<div class="counter-ended">最终提交已截止</div>';return;}
 let s=Math.floor(ms/1000);const days=Math.floor(s/86400);s%=86400;const hours=Math.floor(s/3600);s%=3600;const mins=Math.floor(s/60);s%=60;
 box.innerHTML=[[days,'天'],[hours,'时'],[mins,'分'],[s,'秒']].map(([v,k])=>`<span><b>${String(v).padStart(2,'0')}</b><small>${k}</small></span>`).join('');
}
function clockCard(){return `<div class="countdown-card"><div class="countdown-label">最终提交截止倒计时</div><div id="countdown" class="countdown" aria-label="距离最终提交截止的时间"></div><p class="deadline">11 月 25 日 23:59 AoE</p><p class="deadline">11 月 26 日 19:59 · 北京时间</p><a href="${D.deadline.source_url}" target="_blank" rel="noopener">官方时间线 ↗ · ${D.version} 核对</a><p class="quiet">日程以官网最新通知为准</p></div>`;}
function overview(){
 const after=Date.now()>=Date.parse(D.deadline.countdown_target);
 return `<section class="hero"><div class="hero-intro"><div class="kicker">Virtual Embryo Challenge ${badge(after?'最终截止已过':'P3 · 最终阶段',after?'amber':'green')}</div><h1>虚拟胚胎比赛与研究</h1><p class="sub">比赛进度、数据概况与已有分析的统一入口。</p><div class="hero-actions"><a class="btn primary" href="#/analysis">进入分析专题 <span>↗</span></a><a class="btn" href="#/plan">查看联合规划</a></div></div>${clockCard()}</section>
 ${stats([['正式目标','4','T1 / T2 胚胎 / T2 心脏 / T3'],['官方数据文件','15','9 份训练/参考 + 6 份开发验证'],['先验知识','108','逐条记录核对条件与缺口'],['共同分析索引','15','历史、官方、外部、心脏与评分']])}
 ${section('四个最终目标','#/data','查看数据阶段轴')}<div class="grid four">${D.tasks.map(taskCard).join('')}</div>
 ${section('比赛时间线')}<div class="panel"><div class="schedule">${D.timeline.map(([d,p,t])=>`<div class="milestone ${p==='P3'?'current':p==='FINAL'?'final':''}"><i aria-hidden="true"></i><small>${E(d)}</small><b>${E(p)}</b><small>${E(t)}</small></div>`).join('')}</div><p class="caption">官方日程核对 ${D.version} · 当前账号成绩与剩余次数未核实，不以默认值填充。</p></div>
 ${section('分析入口','#/analysis')}<div class="grid three">${['A05','A06','A13'].map(id=>analysisCard(D.analyses.find(a=>a.analysis_id===id))).join('')}</div>
 ${section('把分析接到预测')}<div class="panel"><div class="flow">${[['定位缺陷','官方输入与旧预测，具体错在哪里'],['查找证据','哪个来源、状态或空间线索适用'],['改一个机制','先核预测时能获得什么输入'],['对照后决定','完整指标支持保留，或明确放弃']].map(([a,b],i)=>`<div class="flow-step"><div class="flow-n">0${i+1}</div><b>${a}</b><span>${b}</span></div>`).join('')}</div></div>
 <div class="notice">现有分析提供了选来源、识别观测偏差和设计模型的依据。近期成果尚未证明新的 P3 正式收益；同标本关联、开发诊断和官方反馈分别记录。</div>`;
}
function stageAxis(){
 const w=900,left=155,right=43,min=6.5,max=12.5,x=t=>left+(t-min)/(max-min)*(w-left-right);
 const ticks=[6.5,6.75,7.25,7.75,8.25,8.75,9.5,10.5,12.5];
 return `<div class="timeline-wrap"><svg class="timeline-svg" role="img" aria-label="四个任务的训练、已开放开发验证与隐藏目标阶段。T3不同扰动在同龄分层显示。" viewBox="0 0 ${w} 330"><title>官方任务数据阶段轴</title>${ticks.map(t=>`<line x1="${x(t)}" x2="${x(t)}" y1="32" y2="293" stroke="#e8ede1"/><text x="${x(t)}" y="18" text-anchor="middle">E${t}</text>`).join('')}${D.tasks.map((t,i)=>{const y=66+i*66;return `<text class="row-label" x="0" y="${y+4}">${E(t.name)}</text><line x1="${x(min)}" x2="${x(max)}" y1="${y}" y2="${y}" stroke="#dce3d3"/>${t.train.map(s=>`<circle cx="${x(s)}" cy="${t.id==='T3'?y-9:y}" r="5" fill="#4d8664"><title>${E(t.name)} · E${s} 训练/参考${t.id==='T3'?'（条件另核）':''}</title></circle>`).join('')}${t.validation.map(s=>`<circle cx="${x(s)}" cy="${t.id==='T3'?y+5:y}" r="5" fill="#c39555"><title>E${s} 开发验证${t.id==='T3'?' · Gata4 KO':''}</title></circle>`).join('')}${t.test.map(s=>`<rect x="${x(s)-4.5}" y="${t.id==='T3'?y+15-4.5:y-4.5}" width="9" height="9" transform="rotate(45 ${x(s)} ${t.id==='T3'?y+15:y})" fill="#8a76b7"><title>E${s} 隐藏目标${t.id==='T3'?' · Ctnnb1 KO':''}；无真值计数</title></rect>`).join('')}`;}).join('')}<text x="${left}" y="321">E 为胚胎日龄；不同阶段并非同一细胞或同一胚胎的连续跟踪</text></svg></div><div class="timeline-legend"><span><i class="legend-symbol"></i>训练/参考</span><span><i class="legend-symbol val"></i>已开放开发验证</span><span><i class="legend-symbol test"></i>隐藏目标</span></div>`;
}
function dataPage(){
 const mode=route[1]||'official';
 if(mode==='external'&&route[2])return externalDetail(route[2]);
 return head('DATA ATLAS','数据图谱','先看阶段、取材与模态，再判断哪些数据可以放在一起比较。')+
 stats([['官方发布观测',N(590352),'15份文件求和，不是独立胚胎数'],['心脏五时期',N(328858),'同事专项分析覆盖'],['外部登记来源',N(D.external.length),'登记不代表全部已计算或可用于预测'],['测量范围','498 / 500','T2 验证面板；胚胎最终目标为497']])+
 `<div class="tabs" aria-label="数据视图"><a class="btn ${mode==='official'?'primary':''}" href="#/data/official">官方数据</a><a class="btn ${mode==='external'?'primary':''}" href="#/data/external">外部来源</a></div>`+
 (mode==='external'?externalPage():`<section class="panel"><h2>任务与数据的阶段位置</h2>${stageAxis()}<p class="caption">心脏 E8.5 插值为诊断研究线，P3没有对应隐藏测试板。T3以同龄不同条件区分WT、Gata4与Ctnnb1。</p></section>${section('官方文件概况')}<p class="quiet">来源：同事官方数据inventory。15份完整发布矩阵的行数与评分器抽样后的truth_cells不同。</p>${table(['文件','任务','角色','观测数','基因','空间','检出基因中位数'],D.official.map(x=>[`<code>${E(x.id)}</code>`,E(taskName(x.task)),tag(x.role,x.role==='开发验证'?'mixed':'good'),N(x.cells),N(x.genes),x.spatial?'三维':'无',N(x.detected_median)]),['','','','num','num','','num'])}<div class="notice">发布X、counts与共同基因重归一化是不同表示。counts含小数的文件不能直接按整数分子计数解释。文件数与细胞数不等于生物重复数。</div><p class="quiet"><a href="data/official-inventory.json">下载带SHA的官方文件摘要 ↗</a></p>`);
}
function externalPage(){return `<div class="panel"><h2>外部来源的时间与类型</h2>${recentExternalSources()}<details><summary>查看 2026-11-13 的阶段图</summary><p class="quiet">图中的状态对应当时的记录。最新入库状态见上方和下方目录。</p><a class="figure-link" href="assets/figures/fig_source_timelines_by_type.png" target="_blank" rel="noopener"><img class="figure" src="assets/figures/fig_source_timelines_by_type.png" alt="外部来源按类型组织的阶段参考图，2026年11月13日原始图件" loading="lazy"></a><p class="caption"><a class="inline-link" href="assets/figures/fig_source_timelines.png" target="_blank" rel="noopener">查看原始来源时间轴大图 ↗</a></p></details></div>${section(N(D.external.length)+' 个来源 · 按适用条件查找')}<div class="toolbar">${field('搜索来源', 'external-q',search('external-q',state.external.q,'编号、固定名称、登录号、取材'),true)}${field('研究任务','external-task',select('external-task',[['T1','T1'],['T2A','T2 胚胎'],['T2B','T2 心脏插值'],['T2C','T2 心脏外推'],['T3','T3']],state.external.task,'全部任务'))}</div><div id="external-results"></div>`;}
function updateExternal(){const s=state.external,q=s.q.toLowerCase();const rows=D.external.filter(x=>(!s.task||x.tasks.includes(s.task))&&(!q||[x.name,x.public_id,x.tissue,x.assay,...(x.aliases||[])].join(' ').toLowerCase().includes(q)));document.getElementById('external-results').innerHTML=`<p class="result-count">${rows.length} / ${D.external.length} 个来源 · 元数据登记 ${D.version}</p><div class="grid two">${rows.map(x=>`<a href="#/data/external/${x.id}" class="card"><div class="card-number">${E(x.public_id)} · ${E(x.priority)}</div><h3>${E(x.name)}</h3><p>${E(x.stage_text)}</p><p>${E(x.tissue)}</p><div class="card-meta">${x.tasks.map(t=>tag(t)).join('')}</div><span class="quiet">查看适用范围与限制 ↗</span></a>`).join('')||empty('没有匹配的来源')}</div>`;}
function externalDetail(id){const x=D.external.find(x=>x.id===id);if(!x)return missing();return crumbs([['数据图谱','#/data'],['外部来源','#/data/external'],[id]])+head('EXTERNAL SOURCE',x.name,x.tissue)+`<div class="grid two"><div class="panel"><h2>阶段与观测单位</h2><p>${E(x.stage_text)}</p><div class="stage-strip">${x.stages.map(s=>`<span class="stage">${E(embryoDay(s))}</span>`).join('')}</div><p class="quiet">${E(x.stage_basis)}</p><div class="evidence-block"><h3>采样 / 测量</h3><p>${E(x.assay)}</p><p>${E(x.unit)}</p></div><p class="quiet">${E(x.availability)}</p></div><div class="panel"><h2>可以怎样使用</h2><p>${E(x.scope)}</p><div class="notice amber">${E(x.limits)}</div><p>${x.urls.map(url=>`<a class="btn small" target="_blank" rel="noopener" href="${E(url)}">原始来源 ↗</a>`).join(' ')}</p></div></div>${externalEvidence(x)}${section('与该来源有关的先验','#/knowledge')}<div class="grid two">${D.claims.filter(c=>c.source_names.some(s=>s.startsWith(id+' '))).slice(0,6).map(c=>knowledgeCard(c)).join('')||empty('当前108条知识没有该来源的对应条目')}</div>`;}

function embryoDay(stage) {
 const n=Number(stage);
 return Number.isInteger(n)?'E'+n.toFixed(1):'E'+stage;
}
function recentExternalSources() {
 const sources=D.external.filter(x=>x.added_on);
 if(!sources.length)return '';
 return `<div class="evidence-block">${sources.map(x=>`<p><a class="inline-link" href="#/data/external/${E(x.id)}">${E(x.name)}</a> · ${E(x.stage_text)} · ${x.bulk_evidence?'已补整体表达与扰动相似度':E(x.priority)}</p>`).join('')}</div>`;
}
function bulkEvidence(x) {
 const b=x.bulk_evidence;if(!b)return '';
 const link=r=>`<a class="inline-link" href="${E(b.download_root+r.gene_table)}">逐基因表</a>`;
 const fraction=v=>v.sign_agreement==null?'—':`${N(v.sign_agreement*100,1)}% · ${v.same_direction}/${v.n}`;
 const label={repeat1:'官方 KO 重复 1',repeat2:'官方 KO 重复 2',equal_repeat_mean:'官方两个 KO 等权'};
 const main=b.expression.filter(r=>r.role==='main');
 const effects=b.response.filter(r=>r.role==='main');
 const expressionRows=rows=>rows.map(r=>[E(r.official_label),E(r.group),N(r.common_genes)+' / '+N(r.used_genes),num(r.spearman),r.per_replicate.map(s=>`${E(s.sample)} · ${num(s.rho)}`).join('<br>'),link(r)]);
 const responseRows=rows=>rows.map(r=>[E(label[r.official]),num(r.all.spearman),fraction(r.all),num(r.robust.spearman),fraction(r.robust),link(r)]);
 return `<section class="panel" id="external-bulk-expression"><h2>与官方的整体表达相似度</h2><p>已计算 · ${E(b.date)}。官方 WT 对外部对照，官方 KO 对外部 Gata4 突变组；保留各组织重复。</p>
 ${table(['官方参照','外部组','共同／参与基因','整体 ρ','各样本 ρ','数据'],expressionRows(main))}
 <details><summary>查看逐样本处理与敏感性比较</summary><p>${E(b.method.official)}</p><p>${E(x.id==='GSE117621'?b.method.fpkm:b.method.array)}</p>${table(['官方参照','外部组','共同／参与基因','整体 ρ','各样本 ρ','数据'],expressionRows(b.expression.filter(r=>r.role!=='main')))}</details></section>
 <section class="panel" id="external-bulk-response"><h2>突变减去对照：变化是否相似</h2><p>${E(effects[0].mutant_group)} − ${E(effects[0].control_group)}。官方使用 E8.75 WT 与 Gata4 KO。</p>
 ${table(['官方变化','变化 ρ','同向 · 全部非零变化','变化 ρ · 官方稳定变化','同向 · 官方稳定变化','数据'],responseRows(effects))}
 <p class="quiet">“官方稳定变化”：两个 KO 重复同向、且各自 |Δ|≥0.25 log2(CP10k+1)。方向一致率列出同向基因／参与基因。外部变化单位：${E(effects[0].external_delta_unit)}。</p>
 <details><summary>包含 KI2、更换对照或 Gata6 的结果</summary>${b.response.filter(r=>r.role!=='main'&&r.official==='equal_repeat_mean').map(r=>`<h3>${E(r.mutant_group)} − ${E(r.control_group)}</h3>${table(['官方变化','变化 ρ','同向 · 全部非零变化','变化 ρ · 官方稳定变化','同向 · 官方稳定变化','数据'],responseRows([r]))}`).join('')}</details>
 <p><a class="btn small" href="#/analysis/A13?section=gata4-bulk-response">查看两来源并列散点图与完整口径 →</a> <a class="btn small" href="${E(b.download_root)}results.json">下载完整结果与输入 SHA</a></p>
 <p class="quiet">组织数据无逐细胞和三维分布，MMD／CSS／比赛分数不适用。</p></section>`;
}
function externalEvidence(x) {
 if(!x.samples?.length)return '';
 const sampleLink=s=>`<a class="inline-link" href="https://www.ncbi.nlm.nih.gov/geo/query/acc.cgi?acc=${encodeURIComponent(s.accession)}" target="_blank" rel="noopener">${E(s.accession)}</a>`;
 if(x.samples[0].group) {
   const rows=x.samples.map(s=>[sampleLink(s),E(s.stage),E(s.group),E(s.note||'')]);
   return bulkEvidence(x)+`<section class="panel" id="external-sample-coverage"><h2>GEO 样本与分组</h2>${table(['样本','日龄','分组','作者备注'],rows)}</section>`;
 }
 const stages=[...new Set(x.samples.map(s=>s.stage))];
 const totals=stages.map(stage=>{
   const samples=x.samples.filter(s=>s.stage===stage);
   const pairs=x.comparisons.filter(p=>p.stage===stage);
   return [E(stage),N(samples.length),N(samples.reduce((n,s)=>n+s.cells,0)),
     pairs.map(p=>`<a class="inline-link" href="readers/research/vem_pairwise_similarity_v3/comparison.html?v=${E(x.added_on)}#pair=${encodeURIComponent(p.pair)}&amp;group=ALL" target="_blank" rel="noopener">${E(p.task)} · ρ ${Number(p.rho).toFixed(3)}</a>`).join(' / ')||'来源覆盖'];
 });
 const specimens=x.samples.map(s=>[E(s.id),E(s.stage),
   sampleLink(s),N(s.cells)]);
 return `<section class="panel" id="external-sample-coverage"><h2>阶段与同日龄对照</h2>
   ${table(['日龄','胚胎','RNA 细胞','对照入口'],totals,['','num','num',''])}
   <details><summary>查看 ${N(x.samples.length)} 个胚胎与 GEO 文库</summary>
   ${table(['胚胎','日龄','GEO RNA 文库','RNA 细胞'],specimens,['','','','num'])}</details></section>`;
}

const readerGroups=['官方数据分析','心脏专项分析','先验知识','官方与外部数据比较','评分规则与例子','工程与历史'];
function originalUrl(r,anchor=''){return anchor?r.url.split('#')[0]+'#'+encodeURIComponent(anchor):r.url;}
function readerRow(r){const a=D.analyses.find(x=>x.analysis_id===r.analysis_id);return `<div class="reader-row"><span class="reader-id">${r.analysis_id}</span><div><a class="reader-title" href="#/analysis/${r.analysis_id}">${E(r.title)}</a><p class="reader-meta">${E(a.source_group.startsWith('peer')?'志琨的分析':a.source_group==='history'?'工程手册':'已有研究')} · ${a.tasks.map(taskName).map(E).join(' / ')}</p><div class="reader-sections">${r.sections.map(h=>`<a href="#/analysis/${r.analysis_id}?${h.anchor?'section='+encodeURIComponent(h.anchor):'heading='+h.heading_index}">${E(h.title)}</a>`).join('')}</div></div><a class="reader-action" href="${E(r.url)}" target="_blank" rel="noopener">单独打开原页 ↗</a></div>`;}
function analysisPage(){
 if(route[1]&&route[1]!=='topic')return analysisDetail(route[1]);
 if(route[1]==='topic')state.analysis.topic=route[2]||'';else state.analysis.topic='';
 return head('','分析专题','按类别查找已有专题，点击标题进入原页面；下方的小标题可直接切入原章节。')+
 `<div class="topic-jumps"><a href="#/similarity">同阶段外部数据前八 →</a>${readerGroups.map((g,i)=>`<a href="#/analysis/topic/group-${i}">${E(g)}</a>`).join('')}<a href="#/analysis">全部专题</a></div><div class="toolbar">${field('搜索专题或原章节','analysis-q',search('analysis-q',state.analysis.q,'标题、原问题、章节或编号'),true)}${field('比赛任务','analysis-task',select('analysis-task',D.tasks.map(t=>[t.id,t.name]),state.analysis.task,'全部任务'))}</div><div id="analysis-results"></div>`;
}
function updateAnalysis(){
 const s=state.analysis,q=s.q.toLowerCase();
 const oldTopic=s.topic.startsWith('group-')?'':s.topic,group=s.topic.startsWith('group-')?readerGroups[Number(s.topic.slice(6))]:'';
 const rows=D.readers.filter(r=>{const a=D.analyses.find(x=>x.analysis_id===r.analysis_id);return (!s.task||a.tasks.includes(s.task))&&(!group||r.group===group)&&(!oldTopic||a.topic===oldTopic)&&(!q||[r.analysis_id,r.title,...r.sections.map(h=>h.title)].join(' ').toLowerCase().includes(q));});
 document.getElementById('analysis-results').innerHTML=`<p class="result-count">${rows.length} / 15 个入口</p>`+readerGroups.map(g=>{const items=rows.filter(r=>r.group===g);return items.length?`<section class="topic-section"><h2>${E(g)}</h2><div class="reader-list">${items.map(readerRow).join('')}</div></section>`:'';}).join('')+(rows.length?'':empty('没有匹配的专题'));
}
function readerView(r,anchor=''){const url=originalUrl(r,anchor),heading=new URLSearchParams(location.hash.split('?')[1]||'').get('heading');return `<h1 class="sr-only">${E(r.title)}</h1><div class="reader-toolbar"><p class="quiet">${E(r.source_path.split('/').slice(1).join('/'))}</p><a class="btn" href="${E(url)}" target="_blank" rel="noopener">单独打开原页 ↗</a></div><iframe class="original-reader" src="${E(url)}" title="${E(r.title)}"${heading!==null?' data-heading="'+E(heading)+'"':''}></iframe>`;}
function analysisDetail(id){const a=D.analyses.find(x=>x.analysis_id===id),r=readerFor(id);if(!a||!r)return missing();const anchor=new URLSearchParams(location.hash.split('?')[1]||'').get('section')||'';return crumbs([['分析专题','#/analysis'],[r.group,'#/analysis/topic/group-'+readerGroups.indexOf(r.group)],[id]])+readerView(r,anchor)+`<details class="disclosure"><summary>来源与联合审视备注</summary><div class="prose"><p>${E(a.evidence_status)}</p><p>${E(a.boundary)}</p>${sourceBox(a)}</div></details>`;}

function detailWidget(id){switch(id){
 case 'A04':return geneWidget();
 case 'A05':return neighbourWidget();
 case 'A06':return thinningWidget();
 case 'A09':case 'A08':return `${section('在统一知识库中继续阅读','#/knowledge')}<div class="panel"><h2>原先验与官方核对分开判断</h2><p class="quiet">可以按基因、类型、阶段及核对状态筛选。首轮34条已经包含在扩展108条中。</p><a class="btn primary" href="#/knowledge">进入108条知识 ↗</a></div>`;
 case 'A11':case 'A12':return pairWidget();
 case 'A13':return metricWidget();
 case 'A14':return scoringWidget();
 case 'A02':return `${section('从官方输入开始')}<a class="btn" href="#/data/official">查看15份官方文件与阶段轴 ↗</a>`;
 case 'A03':return `${section('进一步查基因与邻域')}<div class="grid two">${['A04','A05'].map(x=>analysisCard(D.analyses.find(a=>a.analysis_id===x))).join('')}</div>`;
 case 'A10':return `<div class="notice">跨来源比较使用不同面板、表达表示和分组时，绝对距离不能直接排名。先确定来源与类型的适用范围，再看后续迁移证据。</div>`;
 default:return '';
}}
function geneWidget(){return `${section('500基因交互台账')}<p class="quiet">各轴为按固定阈值得到的描述性候选；可重叠，不是互斥分组。</p>${stats([['类型指向','45','不等于丰度恒定'],['时期关联','81','至少一个粗类型'],['重复空间候选','140','不代表跨期解剖位置已对齐'],['多轴成员','57','同时属于至少两类']])}<div class="toolbar">${field('搜索基因','gene-q',search('gene-q',state.genes.q,'例如 Myl7、Wt1'),true)}${field('候选轴','gene-axis',select('gene-axis',[['type_marker','类型指向'],['stage','时期关联'],['spatial','重复空间'],['multi','多轴'],['stable','严格稳定丰度']],state.genes.axis,'全部基因'))}</div><div id="gene-results"></div>`;}
function updateGenes(){const s=state.genes,rows=D.gene_axes.filter(x=>x.gene.toLowerCase().includes(s.q.toLowerCase())&&(!s.axis||s.axis==='type_marker'&&x.type_marker||s.axis==='stage'&&x.stage_types>0||s.axis==='spatial'&&x.spatial_types>0||s.axis==='multi'&&(+x.type_marker+ +(x.stage_types>0)+ +(x.spatial_types>0))>=2||s.axis==='stable'&&x.stable));document.getElementById('gene-results').innerHTML=`<p class="result-count">${rows.length} / 500 基因</p>${rows.length?table(['基因','领先粗类型','类型指向','时期关联类型数','重复空间类型数','领先差距下限'],rows.map(x=>[`<a class="inline-link" href="#/knowledge?gene=${encodeURIComponent(x.gene)}"><code>${E(x.gene)}</code></a>`,E(x.type||'未达恒定领先条件'),x.type_marker?tag('候选','good'):'—',N(x.stage_types),N(x.spatial_types),num(x.gap)]),['','','','num','num','num']):empty('当前轴没有达标成员')}`;}
function neighbourWidget(){return `${section('邻域增量 · 保存表探索')}<div class="notice amber">同切片二维近邻15个其他细胞；实测类型、位置及目标基因以外检出量参与预测。每期分别拟合、同标本空间块留出、无缓冲、一次分层打乱。这里的ΔR²不能换算为官方三维含self的NFS。部分候选的留出R²仍为负，增量不等于绝对预测能力已达标。</div><div class="toolbar">${field('搜索基因','neighbour-q',search('neighbour-q',state.neighbour.q,'例如 Myl7'),true)}${field('时期','neighbour-stage',select('neighbour-stage',[...new Set(D.official.filter(x=>x.task==='T2_heart'&&x.id!=='E9.5_mab21l2_ko').map(x=>x.id))].filter(x=>['E8.25_late','E8.5','E8.75','E9.5','E10.5'].includes(x)),state.neighbour.stage,'全部时期'))}${field('粗类型','neighbour-type',select('neighbour-type',['Cardiomyocyte','Endothelial/endocardial','Cardiac progenitor/heart field','Other mesoderm'],state.neighbour.type,'全部类型'))}${field('两项增量阈值','neighbour-cut',select('neighbour-cut',[['0.005','> 0.005'],['0.01','> 0.01（原标准）'],['0.02','> 0.02'],['0.05','> 0.05']],state.neighbour.cut,'选择阈值'))}${field('显示范围','neighbour-only',select('neighbour-only',[['hit','达阈值候选'],['eligible','全部可评估']],state.neighbour.only,'全部行'))}</div><div id="neighbour-results" aria-live="polite"><div class="loading">正在载入9,500行保存表…</div></div>`;}
function loadNeighbours(){if(window.VEM_NEIGHBOURS)return Promise.resolve();if(!neighbourPromise)neighbourPromise=new Promise((resolve,reject)=>{const s=document.createElement('script');s.src='assets/neighbours.js';s.onload=resolve;s.onerror=()=>reject(new Error('邻域表未能载入，请刷新后重试'));document.head.appendChild(s);});return neighbourPromise;}
function updateNeighbours(){if(!window.VEM_NEIGHBOURS)return;const s=state.neighbour,cut=Number(s.cut||.01);let rows=window.VEM_NEIGHBOURS.filter(x=>(!s.q||x.gene.toLowerCase().includes(s.q.toLowerCase()))&&(!s.stage||x.stage===s.stage)&&(!s.type||x.type===s.type));const hits=x=>x.eligible&&x.delta>cut&&x.shuffle_delta>cut;const union=new Set(rows.filter(hits).map(x=>x.gene)).size;rows=rows.filter(x=>s.only==='hit'?hits(x):s.only==='eligible'?x.eligible:true).sort((a,b)=>(b.delta??-Infinity)-(a.delta??-Infinity));s.page=Math.min(s.page,Math.max(0,Math.ceil(rows.length/30)-1));document.getElementById('neighbour-results').innerHTML=`<p class="result-count">当前条件 ${N(union)} 个候选基因（并集） · ${N(rows.length)} 行 · 固定原阈值全表为236基因</p>${rows.length?table(['基因','时期','类型','n','检出率','位置R²','加邻域R²','ΔR²','超过打乱Δ'],rows.slice(s.page*30,(s.page+1)*30).map(x=>[`<code>${E(x.gene)}</code>`,E(x.stage),E(x.type),N(x.n),N(x.det*100,1)+'%',num(x.base),num(x.neighbour),num(x.delta),num(x.shuffle_delta)]),['','','','num','num','num','num','num','num']):empty('当前条件下没有候选')}${pager('neighbour',rows.length,s.page,30)}`;}
function thinningWidget(){const a=D.audit.thinning_example[0],b=D.audit.codetection_counterexample[0];return `${section('一个吻合例与一个联合检出反例')}<p class="quiet">E9.5 · Proepi · state=3。高计数源128个、低计数目标130个；留出检验基因未参与锚状态定义。</p><div class="grid two"><div class="panel"><div class="card-number">单基因 · Wt1</div><h2>检出率接近，提示观测过程相容</h2>${table(['量','抽稀预测','观测目标'],[['检出率',N(a.pred_detection*100,2)+'%',N(a.obs_detection*100,2)+'%'],['阳性计数',num(a.pred_positive_counts),num(a.obs_positive_counts)],['均值 logCP10k',num(a.pred_mean_log_cp10k),num(a.obs_mean_log_cp10k)]],['','num','num'])}</div><div class="panel"><div class="card-number">联合检出 · Bnc1 / Myrf</div><h2>单基因吻合未覆盖联合结构</h2>${table(['量','抽稀预测','观测目标'],[['共检出率',N(b.pred*100,2)+'%',N(b.obs*100,2)+'%']],['','num','num'])}<div class="notice amber">抽稀相容性不等于恢复真实RNA；counts小数转整数的模拟本身也是近似。</div></div></div>`;}
function pairWidget(){return `${section('逐对来源比较')}<p class="quiet">${N(D.pairs.length)} 项比较，包含阶段、组别和共同基因数。相关系数用于筛选，不直接设供体权重。</p><div class="toolbar">${field('搜索来源或类群','pair-q',search('pair-q',state.pairs.q,'来源编号、名称或细胞类群'),true)}${field('任务','pair-task',select('pair-task',[...new Set(D.pairs.map(x=>x.task))],state.pairs.task,'全部任务'))}</div><div id="pair-results"></div>`;}
function updatePairs(){const s=state.pairs,rows=D.pairs.filter(x=>(!s.task||x.task===s.task)&&(!s.q||[x.external_name,x.group_name,x.group].join(' ').toLowerCase().includes(s.q.toLowerCase())));s.page=Math.min(s.page,Math.max(0,Math.ceil(rows.length/15)-1));document.getElementById('pair-results').innerHTML=`<p class="result-count">${rows.length} 行 · 检出差异单位为百分点</p>${rows.length?table(['来源','官方 / 外部阶段','分组','基因数','Pearson','Spearman','检出差异绝对均值'],rows.slice(s.page*15,(s.page+1)*15).map(x=>[E(x.external_name),E(x.official_stage+' / '+x.external_stage),E(x.group_name||x.group),N(x.n_genes),num(x.pearson),num(x.spearman_all),num(x.detection_mean_abs_pp)]),['','','','num','num','num','num']):empty('没有匹配的比较')}${pager('pairs',rows.length,s.page,15)}`;}
function metricWidget(){return `${section('公开指标公式下的来源比较')}<div class="grid two"><div class="panel"><h2>均值接近，时间变化仍不同</h2><p>OMIX014646 · mdCLA 全胚胎单细胞图谱</p>${table(['比较对象','相关系数'],[['E8.5均值 Pearson','0.8939'],['E9.5均值 Pearson','0.8883'],['E8.5→E9.5变化 Spearman','0.3676']],['','num'])}</div><div class="panel"><h2>迁移改善有指标代价</h2><p>VED-001 · Pijuan-Sala 早期全胚胎图谱</p>${table(['阶段留出','原始','Ridge'],[['MMD','0.386833','0.277161'],['CSS','0.327530','0.246539'],['均值MSE','0.992228','2.694728']],['','num','num'])}<p class="caption">独立496基因支线口径；不能与主表绝对距离混排。整类型留出亦有失败。</p></div></div>${section('主比较保存表')}<p class="quiet">MMD/CSS是公开公式下的开发诊断raw，越低越接近；不同参考、panel或表示不做全局名次。</p><div class="toolbar">${field('搜索来源','metric-q',search('metric-q',state.metrics.q,'来源编号或名称'),true)}${field('任务','metric-task',select('metric-task',[...new Set(D.metrics.map(x=>x.task))],state.metrics.task,'全部任务'))}${field('表达表示','metric-representation',select('metric-representation',[...new Set(D.metrics.map(x=>x.representation))],state.metrics.representation,'全部表示'))}</div><div id="metric-results"></div>`;}
function updateMetrics(){const s=state.metrics,rows=D.metrics.filter(x=>(!s.task||x.task===s.task)&&(!s.representation||x.representation===s.representation)&&(!s.q||x.source_name.toLowerCase().includes(s.q.toLowerCase())));s.page=Math.min(s.page,Math.max(0,Math.ceil(rows.length/18)-1));document.getElementById('metric-results').innerHTML=`<p class="result-count">${rows.length} 行 · 含技术seed重复，不增加生物重复数</p>${rows.length?table(['来源','阶段 官方/外部','分组','表示','基因','seed','MMD','CSS'],rows.slice(s.page*18,(s.page+1)*18).map(x=>[E(x.source_name),E(x.official_stage+' / '+x.external_stage),E(x.group),E(x.representation),N(x.n_genes),E(x.seed),num(x.MMD),num(x.CSS)]),['','','','','num','num','num','num']):empty('没有匹配的指标行')}${pager('metrics',rows.length,s.page,18)}`;}
function scoringWidget(){return `${section('先分清每个任务在比较什么')}<div class="grid three">${[['T1','表达变化 + 表达分布','参考：前一阶段真实表达；比较预测与目标的变化方向及整群分布。'],['T2','表达 + 形状 + 尺度 + 邻域','三维空间与表达共同评价；NFS是三维近邻15点且含self。'],['T3','KO响应方向 + 幅度 + 分布','参考为匹配WT；正常日龄变化不能代替基因敲除响应。']].map(([a,b,c])=>`<div class="panel"><div class="card-number">${a}</div><h3>${b}</h3><p class="quiet">${c}</p></div>`).join('')}</div><div class="notice">各项raw先按官方floor/ceiling校准，再加权。教学例子用于解释公式，不是模型运行或官方得分。</div>`;}

function knowledgePage(){if(!route[1])return crumbs([['先验知识']])+readerView(readerFor('A09'));if(route[1])return knowledgeDetail(route[1]);const s=state.knowledge;return head('PRIOR KNOWLEDGE','先验知识库','先看具体的生物学命题，再分别看官方数据与外部数据能核对到什么程度。')+stats([['知识条目','108','首轮34条已包含在内'],['官方观测一致','3','另有2条混合结果'],['官方条件不可比','90','明确条件缺口，不强行判断'],['外部有数值','35','原来源复现不等于独立验证']])+`<div class="toolbar">${field('搜索知识','knowledge-q',search('knowledge-q',s.q,'基因、细胞、阶段、来源或知识编号'),true)}${field('研究范围','knowledge-task',select('knowledge-task',[...new Set(D.claims.map(x=>x.task))],s.task,'全部范围'))}${field('核对对象','knowledge-axis',select('knowledge-axis',[['official','官方核对'],['external','外部核对']],s.axis,'选择对象'))}${field('核对状态','knowledge-status',select('knowledge-status',['观测一致','结果混合','条件不可比','面板未覆盖','证据不足'],s.status,'全部状态'))}</div><div id="knowledge-results"></div>`;}
function knowledgeCard(c){return `<a class="knowledge-row" href="#/knowledge/${c.id}"><div class="knowledge-top"><span class="knowledge-id">${c.id} · ${E(c.category)}</span><div class="status-line"><span>官方 ${statusTag(c.checks.official.status)}</span><span>外部 ${statusTag(c.checks.external.status)}</span></div></div><h3>${E(c.title)}</h3><p>${E(c.takeaway||c.checks.official.reason)}</p><div class="card-meta">${tag(c.cell||c.task)}${c.genes.slice(0,8).map(g=>`<span class="gene-pill">${E(g)}</span>`).join('')}</div><span class="quiet">${E(c.source_names.join('；')||'原文来源见详情')}</span></a>`;}
function updateKnowledge(){const s=state.knowledge,q=s.q.toLowerCase();const rows=D.claims.filter(c=>(!s.task||c.task===s.task)&&(!s.status||c.checks[s.axis||'official'].status===s.status)&&(!q||[c.id,c.title,c.cell,c.task,...c.genes,...c.stages,...c.source_names].join(' ').toLowerCase().includes(q)));s.page=Math.min(s.page,Math.max(0,Math.ceil(rows.length/12)-1));document.getElementById('knowledge-results').innerHTML=`<p class="result-count">${rows.length} / 108 条知识 · 当前按${s.axis==='external'?'外部':'官方'}核对状态筛选</p>${rows.slice(s.page*12,(s.page+1)*12).map(knowledgeCard).join('')||empty('没有匹配的知识')}${pager('knowledge',rows.length,s.page,12)}`;}
function knowledgeDetail(id){const c=D.claims.find(x=>x.id===id);if(!c)return missing();return crumbs([['先验知识','#/knowledge'],[c.id]])+head(`${c.id} · ${c.category}`,c.title,c.source_note)+`<div class="card-meta">${tag(c.task)}${tag(c.cell)}${c.stages.map(s=>tag(s)).join('')}${c.genes.map(g=>`<span class="gene-pill">${E(g)}</span>`).join('')}</div><div class="grid two">${['official','external'].map(which=>{const x=c.checks[which];return `<section class="panel"><div class="kicker">${which==='official'?'官方数据核对':'外部数据核对'} ${statusTag(x.status)}</div><h2>${E(x.reason)}</h2>${x.tests.map(t=>`<div class="evidence-block"><h3>${E(t.source||t.comparison_zh||'数值核对')}</h3>${t.source_relation?tag(t.source_relation):''}${t.scope==='partial'?badge('仅部分成分核对','amber'):''}<p>${E(t.number_summary||t.reason||t.comparison_zh||'详细记录见下方')}</p>${t.records?.length?`<details><summary class="quiet">查看 ${t.records.length} 条保存数值</summary>${recordTable(t.records)}</details>`:''}</div>`).join('')}${!x.tests.length?'<p class="quiet">该命题没有满足原条件的主数值；缺口保留，不用近似问题替代。</p>':''}</section>`;}).join('')}</div><div class="notice">${E(c.takeaway||'核对结论仅适用于该条记录的阶段、细胞定义和测量条件；不能自动推广为可部署模型收益。')}</div><div class="panel"><h2>原始出处</h2><p>${E(c.source_names.join('；'))}</p><p class="quiet">${E(c.locator||'')}</p>${c.quote?`<blockquote lang="en">${E(c.quote)}</blockquote>`:''}${c.source_url?`<a class="btn" href="${E(c.source_url)}" target="_blank" rel="noopener">阅读原始来源 ↗</a>`:''}${c.doi?`<p class="quiet">DOI ${E(c.doi)}</p>`:''}</div>`;}
function recordTable(records){const rows=records.map(r=>{const n=r.n??r.cells??'—',d=r.denominator??r.n_comparator;const vals=Object.entries(r).filter(([k,v])=>!['stage','sample','n','cells','denominator','n_comparator'].includes(k)&&v!=null).map(([k,v])=>`${k}: ${typeof v==='number'?N(v,5):Array.isArray(v)?v.map(x=>typeof x==='number'?N(x,4):x).join(', '):JSON.stringify(v)}`).join(' · ');return [E(r.stage??''),E(r.sample??''),E(n),E(d??'—'),E(vals)];});return table(['阶段','样本','n','分母/比较n','保存结果（原字段）'],rows,['','','num','num','']);}

function filesPage(){const f=D.file_counts;return head('','5090 文件结构','沿用工程手册的目录树，补充近期的分析共享包、联合索引和网站入口。')+`<pre class="file-tree" aria-label="5090 VEM 工程目录树">${E(D.file_tree)}</pre>`+(f?`<div class="file-summary"><span>主工程普通文件 <b>${N(f.total_files)}</b></span><span>一级目录 <b>${N(f.top_level_directory_count)}</b></span><span>逻辑大小 <b>${N(f.total_logical_bytes/2**30,1)} GiB</b></span><span>软链接 <b>${N(f.symlinks)}</b></span></div><p class="quiet">计数快照：${date(f.finished_at_utc)} · 仅统计 virtualembryo_cym，不跟随软链接；逻辑大小不等于独占磁盘占用。</p><details class="disclosure"><summary>展开一级目录计数</summary><div class="prose">${table(['目录','普通文件','子目录','软链接','逻辑大小'],f.items.filter(x=>x.kind==='directory').map(x=>[`<code>${E(x.name)}/</code>`,N(x.files),N(x.directories),N(x.symlinks),N(x.logical_bytes/2**30,2)+' GiB']),['','num','num','num','num'])}</div></details>`:'')+`<p class="quiet"><a href="data/5090-tree.txt">下载目录树</a> · <a href="data/file-counts.json">下载计数快照</a></p>`;}

function taskPage(id){const t=D.tasks.find(x=>x.id===id);if(!t)return missing();return crumbs([['比赛目标','#/overview'],[t.name]])+head(t.name,t.target+' · '+t.description,t.modality+' / '+N(t.genes)+'基因')+`<div class="grid two"><section class="panel"><h2>下一项能改变决策的工作</h2><p>${E(t.next)}</p><div class="notice">先登记合格基线、数据曝光、生成时可得输入与失败出口。后续实验尚未启动；P3正式次数未核实。</div><a href="#/plan" class="btn">查看工作卡与分工建议 ↗</a></section><section class="panel"><h2>评价组与权重</h2>${t.weights.map(([a,b])=>`<div class="metric-row"><b>${E(a)}</b><div><div class="progress-line"><span style="width:${b}%"></span></div><small>${b}%</small></div></div>`).join('')}<p class="caption">T2组内各指标平分；T3分布组MMD/CSS为60/40。公开公式不等于线上后台逐位验收。</p></section></div>${section('优先阅读的分析')}<div class="grid two">${t.analysis.map(id=>analysisCard(D.analyses.find(x=>x.analysis_id===id))).join('')}</div>`;}
function planPage(){return head('JOINT PLAN','联合规划','把现有研究接成有限的预测对照，明确每项工作的输入、交付与停止条件。')+`<div class="grid three">${[['P0','接清基线与评价','核父模型、几何来源、输入特征与完整任务指标。'],['P1','心脏邻域小试验','先核可生成条件，再做更强位置对照及向前留期。'],['P2','T1有限来源改动','一个来源、一个类型；拆开检出与强度，报告完整指标。']].map(([p,t,b])=>`<div class="card"><div class="card-number">${p}</div><h3>${t}</h3><p>${b}</p></div>`).join('')}</div><div class="notice">这些是建议工作卡。职责按角色划分，不代表同事已经接单；当前没有启动模型训练、评分或正式提交。</div>${section('谁负责解释，谁负责检验')}${table(['角色','负责的边界','要交出的结果'],[['官方/心脏分析解释角色','原统计含义、局部结构与观测假设','有条件的特征候选与不可推断范围'],['外部来源解释角色','来源身份、阶段/取材、类型映射和迁移失败','一个可检验的来源/类型假设'],['任务模型执行角色','合格生成路径、对照预测和完整指标','保留、放弃或证据不足'],['总控与评估角色','统一版本、输入身份、开发曝光与回执','可复核的决策记录']])}<details class="disclosure" open><summary>联合审视全文 · 18条核对与3张工作卡</summary><article class="prose">${D.plan_html}</article></details>`;}
function missing(){return head('NOT FOUND','未找到这个入口','可从主导航返回现有任务、分析或知识条目。')+'<a class="btn" href="#/overview">返回总览</a>';}
function render(){
 if(clockHandle){clearInterval(clockHandle);clockHandle=null;}
 const raw=(location.hash.slice(1)||'/overview'),parts=raw.split('?');route=parts[0].replace(/^\//,'').split('/').filter(Boolean);
 const query=new URLSearchParams(parts[1]||'');if(route[0]==='knowledge'&&query.has('gene')){state.knowledge.q=query.get('gene');state.knowledge.page=0;}
 const page=route[0]||'overview';document.querySelectorAll('[data-nav]').forEach(a=>{const active=a.dataset.nav===page||(page==='task'&&a.dataset.nav==='overview');a.classList.toggle('active',active);if(active)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});
 try{main.innerHTML=page==='overview'?overview():page==='data'?dataPage():page==='analysis'?analysisPage():page==='similarity'?window.VEMStageRankings.render():page==='knowledge'?knowledgePage():page==='files'?filesPage():page==='plan'?planPage():page==='task'?taskPage(route[1]):missing();}catch(error){console.error(error);main.innerHTML=head('DISPLAY ERROR','页面未能完成载入','请刷新页面；如果仍有问题，可查看维护说明。');}
 document.title=(main.querySelector('h1')?.textContent||'研究工作台')+' · 26VEM';
 document.getElementById('footer-info').textContent='研究快照 '+D.version+' · 截止日来源 '+D.deadline.source_url.replace('https://','');
 if(document.getElementById('countdown')){countdown();clockHandle=setInterval(countdown,1000);}
 if(document.getElementById('analysis-results'))updateAnalysis();
 if(document.getElementById('external-results'))updateExternal();
 if(document.getElementById('knowledge-results'))updateKnowledge();
 if(document.getElementById('gene-results'))updateGenes();
 if(document.getElementById('pair-results'))updatePairs();
 if(document.getElementById('metric-results'))updateMetrics();
 if(document.getElementById('neighbour-results'))loadNeighbours().then(()=>{if(document.getElementById('neighbour-results'))updateNeighbours();}).catch(e=>{if(document.getElementById('neighbour-results'))document.getElementById('neighbour-results').innerHTML=empty(e.message);});
 window.scrollTo({top:0,behavior:'instant'});
 if(page==='similarity'&&route[1])document.getElementById('rank-task-'+route[1])?.scrollIntoView({block:'start'});
}
const controls={
 'analysis-q':['analysis','q',updateAnalysis],'analysis-task':['analysis','task',updateAnalysis],'analysis-topic':['analysis','topic',updateAnalysis],
 'external-q':['external','q',updateExternal],'external-task':['external','task',updateExternal],
 'knowledge-q':['knowledge','q',updateKnowledge],'knowledge-task':['knowledge','task',updateKnowledge],'knowledge-axis':['knowledge','axis',updateKnowledge],'knowledge-status':['knowledge','status',updateKnowledge],
 'gene-q':['genes','q',updateGenes],'gene-axis':['genes','axis',updateGenes],
 'neighbour-q':['neighbour','q',updateNeighbours],'neighbour-stage':['neighbour','stage',updateNeighbours],'neighbour-type':['neighbour','type',updateNeighbours],'neighbour-cut':['neighbour','cut',updateNeighbours],'neighbour-only':['neighbour','only',updateNeighbours],
 'pair-q':['pairs','q',updatePairs],'pair-task':['pairs','task',updatePairs],
 'metric-q':['metrics','q',updateMetrics],'metric-task':['metrics','task',updateMetrics],'metric-representation':['metrics','representation',updateMetrics]
};
main.addEventListener('input',event=>{const c=controls[event.target.id];if(c){state[c[0]][c[1]]=event.target.value;if('page' in state[c[0]])state[c[0]].page=0;c[2]();}});
main.addEventListener('load',event=>{const frame=event.target;if(frame.matches?.('iframe[data-heading]')){const index=Number(frame.dataset.heading);if(Number.isInteger(index)&&index>=0)frame.contentDocument?.querySelectorAll('h2')[index]?.scrollIntoView({block:'start'});}},true);
main.addEventListener('change',event=>{const c=controls[event.target.id];if(c&&event.target.tagName==='SELECT'){state[c[0]][c[1]]=event.target.value;if('page' in state[c[0]])state[c[0]].page=0;c[2]();}});
main.addEventListener('click',event=>{const b=event.target.closest('[data-page]');if(b&&!b.disabled){const key=b.dataset.page;state[key].page+=Number(b.dataset.step);({knowledge:updateKnowledge,neighbour:updateNeighbours,pairs:updatePairs,metrics:updateMetrics})[key]();}});
document.querySelector('.skip').addEventListener('click',event=>{event.preventDefault();main.focus();main.scrollIntoView();});
window.addEventListener('hashchange',render);render();
})();
