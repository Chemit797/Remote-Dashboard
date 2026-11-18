"""Build metadata-only registry from frozen inventories; never opens expression matrices."""
from __future__ import annotations

import collections
import csv
import hashlib
import json
import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent / "src"))
from dataset_names import label as dataset_label, text as named_text
PROJECT = HERE.parents[2]
REMOTE_ROOT = "/home/biocosmosx/work/virtualembryo_cym"
EXTERNAL_ROOT = REMOTE_ROOT + "/Virtual_Embryo_External_Data"
TASKS = {
    "T1": "T1 心脏表达随时间变化",
    "T2A": "T2 全胚胎插值",
    "T2B": "T2 心脏插值",
    "T2C": "T2 心脏外推",
    "T3": "T3 扰动",
}


def read_jsonl(path):
    return [json.loads(line) for line in path.read_text(encoding="utf-8-sig").splitlines() if line.strip()]


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def write_json(name, data):
    (HERE / name).write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def esc(s):
    return str(s).replace("|", "／").replace("\n", " ")


def metadata_resolution():
    labels = list(csv.DictReader((HERE / "GSE169210_metacell_labels.csv").open(encoding="utf-8-sig")))
    dictionary = {r["mc"]: r["annotation"] for r in labels}
    morph = list(csv.DictReader((HERE / "single_embryo_morphology_size_information.txt").open(encoding="utf-8"), delimiter="\t"))
    mid = {r["embryo"] for r in morph}
    cohorts = []
    for r in read_jsonl(HERE / "cache_source_verification.jsonl"):
        if "metacell_metadata" not in r:
            continue
        mc = r["metacell_counts"]
        embryos = set(r["embryo_counts"])
        cohorts.append({
            "path": r["metacell_metadata"], "metadata_sha256": r["sha256"],
            "rows": r["n_rows"], "metacell_na_rows": mc.get("NA", 0),
            "metacell_labeled_rows": sum(v for k, v in mc.items() if k != "NA"),
            "unmapped": {k: v for k, v in mc.items() if k != "NA" and k not in dictionary},
            "embryo_field_unique_values_including_empty": len(embryos),
            "embryos_with_morphology": len(embryos & mid),
            "embryo_values_without_morphology": sorted(embryos - mid),
        })
    out = {
        "dictionary_metacells": len(dictionary), "dictionary_labels": len(set(dictionary.values())),
        "dictionary_key": "mc (not the R row index)",
        "dictionary_source": "https://embflow.s3.eu-west-1.amazonaws.com/data_embflow.tar.gz :: data/fig_s3/mc_cluster_order.txt",
        "author_repository_tree": "9f0c2a704d586bad09a6022b363fc02ba61f4f9f",
        "morphology_rows": len(morph), "metadata_rows_total": sum(c["rows"] for c in cohorts),
        "metadata_metacell_na_rows": sum(c["metacell_na_rows"] for c in cohorts),
        "metadata_labeled_rows": sum(c["metacell_labeled_rows"] for c in cohorts),
        "cohorts": cohorts,
        "stage_resolution": "No literal per-embryo collection E-day was found. Et is model-derived; morphology labels are separate. Do not use Et as observed embryonic day or as an unverified competition-window selector.",
        "metadata_rows_are_not_qc_cell_count": True,
        "metadata_expression_values_read": False,
    }
    assert len(dictionary) == 461 and len(set(dictionary.values())) == 29
    assert all(not c["unmapped"] for c in cohorts)
    assert out["metadata_rows_total"] == out["metadata_labeled_rows"] + out["metadata_metacell_na_rows"]
    write_json("GSE169210_METADATA_RESOLUTION.json", out)
    return out


