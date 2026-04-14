# GitRadar v1 — 技术决策记录

## ADR-001: 删除 LLM Fallback 模板模式

**决策：** LLM 3 次失败后直接 throw，当日不生成日报。

**理由：**
- 低质量模板日报不如没有日报——套话降低信任
- 模板代码占 model.ts ~170 行，增加维护负担
- Fallback 掩盖 LLM 配置问题，用户不知道出了问题
- 个人工具，"今天没有日报"是可接受的信号

---

## ADR-002: "当日跳过"的精确语义

**决策：**

| 步骤 | 行为 |
|------|------|
| 日报归档 | 不生成 |
| runtime state | 写入 `lastRunStatus: "failure"` |
| 企微通知 | 发送失败通知（简要原因） |
| workflow exit | exit 1（失败退出） |
| 日志 | `logger.error` 结构化输出 |

**理由：** 审计指出原 spec 未定义这些细节，导致实现时各自理解不同。必须在 spec 中固定。

---

## ADR-003: 非命中时间槽必须 exit 0

**决策：** Cron 每 5 分钟触发时，不匹配发送时间的 run 必须 exit 0，不输出任何失败信号。

**理由：**
- 每天 288 次 cron 触发，只有 1 次是真正执行
- 如果 287 次 exit 1 → GitHub 每天发 287 封邮件（这很可能是当前"GitHub 每天发报错邮件"的根因）
- exit 0 = "我检查了，不是我的时间槽，正常退出"

---

## ADR-004: 统一 Node 版本为 24

**决策：** 所有 workflow 统一 Node 24。`package.json` 添加 `"engines": { "node": ">=24" }`。

**理由：**
- Node 24 已在所有 workflow 中使用
- 最初计划使用 Node 20 LTS，但实践中选择了 Node 24 以利用最新特性
- 消除版本不一致导致的微妙行为差异

---

## ADR-005: 纯 GitHub-native 执行

**决策：** v1 确认纯 GitHub-native 模式。生产执行只通过 GitHub Actions。

**理由：**
- 代码已做到（无 git CLI 依赖），在 spec 中正式确认
- `platform-client.ts`（346 行）设计良好，是可靠基石
- 本地 `npm run generate:digest` 保留为开发调试手段，但不是核心里程碑

**注意（审计修正）：** 原 spec 把"本地端到端运行"列为核心任务项，与 GitHub-native 定位冲突。v1 中本地运行只是调试辅助，验收标准以 GitHub Actions 实际运行为准。

---

## ADR-006: v1 只有两个 Phase

**决策：** Phase A（最小日报主链路）+ Phase B（可选增强）。不再是 5 个 Phase。

**理由（来自审计）：**
- 原 5 Phase 计划把 Web/反馈/写回/稳定化全部塞进 v1，名为"先跑通再完善"，实为复杂系统分期交付
- Phase A/B 两段式让优先级不会漂移：A 做完 = v1 可用，B 是锦上添花
- Phase A 的 DoD 极简明确：连续 3 天收到企微日报

---

## ADR-007: v1 / v2 功能边界

**决策：**

| 功能 | 归属 |
|------|------|
| 抓取 → 评分 → 成稿 → 推送 → 归档 | **v1 Phase A** |
| Web 只读浏览 | **v1 Phase B** |
| Web 配置修改 | v2 |
| 反馈系统 + 反馈闭环 | v2 |
| console-writeback workflow | v2 |
| environment-diagnose workflow | v2 |
| 探索位逻辑 | v2（依赖反馈系统） |
| Web 控制台组件重构 | v2 |

**理由（来自审计）：** "最简单产品"和"完整保留 Web + 反馈"直接冲突。v1 只解决一个问题：每天收到企微日报。

---

## ADR-008: 归档 Schema 版本管理

**决策：** v1 升级到新 schema version，移除 `editorialMode` 字段。Phase B 的 Web 只读浏览需兼容新旧 schema。

**理由：** 已有历史归档（如 2026-03-31.json）不能丢失，通过 `schemaVersion` 字段区分。

---

## ADR-009: Failure Report 简化

**决策：** 倾向简化为纯日志输出（`logger.error`），不再写本地文件。

**理由：**
- GitHub Actions 日志自带持久化
- 当前 `fs.writeFile` 写入的文件在 runner 销毁后消失（除非显式 commit）
- 对个人工具，Actions 日志页面够用

---

## ADR-010: 保留轮询式调度

**决策：** 保留 cron `*/5 * * * *` + 时间槽检查。

**理由：**
- 已实现且工作正常
- 支持通过 `config/schedule.json` 动态调整发送时间
- **关键前提：** 非命中时间槽的 run 必须 exit 0（见 ADR-003）

---

## ADR-011: README 收缩

**决策（已执行）：** README 只保留产品说明、v1 目标、目录说明、常用命令。不再承载社区治理入口。

**理由（来自审计）：** 个人单用户工具不需要 CONTRIBUTING、SECURITY、CODE_OF_CONDUCT、PR 模板等治理文件作为正式入口。
