"""Prepare newly admitted sources; previous results remain read-only."""
from pathlib import Path
import sys,json,gc,time,zipfile
import numpy as np
import pandas as pd
from scipy import sparse
from data_io import ROOT,LIB,sha,dump,staged_csc,emtab
B=Path(sys.argv[1]);C=B/'cache';C.mkdir(exist_ok=True)
CAN=ROOT/'experiments/T1-v1-20261008/cache/canonical'
def log(s):print(time.strftime('%H:%M:%S'),s,flush=True)
def read_selected_npz(p,rows):
 """CSR entries selected before numeric parsing; ZipExtFile skips other bytes."""
 with np.load(p) as z:
  shape=tuple(z['shape']);fmt=str(z['format'].item().decode());ptr=z['indptr']
 assert fmt=='csr'
 rows=np.asarray(rows);assert np.all(np.diff(rows)>0)
 lens=ptr[rows+1]-ptr[rows];op=np.r_[0,np.cumsum(lens)]
 starts=np.r_[0,np.flatnonzero(np.diff(rows)>1)+1];ends=np.r_[starts[1:],len(rows)]
 out=[]
 with zipfile.ZipFile(p) as archive:
  for member in ['data.npy','indices.npy']:
   with archive.open(member) as f:
    version=np.lib.format.read_magic(f)
    sh,order,dtype=np.lib.format._read_array_header(f,version)
    assert not order
    offset=f.tell();dest=np.empty(int(op[-1]),dtype=dtype)
    for a,b in zip(starts,ends):
     lo,hi=int(ptr[rows[a]]),int(ptr[rows[b-1]+1]);f.seek(offset+lo*dtype.itemsize)
     dest[op[a]:op[b]]=np.frombuffer(f.read((hi-lo)*dtype.itemsize),dtype=dtype)
   out.append(dest)
 return sparse.csr_matrix((out[0],out[1],op),shape=(len(rows),shape[1]))
def save(did,x,genes,obs,**info):
 p=C/did;p.mkdir(exist_ok=False)
 x=x.tocsr();x.sum_duplicates();x.eliminate_zeros()
 assert x.shape==(len(obs),len(genes)) and np.isfinite(x.data).all() and (x.data>=0).all()
 counts=pd.Series(genes).value_counts();bad=sorted(counts[counts>1].index.astype(str));keep=np.array([bool(g) and g not in ['nan','None'] and counts[g]==1 for g in genes]);discard=[str(g) for g,k in zip(genes,keep) if not k]
 total=np.asarray(x.sum(1)).ravel();det=np.diff(x.indptr)
 xx=x[:,keep].astype('float32');sparse.save_npz(p/'mass.npz',xx)
 obs=obs.reset_index(drop=True);obs.to_csv(p/'obs.csv',index=False)
 np.savez(p/'row_stats.npz',total_source=total,detected_source=det)
 inf=dict(id=did,genes=np.asarray(genes)[keep].tolist(),original_feature_count=len(genes),excluded_gene_symbols=discard,duplicate_symbols=bad,n=len(obs),**info)
 dump(p/'info.json',inf)
 manifest=dict(info=inf,files={n:sha(p/n) for n in ['mass.npz','obs.csv','row_stats.npz','info.json']})
 dump(p/'MANIFEST.json',manifest);log(f'saved {did}: {xx.shape}')
def canonical(ved,rep,did,ages,semantics,unit,sample_note):
 p=CAN/ved/rep;report=json.loads((p/'report.json').read_text());ob=pd.read_parquet(p/'cells.parquet');gg=pd.read_parquet(p/'genes.parquet')
 assert (gg.observed==True).all()
 for name,expected in report['files'].items():assert sha(p/name)==expected,(p,name)
 rows=np.flatnonzero(ob.age_value.astype(float).isin(ages))
 assert len(rows)
 # Only the allowed selected rows are parsed, even if another allowed age is present.
 x=read_selected_npz(p/'X.npz',rows)
 ob=ob.iloc[rows].copy();assert np.all(ob.age_value.astype(float)<=9.5)
 if semantics=='inverse_log_relative_mass_not_raw_counts':x.data=np.expm1(x.data.astype(float))
 if semantics=='verified_integer_counts':assert np.allclose(x.data,np.rint(x.data),atol=0,rtol=0)
 oo=pd.DataFrame({'cell_id':ob.cell_uid.to_numpy(),'label':ob.source_celltype.to_numpy(),'sample':ob.sample_id.to_numpy(),'stage':['E'+str(float(v)) for v in ob.age_value]})
 save(did,x,gg.symbol.fillna('').astype(str).tolist(),oo,source=ved,unit=unit,scope=ob.dissection.unique().tolist(),semantics=semantics,sample_note=sample_note,audit=dict(canonical_path=str(p),report=report,report_sha256=sha(p/'report.json'),selected_rows=rows.tolist(),source_metadata_verified=True,unselected_values_parsed=False))
 del x;gc.collect()
