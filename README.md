# GitRadar

![CI](https://img.shields.io/github/actions/workflow/status/Noreply1018/GitRadar/ci.yml?branch=main&label=CI)
![License](https://img.shields.io/badge/license-MIT-2ea44f)
![Mode](https://img.shields.io/badge/runtime-GitHub--native-2F6B8A)

> 一个由 GitHub Actions 驱动、把日报归档正式沉淀回 GitHub 仓库的中文开源日报系统。

![GitRadar Overview](./docs/assets/gitradar-overview.svg)

GitRadar 3.0.0 的正式形态不再是“本地常驻工具”。

它现在默认采用一条单一正式链路：

- GitHub Actions 定时或手动触发
- 读取仓库配置文件与 GitHub Secrets
- 抓取候选、生成日报、发送消息
- 把归档和运行状态提交回仓库
- 前端控制台读取仓库中的正式数据进行展示

这意味着：

- 本地机器不需要一直开机
- 前端归档列表以 GitHub 仓库里的正式归档为准
- 正式配置不再围绕本地 `.env`
- 本地运行只保留开发、调试、预览职责

## GitRadar 3.0.0 的产品定义

GitRadar 不做“今天最热榜单”的简单搬运，而是要稳定回答这些问题：

- 今天哪些仓库值得看
- 为什么是它们
- 为什么是今天
- 最近持续关心的主题是什么
- 正式执行链路是否健康

  3.0.0 的核心原则：

- 单一正式执行器：GitHub Actions
- 单一正式归档源：GitHub 仓库
- 单一正式配置源：仓库配置文件 + GitHub Secrets
- 单一正式阅读入口：GitHub-first 控制台
- Local 仅用于开发调试，不再承担正式产品职责

## 核心能力

- 候选发现：同时覆盖 GitHub Trending、最近更新、最近创建三类候选源
- 结构化筛选：按主题、多样性、成熟度和硬信号收敛候选池
- 中文日报：输出“做什么、为什么值得看、为什么是现在”的解释型日报
- 仓库归档：把每日归档与运行状态正式提交回 GitHub 仓库
- 远端调度：GitHub Actions 每 5 分钟轮询一次，并按仓库调度配置命中执行
- 控制台阅读：查看远端归档、最近运行状态、偏好、收藏与待看
- 反馈闭环：记录 `收藏 / 稍后看 / 跳过`，形成轻量兴趣轨迹

## 普通用户怎么用

GitRadar 3.0.0 面向普通用户的主路径是 `Use this template` 或 fork，而不是先 clone 再本地常驻。

### 1. 创建自己的 GitRadar 仓库

- 点击 GitHub 的 `Use this template`
- 或 fork 当前仓库到自己的账号

### 2. 配置 GitHub Secrets

至少准备这些敏感配置：

- `GITRADAR_GITHUB_TOKEN`
- `GR_API_KEY`
- `GR_BASE_URL`
- `GR_MODEL`
- `GITRADAR_WECOM_WEBHOOK_URL`

### 3. 调整仓库里的非敏感配置

主要修改这些仓库文件：

- `config/schedule.json`
- `config/digest-rules.json`
- `config/user-preferences.json`

### 4. 启用 GitHub Actions

- 打开仓库的 `Actions`
- 启用 `Daily Digest`
- 可先手动 `Run workflow` 验证

执行成功后，GitRadar 会把正式结果写回仓库：

- `data/history/*.json`
- `data/runtime/github-runtime.json`

## 控制台怎么定位

本地前端不是正式执行器，而是正式远端数据的阅读与轻量管理入口。

当前控制台默认做这些事情：

- 读取 GitHub 仓库中的正式归档
- 展示最近一次 GitHub Actions 运行状态
- 编辑仓库中的非敏感配置，例如发送时间和偏好
- 展示哪些敏感配置由 GitHub Secrets 管理

它不再默认做这些事情：

- 写本地 `.env` 当正式配置
- 在本地承担正式定时发送
- 让用户在 GitHub / Local 两个正式模式之间切换

## 本地开发与调试

本地模式仍然保留，但角色已经降级为开发态：

- 启动前端和 API
- 预览界面
- 调试抓取、打分、成稿逻辑
- 复现问题
- 开发 GitHub 正式链路本身

### 启动本地控制台

```bash
npm install
npm run build:web
npm run start:console
```

默认地址：

- `http://127.0.0.1:3210`

开发模式：

```bash
npm run dev:web-api
npm run dev:web
```

### 常用 CLI

```bash
npm run validate:digest-rules
npm run generate:digest
npm run generate:digest -- --send
npm run analyze:digest -- --date 2026-03-30
npm run feedback:list
npm run send:wecom:sample
```

其中：

- `generate:digest` 更适合开发调试
- GitHub 正式生产链路仍以 `Daily Digest` 工作流为准

## 仓库入口

- 架构设计：[`docs/architecture-roadmap.md`](./docs/architecture-roadmap.md)
- 开发与验证：[`docs/development.md`](./docs/development.md)
- 配置说明：[`config/README.md`](./config/README.md)
- 数据目录说明：[`data/README.md`](./data/README.md)
- 推送链路说明：[`docs/push-delivery.md`](./docs/push-delivery.md)

## 项目治理

- 安全策略：[`SECURITY.md`](./SECURITY.md)
- 贡献约定：[`CONTRIBUTING.md`](./CONTRIBUTING.md)
- 行为准则：[`CODE_OF_CONDUCT.md`](./CODE_OF_CONDUCT.md)
- PR 模板：[`/.github/pull_request_template.md`](./.github/pull_request_template.md)

## 许可证

GitRadar 使用 [MIT License](./LICENSE)。
