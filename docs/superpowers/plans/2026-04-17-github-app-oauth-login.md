# GitHub App OAuth 登录 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 GitRadar Pages Console 的登录从手动填写 PAT 改为 GitHub App OAuth + Cloudflare Worker 代理架构。

**Architecture:** 前端（GitHub Pages 静态 SPA）只负责跳转授权和持有会话 JWT。Cloudflare Worker 持有 GitHub App 私钥，处理 OAuth 回调、签发会话 JWT、代理所有 GitHub API 调用。前端永远不接触 installation token。

**Tech Stack:** React 19 + React Router 7 + Tailwind CSS 4（前端）；Hono + jose（Worker）；Cloudflare Workers + KV（后端）

**Spec:** `docs/superpowers/specs/2026-04-17-github-app-oauth-login-design.md`

---

## File Structure

### Worker（新建 `worker/` 目录）

| 文件 | 职责 |
|------|------|
| `worker/package.json` | 依赖声明（hono, jose） |
| `worker/tsconfig.json` | TypeScript 配置 |
| `worker/wrangler.toml` | Cloudflare Worker 部署配置 |
| `worker/src/index.ts` | Hono 入口，路由挂载，CORS |
| `worker/src/auth.ts` | `/auth/login` 和 `/auth/callback` 处理 |
| `worker/src/proxy.ts` | `/api/github/*` 代理逻辑 |
| `worker/src/github-app.ts` | GitHub App JWT 生成、installation token 获取/缓存 |
| `worker/src/session.ts` | 会话 JWT 签发与验证 |
| `worker/src/types.ts` | Worker 侧类型定义 |

### 前端（修改 `web/` 目录）

| 文件 | 变更 |
|------|------|
| `web/src/config.ts` | 新建 — Worker URL 等环境变量 |
| `web/src/hooks/useAuth.ts` | 重写 — AuthState 改为 session JWT |
| `web/src/api/github.ts` | 重写 — 改为调用 Worker 代理端点 |
| `web/src/hooks/useGitHub.ts` | 微调 — 适配新 AuthState |
| `web/src/pages/SetupPage.tsx` | 重写 — OAuth 登录按钮 + 回调处理 |
| `web/src/pages/CallbackPage.tsx` | 新建 — 处理 `/setup/callback` 路由 |
| `web/src/App.tsx` | 微调 — 新增 callback 路由 |
| `web/vite.config.ts` | 微调 — 环境变量声明 |
| `web/src/vite-env.d.ts` | 微调 — 环境变量类型 |

---

## Task 1: Worker 项目脚手架

**Files:**
- Create: `worker/package.json`
- Create: `worker/tsconfig.json`
- Create: `worker/wrangler.toml`
- Create: `worker/src/types.ts`

- [ ] **Step 1: 创建 `worker/package.json`**

```json
{
  "name": "gitradar-worker",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "wrangler dev",
    "deploy": "wrangler deploy",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "hono": "^4.7.11",
    "jose": "^6.0.11"
  },
  "devDependencies": {
    "@cloudflare/workers-types": "^4.20250620.0",
    "wrangler": "^4.22.0",
    "typescript": "^5.8.3"
  }
}
```

- [ ] **Step 2: 创建 `worker/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022"],
    "types": ["@cloudflare/workers-types"],
    "strict": true,
    "noEmit": true,
    "isolatedModules": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["src"]
}
```

- [ ] **Step 3: 创建 `worker/wrangler.toml`**

```toml
name = "gitradar-worker"
main = "src/index.ts"
compatibility_date = "2025-06-01"

[vars]
FRONTEND_URL = "https://noreply1018.github.io/GitRadar"

# Secrets (set via `wrangler secret put`):
# GITHUB_APP_ID
# GITHUB_APP_PRIVATE_KEY
# GITHUB_CLIENT_ID
# GITHUB_CLIENT_SECRET
# SESSION_SECRET
```

- [ ] **Step 4: 创建 `worker/src/types.ts`**

```typescript
export interface Env {
  GITHUB_APP_ID: string;
  GITHUB_APP_PRIVATE_KEY: string;
  GITHUB_CLIENT_ID: string;
  GITHUB_CLIENT_SECRET: string;
  SESSION_SECRET: string;
  FRONTEND_URL: string;
}

export interface SessionPayload {
  iid: number;       // installation_id
  owner: string;
  repo: string;
  exp: number;
}
```

