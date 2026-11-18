# 勘误与运行偏差登记

2026-11-16，Asia/Shanghai。历史文件和初始冻结保留；以下更正不覆盖原始记录。

| ID | 旧说法或假设 | 更正与影响 | 证据 |
|---|---|---|---|
| E01 | 旧VALUE_SEMANTICS_AUDIT称E-MTAB early.h5ad为raw counts | 实际已有normalize_total/log1p；本轮改用原始MTX，避免重复归一化 | PROTOCOL输入核查、原始MTX投影与count校验 |
| E02 | 旧GSE278603来源表并列PRJNA810020 | 当前GEO/SOFT为PRJNA1168072；保留历史表，不改变实际矩阵身份 | provenance/current GEO快照及panel_provenance.md |
| E03 | PROTOCOL v1额外排除缺失celltype | 原作者QC只据doublet/stripped；缺失标签保留未映射。本轮QC后实际为0，未影响结果 | v2修订、external_filters.json |
| E04 | L007/L014仅检测到标志即可判一致的实现草案 | 弱化了激活/二维判定命题；启动前改为证据不足，标志检出只作诊断 | METHOD_REVIEW_K4.md、最终claim_checks |
| E05 | 四份官方layers/counts均是整数 | run01被E8.0非整数断言截停；run02将E8.0降为发布权重敏感性，计数主比较只有两个共同阶段 | job01_failed.json、matrix_semantics.json |
| E06 | 发布文件均符合当前“至少5个检出基因”说明 | E6.75/E7.25仍含448/749个低检出Unknown；保留主分母并给过滤敏感性 | official_qc_sensitivity.csv |
| E07 | run02输出模板把全部pair表示称counts，或省略E8.0 tier | E8.0不视为计数已确认；报告、SEMANTICS与supplement逐行补充，原CSV哈希保留 | 04_输入语义与缺口.md、supplement/ |
| E08 | run02 FREEZE布尔字段可能被读成v3协议全程盲法 | 只有34条知识首次冻结早于run01官方统计；v3输入语义修订发生于run01失败后 | run01/run02相同claims SHA、PROTOCOL时间顺序 |
| E09 | 网页用“等权混合样本平均比例变化”等计算项目名充当陈述，未直接说明发现 | 34条展示文案改为具体发现、官方观察和判断理由；已知细胞名译为中文，计算方法及原始标签放详情。冻结知识和数值判定不变 | [阅读版](00_逐条发现_易读版.md)、reading_guide.json、src/reader_copy.py |

run01没有进入全量映射。短时检查inspect_counts.sh第一次因exec不提供VEM_MODEL_PYTHON而报未绑定变量，改用已核实解释器后执行成功，没有数据写入。此前SCP因SFTP不可用失败，改用SSH stdin独占写入并校验SHA，没有盲目重复启动作业。所有正式作业ID唯一，失败结果没有删除。
