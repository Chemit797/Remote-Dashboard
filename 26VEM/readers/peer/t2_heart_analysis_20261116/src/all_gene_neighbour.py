"""Exploratory all-panel neighbour scan with target-excluded detection covariate.

Run via run_remote.ps1. Inputs are the five hashed official files in the pinned remote
config. Outputs are a compressed CSV and JSON summary printed to stdout.
"""
import base64
import gzip
import io
import json
import os
import pathlib
import sys

os.environ['OPENBLAS_NUM_THREADS'] = '2'
os.environ['OMP_NUM_THREADS'] = '2'

import anndata as ad
import numpy as np
import pandas as pd
from scipy.spatial import cKDTree
from sklearn.linear_model import Ridge
from sklearn.preprocessing import StandardScaler

ROOT = pathlib.Path('/home/biocosmosx/work/virtualembryo_cym/experiments/t2_heart_analysis_20261116')
sys.path.insert(0, str(ROOT / 'src'))
from label_mapping import broad_label

CONFIG = json.loads((ROOT / 'config.json').read_text())
RNG = np.random.default_rng(20261116)
NEIGHBOUR_TYPES = ('Cardiomyocyte', 'Endothelial/endocardial',
                   'Cardiac progenitor/heart field', 'Other mesoderm')
FEATURE_TYPES = NEIGHBOUR_TYPES
STAGES = tuple(x['file_id'] for x in CONFIG['inputs'])
if '--cm-only' in sys.argv:
    FEATURE_TYPES = ('Cardiomyocyte',)
elif '--non-cm' in sys.argv:
    FEATURE_TYPES = NEIGHBOUR_TYPES[1:]
ROWS = []


def fit_predict(train, test, y, base, neighbour):
    scaler = StandardScaler()
    ztrain = scaler.fit_transform(base[train])
    ztest = scaler.transform(base[test])
    model = Ridge(alpha=10.0)
    model.fit(ztrain, y[train])
    pred0 = model.predict(ztest)
    scaler1 = StandardScaler()
    ztrain1 = scaler1.fit_transform(np.column_stack((base[train], neighbour[train])))
    ztest1 = scaler1.transform(np.column_stack((base[test], neighbour[test])))
    model1 = Ridge(alpha=10.0)
    model1.fit(ztrain1, y[train])
    pred1 = model1.predict(ztest1)
    return pred0, pred1


def augmented_predict(train, test, y, base, neighbour):
    scaler = StandardScaler()
    ztrain = scaler.fit_transform(np.column_stack((base[train], neighbour[train])))
    ztest = scaler.transform(np.column_stack((base[test], neighbour[test])))
    model = Ridge(alpha=10.0)
    model.fit(ztrain, y[train])
    return model.predict(ztest)


