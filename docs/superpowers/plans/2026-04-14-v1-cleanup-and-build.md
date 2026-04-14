# GitRadar v1 最终清扫与构建计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 清除所有旧语义/冲突语义/无用代码，修正项目元数据，补齐测试基础设施，完成 v1 版本构建。

**Architecture:** 当前主链路代码已就绪（抓取 → 评分 → 成稿 → 推送 → 归档），但仓库大清扫后残留了死代码、已废弃的 SPEC 引用、以及 v2 功能遗留字段。本计划按"代码清扫 → 元数据修正 → SPEC 收敛 → 测试补齐 → 最终验证"的顺序推进。

**Tech Stack:** TypeScript 5.9, Node 24, undici, vitest (新增)

---

## 审计发现摘要

| 类别 | 问题 | 位置 |
|------|------|------|
| **死代码** | 调度模块整体未被任何文件引用 | `src/core/schedule.ts`, `src/config/schedule.ts` |
| **死代码** | 探索位字段（v2 功能残留） | `src/core/digest.ts:11-12`, `src/core/archive.ts:154-155` |
| **死代码** | 企微失败通知方法（workflow 用内联 JS 代替） | `wecom-robot.ts` 中的 `sendWorkflowFailureAlert` 等 |
| **死代码** | `maskApiKey` 从未被调用 | `src/config/mask.ts:16` |
| **死代码** | `getMaskedWebhook` 从未被外部调用 | `wecom-robot.ts:44` |
| **语义冲突** | `package.json` 版本 `3.0.0` | 应为 `1.0.0` |
| **语义冲突** | ADR-004 写 Node 20，实际全部 Node 24 | `SPEC/v1/technical-decisions.md` |
| **过时文档** | deletion-plan.md 引用已删除的文件/目录 | `SPEC/v1/deletion-plan.md` |
| **过时文档** | rebuild-plan.md 引用已删除的代码和测试 | `SPEC/v1/rebuild-plan.md` |
| **缺失** | 无测试框架、无测试、无 `npm test` 脚本 | `package.json`, `tsconfig.json` |
| **缺失** | 无 `engines` 字段 | `package.json` |

---

## 文件结构总览

### 将要删除的文件

| 文件 | 原因 |
|------|------|
| `src/core/schedule.ts` | 仅被 `config/schedule.ts` 引用，后者也是死代码 |
| `src/config/schedule.ts` | 无任何外部引用，属于已删除的回写系统 |
| `SPEC/v1/deletion-plan.md` | 清扫已完成，内容全部过时 |
| `SPEC/v1/rebuild-plan.md` | Phase A 代码清理部分已完成，引用的代码和测试已不存在 |

### 将要创建的文件

| 文件 | 职责 |
|------|------|
| `tests/core/date.test.ts` | date.ts 单元测试 |
| `tests/core/archive.test.ts` | archive schema 验证测试 |
| `tests/config/mask.test.ts` | mask.ts 单元测试 |
| `tests/config/digest-rules.test.ts` | digest-rules.json 校验测试 |
| `tests/digest/model.test.ts` | LLM 成稿逻辑测试 |
| `tests/digest/rules.test.ts` | 规则筛选逻辑测试 |
| `tests/github/trending.test.ts` | trending 解析测试 |
| `tests/notifiers/wecom-robot.test.ts` | 企微渲染测试 |
| `tests/commands/validate-digest-rules.test.ts` | 校验命令测试 |
| `vitest.config.ts` | vitest 配置 |

### 将要修改的文件

| 文件 | 修改内容 |
|------|---------|
| `src/core/digest.ts` | 移除 `readerTag`, `readerNote` 字段 |
| `src/core/archive.ts` | 移除探索位校验逻辑 |
| `src/config/mask.ts` | 移除 `maskApiKey` |
| `src/notifiers/wecom-robot.ts` | 移除失败通知方法、`getMaskedWebhook`、未使用的 import |
| `package.json` | 版本改为 `1.0.0`、添加 `engines`、添加 `test` 脚本、添加 vitest 依赖 |
| `SPEC/v1/technical-decisions.md` | 更新 ADR-004 Node 版本为 24 |
| `SPEC/v1/README.md` | 移除对已删除文档的引用 |

---

### Task 1: 删除死代码 — 调度模块

两个调度文件形成一个孤岛：`core/schedule.ts` 只被 `config/schedule.ts` 引用，而 `config/schedule.ts` 不被任何文件引用。工作流通过内联 JS 直接读取 `config/schedule.json`，不依赖这些 TypeScript 模块。

**Files:**
- Delete: `src/core/schedule.ts`
- Delete: `src/config/schedule.ts`

- [ ] **Step 1: 删除 `src/core/schedule.ts`**

