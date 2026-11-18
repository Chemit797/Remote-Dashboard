"""Independent arithmetic checks of saved pair outputs (no refitting predictions)."""
from pathlib import Path
import sys,json,math
import numpy as np
import pandas as pd
from scipy import sparse,stats
from data_io import sha,dump,ROOT
B=Path(sys.argv[1]);O=B/'outputs';OLD=ROOT/'experiments/vem_prior_knowledge_v2_20261116/run01'
PAIRS=json.loads((B/'pairs.json').read_text());RESULT=json.loads((O/'pair_results.json').read_text());CHECK=[]
def check(name,ok,**detail):
 CHECK.append(dict(name=name,passed=bool(ok),**detail))
 if not ok:raise AssertionError(name)
def cdir(did):return (B if (B/'cache'/did/'info.json').exists() else OLD)/'cache'/did
for p,r in zip(PAIRS,RESULT):
 A=set(json.loads((cdir(p['official'])/'info.json').read_text())['genes']);E=set(json.loads((cdir(p['external'])/'info.json').read_text())['genes'])
 panel=json.loads((O/(p['id']+'_panel.json')).read_text())
 check(p['id']+' panel',set(panel['common_genes'])==A.intersection(E) and set(panel['unmeasured_external'])==A.difference(E) and panel['common']==len(A.intersection(E)))
 for side in ['official','external']:
  cc=r['composition'][side]
  for s in cc['sample_rows']:check(p['id']+' '+side+' '+s['sample']+' denominator',sum(s['counts'].values())==s['n'] and s['known_mapped']+s['unmapped']==s['n'])
  check(p['id']+' '+side+' proportions',abs(sum(cc['proportions'])-1)<1e-12)
 for rec in r['records']:
  f=B/'profile_arrays'/(p['id']+'_'+rec['group']+'.npz')
  if not f.exists():continue
  z=np.load(f);a=z['external_mean'];b=z['official_mean'];da=z['external_detection'];db=z['official_detection'];keep=(da>0)|(db>0)
  check(p['id']+' '+rec['group']+' zero_partition',rec['both_all_zero']+rec['both_detected']+rec['external_only_detected']+rec['official_only_detected']==len(a))
  check(p['id']+' '+rec['group']+' detection_pp',abs(100*sum(abs(float(v)-float(w)) for v,w in zip(da,db))/len(da)-rec['detection_mean_abs_pp'])<1e-10)
  if rec['spearman_nonzero_union'] is not None:
   ra=stats.rankdata(a[keep]);rb=stats.rankdata(b[keep]);ra-=ra.mean();rb-=rb.mean();rho=float(ra@rb/math.sqrt(float(ra@ra)*float(rb@rb)))
   check(p['id']+' '+rec['group']+' spearman',abs(rho-rec['spearman_nonzero_union'])<1e-12,error=abs(rho-rec['spearman_nonzero_union']))
  check(p['id']+' '+rec['group']+' ranking_gate',not rec.get('ranking_eligible') or (rec['primary'] and rec['eligible'] and p['kind']=='same_stage'))
