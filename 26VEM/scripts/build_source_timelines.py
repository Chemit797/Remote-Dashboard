"""Render current dashboard source timelines as linked SVG diagrams, using registered stages."""
from pathlib import Path
import argparse, html, json, math, unicodedata

SITE=Path(__file__).resolve().parents[1]
W=1800;LEFT=435;RIGHT=1280;ROW=49
BLUE='#2877d3';ORANGE='#c65e23';GRAY='#555b62'
ESC=lambda x:html.escape(str(x),quote=True)

def x(stage):
    return LEFT+(float(stage)-6.25)/(19.5-6.25)*740

def pos(entry):
    if entry.get('stage') is not None:return x(entry['stage'])
    if entry.get('adult'):return 1250
    return 1192+min(float(entry.get('postnatal',0)),21)/21*43

def wrap(text,limit):
    lines=[''];size=0
    for c in text:
        width=2 if unicodedata.east_asian_width(c) in 'WF' else 1
        if size+width>limit:lines.append('');size=0
        lines[-1]+=c;size+=width
    return lines

def text(xv,y,value,size=16,color='#303943',weight='400',anchor='start'):
    return f'<text x="{xv:g}" y="{y:g}" font-size="{size}" fill="{color}" font-weight="{weight}" text-anchor="{anchor}">{ESC(value)}</text>'

def circle(cx,cy,color,empty=False,r=5):
    return f'<circle cx="{cx:g}" cy="{cy:g}" r="{r}" fill="{"white" if empty else color}" stroke="{color if empty else "white"}" stroke-width="{2.5 if empty else 1.2}"/>'

def point(cx,cy,role,color,empty=False):
    if role=='test':return f'<path d="M {cx-5:g} {cy-5:g} l 10 10 m -10 0 l 10 -10" stroke="{color}" stroke-width="3.4"/>'
    return circle(cx,cy,color,empty=empty or role in ['validation','unreleased'],r=6 if role=='validation' else 5)

def link(href,body,title):
    return f'<a href="../../{ESC(href)}" target="_top"><title>{ESC(title)}</title>{body}</a>'

def render_block(block,top):
    height=142+ROW*(len(block['official'])+len(block['sources']))+38
    y0=top+142; bottom=top+height-32
    parts=[text(20,top+32,block['title']+'  |  '+block['target'],24,weight='700'),
        text(20,top+62,block['subtitle'],16,color='#666f78'),
        text(20,top+89,block['note'],14,color='#777f87')]
    parts.append(f'<rect x="1178" y="{top+112}" width="94" height="{bottom-top-112}" fill="#f2f3f4"/>')
    for window in block['windows']:
        a,b=x(window['start']),x(window['end'])
        parts.append(f'<rect x="{a:g}" y="{top+112}" width="{b-a:g}" height="{bottom-top-112}" fill="#fae8df"/>')
    for age in range(7,20):
        xx=x(age)
        parts.append(f'<path d="M{xx:g} {top+115} V{bottom}" stroke="#dfe3e7"/>')
        parts.append(text(xx,top+109,f'E{age}',13,color='#8a9198',anchor='middle'))
    for xx,label in [(1192,'P0'),(1218,'P5'),(1250,'成体')]:parts.append(text(xx,top+109,label,12,color='#8a9198',anchor='middle'))
    for off in block['official']:
        for e in off['stages']:
            if e['role'] in ['validation','test']:
                parts.append(f'<path d="M{x(e["stage"]):g} {top+115} V{bottom}" stroke="{BLUE}" stroke-width="1.5" stroke-dasharray="{2 if e["role"]=="validation" else 7} 5" opacity=".75"/>')
    for i,off in enumerate(block['official']):
        y=y0+i*ROW
        parts.append(f'<rect x="10" y="{y-23}" width="1780" height="45" fill="#e9f1fb"/><rect x="10" y="{y-23}" width="4" height="45" fill="{BLUE}"/>')
        parts.append(text(24,y+4,'官方',14,BLUE,weight='700'))
        parts.append(text(83,y+4,off['name'],17,weight='600'))
        xx=[pos(e) for e in off['stages']]
        if len(xx)>1:parts.append(f'<path d="M{min(xx):g} {y} H{max(xx):g}" stroke="{BLUE}" opacity=".45" stroke-width="2"/>')
        for e in off['stages']:
            c=GRAY if e['role']=='unreleased' else BLUE
            p=point(pos(e),y,e['role'],c)
            task={'T1':'T1','T2':'T2_embryo','T2H':'T2_heart_extrap','T3':'T3'}[block['id']]
            parts.append(link('#/similarity/'+task,p,'官方 '+e['label']+' · '+e['role']))
        for line,v in enumerate(wrap(off['note'],62)[:2]):parts.append(text(RIGHT+10,y-4+line*18,v,14,'#606a74'))
    for i,row in enumerate(block['sources']):
        y=y0+ROW*(len(block['official'])+i)
        if i%2==0:parts.append(f'<rect x="15" y="{y-22}" width="409" height="46" fill="#f8f9fb"/>')
        label=text(24,y-3,row['display_name'],16)
        label+=text(24,y+15,row['status'],12,'#5f7c86')
        parts.append(link(row['url'],label,row['display_name']+' · '+row['assay']))
        points=[pos(e) for e in row['stages']]
        if len(points)>1:parts.append(f'<path d="M{min(points):g} {y} H{max(points):g}" stroke="#c7ccd1" stroke-width="1.3"/>')
        for interval in row['ranges']:
            start,end=interval['start'],interval['end']
            cuts=sorted({start,end,*[v for w in block['windows'] for v in [w['start'],w['end']] if start<v<end]})
            for a,b in zip(cuts,cuts[1:]):
                protected=any(w['start']<(a+b)/2<w['end'] for w in block['windows']) or (block['id']=='T3' and row['id']=='VED-041')
                c=ORANGE if protected else GRAY
                width=5 if interval['kind']=='inferred' else 2
                parts.append(f'<path d="M{x(a):g} {y} H{x(b):g}" stroke="{c}" stroke-width="{width}"><title>{ESC(interval["label"])}</title></path>')
            if interval['kind']=='metadata':
                for age in [start,end]:parts.append(f'<path d="M{x(age):g} {y-6} v12" stroke="{c}" stroke-width="2"/>')
        for e in row['stages']:
            c=ORANGE if e['permission'] in ['protected','unconfirmed'] else GRAY
            candidates=[r for r in row['computed_pairs'] if e['stage'] is not None and
                        r['external_stage'].startswith('E') and r['external_stage'][1:].replace('.','',1).isdigit() and float(r['external_stage'][1:])==e['stage']]
            candidates.sort(key=lambda r:r['official_stage']!=r['external_stage'])
            href=candidates[0]['url'] if candidates else row['url']
            title=row['display_name']+'｜'+e['label']+'｜'+row['status']
            if candidates and candidates[0]['rho'] is not None:title+='｜ρ '+f'{candidates[0]["rho"]:.6f}'
            parts.append(link(href,point(pos(e),y,'external',c,e['permission']=='unconfirmed'),title))
        note=row['note']
        for line,v in enumerate(wrap(note,63)[:2]):parts.append(text(RIGHT+10,y-3+line*18,v,14,'#727b84'))
    parts.append(f'<path d="M15 {top+height-7} H1785" stroke="#dce2e8"/>')
    return parts,height

