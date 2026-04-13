import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";

import { CURRENT_DAILY_DIGEST_ARCHIVE_SCHEMA_VERSION } from "../src/core/archive";
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
    expect(archiveContent).not.toContain('"editorialMode"');
    expect(result.archive.digest.items.length).toBeGreaterThan(0);
    expect(result.archive.selection.llmCandidateRepos.length).toBeGreaterThan(0);
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

    expect(result.sourceCounts.trending).toBe(0);
    expect(result.archive.generationMeta.warnings).toContain(
      "GitHub Trending 抓取失败，已降级为仅使用 Search 候选。",
    );
    expect(result.archive.digest.items.length).toBeGreaterThan(0);
  });

  it("fails when the model keeps failing", async () => {
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

    await expect(
      generateDailyDigest({
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
      }),
    ).rejects.toThrow("LLM request failed with status 500.");
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
    response.end(JSON.stringify({ items }));
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

async function handleLlmRequest(
  request: IncomingMessage,
  response: ServerResponse,
): Promise<void> {
  if (llmFailuresRemaining > 0) {
    llmFailuresRemaining -= 1;
    response.writeHead(500, { "content-type": "application/json" });
    response.end(JSON.stringify({ error: "temporary llm failure" }));
    return;
  }

  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  const rawBody = Buffer.concat(chunks).toString("utf8");
  const parsedBody = JSON.parse(rawBody) as {
    messages?: Array<{ role?: string; content?: string }>;
  };
  let prompt = "";
  for (let index = (parsedBody.messages?.length ?? 0) - 1; index >= 0; index -= 1) {
    const message = parsedBody.messages?.[index];
    if (message?.role === "user") {
      prompt = message.content ?? "";
      break;
    }
  }
  const payloadLine = prompt.trim().split("\n").at(-1) ?? "[]";
  const candidates = JSON.parse(payloadLine) as Array<{
    repo: string;
    url: string;
    theme?: string;
    selectionHints?: {
      whyNow?: string;
      evidence?: string[];
    };
  }>;

  response.writeHead(200, { "content-type": "application/json" });
  response.end(
    JSON.stringify({
      choices: [
        {
          message: {
            content: JSON.stringify({
              items: candidates.slice(0, 6).map((candidate) => ({
                repo: candidate.repo,
                theme: candidate.theme ?? "General OSS",
                summary: `${candidate.repo} 提供了可直接上手的工程能力，面向真实开发工作流。`,
                whyItMatters: "抽象清晰，适合持续关注。",
                whyNow:
                  candidate.selectionHints?.whyNow ??
                  "多来源同时命中，且近期更新活跃。",
                evidence: (candidate.selectionHints?.evidence ?? []).slice(0, 3),
                novelty: "把能力边界收得很实，便于快速判断是否值得深看。",
                trend: "近期讨论度和活跃信号都在上升。",
              })),
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
