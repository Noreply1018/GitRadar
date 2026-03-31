import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import {
  CURRENT_DAILY_DIGEST_ARCHIVE_SCHEMA_VERSION,
  type DailyDigestArchive,
} from "../src/core/archive";

import { generateDailyDigest } from "../src/digest/generate";

let trendingFailuresRemaining = 0;
let llmFailuresRemaining = 0;

describe("generateDailyDigest", () => {
  let tempDir = "";
  let githubServer: ReturnType<typeof createServer>;
  let llmServer: ReturnType<typeof createServer>;
  let wecomServer: ReturnType<typeof createServer>;
  let wecomRequestCount = 0;

  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), "gitradar-"));
    wecomRequestCount = 0;
    trendingFailuresRemaining = 0;
    llmFailuresRemaining = 0;

    githubServer = createServer(handleGitHubRequest);
    llmServer = createServer(handleLlmRequest);
    wecomServer = createServer(
      (_: IncomingMessage, response: ServerResponse) => {
        wecomRequestCount += 1;
        response.writeHead(200, { "content-type": "application/json" });
        response.end(JSON.stringify({ errcode: 0, errmsg: "ok" }));
      },
    );

    await Promise.all([
      new Promise<void>((resolve) => githubServer.listen(0, resolve)),
      new Promise<void>((resolve) => llmServer.listen(0, resolve)),
      new Promise<void>((resolve) => wecomServer.listen(0, resolve)),
    ]);
  });

  afterEach(async () => {
    await Promise.all([
      new Promise<void>((resolve) => githubServer.close(() => resolve())),
      new Promise<void>((resolve) => llmServer.close(() => resolve())),
      new Promise<void>((resolve) => wecomServer.close(() => resolve())),
    ]);
    await rm(tempDir, { recursive: true, force: true });
  });

  it("generates a digest archive without sending", async () => {
    const githubAddress = githubServer.address();
    const llmAddress = llmServer.address();

    if (
      !githubAddress ||
      typeof githubAddress === "string" ||
      !llmAddress ||
      typeof llmAddress === "string"
    ) {
      throw new Error("Failed to bind mock servers.");
    }

    const result = await generateDailyDigest({
      rootDir: tempDir,
      github: {
        token: "token",
        apiBaseUrl: `http://127.0.0.1:${githubAddress.port}`,
        trendingUrl: `http://127.0.0.1:${githubAddress.port}/trending?since=daily`,
      },
      llm: {
        apiKey: "key",
        baseUrl: `http://127.0.0.1:${llmAddress.port}`,
        model: "fake-model",
      },
    });

    const archiveContent = await readFile(result.archivePath, "utf8");
    expect(archiveContent).toContain(
      `"schemaVersion": ${CURRENT_DAILY_DIGEST_ARCHIVE_SCHEMA_VERSION}`,
    );
    expect(archiveContent).toContain('"shortlistedCount"');
    expect(archiveContent).toContain('"generationMeta"');
    expect(result.archive.digest.items.length).toBe(6);
    expect(result.archive.selection?.llmCandidateRepos.length).toBeGreaterThan(
      0,
    );
    expect(result.archive.digest.items[0].evidence.length).toBeGreaterThan(0);
    expect(wecomRequestCount).toBe(0);
  });

  it("falls back to search-only candidates when trending keeps failing", async () => {
    const githubAddress = githubServer.address();
    const llmAddress = llmServer.address();

    if (
      !githubAddress ||
      typeof githubAddress === "string" ||
      !llmAddress ||
      typeof llmAddress === "string"
    ) {
      throw new Error("Failed to bind mock servers.");
    }

    trendingFailuresRemaining = 3;

    const result = await generateDailyDigest({
      rootDir: tempDir,
      github: {
        token: "token",
        apiBaseUrl: `http://127.0.0.1:${githubAddress.port}`,
        trendingUrl: `http://127.0.0.1:${githubAddress.port}/trending?since=daily`,
      },
      llm: {
        apiKey: "key",
        baseUrl: `http://127.0.0.1:${llmAddress.port}`,
        model: "fake-model",
      },
    });

    const failureFiles = await listFailureReports(tempDir);
    const failureReport = await readFailureReport(tempDir, failureFiles[0]);

    expect(result.sourceCounts.trending).toBe(0);
    expect(result.archive.generationMeta.warnings).toContain(
      "GitHub Trending 抓取失败，已降级为仅使用 Search 候选。",
    );
    expect(result.archive.digest.items.length).toBeGreaterThan(0);
    expect(failureReport.stage).toBe("source_trending");
    expect(failureReport.fallbackUsed).toBe(true);
  });

  it("falls back to template digest when the model keeps failing", async () => {
    const githubAddress = githubServer.address();
    const llmAddress = llmServer.address();

    if (
      !githubAddress ||
      typeof githubAddress === "string" ||
      !llmAddress ||
      typeof llmAddress === "string"
    ) {
      throw new Error("Failed to bind mock servers.");
    }

    llmFailuresRemaining = 3;

    const result = await generateDailyDigest({
      rootDir: tempDir,
      github: {
        token: "token",
        apiBaseUrl: `http://127.0.0.1:${githubAddress.port}`,
        trendingUrl: `http://127.0.0.1:${githubAddress.port}/trending?since=daily`,
      },
      llm: {
        apiKey: "key",
        baseUrl: `http://127.0.0.1:${llmAddress.port}`,
        model: "fake-model",
      },
    });

    const failureFiles = await listFailureReports(tempDir);
    const failureReport = await readFailureReport(tempDir, failureFiles[0]);

    expect(result.archive.generationMeta.editorialMode).toBe(
      "template_fallback",
    );
    expect(result.archive.digest.title).toContain("模板降级");
    expect(result.archive.digest.items.length).toBe(7);
    expect(failureReport.stage).toBe("editorial_model");
    expect(failureReport.fallbackUsed).toBe(true);
  });

  it("sends after generating when send=true", async () => {
    const githubAddress = githubServer.address();
    const llmAddress = llmServer.address();
    const wecomAddress = wecomServer.address();

    if (
      !githubAddress ||
      typeof githubAddress === "string" ||
      !llmAddress ||
      typeof llmAddress === "string" ||
      !wecomAddress ||
      typeof wecomAddress === "string"
    ) {
      throw new Error("Failed to bind mock servers.");
    }

    await generateDailyDigest({
      rootDir: tempDir,
      github: {
        token: "token",
        apiBaseUrl: `http://127.0.0.1:${githubAddress.port}`,
        trendingUrl: `http://127.0.0.1:${githubAddress.port}/trending?since=daily`,
      },
      llm: {
        apiKey: "key",
        baseUrl: `http://127.0.0.1:${llmAddress.port}`,
        model: "fake-model",
      },
      wecom: {
        webhookUrl: `http://127.0.0.1:${wecomAddress.port}/webhook`,
      },
      send: true,
    });

    expect(wecomRequestCount).toBe(1);
  });
});