- [ ] **Step 5: 安装依赖**

Run: `cd worker && npm install`
Expected: `node_modules/` 创建成功，无报错

- [ ] **Step 6: 类型检查**

Run: `cd worker && npx tsc --noEmit`
Expected: 无错误（此时只有 types.ts）

- [ ] **Step 7: 提交**

```bash
git add worker/package.json worker/package-lock.json worker/tsconfig.json worker/wrangler.toml worker/src/types.ts
git commit -m "feat(worker): scaffold Cloudflare Worker project"
```

---

## Task 2: Worker 会话 JWT 模块

**Files:**
- Create: `worker/src/session.ts`

- [ ] **Step 1: 创建 `worker/src/session.ts`**

```typescript
import * as jose from "jose";
import type { Env, SessionPayload } from "./types";

const ALG = "HS256";
const SESSION_TTL = 7 * 24 * 60 * 60; // 7 days in seconds

export async function createSessionToken(
  payload: Omit<SessionPayload, "exp">,
  env: Env,
): Promise<string> {
  const secret = new TextEncoder().encode(env.SESSION_SECRET);
  return new jose.SignJWT({ ...payload })
    .setProtectedHeader({ alg: ALG })
    .setExpirationTime(`${SESSION_TTL}s`)
    .setIssuedAt()
    .sign(secret);
}

export async function verifySessionToken(
  token: string,
  env: Env,
): Promise<SessionPayload> {
  const secret = new TextEncoder().encode(env.SESSION_SECRET);
  const { payload } = await jose.jwtVerify(token, secret, {
    algorithms: [ALG],
  });
  return payload as unknown as SessionPayload;
}
```

- [ ] **Step 2: 类型检查**

Run: `cd worker && npx tsc --noEmit`
Expected: 无错误

- [ ] **Step 3: 提交**

```bash
git add worker/src/session.ts
git commit -m "feat(worker): add session JWT sign/verify module"
```

---

## Task 3: Worker GitHub App 模块

**Files:**
- Create: `worker/src/github-app.ts`

- [ ] **Step 1: 创建 `worker/src/github-app.ts`**

