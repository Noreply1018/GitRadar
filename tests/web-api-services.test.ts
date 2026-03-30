import { mkdtemp, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { DIGEST_RULES_CONFIG } from "../src/config/digest-rules";
import { type DailyDigestArchive } from "../src/core/archive";
import { buildArchiveSummary } from "../src/web-api/services/archive-service";
import {
  CommandRunner,
  listCommandSpecs,
} from "../src/web-api/services/command-runner";
import { validateDigestRulesDraft } from "../src/web-api/services/digest-rules-service";
import {
  convertDailySendTimeToCron,
  readScheduleSettings,
  saveScheduleSettings,
} from "../src/web-api/services/schedule-service";

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

describe("schedule settings", () => {
  it("falls back to the default daily send time when no file exists", async () => {
    const rootDir = await mkdtemp(path.join(os.tmpdir(), "gitradar-schedule-"));

    await expect(readScheduleSettings(rootDir)).resolves.toMatchObject({
      settings: {
        timezone: "Asia/Shanghai",
        dailySendTime: "08:17",
      },
    });
  });

  it("saves a valid daily send time to config/schedule.json", async () => {
    const rootDir = await mkdtemp(path.join(os.tmpdir(), "gitradar-schedule-"));

    const saved = await saveScheduleSettings(rootDir, {
      timezone: "Asia/Shanghai",
      dailySendTime: "09:45",
    });

    expect(saved.settings.dailySendTime).toBe("09:45");
    expect(saved.path).toBe(path.join(rootDir, "config", "schedule.json"));

    const file = await readFile(saved.path, "utf8");
    expect(JSON.parse(file)).toEqual({
      timezone: "Asia/Shanghai",
      dailySendTime: "09:45",
    });
  });

  it("rejects unsupported time formats", async () => {
    const rootDir = await mkdtemp(path.join(os.tmpdir(), "gitradar-schedule-"));

    await expect(
      saveScheduleSettings(rootDir, {
        timezone: "Asia/Shanghai",
        dailySendTime: "9:45",
      }),
    ).rejects.toThrow(/HH:mm/);
  });

  it("converts a saved time into the cron expression used by Docker", () => {
    expect(convertDailySendTimeToCron("08:17")).toBe("17 8 * * *");
    expect(convertDailySendTimeToCron("21:05")).toBe("5 21 * * *");
  });
});
