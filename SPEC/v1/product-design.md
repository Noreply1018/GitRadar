# GitRadar v1 — 产品设计文档

## 1. 产品定位

**GitRadar** 是一个单用户、单仓库、单推送渠道的 GitHub 开源日报工具。

它每天自动发现值得关注的开源项目，通过 LLM 生成中文摘要，推送到企业微信。

### 核心价值

> 每天早上打开企微，看到一份 6-8 个项目的开源日报，每个都有"它做什么"、"为什么值得看"、"为什么是现在"。

### 不是什么

- 不是多用户平台
- 不是新闻聚合器
- 不需要本地运行环境

---

## 2. v1 边界

### v1 只做 7 件事

1. GitHub Actions 定时运行
2. GitHub Trending / Search API 抓候选
3. 评分筛选
4. LLM 生成日报
5. 企业微信推送
6. 归档到 `data/history/`
7. 回写 `data/runtime/github-runtime.json`

### v1 明确不做

- Web 控制台的配置修改和反馈提交（推到 v2）
- 反馈闭环（推到 v2）
- LLM 失败的模板降级
- 多推送渠道
- 本地运行模式
- 社区治理流程

### v1 可选做（Phase B）

- Web 只读浏览历史日报（不含配置修改、反馈提交）

---

## 3. 用户故事

| 编号 | 用户故事 | 版本 |
|------|---------|------|
| US-1 | 每天早上在企微收到一份 6-8 个项目的中文日报 | **v1** |
| US-2 | 在 Web 页面只读浏览当天和历史日报 | v1 Phase B |
| US-3 | 在 Web 页面标记"收藏"/"跳过"/"稍后看" | v2 |
| US-4 | 通过反馈影响后续推荐（个性化） | v2 |
| US-5 | 在 Web 页面修改配置 | v2 |

---

## 4. 主链路架构

```
┌─────────────────────────────────────────────────────────────┐
│                      调度层 (Scheduler)                      │
│  GitHub Actions cron 5min → 时间槽检查 → 触发/跳过           │
│  不匹配时间槽 → exit 0（静默，不发通知）                      │
└──────────────────┬──────────────────────────────────────────┘
                   │ 匹配时间槽
┌──────────────────▼──────────────────────────────────────────┐
│                      发现层 (Source)                          │
│  GitHub Trending 爬取 + GitHub Search API                    │
│  输入：GitHub token                                          │
│  输出：GitHubCandidateRepo[]                                 │
└──────────────────┬──────────────────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────────────────┐
│                      评分层 (Scoring)                         │
│  主题推断(9类) → 多因子评分 → 多样性控制 → 黑名单过滤         │
│  输入：GitHubCandidateRepo[], UserPreferences                │
│  输出：llmPool (12个候选)                                     │
└──────────────────┬──────────────────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────────────────┐
│                      编辑层 (Editorial)                       │
│  LLM 调用 → JSON 解析 → 质量校验                             │
│  重试 3 次 → 全失败则 throw                                   │
│  输入：llmPool[], date, LlmConfig                            │
│  输出：DailyDigest { date, title, items[] }                  │
└──────────────────┬──────────────────────────────────────────┘
                   │
              ┌────┴────┐
              │         │
┌─────────────▼──┐  ┌──▼──────────────────────────────────────┐
│   推送层        │  │   归档层 (Archive)                       │
│  (Delivery)    │  │  DailyDigestArchive → data/history/      │
│  企微 webhook  │  │  + runtime state → github-runtime.json   │
│  Markdown 分页 │  │  通过 workflow 内 git commit 写回仓库     │
└────────────────┘  └─────────────────────────────────────────┘
```

**v1 没有的层：** 反馈层、控制台写入层。评分层的 `FeedbackState` 和 `UserPreference` 参数在 v1 中读取仓库中已有的静态配置文件，不依赖 Web 写入。

---

## 5. 各层设计

### 5.1 发现层 (Source)

| 源 | 方式 | 发现范围 |
|----|------|---------|
| GitHub Trending | 爬取 trending 页面 | 当日热门仓库 |
| Search: recently_updated | GitHub Search API | 最近 7 天有 push、50+ stars |
| Search: recently_created | GitHub Search API | 最近 30 天创建、20+ stars |