```typescript
import * as jose from "jose";
import type { Env } from "./types";

// Cache installation tokens in module-level Map (per-isolate, not persistent)
const tokenCache = new Map<number, { token: string; expiresAt: number }>();

/**
 * Generate a short-lived JWT for authenticating as the GitHub App itself.
 * This JWT is used to request installation access tokens.
 */
async function createAppJwt(env: Env): Promise<string> {
  const privateKey = await jose.importPKCS8(env.GITHUB_APP_PRIVATE_KEY, "RS256");
  return new jose.SignJWT({})
    .setProtectedHeader({ alg: "RS256" })
    .setIssuer(env.GITHUB_APP_ID)
    .setIssuedAt(Math.floor(Date.now() / 1000) - 60) // 60s clock skew
    .setExpirationTime("10m")
    .sign(privateKey);
}

/**
 * Get an installation access token, using cache when possible.
 * Installation tokens are valid for 1 hour; we cache for 50 minutes.
 */
export async function getInstallationToken(
  installationId: number,
  env: Env,
): Promise<string> {
  const cached = tokenCache.get(installationId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.token;
  }

  const appJwt = await createAppJwt(env);
  const res = await fetch(
    `https://api.github.com/app/installations/${installationId}/access_tokens`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${appJwt}`,
        accept: "application/vnd.github+json",
        "user-agent": "GitRadar-Worker",
      },
    },
  );

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Failed to get installation token: ${res.status} ${body}`);
  }

  const data = (await res.json()) as { token: string; expires_at: string };

  // Cache for 50 minutes (installation tokens expire in 60 min)
  tokenCache.set(installationId, {
    token: data.token,
    expiresAt: Date.now() + 50 * 60 * 1000,
  });

  return data.token;
}

/**
 * Exchange the OAuth code from GitHub App installation flow for
 * the installation_id. Returns owner, repo, and installation_id.
 */
export async function exchangeCodeForInstallation(
  code: string,
  env: Env,
): Promise<{ installationId: number; owner: string; repo: string }> {
  // Exchange code for user access token (GitHub App OAuth)
  const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      client_id: env.GITHUB_CLIENT_ID,
      client_secret: env.GITHUB_CLIENT_SECRET,
      code,
    }),
  });

  if (!tokenRes.ok) {
    throw new Error(`OAuth token exchange failed: ${tokenRes.status}`);
  }

  const tokenData = (await tokenRes.json()) as {
    access_token?: string;
    error?: string;
    error_description?: string;
  };

  if (tokenData.error || !tokenData.access_token) {
    throw new Error(
      `OAuth error: ${tokenData.error_description ?? tokenData.error}`,
    );
  }

  // List installations accessible to this user via the App
  const installRes = await fetch(
    "https://api.github.com/user/installations",
    {
      headers: {
        authorization: `token ${tokenData.access_token}`,
        accept: "application/vnd.github+json",
        "user-agent": "GitRadar-Worker",
      },
    },
  );

  if (!installRes.ok) {
    throw new Error(`Failed to list installations: ${installRes.status}`);
  }

  const installData = (await installRes.json()) as {
    installations: Array<{
      id: number;
      account: { login: string };
    }>;
  };

  if (installData.installations.length === 0) {
    throw new Error("No installations found. Please install the GitHub App first.");
  }

  // Use the first installation (single-user tool)
  const installation = installData.installations[0];

  // Get repositories for this installation to find the repo name
  const repoRes = await fetch(
    `https://api.github.com/user/installations/${installation.id}/repositories`,
    {
      headers: {
        authorization: `token ${tokenData.access_token}`,
        accept: "application/vnd.github+json",
        "user-agent": "GitRadar-Worker",
      },
    },
  );

  if (!repoRes.ok) {
    throw new Error(`Failed to list installation repos: ${repoRes.status}`);
  }

  const repoData = (await repoRes.json()) as {
    repositories: Array<{ name: string; owner: { login: string } }>;
  };

  if (repoData.repositories.length === 0) {
    throw new Error("No repositories found for this installation.");
  }

  const repo = repoData.repositories[0];

  return {
    installationId: installation.id,
    owner: repo.owner.login,
    repo: repo.name,
  };
}
```

- [ ] **Step 2: 类型检查**

Run: `cd worker && npx tsc --noEmit`
Expected: 无错误

- [ ] **Step 3: 提交**

```bash
git add worker/src/github-app.ts
git commit -m "feat(worker): add GitHub App JWT and installation token module"
```

---

## Task 4: Worker 认证路由

**Files:**
- Create: `worker/src/auth.ts`

- [ ] **Step 1: 创建 `worker/src/auth.ts`**

```typescript
import { Hono } from "hono";
import type { Env } from "./types";
import { exchangeCodeForInstallation } from "./github-app";
import { createSessionToken } from "./session";

const auth = new Hono<{ Bindings: Env }>();

/**
 * GET /auth/login
 * Generate a random state, store it in a cookie, redirect to GitHub App installation page.
 */
auth.get("/login", async (c) => {
  const state = crypto.randomUUID();
  const clientId = c.env.GITHUB_CLIENT_ID;
  const redirectUrl = `https://github.com/login/oauth/authorize?client_id=${clientId}&state=${state}`;

  // Set state cookie for CSRF protection (5 min TTL)
  c.header(
    "set-cookie",
    `oauth_state=${state}; HttpOnly; SameSite=Lax; Secure; Path=/; Max-Age=300`,
  );

  return c.redirect(redirectUrl);
});

/**
 * GET /auth/callback
 * GitHub redirects here after user authorizes. Exchange code for installation info,
 * create session JWT, redirect back to frontend.
 */
auth.get("/callback", async (c) => {
  const code = c.req.query("code");
  const state = c.req.query("state");
  const frontendUrl = c.env.FRONTEND_URL;

  // Validate state against cookie
  const cookies = c.req.header("cookie") ?? "";
  const stateCookie = cookies
    .split(";")
    .map((s) => s.trim())
    .find((s) => s.startsWith("oauth_state="));
  const savedState = stateCookie?.split("=")[1];

  if (!code || !state || state !== savedState) {
    return c.redirect(`${frontendUrl}/setup?error=invalid_state`);
  }

  // Clear the state cookie
  c.header(
    "set-cookie",
    "oauth_state=; HttpOnly; SameSite=Lax; Secure; Path=/; Max-Age=0",
  );

  try {
    const { installationId, owner, repo } =
      await exchangeCodeForInstallation(code, c.env);

    const session = await createSessionToken(
      { iid: installationId, owner, repo },
      c.env,
    );

    return c.redirect(
      `${frontendUrl}/setup/callback?session=${encodeURIComponent(session)}`,
    );
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Unknown error during login";
    return c.redirect(
      `${frontendUrl}/setup?error=${encodeURIComponent(message)}`,
    );
  }
});