if __name__=='__main__':
 log('prepare started')
 canonical('VED-003','e95_moca_matrix_tome_qc','TOME3_E95',[9.5],'verified_integer_counts','nucleus','15作者胚胎；计数来自VED-008，注释及QC来自VED-003；两者只算一个数据对象')
 canonical('VED-004','raw_counts','TOME4_E85',[8.5],'verified_integer_counts','nucleus','12个作者RT组；不能据字段名改称12个独立胚胎')
 canonical('VED-006','wt_alltimepoints','DESOYSA_WT',[8.25,9.25],'inverse_log_relative_mass_not_raw_counts','cell','每阶段WT1/WT2样本；池化字段保留，不推断独立胚胎数')
 canonical('VED-010','called_cells','HEART230531_E85',[8.5],'integer_like_our_QC','cell','仅第2份E8.5文件；沿用旧knee筛选；第1份压缩文件损坏；无原类型标签')
 canonical('VED-019','e95_tsv','OSR1_E95',[9.5],'integer_like_unverified','cell','Osr1阳性SHF富集；仅533个对象，无更细类型')
 folder=ROOT/'experiments/T1-v1-20261008/cache/staging/VED-002'
 ob=pd.read_csv(folder/'cells_meta.csv');q=set((folder/'postqc_cells_pbmc_data.txt').read_text().splitlines())
 stage=ob.cell.str.split('_').str[0].map({'E720':'E7.25','E825':'E8.25'})
 rows=np.flatnonzero(ob.cell.isin(q)&stage.notna());assert len(rows)>0
 x,gg,ids=staged_csc(folder,rows,'raw_');assert np.array_equal(ob.cell.to_numpy(),ids)
 assert np.allclose(np.asarray(x.sum(1)).ravel(),ob.iloc[rows].nUMI.to_numpy(),atol=0,rtol=0)
 oo=pd.DataFrame({'cell_id':ob.iloc[rows].cell.to_numpy(),'label':'Mesp1-lineage (untyped)','sample':['stage_pool_'+s for s in stage.iloc[rows]],'stage':stage.iloc[rows].to_numpy()})
 save('MESP1_ALLOWED',x,gg,oo,source='VED-002',unit='cell',scope='FACS tdTomato+ Mesp1 lineage',semantics='verified_integer_counts',sample_note='阶段池化，不能恢复E8.25各GSM，缺细胞类型',audit=dict(path=str(folder),source_metadata='GSE176306_geo_stage.json',staging_sha256={p.name:sha(p) for p in folder.iterdir() if p.is_file()},restricted_values_parsed=False))
 del x;gc.collect()
 raw=LIB/'T1_Temporal/T1-01__VED-001__E-MTAB-6967/raw/preexisting_official_asset'
 feat=pd.read_csv(raw/'genes.tsv',sep='\t',header=None)
 ds=emtab(B,set(feat[1]));ds['x']=ds['x'].astype('float32')
 # The full symbol axis replaces the old 613-gene projection for new T1 comparisons.
 save('EMTAB_FULL',ds['x'],ds['genes'],ds['obs'],source='VED-001',unit=ds['unit'],scope=ds['scope'],semantics=ds['semantics'],sample_note='作者QC保留的独立混合样本，保护阶段在解析表达前排除',audit=ds['audit'])
 dump(B/'PREPARED.json',dict(caches=[p.name for p in C.iterdir() if (p/'info.json').exists()],status='complete'))
 log('prepare complete')
