# PRD — GitRadar GitHub-native 重构收敛计划

## Metadata
- Date: 2026-04-07
- Source brief: `.omx/context/gitradar-github-native-rebuild-20260407T092447Z.md`
- Upstream requirements: `/root/projects/.omx/specs/deep-interview-gitradar-project-understanding.md`
- Planning mode: `$ralplan`
- Scope type: brownfield / 架构重构

---

## RALPLAN-DR Summary

### Principles
1. **GitHub 是唯一正式运行面**：正式执行、正式状态、正式归档、正式写入都必须可在 GitHub 内闭环追溯。
2. **先删旧语义，再补新能力**：任何把本地 git、本地 server、本地控制台当正式路径的语义，优先删除，不做兼容层。
3. **前端只读公开结果，写入走 GitHub 授权与工作流**：GitHub Pages 负责正式阅读；配置/反馈写入必须经 GitHub 平台能力落仓库并留下 commit / PR / run 证据。
4. **正式状态以远端产物为准，不以本地推断为准**：运行状态、环境诊断、归档历史都以仓库产物或 GitHub run 信息为正式来源。
5. **验证必须围绕真实正式链路**：验收不能只看本地构建通过，必须证明 GitHub 定时执行、企业微信发送、归档可读、收藏/配置可交互。

### Decision Drivers
1. **用户目标**：真正项目运行在 GitHub；本地只做调试；正式产品只保留“企业微信日报 + 前端归档/收藏/配置”。
2. **当前最大架构张力**：`web/src/api.ts` 已走 GitHub 原生方向，但 `src/web-api/*` 与多个 workflow 仍保留 git / 本地 server 语义，形成双控制面。
3. **后续执行效率**：如果不先切掉双正式入口，后续实现、测试、文档和认知都会持续分裂。

### Viable Options

#### Option A — 温和迁移：保留本地调试 API，优先补文档和少量接口抽象
**做法**
- 保留 `src/web-api/server.ts` 及 git-based service
- 只把 README / docs 更明确地改成“本地仅调试”
- 先不碰 workflow 内的 git commit/push

**优点**
- 改动风险较低
- 可以较快维持现有本地开发方式

**缺点**
- 双正式入口语义仍残留在代码结构里
- `repo-sync-service.ts` / `github-runtime-service.ts` 继续把 git fetch/show 当成正式读取机制
- 不符合“直接删除旧语义”的用户边界

#### Option B — 硬切正式控制面：前端 / 工作流全面收敛到 GitHub 平台能力
**做法**
- 将 GitHub Pages 前端确立为唯一正式控制台
- 删除 `src/web-api/*` 中承载正式语义的 server 与 git-based 读取/写入层
- 扩展 `src/github/platform-client.ts` 为正式 GitHub 平台客户端
- 将 workflow 回写从 git CLI 改为 GitHub API / Git Data API / gh api 的平台写入

**优点**
- 与用户要求和路线图完全一致
- 正式读写路径更单一，代码认知更清晰
- 后续测试与发布模型更稳定

**缺点**
- 涉及前端、workflow、平台客户端、文档的系统性重构
- 需要处理多文件写入、PR 创建、冲突检测等平台细节

#### Option C — 半收敛：前端保持 GitHub 原生，但 workflow 继续用 git CLI 回写
**做法**
- 删除或降级 `src/web-api/*`
- 前端保留当前 PAT + workflow dispatch 模式
- `daily-digest.yml` / `environment-diagnose.yml` / `console-writeback.yml` 暂时继续 git add/commit/push

**优点**
- 相比 Option B 实施更快
- 能尽快清除本地 server 的正式语义

**缺点**
- 正式回写仍绑定 git CLI，而不是 GitHub 平台写入
- 与 `docs/github-native-roadmap.md` 的 P0 目标仍有偏差
- 后续还要再做一次回写层重构

### Recommended Option
**选择 Option B，但执行顺序采用“硬边界 + 分阶段落地”的方式。**

不是一次性重写所有代码，而是：
1. 先在语义上硬切：明确 GitHub Pages / Actions / dispatch 是唯一正式入口，删除本地正式控制面残余。
2. 再按价值顺序完成平台客户端与 workflow 回写重构。
3. 最后收尾环境诊断、运行历史、发布治理。

