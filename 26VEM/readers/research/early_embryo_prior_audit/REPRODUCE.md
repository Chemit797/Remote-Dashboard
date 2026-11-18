# 复现与文件说明

运行日期2026-11-16。主计算位于5090，根目录`/home/biocosmosx/work/virtualembryo_cym/experiments/early_embryo_prior_audit_20261116/run02`。输入原位保留，实际路径、文件大小、SHA256及角色见[输入清单](results/input_manifest.json)；软件版本见[runtime](results/runtime.json)。本地导出与图形使用Python，主矩阵计算没有迁到本地。

## 从结果复核

1. 核对`results/MANIFEST.json`与`evidence/remote_run02_manifest/OUTPUT_MANIFEST.json`的SHA。`supplement/MANIFEST.json`为逐基因与语义补充的接收回执。
2. `knowledge.jsonl`是带最终核对结果的主记录，`results/claims_frozen.jsonl`是最初34条冻结知识。SQLite是可重建查询副本；`knowledge_graph.json`与`knowledge_graph.graphml`保持陈述条件与来源。
3. 本地执行`python -X utf8 src/qa_viewer.py --base .`核验34条页面和筛选。`python -X utf8 src/make_figures.py --base .`重绘三图（覆写本轮同名派生图）；修改模板后用`python -X utf8 src/render_viewer.py --base .`刷新HTML。
4. 完整导出用`src/build_deliverables.py --base <新导出目录> --results <该目录/results>`。先复制本轮src、literature、provenance、results、supplement至新目录；脚本拒绝覆盖已有SQLite。随后运行`write_reports.py --base <新目录>`。复制生成的图或重绘。

逐条阅读版与网页使用同一份文案：修改`src/reader_copy.py`后，依次运行`python -X utf8 src/reader_copy.py --base .`和`python -X utf8 src/render_viewer.py --base .`。前者生成`reading_guide.json`及`00_逐条发现_易读版.md`，后者刷新网页；它们不修改冻结知识或科学计算结果。新导出目录也需要运行文案生成器。

## 原矩阵重新计算

仅在需要重算时建立全新远端run目录；不要重启或删除run01/run02。将当前`src/analyze.py`存入新目录的src子目录，文件名analyze_v3.py；将`src/project_mtx.cpp`存入同一src子目录，文件名project_mtx_v2.cpp；`PROTOCOL.md`存为PROTOCOL_v3.md，另放`mapping.json`与`literature/literature_claims.jsonl`（远端名literature_claims.jsonl）。这些输入源文件的冻结哈希见`evidence/PRE_RUN_FREEZE_v3.json`。本轮输出目录中的FREEZE还核对run01相同知识哈希。

检查当前GPU/CPU任务与路径后，复制`src/launch_run02.sh`为新的审查脚本，明确修改AUDIT_BASE并使用全新job ID，通过项目根`python scripts/vem_remote.py start --id <新ID> --script <新脚本>`启动。环境为`/home/biocosmosx/miniconda3/envs/model_py310/bin/python`，OMP/BLAS/MKL线程数1；C++投影器由g++ -O3 -std=c++17编译。断线后只查同一ID，不盲目重复启动。

程序顺序：允许元数据筛选→原始MTX投影→外部样本比例与知识冻结→四份官方统计→E8.0空间外部数据→六条pilot→全部知识→固定映射→验证与输出清单。原始MTX全字节hash包含受保护列的文件字节，但这些列的表达token在解析数值前跳过，不产生受保护阶段统计或输出。未用这批知识训练比赛模型。

主统计结束后，`src/supplement.py --base <新远端run目录>`从已经保存的聚合与cache派生逐基因表和仿射系数，拒绝覆盖supplement目录；不改变冻结结果。主代码使用精确symbol匹配；歧义symbol隔离。当前参数均固定，无参数搜索。

## 分析单位、分母与缺失

- 比例：每样本全部保留观测；Unknown和未映射计入分母；E-MTAB先作者QC再允许日龄。混合样本不是单胚胎。
- 轮廓：每样本×类型，至少30个共同面板非零观测；共同基因counts/total×10000后log1p，先均值再样本等权。E8.0为未核实权重敏感性；缺基因不补零。
- 检测率：该组全部观测中相应层>0的比例。AUC为该官方标签相对其余标签的秩区分度，无显著性解释。
- 映射：外部平均轮廓为x、官方为y；identity、全局y=a+bx、逐基因一元Ridge(alpha=1)。标准化仅训练x，训练y均值作截距；不随机拆细胞；不调参。
- 打乱对照：固定seed=20261116，在训练阶段内部打乱类型对应。它保留总体基因分布，用来判断改善是否依赖类型对应。
- 泛化门槛：训练至少2阶段和3类型；两种留出每个组都改善且平均优于相应打乱对照才支持。主分析缺整阶段留出条件；敏感性未通过门槛。

## 收据和存储

主作业成功回执`evidence/job02_success.json`，失败`evidence/job01_failed.json`。原始数据、投影大矩阵、可重用cache留远端；本地仅明确清单的小文件。正式数据hash、知识冻结、结果hash、补充hash、交付hash分别保留，不用本地派生文件冒充原始矩阵。
