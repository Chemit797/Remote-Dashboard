# 本轮最值得先看的四个结果

这些是已计算数据中的具体例子。来源身份、基因集合、种子和逐条数值可从证据链接追溯；未据这些例子调参。

## T1 E9.5：不同指标给出的来源顺序不同

VED-012 · Feng 分心腔单细胞图谱的 MMD 是 0.3321，小于OMIX014646 · mdCLA 全胚胎单细胞图谱的 0.3998；CSS 距离却是 0.0337，大于后者的 0.0306。两项都是越小越近，当前点估计的顺序并不相同。

限于本轮共同基因、抽样和取材条件；不是数据质量排名，也没有把小差值判成生物学显著差异。

证据：[source_summary.csv](results/outputs/source_summary.csv)、[metrics.csv](results/outputs/metrics.csv)。

## 统一分母，不能同时改善所有指标

T2 的 6 个同阶段配对中，MMD 有 6 个变小，CSS 只有 2 个变小。例如VED-001 · Pijuan-Sala 早期全胚胎图谱在 E7.25 的 MMD 从 0.3978 降至 0.2495，CSS 却从 0.1115 升至 0.2846。

配对数包含同一来源的重建重复，不是独立研究数。两种表示都保留，不把一种数值改善解释成来源差异已被消除。

证据：[representation_change.csv](results/outputs/representation_change.csv)、[metrics.csv](results/outputs/metrics.csv)。

## 单阶段接近，与发育变化接近，是两项检查

OMIX014646 · mdCLA 全胚胎单细胞图谱与官方在 E8.5、E9.5 的平均表达 Pearson 相关分别为 0.8939、0.8883；双方各自 E8.5→E9.5 的变化 Spearman 相关为 0.3676。

前者看某时刻的平均表达，后者看同一基因前后变化。阶段间不是同一胚胎的连续跟踪，取材变化也可能影响结果。

证据：[source_summary.csv](results/outputs/source_summary.csv)、[delta_metrics.csv](results/outputs/delta_metrics.csv)。

## 简单换算尚不能稳定迁移到所有类型

VED-001 · Pijuan-Sala 早期全胚胎图谱的整阶段留出中，Ridge 让 MMD 从 0.3868 降至 0.2772，CSS 从 0.3275 降至 0.2465；同一视图上的逐基因均值 MSE 却从 0.9922 升至 2.6947。整类型留出仍在尿囊、血液祖细胞上失败。

此支线用独立的496基因面板，不能与主表绝对距离横排；分布指标变好不保证每个基因的均值更准确。

证据：[overview.csv](transfer/results/outputs/overview.csv)、[fold_verdicts.json](transfer/results/outputs/fold_verdicts.json)、[FINDINGS.md](transfer/FINDINGS.md)。
