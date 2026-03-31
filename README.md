# GitRadar

![CI](https://img.shields.io/github/actions/workflow/status/Noreply1018/GitRadar/ci.yml?branch=main&label=CI)
![License](https://img.shields.io/badge/license-MIT-2ea44f)
![Topics](https://img.shields.io/badge/topics-github%20radar%20%7C%20llm%20%7C%20wecom-2F6B8A)

> 一个把 GitHub 候选信号收敛成中文日报、归档和反馈轨迹的本地开源兴趣雷达。

![GitRadar Overview](./docs/assets/gitradar-overview.svg)

GitRadar 面向个人与小团队。它从 GitHub 候选源抓取项目，经过规则筛选、证据整理和模型编辑，生成一份解释型中文日报，并把归档、反馈、偏好提示和环境验证统一收口到本地控制台。

它的重点不是“今天什么最热”，而是把这些问题稳定回答出来：

- 今天哪些仓库真正值得看
- 为什么是这些仓库
- 为什么是今天
- 最近持续关心的主题是什么
- 当前这套链路是不是还活着

## 核心能力

- 候选发现：同时覆盖 GitHub Trending、最近更新、最近创建三类候选源
- 规则筛选：用主题、多样性、成熟度和硬信号约束候选池，而不是直接抄榜单
- 中文日报：为每条入选项目生成“做什么、为什么值得看、为什么是现在”的中文摘要
- 本地控制台：查看环境配置、偏好设置、收藏/稍后看、归档阅读和运行状态
- 反馈闭环：记录 `收藏 / 稍后看 / 跳过`，形成轻量兴趣轨迹
- 归档沉淀：本地保存日报、反馈和分析结果，支持当前结构下的分析和复盘
- 多运行方式：CLI、Docker、本地控制台、Windows 启动脚本

## 仓库入口

- 架构与演进方向：[`docs/architecture-roadmap.md`](./docs/architecture-roadmap.md)
- 开发与验证约定：[`docs/development.md`](./docs/development.md)
- 配置说明：[`config/README.md`](./config/README.md)
- 数据目录说明：[`data/README.md`](./data/README.md)
- 推送链路说明：[`docs/push-delivery.md`](./docs/push-delivery.md)

## 快速开始

### 环境要求

- Node.js 20+
- npm 10+
- 可用的 GitHub Token
- 可用的模型网关配置
- 如果需要群推送，还需要企业微信群机器人 Webhook

### 初始化

```bash
cp .env.example .env
npm install
```

### 启动本地控制台

```bash
npm run build:web
npm run start:console
```

默认地址：

- 控制台与本地 API：`http://127.0.0.1:3210`

开发模式：

```bash
npm run dev:web-api
npm run dev:web
```

## Docker 运行

如果希望 GitRadar 常驻在本机，直接使用 Docker：

```bash
docker compose up --build
```

停止：

```bash
docker compose down
```

宿主机保留的数据：

- `config/`
- `data/`
- `.env`

## Windows 启动

仓库自带 Windows 启停脚本，适合本地 Docker 场景：

- `start-gitradar.bat`
- `stop-gitradar.bat`

## CLI 入口

```bash
npm run validate:digest-rules
npm run generate:digest
npm run generate:digest -- --send
npm run analyze:digest -- --date 2026-03-30
npm run feedback:list
npm run send:wecom:sample
```

常见用途：

- `validate:digest-rules`：校验 `config/digest-rules.json`
- `generate:digest`：抓取、筛选、编辑并写入日报归档
- `generate:digest -- --send`：生成日报后发送企业微信
- `analyze:digest`：分析某天归档结果
- `feedback:list`：查看收藏、稍后看和跳过反馈
- `send:wecom:sample`：验证企业微信群机器人链路

## 配置与数据

主要配置：

- 规则配置：`config/digest-rules.json`
- 调度配置：`config/schedule.json`
- 环境变量：`.env`

主要数据：

- 归档样本与历史：`data/history/`
- 运行期临时数据：`data/runtime/`
- 抓取缓存：`data/cache/`
- 导出结果：`data/exports/`

关键环境变量：

- `GITHUB_TOKEN`
- `GR_API_KEY`
- `GR_BASE_URL`
- `GR_MODEL`
- `GITRADAR_WECOM_WEBHOOK_URL`

## 项目治理

- 安全策略：[`SECURITY.md`](./SECURITY.md)
- 贡献约定：[`CONTRIBUTING.md`](./CONTRIBUTING.md)
- 行为准则：[`CODE_OF_CONDUCT.md`](./CODE_OF_CONDUCT.md)
- PR 模板：[`/.github/pull_request_template.md`](./.github/pull_request_template.md)

## 许可证

GitRadar 使用 [MIT License](./LICENSE)。
