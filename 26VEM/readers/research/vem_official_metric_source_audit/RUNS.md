# 本轮运行与复现

本轮已完成。没有进行官网提交，没有生成竞赛预测 H5AD。远端主分析根为`/home/biocosmosx/work/virtualembryo_cym/experiments/vem_official_metric_source_audit_20261116/run01`。

| 作业 ID | 实际结果 | 内容 |
| --- | --- | --- |
| `vem-metric-inputs-20261116-01` | succeeded，exit 0 | 36份阶段输入，0项准备失败；后续增加6个跨任务引用视图，不复制原矩阵 |
| `vem-metric-score-20261116-01` | succeeded，exit 0 | 46个配对、369行表达指标、12行空间结果、20条阶段变化；1,530项独立检查通过 |
| `vem-metric-transfer-20261116-01` | failed | Python 3.10语法不兼容，未开始读取分析数据；原记录保留 |
| `vem-metric-transfer-20261116-02` | succeeded，exit 0 | 780行留出指标；76项本地交付核验通过 |

主评分使用`ops/score02.sh`，远端实际入口为`src/score_sources_v2.py`；文件名里的02表示部署稿版本，不是第二次评分尝试。原准备包中的`src/score_sources.py`和初版协议保留。实际代码 SHA 与本地当前`src/score_sources.py`一致，参见[运行身份](results/outputs/run_identity.json)与[部署清单](provenance/scoring_bundle_manifest.json)。

算法固定到`aristoteleo/veckit@cc3859ab2a2305efc4544815d3f44f660efa77d4`。远端使用Python 3.10.18、NumPy 2.2.6、SciPy 1.15.3、scikit-learn 1.7.2；BLAS/OMP各1线程。本轮主分析只运行一个CPU作业。

## 结果接收

按显式文件清单分13批取回211个小结果文件，传输内容52,569,293 bytes，另有接收清单；每个文件都核对了传输字节SHA，以及解压后的原始SHA。矩阵、全部抽样行号及完整远端输出留在5090；其身份与哈希可由[完整远端结果清单](results/outputs/RESULT_MANIFEST.json)追溯。[本地接收核验](RESULT_RETRIEVAL_VERIFICATION.json)记录了所有取回文件，没有未取回的所选文件。

空间输入另核对了两份原文件的全部表达值、标签及坐标行对应：[核验记录](results/outputs/spatial_input_verification.json)。四种任务/参考条件下，缓存公式与公开函数的MMD、CSS、DES差为0；DCS另用残差相关复核，误差小于3e-17。阶段变化的20条结果另有[独立核验](results/outputs/delta_audit/verification.json)。

网页经过桌面和手机布局、七份已公开参照、两个隐藏测试位置、筛选、详情页签和本地链接检查：[网页验收](qa/VERIFICATION.json)。首次发现的手机横向溢出已修复，原失败记录和截图保留在`qa/INITIAL_LAYOUT_FAILURE.json`和`qa/mobile_before_fix.png`。

## 重建本地交付

在项目根目录依次运行：

```powershell
python -X utf8 -B research/vem_official_metric_source_audit/src/build_report.py
python -X utf8 -B research/vem_official_metric_source_audit/src/build_findings.py
python -X utf8 -B research/vem_official_metric_source_audit/src/build_dashboard.py
python -X utf8 -B research/vem_official_metric_source_audit/src/verify_dashboard.py
```

这只读取已核验的小结果文件，不会重跑远端计算。若要重新计算，先指定新的实验目录与唯一作业ID，再按[冻结方案](PROTOCOL.md)和[口径补充](CLARIFICATIONS.md)复用可追溯输入；不要原地覆盖本轮运行或直接重启旧ID。

原知识库及其模板只追加了本页入口，原来的普通比较入口与知识内容均保持原字节：[导航更新核验](provenance/knowledge_navigation_update.json)。
