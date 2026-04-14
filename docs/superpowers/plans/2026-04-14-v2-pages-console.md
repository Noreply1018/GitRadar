# v2 GitRadar Pages Console Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a GitHub Pages SPA console that lets a single user manage GitRadar's configuration, browse history, provide feedback, and monitor workflows — all through the GitHub REST API, zero backend.

**Architecture:** Monorepo SPA in `web/` using React + Vite + TailwindCSS. All state lives in the GitHub repo — config, archives, feedback, runtime. The SPA reads/writes via GitHub Contents API and Actions API, authenticated by a user-supplied PAT stored in localStorage.

**Tech Stack:** React 19, TypeScript, Vite, TailwindCSS v4, React Router v7, GitHub REST API (via fetch)

---

## File Structure

```
web/
├── package.json
├── tsconfig.json
├── vite.config.ts
├── index.html
├── public/
│   └── 404.html                       # SPA fallback for GitHub Pages
├── src/
│   ├── main.tsx                        # ReactDOM entry
│   ├── App.tsx                         # Router + auth guard + layout shell
│   ├── api/
│   │   ├── github.ts                   # GitHubClient class — all GitHub REST API calls
│   │   └── types.ts                    # API response types
│   ├── hooks/
│   │   ├── useAuth.ts                  # PAT + owner/repo from localStorage, validate, clear
│   │   └── useGitHub.ts               # Instantiate GitHubClient from auth context
│   ├── pages/
│   │   ├── SetupPage.tsx               # PAT input form
│   │   ├── DashboardPage.tsx           # Runtime status overview
│   │   ├── HistoryPage.tsx             # Archive list + detail view
│   │   ├── ConfigPage.tsx              # Schedule + digest-rules editor
│   │   ├── FeedbackPage.tsx            # Like/bookmark/not-interested per digest item
│   │   └── LogsPage.tsx               # Workflow runs list + manual trigger
│   └── components/
│       ├── Layout.tsx                  # Sidebar nav + content area
│       ├── NavLink.tsx                 # Active-aware nav link
│       └── Toast.tsx                   # Simple toast notification
```

Additionally:
- `.github/workflows/deploy-pages.yml` — new workflow for building and deploying to GitHub Pages
- Root `tsconfig.json` — will need `web/` excluded from backend TS config (or leave as-is since web has its own)

---

### Task 1: Scaffold `web/` project with Vite + React + TypeScript

**Files:**
- Create: `web/package.json`
- Create: `web/tsconfig.json`
- Create: `web/vite.config.ts`
- Create: `web/index.html`
- Create: `web/src/main.tsx`
- Create: `web/src/App.tsx`

- [ ] **Step 1: Create `web/package.json`**

```json
{
  "name": "gitradar-console",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview"
  }
}
```

- [ ] **Step 2: Install dependencies**

Run:
```bash
cd web && npm install react@19 react-dom@19 react-router@7 && npm install -D vite@6 @vitejs/plugin-react typescript @types/react @types/react-dom tailwindcss@4 @tailwindcss/vite@4
```

- [ ] **Step 3: Create `web/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
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

- [ ] **Step 4: Create `web/vite.config.ts`**

```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: "/GitRadar/",
});
```

Note: `base` must match the GitHub Pages URL path `https://<owner>.github.io/GitRadar/`.

- [ ] **Step 5: Create `web/index.html`**

```html
<!DOCTYPE html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>GitRadar Console</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 6: Create `web/src/main.tsx`**

```tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";

import "./main.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

- [ ] **Step 7: Create `web/src/main.css`**

```css
@import "tailwindcss";
```

- [ ] **Step 8: Create `web/src/App.tsx` (minimal placeholder)**

```tsx
export default function App() {
  return <div className="p-8 text-lg">GitRadar Console</div>;
}
```

- [ ] **Step 9: Verify dev server starts**

Run:
```bash
cd web && npm run dev
```

Expected: Vite dev server starts, browser shows "GitRadar Console" with TailwindCSS styling applied.

- [ ] **Step 10: Verify build succeeds**

Run:
```bash
cd web && npm run build
```

Expected: `web/dist/` created with `index.html` and JS/CSS assets. No errors.

- [ ] **Step 11: Commit**

```bash
git add web/
git commit -m "feat(web): scaffold Vite + React + TypeScript + TailwindCSS project"
```

---

### Task 2: GitHub API client

**Files:**
- Create: `web/src/api/types.ts`
- Create: `web/src/api/github.ts`

- [ ] **Step 1: Create `web/src/api/types.ts`**

```ts
export interface GitHubFileResponse {
  name: string;
  path: string;
  sha: string;
  size: number;
  content?: string;
  encoding?: string;
  html_url: string;
  download_url: string | null;
  type: "file" | "dir" | "symlink" | "submodule";
}

export interface GitHubDirectoryEntry {
  name: string;
  path: string;
  sha: string;
  type: "file" | "dir" | "symlink" | "submodule";
}

export interface GitHubWorkflowRun {
  id: number;
  name: string | null;
  status: string | null;
  conclusion: string | null;
  event: string;
  created_at: string;
  updated_at: string;
  html_url: string;
  run_started_at?: string;
}

export interface GitHubWorkflowRunsResponse {
  total_count: number;
  workflow_runs: GitHubWorkflowRun[];
}
```

- [ ] **Step 2: Create `web/src/api/github.ts`**

