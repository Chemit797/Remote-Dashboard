"""Read-only targeted checks of cardiac priors in the official T2 heart release."""

import json
from pathlib import Path

import anndata as ad
import numpy as np
from scipy.spatial import cKDTree


ROOT = Path('/home/biocosmosx/work/virtualembryo_cym')
STAGES = ('E8.75', 'E9.5', 'E10.5')
GENES = (
    'Nppa', 'Tbx2', 'Tbx3', 'Bmp2', 'Hey2', 'Nr2f2', 'Tbx5',
    'Ttn', 'Myh7', 'Myl4', 'Myl7', 'Pecam1', 'Cdh5', 'Esam', 'Emcn',
)
LATE_CM_TYPES = ('A-CM', 'V-CM', 'OFT-CM', 'SV-CM')
CM_TYPES = LATE_CM_TYPES + ('IFT-CM', 'LV-CM', 'RV-CM', 'AVC-CM', 'OFT/RV-CM')
ENDO_TYPES = (
    'BEC', 'Chamber-Endo', 'Cush-EndoMT-Endo', 'Great Artery Endoth',
    'HEM-Endoth', 'Intra-Endoth-1', 'Intra-Endoth-2',
)
PAIRS = (
    ('Nppa', 'Tbx2'), ('Nppa', 'Tbx3'), ('Nppa', 'Bmp2'),
    ('Tbx2', 'Bmp2'), ('Nppa', 'Hey2'), ('Pecam1', 'Cdh5'),
    ('Esam', 'Emcn'),
)


def path(stage):
    if stage == 'E10.5':
        return ROOT / 'official_data_analysis_20261114/raw_validation_release_v1/T2/E10.5.h5ad'
    return ROOT / 'data' / (stage + '.h5ad')


def dense(x):
    return x.toarray() if hasattr(x, 'toarray') else np.asarray(x)


def load(stage):
    a = ad.read_h5ad(path(stage), backed='r')
    try:
        genes = list(map(str, a.var_names))
        idx = [genes.index(g) for g in GENES]
        selected = []
        totals = []
        for i in range(0, a.n_obs, 4096):
            c = np.asarray(dense(a.layers['counts'][i:i + 4096]), dtype=np.float32)
            selected.append(c[:, idx])
            totals.append(c.sum(axis=1))
        return dict(
            stage=stage,
            counts=np.concatenate(selected),
            total=np.concatenate(totals),
            celltype=a.obs['celltype'].astype(str).to_numpy(),
            z=np.round(np.asarray(a.obsm['spatial_3D'])[:, 2], 6),
            xy=np.asarray(a.obsm['spatial_3D'])[:, :2],
            obs_columns=list(a.obs.columns),
            var_columns=list(a.var.columns),
            uns_keys=list(a.uns.keys()),
        )
    finally:
        a.file.close()


def f(x):
    return float(x)


def gene_summary(d, label, mask):
    c, total = d['counts'][mask], d['total'][mask]
    out = []
    for j, g in enumerate(GENES):
        v = c[:, j]
        out.append(dict(
            stage=d['stage'], group=label, n=len(v), gene=g,
            detection=f(np.mean(v > 0)),
            mean_released_counts=f(np.mean(v)),
            mean_log_cp10k=f(np.mean(np.log1p(v / np.maximum(total, 1) * 10000))),
            positive_mean=f(np.mean(v[v > 0])) if np.any(v > 0) else None,
        ))
    return out


