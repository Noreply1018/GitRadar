import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  DIGEST_RULES_CONFIG,
  loadDigestRulesConfig,
  parseDigestRulesConfig,
} from "../src/config/digest-rules";
import {
  buildDigestCandidatePool,
  getRulesVersion,
  selectCandidatesForDigest,
} from "../src/digest/rules";
import type { GitHubCandidateRepo } from "../src/github/types";

function createCandidate(
  overrides: Partial<GitHubCandidateRepo>,
): GitHubCandidateRepo {
  return {
    repo: "owner/repo",
    url: "https://github.com/owner/repo",
    description: "一个很有意思的项目，最近更新活跃。",
    language: "TypeScript",
    stars: 1200,
    forks: 100,
    topics: ["ai", "agent"],
    createdAt: "2026-03-01T00:00:00Z",
    updatedAt: "2026-03-25T00:00:00Z",
    pushedAt: "2026-03-25T00:00:00Z",
    archived: false,
    disabled: false,
    fork: false,
    sources: ["trending"],
    ...overrides,
  };
}

describe("selectCandidatesForDigest", () => {
  it("filters obvious low-quality repositories", () => {
    const selected = selectCandidatesForDigest([
      createCandidate({ repo: "good/repo" }),
      createCandidate({
        repo: "bad/repo",
        description: "awesome curated list for everything",
      }),
    ]);

    expect(selected).toHaveLength(1);
    expect(selected[0].repo).toBe("good/repo");
  });

  it("limits the shortlisted candidates", () => {
    const themes = [
      {
        description: "AI agent orchestration runtime for developers.",
        topics: ["ai", "agent"],
      },
      {
        description: "CLI automation layer for local developer workflows.",
        topics: ["cli", "developer"],
      },
      {
        description: "Observability toolkit for profiling Rust services.",
        topics: ["observability", "profiling"],
      },
      {
        description: "Experimental frontend design system for web animation.",
        topics: ["frontend", "design"],
      },
      {
        description: "Search and retrieval stack for data-heavy products.",
        topics: ["search", "data"],
      },
    ];
    const candidates = Array.from({ length: 30 }, (_, index) => {
      const theme = themes[index % themes.length];
      return createCandidate({
        repo: `owner/repo-${index}`,
        description: theme.description,
        topics: theme.topics,
        stars: 2000 - index,
      });
    });

    expect(selectCandidatesForDigest(candidates, 20)).toHaveLength(20);
  });

  it("caps same-theme candidates by the configured shortlist quota", () => {
    const candidates = Array.from({ length: 6 }, (_, index) =>
      createCandidate({
        repo: `owner/agent-${index}`,
        description: "AI agent orchestration runtime with workflow memory.",
        topics: ["agent", "workflow"],
        stars: 5000 - index,
      }),
    );

    const selected = selectCandidatesForDigest(candidates, 20);

    expect(selected).toHaveLength(
      DIGEST_RULES_CONFIG.selection.shortlistMaxPerTheme,
    );
    expect(selected.every((candidate) => candidate.theme === "AI Agents")).toBe(
      true,
    );
  });

  it("prefers multi-source and recently active projects over stale mature ones", () => {
    const selected = selectCandidatesForDigest([
      createCandidate({
        repo: "owner/fresh-signal",
        sources: ["trending", "search_recently_updated"],
        stars: 3600,
        forks: 280,
        createdAt: "2026-03-10T00:00:00Z",
        pushedAt: "2026-03-25T00:00:00Z",
        readmeExcerpt: "A runtime for AI workflows with production examples.",
      }),
      createCandidate({
        repo: "owner/old-giant",
        sources: ["search_recently_updated"],
        stars: 65000,
        forks: 8200,
        createdAt: "2021-01-01T00:00:00Z",
        pushedAt: "2026-02-15T00:00:00Z",
        readmeExcerpt: "A mature general purpose framework.",
      }),
    ]);

    expect(selected[0].repo).toBe("owner/fresh-signal");
  });

  it("filters template-style repositories by topic or readme", () => {
    const selected = selectCandidatesForDigest([
      createCandidate({
        repo: "owner/real-project",
        topics: ["ai", "search"],
        readmeExcerpt: "An opinionated search agent for developer workflows.",
      }),
      createCandidate({
        repo: "owner/template-project",
        topics: ["ai", "template"],
        readmeExcerpt: "This starter template helps you bootstrap quickly.",
      }),
    ]);

    expect(selected).toHaveLength(1);
    expect(selected[0].repo).toBe("owner/real-project");
  });

  it("filters repositories beyond the configured pushed-at threshold", () => {
    const selected = selectCandidatesForDigest([
      createCandidate({ repo: "owner/fresh" }),
      createCandidate({
        repo: "owner/stale",
        pushedAt: "2025-09-01T00:00:00Z",
      }),
    ]);

    expect(selected).toHaveLength(1);
    expect(selected[0].repo).toBe("owner/fresh");
  });

  it("annotates selected candidates with theme and structured scoring", () => {
    const selected = selectCandidatesForDigest([
      createCandidate({
        repo: "owner/agent-runtime",
        description: "AI agent orchestration runtime with workflow memory.",
        topics: ["agent", "workflow"],
      }),
    ]);

    expect(selected[0].theme).toBe("AI Agents");
    expect(selected[0].scoreBreakdown?.total).toBeGreaterThan(0);
    expect(selected[0].selectionHints?.evidence.length).toBeGreaterThan(0);
  });

  it("reads the rules version from the externalized config", () => {
    expect(getRulesVersion()).toBe(DIGEST_RULES_CONFIG.version);
  });
});

