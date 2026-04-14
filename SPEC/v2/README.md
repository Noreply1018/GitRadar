# GitRadar v2 Spec

v2 的前提是 v1 Phase A 已达标（连续 3 天收到企微日报）。

本文档记录从 v1 推迟到 v2 的全部功能，作为后续工作的索引。v2 的详细设计在 v1 稳定运行后再展开。

## v2 功能清单

以下功能在 v1 审计中被明确排除出 v1 范围（见 `SPEC/v1/audit.md`）。

### Web 控制台完整功能

| 功能 | 依赖 | 说明 |
|------|------|------|
| 配置修改 | console-writeback workflow | Web 上修改 schedule / preferences → workflow_dispatch → PR 或 commit |
| 反馈提交 | console-writeback workflow | Web 上标记 saved/skipped/later → 写入 feedback 数据 |
| PAT 管理 | Web 前端 | 浏览器本地存储 GitHub PAT，用于触发 workflow_dispatch |
| 组件重构 | 无 | App.tsx (1406行) 拆分为 EnvironmentView / PreferencesView / SavedView / ArchiveView + 共享 hooks |

### 反馈系统

| 功能 | 涉及目录 | 说明 |
|------|---------|------|
| 反馈采集 | `src/feedback/`, `data/feedback/` | saved/skipped/later 事件流 + 聚合状态 |
| 反馈闭环 | `src/digest/rules.ts`, `src/digest/generate.ts` | FeedbackState 影响评分层权重 |
| 探索位 | `src/digest/generate.ts` markExplorationItem | 基于反馈 insights 选出舒适区外的项目 |

### Workflow

| Workflow | 说明 |
|----------|------|
| `console-writeback.yml` | 接收 Web 的配置/反馈写入请求，创建 PR 或直接 commit |
| `environment-diagnose.yml` | 定期环境诊断（GitHub/LLM/企微连通性），频率待定 |

## v2 不做什么

以下在可预见的将来都不做：

- 多用户 / 权限 / 注册
- Email / Slack / Telegram 等其他推送渠道
- 本地运行模式作为正式链路
- 社区治理流程（CONTRIBUTING, SECURITY 等）

## 涉及的现有代码

这些代码在 v1 中保留但冻结（不投入工作），v2 中解冻：

```
web/                                    # React SPA 完整功能
src/feedback/                           # 反馈系统
  ├── store.ts                          # 反馈持久化
  ├── model.ts                          # 反馈事件类型
  └── insights.ts                       # 反馈分析
data/feedback/                          # 反馈数据
  ├── feedback-events.jsonl
  └── feedback-state.json
src/commands/process-writeback-request.ts  # writeback 命令
src/commands/list-feedback.ts              # 反馈列表命令
.github/workflows/console-writeback.yml    # 配置/反馈回写
.github/workflows/environment-diagnose.yml # 环境诊断
.github/workflows/pages-deploy.yml         # Pages 部署（v1 Phase B 可能已启用只读模式）
```

## 启动条件

v2 工作在以下条件全部满足后才开始详细设计：

1. v1 Phase A DoD 全部达标
2. 至少连续 7 天无需人工干预，每天收到日报
3. 用户明确提出需要 Web 配置修改或反馈功能