```bash
rm src/core/schedule.ts
```

- [ ] **Step 2: 删除 `src/config/schedule.ts`**

```bash
rm src/config/schedule.ts
```

- [ ] **Step 3: 运行 typecheck 确认无破坏**

Run: `npx tsc --noEmit`
Expected: 无错误输出

- [ ] **Step 4: Commit**

```bash
git add -u
git commit -m "refactor: remove dead schedule modules

These files were only referenced by each other. The workflow reads
config/schedule.json directly via inline JS."
```

---

### Task 2: 删除死代码 — 探索位字段

`readerTag` 和 `readerNote` 是探索位系统的残留，该系统已明确移至 v2（依赖反馈系统）。当前没有任何代码设置这些字段。

**Files:**
- Modify: `src/core/digest.ts:11-12`
- Modify: `src/core/archive.ts:154-155`

- [ ] **Step 1: 从 DigestItem 移除探索位字段**

在 `src/core/digest.ts` 中，删除 `readerTag` 和 `readerNote`：

```typescript
// Before (lines 11-12):
  readerTag?: "exploration";
  readerNote?: string;

// After: 删除这两行
```

修改后 `DigestItem` 完整定义：

```typescript
export interface DigestItem {
  repo: string;
  url: string;
  theme: string;
  summary: string;
  whyItMatters: string;
  whyNow: string;
  evidence: string[];
  novelty: string;
  trend: string;
}
```

- [ ] **Step 2: 从 archive.ts 移除探索位校验**

在 `src/core/archive.ts` 的 `isValidDigestItem` 函数中，删除 lines 154-155：

```typescript
// Before:
    typeof item.trend === "string" &&
    (item.readerTag === undefined || item.readerTag === "exploration") &&
    (item.readerNote === undefined || typeof item.readerNote === "string")

// After:
    typeof item.trend === "string"
```

- [ ] **Step 3: 运行 typecheck 确认无破坏**

Run: `npx tsc --noEmit`
Expected: 无错误输出

- [ ] **Step 4: Commit**

```bash
git add src/core/digest.ts src/core/archive.ts
git commit -m "refactor: remove exploration system remnants from DigestItem

readerTag and readerNote belong to the v2 feedback/exploration system.
No code in the current pipeline sets these fields."
```

---

### Task 3: 删除死代码 — 企微失败通知与未使用方法

`sendWorkflowFailureAlert` 及其相关类型/渲染函数从未被外部调用——工作流的失败通知用内联 JS 实现。`getMaskedWebhook` 也从未被外部调用。

**Files:**
- Modify: `src/notifiers/wecom-robot.ts`

- [ ] **Step 1: 移除 `WecomWorkflowFailureAlert` 接口**

在 `src/notifiers/wecom-robot.ts` 中，删除 lines 21-27：

```typescript
// Delete:
export interface WecomWorkflowFailureAlert {
  workflowName: string;
  trigger: string;
  failedAt: string;
  runUrl: string;
  details?: string;
}
```

- [ ] **Step 2: 移除 `sendWorkflowFailureAlert` 方法**

在 `WecomRobotNotifier` class 中，删除 lines 38-42：

```typescript
// Delete:
  async sendWorkflowFailureAlert(
    alert: WecomWorkflowFailureAlert,
  ): Promise<void> {
    await this.sendPayload(renderWecomWorkflowFailurePayload(alert));
  }
```

- [ ] **Step 3: 移除 `getMaskedWebhook` 方法和未使用的 import**

在 `WecomRobotNotifier` class 中，删除 `getMaskedWebhook` 方法 (lines 44-46)：

```typescript
// Delete:
  getMaskedWebhook(): string {
    return maskWebhookUrl(this.webhookUrl);
  }
```

同时删除文件顶部的 `maskWebhookUrl` import (line 4)：

```typescript
// Delete:
import { maskWebhookUrl } from "../config/mask";
```

- [ ] **Step 4: 移除 `renderWecomWorkflowFailurePayload` 和 `renderWecomWorkflowFailureMarkdown`**

删除这两个导出函数（文件末尾区域）：

```typescript
// Delete renderWecomWorkflowFailurePayload:
export function renderWecomWorkflowFailurePayload(
  alert: WecomWorkflowFailureAlert,
): WecomRobotPayload {
  return {
    msgtype: "markdown",
    markdown: {
      content: renderWecomWorkflowFailureMarkdown(alert),
    },
  };
}

// Delete renderWecomWorkflowFailureMarkdown:
export function renderWecomWorkflowFailureMarkdown(
  alert: WecomWorkflowFailureAlert,
): string {
  // ... entire function body
}
```

- [ ] **Step 5: 运行 typecheck 确认无破坏**

Run: `npx tsc --noEmit`
Expected: 无错误输出