```ts
import type {
  GitHubDirectoryEntry,
  GitHubFileResponse,
  GitHubWorkflowRun,
  GitHubWorkflowRunsResponse,
} from "./types";

export class GitHubClient {
  private readonly baseUrl = "https://api.github.com";

  constructor(
    private readonly token: string,
    private readonly owner: string,
    private readonly repo: string,
  ) {}

  async readFile(path: string): Promise<{ content: string; sha: string }> {
    const res = await this.request<GitHubFileResponse>(
      `/repos/${this.owner}/${this.repo}/contents/${path}`,
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

    await this.request(`/repos/${this.owner}/${this.repo}/contents/${path}`, {
      method: "PUT",
      body: JSON.stringify(body),
    });
  }

  async listDirectory(path: string): Promise<GitHubDirectoryEntry[]> {
    return this.request<GitHubDirectoryEntry[]>(
      `/repos/${this.owner}/${this.repo}/contents/${path}`,
    );
  }

  async triggerWorkflow(workflowId: string, ref = "main"): Promise<void> {
    await this.request(
      `/repos/${this.owner}/${this.repo}/actions/workflows/${workflowId}/dispatches`,
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
      `/repos/${this.owner}/${this.repo}/actions/workflows/${workflowId}/runs?per_page=${perPage}`,
    );

    return res.workflow_runs;
  }

  async validateToken(): Promise<boolean> {
    try {
      await this.request(`/repos/${this.owner}/${this.repo}`);
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
        authorization: `token ${this.token}`,
        accept: "application/vnd.github.v3+json",
        "content-type": "application/json",
        ...init?.headers,
      },
    });

    if (res.status === 401) {
      throw new AuthError("Token is invalid or expired.");
    }

    if (res.status === 404) {
      throw new NotFoundError(`Not found: ${path}`);
    }

    if (res.status === 409) {
      throw new ConflictError("File was modified by another process. Please refresh and try again.");
    }

    if (!res.ok) {
      throw new Error(`GitHub API error: ${res.status} ${res.statusText}`);
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

- [ ] **Step 3: Verify type-check passes**

Run:
```bash
cd web && npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add web/src/api/
git commit -m "feat(web): add GitHub REST API client with typed error classes"
```

---

### Task 3: Auth hooks and Setup page

**Files:**
- Create: `web/src/hooks/useAuth.ts`
- Create: `web/src/hooks/useGitHub.ts`
- Create: `web/src/pages/SetupPage.tsx`
- Modify: `web/src/App.tsx`

- [ ] **Step 1: Create `web/src/hooks/useAuth.ts`**

```ts
import { useCallback, useSyncExternalStore } from "react";

interface AuthState {
  token: string;
  owner: string;
  repo: string;
}

const STORAGE_KEYS = {
  token: "gitradar_pat",
  owner: "gitradar_owner",
  repo: "gitradar_repo",
} as const;

function getSnapshot(): AuthState | null {
  const token = localStorage.getItem(STORAGE_KEYS.token);
  const owner = localStorage.getItem(STORAGE_KEYS.owner);
  const repo = localStorage.getItem(STORAGE_KEYS.repo);

  if (!token || !owner || !repo) {
    return null;
  }

  return { token, owner, repo };
}

function subscribe(callback: () => void): () => void {
  window.addEventListener("storage", callback);
  return () => window.removeEventListener("storage", callback);
}

export function useAuth() {
  const auth = useSyncExternalStore(subscribe, getSnapshot, () => null);

  const login = useCallback(
    (token: string, owner: string, repo: string) => {
      localStorage.setItem(STORAGE_KEYS.token, token);
      localStorage.setItem(STORAGE_KEYS.owner, owner);
      localStorage.setItem(STORAGE_KEYS.repo, repo);
      window.dispatchEvent(new Event("storage"));
    },
    [],
  );

  const logout = useCallback(() => {
    localStorage.removeItem(STORAGE_KEYS.token);
    localStorage.removeItem(STORAGE_KEYS.owner);
    localStorage.removeItem(STORAGE_KEYS.repo);
    window.dispatchEvent(new Event("storage"));
  }, []);

  return { auth, login, logout };
}
```

- [ ] **Step 2: Create `web/src/hooks/useGitHub.ts`**

```ts
import { useMemo } from "react";
import { GitHubClient } from "../api/github";
import { useAuth } from "./useAuth";

export function useGitHub(): GitHubClient | null {
  const { auth } = useAuth();

  return useMemo(() => {
    if (!auth) return null;
    return new GitHubClient(auth.token, auth.owner, auth.repo);
  }, [auth]);
}
```

- [ ] **Step 3: Create `web/src/pages/SetupPage.tsx`**

```tsx
import { type FormEvent, useState } from "react";
import { useNavigate } from "react-router";
import { GitHubClient } from "../api/github";
import { useAuth } from "../hooks/useAuth";

export default function SetupPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [token, setToken] = useState("");
  const [owner, setOwner] = useState("");
  const [repo, setRepo] = useState("GitRadar");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const client = new GitHubClient(token.trim(), owner.trim(), repo.trim());
      const valid = await client.validateToken();

      if (!valid) {
        setError("无法访问该仓库，请检查 Token 和仓库信息。");
        return;
      }

      login(token.trim(), owner.trim(), repo.trim());
      navigate("/");
    } catch {
      setError("验证失败，请检查网络连接。");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <form
        onSubmit={handleSubmit}
        className="bg-white p-8 rounded-lg shadow-md w-full max-w-md space-y-4"
      >
        <h1 className="text-xl font-bold">GitRadar Console 设置</h1>
        <p className="text-sm text-gray-500">
          输入 GitHub PAT（需要 <code>repo</code> scope）和仓库信息。
        </p>

        <label className="block">
          <span className="text-sm font-medium">GitHub Token</span>
          <input
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            required
            className="mt-1 block w-full rounded border border-gray-300 px-3 py-2 text-sm"
            placeholder="ghp_..."
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium">Owner（用户名或组织名）</span>
          <input
            type="text"
            value={owner}
            onChange={(e) => setOwner(e.target.value)}
            required
            className="mt-1 block w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium">Repo</span>
          <input
            type="text"
            value={repo}
            onChange={(e) => setRepo(e.target.value)}
            required
            className="mt-1 block w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </label>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 text-white py-2 rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? "验证中..." : "连接"}
        </button>
      </form>
    </div>
  );
}
```

- [ ] **Step 4: Update `web/src/App.tsx` with routing and auth guard**

```tsx
import { BrowserRouter, Routes, Route, Navigate } from "react-router";
import { useAuth } from "./hooks/useAuth";
import SetupPage from "./pages/SetupPage";

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { auth } = useAuth();

  if (!auth) {
    return <Navigate to="/setup" replace />;
  }

  return <>{children}</>;
}