export default auth;
```

- [ ] **Step 2: 类型检查**

Run: `cd worker && npx tsc --noEmit`
Expected: 无错误

- [ ] **Step 3: 提交**

```bash
git add worker/src/auth.ts
git commit -m "feat(worker): add OAuth login and callback routes"
```

---

## Task 5: Worker API 代理路由

**Files:**
- Create: `worker/src/proxy.ts`

- [ ] **Step 1: 创建 `worker/src/proxy.ts`**

```typescript
import { Hono } from "hono";
import type { Env } from "./types";
import { verifySessionToken } from "./session";
import { getInstallationToken } from "./github-app";

const proxy = new Hono<{ Bindings: Env }>();

/**
 * Middleware: extract and verify session JWT from Authorization header.
 * Attaches session payload to c.set("session", ...).
 */
proxy.use("*", async (c, next) => {
  const authHeader = c.req.header("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return c.json({ error: "Missing or invalid authorization header" }, 401);
  }

  const token = authHeader.slice(7);
  try {
    const session = await verifySessionToken(token, c.env);
    c.set("session" as never, session as never);
  } catch {
    return c.json({ error: "Invalid or expired session" }, 401);
  }

  await next();
});

/**
 * Proxy all requests under /api/github/* to the GitHub API.
 * Maps:
 *   /api/github/repos/contents/path  -> /repos/{owner}/{repo}/contents/path
 *   /api/github/repos/actions/...    -> /repos/{owner}/{repo}/actions/...
 *   /api/github/repos                -> /repos/{owner}/{repo}
 */
proxy.all("/*", async (c) => {
  const session = c.get("session" as never) as {
    iid: number;
    owner: string;
    repo: string;
  };

  const installToken = await getInstallationToken(session.iid, c.env);

  // Strip the /api/github prefix to get the relative path
  const url = new URL(c.req.url);
  const relativePath = url.pathname.replace(/^\/api\/github/, "");

  // Build the GitHub API path: prepend /repos/{owner}/{repo}
  let githubPath: string;
  if (relativePath === "/repos" || relativePath === "/repos/") {
    githubPath = `/repos/${session.owner}/${session.repo}`;
  } else if (relativePath.startsWith("/repos/")) {
    githubPath = `/repos/${session.owner}/${session.repo}${relativePath.slice(6)}`;
  } else {
    return c.json({ error: "Invalid API path" }, 400);
  }

  const githubUrl = `https://api.github.com${githubPath}${url.search}`;

  const headers: Record<string, string> = {
    authorization: `token ${installToken}`,
    accept: "application/vnd.github.v3+json",
    "user-agent": "GitRadar-Worker",
  };

  // Forward content-type and body for non-GET requests
  const method = c.req.method;
  let body: string | undefined;

  if (method !== "GET" && method !== "HEAD") {
    headers["content-type"] = "application/json";
    body = await c.req.text();
  }

  const ghRes = await fetch(githubUrl, { method, headers, body });

  // Forward the response status and body
  const responseHeaders = new Headers();
  responseHeaders.set(
    "content-type",
    ghRes.headers.get("content-type") ?? "application/json",
  );

  return new Response(ghRes.body, {
    status: ghRes.status,
    headers: responseHeaders,
  });
});

export default proxy;
```

- [ ] **Step 2: 类型检查**

Run: `cd worker && npx tsc --noEmit`
Expected: 无错误

- [ ] **Step 3: 提交**

```bash
git add worker/src/proxy.ts
git commit -m "feat(worker): add GitHub API proxy with session auth"
```

---

## Task 6: Worker 入口与 CORS

**Files:**
- Create: `worker/src/index.ts`

- [ ] **Step 1: 创建 `worker/src/index.ts`**

```typescript
import { Hono } from "hono";
import { cors } from "hono/cors";
import type { Env } from "./types";
import auth from "./auth";
import proxy from "./proxy";

