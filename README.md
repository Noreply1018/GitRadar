# GitRadar

![Release](https://img.shields.io/github/v/release/Noreply1018/GitRadar?display_name=tag&label=release)
![CI](https://img.shields.io/github/actions/workflow/status/Noreply1018/GitRadar/ci.yml?branch=main&label=CI)
![Docs](https://img.shields.io/badge/docs-showcase-1f6feb)
![License](https://img.shields.io/badge/license-MIT-2ea44f)
![Topics](https://img.shields.io/badge/topics-github%20radar%20%7C%20wecom%20%7C%20typescript-2F6B8A)

![GitRadar Showcase](./docs/assets/showcase-hero.svg)

GitRadar 是一个面向个人和小团队的 GitHub 开源项目雷达。它每天从 GitHub Trending、最近更新、最近创建三类来源里抓取候选仓库，经过规则筛选、主题去重、候选池收敛和证据整理后，生成 6 到 8 条中文日报，支持企业微信群机器人发送，并把完整过程归档到本地。

当前主线正在推进 `v1.3.0`：在保留现有 CLI 主流程的前提下，新增一个本地中文网页控制台，把规则配置、命令执行和归档浏览收口到同一套工作界面。

## 当前产品状态

GitRadar 现在已经具备这些稳定能力：

- 多来源候选抓取：Trending、最近更新、最近创建
- 结构化打分：动量、新鲜度、成熟度、覆盖度
- digest 规则配置文件化：`config/digest-rules.json`
- 规则独立校验：`npm run validate:digest-rules`
- 日报归档、迁移、分析和历史重发
- 企业微信群机器人发送与失败留痕
- GitHub Actions 每日自动运行
- 本地中文控制台第一期：规则配置、执行中心、归档浏览

它不是一个“抄 GitHub 热榜”的脚本，而是一个强调“为什么今天值得看”的解释型发现引擎。

## 当前交互面

GitRadar 当前同时提供两套入口：

- CLI：适合脚本化、自动化和 CI
- 中文网页控制台：适合改规则、看日志、浏览归档

两套入口共享同一套内核边界：

- 环境配置：`src/config/env.ts`
- 规则配置：`src/config/digest-rules.ts`
- 规则文件：`config/digest-rules.json`
- 归档模型：`src/core/archive.ts`
- 命令入口：`src/commands/*.ts`

网页控制台不会替代现有 CLI，而是把已有能力可视化。

## 一个典型工作流

GitRadar 的主链路仍然是固定流水线：

1. 抓取 GitHub Trending 仓库
2. 通过 GitHub Search API 获取最近更新和最近创建候选
3. 读取 README 摘要补足上下文
4. 根据规则配置过滤低质量仓库并计算结构化评分
5. 推断主题，构造 shortlist 和 LLM 候选池
6. 让模型只在受限候选池内生成 6 到 8 条中文日报
7. 写入 `data/history/YYYY-MM-DD.json`
8. 显式发送时推送到企业微信群机器人

模型只负责最终中文成稿，不负责额外搜索、捏造 repo 或补造证据。

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

推荐的第一次检查顺序：

```bash
npm install
npm run validate:digest-rules
npm run typecheck
npm test
```

## 常用 CLI 命令

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

- `validate:digest-rules`：校验 `config/digest-rules.json`
- `generate:digest`：抓取、筛选、成稿并写归档
- `generate:digest -- --send`：生成后发送企业微信
- `generate:digest -- --resend-date YYYY-MM-DD`：重发已有归档
- `analyze:digest -- --date YYYY-MM-DD`：分析某天归档
- `migrate:archives`：把旧归档迁移到当前 schema
- `send:wecom:sample`：发送样例消息验证机器人链路

## 中文网页控制台

第一期控制台聚焦于三件事：

- 改规则时不再手写整份 JSON
- 跑命令时直接看真实终端输出和退出码
- 看归档时不必手翻历史 JSON

本地启动方式：

```bash
npm run dev:web-api
npm run dev:web
```

默认端口：

- API：`http://127.0.0.1:3210`
- 前端开发服务：`http://127.0.0.1:4173`

如果要本地构建并通过 API 服务同源访问控制台：

```bash
npm run build:web
npm run start:console
```

控制台当前包含：

- 仪表盘：规则版本、最近归档、最近命令状态、快捷动作
- 规则配置：主题、黑名单、阈值、权重的结构化编辑
- 执行中心：校验、生成、发送样例、归档分析与终端日志
- 归档浏览：日报详情、LLM 候选池、排除原因

当前控制台仍然是本地优先设计，默认只监听 `127.0.0.1`，不面向公网多用户部署。

## 真实验证口径

GitRadar 对外汇报时严格区分：

- 代码已改
- 测试已过
- 真实终端已验证
- 企业微信群内已实际收到

没有真实终端复现前，不报告“链路已成功”。

## 规则配置

digest 规则配置文件位于 `config/digest-rules.json`，当前集中维护：

- 主题定义和关键词
- 描述、README 和 topic 黑名单
- shortlist 与候选池主题配额
- 推送时间、新建时间、成熟项目等阈值
- 打分权重和 bucket 分段

当前已做的配置有效性校验包括：

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

本地基线检查：

```bash
npm run format:check
npm run lint:md
npm run lint:yaml
npm run validate:digest-rules -- --format json
npm run typecheck
npm test
```

涉及代码或架构变更时，仓库默认通过分支和 PR 推进；合并前需要等待 CI 通过，不再直接推送到受保护的 `main`。

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
