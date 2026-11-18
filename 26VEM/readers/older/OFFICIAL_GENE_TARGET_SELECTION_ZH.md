# 官方 T1、T2、T3 如何选基因、选预测目标与扰动靶点

2026-11-15；依据本日直接获取的官方 Data、Data Protocol 页面，以及本地真实文件/官方有序 panel 的复核。

先分清四件事：**实验测哪些基因、提交文件必须带哪些基因、评分中的差异基因如何确定、实验敲除哪个基因**。它们不是同一个集合，也不是同一个选择步骤。

## 1. 实验测量的基因怎么选

| 任务 | 实验及基因范围 | 官方明确说明的选择依据 | 尚未公开的细节 |
|---|---|---|---|
| T1 | 10x Single-cell Multiome，**细胞核**；竞赛只释放 RNA，不释放 ATAC；32,285 基因 | 全转录组测量；Cell Ranger ARC v2.0.2 对齐 mm10；Seurat/Signac 处理、去双细胞和环境 RNA 后导出 RNA | 从参考注释到恰好 32,285 列的完整基因过滤代码/阈值；不能声称它们是按高变基因或心脏 marker 选出的 panel |
| T2 胚胎与心脏 | Vizgen MERSCOPE 的 500 基因 MERFISH panel | 官方原文：**“designed to cover all cardiac-related cell types and the cell types around them”**；不同阶段、胚胎和心脏使用同一设计 | 每类配多少基因、候选池、差异表达或特异性阈值、探针可设计性筛选、逐基因入选理由和设计代码 |
| T3 | 与 T2 相同的 500 基因 MERFISH panel | 在 WT 与 KO 中测量同一个读出集合，比较扰动造成的表达和空间分布变化 | 未公开另一套专门按 KO 响应筛出的 500 基因；不能把它当成专门的 Gata4/Wnt 靶基因库 |

这套官方资源由 UCSD 的 Qingquan Zhang、Neil Chi 团队生成。官网明确写明数据尚未发表，因此目前不能拿一篇外部 MERFISH 论文的 panel 设计方法来冒充这套数据的实际方法。

T1 协议里的 `FindAllMarkers` 用于**聚类之后找 marker 和注释细胞类型**。官方没有说用它把 T1 压缩为 32,285 基因，也没有明确说它直接生成了 MERFISH 的 500 基因清单。

