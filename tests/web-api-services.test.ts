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
import {
  readUserPreferences,
  saveUserPreferences,
} from "../src/web-api/services/user-preferences-service";
import { readFeedbackState, recordFeedback } from "../src/feedback/store";

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
      availableTimezones: expect.arrayContaining([
        expect.objectContaining({ value: "Asia/Shanghai" }),
        expect.objectContaining({ value: "America/New_York" }),
      ]),
    });
  });

  it("saves a valid daily send time and timezone to config/schedule.json", async () => {
    const rootDir = await mkdtemp(path.join(os.tmpdir(), "gitradar-schedule-"));

    const saved = await saveScheduleSettings(rootDir, {
      timezone: "America/New_York",
      dailySendTime: "09:45",
    });

    expect(saved.settings.dailySendTime).toBe("09:45");
    expect(saved.settings.timezone).toBe("America/New_York");
    expect(saved.path).toBe(path.join(rootDir, "config", "schedule.json"));

    const file = await readFile(saved.path, "utf8");
    expect(JSON.parse(file)).toEqual({
      timezone: "America/New_York",
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

  it("rejects unsupported timezone values", async () => {
    const rootDir = await mkdtemp(path.join(os.tmpdir(), "gitradar-schedule-"));

    await expect(
      saveScheduleSettings(rootDir, {
        timezone: "UTC" as "Asia/Shanghai",
        dailySendTime: "09:45",
      }),
    ).rejects.toThrow(/常用城市时区/);
  });

  it("converts a saved time into the cron expression used by Docker", () => {
    expect(convertDailySendTimeToCron("08:17")).toBe("17 8 * * *");
    expect(convertDailySendTimeToCron("21:05")).toBe("5 21 * * *");
  });
});

describe("user preferences", () => {
  it("falls back to empty preferences when no file exists", async () => {
    const rootDir = await mkdtemp(
      path.join(os.tmpdir(), "gitradar-preferences-"),
    );

    expect(readUserPreferences(rootDir)).toMatchObject({
      preferences: {
        preferredThemes: [],
        customTopics: [],
      },
      availableThemes: expect.arrayContaining(["AI Agents", "AI Research"]),
    });
  });

  it("saves preferred themes and custom topics", async () => {
    const rootDir = await mkdtemp(
      path.join(os.tmpdir(), "gitradar-preferences-"),
    );

    const saved = await saveUserPreferences(rootDir, {
      preferredThemes: ["AI Agents", "Frontend & Design"],
      customTopics: ["Fabric", "FPGA"],
    });

    expect(saved.preferences).toEqual({
      preferredThemes: ["AI Agents", "Frontend & Design"],
      customTopics: ["Fabric", "FPGA"],
    });

    const file = await readFile(saved.path, "utf8");
    expect(JSON.parse(file)).toEqual({
      preferredThemes: ["AI Agents", "Frontend & Design"],
      customTopics: ["Fabric", "FPGA"],
    });
  });

  it("rejects unknown preferred themes", async () => {
    const rootDir = await mkdtemp(
      path.join(os.tmpdir(), "gitradar-preferences-"),
    );

    await expect(
      saveUserPreferences(rootDir, {
        preferredThemes: ["Unknown Theme"],
        customTopics: [],
      }),
    ).rejects.toThrow(/unknown theme/i);
  });
});

describe("feedback store", () => {
  it("falls back to an empty feedback state when no file exists", async () => {
    const rootDir = await mkdtemp(path.join(os.tmpdir(), "gitradar-feedback-"));

    await expect(readFeedbackState(rootDir)).resolves.toEqual({
      repoStates: {},
      themeStats: {},
      recent: [],
    });
  });

  it("records feedback events and keeps the latest repo state", async () => {
    const rootDir = await mkdtemp(path.join(os.tmpdir(), "gitradar-feedback-"));

    await recordFeedback(rootDir, {
      repo: "owner/repo-a",
      date: "2026-03-30",
      action: "saved",
      theme: "Frontend & Design",
    });
    const result = await recordFeedback(rootDir, {
      repo: "owner/repo-a",
      date: "2026-03-31",
      action: "skipped",
      theme: "Frontend & Design",
    });

    expect(result.state.repoStates["owner/repo-a"]).toMatchObject({
      action: "skipped",
      date: "2026-03-31",
      theme: "Frontend & Design",
    });
    expect(result.state.themeStats["Frontend & Design"]).toEqual({
      saved: 0,
      skipped: 1,
    });
    expect(result.state.recent[0]?.repo).toBe("owner/repo-a");
  });

  it("rejects invalid feedback actions", async () => {
    const rootDir = await mkdtemp(path.join(os.tmpdir(), "gitradar-feedback-"));

    await expect(
      recordFeedback(rootDir, {
        repo: "owner/repo-a",
        date: "2026-03-30",
        action: "opened" as "saved",
      }),
    ).rejects.toThrow(/saved、skipped 或 later/);
  });
});
