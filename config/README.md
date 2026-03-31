# 配置目录

GitRadar 3.0.0 的正式配置分成两层：

- 仓库配置文件：非敏感、可版本化、可审阅
- GitHub Secrets：敏感信息、只在远端工作流运行时注入

## 仓库配置文件

当前正式配置文件包括：

- `config/schedule.json`
- `config/digest-rules.json`
- `config/user-preferences.json`

职责分别是：

- `schedule.json`：发送时间与时区
- `digest-rules.json`：候选筛选规则、主题、阈值和权重
- `user-preferences.json`：主题偏好与自定义主题词

其中 `schedule.json` 是 `Daily Digest` 工作流的正式调度输入。工作流每 5 分钟轮询一次，命中目标时间槽后执行日报。

## GitHub Secrets

当前正式 Secrets：

- `GITRADAR_GITHUB_TOKEN`
- `GR_API_KEY`
- `GR_BASE_URL`
- `GR_MODEL`
- `GITRADAR_WECOM_WEBHOOK_URL`

这些值不会入库，控制台也不会直接编辑它们；控制台只展示映射位置和最近一次远端运行反映出的状态。

## 配置原则

- 可审阅、可版本化、会频繁调整的内容进入仓库配置文件
- Token、API Key、Webhook 等敏感值进入 GitHub Secrets
- 所有正式运行均以仓库配置和 GitHub Secrets 的组合为准
