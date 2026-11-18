"""Publish existing reader pages byte-for-byte; add navigation, never rewrite them."""
from pathlib import Path
from urllib.parse import urlsplit,unquote
import argparse,hashlib,html,json,re,shutil,posixpath
import markdown
from bs4 import BeautifulSoup

def build(project):
    project=Path(project).resolve();site=Path(__file__).resolve().parents[1]
    revision=project/'reports/analysis_integration_20261118/ui_revision'
    peer=revision/'original_peer'
    roots={'research':project/'research','notes':project/'notes','docs':project/'docs',
           'peer':peer,'handbook':project/'reports/analysis_integration_20261118/handbook/team/handbook_20261111',
           'older':project/'reports/analysis_integration_20261118/older_comparison/team/official_external_comparison_20261115'}
    # Dated additions are separate sources. The original snapshots stay frozen.
    overlay=project/'research/validation_completion_20261119/overlays'
    frozen_dependencies=overlay.parent/'frozen_dependencies'
    baseline_files=json.loads((overlay.parent/'REMOTE_WEBSITE_BEFORE.json').read_text(encoding='utf-8'))['files']
    seeds={
      'A01':('handbook/HUMAN_GUIDE.md','工程与历史'),
      'A02':('peer/official_data_analysis_20261114/report.html','官方数据分析'),
      'A03':('peer/t2_heart_analysis_20261116/report.html','心脏专项分析'),
      'A04':('peer/t2_heart_analysis_20261116/gene_500_explorer.html','心脏专项分析'),
      'A05':('peer/t2_heart_analysis_20261116/NEIGHBOUR_ALL_GENES_ZH.md','心脏专项分析'),
      'A06':('peer/t2_heart_prior_audit_v2/report.html','心脏专项分析'),
      'A07':('peer/t2_heart_prior_followup_20261116/report.html','心脏专项分析'),
      'A08':('research/early_embryo_prior_audit/knowledge.html','先验知识'),
      'A09':('research/vem_prior_knowledge_v2/knowledge.html','先验知识'),
      'A10':('research/vem_source_comparison_v2/README.md','官方与外部数据比较'),
      'A11':('research/vem_pairwise_similarity_v3/comparison.html','官方与外部数据比较'),
      'A12':('research/vem_pairwise_similarity_v3/comparison.html#t1-weighted-binary-appendix','官方与外部数据比较'),
      'A13':('research/vem_official_metric_source_audit/index.html','官方与外部数据比较'),
      'A14':('notes/scoring_review_20261118/03_分任务评分过程与独立例子.md','评分规则与例子'),
      'A15':('older/REPORT_ZH.md','官方与外部数据比较')}
    out=site/'readers';out.mkdir(exist_ok=True);copied={};missing=[];parsed=set()
    def original(key):
        p=Path(key);return roots[p.parts[0]].joinpath(*p.parts[1:])
    def resolve(key):
        candidate=overlay/key
        if candidate.is_file():return candidate
        candidate=frozen_dependencies/key
        if candidate.is_file():return candidate
        candidate=original(key)
        previous=baseline_files.get('readers/'+key)
        if previous and candidate.is_file():
            assert hashlib.sha256(candidate.read_bytes()).hexdigest()==previous['sha256'], 'Concurrent source dependency changed; freeze the reviewed baseline first: '+key
        return candidate
    def key_for(path):
        path=path.resolve()
        for name,root in roots.items():
            if path.is_relative_to(root.resolve()):return name+'/'+path.relative_to(root).as_posix()
    def copy(key):
        if key in copied:return
        src=resolve(key)
        if not src.is_file():missing.append(key);return
        if src.suffix.lower() in ['.h5ad','.pt','.pth','.ckpt','.pkl']:return
        dst=out/key;dst.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(src,dst)
        copied[key]={'path':'readers/'+key,'source':str(src),'bytes':src.stat().st_size,'sha256':hashlib.sha256(src.read_bytes()).hexdigest()}
    for path in peer.rglob('*'):
        if path.is_file():copy('peer/'+path.relative_to(peer).as_posix())
    # Data-driven readers construct download links at runtime. Include the
    # explicitly selected dated evidence, including those non-static targets.
    for path in overlay.rglob('*'):
        if path.is_file():copy(path.relative_to(overlay).as_posix())
    queue=[urlsplit(p).path for p,_ in seeds.values()]
    while queue:
        key=queue.pop()
        if key in parsed:continue
        parsed.add(key);copy(key)
        if key not in copied:continue
        src=resolve(key)
        if src.suffix not in ['.html','.md','.css']:continue
        text=src.read_text(encoding='utf-8-sig')
        if src.suffix=='.html':
            soup=BeautifulSoup(text,'html.parser');links=[t.get('href') or t.get('src') for t in soup.select('[href],[src]')]
        elif src.suffix=='.md':links=re.findall(r'\]\(([^)]+)\)',text)
        else:links=re.findall(r'url\(["\x27]?([^)"\x27]+)',text)
        for link in links:
            u=urlsplit(link)
            if u.scheme or u.netloc or not u.path:continue
            target=(original(key).parent/unquote(u.path)).resolve()
            logical=posixpath.normpath(posixpath.join(posixpath.dirname(key),unquote(u.path)))
            nextkey=logical if logical.split('/')[0] in roots else key_for(target)
            if nextkey and resolve(nextkey).is_file():queue.append(nextkey)
            elif src.suffix=='.html':missing.append(key+' -> '+link)
    catalog=[]
    for aid,(path,group) in seeds.items():
        u=urlsplit(path);key=u.path;src=out/key;raw=src.read_text(encoding='utf-8-sig')
        if src.suffix=='.md':
            body=markdown.markdown(raw,extensions=['tables','fenced_code','toc','sane_lists'])
            soup=BeautifulSoup(body,'html.parser');title=soup.h1.get_text(' ',strip=True) if soup.h1 else src.stem
            css='../'*(len(Path(key).parts)-1)+'../assets/site.css'
            wrapper='<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+html.escape(title)+'</title><link rel="stylesheet" href="'+css+'"></head><body><main class="prose">'+body+'</main></body></html>'
            dest=src.with_suffix('.html');dest.write_text(wrapper,encoding='utf-8',newline='\n');key=Path(key).with_suffix('.html').as_posix()
        else:
            soup=BeautifulSoup(raw,'html.parser');title=soup.h1.get_text(' ',strip=True) if soup.h1 else soup.title.get_text(' ',strip=True)
        section_root=soup.find(id=u.fragment) if u.fragment else soup
        if section_root and u.fragment:
            heading=section_root if section_root.name in ['h1','h2','h3'] else section_root.find(['h1','h2','h3'])
            if heading:title=heading.get_text(' ',strip=True)
        sections=[]
        for h in (section_root or soup).select('h2'):
            label=h.get_text(' ',strip=True)
            if not label:continue
            ancestor=h if h.get('id') else h.find_parent(id=True)
            sections.append({'title':label,'anchor':ancestor.get('id','') if ancestor else '', 'heading_index':soup.select('h2').index(h)})
        catalog.append({'analysis_id':aid,'group':group,'title':title,'url':'readers/'+key+('#'+u.fragment if u.fragment else ''),'source_path':path,'sections':sections})
    manifest={'policy':'Selected source bytes copied exactly; dated additive overlays take precedence without changing original snapshots. Markdown receives a reading wrapper only. Original sections, figures and interactions retained.','files':list(copied.values()),'missing_html_links':sorted(set(missing))}
    (site/'data/original-readers-manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8',newline='\n')
    (site/'data/original-readers.json').write_text(json.dumps(catalog,ensure_ascii=False,indent=2)+'\n',encoding='utf-8',newline='\n')
    print(json.dumps({'reader_entries':len(catalog),'original_files':len(copied),'original_bytes':sum(x['bytes'] for x in copied.values()),'missing_html_links':manifest['missing_html_links']},ensure_ascii=False))
    return catalog

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--project',required=True);build(p.parse_args().project)
