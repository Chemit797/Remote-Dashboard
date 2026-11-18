# VEM 项目全景与策略回顾

更新于 2026-11-11，面向重新接手项目的人。范围覆盖 T1、T2 的胚胎插值、心脏插值、心脏外推，以及 T3。按你的原文回顾各策略从本地验证向 P2 官方评测的迁移，同时讨论进入 P3 后的接续。

5090 主机名为 `DESKTOP-7A215VC`，当前计算环境为 WSL，GPU 为 RTX 5090 32 GB。五个历史最佳预测已经在本轮从保存的父文件或拟合状态重新生成，五份 SHA256 均与历史文件完全一致。运行步骤和训练链详见 agent 手册。[agent 完整手册](/home/biocosmosx/work/virtualembryo_cym/team/handbook_20261111/AGENT_HANDBOOK.md)

## 一、文件现在分布在哪里

```text
5090 上的 VEM
├── /home/biocosmosx/work/
│   ├── virtualembryo/                 25.85 GiB，最初工程和官方训练数据
│   │   ├── data/                      各阶段 H5AD，当前主工程通过软链接使用
│   │   ├── assets/                    基因网络等先验
│   │   ├── checkpoints/               早期模型
│   │   ├── outputs/                   早期各版本预测
│   │   └── logs/、reports/、manifests/  早期执行和提交证据
│   ├── virtualembryo_baseline/         约 0.14 GiB，8 月最佳组合归档
│   ├── virtualembryo_csh/              约 0.13 GiB，旧基线分支
│   ├── virtualembryo_ct/               约 0.13 GiB，旧基线分支
│   └── virtualembryo_cym/              396.08 GiB，当前主工程
│       ├── experiments/               39 个一级实验目录，训练、模型、评分、交付
│       ├── Virtual_Embryo_External_Data/ 125.44 GiB，外部数据与来源审计
│       ├── reproduction_20261020/      公开方法复现及旧 P3 预演
│       ├── src/、scripts/、protocols/  共用实现、工具和验证协议
│       ├── reports/、registry/        分析报告及旧索引
│       ├── submission/                历史提交归档
│       ├── SUBMISSION_READY_T1_*/      10 月 12–13 日的旧交付包
│       ├── data -> ../virtualembryo/data
│       ├── assets -> ../virtualembryo/assets
│       └── team/handbook_20261111/     本次两版手册、全量路径索引、复现结果
├── /mnt/d/work/virtualembryo/           19.36 GiB，Windows D 盘的旧结果副本
│   ├── reports/
│   ├── submission/
│   └── tmp_v33/
├── /mnt/d/virtualembryo_cym_archive/    286.46 GiB，已迁出的历史大文件
│   ├── cleanup_20261025/experiments/
│   ├── cleanup_20261025/_provenance/
│   └── revisions/20261011/
├── /mnt/d/Project/26WLU/               约 0.015 GiB，Windows 旧提交中转
│   └── md/submit/1026/、1027/          29 个交付文件、脚本与说明
├── /mnt/c/Users/AI server/Downloads/   已识别 VEM 文件约 11.22 GiB
│   ├── VEC2026_T1_*/                   T1 H5AD、ZIP、PowerShell 下载校验脚本
│   ├── VEC2026_T2_*/                   三个 T2 子任务的交付包
│   ├── VEC2026_T3_*、T3_*              T3 交付包及散落 H5AD
│   ├── VEC2026_SOURCE_CACHE_20261025/   源数据缓存
│   └── VEC2026_OFFLINE_NOT_FOR_SUBMISSION_20261025/ 旧离线材料
├── /home/biocosmosx/Downloads/          已识别 VEM 文件约 0.20 GiB
│   └── VEC2026_T1_*、VEC2026_T3_*      另一路交付包
├── /mnt/c/Users/AI server/virtualembryo-transfer/  当前为空
├── /home/biocosmosx/ 与 C 盘用户根部    少量旧诊断、编码器和后处理脚本
└── /tmp/                              已识别 VEM 材料约 2.42 GiB
    └── vec_*、ve_*、T1_*、T2_*、T3_*   网页快照、公开代码缓存、临时计算材料
```

