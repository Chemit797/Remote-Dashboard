"""Build a curated static VEM website from fixed local review evidence.

Reads analysis results only; never runs their code or opens expression matrices.
Usage: python -X utf8 26VEM/scripts/build_data.py --project D:/Project/virtualembryo_biocosmosX
"""
from pathlib import Path
import argparse,collections,csv,datetime,hashlib,json,re,shutil
import markdown
from bs4 import BeautifulSoup

parser=argparse.ArgumentParser()
parser.add_argument('--project',type=Path,required=True)
args=parser.parse_args()
P=args.project.resolve(); SITE=Path(__file__).resolve().parents[1]
R=P/'reports/analysis_integration_20261118'; PEER=R/'peer_analysis'
SOURCES=[]
def source(path):
    path=Path(path)
    if not any(x['path']==path.relative_to(P).as_posix() for x in SOURCES):
        SOURCES.append({'path':path.relative_to(P).as_posix(),'bytes':path.stat().st_size,
                        'sha256':hashlib.sha256(path.read_bytes()).hexdigest()})
    return path
def read(path):return source(path).read_text(encoding='utf-8-sig')
def load(path):return json.loads(read(path))
def csvrows(path):return list(csv.DictReader(read(path).splitlines()))
def write_json(path,data):
    path.parent.mkdir(parents=True,exist_ok=True)
    path.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n',encoding='utf-8',newline='\n')
def jsfile(path,var,data):
    path.parent.mkdir(parents=True,exist_ok=True)
    text=json.dumps(data,ensure_ascii=False,separators=(',',':'),allow_nan=False)
    path.write_text(f'window.{var}='+text+';\n',encoding='utf-8',newline='\n')
def number(value):
    try:
        f=float(value)
        return round(f,8) if abs(f)<1e15 and f==f else None
    except (ValueError,TypeError):return None
def flag(value):return str(value).lower()=='true'

names=load(P/'catalogs/external_dataset_names.json')
named={x['id']:f"{x.get('display_id',x['id'])} · {x['name']}" for x in names['datasets']}
display_ids={x['id']:x.get('display_id',x['id']) for x in names['datasets']}
legacy_labels={x['id']+' · '+x['name']:named[x['id']] for x in names['datasets'] if x['id']!=display_ids[x['id']]}
def current_labels(value):
    if isinstance(value,str):
        for old,new in legacy_labels.items():value=value.replace(old,new)
        return value
    if isinstance(value,list):return [current_labels(v) for v in value]
    if isinstance(value,dict):return {k:current_labels(v) for k,v in value.items()}
    return value
inventory=csvrows(PEER/'official_data_analysis_20261114/tables/file_inventory.csv')
official=[]
for row in inventory:
    task='T1' if row['role'].startswith('T1') else 'T2_embryo' if row['role'].startswith('T2_embryo') else 'T3' if row['role'].startswith('T3') else 'T2_heart'
    official.append({'id':row['file_id'],'task':task,'stage':row['stage_from_filename'],
        'role':'开发验证' if 'validation' in row['role'].lower() else '训练/参考',
        'cells':int(row['cells']),'genes':int(row['genes']),'spatial':flag(row['spatial_3D']),
        'bytes':int(row['bytes']),'sha256':row['sha256'],
        'detected_median':number(row['median_detected_genes']),
        'zero_cells':int(row['all_zero_cells']),'label_count':int(row['raw_label_count']),
        'scale':'发布 log1p(CP10k)，counts层语义另行审计',
        'specimen_note':row['independent_unit_status']})
assert len(official)==15 and sum(x['cells'] for x in official)==590352
registry=load(P/'research/vem_prior_knowledge_v2/provenance/dataset_registry.json')
stages=load(R/'data_review/team/data_review_20261113/evidence/ved_stages.json')
external=[]
for row in registry['datasets']:
    id=row['ved_id']; meta=stages.get(id,{})
    external.append({'id':id,'display_id':display_ids[id],'name':named[id],'tasks':row['current_research_tasks'],
        'stage_text':row['stage_readable'],'stages':meta.get('ages_parsed',[]),
        'stage_basis':'2026-11-13元数据解析参考；并非所有阶段都可用于预测',
        'tissue':row['tissue_readable'],'assay':meta.get('assay','见来源元数据'),
        'unit':row['observation_unit'],'scope':row['proposed_numeric_scope'],
        'limits':row['comparison_limits_and_exclusions'],'priority':row['research_priority'],
        'availability':row['availability'],'urls':row['accession_urls'],
        'public_id':row['public_id']})
