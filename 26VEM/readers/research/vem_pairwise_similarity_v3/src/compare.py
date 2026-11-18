"""Descriptive pair audit. No cell matching, predictions, or competition scores."""
from pathlib import Path
import sys,json,time,gc,platform,itertools
import numpy as np
import pandas as pd
from scipy import sparse,stats
from scipy.spatial.distance import jensenshannon
from data_io import sha,dump,clean,ROOT
B=Path(sys.argv[1]);OLD=ROOT/'experiments/vem_prior_knowledge_v2_20261116/run01'
OUT=B/'outputs';OUT.mkdir(exist_ok=False);DETAIL=B/'profile_arrays';DETAIL.mkdir(exist_ok=False)
PAIRS=json.loads((B/'pairs.json').read_text())
FOCUS=['T','Sox2','Sox17','Foxa2','Mesp1','Isl1','Nkx2-5','Tnnt2','Myh6','Myh7','Myl2','Myl7','Pln','Hey2','Kdr','Cdh5','Pecam1','Gata4','Gata6','Rspo3']
INPUTS={};SAMPLE_ROWS=[];COMPOSITIONS=[];ALL_RECORDS=[];AGG={};PAIR_RESULTS=[];AUDITS=[]
def log(s):print(time.strftime('%H:%M:%S'),s,flush=True)
def cor(a,b,method='spearman'):
 a=np.asarray(a);b=np.asarray(b)
 if len(a)<3 or np.ptp(a)==0 or np.ptp(b)==0:return None
 if method=='pearson':return float(np.corrcoef(a,b)[0,1])
 if method=='kendall':return float(stats.kendalltau(a,b).statistic)
 return float(stats.spearmanr(a,b).statistic)
def quant(a):return dict(zip(['p10','median','p90'],map(float,np.quantile(a,[.1,.5,.9])))) if len(a) else None
def cachedir(did):return (B if (B/'cache'/did/'info.json').exists() else OLD)/'cache'/did
def load(did):
 p=cachedir(did);info=json.loads((p/'info.json').read_text());ob=pd.read_csv(p/'obs.csv',keep_default_na=False)
 x=sparse.load_npz(p/'mass.npz').tocsr().astype('float32');x.sum_duplicates();x.eliminate_zeros()
 rs=dict(np.load(p/'row_stats.npz'));assert len(ob)==x.shape[0] and len(info['genes'])==x.shape[1]
 assert len(set(info['genes']))==len(info['genes'])
 invalid=int((~np.isfinite(x.data)).sum());negative=int((x.data<0).sum());assert not invalid and not negative
 if did not in INPUTS:
  audit=info.get('audit');audit={k:v for k,v in audit.items() if k!='selected_rows'} if isinstance(audit,dict) else audit
  INPUTS[did]=dict(id=did,cache_path=str(p),n=len(ob),genes=len(info['genes']),original_features=info.get('original_feature_count',info.get('feature_count_source',len(info['genes']))),stages=sorted(ob.stage.unique()),unit=info['unit'],scope=info.get('scope'),sample_note=info.get('sample_note'),semantics=info['semantics'],invalid_stored_values=invalid,negative_values=negative,files={n:dict(bytes=(p/n).stat().st_size,sha256=sha(p/n)) for n in ['mass.npz','obs.csv','info.json','row_stats.npz']},original_audit=audit,excluded_gene_symbols=info.get('excluded_gene_symbols',[]))
 return dict(info,obs=ob,x=x,stats=rs)
def summarize_group(ds,rows,jj):
 G=len(jj);n=len(rows);s=np.zeros(G);s2=s.copy();lin=s.copy();det=s.copy();rowdet=[];total=[]
 for start in range(0,n,512):
  rr=rows[start:start+512];a=ds['x'][rr][:,jj].astype('float64');t=np.asarray(a.sum(1)).ravel();d=np.diff(a.indptr)
  det+=np.bincount(a.indices,minlength=G);rowdet.extend(d/G);total.extend(t)
  inv=np.divide(1e4,t,out=np.zeros_like(t),where=t>0);a.data*=np.repeat(inv,d)
  lin+=np.asarray(a.sum(0)).ravel();a.data=np.log1p(a.data)
  s+=np.asarray(a.sum(0)).ravel();a.data**=2;s2+=np.asarray(a.sum(0)).ravel()
 total=np.asarray(total);nv=int((total>0).sum());den=nv or 1
 return dict(n=n,n_valid=nv,zero_common_total=n-nv,mean=s/den,variance=np.maximum(s2/den-(s/den)**2,0),linear_mean=lin/den,detection=det/max(n,1),rowdet=np.asarray(rowdet),sum_log=s,detected_counts=det)
