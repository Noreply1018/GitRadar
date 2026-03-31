import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { DIGEST_RULES_CONFIG } from "../src/config/digest-rules";
import { type DailyDigestArchive } from "../src/core/archive";
import { buildFeedbackInsights } from "../src/feedback/insights";
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
import {
  listFeedbackItems,
  readFeedbackState,
  readRemoteFeedbackState,
  recordFeedback,
} from "../src/feedback/store";
import { readGitHubModeSchedule } from "../src/web-api/services/github-runtime-service";

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
      schemaVersion: 3,
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
      schemaVersion: 3,
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
      source: "github",
      readonly: false,
      path: path.join("config", "schedule.json"),
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
    expect(saved.path).toBe(path.join("config", "schedule.json"));
    expect(saved.committed).toBe(false);

    const file = await readFile(
      path.join(rootDir, "config", "schedule.json"),
      "utf8",
    );
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

  it("uses repo schedule.json as the formal GitHub schedule source", async () => {
    const rootDir = await mkdtemp(path.join(os.tmpdir(), "gitradar-gh-mode-"));
    await mkdir(path.join(rootDir, "config"), { recursive: true });
    await mkdir(path.join(rootDir, ".github", "workflows"), {
      recursive: true,
    });

    await writeFile(
      path.join(rootDir, "config", "schedule.json"),
      JSON.stringify(
        {
          timezone: "America/New_York",
          dailySendTime: "09:45",
        },
        null,
        2,
      ),
      "utf8",
    );
    await writeFile(
      path.join(rootDir, ".github", "workflows", "daily-digest.yml"),
      [
        "name: Daily Digest",
        "on:",
        "  schedule:",
        '    - cron: "*/5 * * * *"',
        "",
      ].join("\n"),
      "utf8",
    );

    await expect(readGitHubModeSchedule(rootDir)).resolves.toMatchObject({
      source: "github",
      readonly: false,
      path: "config/schedule.json",
      settings: {
        timezone: "America/New_York",
        dailySendTime: "09:45",
      },
      cronExpression: "*/5 * * * * (polling) / 45 9 * * * (target)",
    });
  });
});

describe("user preferences", () => {
  it("falls back to empty preferences when no file exists", async () => {
    const rootDir = await mkdtemp(
      path.join(os.tmpdir(), "gitradar-preferences-"),
    );

    expect(readUserPreferences(rootDir)).toMatchObject({
      path: path.join("config", "user-preferences.json"),
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
    expect(saved.path).toBe(path.join("config", "user-preferences.json"));
    expect(saved.committed).toBe(false);

    const file = await readFile(
      path.join(rootDir, "config", "user-preferences.json"),
      "utf8",
    );
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
    expect(result.committed).toBe(false);

    const storedState = JSON.parse(
      await readFile(
        path.join(rootDir, "data", "feedback", "feedback-state.json"),
        "utf8",
      ),
    ) as Record<string, unknown>;
    expect(storedState.repoStates).toBeTruthy();
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

  it("lists current saved and later items from the latest repo state", async () => {
    const rootDir = await mkdtemp(path.join(os.tmpdir(), "gitradar-feedback-"));

    await recordFeedback(rootDir, {
      repo: "owner/repo-a",
      date: "2026-03-30",
      action: "saved",
      theme: "AI Agents",
    });
    await recordFeedback(rootDir, {
      repo: "owner/repo-b",
      date: "2026-03-30",
      action: "later",
      theme: "Frontend & Design",
    });
    await recordFeedback(rootDir, {
      repo: "owner/repo-a",
      date: "2026-03-31",
      action: "skipped",
      theme: "AI Agents",
    });

    const savedItems = await listFeedbackItems(rootDir, { action: "saved" });
    const laterItems = await listFeedbackItems(rootDir, { action: "later" });

    expect(savedItems).toEqual([]);
    expect(laterItems).toHaveLength(1);
    expect(laterItems[0]).toMatchObject({
      repo: "owner/repo-b",
      action: "later",
      theme: "Frontend & Design",
    });
  });

  it("derives interest insights and preference suggestions from recent saves", async () => {
    const rootDir = await mkdtemp(path.join(os.tmpdir(), "gitradar-feedback-"));

    await recordFeedback(rootDir, {
      repo: "owner/repo-a",
      date: "2026-03-30",
      action: "saved",
      theme: "Infra & Runtime",
    });
    await recordFeedback(rootDir, {
      repo: "owner/repo-b",
      date: "2026-03-31",
      action: "saved",
      theme: "Infra & Runtime",
    });
    await recordFeedback(rootDir, {
      repo: "owner/repo-c",
      date: "2026-03-31",
      action: "skipped",
      theme: "Frontend & Design",
    });

    const state = await readFeedbackState(rootDir);
    const insights = buildFeedbackInsights(state, {
      preferredThemes: [],
      customTopics: [],
    });

    expect(insights.interestedThemes[0]).toMatchObject({
      theme: "Infra & Runtime",
    });
    expect(insights.skippedThemes[0]).toMatchObject({
      theme: "Frontend & Design",
    });
    expect(insights.preferenceSuggestion).toMatchObject({
      theme: "Infra & Runtime",
      suggestedAction: "prefer",
    });
  });

  it("reads the remote feedback state from the formal feedback directory", async () => {
    const rootDir = await mkdtemp(path.join(os.tmpdir(), "gitradar-feedback-"));
    await mkdir(path.join(rootDir, "data", "feedback"), { recursive: true });
    await writeFile(
      path.join(rootDir, "data", "feedback", "feedback-state.json"),
      JSON.stringify(
        {
          repoStates: {
            "owner/repo-a": {
              repo: "owner/repo-a",
              date: "2026-03-31",
              action: "saved",
              theme: "AI Agents",
              recordedAt: "2026-03-31T09:00:00.000Z",
            },
          },
          themeStats: {
            "AI Agents": { saved: 1, skipped: 0 },
          },
          recent: [
            {
              repo: "owner/repo-a",
              date: "2026-03-31",
              action: "saved",
              theme: "AI Agents",
              recordedAt: "2026-03-31T09:00:00.000Z",
            },
          ],
        },
        null,
        2,
      ),
      "utf8",
    );

    await expect(readRemoteFeedbackState(rootDir)).resolves.toMatchObject({
      repoStates: {
        "owner/repo-a": expect.objectContaining({
          action: "saved",
          theme: "AI Agents",
        }),
      },
    });
  });
});