release_catalog=P/'catalogs/dashboard_external_releases.json'
releases=load(release_catalog)['releases'] if release_catalog.is_file() else []
extension_pairs=[]
for release in releases:
    accession=release['id']
    assert accession in named and accession not in {row['id'] for row in external}
    new_pairs=[]
    if 'intake_json' in release:
        intake=load(P/release['intake_json'])
        assert intake['id']==accession
        samples=[{k:s[k] for k in ['id','accession','stage','group','note'] if k in s} for s in intake['samples']]
    else:
        samples=load(P/release['summary'])['samples']
        new_pairs=load(P/release['reader_input'])
        assert {sample['id']:sample['cells'] for sample in samples}=={
            row['sample_id']:int(row['n_cells_or_units']) for row in csvrows(P/release['intake'])
        }
    coverage=[dict(pair=p['id'], task={'T2_heart':'T2 心脏','T2_embryo':'T2 胚胎'}.get(p['task'],p['task']),
        stage=p['official_stage'], common=p['panel']['common'], rho=p['records'][0]['spearman_nonzero_union'])
        for p in new_pairs]
    external.append({k:release[k] for k in ['id','tasks','stage_text','stages','stage_basis','tissue',
        'assay','unit','scope','limits','priority','availability','urls']} | {
        'name':named[accession],'display_id':display_ids[accession],'public_id':accession,'aliases':next(x.get('aliases',[]) for x in names['datasets'] if x['id']==accession),
        'samples':samples,'comparisons':coverage,'added_on':release['date']})
    if 'quantitative_summary' in release:
        bulk=load(P/release['quantitative_summary'])
        bulk_source=bulk['sources'][accession]
        external[-1]['bulk_evidence']={
            'date':bulk['date'],'method':bulk['method'],'mapping':bulk_source['mapping'],
            'expression':bulk_source['expression'],
            'response':[{k:v for k,v in row.items() if k!='scatter'} for row in bulk_source['response']],
            'download_root':'readers/research/gata4_bulk_similarity_20261121/data/'}
    extension_pairs.extend(
        {**r,'task':{'T2_heart':'T2 心脏','T2_embryo':'T2 胚胎'}.get(r['task'],r['task'])}
        for p in new_pairs for r in p['records']
    )

claims=[]
for line in read(P/'research/vem_prior_knowledge_v2/knowledge.jsonl').splitlines():
    row=json.loads(line); legacy=row.get('legacy_reading',{})
    checks={}
    for which in ['official','external']:
        check=row[which+'_check']
        tests=[]
        for t in check.get('tests',[]):
            keys=['test_id','status','reason','kind','source_relation','scope','comparison_zh','number_summary','number_lines',
                  'records','missing_genes','dataset_subset']
            item={k:t[k] for k in keys if k in t}
            did=t.get('external_dataset_id')
            if did:item['source']=named.get(did,t.get('display_source',did))
            tests.append(item)
        checks[which]={'status':check.get('status','证据不足'),'reason':check.get('reason',''),
                       'tests':tests,'observations':check.get('observations',[])}
    claims.append({'id':row['id'],'title':row['statement_zh'],'original_statement':row.get('original_statement',''),
        'category':row['category'],'task':row['task'],'stages':row['stages'],'cell':legacy.get('cell_name') or row.get('cell_type_zh') or row.get('cell_type'),
        'genes':row.get('genes',[]),'source_names':[named[x] for x in row.get('external_dataset_ids',[]) if x in named],
        'source_url':row.get('source_url'),'doi':row.get('doi'),'quote':row.get('quote'),
        'source_note':legacy.get('source_text',''),'takeaway':legacy.get('takeaway',''),
        'locator':row.get('locator'),'checks':checks})
assert len(claims)==108
summary=load(P/'research/vem_prior_knowledge_v2/SUMMARY.json')
assert dict(collections.Counter(x['checks']['official']['status'] for x in claims))==summary['official']

axis=[]
for row in csvrows(PEER/'t2_heart_analysis_20261116/tables/gene_500_axes_ledger.csv'):
    axis.append({'gene':row['gene'],'type':row['leading_type'],
        'type_marker':flag(row['persistent_type_marker']),'stable':flag(row['approximately_stable_abundance']),
        'stage_types':int(row['time_associated_types']),'spatial_types':int(row['recurrent_spatial_types']),
        'gap':number(row['min_top_second_gap']),'detection':number(row['min_leading_type_detection'])})
