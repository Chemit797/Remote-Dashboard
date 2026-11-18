"""Frozen descriptive audit; no predictions or competition score calls."""
from pathlib import Path
import sys,json,time,platform,gc,itertools
import numpy as np
import pandas as pd
from scipy import sparse,stats
from data_io import *

BASE=Path(sys.argv[1]);OUT=BASE/'outputs';OUT.mkdir(exist_ok=True)
CONFIG=json.loads((BASE/'test_plan.json').read_text())
REQUESTED=json.loads((BASE/'required_genes.json').read_text())

def log(s):print(time.strftime('%Y-%m-%d %H:%M:%S'),s,flush=True)
def csv(p,rows):pd.DataFrame(rows).to_csv(p,index=False)
def corr(a,b):
 a=np.asarray(a);b=np.asarray(b)
 return float(stats.spearmanr(a,b).statistic) if np.ptp(a)>0 and np.ptp(b)>0 else None
def mean(x):return np.asarray(x.mean(0)).ravel()
def quant(x):return dict(zip(['min','p25','median','p75','max'],np.quantile(x,[0,.25,.5,.75,1]).tolist()))

def summary(ds):
 ob=ds['obs'];x=ds['x'];z=ds['native'];genes=ds['genes'];records=[];compo=[];markers=[]
 all_det=ds['detected_source'] if 'detected_source' in ds else np.asarray((x>0).sum(1)).ravel()
 gi=[i for i,g in enumerate(genes) if g in REQUESTED];gg=[genes[i] for i in gi]
 for (stage,sample),ix in ob.groupby(['stage','sample'],sort=True).indices.items():
  ix=np.asarray(ix);xx=x[ix];zz=z[ix];tot=ds.get('total_source',ds['total'])[ix]
  det=all_det[ix]
  records.append(dict(dataset=ds['id'],source=ds['source'],stage=stage,sample=sample,n=len(ix),unit=ds['unit'],scope=ds['scope'],semantics=ds['semantics'],measured_features=ds.get('feature_count_source',len(genes)),cached_features=len(genes),total=quant(tot),detected=quant(det),zero_fraction=1-float(det.mean())/ds.get('feature_count_source',len(genes)),zero_total=int((tot==0).sum()),nonzero_native=quant(zz.data) if zz.nnz else None))
  for label,inds in ob.iloc[ix].groupby('label',sort=True).indices.items():
   r=ix[inds];a=x[r][:,gi];b=z[r][:,gi];n=len(r)
   compo.append(dict(dataset=ds['id'],source=ds['source'],stage=stage,sample=sample,label=label,n=n,denominator=len(ix),proportion=n/len(ix),small_group=n<30,unit=ds['unit']))
   mu=mean(b);detect=np.asarray((a>0).sum(0)).ravel()
   for k,g in enumerate(gg):markers.append(dict(dataset=ds['id'],stage=stage,sample=sample,label=label,gene=g,n=n,mean_logCP10k=float(mu[k]),detected=int(detect[k]),detection_rate=float(detect[k]/n)))
 csv(OUT/(ds['id']+'_composition.csv'),compo)
 csv(OUT/(ds['id']+'_markers.csv.gz'),markers)
 dump(OUT/(ds['id']+'_summary.json'),records)
 return {'id':ds['id'],'source':ds['source'],'n':x.shape[0],'n_genes':len(genes),'stages':sorted(ob.stage.unique()),'labels':sorted(ob.label.unique()),'sample_count':ob['sample'].nunique(),'unit':ds['unit'],'scope':ds['scope'],'semantics':ds['semantics'],'genotype':ds['genotype'],'audit':ds['audit'],'genes':genes}

def choose(ob,spec):
 mask=np.ones(len(ob),dtype=bool)
 for field,values in spec.items():
  if field not in ob:return np.zeros(len(ob),dtype=bool)
  mask &= ob[field].isin(values).to_numpy()
 return mask

