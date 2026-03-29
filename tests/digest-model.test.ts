import { createServer } from "node:http";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  generateDigestWithModel,
  generateDigestWithResilience,
} from "../src/digest/model";
import type { GitHubCandidateRepo } from "../src/github/types";

describe("generateDigestWithModel", () => {
  let llmServer: ReturnType<typeof createServer>;
  let responseBody = "";

  beforeEach(async () => {
    responseBody = JSON.stringify({
      choices: [
        {
          message: {
            content: JSON.stringify({
              items: [],
            }),
          },
        },
      ],
    });

    llmServer = createServer((_, response) => {
      response.writeHead(200, { "content-type": "application/json" });
      response.end(responseBody);
    });

    await new Promise<void>((resolve) => llmServer.listen(0, resolve));
  });

  afterEach(async () => {
    await new Promise<void>((resolve) => llmServer.close(() => resolve()));
  });

  it("rejects invented evidence entries from the model", async () => {
    responseBody = JSON.stringify({
      choices: [
        {
          message: {
            content: JSON.stringify({
              items: [
                {
                  repo: "owner/alpha-agent",
                  theme: "AI Agents",
                  summary: "一个面向自动化任务的 AI Agent 框架。",
                  whyItMatters: "适合持续关注。",
                  whyNow: "多来源同时命中，且近期更新活跃。",
                  evidence: ["模型自造证据"],
                  novelty: "结构清晰。",
                  trend: "近期热度上升。",
                },
              ],
            }),
          },
        },
      ],
    });

    await expect(
      generateDigestWithModel(
        [createCandidate()],
        "2026-03-28",
        getLlmConfig(llmServer),
      ),
    ).rejects.toThrow("LLM response did not include any valid digest items.");
  });

  it("requires a mature momentum project when the candidate pool has one", async () => {
    responseBody = JSON.stringify({
      choices: [
        {
          message: {
            content: JSON.stringify({
              items: [
                {
                  repo: "owner/alpha-agent",
                  theme: "AI Agents",
                  summary: "一个面向自动化任务的 AI Agent 框架。",
                  whyItMatters: "适合持续关注。",
                  whyNow: "多来源同时命中，且近期更新活跃。",
                  evidence: ["GitHub Trending 命中", "最近 7 天更新活跃"],
                  novelty: "结构清晰。",
                  trend: "近期热度上升。",
                },
                {
                  repo: "owner/data-scout",
                  theme: "Data & Search",
                  summary: "数据搜索工具。",
                  whyItMatters: "适合持续关注。",
                  whyNow: "新项目仍在快速迭代，正处于出圈窗口。",
                  evidence: ["最近 30 天新建仓库", "近 7 天仍在推进"],
                  novelty: "搜索体验直接。",
                  trend: "近期热度上升。",
                },
                {
                  repo: "owner/ui-lab",
                  theme: "Frontend & Design",
                  summary: "实验性 Web UI 项目。",
                  whyItMatters: "适合持续关注。",
                  whyNow: "新项目仍在快速迭代，正处于出圈窗口。",
                  evidence: ["GitHub Trending 命中", "最近 30 天新建仓库"],
                  novelty: "视觉风格完整。",
                  trend: "近期热度上升。",
                },
                {
                  repo: "owner/cli-bridge",
                  theme: "Developer Tools",
                  summary: "把本地工具统一包装为 CLI 的桥接层。",
                  whyItMatters: "适合持续关注。",
                  whyNow: "新项目仍在快速迭代，正处于出圈窗口。",
                  evidence: ["最近 30 天新建仓库", "近 7 天仍在推进"],
                  novelty: "工具接入成本很低。",
                  trend: "近期热度上升。",
                },
                {
                  repo: "owner/policy-guard",
                  theme: "Observability & Security",
                  summary: "用于运行时策略校验和风险审计的安全工具。",
                  whyItMatters: "适合持续关注。",
                  whyNow: "新项目仍在快速迭代，正处于出圈窗口。",
                  evidence: ["最近 30 天新建仓库", "近 7 天仍在推进"],
                  novelty: "把策略检查和工程化接入放在同一条链路里。",
                  trend: "近期热度上升。",
                },
                {
                  repo: "owner/runtime-mesh",
                  theme: "Infra & Runtime",
                  summary: "分布式运行时编排和任务调度工具。",
                  whyItMatters: "适合持续关注。",
                  whyNow: "新项目仍在快速迭代，正处于出圈窗口。",
                  evidence: ["最近 30 天新建仓库", "近 7 天仍在推进"],
                  novelty: "把运行时编排和工程接入放在同一层抽象里。",
                  trend: "近期热度上升。",
                },
              ],
            }),
          },
        },
      ],
    });

    await expect(
      generateDigestWithModel(
        [
          createCandidate(),
          createCandidate({
            repo: "owner/data-scout",
            theme: "Data & Search",
            selectionHints: {
              whyNow: "新项目仍在快速迭代，正处于出圈窗口。",
              evidence: ["最近 30 天新建仓库", "近 7 天仍在推进"],
              matureMomentum: false,
              sourceSummary: "最近创建",
              selectionReason: "新鲜度和近期动量更强。",
            },
          }),
          createCandidate({
            repo: "owner/ui-lab",
            theme: "Frontend & Design",
            selectionHints: {
              whyNow: "新项目仍在快速迭代，正处于出圈窗口。",
              evidence: ["GitHub Trending 命中", "最近 30 天新建仓库"],
              matureMomentum: false,
              sourceSummary: "Trending + 最近创建",
              selectionReason: "主题代表性和近期活跃度更均衡。",
            },
          }),
          createCandidate({
            repo: "owner/mature-observability",
            theme: "Observability & Security",
            selectionHints: {
              whyNow: "成熟项目近期恢复高频更新，值得重新关注。",
              evidence: ["最近 7 天更新活跃", "成熟项目近期再次升温"],
              matureMomentum: true,
              sourceSummary: "最近更新",
              selectionReason: "保留一条成熟但重新升温的项目位。",
            },
          }),
          createCandidate({
            repo: "owner/cli-bridge",
            theme: "Developer Tools",
            selectionHints: {
              whyNow: "新项目仍在快速迭代，正处于出圈窗口。",
              evidence: ["最近 30 天新建仓库", "近 7 天仍在推进"],
              matureMomentum: false,
              sourceSummary: "最近创建",
              selectionReason: "新鲜度和近期动量更强。",
            },
          }),
          createCandidate({
            repo: "owner/policy-guard",
            theme: "Observability & Security",
            selectionHints: {
              whyNow: "新项目仍在快速迭代，正处于出圈窗口。",
              evidence: ["最近 30 天新建仓库", "近 7 天仍在推进"],
              matureMomentum: false,
              sourceSummary: "最近创建",
              selectionReason: "新鲜度和近期动量更强。",
            },
          }),
          createCandidate({
            repo: "owner/runtime-mesh",
            theme: "Infra & Runtime",
            selectionHints: {
              whyNow: "新项目仍在快速迭代，正处于出圈窗口。",
              evidence: ["最近 30 天新建仓库", "近 7 天仍在推进"],
              matureMomentum: false,
              sourceSummary: "最近创建",
              selectionReason: "新鲜度和近期动量更强。",
            },
          }),
        ],
        "2026-03-28",
        getLlmConfig(llmServer),
      ),
    ).rejects.toThrow(
      "LLM response did not keep a mature momentum project from the candidate pool.",
    );
  });

  it("sanitizes README-heavy fallback copy when the model keeps failing", async () => {
    responseBody = JSON.stringify({ error: "temporary llm failure" });
    llmServer.removeAllListeners("request");
    llmServer.on("request", (_, response) => {
      response.writeHead(500, { "content-type": "application/json" });
      response.end(responseBody);
    });

    const result = await generateDigestWithResilience(
      [
        createCandidate({
          description:
            "Open Source AI Platform - AI Chat with advanced features that works with every LLM",
          readmeExcerpt: [
            '<a name="readme-top"></a>',
            '<h2 align="center"><a href="https://www.onyx.app/?utm_source=onyx">',
            '<img src="docs/assets/logo.png" width="120" /></a></h2>',
            "",
            "Open Source AI Platform built for workplace search and internal knowledge assistants.",
          ].join("\n"),
        }),
      ],
      "2026-03-29",
      getLlmConfig(llmServer),
    );

    expect(result.mode).toBe("template_fallback");
    expect(result.digest.items[0]?.novelty).toBe(
      "Open Source AI Platform built for workplace search and internal knowledge assistants.",
    );
  });
});

