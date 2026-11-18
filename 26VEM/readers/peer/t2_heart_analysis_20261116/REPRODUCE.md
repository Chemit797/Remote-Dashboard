# 复现与验收边界

## 六问版报告（2026-11-16）

当前 report.html 与 REPORT_ZH.md 先以六个问题呈现原统计，再附新完成的 500 基因三轴分析。运行 `python src/reorganize_report.py` 可重建六问版，随后运行 `python src/gene_axes_report.py` 恢复基因章节及两组新图。原技术报告归档为 report_before_six_questions.html 与 REPORT_BEFORE_SIX_QUESTIONS.md。PRESENTATION_REVISION.json 记录基因章节加入前的六问版哈希；本次最终输出记录在 MANIFEST.json 与 GENE_AXES_REVISION.json。报告本身的浏览器实开验收仍受先前的 file:// URL 安全策略阻挡；交互总表已通过独立的本机浏览器检查。

输入仅为 config.json 中五份官方 H5AD。路径与 SHA-256 从旧清单提取，并在远端每样本计算前重新验证。未重新下载数据。输入只读；远端仅写 experiments/t2_heart_analysis_20261116/。PLAN_ZH.md、EXECUTION_PROMPT_ZH.md 和旧交付未修改。

## 计算

远端环境 /home/biocosmosx/miniconda3/envs/model_py310/bin/python，版本记录在 evidence/INPUT_AUDIT.json。OPENBLAS_NUM_THREADS=2、OMP_NUM_THREADS=2、PYTHONDONTWRITEBYTECODE=1。

1. 将 config.json、HYPOTHESES.json、src/analyze.py、src/supplement.py、src/label_mapping.py 放入独占远端目录的对应路径。
2. 运行 python src/analyze.py，再运行 python src/supplement.py。analyze 按 evidence/*.done.json 跳过完成样本；要重算须先归档对应完成标记。每个样本种子固定为 20261116 加输入顺序索引。
3. 只回传 tables/、evidence/、run.log、STATE.json，原始 H5AD 留在服务器。
4. 本地使用 D:/anaconda3/python.exe 依次执行 src/derive.py、src/report.py、src/verify.py。图使用 Microsoft YaHei；SVG 将字形转路径，离线不依赖远程字体。

代码 prepare.py 为本轮初始登记，非必须重跑；deploy.py 是本次执行辅助，会归档完成标记后启动重算，不应用于简单断点续跑。run_remote.ps1 在上一级目录。所有可视化结果表均在 tables/，all_ 前缀表示五时期合并。

## 500 基因三轴补充

初始三轴定义先记录在 GENE_AXES_SPEC.json；汇总时为 G3 加入“峰值空间块至少 50 个细胞”的保护条件，并把实际判据补记进同一文件。G1 的比较范围是每期至少 300 细胞的 7 个粗类型；G2 是每期至少 500 细胞的 6 个粗类型。三个分类可重叠，另单列更严格的表达量与检出率稳定子集。

1. `src/gene_axes_remote.py` 在远端逐份重新校验 H5AD 的 SHA-256，计算五期全部 500 基因的细胞类型内条件空间统计，输出 `tables/<stage>_gene_spatial.csv` 和证据检查点。`src/gene_map_remote.py` 提取 E9.5、E10.5 的代表切片用于图示。远端运行通过上一级 `run_remote.ps1` 向该独占目录提交脚本；原始 H5AD 只读。
2. `src/fetch_gene_axes.py` 仅回传汇总表与两张代表切片的坐标和四个已测基因值；原始 H5AD 未回传。
3. 本地依次运行 `src/gene_axes_derive.py`、`src/gene_axes_report.py`、`src/verify.py`，生成完整台账、各轴明细、图、报告与哈希清单。`gene_axes_results.b64` 仅为传输中间文件，不列入 MANIFEST.json。

`src/build_gene_explorer.py` 从上述逐轴 CSV 构建 `gene_500_explorer.html`，并把 500 行压缩数据嵌入页面；浏览器直接打开 HTML 即可搜索、筛选、排序、查看逐基因详情和导出当前筛选结果。重建交互页时先运行此脚本，再运行 `src/gene_axes_report.py` 和 `src/verify.py`。交互页的总体数字与 `GENE_AXES_SUMMARY.json`、500 基因台账逐项核对。`src/test_gene_explorer.cjs` 使用本机 Edge 的 Playwright 会话验证桌面与手机宽度、筛选、导出、详情及脚本错误，并在 evidence/ 留下截图。

G1 的“持续类型指向”指五期领先粗类型一致且相对第二类型有足够差距。G2 是同一粗类型内的五期单调关联候选，同时进行检测基因数四分位等权与逐期剔除检查。G3 在每份样本内先按细标签及检测四分位调整，再检查空间块残差解释比例与近邻关联。G3 的“重复”表示至少两份不同时期样本出现同类型局部关联；各期坐标系未对齐，不指同一解剖位置。时期与标本一一对应，所以时间结果是候选趋势；下一步是同一期独立胚胎和解剖区域的复核。

## 估计对象

X 为 log1p(CP10k)，expm1(X) 为线性相对量。四结构模块线性汇总采用四成员之和；旧报告部分数字是每成员均值，两者相差四倍。counts 可重建归一化，但含分数值，未认证为原始分子数。候选范围不等于共同解剖区。无独立胚胎重复，不作细胞级发育显著性推断。

空间是各切片内 XY kNN（15、40），z 六位小数仅用于层归组。原始坐标不改写。空间块为 XY 象限×z 四分位，留出块相邻且无缓冲区。低阶回归是条件关联诊断，未训练任何挑战预测模型。置换限定原始类型、空间块和检测四分位；保零位对照只交换阳性数值。行总量可能改变，不能把对照当生物学样本。

## 修复与局限

初次运行在 E9.5 浮点 z 伪切片处出现单点邻域错误，日志保留。全层检查发现 E8.5/E9.5/E10.5 精确 z 唯一值偏多，统一六位小数层归组后重新计算全部五份。最终改为每样本独立种子，避免恢复路径改变置换和抽样；所有最终结果均来自该版本。

标记集合中基质、周期、神经部分仍为探索性定义，未完成逐成员同期方向的原始研究认证；没有完整通路活性结论。没有认证连续双峰或新稀有谱系。未发布的分割、面积、探针、视野和批次记录使具体技术归因不可识别。

## 验收

verify.py 核对组成归一、对称分解恒等式、五时期细胞总数、z 层、500 基因分类计数、报告和交互总表的本地链接及远程资源依赖。PNG 图另行实际查看。交互总表已在桌面和手机宽度下通过 Edge 浏览器实测；此前报告 file:// 实开遭浏览器 URL 安全策略拒绝，因此报告的浏览器及窄屏视觉验收仍待用户在本机确认。