describe("buildDigestCandidatePool", () => {
  it("keeps a mature momentum project in the final candidate pool", () => {
    const candidates = [
      createCandidate({
        repo: "owner/new-agent-1",
        description: "AI agent orchestration runtime for autonomous workflows.",
        topics: ["ai", "agent"],
        sources: ["trending", "search_recently_created"],
      }),
      createCandidate({
        repo: "owner/new-agent-2",
        description: "AI agent toolkit with workflow planning support.",
        topics: ["ai", "agent"],
        sources: ["trending", "search_recently_updated"],
      }),
      createCandidate({
        repo: "owner/new-agent-3",
        description: "AI agent runtime focused on tool calling and memory.",
        topics: ["ai", "agent"],
        sources: ["trending"],
      }),
      createCandidate({
        repo: "owner/mature-observability",
        description: "Observability toolkit for profiling production systems.",
        topics: ["observability", "profiling"],
        sources: ["search_recently_updated"],
        stars: 22000,
        createdAt: "2021-01-01T00:00:00Z",
        pushedAt: "2026-03-25T00:00:00Z",
        readmeExcerpt:
          "Production observability runtime for traces and profiling.",
      }),
    ];

    const shortlisted = selectCandidatesForDigest(candidates, 4);
    const pool = buildDigestCandidatePool(shortlisted, 3);

    expect(
      pool.selected.some(
        (candidate) => candidate.repo === "owner/mature-observability",
      ),
    ).toBe(true);
  });
});

describe("digest rules config", () => {
  it("loads the editable repo config file", () => {
    const loaded = loadDigestRulesConfig();

    expect(loaded.version).toBe(DIGEST_RULES_CONFIG.version);
    expect(loaded.themes).toHaveLength(DIGEST_RULES_CONFIG.themes.length);
  });

  it("rejects themes with empty names", () => {
    expect(() =>
      parseDigestRulesConfig({
        ...DIGEST_RULES_CONFIG,
        themes: [
          {
            theme: "   ",
            keywords: ["agent"],
          },
        ],
      }),
    ).toThrow(/themes\[0\]\.theme must be a non-empty string/i);
  });

  it("rejects overly reused keywords across themes", () => {
    expect(() =>
      parseDigestRulesConfig({
        ...DIGEST_RULES_CONFIG,
        themes: [
          { theme: "A", keywords: ["shared"] },
          { theme: "B", keywords: ["shared"] },
          { theme: "C", keywords: ["shared"] },
        ],
      }),
    ).toThrow(/reuses keyword "shared" across 3 themes/i);
  });

  it("rejects negative thresholds", () => {
    expect(() =>
      parseDigestRulesConfig({
        ...DIGEST_RULES_CONFIG,
        thresholds: {
          ...DIGEST_RULES_CONFIG.thresholds,
          maxPushedDays: -1,
        },
      }),
    ).toThrow(/thresholds\.maxPushedDays must be a non-negative number/i);
  });

  it("rejects buckets that are not strictly increasing", () => {
    expect(() =>
      parseDigestRulesConfig({
        ...DIGEST_RULES_CONFIG,
        thresholds: {
          ...DIGEST_RULES_CONFIG.thresholds,
          recentPushMomentum: [
            { maxDays: 7, score: 20 },
            { maxDays: 7, score: 14 },
          ],
        },
      }),
    ).toThrow(/recentPushMomentum maxDays must be strictly increasing/i);
  });

  it("rejects configs with missing weight fields", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "gitradar-rules-"));
    const configPath = path.join(tempDir, "digest-rules.json");
    const invalidConfig = {
      ...DIGEST_RULES_CONFIG,
      weights: {
        ...DIGEST_RULES_CONFIG.weights,
        coverage: {
          ...DIGEST_RULES_CONFIG.weights.coverage,
        },
      },
    } as Record<string, unknown>;

    delete (invalidConfig.weights as { coverage?: Record<string, unknown> })
      .coverage?.language;
    fs.writeFileSync(configPath, JSON.stringify(invalidConfig), "utf8");

    expect(() => loadDigestRulesConfig(configPath)).toThrow(
      /weights\.coverage\.language must be a valid number/i,
    );
  });
});