function createCandidate(
  overrides: Partial<GitHubCandidateRepo> = {},
): GitHubCandidateRepo {
  return {
    repo: "owner/alpha-agent",
    url: "https://github.com/owner/alpha-agent",
    description: "AI agent orchestration runtime for autonomous workflows.",
    language: "TypeScript",
    stars: 4200,
    forks: 300,
    topics: ["ai", "agent"],
    createdAt: "2026-03-01T00:00:00Z",
    updatedAt: "2026-03-25T00:00:00Z",
    pushedAt: "2026-03-25T00:00:00Z",
    archived: false,
    disabled: false,
    fork: false,
    sources: ["trending", "search_recently_updated"],
    theme: "AI Agents",
    scoreBreakdown: {
      momentum: 40,
      novelty: 16,
      maturity: 18,
      coverage: 12,
      penalties: 0,
      total: 86,
    },
    selectionHints: {
      whyNow: "多来源同时命中，且近期更新活跃。",
      evidence: ["GitHub Trending 命中", "最近 7 天更新活跃"],
      matureMomentum: false,
      sourceSummary: "Trending + 最近更新",
      selectionReason: "多来源重合且综合评分靠前。",
    },
    ruleScore: 86,
    ...overrides,
  };
}

function getLlmConfig(server: ReturnType<typeof createServer>) {
  const address = server.address();

  if (!address || typeof address === "string") {
    throw new Error("Failed to bind mock server.");
  }

  return {
    apiKey: "key",
    baseUrl: `http://127.0.0.1:${address.port}`,
    model: "fake-model",
  };
}
