"""Depth- and identity-conditioned follow-up for E9.5/E10.5 T2 heart data."""

import json
from pathlib import Path

import anndata as ad
import numpy as np


ROOT = Path('/home/biocosmosx/work/virtualembryo_cym')
FILES = {
    'E9.5': ROOT / 'data/E9.5.h5ad',
    'E10.5': ROOT / 'official_data_analysis_20261114/raw_validation_release_v1/T2/E10.5.h5ad',
}
TYPES = (
    'A-CM', 'V-CM', 'OFT-CM', 'SV-CM',
    'BEC', 'Chamber-Endo', 'Cush-EndoMT-Endo', 'Great Artery Endoth',
)
TARGET_GENES = ('Ttn', 'Myh7', 'Myl4', 'Myl7', 'Nppa', 'Tbx2',
                'Pecam1', 'Cdh5', 'Esam', 'Emcn')


def dense(x):
    return x.toarray() if hasattr(x, 'toarray') else np.asarray(x)


def load(stage):
    a = ad.read_h5ad(FILES[stage], backed='r')
    try:
        x = np.empty((a.n_obs, a.n_vars), dtype=np.float32)
        for i in range(0, a.n_obs, 4096):
            x[i:i + 4096] = dense(a.layers['counts'][i:i + 4096])
        return dict(x=x, total=x.sum(1), type=a.obs['celltype'].astype(str).to_numpy(),
                    genes=list(map(str, a.var_names)))
    finally:
        a.file.close()


def f(v):
    return float(v)


def depth_overlap(source, target, typ, gene):
    ix = source['genes'].index(gene)
    s = source['type'] == typ
    t = target['type'] == typ
    slo = max(20.0, f(np.quantile(source['total'][s], .25)),
              f(np.quantile(target['total'][t], .25)))
    shi = min(f(np.quantile(source['total'][s], .75)),
              f(np.quantile(target['total'][t], .75)))
    sm = s & (source['total'] >= slo) & (source['total'] <= shi)
    tm = t & (target['total'] >= slo) & (target['total'] <= shi)
    if min(sm.sum(), tm.sum()) < 100 or slo >= shi:
        return dict(type=typ, gene=gene, source_n=int(sm.sum()), target_n=int(tm.sum()),
                    status='insufficient_overlapping_depth')
    return dict(type=typ, gene=gene, source_n=int(sm.sum()), target_n=int(tm.sum()),
                depth_range=[slo, shi],
                source_detection=f(np.mean(source['x'][sm, ix] > 0)),
                target_detection=f(np.mean(target['x'][tm, ix] > 0)),
                source_depth_median=f(np.median(source['total'][sm])),
                target_depth_median=f(np.median(target['total'][tm])),
                status='computed')


def identity_conditioned(data, typ, gene):
    ix = {g: data['genes'].index(g) for g in ('Pecam1', 'Cdh5', 'Esam', 'Emcn')}
    mask = ((data['type'] == typ) & (data['x'][:, ix['Pecam1']] > 0)
            & (data['x'][:, ix['Cdh5']] > 0))
    vals = data['x'][mask, ix[gene]]
    return dict(type=typ, gene=gene, n=int(mask.sum()),
                detection=f(np.mean(vals > 0)) if len(vals) else None,
                mean_released_counts=f(np.mean(vals)) if len(vals) else None,
                median_total=f(np.median(data['total'][mask])) if len(vals) else None)


def gene_rank(source, target, typ):
    sm = source['type'] == typ
    tm = target['type'] == typ
    a, b = source['x'][sm], target['x'][tm]
    p = min(1.0, f(target['total'][tm].mean() / source['total'][sm].mean()))
    source_det = np.mean(a > 0, axis=0)
    target_det = np.mean(b > 0, axis=0)
    predicted_det = np.mean(1 - np.power(1 - p, a), axis=0)
    residual = target_det - predicted_det
    output = []
    for gene in TARGET_GENES:
        j = source['genes'].index(gene)
        nearest = np.argsort(np.abs(source_det - source_det[j]))[:51]
        matched = nearest[nearest != j][:50]
        lo = np.quantile(residual[matched], .1)
        hi = np.quantile(residual[matched], .9)
        output.append(dict(type=typ, gene=gene, source_n=int(sm.sum()), target_n=int(tm.sum()),
                           thinning_p=p, source_detection=f(source_det[j]),
                           target_detection=f(target_det[j]),
                           predicted_detection=f(predicted_det[j]),
                           residual=f(residual[j]),
                           matched_gene_residual_q10=f(lo),
                           matched_gene_residual_q90=f(hi),
                           percentile_vs_50_matched=f(np.mean(residual[matched] <= residual[j])),
                           matched_detect_range=[f(np.min(source_det[matched])),
                                                 f(np.max(source_det[matched]))]))
    return output


def main():
    a, b = load('E9.5'), load('E10.5')
    assert a['genes'] == b['genes']
    assert np.max(np.abs(a['x'] - np.rint(a['x']))) < 1e-5
    assert np.max(np.abs(b['x'] - np.rint(b['x']))) < 1e-5
    ranks = []
    depth = []
    identity = []
    for typ in TYPES:
        if min((a['type'] == typ).sum(), (b['type'] == typ).sum()) < 100:
            continue
        ranks.extend(gene_rank(a, b, typ))
        depth.extend(depth_overlap(a, b, typ, g) for g in TARGET_GENES)
        if typ in TYPES[4:]:
            for stage, data in [('E9.5', a), ('E10.5', b)]:
                for gene in ('Esam', 'Emcn'):
                    identity.append(dict(stage=stage, **identity_conditioned(data, typ, gene)))
    print(json.dumps(dict(rank=ranks, depth_overlap=depth,
                          identity_conditioned=identity), separators=(',', ':')))


if __name__ == '__main__':
    main()