neighbours=[]
for row in csvrows(PEER/'t2_heart_analysis_20261116/tables/all_gene_neighbour_scan.csv'):
    neighbours.append({'stage':row['stage'],'type':row['cell_type'],'gene':row['gene'],'n':int(row['n']),
        'det':number(row['detection']),'base':number(row['r2_position']),'neighbour':number(row['r2_neighbour']),
        'delta':number(row['delta_r2']),'shuffle_delta':number(row['delta_over_shuffled']),
        'eligible':flag(row['eligible']),'hit':flag(row['practical_hit'])})
assert len(neighbours)==9500 and len({x['gene'] for x in neighbours if x['hit']})==236
jsfile(SITE/'assets/neighbours.js','VEM_NEIGHBOURS',neighbours)
pairs=[]
completion_root=P/'research/validation_completion_20261119'
completion=load(completion_root/'COMPLETION_SUMMARY.json')
pair_table=completion_root/'overlays/research/vem_pairwise_similarity_v3/results/all_comparisons.csv'
external_root=P/'research/external_E10p5_analysis_20261119'
new_pair_table=external_root/'overlays/research/vem_pairwise_similarity_v3/results/all_comparisons.csv'
if new_pair_table.is_file():pair_table=new_pair_table
for row in [*csvrows(pair_table),*extension_pairs]:
    keys=['pair','task','external_name','official_stage','external_stage','group','group_name','kind','note']
    item={k:row.get(k,'') for k in keys}
    item.update({k:number(row.get(k)) for k in ['n_genes','pearson','spearman_all','detection_mean_abs_pp','detected_jaccard']})
    pairs.append(item)
metrics=[]
metric_rows=csvrows(P/'research/vem_official_metric_source_audit/results/outputs/metrics.csv')
extra_metrics=external_root/'results/metric_outputs/metrics.csv'
if extra_metrics.is_file():metric_rows+=csvrows(extra_metrics)
external_summary=load(external_root/'WEB_SUMMARY.json') if (external_root/'WEB_SUMMARY.json').is_file() else None
for row in metric_rows:
    item={k:row.get(k) for k in ['task','source_id','source_name','official_stage','external_stage','group','representation','seed']}
    if item.get('source_name'):item['source_name']=re.sub(r'重复(\d+)_(?:T1|T2_heart)$',r'重复\1',item['source_name'])
    item.update({k:number(row.get(k)) for k in ['n_genes','MMD','CSS','pseudobulk_pearson','pseudobulk_spearman']})
    metrics.append(item)

# Core report texts appear inside the common interface. Local-only links become
# explicitly labelled evidence paths, so public readers never get dead links.
reports={
 'A01':R/'handbook/team/handbook_20261111/AGENT_HANDBOOK.md',
 'A02':PEER/'official_data_analysis_20261114/REPORT_ZH.md',
 'A03':PEER/'t2_heart_analysis_20261116/REPORT_ZH.md',
 'A04':PEER/'t2_heart_analysis_20261116/REPORT_ZH.md',
 'A05':PEER/'t2_heart_analysis_20261116/NEIGHBOUR_ALL_GENES_ZH.md',
 'A06':PEER/'t2_heart_prior_audit_v2/README_ZH.md',
 'A07':PEER/'t2_heart_prior_followup_20261116/REPORT_ZH.md',
 'A08':P/'research/early_embryo_prior_audit/README.md',
 'A09':P/'research/vem_prior_knowledge_v2/README.md',
 'A10':P/'research/vem_source_comparison_v2/README.md',
 'A11':P/'research/vem_pairwise_similarity_v3/README.md',
 'A12':P/'research/vem_t1_weighted_binary_v4/README.md',
 'A13':P/'research/vem_official_metric_source_audit/FINDINGS.md',
 'A14':P/'notes/scoring_review_20261118/03_分任务评分过程与独立例子.md',
 'A15':R/'older_comparison/team/official_external_comparison_20261115/REPORT_ZH.md'}
def render_report(path):
    if not path.is_file():return '<p>原文保留在5090共享包，核心结论见上方证据摘要。</p>'
    raw=read(path)
    soup=BeautifulSoup(markdown.markdown(raw,extensions=['tables','fenced_code','sane_lists']), 'html.parser')
    for tag in soup(['script','iframe','style','object','embed','form']):tag.decompose()
    for tag in soup.find_all(True):
        for key in list(tag.attrs):
            if key.startswith('on') or key=='style':del tag[key]
    for a in soup.find_all('a'):
        href=a.get('href','')
        if href.startswith(('https://','http://')):
            a['target']='_blank';a['rel']='noopener'
        else:
            a.name='span';a.attrs={'class':'source-path','title':'原始证据路径：'+href};a.append('〔原始证据〕')
    for img in soup.find_all('img'):
        span=soup.new_tag('span',attrs={'class':'source-path'})
        span.string='原图：'+img.get('alt','图件')+'（见5090原始报告）';img.replace_with(span)
    return str(soup)