---

## Architect Review（钢人反驳 + 综合）

### 最强反驳
最强反对意见不是“要不要 GitHub-native”，而是：

> 现有 `web/src/api.ts` 已经能直接读 GitHub、写入靠 workflow dispatch，真正的高风险点在 workflow 回写的多文件提交；如果一开始就要求所有正式写入都切到 GitHub API，可能会拖慢最重要的用户价值交付。

### 真实张力
- **价值最大化**：先把双正式入口彻底切掉，避免认知继续分裂。
- **实施风险最小化**：不要在第一步就把所有多文件写入都重写成复杂的 Git Data API 事务，而是先抽象统一平台写入层，再按单文件/多文件场景分别落地。

### 综合结论
- 前端正式面与本地 server 正式语义的切割，必须前置。
- workflow 回写层不必“同一提交全部完成”，但必须在同一版本计划内完成，不能无限延期。
- 平台写入方案应区分：
  - **单文件配置写入**：Contents API + sha 冲突检测
  - **多文件归档/反馈/运行状态写入**：Git Data API 或 `gh api` 统一封装，保证原子提交与可追溯 commit

---

## Critic Review（批判审查结果）

### Verdict
**APPROVE（附约束）**

### 必须保留的约束
1. 计划必须明确“删除哪些旧语义文件/模块”，不能只写“逐步迁移”。
2. 验收标准必须要求真实 GitHub 运行证据，不能只看本地测试通过。
3. 必须将“前端正式入口完成态”定义清楚：归档阅读、收藏、配置、环境状态、写入反馈都在 Pages 上完成。
4. 必须把 workflow git CLI 回写列为当前版本范围内必做项，而不是 future nice-to-have。

---

## Product Intent
将 GitRadar 收敛为一个真正运行在 GitHub 上的正式产品：
- GitHub Actions 定时生成并发送企业微信日报
- GitHub Pages 提供正式前端入口
- 前端可查看归档、记录收藏/稍后看、修改配置
- 本地环境只保留调试/复现职责

## Non-goals
- 不做飞书
- 不做本地正式运行入口
- 不做多平台通知扩展
- 不保留双正式入口语义
- 不为本地正式模式保留兼容层

---

## Current Brownfield Findings

### 已具备的 GitHub-native 基础
- `web/src/api.ts` 已直接用 GitHub Contents API 读取配置/归档/状态，并用 workflow dispatch 提交写入请求。
- `web/src/App.tsx` 已具备环境、偏好、收藏/待看、归档阅读等正式前端骨架。
- `.github/workflows/console-writeback.yml` 已承接前端写入请求并自动创建 PR。
- `.github/workflows/daily-digest.yml` 已承接定时执行、发送、归档与 runtime 回写。
- `src/github/platform-client.ts` 已存在 GitHub 平台客户端雏形。

### 主要阻塞点
- `src/web-api/server.ts` 仍提供一套本地 HTTP 控制面，并承载正式语义镜像。
- `src/web-api/services/repo-sync-service.ts` 仍依赖 `git fetch/show/add/commit/push`。
- `src/web-api/services/github-runtime-service.ts` 仍通过 git remote + fetch/show 读取“远端正式结果”。
- `src/feedback/store.ts`、`src/web-api/services/digest-rules-service.ts` 等仍通过 `commitAndPushRepoFiles()` 落仓库。
- `console-writeback.yml`、`daily-digest.yml`、`environment-diagnose.yml` 仍用 git CLI 提交回写。

---

## Decision / ADR

### Decision
采用 **“GitHub 平台单控制面”** 重构路线：
- GitHub Pages 成为唯一正式前端入口
- GitHub Actions / workflow dispatch 成为唯一正式执行与写入口
- GitHub 仓库 contents / run / diagnostic artifacts 成为唯一正式数据面
- 本地 server 与 git-based 正式读写层从正式架构中删除

### Drivers
- 满足用户明确边界
- 消除双正式入口导致的认知和测试分裂
- 为后续长期维护、发布和真实验证建立单一正式面

### Alternatives Considered
- 保留本地调试 API 并长期共存：拒绝，因继续扩散双语义
- 仅前端收敛，workflow 继续 git CLI：拒绝，因正式回写仍未 GitHub 平台化

