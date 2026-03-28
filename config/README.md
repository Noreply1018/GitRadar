# 配置目录

这个目录用于存放 GitRadar 的配置模板和配置约定说明。

当前已经使用的配置以环境变量为主，本地通过 `.env` 注入，GitHub Actions 通过同名 secrets 注入。

当前主要配置范围：

- 企业微信群机器人 webhook
- GitHub API 访问令牌
- 模型 API 基础地址、密钥与模型名
- 抓取调试时的 GitHub API 和 Trending 覆盖地址
- Digest 候选筛选与打分规则的仓库级静态配置文件

敏感配置不直接入库，应通过 `.env` 或本地私有配置注入。

非敏感的静态业务配置已经改为仓库文件管理，当前 digest 规则配置位于 `config/digest-rules.json`，加载与校验逻辑位于 `src/config/digest-rules.ts`。

当前 digest 规则配置集中维护：

- 主题定义
- 黑名单词
- 候选筛选阈值
- 打分权重

当前已做的配置有效性校验：

- 主题名不能为空
- 同一主题内关键词不能重复
- 同一关键词最多只能复用到 2 个主题
- 阈值必须是非负数
- 分段 bucket 的 `maxDays` 必须严格递增
- 权重字段缺失或类型不对时启动即报错

当前已使用的环境变量：

- `GITRADAR_WECOM_WEBHOOK_URL`
- `GITHUB_TOKEN`
- `GITRADAR_GITHUB_TOKEN`（GitHub Actions 专用）
- `GR_API_KEY`
- `GR_BASE_URL`
- `GR_MODEL`

仅用于本地调试的可选覆盖：

- `GR_GH_API_URL`
- `GR_GH_TRENDING_URL`

GitHub Actions 的 `Daily Digest` 工作流使用 `GITRADAR_GITHUB_TOKEN`，其余配置名与本地保持一致。

当前已验证的关键点：

- `GR_MODEL` 必须填写当前网关真实支持的模型名
- 本地 `.env` 与 GitHub Actions secrets 应保持一致
- 企业微信 webhook 只能放在本地私有配置或 GitHub Secrets 中，不能提交入库