def svg(parts,height,title):
    return f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{height}" viewBox="0 0 {W} {height}" role="img" aria-label="{ESC(title)}"><title>{ESC(title)}</title><style>text{{font-family:Arial,"Microsoft YaHei","Noto Sans CJK SC",sans-serif}} rect{{pointer-events:none}} a:hover text{{fill:#2877d3}} a:hover circle{{stroke:#2877d3;stroke-width:3}}</style><rect width="100%" height="100%" fill="white"/>'+''.join(parts)+'</svg>\n'

def main(project):
    project=Path(project)
    config=json.loads((project/'catalogs/dashboard_external_releases.json').read_text(encoding='utf-8'))['display_updates']
    source=project/config['timeline'];d=json.loads(source.read_text(encoding='utf-8'))
    figures=SITE/'assets/figures';figures.mkdir(exist_ok=True)
    allparts=[text(20,36,'各任务的数据来源与测量时间',28,weight='700'),text(20,65,'2026-11-21 更新 · 每个来源一行 · 官方置顶 · 名称和阶段点可点击',17,'#626f7a')]
    allparts += [circle(30,94,BLUE),text(44,100,'官方训练／参照',15),circle(232,94,BLUE,True),text(247,100,'官方验证',15),point(390,94,'test',BLUE),text(405,100,'官方测试',15),circle(555,94,GRAY),text(570,100,'外部阶段',15),circle(704,94,ORANGE),text(719,100,'原任务保护条件',15),circle(926,94,ORANGE,True),text(941,100,'T3 许可待确认',15),text(1155,100,'粗线：模型推断时间；端帽线：元数据范围',15)]
    y=122
    for block in d['blocks']:
        parts,height=render_block(block,0)
        (figures/f'source_timeline_{block["id"]}_20261121.svg').write_text(svg(parts,height,block['title']+' · 来源时间轴'),encoding='utf-8',newline='\n')
        parts,height=render_block(block,y);allparts+=parts;y+=height+10
    allparts.append(text(20,y+14,'阶段覆盖和入库／计算状态分别列出；出生后与成体区间压缩。原任务保护条件沿用已保存的规则登记。',14,'#727b84'))
    (figures/'fig_source_timelines_20261121.svg').write_text(svg(allparts,y+40,'四任务数据来源时间轴 · 2026-11-21'),encoding='utf-8',newline='\n')
    (SITE/'data/source-timelines.json').write_bytes(source.read_bytes())
    names=project/'catalogs/external_dataset_names.json'
    (SITE/'data/external-dataset-names.json').write_bytes(names.read_bytes())
    print(json.dumps({'blocks':len(d['blocks']),'rows':sum(len(b['sources']) for b in d['blocks']),'combined_height':y+40}))

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--project',required=True);main(p.parse_args().project)