- [ ] **Step 6: Commit**

```bash
git add src/notifiers/wecom-robot.ts
git commit -m "refactor: remove unused failure alert and masking from WecomRobotNotifier

sendWorkflowFailureAlert is never called - the workflow handles failure
notification with inline JS. getMaskedWebhook is also unreferenced."
```

---

### Task 4: 删除死代码 — maskApiKey

`maskApiKey` 在 `src/config/mask.ts` 中定义但从未被任何文件调用。

**Files:**
- Modify: `src/config/mask.ts`

- [ ] **Step 1: 移除 `maskApiKey` 函数**

在 `src/config/mask.ts` 中，删除整个 `maskApiKey` 函数（lines 16-29）：

```typescript
// Delete:
export function maskApiKey(value: string): string {
  if (value.length <= 4) {
    return "***";
  }

  const prefix = value.slice(0, 2);
  const suffix = value.slice(-2);
  return `${prefix}***${suffix}`;
}
```

修改后 `mask.ts` 只保留 `maskWebhookUrl`：

```typescript
export function maskWebhookUrl(value: string): string {
  try {
    const url = new URL(value);
    const masked = `${url.origin}${url.pathname}`;
    return url.search || url.hash ? `${masked}?***` : masked;
  } catch {
    if (value.length <= 6) {
      return "***";
    }

    return `${value.slice(0, 3)}***${value.slice(-3)}`;
  }
}
```

- [ ] **Step 2: 运行 typecheck 确认无破坏**

Run: `npx tsc --noEmit`
Expected: 无错误输出

- [ ] **Step 3: Commit**

```bash
git add src/config/mask.ts
git commit -m "refactor: remove unused maskApiKey function"
```

---

### Task 5: 修正 package.json 元数据

版本号 `3.0.0` 来自历史版本，不反映 v1 重建的语义。需要重置为 `1.0.0`，并添加 `engines` 字段锁定 Node 24。

**Files:**
- Modify: `package.json`

- [ ] **Step 1: 更新 package.json**

修改 `package.json` 中的 `version` 和新增 `engines` 字段：

```json
{
  "name": "gitradar",
  "version": "1.0.0",
  "license": "MIT",
  "private": false,
  "description": "Minimal GitHub-native daily digest pipeline for open-source discovery.",
  "engines": {
    "node": ">=24"
  },
  "scripts": {
    "generate:digest": "tsx src/commands/generate-daily-digest.ts",
    "generate:digest:send": "tsx src/commands/generate-daily-digest.ts --send",
    "runtime:github": "tsx src/commands/write-github-runtime.ts",
    "persist:github": "tsx src/commands/persist-github-files.ts",
    "validate:digest-rules": "tsx src/commands/validate-digest-rules.ts",
    "typecheck": "tsc --noEmit"
  },
  "devDependencies": {
    "@types/node": "24.5.2",
    "dotenv": "17.2.2",
    "tsx": "4.20.5",
    "typescript": "5.9.2",
    "undici": "7.24.5"
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add package.json
git commit -m "chore: set version to 1.0.0 and add engines field for Node 24"
```

---

### Task 6: 收敛 SPEC 文档

清扫后 SPEC 中有两份文档已完全过时：`deletion-plan.md`（列出的删除任务已全部完成）和 `rebuild-plan.md`（引用的代码/测试已不存在，Phase A DoD 勾选但实际未达标）。ADR-004 的 Node 版本描述与实际不符。

**Files:**
- Delete: `SPEC/v1/deletion-plan.md`
- Delete: `SPEC/v1/rebuild-plan.md`
- Modify: `SPEC/v1/technical-decisions.md`
- Modify: `SPEC/v1/README.md`

- [ ] **Step 1: 删除已完成的计划文档**

```bash
rm SPEC/v1/deletion-plan.md
rm SPEC/v1/rebuild-plan.md
```

- [ ] **Step 2: 更新 ADR-004 Node 版本**

在 `SPEC/v1/technical-decisions.md` 中，将 ADR-004 整段替换为：

```markdown
## ADR-004: 统一 Node 版本为 24

**决策：** 所有 workflow 统一 Node 24。`package.json` 添加 `"engines": { "node": ">=24" }`。

**理由：**
- Node 24 已在所有 workflow 中使用
- 最初计划使用 Node 20 LTS，但实践中选择了 Node 24 以利用最新特性
- 消除版本不一致导致的微妙行为差异
```

- [ ] **Step 3: 更新 SPEC/v1/README.md**

将 `SPEC/v1/README.md` 更新为只引用仍然存在的文档：

```markdown
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
```

- [ ] **Step 4: 运行 typecheck 确认无影响**

Run: `npx tsc --noEmit`
Expected: 无错误输出

