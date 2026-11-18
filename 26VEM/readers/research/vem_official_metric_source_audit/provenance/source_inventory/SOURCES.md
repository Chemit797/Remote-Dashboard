# T1、T2 全胚胎外部来源登记

2026-11-16，Asia/Shanghai。本表检查元数据、文件结构、来源说明和缓存；没有读取表达矩阵数值、没有评分。

本轮登记 22 个历史相关来源，另补 1 个库外已下载来源。条件允许、条件不同和暂时无法计算分别记录，不把缺口填成零分。

| 来源 | 当前状态 | 本轮用途与限制 |
|---|---|---|
| VED-001 · Pijuan-Sala 早期全胚胎图谱 | ready | T1 可直接用 E8.5 全转录组缓存；T2 全胚胎用已排除保护期的 613 基因缓存，覆盖实际面板交集。 |
| VED-002 · Mesp1 早期心脏谱系图谱 | conditional | Mesp1 谱系富集，E7.25/E8.25 可用于来源差异诊断；没有细胞类型注释，不能解释为全胚组成。 |
| VED-003 · TOME E9.5–E13.5 全胚胎图谱 | ready_shared_source | 可用 E9.5 缓存；其表达来自 VED-008 · MOCA 全胚胎器官发生图谱，QC 和标签来自 VED-003 · TOME E9.5–E13.5 全胚胎图谱，只计算一个来源家族。 |
| VED-004 · TOME E8.5 全胚胎图谱 | ready | E8.5 原始计数、作者细胞标签和 QC 已整理；12 个 RT_group 的独立胚胎含义未另外核实。 |
| VED-005 · Mittnenzweig 胚胎发育图谱 | stage_unresolved | 只有模型推断发育时间 Et，没有可据以划分允许时间窗口的实测日龄，不进行阶段配对评分。 |
| VED-006 · de Soysa 早期心脏图谱 | conditional | WT E8.25/E9.25 可作相邻阶段表达参照；是发布 logCP10k 而非原始计数，无作者细胞类型。 |
| VED-007 · Qiu 产前细胞核图谱 | ready_subset | 已有合法 E8.75/E9/E9.25/E9.5 心肌和心内膜细胞核缓存；属于全胚图谱中的选择类群，不能代表全胚组成。 |
| VED-008 · MOCA 全胚胎器官发生图谱 | shared_source_no_duplicate | E9.5 原始计数已用于 VED-003 · TOME E9.5–E13.5 全胚胎图谱 的重注释缓存；与该来源共享细胞，不能作为第二个独立重复。 |
| VED-009 · MOSTA 心脏空间图谱 | conditional_scope_unit | E9.5 是心脏空间单元，不是已核实的解离单细胞；可做来源表达诊断，不能和全胚组成直接比较。 |
| VED-010 · 胚胎与心脏单细胞图谱 | conditional_local_QC | E8.5 只有一份可用缓存（3,413 个本地 knee 方法保留条形码）；另一份原始 gzip 截断，且缺作者类型/QC。只能作为明确标注的敏感性分析。 |
| VED-011 · 胚胎全心脏单细胞图谱 | no_near_eligible_stage | E12.5/E13.5 位于 T1 保护期；合法 E14.5/E15.5 心脏样本距本次官方 E8.5–E10.5 太远，不当作条件相近来源。 |
| VED-012 · Feng 分心腔单细胞图谱 | ready_subset | CD1 E9.5 887 细胞可用，作者 QC 与标签齐全；是分心腔样本，MULTI-seq 标签不代表独立胚胎。 |
| VED-013 · Prmt1 缺失心脏单细胞数据 | protected_only | 只有 E12.5，处于 T1 保护期；不读取表达数值。 |
| VED-014 · Pitx2 缺失心脏单细胞数据 | protected_only | 只有 E10.5/E13.5，处于 T1 保护期；不读取表达数值。 |
| VED-015 · BubR1 缺失心脏单细胞数据 | protected_only | 只有 E10.5，处于 T1 保护期；不读取表达数值。 |
| VED-016 · 心脏流出道单细胞数据 | protected_only | 只有 E10.5 流出道样本，处于 T1 保护期；不读取表达数值。 |
| VED-017 · Wt1 心外膜谱系单细胞数据 | no_near_eligible_stage | 合法 E14.5/E16.5 是 Wt1 富集谱系，距本次官方阶段较远；E12.5 处于 T1 保护期。 |
| VED-018 · Cdh5-CreER Gata4 缺失心室数据 | protected_only | 只有 E12.5，且为 Gata4 扰动相关；不作为 T1 WT 条件相近输入。 |
| VED-019 · Osr1 阳性第二心场单细胞数据 | conditional_partial_axis | E9.5 533 个 Osr1+ 第二心场细胞；发布为整数风格但不独立证明原始 UMI，基因轴是筛选后子集。 |
| VED-020 · Stereo-seq 胚胎三维重建图谱 | ready_spatial_units_unresolved | E8.0 两重复可用；obs x/y/z 是重建坐标，未找到其存储单位声明。可比较形状和表达，物理生长尺度结论需保留缺口。 |
| VED-021 · sc3D 胚胎切片空间图谱 | adapter_needed_2d_beads | 17 个 E8.5、6 个 E9.5 切片的表达矩阵可读；只有二维珠坐标，不支持完整三维官方空间评价。需要按切片保留观测单位。 |
| VED-022 · 全胚胎数字重建论文资料 | metadata_only | 没有本地表达矩阵或可用坐标，仅论文和元数据。 |
| OMIX014646 · mdCLA 全胚胎单细胞图谱 | ready_additional_source | 库外已下载的 E8.5/E9.5 全胚胎文件可用；此前仅分析过选择子集，本次可直接读取完整合法阶段。 |

