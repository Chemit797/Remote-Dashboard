"""Index existing whole-profile comparisons by official task and exact stage."""
from pathlib import Path
import argparse, collections, hashlib, json, math
from bs4 import BeautifulSoup

SITE=Path(__file__).resolve().parents[1]

def build(project):
    project=Path(project)
    pair_file=SITE/'readers/research/vem_pairwise_similarity_v3/comparison.html'
    name_file=project/'catalogs/external_dataset_names.json'
    payload=json.loads(BeautifulSoup(pair_file.read_text(encoding='utf-8'),'html.parser').find(id='payload').get_text())
    names={d['id']:d.get('display_id',d['id'])+' · '+d['name'] for d in json.loads(name_file.read_text(encoding='utf-8'))['datasets']}
    candidates=[];excluded=[]
    for p in payload['pairs']:
        record=next((r for r in p['records'] if r['group']=='ALL'),None)
        reason=None
        if p['official_stage']!=p['external_stage']:reason='different_stage'
        elif p['kind'] in ['near_stage','validation_background']:reason='documented_stage_mismatch'
        elif not record or record.get('status')!='calculated':reason='no_whole_profile_result'
        elif record.get('spearman_nonzero_union') is None or not math.isfinite(record['spearman_nonzero_union']):reason='no_finite_similarity'
        if reason:
            excluded.append(dict(pair=p['id'],reason=reason));continue
        for sid in p['external_ids']:
            assert names[sid] in p['external_name'],(sid,p['external_name'])
        note={'BUBR1_WT_E105':'WT','PITX2_CONTROL_E105':'Control'}.get(p['external'])
        name=p['external_name']+(' · '+note if note else '')
        revision=payload.get('release','e105-same-stage-20261119')
        candidates.append(dict(pair=p['id'],task=p['task'],official=p['official'],official_stage=p['official_stage'],external_stage=p['external_stage'],external=p['external'],external_ids=p['external_ids'],name=name,rho=record['spearman_nonzero_union'],common_genes=p['panel']['common'],observations=record['external_n'],note=p['note'],kind=p['kind'],url='readers/research/vem_pairwise_similarity_v3/comparison.html?v='+revision+'#pair='+p['id']+'&group=ALL'))

    def node(stage,role,official=None,condition='WT',label=None,reason=None,extra_ids=None):
        rows=[dict(r) for r in candidates if r['official']==official] if official else []
        rows.sort(key=lambda r:(-r['rho'],r['external_ids'],r['name'],r['pair']))
        for i,r in enumerate(rows,1):r['rank']=i
        return dict(stage=stage,label=label or stage,role=role,condition=condition,official=official,official_files=extra_ids or ([official] if official else []),rows=rows,empty_reason=reason or ('测试答案尚未公开' if role=='test' else '暂无已计算的同阶段外部对照'))

    groups=[dict(id='T1',parent='T1',title='T1 · 表达时间外推',description='官方核RNA · 心脏及周边取材',nodes=[
        node('E8.5','train','OFF_T1_E8.5_RNA'),node('E9.5','train','OFF_T1_E9.5_RNA'),node('E10.5','validation','OFF_T1_E10.5_RNA'),node('E12.5','test','T1_hidden_test')]),
        dict(id='T2_embryo',parent='T2',title='胚胎 · 插值',description='官方空间数据',nodes=[
        node('E6.75','train','OFF_T2_embryo_E6.75'),node('E7.25','train','OFF_T2_embryo_E7.25'),node('E7.5','validation','OFF_T2_embryo_E7.5'),node('E7.75','test','T2_embryo_hidden_test'),node('E8.0','train','OFF_T2_embryo_E8.0')]),
        dict(id='T2_heart_interp',parent='T2',title='心脏 · 插值',description='验证目标 E8.5',nodes=[
        node('E8.25','train','OFF_T2_heart_E8.25_late',label='E8.25 late ≈ E8.3',reason='外部E8.25与官方实际约E8.3日龄不同，未列入同阶段排名'),node('E8.5','validation','OFF_T2_heart_E8.5'),node('E8.75','train','OFF_T2_heart_E8.75'),node('E9.5','train','OFF_T2_heart_E9.5')]),
        dict(id='T2_heart_extrap',parent='T2',title='心脏 · 外推',description='验证目标 E10.5 · 测试目标 E12.5',nodes=[
        node('E8.25','train','OFF_T2_heart_E8.25_late',label='E8.25 late ≈ E8.3',reason='外部E8.25与官方实际约E8.3日龄不同，未列入同阶段排名'),node('E8.75','train','OFF_T2_heart_E8.75'),node('E9.5','train','OFF_T2_heart_E9.5'),node('E10.5','validation','OFF_T2_heart_E10.5'),node('E12.5','test','T2_heart_hidden_test')]),
        dict(id='T3',parent='T3',title='T3 · 扰动预测',description='WT参照与各敲除条件分别列出',nodes=[
        node('E8.75','reference','OFF_T2_heart_E8.75',label='E8.75 · WT参照'),
        node('E8.75','validation','OFF_T3_E8.75_gata4_ko_1',condition='Gata4 KO · 重复1',label='E8.75 · Gata4 KO',reason='暂无同阶段且基因型、驱动与对照条件匹配的外部结果'),
        node('E8.75','validation','OFF_T3_E8.75_gata4_ko_2',condition='Gata4 KO · 重复2',label='E8.75 · Gata4 KO',reason='暂无同阶段且基因型、驱动与对照条件匹配的外部结果'),
        node('E8.75','test','T3_hidden_test',condition='Ctnnb1 KO',label='E8.75 · Ctnnb1 KO'),
        node('E9.5','reference','OFF_T2_heart_E9.5',label='E9.5 · WT参照'),
        node('E9.5','train','OFF_T3_E9.5_mab21l2_ko',condition='Mab21l2 KO',label='E9.5 · Mab21l2 KO',reason='暂无同阶段且扰动条件匹配的外部结果')])]
    for g in groups:
        for n in g['nodes']:
            assert len({r['pair'] for r in n['rows']})==len(n['rows'])
            assert all(r['official_stage']==r['external_stage']==n['stage'] for r in n['rows'])
    data=dict(version=payload.get('released_on','2026-11-20'),metric='spearman_nonzero_union',metric_label='整体表达相关 ρ',limit=8,method='每个配对在共同实测基因内归一化、log1p，再按样本等权平均；删除双方全零基因，计算Spearman相关。',scope_note='各行附共同基因数。已分开计算的品系和重复各列一行。按胚胎等权汇总的来源在每个阶段列一行，点击查看重复。',groups=groups,candidate_count=len(candidates),excluded=excluded,sources=[dict(path=p.relative_to(root).as_posix(),sha256=hashlib.sha256(p.read_bytes()).hexdigest()) for p,root in [(pair_file,SITE),(name_file,project)]])
    text=json.dumps(data,ensure_ascii=False,separators=(',',':'))
    (SITE/'data/stage-rankings.json').write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n',encoding='utf-8',newline='\n')
    (SITE/'assets/stage-rankings-data.js').write_text('window.VEM_STAGE_RANKINGS='+text+';\n',encoding='utf-8',newline='\n')
    print(json.dumps(dict(groups=len(groups),official_nodes=sum(len(g['nodes']) for g in groups),same_stage_candidates=len(candidates),excluded=len(excluded)),ensure_ascii=False))

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--project',required=True);build(parser.parse_args().project)