- [ ] **Step 5: Commit**

```bash
git add -u SPEC/
git commit -m "docs: prune stale SPEC documents and update ADR-004 to Node 24

deletion-plan.md and rebuild-plan.md are fully completed and reference
files/code that no longer exist. ADR-004 updated from Node 20 to 24
to match actual workflow configuration."
```

---

### Task 7: 添加测试基础设施

当前仓库没有测试框架。添加 vitest 作为测试运行器，配置 `npm test` 脚本。

**Files:**
- Create: `vitest.config.ts`
- Modify: `package.json`

- [ ] **Step 1: 安装 vitest**

```bash
npm install --save-dev vitest
```

- [ ] **Step 2: 创建 vitest.config.ts**

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
  },
});
```

- [ ] **Step 3: 在 package.json 添加 test 脚本**

在 `scripts` 中添加：

```json
"test": "vitest run"
```

- [ ] **Step 4: 确认测试命令可运行**

Run: `npm test`
Expected: 输出 "no test files found"（因为还没有测试文件），但命令本身不报错

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json vitest.config.ts
git commit -m "chore: add vitest test infrastructure"
```

---

### Task 8: 编写核心模块测试 — date.ts

`date.ts` 提供日期工具函数，是归档命名和评分计算的基础。

**Files:**
- Create: `tests/core/date.test.ts`

- [ ] **Step 1: 编写测试**

```typescript
import { describe, expect, it } from "vitest";
import {
  getCurrentDigestDate,
  getIsoTimestamp,
  getDateDaysAgo,
  getDaysSince,
} from "../../src/core/date";

describe("getCurrentDigestDate", () => {
  it("returns a YYYY-MM-DD string", () => {
    const result = getCurrentDigestDate();
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe("getIsoTimestamp", () => {
  it("returns an ISO 8601 string", () => {
    const result = getIsoTimestamp();
    expect(() => new Date(result).toISOString()).not.toThrow();
  });
});

describe("getDateDaysAgo", () => {
  it("returns a YYYY-MM-DD string for a given number of days ago", () => {
    const result = getDateDaysAgo(7);
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("returns today (UTC) when days is 0", () => {
    const todayUtc = new Date().toISOString().slice(0, 10);
    expect(getDateDaysAgo(0)).toBe(todayUtc);
  });
});

describe("getDaysSince", () => {
  it("returns 0 for today", () => {
    const today = new Date().toISOString();
    expect(getDaysSince(today)).toBe(0);
  });

  it("returns positive number for past dates", () => {
    const pastDate = new Date(Date.now() - 3 * 86400000).toISOString();
    expect(getDaysSince(pastDate)).toBeGreaterThanOrEqual(2);
    expect(getDaysSince(pastDate)).toBeLessThanOrEqual(4);
  });
});
```

- [ ] **Step 2: 运行测试确认通过**

Run: `npm test -- tests/core/date.test.ts`
Expected: 所有测试 PASS

- [ ] **Step 3: Commit**

```bash
git add tests/core/date.test.ts
git commit -m "test: add unit tests for core/date module"
```

---

### Task 9: 编写核心模块测试 — mask.ts

**Files:**
- Create: `tests/config/mask.test.ts`

- [ ] **Step 1: 编写测试**

```typescript
import { describe, expect, it } from "vitest";
import { maskWebhookUrl } from "../../src/config/mask";

describe("maskWebhookUrl", () => {
  it("masks query string for valid URLs", () => {
    const result = maskWebhookUrl(
      "https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=abc123",
    );
    expect(result).toBe(
      "https://qyapi.weixin.qq.com/cgi-bin/webhook/send?***",
    );
  });

  it("returns full URL when no query or hash", () => {
    const result = maskWebhookUrl("https://example.com/webhook");
    expect(result).toBe("https://example.com/webhook");
  });

  it("masks middle of non-URL strings", () => {
    const result = maskWebhookUrl("not-a-url-but-long-enough");
    expect(result).toBe("not***ugh");
  });

  it("masks short non-URL strings completely", () => {
    const result = maskWebhookUrl("short");
    expect(result).toBe("***");
  });
});
```

- [ ] **Step 2: 运行测试确认通过**

Run: `npm test -- tests/config/mask.test.ts`
Expected: 所有测试 PASS

- [ ] **Step 3: Commit**

```bash
git add tests/config/mask.test.ts
git commit -m "test: add unit tests for config/mask module"
```

---

### Task 10: 编写核心模块测试 — archive.ts

归档是主链路的数据持久化层。测试 schema 验证逻辑确保归档格式正确。

**Files:**
- Create: `tests/core/archive.test.ts`

- [ ] **Step 1: 编写测试**