## 可立即复用的矩阵

大矩阵保留在 5090。完整字段和精确路径见 `sources.json` 的 `read_adapters`。所有 canonical 缓存都是 `X.npz`、`cells.parquet`、`genes.parquet` 和 `report.json` 四件套；表达是 cells×genes，类型和阶段字段不可从文件名猜。

| 来源 | 表示及规模 | 关键字段 |
|---|---|---|
| VED-001 · Pijuan-Sala 早期全胚胎图谱 | `experiments/vem_prior_knowledge_v2_20261116/run01/cache/EMTAB6967`；[83370, 613] | stage、label、sample、info.json.genes |
| VED-001 · Pijuan-Sala 早期全胚胎图谱 | `experiments/T1-v1-20261008/cache/canonical/VED-001/raw_counts`；[108857, 29452] | age_value、source_celltype、sample_id、genes.symbol |
| VED-002 · Mesp1 早期心脏谱系图谱 | `experiments/T1-v1-20261008/cache/canonical/VED-002/raw_counts`；[9072, 27998] | age_value、source_celltype、sample_id、genes.symbol |
| VED-003 · TOME E9.5–E13.5 全胚胎图谱 | `experiments/T1-v1-20261008/cache/canonical/VED-003/e95_moca_matrix_tome_qc`；[110229, 26183] | age_value、source_celltype、sample_id、genes.symbol |
| VED-004 · TOME E8.5 全胚胎图谱 | `experiments/T1-v1-20261008/cache/canonical/VED-004/raw_counts`；[154313, 49585] | age_value、source_celltype、sample_id、genes.symbol |
| VED-005 · Mittnenzweig 胚胎发育图谱 | `experiments/T1-v1-20261008/cache/canonical/VED-005/wt_plates`；[44543, 27400] | age_value、source_celltype、sample_id、genes.symbol |
| VED-006 · de Soysa 早期心脏图谱 | `experiments/T1-v1-20261008/cache/canonical/VED-006/wt_alltimepoints`；[36753, 23476] | age_value、source_celltype、sample_id、genes.symbol |
| VED-007 · Qiu 产前细胞核图谱 | `experiments/vem_prior_knowledge_v2_20261116/run01/cache/QIU228590`；[14265, 45451] | stage、label、sample、info.json.genes |
| VED-008 · MOCA 全胚胎器官发生图谱 | `experiments/T1-v1-20261008/cache/canonical/VED-003/e95_moca_matrix_tome_qc`；[110229, 26183] | age_value、source_celltype、sample_id、genes.symbol |
| VED-009 · MOSTA 心脏空间图谱 | `experiments/vem_prior_knowledge_v2_20261116/run01/cache/MOSTA_E9.5`；[19780, 12581] | stage、label、sample、info.json.genes |
| VED-010 · 胚胎与心脏单细胞图谱 | `experiments/T1-v1-20261008/cache/canonical/VED-010/called_cells`；[17885, 27998] | age_value、source_celltype、sample_id、genes.symbol |
| VED-011 · 胚胎全心脏单细胞图谱 | `experiments/T1-v1-20261008/cache/canonical/VED-011/filtered_e14_e15`；[9027, 27999] | age_value、source_celltype、sample_id、genes.symbol |
| VED-012 · Feng 分心腔单细胞图谱 | `experiments/vem_prior_knowledge_v2_20261116/run01/cache/FENG193346_CD1`；[887, 30976] | stage、label、sample、info.json.genes |
| VED-019 · Osr1 阳性第二心场单细胞数据 | `experiments/T1-v1-20261008/cache/canonical/VED-019/e95_tsv`；[533, 17492] | age_value、source_celltype、sample_id、genes.symbol |
| VED-020 · Stereo-seq 胚胎三维重建图谱 | `experiments/vem_prior_knowledge_v2_20261116/run01/cache/STEREO_E8_rep1`；[11048, 16636] | stage、label、sample、info.json.genes |
| VED-020 · Stereo-seq 胚胎三维重建图谱 | `experiments/vem_prior_knowledge_v2_20261116/run01/cache/STEREO_E8_rep2`；[27266, 19046] | stage、label、sample、info.json.genes |
| OMIX014646 · mdCLA 全胚胎单细胞图谱 | `experiments/T1-push70-20261022/expansion_163/source_raw/OMIX014646-36.5.h5ad`；[60819, 55450] | time、level3_celltypes、unique_library、var/index |
| OMIX014646 · mdCLA 全胚胎单细胞图谱 | `experiments/T1-push70-20261022/expansion_163/source_raw/OMIX014646-38.5.h5ad`；[36238, 55450] | time、level3_celltypes、unique_library、var/index |