def run_tests(ds):
 out=[];ob=ds['obs'];lookup={g:i for i,g in enumerate(ds['genes'])};resolutions={g:g for g in ds['genes']}
 for original,approved in CONFIG.get('authority_aliases',{}).items():
  if original not in lookup and approved in lookup:lookup[original]=lookup[approved];resolutions[original]=approved
 for t in CONFIG['tests']:
  if ds['id'] not in t['datasets']:continue
  rr=dict(test_id=t['id'],claim_id=t['claim'],dataset=ds['id'],source=ds['source'],scope=t.get('scope','full'),kind=t['kind'],records=[])
  genes=t.get('genes',[]);missing=sorted(set(genes)-lookup.keys());rr['missing_genes']=missing;rr['gene_resolution']={g:resolutions.get(g) for g in genes}
  if missing:rr['block']='面板未覆盖';out.append(rr);continue
  steps=t.get('stages',[]);filt=ob.stage.isin(steps).to_numpy() if steps else np.ones(len(ob),bool)
  if not filt.any():rr['block']='未观测到指定阶段';out.append(rr);continue
  gg=[lookup[g] for g in genes]
  if t.get('aggregation')=='stage_unpaired_sample_equal':
   for stage in sorted(ob.loc[filt,'stage'].unique()):
    sub=ob.loc[filt & ob.stage.eq(stage).to_numpy()];sides=[]
    for spec in [t['target'],t['comparator']]:
     group=[]
     for sample,ix0 in sub.groupby('sample').groups.items():
      ix=np.array(list(ix0));r=ix[choose(ob.iloc[ix],spec)]
      if len(r):group.append(dict(sample=sample,n=len(r),mean=mean(ds['native'][r][:,gg]),detection=mean(ds['x'][r][:,gg]>0)))
     sides.append(group)
    if all(sides):
     a,b=sides;am=np.mean([q['mean'] for q in a],0);bm=np.mean([q['mean'] for q in b],0)
     rr['records'].append(dict(stage=stage,sample='unpaired_equal_chamber_samples',n=sum(q['n'] for q in a),n_comparator=sum(q['n'] for q in b),denominator=len(sub),small_group=any(q['n']<30 for q in a+b),genes=genes,mean_logCP10k=am.tolist(),comparator_mean_logCP10k=bm.tolist(),difference=(am-bm).tolist(),detection_rate=np.mean([q['detection'] for q in a],0).tolist(),comparator_detection_rate=np.mean([q['detection'] for q in b],0).tolist(),target_samples=clean(a),comparator_samples=clean(b),note='不同心腔独立取材组的等权描述，未按生物个体配对'))
   if not rr['records']:rr['block']='没有同时具有指定比较组的阶段'
   out.append(rr);continue
  for (stage,sample),ix in ob.loc[filt].groupby(['stage','sample'],sort=True).groups.items():
   ix=np.array(list(ix));target=ix[choose(ob.iloc[ix],t.get('target',{}))]
   comp=t.get('comparator');other=ix[choose(ob.iloc[ix],comp)] if comp is not None else np.setdiff1d(ix,target)
   if len(target)==0:
    if t['kind']=='proportion':rr['records'].append(dict(stage=stage,sample=sample,n=0,denominator=len(ix),proportion=0.,small_group=True,genes=[]))
    continue
   a=ds['x'][target][:,gg];z=ds['native'][target][:,gg];n=len(target)
   r=dict(stage=stage,sample=sample,n=n,n_comparator=len(other),denominator=len(ix),proportion=n/len(ix),small_group=n<30,genes=genes,mean_logCP10k=mean(z).tolist() if genes else [],detected=np.asarray((a>0).sum(0)).ravel().tolist() if genes else [])
   if t['kind'] in ['diff','presence','module','joint'] and genes:
    r['detection_rate']=(np.asarray((a>0).sum(0)).ravel()/n).tolist()
   if t['kind']=='diff' and len(other):
    b=ds['native'][other][:,gg];r['comparator_mean_logCP10k']=mean(b).tolist();r['difference']=(mean(z)-mean(b)).tolist();r['comparator_detection_rate']=(np.asarray((ds['x'][other][:,gg]>0).sum(0)).ravel()/len(other)).tolist();r['small_group']=r['small_group'] or len(other)<30
   if t['kind']=='joint':
    joint=np.asarray((a>0).sum(1)).ravel()==len(genes)
    r['joint_detected']=int(joint.sum());r['joint_rate']=float(joint.mean())
    # Independent implementation: set intersection of positive row IDs.
    sets=[set(a[:,j].nonzero()[0].tolist()) for j in range(len(genes))]
    r['independent_joint_count']=len(set.intersection(*sets))
    assert r['joint_detected']==r['independent_joint_count']
   if t['kind']=='module' and len(other):
    total=ds.get('total_source',ds['total']);r['modules']={}
    for name,gs in t['gene_sets'].items():
     jj=[lookup[g] for g in gs];v=np.asarray(ds['x'][:,jj].sum(1)).ravel();v=np.divide(v,total,out=np.full(len(v),np.nan),where=total>0)
     r['modules'][name]={'target_UMI_fraction':float(np.nanmean(v[target])),'comparator_UMI_fraction':float(np.nanmean(v[other])),'difference':float(np.nanmean(v[target])-np.nanmean(v[other]))}
   rr['records'].append(r)
  if not rr['records']:rr['block']='指定阶段没有原命题所需标签或区域'
  out.append(rr)
 dump(OUT/(ds['id']+'_tests.json'),out)

