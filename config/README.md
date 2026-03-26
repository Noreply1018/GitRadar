# 配置目录

这个目录用于存放 GitRadar 的配置模板和配置约定说明。

当前已经使用的配置以环境变量为主，本地通过 `.env` 注入，GitHub Actions 通过同名 secrets 注入。

当前主要配置范围：

- 企业微信群机器人 webhook
- GitHub API 访问令牌
- 模型 API 基础地址、密钥与模型名
- 抓取调试时的 GitHub API 和 Trending 覆盖地址

敏感配置不直接入库，应通过 `.env` 或本地私有配置注入。

当前已使用的环境变量：

- `GITRADAR_WECOM_WEBHOOK_URL`
- `GITHUB_TOKEN`
- `GR_API_KEY`
- `GR_BASE_URL`
- `GR_MODEL`

仅用于本地调试的可选覆盖：

- `GR_GH_API_URL`
- `GR_GH_TRENDING_URL`

GitHub Actions 的 `Daily Digest` 工作流应复用这些环境变量名，避免维护单独一套 CI 专用命名。