const app = new Hono<{ Bindings: Env }>();

// CORS: allow frontend origin for API proxy routes
app.use(
  "/api/*",
  cors({
    origin: (origin, c) => {
      const allowed = c.env.FRONTEND_URL;
      return origin === allowed ? origin : "";
    },
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowHeaders: ["authorization", "content-type"],
    maxAge: 86400,
  }),
);

// Health check
app.get("/health", (c) => c.json({ ok: true }));

// Auth routes (no CORS needed — browser navigates directly)
app.route("/auth", auth);

// API proxy routes
app.route("/api/github", proxy);

export default app;
```

- [ ] **Step 2: 类型检查**

Run: `cd worker && npx tsc --noEmit`
Expected: 无错误

- [ ] **Step 3: 本地启动验证**

Run: `cd worker && npx wrangler dev`
Expected: Worker 启动成功（会因缺少 secrets 而在实际请求时报错，但启动本身应成功）

按 `Ctrl+C` 停止。

- [ ] **Step 4: 提交**

```bash
git add worker/src/index.ts
git commit -m "feat(worker): add Hono entry point with CORS and route mounting"
```

---

## Task 7: 前端环境配置

**Files:**
- Create: `web/src/config.ts`
- Modify: `web/vite.config.ts`
- Modify: `web/src/vite-env.d.ts`

- [ ] **Step 1: 创建 `web/src/config.ts`**

```typescript
export const WORKER_URL = import.meta.env.VITE_WORKER_URL as string;
```

- [ ] **Step 2: 修改 `web/vite.config.ts`**

在 `defineConfig` 中添加 `define` 配置，使开发时有默认值：

```typescript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: "/GitRadar/",
  envPrefix: "VITE_",
});
```

注意：`envPrefix: "VITE_"` 是 Vite 默认值，这里显式声明以便阅读。实际上 Vite 已经默认支持 `VITE_` 前缀。如果当前 `vite.config.ts` 已经很简洁，只需确保不阻止环境变量即可。因为 Vite 默认已经支持 `VITE_` 前缀环境变量，所以 `vite.config.ts` 不需要改动。

- [ ] **Step 3: 修改 `web/src/vite-env.d.ts`**

```typescript
/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_WORKER_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
```

- [ ] **Step 4: 提交**

```bash
git add web/src/config.ts web/src/vite-env.d.ts
git commit -m "feat(web): add worker URL config and env type declarations"
```

---

## Task 8: 重写 useAuth hook

**Files:**
- Modify: `web/src/hooks/useAuth.ts`

- [ ] **Step 1: 重写 `web/src/hooks/useAuth.ts`**

```typescript
import { useCallback, useSyncExternalStore } from "react";

interface AuthState {
  session: string;
  owner: string;
  repo: string;
}

const STORAGE_KEY = "gitradar_session";

// Legacy keys to clean up
const LEGACY_KEYS = ["gitradar_pat", "gitradar_owner", "gitradar_repo"];

function cleanLegacyStorage(): void {
  for (const key of LEGACY_KEYS) {
    localStorage.removeItem(key);
  }
}

function decodeJwtPayload(token: string): { owner: string; repo: string; exp: number } | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payload = JSON.parse(atob(parts[1]));
    return payload;
  } catch {
    return null;
  }
}

function getSnapshot(): AuthState | null {
  const session = localStorage.getItem(STORAGE_KEY);
  if (!session) return null;

  const payload = decodeJwtPayload(session);
  if (!payload) {
    localStorage.removeItem(STORAGE_KEY);
    return null;
  }

  // Check expiration
  if (payload.exp * 1000 < Date.now()) {
    localStorage.removeItem(STORAGE_KEY);
    return null;
  }

  return { session, owner: payload.owner, repo: payload.repo };
}

function subscribe(callback: () => void): () => void {
  window.addEventListener("storage", callback);
  return () => window.removeEventListener("storage", callback);
}

