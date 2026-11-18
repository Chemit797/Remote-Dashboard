"""Independent teaching calculation following audited public formulas.

Does not import or execute the downloaded repository. No competition data,
H5AD prediction, model evaluation, or online submission is used.
"""
import json
from pathlib import Path
import numpy as np
from scipy.stats import mannwhitneyu, rankdata
from sklearn.decomposition import PCA
from sklearn.metrics.pairwise import rbf_kernel
from sklearn.neighbors import NearestNeighbors

ROOT=Path(__file__).resolve().parent
base=np.array([1.,2.,3.,4.,5.,6.])
delta=np.array([.8,-.7,.6,-.5,.4,0.])
state=np.array([.3,-.3,.2,-.2,.1,-.1])
sign=np.tile([1.,-1.],10)[:,None]
ref=np.tile(base,(20,1))
truth=base+delta+sign*state
predictions={
    'same_cells_reversed':truth[::-1].copy(),
    'correct_mean_collapsed':np.tile(base+delta,(20,1)),
    'half_response_with_states':base+.5*delta+sign*state,
    'copy_reference':ref.copy(),
}

dt=truth.mean(0)-ref.mean(0)
_,p=mannwhitneyu(truth,ref,axis=0,alternative='two-sided')
order=np.argsort(p)
passed=p[order] <= .05*np.arange(1,7)/6
k=int(np.flatnonzero(passed).max()+1) if passed.any() else 0
de=order[:k]
de=de[np.abs(dt[de])>=.25]
up=de[dt[de]>0]; down=de[dt[de]<0]

def overlap(d):
    order=np.argsort(-np.asarray(d,float))
    pu=order[:len(up)]; pd=order[len(order)-len(down):]
    return (len(np.intersect1d(pu,up))+len(np.intersect1d(pd,down)))/len(de)

chance=max(overlap(base),overlap(-base))

def mmd(pred):
    rng=np.random.default_rng(0)
    pca=PCA(n_components=min(30,truth.shape[1]),random_state=0).fit(truth)
    A=pca.transform(pred[rng.choice(len(pred),min(2000,len(pred)),replace=False)])
    B=pca.transform(truth[rng.choice(len(truth),min(2000,len(truth)),replace=False)])
    d2=((B[:,None]-B[None,:])**2).sum(-1)
    gamma=1/(np.median(d2[d2>0])+1e-9)
    terms=[]
    for scale in [.25,.5,1,2,4]:
        aa=rbf_kernel(A,A,gamma*scale); bb=rbf_kernel(B,B,gamma*scale)
        ab=rbf_kernel(A,B,gamma*scale)
        np.fill_diagonal(aa,0); np.fill_diagonal(bb,0)
        terms.append(float(aa.sum()/(len(A)*(len(A)-1))+bb.sum()/(len(B)*(len(B)-1))-2*ab.mean()))
    return float(np.mean(terms))

def css(pred):
    rng=np.random.default_rng(0)
    A=pred[rng.choice(len(pred),min(1500,len(pred)),replace=False)]
    B=truth[rng.choice(len(truth),min(1500,len(truth)),replace=False)]
    i=rng.integers(0,6,20000); j=rng.integers(0,6,20000)
    keep=i!=j; i,j=i[keep],j[keep]
    va=np.sqrt(np.abs(A[:,i]-A[:,j])).mean(0)
    vb=np.sqrt(np.abs(B[:,i]-B[:,j])).mean(0)
    return float(np.mean((va-vb)**2))

def evaluate(pred):
    dp=pred.mean(0)-ref.mean(0)
    no_effect=np.std(dp)<.01*np.std(dt)
    raw=0. if no_effect else overlap(dp)
    des=0. if no_effect else (raw-chance)/(1-chance)
    C=np.corrcoef([rankdata(dp),rankdata(dt),rankdata(base)]) if not no_effect else None
    if no_effect or not np.isfinite(C).all() or 1-abs(C[0,2])<1e-6:
        dcs=0.
    else:
        dcs=float(np.clip((C[0,1]-C[0,2]*C[1,2])/np.sqrt(max((1-C[0,2]**2)*(1-C[1,2]**2),1e-12)),-1,1))
    beta=float(dt[de]@dp[de]/(dt[de]@dt[de]))
    r2=1-float(np.sum((dp[de]-beta*dt[de])**2))/max(float(np.sum((dp[de]-dp[de].mean())**2)),1e-12)
    slope=float(np.log(.001)) if no_effect or beta<=0 or r2<=.01 else float(np.log(beta))
    return dict(mean=pred.mean(0).tolist(),delta=dp.tolist(),overlap=raw,DES=des,DCS=dcs,beta=beta,PSS=slope,R2=0. if no_effect else r2,MMD=mmd(pred),CSS=css(pred),variance_ratio=float(pred.var(0).mean()/truth.var(0).mean()))

rows={name:evaluate(x) for name,x in predictions.items()}
assert set(up)=={0,2,4} and set(down)=={1,3}
assert np.isclose(chance,.4)
assert all(np.isclose(rows[x]['DES'],1) for x in list(rows)[:3])
assert all(np.isclose(rows[x]['DCS'],1) for x in list(rows)[:3])
assert np.isclose(rows['half_response_with_states']['beta'],.5)
assert np.allclose(predictions['correct_mean_collapsed'].mean(0),truth.mean(0))
assert rows['correct_mean_collapsed']['CSS'] > rows['same_cells_reversed']['CSS']
assert rows['correct_mean_collapsed']['MMD'] > rows['same_cells_reversed']['MMD']

# Verify the self-neighbor behavior of the exact sklearn call used by NFS.
coords=np.column_stack([np.arange(20,dtype=float),np.zeros(20),np.zeros(20)])
idx=NearestNeighbors(n_neighbors=15).fit(coords).kneighbors(coords)[1]
assert all(i in idx[i] for i in range(20))

out=dict(scope='Independent local teaching reproduction; not a competition score or execution of the repository',genes=list('ABCDEF'),reference_row=base.tolist(),truth_two_rows=[(base+delta+state).tolist(),(base+delta-state).tolist()],rows_per_state=10,truth_mean=truth.mean(0).tolist(),true_delta=dt.tolist(),up=[list('ABCDEF')[i] for i in up],down=[list('ABCDEF')[i] for i in down],p_values=p.tolist(),chance=chance,results=rows,knn_includes_self=True)
(ROOT/'TOY_RESULTS.json').write_text(json.dumps(out,ensure_ascii=False,indent=2),encoding='utf-8')
np.savez(ROOT/'TOY_ARRAYS.npz',reference=ref,truth=truth,**predictions)
print(json.dumps(out,ensure_ascii=False,indent=2))
