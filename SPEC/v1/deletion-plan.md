# GitRadar v1 — 删除计划

## 原则

1. **先冻结目录，再改代码** — 先决定哪些目录属于 v1，再动代码
2. 删除的是语义和逻辑，不是追求减少行数
3. "不属于 v1"不等于"物理删除" — 非 v1 的目录保留在仓库中，但不投入工作

---

## 1. 目录级分类

### v1 核心（投入工作）

| 目录/文件 | 角色 |
|----------|------|
| `src/commands/generate-daily-digest.ts` | 主入口 |
| `src/commands/write-github-runtime.ts` | runtime 回写 |
| `src/digest/` | 生成 pipeline |
| `src/github/` | GitHub API 层 |
| `src/config/` | 配置读取 |
| `src/core/` | 核心模型 |
| `src/notifiers/wecom-robot.ts` | 企微推送 |
| `src/utils/` | 工具函数 |
| `config/` | 静态配置文件 |
| `data/history/` | 归档 |
| `data/runtime/` | 运行状态 |
| `tests/` | 测试 |
| `.github/workflows/daily-digest.yml` | 核心 workflow |
| `.github/workflows/ci.yml` | CI |

### 非 v1 核心（保留但冻结）

| 目录/文件 | 归属 | 说明 |
|----------|------|------|
| `web/` | Phase B / v2 | Phase B 做只读浏览，v2 做完整功能 |
| `src/feedback/` | v2 | 反馈系统 |
| `data/feedback/` | v2 | 反馈数据 |
| `.github/workflows/console-writeback.yml` | v2 | 配置/反馈回写 |
| `.github/workflows/pages-deploy.yml` | Phase B | Pages 部署 |
| `.github/workflows/environment-diagnose.yml` | v2 | 环境诊断 |

### 非 v1 相关命令（保留但不是主链路）

| 命令 | 说明 |
|------|------|
| `src/commands/persist-github-files.ts` | 被 workflow 使用，保留 |
| `src/commands/write-environment-report.ts` | 非 v1 核心，保留 |
| `src/commands/process-writeback-request.ts` | v2，保留 |
| `src/commands/validate-digest-rules.ts` | CI 使用，保留 |
| `src/commands/list-feedback.ts` | v2，保留 |
| `src/commands/send-wecom-sample.ts` | 调试工具，保留 |
| `src/commands/analyze-digest.ts` | 工具，保留 |

### 已删除

| 项目 | 状态 |
|------|------|
| `.omx/` | 已删除（非源码元数据） |
| `CODE_OF_CONDUCT.md` | 已删除 |
| `CONTRIBUTING.md` | 已删除 |
| `SUPPORT.md` | 已删除 |
| `SECURITY.md` | 已删除 |
| `.github/ISSUE_TEMPLATE/*` | 已删除 |
| `.github/pull_request_template.md` | 已删除 |
| `.github/CODEOWNERS` | 已删除 |
| `.github/dependabot.yml` | 已删除 |

---

## 2. 代码级删除：LLM Fallback 模板

### 背景

v1 决策：LLM 必须成功，失败则跳过当日。模板降级掩盖问题，增加代码复杂度。

### `src/digest/model.ts` 删除清单

| 行号 | 内容 | 动作 |
|------|------|------|
| 45 | `mode: "llm" \| "template_fallback"` | 删除类型，简化返回值 |
| 43-46 | `GenerateDigestWithResilienceResult` 接口 | 删除整个接口，函数直接返回 `DailyDigest` |
| 141-194 | `generateDigestWithResilience()` | 重写：catch 块直接 throw，不调用模板 |
| 232-254 | `generateDigestWithTemplate()` | 整个删除 |
| 339-355 | `buildTemplateSummary()` | 整个删除 |
| 357-362 | `buildTemplateWhyItMatters()` | 整个删除 |
| 364-376 | `buildTemplateNovelty()` | 整个删除 |
| 378-384 | `buildTemplateTrend()` | 整个删除 |
| 386-388 | `buildFallbackWhyNow()` | 整个删除 |
| 390-402 | `buildFallbackEvidence()` | 整个删除 |

**模板相关辅助函数（审查后决定）：**
- `extractReadableLine()` (404-427) — 检查是否被其他地方引用，若无则删除
- `sanitizeReadmeLine()` / `isReadableReadmeLine()` (429-471) — 同上
- `decodeHtmlEntities()` (473-481) — 同上

**预估删除：~170 行**

### `src/digest/generate.ts` 适配

| 行号 | 内容 | 动作 |
|------|------|------|
| 31 | `import { generateDigestWithResilience }` | 适配新函数签名 |
| 124-152 | `generateDigestWithResilience()` 调用 | 简化：不需要 `onModelFailure` 回调 |
| 187 | `editorialMode: editorialResult.mode` | 删除（永远是 LLM） |
| 236 | `editorialMode: editorialResult.mode` | 删除 |

### 归档 schema 变更

- `DailyDigestArchive.generationMeta.editorialMode` 字段移除
- 升级 `CURRENT_DAILY_DIGEST_ARCHIVE_SCHEMA_VERSION`
- Web 只读浏览（Phase B）需兼容新旧 schema

### 测试更新

| 文件 | 动作 |
|------|------|
| `tests/digest-model.test.ts` | 删除 fallback 测试，新增"3次失败则 throw"测试 |
| `tests/generate-digest.test.ts` | 删除 "falls back to template" 测试 |

---

## 3. Failure Report 简化

### 背景

`src/core/failure-report.ts` 通过 `fs.writeFile` 写入 `data/runtime/failures/`。在 GitHub Actions runner 上，这些文件在 run 结束后消失（除非显式 commit）。

### 决策

简化为纯日志输出（`logger.error`）。Actions 日志自带持久化，对个人工具足够。

如果将来需要结构化持久化，可以在 v2 中通过 GitHub API 写入。

---

## 4. 删除执行顺序

1. 确认目录分类（本文档 §1）
2. 删除 `model.ts` 中的模板代码
3. 更新 `generate.ts` 适配新接口
4. 更新归档 schema
5. 更新测试
6. 简化 failure-report（可选，Phase A 或 B）
7. 统一 Node 版本
8. 运行 `npm test` + `npm run typecheck` 验证
