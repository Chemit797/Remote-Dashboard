# H200 评分器 v5 · 远端快照

**采集时间：2026-11-03T19:21:33+08:00（北京时间）**

**[打开完整看板](https://chemit797.github.io/Remote-Dashboard/)** · [精简原始数据](snapshot.json)

每15分钟采集并上传；网页每分钟检查已上传的新快照。超过35分钟未更新，网页标为过期。刷新网页不会直接查询H200。同步失败保留上次成功版本，可按上述时间判断。

登记策略 93 个，独立归档 8 个；采集时进程记录 16 条（生成 11、评分 1）。

## 当前轮次

| 轮次 | 生成 | GREEN | 已评 | 成绩单 | 状态文件时间 |
|---|---:|---:|---:|---:|---|
| 对照噪声 DN3 | 30/30 | 30/30 | 30/30 | 3/3 | 2026-11-02T18:28:00+08:00 |
| 机制证据 pilot | 12/20 | 11/20 | 11/20 | 1/2 | 2026-11-02T18:08:41+08:00 |
| 软机制证据 SE 四方案 | 40/40 | 40/40 | 40/40 | 4/4 | 2026-11-03T12:13:26.831464+08:00 |
| 公开仓库来源融合 C01/C02 | 20/20 | 20/20 | 20/20 | 2/2 | 2026-11-03T09:11:12+08:00 |
| 公开仓库控制轴 C06/C07 | 20/20 | 20/20 | 20/20 | 2/2 | 2026-11-03T10:20:05+08:00 |
| public_repo_trials_E20261103_010 | 7/10 | 7/10 | 7/10 | 0/1 | 2026-11-03T19:19:57.836985+08:00 |
| public_repo_trials_E20261103_026 | 3/10 | 2/10 | 2/10 | 0/1 | 2026-11-03T19:01:47.277019+08:00 |
| public_repo_trials_E20261103_027 | 0/10 | 0/10 | 0/10 | 0/1 | 2026-11-03T19:17:44.429962+08:00 |

## 今日新增与核对（北京时间）

2026-11-03：预测 **235** 份，GREEN 221，RED 5，未盖章 9；实际评分 **217** 份（含已替代旧测量 0 份）；完整成绩单 **20** 份。

新成绩单：PR26_C01_v01、PR26_C02_v01、PR26_C06_v01、PR26_C07_v01、SE_fad805c229_D、SE_fad805c229_J、SE_fad805c229_JM、SE_fad805c229_S、SP26_S001_v01、SP26_S002_v01、SP26_S003_v01、SP26_S004_v01、SP26_S005_v01、SP26_S006_v01、SP26_S007_v01、SP26_S009_v01、XZK26_S007_v02、XZK26_S008_v03、XZK26_S009_v04、XZK26_S010_v02。

北京时间当日预测、印记与实际评分记录；保留已替代和停止分支，旧测量另注明。P正式包、连续值预检和分析不计入原生评分。

- 软机制证据 SE 四方案：成绩单与GREEN封存已齐

- 公开仓库来源融合 C01/C02：成绩单与GREEN封存已齐

- 公开仓库控制轴 C06/C07：成绩单与GREEN封存已齐

- public_repo_trials_E20261103_010：等待资源/下一轮：existing batch workers/finalizer active: [947181, 947182, 947199, 984289]；existing batch workers/finalizer active: [947181, 947182, 947199, 984289]

- public_repo_trials_E20261103_026：已停止，需重启；RuntimeError('{"created_bjt": "2026-11-03T19:01:46+08:00", "total": 10, "generated": 3, "green": 2, "scored": 2, "positions": [{"strategy_id": "PR26_C09_v01", "fold": "F1", "seed": 0, "generated": false, "green": false, "scored": false, "running": true}, {"strategy_id": "PR26_C09_v01", "fold": "F1", "seed": 1, "generated": true, "green": false, "scored": false, "running": true, "attempt": "run/strategies/PR26_C09_v01/03_runs/F1/seed1/attempt_2026-11-03T103052_0000_278ec3c0"}, {"strategy_id": "PR26_C09_v01", "fold": "F2", "seed": 0, "generated": true, "green": true, "scored": true, "running": false, "attempt": "run/strategies/PR26_C09_v01/03_runs/F2/seed0/attempt_2026-11-03T103602_0000_00eecb57"}, {"strategy_id": "PR26_C09_v01", "fold": "F2", "seed": 1, "generated": true, "green": true, "scored": true, "running": false, "attempt": "run/strategies/PR26_C09_v01/03_runs/F2/seed1/attempt_2026-11-03T103603_0000_929267c3"}, {"strategy_id": "PR26_C09_v01", "fold": "F3", "seed": 0, "generated": false, "green": false, "scored": false, "running": false}, {"strategy_id": "PR26_C09_v01", "fold": "F3", "seed": 1, "generated": false, "green": false, "scored": false, "running": true}, {"strategy_id": "PR26_C09_v01", "fold": "F5", "seed": 0, "generated": false, "green": false, "scored": false, "running": false}, {"strategy_id": "PR26_C09_v01", "fold": "F5", "seed": 1, "generated": false, "green": false, "scored": false, "running": false}, {"strategy_id": "PR26_C09_v01", "fold": "F6", "seed": 0, "generated": false, "green": false, "scored": false, "running": false}, {"strategy_id": "PR26_C09_v01", "fold": "F6", "seed": 1, "generated": false, "green": false, "scored": false, "running": false}], "actions": [{"kind": "generation", "case": {"strategy_id": "PR26_C09_v01", "fold": "F5", "seed": 0}, "launch": {"pid": 970269, "argv": ["work/.venv/bin/python", "run/tools/resource_policy_exec_v1.py", "run/tools/round2_generate_worker.py", "PR26_C09_v01", "F5", "0"], "log": "run/logs/round2_publicrepo_E20261103_026_PR26_C09_v01_F5_s0/1793703706354587179.log", "started_epoch": 1793703706.3563282, "operational_resource_policy": "run/RESOURCE_POLICY_v1.json", "start_ticks": 828771742}}, {"kind": "generation", "case": {"strategy_id": "PR26_C09_v01", "fold": "F5", "seed": 1}, "launch": {"pid": 970335, "argv": ["work/.venv/bin/python", "run/tools/resource_policy_exec_v1.py", "run/tools/round2_generate_worker.py", "PR26_C09_v01", "F5", "1"], "log": "run/logs/round2_publicrepo_E20261103_026_PR26_C09_v01_F5_s1/1793703706545306195.log", "started_epoch": 1793703706.5467072, "operational_resource_policy": "run/RESOURCE_POLICY_v1.json", "start_ticks": 828771761}}], "errors": [{"case": {"strategy_id": "PR26_C09_v01", "fold": "F3", "seed": 0}, "phase": "generation", "reason": "prior ended without CURRENT; inspect original log", "logs": ["run/logs/round2_publicrepo_E20261103_026_PR26_C09_v01_F3_s0/1793702774453013613.log"]}], "status": "failed_retained"}')

- public_repo_trials_E20261103_027：等待资源/下一轮：shared generation slots 12 >= 12；shared generation slots 12 >= 12

## 今日实验、预检与分析记录

| 记录 | 类型 | 状态 | 更新时间 |
|---|---|---|---|
| 2026-11-02/mechanism_soft_evidence | experiment | completed | 11-03 12:13 |
| 2026-11-02/evidence_l45_iteration | analysis | running | 11-03 00:17 |

## 采集时正在运行

| 任务 | 类别 | 已运行（秒） |
|---|---|---:|
| 生成 · PR26_C08_v01 F1/seed0 | generate | 3248 |
| 生成 · PR26_C08_v01 F1/seed1 | generate | 3248 |
| 生成 · PR26_C08_v01 F5/seed0 | generate | 3247 |
| 生成 · SP26_S010_v01 F1/seed0 | generate | 1437 |
| 生成 · SP26_S010_v01 F1/seed1 | generate | 1437 |
| 生成 · SP26_S010_v01 F3/seed0 | generate | 823 |
| 生成 · SP26_S010_v01 F3/seed1 | generate | 822 |
| 生成 · SP26_S010_v01 F5/seed0 | generate | 822 |
| 生成 · SP26_S010_v01 F5/seed1 | generate | 822 |
| 生成 · PR26_C17_v01 F1/seed0 | generate | 233 |
| 生成 · PR26_C17_v01 F1/seed1 | generate | 233 |
| 评分 · SP26_S010_v01 F2/seed1 | score | 201 |
| 管线状态刷新 · board_refresh_resource_v4 | status | 251971 |
| 调度/收尾 · task_io_v1 | controller | 3254 |
| 调度/收尾 · task_io_v1 | controller | 1441 |
| 调度/收尾 · task_io_v1 | controller | 239 |

<details>
<summary>全部样本状态与成绩摘要（展开）</summary>

| 编号 | 策略 | 状态 | GREEN | 已评 | F1–F3均分 | 原成绩单判读 |
|---|---|---|---:|---:|---:|---|
| 工程-01 | TRIAL_F250_r1 | 待派发（当前无活进程） | 4/10 | 4/10 | — | 工程测试 |
| V5-01 | F250_v1 | 已由 F250_v2 接续 | 31/30 | 27/30 | 0.210796 | 已换成 V5-04 |
| 工程-02 | PROBE_leak_probe | 待派发（当前无活进程） | 0/1 | 0/1 | — | 工程测试 |
| 工程-03 | PROBE_derived_probe | 待派发（当前无活进程） | 0/1 | 0/1 | — | 工程测试 |
| 工程-04 | PROBE_subproc_probe | 待派发（当前无活进程） | 0/1 | 0/1 | — | 工程测试 |
| 工程-05 | PROBE_net_probe | 待派发（当前无活进程） | 0/1 | 0/1 | — | 工程测试 |
| V5-02 | NULL_control | 成绩单已齐 | 5/5 | 5/5 | -0.218933 | 对照组 |
| V5-03 | NULL_shuffle | 已由 NULL_shuffle_v2 接续 | 6/6 | 6/6 | -0.010538 | 已换成 V5-05 |
| 工程-06 | PROBE_T12_resume | 待派发（当前无活进程） | 1/1 | 0/1 | — | 工程测试 |
| 工程-07 | PROBE_T4_repeat | 已由 PROBE_T4_repeat_v2 接续 | 1/1 | 0/1 | — | 工程测试 |
| V5-04 | F250_v2 | 成绩单已齐 | 26/25 | 25/25 | 0.210837 | 父本 |
| V5-05 | NULL_shuffle_v2 | 成绩单已齐 | 5/5 | 5/5 | -0.010534 | 对照组 |
| 工程-08 | PROBE_T4_repeat_v2 | 待派发（当前无活进程） | 1/1 | 0/1 | — | 工程测试 |
| V5-06 | B1 | 成绩单已齐 | 10/10 | 10/10 | 0.166528 | 参照 |
| V5-07 | B2 | 成绩单已齐 | 10/10 | 10/10 | 0.184562 | 参照 |
| V5-08 | B3 | 成绩单已齐 | 10/10 | 10/10 | 0.205517 | 参照 |
| V5-09 | B5 | 成绩单已齐 | 10/10 | 10/10 | 0.093737 | 参照 |
| V5-10 | P2-T | 成绩单已齐 | 10/10 | 10/10 | 0.213390 | 否决 |
| 工程-09 | AUDIT_round2_P2_P | 待派发（当前无活进程） | 0/5 | 0/5 | — | 工程测试 |
| 工程-10 | PROBE_round2_B_F3 | 待派发（当前无活进程） | 1/5 | 0/5 | — | 工程测试 |
| V5-11 | E_cd4rest_sc | 成绩单已齐 | 11/10 | 10/10 | 0.208712 | 不确定 |
| 工程-11 | PROBE_round2_A_identity_F2 | 待派发（当前无活进程） | 1/5 | 0/5 | — | 工程测试 |
| 工程-12 | AUDIT_round2_A_energy_F2 | 待派发（当前无活进程） | 0/5 | 0/5 | — | 工程测试 |
| 工程-13 | AUDIT_round2_C_K562 | 待派发（当前无活进程） | 0/5 | 0/5 | — | 工程测试 |
| 工程-14 | AUDIT_round2_C_HCT116 | 待派发（当前无活进程） | 0/5 | 0/5 | — | 工程测试 |
| 工程-15 | AUDIT_round2_C_HEK293T | 待派发（当前无活进程） | 0/5 | 0/5 | — | 工程测试 |
| 工程-16 | AUDIT_round2_C_H1 | 待派发（当前无活进程） | 0/5 | 0/5 | — | 工程测试 |
| 工程-17 | PROBE_round2_C_null | 待派发（当前无活进程） | 0/5 | 0/5 | — | 工程测试 |
| 工程-18 | AUDIT_round2_C_revert_F3 | 待派发（当前无活进程） | 0/5 | 0/5 | — | 工程测试 |
| 工程-19 | PROBE_round2_B_g1_F3 | 待派发（当前无活进程） | 1/5 | 0/5 | — | 工程测试 |
| 工程-20 | AUDIT_round2_B_rebuild_F3 | 待派发（当前无活进程） | 0/5 | 0/5 | — | 工程测试 |
| V5-12 | P2B_keepshare | 成绩单已齐 | 11/10 | 10/10 | 0.214893 | 否决 |
| 工程-21 | AUDIT_round2_B_rebuild_F6 | 待派发（当前无活进程） | 0/5 | 0/5 | — | 工程测试 |
| 工程-22 | AUDIT_round2_B_rebuild_F2 | 待派发（当前无活进程） | 0/5 | 0/5 | — | 工程测试 |
| 工程-23 | AUDIT_round2_B_rebuild_F5 | 待派发（当前无活进程） | 0/5 | 0/5 | — | 工程测试 |
| 工程-24 | AUDIT_round2_B_rebuild_F1 | 待派发（当前无活进程） | 0/5 | 0/5 | — | 工程测试 |
| V5-13 | P2A_cd4tilt | 成绩单已齐 | 10/10 | 10/10 | 0.210347 | 采用 |
| V5-14 | M_pdsc_010_050_040_005 | 重复支线已封存 | 10/10 | 10/10 | 0.209865 | 不确定 |
| V5-15 | M_pdsu_010_050_040_030 | 重复支线已封存 | 10/10 | 10/10 | 0.209765 | 不确定 |
| 工程-25 | PROBE_M_REF | 待派发（当前无活进程） | 1/5 | 0/5 | — | 工程测试 |
| V5-16 | M_pdsuc_010_025_040_015_005 | 已停止重复计算 | 10/10 | 8/10 | 盲评中 | 已停止重复计算 |
| V5-17 | M_pdsuc_010_050_040_030_005 | 重复支线已封存 | 10/10 | 10/10 | 0.209598 | 不确定 |
| V5-18 | M_ps_005_040 | 已停止重复计算 | 8/10 | 0/10 | 盲评中 | 已停止重复计算 |
| V5-19 | M_ps_010_030 | 已停止重复计算 | 0/10 | 0/10 | 盲评中 | 已停止重复计算 |
| V5-20 | M_ps_010_060 | 已停止重复计算 | 0/10 | 0/10 | 盲评中 | 已停止重复计算 |
| V5-21 | M_ps_015_040 | 已停止重复计算 | 0/10 | 0/10 | 盲评中 | 已停止重复计算 |
| 归档-01 | MSB_pdsu_010_050_040_030 | 成绩单已齐 | 10/10 | 10/10 | 0.209733 | 不确定 |
| 归档-02 | MSB_pdsc_010_050_040_005 | 成绩单已齐 | 10/10 | 10/10 | 0.209833 | 不确定 |
| 归档-03 | MSB_pdsuc_010_050_040_030_005 | 成绩单已齐 | 10/10 | 10/10 | 0.209565 | 不确定 |
| 归档-04 | MSB_pdsuc_010_025_040_015_005 | 成绩单已齐 | 10/10 | 10/10 | 0.209775 | 不确定 |
| 归档-05 | MSB_ps_005_040 | 成绩单已齐 | 10/10 | 10/10 | 0.210418 | 不确定 |
| 归档-06 | MSB_ps_015_040 | 成绩单已齐 | 10/10 | 10/10 | 0.209937 | 不确定 |
| 归档-07 | MSB_ps_010_030 | 成绩单已齐 | 10/10 | 10/10 | 0.210328 | 不确定 |
| 归档-08 | MSB_ps_010_060 | 成绩单已齐 | 10/10 | 10/10 | 0.210540 | 不确定 |
| V5-22 | DN3_NTC_GENE | 成绩单已齐 | 10/10 | 10/10 | 0.219273 | 不确定 |
| V5-23 | DN3_NTC_SHAPE | 成绩单已齐 | 10/10 | 10/10 | 0.217398 | 否决 |
| V5-24 | DN3_NTC_TARGET | 成绩单已齐 | 10/10 | 10/10 | 0.208824 | 否决 |
| V5-25 | EVP_A | 已由 EVP4_A 接续 | 0/10 | 0/10 | 盲评中 | 已换成 V5-34 |
| V5-26 | EVP_B1 | 已由 EVP3_B1 接续 | 0/10 | 0/10 | 盲评中 | 已换成 V5-32 |
| V5-27 | EVP_B2 | 已由 EVP4_B2 接续 | 0/10 | 0/10 | 盲评中 | 已换成 V5-35 |
| V5-28 | EVP2_A | 已由 EVP4_A 接续 | 0/10 | 0/10 | 盲评中 | 已换成 V5-34 |
| V5-29 | EVP2_B1 | 已由 EVP3_B1 接续 | 0/10 | 0/10 | 盲评中 | 已换成 V5-32 |
| V5-30 | EVP2_B2 | 已由 EVP4_B2 接续 | 0/10 | 0/10 | 盲评中 | 已换成 V5-35 |
| V5-31 | EVP3_A | 已由 EVP4_A 接续 | 0/10 | 0/10 | 盲评中 | 已换成 V5-34 |
| V5-32 | EVP3_B1 | 解析零更新，按计划不运行 | 0/10 | 0/10 | 盲评中 | 解析零更新，按计划不运行 |
| V5-33 | EVP3_B2 | 已由 EVP4_B2 接续 | 3/10 | 2/10 | 盲评中 | 已换成 V5-35 |
| V5-34 | EVP4_A | 用户已停止剩余任务（保留已有测量） | 1/10 | 1/10 | 盲评中 | 用户已停止剩余任务（保留已有测量） |
| V5-35 | EVP4_B2 | 成绩单已齐 | 10/10 | 10/10 | 0.210053 | 不确定 |
| V5-36 | SE_fad805c229_D | 成绩单已齐 | 10/10 | 10/10 | 0.201490 | 否决 |
| V5-37 | SE_fad805c229_J | 成绩单已齐 | 10/10 | 10/10 | 0.200531 | 否决 |
| V5-38 | SE_fad805c229_JM | 成绩单已齐 | 10/10 | 10/10 | 0.212847 | 不确定 |
| V5-39 | SE_fad805c229_S | 成绩单已齐 | 10/10 | 10/10 | 0.210661 | 不确定 |
| V5-40 | PR26_C01_v01 | 成绩单已齐 | 10/10 | 10/10 | 0.210103 | 不确定 |
| V5-41 | PR26_C02_v01 | 成绩单已齐 | 10/10 | 10/10 | 0.210056 | 不确定 |
| V5-42 | PR26_C06_v01 | 成绩单已齐 | 10/10 | 10/10 | 0.191791 | 否决 |
| V5-43 | PR26_C07_v01 | 成绩单已齐 | 10/10 | 10/10 | 0.210689 | 否决 |
| 工程-26 | PERMLOCK_probe_20261103 | 待派发（当前无活进程） | 1/5 | 1/5 | — | 工程测试 |
| V5-44 | SP26_S001_v01 | 成绩单已齐 | 10/10 | 10/10 | 0.207608 | 否决 |
| V5-45 | SP26_S002_v01 | 成绩单已齐 | 10/10 | 10/10 | 0.209561 | 不确定 |
| V5-46 | SP26_S003_v01 | 成绩单已齐 | 10/10 | 10/10 | 0.203801 | 否决 |
| V5-47 | SP26_S004_v01 | 成绩单已齐 | 10/10 | 10/10 | 0.209449 | 不确定 |
| V5-48 | SP26_S005_v01 | 成绩单已齐 | 10/10 | 10/10 | 0.208871 | 不确定 |
| V5-49 | SP26_S006_v01 | 成绩单已齐 | 10/10 | 10/10 | 0.208927 | 不确定 |
| V5-50 | XZK26_S007_v01 | 已由 XZK26_S007_v02 接续 | 0/10 | 0/10 | 盲评中 | 已换成 V5-56 |
| V5-51 | XZK26_S008_v01 | 已由 XZK26_S008_v03 接续 | 0/10 | 0/10 | 盲评中 | 已换成 V5-57 |
| V5-52 | XZK26_S009_v01 | 已由 XZK26_S009_v04 接续 | 0/10 | 0/10 | 盲评中 | 已换成 V5-60 |
| V5-53 | XZK26_S008_v02 | 已由 XZK26_S008_v03 接续 | 0/10 | 0/10 | 盲评中 | 已换成 V5-57 |
| V5-54 | XZK26_S010_v01 | 已由 XZK26_S010_v02 接续 | 0/10 | 0/10 | 盲评中 | 已换成 V5-59 |
| V5-55 | XZK26_S009_v02 | 已由 XZK26_S009_v04 接续 | 0/10 | 0/10 | 盲评中 | 已换成 V5-60 |
| V5-56 | XZK26_S007_v02 | 成绩单已齐 | 10/10 | 10/10 | 0.210838 | 不确定 |
| V5-57 | XZK26_S008_v03 | 成绩单已齐 | 10/10 | 10/10 | 0.210325 | 不确定 |
| V5-58 | XZK26_S009_v03 | 已由 XZK26_S009_v04 接续 | 0/10 | 0/10 | 盲评中 | 已换成 V5-60 |
| V5-59 | XZK26_S010_v02 | 成绩单已齐 | 10/10 | 10/10 | 0.191521 | 否决 |
| V5-60 | XZK26_S009_v04 | 成绩单已齐 | 10/10 | 10/10 | 0.212288 | 不确定 |
| V5-61 | SP26_S007_v01 | 成绩单已齐 | 10/10 | 10/10 | 0.210496 | 不确定 |
| V5-62 | SP26_S008_v01 | 待派发（当前无活进程） | 7/10 | 4/10 | 盲评中 | 待派发（当前无活进程） |
| V5-63 | SP26_S009_v01 | 成绩单已齐 | 10/10 | 10/10 | 0.206649 | 否决 |
| V5-64 | PR26_C08_v01 | 生成中 | 7/10 | 7/10 | 盲评中 | 生成中 |
| V5-65 | PR26_C09_v01 | 已停止，需重启：RuntimeError('{"created_bjt": "2026-11-03T19:01:46+08:00", "total": 10, "generated": 3, "green": 2, "scored": 2, "positions": [{"strategy_id": "PR26_C09_v01", "fold": "F1", "seed": 0, "generated": false, "green": false, "scored": false, "running": true}, {"strategy_id": "PR26_C09_v01", "fold": "F1", "seed": 1, "generated": true, "green": false, "scored": false, "running": true, "attempt": "run/strategies/PR26_C09_v01/03_runs/F1/seed1/attempt_2026-11-03T103052_0000_278ec3c0"}, {"strategy_id": "PR26_C09_v01", "fold": "F2", "seed": 0, "generated": true, "green": true, "scored": true, "running": false, "attempt": "run/strategies/PR26_C09_v01/03_runs/F2/seed0/attempt_2026-11-03T103602_0000_00eecb57"}, {"strategy_id": "PR26_C09_v01", "fold": "F2", "seed": 1, "generated": true, "green": true, "scored": true, "running": false, "attempt": "run/strategies/PR26_C09_v01/03_runs/F2/seed1/attempt_2026-11-03T103603_0000_929267c3"}, {"strategy_id": "PR26_C09_v01", "fold": "F3", "seed": 0, "generated": false, "green": false, "scored": false, "running": false}, {"strategy_id": "PR26_C09_v01", "fold": "F3", "seed": 1, "generated": false, "green": false, "scored": false, "running": true}, {"strategy_id": "PR26_C09_v01", "fold": "F5", "seed": 0, "generated": false, "green": false, "scored": false, "running": false}, {"strategy_id": "PR26_C09_v01", "fold": "F5", "seed": 1, "generated": false, "green": false, "scored": false, "running": false}, {"strategy_id": "PR26_C09_v01", "fold": "F6", "seed": 0, "generated": false, "green": false, "scored": false, "running": false}, {"strategy_id": "PR26_C09_v01", "fold": "F6", "seed": 1, "generated": false, "green": false, "scored": false, "running": false}], "actions": [{"kind": "generation", "case": {"strategy_id": "PR26_C09_v01", "fold": "F5", "seed": 0}, "launch": {"pid": 970269, "argv": ["work/.venv/bin/python", "run/tools/resource_policy_exec_v1.py", "run/tools/round2_generate_worker.py", "PR26_C09_v01", "F5", "0"], "log": "run/logs/round2_publicrepo_E20261103_026_PR26_C09_v01_F5_s0/1793703706354587179.log", "started_epoch": 1793703706.3563282, "operational_resource_policy": "run/RESOURCE_POLICY_v1.json", "start_ticks": 828771742}}, {"kind": "generation", "case": {"strategy_id": "PR26_C09_v01", "fold": "F5", "seed": 1}, "launch": {"pid": 970335, "argv": ["work/.venv/bin/python", "run/tools/resource_policy_exec_v1.py", "run/tools/round2_generate_worker.py", "PR26_C09_v01", "F5", "1"], "log": "run/logs/round2_publicrepo_E20261103_026_PR26_C09_v01_F5_s1/1793703706545306195.log", "started_epoch": 1793703706.5467072, "operational_resource_policy": "run/RESOURCE_POLICY_v1.json", "start_ticks": 828771761}}], "errors": [{"case": {"strategy_id": "PR26_C09_v01", "fold": "F3", "seed": 0}, "phase": "generation", "reason": "prior ended without CURRENT; inspect original log", "logs": ["run/logs/round2_publicrepo_E20261103_026_PR26_C09_v01_F3_s0/1793702774453013613.log"]}], "status": "failed_retained"}') | 2/10 | 2/10 | 盲评中 | 已停止，需重启：RuntimeError('{"created_bjt": "2026-11-03T19:01:46+08:00", "total": 10, "generated": 3, "green": 2, "scored": 2, "positions": [{"strategy_id": "PR26_C09_v01", "fold": "F1", "seed": 0, "generated": false, "green": false, "scored": false, "running": true}, {"strategy_id": "PR26_C09_v01", "fold": "F1", "seed": 1, "generated": true, "green": false, "scored": false, "running": true, "attempt": "run/strategies/PR26_C09_v01/03_runs/F1/seed1/attempt_2026-11-03T103052_0000_278ec3c0"}, {"strategy_id": "PR26_C09_v01", "fold": "F2", "seed": 0, "generated": true, "green": true, "scored": true, "running": false, "attempt": "run/strategies/PR26_C09_v01/03_runs/F2/seed0/attempt_2026-11-03T103602_0000_00eecb57"}, {"strategy_id": "PR26_C09_v01", "fold": "F2", "seed": 1, "generated": true, "green": true, "scored": true, "running": false, "attempt": "run/strategies/PR26_C09_v01/03_runs/F2/seed1/attempt_2026-11-03T103603_0000_929267c3"}, {"strategy_id": "PR26_C09_v01", "fold": "F3", "seed": 0, "generated": false, "green": false, "scored": false, "running": false}, {"strategy_id": "PR26_C09_v01", "fold": "F3", "seed": 1, "generated": false, "green": false, "scored": false, "running": true}, {"strategy_id": "PR26_C09_v01", "fold": "F5", "seed": 0, "generated": false, "green": false, "scored": false, "running": false}, {"strategy_id": "PR26_C09_v01", "fold": "F5", "seed": 1, "generated": false, "green": false, "scored": false, "running": false}, {"strategy_id": "PR26_C09_v01", "fold": "F6", "seed": 0, "generated": false, "green": false, "scored": false, "running": false}, {"strategy_id": "PR26_C09_v01", "fold": "F6", "seed": 1, "generated": false, "green": false, "scored": false, "running": false}], "actions": [{"kind": "generation", "case": {"strategy_id": "PR26_C09_v01", "fold": "F5", "seed": 0}, "launch": {"pid": 970269, "argv": ["work/.venv/bin/python", "run/tools/resource_policy_exec_v1.py", "run/tools/round2_generate_worker.py", "PR26_C09_v01", "F5", "0"], "log": "run/logs/round2_publicrepo_E20261103_026_PR26_C09_v01_F5_s0/1793703706354587179.log", "started_epoch": 1793703706.3563282, "operational_resource_policy": "run/RESOURCE_POLICY_v1.json", "start_ticks": 828771742}}, {"kind": "generation", "case": {"strategy_id": "PR26_C09_v01", "fold": "F5", "seed": 1}, "launch": {"pid": 970335, "argv": ["work/.venv/bin/python", "run/tools/resource_policy_exec_v1.py", "run/tools/round2_generate_worker.py", "PR26_C09_v01", "F5", "1"], "log": "run/logs/round2_publicrepo_E20261103_026_PR26_C09_v01_F5_s1/1793703706545306195.log", "started_epoch": 1793703706.5467072, "operational_resource_policy": "run/RESOURCE_POLICY_v1.json", "start_ticks": 828771761}}], "errors": [{"case": {"strategy_id": "PR26_C09_v01", "fold": "F3", "seed": 0}, "phase": "generation", "reason": "prior ended without CURRENT; inspect original log", "logs": ["run/logs/round2_publicrepo_E20261103_026_PR26_C09_v01_F3_s0/1793702774453013613.log"]}], "status": "failed_retained"}') |
| V5-66 | SP26_S010_v01 | 评分中 | 4/10 | 3/10 | 盲评中 | 评分中 |
| V5-67 | PR26_C17_v01 | 生成中 | 0/10 | 0/10 | 盲评中 | 生成中 |

</details>

## 计划停止与读法

- C / P2C_ctrlnoise：计划停止：固定来源预检未过，不生成、不评分
- D / P2D_targetlevel：未运行；C开跑前自检未通过
- 候选未出自身成绩单前隐藏分数；MSB独立归档，不借分填写M支线进度。
- F4/THP-1保留历史但不计现行份数；F5/F6只看方向。正式采用以现行成绩单判读为准，箭头只是展示辅助。
- 本地三考场均分、两组平均、配对差d是不同口径；本页不替用户选择正式包，也不能提交。
- 完整看板保留六指标、逐折、逐种子、来源SHA、管线与考场读法。数字不做精度截断，完整值见JSON。
- 不公开原始预测、原始细胞数据、凭据、命令行或服务器文档；文档入口在远端只作说明。

**内网看板部署：** 修复版已部署。

采集版本：`20261103-native-batch-liveness-v3`；快照SHA256：`33918a01ce8fda28cee85e59e3e6ba20bcf89484182ba3eb6cac84813840bb73`。

定时更新由本次对话的Codex自动接续执行，需要运行Codex的电脑与H200网络可达；GitHub页面本身无需VPN。服务器或网络不可达时不会伪造新时间。
