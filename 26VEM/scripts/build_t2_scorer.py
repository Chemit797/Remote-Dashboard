"""Project the verified T2 reports into an aggregate-only dashboard snapshot."""
import argparse
from collections import Counter
import csv
from datetime import datetime, timedelta, timezone
import hashlib
import json
import math
from pathlib import Path
import re


ASSET = Path(__file__).resolve().parents[1] / "assets/t2-scorer-data.js"
REVIEW = "review_20261122"
BEDS = "full_beds_20261122"
REGISTRY = f"{BEDS}/REGISTRY.json"
RELEASE = "core_v1/RELEASE.json"
BOARDS = (
    ("T2A", "胚胎插值", "embryo", "interp", ["E6.75", "E7.25", "E8.0"]),
    ("T2B", "心脏外推", "heart", "extrap", ["E8.25 late", "E8.5", "E8.75", "E9.5"]),
)
METRIC_GROUPS = (
    ("表达变化", ["DES", "DCS"]),
    ("状态分布", ["MMD", "CSS"]),
    ("形状与尺寸", ["SDD", "ODS", "TSR"]),
    ("局部组织", ["NFS"]),
)
RECORD_STATES = {
    ("generated", "full"): "full",
    ("generated", "expression_only"): "expressionOnly",
    ("not_applicable", "full"): "notApplicable",
    ("not_applicable", "expression_only"): "notApplicable",
    ("not_run", "full"): "notRun",
    ("not_run", "expression_only"): "notRun",
}


def require(condition, reason):
    if not condition:
        raise ValueError(reason)


def score_counts(path, board, scored_beds, release_sha, bed_version):
    """Retain the number of records in each state and never export row data."""
    counts = dict.fromkeys(RECORD_STATES.values(), 0)
    seen = set()
    with path.open(encoding="utf-8", newline="") as stream:
        for row in csv.DictReader(stream):
            bed = row["bed_id"]
            key = (row["recipe_id"], bed, row["seed"], row["ref_mode"])
            state = RECORD_STATES.get((row["status"], row["modality"]))
            scored = state in {"full", "expressionOnly"}
            require(key not in seen and row["board"] == board and
                    row["modality"] == scored_beds.get(bed) and
                    row["release_sha256"] == release_sha and row["bed_version"] == bed_version,
                    f"{board}: inconsistent review row")
            require(state and bool(row["total"]) == (state == "full") and
                    bool(row["expr_half"]) == scored and
                    (not scored or math.isfinite(float(row["expr_half"]))) and
                    (state != "full" or math.isfinite(float(row["total"]))),
                    f"{board}: unexpected score status")
            counts[state] += 1
            seen.add(key)
    require(bool(counts["full"] and counts["expressionOnly"]), f"{board}: missing reviewed scores")
    return counts


def target_stage(panel, split):
    match = re.search(r"\((E\d+(?:\.\d+)?)\)$", panel["label"])
    require(panel["split"] == split and panel["task"] == "T2" and match, "unexpected T2 panel")
    return match[1]