`/mnt/c`、`/mnt/d` 分别对应 Windows 的 `C:\`、`D:\`。盘点得到的路径文件大小合计约 742 GiB，包含不同位置的副本、归档和缓存。完整扫描范围、每个根路径和逐文件地址均已保存，目录软链接的目标也在清单中。[根路径清单](/home/biocosmosx/work/virtualembryo_cym/team/handbook_20261111/inventory/ROOTS.csv) · [逐文件索引](/home/biocosmosx/work/virtualembryo_cym/team/handbook_20261111/inventory/ALL_PATHS.tsv.gz) · [扫描记录](/home/biocosmosx/work/virtualembryo_cym/team/handbook_20261111/inventory/SCAN_RECEIPT.json)

主工程内部按任务寻找文件即可。

```text
/home/biocosmosx/work/virtualembryo_cym/experiments/
├── T1-v1-20261008/ → T1-atlastimeshift-20261013/
│   → T1-push60-20261021/ → T1-push70-20261022/ → T1-top10-20261026/
├── T2-embryo-push-20261025/              胚胎插值主线
├── T2-heart-interp-20261025/            R05、R15、R31 等初期心脏插值
│   → T2-heart-public-reset-20261025/ → T2-heart-interp-top10-20261026/
├── T2-heart-extrap-20261025/            54.59 簇级表达外推及公开重建
│   → T2-heart-extrap-top10-20261026/    后续神经、空间与多时间研究
├── T2-heart-top10-20261025/             两条心脏线共享的 TIGON 研究
├── T3-push60-20261021/ → T3-push70-20261021/ → T3-push75-20261023/
│   → T3-push80-20261023/、20261024/、20261025/、20261026/
│   → T3-top10-20261026/
├── T3-kbb-repro-20261021/、T3-candidate-audit-20261021/ 公开配方与交付审计
├── T3-BGM-20260909-01/、T3-PTM-20260908-01/            早期扰动模型
├── VCC-to-VEM-20261021/                 跨比赛方法迁移
├── embryo_table_*、embryo_vision*、t2_route_*、whole_table_state_* 等共享探索
├── paper_lineage_20261108/              论文程序、真实谱系教师与实际 T2 评分
└── submission_feedback/                共享官方结果账本及原文
```

`models/` 在当前主工程中为空，训练模型主要放在对应实验目录。根部 `best_scores.json` 与不少 `CURRENT_STATE.json` 更新较早，本轮汇总另纳入了独立保存的后续回执。91 条归一后的官方结果记录可直接查表，原始出处逐条列出。[官方结果总表](/home/biocosmosx/work/virtualembryo_cym/team/handbook_20261111/evidence/OFFICIAL_RESULTS.csv)

## 二、任务、成绩和阶段

| 任务 | P2 要回答的问题 | 已保存最佳 | P3 目标 |
|---|---|---:|---|
| T1 | 用 E8.5/E9.5 单细胞 RNA 预测 E10.5 的细胞表达分布 | 70.01 | E12.5，32,285 基因 |
| T2 胚胎插值 | 用 E7.25/E8.0 等已发布阶段预测 E7.5 的 RNA 和三维分布 | 67.22 | E7.75，497 基因 |
| T2 心脏插值 | 用 E8.25_late/E8.75 预测 E8.5 的 RNA 和三维分布 | 68.50 | E8.5 转为获权后的验证研究材料 |
| T2 心脏外推 | 用截至 E9.5 的已发布阶段预测 E10.5 | 54.59 | E12.5，500 基因 |
| T3 | 从正常与已发布训练 KO 推断 E8.75 Gata4 条件敲除的完整表达分布 | 73.78 | E8.75 β-catenin 条件 KO，500 基因 |

这里的分数来自 P2 官方反馈。11 月 10 日公开合同已显示 P3 开放，四个 test 板各有整个阶段两次正式提交机会，公布的截止日是 12 月 2 日。账号的访问状态、P3 已用次数和最终截止时刻仍需账号侧核对。[本期合同](/home/biocosmosx/work/virtualembryo_cym/team/evidence/contracts_20261110/RELEASE_GATE_RECEIPT.json)

## 三、T1 的迭代与当前方法

**问题在于同时预测均值、细胞组成和细胞间表达分布。** T1 的 DE、方向、MMD、基因对 variogram 权重分别是 25%、25%、30%、20%。后两项使细胞生成方式直接影响总分。

迭代路径由早期 latent transport、状态质量与 birth mixture，经过 VCC AtlasTimeShift、分位数/稀疏性与均值锚定，再进入多来源发育响应和细胞类型条件修正。进入后期，完整配方消融比持续叠加修正更有效。

| 关键阶段 | P2 结果 | 得到的认识 |
|---|---:|---|
| VCC Atlas blend10 | 51.12 | 跨比赛的有效机制仍需适配表达单位和评估目标 |
| q20 → q40 mean-anchor | 58.48 → 59.55 | 保留真实细胞残差并校准分布，开始获得稳定收益 |
| Feng hurdle、多来源与组织范围调整 | 63.26，随后进入 67 分段 | 合法外部发育变化与目标细胞类型匹配有价值 |
| Global30 mean＋shape → mean-only | 68.70 → 69.45 | 移除后续 shape 步骤，保留已有效的均值阶段，官方提高 0.75 |
| CellOT PCA50 joint residual | 69.49 | 当前两帧训练的非线性映射带来小幅增量 |
| 类型内离散度 D150 | **70.01** | 主要改善基因对表达结构 |
| 后续 Global30 mean transfer、GP curvature | 69.91、69.71 | 两者接近最佳，仍低于 D150 |
| 进一步 SuperDispersion225/300 | 49.25、41.33 | 原成功幅度向更强幅度延伸时，分布严重失真 |

当前最强文件由 69.49 的 CellOT 父预测生成。逐细胞类型把表达还原到线性量，对正值应用 1.5 次幂，再用迭代比例拟合恢复原类型内基因总量和每细胞总量。这个操作保留零模式和线性量边际，log 均值与 DE 可以随之改变。

D150 相比 CellOT 的 variogram skill 提高 6.7 个百分点，按权重约贡献 1.34 总分。MMD、DE 和方向的下降抵消部分收益，最后官方提高约 0.52。这解释了高分的直接来源。进一步放大失败，说明有效范围依赖父分布和输出约束。[离散度实现与报告](/home/biocosmosx/work/virtualembryo_cym/experiments/T1-top10-20261026/deadline_sprint_v1/bedtime_attack_20261027/dispersion/METHOD_REPORT.md)

**P2 迁移结论。** mean-only、CellOT 和 D150 的具体文件有正式回执。来源数据中 MMD/CSS 的改善和后续官方结果并不总同向，尤其是扩大来源范围、增强协方差和提高响应强度时。多个合法发育窗口提供机制筛查，E10.5 的正式效果仍由回执决定。

**改进方向。** 将均值、检出率、正表达分布和联合结构各自做配对消融，围绕强父预测验证观测过程与目标组织覆盖。P3 获得官方 E10.5 后，优先判断哪些部分能延伸到 E12.5。新来源首先检查组织、时期、单位与增量信息。

```text
方法与训练   experiments/T1-top10-20261026/deadline_sprint_v1/cellot_pca_v1/
最佳生成     同级 bedtime_attack_20261027/dispersion/build.py
实际日志     同级 bedtime_attack_20261027/dispersion/EXECUTION.log
关键消融     experiments/T1-push70-20261022/expansion_653/
后续失败     deadline_sprint_v1/final_charge_20261027/OFFICIAL_FEEDBACK.json
最新回执     deadline_sprint_v1/OFFICIAL_FEEDBACK_20261028.json
```

上方路径均位于主工程根目录，完整绝对路径及上游依赖在 agent 版中展开。

## 四、T2 胚胎插值

**问题在于原肠胚形成期的细胞组成变化、三维形状和 RNA–位置绑定。** 当前最好 67.22 来自公开方法重建后的源支持几何选择。

早期 v3.1 归档为 63.70。真实细胞 donor 与观察过程的多轮修正产生大量开发结果，正式 D100 为 61.84。随后重建公开 OT/点云形变、分层抽样、16 基因均值修正和全局 Hungarian RNA–位置重配对，得到公开 A 配方的本地版本，正式分为 67.19。源支持几何探针再提高到 67.22。

源支持机制为每个细胞提供两个固定坐标候选，分别来自 A 和 source-sliced 形状。对两个可见端点建立 32 邻居距离，并用源内距离尺度归一化，逐行选择支持代价较低的坐标。表达行直接沿用 A。源坐标对齐来自模型假设，需要在目标任务上验证。

| 配对比较 | 本地判断 | P2 官方结果 |
|---|---|---|
| A → support geometry | 原版本约 +1.99，旋转修复版本约 +1.63 | **+0.03** |
| 相同几何上加入 high-DE 表达 | 约 +0.54 | **−0.18**，67.04 |

几何探针的 D2/Dice 进步被尺度和邻域项回退部分抵消。high-DE 的 DE/方向稍升，MMD、variogram 和邻域下降。完整评分解释了局部目标优化后的正式结果。[官方配对复盘](/home/biocosmosx/work/virtualembryo_cym/experiments/T2-embryo-push-20261025/aggressive_pair_20261027/OFFICIAL_PAIR_CLOSEOUT.md)

**P2 迁移结论。** A 的完整重建获得了有效成绩，后续本地增量明显高估正式增量。反复使用的 E7.25 开发窗已经难以提供新的选模证据。作者公开 69.67 的历史链仍涉及未公开中间字节和尺度出处，当前 67.19/67.22 是本队具体文件的成绩。

**改进方向。** 在同一表达/几何父模型上分别测形状、分布和绑定，使用标准与稀疏观测视图解释差异。P3 获权后的 E7.5 是最重要的新验证输入，E7.75 生成须使用 497 基因的当期合同。

```text
公开方法链   experiments/T2-embryo-push-20261025/public_restart_v1/
最佳生成     同级 source_support_choice_v1/build.py
输入/坐标选择 同级 source_support_choice_v1/REGISTRATION.json
原始评分     同级 source_support_choice_v1/ 下的评价与 review 文件
官方交付复盘 同级 aggressive_pair_20261027/OFFICIAL_PAIR_CLOSEOUT.md
P3 准备      同级 p3_* 与 tigon_embryo_three_v1/test_readout_v1/
```

## 五、T2 心脏插值

**问题是在 E8.25_late 与 E8.75 之间恢复 E8.5 的表达分布、点云和局部组织结构。** 原公开 repair-field 重建 63.40，R05 提升到 67.04，后来的 RMS255 为 68.50。

R05 先生成多份可见端点的预测，进行表达量均值半锚定和 Hungarian 排布，再从三个固定父预测中整行抽取 RNA 与坐标，形成 bag71 的 5,000 细胞预测。最终 RMS255 只对这份预测的坐标中心化并统一缩放。

| 后续方向 | 官方或开发证据 | 结论 |
|---|---|---|
| R15 support mean、R31 program-rank | 官方 64.22、66.00 | 本地表达改善未迁移，形状或邻域受损 |
| sliced 几何、elastic/RNA graph | 官方 64.27/65.24、65.31/65.42 | 多个几何构造低于 R05 |
| R05 RMS255 | **68.50** | 尺度 skill 从 82.5 到 100，贡献约 +1.46 |
| 同尺度加轴形变或 R31 几何 | 68.07、67.82 | 额外形变丢失 D2 或邻域表现 |
| T1 均值、离散度直接迁移 | 两个开发窗失败或增量过小 | T1 的成功参数没有形成 T2 稳健增益 |
| MELA 程序与真实来源教师 | 完整文件和多 seed 实际评分完成，均未越过强基线 | 来源约束满足程度与最终空间表达质量仍有距离 |

68.50 的官方增益可以用单个尺度项解释。D2、占据和局部绑定仍是主要剩余空间，调强尺度已缺少直接收益。早期用跨时期最近距离解释“生物学支持”的记录也经历了纠正，官方坐标是胚胎局部坐标，各时期的共同解剖注册需要另外证明。[坐标纠正记录](/home/biocosmosx/work/virtualembryo_cym/experiments/T2-heart-interp-top10-20261026/SOURCE_FRAME_CORRECTION_20261027.md)

**P2 迁移结论。** R05 和 RMS255 得到正式收益，后来多种看似合理的表达、形状、谱系机制有负例。最近真实来源教师在早/晚开发窗分别低于 R05 0.1716/0.2095，主要损失来自邻域表达。P3 中这条线适合承担空间机制诊断与对其他任务的经验迁移。

**改进方向。** 在 P2 的相同条件下，优先验证真正的局部组织对应和观测过程，对“表达更像、几何更像、绑定更好”分别做完整消融。新谱系信息需要先解决原生测量域下的可识别性、缺失来源和置信度，再进入生成。

```text
R05 全链       experiments/T2-heart-interp-20261025/round03.py、round04.py、round05.py
R05 日志       同级 RUN_LEDGER.jsonl、round05_*_build.log、round05_*_score.log
最佳缩放       experiments/T2-heart-interp-top10-20261026/public_repair_coordinate_transplant_v1/build_r05scale.py
最佳反馈       同级 official_feedback_20261027_rescale255/REVIEW.json
最近官方复盘   同级 SPRINT_108.md
完整论文后续   experiments/paper_lineage_20261108/scored_followup_20261109/
真实谱系后续   同级 lineage_coupling_20261109/
```

## 六、T2 心脏外推

**问题是从截至 E9.5 的观测预测 E10.5 的表达、组成和三维组织，P3 再到 E12.5。** 当前历史最佳 54.59 使用 coarse050 表达外推。

该方法把 E8.75/E9.5 细胞映射到粗类型，估计每类的均值变化，对 E9.5 donor 表达施加 0.5 倍变化，保留已有零支持并恢复每细胞的源表达总量。它沿用了历史 scale-copy 父预测的坐标。

| 方法 | P2 官方结果 | 主要经验 |
|---|---:|---|
| scale-copy | 53.34 | 简单父预测构成有效对照 |
| coarse050＋源总量锚定 | **54.59** | 温和表达趋势获得收益 |
| regional C095 | 46.49 | 更细区域和更强响应未迁移 |
| TIGON VG | 50.43 | 连续时间模型与完整读出仍受生成和空间误差限制 |
| recent VG / V-only | 43.77 / 40.26 | 在同几何下的响应进一步退步 |

后来对公开代码来源的审计发现，旧 scale-copy 的尺度参数源于官方分数反解。54.59 及后代的坐标继承了这条祖先链。历史回执被保存，后续可用方法需要用允许来源重新建立尺度与几何。来源版本的 G0→234 已重建，训练输入为 E8.75/E9.5，尺度取真实 E9.5。[来源与重建审计](/home/biocosmosx/work/virtualembryo_cym/experiments/T2-heart-extrap-20261025/public_reset_v1/tubager_reconstruction_v1/REPRODUCTION_FINDINGS.md)

PRESCIENT、scGen、CellOT、MIOFlow、DeST-OT、多时间 TIGON、splicing 和空间 TrajectoryNet 都有实际研究记录，多个固定实例的双窗口门槛失败。增加网络复杂度或训练时长，需要由新的可预测信息支持。

**P2 迁移结论。** coarse050 的表达改动有一次正式改善，但历史总分包含有来源问题的几何部分。已有模型在近端回放上的优势未稳定延伸到正式 E10.5。另有五条心脏外推回执的显示分项与当前公开权重算出的总分存在明显差异，原始值和差异都已登记。

**改进方向。** 从允许来源重建几何基线，区分细胞内状态变化、类型比例和采样范围。用时间跨度匹配的外推窗评价，优先解决空间增长与 RNA–位置绑定，再研究更长时距。P3 获权后的 E10.5 可以提供直接的观察过程和外推校准。

```text
54.59 表达算子 experiments/T2-heart-extrap-20261025/operators_v2.py
原始构建       同级 build_round3_e105.py、round3_e105/
官方文件/回执  同级 delivery_r3_c050/
公开合法重建   同级 public_reset_v1/tubager_reconstruction_v1/
后续模型       experiments/T2-heart-extrap-top10-20261026/*_v1/
release 校准   同级 released_validation_calibration_v1/
```

## 七、T3

**问题是预测完整条件 KO 胚胎的细胞表达分布。** Gata4 条件实际为 `Mesp1-Cre; Gata4 F/F; Gata6 F/+`。T3 对 DE、方向和效应幅度的总权重为 80%，MMD 与 variogram 共 20%。空间坐标属于提交格式要求，当前排名指标使用表达。

早期从 Mab21l2 跨基因响应、稀疏 regulon、公开 KBB 重建开始，逐步转向真实 WT donor、类型匹配、阶段混合和心脏功能组成先验。

| 关键变化 | P2 官方结果 |
|---|---:|
| matched WT 与阶段/配额变化 | 70.16 → 71.16 → 72.10 |
| Hand2 来源的心场/心肌相对比例先验 | 72.58 |
| 相同先验强度 S200 | 73.03 |
| 心脏总量 C075 → C050 | 73.60 → **73.78** |
| 更低 C0375 | 73.44 |
| 小范围 GP、regulon、FWL | 约 73.74–73.78 的平台 |
| 神经 EC、CM、联合响应 | 71.96、72.16、70.48 |
| 全局 graft / D100 等大幅替换 | 约 43.83–46.87 |

C050 使用 6,000 个唯一真实 WT donor，含 2,100 个 E8.75 和 3,900 个 E9.5 细胞。在 S200 父预测上，把晚阶段心场与心肌总数由 1,074 降为 537，维持内部比例，并向其他晚阶段类型分配空出的名额。每个细胞带着原始 RNA 和坐标进入预测，随后执行已有的 Gata4 处理和表达归一化。

它的 severity skill 为 94.6，对总分贡献约 23.65。官方 C075/C050/C0375/C125 的配对结果说明，细胞组成和整体响应幅度是这条路线的主要有效因素。当前证据仍不足以把这个最优细胞配额解释为真实 KO 组成。

**P2 迁移结论。** Hand2 的粗功能相对先验和 C050 的具体组成都有 Gata4 正式收益。细胞来源、响应方向与剂量的跨基因转移属于模型假设，多个更精细模型未提高正式分数。β-catenin 的专用响应需要独立建立。

**改进方向。** 联合刻画细胞组成与类型内响应，利用真实扰动来源验证效应方向和幅度，处理 Mesp1 谱系范围和非细胞自主效应。Gata4 官方 release 可用于机制和读出校准。T3 专项评估器已有 signed-log severity 的正确聚合，通用 release 入口仍继承旧实现。11 月 11 日专项检查已复现该问题，并列出修复与历史对账顺序。[评分器专项复盘](/home/biocosmosx/work/virtualembryo_cym/team/scorer_review_20261111/REPORT_ZH.md)

```text
matched WT 起点 experiments/T3-push70-20261021/post_response_locked_20261023/
Hand2 相对先验  experiments/T3-push80-20261023/cardiac_maturation_prior_v1/
S200            同级 cardiac_prior_strength_r2/
C050 最佳构建   experiments/T3-push80-20261024/cardiac_total_v2/build.py
实际日志/供体表 同级 build.log、audit.log、build/*SOURCE_MAP.csv
后续响应/图模型 experiments/T3-top10-20261026/
评分纠正        同级 released_validation_evaluator_v1/
交付事故复盘    同级 T3_GENERIC_UPLOAD_FAILURE_AUDIT_20261027.md
```

## 八、共享研究路线

目录中的视觉和整表模型也有实际训练。`embryo_vision` 把单细胞表达排成基因图像，`embryo_table_state` 把一张生物快照编码成一个全局 state，`embryo_table_supervised` 加入类型、年龄和程序监督，并训练联合生成器。

T2 的 A/B/C 三路线分别探索组织空间关系、功能程序和观察过程。统一复核中，A/B 的代表方法略低于各自最强对照，C 的小幅均值增益跨训练 seed 变号。它们贡献了表示与测量诊断，完整整表动态和联合生成仍是下一层问题。具体方法、完整日志入口和实现与名称的差异已展开到 agent 版。[三路线复核](/home/biocosmosx/work/virtualembryo_cym/experiments/t2_three_route_review_20261024/REVIEW.md)

## 九、跨任务经验和下一阶段重点

1. **完整配方消融要贯穿迭代。** T1 删除 shape 步骤有明显收益，T3 配额消融解释了主要改善，T2 的几何/表达二乘二比较揭示了局部优化的代价。
2. **观测过程需要进入模型设计。** 细胞类型比例受到采样范围、组织切片和检测过程影响，跨研究比例不能直接当目标生长率。真实整细胞状态能保留稀疏性与联合结构。
3. **本地分数的迁移尺度尚未校准。** 胚胎几何本地 +1.6–2.0 只对应 P2 +0.03，心脏多项本地赢家正式下降。对重复使用的开发窗，应记录选择次数、来源和对照。
4. **表达与空间绑定需要一起评价。** T2 邻域项占 25%，只看边际 RNA 或 D2 容易选出最终退步的方案。跨时期局部坐标需要独立的注册或不依赖坐标朝向的机制。
5. **来源与交付也是成绩可信度的一部分。** 外推尺度祖先审计、T3 同名错传、失败校验仍打印成功、重复 TIGON 提交，都说明需要用确切文件、代码、输入和官方回执关联结果。
6. **研究数量要转化为可检验的新信息。** 真实谱系、bulk count、splicing、CellOT 和图模型已积累大量负例，后续应由尚未解决的观测或预测问题驱动。

全项目的宏观顺序为核对账号访问与剩余额度，接入官方 validation，统一复评主要配方，生成四个 test 专用预测，再按增益与成本安排每板两次正式机会。T1/T3 每提高一分对总分贡献一分，单个 T2 板贡献半分，最终重点仍由可靠的 validation 改善决定。

## 十、如何查原始材料

| 需要查看 | 文件 |
|---|---|
| 五个最佳文件的完整地址和 SHA | [最佳文件登记](/home/biocosmosx/work/virtualembryo_cym/team/inventory/20261110/SCOREBOARD.json) |
| 本轮五文件重新生成及逐字节验证 | [复现结果](/home/biocosmosx/work/virtualembryo_cym/team/handbook_20261111/reproduction/run_20261111/REPLAY_ALL.json) |
| 主要构建链的 212 个依赖及 82 项代码/检查点哈希核对 | [依赖核对](/home/biocosmosx/work/virtualembryo_cym/team/handbook_20261111/evidence/DEPENDENCY_METADATA.json) |
| 91 条官方结果及算术核对 | [完整结果 JSON](/home/biocosmosx/work/virtualembryo_cym/team/handbook_20261111/evidence/OFFICIAL_RESULTS.json) |
| 所有扫描到的文件地址 | [ALL_PATHS.tsv.gz](/home/biocosmosx/work/virtualembryo_cym/team/handbook_20261111/inventory/ALL_PATHS.tsv.gz) |
| 报告、日志、代码检索 | [DOCUMENT_INDEX.tsv.gz](/home/biocosmosx/work/virtualembryo_cym/team/handbook_20261111/inventory/DOCUMENT_INDEX.tsv.gz) |
| 2,248 个实验目录的脚本、协议和日志入口 | [STRATEGY_DIRECTORIES.jsonl.gz](/home/biocosmosx/work/virtualembryo_cym/team/handbook_20261111/inventory/STRATEGY_DIRECTORIES.jsonl.gz) |
| 当前文件冲突与过期状态 | [状态核对表](/home/biocosmosx/work/virtualembryo_cym/team/STATE_RECONCILIATION.md) |

扫描覆盖已识别工程、D 盘归档、下载目录匹配项、临时目录匹配项和补充识别的散落脚本。具体检索范围与排除目录记录在扫描回执中，单个历史实验的科学结论以原协议、结果和官方反馈共同解释。
