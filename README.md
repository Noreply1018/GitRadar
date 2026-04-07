# GitRadar

![CI](https://img.shields.io/github/actions/workflow/status/Noreply1018/GitRadar/ci.yml?branch=main&label=CI)
![License](https://img.shields.io/badge/license-MIT-2ea44f)
![Runtime](https://img.shields.io/badge/runtime-GitHub--native-2F6B8A)

> 一个把候选发现、中文日报、发送、归档、运行状态和反馈都收敛到 GitHub 仓库的开源日报系统。

![GitRadar Overview](./docs/assets/gitradar-overview.svg)

## 产品定义

GitRadar 3.0.0 只有一条正式链路：

- GitHub Actions 是唯一正式执行器
- GitHub 仓库是唯一正式配置源、归档源和运行状态源
- 控制台只读取远端正式结果，并编辑仓库内可版本化配置
- GitHub Secrets 负责所有敏感凭据

GitRadar 不只是“抓热门仓库”，而是围绕每日开源发现建立完整链路：

- 候选发现：从 Trending、最近更新、最近创建等来源收集信号
- 规则筛选：在模型之前完成主题、多样性和成熟度收敛
- 中文成稿：回答“是什么、为什么值得看、为什么是今天”
- 远端发送：由 GitHub Actions 调用发送器完成投递
- 仓库归档：把日报、反馈和运行状态长期沉淀回仓库
- 控制台阅读：查看归档、运行状态、调度、偏好和远端映射信息

## 正式状态与数据

GitRadar 3.0.0 的正式结果都回写到仓库：

- `data/history/*.json`：正式日报归档
- `data/runtime/github-runtime.json`：最近一次正式运行状态
- `data/feedback/feedback-events.jsonl`：反馈事件流
- `data/feedback/feedback-state.json`：反馈聚合状态

控制台默认读取这套远端正式数据。只要远端工作流已经跑过一次，控制台看到的状态就应该能对应到仓库中的真实文件和 GitHub Actions 运行链接。

## 配置方式

### GitHub Secrets

至少需要这些 Secrets：

- `GITRADAR_GITHUB_TOKEN`
- `GR_API_KEY`
- `GR_BASE_URL`
- `GR_MODEL`
- `GITRADAR_WECOM_WEBHOOK_URL`

Secrets 只在 GitHub Actions 运行时注入，不进入仓库历史。

### 仓库配置文件

当前正式配置文件包括：

- `config/schedule.json`
- `config/digest-rules.json`
- `config/user-preferences.json`

职责分别是：

- `schedule.json`：正式发送时区与时间槽
- `digest-rules.json`：候选筛选规则、主题、阈值和权重
- `user-preferences.json`：主题偏好与自定义关注词

控制台不会直接操作本地工作树。正式写入通过浏览器中的细粒度 PAT 触发 `Console Writeback` workflow，由 GitHub Actions 在远端创建 PR 和提交。

## 启用正式链路

1. 使用模板创建自己的仓库，或 fork 当前仓库
2. 配置所有必需 GitHub Secrets
3. 按需要调整 `config/` 下的正式配置文件
4. 在仓库 `Actions` 中启用 `Daily Digest`
5. 首次建议先手动 `Run workflow`

一次成功的正式运行完成后，仓库里应至少出现或更新：

- `data/history/<YYYY-MM-DD>.json`
- `data/runtime/github-runtime.json`

如果运行失败，`data/runtime/github-runtime.json` 也会回写失败状态，控制台会把该次远端失败作为正式状态显示出来，而不是把失败误报成成功。

## 控制台定位

控制台是 GitRadar 的 GitHub-first 管理与阅读界面，不是第二套正式执行器。它负责：

- 展示最近一次远端运行状态
- 展示和阅读正式归档
- 编辑仓库中的调度与偏好配置
- 记录收藏、稍后看、跳过等反馈
- 展示 Secrets 的映射位置与最近远端验证结果

正式入口：

- GitHub Pages：`https://noreply1018.github.io/GitRadar/`
- GitHub Actions：`Daily Digest` 负责正式执行，`Console Writeback` 负责正式写入请求

GitHub Pages 读取仓库中的正式归档与运行状态。需要写入配置或记录反馈时，控制台会要求提供细粒度 PAT，并通过 workflow dispatch 把请求交给 GitHub Actions。

本地开发只保留静态前端调试，不再提供第二套本地正式控制面。

本地开发调试：

```bash
npm install
npm run dev:web
```

默认地址：`http://127.0.0.1:4173`

如果需要确认生产构建结果，可额外执行：

```bash
npm run build:web
```

## 开发与验证命令

```bash
npm run validate:digest-rules -- --format json
npm run generate:digest
npm run generate:digest -- --send
npm run runtime:github
npm run analyze:digest -- --date 2026-03-30
npm run feedback:list
npm run send:wecom:sample
```

这些命令用于开发、调试和问题复现；正式运行仍以 `Daily Digest` 工作流为准。

如果需要本地开发环境变量模板，请参考 [`docs/examples/development.env.example`](./docs/examples/development.env.example)。该模板只服务于开发调试，不代表正式配置入口。

## 文档入口

- 架构设计：[`docs/architecture-roadmap.md`](./docs/architecture-roadmap.md)
- GitHub native 升级路线图：[`docs/github-native-roadmap.md`](./docs/github-native-roadmap.md)
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