def build_datasets():
 infos=[]
 def handle(ds):
  log('summarize '+ds['id']);info=summary(ds);run_tests(ds);save_dataset(BASE,ds);infos.append(info);gc.collect()
 for p,stage,task in official_paths():handle(official(p,stage,task))
 # EMTAB projection covers every shared official panel gene plus literature genes.
 panel=set(REQUESTED)
 for i in infos:
  if i['id'].startswith('OFF_T2'):panel.update(i['genes'])
 handle(emtab(BASE,panel));handle(qiu());handle(feng())
 for ds in stereo():handle(ds)
 handle(mosta())
 dump(OUT/'input_manifest.json',infos)
 return infos

def profiles(ds,stages,mapping,genes,pair):
 ob=ds['obs'];lookup={g:i for i,g in enumerate(ds['genes'])};jj=[lookup[g] for g in genes]
 xx=ds['x'][:,jj];z,total=norm(xx);group=ob.label.map(mapping).fillna('UNMAPPED');out=[];coverage=[]
 for (stage,sample),inds in ob.groupby(['stage','sample']).indices.items():
  if stage not in stages:continue
  ix=np.array(inds);coverage.append(dict(pair=pair,dataset=ds['id'],stage=stage,sample=sample,n=len(ix),mapped_n=int((group.iloc[ix]!='UNMAPPED').sum()),zero_common_total=int((total[ix]==0).sum()),denominator='all retained observations in source sample',unit=ds['unit']))
  for label in sorted(group.iloc[ix].unique()):
   if label=='UNMAPPED':continue
   rows=ix[(group.iloc[ix].to_numpy()==label)];valid=rows[total[rows]>0]
   if not len(valid):continue
   out.append(dict(pair=pair,source='official' if ds['source']=='OFFICIAL' else 'external',dataset=ds['id'],stage=stage,sample=sample,group=label,n=len(rows),n_valid=len(valid),denominator=len(ix),proportion=len(rows)/len(ix),mean=mean(z[valid]),detection=mean(xx[rows]>0),zero_common_total=len(rows)-len(valid)))
 return out,coverage