for stage_index, inp in enumerate(CONFIG['inputs']):
    stage = inp['file_id']
    a = ad.read_h5ad(inp['path'], backed='r')
    try:
        assert a.shape == (inp['cells'], 500)
        raw = a.obs['celltype'].astype(str).to_numpy()
        broad = np.asarray([broad_label(v)[0] for v in raw])
        xyz = np.asarray(a.obsm['spatial_3D'])
        z = np.round(xyz[:, 2], 6)
        xy = (xyz[:, :2] - np.median(xyz[:, :2], axis=0)) / (np.std(xyz[:, :2], axis=0) + 1e-9)
        region = (xy[:, 0] > 0).astype(int) + 2 * (xy[:, 1] > 0).astype(int)
        zb = np.searchsorted(np.quantile(z, [0.25, 0.5, 0.75]), z)
        blocks_all = region + 4 * (zb >= 2).astype(int)
        neighbours = np.empty((len(raw), 15), dtype=np.int32)
        for level in np.unique(z):
            ids = np.flatnonzero(z == level)
            if len(ids) < 2:
                neighbours[ids] = ids[0]
                continue
            _, near = cKDTree(xyz[ids, :2]).query(xyz[ids, :2], k=min(16, len(ids)))
            selected = ids[near[:, 1:]]
            if selected.shape[1] < 15:
                selected = np.pad(selected, ((0, 0), (0, 15 - selected.shape[1])), mode='edge')
            neighbours[ids] = selected
        names = np.asarray(a.var_names).astype(str)
        for group_index, group in enumerate(FEATURE_TYPES):
            ids = np.flatnonzero(broad == group)
            if len(ids) < 250:
                continue
            if len(ids) > 3000:
                ids = np.sort(RNG.choice(ids, 3000, replace=False))
            X = a[ids, :].X
            X = np.asarray(X.toarray() if hasattr(X, 'toarray') else X, dtype=np.float32)
            found = X > 0
            det = found.sum(1).astype(np.float32)
            yvar = X.var(axis=0)
            onehot = pd.get_dummies(pd.Series(raw[ids]), dtype=np.float32).to_numpy()
            pos = np.column_stack((xy[ids], xy[ids] ** 2, xy[ids, 0] * xy[ids, 1],
                                   (z[ids] - z.mean()) / (z.std() + 1e-9))).astype(np.float32)
            nb = np.column_stack([(broad[neighbours[ids]] == label).mean(1)
                                  for label in NEIGHBOUR_TYPES]).astype(np.float32)
            strata = pd.Series(raw[ids].astype(str) + '|' + blocks_all[ids].astype(str))
            shuffled = nb.copy()
            for members in strata.groupby(strata).groups.values():
                members = np.asarray(list(members), dtype=int)
                shuffled[members] = nb[RNG.permutation(members)]
            blocks = blocks_all[ids]
            folds = [(blocks != b, blocks == b) for b in np.unique(blocks)
                     if (blocks == b).sum() >= 20 and (blocks != b).sum() >= 100]
            print('scan', stage, group, len(ids), 'blocks', len(folds), file=sys.stderr, flush=True)
            for j, gene in enumerate(names):
                target = X[:, j].astype(np.float64)
                detection = float(found[:, j].mean())
                if yvar[j] < 1e-8:
                    ROWS.append(dict(stage=stage, cell_type=group, gene=gene, n=len(ids),
                                     detection=detection, variance=float(yvar[j]), blocks=len(folds),
                                     r2_position=np.nan, r2_neighbour=np.nan, r2_shuffled=np.nan,
                                     delta_r2=np.nan, delta_over_shuffled=np.nan))
                    continue
                q = (det - found[:, j].astype(np.float32)) / 499.0
                base = np.column_stack((onehot, q, q * q, pos))
                mse0 = mse1 = msen = count = 0.0
                for train, test in folds:
                    pred0, pred1 = fit_predict(train, test, target, base, nb)
                    predn = augmented_predict(train, test, target, base, shuffled)
                    mse0 += float(np.square(target[test] - pred0).sum())
                    mse1 += float(np.square(target[test] - pred1).sum())
                    msen += float(np.square(target[test] - predn).sum())
                    count += int(test.sum())
                scale = float(yvar[j]) * count
                r0, r1, rn = 1 - mse0 / scale, 1 - mse1 / scale, 1 - msen / scale
                ROWS.append(dict(stage=stage, cell_type=group, gene=gene, n=len(ids),
                                 detection=detection, variance=float(yvar[j]), blocks=len(folds),
                                 r2_position=r0, r2_neighbour=r1, r2_shuffled=rn,
                                 delta_r2=r1-r0, delta_over_shuffled=r1-rn))
    finally:
        a.file.close()

result = pd.DataFrame(ROWS)
buffer = io.BytesIO()
with gzip.GzipFile(fileobj=buffer, mode='wb') as stream:
    stream.write(result.to_csv(index=False).encode('utf-8'))
print(json.dumps({'stages': STAGES, 'types': FEATURE_TYPES,
                  'neighbour_types': NEIGHBOUR_TYPES, 'max_cells_per_group': 3000,
                  'rows': len(result),
                  'csv_gzip_base64': base64.b64encode(buffer.getvalue()).decode('ascii')}))
