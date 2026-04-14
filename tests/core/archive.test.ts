import { describe, expect, it } from "vitest";
import {
  parseDailyDigestArchive,
  CURRENT_DAILY_DIGEST_ARCHIVE_SCHEMA_VERSION,
} from "../../src/core/archive";

function buildValidArchive() {
  return {
    schemaVersion: CURRENT_DAILY_DIGEST_ARCHIVE_SCHEMA_VERSION,
    generatedAt: "2026-04-14T08:17:00.000Z",
    candidateCount: 30,
    shortlistedCount: 20,
    digest: {
      date: "2026-04-14",
      title: "GitRadar \u00b7 2026-04-14",
      items: [
        {
          repo: "owner/repo",
          url: "https://github.com/owner/repo",
          theme: "AI Agents",
          summary: "\u7528\u4e8e\u7f16\u6392\u591a\u6b65\u9aa4 AI \u5de5\u4f5c\u6d41\u7684\u6846\u67b6",
          whyItMatters: "\u964d\u4f4e agent \u5f00\u53d1\u95e8\u69db",
          whyNow: "\u8fd1\u4e00\u5468 star \u6da8\u5e45 300%",
          evidence: ["7\u65e5 star +1200", "trending \u4e0a\u699c"],
          novelty: "\u9996\u4e2a\u540c\u65f6\u652f\u6301\u540c\u6b65\u548c\u5f02\u6b65 agent \u7684\u6846\u67b6",
          trend: "\u8fde\u7eed\u4e24\u5468\u51fa\u73b0\u5728 trending",
        },
      ],
    },
    candidates: [],
    shortlisted: [],
    selection: {
      llmCandidateRepos: ["owner/repo"],
      selected: [
        {
          repo: "owner/repo",
          theme: "AI Agents",
          reason: "\u7efc\u5408\u8bc4\u5206\u6700\u9ad8",
          evidence: ["7\u65e5 star +1200"],
        },
      ],
      rejected: [],
    },
    generationMeta: {
      sourceCounts: {
        trending: 15,
        search_recently_updated: 10,
        search_recently_created: 5,
      },
      llmCandidateCount: 12,
      rulesVersion: "2026-03-evidence-v1",
    },
  };
}

describe("parseDailyDigestArchive", () => {
  it("parses a valid archive", () => {
    const archive = buildValidArchive();
    const result = parseDailyDigestArchive(archive, "test");
    expect(result.schemaVersion).toBe(CURRENT_DAILY_DIGEST_ARCHIVE_SCHEMA_VERSION);
    expect(result.digest.items).toHaveLength(1);
    expect(result.digest.items[0].repo).toBe("owner/repo");
  });

  it("returns a defensive clone", () => {
    const archive = buildValidArchive();
    const result = parseDailyDigestArchive(archive, "test");
    result.digest.items[0].repo = "mutated";
    const result2 = parseDailyDigestArchive(archive, "test");
    expect(result2.digest.items[0].repo).toBe("owner/repo");
  });

  it("rejects archives with wrong schema version", () => {
    const archive = buildValidArchive();
    archive.schemaVersion = 99 as typeof archive.schemaVersion;
    expect(() => parseDailyDigestArchive(archive, "test")).toThrow(/not supported/);
  });

  it("rejects null input", () => {
    expect(() => parseDailyDigestArchive(null, "test")).toThrow(/not supported/);
  });

  it("rejects archive missing digest items", () => {
    const archive = buildValidArchive();
    (archive.digest as Record<string, unknown>).items = "not-an-array";
    expect(() => parseDailyDigestArchive(archive, "test")).toThrow(/not supported/);
  });

  it("rejects archive with invalid selection entry", () => {
    const archive = buildValidArchive();
    archive.selection.selected[0].evidence = "not-an-array" as unknown as string[];
    expect(() => parseDailyDigestArchive(archive, "test")).toThrow(/not supported/);
  });
});