def build(project):
    root = project / "reports/vem_scorer/t2"
    sources, hashes = [], {}

    def read(path, label):
        raw = (root / path).read_bytes()
        sha = hashes[path] = hashlib.sha256(raw).hexdigest()
        sources.append({"label": label, "sha256": sha})
        return json.loads(raw)

    release = read(RELEASE, "评分核心发布记录")
    anchors = read("core_v1/ANCHOR_CHECK.json", "三块验证板回归")
    gates = read("core_v1/GATES.json", "冻结回归门槛")
    registry = read(REGISTRY, "考场登记")
    coverage = read(f"{BEDS}/FULL_COVERAGE.json", "工作集覆盖审计")
    review = read(f"{REVIEW}/REVIEW_SUMMARY.json", "两板 TEST 干跑验收")
    panels = read("source/verifier/panels_index.json", "官网验证与测试目标")
    worksets = coverage["beds"]
    beds = registry["beds"]
    require(len(beds) == len(worksets) and {b["bed_id"] for b in beds} == set(worksets) and
            all(b["status"] == "published" and worksets[b["bed_id"]]["kind"] == b["kind"] for b in beds),
            "bed registry and coverage disagree")
    require(coverage["pass"] and not coverage["missing_worksets"] and
            not coverage["invalid_anchor_worksets"] and not coverage["indexed_batch_failures"] and
            coverage["registry_sha256"] == review["registry"]["sha256"] == hashes[REGISTRY] and
            coverage["release_sha256"] == hashes[RELEASE] and
            sum(w["expected_worksets"] for w in worksets.values()) == coverage["expected_worksets"] and
            sum(w["covered_worksets"] for w in worksets.values()) == coverage["covered_worksets"] ==
            coverage["expected_worksets"] and coverage["reference_controls_equal_50"] > 0,
            "workset audit has gaps or uses a different registry/release")

    history = anchors["history"]
    matched = sum(b["matching_anchors"] for b in anchors["boards"].values())
    gate_matches = sum(g["display_match"] is True for g in gates.values())
    require(release["grade"] == anchors["grade"] == "A" and
            matched == len(anchors["comparisons"]) > 0 and not anchors["anchor_mismatch_count"] and
            history["count"] == history["scored"] == history["within_0_01"] > 0 and
            0 <= history["max_absolute_delta"] <= 0.01 and
            gate_matches == anchors["matching_gate_displays"] == len(gates) > 0 and
            set(release["gates"]) == set(gates), "core regression does not match the frozen release")

    boards = []
    for board, title, setting, mode, visible in BOARDS:
        val_key, test_key = f"T2:{setting}:val_{mode}", f"T2:{setting}:test_{mode}"
        validation_target = target_stage(panels[val_key], f"val_{mode}")
        test_target = target_stage(panels[test_key], "test")
        board_beds = [b for b in beds if b["board_key"] in {val_key, test_key}]
        by_kind = Counter(b["kind"] for b in board_beds)
        require(by_kind["official"] == by_kind["test"] == 1 and by_kind["wild"] > 0,
                f"{board}: expected one validation and one TEST bed")
        board_worksets = [worksets[b["bed_id"]] for b in board_beds]
        require(all(w["covered_worksets"] == w["expected_worksets"] and
                    (w["expected_worksets"] == 0) == (w["kind"] == "test") for w in board_worksets),
                f"{board}: incorrect validation/TEST coverage")
        dryrun = review["boards"][board]
        passed = sum(r["status"] == "passed" for r in dryrun["dryruns"])
        require(dryrun["status"] == "passed" and passed == len(dryrun["dryruns"]) > 0,
                f"{board}: incomplete TEST dry runs")

        mock = read(f"{REVIEW}/{board}/MOCK_EXAM.json", f"{board} 留一族模拟考")
        expression = mock["expression_leave_one_family_out"]
        correct, judged, eligible = (expression[k] for k in ("correct_pairs", "predicted_pairs", "decidable_pairs"))
        require(0 <= correct <= judged <= eligible and judged > 0 and
                math.isclose(correct / judged, expression["accuracy"]) and
                math.isclose(judged / eligible, expression["coverage"]), f"{board}: inconsistent mock exam counts")
        master = f"{REVIEW}/{board}/RESULTS_MASTER.csv"
        result = score_counts(root / master, board,
                              {b["bed_id"]: b["modality"] for b in board_beds if b["kind"] != "test"},
                              hashes[RELEASE], registry["version"])
        sources.append({"label": f"{board} 开发评估成绩汇总表",
                        "sha256": hashlib.sha256((root / master).read_bytes()).hexdigest()})
        boards.append({
            "id": board, "title": title, "visible": visible,
            "testVisible": sorted([*visible, validation_target], key=lambda stage: float(stage.split()[0][1:])),
            "validationTarget": validation_target, "testTarget": test_target,
            "officialBeds": by_kind["official"], "externalBeds": by_kind["wild"], "testBeds": by_kind["test"],
            "worksetsCovered": sum(w["covered_worksets"] for w in board_worksets),
            "worksetsExpected": sum(w["expected_worksets"] for w in board_worksets),
            "dryrunsPassed": passed, "dryrunsExpected": len(dryrun["dryruns"]),
            "records": result, "mock": {"correct": correct, "judged": judged, "eligible": eligible},
        })
    total_dryruns = sum(board["dryrunsExpected"] for board in boards)
    require(review["status"] == "passed" and total_dryruns == review["expected_dryruns"] ==
            review["passed_dryruns"] and set(review["boards"]) == {board["id"] for board in boards},
            "board and aggregate dry-run counts disagree")
    all_beds = Counter(b["kind"] for b in beds)
    require(sum(board["worksetsCovered"] for board in boards) == coverage["covered_worksets"] and
            sum(board["officialBeds"] + board["externalBeds"] + board["testBeds"] for board in boards) == len(beds),
            "all beds and worksets must be assigned to the two boards")
    beijing = timezone(timedelta(hours=8))
    return {
        "version": 1, "asOf": datetime.fromisoformat(review["utc"]).astimezone(beijing).date().isoformat(),
        "core": {
            "version": release["version"], "grade": release["grade"],
            "anchorsMatched": matched, "anchorsTotal": len(anchors["comparisons"]),
            "historyWithinTolerance": history["within_0_01"], "historyTotal": history["count"],
            "tolerance": 0.01, "maxDelta": history["max_absolute_delta"],
            "gatesMatched": gate_matches, "gatesTotal": len(gates),
            "ods": release["ods_version"],
        },
        "coverage": {
            "officialBeds": all_beds["official"], "externalBeds": all_beds["wild"], "testBeds": all_beds["test"],
            "worksetsCovered": coverage["covered_worksets"], "worksetsExpected": coverage["expected_worksets"],
            "referenceControls": coverage["reference_controls_equal_50"], "referenceScore": 50,
            "dryrunsPassed": review["passed_dryruns"], "dryrunsExpected": review["expected_dryruns"],
        },
        "boards": boards,
        "metricGroups": [{"title": title, "metrics": metrics, "weight": 25} for title, metrics in METRIC_GROUPS],
        "sources": sources,
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--project", type=Path, required=True, help="Local Virtual Embryo project root")
    parser.add_argument("--check", action="store_true", help="Verify the asset without writing it")
    args = parser.parse_args()
    data = build(args.project)
    payload = ("window.VEMT2ScorerData=" + json.dumps(data, ensure_ascii=False, indent=2, allow_nan=False) + ";\n")
    if args.check:
        if not ASSET.exists() or ASSET.read_text(encoding="utf-8") != payload:
            parser.exit(1, f"{ASSET.name} does not match the verified T2 snapshot\n")
    else:
        ASSET.write_text(payload, encoding="utf-8", newline="\n")
    print(f"{ASSET.name}: verified T2 snapshot for {data['asOf']}")


if __name__ == "__main__":
    main()
