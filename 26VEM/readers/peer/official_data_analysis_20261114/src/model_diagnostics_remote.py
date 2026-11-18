"""Read-only P2 prediction diagnostics against verified official truth files.

The scorer functions are imported from a pinned public veckit checkout. This
script reports raw metrics on a fixed cell subsample, never an official score.
"""
from __future__ import annotations

import argparse
import csv
import hashlib
import importlib.util
import json
import math
from pathlib import Path
import sys

import anndata as ad
import numpy as np
from scipy import sparse


RANKED_METRICS = {
    "T1": ("de_score", "de_direction", "mmd_u", "variogram"),
    "T2": ("de_score", "de_direction", "mmd_u", "variogram", "d2_shape",
           "occupancy_dice", "scale_log_ratio", "neighborhood_mmd"),
    "T3": ("de_score", "de_direction", "severity_slope", "mmd_u", "variogram"),
}
LABEL_KEYS = ("celltype", "cell_type", "cell_type_l2", "cell_type_l1", "annotation")


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(8 << 20), b""):
            digest.update(block)
    return digest.hexdigest()


def finite_number(value):
    value = float(value)
    return value if math.isfinite(value) else None


def write_csv(path: Path, rows: list[dict], columns: list[str] | None = None):
    if columns is None:
        columns = list(dict.fromkeys(key for row in rows for key in row))
    with path.open("w", newline="", encoding="utf-8-sig") as handle:
        writer = csv.DictWriter(handle, fieldnames=columns, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(rows)


def matrix_stats(adata: ad.AnnData):
    x = adata.X
    if sparse.issparse(x):
        csc = x.tocsc(copy=False)
        csc.eliminate_zeros()
        n_positive = np.diff(csc.indptr).astype(np.int64)
        mean_log = np.asarray(csc.mean(axis=0)).ravel()
        linear = csc.copy().astype(np.float64)
        linear.data = np.expm1(linear.data)
        mean_linear = np.asarray(linear.mean(axis=0)).ravel()
        row_detected = np.asarray(csc.getnnz(axis=1)).ravel()
        row_linear_sum = np.asarray(linear.sum(axis=1)).ravel()
        positive_median = np.full(adata.n_vars, np.nan)
        positive_p90 = np.full(adata.n_vars, np.nan)
        for j in np.flatnonzero(n_positive):
            values = csc.data[csc.indptr[j]:csc.indptr[j + 1]]
            positive_median[j] = np.median(values)
            positive_p90[j] = np.quantile(values, 0.9)
        nonfinite = int(np.sum(~np.isfinite(csc.data)))
        negative = int(np.sum(csc.data < 0))
    else:
        dense = np.asarray(x)
        n_positive = np.count_nonzero(dense, axis=0)
        mean_log = dense.mean(axis=0)
        mean_linear = np.expm1(dense).mean(axis=0)
        row_detected = np.count_nonzero(dense, axis=1)
        row_linear_sum = np.expm1(dense).sum(axis=1)
        positive_median = np.array([np.median(col[col > 0]) if np.any(col > 0) else np.nan
                                    for col in dense.T])
        positive_p90 = np.array([np.quantile(col[col > 0], 0.9) if np.any(col > 0) else np.nan
                                 for col in dense.T])
        nonfinite = int(np.sum(~np.isfinite(dense)))
        negative = int(np.sum(dense < 0))
    records = {}
    for j, gene in enumerate(adata.var_names.astype(str)):
        records[gene] = {
            "n_positive": int(n_positive[j]),
            "detected_fraction": finite_number(n_positive[j] / max(adata.n_obs, 1)),
            "mean_log1p": finite_number(mean_log[j]),
            "mean_expm1_log1p": finite_number(mean_linear[j]),
            "positive_median_log1p": finite_number(positive_median[j]),
            "positive_p90_log1p": finite_number(positive_p90[j]),
        }
    summary = {
        "n_cells": int(adata.n_obs), "n_genes": int(adata.n_vars),
        "nonfinite_stored": nonfinite, "negative_stored": negative,
        "detected_per_cell_q10_q50_q90": [finite_number(v) for v in np.quantile(row_detected, [0.1, 0.5, 0.9])],
        "linear_normalized_sum_q10_q50_q90": [finite_number(v) for v in np.quantile(row_linear_sum, [0.1, 0.5, 0.9])],
        "zero_cell_count": int(np.sum(row_detected == 0)),
        "zero_gene_count": int(np.sum(n_positive == 0)),
        "matrix_storage": type(x).__name__,
    }
    return records, summary, row_detected


def labels(adata: ad.AnnData, override: str | None):
    key = override if override is not None else next((k for k in LABEL_KEYS if k in adata.obs), None)
    if key is None or key not in adata.obs:
        return None, None
    return key, np.asarray(adata.obs[key].astype(str))


def coordinate_stats(adata: ad.AnnData, row_detected: np.ndarray, case: str, role: str):
    if "spatial_3D" not in adata.obsm:
        return None, []
    coords = np.asarray(adata.obsm["spatial_3D"], dtype=np.float64)
    if coords.ndim != 2 or coords.shape[1] < 3 or coords.shape[0] != adata.n_obs:
        return {"status": "invalid_shape", "shape": list(coords.shape)}, []
    coords = coords[:, :3]
    valid = np.isfinite(coords).all(axis=1)
    xyz = coords[valid]
    if len(xyz) == 0:
        return {"status": "no_finite_coordinates"}, []
    centered = xyz - xyz.mean(axis=0)
    eig = np.linalg.eigvalsh(centered.T @ centered / len(xyz))[::-1]
    z, inverse = np.unique(xyz[:, 2], return_inverse=True)
    slice_rows = []
    if len(z) <= 500:
        for j, value in enumerate(z):
            mask = inverse == j
            slice_rows.append({
                "case": case, "role": role, "z_published": finite_number(value),
                "n_cells": int(mask.sum()),
                "median_detected_genes": finite_number(np.median(row_detected[valid][mask])),
            })
    return {
        "status": "available_published_units_unverified", "n_finite": int(valid.sum()),
        "n_nonfinite": int((~valid).sum()), "n_unique_xyz": int(np.unique(xyz, axis=0).shape[0]),
        "n_unique_z": int(len(z)), "z_step_unique_head": [finite_number(v) for v in np.unique(np.diff(z))[:12]],
        "min_xyz": [finite_number(v) for v in xyz.min(axis=0)],
        "max_xyz": [finite_number(v) for v in xyz.max(axis=0)],
        "rms_published": finite_number(np.sqrt(np.mean(np.sum(centered ** 2, axis=1)))),
        "principal_variance_published_squared": [finite_number(v) for v in eig],
    }, slice_rows


def sampled_dense(adata: ad.AnnData, genes: list[str], seed: int, offset: int, cap: int):
    count = min(adata.n_obs, cap)
    rows = np.random.default_rng(seed + offset).choice(adata.n_obs, count, replace=False)
    x = adata[rows, genes].X
    return (x.toarray() if sparse.issparse(x) else np.asarray(x)).astype(np.float32), rows


def column_mean_and_detection(x):
    if sparse.issparse(x):
        return (np.asarray(x.mean(axis=0)).ravel(),
                np.asarray(x.getnnz(axis=0)).ravel() / x.shape[0])
    values = np.asarray(x)
    return values.mean(axis=0), np.count_nonzero(values, axis=0) / values.shape[0]


def load_public_metrics(scorer_root: Path):
    root = scorer_root.resolve()
    sys.path.insert(0, str(root))
    from common import core_metrics, shape_metrics
    t2_path = root / "T2" / "metrics.py"
    if t2_path.exists():
        # T2 imports the canonical T1 metrics through the private _reuse shim.
        scorer_path = root / "score_h5ad.py"
        spec = importlib.util.spec_from_file_location("verified_score_h5ad", scorer_path)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        t2, _ = module._load_task_metrics("T2")
    else:
        t2 = None
    return core_metrics, shape_metrics, t2


def raw_metrics(task: str, pred: ad.AnnData, truth: ad.AnnData,
                ref: ad.AnnData, genes: list[str], scorer_root: Path,
                seeds: list[int], cap: int):
    core, shape, t2 = load_public_metrics(scorer_root)
    has_coords = "spatial_3D" in pred.obsm and "spatial_3D" in truth.obsm
    output = []
    for seed in seeds:
        px, prow = sampled_dense(pred, genes, seed, 33000, cap)
        tx, trow = sampled_dense(truth, genes, seed, 11000, cap)
        rx, _ = sampled_dense(ref, genes, seed, 22000, cap)
        de = core.de_score(px, tx, rx)
        ranked = {
            "de_score": de["score"],
            "de_direction": core.de_direction(px, tx, rx),
            "mmd_u": core.mmd_unbiased(px, tx, seed=seed),
            "variogram": core.variogram_score(px, tx, seed=seed),
        }
        if task == "T3":
            slope, r2 = core.severity_slope(px, tx, rx)
            ranked["severity_slope"] = slope
            ranked["severity_slope_r2"] = r2
        if task in ("T2", "T3") and has_coords:
            pc = np.asarray(pred.obsm["spatial_3D"])[prow, :3]
            tc = np.asarray(truth.obsm["spatial_3D"])[trow, :3]
            dice, occupancy_aux = shape.occupancy_dice(pc, tc, seed=seed)
            spatial_raw = {
                "d2_shape": shape.d2_distance(pc, tc, seed=seed),
                "occupancy_dice": dice,
                "scale_log_ratio": shape.scale_log_ratio(pc, tc),
                "neighborhood_mmd": t2.neighborhood_mmd(px, pc, tx, tc),
                "occupancy_voxel_over_nn": occupancy_aux,
            }
            if task == "T2":
                ranked.update(spatial_raw)
            shuffled = px[np.random.default_rng(seed + 44000).permutation(len(px))]
            spatial_raw["neighborhood_mmd_position_shuffle_control"] = t2.neighborhood_mmd(
                shuffled, pc, tx, tc)
            if task == "T2":
                ranked.update(spatial_raw)
        auxiliary = {
            "pb_rel_err": core.pb_rel_err(px, tx),
            "library_size_ratio": core.library_size_ratio(px, tx),
            "variance_ratio": core.variance_ratio(px, tx),
            "energy_distance": core.energy_distance(px, tx, seed=seed),
        }
        if task == "T3" and has_coords:
            auxiliary.update({f"spatial_v2_{key}": value for key, value in spatial_raw.items()})
        output.append({
            "seed": seed, "n_prediction": len(prow), "n_truth": len(trow),
            "n_reference": min(ref.n_obs, cap), "n_common_genes": len(genes),
            "ranked_raw": {k: finite_number(v) for k, v in ranked.items()},
            "auxiliary_raw": {k: finite_number(v) for k, v in auxiliary.items()},
            "truth_de_up": de["n_up"], "truth_de_down": de["n_dn"],
        })
    return output


def composition_diagnostic(case: str, pred: ad.AnnData, truth: ad.AnnData,
                           pred_label: np.ndarray | None, truth_label: np.ndarray | None):
    if pred_label is None or truth_label is None:
        return {"status": "not_estimable_missing_labels"}
    pred_counts = {str(k): int(v) for k, v in zip(*np.unique(pred_label, return_counts=True))}
    truth_counts = {str(k): int(v) for k, v in zip(*np.unique(truth_label, return_counts=True))}
    common = sorted(set(pred_counts) & set(truth_counts))
    if len(common) < 2:
        return {"status": "not_estimable_label_mapping", "common_labels": common}
    # Reweighting requires conditional expression, not just marginal gene means.
    genes = sorted(set(pred.var_names.astype(str)) & set(truth.var_names.astype(str)))
    if not genes:
        return {"status": "not_estimable_no_common_genes"}
    target_weights = np.array([truth_counts[k] for k in common], dtype=float)
    target_weights /= target_weights.sum()
    original_weights = np.array([pred_counts[k] for k in common], dtype=float)
    original_weights /= original_weights.sum()
    sums = np.zeros((len(common), len(genes)), dtype=float)
    detect = np.zeros_like(sums)
    truth_sums = np.zeros_like(sums)
    truth_detect = np.zeros_like(sums)
    type_rows = []
    for j, label in enumerate(common):
        sums[j], detect[j] = column_mean_and_detection(pred[pred_label == label, genes].X)
        truth_sums[j], truth_detect[j] = column_mean_and_detection(truth[truth_label == label, genes].X)
        type_rows.append({
            "case": case, "raw_label": label, "prediction_cells": pred_counts[label],
            "truth_cells": truth_counts[label], "n_common_genes": len(genes),
            "within_type_mean_log1p_mae": finite_number(np.mean(np.abs(sums[j] - truth_sums[j]))),
            "within_type_detection_mae": finite_number(np.mean(np.abs(detect[j] - truth_detect[j]))),
        })
    target_mean = target_weights @ truth_sums
    target_detect = target_weights @ truth_detect
    original_mean = original_weights @ sums
    reweighted_mean = target_weights @ sums
    original_detect = original_weights @ detect
    reweighted_detect = target_weights @ detect
    return {
        "status": "truth_assisted_diagnostic_not_deployable",
        "label_scope": "exact_shared_labels_only",
        "common_labels": common,
        "truth_coverage": finite_number(sum(truth_counts[k] for k in common) / truth.n_obs),
        "prediction_coverage": finite_number(sum(pred_counts[k] for k in common) / pred.n_obs),
        "n_genes": len(genes),
        "mean_log1p_mae_before": finite_number(np.mean(np.abs(original_mean - target_mean))),
        "mean_log1p_mae_after": finite_number(np.mean(np.abs(reweighted_mean - target_mean))),
        "detection_mae_before": finite_number(np.mean(np.abs(original_detect - target_detect))),
        "detection_mae_after": finite_number(np.mean(np.abs(reweighted_detect - target_detect))),
    }, type_rows


def run_case(config: dict, outdir: Path, scorer_root: Path, seeds: list[int], cap: int):
    case = str(config["id"])
    task = str(config["task"])
    if task not in RANKED_METRICS:
        raise ValueError(f"Unsupported task: {task}")
    paths = {role: Path(config[role]).resolve() for role in ("prediction", "truth", "reference")}
    for path in paths.values():
        if not path.is_file():
            raise FileNotFoundError(path)
    data = {role: ad.read_h5ad(path) for role, path in paths.items()}
    by_role, summaries, detected = {}, {}, {}
    for role, item in data.items():
        by_role[role], summaries[role], detected[role] = matrix_stats(item)
    genes = sorted(set(by_role["prediction"]) & set(by_role["truth"]) & set(by_role["reference"]))
    all_genes = sorted(set().union(*(set(v) for v in by_role.values())))
    gene_rows = []
    for gene in all_genes:
        row = {"case": case, "gene": gene, "three_way_observed": gene in genes}
        for role in ("prediction", "truth", "reference"):
            row[f"{role}_observed"] = gene in by_role[role]
            for key, value in by_role[role].get(gene, {}).items():
                row[f"{role}_{key}"] = value
        if gene in by_role["prediction"] and gene in by_role["truth"]:
            for key in ("detected_fraction", "mean_log1p", "positive_median_log1p"):
                a, b = by_role["prediction"][gene][key], by_role["truth"][gene][key]
                row[f"prediction_minus_truth_{key}"] = finite_number(a - b) if a is not None and b is not None else None
        gene_rows.append(row)
    write_csv(outdir / f"{case}_genes.csv", gene_rows)

    label_data = {role: labels(data[role], config.get(f"{role}_label_key")) for role in data}
    type_rows = []
    for role, (key, values) in label_data.items():
        if values is None:
            continue
        names, counts = np.unique(values, return_counts=True)
        for name, count in zip(names, counts):
            type_rows.append({"case": case, "role": role, "label_field": key,
                              "raw_label": name, "n_cells": int(count),
                              "fraction": finite_number(count / len(values))})
    write_csv(outdir / f"{case}_types.csv", type_rows,
              ["case", "role", "label_field", "raw_label", "n_cells", "fraction"])

    spatial = {}
    slice_rows = []
    for role in data:
        spatial[role], rows = coordinate_stats(data[role], detected[role], case, role)
        slice_rows.extend(rows)
    write_csv(outdir / f"{case}_slices.csv", slice_rows,
              ["case", "role", "z_published", "n_cells", "median_detected_genes"])

    metric_status = "complete" if len(genes) == data["prediction"].n_vars == data["truth"].n_vars == data["reference"].n_vars else "three_way_intersection_research_only"
    for role, summary in summaries.items():
        if summary["negative_stored"] or summary["nonfinite_stored"]:
            metric_status = "invalid_expression_values"
    metrics = []
    if metric_status != "invalid_expression_values" and len(genes) >= 30:
        if task != "T2" or (spatial["prediction"] is not None and spatial["truth"] is not None):
            metrics = raw_metrics(task, data["prediction"], data["truth"], data["reference"],
                                  genes, scorer_root, seeds, cap)
        else:
            metric_status = "missing_spatial_3d"
    else:
        metric_status = "insufficient_common_genes_or_invalid_expression"
    comp_result = composition_diagnostic(case, data["prediction"], data["truth"],
                                         label_data["prediction"][1], label_data["truth"][1])
    comp, type_error_rows = comp_result if isinstance(comp_result, tuple) else (comp_result, [])
    write_csv(outdir / f"{case}_type_errors.csv", type_error_rows,
              ["case", "raw_label", "prediction_cells", "truth_cells", "n_common_genes",
               "within_type_mean_log1p_mae", "within_type_detection_mae"])
    result = {
        "case": case, "task": task, "setting": config.get("setting"),
        "interpretation": "P2 development diagnostic, not independent validation or an official score",
        "matrix_scale": "X requires file-level scale verification; expm1(log1p-normalized X) is not raw counts",
        "independent_unit": "unknown from these files; fixed cell subsamples are technical repeats",
        "input_paths": {role: str(path) for role, path in paths.items()},
        "input_sha256": {role: sha256(path) for role, path in paths.items()},
        "gene_axis_sha256": {role: hashlib.sha256("\n".join(data[role].var_names.astype(str)).encode()).hexdigest()
                             for role in data},
        "cell_and_gene_summary": summaries,
        "gene_coverage": {"three_way_observed": len(genes), "union": len(all_genes),
                          "truth_missing_in_prediction": len(set(by_role["truth"]) - set(by_role["prediction"]))},
        "label_fields": {role: label_data[role][0] for role in data},
        "spatial": spatial, "metric_status": metric_status,
        "public_ranked_metric_keys": RANKED_METRICS[task],
        "raw_metrics_fixed_cell_subsamples": metrics,
        "composition_reweighting": comp,
        "outputs": [f"{case}_genes.csv", f"{case}_types.csv", f"{case}_type_errors.csv",
                    f"{case}_slices.csv", f"{case}_diagnostic.json"],
    }
    (outdir / f"{case}_diagnostic.json").write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    return result


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--config", type=Path, required=True)
    parser.add_argument("--outdir", type=Path, required=True)
    parser.add_argument("--scorer-root", type=Path, required=True)
    parser.add_argument("--seeds", default="0,17,43")
    parser.add_argument("--max-metric-cells", type=int, default=1000)
    args = parser.parse_args()
    args.outdir.mkdir(parents=True, exist_ok=True)
    cases = json.loads(args.config.read_text(encoding="utf-8"))["cases"]
    seeds = [int(value) for value in args.seeds.split(",")]
    results = []
    for case in cases:
        result = run_case(case, args.outdir, args.scorer_root, seeds, args.max_metric_cells)
        results.append({"case": result["case"], "metric_status": result["metric_status"],
                        "gene_coverage": result["gene_coverage"]})
        print(json.dumps(results[-1], ensure_ascii=False), flush=True)
    script_path = Path(__file__)
    (args.outdir / "A8_INDEX.json").write_text(json.dumps({
        "script_sha256": sha256(script_path) if script_path.is_file() else None,
        "script_delivery": "stdin" if not script_path.is_file() else str(script_path),
        "scorer_root": str(args.scorer_root),
        "scorer_sha256": sha256(args.scorer_root / "score_h5ad.py"),
        "seeds": seeds, "max_metric_cells": args.max_metric_cells,
        "cases": results,
    }, ensure_ascii=False, indent=2), encoding="utf-8")


if __name__ == "__main__":
    main()