## 已查清的来源关系

VED-003 · TOME E9.5–E13.5 全胚胎图谱 的当前 E9.5 缓存，表达实际来自 VED-008 · MOCA 全胚胎器官发生图谱。已有去重文件登记两者共享 2,058,538 个 cell IDs，E9.5 共享 152,112 个；这里只读取了该审计文件，未重算全库。应保留双来源说明，只计算一个数据家族，不能把两份成绩当成两次独立验证。

VED-004 · TOME E8.5 全胚胎图谱 的缓存有 154,313 个细胞核、49,585 个基因。12 个 RT_group 是来源分组，独立胚胎数尚未另外核实。

VED-001 · Pijuan-Sala 早期全胚胎图谱 的 T1 全转录组缓存含 108,857 个作者 QC 保留观测，其中 E8.5 为 16,909 个。它同时含 T2 禁用阶段，T2 应继续使用已经按允许阶段提取的 83,370×613 缓存或按行选择原始文件。

## 空间字段与限制

VED-020 · Stereo-seq 胚胎三维重建图谱 的 E8.0 两个文件都在 obs 提供 x/y/z；obsm/X_spatial 只有两列。GEO 说明连续冠状切片厚度为 10 µm，但 H5AD 和取到的说明没有明确三列坐标的单位。单位未知时不能把三维尺度误差解释成真实胚胎尺寸误差。

VED-021 · sc3D 胚胎切片空间图谱 有 23 个切片矩阵（17 个 E8.5、6 个 E9.5），共 504,061,696 bytes 压缩表达文件。GEO 明确它们是 gene×bead 的计数表，坐标表行与表达列对应；只有 x/y，没有可直接使用的三维配准。各切片保持独立记录，不能把切片编号当成胚胎编号。

## 证据与接续

- `remote_inspection.json`：实读缓存 report/parquet 元数据，以及 E8.0 空间 H5AD schema。
- `spatial_inspection.json`：原始 GEO SOFT、逐切片样本登记、坐标字段属性、已有来源去重证据。
- `mdcla_inspection_v2.json`：完整阶段 H5AD schema、作者标签和双细胞字段；不含表达数组。
- `sources.json`：全部 23 条机器可读记录，明确不可用原因、适配路径、层和字段。

后续执行者：主分析程序根据这些字段先固定比较阶段、观测单位和基因交集，读取数值后检查真实计数语义，并输出官方算法下的本地诊断。该子任务没有运行长作业、训练、生成预测或提交。
