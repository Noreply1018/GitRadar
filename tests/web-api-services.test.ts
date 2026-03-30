import { describe, expect, it } from "vitest";

import { DIGEST_RULES_CONFIG } from "../src/config/digest-rules";
import { type DailyDigestArchive } from "../src/core/archive";
import { buildArchiveSummary } from "../src/web-api/services/archive-service";
import {
  CommandRunner,
  listCommandSpecs,
} from "../src/web-api/services/command-runner";
import { validateDigestRulesDraft } from "../src/web-api/services/digest-rules-service";

describe("validateDigestRulesDraft", () => {
  it("accepts the current repository config", () => {
    const result = validateDigestRulesDraft(DIGEST_RULES_CONFIG);

    expect(result.valid).toBe(true);
    expect(result.issues).toEqual([]);
  });

  it("returns a structured path when validation fails", () => {
    const result = validateDigestRulesDraft({
      ...DIGEST_RULES_CONFIG,
      thresholds: {
        ...DIGEST_RULES_CONFIG.thresholds,
        maxPushedDays: -1,
      },
    });

    expect(result.valid).toBe(false);
    expect(result.issues[0]?.path).toBe("digestRules.thresholds.maxPushedDays");
  });
});

describe("buildArchiveSummary", () => {
  it("extracts top-level archive data for the dashboard", () => {
    const archive: DailyDigestArchive = {
      schemaVersion: 2,
      generatedAt: "2026-03-30T07:00:00.000Z",
      candidateCount: 12,
      shortlistedCount: 6,
      candidates: [],
      shortlisted: [],
      selection: {
        llmCandidateRepos: ["owner/a", "owner/b"],
        selected: [],
        rejected: [],
      },
      generationMeta: {
        sourceCounts: {
          trending: 1,
          search_recently_updated: 2,
          search_recently_created: 3,
        },
        llmCandidateCount: 2,
        rulesVersion: "2026-03-evidence-v1",
        editorialMode: "llm",
      },
      digest: {
        date: "2026-03-30",
        title: "GitRadar Daily Digest",
        items: [
          {
            repo: "owner/a",
            url: "https://github.com/owner/a",
            summary: "A",
            whyItMatters: "B",
            whyNow: "C",
            novelty: "D",
            trend: "E",
            evidence: ["F"],
            theme: "AI Agents",
          },
          {
            repo: "owner/b",
            url: "https://github.com/owner/b",
            summary: "A",
            whyItMatters: "B",
            whyNow: "C",
            novelty: "D",
            trend: "E",
            evidence: ["F"],
            theme: "AI Research",
          },
        ],
      },
    };

    expect(buildArchiveSummary(archive)).toEqual({
      date: "2026-03-30",
      generatedAt: "2026-03-30T07:00:00.000Z",
      schemaVersion: 2,
      rulesVersion: "2026-03-evidence-v1",
      digestCount: 2,
      title: "GitRadar Daily Digest",
      editorialMode: "llm",
      topRepos: ["owner/a", "owner/b"],
    });
  });
});

describe("CommandRunner", () => {
  it("documents the supported command whitelist", () => {
    const specs = listCommandSpecs();

    expect(specs.map((item) => item.id)).toContain("generate-digest");
    expect(
      specs.find((item) => item.id === "analyze-digest")?.requiresDate,
    ).toBe(true);
  });

  it("rejects analyze requests without a date", () => {
    const runner = new CommandRunner(process.cwd());

    expect(() => runner.startJob("analyze-digest")).toThrow(/requires a date/);
  });
});