findings={
 'A01':('旧方法与预测需要沿来源链查找。','寻找父模型、生成脚本、复现状态和官方原始回执。','历史手册不是实时状态；旧高分方法的来源边界仍要复核。'),
 'A02':('15份官方文件、6份开放验证已被系统审计。','按类型、基因和指标定位一个具体预测缺陷。','开放真值已用于开发，诊断complete不等于生产评分器验收。'),
 'A03':('心脏五时期的类型、检出、强度与空间各有不同变化。','分开检出率与阳性强度，选定一个生成机制。','时期与标本混杂；观察并非同一胚胎的连续跟踪。'),
 'A04':('500基因中45个类型指向、81个时期关联、140个重复空间候选。','先查基因适用的轴与类型，再决定是否建模。','三类可重叠，57个多轴；严格稳定丰度子集为0。'),
 'A05':('236个基因在至少一个时期×类型组合显示邻域增量。','先核生成时特征是否可得，再做更强位置对照与跨期试验。','同标本二维空间留出；不是跨时期收益，也不等于官方NFS。'),
 'A06':('单基因抽稀可以吻合，联合检出仍有偏差。','把观测过程设为对照，避免统一补零或删除边界细胞。','不能分离技术效率与真实RNA量；A/B标记不等于统计独立。'),
 'A07':('已补E8.5定位、条件双检出、边界与计数检查。','与原E8.75/E9.5/E10.5逐节对照。','E8.5边界双标记数较少，不能据此确定机制。'),
 'A08':('早期34条先验各有支持、不可比或明确缺口。','查找早期胚胎比例、表达和取材的适用条件。','已并入108条扩展库，不额外增加34条独立知识。'),
 'A09':('108条知识已逐条记录官方与外部核对。','按细胞、基因、阶段和证据状态查找可用先验。','官方只有3条观测一致；不可把条目数量当验证数量。'),
 'A10':('原六节补入E10.5同阶段、整体RNA与阶段变化对照。','先核对标签、取材、尺度，再看同阶段与跨阶段结果。','观测变化对照不等于预测泛化验证。'),
 'A11':('保留原40对，加入30对E10.5同阶段数据。','在原筛选器选择E10.5查类型、组成和逐基因图。','不同panel和表达表示的绝对距离不能混排。'),
 'A12':('已补E10.5加权S与30组新的0/1分布对照。','区分供体差异来自零值还是阳性表达。','加权S是自定义描述统计，不是官网分数。'),
 'A13':('已补15份E10.5外部对象的四项表达公式对照。','选择T1或心脏E10.5，查看分项、类型与样本。','分布距离改善可伴随均值误差恶化；没有通用换算。'),
 'A14':('三个任务比较的对象和指标权重不同。','先明确参考、真值、预测的角色，再解释每项诊断。','固定公开版本；线上后台与部分gate未完成等价验收。'),
 'A15':('已接回原图和结果表，并展示历史验证结果。','查询旧分析、映射与来源记录，避免重复劳动。','不能把旧归一化结果或特定子集许可推广到其他条件。')}
catalog=load(R/'hub/catalogs/analyses.json')['analyses']; analyses=[]
for item in catalog:
    a={k:item[k] for k in ['analysis_id','title','topic','tasks','evidence_status','limitation','source_group']}
    a.update(finding=findings[item['analysis_id']][0],use=findings[item['analysis_id']][1],boundary=findings[item['analysis_id']][2],
        report=render_report(reports[item['analysis_id']]),remote_reader=item['reader'],remote_compute_root=item['remote_compute_root'])
    a['validation_review']=[x for x in load(completion_root/'TOPIC_COVERAGE.json') if x['topic']==item['analysis_id']]
    analyses.append(a)
