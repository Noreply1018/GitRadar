import { describe, expect, it } from "vitest";

import {
  parseAnalyzeDigestArgs,
  renderArchiveAnalysis,
} from "../src/commands/analyze-digest";
import {
  CURRENT_DAILY_DIGEST_ARCHIVE_SCHEMA_VERSION,
  migrateDailyDigestArchive,
  type DailyDigestArchive,
} from "../src/core/archive";

describe("parseAnalyzeDigestArgs", () => {
  it("defaults to markdown output when --format is omitted", () => {
    expect(parseAnalyzeDigestArgs(["--date", "2026-03-28"])).toEqual({
      date: "2026-03-28",
      format: "markdown",
    });
  });
});

describe("renderArchiveAnalysis", () => {
  it("renders evidence-driven analysis for the current archive shape", () => {
    const output = renderArchiveAnalysis("2026-03-28", {
      schemaVersion: CURRENT_DAILY_DIGEST_ARCHIVE_SCHEMA_VERSION,
      generatedAt: "2026-03-28T02:00:00Z",
      candidateCount: 49,
      shortlistedCount: 20,
      digest: {
        date: "2026-03-28",
        title: "GitRadar · 2026-03-28",
        items: [
          {
            repo: "owner/alpha-agent",
            url: "https://github.com/owner/alpha-agent",
            theme: "AI Agents",
            summary: "一个面向自动化任务的 AI Agent 框架。",
            whyItMatters: "适合持续关注。",
            whyNow: "多来源同时命中，且近期更新活跃。",
            evidence: ["GitHub Trending 命中", "最近 7 天更新活跃"],
            novelty: "结构清晰。",
            trend: "近期热度上升。",
          },
        ],
      },
      candidates: [],
      shortlisted: [],
      selection: {
        llmCandidateRepos: ["owner/alpha-agent"],
        selected: [
          {
            repo: "owner/alpha-agent",
            theme: "AI Agents",
            reason: "多来源重合且综合评分靠前。",
            evidence: ["GitHub Trending 命中", "最近 7 天更新活跃"],
          },
        ],
        rejected: [],
      },
      generationMeta: {
        sourceCounts: {
          trending: 20,
          search_recently_updated: 20,
          search_recently_created: 20,
        },
        llmCandidateCount: 1,
        rulesVersion: "2026-03-evidence-v1",
        editorialMode: "llm",
        warnings: ["GitHub Trending 抓取失败，已降级为仅使用 Search 候选。"],
      },
    });

    expect(output).toContain("GitRadar Archive Analysis · 2026-03-28");
    expect(output).toContain("为什么是现在：多来源同时命中，且近期更新活跃。");
    expect(output).toContain("证据：GitHub Trending 命中；最近 7 天更新活跃");
    expect(output).toContain("成稿模式：llm");
    expect(output).toContain("## 运行警告");
  });

  it("handles legacy archives without evidence fields", () => {
    const migratedArchive = migrateDailyDigestArchive({
      generatedAt: "2026-03-21T02:00:00Z",
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
    });
    const output = renderArchiveAnalysis(
      "2026-03-21",
      migratedArchive as DailyDigestArchive,
    );

    expect(output).toContain("General OSS");
    expect(output).toContain("为什么是现在：未记录");
    expect(output).toContain("证据：未记录");
    expect(output).toContain(
      `Schema 版本：${CURRENT_DAILY_DIGEST_ARCHIVE_SCHEMA_VERSION}`,
    );
  });
});
