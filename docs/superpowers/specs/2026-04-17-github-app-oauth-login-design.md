# GitHub App OAuth 登录设计

将 GitRadar Pages Console 的首次登录从手动填写 PAT 改为 GitHub App 安装授权流程，后端用 Cloudflare Worker 代理所有 GitHub API 调用。

## 背景

当前 SetupPage 要求用户手动创建 PAT 并填入 token/owner/repo 三个字段。这个方案存在以下问题：

- PAT 明文存储在 localStorage，权限粒度粗
- 用户需要理解 GitHub token scope 概念
- 不适合面向非技术用户

## 架构

```
前端 (GitHub Pages)          Cloudflare Worker             GitHub API
┌────────────────┐     ┌──────────────────────┐     ┌──────────────┐
│  React SPA     │────>│  /auth/login          │────>│  GitHub App  │
│  静态部署       │<────│  /auth/callback       │<────│  Installation│
│  不持有任何密钥  │     │  /api/github/*        │     │  Token       │
└────────────────┘     └──────────────────────┘     └──────────────┘
```

三层职责：

1. **前端**：部署在 GitHub Pages，不持有任何密钥，只存 Worker 颁发的会话 token（session token）
2. **Cloudflare Worker**：持有 GitHub App 私钥，负责 OAuth 回调 + 代理所有 GitHub API 调用
3. **GitHub App**：安装在目标仓库上，提供 installation token 级别的细粒度权限

## GitHub App 配置

**权限（Permissions）：**

- `contents: read & write` — 读写仓库文件（config、data/history、data/runtime 等）
- `actions: read & write` — 查看 workflow runs、触发 workflow dispatch
- `metadata: read` — 基础仓库信息（自动授予）

**回调 URL：** `https://<worker-domain>/auth/callback`

**安装范围：** 仅安装到 GitRadar 仓库（单仓库安装）

## 登录流程

```
用户点击"使用 GitHub 登录"
        │
        ▼
前端 GET /auth/login ──> Worker 生成 state，302 跳转到
        │                 https://github.com/apps/<app-name>/installations/new
        ▼
用户在 GitHub 上确认安装 App 到目标仓库
        │
        ▼
GitHub 回调 GET /auth/callback?code=xxx&installation_id=yyy&state=zzz
        │
        ▼
Worker 验证 state ──> 用 App 私钥生成 JWT ──> 
        │             POST /app/installations/{id}/access_tokens
        ▼
Worker 获得 installation_id，生成会话 token（JWT，含 installation_id + 过期时间）
        │
        ▼
302 重定向到前端 /setup/callback?session=<jwt>
        │
        ▼
前端提取 session token，存入 localStorage，跳转到 Dashboard
```

**如果用户已安装过 App：** GitHub 会跳过安装步骤，直接回调。

## 会话管理

### Worker 颁发的会话 Token

格式：JWT，由 Worker 签发和验证。

Payload：
```json
{
  "iid": 12345678,      // GitHub App installation_id
  "owner": "Noreply1018",
  "repo": "GitRadar",
  "exp": 1713484800     // 过期时间（7 天）
}
```

签名密钥：Worker 环境变量 `SESSION_SECRET`（与 GitHub App 私钥独立）。

### Token 刷新策略

- 会话 token 有效期 7 天
- Installation token（GitHub 颁发）有效期 1 小时，由 Worker 自动缓存和刷新
- 前端不感知 installation token 的存在

### 前端存储

localStorage key 从 `gitradar_pat` / `gitradar_owner` / `gitradar_repo` 简化为单一的 `gitradar_session`。

## Worker API 设计