### Consequences
- 重构范围会覆盖前端接口层、workflow、部分服务层与文档
- 一些“本地调试便利设施”会被删除或降级为纯开发脚本
- 验证成本上升，但正式链路可信度显著提高

### Follow-ups
- 先执行控制面切割与平台客户端抽象
- 再执行 workflow 回写平台化
- 最后补强历史索引、诊断、治理与发布

---

## 分阶段实施计划

### Phase 1 — 删除本地正式控制面，确立单一正式入口
**目标**：先把“什么才是正式路径”彻底钉死。

**动作**
- 将 README、docs、前端文案统一到：GitHub Pages + GitHub Actions/dispatch + GitHub repo contents。
- 删除或重构 `src/web-api/server.ts` 及其路由，使其不再承担正式 API 语义。
- 清理 `src/web-api/services/github-runtime-service.ts`、`repo-sync-service.ts` 的正式职责说明与调用入口。
- 重新梳理本地开发命令，只保留调试/复现所需最小集合。

**完成定义**
- 代码中不再存在“本地 server 是正式控制台后端”的产品语义。
- README 不再把 `npm run dev:console-api` 作为正式入口前提。
- 前端正式文案与工作流入口一致。

### Phase 2 — 平台客户端统一化，替换 git-based 正式读写服务
**目标**：让正式读取与正式写入都通过 GitHub 平台能力完成。

**动作**
- 扩展 `src/github/platform-client.ts`：
  - repo contents 读取/写入
  - 目录 listing
  - workflow dispatch
  - repo metadata / default branch
  - PR/branch/commit 辅助能力（按需要）
- 新建正式数据访问层：配置、归档、反馈、runtime、environment report 都走平台客户端。
- 删除 `commitAndPushRepoFiles()` 与 `readRemoteRepoFile()` 这类 git CLI 读写抽象。
- 将 `src/feedback/store.ts`、配置保存服务等迁移到平台写入接口。

**完成定义**
- 正式读写链路不再依赖 `git fetch/show/add/commit/push`。
- `src/web-api/services/repo-sync-service.ts` 被删除或降级为纯开发调试脚本，不再出现在正式路径。
- 单元测试可验证平台客户端的 sha 冲突、payload 编码、dispatch 输入。

### Phase 3 — Workflow 回写平台化与正式闭环固化
**目标**：让 GitHub 内的正式执行与回写不再依赖 git CLI。

**动作**
- 重写 `console-writeback.yml`：checkout 仅在必要时保留；正式回写通过 GitHub API / Git Data API 完成；PR 创建通过 GitHub API/gh。
- 重写 `daily-digest.yml`：生成 digest 后以平台写入方式提交 `data/history/*.json` 和 `data/runtime/github-runtime.json`。
- 重写 `environment-diagnose.yml`：环境诊断报告通过平台写入更新 `data/runtime/environment-report.json`。
- 为多文件写入定义统一提交策略：提交信息、冲突处理、重试、幂等约束。

**完成定义**
- 正式 workflow 中不再出现 `git add/commit/push` 作为核心回写机制。
- 每次正式写入都可追溯到 GitHub run + commit/PR。
- Daily Digest 失败时仍能留下正确 runtime 状态与错误证据。

### Phase 4 — Pages 产品面补强与治理收口
**目标**：让 GitHub Pages 真正成为用户可长期使用的正式入口。

**动作**
- 补强前端对正式状态的展示：最近运行、环境诊断、写入已提交 vs 已正式生效 的区分。
- 补强归档索引与运行历史展示能力，避免归档列表依赖高频逐文件读取。
- 视需要新增历史索引数据文件和运行历史数据文件。
- 补强 CI / workflow 验证、CODEOWNERS、发布与版本文档。

**完成定义**
- 用户无需本地服务即可完成正式阅读与正式写入请求。
- 前端可清晰区分：公开只读结果、需要 PAT 的写操作、PR 待合并状态。
- 发布治理与正式产品文档一致。

---

## Story Map / Deliverables
1. **控制面硬切**：删掉本地正式控制面语义与入口
2. **平台客户端扩展**：统一正式读写 API
3. **配置/反馈迁移**：前端与服务层只走平台写入
4. **workflow 回写重构**：digest / runtime / diagnose 全部平台化
5. **Pages 产品完成态**：归档/收藏/配置/环境状态体验收口
6. **治理与发布**：CI、文档、release、历史索引