def mapping_test(pair,keys,x,y):
 # Fixed models. Each row is one equal-sample stage x type mean.
 records=[];preds=[];rng=np.random.default_rng(20261116)
 for axis,field in [(0,'stage'),(1,'type')]:
  for held in sorted(set(k[axis] for k in keys)):
   test=np.array([k[axis]==held for k in keys]);train=~test;tk=[k for k,m in zip(keys,train) if m]
   ns=len(set(k[0] for k in tk));nt=len(set(k[1] for k in tk))
   if ns<2 or nt<3:
    records.append(dict(pair=pair,split=field,held_out=held,status='insufficient_training_groups',train_stages=ns,train_types=nt,required='at least 2 stages and 3 types'));continue
   X=x[train];Y=y[train];Xt=x[test];Yt=y[test]
   permutation=np.arange(len(X))
   for s in sorted(set(k[0] for k in tk)):
    ids=np.array([i for i,k in enumerate(tk) if k[0]==s]);permutation[ids]=rng.permutation(ids)
   baseline=float(np.mean((Xt-Yt)**2))
   for shuffled in [False,True]:
    Ytr=Y[permutation] if shuffled else Y
    for model in ['identity','affine','ridge']:
     if shuffled and model=='identity':continue
     if model=='identity':P=Xt.copy();params={}
     elif model=='affine':
      a,b=np.linalg.lstsq(np.column_stack([np.ones(X.size),X.ravel()]),Ytr.ravel(),rcond=None)[0];P=a+b*Xt;params={'intercept':float(a),'slope':float(b)}
     else:
      mu=X.mean(0);sd=X.std(0);sd[sd==0]=1.;Z=(X-mu)/sd;Zt=(Xt-mu)/sd;ym=Ytr.mean(0)
      coef=(Z*(Ytr-ym)).sum(0)/((Z*Z).sum(0)+1.);P=ym+Zt*coef;params={'alpha':1,'training_only_standardization':True}
     err=float(np.mean((P-Yt)**2));independent=float(sum(float(np.dot(a-b,a-b)) for a,b in zip(P,Yt))/P.size)
     assert abs(err-independent)<1e-10
     rec=dict(pair=pair,split=field,held_out=held,status='evaluated',train_stages=ns,train_types=nt,train_groups=[list(k) for k in tk],test_groups=[list(k) for k,m in zip(keys,test) if m],model=model,shuffled=shuffled,mse=err,baseline_mse=baseline,relative_MSE_improvement=1-err/baseline if baseline else None,spearman=corr(P.ravel(),Yt.ravel()),independent_mse=independent,params=params)
     records.append(rec)
     for k,pred,truth,raw in zip([k for k,m in zip(keys,test) if m],P,Yt,Xt):
      preds.append(dict(pair=pair,split=field,held_out=held,stage=k[0],group=k[1],model=model,shuffled=shuffled,mse=float(np.mean((pred-truth)**2)),baseline_mse=float(np.mean((raw-truth)**2)),spearman=corr(pred,truth)))
 return records,preds