```typescript
import { describe, expect, it } from "vitest";
import {
  parseDailyDigestArchive,
  CURRENT_DAILY_DIGEST_ARCHIVE_SCHEMA_VERSION,
} from "../../src/core/archive";

function buildValidArchive() {
  return {
    schemaVersion: CURRENT_DAILY_DIGEST_ARCHIVE_SCHEMA_VERSION,
    generatedAt: "2026-04-14T08:17:00.000Z",
    candidateCount: 30,
    shortlistedCount: 20,
    digest: {
      date: "2026-04-14",
      title: "GitRadar · 2026-04-14",
      items: [
        {
          repo: "owner/repo",
          url: "https://github.com/owner/repo",
          theme: "AI Agents",
          summary: "用于编排多步骤 AI 工作流的框架",
          whyItMatters: "降低 agent 开发门槛",
          whyNow: "近一周 star 涨幅 300%",
          evidence: ["7日 star +1200", "trending 上榜"],
          novelty: "首个同时支持同步和异步 agent 的框架",
          trend: "连续两周出现在 trending",
        },
      ],
    },
    candidates: [],
    shortlisted: [],
    selection: {
      llmCandidateRepos: ["owner/repo"],
      selected: [
        {
          repo: "owner/repo",
          theme: "AI Agents",
          reason: "综合评分最高",
          evidence: ["7日 star +1200"],
        },
      ],
      rejected: [],
    },
    generationMeta: {
      sourceCounts: {
        trending: 15,
        search_recently_updated: 10,
        search_recently_created: 5,
      },
      llmCandidateCount: 12,
      rulesVersion: "2026-03-evidence-v1",
    },
  };
}

describe("parseDailyDigestArchive", () => {
  it("parses a valid archive", () => {
    const archive = buildValidArchive();
    const result = parseDailyDigestArchive(archive, "test");
    expect(result.schemaVersion).toBe(
      CURRENT_DAILY_DIGEST_ARCHIVE_SCHEMA_VERSION,
    );
    expect(result.digest.items).toHaveLength(1);
    expect(result.digest.items[0].repo).toBe("owner/repo");
  });

  it("returns a defensive clone", () => {
    const archive = buildValidArchive();
    const result = parseDailyDigestArchive(archive, "test");
    result.digest.items[0].repo = "mutated";
    const result2 = parseDailyDigestArchive(archive, "test");
    expect(result2.digest.items[0].repo).toBe("owner/repo");
  });

  it("rejects archives with wrong schema version", () => {
    const archive = buildValidArchive();
    archive.schemaVersion = 99 as typeof archive.schemaVersion;
    expect(() => parseDailyDigestArchive(archive, "test")).toThrow(
      /not supported/,
    );
  });

  it("rejects null input", () => {
    expect(() => parseDailyDigestArchive(null, "test")).toThrow(
      /not supported/,
    );
  });

  it("rejects archive missing digest items", () => {
    const archive = buildValidArchive();
    (archive.digest as Record<string, unknown>).items = "not-an-array";
    expect(() => parseDailyDigestArchive(archive, "test")).toThrow(
      /not supported/,
    );
  });

  it("rejects archive with invalid selection entry", () => {
    const archive = buildValidArchive();
    archive.selection.selected[0].evidence = "not-an-array" as unknown as string[];
    expect(() => parseDailyDigestArchive(archive, "test")).toThrow(
      /not supported/,
    );
  });
});
```

- [ ] **Step 2: 运行测试确认通过**

Run: `npm test -- tests/core/archive.test.ts`
Expected: 所有测试 PASS

- [ ] **Step 3: Commit**

```bash
git add tests/core/archive.test.ts
git commit -m "test: add unit tests for core/archive schema validation"
```

---

### Task 11: 编写管道测试 — digest rules

规则筛选是主链路的质量守门员。测试 `selectCandidatesForDigest` 和 `buildDigestCandidatePool` 的核心逻辑。

**Files:**
- Create: `tests/digest/rules.test.ts`

- [ ] **Step 1: 编写测试**