---

## Testable Acceptance Criteria
1. 仓库正式路径中不再把 `src/web-api/server.ts` 或本地 HTTP API 作为正式控制台依赖。
2. 正式读写代码路径中不再依赖 `git fetch/show/add/commit/push`。
3. GitHub Pages 前端可以直接：
   - 查看归档
   - 查看最近一次正式运行状态
   - 查看环境诊断结果
   - 提交收藏/稍后看/配置写入请求
4. GitHub Actions 可以真实完成：
   - 定时生成日报
   - 发送企业微信
   - 回写归档与 runtime
   - 回写环境诊断
5. 正式写入都有 GitHub 侧证据：run URL、PR URL 或 commit SHA。
6. 文档不再暗示本地 server / 本地 git 是正式运行前提。

---

## Risks
1. **平台写入复杂度**：多文件原子提交与 PR 创建会增加 GitHub API 复杂度。
2. **PAT / 权限模型复杂**：浏览器 PAT、workflow token、repo permissions 需要明确区分。
3. **历史数据兼容**：迁移归档索引与反馈读写时可能出现历史数据格式不一致。
4. **前端速率限制与公开读取成本**：Pages 前端直接读 contents API 可能受 rate limit 影响。

## Mitigations
- 单文件与多文件写入采用不同策略，避免一刀切实现复杂度。
- 将平台客户端抽象清楚，先做测试，再替换调用方。
- 为历史数据增加 parse/normalize 测试。
- 如需降低 API 读取成本，可在后续阶段增加索引文件而不是回退本地 server。

---

## Verification Plan
- 单元：平台客户端、payload 编码/解码、配置解析、反馈状态构建、runtime normalize
- 集成：workflow dispatch 输入、配置/反馈写入路径、daily digest 持久化路径
- 构建：`npm run format:check && npm run lint:md && npm run lint:yaml && npm run typecheck && npm run test && npm run build:web`
- 真实 GitHub 证据：
  - 手动触发 Console Writeback
  - 手动触发 Daily Digest / Environment Diagnose
  - 检查 run URL、PR、commit、Pages 展示结果
- 真实产品证据：
  - 企业微信收到日报或失败告警
  - GitHub Pages 可读到最新归档
  - 收藏/配置交互能形成正式仓库变更

---

## Available Agent Types Roster
- `architect`：高风险边界、平台写入方案、ADR 审查
- `executor`：平台客户端扩展、workflow 重构、前端/服务层删除旧语义
- `debugger`：GitHub Actions / API 权限与失败诊断
- `test-engineer`：单元/集成/真实链路测试设计
- `verifier`：GitHub run/PR/Pages/WeCom 证据核验
- `writer`：README / docs / 操作文档重写

## Staffing Guidance
### 如果走 `$ralph`
- 主执行：`executor`（high）
- 伴随验证：`verifier`（high）
- 文档收口：`writer`（medium）
- 遇到 GitHub API / workflow 结构争议时插入 `architect`（high）

### 如果走 `$team`
- Lane 1：平台客户端与正式读写层（executor / high）
- Lane 2：workflow 重构与 GitHub Actions 验证（executor/debugger / high）
- Lane 3：Pages 前端收口与文档迁移（executor/writer / medium-high）
- 收尾统一由 verifier 做真实 GitHub 证据核验

## Launch Hints
- Ralph: `$ralph .omx/plans/prd-gitradar-github-native-rebuild.md`
- Team: `$team .omx/plans/prd-gitradar-github-native-rebuild.md`
- 若要保守推进，先以 Phase 1 + Phase 2 作为第一个执行版本。

## Team Verification Path
1. Team 完成各 lane 改动后，先跑本地质量门：format/md/yaml/typecheck/test/build:web
2. 再手动触发 GitHub 工作流验证 writeback / digest / diagnose
3. 再由 verifier 对照 acceptance criteria 检查：
   - 是否仍有本地正式语义残留
   - 是否仍有 git CLI 正式回写残留
   - Pages 是否可完成归档/收藏/配置正式操作
   - WeCom 是否真实收到日报/告警
4. 未满足即回到 team-fix / ralph loop，不宣布完成
