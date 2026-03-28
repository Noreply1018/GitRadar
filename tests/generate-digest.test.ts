import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import type { DailyDigestArchive } from "../src/core/archive";

import {
  generateDailyDigest,
  resendArchivedDigest,
} from "../src/digest/generate";

describe("generateDailyDigest", () => {
  let tempDir = "";
  let githubServer: ReturnType<typeof createServer>;
  let llmServer: ReturnType<typeof createServer>;
  let wecomServer: ReturnType<typeof createServer>;
  let wecomRequestCount = 0;

  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), "gitradar-"));
    wecomRequestCount = 0;

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
    expect(archiveContent).toContain('"shortlistedCount"');
    expect(archiveContent).toContain('"generationMeta"');
    expect(result.archive.digest.items.length).toBe(3);
    expect(result.archive.selection?.llmCandidateRepos.length).toBeGreaterThan(
      0,
    );
    expect(result.archive.digest.items[0].evidence.length).toBeGreaterThan(0);
    expect(wecomRequestCount).toBe(0);
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

  it("resends an existing archive by date", async () => {
    const wecomAddress = wecomServer.address();

    if (!wecomAddress || typeof wecomAddress === "string") {
      throw new Error("Failed to bind mock servers.");
    }

    const archive: DailyDigestArchive = {
      generatedAt: "2026-03-26T00:00:00Z",
      candidateCount: 10,
      shortlistedCount: 5,
      digest: {
        date: "2026-03-20",
        title: "GitRadar · 2026-03-20",
        items: [
          {
            repo: "owner/replay-target",
            url: "https://github.com/owner/replay-target",
            summary: "用于验证重发功能的项目。",
            whyItMatters: "能确认历史归档是否可直接重发。",
            theme: "General OSS",
            whyNow: "历史归档重发时需要保留旧结构兼容能力。",
            evidence: ["历史归档兼容读取"],
            novelty: "不需要重新抓取即可补发。",
            trend: "适合处理推送故障后的补发。",
          },
        ],
      },
    };

    await writeArchive(tempDir, archive);

    const result = await resendArchivedDigest({
      rootDir: tempDir,
      date: "2026-03-20",
      wecom: {
        webhookUrl: `http://127.0.0.1:${wecomAddress.port}/webhook`,
      },
    });

    expect(result.archive.digest.date).toBe("2026-03-20");
    expect(result.archivePath).toContain("2026-03-20.json");
    expect(wecomRequestCount).toBe(1);
  });

  it("normalizes legacy archives when resending", async () => {
    const wecomAddress = wecomServer.address();

    if (!wecomAddress || typeof wecomAddress === "string") {
      throw new Error("Failed to bind mock servers.");
    }

    await writeArchive(tempDir, {
      generatedAt: "2026-03-26T00:00:00Z",
      candidateCount: 10,
      shortlistedCount: 5,
      digest: {
        date: "2026-03-21",
        title: "GitRadar · 2026-03-21",
        items: [
          {
            repo: "owner/legacy-target",
            url: "https://github.com/owner/legacy-target",
            summary: "旧版归档项目。",
            whyItMatters: "用于验证向后兼容。",
            novelty: "旧数据没有 theme 和 evidence 字段。",
            trend: "重发时仍然可用。",
          },
        ],
      },
    } as DailyDigestArchive);

    const result = await resendArchivedDigest({
      rootDir: tempDir,
      date: "2026-03-21",
      wecom: {
        webhookUrl: `http://127.0.0.1:${wecomAddress.port}/webhook`,
      },
    });

    expect(result.archive.selection?.selected[0].theme).toBe("General OSS");
    expect(result.archive.generationMeta?.rulesVersion).toBe("legacy");
  });

  it("fails when the requested resend archive does not exist", async () => {
    const wecomAddress = wecomServer.address();

    if (!wecomAddress || typeof wecomAddress === "string") {
      throw new Error("Failed to bind mock servers.");
    }

    await expect(
      resendArchivedDigest({
        rootDir: tempDir,
        date: "2026-03-19",
        wecom: {
          webhookUrl: `http://127.0.0.1:${wecomAddress.port}/webhook`,
        },
      }),
    ).rejects.toThrow("Daily digest archive not found for 2026-03-19");
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
    response.writeHead(200, { "content-type": "text/html" });
    response.end(`
      <article><h2><a href="/owner/alpha-agent">alpha-agent</a></h2></article>
      <article><h2><a href="/owner/rust-observatory">rust-observatory</a></h2></article>
      <article><h2><a href="/owner/ui-lab">ui-lab</a></h2></article>
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
        ]
      : [
          repository("owner/alpha-agent", 4200, "一个 AI Agent 框架"),
          repository("owner/rust-observatory", 3200, "Rust 性能观测工具"),
          repository("owner/ui-lab", 2600, "实验性 Web UI 项目"),
          repository("owner/data-scout", 1800, "数据搜索工具"),
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
                  evidence: ["GitHub Trending 命中", "最近 7 天更新活跃"],
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
                  summary: "实验性 Web UI 项目。",
                  whyItMatters: "适合看前端表达方式。",
                  whyNow: "新项目仍在快速迭代，正处于出圈窗口。",
                  evidence: ["GitHub Trending 命中", "最近 30 天新建仓库"],
                  novelty: "动态视觉风格比较完整。",
                  trend: "本周在设计开发圈很热。",
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
