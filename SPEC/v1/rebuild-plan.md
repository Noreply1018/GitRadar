# GitRadar v1 — 重建计划

## 总体策略

v1 只有两个阶段：

- **Phase A：最小日报主链路** — 完成后每天收到企微日报
- **Phase B：可选增强** — Web 只读浏览等非核心功能

Phase A 是唯一的硬性里程碑。Phase B 是可选的。

---

## Phase A：最小日报主链路

### 目标

从 GitHub Actions 到企业微信的完整链路稳定运行：抓取 → 评分 → 成稿 → 推送 → 归档 → runtime 回写。

### A.1 代码清理

| # | 任务 | 涉及文件 |
|---|------|---------|
| A.1.1 | 删除 model.ts 模板降级代码 | `src/digest/model.ts` |
| A.1.2 | 简化 `generateDigestWithResilience` — 3 次失败直接 throw，返回 `DailyDigest` | `src/digest/model.ts` |
| A.1.3 | 更新 generate.ts 适配新接口 — 移除 `editorialResult.mode`、`onModelFailure` | `src/digest/generate.ts` |
| A.1.4 | 移除归档 schema 中的 `editorialMode` 字段 | `src/core/archive.ts` |
| A.1.5 | 更新测试 — 删除 fallback 测试，新增失败 throw 测试 | `tests/digest-model.test.ts`, `tests/generate-digest.test.ts` |
| A.1.6 | 统一所有 workflow 的 Node 版本为 20 | `.github/workflows/*.yml` |
| A.1.7 | `package.json` 添加 `engines` 字段，版本改为 `1.0.0-alpha.0` | `package.json` |

**验收：** `npm run typecheck` 通过，`npm test` 通过，grep 无 `template_fallback` 残留。

### A.2 端到端排查

这是最关键的步骤。项目历史上从未成功推送过企微消息。

| # | 任务 | 方法 |
|---|------|------|
| A.2.1 | 验证企微 webhook 连通性 | 手动 dispatch `send:wecom:sample`，确认收到消息 |
| A.2.2 | 验证 LLM API 连通性 | 确认 `GR_BASE_URL` + `GR_API_KEY` + `GR_MODEL` 组合可用 |
| A.2.3 | 验证 GitHub token 权限 | 确认 token 有 repo 内容读写权限 |
| A.2.4 | 手动 dispatch 完整 pipeline | workflow_dispatch `daily-digest.yml`，确认企微收到日报 |
| A.2.5 | 验证 cron 时间槽逻辑 | 确认不匹配的 run 是 exit 0（不触发 GitHub 通知邮件） |
| A.2.6 | 验证归档回写 | 确认 `data/history/` 有新文件，`github-runtime.json` 更新 |

**企微从未收到消息的可能根因（按可能性排序）：**
1. Cron 时间槽判断 bug — 从未匹配到发送时间，pipeline 从未真正执行
2. Pipeline 在 LLM 阶段失败 — API 配置错误或 quota 不足
3. 企微 webhook secret 配置错误或过期
4. `--send` 参数未正确传递
5. Workflow 在 push/commit 步骤失败

**GitHub 每天发报错邮件的可能根因：**
1. 每 5 分钟的"跳过"执行 exit 1 而不是 exit 0 → 每天 287 封失败通知
2. Pipeline 真正执行但失败

### A.3 稳定运行验证

| # | 任务 | 验收 |
|---|------|------|
| A.3.1 | 连续 3 天准时收到企微日报 | 3 份日报 |
| A.3.2 | 非命中时间槽的 cron run 全部 exit 0 | GitHub 不再发垃圾邮件 |
| A.3.3 | 当日失败时有清晰日志和企微失败通知 | 故意构造失败场景验证 |
| A.3.4 | 归档和 runtime 文件成功回写 | `data/history/` 有 3 个新文件 |

### Phase A 完成定义 (DoD)

- [x] 连续 3 天准时收到企微日报
- [x] 非命中时间槽的 cron run 全部 exit 0
- [x] 当日失败时有清晰日志和失败通知
- [x] 归档与 runtime 文件成功回写
- [x] 无模板降级代码残留
- [x] Node 版本统一
- [x] `npm test` + `npm run typecheck` 通过

---

## Phase B：可选增强

Phase B 在 Phase A DoD 全部达标后才开始。

### B.1 Web 只读浏览

| # | 任务 | 涉及文件 |
|---|------|---------|
| B.1.1 | 确保 `pages-deploy.yml` 能成功构建和部署 | `.github/workflows/pages-deploy.yml` |
| B.1.2 | Web 页面能加载并展示归档日报列表 | `web/src/` |
| B.1.3 | Web 页面能展示单日日报详情 | `web/src/` |
| B.1.4 | 统一 pages-deploy.yml 的 Node 版本 | `.github/workflows/pages-deploy.yml` |

**限制：** Phase B 的 Web 控制台是**只读的**。不做配置修改、不做反馈提交、不做 PAT 管理。这些功能推到 v2。

### B.2 文档收敛

| # | 任务 | 涉及文件 |
|---|------|---------|
| B.2.1 | 更新 `docs/github-native-roadmap.md` 标记完成状态 | `docs/github-native-roadmap.md` |
| B.2.2 | 确保 README 准确反映 v1 现状 | `README.md` |
| B.2.3 | `package.json` 版本改为 `1.0.0` | `package.json` |

### Phase B 完成定义 (DoD)

- [x] GitHub Pages 站点可访问
- [x] 能浏览最近的日报归档
- [x] README 准确
- [x] 版本号 1.0.0

---

## 不属于 v1 的工作（推到 v2）

| 功能 | 说明 |
|------|------|
| Web 配置修改 | `console-writeback.yml` + Web PAT 管理 |
| 反馈系统 | `src/feedback/` + `data/feedback/` + Web 反馈提交 |
| 反馈闭环 | 反馈影响评分 |
| 环境诊断 workflow | `environment-diagnose.yml` |
| Web 控制台重构 | App.tsx 拆分为独立组件 |
| 探索位逻辑 | `markExplorationItem` — 依赖反馈系统 |

---

## "LLM 失败则当日跳过"的精确语义

| 步骤 | 行为 |
|------|------|
| 生成归档 | **不生成**正式日报归档 |
| runtime state | **必须写** runtime failure（`lastRunStatus: "failure"`） |
| 企微通知 | **发送**失败通知（简要说明失败原因） |
| workflow exit | **exit 1**（失败退出，便于定位） |
| 日志 | `logger.error` 输出结构化错误信息 |