export function useAuth() {
  const auth = useSyncExternalStore(subscribe, getSnapshot, () => null);

  const login = useCallback((session: string) => {
    cleanLegacyStorage();
    localStorage.setItem(STORAGE_KEY, session);
    window.dispatchEvent(new Event("storage"));
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    window.dispatchEvent(new Event("storage"));
  }, []);

  return { auth, login, logout };
}
```

- [ ] **Step 2: 类型检查**

Run: `cd web && npx tsc --noEmit`
Expected: 会有编译错误（因为 SetupPage 还在调用旧的 `login(token, owner, repo)` 签名）。这是预期的，后续步骤会修复。

- [ ] **Step 3: 提交**

```bash
git add web/src/hooks/useAuth.ts
git commit -m "feat(web): rewrite useAuth for session JWT"
```

---

## Task 9: 重写 GitHubClient 为 Worker 代理客户端

**Files:**
- Modify: `web/src/api/github.ts`
- Modify: `web/src/hooks/useGitHub.ts`

- [ ] **Step 1: 重写 `web/src/api/github.ts`**

```typescript
import type {
  GitHubDirectoryEntry,
  GitHubFileResponse,
  GitHubWorkflowRun,
  GitHubWorkflowRunsResponse,
} from "./types";
import { WORKER_URL } from "../config";

export class GitHubClient {
  private readonly baseUrl: string;

  constructor(private readonly session: string) {
    this.baseUrl = `${WORKER_URL}/api/github`;
  }

  async readFile(path: string): Promise<{ content: string; sha: string }> {
    const res = await this.request<GitHubFileResponse>(
      `/repos/contents/${path}`,
    );

    if (res.type !== "file" || !res.content) {
      throw new Error(`Path is not a file: ${path}`);
    }

    const content = decodeBase64(res.content);
    return { content, sha: res.sha };
  }

  async writeFile(
    path: string,
    content: string,
    message: string,
    sha?: string,
  ): Promise<void> {
    const body: Record<string, string> = {
      message,
      content: encodeBase64(content),
    };

    if (sha) {
      body.sha = sha;
    }

    await this.request(`/repos/contents/${path}`, {
      method: "PUT",
      body: JSON.stringify(body),
    });
  }

  async listDirectory(path: string): Promise<GitHubDirectoryEntry[]> {
    return this.request<GitHubDirectoryEntry[]>(
      `/repos/contents/${path}`,
    );
  }

  async triggerWorkflow(workflowId: string, ref = "main"): Promise<void> {
    await this.request(
      `/repos/actions/workflows/${workflowId}/dispatches`,
      {
        method: "POST",
        body: JSON.stringify({ ref }),
      },
    );
  }

  async listWorkflowRuns(
    workflowId: string,
    perPage = 20,
  ): Promise<GitHubWorkflowRun[]> {
    const res = await this.request<GitHubWorkflowRunsResponse>(
      `/repos/actions/workflows/${workflowId}/runs?per_page=${perPage}`,
    );

    return res.workflow_runs;
  }

  async validateConnection(): Promise<boolean> {
    try {
      await this.request("/repos");
      return true;
    } catch {
      return false;
    }
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const res = await fetch(url, {
      ...init,
      headers: {
        authorization: `Bearer ${this.session}`,
        "content-type": "application/json",
        ...init?.headers,
      },
    });

    if (res.status === 401) {
      throw new AuthError("Session is invalid or expired.");
    }

    if (res.status === 404) {
      throw new NotFoundError(`Not found: ${path}`);
    }

    if (res.status === 409) {
      throw new ConflictError(
        "File was modified by another process. Please refresh and try again.",
      );
    }

    if (!res.ok) {
      throw new Error(`API error: ${res.status} ${res.statusText}`);
    }

    if (res.status === 204) {
      return undefined as T;
    }

    return res.json() as Promise<T>;
  }
}

export class AuthError extends Error {
  readonly name = "AuthError";
}

export class NotFoundError extends Error {
  readonly name = "NotFoundError";
}

export class ConflictError extends Error {
  readonly name = "ConflictError";
}

function decodeBase64(encoded: string): string {
  return decodeURIComponent(
    atob(encoded.replace(/\n/g, ""))
      .split("")
      .map((c) => "%" + c.charCodeAt(0).toString(16).padStart(2, "0"))
      .join(""),
  );
}