### 认证端点

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/auth/login` | 生成 state，302 跳转 GitHub 安装页 |
| GET | `/auth/callback` | 处理 GitHub 回调，签发会话 JWT，302 回前端 |
| POST | `/auth/logout` | 可选：清除服务端缓存 |

### GitHub API 代理端点

| 方法 | 路径 | 对应 GitHub API |
|------|------|----------------|
| GET | `/api/github/repos/contents/*` | GET /repos/{owner}/{repo}/contents/{path} |
| PUT | `/api/github/repos/contents/*` | PUT /repos/{owner}/{repo}/contents/{path} |
| GET | `/api/github/repos/actions/workflows/*/runs` | GET /repos/{owner}/{repo}/actions/workflows/{id}/runs |
| POST | `/api/github/repos/actions/workflows/*/dispatches` | POST /repos/{owner}/{repo}/actions/workflows/{id}/dispatches |
| GET | `/api/github/repos` | GET /repos/{owner}/{repo}（验证连接） |

每个代理请求：
1. 从 Authorization header 提取会话 JWT
2. 验证签名和过期时间
3. 从 JWT 中取 installation_id
4. 用缓存的 installation token（或重新生成）调用 GitHub API
5. 透传响应

### Installation Token 缓存

Worker 使用 KV 或内存缓存 installation token：
- Key: `install_token:{installation_id}`
- TTL: 50 分钟（GitHub installation token 有效期 1 小时，留 10 分钟余量）
- 过期后自动重新生成

## 前端改动

### 变更文件清单

| 文件 | 变更类型 | 说明 |
|------|----------|------|
| `web/src/hooks/useAuth.ts` | 重写 | AuthState 简化为 `{ session: string, owner: string, repo: string }`，session 从 JWT 解析 |
| `web/src/api/github.ts` | 重写 | `GitHubClient` 不再直连 GitHub API，改为调用 Worker 代理端点 |
| `web/src/hooks/useGitHub.ts` | 微调 | 适配新的 AuthState 结构 |
| `web/src/pages/SetupPage.tsx` | 重写 | 移除 token/owner/repo 表单，改为"使用 GitHub 登录"按钮 + OAuth 回调处理 |
| `web/src/App.tsx` | 微调 | 新增 `/setup/callback` 路由处理 OAuth 回调 |
| `web/src/config.ts` | 新增 | 集中管理 Worker URL 等环境变量 |
| `web/vite.config.ts` | 微调 | 添加环境变量定义 |

### SetupPage 新 UI

移除三个输入框，替换为：

- 标题：GitRadar Console
- 说明文字：通过 GitHub 授权连接你的 GitRadar 仓库
- 主按钮："使用 GitHub 登录"（点击后跳转 Worker `/auth/login`）
- 错误提示区域（处理回调失败等情况）

### AuthGuard 改动

判断条件从检查 `token + owner + repo` 改为检查 `session` 是否存在且未过期（解析 JWT exp 字段，纯前端判断）。

## Worker 项目结构

在仓库根目录新增 `worker/` 目录：

```
worker/
├── wrangler.toml         # Cloudflare Worker 配置
├── package.json          # 依赖（hono、jose）
├── tsconfig.json
└── src/
    ├── index.ts          # 入口，路由分发
    ├── auth.ts           # /auth/login、/auth/callback 处理
    ├── proxy.ts          # /api/github/* 代理逻辑
    ├── github-app.ts     # GitHub App JWT 生成、installation token 获取
    └── session.ts        # 会话 JWT 签发与验证
```

**技术选型：**
- **路由框架**：Hono（轻量，Cloudflare Workers 原生支持）
- **JWT 库**：jose（Web Crypto API 兼容，适合 Workers 环境）

**Worker 环境变量（Secrets）：**
- `GITHUB_APP_ID` — GitHub App ID
- `GITHUB_APP_PRIVATE_KEY` — GitHub App 私钥（PEM 格式）
- `GITHUB_CLIENT_ID` — GitHub App OAuth client ID
- `GITHUB_CLIENT_SECRET` — GitHub App OAuth client secret
- `SESSION_SECRET` — 会话 JWT 签名密钥
- `FRONTEND_URL` — 前端 URL（如 `https://noreply1018.github.io/GitRadar`）

## 安全考量

1. **state 参数防 CSRF**：Worker 在 `/auth/login` 时生成随机 state，存入 cookie（httpOnly，SameSite=Lax），回调时验证一致性
2. **CORS**：Worker 只允许来自 `FRONTEND_URL` 的跨域请求
3. **会话 token 过期**：7 天过期，前端在过期后自动跳转 SetupPage
4. **Installation token 不暴露**：前端永远不接触 installation token
5. **权限最小化**：GitHub App 只请求必要的仓库权限

## 向后兼容

- 旧的 `gitradar_pat` / `gitradar_owner` / `gitradar_repo` localStorage 条目在首次加载新版时自动清除
- 用户需要重新通过 GitHub App 授权登录
- 这是一个破坏性变更，但考虑到 GitRadar 是单用户工具，影响可控

## 不在范围内

- 多用户支持 / 用户数据库
- Refresh token 机制（7 天有效期足够，过期重新登录）
- Worker 自定义域名（先用 `*.workers.dev` 默认域名）
- 前端 PAT 模式作为降级方案（彻底移除）