function PlaceholderPage({ title }: { title: string }) {
  return <div className="p-8 text-lg">{title}</div>;
}

export default function App() {
  return (
    <BrowserRouter basename="/GitRadar">
      <Routes>
        <Route path="/setup" element={<SetupPage />} />
        <Route
          path="/*"
          element={
            <AuthGuard>
              <Routes>
                <Route path="/" element={<PlaceholderPage title="Dashboard" />} />
                <Route path="/history" element={<PlaceholderPage title="History" />} />
                <Route path="/config" element={<PlaceholderPage title="Config" />} />
                <Route path="/feedback" element={<PlaceholderPage title="Feedback" />} />
                <Route path="/logs" element={<PlaceholderPage title="Logs" />} />
              </Routes>
            </AuthGuard>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}
```

- [ ] **Step 5: Verify dev server — unauthenticated redirects to `/setup`**

Run:
```bash
cd web && npm run dev
```

Expected: Opening `http://localhost:5173/GitRadar/` redirects to `/GitRadar/setup`. The setup form renders correctly.

- [ ] **Step 6: Commit**

```bash
git add web/src/
git commit -m "feat(web): add auth hooks, setup page, and routing with auth guard"
```

---

### Task 4: Layout shell with sidebar navigation

**Files:**
- Create: `web/src/components/Layout.tsx`
- Create: `web/src/components/NavLink.tsx`
- Modify: `web/src/App.tsx`

- [ ] **Step 1: Create `web/src/components/NavLink.tsx`**

```tsx
import { NavLink as RouterNavLink } from "react-router";

export default function NavLink({
  to,
  children,
}: {
  to: string;
  children: React.ReactNode;
}) {
  return (
    <RouterNavLink
      to={to}
      end
      className={({ isActive }) =>
        `block px-4 py-2 rounded text-sm ${
          isActive
            ? "bg-blue-100 text-blue-700 font-medium"
            : "text-gray-600 hover:bg-gray-100"
        }`
      }
    >
      {children}
    </RouterNavLink>
  );
}
```

- [ ] **Step 2: Create `web/src/components/Layout.tsx`**

```tsx
import { Outlet } from "react-router";
import NavLink from "./NavLink";
import { useAuth } from "../hooks/useAuth";

export default function Layout() {
  const { logout } = useAuth();

  return (
    <div className="min-h-screen flex bg-gray-50">
      <aside className="w-56 bg-white border-r border-gray-200 p-4 flex flex-col justify-between">
        <div>
          <h1 className="text-lg font-bold mb-6 px-4">GitRadar</h1>
          <nav className="space-y-1">
            <NavLink to="/">Dashboard</NavLink>
            <NavLink to="/history">History</NavLink>
            <NavLink to="/config">Config</NavLink>
            <NavLink to="/feedback">Feedback</NavLink>
            <NavLink to="/logs">Logs</NavLink>
          </nav>
        </div>
        <button
          onClick={logout}
          className="text-sm text-gray-500 hover:text-red-600 px-4 py-2 text-left"
        >
          退出登录
        </button>
      </aside>
      <main className="flex-1 p-8 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
```

- [ ] **Step 3: Update `web/src/App.tsx` to use Layout**

```tsx
import { BrowserRouter, Routes, Route, Navigate } from "react-router";
import { useAuth } from "./hooks/useAuth";
import Layout from "./components/Layout";
import SetupPage from "./pages/SetupPage";

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { auth } = useAuth();

  if (!auth) {
    return <Navigate to="/setup" replace />;
  }

  return <>{children}</>;
}

function PlaceholderPage({ title }: { title: string }) {
  return <h2 className="text-xl font-semibold">{title}</h2>;
}

export default function App() {
  return (
    <BrowserRouter basename="/GitRadar">
      <Routes>
        <Route path="/setup" element={<SetupPage />} />
        <Route
          element={
            <AuthGuard>
              <Layout />
            </AuthGuard>
          }
        >
          <Route path="/" element={<PlaceholderPage title="Dashboard" />} />
          <Route path="/history" element={<PlaceholderPage title="History" />} />
          <Route path="/config" element={<PlaceholderPage title="Config" />} />
          <Route path="/feedback" element={<PlaceholderPage title="Feedback" />} />
          <Route path="/logs" element={<PlaceholderPage title="Logs" />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
```

- [ ] **Step 4: Verify layout renders with sidebar and navigation**

Run:
```bash
cd web && npm run dev
```

Expected: After authenticating (or setting localStorage manually), the page shows a sidebar with 5 nav links. Clicking each link highlights the active one and shows the placeholder content.

- [ ] **Step 5: Commit**

```bash
git add web/src/
git commit -m "feat(web): add layout shell with sidebar navigation"
```

---

### Task 5: Dashboard page

**Files:**
- Create: `web/src/pages/DashboardPage.tsx`
- Modify: `web/src/App.tsx` — swap placeholder

- [ ] **Step 1: Create `web/src/pages/DashboardPage.tsx`**

```tsx
import { useEffect, useState } from "react";
import { useGitHub } from "../hooks/useGitHub";
import { NotFoundError } from "../api/github";

interface RuntimeState {
  source: string;
  workflowName: string;
  trigger: string;
  lastRunAt: string;
  lastRunStatus: string;
  lastArchiveDate: string;
  runUrl: string;
  ref: string;
}

export default function DashboardPage() {
  const client = useGitHub();
  const [runtime, setRuntime] = useState<RuntimeState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!client) return;

    setLoading(true);
    client
      .readFile("data/runtime/github-runtime.json")
      .then(({ content }) => setRuntime(JSON.parse(content) as RuntimeState))
      .catch((err) => {
        if (err instanceof NotFoundError) {
          setRuntime(null);
        } else {
          setError(err instanceof Error ? err.message : String(err));
        }
      })
      .finally(() => setLoading(false));
  }, [client]);

  if (loading) return <p className="text-gray-500">加载中...</p>;
  if (error) return <p className="text-red-600">{error}</p>;
  if (!runtime) return <p className="text-gray-500">暂无运行记录。</p>;

  const statusColor =
    runtime.lastRunStatus === "success" ? "text-green-600" : "text-red-600";

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">Dashboard</h2>

      <div className="grid grid-cols-2 gap-4">
        <Card label="运行状态">
          <span className={`font-medium ${statusColor}`}>
            {runtime.lastRunStatus}
          </span>
        </Card>
        <Card label="最近运行">
          {new Date(runtime.lastRunAt).toLocaleString("zh-CN")}
        </Card>
        <Card label="最新归档">{runtime.lastArchiveDate}</Card>
        <Card label="触发方式">{runtime.trigger}</Card>
      </div>

      <a
        href={runtime.runUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-block text-sm text-blue-600 hover:underline"
      >
        查看 GitHub Actions 日志
      </a>
    </div>
  );
}

function Card({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className="text-sm">{children}</p>
    </div>
  );
}
```

- [ ] **Step 2: Update `web/src/App.tsx` — import and use DashboardPage**

Replace `<PlaceholderPage title="Dashboard" />` with `<DashboardPage />` and add the import:

```tsx
import DashboardPage from "./pages/DashboardPage";
```

```tsx
<Route path="/" element={<DashboardPage />} />
```

- [ ] **Step 3: Verify Dashboard renders runtime data**

Run:
```bash
cd web && npm run dev
```

Expected: Dashboard shows runtime status cards with data from the repo's `data/runtime/github-runtime.json`.

- [ ] **Step 4: Commit**

```bash
git add web/src/
git commit -m "feat(web): add dashboard page with runtime status overview"
```

---

### Task 6: History page

**Files:**
- Create: `web/src/pages/HistoryPage.tsx`
- Modify: `web/src/App.tsx` — swap placeholder

- [ ] **Step 1: Create `web/src/pages/HistoryPage.tsx`**

```tsx
import { useEffect, useState } from "react";
import { useGitHub } from "../hooks/useGitHub";
import { NotFoundError } from "../api/github";
import type { GitHubDirectoryEntry } from "../api/types";

interface DigestItem {
  repo: string;
  url: string;
  theme: string;
  summary: string;
  whyItMatters: string;
  evidence: string[];
}

interface ArchiveOverview {
  generatedAt: string;
  candidateCount: number;
  shortlistedCount: number;
  generationMeta: { llmCandidateCount: number; rulesVersion: string };
  digest: { items: DigestItem[] };
}

export default function HistoryPage() {
  const client = useGitHub();
  const [entries, setEntries] = useState<GitHubDirectoryEntry[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [detail, setDetail] = useState<ArchiveOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!client) return;

    setLoading(true);
    client
      .listDirectory("data/history")
      .then((items) => {
        const jsonFiles = items
          .filter((item) => item.name.endsWith(".json"))
          .sort((a, b) => b.name.localeCompare(a.name));
        setEntries(jsonFiles);
      })
      .catch((err) => {
        if (err instanceof NotFoundError) {
          setEntries([]);
        } else {
          setError(err instanceof Error ? err.message : String(err));
        }
      })
      .finally(() => setLoading(false));
  }, [client]);

  function handleSelect(name: string) {
    if (!client) return;

    const date = name.replace(".json", "");

    if (selectedDate === date) {
      setSelectedDate(null);
      setDetail(null);
      return;
    }

    setSelectedDate(date);
    setDetailLoading(true);
    client
      .readFile(`data/history/${name}`)
      .then(({ content }) => setDetail(JSON.parse(content) as ArchiveOverview))
      .catch((err) =>
        setError(err instanceof Error ? err.message : String(err)),
      )
      .finally(() => setDetailLoading(false));
  }

  if (loading) return <p className="text-gray-500">加载中...</p>;
  if (error) return <p className="text-red-600">{error}</p>;

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">历史日报</h2>

      {entries.length === 0 && (
        <p className="text-gray-500">暂无历史日报。</p>
      )}

      <ul className="space-y-2">
        {entries.map((entry) => {
          const date = entry.name.replace(".json", "");
          const isSelected = selectedDate === date;

          return (
            <li key={entry.name}>
              <button
                onClick={() => handleSelect(entry.name)}
                className={`w-full text-left px-4 py-3 rounded border text-sm ${
                  isSelected
                    ? "bg-blue-50 border-blue-300"
                    : "bg-white border-gray-200 hover:bg-gray-50"
                }`}
              >
                {date}
              </button>

              {isSelected && detailLoading && (
                <p className="text-gray-500 text-sm mt-2 px-4">加载中...</p>
              )}

              {isSelected && detail && (
                <div className="mt-2 px-4 space-y-3">
                  <div className="flex gap-4 text-xs text-gray-500">
                    <span>候选 {detail.candidateCount}</span>
                    <span>入围 {detail.shortlistedCount}</span>
                    <span>
                      LLM 候选 {detail.generationMeta.llmCandidateCount}
                    </span>
                    <span>规则 {detail.generationMeta.rulesVersion}</span>
                  </div>

                  {detail.digest.items.map((item) => (
                    <div
                      key={item.repo}
                      className="bg-white border border-gray-200 rounded p-3 space-y-1"
                    >
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm font-medium text-blue-600 hover:underline"
                      >
                        {item.repo}
                      </a>
                      <p className="text-xs text-gray-500">{item.theme}</p>
                      <p className="text-sm">{item.summary}</p>
                      <p className="text-xs text-gray-600">
                        {item.evidence.join("；")}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
```

- [ ] **Step 2: Update `web/src/App.tsx` — import and use HistoryPage**

Add import and replace placeholder:

```tsx
import HistoryPage from "./pages/HistoryPage";
```

```tsx
<Route path="/history" element={<HistoryPage />} />
```

- [ ] **Step 3: Verify History page loads and expands**

Run:
```bash
cd web && npm run dev
```

Expected: History page lists archive dates. Clicking a date expands to show digest items with metadata.

- [ ] **Step 4: Commit**

```bash
git add web/src/
git commit -m "feat(web): add history page with archive list and detail view"
```

---

### Task 7: Config page

**Files:**
- Create: `web/src/pages/ConfigPage.tsx`
- Modify: `web/src/App.tsx` — swap placeholder

- [ ] **Step 1: Create `web/src/pages/ConfigPage.tsx`**

```tsx
import { useEffect, useState, type FormEvent } from "react";
import { useGitHub } from "../hooks/useGitHub";

interface ScheduleConfig {
  timezone: string;
  dailySendTime: string;
}

interface ThemeEntry {
  theme: string;
  keywords: string[];
}

interface DigestRulesConfig {
  version: string;
  themes: ThemeEntry[];
  blacklists: {
    descriptionKeywords: string[];
    readmeKeywords: string[];
    topics: string[];
  };
  selection: Record<string, unknown>;
  thresholds: Record<string, unknown>;
  weights: Record<string, unknown>;
}

export default function ConfigPage() {
  const client = useGitHub();
  const [schedule, setSchedule] = useState<ScheduleConfig | null>(null);
  const [scheduleSha, setScheduleSha] = useState("");
  const [rules, setRules] = useState<DigestRulesConfig | null>(null);
  const [rulesSha, setRulesSha] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!client) return;

    setLoading(true);
    Promise.all([
      client.readFile("config/schedule.json"),
      client.readFile("config/digest-rules.json"),
    ])
      .then(([scheduleRes, rulesRes]) => {
        setSchedule(JSON.parse(scheduleRes.content) as ScheduleConfig);
        setScheduleSha(scheduleRes.sha);
        setRules(JSON.parse(rulesRes.content) as DigestRulesConfig);
        setRulesSha(rulesRes.sha);
      })
      .catch((err) =>
        setMessage(err instanceof Error ? err.message : String(err)),
      )
      .finally(() => setLoading(false));
  }, [client]);

  async function saveSchedule(e: FormEvent) {
    e.preventDefault();
    if (!client || !schedule) return;

    setSaving(true);
    setMessage("");
    try {
      await client.writeFile(
        "config/schedule.json",
        JSON.stringify(schedule, null, 2) + "\n",
        "chore(console): update schedule.json",
        scheduleSha,
      );
      const updated = await client.readFile("config/schedule.json");
      setScheduleSha(updated.sha);
      setMessage("调度配置已保存。");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  async function saveRules(e: FormEvent) {
    e.preventDefault();
    if (!client || !rules) return;

    setSaving(true);
    setMessage("");
    try {
      await client.writeFile(
        "config/digest-rules.json",
        JSON.stringify(rules, null, 2) + "\n",
        "chore(console): update digest-rules.json",
        rulesSha,
      );
      const updated = await client.readFile("config/digest-rules.json");
      setRulesSha(updated.sha);
      setMessage("规则配置已保存。");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="text-gray-500">加载中...</p>;

  return (
    <div className="space-y-8 max-w-2xl">
      <h2 className="text-xl font-semibold">配置</h2>

      {message && (
        <p
          className={`text-sm ${message.includes("已保存") ? "text-green-600" : "text-red-600"}`}
        >
          {message}
        </p>
      )}

      {/* Schedule Section */}
      {schedule && (
        <form onSubmit={saveSchedule} className="space-y-4">
          <h3 className="text-lg font-medium">调度设置</h3>

          <label className="block">
            <span className="text-sm font-medium">发送时间</span>
            <input
              type="time"
              value={schedule.dailySendTime}
              onChange={(e) =>
                setSchedule({ ...schedule, dailySendTime: e.target.value })
              }
              className="mt-1 block w-full rounded border border-gray-300 px-3 py-2 text-sm"
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium">时区</span>
            <input
              type="text"
              value={schedule.timezone}
              onChange={(e) =>
                setSchedule({ ...schedule, timezone: e.target.value })
              }
              className="mt-1 block w-full rounded border border-gray-300 px-3 py-2 text-sm"
            />
          </label>

          <button
            type="submit"
            disabled={saving}
            className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? "保存中..." : "保存调度设置"}
          </button>
        </form>
      )}

      {/* Themes Section */}
      {rules && (
        <form onSubmit={saveRules} className="space-y-4">
          <h3 className="text-lg font-medium">主题配置</h3>

          {rules.themes.map((theme, index) => (
            <div
              key={index}
              className="bg-white border border-gray-200 rounded p-4 space-y-2"
            >
              <div className="flex items-center justify-between">
                <input
                  type="text"
                  value={theme.theme}
                  onChange={(e) => {
                    const updated = [...rules.themes];
                    updated[index] = { ...theme, theme: e.target.value };
                    setRules({ ...rules, themes: updated });
                  }}
                  className="font-medium text-sm border border-gray-300 rounded px-2 py-1"
                />
                <button
                  type="button"
                  onClick={() => {
                    const updated = rules.themes.filter((_, i) => i !== index);
                    setRules({ ...rules, themes: updated });
                  }}
                  className="text-xs text-red-500 hover:text-red-700"
                >
                  删除主题
                </button>
              </div>

              <textarea
                value={theme.keywords.join(", ")}
                onChange={(e) => {
                  const updated = [...rules.themes];
                  updated[index] = {
                    ...theme,
                    keywords: e.target.value
                      .split(",")
                      .map((k) => k.trim())
                      .filter(Boolean),
                  };
                  setRules({ ...rules, themes: updated });
                }}
                rows={2}
                className="w-full text-sm border border-gray-300 rounded px-2 py-1"
                placeholder="关键词，用逗号分隔"
              />
            </div>
          ))}

          <button
            type="button"
            onClick={() =>
              setRules({
                ...rules,
                themes: [...rules.themes, { theme: "New Theme", keywords: [] }],
              })
            }
            className="text-sm text-blue-600 hover:underline"
          >
            + 添加主题
          </button>

          <h3 className="text-lg font-medium mt-6">黑名单</h3>

          <label className="block">
            <span className="text-sm font-medium">Description 黑名单</span>
            <textarea
              value={rules.blacklists.descriptionKeywords.join(", ")}
              onChange={(e) =>
                setRules({
                  ...rules,
                  blacklists: {
                    ...rules.blacklists,
                    descriptionKeywords: e.target.value
                      .split(",")
                      .map((k) => k.trim())
                      .filter(Boolean),
                  },
                })
              }
              rows={2}
              className="mt-1 w-full text-sm border border-gray-300 rounded px-2 py-1"
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium">README 黑名单</span>
            <textarea
              value={rules.blacklists.readmeKeywords.join(", ")}
              onChange={(e) =>
                setRules({
                  ...rules,
                  blacklists: {
                    ...rules.blacklists,
                    readmeKeywords: e.target.value
                      .split(",")
                      .map((k) => k.trim())
                      .filter(Boolean),
                  },
                })
              }
              rows={2}
              className="mt-1 w-full text-sm border border-gray-300 rounded px-2 py-1"
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium">Topics 黑名单</span>
            <textarea
              value={rules.blacklists.topics.join(", ")}
              onChange={(e) =>
                setRules({
                  ...rules,
                  blacklists: {
                    ...rules.blacklists,
                    topics: e.target.value
                      .split(",")
                      .map((k) => k.trim())
                      .filter(Boolean),
                  },
                })
              }
              rows={2}
              className="mt-1 w-full text-sm border border-gray-300 rounded px-2 py-1"
            />
          </label>

          <button
            type="submit"
            disabled={saving}
            className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? "保存中..." : "保存规则配置"}
          </button>
        </form>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Update `web/src/App.tsx` — import and use ConfigPage**

Add import and replace placeholder:

```tsx
import ConfigPage from "./pages/ConfigPage";
```

```tsx
<Route path="/config" element={<ConfigPage />} />
```

- [ ] **Step 3: Verify Config page loads, edits, and saves**

Run:
```bash
cd web && npm run dev
```

Expected: Config page loads both config files, shows editable forms. Saving writes back to the repo (confirm with `git log` on remote).

- [ ] **Step 4: Commit**

```bash
git add web/src/
git commit -m "feat(web): add config page with schedule and digest-rules editing"
```

---

### Task 8: Feedback page

**Files:**
- Create: `web/src/pages/FeedbackPage.tsx`
- Modify: `web/src/App.tsx` — swap placeholder

- [ ] **Step 1: Create `web/src/pages/FeedbackPage.tsx`**

```tsx
import { useEffect, useState } from "react";
import { useGitHub } from "../hooks/useGitHub";
import { NotFoundError } from "../api/github";
import type { GitHubDirectoryEntry } from "../api/types";

type FeedbackAction = "like" | "bookmark" | "not_interested";

interface FeedbackEntry {
  repo: string;
  action: FeedbackAction;
  updatedAt: string;
}

interface FeedbackFile {
  date: string;
  items: FeedbackEntry[];
}

interface DigestItem {
  repo: string;
  url: string;
  theme: string;
  summary: string;
}

export default function FeedbackPage() {
  const client = useGitHub();
  const [dates, setDates] = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [digestItems, setDigestItems] = useState<DigestItem[]>([]);
  const [feedback, setFeedback] = useState<FeedbackEntry[]>([]);
  const [feedbackSha, setFeedbackSha] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!client) return;

    setLoading(true);
    client
      .listDirectory("data/history")
      .then((items: GitHubDirectoryEntry[]) =>
        setDates(
          items
            .filter((item) => item.name.endsWith(".json"))
            .map((item) => item.name.replace(".json", ""))
            .sort((a, b) => b.localeCompare(a)),
        ),
      )
      .catch(() => setDates([]))
      .finally(() => setLoading(false));
  }, [client]);

  async function loadDate(date: string) {
    if (!client) return;

    setSelectedDate(date);

    const archiveRes = await client.readFile(`data/history/${date}.json`);
    const archive = JSON.parse(archiveRes.content) as {
      digest: { items: DigestItem[] };
    };
    setDigestItems(archive.digest.items);

    try {
      const fbRes = await client.readFile(`data/feedback/${date}.json`);
      const fbData = JSON.parse(fbRes.content) as FeedbackFile;
      setFeedback(fbData.items);
      setFeedbackSha(fbRes.sha);
    } catch (err) {
      if (err instanceof NotFoundError) {
        setFeedback([]);
        setFeedbackSha(undefined);
      }
    }
  }

  async function toggleFeedback(repo: string, action: FeedbackAction) {
    if (!client || !selectedDate) return;

    setSaving(true);

    const existing = feedback.find((f) => f.repo === repo);
    let updated: FeedbackEntry[];

    if (existing?.action === action) {
      updated = feedback.filter((f) => f.repo !== repo);
    } else {
      const entry: FeedbackEntry = {
        repo,
        action,
        updatedAt: new Date().toISOString(),
      };
      updated = [...feedback.filter((f) => f.repo !== repo), entry];
    }

    const fileContent: FeedbackFile = { date: selectedDate, items: updated };
    const content = JSON.stringify(fileContent, null, 2) + "\n";

    try {
      await client.writeFile(
        `data/feedback/${selectedDate}.json`,
        content,
        `chore(console): update feedback for ${selectedDate}`,
        feedbackSha,
      );
      const res = await client.readFile(`data/feedback/${selectedDate}.json`);
      setFeedbackSha(res.sha);
      setFeedback(updated);
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  function getAction(repo: string): FeedbackAction | null {
    return feedback.find((f) => f.repo === repo)?.action ?? null;
  }

  if (loading) return <p className="text-gray-500">加载中...</p>;

  return (
    <div className="space-y-4 max-w-2xl">
      <h2 className="text-xl font-semibold">反馈</h2>

      <select
        value={selectedDate ?? ""}
        onChange={(e) => e.target.value && loadDate(e.target.value)}
        className="border border-gray-300 rounded px-3 py-2 text-sm"
      >
        <option value="">选择日期</option>
        {dates.map((d) => (
          <option key={d} value={d}>
            {d}
          </option>
        ))}
      </select>

      {selectedDate && digestItems.length === 0 && (
        <p className="text-gray-500">该日期暂无日报条目。</p>
      )}

      {digestItems.map((item) => {
        const current = getAction(item.repo);

        return (
          <div
            key={item.repo}
            className="bg-white border border-gray-200 rounded p-4 space-y-2"
          >
            <a
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium text-blue-600 hover:underline"
            >
              {item.repo}
            </a>
            <p className="text-xs text-gray-500">{item.theme}</p>
            <p className="text-sm">{item.summary}</p>

            <div className="flex gap-2 pt-1">
              <FeedbackButton
                active={current === "like"}
                disabled={saving}
                onClick={() => toggleFeedback(item.repo, "like")}
                label="👍 赞"
              />
              <FeedbackButton
                active={current === "bookmark"}
                disabled={saving}
                onClick={() => toggleFeedback(item.repo, "bookmark")}
                label="⭐ 收藏"
              />
              <FeedbackButton
                active={current === "not_interested"}
                disabled={saving}
                onClick={() => toggleFeedback(item.repo, "not_interested")}
                label="👎 不感兴趣"
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function FeedbackButton({
  active,
  disabled,
  onClick,
  label,
}: {
  active: boolean;
  disabled: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`text-xs px-3 py-1 rounded border ${
        active
          ? "bg-blue-100 border-blue-300 text-blue-700"
          : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"
      } disabled:opacity-50`}
    >
      {label}
    </button>
  );
}
```

- [ ] **Step 2: Update `web/src/App.tsx` — import and use FeedbackPage**

Add import and replace placeholder:

```tsx
import FeedbackPage from "./pages/FeedbackPage";
```

```tsx
<Route path="/feedback" element={<FeedbackPage />} />
```

- [ ] **Step 3: Verify Feedback page loads, toggles, and persists**

Run:
```bash
cd web && npm run dev
```

Expected: Select a date, see digest items with feedback buttons. Clicking a button saves to `data/feedback/{date}.json` in the repo. Clicking again toggles off. Refreshing preserves state.

- [ ] **Step 4: Commit**

```bash
git add web/src/
git commit -m "feat(web): add feedback page with like/bookmark/not-interested"
```

---

### Task 9: Logs page

**Files:**
- Create: `web/src/pages/LogsPage.tsx`
- Modify: `web/src/App.tsx` — swap placeholder

- [ ] **Step 1: Create `web/src/pages/LogsPage.tsx`**

```tsx
import { useEffect, useState } from "react";
import { useGitHub } from "../hooks/useGitHub";
import type { GitHubWorkflowRun } from "../api/types";

export default function LogsPage() {
  const client = useGitHub();
  const [runs, setRuns] = useState<GitHubWorkflowRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [triggering, setTriggering] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    loadRuns();
  }, [client]);

  function loadRuns() {
    if (!client) return;

    setLoading(true);
    client
      .listWorkflowRuns("daily-digest.yml")
      .then(setRuns)
      .catch((err) =>
        setError(err instanceof Error ? err.message : String(err)),
      )
      .finally(() => setLoading(false));
  }

  async function handleTrigger() {
    if (!client) return;

    setTriggering(true);
    setMessage("");
    try {
      await client.triggerWorkflow("daily-digest.yml");
      setMessage("已触发工作流，请稍后刷新查看结果。");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : String(err));
    } finally {
      setTriggering(false);
    }
  }

  if (loading) return <p className="text-gray-500">加载中...</p>;
  if (error) return <p className="text-red-600">{error}</p>;

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">工作流日志</h2>
        <div className="flex gap-2">
          <button
            onClick={loadRuns}
            className="text-sm text-gray-600 hover:text-gray-900 border border-gray-300 px-3 py-1 rounded"
          >
            刷新
          </button>
          <button
            onClick={handleTrigger}
            disabled={triggering}
            className="bg-blue-600 text-white px-4 py-1 rounded text-sm hover:bg-blue-700 disabled:opacity-50"
          >
            {triggering ? "触发中..." : "手动触发"}
          </button>
        </div>
      </div>

      {message && (
        <p
          className={`text-sm ${message.includes("已触发") ? "text-green-600" : "text-red-600"}`}
        >
          {message}
        </p>
      )}

      {runs.length === 0 && (
        <p className="text-gray-500">暂无工作流运行记录。</p>
      )}

      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-gray-500 border-b border-gray-200">
            <th className="pb-2">状态</th>
            <th className="pb-2">触发</th>
            <th className="pb-2">开始时间</th>
            <th className="pb-2">链接</th>
          </tr>
        </thead>
        <tbody>
          {runs.map((run) => (
            <tr key={run.id} className="border-b border-gray-100">
              <td className="py-2">
                <StatusBadge
                  status={run.status}
                  conclusion={run.conclusion}
                />
              </td>
              <td className="py-2 text-gray-600">{run.event}</td>
              <td className="py-2 text-gray-600">
                {run.run_started_at
                  ? new Date(run.run_started_at).toLocaleString("zh-CN")
                  : "-"}
              </td>
              <td className="py-2">
                <a
                  href={run.html_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  查看
                </a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StatusBadge({
  status,
  conclusion,
}: {
  status: string | null;
  conclusion: string | null;
}) {
  if (status === "completed") {
    const color =
      conclusion === "success"
        ? "bg-green-100 text-green-700"
        : "bg-red-100 text-red-700";
    return (
      <span className={`text-xs px-2 py-0.5 rounded ${color}`}>
        {conclusion}
      </span>
    );
  }

  return (
    <span className="text-xs px-2 py-0.5 rounded bg-yellow-100 text-yellow-700">
      {status ?? "unknown"}
    </span>
  );
}
```

- [ ] **Step 2: Update `web/src/App.tsx` — import and use LogsPage**

Add import and replace placeholder:

```tsx
import LogsPage from "./pages/LogsPage";
```

```tsx
<Route path="/logs" element={<LogsPage />} />
```

- [ ] **Step 3: Verify Logs page loads workflow runs and manual trigger works**

Run:
```bash
cd web && npm run dev
```

Expected: Logs page shows workflow run history in a table. "手动触发" button dispatches a workflow_dispatch event. "刷新" reloads the list.

- [ ] **Step 4: Commit**

```bash
git add web/src/
git commit -m "feat(web): add logs page with workflow runs and manual trigger"
```

---

### Task 10: SPA 404 fallback and GitHub Pages deploy workflow

**Files:**
- Create: `web/public/404.html`
- Create: `.github/workflows/deploy-pages.yml`

- [ ] **Step 1: Create `web/public/404.html`**

This handles GitHub Pages SPA routing — any non-root path returns 404.html, which redirects to `index.html` with the original path preserved.

```html
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <script>
      // GitHub Pages SPA redirect
      // Converts path to query string so index.html can restore it
      var pathSegmentsToKeep = 1; // /GitRadar is the base
      var l = window.location;
      l.replace(
        l.protocol + '//' + l.hostname + (l.port ? ':' + l.port : '') +
        l.pathname.split('/').slice(0, 1 + pathSegmentsToKeep).join('/') + '/?/' +
        l.pathname.slice(1).split('/').slice(pathSegmentsToKeep).join('/').replace(/&/g, '~and~') +
        (l.search ? '&' + l.search.slice(1).replace(/&/g, '~and~') : '') +
        l.hash
      );
    </script>
  </head>
  <body></body>
</html>
```

- [ ] **Step 2: Add redirect restore script to `web/index.html`**

Add before the `<div id="root">` line:

```html
    <script>
      // GitHub Pages SPA redirect restore
      (function(l) {
        if (l.search[1] === '/') {
          var decoded = l.search.slice(1).split('&').map(function(s) {
            return s.replace(/~and~/g, '&');
          }).join('?');
          window.history.replaceState(null, null,
            l.pathname.slice(0, -1) + decoded + l.hash
          );
        }
      }(window.location));
    </script>
```

- [ ] **Step 3: Create `.github/workflows/deploy-pages.yml`**

```yaml
name: Deploy Pages

on:
  push:
    branches: [main]
    paths: [web/**]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: deploy-pages
  cancel-in-progress: true

jobs:
  build-and-deploy:
    name: Build And Deploy
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - name: Check out repository
        uses: actions/checkout@de0fac2e4500dabe0009e67214ff5f5447ce83dd

      - name: Set up Node.js
        uses: actions/setup-node@53b83947a5a98c8d113130e565377fae1a50d02f
        with:
          node-version: 24
          cache: npm
          cache-dependency-path: web/package-lock.json

      - name: Install dependencies
        working-directory: web
        run: npm ci

      - name: Build
        working-directory: web
        run: npm run build

      - name: Upload artifact
        uses: actions/upload-pages-artifact@56afc609e74202658d3ffba0e8f6dda462b719fa
        with:
          path: web/dist

      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@d6db90164ac5ed86f2b6aed7e0febac5b3c0c03e
```

- [ ] **Step 4: Verify build produces correct output**

Run:
```bash
cd web && npm run build && ls dist/
```

Expected: `dist/` contains `index.html`, `404.html`, `assets/` with JS/CSS bundles.

- [ ] **Step 5: Commit**

```bash
git add web/public/404.html web/index.html .github/workflows/deploy-pages.yml
git commit -m "feat(web): add SPA 404 fallback and GitHub Pages deploy workflow"
```

---

### Task 11: Final integration verification

**Files:** None (verification only)

- [ ] **Step 1: Run full type-check for web/**

Run:
```bash
cd web && npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 2: Run full build**

Run:
```bash
cd web && npm run build
```

Expected: Build succeeds with no errors or warnings.

- [ ] **Step 3: Run existing backend type-check (ensure no regressions)**

Run:
```bash
npm run typecheck
```

Expected: No errors. The root `tsconfig.json` only includes `src/` and `tests/`, so `web/` is independent.

- [ ] **Step 4: Run existing backend tests**

Run:
```bash
npm test
```

Expected: All 50 existing tests pass. No regressions.

- [ ] **Step 5: Verify dev server with all pages end-to-end**

Run:
```bash
cd web && npm run dev
```

Manual checklist:
1. `/setup` — enter PAT, owner, repo → validate → redirect to `/`
2. `/` (Dashboard) — shows runtime status cards
3. `/history` — lists dates, expand shows digest items
4. `/config` — loads both configs, edit and save works
5. `/feedback` — select date, toggle feedback buttons, persists
6. `/logs` — shows workflow runs, manual trigger works
7. Sidebar nav — all links highlight correctly
8. Logout — clears auth, redirects to setup

- [ ] **Step 6: Final commit (if any fixes needed)**

```bash
git add -A web/
git commit -m "fix(web): integration fixes from end-to-end verification"
```