function handleGitHubRequest(
  request: IncomingMessage,
  response: ServerResponse,
): void {
  if (!request.url) {
    response.writeHead(404);
    response.end();
    return;
  }

  if (request.url.startsWith("/trending")) {
    if (trendingFailuresRemaining > 0) {
      trendingFailuresRemaining -= 1;
      response.writeHead(503, { "content-type": "text/plain" });
      response.end("temporary trending failure");
      return;
    }

    response.writeHead(200, { "content-type": "text/html" });
    response.end(`
      <article><h2><a href="/owner/alpha-agent">alpha-agent</a></h2></article>
      <article><h2><a href="/owner/rust-observatory">rust-observatory</a></h2></article>
      <article><h2><a href="/owner/ui-lab">ui-lab</a></h2></article>
      <article><h2><a href="/owner/data-scout">data-scout</a></h2></article>
      <article><h2><a href="/owner/policy-guard">policy-guard</a></h2></article>
      <article><h2><a href="/owner/cli-bridge">cli-bridge</a></h2></article>
    `);
    return;
  }

  if (request.url.startsWith("/search/repositories")) {
    const requestUrl = new URL(request.url, "http://127.0.0.1");
    const query = requestUrl.searchParams.get("q") ?? "";
    const items = query.includes("created:>=")
      ? [
          repository("owner/alpha-agent", 4200, "一个 AI Agent 框架"),
          repository("owner/ui-lab", 2600, "实验性 Web UI 项目"),
          repository("owner/data-scout", 1800, "数据搜索工具"),
          repository("owner/policy-guard", 1600, "安全策略校验工具"),
          repository("owner/cli-bridge", 1500, "开发者 CLI 自动化桥接工具"),
          repository("owner/runtime-mesh", 1400, "分布式运行时编排工具"),
        ]
      : [
          repository("owner/alpha-agent", 4200, "一个 AI Agent 框架"),
          repository("owner/rust-observatory", 3200, "Rust 性能观测工具"),
          repository("owner/ui-lab", 2600, "实验性 Web UI 项目"),
          repository("owner/data-scout", 1800, "数据搜索工具"),
          repository("owner/policy-guard", 1600, "安全策略校验工具"),
          repository("owner/cli-bridge", 1500, "开发者 CLI 自动化桥接工具"),
          repository("owner/runtime-mesh", 1400, "分布式运行时编排工具"),
        ];

    response.writeHead(200, { "content-type": "application/json" });
    response.end(
      JSON.stringify({
        items,
      }),
    );
    return;
  }

  if (request.url.startsWith("/repos/")) {
    const repoPath = request.url.replace(/^\/repos\//, "");

    if (repoPath.endsWith("/readme")) {
      response.writeHead(200, { "content-type": "application/json" });
      response.end(
        JSON.stringify({
          encoding: "base64",
          content: Buffer.from(`# ${repoPath}\nREADME content`).toString(
            "base64",
          ),
        }),
      );
      return;
    }

    response.writeHead(200, { "content-type": "application/json" });
    response.end(
      JSON.stringify(repository(repoPath, 3000, `${repoPath} description`)),
    );
    return;
  }

  response.writeHead(404);
  response.end();
}

function handleLlmRequest(_: IncomingMessage, response: ServerResponse): void {
  if (llmFailuresRemaining > 0) {
    llmFailuresRemaining -= 1;
    response.writeHead(500, { "content-type": "application/json" });
    response.end(JSON.stringify({ error: "temporary llm failure" }));
    return;
  }

  response.writeHead(200, { "content-type": "application/json" });
  response.end(
    JSON.stringify({
      choices: [
        {
          message: {
            content: JSON.stringify({
              items: [
                {
                  repo: "owner/alpha-agent",
                  theme: "AI Agents",
                  summary: "一个面向自动化任务的 AI Agent 框架。",
                  whyItMatters: "抽象清晰，适合持续关注。",
                  whyNow: "多来源同时命中，且近期更新活跃。",
                  evidence: [
                    "GitHub Trending 命中",
                    "最近 7 天更新活跃",
                    "最近 30 天新建仓库",
                  ],
                  novelty: "把 agent runtime 做得很轻。",
                  trend: "今天热度增长明显。",
                },
                {
                  repo: "owner/rust-observatory",
                  theme: "Observability & Security",
                  summary: "Rust 服务性能观测工具。",
                  whyItMatters: "定位性能问题很直接。",
                  whyNow: "成熟项目近期恢复高频更新，值得重新关注。",
                  evidence: ["最近 7 天更新活跃", "成熟项目近期再次升温"],
                  novelty: "把 profiling 和 trace 流程串起来了。",
                  trend: "最近讨论度持续上升。",
                },
                {
                  repo: "owner/ui-lab",
                  theme: "Frontend & Design",
                  summary: "用于实验交互动效和动态视觉表达的 Web UI 项目。",
                  whyItMatters: "适合看前端表达方式。",
                  whyNow: "新项目仍在快速迭代，正处于出圈窗口。",
                  evidence: [
                    "GitHub Trending 命中",
                    "最近 7 天更新活跃",
                    "最近 30 天新建仓库",
                  ],
                  novelty: "动态视觉风格比较完整。",
                  trend: "本周在设计开发圈很热。",
                },
                {
                  repo: "owner/data-scout",
                  theme: "Data & Search",
                  summary: "面向开发者知识库和检索场景的数据搜索工具。",
                  whyItMatters: "适合跟踪 agent 时代的数据接入层。",
                  whyNow: "多来源同时命中，且近期更新活跃。",
                  evidence: [
                    "GitHub Trending 命中",
                    "最近 7 天更新活跃",
                    "最近 30 天新建仓库",
                  ],
                  novelty: "把搜索接口和开发工作流结合得更直接。",
                  trend: "最近在工具链方向讨论度上升。",
                },
                {
                  repo: "owner/policy-guard",
                  theme: "Observability & Security",
                  summary: "用于运行时策略校验和风险审计的安全工具。",
                  whyItMatters: "能补上 agent 进入生产环境后的风控缺口。",
                  whyNow: "新项目仍在快速迭代，正处于出圈窗口。",
                  evidence: [
                    "GitHub Trending 命中",
                    "最近 7 天更新活跃",
                    "最近 30 天新建仓库",
                  ],
                  novelty: "把策略检查和工程化接入放在同一条链路里。",
                  trend: "安全运行时相关项目最近持续升温。",
                },
                {
                  repo: "owner/cli-bridge",
                  theme: "Developer Tools",
                  summary: "把本地工具和桌面应用统一暴露为 CLI 的桥接层。",
                  whyItMatters: "很适合 agent 调用已有开发工具。",
                  whyNow: "新项目仍在快速迭代，正处于出圈窗口。",
                  evidence: [
                    "GitHub Trending 命中",
                    "最近 7 天更新活跃",
                    "最近 30 天新建仓库",
                  ],
                  novelty: "以低接入成本把现有软件改造成可编排命令接口。",
                  trend: "Anything-to-CLI 方向最近明显升温。",
                },
              ],
            }),
          },
        },
      ],
    }),
  );
}

function repository(repo: string, stars: number, description: string) {
  const topicMap: Record<string, string[]> = {
    "owner/alpha-agent": ["ai", "agent"],
    "owner/rust-observatory": ["observability", "profiling"],
    "owner/ui-lab": ["frontend", "design"],
    "owner/data-scout": ["data", "search"],
    "owner/policy-guard": ["security", "policy"],
    "owner/cli-bridge": ["cli", "developer"],
    "owner/runtime-mesh": ["runtime", "orchestrator"],
  };
  const createdAt =
    repo === "owner/rust-observatory"
      ? "2023-01-01T00:00:00Z"
      : "2026-03-01T00:00:00Z";

  return {
    full_name: repo,
    html_url: `https://github.com/${repo}`,
    description,
    language: "TypeScript",
    stargazers_count: stars,
    forks_count: 100,
    topics: topicMap[repo] ?? ["ai", "tooling"],
    created_at: createdAt,
    updated_at: "2026-03-25T00:00:00Z",
    pushed_at: "2026-03-25T00:00:00Z",
    archived: false,
    disabled: false,
    fork: false,
  };
}

async function writeArchive(
  rootDir: string,
  archive: DailyDigestArchive,
): Promise<void> {
  const historyDir = path.join(rootDir, "data", "history");
  await mkdir(historyDir, { recursive: true });
  await writeFile(
    path.join(historyDir, `${archive.digest.date}.json`),
    `${JSON.stringify(archive, null, 2)}\n`,
    "utf8",
  );
}

async function listFailureReports(rootDir: string): Promise<string[]> {
  const failuresDir = path.join(rootDir, "data", "runtime", "failures");
  const files = await readdir(failuresDir);
  return files.sort();
}

async function readFailureReport(
  rootDir: string,
  fileName: string,
): Promise<Record<string, unknown>> {
  const failurePath = path.join(
    rootDir,
    "data",
    "runtime",
    "failures",
    fileName,
  );
  const content = await readFile(failurePath, "utf8");
  return JSON.parse(content) as Record<string, unknown>;
}