def profiles(ds,p,side,genes):
 lookup={g:i for i,g in enumerate(ds['genes'])};jj=np.array([lookup[g] for g in genes]);ob=ds['obs'];stage=p[side+'_stage']
 wanted=ob.stage.eq(stage).to_numpy();assert wanted.any(),(p['id'],side,stage)
 all_groups=[dict(key='ALL',name='全部采集对象',official=None,external=None,primary=False)]+p['groups'];ret={g['key']:[] for g in all_groups}
 for sample in sorted(ob.loc[wanted,'sample'].unique()):
  ix=np.flatnonzero(wanted & ob['sample'].eq(sample).to_numpy());labels=ob.iloc[ix].label.to_numpy();N=len(ix)
  for label in sorted(set(labels)):
   n=int((labels==label).sum());COMPOSITIONS.append(dict(pair=p['id'],side=side,dataset=ds['id'],stage=stage,sample=sample,raw_label=label,n=n,denominator=N,proportion=n/N))
  for group in all_groups:
   rr=ix if group['key']=='ALL' else ix[np.isin(labels,group[side])]
   rec=dict(pair=p['id'],side=side,dataset=ds['id'],stage=stage,sample=sample,group=group['key'],group_name=group['name'],denominator=N,proportion=len(rr)/N)
   if not len(rr):
    SAMPLE_ROWS.append(dict(rec,n=0,n_valid=0,zero_common_total=0,eligible=False));continue
   r=summarize_group(ds,rr,jj);r.update(rec);r['eligible']=r['n_valid']>=30
   r['full_detected_quantiles']=quant(ds['stats']['detected_source'][rr]);r['full_total_quantiles']=quant(ds['stats']['total_source'][rr]);r['common_detection_fraction_quantiles']=quant(r['rowdet'])
   SAMPLE_ROWS.append({k:v for k,v in r.items() if k not in ['mean','variance','linear_mean','detection','rowdet','sum_log','detected_counts']})
   ret[group['key']].append(r)
 return ret
def pool(rr):
 if not rr:return None
 good=[r for r in rr if r['eligible']];used=good or rr
 r={key:np.mean([q[key] for q in used],axis=0) for key in ['mean','variance','linear_mean','detection']}
 r.update(n=sum(q['n'] for q in rr),n_used=sum(q['n'] for q in used),samples=len(rr),samples_used=len(used),eligible=bool(good),small_samples=sum(not q['eligible'] for q in rr),zero_common_total=sum(q['zero_common_total'] for q in rr),sample_names=[q['sample'] for q in used],rowdet=np.concatenate([q['rowdet'] for q in used]),row_weights=np.concatenate([np.full(q['n'],1/q['n']/len(used)) for q in used]),sample_profiles=used)
 return r
def weighted_quantiles(x,w):
 order=np.argsort(x);xx=x[order];cum=np.cumsum(w[order]);return dict(zip(['p10','median','p90'],[float(xx[min(np.searchsorted(cum,q),len(xx)-1)]) for q in [.1,.5,.9]]))
def weighted_ks(x,y,wx,wy):
 a=np.argsort(x);b=np.argsort(y);sx=x[a];sy=y[b];grid=np.unique(np.r_[sx,sy]);cx=np.r_[0,np.cumsum(wx[a])];cy=np.r_[0,np.cumsum(wy[b])]
 return float(np.max(abs(cx[np.searchsorted(sx,grid,side='right')]-cy[np.searchsorted(sy,grid,side='right')])))
