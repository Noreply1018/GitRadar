# 开发规范

## 当前目标

GitRadar 3.0.0 的开发重点是把 GitHub-native 正式链路做实：

- 远端执行稳定
- 远端归档可信
- 远端配置收敛
- 控制台只围绕正式数据展开

## 目录约定

- `src/`：核心逻辑与命令入口
- `src/web-api/`：本地开发调试用的控制台 API 与状态聚合层
- `tests/`：单元与集成测试
- `web/`：GitHub-first 控制台前端
- `config/`：正式仓库配置文件
- `data/history/`：正式日报归档
- `data/runtime/`：正式运行状态
- `docs/`：架构与开发文档

## 开发原则

- 所有用户可见行为都区分“代码已改”“测试已过”“真实终端已验证”
- 优先删掉旧语义，而不是继续兼容本地优先产品模型
- 正式链路由 GitHub Actions 承担，控制台和 CLI 只承担开发、调试和验证职责
- 非敏感配置优先仓库化，敏感配置优先 GitHub Secrets
- 归档与运行状态优先以仓库中的正式结果为准

## 架构边界

GitRadar 继续保持这些边界：

- Source Layer：候选抓取与补充信号
- Scoring Layer：规则筛选与候选池构建
- Editorial Layer：中文成稿
- Archive Layer：归档与复盘
- Delivery Layer：企业微信等发送器
- Feedback Layer：反馈采集与轻量个性化

不要为了“远端化”把这些职责重新揉成一段大脚本。

## 工作流与验证

当前正式工作流：

- `CI`：格式、Markdown、YAML、类型检查、测试
- `Daily Digest`：远端定时执行、发送、归档、运行状态回写
- `Console Writeback`：接收控制台写入请求并在远端创建 PR
- `Deploy Pages`：构建并发布 GitHub Pages 控制台

开发调试环境变量模板：

- `docs/examples/development.env.example`

它只用于本地开发命令和问题复现，不是正式配置入口。

每次涉及代码、配置、工作流或架构改动，至少执行：

1. `npm run format:check`
2. `npm run lint:md`
3. `npm run lint:yaml`
4. `npm run typecheck`
5. `npm run test`

如果改动涉及正式运行状态，还应额外验证：

- `npm run runtime:github`
- 检查 `data/runtime/github-runtime.json` 字段是否与最新归档和最近一次运行语义一致

如果涉及控制台静态站点，还应额外验证：

- `npm run build:web`

如果涉及本地调试 API，还应额外验证：

- `npm run dev:console-api`
- `curl http://127.0.0.1:3210/api/health`

如果涉及 GitHub 正式链路，还应检查：

- `Daily Digest` 工作流 YAML 语义是否仍与仓库配置一致
- 调度配置是否仍由 `config/schedule.json` 驱动
- 归档与 `data/runtime/github-runtime.json` 是否仍会提交回仓库