def conditional_pair(d, mask, g1, g2, threshold=1):
    c = d['counts'][mask]
    x = c[:, GENES.index(g1)] >= threshold
    y = c[:, GENES.index(g2)] >= threshold
    types = d['celltype'][mask]
    z = d['z'][mask]
    total = d['total'][mask]
    # Conditioning controls subtype, section and four abundance strata.
    q = np.searchsorted(np.quantile(total, [.25, .5, .75]), total)
    key = np.rec.fromarrays([types, z, q], names='type,z,depth')
    _, inv = np.unique(key, return_inverse=True)
    observed = int((x & y).sum())
    expected = 0.0
    covered = 0
    for k in np.unique(inv):
        ix = inv == k
        if ix.sum() >= 5:
            expected += x[ix].sum() * y[ix].sum() / ix.sum()
            covered += int((x[ix] & y[ix]).sum())
    return dict(
        stage=d['stage'], group='CM' if g1 in ('Nppa', 'Tbx2') else 'other',
        genes=[g1, g2], threshold=threshold, n=len(c),
        first_rate=f(x.mean()), second_rate=f(y.mean()),
        double_rate=f((x & y).mean()), observed_double=observed,
        observed_double_covered=covered,
        expected_double_conditional=f(expected),
        ratio_to_conditional=f(covered / expected) if expected else None,
    )


def lineage_mix(d):
    c = d['counts']
    ix = {g: GENES.index(g) for g in GENES}
    cm_support = (c[:, [ix['Ttn'], ix['Myh7'], ix['Myl4'], ix['Myl7']]] > 0).sum(1) >= 2
    en_support = (c[:, [ix['Pecam1'], ix['Cdh5'], ix['Esam'], ix['Emcn']]] > 0).sum(1) >= 2
    raw_cm = np.isin(d['celltype'], CM_TYPES)
    raw_en = np.isin(d['celltype'], ENDO_TYPES)
    dual = cm_support & en_support
    cm_strict = (c[:, [ix['Ttn'], ix['Myh7'], ix['Myl4'], ix['Myl7']]] >= 2).sum(1) >= 2
    en_strict = (c[:, [ix['Pecam1'], ix['Cdh5'], ix['Esam'], ix['Emcn']]] >= 2).sum(1) >= 2
    strict_dual = cm_strict & en_strict
    out = []
    for group, mask in [('all', np.ones(len(c), bool)), ('CM_label', raw_cm), ('Endo_label', raw_en)]:
        vals = d['total'][mask]
        out.append(dict(stage=d['stage'], group=group, n=int(mask.sum()),
                        cm_support=f(cm_support[mask].mean()),
                        endo_support=f(en_support[mask].mean()),
                        dual_support=f(dual[mask].mean()),
                        strict_dual_support=f(strict_dual[mask].mean()),
                        median_total=f(np.median(vals)),
                        median_total_dual=f(np.median(d['total'][mask & dual])) if np.any(mask & dual) else None))
    # Geometry: dual-marker cells versus all other cells within the same label.
    # The distance is to a cell of the opposite published broad type in the same section.
    for group, source, opposite in [('CM_label', raw_cm, raw_en), ('Endo_label', raw_en, raw_cm)]:
        distances = []
        for zz in np.unique(d['z']):
            src = np.flatnonzero(source & (d['z'] == zz))
            dst = np.flatnonzero(opposite & (d['z'] == zz))
            if len(src) and len(dst):
                dist = cKDTree(d['xy'][dst]).query(d['xy'][src], k=1)[0]
                distances.append((src, dist))
        if distances:
            src = np.concatenate([v[0] for v in distances])
            dist = np.concatenate([v[1] for v in distances])
            near = dist <= np.quantile(dist, .25)
            total = d['total'][src]
            depth = np.searchsorted(np.quantile(total, [.25, .5, .75]), total)
            key = np.rec.fromarrays([d['celltype'][src], d['z'][src], depth], names='type,z,depth')
            _, inv = np.unique(key, return_inverse=True)
            expected_near = 0.0
            expected_strict = 0.0
            for k in np.unique(inv):
                ix = inv == k
                if ix.sum() >= 5:
                    expected_near += dual[src[ix]].sum() * near[ix].mean()
                    expected_strict += strict_dual[src[ix]].sum() * near[ix].mean()
            out.append(dict(stage=d['stage'], group=group + '_boundary', n=len(src),
                            n_dual=int(dual[src].sum()),
                            n_strict_dual=int(strict_dual[src].sum()),
                            near_cutoff_published_units=f(np.quantile(dist, .25)),
                            near_rate_all=f(near.mean()),
                            near_rate_dual=f(near[dual[src]].mean()) if np.any(dual[src]) else None,
                            near_rate_strict_dual=f(near[strict_dual[src]].mean()) if np.any(strict_dual[src]) else None,
                            observed_near_dual=int(np.sum(near & dual[src])),
                            expected_near_dual_conditional=f(expected_near),
                            observed_near_strict_dual=int(np.sum(near & strict_dual[src])),
                            expected_near_strict_dual_conditional=f(expected_strict),
                            nearest_opposite_median_dual=f(np.median(dist[dual[src]])) if np.any(dual[src]) else None,
                            nearest_opposite_median_other=f(np.median(dist[~dual[src]])) if np.any(~dual[src]) else None))
    return out