def metrics(a,b):
 x=a['mean'];y=b['mean'];dx=a['detection'];dy=b['detection'];anydet=(dx>0)|(dy>0);both=(dx>0)&(dy>0)
 top=lambda z:set(np.argsort(-z,kind='stable')[:min(100,int((z>0).sum()))])
 tx=top(x);ty=top(y);union=tx|ty
 per=[cor(q['mean'][(q['detection']>0)|(dy>0)],y[(q['detection']>0)|(dy>0)]) for q in a['sample_profiles']]
 denom=np.linalg.norm(x)*np.linalg.norm(y)
 return dict(n_genes=len(x),both_all_zero=int((~anydet).sum()),external_only_detected=int(((dx>0)&(dy==0)).sum()),official_only_detected=int(((dy>0)&(dx==0)).sum()),both_detected=int(both.sum()),detected_jaccard=float(both.sum()/anydet.sum()) if anydet.any() else None,spearman_all=cor(x,y),spearman_nonzero_union=cor(x[anydet],y[anydet]),spearman_both_detected=cor(x[both],y[both]),pearson=cor(x,y,'pearson'),kendall=cor(x[anydet],y[anydet],'kendall'),cosine=float(np.dot(x,y)/denom) if denom else None,rmse=float(np.sqrt(np.mean((x-y)**2))),detection_spearman=cor(dx,dy),detection_mean_abs_pp=float(100*np.mean(abs(dx-dy))),detection_signed_mean_pp=float(100*np.mean(dy-dx)),detection_p90_abs_pp=float(100*np.quantile(abs(dx-dy),.9)),linear_mean_log_spearman=cor(np.log1p(a['linear_mean']),np.log1p(b['linear_mean'])),variance_spearman=cor(a['variance'],b['variance']),top100_intersection=len(tx&ty),top100_jaccard=len(tx&ty)/len(union) if union else None,gene_mean_distribution_wasserstein=float(stats.wasserstein_distance(x,y)),cell_detection_wasserstein_pp=float(100*stats.wasserstein_distance(a['rowdet'],b['rowdet'],a['row_weights'],b['row_weights'])),cell_detection_ks=weighted_ks(a['rowdet'],b['rowdet'],a['row_weights'],b['row_weights']),external_cell_detection_quantiles=weighted_quantiles(a['rowdet'],a['row_weights']),official_cell_detection_quantiles=weighted_quantiles(b['rowdet'],b['row_weights']),external_sample_spearman=per,external_mean_detection=float(dx.mean()),official_mean_detection=float(dy.mean()))
def composition(p,side):
 rows=[r for r in COMPOSITIONS if r['pair']==p['id'] and r['side']==side];df=pd.DataFrame(rows);groups=[g for g in p['groups'] if g['primary']]
 arrays=[];sample_rows=[]
 for sample,dd in df.groupby('sample'):
  N=int(dd.denominator.iloc[0]);ns=[int(dd[dd.raw_label.isin(g[side])].n.sum()) for g in groups];assert sum(ns)<=N
  unknown=int(dd[dd.raw_label.str.lower().isin(['unknown','__missing__','na','nan',''])].n.sum())
  ar=np.r_[ns,N-sum(ns)]/N;arrays.append(ar)
  sample_rows.append(dict(sample=sample,n=N,known_mapped=sum(ns),unmapped=N-sum(ns),unknown_explicit=unknown,counts=dict(zip([g['key'] for g in groups]+['UNMAPPED'],ns+[N-sum(ns)]))))
 return dict(groups=[g['key'] for g in groups],proportions=np.mean(arrays,axis=0).tolist(),sample_rows=sample_rows,samples=len(arrays))
def specificity(p,genes):
 gs=[g for g in p['groups'] if g['primary'] and (p['id'],g['key']) in AGG and AGG[p['id'],g['key']]['eligible']]
 if len(gs)<3:return dict(status='insufficient_types',n_types=len(gs),reason='至少3个命名层级可对应且样本量合格的共同类型')
 x=np.array([AGG[p['id'],g['key']]['external']['mean'] for g in gs]);y=np.array([AGG[p['id'],g['key']]['official']['mean'] for g in gs]);x-=x.mean(0);y-=y.mean(0)
 variable=(np.ptp(x,axis=0)>0)&(np.ptp(y,axis=0)>0);unique=variable&((x==x.max(0)).sum(0)==1)&((y==y.max(0)).sum(0)==1)
 xx=x[:,variable];yy=y[:,variable];r=cor(xx.ravel(),yy.ravel());rng=np.random.default_rng(20261116)
 rx=stats.rankdata(xx.ravel()).reshape(xx.shape);ry=stats.rankdata(yy.ravel()).reshape(yy.shape);rx-=rx.mean();ry-=ry.mean();den=np.linalg.norm(rx)*np.linalg.norm(ry)
 null=[float(np.sum(rx[rng.permutation(len(gs))]*ry)/den) for _ in range(100)] if den else []
 return dict(status='calculated',n_types=len(gs),groups=[g['name'] for g in gs],genes=int(variable.sum()),centered_spearman=r,highest_type_agreement=float((np.argmax(x[:,unique],axis=0)==np.argmax(y[:,unique],axis=0)).mean()) if unique.any() else None,unique_max_genes=int(unique.sum()),permuted_type_correlation_quantiles=quant(null),permutation_count=len(null),note='按已有标签比较；100次打乱用于描述，少类型时排列会重复，不作100次独立实验')