证据：[官方实验协议：MERFISH](https://virtualembryo.ai/challenge/data-protocol#merfish)、[Multiome](https://virtualembryo.ai/challenge/data-protocol#multiome)、[数据出处](https://virtualembryo.ai/challenge/data)。

## 2. 提交的 panel 又经过了一次交集

官方 Data 页面说明：一个赛道的提交 panel 是**该赛道实际加载的所有阶段的基因有序交集**，包含相应训练/参照阶段和目标阶段，并非直接照搬目标文件的列。

| 文件或赛道 | 实际基因数 | 本次复核 |
|---|---:|---|
| T1 当前 test panel；已释放 E8.5/E9.5/E10.5 RNA | 32,285 | 固定全转录组轴 |
| T2/T3 空间标准 panel | 500 | 当前 heart test 与 β-catenin test 的清单相同；提交仍须读取对应赛道文件 |
| 胚胎 E6.75/E7.25 文件与旧 validation 提交 panel | 498 | 相对 500 缺 `Casp4`、`Pnliprp1` |
| 官方已释放胚胎 E7.5 真值文件 | 500 | 不等于当时提交要求 500 列 |
| 当前胚胎 test panel | 497 | 相对 498 再缺 `AI646519` |

**Casp4/Pnliprp1 的原因有了更精确说明。** Data 页面使用“not measured”的简写，Data Protocol 则明确说设计 panel 没变，而是这两个基因在 E6.75/E7.25 表达过低、未检出，所以未保留在文件轴中。应表述为“同一实验设计、导出列不同”，不能直接推断实验换了 panel。

对 `AI646519`，可确认的是当前有序交集少了这一列；没有公开到足以确定其具体缺列原因的测量记录，不能把前两个基因的解释自动套到它身上。

证据：[官方每赛道 panel 解释与下载](https://virtualembryo.ai/challenge/data#panels)、[MERFISH 协议](https://virtualembryo.ai/challenge/data-protocol#merfish)。本地复核数据见本目录 `panels.json`、`panel_marker_examples.csv`。

## 3. 面板里确实包含什么，又不包含什么

以下只是核对实际名单后的生物学示例，**不是官方公开的选基因打分函数或分组配额**。

| 读出示例 | 500 panel 中实际存在 | 不能默认存在的常用 marker |
|---|---|---|
| 心脏发育/心场 | Gata4、Gata6、Tbx5、Hand1、Hand2、Isl1、Mab21l2 | Nkx2-5、Tbx20 |
| 心肌相关 | Myh7、Acta2 | Tnnt2、Myh6 |
| 内皮相关 | Pecam1、Cdh5、Klf2 | Kdr、Tek |
| 周围胚层/组织 | Sox17、Foxa2、Sox2、Pax6、Tbx6、Col1a1、Col3a1 | Mesp1、T |

`Ctnnb1` 在 T1 的 32,285 基因轴里，但不在 T2/T3 的 500 panel 中。这直接证明：**实验中的敲除靶点不要求本身出现在空间读出 panel 中**。β-catenin 任务要预测的是其下游造成的整体细胞状态、组成和空间变化，不能通过“把 Ctnnb1 那一列清零”来完成。

## 4. T1、T2 的“靶点”实际是发育阶段

| 任务 | 原始训练阶段 | validation 目标 | test 目标 | 官方解释的设计逻辑 |
|---|---|---|---|---|
| T1 | E8.5、E9.5 | E10.5 | E12.5 | 从已观测阶段预测未来表达分布，考察时间外推；这套单核 RNA 发布中没有 E9.25，因此用真实存在的两个前置阶段 |
| T2 胚胎 | E6.75、E7.25、E8.0 | E7.5 | E7.75 | 两个目标都严格位于 E7.25–E8.0 内，考察插值；时间间隔小、原肠运动期组成变化快 |
| T2 心脏插值 | E8.25、E8.75（另有 E9.5） | E8.5 | **无心脏插值 test** | E8.25–E8.75 间只有一个可留出的 E8.5；最终插值能力在胚胎 E7.75 上考察 |
| T2 心脏外推 | E8.25、E8.75、E9.5 | E10.5 | E12.5 | 目标位于最后训练阶段之后，考察外推；P3 授权释放 validation 后可加入这些官方阶段 |

E7.75 虽然存在 Multiome 测量，但官方未把它作为 T1 的附加训练数据发布，因为它同时是 T2 胚胎的隐藏 test 阶段。这是跨任务防泄漏的切分决定。

另一个重要背景是**取材范围也变化**：官方协议说明 E8.25–E9.5 空间数据取含心管的切片、保留卵黄囊；E10.5/E12.5 则先解剖出心脏再切整个心脏。T1 早期也带较多周围组织，后期更偏心脏。所以阶段差异同时混合了发育和取材，外部整胚/纯心脏不能只按 E 天数视为完全可比。

官方对 E8.0 的细化协议还指出，只收集从卵黄囊–胚胎边界到心月牙消失层面的切片。Data 概览里的“whole embryo”是设置名称，不能替代这一具体采样范围。

证据：[官方任务切分](https://virtualembryo.ai/challenge/data)、[取材协议](https://virtualembryo.ai/challenge/data-protocol#sampling)。

## 5. T3 怎么选扰动靶点

| 角色 | 基因/阶段 | 官方公布的真实基因型 | 官方已说明的难度设计 |
|---|---|---|---|
| 训练 | Mab21l2，E9.5 | Mab21l2-null；两份 CreERT2 knock-in 等位基因，导致功能性 MAB21L2 丧失 | 表型清晰、基因相对特异 |
| validation | Gata4，E8.75 | **Mesp1-Cre; Gata4 F/F; Gata6 F/+**，两个独立同窝重复 | 特异性较强的扰动；不是一个孤立的纯 Gata4 条件，Gata6 杂合是增敏背景 |
| test | β-catenin/Ctnnb1，E8.75 | **Mesp1-Cre; β-catenin F/F**，两个独立同窝重复 | 基因表达更广、影响更分散，官方称其最难 |

Gata4 与 β-catenin 的删除受 Mesp1-Cre 限定在中胚层谱系。Mab21l2 则应按协议写作 null，不应沿用此前笼统的“所有都是同一种条件 KO”的说法。

每个 KO 配同阶段 WT 参照；官方协议说明 WT 是另一条野生型品系，KO 与 WT 分批处理。因此 KO–WT 差别也可能带批次成分，不能把所有差异基因都视为直接调控靶基因。

**公开依据能支持的结论是：用一个已知扰动训练，预测新的扰动，并把更广泛的 β-catenin 作用留到最终测试。** 暂未找到官方公布的候选靶点全集、筛选排名、随机化过程、为何不选其他通路或具体预算权衡；这些不能靠生物学常识补成“官方理由”。

证据：[官方 KO 切分与难度描述](https://virtualembryo.ai/challenge/data)、[官方 KO 基因型](https://virtualembryo.ai/challenge/data-protocol#knockouts)。

## 6. 评分时选的差异基因是第四层

本地保存的公开 `veckit/common/core_metrics.py` 中，`de_genes` 使用真值相对参照的 Wilcoxon/Mann–Whitney、BH FDR 0.05 和平均 log 表达变化幅度至少 0.25 来定义上/下调集合；预测按自身变化排序，分别匹配真值规定数量的上/下调基因。这里所谓 `lfc` 实现为**平均 log 表达差**，不能直接解释为原始计数的 log2 fold change。

这个集合随阶段/扰动和比较参照变化，既不是预先设计的 500 探针，也不是敲掉的那一个基因。此处说明的是本地公开代码快照；本日尝试访问其 README 所列 GitHub 仓库返回 404，未把本地快照伪称为新核验的线上服务端版本。细节不影响前五节直接由官方页面和实际 panel 支持的结论。

## 对我们比较外部数据的直接影响

1. T1 优先比较同阶段、同类型的**核 RNA/细胞 RNA**，并显式记录二者差别；不能将 32,285 基因要求理解为 500 心脏 marker 任务。
2. T2/T3 先看外部矩阵对**当前赛道交集**的实测覆盖，再看表达、采样范围和空间单位。算法补齐的零列不算覆盖。
3. “也用了 MERSCOPE”不保证 panel 一样；“也敲 Gata4”不保证 Cre、背景等位、年龄与组织一致。
4. 当前只明确了 500 panel 的覆盖目标，没有逐基因的入选方法。如果后续需要重建实验 panel 的选择逻辑，真正缺的是设计表/探针表及候选 marker 选择记录，而不是再猜一次常见 marker 名单。

官方页面原始 HTML、可检索文字与 SHA 位于 `official_sources/`，本报告不修改任何历史记录。
