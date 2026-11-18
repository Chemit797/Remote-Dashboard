"""Verify data provenance relationships, static assets and site boundaries."""
from pathlib import Path
from urllib.parse import urlsplit,unquote
import collections,hashlib,json,re
from bs4 import BeautifulSoup

SITE=Path(__file__).resolve().parents[1]
def data(name,var):
    s=(SITE/'assets'/name).read_text(encoding='utf-8')
    assert s.startswith('window.'+var+'=') and s.endswith(';\n')
    return json.loads(s.split('=',1)[1][:-2])
D=data('data.js','VEM_DATA'); neighbours=data('neighbours.js','VEM_NEIGHBOURS')
checks={}
def check(key,value):
    checks[key]=bool(value)
    if not value:raise AssertionError(key)
check('four_final_targets',len(D['tasks'])==4)
check('no_invented_scores_or_quota',D['current_official_score'] is None and D['remaining_attempts'] is None)
check('official_inventory_15_and_590352',len(D['official'])==15 and sum(x['cells'] for x in D['official'])==590352)
check('validation_files_6',sum(x['role']=='开发验证' for x in D['official'])==6)
check('108_unique_claims',len(D['claims'])==len({x['id'] for x in D['claims']})==108)
check('claim_statuses_match_summary',dict(collections.Counter(x['checks']['official']['status'] for x in D['claims']))==D['knowledge_summary']['official'])
check('43_unique_external_identities',len(D['external'])==len({x['id'] for x in D['external']})==43)
check('external_names_have_fixed_ids',all(x['name'].startswith(x['id']+' · ') for x in D['external']))
check('15_unique_analyses',len(D['analyses'])==len({x['analysis_id'] for x in D['analyses']})==15)
readers=D['readers']
check('15_original_reader_entries',len(readers)==len({x['analysis_id'] for x in readers})==15)
check('reader_categories_cover_existing_analyses',{x['analysis_id'] for x in readers}=={x['analysis_id'] for x in D['analyses']})
check('reader_entry_files_present',all((SITE/unquote(urlsplit(x['url']).path)).is_file() for x in readers))
rm=json.loads((SITE/'data/original-readers-manifest.json').read_text(encoding='utf-8'))
check('original_reader_bytes_unchanged',all(hashlib.sha256((SITE/x['path']).read_bytes()).hexdigest()==x['sha256'] for x in rm['files']))
check('no_missing_original_html_dependencies',not rm['missing_html_links'])
check('directory_tree_has_engineering_and_research_roots',all(x in D['file_tree'] for x in ['virtualembryo_baseline/','virtualembryo_cym/','handbook_20261111/','analysis_share_20261117/','research_hub/','26VEM/']))
check('all_report_texts_present',all('原文保留在5090共享包' not in x['report'] for x in D['analyses']))
check('500_unique_genes',len(D['gene_axes'])==len({x['gene'] for x in D['gene_axes']})==500)
check('type_markers_45',sum(x['type_marker'] for x in D['gene_axes'])==45)
check('stage_axis_81',sum(x['stage_types']>0 for x in D['gene_axes'])==81)
check('spatial_axis_140',sum(x['spatial_types']>0 for x in D['gene_axes'])==140)
check('9500_neighbour_rows_19_groups',len(neighbours)==9500 and len({(x['stage'],x['type']) for x in neighbours})==19)
check('neighbour_eligible_flags_recomputed',all(x['eligible']==(x['det']>=.05 and x['delta'] is not None) for x in neighbours))
check('neighbour_candidate_flags_recomputed',all(x['hit']==(x['eligible'] and x['delta']>.01 and x['shuffle_delta']>.01) for x in neighbours))
check('236_candidate_gene_union',len({x['gene'] for x in neighbours if x['hit']})==236)
for cut,expected in [(.005,282),(.01,236),(.02,162),(.05,71)]:
    check('threshold_union_'+str(cut),len({x['gene'] for x in neighbours if x['eligible'] and x['delta']>cut and x['shuffle_delta']>cut})==expected)
check('82_pairwise_rows_and_369_metric_rows',len(D['pairs'])==82 and len(D['metrics'])==369)
f=D['file_counts']
check('file_snapshot_present_and_error_free',f and f['errors']==0)
check('file_summary_reconciles',sum(x['files'] for x in f['items'])==f['total_files'] and sum(x['logical_bytes'] for x in f['items'])==f['total_logical_bytes'])
check('exact_AoE_conversion',D['deadline']['countdown_target']=='2026-11-26T11:59:00Z')
check('no_model_or_raw_data_assets',not any(p.suffix.lower() in ['.h5ad','.pt','.pth','.ckpt','.pkl'] for p in SITE.rglob('*') if p.is_file()))
check('no_absolute_browser_file_links',not re.search(r'(?:href|src)=["\'](?:file:|/home/|/mnt/|[A-Z]:)',(SITE/'index.html').read_text()))
linked=[]
for file in [SITE/'index.html']:
    soup=BeautifulSoup(file.read_text(encoding='utf-8'),'html.parser')
    for tag in soup.find_all(['a','link','script','img']):
        value=tag.get('href') or tag.get('src') or ''
        u=urlsplit(value)
        if u.scheme or u.netloc or not u.path:continue
        target=(file.parent/unquote(u.path)).resolve()
        check('asset_'+u.path,target.is_file());linked.append(u.path)
for a in D['analyses']:
    soup=BeautifulSoup(a['report'],'html.parser')
    check('safe_report_'+a['analysis_id'],not soup.find(['script','iframe','object','embed','form']))
    check('web_report_links_'+a['analysis_id'],all(x.get('href','').startswith(('https://','http://')) for x in soup.find_all('a')))
script=(SITE/'assets/app.js').read_text(encoding='utf-8')
for val in {x['type'] for x in neighbours}:
    check('filter_type_'+val,repr(val) in script)
manifest={'built_at':D['built_at'],'checks':checks,'check_count':len(checks),'all_passed':all(checks.values()),
    'browser_checks':'See delivery receipt for desktop/mobile screenshots and interactive verification; not performed by this script.',
    'counts':{'analyses':15,'knowledge':108,'sources':43,'genes':500,'neighbour_rows':9500,'pairs':82,'metrics':369},
    'files':[{'path':p.relative_to(SITE).as_posix(),'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in sorted(SITE.rglob('*')) if p.is_file() and p.name!='VERIFICATION.json' and '__pycache__' not in p.parts]}
(SITE/'VERIFICATION.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8',newline='\n')
print(json.dumps({'checks':len(checks),'all_passed':all(checks.values()),'files':len(manifest['files'])},ensure_ascii=False))
