import { createServer } from "node:http";

import { describe, expect, it } from "vitest";

import { getWecomRobotConfigFromEnv } from "../src/config/env";
import { maskWebhookUrl } from "../src/config/mask";
import type { DailyDigest } from "../src/core/digest";
import {
  renderWecomMarkdown,
  renderWecomMarkdownPages,
  renderWecomMarkdownPayload,
  renderWecomMarkdownPayloads,
  renderWecomWorkflowFailureMarkdown,
  renderWecomWorkflowFailurePayload,
  WecomRobotNotifier,
} from "../src/notifiers/wecom-robot";

describe("maskWebhookUrl", () => {
  it("keeps only the safe endpoint shape for a webhook URL", () => {
    expect(
      maskWebhookUrl(
        "https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=1234567890",
      ),
    ).toBe("https://qyapi.weixin.qq.com/cgi-bin/webhook/send?***");
  });

  it("falls back to a generic marker for an invalid URL", () => {
    expect(maskWebhookUrl("not-a-url")).toBe("[masked webhook]");
  });
});

describe("getWecomRobotConfigFromEnv", () => {
  it("throws when the webhook is missing", () => {
    expect(() => getWecomRobotConfigFromEnv({})).toThrow(
      "Missing GITRADAR_WECOM_WEBHOOK_URL.",
    );
  });
});

describe("renderWecomMarkdown", () => {
  const baseDigest: DailyDigest = {
    date: "2026-03-25",
    title: "GitRadar Digest",
    items: [
      {
        repo: "owner/project-one",
        url: "https://github.com/owner/project-one",
        theme: "AI Agents",
        summary: "一个测试项目。",
        whyItMatters: "值得关注。",
        whyNow: "多来源同时命中，且近期更新活跃。",
        evidence: ["GitHub Trending 命中", "最近 7 天更新活跃"],
        novelty: "有新意。",
        trend: "增长明显。",
      },
    ],
  };

  it("renders a valid markdown payload", () => {
    const payload = renderWecomMarkdownPayload(baseDigest);

    expect(payload.msgtype).toBe("markdown");
    expect(payload.markdown.content).toContain("# GitRadar Digest");
    expect(payload.markdown.content).toContain("## 1. [owner/project-one]");
    expect(payload.markdown.content).toContain("主题：AI Agents");
    expect(payload.markdown.content).toContain(
      "证据：GitHub Trending 命中；最近 7 天更新活跃",
    );
  });

  it("rejects a digest without items", () => {
    expect(() =>
      renderWecomMarkdown({
        ...baseDigest,
        items: [],
      }),
    ).toThrow("Cannot render a digest without items.");
  });

  it("splits oversized digests into multiple markdown pages", () => {
    const oversizedDigest: DailyDigest = {
      ...baseDigest,
      items: Array.from({ length: 6 }, (_, index) => ({
        repo: `owner/project-${index}`,
        url: `https://github.com/owner/project-${index}`,
        theme: "AI Agents",
        summary: "很长的内容".repeat(280),
        whyItMatters: "很长的内容".repeat(280),
        whyNow: "很长的内容".repeat(280),
        evidence: ["很长的内容".repeat(60), "很长的内容".repeat(60)],
        novelty: "很长的内容".repeat(280),
        trend: "很长的内容".repeat(280),
      })),
    };

    const pages = renderWecomMarkdownPages(oversizedDigest);

    expect(pages.length).toBeGreaterThan(1);
    pages.forEach((page) => {
      expect(Buffer.byteLength(page, "utf8")).toBeLessThanOrEqual(4096);
    });
    expect(pages[0]).toContain("# GitRadar Digest");
    expect(pages[1]).toContain("第 2 页");
  });

  it("renders multiple payloads when a digest spans multiple pages", () => {
    const oversizedDigest: DailyDigest = {
      ...baseDigest,
      items: Array.from({ length: 6 }, (_, index) => ({
        repo: `owner/project-${index}`,
        url: `https://github.com/owner/project-${index}`,
        theme: "AI Agents",
        summary: "很长的内容".repeat(280),
        whyItMatters: "很长的内容".repeat(280),
        whyNow: "很长的内容".repeat(280),
        evidence: ["很长的内容".repeat(60), "很长的内容".repeat(60)],
        novelty: "很长的内容".repeat(280),
        trend: "很长的内容".repeat(280),
      })),
    };

    const payloads = renderWecomMarkdownPayloads(oversizedDigest);

    expect(payloads.length).toBeGreaterThan(1);
    expect(payloads[0].msgtype).toBe("markdown");
  });
});

describe("renderWecomWorkflowFailureMarkdown", () => {
  it("renders a workflow failure alert payload", () => {
    const payload = renderWecomWorkflowFailurePayload({
      workflowName: "Daily Digest",
      trigger: "schedule",
      failedAt: "2026-03-26T00:00:00Z",
      runUrl: "https://github.com/example/GitRadar/actions/runs/123",
      details: "npm run generate:digest -- --send",
    });

    expect(payload.msgtype).toBe("markdown");
    expect(payload.markdown.content).toContain("# GitRadar 任务失败");
    expect(payload.markdown.content).toContain("工作流：Daily Digest");
    expect(payload.markdown.content).toContain(
      "[GitHub Actions](https://github.com/example/GitRadar/actions/runs/123)",
    );
  });

  it("renders the markdown body directly", () => {
    const content = renderWecomWorkflowFailureMarkdown({
      workflowName: "Daily Digest",
      trigger: "workflow_dispatch",
      failedAt: "2026-03-26T00:00:00Z",
      runUrl: "https://github.com/example/GitRadar/actions/runs/456",
    });

    expect(content).toContain("触发方式：workflow_dispatch");
    expect(content).toContain("失败时间：2026-03-26T00:00:00Z");
  });
});

