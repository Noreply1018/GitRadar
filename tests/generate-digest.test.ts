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
    expect(result.archive.digest.items.length).toBe(3);
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
    response.writeHead(200, { "content-type": "application/json" });
    response.end(
      JSON.stringify({
        items: [
          repository("owner/alpha-agent", 4200, "一个 AI Agent 框架"),
          repository("owner/rust-observatory", 3200, "Rust 性能观测工具"),
          repository("owner/ui-lab", 2600, "实验性 Web UI 项目"),
          repository("owner/data-scout", 1800, "数据探索工具"),
        ],
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
                  summary: "一个面向自动化任务的 AI Agent 框架。",
                  whyItMatters: "抽象清晰，适合持续关注。",
                  novelty: "把 agent runtime 做得很轻。",
                  trend: "今天热度增长明显。",
                },
                {
                  repo: "owner/rust-observatory",
                  summary: "Rust 服务性能观测工具。",
                  whyItMatters: "定位性能问题很直接。",
                  novelty: "把 profiling 和 trace 流程串起来了。",
                  trend: "最近讨论度持续上升。",
                },
                {
                  repo: "owner/ui-lab",
                  summary: "实验性 Web UI 项目。",
                  whyItMatters: "适合看前端表达方式。",
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
  return {
    full_name: repo,
    html_url: `https://github.com/${repo}`,
    description,
    language: "TypeScript",
    stargazers_count: stars,
    forks_count: 100,
    topics: ["ai", "tooling"],
    created_at: "2026-03-01T00:00:00Z",
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
