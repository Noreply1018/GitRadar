import { describe, expect, it } from "vitest";
import {
  renderWecomMarkdownPages,
  renderWecomMarkdown,
  renderWecomMarkdownPayloads,
} from "../../src/notifiers/wecom-robot";
import type { DailyDigest } from "../../src/core/digest";

function buildDigest(itemCount: number): DailyDigest {
  return {
    date: "2026-04-14",
    title: "GitRadar \u00b7 2026-04-14",
    items: Array.from({ length: itemCount }, (_, i) => ({
      repo: `owner/repo-${i}`,
      url: `https://github.com/owner/repo-${i}`,
      theme: "AI Agents",
      summary: `\u7528\u4e8e\u7f16\u6392\u591a\u6b65\u9aa4 AI \u5de5\u4f5c\u6d41\u7684\u6846\u67b6 ${i}`,
      whyItMatters: "\u964d\u4f4e agent \u5f00\u53d1\u95e8\u69db",
      whyNow: "\u8fd1\u4e00\u5468 star \u6da8\u5e45 300%",
      evidence: ["7\u65e5 star +1200", "trending \u4e0a\u699c"],
      novelty: "\u9996\u4e2a\u540c\u65f6\u652f\u6301\u540c\u6b65\u548c\u5f02\u6b65 agent \u7684\u6846\u67b6",
      trend: "\u8fde\u7eed\u4e24\u5468\u51fa\u73b0\u5728 trending",
    })),
  };
}

describe("renderWecomMarkdownPages", () => {
  it("renders a single page for small digest", () => {
    const digest = buildDigest(2);
    const pages = renderWecomMarkdownPages(digest);
    expect(pages.length).toBe(1);
    expect(pages[0]).toContain("GitRadar");
  });

  it("splits into multiple pages when exceeding byte limit", () => {
    const digest = buildDigest(8);
    const pages = renderWecomMarkdownPages(digest);
    for (const page of pages) {
      const byteLength = Buffer.byteLength(page, "utf8");
      expect(byteLength).toBeLessThanOrEqual(4096);
    }
  });

  it("includes all items across pages", () => {
    const digest = buildDigest(8);
    const pages = renderWecomMarkdownPages(digest);
    const combined = pages.join("\n");
    for (const item of digest.items) {
      expect(combined).toContain(item.repo);
    }
  });
});

describe("renderWecomMarkdown", () => {
  it("returns a non-empty string", () => {
    const digest = buildDigest(3);
    const result = renderWecomMarkdown(digest);
    expect(result.length).toBeGreaterThan(0);
  });
});

describe("renderWecomMarkdownPayloads", () => {
  it("returns payload objects with msgtype markdown", () => {
    const digest = buildDigest(3);
    const payloads = renderWecomMarkdownPayloads(digest);
    for (const payload of payloads) {
      expect(payload.msgtype).toBe("markdown");
      expect(payload.markdown.content).toBeTruthy();
    }
  });
});