def main():
    rows = read_jsonl(HERE / "canonical_metadata_snapshot.jsonl")
    receipt, rows = rows[0], rows[1:]
    assessments = {r["id"]: r for r in json.loads((HERE / "registry_assessments.json").read_text(encoding="utf-8"))}
    overview = (PROJECT / "notes/Virtual_Embryo/MASTER_DATASETS_REAUDITED.md").read_text(encoding="utf-8")
    first, second = overview.split("## 第一层：", 1)[1].split("## 第二层：", 1)
    second = second.split("## 明确未完成项", 1)[0]
    tables = []
    for text in (first, second):
        table = {}
        for line in text.splitlines():
            if re.match(r"\| VED-\d{3} \|", line):
                columns = [s.strip() for s in line.strip().strip("|").split("|")]
                table[columns[0]] = columns
        tables.append(table)
    assert len(rows) == len(assessments) == len(tables[0]) == len(tables[1]) == 43
    extra = {}
    for r in read_jsonl(HERE / "selected_cache_details.jsonl"):
        if "extra_inventory" in r:
            ved = re.search(r"VED-\d{3}", r["extra_inventory"])[0]
            extra[ved] = [dict(path=REMOTE_ROOT + "/" + f["path"], recorded_path=f["path"],
                                role="supplemental raw-file stat; not asserted expression matrix", exists_now=True,
                                bytes_now=f["bytes"], sha256_previous_audit=None, archive_member=None) for f in r["files"]]
    result = []
    for r in rows:
        m = r["master"]
        ved = m["VED_ID"]
        a = assessments[ved]
        core, detail = tables[0][ved], tables[1][ved]
        rels = [x for x in receipt["relations"] if x["VED_ID"] == ved]
        files = r["files"] or extra.get(ved, [])
        facts = r["audit"].get("actual_file_facts", {})
        compact_facts = {k: v for k, v in facts.items() if k in {
            "file_count", "readable_file_count", "matrix_file_count", "matrix_shape", "unit_count",
            "unit_count_basis", "gene_count", "gene_count_basis", "spatial_file_fact", "sample_count_from_soft"
        }}
        accession = m["public_id"]
        corrections = []
        if ved == "VED-020":
            corrections.append({"field": "public_id/BioProject", "old": accession,
                                "new": "GSE278603; PRJNA1168072",
                                "evidence": "../../early_embryo_prior_audit/provenance/sources.json; GSE278603 GEO source metadata",
                                "reason": "PRJNA810020 belongs to GSE197353; old source overview retained unchanged."})
            accession = "GSE278603; PRJNA1168072"
        task_codes = list(dict.fromkeys([x["task"] for x in rels] + a["extra_tasks"]))
        unit = m["granularity"]
        available = "metadata_only" if m["audit_status"] == "METADATA_AUDITED" else "local_data_with_recorded_audit"
        record = {
            "ved_id": ved, "public_id": accession, "public_id_in_previous_inventory": m["public_id"],
            "name": m["canonical_name"], "name_zh": core[2], "source_family_id_previous_inventory": m["family_id"],
            "accession_urls": ["https://www.ncbi.nlm.nih.gov/geo/query/acc.cgi?acc=" + g for g in re.findall(r"GSE\d+", accession)],
            "canonical_directory": EXTERNAL_ROOT + "/" + m["canonical_directory"],
            "canonical_exists_current_check": r["canonical_exists_now"],
            "historical_task_relations": rels, "historical_tasks": [x["task"] for x in rels],
            "current_research_tasks": task_codes, "current_research_task_names": [TASKS[t] for t in task_codes],
            "added_task_reason": "E9.5 heart expression can also inform T2 heart expression comparison; this adds a research relationship, not a duplicate data source." if a["extra_tasks"] else None,
            "species": m["species"], "strain_recorded": m["strain"],
            "stage_original": m["stages"], "stage_readable": core[6],
            "tissue_original": m["tissue_detailed"], "tissue_readable": core[4] + "；" + core[5],
            "sampling_original": m["sampling_scope"], "observation_unit": unit,
            "spatial_representation": m["spatial_dimensionality"],
            "genotype_recorded": m["genotype_file_audit"], "perturbation_gene": m["perturbation_gene"],
            "perturbation_type": m["perturbation_type"], "cre_driver": m["Cre_driver"],
            "sample_semantics": a["sample_meaning"], "sample_inventory_rows": r["sample_inventory_n"],
            "sample_inventory_sha256_current_check": r["sample_inventory_sha256"],
            "sample_summary": r["sample_summary"], "sample_examples": r["sample_examples"],
            "historical_audit_status": m["audit_status"], "historical_matrix_facts": compact_facts,
            "historical_matrix_size_readable": detail[1], "historical_panel_summary_not_current_contract": detail[2],
            "current_file_presence": files,
            "file_presence_count_is_not_matrix_or_sample_count": True,
            "source_hashes_recomputed_this_round": False,
            "availability": available, "research_priority": a["priority"],
            "proposed_numeric_scope": a["usable_scope"], "possible_prior_checks": a["can_check"],
            "comparison_limits_and_exclusions": a["limitations"],
            "previous_limitations": detail[6], "previous_eligibility_not_reused_as_current_permission": m["competition_use_status"],
            "current_rules_source": "official_rules_receipt.json", "corrections": corrections,
            "evidence": {"metadata_and_current_stat": "canonical_metadata_snapshot.jsonl", "record_key": ved,
                         "historical_readable_summary": "../../../notes/Virtual_Embryo/MASTER_DATASETS_REAUDITED.md",
                         "supplemental_file_stat": "selected_cache_details.jsonl" if ved in extra else None,
                         "evidence_strength": "原文；本轮只读元数据与文件存在/大小。表达矩阵结构、历史数量和面板交集沿用标明来源的已有审计，未在此重算。"},
        }
        if ved == "VED-001":
            record["accession_urls"] = ["https://www.ebi.ac.uk/biostudies/arrayexpress/studies/E-MTAB-6967"]
        result.append(record)
    out = {
        "schema_version": "vem.external_registry.v2.1", "registry_date_utc": "2026-11-16",
        "metadata_snapshot_at_utc": receipt["at_utc"], "external_root": EXTERNAL_ROOT,
        "dataset_count": len(result), "historical_task_relation_count": len(receipt["relations"]),
        "task_code_definitions": TASKS,
        "historical_task_relation_counts": dict(collections.Counter(r["task"] for r in receipt["relations"])),
        "reading_scope": "Metadata, audit records, source code text, public rule text and file stat only. No expression matrix values read by this registry workflow.",
        "inclusion_policy": "Keep all 43 canonical identities, including protected stages, missing local data and non-RNA resources. A current candidate is not an executed analysis or a declaration of unconditional eligibility.",
        "input_hashes": {name: sha(HERE / name) for name in ["canonical_metadata_snapshot.jsonl", "registry_assessments.json", "selected_cache_details.jsonl", "official_rules_receipt.json"]},
        "master_table_sha256_at_snapshot": receipt["master_sha256"], "relations_sha256_at_snapshot": receipt["relations_sha256"],
        "datasets": result,
    }
    write_json("dataset_registry.json", out)
    flat = []
    for d in result:
        flat.append({k: "; ".join(d[k]) if isinstance(d[k], list) else d[k] for k in [
            "ved_id", "public_id", "name_zh", "historical_tasks", "current_research_tasks", "canonical_directory",
            "species", "stage_readable", "tissue_readable", "observation_unit", "sample_semantics", "genotype_recorded",
            "cre_driver", "historical_audit_status", "research_priority", "proposed_numeric_scope", "possible_prior_checks",
            "comparison_limits_and_exclusions", "historical_matrix_size_readable"]})
    with (HERE / "dataset_registry.csv").open("w", encoding="utf-8-sig", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=list(flat[0]))
        writer.writeheader()
        writer.writerows(flat)
    mm = metadata_resolution()
    cache_reports = [r for r in read_jsonl(HERE.parent / "evidence/staged_metadata.jsonl") if "data" in r]
    source_match = []
    for r in cache_reports:
        report = r["data"]
        expected = {"VED-002": report["source_sha256"]} if "source_sha256" in report else {"VED-012/CD1": report["source_files"]["CD1"]}
        for key, h in expected.items():
            ved = key.split("/")[0]
            d = next(x for x in result if x["ved_id"] == ved)
            matches = [x for x in d["current_file_presence"] if x.get("sha256_previous_audit") == h]
            source_match.append({"dataset": key, "canonical_report": r["file"], "source_sha256_recorded": h,
                                 "matching_historical_audit_files": [x["path"] for x in matches],
                                 "recorded_hash_match": len(matches) == 1, "large_source_rehashed_this_round": False})
    write_json("cache_source_hash_crosscheck.json", source_match)
    assert all(x["recorded_hash_match"] for x in source_match)
    stats = {
        "unique_ved": len({r["ved_id"] for r in result}),
        "historical_task_relations": sum(len(r["historical_task_relations"]) for r in result),
        "all_canonical_directories_exist": all(r["canonical_exists_current_check"] for r in result),
        "recorded_file_stat_entries": sum(len(r["current_file_presence"]) for r in result),
        "missing_recorded_file_paths": [f["path"] for r in result for f in r["current_file_presence"] if not f["exists_now"]],
        "historical_status_counts": dict(collections.Counter(d["historical_audit_status"] for d in result)),
        "matrix_only_metadata_records": [d["ved_id"] for d in result if d["availability"] == "metadata_only"],
        "all_records_have_sampling_and_exclusion_reasons": all(d["sample_semantics"] and d["comparison_limits_and_exclusions"] for d in result),
        "GSE169210_all_nonmissing_metacells_mapped": all(not c["unmapped"] for c in mm["cohorts"]),
        "cache_source_hash_records_agree": all(x["recorded_hash_match"] for x in source_match),
        "expression_values_read": False,
    }
    assert stats["unique_ved"] == 43 and stats["historical_task_relations"] == 71
    assert stats["all_canonical_directories_exist"] and not stats["missing_recorded_file_paths"]
    write_json("registry_validation.json", stats)
    report = [
        "# 外部数据分别能用于哪些任务\n",
        "本登记以 2026-11-16 UTC 读取的 5090 目录和元数据为准。共 **43 个唯一 VED 数据来源、71 条已有任务关系**；同一个来源出现在多个任务里，只计一次。数据根目录仍为 `" + EXTERNAL_ROOT + "`。\n",
        "**早期全胚胎先从 E-MTAB-6967 的允许阶段和 GSE278603 的 E8.0 看起；心脏先看 GSE228590 的允许阶段、GSE193346 CD1 E9.5、GSE176306 的允许早期谱系，以及 MOSTA E9.5。** 它们测量的对象不同：全胚细胞、细胞核、谱系富集细胞、空间重建对象和心区不能混成同一个细胞比例分母。\n",
        "- 37 个来源已有文件级审计，5 个只有元数据，1 个只有部分样本仍需从原始测序重建。这里复核了目录与记录文件的存在、大小及元数据，没有重新读取 43 份来源的表达矩阵。\n",
        "- 找到了 GSE169210 的作者细胞类型字典：461 个 metacell 对应 29 类；本地有标签的 33,700 行全部能对应。10,844 行缺标签仍保留未知。真实采集 E 日龄仍未解决。\n",
        "- 找到了 GSE176306 与 GSE193346 已提取的原始计数 CSC 缓存，可按列指针只读允许阶段，不必重新打开整份跨阶段 RData/RDS。\n",
        "- T3 的 Gata4/Ctnnb1 同基因或近似条件、保护阶段、缺本地矩阵的来源都保留在总表，并逐项说明为什么本轮不做数值核对。\n",
        "- 旧目录中的 task 标签是已有任务入口，不是无条件可用许可；本轮新增 GSE193346 对 T2 心脏表达比较的研究关联，没有新增数据副本。\n",
        "## 信息列表\n",
        "### 当前规则与比较边界\n",
        "[官网规则](https://virtualembryo.ai/challenge/rules)已在 2026-11-16 06:04:46 UTC 取回，原文及 SHA 保存在 [规则收据](official_rules_receipt.json)。以下是本轮采用的计算边界，不是主办方对每个数据集作出的个别裁定。\n",
        "| 任务 | 外部数值输入排除范围 | 边界怎样处理 |\n|---|---|---|",
        "| T1 / 心脏外推 | 9.5 < E ≤ 13.5 | E9.5 允许；E13.5 排除；E13.5 以后可另列阶段 |",
        "| T2 心脏插值 | 8.25 < E < 8.75 | E8.25、E8.75 允许；跨保护区间的分期不能按一个端点放行 |",
        "| T2 胚胎插值 | 7.25 < E < 8.0 | E7.25、E8.0 允许 |",
        "| T3 | held-out KO、相近阶段同基因其他等位或 phenocopy 条件 | 不因换 Cre、取材或 accession 自动豁免；有疑义的本轮只登记 |\n",
        "官方已 opt-in 的 validation 例外不扩展至外部数据。模型 Et、体节数、形态期都不能仅改标签来绕过阶段限制。跨来源差异先称来源差异；没有交叉实验设计时不能分离技术批次与取材、品系、平台的贡献。\n",
        "### 按任务找到现有入口\n",
        "| 任务 | 原有关系数 | 本轮优先对象 | 主要不能混用的条件 |\n|---|---:|---|---|",
        "| T1 | 19 | GSE228590 允许阶段、GSE193346 CD1 E9.5；早期谱系 GSE176306 | 核与细胞、富集与随机心脏、单个体与混样 |",
        "| T2 全胚胎（T2A） | 7 | E-MTAB-6967 允许阶段、GSE278603 E8.0 | 全胚与心脏新月 ROI、细胞与重建对象 |",
        "| T2 心脏插值（T2B） | 11 | GSE176306 E8.25、GSE126128 WT E8.25/E9.25 的发布尺度 | E8.5 外部禁入；谱系富集不可当全心脏组成 |",
        "| T2 心脏外推（T2C） | 18 | MOSTA E9.5、GSE228590 E9.5；新增 GSE193346 E9.5 研究关联 | 心区与细胞类型不同；E10.5–E13.5 外部禁入 |",
        "| T3 | 16 | 先登记 driver、等位、组织和阶段；本轮同基因近似条件不取数值 | 不把 GOF、LOF、通路邻近或不同取材当同一扰动 |\n",
        "### 43 个唯一来源逐项安排\n",
        "下表是数据选择与缺口登记，不是已完成表达检验。完整原标签、样本字段、文件绝对路径、历史哈希和每条任务关系在 [JSON](dataset_registry.json)；[CSV](dataset_registry.csv)供筛选。表内规模和旧面板重合来自已有审计，未冒充本轮复算。\n",
        "| VED / 来源 | 已有任务入口 | 本轮可检查的内容和阶段 | 限制及不做的部分 |\n|---|---|---|---|",
    ]
    for d in result:
        report.append("| " + " | ".join(esc(x) for x in [d["ved_id"] + " / " + d["public_id"], ", ".join(d["historical_tasks"]),
                       d["research_priority"] + "。" + d["proposed_numeric_scope"] + "。" + d["possible_prior_checks"], d["comparison_limits_and_exclusions"]]) + " |")
    report += [
        "\n### 两个原始计数缓存如何接续\n",
        "| 来源 | 5090 执行根下的缓存 | 已核实的语义 | 本轮取值范围 |\n|---|---|---|---|",
        "| GSE176306 | `experiments/T1-v1-20261008/cache/staging/VED-002/` | `pbmc.combined@raw.data`；基因×细胞；x=float64，i/p=int32；作者保留名单来自 `pbmc@data` 列名 | `postqc_cells_pbmc_data.txt` 与原列交集后 E720=785、E825=4,611；E720 对应 GEO E7.25 |",
        "| GSE193346 CD1 | `experiments/T1-v1-20261008/cache/staging/VED-012/CD1/` | `RNA@counts`；基因×细胞；x=float64，i/p=int32；作者 QC 后对象 | 按 metadata.stage=E9.5 选 887 列；保留原 cell_type_broad/spec、样本与心腔 |\n",
        "只读取选定列的 p 指针区间。旧 Python reader 会先把整个跨阶段数组载入内存，不直接复跑。源 RData/RDS 的历史 SHA 与 canonical report 一致，见 [哈希记录交叉核对](cache_source_hash_crosscheck.json)；本轮未重新散列大源文件。导出器正文、当前脚本 SHA、QC 名单哈希及顺序检查在 [缓存出处核实](cache_source_verification.jsonl)。GEO 明文 E7.25 证据在 [GSE176306 分期](GSE176306_geo_stage.json)。\n",
        "### GSE169210 解决了什么，还缺什么\n",
        "已从作者 `data_embflow.tar.gz` 取出 [原始 metacell 表](mc_cluster_order.txt)（包内路径 data/fig_s3/mc_cluster_order.txt），导出 [metacell 字典](GSE169210_metacell_labels.csv)。原表的 `mc` 列才是 metacell ID，R 行号不是 ID。共 461 个 ID、29 个标签；两份 WT metadata 共 44,544 行，其中 33,700 行有 ID 且全部对应，10,844 行为 NA。这里的行数不是宣布这些都是作者 QC 后细胞。\n",
        "作者形态表含 153 个 embryo ID，与本地 BL6 的 111 个、ICR 的 42 个对应，字段有 PrS/ES、ES、MS、LS 等形态期。Et 为模型时间；真实采集 E 日龄仍未找到。因此暂不做与官方 E 日龄的主定量配对，也不据 Et 单独判定允许窗口。详情见 [元数据对应结果](GSE169210_METADATA_RESOLUTION.json)；作者支持文件和哈希在 [选定文件清单](embflow_metadata_selected.json)。没有下载约 4.9 GB 的完整模型数据库，也没有运行作者代码。\n",
        "## 分工与接续\n",
        "本登记已完成选择依据与输入定位；正式分析沿当前任务继续，不需再询问例行偏好。心房/心室/心内膜与早期粗类群的原标签和定义依据单列于 [细胞标签对应](02_细胞标签对应依据.md)，其中名称对应与未核实边界逐项注明。\n",
        "| 工作 | 执行者 | 输入 | 应交结果 |\n|---|---|---|---|",
        "| 逐条先验在外部数据的核对 | 当前主分析 | 本登记的允许阶段、样本与原标签；冻结先验 | 每条知识第二个外部结果，或具体不可检验原因 |",
        "| 同任务官方/外部差异 | 当前主分析 | 先锁定阶段、取材、单位、基因集合；不直接合并矩阵 | 原尺度、共同表示、类型特异性、留组回归与打乱对照 |",
        "| 元数据字典与证据保持一致 | 本登记脚本 | `build_registry.py` 与冻结快照 | 43 来源、71 历史关系、选择原因、哈希与来源证据 |\n",
        "## 交接与未解决问题\n",
        "1. GSE169210 的 metacell→类型缺口已解决；采集 E 日龄未解决。用形态期时必须注明分期体系。\n",
        "2. GSE176306 有原始 counts 和作者 QC 名单，但细胞类型注释和逐细胞 GSM 对应缺失；允许做谱系总体表达，不能用表达反推标签后声称独立验证。\n",
        "3. GSE193346 的 MULTI-seq/心腔标识不能确认独立胚胎；不报告跨胚胎显著性。\n",
        "4. GSE228590 的 `stage` 区间与 `geo_day` 字段须并列；GSE278603/MOSTA 的重建单位不升级为单细胞。\n",
        "5. 五个只有元数据的 VED-022/026/027/028/041 无本地表达矩阵；GSE230531 是局部矩阵缺口，不是整项没有数据。\n",
        "6. 本工作没有重新运行历史表达计算、重建 SRA、训练或生成预测，没有修改源数据。官方/外部一致性与回归误差由正式分析的机器结果给出，本登记不预判。\n",
        "| 证据文件 | 内容 |\n|---|---|",
        "| [canonical_metadata_snapshot.jsonl](canonical_metadata_snapshot.jsonl) | 43 个来源、71 关系、历史审计、当前文件存在/大小；逐样本清单 SHA |",
        "| [dataset_registry.json](dataset_registry.json) / [dataset_registry.csv](dataset_registry.csv) | 唯一来源、原始条件、逐项可用范围与限制 |",
        "| [registry_validation.json](registry_validation.json) | 去重计数、关系数、存在性、未知字段与哈希记录核对 |",
        "| [selected_cache_details.jsonl](selected_cache_details.jsonl) | 已提取缓存与 VED-029/036 补充文件目录 |",
        "| [official_rules_receipt.json](official_rules_receipt.json) | 官网规则第 10 节原文、取回时间、HTTP 状态和哈希 |",
        "| [build_registry.py](build_registry.py) | 从已冻结元数据生成登记、对应统计和报告；不读表达值 |\n",
        "勘误：旧 VED-020 的 PRJNA810020 更正为 PRJNA1168072；旧原文保留，纠正在 registry.corrections 中单列。旧文件级 AUDITED 状态只表示其当时文件核查通过，不等于本轮全部条件可比。\n",
    ]
    report_text = "\n".join(report) + "\n"
    report_text = re.sub(r"^\| (VED-\d{3}) / [^|]+ \|", lambda m: "| " + dataset_label(m[1]) + " |", report_text, flags=re.M)
    report_text = named_text(report_text)
    first_line = report_text.index("\n")
    report_text = report_text[:first_line] + "\n\n名称按[外部数据统一对照表](../../../docs/EXTERNAL_DATASET_NAMES.md)显示；数据身份、阶段和核对结论不变。" + report_text[first_line:]
    (HERE / "01_外部数据任务对应.md").write_text(report_text, encoding="utf-8")
    print(json.dumps(stats, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