def compare(p):
 log('compare '+p['id']+' '+p['external'])
 o=load(p['official']);e=load(p['external']);O=set(o['genes']);E=set(e['genes']);genes=sorted(O&E);assert len(genes)>0
 panel=dict(pair=p['id'],official_genes=len(O),external_genes=len(E),common=len(genes),official_coverage=len(genes)/len(O),external_coverage=len(genes)/len(E),jaccard=len(genes)/len(O|E),unmeasured_external=sorted(O-E),unmeasured_official=sorted(E-O),common_genes=genes)
 dump(OUT/(p['id']+'_panel.json'),panel)
 pp={'official':profiles(o,p,'official',genes),'external':profiles(e,p,'external',genes)}
 del o,e;gc.collect()
 groups=[dict(key='ALL',name='全部采集对象',primary=False)]+p['groups'];records=[];gene_rows=[]
 for g in groups:
  a=pool(pp['external'][g['key']]);b=pool(pp['official'][g['key']]);rec=dict(pair=p['id'],task=p['task'],external_name=p['external_name'],official_stage=p['official_stage'],external_stage=p['external_stage'],group=g['key'],group_name=g['name'],primary=g['primary'],kind=p['kind'],note=g.get('note',p['note']))
  if a is None or b is None:
   rec.update(status='missing_type',external_n=0 if a is None else a['n'],official_n=0 if b is None else b['n'],eligible=False);records.append(rec);continue
  eligible=a['eligible'] and b['eligible'];m=metrics(a,b);rec.update(m,status='calculated' if eligible else 'small_group',eligible=eligible,external_n=a['n'],official_n=b['n'],external_n_used=a['n_used'],official_n_used=b['n_used'],external_samples=a['samples'],official_samples=b['samples'],external_samples_used=a['samples_used'],official_samples_used=b['samples_used'],external_small_samples=a['small_samples'],official_small_samples=b['small_samples'],external_zero_total=a['zero_common_total'],official_zero_total=b['zero_common_total'],external_sample_names=a['sample_names'],official_sample_names=b['sample_names'])
  rec['ranking_eligible']=bool(eligible and g['primary'] and p['kind']=='same_stage');rec['profile_rho_ge_08']=bool(rec['ranking_eligible'] and m['spearman_nonzero_union'] is not None and m['spearman_nonzero_union']>=.8)
  order=np.argsort(-abs(b['detection']-a['detection']),kind='stable');select=list(order[:5])+[genes.index(g) for g in FOCUS if g in genes];rec['gene_examples']=[]
  for i,gene in enumerate(genes):
   row=dict(pair=p['id'],group=g['key'],gene=gene,external_mean=float(a['mean'][i]),official_mean=float(b['mean'][i]),external_detection=float(a['detection'][i]),official_detection=float(b['detection'][i]),detection_difference_pp=float(100*(b['detection'][i]-a['detection'][i])),external_variance=float(a['variance'][i]),official_variance=float(b['variance'][i]))
   gene_rows.append(row)
   if i in select:rec['gene_examples'].append(row)
  rec['largest_detection_gap_genes']=[genes[i] for i in order[:5]]
  save={f'{side}_{key}':poolrec[key] for side,poolrec in [('external',a),('official',b)] for key in ['mean','detection','variance','linear_mean']}
  np.savez_compressed(DETAIL/(p['id']+'_'+g['key']+'.npz'),genes=np.array(genes),**save)
  AGG[p['id'],g['key']]=dict(external={k:v for k,v in a.items() if k not in ['rowdet','row_weights','sample_profiles']},official={k:v for k,v in b.items() if k not in ['rowdet','row_weights','sample_profiles']},eligible=eligible,genes=genes)
  records.append(rec)
 if gene_rows:pd.DataFrame(gene_rows).to_csv(OUT/(p['id']+'_genes.csv.gz'),index=False)
 co=composition(p,'official');ce=composition(p,'external');po=np.array(co['proportions']);pe=np.array(ce['proportions']);assert len(po)==len(pe)
 # Separate unknown buckets; unknown on one side never matches unknown on the other.
 u=np.r_[po[:-1],po[-1],0.];v=np.r_[pe[:-1],0.,pe[-1]]
 comp=dict(official=co,external=ce,coverage_official=float(1-po[-1]),coverage_external=float(1-pe[-1]),descriptive_all_TV=float(abs(u-v).sum()/2),descriptive_all_JS_distance=float(jensenshannon(u,v,base=2)),conditional_TV=None,conditional_JS_distance=None)
 if po[:-1].sum()>0 and pe[:-1].sum()>0:
  xo=po[:-1]/po[:-1].sum();xe=pe[:-1]/pe[:-1].sum();comp.update(conditional_TV=float(abs(xo-xe).sum()/2),conditional_JS_distance=float(jensenshannon(xo,xe,base=2)))
 for i,key in enumerate(co['groups']):
  for rec in records:
   if rec['group']==key:rec.update(official_proportion=float(po[i]),external_proportion=float(pe[i]),proportion_difference_pp=float(100*(po[i]-pe[i])))
 result=dict(**p,panel={k:v for k,v in panel.items() if k not in ['common_genes','unmeasured_official','unmeasured_external']},composition=comp,specificity=specificity(p,genes),records=records)
 dump(OUT/(p['id']+'_result.json'),result);PAIR_RESULTS.append(result);ALL_RECORDS.extend(records)
