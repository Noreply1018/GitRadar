# GitRadar v1 Spec

本目录包含 GitRadar v1 的产品设计、删除计划、重建计划和审计结论。

## 阅读顺序

1. **[audit.md](./audit.md)** — 审计结论（对初版 spec 的审计，定义了 v1 的真正边界）
2. **[product-design.md](./product-design.md)** — 产品设计（审计后修订版）
3. **[deletion-plan.md](./deletion-plan.md)** — 删除计划（目录级 + 代码级）
4. **[rebuild-plan.md](./rebuild-plan.md)** — 重建计划（Phase A / Phase B 两段式）
5. **[technical-decisions.md](./technical-decisions.md)** — 技术决策记录（11 条 ADR）

## v1 边界

v1 只做 7 件事：

1. GitHub Actions 定时运行
2. GitHub Trending / Search API 抓候选
3. 评分筛选
4. LLM 生成日报
5. 企业微信推送
6. 归档到 `data/history/`
7. 回写 `data/runtime/github-runtime.json`

**Web 只读浏览**是 Phase B 可选增强。
**Web 配置修改、反馈系统、反馈闭环**推到 v2。

## Phase 结构

| Phase | 内容 | 完成定义 |
|-------|------|---------|
| **Phase A** | 最小日报主链路 | 连续 3 天收到企微日报，cron 不发垃圾邮件 |
| **Phase B** | Web 只读浏览 + 文档收敛 | Pages 站点可访问，版本号 1.0.0 |

## 关键技术决策

- LLM 失败 → 不生成归档 + 写 runtime failure + 企微发失败通知 + exit 1
- 非命中时间槽 → exit 0（不触发 GitHub 通知）
- Node 版本统一为 20
- 删除 LLM fallback 模板代码
