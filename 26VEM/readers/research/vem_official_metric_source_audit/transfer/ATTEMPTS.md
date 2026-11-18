# 运行记录

| 作业 ID | 实验目录 | 结果与处理 |
| --- | --- | --- |
| `vem-metric-transfer-20261116-01` | `transfer01` | 在读取任何数据前因 Python 3.10 不支持未括号化的 starred 下标表达式而退出。源文件、启动脚本和失败收据均保留。将下标改成显式 tuple；增加 Python 3.10 grammar 检查。 |
| `vem-metric-transfer-20261116-02` | `transfer02` | 第二次运行沿用冻结科学方案，仅包含上述语法兼容修复；最终状态见相应 job 收据。 |

`PROTOCOL.md` 中的 `transfer01` 是第一版冻结执行位置。修复后新 attempt 使用 `transfer02`；原位置不被覆盖。

第二次作业实际成功：2026-11-16 12:14:21 UTC 启动，12:18:11 UTC 完成，exit 0。780 行指标、45 个折×模型组合、10 个匹配阶段×类型组合，计算用时 229.21 秒。完成收据为 `progress_04.json`。

20 个小结果文件已取回（1,247,575 bytes），接收 SHA 校验通过。本地复核脚本第一次读取中文 JSON 时受 Windows 默认 GBK 编码影响而失败；显式指定 UTF-8 后通过全部 76 项检查。该修复只影响本地小文件复核，不改远端计算及结果。记录在 `LOCAL_DELIVERY_VERIFICATION.json`。
