# GitRadar

![Release](https://img.shields.io/github/v/release/Noreply1018/GitRadar?display_name=tag&label=release)
![CI](https://img.shields.io/github/actions/workflow/status/Noreply1018/GitRadar/ci.yml?branch=main&label=CI)
![Docs](https://img.shields.io/badge/docs-showcase-1f6feb)
![License](https://img.shields.io/badge/license-MIT-2ea44f)
![Topics](https://img.shields.io/badge/topics-github%20radar%20%7C%20wecom%20%7C%20typescript-2F6B8A)

![GitRadar Showcase](./docs/assets/showcase-hero.svg)

GitRadar 是一个面向个人和小团队的 GitHub 开源项目雷达。它每天从 GitHub Trending、最近更新、最近创建三类来源里抓取候选仓库，经过规则筛选、主题去重、候选池收敛和证据整理后，生成 6 到 8 条中文日报，支持企业微信群机器人发送，并把完整过程归档到本地。

当前版本把 GitRadar 收口成两层能力：

- 产品内核：CLI + 规则配置 + 归档 + 企业微信发送
- 本地使用层：中文网页控制台 + Docker 容器 + Windows 双击启动脚本

这意味着你可以继续像开发者一样直接跑 CLI，也可以把仓库 clone 到 Windows 本机后，通过 `.bat` 双击直接启动 GitRadar 并打开网页前端。

## 当前产品状态

GitRadar 现在已经具备这些稳定能力：

- 多来源候选抓取：Trending、最近更新、最近创建
- 结构化打分：动量、新鲜度、成熟度、覆盖度
- digest 规则配置文件化：`config/digest-rules.json`
- 规则独立校验：`npm run validate:digest-rules`
- 日报归档、迁移、分析和历史重发
- 反馈闭环：网页里可以对项目标记“收藏 / 稍后看 / 跳过”
- 反馈终端复盘：`npm run feedback:list`
- 企业微信群机器人发送与失败留痕
- GitHub Actions 每日自动运行
- 本地中文控制台：规则配置、执行中心、归档浏览
- Docker 本地运行：控制台和每日任务一起封装进容器
- Windows 双击启动：`start-gitradar.bat`

它不是一个“抄 GitHub 热榜”的脚本，而是一个强调“为什么今天值得看”的解释型发现引擎。

## Windows 双击启动

这是当前最推荐的本地使用方式。

前提：

- 已安装并启动 Docker Desktop
- 已把仓库 clone 到本机
- 已准备好 `.env`

首次准备：

```bash
cp .env.example .env
```

Windows 上直接双击：

- `start-gitradar.bat`：启动 Docker 服务并自动打开网页前端
- `stop-gitradar.bat`：停止 Docker 服务

双击 `start-gitradar.bat` 后，脚本会自动完成这些动作：

1. 检查 Docker Desktop 和 `docker compose` 是否可用
2. 检查 `.env` 是否存在
3. 启动或构建 GitRadar 容器
4. 等待控制台健康检查通过
5. 自动打开 `http://127.0.0.1:3210`
6. 保留一个 Docker 服务窗口显示日志

## Docker 本地运行

GitRadar 当前的 Docker 方案默认包含两部分：

- 中文网页控制台
- 容器内每日定时任务

默认行为：

- 控制台端口：`http://127.0.0.1:3210`
- 容器时区：`Asia/Shanghai`
- 每日任务时间：`08:17`
- 容器内定时命令：`npm run generate:digest:send`

如果你不用 `.bat`，也可以直接手动运行：

```bash
docker compose up --build
```

停止：

```bash
docker compose down
```

挂载策略：

- `config/`：规则配置保留在宿主机
- `data/`：历史归档、失败报告、缓存和导出保留在宿主机
- `.env`：通过 `env_file` 和只读挂载注入容器

这保证了你在网页里改规则、运行命令、生成归档后，本机仓库目录里能直接看到结果。

## 中文网页控制台

控制台当前包含 4 个主要区域：

- 仪表盘：规则版本、最近归档、最近命令状态、快捷动作
- 规则配置：主题、黑名单、阈值、权重的结构化编辑
- 执行中心：校验、生成、发送样例、归档分析与终端日志
- 归档浏览：日报详情、左右翻页阅读和“收藏 / 稍后看 / 跳过”反馈

控制台通过本地 API 工作，默认只监听本机，不面向公网多用户部署。

## 常用 CLI 命令

GitRadar 仍然保留完整 CLI 能力，适合开发、调试和 CI：

```bash
npm install
npm run validate:digest-rules
npm run validate:digest-rules -- --format json
npm run generate:digest
npm run generate:digest -- --send
npm run analyze:digest -- --date 2026-03-26
npm run analyze:digest -- --date 2026-03-26 --format json
npm run feedback:list
npm run feedback:list -- --action saved
npm run feedback:list -- --action later --format json
npm run migrate:archives
npm run migrate:archives -- --dry-run
npm run send:wecom:sample
```

命令说明：

- `validate:digest-rules`：校验 `config/digest-rules.json`
- `generate:digest`：抓取、筛选、成稿并写归档
- `generate:digest -- --send`：生成后发送企业微信
- `analyze:digest -- --date YYYY-MM-DD`：分析某天归档
- `feedback:list`：查看本地反馈记录，支持按动作、主题、仓库筛选
- `migrate:archives`：把旧归档迁移到当前 schema
- `send:wecom:sample`：发送样例消息验证机器人链路

`feedback:list` 常用写法：

```bash
npm run feedback:list
npm run feedback:list -- --action saved
npm run feedback:list -- --action later --theme "AI Agents"
npm run feedback:list -- --repo owner/alpha-agent --format json
```

支持参数：

- `--action saved|later|skipped`
- `--theme <主题名>`
- `--repo <owner/name>`
- `--limit <数量>`
- `--format text|json`

## 开发模式

如果你是在本地继续开发网页控制台，而不是作为普通用户使用 Docker：

```bash
npm install
npm run dev:web-api
npm run dev:web
```

开发端口：

- API：`http://127.0.0.1:3210`
- 前端开发服务：`http://127.0.0.1:4173`

如果只想构建网页前端并通过同源方式访问：

```bash
npm run build:web
npm run start:console
```

## 环境变量

必填环境变量：

- `GITHUB_TOKEN`
- `GR_API_KEY`
- `GR_BASE_URL`
- `GR_MODEL`
- `GITRADAR_WECOM_WEBHOOK_URL`

可选调试覆盖：

- `GR_GH_API_URL`
- `GR_GH_TRENDING_URL`

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
npm run build:web
```

## 真实验证口径

GitRadar 对外汇报时严格区分：

- 代码已改
- 测试已过
- 真实终端已验证
- 企业微信群内已实际收到

没有真实终端复现前，不报告“链路已成功”。

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