def trends_and_mapping():
 trends=[];mapping=[];preds=[]
 # Only the same external source and task, with identical normalization gene axes.
 for (task,external),ps_iter in itertools.groupby(sorted(PAIRS,key=lambda p:(p['task'],p['external'],float(p['official_stage'][1:]))),key=lambda p:(p['task'],p['external'])):
  ps=[p for p in ps_iter if p['kind']=='same_stage' and p['official_stage']==p['external_stage']]
  for p1,p2 in zip(ps[:-1],ps[1:]):
   if p1['official_stage']==p2['official_stage']:continue
   keys={g['key'] for g in p1['groups'] if g['primary']}&{g['key'] for g in p2['groups'] if g['primary']}
   for key in sorted(keys):
    a=AGG.get((p1['id'],key));b=AGG.get((p2['id'],key))
    if not a or not b or not a['eligible'] or not b['eligible']:continue
    if a['genes']!=b['genes']:
     trends.append(dict(from_pair=p1['id'],to_pair=p2['id'],group=key,status='different_normalization_gene_axes',reason='各配对基因集不同，不能直接相减其已归一化均值'));continue
    x=b['external']['mean']-a['external']['mean'];y=b['official']['mean']-a['official']['mean'];nz=(x!=0)&(y!=0)
    r1=next(r for r in ALL_RECORDS if r['pair']==p1['id'] and r['group']==key);r2=next(r for r in ALL_RECORDS if r['pair']==p2['id'] and r['group']==key)
    trends.append(dict(from_pair=p1['id'],to_pair=p2['id'],external_name=p1['external_name'],group=key,group_name=r1['group_name'],from_stage=p1['official_stage'],to_stage=p2['official_stage'],status='calculated',spearman=cor(x,y),direction_agreement=float((np.sign(x[nz])==np.sign(y[nz])).mean()) if nz.any() else None,n_nonzero_direction=int(nz.sum()),external_change_rms=float(np.sqrt(np.mean(x*x))),official_change_rms=float(np.sqrt(np.mean(y*y))),external_proportion_delta_pp=100*(r2['external_proportion']-r1['external_proportion']),official_proportion_delta_pp=100*(r2['official_proportion']-r1['official_proportion'])))
 # Predeclared early count-layer series; E8.0 weight source is excluded here.
 keys=[];xx=[];yy=[]
 for p in PAIRS[:2]:
  for g in p['groups']:
   a=AGG.get((p['id'],g['key']))
   if a and a['eligible'] and g['primary']:
    keys.append((p['official_stage'],g['key']));xx.append(a['external']['mean']);yy.append(a['official']['mean'])
 X=np.array(xx);Y=np.array(yy);np.savez(OUT/'mapping_inputs.npz',external=X,official=Y,keys=np.array(keys))
 rng=np.random.default_rng(20261116)
 for axis,field in [(0,'stage'),(1,'type')]:
  for held in sorted({k[axis] for k in keys}):
   test=np.array([k[axis]==held for k in keys]);train=~test;trkeys=[k for k,m in zip(keys,train) if m];stages={k[0] for k in trkeys};types={k[1] for k in trkeys}
   base=dict(split=field,held_out=held,train_groups=trkeys,test_groups=[k for k,m in zip(keys,test) if m],train_stages=len(stages),train_types=len(types))
   if len(stages)<2 or len(types)<3:mapping.append(dict(base,status='insufficient_training_groups'));continue
   A=X[train];C=Y[train];AT=X[test];truth=Y[test];baseline=float(np.mean((AT-truth)**2));perm=np.arange(len(A))
   for s in sorted(stages):
    ix=np.array([i for i,k in enumerate(trkeys) if k[0]==s]);perm[ix]=rng.permutation(ix)
   for shuffled in [False,True]:
    target=C[perm] if shuffled else C
    for model in ['identity','affine','ridge']:
     if model=='identity' and shuffled:continue
     if model=='identity':pr=AT.copy();param={}
     elif model=='affine':
      intercept,slope=np.linalg.lstsq(np.column_stack([np.ones(A.size),A.ravel()]),target.ravel(),rcond=None)[0];pr=intercept+slope*AT;param=dict(intercept=intercept,slope=slope)
     else:
      mu=A.mean(0);sd=A.std(0);sd[sd==0]=1.;z=(A-mu)/sd;zt=(AT-mu)/sd;ym=target.mean(0);coef=(z*(target-ym)).sum(0)/((z*z).sum(0)+1);pr=ym+zt*coef;param=dict(alpha=1,training_only_standardization=True)
     mse=float(np.mean((pr-truth)**2));rec=dict(base,status='calculated',model=model,shuffled=shuffled,permutation=perm.tolist(),params=param,mse=mse,baseline_mse=baseline,relative_improvement=1-mse/baseline,spearman=cor(pr.ravel(),truth.ravel()))
     mapping.append(rec)
     for k,row,t,raw in zip(base['test_groups'],pr,truth,AT):preds.append(dict(split=field,held_out=held,model=model,shuffled=shuffled,stage=k[0],group=k[1],mse=float(np.mean((row-t)**2)),baseline_mse=float(np.mean((raw-t)**2)),spearman=cor(row,t)))
 dump(OUT/'trends.json',trends);dump(OUT/'mapping.json',mapping);pd.DataFrame(preds).to_csv(OUT/'mapping_group_errors.csv',index=False)
