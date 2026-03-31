# 配置目录

GitRadar 3.0.0 把配置正式分成两层：

- 仓库配置文件：非敏感、可版本化、可审阅
- GitHub Secrets：敏感信息、只在远端运行时注入

不再把本地 `.env` 视为正式配置源。

## 仓库配置文件

当前正式入库并参与 GitHub 正式链路的配置包括：

- `config/schedule.json`
- `config/digest-rules.json`
- `config/user-preferences.json`

这些配置的职责：

- `schedule.json`：正式发送时间与时区
- `digest-rules.json`：候选筛选、主题、阈值和权重
- `user-preferences.json`：主题偏好与自定义主题词

其中 `schedule.json` 已经是 GitHub Actions 的正式调度输入，工作流每 5 分钟轮询一次，命中时间槽后执行日报。

## GitHub Secrets

当前正式 Secrets：

- `GITRADAR_GITHUB_TOKEN`
- `GR_API_KEY`
- `GR_BASE_URL`
- `GR_MODEL`
- `GITRADAR_WECOM_WEBHOOK_URL`

这些配置不提交入库，也不再由默认控制台写入本地 `.env`。

## 本地 `.env` 的角色

本地 `.env` 仍可保留，但只用于：

- 本地开发
- 本地调试命令
- 复现远端问题

它不再代表正式生产配置，也不再是前端控制台的默认写入目标。

## 配置原则

- 频繁调整且不敏感的内容优先进入仓库配置文件
- 密钥、Webhook、Token 一律进入 GitHub Secrets
- 不再要求“本地 `.env` 与 GitHub Secrets 完全一致”
- 不再以 Docker 或本地常驻进程作为配置设计前提
