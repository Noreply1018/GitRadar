# GitRadar v1 规格说明

v1 的目标是跑通最小主链路：GitHub 候选抓取 → 规则筛选 → LLM 成稿 → 企微推送 → 归档回写。

## v1 只做 7 件事

1. 定时从 GitHub Trending 和 Search API 抓取候选项目
2. 对候选项目进行规则评分和主题归类
3. 调用 LLM 从候选池中生成中文日报
4. 推送到企业微信
5. 将日报归档到 `data/history/`
6. 将运行状态写入 `data/runtime/github-runtime.json`
7. 通过 GitHub API 将归档和状态回写到仓库

## 文档

| 文档 | 内容 |
|------|------|
| [audit.md](./audit.md) | 对原始 v1 规划的审计，确定真正的最小边界 |
| [product-design.md](./product-design.md) | 产品设计：五层架构、主链路、配置模型 |
| [technical-decisions.md](./technical-decisions.md) | 11 条技术决策记录（ADR） |

## 关键技术决策

- ADR-001: LLM 失败不降级，直接抛错
- ADR-002: 失败时不生成归档，写 runtime failure，发企微通知，exit 1
- ADR-003: 非命中时间槽必须 exit 0
- ADR-004: 统一 Node 24
- ADR-005: 纯 GitHub-native 执行
- ADR-006: v1 只有 Phase A（主链路）
- ADR-007: v1/v2 功能边界
- ADR-008: 归档 Schema 版本管理
- ADR-009: Failure Report 简化为纯日志
- ADR-010: 保留轮询式调度
- ADR-011: README 收缩
