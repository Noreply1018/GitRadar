# GitRadar

GitRadar 是一个面向个人使用的 GitHub 开源项目日报工具，目标是每天自动抓取值得关注的项目，筛出少量真正值得点进去看的仓库，生成中文摘要，并直接推送到企业微信群机器人。

`1.0.0` 版本已经满足“个人可稳定日用”的标准：

- 支持手动生成当天日报
- 支持手动重发指定日期的已有归档
- 支持企业微信群机器人真实发送
- 支持 GitHub Actions 手动触发和每天 `08:00` 中国时间自动触发
- 支持失败告警、历史归档和基础质量检查

当前仍然刻意保持轻量，不包含：

- `Telegram` 推送
- 多数据源聚合
- agent 化搜索与审稿
- 复杂推荐系统

## 工作方式

GitRadar 当前采用“脚本抓取 + 规则筛选 + 单次模型编辑”的结构：

1. 抓取 GitHub Trending 仓库
2. 调 GitHub Search API 补充“最近更新”和“最近创建”的候选
3. 读取候选仓库 README 摘要补充上下文
4. 用规则做一轮过滤、打分和排序
5. 调模型从 shortlist 里选出 3 到 5 个项目并生成中文卡片
6. 写入 `data/history/YYYY-MM-DD.json`
7. 显式发送时推送到企业微信群机器人

模型当前不负责自主搜索，也不是 agent。它只负责在已抓好的候选里做最后一轮编辑和摘要。

## 当前能力

### 日报生成

- 入口命令：`npm run generate:digest`
- 输出结果：`data/history/YYYY-MM-DD.json`
- 归档内容包含生成时间、候选数量、shortlist 数量和最终 digest

### 企业微信发送

- 即时发送：`npm run generate:digest -- --send`
- 样例消息：`npm run send:wecom:sample`
- 历史重发：`npm run generate:digest -- --resend-date YYYY-MM-DD`

`--resend-date` 的语义是“重发已有归档”，不会重新抓 GitHub，也不会重新调用模型。

### GitHub Actions 自动化

仓库内置 `Daily Digest` workflow：

- `workflow_dispatch`：手动触发
- `schedule`：每天 `08:00` 中国时间自动触发
- 执行命令：`npm run generate:digest -- --send`
- 失败时发送企业微信告警

## 本地运行

先准备本地配置：

```bash
cp .env.example .env
```

需要填写：

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
npm run send:wecom:sample
```

## GitHub Actions Secrets

`Daily Digest` workflow 需要以下 secrets：

- `GITRADAR_GITHUB_TOKEN`
- `GR_API_KEY`
- `GR_BASE_URL`
- `GR_MODEL`
- `GITRADAR_WECOM_WEBHOOK_URL`

本地建议继续使用 `GITHUB_TOKEN`，GitHub Actions 因平台限制改用 `GITRADAR_GITHUB_TOKEN`。

## 真实验证标准

GitRadar 对“已跑通”的判断必须拆开看：

- 代码已改
- 测试已过
- 真实终端已验证
- 用户在企业微信群里实际看到消息

只有前三项都成立，且最后一项也有人肉确认时，才算这条链路真正完成。

建议保留这些证据：

- 实际执行命令
- 终端可见输出
- 归档文件路径
- GitHub Actions run 链接
- 企业微信群内实际收到的消息

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

- [推送方案](./docs/push-delivery.md)
- [版本管理说明](./docs/versioning.md)
- [开发规范](./docs/development.md)
- [变更记录](./CHANGELOG.md)
