"""Task-separated teaching arithmetic; imports no downloaded repository code."""
from pathlib import Path
import json
import numpy as np
from scipy.stats import mannwhitneyu, rankdata, wasserstein_distance
from sklearn.decomposition import PCA
from sklearn.metrics.pairwise import rbf_kernel
from sklearn.neighbors import NearestNeighbors

ROOT=Path(__file__).resolve().parent
ref=np.tile([1.,2.,3.],(20,1))
truth=np.repeat([[3.,1.,3.],[1.,1.,3.]],10,axis=0)
prediction=np.repeat([[2.5,1.,3.],[1.5,1.,3.]],10,axis=0)

def distribution(pred,true):
    rng=np.random.default_rng(0)
    pca=PCA(n_components=min(30,true.shape[1]),random_state=0).fit(true)
    A=pca.transform(pred[rng.choice(len(pred),min(2000,len(pred)),replace=False)])
    B=pca.transform(true[rng.choice(len(true),min(2000,len(true)),replace=False)])
    d2=((B[:,None]-B[None,:])**2).sum(-1)
    gamma=1/(np.median(d2[d2>0])+1e-9)
    terms=[]
    for scale in [.25,.5,1,2,4]:
        aa=rbf_kernel(A,A,gamma*scale);bb=rbf_kernel(B,B,gamma*scale);ab=rbf_kernel(A,B,gamma*scale)
        np.fill_diagonal(aa,0);np.fill_diagonal(bb,0)
        terms.append(aa.sum()/(len(A)*(len(A)-1))+bb.sum()/(len(B)*(len(B)-1))-2*ab.mean())
    rng=np.random.default_rng(0)
    a=pred[rng.choice(len(pred),min(1500,len(pred)),replace=False)]
    b=true[rng.choice(len(true),min(1500,len(true)),replace=False)]
    i=rng.integers(0,pred.shape[1],20000);j=rng.integers(0,pred.shape[1],20000)
    keep=i!=j;i,j=i[keep],j[keep]
    va=np.sqrt(np.abs(a[:,i]-a[:,j])).mean(0)
    vb=np.sqrt(np.abs(b[:,i]-b[:,j])).mean(0)
    return {'MMD':float(np.mean(terms)),'CSS':float(np.mean((va-vb)**2))}

dt=truth.mean(0)-ref.mean(0);dp=prediction.mean(0)-ref.mean(0)
_,p=mannwhitneyu(truth,ref,axis=0,alternative='two-sided')
order=np.argsort(p);passed=p[order]<=.05*np.arange(1,4)/3
de=order[:int(np.flatnonzero(passed).max()+1)]
de=de[np.abs(dt[de])>=.25]
up=de[dt[de]>0];dn=de[dt[de]<0]
def overlap(d):
    order=np.argsort(-d)
    return (len(np.intersect1d(order[:len(up)],up))+len(np.intersect1d(order[len(order)-len(dn):],dn)))/len(de)
chance=max(overlap(ref.mean(0)),overlap(-ref.mean(0)))
C=np.corrcoef([rankdata(dp),rankdata(dt),rankdata(ref.mean(0))])
dcs=(C[0,1]-C[0,2]*C[1,2])/np.sqrt((1-C[0,2]**2)*(1-C[1,2]**2))
t1=dict(reference_mean=ref.mean(0).tolist(),truth_mean=truth.mean(0).tolist(),prediction_mean=prediction.mean(0).tolist(),delta_true=dt.tolist(),delta_pred=dp.tolist(),p_values=p.tolist(),up=up.tolist(),down=dn.tolist(),overlap=overlap(dp),chance=chance,DES=(overlap(dp)-chance)/(1-chance),DCS=float(dcs),**distribution(prediction,truth))

# An independent T2 teaching input: expression exactly correct, coordinates doubled.
coords=np.column_stack([np.arange(20,dtype=float),np.zeros((20,2))])
pred_coords=2*coords
rms=lambda x:float(np.sqrt(((x-x.mean(0))**2).sum(1).mean()))
norm_true=(coords-coords.mean(0))/rms(coords)
norm_pred=(pred_coords-pred_coords.mean(0))/rms(pred_coords)
assert np.allclose(norm_pred,norm_true)
idx_true=NearestNeighbors(n_neighbors=15).fit(coords).kneighbors(coords)[1]
idx_pred=NearestNeighbors(n_neighbors=15).fit(pred_coords).kneighbors(pred_coords)[1]
ntrue=truth[idx_true].mean(1);npred=truth[idx_pred].mean(1)
assert np.allclose(ntrue,npred)
rng=np.random.default_rng(0)
def point_distances(x):
    i=rng.integers(0,len(x),200000);j=rng.integers(0,len(x),200000);keep=i!=j
    return np.linalg.norm(x[i[keep]]-x[j[keep]],axis=1)/rms(x)
sdd=float(wasserstein_distance(point_distances(pred_coords),point_distances(coords)))
t2=dict(expression_metrics=distribution(truth,truth),radius_true=rms(coords),radius_pred=rms(pred_coords),TSR=float(np.log(rms(pred_coords)/rms(coords))),SDD=sdd,normalized_coords_identical=True,ODS=1.,first_cell_neighborhood_indices=idx_true[0].tolist(),first_cell_neighborhood_mean=ntrue[0].tolist(),neighborhood_profiles_identical=True,NFS=distribution(npred,ntrue)['MMD'])

t3=json.loads((ROOT/'repository_review/TOY_RESULTS.json').read_text(encoding='utf-8'))
out=dict(scope='independent task-separated local teaching arithmetic, not official scores',T1=t1,T2=t2,T3_half_response=t3['results']['half_response_with_states'],calibration_example=dict(metric='T1 validation MMD, synthetic raw unrelated to toy matrix',raw=.04,floor=.08359,ceiling=.00406,skill=(.08359-.00406)/((.08359-.00406)+(.04-.00406))))
assert t1['DES']==1 and np.isclose(t1['DCS'],1)
assert np.isclose(t2['TSR'],np.log(2))
assert np.isclose(t2['expression_metrics']['CSS'],0,atol=1e-25)
(ROOT/'TASK_EXAMPLES.json').write_text(json.dumps(out,ensure_ascii=False,indent=2),encoding='utf-8')
np.savez(ROOT/'TASK_EXAMPLE_ARRAYS.npz',reference=ref,truth=truth,t1_prediction=prediction,t2_pred_expression=truth,t2_true_coords=coords,t2_pred_coords=pred_coords)
print(json.dumps(out,ensure_ascii=False,indent=2))