def thinning(source, target):
    out = []
    co = []
    for typ in LATE_CM_TYPES + ENDO_TYPES:
        sc = source['counts'][source['celltype'] == typ]
        st = source['total'][source['celltype'] == typ]
        tc = target['counts'][target['celltype'] == typ]
        tt = target['total'][target['celltype'] == typ]
        if min(len(sc), len(tc)) < 100:
            continue
        p = min(1.0, f(tt.mean() / st.mean()))
        for j, gene in enumerate(GENES):
            sv = sc[:, j]
            tv = tc[:, j]
            pred = f(np.mean(1 - (1 - p) ** sv))
            out.append(dict(
                type=typ, gene=gene, source_n=len(sc), target_n=len(tc),
                source_depth_mean=f(st.mean()), target_depth_mean=f(tt.mean()),
                thinning_p=p, source_detection=f(np.mean(sv > 0)),
                predicted_detection=pred, target_detection=f(np.mean(tv > 0)),
                detection_residual=f(np.mean(tv > 0) - pred),
                source_counts_mean=f(np.mean(sv)),
                predicted_counts_mean=f(np.mean(sv) * p),
                target_counts_mean=f(np.mean(tv)),
            ))
        for g1, g2 in [('Nppa', 'Tbx2'), ('Myh7', 'Myl4'), ('Pecam1', 'Cdh5')]:
            j, k = GENES.index(g1), GENES.index(g2)
            u = 1 - (1 - p) ** sc[:, j]
            v = 1 - (1 - p) ** sc[:, k]
            co.append(dict(type=typ, pair=[g1, g2], p=p,
                           source=f(np.mean((sc[:, j] > 0) & (sc[:, k] > 0))),
                           predicted=f(np.mean(u * v)),
                           target=f(np.mean((tc[:, j] > 0) & (tc[:, k] > 0)))))
    return out, co


def main():
    all_data = {stage: load(stage) for stage in STAGES}
    summaries, pairs, mixes = [], [], []
    for stage, d in all_data.items():
        for typ in CM_TYPES + ENDO_TYPES:
            mask = d['celltype'] == typ
            if mask.sum() >= 50:
                summaries.extend(gene_summary(d, typ, mask))
        cm = np.isin(d['celltype'], CM_TYPES)
        en = np.isin(d['celltype'], ENDO_TYPES)
        for g1, g2 in PAIRS:
            mask = en if g1 in ('Pecam1', 'Esam') else cm
            for threshold in (1, 2):
                pairs.append(conditional_pair(d, mask, g1, g2, threshold))
        mixes.extend(lineage_mix(d))
    thin, thin_pairs = thinning(all_data['E9.5'], all_data['E10.5'])
    result = dict(
        provenance='official T2 heart files in t2_heart_analysis_20261116/config.json',
        stages=list(STAGES),
        fields={k: {name: d[name] for name in ('obs_columns', 'var_columns', 'uns_keys')}
                for k, d in all_data.items()},
        gene_summary=summaries,
        pair_conditioned=pairs,
        lineage_mix=mixes,
        thinning=thin,
        thinning_pairs=thin_pairs,
    )
    print(json.dumps(result, separators=(',', ':')))


if __name__ == '__main__':
    main()
