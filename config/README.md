# 配置目录

这个目录用于存放 GitRadar 的配置模板和示例配置。

后续预计会放入：

- Telegram Bot 相关配置示例
- 企业微信群机器人 webhook 配置示例
- GitHub API 相关配置示例
- 模型调用参数模板
- 抓取与筛选规则配置

敏感配置不直接入库，应通过 `.env` 或本地私有配置注入。

当前已使用的环境变量：

- `GITRADAR_WECOM_WEBHOOK_URL`
