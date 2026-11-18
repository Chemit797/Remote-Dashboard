"""Independent arithmetic checks on frozen outputs; writes only a new audit folder."""
from pathlib import Path
import sys,json,itertools,collections
import numpy as np,pandas as pd
from data_io import load_dataset,dump,sha,ROOT
B=Path(sys.argv[1]);O=B/'outputs';V=B/'verification';V.mkdir(exist_ok=False)
infos=json.loads((O/'input_manifest.json').read_text());plan=json.loads((B/'test_plan.json').read_text());spec={t['id']:t for t in plan['tests']}
checks=[];joint=[];expression=[]
def check(name,ok,**kw):
 checks.append(dict(check=name,pass_=bool(ok),**kw));assert ok,(name,kw)
for info in infos:
 ds=load_dataset(B,info['id']);ob=ds['obs'];x=ds['x'];z=ds['native'];comp=pd.read_csv(O/(ds['id']+'_composition.csv'))
 check(ds['id']+'_total',comp.n.sum()==len(ob))
 for key,ss in comp.groupby(['stage','sample']):
  n=len(ob[(ob.stage==key[0])&(ob['sample']==key[1])]);check(ds['id']+'_denominator_'+str(key),ss.n.sum()==n and (ss.denominator==n).all() and np.allclose(ss.proportion,ss.n/n))
 if ds['source']!='OFFICIAL':
  day=ob.stage.str.replace('E','',regex=False).astype(float)
  gate=(~((day>7.25)&(day<8.0))) if ds['id']=='EMTAB6967' else (day.between(8.75,9.5) if ds['id']=='QIU228590' else day.eq(9.5) if ds['id'] in ['FENG193346_CD1','MOSTA_E9.5'] else day.eq(8.0))
  check(ds['id']+'_allowed_stages',gate.all(),stages=sorted(ob.stage.unique()))
 ts=json.loads((O/(ds['id']+'_tests.json')).read_text());lookup={g:i for i,g in enumerate(ds['genes'])}
 for t in ts:
  if t['kind']!='joint' or 'block' in t:continue
  s=spec[t['test_id']];g=s['genes'];j=[lookup[t.get('gene_resolution',{}).get(v,v)] for v in g]
  for row in t['records']:
   mask=ob.stage.eq(row['stage'])&ob['sample'].eq(row['sample'])
   for field,values in s['target'].items():mask &= ob[field].isin(values)
   vals=x[np.flatnonzero(mask.to_numpy())][:,j].toarray()>0
   ct=collections.Counter(tuple(map(int,v)) for v in vals)
   for pattern in itertools.product([0,1],repeat=len(g)):joint.append(dict(claim_id=t['claim_id'],dataset=ds['id'],sample=row['sample'],stage=row['stage'],genes=g,pattern=pattern,n=ct[pattern],denominator=len(vals)))
   check(t['test_id']+'_'+row['sample']+'_joint',ct[(1,)*len(g)]==row['joint_detected'] and len(vals)==row['n'])
 # Selected expression values checked by dense scalar summation, not sparse.mean.
 if ds['id'] in ['OFF_T1_E10.5_RNA','OFF_T2_heart_E9.5','QIU228590']:
  for t in ts:
   if t['kind']!='diff' or 'block' in t:continue
   s=spec[t['test_id']]
   for row in t['records']:
    if 'difference' not in row:continue
    ms=ob.stage.eq(row['stage'])&ob['sample'].eq(row['sample']);sides=[]
    for sel in [s['target'],s['comparator']]:
     mask=ms.copy()
     for f,vs in sel.items():mask &= ob[f].isin(vs)
     sides.append(np.flatnonzero(mask.to_numpy()))
    for k,g in enumerate(s['genes']):
     jj=lookup[g];a=z[sides[0],jj].toarray().ravel().tolist();b=z[sides[1],jj].toarray().ravel().tolist();d=sum(a)/len(a)-sum(b)/len(b)
     err=abs(d-row['difference'][k]);check(t['test_id']+'_'+row['sample']+'_'+g,err<1e-10)
     expression.append(dict(test=t['test_id'],sample=row['sample'],gene=g,alternative_difference=d,recorded_difference=row['difference'][k],absolute_error=err))
 del ds,x,z
