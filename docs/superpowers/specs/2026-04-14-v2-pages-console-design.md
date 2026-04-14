# v2 设计文档：GitRadar Pages 控制台

## 概述

v2 的唯一目标是为 GitRadar 新增一个基于 GitHub Pages 的全功能控制台（SPA），让用户通过网页完成配置编辑、历史日报浏览、反馈标记、工作流管理等操作，而不再需要手动修改仓库文件或进入 GitHub Secrets。

后端链路（数据采集、规则筛选、LLM 成稿、企业微信投递、归档写回）不在 v2 范围内，保持不变。

## 约束

- **GitHub-native**：SPA 部署在 GitHub Pages，所有数据读写通过 GitHub REST API，零服务器。
- **单用户**：认证方式为 PAT + localStorage，无需 OAuth 后端。
- **不污染现有代码**：前端代码独立在 `web/` 目录下，不修改现有 `src/`、`config/`、`data/` 的结构。
- **不引入多子系统**：遵守 CLAUDE.md 约束，不建新仓库。

## 技术栈

- React 19 + TypeScript
- Vite（构建）
- TailwindCSS（样式）
- React Router（路由）
- GitHub REST API（数据层）

## 目录结构

```
web/
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   ├── api/
│   │   ├── github.ts
│   │   └── types.ts
│   ├── pages/
│   │   ├── SetupPage.tsx
│   │   ├── DashboardPage.tsx
│   │   ├── HistoryPage.tsx
│   │   ├── ConfigPage.tsx
│   │   ├── FeedbackPage.tsx
│   │   └── LogsPage.tsx
│   ├── components/
│   └── hooks/
├── index.html
├── vite.config.ts
├── tailwind.config.ts
├── tsconfig.json
└── package.json
```

## 页面设计

### Setup (`/setup`)

首次访问或 token 失效时展示。用户输入 GitHub PAT（需 `repo` scope），存入 localStorage。验证成功后跳转 Dashboard。提供退出按钮清除 token。

### Dashboard (`/`)

运行状态总览页，展示：

- 最近一次运行的状态、时间、触发方式（来自 `data/runtime/github-runtime.json`）
- 最近一次归档的日期和条目数
- 快捷操作：手动触发工作流、跳转配置编辑

只读页面，不做写入。

### History (`/history`)

历史日报列表页：

- 列出 `data/history/` 下所有 JSON 文件，按日期倒序
- 点击某天展开详情：显示所有入选条目的 repo、主题、摘要、evidence
- 显示该次运行的元数据：候选数、入围数、LLM 候选数、规则版本

只读页面。

### Config (`/config`)

配置编辑器，编辑两个文件：

- `config/schedule.json`：发送时间、时区
- `config/digest-rules.json`：主题关键词、黑名单、阈值、评分权重

编辑器设计：

- **schedule.json**：表单化编辑（时间选择器 + 时区下拉）
- **digest-rules.json**：分区表单化编辑
  - 主题管理：增删主题、编辑关键词列表
  - 黑名单管理：description/readme/topics 黑名单的增删
  - 阈值和权重：数值输入，带当前值显示

保存时通过 GitHub Contents API 写回仓库（自动 commit），commit message 格式 `chore(console): update {filename}`。

### Feedback (`/feedback`)

对历史日报条目做反馈标记：

- 按日期选择日报
- 每个条目显示 repo + 摘要，提供三个操作按钮：点赞 / 收藏 / 不感兴趣
- 反馈数据写入 `data/feedback/YYYY-MM-DD.json`

反馈数据结构：

```json
{
  "date": "2026-04-14",
  "items": [
    {
      "repo": "owner/repo",
      "action": "like",
      "updatedAt": "2026-04-14T10:30:00Z"
    }
  ]
}
```

`action` 取值：`"like"` | `"bookmark"` | `"not_interested"`

同一条目可以切换 action（覆盖写入），也可以取消（删除该条记录）。

### Logs (`/logs`)

工作流运行记录：

- 通过 GitHub Actions API 获取 `daily-digest.yml` 的最近运行列表
- 显示每次运行的：状态、触发方式、开始时间、耗时
- 提供"手动触发"按钮（调用 workflow_dispatch）
- 点击某次运行可跳转到 GitHub Actions 页面查看详细日志

## 数据流

SPA 不持有任何后端，所有数据读写通过 GitHub REST API。

### API 封装层 (`web/src/api/github.ts`)

```
GitHubClient
├── readFile(path)           → GET /repos/{owner}/{repo}/contents/{path}
├── writeFile(path, content) → PUT /repos/{owner}/{repo}/contents/{path}
├── listDirectory(path)      → GET /repos/{owner}/{repo}/contents/{path}
├── triggerWorkflow(id)      → POST /repos/{owner}/{repo}/actions/workflows/{id}/dispatches
└── listWorkflowRuns(id)     → GET /repos/{owner}/{repo}/actions/workflows/{id}/runs
```

注：不封装 getWorkflowRunLogs，GitHub Actions 日志 API 返回 zip 压缩包，纯前端解压展示复杂度高且价值低。详细日志通过跳转 GitHub Actions 页面查看。

### 各页面数据流

| 页面 | 读 | 写 |
|------|----|----|
| Dashboard | `data/runtime/github-runtime.json` | 无 |
| History | `data/history/` 目录列表 + 单文件读取 | 无 |
| Config | `config/schedule.json` + `config/digest-rules.json` | 同路径 writeFile |
| Feedback | `data/feedback/YYYY-MM-DD.json` | 同路径 writeFile |
| Logs | GitHub Actions API | triggerWorkflow |

### 写入机制

GitHub Contents API 的 PUT 要求传入当前文件 sha：

1. GET 读取文件，获取 content + sha
2. 前端修改 content
3. PUT 写回，携带 sha
4. 新文件不传 sha 即创建

### 错误处理

| 状态码 | 含义 | 处理 |
|--------|------|------|
| 401 | token 无效或过期 | 清除 localStorage，跳转 Setup |
| 404 | 文件或目录不存在 | 显示空状态 |
| 409 | sha 冲突（并发编辑） | 提示用户刷新后重试 |
| 网络错误 | 连接失败 | toast 提示 |

## 认证

- 用户在 Setup 页面输入 GitHub PAT（需 `repo` scope）
- 存入 localStorage key `gitradar_pat`
- 同时存储 owner/repo 信息：`gitradar_owner`、`gitradar_repo`
- API 请求通过 `Authorization: token {PAT}` 头携带
- 提供退出功能，清除所有 localStorage 数据

## 部署

新增 GitHub Actions 工作流 `.github/workflows/deploy-pages.yml`：

- 触发条件：`web/` 目录下的文件变更 push 到 main
- 步骤：checkout → setup-node → npm ci → npm run build → 部署到 GitHub Pages
- 使用 `actions/deploy-pages` action

GitHub Pages 配置：

- Source: GitHub Actions
- SPA 路由处理：Vite 构建时配置 base path，404.html 重定向到 index.html

## 不做的事

- 不修改现有后端链路（src/ 目录）
- 不引入 SSR 或 BFF
- 不引入数据库或第三方服务
- 不做多用户支持
- 不做企业微信端交互
- 不对反馈数据做自动化利用（v2 只存储，未来版本可能用于优化选题）