quantitative_releases=[r for r in releases if 'reader_input' in r]
if quantitative_releases:
    latest=quantitative_releases[-1]
    label=named[latest['id']]
    supplements={
        'A08':('E8.0 尿囊比例新增一组全胚胎观测。','在原页对照同日龄的各胚胎比例。'),
        'A09':('D001 新增 E8.0 尿囊占比对照。','查证据时区分同名群和更细的内皮群。'),
        'A10':(f'补入 {label} 的同日龄表达对照与共同面板阶段差。','并排看整体表达、检出和变化方向。'),
        'A11':(f'原配对保留，新增 {label} 的同日龄数据。','按来源筛选，查看整体、细胞类型和逐基因结果。'),
        'A12':(f'{label} 已补 E8.5 和 E9.5 的加权 S 与 0/1 检出对照。','按同阶段查看计算项与覆盖。'),
        'A13':(f'{label} 已补共同面板 MMD 和 CSS 与官方同标本抽样参照。','在原页查看六组同日龄 RNA 分布距离。'),
    }
    for a in analyses:
        if a['analysis_id'] in supplements:
            a['finding'],a['use']=supplements[a['analysis_id']]
plan=render_report(R/'hub/reviews/20261118/01_联合审视与使用规划.md')

for filename in ['fig_source_timelines.png','fig_source_timelines_by_type.png']:
    src=source(R/'data_review/team/data_review_20261113'/filename)
    dst=SITE/'assets/figures'/filename;dst.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(src,dst)
for filename in ['01_official_composition.png','02_source_similarity.png','03_mapping_errors.png']:
    src=source(P/'research/early_embryo_prior_audit/figures'/filename)
    dst=SITE/'assets/figures'/filename;shutil.copyfile(src,dst)

inventory_source=R/'dashboard_inventory/FILE_COUNTS.json'
file_counts=load(inventory_source) if inventory_source.is_file() else None
if file_counts:
    # Publish a macro overview, not the full top-level filename inventory.
    file_counts['top_level_directory_count']=sum(x['kind']=='directory' for x in file_counts['items'])
    keep={'experiments','Virtual_Embryo_External_Data','team','reports','reproduction_20261020',
          'src','scripts','ops','tests','submission','external_references','official_data_analysis_20261114',
          'docs','protocols','registry','models','assets','data'}
    visible=[x for x in file_counts['items'] if x['name'] in keep]
    other=[x for x in file_counts['items'] if x['name'] not in keep]
    visible.append({'name':'其他目录、环境与根部文件','kind':'directory','files':sum(x['files'] for x in other),
        'directories':sum(x['directories']+(x['kind']=='directory') for x in other),
        'symlinks':sum(x['symlinks'] for x in other),'logical_bytes':sum(x['logical_bytes'] for x in other),
        'errors':[],'aggregate':True})
    file_counts['items']=visible
    file_counts['display_scope']='Selected VEM directories; environment/cache and root files grouped as other. Original complete receipt remains local and on 5090.'
audit=load(R/'INDEPENDENT_TABLE_REVIEW.json')
deadline={
 'source_url':'https://virtualembryo.ai/challenge/timeline','checked_at':'2026-11-18T02:56:00+08:00',
 'checked_method':'Live official timeline viewed in browser; URL and rendered schedule verified',
 'official_text':'Final submissions due at 23:59 AoE on 25 November 2026.',
 'official_utc_text':'12:00 UTC on 26 November',
 'countdown_target':'2026-11-26T11:59:00Z','display_aoe':'2026-11-25 23:59 AoE',
 'display_beijing':'2026-11-26 19:59 北京时间',
 'conversion_note':'计时按官方23:59 AoE作UTC−12精确换算（11:59 UTC），早于同页写的12:00 UTC一分钟。'}
