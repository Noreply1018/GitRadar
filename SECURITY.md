# Security Policy

## Supported Versions

GitRadar 当前只对下面两个范围提供安全修复支持：

| Version                               | Supported |
| ------------------------------------- | --------- |
| `main`                                | Yes       |
| 最新 GitHub Release 所在 minor 版本线 | Yes       |
| 更早的历史版本                        | No        |

如果问题只影响旧版本，默认会优先在 `main` 修复，再按需要决定是否回移到最近发布线。

## Reporting A Vulnerability

如果你发现了安全问题，请不要公开提 issue。

优先使用 GitHub 的私密漏洞提交通道：

1. 打开仓库主页
2. 进入 `Security`
3. 点击 `Report a vulnerability`

请尽量提供这些信息：

- 影响范围和前置条件
- 可复现步骤
- 预期影响
- 如果已经有 PoC，请附上最小可复现版本
- 是否涉及 token、webhook、workflow、依赖供应链或归档数据

如果你只是发现安全加固建议，但并不存在可利用风险，可以正常提公开 issue。

## Response Expectations

- 目标是在 3 个工作日内确认收到报告
- 目标是在确认后 7 个工作日内给出初步分级和处理路径
- 修复发布前，希望保持私下协调披露
- 修复完成后，会优先通过 GitHub Release 或提交记录同步公开修复结果

这些时间目标不是 SLA，但会按这个节奏推进。

## Scope

这份策略特别关注下面几类问题：

- GitHub token、LLM API key、企业微信 webhook 等敏感信息泄露
- GitHub Actions、分支保护、发布流程或依赖供应链带来的安全风险
- 运行日志、失败报告、归档文件中的敏感信息落盘
- 输入处理不当导致的命令执行、SSRF、注入或越权行为
- 会影响公开仓库分发安全性的构建与发布链路问题

## Safe Harbor

欢迎善意、最小化影响的安全研究。请避免：

- 访问、修改、删除不属于你的数据
- 触发大规模请求、拒绝服务或垃圾通知
- 在公开 issue、PR、讨论区或截图中暴露敏感信息
- 对第三方服务进行越界测试

如果你不确定某种测试方式是否合适，先通过私密漏洞提交通道说明你的计划。
