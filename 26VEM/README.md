# 26VEM · 虚拟胚胎研究工作台

[打开工作台](https://chemit797.github.io/Remote-Dashboard/26VEM/)

独立的 Virtual Embryo 比赛总览、数据与研究系统。该目录与仓库根部既有的 VCC/H200 看板分开维护，新增内容仅位于 `26VEM/`。

## 页面与数据

- 比赛总览：四个最终目标、官方阶段时间线、AoE及北京时间截止倒计时。
- [评分器](https://chemit797.github.io/Remote-Dashboard/26VEM/scorer/#/t1)：T1、T2A、T2B、T3 四个任务各一页。页面依次是基线对照、样本记录、在跑、最近动态、批次与口径；基线对照与样本记录两张表逐列对齐。代码在 VEM 项目 `ops/scorer_board/`，由 `tools/build_snapshot_page.py` 生成本目录的 `scorer/`。实时版在 5090：经 SSH 隧道打开 `http://127.0.0.1:18765/` 就是整个工作台，评分器在 `/scorer/`。这里的公开快照读取 `vem-board-feed` 分支，5090 每小时覆盖推送一次，只含分数、状态和口径；改了什么、逐种子明细、作业和日志只在实时版。旧的 `#/scorer…` 链接会转到新页面。
- 数据图谱：15 份官方文件与阶段轴、46 个外部来源的固定名称、取材、观测单位和适用范围。近期登记可展开逐样本条目。
- 分析专题：按官方数据、心脏、先验、来源比较、评分、工程历史分类；15个入口保留原网页的内容、图件、交互与章节。点标题阅读原页，点章节直接切入，也可单独打开原页。
- 同阶段对照：按T1、T2胚胎插值、心脏插值／外推、T3依次显示官方时间轴，各节点列同阶段整体表达ρ前八名；编号与固定名称可打开原配对明细。
- 先验知识：直接进入原108条知识网页，保留逐条官方与外部核对、查询与图谱。
- 5090文件：以工程手册式目录树展示工程与用途，计数放在目录树之后，可展开明细。
- 联合规划：18条核对、建议职责与有限实验工作卡。

研究专题和目录来自注明日期的快照。T1 评分页读取 5090 发布到 GitHub 的数据；断网仍能用随页副本。本机 T1 页还提供 5090 隧道入口。T2 网页使用已复核的随页快照。倒计时按设备时钟更新。刷新只读取已有结果。

官网时间线在2026-11-18核实为2026-11-25 23:59 AoE。按UTC−12换算为2026-11-26 11:59 UTC、19:59北京时间；同页另写12:00 UTC，两者相差一分钟，本工作台以较早的23:59精确换算计时。时间来源、核对方式与计时目标见 [时间来源](data/official-timeline-source.json)。官网日程若调整，需核原页并更新快照。

## 本地使用

无需安装前端依赖，也不调用外部脚本或字体。

```powershell
python -m http.server 8765 --bind 127.0.0.1
# 打开 http://127.0.0.1:8765/26VEM/
```

GitHub Pages 子路径与本地服务使用相同相对资源路径。Hash路由无需后端重写，也可以保留直达分析与知识的链接，例如 `#/analysis/A05` 和 `#/knowledge/L001`。

## 更新研究快照

T2 评分快照用 `python -X utf8 26VEM/scripts/build_t2_scorer.py --project D:/Project/virtualembryo_biocosmosX` 从指定的本地验收存档重建。换批次时核对脚本所用的存档版本和本机报告链接。公开资产只包含汇总数据与快照校验指纹。

`scripts/build_data.py` 从本地VEM项目中选定报告、CSV/JSON和来源登记构建静态阅读数据；不会执行这些分析代码、打开表达矩阵、下载模型或连接评测账号。构建依赖Python的 `markdown`、`beautifulsoup4`，浏览器端无依赖。

```powershell
python -X utf8 26VEM/scripts/build_data.py --project D:/Project/virtualembryo_biocosmosX
python -X utf8 26VEM/scripts/verify_site.py
node --check 26VEM/assets/app.js
```

首次构建或更新原网页时，先运行 `python -X utf8 26VEM/scripts/build_readers.py --project D:/Project/virtualembryo_biocosmosX`，再运行上面的构建与检查。它从本地已有研究与已核SHA的同事网页快照复制原页面和相对链接依赖；现有HTML逐字节保留，Markdown只加阅读外壳。来源及SHA见 `data/original-readers-manifest.json`，目录树原文见 `data/5090-tree.txt`。`readers/**` 禁用Git文本换行转换，以保留原文件身份。

更新同阶段排名时运行 `python -X utf8 26VEM/scripts/build_stage_rankings.py --project D:/Project/virtualembryo_biocosmosX`。它只整理A11已有的整体表达相关，不重算矩阵；配对、共同基因和来源SHA在 `data/stage-rankings.json`。每条以自己的共同实测基因为口径，供浏览排序；不同品系／重复分别保留，共用细胞的来源合并为一个既有对象。日龄错位、条件不匹配或未计算者不补分。入口为 `#/similarity`。

新增来源先在 VEM 的 `catalogs/external_dataset_names.json` 登记固定名称，再在 `catalogs/dashboard_external_releases.json` 增加经过验收的登记。已入库的样本清单进数据图谱。有匹配日龄与测量的来源按受影响任务补算，将快照追加到原专题并重建榜单。按胚胎等权汇总的来源在每个日龄列一行。历史图作为按日期可展开的快照。

2026-11-21 补全：VED-045 · Gata4 G295S 流出道瓣膜数据与 VED-046 · Gata4 缺失成体心脏数据已计算 30 项整体表达、15 项扰动变化比较，含官方两个 KO 重复及外部对照敏感性。结果在来源详情、A10 第 1/4/6 节、A13 的表达／变化／计算章节，并从同阶段对照页 T3 下方进入。组织样本使用聚合表达与变化向量，不作为单细胞 MMD/CSS 输入。可从 `readers/research/gata4_bulk_similarity_20261121/data/results.json` 下载完整结果、样本与输入 SHA。

2026-11-21 编号与时间轴更新：VED-044 · 小鼠胚胎谱系追踪图谱覆盖 E7.5–E10.0 的六个已验收日龄；新图在 `#/data/external` 默认显示，保留 T1、T2 胚胎、T2 心脏、T3 四块，共 84 条任务×来源行。SVG 名称和阶段点可点击，完整大图可下载为 SVG／PNG。新增来源使用目录的 `display_id`，原 `id`、数据库登录号、配对 ID 与文件路径继续用于溯源；旧 GSE 详情链接仍可访问。

时间轴输入由 `catalogs/dashboard_external_releases.json` 的 `display_updates.timeline` 指定，当前展示修订由 `display_updates.overlay` 提供，不覆盖旧证据。运行 `python -X utf8 26VEM/scripts/build_source_timelines.py --project D:/Project/virtualembryo_biocosmosX` 重建 SVG 和可下载元数据，再按原顺序构建 reader、数据和榜单。原始数值结果不因编号更新而重算。

构建时从明确的本地快照读取。新一轮研究需先选择、审读输入，再更新入口。原专题的问题、顺序、图件与交互应保留；分类和导航不代替原文。新结论应保留原ID、原失败记录与勘误，不仅替换看起来有利的数字。禁止把更新网站变成自动模型运行或官方提交。

文件计数当前来自5090唯一作业 `vem-dashboard-inventory-20261118-01`，只扫描主工程文件元数据；扫描期间文件可能变化，输出自身不计入本次快照。逻辑大小不是独占磁盘用量，也不包括通过软链接可访问的全机数据。更新时另用唯一采样ID，取回JSON并验证SHA，不创建循环SSH或无授权定时任务。

## 证据与边界

[来源清单](data/source-manifest.json)保存构建输入的路径、大小与SHA；[分析索引](data/research-catalog.json)、[官方文件摘要](data/official-inventory.json)、[文件计数](data/file-counts.json)可下载。

5090的完整共同阅读入口为 `/home/biocosmosx/work/virtualembryo_cym/team/research_hub/`。本网站按类别组织原专题入口；原始大矩阵、模型、预测、原共享包和完整实验继续保留原位。HTML原页与其可下载图表、结果保留相对链接，少数补充阅读摘要中的原内部文件链接显示为证据路径。

先验原数据复现不等于独立验证；同一官方标本多种分析不增加独立样本。邻域ΔR²来自同标本二维空间块留出，而公开NFS为三维15点含自身，不能互换。先验条目、统计候选、开发诊断与正式比赛收益分别记录。当前页面不会把236个邻域候选或108条知识解释为已经提分。

2026-11-21 来源时间轴为外部数据页主图；2026-11-13 原始图件保留在历史展开项中。逐来源的新固定名称、适用阶段、后续纠正可在统一详情中阅读。
