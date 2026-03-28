# GitRadar

GitRadar 是一个面向个人和小团队的 GitHub 开源项目雷达。它每天抓取值得关注的仓库候选，做规则筛选、主题去重和证据整理，再生成 6 到 8 条中文日报，推送到企业微信群机器人，并把完整归档落到本地。

当前版本的重点不是“尽量多抓项目”，而是“每条推荐都能解释为什么今天值得看”。日报不只保留最终文案，也保留候选、shortlist、LLM 候选池、入选理由和被排除原因，便于复盘和持续调参。

## 核心能力

- 每日抓取 GitHub Trending、最近更新、最近创建三类候选
- 基于活跃度、新鲜度、成熟度和覆盖度做结构化打分
- 自动推断主题并限制同主题过度堆叠
- 为每条入选项目生成 `whyNow` 和证据摘要
- 生成中文日报并支持企业微信群机器人发送
- 保存可复盘的历史归档，支持按日期重发旧归档
- 提供归档分析命令，方便回看某天为什么这么选
- 支持 GitHub Actions 定时运行、手动触发和失败告警

当前仍然刻意保持轻量，不包含：

- 多数据源聚合
- 多 agent 编排
- 数据库和任务队列
- 复杂推荐反馈系统

## 工作流

GitRadar 当前采用“脚本抓取 + 规则筛选 + 结构化证据 + 单次模型成稿”的流程：

1. 抓取 GitHub Trending 仓库
2. 调 GitHub Search API 补充最近更新和最近创建候选
3. 读取仓库 README 摘要补上下文
4. 过滤低质量仓库并计算结构化评分
5. 推断主题，做 shortlist 和 LLM 候选池去重
6. 让模型只在候选池内生成 6 到 8 条中文摘要
7. 写入 `data/history/YYYY-MM-DD.json`
8. 显式发送时推送到企业微信群机器人

模型不是 agent，也不负责自行搜索。它只基于系统已经提供的候选、证据和主题信息做最后一轮中文编辑。

## 日常命令

准备本地配置：

```bash
cp .env.example .env
```

必填环境变量：

- `GITHUB_TOKEN`
- `GR_API_KEY`
- `GR_BASE_URL`
- `GR_MODEL`
- `GITRADAR_WECOM_WEBHOOK_URL`

可选调试覆盖：

- `GR_GH_API_URL`
- `GR_GH_TRENDING_URL`

常用命令：

```bash
npm run generate:digest
npm run generate:digest -- --send
npm run generate:digest -- --resend-date 2026-03-26
npm run analyze:digest -- --date 2026-03-26
npm run analyze:digest -- --date 2026-03-26 --format json
npm run send:wecom:sample
```

命令说明：

- `generate:digest`：抓取、筛选、生成日报并写归档
- `generate:digest -- --send`：在生成后发送企业微信
- `generate:digest -- --resend-date YYYY-MM-DD`：重发已有归档，不重新抓取或调用模型
- `analyze:digest -- --date YYYY-MM-DD`：输出某天归档的候选池、入选理由和排除原因
- `send:wecom:sample`：发送样例消息，验证机器人链路

## 归档内容

每个归档文件默认保存这些信息：

- 生成时间
- 候选总数
- shortlist 数量
- 最终 digest
- 完整候选列表
- shortlist 列表
- LLM 候选池
- 每个入选项目的原因和证据
- 被排除项目的原因
- 本次规则版本和来源统计

这让 GitRadar 不只是“发一条日报”，也能回答：

- 为什么今天选了这几个项目
- 为什么另一些项目没有入选
- 这条结论基于哪些硬信号

## 自动化运行

仓库内置两个 GitHub Actions workflow：

- `CI`：格式、Markdown、YAML、类型检查、测试、workflow lint
- `Daily Digest`：每天 `08:17` 中国时间自动生成并发送日报，也支持手动触发

`Daily Digest` 需要以下 GitHub Secrets：

- `GITRADAR_GITHUB_TOKEN`
- `GR_API_KEY`
- `GR_BASE_URL`
- `GR_MODEL`
- `GITRADAR_WECOM_WEBHOOK_URL`

本地建议继续使用 `GITHUB_TOKEN`，GitHub Actions 因平台限制改用 `GITRADAR_GITHUB_TOKEN`。

## 真实验证标准

GitRadar 对外汇报时必须明确区分：

- 代码已改
- 测试已过
- 真实终端已验证
- 企业微信群内已实际收到

只有前三项成立，且最后一项也被人确认时，才能把一条用户可见链路视为真正完成。

建议保留这些证据：

- 实际执行命令
- 终端可见输出
- 归档文件路径
- GitHub Actions run 链接
- 企业微信群里的可见消息

## 质量检查

本地和 CI 当前运行：

```bash
npm run format:check
npm run lint:md
npm run lint:yaml
npm run typecheck
npm test
```

## 目录结构

```text
GitRadar/
├── .github/workflows/   # CI 与日报自动化
├── config/              # 配置说明
├── data/
│   ├── cache/           # 本地缓存，不入库
│   ├── exports/         # 导出结果，不入库
│   ├── history/         # 每日归档
│   └── runtime/         # 运行期临时文件，不入库
├── docs/                # 开发与版本文档
├── scripts/             # 运维、重发和调试脚本预留
├── src/                 # TypeScript 实现
├── tests/               # 单元与集成测试
├── CHANGELOG.md
├── package.json
└── README.md
```

## 文档索引

- [架构设计与版本路线](./docs/architecture-roadmap.md)
- [开发规范](./docs/development.md)
- [推送与交付设计](./docs/push-delivery.md)
- [版本管理说明](./docs/versioning.md)
- [变更记录](./CHANGELOG.md)
