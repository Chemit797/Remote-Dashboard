# 面板与先验的来源边界

来源索引和逐项限制见 [SOURCES.json](SOURCES.json)。本文件在查看本轮 P2 定量结果前整理，不包含 P2 结果。

## 官方能够直接回答的选择问题

官方 [Data Protocol](https://virtualembryo.ai/challenge/data-protocol) 的设计层理由只有一项明确陈述：同一 500 基因 MERSCOPE 面板用于覆盖心脏相关及周边细胞类型。公开页面没有完整的逐基因选择记录、候选设计池或探针技术表。因此，把某基因注释为“心肌收缩”“内皮”“神经”等，只说明它可能提供何种观测信息，不能写成作者确曾因此选择该基因。

原始设计、文件观测和评分纳入是三个轴。[官方 Data 页](https://virtualembryo.ai/challenge/data) 说明评分面板为每个 board 所加载阶段的有序交集。胚胎 P2 排除 Casp4 与 Pnliprp1，共 498 基因；官方协议称两基因在早期“低表达未检出”，数据页称“未测量”。本轮保留此冲突，文件中将其编码为缺列，不能补成观测零值。

## 查看 P2 前可固定的分析先验

本地 [marker_modules.json](../../results_20261112/marker_modules.json) 是 2026-11-12 已存在的六组基因定义，SHA-256 为 `c1bf5f000b02ac1c54a941d7f17742c30d6ff14da4b1b7b7382db6dba7a8788f`。其用途是限定本轮检验成员，而不是继承旧结果。官方 500 基因心脏评分清单与这六组的交集如下；分母是模块定义基因数，未观测成员不补零。

| 先验模块 | 原定义数 | MERFISH 面板可观测数 | 可观测成员 | 主要边界 |
| --- | ---: | ---: | --- | --- |
| 收缩装置 | 12 | 4 | Myh7, Myl4, Myl7, Ttn | Tnnt2、Actc1 等不在面板；四基因不能代表完整收缩程序 |
| 心脏调控 | 6 | 5 | Tbx5, Gata4, Hand1, Hand2, Mef2c | Nkx2-5 缺失；调控因子 RNA 不等于活性 |
| 内皮身份 | 8 | 4 | Pecam1, Cdh5, Esam, Emcn | 覆盖不完整，且可能参与原始类型注释 |
| S 期 | 9 | 0 | 无 | 不能以此模块在 MERFISH 中判断 S 期状态 |
| G2/M | 8 | 3 | Top2a, Cdk1, Cenpf | 仅限部分周期标记 |
| 神经分化 | 6 | 2 | Elavl3, Stmn2 | 阴性对照需先检查实际细胞与检出支持 |

这些覆盖数来自 [官方心脏 500 基因有序清单](https://virtualembryo.ai/challenge/panels/T2__heart__val_extrap.genes.txt) 与本地模块定义的交集，属于面板身份核对，不是表达结果。T1 全转录组仍可检查原始模块；T2/T3 需使用面板内成员并在图表注明不同估计对象。用于定义类型的标记不得再单独充当该类型符合先验的独立验证。

[Klaus 等 2012 原始扰动研究](https://pmc.ncbi.nlm.nih.gov/articles/PMC3390862/) 支持在 **E9.0 心脏祖细胞及其特定干预背景** 将 Wnt 相关的 Nkx2-5/Isl1/Smarcd3 与 BMP 相关的 Gata4/Srf/Mef2c 分成不同候选组；它不规定正常时序的统一上升方向，也不能给本挑战 Gata4 条件的效应量。更广的情境化先验已列在本地 `priors_20261112/prior_catalog.json`；进入主分析的成员、时期、谱系、对照和尺度应另以本轮冻结文件为准。

## 功能富集与技术特征

功能富集可以使用 [GO 小鼠 GAF 与 go-basic 本体](https://geneontology.org/docs/download-go-annotations/downloads/)，主背景应是相应时期 T1 中可表达且可映射的基因，另用表达量/检出率匹配的随机集检查选择偏差。下载版本、哈希、证据代码、映射率和匹配失衡必须留档；全基因组背景仅作描述。GO 的功能归属不能证明作者设计动机。

官方尚未公开逐基因探针数量、序列、轮次、通道和 blank-probe 信息。缺少这些字段时可以定位基因特异异常，但不能确认探针失败、串色或具体技术偏差。发布矩阵为 log1p(CP10k)，`expm1(X)` 仅是相对的线性归一化表达。