function encodeBase64(content: string): string {
  return btoa(
    encodeURIComponent(content).replace(/%([0-9A-F]{2})/g, (_, p1) =>
      String.fromCharCode(parseInt(p1, 16)),
    ),
  );
}
```

- [ ] **Step 2: 修改 `web/src/hooks/useGitHub.ts`**

```typescript
import { useMemo } from "react";
import { GitHubClient } from "../api/github";
import { useAuth } from "./useAuth";

export function useGitHub(): GitHubClient | null {
  const { auth } = useAuth();

  return useMemo(() => {
    if (!auth) return null;
    return new GitHubClient(auth.session);
  }, [auth]);
}
```

- [ ] **Step 3: 提交**

```bash
git add web/src/api/github.ts web/src/hooks/useGitHub.ts
git commit -m "feat(web): rewrite GitHubClient to use Worker proxy"
```

---

## Task 10: 新建 CallbackPage 处理 OAuth 回调

**Files:**
- Create: `web/src/pages/CallbackPage.tsx`

- [ ] **Step 1: 创建 `web/src/pages/CallbackPage.tsx`**

```typescript
import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { useAuth } from "../hooks/useAuth";

export default function CallbackPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [error, setError] = useState("");

  useEffect(() => {
    const session = searchParams.get("session");

    if (!session) {
      setError("登录失败：未收到有效的会话凭证。");
      return;
    }

    login(session);
    navigate("/", { replace: true });
  }, [searchParams, login, navigate]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-md space-y-4">
          <h1 className="text-xl font-bold text-red-600">登录失败</h1>
          <p className="text-sm text-gray-600">{error}</p>
          <a
            href="/GitRadar/setup"
            className="inline-block text-sm text-blue-600 hover:underline"
          >
            返回登录页
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <p className="text-gray-500">正在登录...</p>
    </div>
  );
}
```

- [ ] **Step 2: 提交**

```bash
git add web/src/pages/CallbackPage.tsx
git commit -m "feat(web): add OAuth callback page"
```

---

## Task 11: 重写 SetupPage 为 OAuth 登录页

**Files:**
- Modify: `web/src/pages/SetupPage.tsx`

- [ ] **Step 1: 重写 `web/src/pages/SetupPage.tsx`**

```typescript
import { useSearchParams } from "react-router";
import { WORKER_URL } from "../config";