def compare(infos):
 allsim=[];allspecific=[];allchanges=[];allmaps=[];allpred=[];allcov=[];pairdefs=[]
 for pair in CONFIG['pairs']:
  pid=pair['id'];log('compare '+pid)
  selected=[i for i in infos if i['id'] in pair['official']+pair['external']]
  if len(selected)!=len(pair['official'])+len(pair['external']):raise ValueError(pid+' missing dataset')
  genes=sorted(set.intersection(*(set(i['genes']) for i in selected)))
  rows=[]
  for i in selected:
   ds=load_dataset(BASE,i['id']);q,c=profiles(ds,pair['stages'],pair['official_map'] if i['source']=='OFFICIAL' else pair['external_map'],genes,pid);rows.extend(q);allcov.extend(c);del ds;gc.collect()
  # Export all samples (including small samples); qualifying groups separately.
  arr=[];rowmeta=[]
  for j,r in enumerate(rows):
   rowmeta.append({k:v for k,v in r.items() if k not in ['mean','detection']})
   for g,m,d in zip(genes,r['mean'],r['detection']):arr.append(dict(profile_id=j,gene=g,mean_logCP10k=float(m),detection_rate=float(d)))
  csv(OUT/(pid+'_profile_metadata.csv'),[dict(profile_id=i,**r) for i,r in enumerate(rowmeta)])
  csv(OUT/(pid+'_profiles.csv.gz'),arr)
  pools={};pooldet={};counts={}
  for source in ['external','official']:
   for stage,group in sorted(set((r['stage'],r['group']) for r in rows)):
    rr=[r for r in rows if r['source']==source and r['stage']==stage and r['group']==group and r['n_valid']>=30]
    if not rr:continue
    pools[source,stage,group]=np.mean([r['mean'] for r in rr],axis=0);pooldet[source,stage,group]=np.mean([r['detection'] for r in rr],axis=0);counts[source,stage,group]=len(rr)
  keys=sorted((s,g) for src,s,g in pools if src=='external' and ('official',s,g) in pools)
  pddef=dict(**pair,genes=genes,n_genes=len(genes),matched_groups=[dict(stage=s,group=g,external_samples=counts['external',s,g],official_samples=counts['official',s,g]) for s,g in keys],minimum_n_per_sample_type=30,normalization='common genes per observation total 10000 then log1p; zero common total excluded from expression means and explicitly counted',equal_sample_weight=True)
  pairdefs.append(pddef);genecomp=[]
  for s,g in keys:
   x=pools['external',s,g];y=pools['official',s,g];dx=pooldet['external',s,g];dy=pooldet['official',s,g]
   allsim.append(dict(pair=pid,stage=s,group=g,n_genes=len(genes),spearman=corr(x,y),mse=float(np.mean((x-y)**2)),mean_detection_difference=float(np.mean(dy-dx)),external_samples=counts['external',s,g],official_samples=counts['official',s,g]))
   for k,gene in enumerate(genes):genecomp.append(dict(stage=s,group=g,gene=gene,external_mean=x[k],official_mean=y[k],difference=y[k]-x[k],external_detection=dx[k],official_detection=dy[k],detection_difference=dy[k]-dx[k]))
  csv(OUT/(pid+'_gene_comparison.csv.gz'),genecomp)
  for s in sorted(set(k[0] for k in keys)):
   groups=[g for st,g in keys if st==s]
   if len(groups)<2:continue
   a=np.array([pools['external',s,g] for g in groups]);b=np.array([pools['official',s,g] for g in groups]);a-=a.mean(0);b-=b.mean(0)
   variable=(np.ptp(a,axis=0)>0)&(np.ptp(b,axis=0)>0)
   tie_a=(a==a.max(0)).sum(0)>1;tie_b=(b==b.max(0)).sum(0)>1;unique=variable&~tie_a&~tie_b
   agree=(np.argmax(a[:,unique],axis=0)==np.argmax(b[:,unique],axis=0))
   allspecific.append(dict(pair=pid,stage=s,groups=groups,n_variable_genes=int(variable.sum()),centered_spearman=corr(a[:,variable].ravel(),b[:,variable].ravel()),highest_type_agreement=float(agree.mean()) if len(agree) else None,n_unique_maximum_both=int(unique.sum()),ties_external=int(tie_a.sum()),ties_official=int(tie_b.sum()),note='type centered within each source; both sources must have a unique maximum for highest-type agreement'))
  for g in sorted(set(k[1] for k in keys)):
   stages=sorted([s for s,gr in keys if gr==g],key=lambda x:float(x[1:]))
   for s1,s2 in zip(stages[:-1],stages[1:]):
    dx=pools['external',s2,g]-pools['external',s1,g];dy=pools['official',s2,g]-pools['official',s1,g];nz=(dx!=0)&(dy!=0)
    allchanges.append(dict(pair=pid,group=g,from_stage=s1,to_stage=s2,spearman=corr(dx,dy),sign_agreement=float((np.sign(dx[nz])==np.sign(dy[nz])).mean()) if nz.any() else None,n_nonzero_direction=int(nz.sum()),external_delta_rms=float(np.sqrt(np.mean(dx**2))),official_delta_rms=float(np.sqrt(np.mean(dy**2)))))
  if keys:
   maps,preds=mapping_test(pid,keys,np.array([pools['external',s,g] for s,g in keys]),np.array([pools['official',s,g] for s,g in keys]));allmaps+=maps;allpred+=preds
 dump(OUT/'pair_definitions.json',pairdefs);csv(OUT/'cross_source_similarity.csv',allsim);dump(OUT/'type_specificity.json',allspecific);csv(OUT/'stage_changes.csv',allchanges);dump(OUT/'mapping_folds.json',allmaps);csv(OUT/'mapping_group_errors.csv',allpred);csv(OUT/'mapping_coverage.csv',allcov)

if __name__=='__main__':
 start=time.time();log('begin')
 if '--compare-only' in sys.argv:infos=json.loads((OUT/'input_manifest.json').read_text())
 else:infos=build_datasets()
 compare(infos)
 dump(OUT/'runtime.json',dict(elapsed_seconds=time.time()-start,python=sys.version,numpy=np.__version__,pandas=pd.__version__,platform=platform.platform(),threads=1))
 files=[p for p in OUT.iterdir() if p.is_file() and p.name!='MANIFEST.json'];dump(OUT/'MANIFEST.json',[dict(path=p.name,bytes=p.stat().st_size,sha256=sha(p)) for p in sorted(files)])
 log('complete')