def main():
 start=time.time()
 for p in PAIRS:compare(p)
 trends_and_mapping()
 dump(OUT/'inputs.json',INPUTS);dump(OUT/'pair_results.json',PAIR_RESULTS)
 cols=[{k:json.dumps(clean(v),ensure_ascii=False) if isinstance(v,(list,dict)) else v for k,v in r.items() if k not in ['gene_examples']} for r in ALL_RECORDS]
 pd.DataFrame(cols).to_csv(OUT/'all_comparisons.csv',index=False)
 rank=[r for r in ALL_RECORDS if r.get('ranking_eligible')];rank.sort(key=lambda r:-(r['spearman_nonzero_union'] if r['spearman_nonzero_union'] is not None else -2));dump(OUT/'ranked_types.json',rank)
 pd.DataFrame([{k:json.dumps(v) if isinstance(v,dict) else v for k,v in r.items()} for r in SAMPLE_ROWS]).to_csv(OUT/'sample_statistics.csv',index=False)
 pd.DataFrame(COMPOSITIONS).to_csv(OUT/'original_label_composition.csv',index=False)
 dump(OUT/'runtime.json',dict(elapsed_seconds=time.time()-start,python=sys.version,numpy=np.__version__,pandas=pd.__version__,platform=platform.platform(),single_cpu_process=True,comparison_count=len(ALL_RECORDS),ranked_types=len(rank),pairs=len(PAIRS)))
 dump(OUT/'MANIFEST.json',[dict(path=p.name,bytes=p.stat().st_size,sha256=sha(p)) for p in sorted(OUT.iterdir()) if p.name!='MANIFEST.json']);log('complete')
if __name__=='__main__':main()
