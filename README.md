# GitRadar

GitRadar 是一个面向个人和小团队的 GitHub 开源项目雷达。它每天抓取 GitHub Trending、最近更新、最近创建三类候选，结合规则筛选、主题多样性和结构化证据，生成 6 到 8 条中文日报，支持企业微信群机器人推送，并把完整过程归档到本地。

当前版本已经收口到 `1.2.0` 的产品形态：规则从代码常量升级为仓库级配置文件，主流程支持失败证据留存与模板降级，归档可迁移、可重发、可分析，规则配置还可以单独校验。

## 核心能力

- 每日抓取 GitHub Trending、最近更新、最近创建三类候选
- 读取 README 摘要补上下文，做多来源合并和去重
- 基于动量、新鲜度、成熟度、覆盖度做结构化打分
- 自动推断主题并限制同主题堆叠
- 为每条入选项目保留 `whyNow`、证据摘要和规则版本
- 生成中文日报，支持企业微信群机器人发送
- 保存带 `schemaVersion` 的历史归档，支持迁移、分析和重发
- 对 Trending 抓取和模型成稿提供重试、降级和失败报告
- 将 digest 规则外置到 `config/digest-rules.json`，并支持单独校验
- 支持 GitHub Actions 定时运行、手动触发和 CI 质量检查

## 工作流

GitRadar 当前采用固定流程，不依赖 agent 自主搜索：

1. 抓取 GitHub Trending 仓库
2. 通过 GitHub Search API 拉取最近更新和最近创建候选
3. 读取仓库 README 摘要补足上下文
4. 根据规则配置过滤低质量仓库并计算结构化评分
5. 推断主题，构造 shortlist 和 LLM 候选池
6. 让模型仅基于候选池生成 6 到 8 条中文日报
7. 写入 `data/history/YYYY-MM-DD.json`
8. 显式发送时推送到企业微信群机器人

模型只负责最终中文编辑，不负责额外检索、补采样或自行选题。

## 快速开始

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

建议先校验规则配置，再跑主流程：

```bash
npm run validate:digest-rules
npm run generate:digest
```

## 常用命令

```bash
npm run validate:digest-rules
npm run validate:digest-rules -- --format json
npm run generate:digest
npm run generate:digest -- --send
npm run generate:digest -- --resend-date 2026-03-26
npm run analyze:digest -- --date 2026-03-26
npm run analyze:digest -- --date 2026-03-26 --format json
npm run migrate:archives
npm run migrate:archives -- --dry-run
npm run send:wecom:sample
```

命令说明：

- `validate:digest-rules`：校验 `config/digest-rules.json` 并输出规则摘要
- `validate:digest-rules -- --format json`：输出机器可读的规则校验结果
- `generate:digest`：抓取、筛选、生成日报并写归档
- `generate:digest -- --send`：在生成后发送企业微信
- `generate:digest -- --resend-date YYYY-MM-DD`：重发已有归档，不重新抓取或调用模型
- `analyze:digest -- --date YYYY-MM-DD`：输出某天归档的候选池、入选理由和排除原因
- `migrate:archives`：扫描 `data/history/` 并把旧归档升级到当前 schema
- `migrate:archives -- --dry-run`：预览哪些归档会被迁移，不写回文件
- `send:wecom:sample`：发送样例消息，验证机器人链路

如果历史归档还是旧结构，需要先执行 `migrate:archives`，再使用 `analyze:digest` 或 `--resend-date`。

## 规则配置

Digest 规则配置文件位于 `config/digest-rules.json`，加载和校验逻辑位于 `src/config/digest-rules.ts`。

当前配置集中维护：

- 主题定义和关键词
- 描述、README 和 topic 黑名单
- shortlist 与候选池的主题配额
- 推送时间、新建时间、成熟项目等阈值
- 打分权重和 bucket 分段

当前已做的配置有效性校验：

- 主题名不能为空
- 同一主题内关键词不能重复
- 同一关键词最多复用到 2 个主题
- 阈值必须是非负数
- bucket 的 `maxDays` 必须严格递增
- 权重字段缺失或类型错误时立即报错

## 归档与失败报告

每个归档文件当前都会保存：

- `schemaVersion`
- 生成时间
- 候选总数
- shortlist 数量
- 最终 digest
- 完整候选列表
- shortlist 列表
- LLM 候选池
- 每个入选项目的原因和证据
- 被排除项目的原因
- 规则版本和来源统计

运行期失败信息不会写入 `history/`，而是落到 `data/runtime/failures/`，用于保留：

- 失败阶段
- 错误信息和堆栈
- 当时的候选池、来源和降级上下文
- 是否启用模板降级或其他回退路径

## 自动化运行

仓库内置两个 GitHub Actions workflow：

- `CI`：格式、Markdown、YAML、规则配置校验、类型检查、测试、workflow lint
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
- `data/runtime/failures/` 下的失败报告路径
- GitHub Actions run 链接
- 企业微信群里的可见消息

## 质量检查

本地和 CI 当前运行：

```bash
npm run format:check
npm run lint:md
npm run lint:yaml
npm run validate:digest-rules
npm run typecheck
npm test
```

## 目录结构

```text
GitRadar/
├── .github/workflows/   # CI 与日报自动化
├── config/              # 仓库级静态配置与说明
├── data/
│   ├── cache/           # 本地缓存，不入库
│   ├── exports/         # 导出结果，不入库
│   ├── history/         # 每日归档
│   └── runtime/         # 运行期临时文件，不入库
├── docs/                # 开发与版本文档
├── scripts/             # 运维、重发、调试和迁移脚本
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