export default function SetupPage() {
  const [searchParams] = useSearchParams();
  const error = searchParams.get("error");

  function handleLogin() {
    window.location.href = `${WORKER_URL}/auth/login`;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-md space-y-4 text-center">
        <h1 className="text-xl font-bold">GitRadar Console</h1>
        <p className="text-sm text-gray-500">
          通过 GitHub 授权连接你的 GitRadar 仓库。
        </p>

        {error && (
          <p className="text-sm text-red-600">
            登录失败：{decodeURIComponent(error)}
          </p>
        )}

        <button
          onClick={handleLogin}
          className="w-full bg-gray-900 text-white py-2 rounded text-sm font-medium hover:bg-gray-800 flex items-center justify-center gap-2"
        >
          <svg
            className="w-5 h-5"
            fill="currentColor"
            viewBox="0 0 24 24"
          >
            <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
          </svg>
          使用 GitHub 登录
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 提交**

```bash
git add web/src/pages/SetupPage.tsx
git commit -m "feat(web): rewrite SetupPage as OAuth login page"
```

---

## Task 12: 更新 App.tsx 路由

**Files:**
- Modify: `web/src/App.tsx`

- [ ] **Step 1: 修改 `web/src/App.tsx`**

```typescript
import { BrowserRouter, Routes, Route, Navigate } from "react-router";
import { useAuth } from "./hooks/useAuth";
import Layout from "./components/Layout";
import SetupPage from "./pages/SetupPage";
import CallbackPage from "./pages/CallbackPage";
import DashboardPage from "./pages/DashboardPage";
import HistoryPage from "./pages/HistoryPage";
import ConfigPage from "./pages/ConfigPage";
import FeedbackPage from "./pages/FeedbackPage";
import LogsPage from "./pages/LogsPage";

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { auth } = useAuth();

  if (!auth) {
    return <Navigate to="/setup" replace />;
  }

  return <>{children}</>;
}

export default function App() {
  return (
    <BrowserRouter basename="/GitRadar">
      <Routes>
        <Route path="/setup" element={<SetupPage />} />
        <Route path="/setup/callback" element={<CallbackPage />} />
        <Route
          element={
            <AuthGuard>
              <Layout />
            </AuthGuard>
          }
        >
          <Route path="/" element={<DashboardPage />} />
          <Route path="/history" element={<HistoryPage />} />
          <Route path="/config" element={<ConfigPage />} />
          <Route path="/feedback" element={<FeedbackPage />} />
          <Route path="/logs" element={<LogsPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
```

- [ ] **Step 2: 类型检查（全前端）**

Run: `cd web && npx tsc --noEmit`
Expected: 无错误。所有页面通过 `useGitHub()` 获取的 `GitHubClient` 接口不变（`readFile`, `writeFile`, `listDirectory`, `triggerWorkflow`, `listWorkflowRuns` 签名未变），所以 DashboardPage、HistoryPage、ConfigPage、FeedbackPage、LogsPage 不需要修改。

- [ ] **Step 3: 提交**

```bash
git add web/src/App.tsx
git commit -m "feat(web): add callback route to App router"
```

---

## Task 13: 前端构建验证

**Files:** 无新文件

- [ ] **Step 1: 前端类型检查**

Run: `cd web && npx tsc --noEmit`
Expected: 无错误

- [ ] **Step 2: 前端构建**

Run: `cd web && VITE_WORKER_URL=https://gitradar-worker.example.workers.dev npm run build`
Expected: 构建成功，输出到 `web/dist/`

- [ ] **Step 3: 提交（如有 .gitignore 或配置修改）**

如果一切正常无需额外提交。

---

## Task 14: 更新 GitHub Pages 部署工作流

**Files:**
- Modify: `.github/workflows/deploy-pages.yml`

- [ ] **Step 1: 在工作流中添加 VITE_WORKER_URL 环境变量**

在 deploy-pages.yml 的 build step 中添加环境变量。找到 `npm run build` 步骤，在其上方添加 `env:`：

```yaml
      - name: Build
        working-directory: web
        env:
          VITE_WORKER_URL: ${{ vars.WORKER_URL }}
        run: npm run build
```

需要在 GitHub 仓库的 Settings > Secrets and Variables > Actions > Variables 中添加 `WORKER_URL` 变量，值为 Worker 的部署 URL（如 `https://gitradar-worker.<account>.workers.dev`）。

- [ ] **Step 2: 提交**

```bash
git add .github/workflows/deploy-pages.yml
git commit -m "ci: pass WORKER_URL env to Pages build"
```

---

## Task 15: Worker 部署指南

**Files:**
- Create: `worker/README.md`

- [ ] **Step 1: 创建 `worker/README.md`**

```markdown
# GitRadar Worker

Cloudflare Worker，处理 GitHub App OAuth 登录和 API 代理。

## 前置条件

1. 创建 GitHub App：
   - Homepage URL: `https://noreply1018.github.io/GitRadar`
   - Callback URL: `https://gitradar-worker.<account>.workers.dev/auth/callback`
   - Permissions: `contents: read & write`, `actions: read & write`, `metadata: read`
   - 生成私钥（PEM 格式）

2. 安装 GitHub App 到 GitRadar 仓库

## 部署

```bash
cd worker
npm install

# 设置 secrets
npx wrangler secret put GITHUB_APP_ID
npx wrangler secret put GITHUB_APP_PRIVATE_KEY
npx wrangler secret put GITHUB_CLIENT_ID
npx wrangler secret put GITHUB_CLIENT_SECRET
npx wrangler secret put SESSION_SECRET

# 部署
npm run deploy
```

## 本地开发

```bash
# 创建 .dev.vars 文件（不入库）
cat > .dev.vars << 'EOF'
GITHUB_APP_ID=your_app_id
GITHUB_APP_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----"
GITHUB_CLIENT_ID=your_client_id
GITHUB_CLIENT_SECRET=your_client_secret
SESSION_SECRET=any_random_string_for_dev
EOF

npm run dev
```
```

- [ ] **Step 2: 添加 `.dev.vars` 到 worker `.gitignore`**

创建 `worker/.gitignore`：

```
node_modules/
.dev.vars
.wrangler/
```

- [ ] **Step 3: 提交**

```bash
git add worker/README.md worker/.gitignore
git commit -m "docs(worker): add deployment guide and gitignore"
```