df=pd.read_csv(O/'original_label_composition.csv')
for key,g in df.groupby(['pair','side','sample']):check(str(key)+' raw labels sum',g.n.sum()==g.denominator.iloc[0])
# Dense blocks are a second implementation of sparse aggregation for representative
# small and full-transcriptome groups. It reads actual cache matrices again.
for pid,gkey in [('P001','streak'),('P012','endocardium')]:
 p=next(p for p in PAIRS if p['id']==pid);group=next(g for g in p['groups'] if g['key']==gkey)
 expected=np.load(B/'profile_arrays'/(pid+'_'+gkey+'.npz'));genes=expected['genes'].tolist()
 for side in ['official','external']:
  folder=cdir(p[side]);info=json.loads((folder/'info.json').read_text());obs=pd.read_csv(folder/'obs.csv',keep_default_na=False);x=sparse.load_npz(folder/'mass.npz').astype('float32');look={g:i for i,g in enumerate(info['genes'])};jj=[look[g] for g in genes];means=[];dets=[]
  mask=(obs.stage==p[side+'_stage'])&obs.label.isin(group[side])
  for sample in sorted(obs.loc[mask,'sample'].unique()):
   rows=np.flatnonzero(mask & obs['sample'].eq(sample));summ=np.zeros(len(genes));det=summ.copy();nv=0
   for i in range(0,len(rows),128):
    a=x[rows[i:i+128]][:,jj].toarray().astype('float64');tot=a.sum(axis=1);valid=tot>0;det+=(a>0).sum(axis=0);nv+=int(valid.sum());a[valid]=np.log1p(a[valid]/tot[valid,None]*10000);summ+=a[valid].sum(axis=0)
   if nv>=30:means.append(summ/nv);dets.append(det/len(rows))
  check(pid+' '+gkey+' '+side+' independent dense expression',len(means)>0 and np.max(abs(np.mean(means,axis=0)-expected[side+'_mean']))<1e-7,max_error=float(np.max(abs(np.mean(means,axis=0)-expected[side+'_mean']))))
  check(pid+' '+gkey+' '+side+' independent dense detection',np.max(abs(np.mean(dets,axis=0)-expected[side+'_detection']))<1e-12)
  del x
# Training-only transformation and group holdouts replayed from input arrays.
z=np.load(O/'mapping_inputs.npz');X=z['external'];Y=z['official'];keys=[tuple(k) for k in z['keys']];folds=json.loads((O/'mapping.json').read_text())
for n,r in enumerate(folds):
 if r['status']!='calculated':continue
 tr=[keys.index(tuple(k)) for k in r['train_groups']];te=[keys.index(tuple(k)) for k in r['test_groups']];axis=0 if r['split']=='stage' else 1
 check('mapping split '+str(n),not set(tr)&set(te) and all(keys[i][axis]!=r['held_out'] for i in tr) and all(keys[i][axis]==r['held_out'] for i in te))
 a=X[tr];target=Y[tr];at=X[te];truth=Y[te]
 if r['shuffled']:
  perm=r['permutation'];check('mapping within-stage permutation '+str(n),all(keys[tr[i]][0]==keys[tr[j]][0] for i,j in enumerate(perm)));target=target[perm]
 if r['model']=='identity':pred=at
 elif r['model']=='affine':
  aa=a.ravel();tt=target.ravel();slope=np.sum((aa-aa.mean())*(tt-tt.mean()))/np.sum((aa-aa.mean())**2);intercept=tt.mean()-slope*aa.mean();pred=intercept+slope*at
 else:
  pred=np.empty_like(truth)
  for j in range(a.shape[1]):
   mu=float(a[:,j].mean());sd=float(a[:,j].std()) or 1.;v=(a[:,j]-mu)/sd;design=np.column_stack([np.ones(len(v)),v]);penalty=np.diag([0.,1.]);beta=np.linalg.solve(design.T@design+penalty,design.T@target[:,j]);pred[:,j]=beta[0]+beta[1]*(at[:,j]-mu)/sd
 mse=math.fsum(float(v-w)**2 for v,w in zip(pred.ravel(),truth.ravel()))/truth.size
 check('mapping independent MSE '+str(n),abs(mse-r['mse'])<1e-9,max_error=abs(mse-r['mse']))
dump(O/'INDEPENDENT_VERIFICATION.json',dict(checks=len(CHECK),passed=all(c['passed'] for c in CHECK),items=CHECK))
dump(O/'FINAL_MANIFEST.json',[dict(path=p.name,bytes=p.stat().st_size,sha256=sha(p)) for p in sorted(O.iterdir()) if p.name!='FINAL_MANIFEST.json'])
print(json.dumps({'checks':len(CHECK),'passed':True}),flush=True)
