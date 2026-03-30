# GitRadar

![Release](https://img.shields.io/github/v/release/Noreply1018/GitRadar?display_name=tag&label=release)
![CI](https://img.shields.io/github/actions/workflow/status/Noreply1018/GitRadar/ci.yml?branch=main&label=CI)
![Docs](https://img.shields.io/badge/docs-showcase-1f6feb)
![License](https://img.shields.io/badge/license-MIT-2ea44f)
![Topics](https://img.shields.io/badge/topics-github%20radar%20%7C%20wecom%20%7C%20typescript-2F6B8A)

![GitRadar Showcase](./docs/assets/showcase-hero.svg)

GitRadar 是一个面向个人和小团队的 GitHub 开源项目雷达。它每天从 GitHub Trending、最近更新、最近创建三类信号里挑出值得关注的仓库，经过规则筛选、主题去重和证据整理后，生成 6 到 8 条中文日报，支持企业微信群机器人发送，并把完整过程归档到本地。

它不是“再做一个排行榜脚本”，而是一个强调可解释性的发现引擎。GitRadar 关心的不只是“什么项目热”，更是“为什么今天值得看”。

## 这个版本解决了什么

`v1.2.0` 把 GitRadar 从“已经能用的日报脚本”推进成了“可以稳定展示、复盘和发布的产品内核”：

- digest 规则不再散落在代码里，而是集中到 `config/digest-rules.json`
- 规则配置可以单独校验，不用等主流程跑起来才发现错误
- 历史归档支持迁移、分析和重发
- 主流程对抓取失败、模型失败都具备重试、降级和失败留痕
- README 与文档已经收口到当前产品状态，适合直接对外展示

## 核心特点

- 多来源候选：同时抓取 Trending、最近更新、最近创建三类仓库候选
- 结构化筛选：基于动量、新鲜度、成熟度、覆盖度做打分，而不是只看 star
- 主题多样性：自动推断主题，避免日报被单一方向淹没
- 证据化输出：每条项目都保留 `whyNow`、证据摘要和规则版本
- 可复盘归档：保存候选、shortlist、候选池、入选原因和排除原因
- 可运维：支持规则校验、归档迁移、归档分析、历史重发
- 可自动化：支持 GitHub Actions 定时运行和 CI 质量检查

## 为什么它和普通 GitHub 热榜不一样

普通热榜通常只回答“最近什么热”。GitRadar 试图补上另外三件事：

- 为什么是它：不是只给 repo 名称，还给出今天入选的证据
- 为什么是现在：区分新项目爆发、成熟项目回暖、近期持续推进等不同信号
- 为什么不是别的：在归档里保留被排除项目和排除原因，方便复盘规则是否合理

这让它更像一个“解释型雷达”，而不是“热度抄录器”。

## 一个典型工作流

GitRadar 当前采用固定流水线，不依赖 agent 自主搜索：

1. 抓取 GitHub Trending 仓库
2. 通过 GitHub Search API 获取最近更新和最近创建候选
3. 读取 README 摘要补足上下文
4. 根据规则配置过滤低质量仓库并计算结构化评分
5. 推断主题，构造 shortlist 和 LLM 候选池
6. 让模型只在受限候选池内生成 6 到 8 条中文日报
7. 写入 `data/history/YYYY-MM-DD.json`
8. 显式发送时推送到企业微信群机器人

模型只负责最终中文编辑，不负责额外搜索、捏造 repo 或补造证据。

## 真实验证情况

当前版本已经完成这些验证：

- 本地格式、Markdown、YAML、类型检查、测试全部通过
- digest 规则配置已可通过单独命令校验
- 企业微信群机器人发送链路已经真实终端执行
- 样例 digest 已由人工确认在企业微信群中实际收到

实发样例展示：

![WeCom Digest Sample](./docs/assets/wecom-sample-digest.svg)

GitRadar 对外汇报时严格区分：

- 代码已改
- 测试已过
- 真实终端已验证
- 企业微信群内已实际收到

## 快速开始

准备本地环境：

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

推荐的初次运行顺序：

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

- `validate:digest-rules`：校验 `config/digest-rules.json` 并输出摘要
- `generate:digest`：抓取、筛选、生成日报并写归档
- `generate:digest -- --send`：生成后发送企业微信
- `generate:digest -- --resend-date YYYY-MM-DD`：重发已有归档
- `analyze:digest -- --date YYYY-MM-DD`：分析某天归档的候选池和入选逻辑
- `migrate:archives`：把旧归档升级到当前 schema
- `send:wecom:sample`：发送样例消息验证机器人链路

## 项目展示页

如果你想把 GitRadar 发给别人看，优先用这份页面：

- [项目展示页](./docs/showcase.md)
- [社交传播套件](./docs/social-preview-kit.md)
- [GitHub Profile 置顶配置清单](./docs/profile-pinned-checklist.md)
- [传播文案](./docs/promo-copy.md)

它更适合对外介绍，包括产品定位、版本亮点、演示链路和适用场景。

## 规则配置

digest 规则配置文件位于 `config/digest-rules.json`，加载与校验逻辑位于 `src/config/digest-rules.ts`。

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

## 自动化与质量保证

仓库内置两个 GitHub Actions workflow：

- `CI`：格式、Markdown、YAML、规则配置校验、类型检查、测试、workflow lint
- `Daily Digest`：每天 `08:17` 中国时间自动生成并发送日报，也支持手动触发

本地与 CI 当前运行：

```bash
npm run format:check
npm run lint:md
npm run lint:yaml
npm run validate:digest-rules
npm run typecheck
npm test
```

## 文档索引

- [中文网页前端实施蓝图](./docs/web-frontend-blueprint.md)
- [项目展示页](./docs/showcase.md)
- [社交传播套件](./docs/social-preview-kit.md)
- [GitHub Profile 置顶配置清单](./docs/profile-pinned-checklist.md)
- [传播文案](./docs/promo-copy.md)
- [企业微信样例展示图](./docs/assets/wecom-sample-digest.svg)
- [架构设计与版本路线](./docs/architecture-roadmap.md)
- [开发规范](./docs/development.md)
- [推送与交付设计](./docs/push-delivery.md)
- [版本管理说明](./docs/versioning.md)
- [变更记录](./CHANGELOG.md)