# Original metadata re-read, separate algorithm for a representative proportion.
p=ROOT/'Virtual_Embryo_External_Data/01_datasets/T1_Temporal/T1-01__VED-001__E-MTAB-6967/raw/preexisting_official_asset/meta.csv'
md=pd.read_csv(p,dtype=str,keep_default_na=False);keep=md[(md.doublet=='FALSE')&(md.stripped=='FALSE')&md.stage.isin(['E6.75','E7.25'])];recomputed=[]
for (stage,sample),g in keep.groupby(['stage','sample']):recomputed.append(dict(stage=stage,sample='EMTAB_pool_'+sample,n=int(g.celltype.eq('Primitive Streak').sum()),denominator=len(g)))
t=next(t for t in json.loads((O/'EMTAB6967_tests.json').read_text()) if t['claim_id']=='D008')
check('D008_independent_metadata_proportion',all(any(x['stage']==r['stage'] and x['sample']==r['sample'] and x['n']==r['n'] and x['denominator']==r['denominator'] for x in recomputed) for r in t['records']))
# Rebuild paired profiles from exported per-sample records, independently refit folds.
folds=json.loads((O/'mapping_folds.json').read_text());errors=[]
for pid in sorted({r['pair'] for r in folds if r['status']=='evaluated'}):
 meta=pd.read_csv(O/(pid+'_profile_metadata.csv'));val=pd.read_csv(O/(pid+'_profiles.csv.gz'));wide=val.pivot(index='profile_id',columns='gene',values='mean_logCP10k')
 tab=meta[meta.n_valid>=30].set_index('profile_id').join(wide);cols=list(wide.columns);agg=tab.groupby(['source','stage','group'])[cols].mean()
 for f in [r for r in folds if r['pair']==pid and r['status']=='evaluated' and not r['shuffled']]:
  train=f['train_groups'];test=f['test_groups'];X=np.array([agg.loc[('external',*k)] for k in train]);Y=np.array([agg.loc[('official',*k)] for k in train]);A=np.array([agg.loc[('external',*k)] for k in test]);T=np.array([agg.loc[('official',*k)] for k in test])
  axis=0 if f['split']=='stage' else 1;check(pid+'_'+f['split']+'_'+f['held_out']+'_no_leak',all(k[axis]!=f['held_out'] for k in train))
  if f['model']=='identity':P=A
  elif f['model']=='affine':
   xf=X.ravel();yf=Y.ravel();slope=np.cov(xf,yf,ddof=0)[0,1]/np.var(xf);intercept=yf.mean()-slope*xf.mean();P=intercept+slope*A
  else:
   mu=X.mean(0);sd=X.std(0);sd[sd==0]=1;Z=(X-mu)/sd;W=(A-mu)/sd;P=np.empty_like(T)
   for j in range(X.shape[1]):
    D=np.column_stack([np.ones(len(Z)),Z[:,j]]);coef=np.linalg.solve(D.T@D+np.diag([0.,1.]),D.T@Y[:,j]);P[:,j]=coef[0]+coef[1]*W[:,j]
  mse=float(np.average(np.square(P-T)));error=abs(mse-f['mse']);check(pid+'_'+f['split']+'_'+f['held_out']+'_'+f['model']+'_independent_mse',error<1e-9)
  errors.append(dict(pair=pid,split=f['split'],held=f['held_out'],model=f['model'],alternative_mse=mse,recorded_mse=f['mse'],absolute_error=error))
dump(V/'joint_contingencies.json',joint);dump(V/'expression_check.json',expression);dump(V/'proportion_check.json',recomputed);dump(V/'mapping_check.json',errors);dump(V/'CHECKS.json',dict(checks=checks,passed=len(checks),failed=sum(not x['pass_'] for x in checks)))
dump(V/'MANIFEST.json',[dict(path=p.name,sha256=sha(p),bytes=p.stat().st_size) for p in sorted(V.iterdir()) if p.is_file() and p.name!='MANIFEST.json'])
print(json.dumps({'passed':len(checks),'max_mapping_error':max([x['absolute_error'] for x in errors],default=0)}),flush=True)