输出 `GitHubCandidateRepo[]`，按 repo 全名去重。对候选通过 GitHub API 获取 README 首段摘要。

Trending 失败时仅依赖 Search 继续（反之亦然）。两个源都失败则当日跳过。

### 5.2 评分层 (Scoring)

**主题（9 类）：** AI Agents, AI Research, Infra & Runtime, Developer Tools, Data & Search, Observability & Security, Frontend & Design, General OSS + 用户自定义

**评分维度：** Momentum, Novelty, Maturity, Coverage, User Preference

**控制机制：** 多样性（每主题上限）、黑名单（关键词过滤）

**输出：** shortlisted (20) → llmPool (12)

v1 中评分层只读 `config/user-preferences.json`（静态文件），不依赖反馈系统。

### 5.3 编辑层 (Editorial)

- OpenAI-compatible API（base_url + api_key + model）
- System prompt：日报编辑角色
- 质量校验：theme 一致、summary 具体（正则检测）、evidence 从候选原样选取
- 重试 3 次，间隔 200ms
- **全失败 → throw → 当日跳过**

### 5.4 归档层 (Archive)

归档 JSON 包含：日报内容、候选全量数据、筛选过程、生成元信息、schema version。

存储在 `data/history/YYYY-MM-DD.json`。

### 5.5 推送层 (Delivery)

企业微信机器人 webhook，Markdown 格式，4096 字节自动分页（UTF-8 精确计算），中文本地化。

---

## 6. 配置体系

### 仓库配置（v1 只通过直接编辑修改）

| 文件 | 内容 |
|------|------|
| `config/schedule.json` | 发送时间、时区 |
| `config/digest-rules.json` | 主题定义、评分权重、黑名单、阈值 |
| `config/user-preferences.json` | 偏好主题、自定义话题 |

### GitHub Secrets

| Secret | 用途 |
|--------|------|
| `GITRADAR_GITHUB_TOKEN` | GitHub API 访问 |
| `GR_API_KEY` | LLM API 密钥 |
| `GR_BASE_URL` | LLM API 端点 |
| `GR_MODEL` | LLM 模型标识 |
| `GITRADAR_WECOM_WEBHOOK_URL` | 企微 webhook |

---

## 7. 错误处理策略

**原则：失败要大声，不要静默降级。**

| 场景 | 行为 | workflow exit |
|------|------|-------------|
| 非命中时间槽 | 静默跳过 | **exit 0** |
| Trending 失败 | 日志记录，仅依赖 Search 继续 | 继续执行 |
| Search 失败 | 日志记录，仅依赖 Trending 继续 | 继续执行 |
| 两个源都失败 | 日志记录 | **exit 1** |
| LLM 3 次失败 | 不生成归档，写 runtime failure，企微发失败通知 | **exit 1** |
| 企微推送失败 | 日志记录，归档仍写入 | **exit 1** |

**关键：非命中时间槽必须 exit 0，不能触发 GitHub 通知邮件。只有真正的执行失败才 exit 1。**

---

## 8. v1 目录结构（最小）

```
GitRadar/
├── .github/workflows/
│   ├── daily-digest.yml        # 唯一核心 workflow
│   └── ci.yml                  # CI
├── src/
│   ├── commands/               # CLI 入口
│   ├── core/                   # 核心模型
│   ├── digest/                 # 生成 pipeline
│   ├── github/                 # GitHub API
│   ├── config/                 # 配置读取
│   ├── notifiers/              # 企微推送
│   └── utils/                  # 工具函数
├── config/                     # 静态配置文件
├── data/
│   ├── history/                # 日报归档
│   └── runtime/                # 运行状态
├── tests/                      # 测试
├── docs/                       # 文档
├── SPEC/v1/                    # 本文档
└── package.json
```

**不属于 v1 核心的目录（保留但不投入工作）：**
- `web/` — Phase B 只读浏览，v2 完整功能
- `src/feedback/` — v2
- `data/feedback/` — v2
- `.github/workflows/console-writeback.yml` — v2
- `.github/workflows/pages-deploy.yml` — Phase B
- `.github/workflows/environment-diagnose.yml` — v2