```typescript
import { describe, expect, it } from "vitest";
import {
  selectCandidatesForDigest,
  buildDigestCandidatePool,
  getRulesVersion,
} from "../../src/digest/rules";
import type { GitHubCandidateRepo } from "../../src/github/types";

function buildCandidate(
  overrides: Partial<GitHubCandidateRepo> = {},
): GitHubCandidateRepo {
  return {
    repo: "owner/test-repo",
    url: "https://github.com/owner/test-repo",
    description: "A framework for building AI agents with tool orchestration",
    stars: 500,
    forks: 50,
    language: "TypeScript",
    topics: ["ai", "agents"],
    createdAt: new Date(Date.now() - 90 * 86400000).toISOString(),
    updatedAt: new Date(Date.now() - 1 * 86400000).toISOString(),
    pushedAt: new Date(Date.now() - 1 * 86400000).toISOString(),
    archived: false,
    disabled: false,
    fork: false,
    sources: ["trending"],
    ...overrides,
  };
}

describe("getRulesVersion", () => {
  it("returns a non-empty version string", () => {
    expect(getRulesVersion()).toBeTruthy();
    expect(typeof getRulesVersion()).toBe("string");
  });
});

describe("selectCandidatesForDigest", () => {
  it("filters out archived repos", () => {
    const candidates = [
      buildCandidate({ repo: "a/active" }),
      buildCandidate({ repo: "b/archived", archived: true }),
    ];
    const result = selectCandidatesForDigest(candidates, 20);
    expect(result.every((c) => !c.archived)).toBe(true);
  });

  it("filters out forks", () => {
    const candidates = [
      buildCandidate({ repo: "a/original" }),
      buildCandidate({ repo: "b/forked", fork: true }),
    ];
    const result = selectCandidatesForDigest(candidates, 20);
    expect(result.every((c) => !c.fork)).toBe(true);
  });

  it("filters out repos without description", () => {
    const candidates = [
      buildCandidate({ repo: "a/described" }),
      buildCandidate({ repo: "b/empty", description: "" }),
    ];
    const result = selectCandidatesForDigest(candidates, 20);
    expect(result.every((c) => c.description)).toBe(true);
  });

  it("respects maxCount limit", () => {
    const candidates = Array.from({ length: 30 }, (_, i) =>
      buildCandidate({ repo: `owner/repo-${i}`, stars: 1000 - i }),
    );
    const result = selectCandidatesForDigest(candidates, 5);
    expect(result.length).toBeLessThanOrEqual(5);
  });
});

describe("buildDigestCandidatePool", () => {
  it("splits candidates into selected and rejected", () => {
    const candidates = Array.from({ length: 20 }, (_, i) =>
      buildCandidate({
        repo: `owner/repo-${i}`,
        stars: 1000 - i * 10,
        theme: i % 2 === 0 ? "AI Agents" : "Developer Tools",
        ruleScore: 100 - i,
      }),
    );
    const result = buildDigestCandidatePool(candidates, 10);
    expect(result.selected.length + result.rejected.length).toBe(
      candidates.length,
    );
    expect(result.selected.length).toBeLessThanOrEqual(10);
  });
});
```

- [ ] **Step 2: 运行测试确认通过**

Run: `npm test -- tests/digest/rules.test.ts`
Expected: 所有测试 PASS

- [ ] **Step 3: Commit**

```bash
git add tests/digest/rules.test.ts
git commit -m "test: add unit tests for digest/rules filtering and pool building"
```

---

### Task 12: 编写管道测试 — GitHub trending 解析

trending 解析是纯函数，无外部依赖，适合单元测试。

**Files:**
- Create: `tests/github/trending.test.ts`

- [ ] **Step 1: 编写测试**

```typescript
import { describe, expect, it } from "vitest";
import { parseTrendingRepositoryNames } from "../../src/github/trending";

describe("parseTrendingRepositoryNames", () => {
  it("extracts repo names from trending HTML", () => {
    const html = `
      <article>
        <h2><a href="/facebook/react">facebook / react</a></h2>
      </article>
      <article>
        <h2><a href="/vercel/next.js">vercel / next.js</a></h2>
      </article>
    `;
    const result = parseTrendingRepositoryNames(html);
    expect(result).toContain("facebook/react");
    expect(result).toContain("vercel/next.js");
  });

  it("returns empty array for non-matching HTML", () => {
    const result = parseTrendingRepositoryNames("<html><body>nothing</body></html>");
    expect(result).toEqual([]);
  });

  it("deduplicates repo names", () => {
    const html = `
      <h2><a href="/owner/repo">1</a></h2>
      <h2><a href="/owner/repo">2</a></h2>
    `;
    const result = parseTrendingRepositoryNames(html);
    expect(result).toEqual(["owner/repo"]);
  });
});
```

- [ ] **Step 2: 运行测试确认通过**

Run: `npm test -- tests/github/trending.test.ts`
Expected: 所有测试 PASS

- [ ] **Step 3: Commit**

```bash
git add tests/github/trending.test.ts
git commit -m "test: add unit tests for GitHub trending HTML parser"
```

---

### Task 13: 编写管道测试 — 企微渲染

企微 Markdown 渲染有 4096 字节分页逻辑，是容易出 bug 的边界区域。

**Files:**
- Create: `tests/notifiers/wecom-robot.test.ts`

- [ ] **Step 1: 编写测试**