write_json(SITE/'data/official-timeline-source.json',deadline)
tasks=[
 {'id':'T1','name':'T1 · 时间外推','target':'E12.5','modality':'scRNA-seq · 表达','genes':32285,'kind':'temporal','description':'从早期心脏及周边取材的表达，生成未来细胞群体。','train':[8.5,9.5],'validation':[10.5],'test':[12.5],'analysis':['A02','A11','A12','A13'],'next':'一个来源、一个类型，区分检出与阳性强度校准。','weights':[['DES',25],['DCS',25],['MMD',30],['CSS',20]]},
 {'id':'T2_embryo','name':'T2 · 胚胎插值','target':'E7.75','modality':'MERFISH · 表达 + 三维坐标','genes':497,'kind':'embryo','description':'在已观测早期胚胎阶段之间，预测表达与空间分布。','train':[6.75,7.25,8],'validation':[7.5],'test':[7.75],'analysis':['A01','A08','A13'],'next':'先复用合格简单插值，明确其具体不足，再引入外部先验。','weights':[['表达变化 DES/DCS',25],['表达分布 MMD/CSS',25],['形状 SDD/ODS',25],['尺度与邻域 TSR/NFS',25]]},
 {'id':'T2_heart','name':'T2 · 心脏外推','target':'E12.5','modality':'MERFISH · 表达 + 三维坐标','genes':500,'kind':'heart','description':'联合生成未来心脏的细胞表达和组织空间。','train':[8.25,8.75,9.5],'validation':[8.5,10.5],'test':[12.5],'analysis':['A03','A04','A05','A06'],'next':'先做邻域特征可得性表，再选择少量基因做受控预测试验。','weights':[['表达变化 DES/DCS',25],['表达分布 MMD/CSS',25],['形状 SDD/ODS',25],['尺度与邻域 TSR/NFS',25]]},
 {'id':'T3','name':'T3 · 未知扰动','target':'Ctnnb1 KO','modality':'MERFISH · 表达 + 三维坐标','genes':500,'kind':'perturbation','description':'从正常发育及已知扰动，泛化到E8.75的β-catenin敲除。','train':[8.75,9.5],'validation':[8.75],'test':[8.75],'analysis':['A02','A06','A09','A14'],'next':'匹配WT和扰动身份；正常心脏先验不能代替Ctnnb1响应证据。','weights':[['DES',30],['DCS',25],['PSS',25],['MMD/CSS',20]]}
]
timeline=[['2026-08-10','P1','门户与验证榜开放'],['2026-08-15','P2','Starter kit 与参考基线'],['2026-10-27','P3','隐藏测试榜开放'],['2026-11-25','FINAL','23:59 AoE 最终截止'],['2026-11-26','评估','官方隐藏测试评估'],['2026-12-12','公布','NeurIPS 公布优胜者']]
readers=json.loads((SITE/'data/original-readers.json').read_text(encoding='utf-8'))
data={'version':max([r['date'] for r in releases],default='2026-11-19'),'title':'26VEM · 虚拟胚胎研究工作台','built_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),
 'snapshot_note':'研究结论与文件统计是标明时间的快照；刷新页面不会连接5090。倒计时在浏览器本地更新。',
 'deadline':deadline,'timeline':timeline,'tasks':tasks,'official':official,'external':external,
 'claims':claims,'knowledge_summary':summary,'analyses':analyses,'gene_axes':axis,'pairs':pairs,'metrics':metrics,
 'external_extensions':[{k:r[k] for k in ['id','date']} for r in releases],
 'external_extension_pair_rows':len(extension_pairs),
 'audit':audit,'file_counts':file_counts,'plan_html':plan,'readers':readers,'validation_completion':completion,'external_e105':external_summary,
 'file_tree':(SITE/'data/5090-tree.txt').read_text(encoding='utf-8'),
 'remote_root':'/home/biocosmosx/work/virtualembryo_cym','remote_hub':'/home/biocosmosx/work/virtualembryo_cym/team/research_hub',
 'current_official_score':None,'remaining_attempts':None}
display_config=json.loads(release_catalog.read_text(encoding='utf-8')).get('display_updates',{})
if display_config.get('timeline'):
    timeline=load(P/display_config['timeline'])
    data['source_timelines']={'date':timeline['metadata_date'],'blocks':[
        {k:b[k] for k in ['id','title','target']}|{'source_count':len(b['sources']),
        'figure':'assets/figures/source_timeline_'+b['id']+'_20261121.svg'} for b in timeline['blocks']]}
data['dataset_display_ids']=display_ids
data=current_labels(data)
jsfile(SITE/'assets/data.js','VEM_DATA',data)
write_json(SITE/'data/source-manifest.json',{'built_at':data['built_at'],'scope':'Selected reports, aggregate statistics and metadata only. No H5AD, model weights, credentials or submission payloads.','files':SOURCES})
write_json(SITE/'data/research-catalog.json',{'analyses':[{k:v for k,v in a.items() if k!='report'} for a in analyses]})
write_json(SITE/'data/official-inventory.json',official)
write_json(SITE/'data/validation-completion.json',completion)
if file_counts:write_json(SITE/'data/file-counts.json',file_counts)
print(json.dumps({'analyses':len(analyses),'claims':len(claims),'external_sources':len(external),'genes':len(axis),
 'neighbour_rows':len(neighbours),'pairs':len(pairs),'metric_rows':len(metrics),'source_files':len(SOURCES),
 'data_bytes':(SITE/'assets/data.js').stat().st_size,'file_counts':file_counts is not None},ensure_ascii=False))
