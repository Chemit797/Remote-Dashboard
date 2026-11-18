# 官方数据分析复现说明

## 输入与保存位置

本轮使用 9 份官方训练 H5AD 和 6 份从已解锁的 [validation answers 页面](https://virtualembryo.ai/challenge/data#validation-answers) 下载的真值。原始数据只在 `5090server` 的 WSL Ubuntu-22.04 上读取。训练文件位于 `/home/biocosmosx/work/virtualembryo_cym/data/`；验证真值位于：

`/home/biocosmosx/work/virtualembryo_cym/official_data_analysis_20261114/raw_validation_release_v1/`

该目录下按 `T1/`、`T2/`、`T3/` 分组，六个相对路径和本轮 SHA-256 见 `evidence/VALIDATION_RELEASE_AUDIT.json` 与 `MANIFEST.json`。这是认证下载后的自记指纹，不冒称官网公布的校验值。远端派生模型诊断位于同级 `derived/model_diagnostics/`；原始 H5AD 没有复制进本地交付目录。

训练文件的发布字节数与 SHA-256 为 9/9 匹配。15 份文件的大小、基因/细胞轴哈希、字段、样本身份与表达尺度见 `tables/file_inventory.csv`、`evidence/TRAIN_AUDIT_RAW.json`、`evidence/VALIDATION_AUDIT_RAW.json`；空间全层审计分别见 `evidence/SPATIAL_AUDIT_RAW.json` 和 `evidence/VALIDATION_SPATIAL_AUDIT_RAW.json`。方案冻结、字段驱动调整和来源分别见 `evidence/FROZEN_ANALYSIS.json`、`evidence/DEVIATIONS.json`、`evidence/SOURCES.json`。

## 软件与尺度

本地用 `D:\anaconda3\python.exe`、远端用 `/home/biocosmosx/miniconda3/envs/model_py310/bin/python`。具体本地包版本写入 `MANIFEST.json`。分析主尺度为发布的 `log1p(CP10k)`；`expm1(X)` 仅为线性相对归一化表达，不能当作原始 RNA 分子数。每期一份标本或不可拆分混样池，细胞与切片不是独立生物学重复。Gata4 两份 KO 为两个独立胚胎，但共享 WT 只有一份且运行批次不交叉。

## 从审计重建交付

在 `C:\Users\xzk28\Documents\ChatGPT\VEC local 2` 打开 PowerShell。以下命令只读取已保存的本地审计 JSON 和表，生成本地派生结果，不下载原始数据：

```powershell
$analysisPy = 'D:\anaconda3\python.exe'
$dir = '.\official_data_analysis_20261114\src'
& $analysisPy "$dir\build_tables.py"
& $analysisPy "$dir\build_spatial_tables.py"
& $analysisPy "$dir\analyze_tables.py"
& $analysisPy "$dir\temporal_ko_analysis.py"
& $analysisPy "$dir\summarize_validation.py"
& $analysisPy "$dir\audit_score_panels.py"
& $analysisPy "$dir\summarize_model_validation.py"
& $analysisPy "$dir\build_evidence.py"
& $analysisPy "$dir\make_figures.py"
& $analysisPy "$dir\make_validation_figures.py"
& $analysisPy "$dir\build_report.py"
& $analysisPy "$dir\validate_delivery.py"
& $analysisPy "$dir\build_manifest.py"
& $analysisPy "$dir\qa_browser.py"
& $analysisPy "$dir\build_manifest.py"
```

GO 富集表由 `src/panel_functional.py` 从 `evidence/MOUSE-mod.gaf.gz`、`evidence/go-basic.obo` 重建；该步骤含 1,000 个表达/检出匹配面板，可单独复跑。确切源版本与哈希见 `evidence/PANEL_GO_METHOD.json`。

官方评分轴快照在 `evidence/official_panels_p2/`，原快照保存在服务器项目的 `reproduction_20261020/evidence/official_panels_p2/`。`src/audit_score_panels.py` 校验每个有序基因轴的数量、唯一性和官网索引给出的 SHA-256 前缀，再检查六组预测、真值与参考文件的评分基因完整性。E7.5 官方评分轴为 498 基因，真值另外观察 `Casp4`、`Pnliprp1`；这两列不参与该榜评分，不能叫预测漏列。证据在 `evidence/SCORE_PANEL_AUDIT.json` 与 `tables/score_gene_mask.csv`。新增的跨模态时期方向和 Gata4 WT 方向投影由 `src/temporal_ko_analysis.py` 生成，只是解锁真值后的探索性描述。

远端重新读取验证 H5AD 时，使用 `run_remote.ps1` 将 `src/audit_remote.py` 和 `src/spatial_remote.py` 分别以验证原始目录作参数运行，并将标准输出保存为 `VALIDATION_AUDIT_RAW.json` 与 `VALIDATION_SPATIAL_AUDIT_RAW.json`。`src/model_cases_validation.json` 指定六个诊断配对；`src/model_diagnostics_remote.py` 在远端只读加载预测、真值和参考文件，将诊断表写入远端 `derived/model_diagnostics/`，再把 JSON/CSV 派生表复制到本地 `evidence/model_diagnostics/` 与 `tables/`。固定抽样种子为 0、17、43，每个角色最多 700 细胞；它们只是数值敏感性，不是胚胎重复或新官方成绩。

## 验收

`src/validate_delivery.py` 检查 15 文件覆盖、17 个问题、代数加和、图表和假说台账；`src/qa_browser.py` 用本机无头 Chrome 实际打开离线 `report.html`，核对图、链接、导航、筛选和桌面/手机布局，截图与记录保存在 `evidence/QA_*`。`MANIFEST.json` 逐项给出输入与输出哈希。

已解锁的 validation 答案是开发数据。使用它发现、选择或校正模型后，独立泛化只能在新胚胎或隐藏 P3 测试中判断；真值辅助诊断不可当成可部署收益。
