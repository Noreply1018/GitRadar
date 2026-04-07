# GitRadar

![CI](https://img.shields.io/github/actions/workflow/status/Noreply1018/GitRadar/ci.yml?branch=main&label=CI)
![License](https://img.shields.io/badge/license-MIT-2ea44f)
![Runtime](https://img.shields.io/badge/runtime-GitHub--native-2F6B8A)

> 一个真正运行在 GitHub 上的开源日报系统：GitHub Actions 负责抓取、成稿、发送与归档，GitHub Pages 负责阅读与轻量管理，企业微信负责正式投递。

![GitRadar Overview](./docs/assets/gitradar-overview.svg)

## 产品定位

GitRadar 的正式产品面只保留一条链路：

- **GitHub Actions** 是唯一正式执行器
- **GitHub 仓库** 是唯一正式配置源、归档源与运行状态源
- **GitHub Pages** 是唯一正式控制台入口
- **GitHub API / workflow dispatch / Git Data API** 是正式写入路径
- **GitHub Secrets** 负责敏感凭据
- **企业微信群机器人** 是当前唯一正式投递通道

这不是“本地工具 + GitHub 托管”的混合模式。
GitRadar 的正式运行位置就是 GitHub，本地只用于开发调试和问题复现。

## 当前正式能力

GitRadar 当前围绕三件事收敛：

1. **定时生成并发送日报**
   - GitHub Actions 定时执行
   - 候选抓取、规则筛选、中文成稿、发送与归档都在远端完成
   - 企业微信群机器人接收正式日报与失败告警

2. **查看正式归档与状态**
   - GitHub Pages 直接读取仓库中的正式归档与运行状态
   - 控制台可以查看最近运行结果、归档列表和阅读详情

3. **配置与收藏交互**
   - 用户可在 Pages 中修改调度与偏好、记录收藏/稍后看/跳过
   - 写入请求通过 PAT 触发 workflow dispatch，由 GitHub 内流程正式落仓库并保留 PR / commit 证据

## 正式数据落点

正式结果全部回写到仓库：

- `config/schedule.json`：正式发送时区与时间槽
- `config/digest-rules.json`：正式筛选规则与权重
- `config/user-preferences.json`：正式主题偏好与自定义关注词
- `data/history/*.json`：正式日报归档
- `data/runtime/github-runtime.json`：最近一次正式执行状态
- `data/runtime/environment-report.json`：最近一次正式环境诊断结果
- `data/feedback/feedback-events.jsonl`：反馈事件流
- `data/feedback/feedback-state.json`：反馈聚合状态

控制台默认读取这些正式文件，而不是读取本地副本或本地服务拼接出来的状态。

## 正式入口

- **GitHub Pages**：`https://noreply1018.github.io/GitRadar/`
- **GitHub Actions / Daily Digest**：正式定时执行、发送、归档、运行状态回写
- **GitHub Actions / Console Writeback**：正式写入配置与反馈请求
- **GitHub Actions / Environment Diagnose**：正式环境诊断

控制台读取公开正式数据时不需要本地 server。
当需要修改配置或提交反馈时，控制台会要求输入细粒度 PAT，然后通过 workflow dispatch 把请求交给 GitHub 内流程处理。

## 启用正式链路

1. 使用模板创建自己的 GitRadar 仓库，或 fork 当前仓库
2. 配置必需的 GitHub Secrets：
   - `GITRADAR_GITHUB_TOKEN`
   - `GR_API_KEY`
   - `GR_BASE_URL`
   - `GR_MODEL`
   - `GITRADAR_WECOM_WEBHOOK_URL`
3. 按需要修改：
   - `config/schedule.json`
   - `config/digest-rules.json`
   - `config/user-preferences.json`
4. 在仓库 `Actions` 中启用：
   - `Daily Digest`
   - `Console Writeback`
   - `Deploy Pages`
   - `Environment Diagnose`
5. 首次建议先手动运行一次 `Daily Digest`

一次成功执行后，仓库里应至少出现或更新：

- `data/history/<YYYY-MM-DD>.json`
- `data/runtime/github-runtime.json`

如果运行失败，`data/runtime/github-runtime.json` 也会回写失败状态；控制台会显示这次远端失败，而不是把失败误报成成功。

## 正式工作流

### `Daily Digest`

负责：

- 定时或手动触发
- 候选抓取、规则筛选、中文成稿
- 企业微信发送
- 归档写入
- runtime 状态回写

### `Console Writeback`

负责：

- 接收 Pages 控制台的写入请求
- 应用配置或反馈变更
- 通过 GitHub 原生写回路径创建 PR

### `Environment Diagnose`

负责：

- 校验 GitHub、LLM、企业微信环境
- 生成并写回环境诊断报告

### `Deploy Pages`

负责：

- 构建静态控制台
- 发布 GitHub Pages 正式入口

## 本地开发与调试

本地不再提供第二套正式控制面。
本地只保留静态前端调试、命令复现和测试验证。

### 开发模式

```bash
npm install
npm run dev:web
```

默认地址：`http://127.0.0.1:4173`

### 生产构建预览

```bash
npm run build:web
```

## 常用开发命令

```bash
npm run validate:digest-rules -- --format json
npm run generate:digest
npm run generate:digest -- --send
npm run runtime:github
npm run diagnose:environment
npm run feedback:list
npm run send:wecom:sample
npm run build:web
npm run test
npm run typecheck
```

这些命令用于开发、调试、复现和验证；正式运行仍以 GitHub Actions 为准。

如果需要本地环境变量模板，请参考：

- [`docs/examples/development.env.example`](./docs/examples/development.env.example)

该模板只服务于开发调试，不代表正式配置入口。

## 架构边界

GitRadar 当前保持这些边界：

- **Source Layer**：候选抓取与补充信号
- **Scoring Layer**：规则筛选与候选池构建
- **Editorial Layer**：中文成稿
- **Archive Layer**：归档与复盘
- **Delivery Layer**：企业微信发送
- **Feedback Layer**：反馈采集与轻量个性化

不要再把这些职责揉回“本地 server + Git CLI 控制面”的旧模型里。

## 文档入口

- 架构设计：[`docs/architecture-roadmap.md`](./docs/architecture-roadmap.md)
- GitHub native 路线图：[`docs/github-native-roadmap.md`](./docs/github-native-roadmap.md)
- 开发规范：[`docs/development.md`](./docs/development.md)
- 推送链路：[`docs/push-delivery.md`](./docs/push-delivery.md)
- 配置说明：[`config/README.md`](./config/README.md)
- 数据目录说明：[`data/README.md`](./data/README.md)

## 项目治理

- 安全策略：[`SECURITY.md`](./SECURITY.md)
- 贡献约定：[`CONTRIBUTING.md`](./CONTRIBUTING.md)
- 行为准则：[`CODE_OF_CONDUCT.md`](./CODE_OF_CONDUCT.md)
- PR 模板：[`/.github/pull_request_template.md`](./.github/pull_request_template.md)

## 许可证

GitRadar 使用 [MIT License](./LICENSE)。