describe("WecomRobotNotifier", () => {
  it("sends markdown payload to the configured webhook", async () => {
    let receivedBody = "";

    const server = createServer((request, response) => {
      request.on("data", (chunk) => {
        receivedBody += chunk.toString();
      });

      request.on("end", () => {
        response.writeHead(200, { "content-type": "application/json" });
        response.end(JSON.stringify({ errcode: 0, errmsg: "ok" }));
      });
    });

    await new Promise<void>((resolve) => server.listen(0, resolve));
    const address = server.address();

    if (!address || typeof address === "string") {
      throw new Error("Failed to create test server.");
    }

    const notifier = new WecomRobotNotifier(
      `http://127.0.0.1:${address.port}/webhook`,
    );

    await notifier.sendDailyDigest({
      date: "2026-03-25",
      title: "GitRadar Digest",
      items: [
        {
          repo: "owner/project-one",
          url: "https://github.com/owner/project-one",
          theme: "AI Agents",
          summary: "一个测试项目。",
          whyItMatters: "值得关注。",
          whyNow: "多来源同时命中，且近期更新活跃。",
          evidence: ["GitHub Trending 命中", "最近 7 天更新活跃"],
          novelty: "有新意。",
          trend: "增长明显。",
        },
      ],
    });

    server.close();

    expect(receivedBody).toContain('"msgtype":"markdown"');
    expect(receivedBody).toContain("owner/project-one");
  });

  it("sends multiple webhook requests when the digest spans multiple pages", async () => {
    const receivedBodies: string[] = [];

    const server = createServer((request, response) => {
      let body = "";

      request.on("data", (chunk) => {
        body += chunk.toString();
      });

      request.on("end", () => {
        receivedBodies.push(body);
        response.writeHead(200, { "content-type": "application/json" });
        response.end(JSON.stringify({ errcode: 0, errmsg: "ok" }));
      });
    });

    await new Promise<void>((resolve) => server.listen(0, resolve));
    const address = server.address();

    if (!address || typeof address === "string") {
      throw new Error("Failed to create test server.");
    }

    const notifier = new WecomRobotNotifier(
      `http://127.0.0.1:${address.port}/webhook`,
    );

    await notifier.sendDailyDigest({
      date: "2026-03-25",
      title: "GitRadar Digest",
      items: Array.from({ length: 6 }, (_, index) => ({
        repo: `owner/project-${index}`,
        url: `https://github.com/owner/project-${index}`,
        theme: "AI Agents",
        summary: "很长的内容".repeat(280),
        whyItMatters: "很长的内容".repeat(280),
        whyNow: "很长的内容".repeat(280),
        evidence: ["很长的内容".repeat(60), "很长的内容".repeat(60)],
        novelty: "很长的内容".repeat(280),
        trend: "很长的内容".repeat(280),
      })),
    });

    server.close();

    expect(receivedBodies.length).toBeGreaterThan(1);
    expect(receivedBodies[0]).toContain('"msgtype":"markdown"');
  });

  it("throws when the remote API responds with an error", async () => {
    const server = createServer((_, response) => {
      response.writeHead(200, { "content-type": "application/json" });
      response.end(
        JSON.stringify({ errcode: 93000, errmsg: "invalid webhook" }),
      );
    });

    await new Promise<void>((resolve) => server.listen(0, resolve));
    const address = server.address();

    if (!address || typeof address === "string") {
      throw new Error("Failed to create test server.");
    }

    const notifier = new WecomRobotNotifier(
      `http://127.0.0.1:${address.port}/webhook`,
    );

    await expect(
      notifier.sendDailyDigest({
        date: "2026-03-25",
        title: "GitRadar Digest",
        items: [
          {
            repo: "owner/project-one",
            url: "https://github.com/owner/project-one",
            theme: "AI Agents",
            summary: "一个测试项目。",
            whyItMatters: "值得关注。",
            whyNow: "多来源同时命中，且近期更新活跃。",
            evidence: ["GitHub Trending 命中", "最近 7 天更新活跃"],
            novelty: "有新意。",
            trend: "增长明显。",
          },
        ],
      }),
    ).rejects.toThrow("WeCom robot responded with errcode=93000");

    server.close();
  });

  it("sends a workflow failure alert to the configured webhook", async () => {
    let receivedBody = "";

    const server = createServer((request, response) => {
      request.on("data", (chunk) => {
        receivedBody += chunk.toString();
      });

      request.on("end", () => {
        response.writeHead(200, { "content-type": "application/json" });
        response.end(JSON.stringify({ errcode: 0, errmsg: "ok" }));
      });
    });

    await new Promise<void>((resolve) => server.listen(0, resolve));
    const address = server.address();

    if (!address || typeof address === "string") {
      throw new Error("Failed to create test server.");
    }

    const notifier = new WecomRobotNotifier(
      `http://127.0.0.1:${address.port}/webhook`,
    );

    await notifier.sendWorkflowFailureAlert({
      workflowName: "Daily Digest",
      trigger: "schedule",
      failedAt: "2026-03-26T00:00:00Z",
      runUrl: "https://github.com/example/GitRadar/actions/runs/789",
      details: "npm run generate:digest -- --send",
    });

    server.close();

    expect(receivedBody).toContain('"msgtype":"markdown"');
    expect(receivedBody).toContain("GitRadar 任务失败");
    expect(receivedBody).toContain("actions/runs/789");
  });
});
