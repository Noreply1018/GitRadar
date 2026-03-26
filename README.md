# GitRadar

GitRadar 是一个面向个人使用的 GitHub 开源项目日报工具。

它每天从 GitHub 抓取候选项目，做一轮规则筛选和模型摘要，产出少量值得深看的项目卡片，并把结果归档到本地，同时支持发送到企业微信群机器人。

## 当前状态

当前仓库已经不是“只有产品定义”的阶段，而是一个可运行的 `v0` 原型：

- 支持手动生成当天日报
- 支持把日报写入 `data/history/YYYY-MM-DD.json`
- 支持显式加 `--send` 后发送到企业微信群机器人
- 支持 GitHub Actions 手动触发和每天 `08:00` 中国时间定时触发
- 定时任务失败时会向同一个企业微信群机器人发送失败告警

当前尚未完成的部分：

- `Telegram` 推送
- 更细的失败重试与恢复策略
- 更完善的候选缓存、重发和运营脚本

## 当前数据链路

GitRadar 当前的主流程如下：

1. 抓取 GitHub Trending 仓库
2. 调 GitHub Search API 补充“最近更新”和“最近创建”的候选
3. 按规则做一轮初筛和排序
4. 读取 README 摘要补充上下文
5. 调模型生成最终 `DailyDigest`
6. 写入本地历史归档
7. 显式开启发送时，把日报发到企业微信群机器人

企业微信当前只支持“群机器人 webhook”方案，不是企业微信应用消息。

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
├── scripts/             # 预留给运维和重发脚本
├── src/                 # TypeScript 实现
├── tests/               # 单元与集成测试
├── CHANGELOG.md
├── package.json
└── README.md
```

## 本地运行

先准备 `.env`：

```bash
cp .env.example .env
```

需要填写的环境变量：

- `GITHUB_TOKEN`
- `GR_API_KEY`
- `GR_BASE_URL`
- `GR_MODEL`
- `GITRADAR_WECOM_WEBHOOK_URL`

可选的本地调试覆盖：

- `GR_GH_API_URL`
- `GR_GH_TRENDING_URL`

只生成日报并写入归档：

```bash
npm run generate:digest
```

生成后直接发送到企业微信群机器人：

```bash
npm run generate:digest -- --send
```

如果只想单独验证企业微信机器人格式和 webhook 是否可用，也可以发送样例消息：

```bash
npm run send:wecom:sample
```

## 真实验证标准

GitRadar 对“企业微信已跑通”的标准不是“测试通过”，而是下面三项都成立：

- 代码已经改到位
- 本地测试和质量检查通过
- 在真实终端执行发送命令后，企业微信群里确实看到消息

建议保留真实执行记录，至少包括：

- 实际执行命令
- 命令前提配置
- 终端可见输出
- 群里收到的日报或失败告警

如果没有真实 webhook，就只能证明“代码已改”和“测试已过”，不能算真实发送验证完成。

## GitHub Actions 自动化

仓库内置了独立的日报工作流：

- 支持 `workflow_dispatch` 手动触发
- 支持每天 `08:00` 中国时间自动触发
- 运行命令是 `npm run generate:digest -- --send`
- 任务失败时会发送企业微信失败告警

GitHub Actions 需要配置以下 secrets：

- `GITHUB_TOKEN`
- `GR_API_KEY`
- `GR_BASE_URL`
- `GR_MODEL`
- `GITRADAR_WECOM_WEBHOOK_URL`

本地 `.env` 和 GitHub Actions 运行时环境变量名保持一致，避免维护两套命名体系。

## 质量检查

本地和 CI 当前会跑这些检查：

```bash
npm run format:check
npm run lint:md
npm run lint:yaml
npm run typecheck
npm test
```

## 文档索引

- [推送方案](./docs/push-delivery.md)
- [版本管理说明](./docs/versioning.md)
- [开发规范](./docs/development.md)
- [变更记录](./CHANGELOG.md)