```typescript
import { describe, expect, it } from "vitest";
import {
  renderWecomMarkdownPages,
  renderWecomMarkdown,
  renderWecomMarkdownPayloads,
} from "../../src/notifiers/wecom-robot";
import type { DailyDigest } from "../../src/core/digest";

function buildDigest(itemCount: number): DailyDigest {
  return {
    date: "2026-04-14",
    title: "GitRadar · 2026-04-14",
    items: Array.from({ length: itemCount }, (_, i) => ({
      repo: `owner/repo-${i}`,
      url: `https://github.com/owner/repo-${i}`,
      theme: "AI Agents",
      summary: `用于编排多步骤 AI 工作流的框架 ${i}`,
      whyItMatters: "降低 agent 开发门槛",
      whyNow: "近一周 star 涨幅 300%",
      evidence: ["7日 star +1200", "trending 上榜"],
      novelty: "首个同时支持同步和异步 agent 的框架",
      trend: "连续两周出现在 trending",
    })),
  };
}

describe("renderWecomMarkdownPages", () => {
  it("renders a single page for small digest", () => {
    const digest = buildDigest(2);
    const pages = renderWecomMarkdownPages(digest);
    expect(pages.length).toBe(1);
    expect(pages[0]).toContain("GitRadar");
  });

  it("splits into multiple pages when exceeding byte limit", () => {
    const digest = buildDigest(8);
    const pages = renderWecomMarkdownPages(digest);
    for (const page of pages) {
      const byteLength = Buffer.byteLength(page, "utf8");
      expect(byteLength).toBeLessThanOrEqual(4096);
    }
  });

  it("includes all items across pages", () => {
    const digest = buildDigest(8);
    const pages = renderWecomMarkdownPages(digest);
    const combined = pages.join("\n");
    for (const item of digest.items) {
      expect(combined).toContain(item.repo);
    }
  });
});

describe("renderWecomMarkdown", () => {
  it("returns a non-empty string", () => {
    const digest = buildDigest(3);
    const result = renderWecomMarkdown(digest);
    expect(result.length).toBeGreaterThan(0);
  });
});

describe("renderWecomMarkdownPayloads", () => {
  it("returns payload objects with msgtype markdown", () => {
    const digest = buildDigest(3);
    const payloads = renderWecomMarkdownPayloads(digest);
    for (const payload of payloads) {
      expect(payload.msgtype).toBe("markdown");
      expect(payload.markdown.content).toBeTruthy();
    }
  });
});
```

- [ ] **Step 2: 运行测试确认通过**

Run: `npm test -- tests/notifiers/wecom-robot.test.ts`
Expected: 所有测试 PASS

- [ ] **Step 3: Commit**

```bash
git add tests/notifiers/wecom-robot.test.ts
git commit -m "test: add unit tests for WeCom markdown rendering and pagination"
```

---

### Task 14: 编写命令测试 — validate-digest-rules

`validate-digest-rules` 是 CI 的一部分，确保 `config/digest-rules.json` 格式正确。

**Files:**
- Create: `tests/commands/validate-digest-rules.test.ts`

- [ ] **Step 1: 编写测试**

```typescript
import { describe, expect, it } from "vitest";
import {
  parseValidateDigestRulesArgs,
  buildDigestRulesSummary,
  renderDigestRulesSummary,
} from "../../src/commands/validate-digest-rules";
import {
  loadDigestRulesConfig,
  getDefaultDigestRulesConfigPath,
} from "../../src/config/digest-rules";

describe("parseValidateDigestRulesArgs", () => {
  it("defaults to text format with no args", () => {
    const result = parseValidateDigestRulesArgs([]);
    expect(result.format).toBe("text");
  });

  it("accepts --format json", () => {
    const result = parseValidateDigestRulesArgs(["--format", "json"]);
    expect(result.format).toBe("json");
  });

  it("throws on unsupported argument", () => {
    expect(() => parseValidateDigestRulesArgs(["--unknown"])).toThrow();
  });
});

describe("buildDigestRulesSummary", () => {
  const configPath = getDefaultDigestRulesConfigPath();
  const config = loadDigestRulesConfig(configPath);

  it("returns a summary with theme count", () => {
    const summary = buildDigestRulesSummary(config, configPath);
    expect(summary.themeCount).toBeGreaterThan(0);
  });

  it("includes blacklist sizes", () => {
    const summary = buildDigestRulesSummary(config, configPath);
    expect(summary.descriptionBlacklistCount).toBeGreaterThanOrEqual(0);
    expect(summary.topicBlacklistCount).toBeGreaterThanOrEqual(0);
  });
});

describe("renderDigestRulesSummary", () => {
  it("renders a non-empty text summary", () => {
    const configPath = getDefaultDigestRulesConfigPath();
    const config = loadDigestRulesConfig(configPath);
    const summary = buildDigestRulesSummary(config, configPath);
    const text = renderDigestRulesSummary(summary);
    expect(text.length).toBeGreaterThan(0);
    expect(text).toContain("Themes");
  });
});
```

- [ ] **Step 2: 运行测试确认通过**

Run: `npm test -- tests/commands/validate-digest-rules.test.ts`
Expected: 所有测试 PASS

- [ ] **Step 3: Commit**

```bash
git add tests/commands/validate-digest-rules.test.ts
git commit -m "test: add unit tests for validate-digest-rules command"
```

---

### Task 15: 编写管道测试 — digest-rules config 加载

`config/digest-rules.ts` 有 618 行校验逻辑，确保 `config/digest-rules.json` 通过完整校验。

**Files:**
- Create: `tests/config/digest-rules.test.ts`

- [ ] **Step 1: 编写测试**

```typescript
import { describe, expect, it } from "vitest";
import {
  DIGEST_RULES_CONFIG,
  DIGEST_DESCRIPTION_BLACKLIST,
  DIGEST_TOPIC_BLACKLIST,
  loadDigestRulesConfig,
  getDefaultDigestRulesConfigPath,
} from "../../src/config/digest-rules";

describe("DIGEST_RULES_CONFIG", () => {
  it("loads the default config successfully", () => {
    expect(DIGEST_RULES_CONFIG).toBeDefined();
    expect(DIGEST_RULES_CONFIG.version).toBeTruthy();
  });

  it("has at least one theme defined", () => {
    expect(DIGEST_RULES_CONFIG.themes.length).toBeGreaterThan(0);
  });

  it("has valid score buckets", () => {
    for (const bucket of DIGEST_RULES_CONFIG.scoreBuckets) {
      expect(bucket.maxDays).toBeGreaterThan(0);
      expect(bucket.minScore).toBeGreaterThanOrEqual(0);
    }
  });
});

describe("DIGEST_DESCRIPTION_BLACKLIST", () => {
  it("is a non-empty array of regex patterns", () => {
    expect(DIGEST_DESCRIPTION_BLACKLIST.length).toBeGreaterThan(0);
    for (const pattern of DIGEST_DESCRIPTION_BLACKLIST) {
      expect(pattern).toBeInstanceOf(RegExp);
    }
  });
});

describe("DIGEST_TOPIC_BLACKLIST", () => {
  it("is a Set", () => {
    expect(DIGEST_TOPIC_BLACKLIST).toBeInstanceOf(Set);
  });
});

describe("loadDigestRulesConfig", () => {
  it("loads from default path without error", () => {
    const config = loadDigestRulesConfig(getDefaultDigestRulesConfigPath());
    expect(config.version).toBeTruthy();
    expect(config.themes.length).toBeGreaterThan(0);
  });

  it("throws on non-existent path", () => {
    expect(() => loadDigestRulesConfig("/nonexistent/path.json")).toThrow();
  });
});
```

- [ ] **Step 2: 运行测试确认通过**

Run: `npm test -- tests/config/digest-rules.test.ts`
Expected: 所有测试 PASS

- [ ] **Step 3: Commit**

```bash
git add tests/config/digest-rules.test.ts
git commit -m "test: add unit tests for digest-rules config loading and validation"
```

---

### Task 16: 最终验证

运行全部检查，确认 v1 状态干净。

**Files:**
- No files created or modified

- [ ] **Step 1: 运行 typecheck**

Run: `npx tsc --noEmit`
Expected: 无错误

- [ ] **Step 2: 运行全部测试**

Run: `npm test`
Expected: 所有测试 PASS

- [ ] **Step 3: 运行规则校验**

Run: `npm run validate:digest-rules -- --format json`
Expected: 输出 JSON 格式的规则摘要，无报错

- [ ] **Step 4: 确认无死代码残留**

```bash
# 确认 schedule 模块已删除
ls src/core/schedule.ts src/config/schedule.ts 2>&1
# Expected: No such file or directory

# 确认无 template_fallback 残留
grep -r "template_fallback\|fallback\|editorialMode\|readerTag\|readerNote" src/
# Expected: 无输出

# 确认无 maskApiKey 残留
grep -r "maskApiKey" src/
# Expected: 无输出

# 确认无 sendWorkflowFailureAlert 残留
grep -r "sendWorkflowFailureAlert\|WecomWorkflowFailureAlert\|getMaskedWebhook" src/
# Expected: 无输出
```

- [ ] **Step 5: 确认版本号正确**

```bash
node -e "console.log(require('./package.json').version)"
# Expected: 1.0.0
```

- [ ] **Step 6: 确认 git 状态干净**

```bash
git status
# Expected: nothing to commit, working tree clean
```
