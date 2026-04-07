import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  convertDailySendTimeToCron,
  parseScheduleSettings,
  readStoredScheduleSettings,
  writeStoredScheduleSettings,
} from "../src/config/schedule";
import {
  normalizeExecutionState,
  writeGitHubExecutionState,
  getGitHubExecutionStatePath,
} from "../src/core/github-execution-state";
import { buildFeedbackInsights } from "../src/feedback/insights";
import {
  listStoredFeedbackItems,
  readStoredFeedbackState,
  recordFeedback,
} from "../src/feedback/store";
import {
  parseUserPreferencesConfig,
  readStoredUserPreferencesConfig,
} from "../src/config/user-preferences";

describe("schedule config", () => {
  it("falls back to the default schedule when no file exists", async () => {
    const rootDir = await mkdtemp(path.join(os.tmpdir(), "gitradar-schedule-"));

    await expect(readStoredScheduleSettings(rootDir)).resolves.toEqual({
      timezone: "Asia/Shanghai",
      dailySendTime: "08:17",
    });
  });

  it("writes a validated schedule into config/schedule.json", async () => {
    const rootDir = await mkdtemp(path.join(os.tmpdir(), "gitradar-schedule-"));

    const saved = await writeStoredScheduleSettings(rootDir, {
      timezone: "America/New_York",
      dailySendTime: "09:45",
    });

    expect(saved).toEqual({
      timezone: "America/New_York",
      dailySendTime: "09:45",
    });

    const file = await readFile(
      path.join(rootDir, "config", "schedule.json"),
      "utf8",
    );
    expect(JSON.parse(file)).toEqual(saved);
  });

  it("rejects invalid schedule payloads and converts valid times to cron", () => {
    expect(() =>
      parseScheduleSettings({
        timezone: "UTC",
        dailySendTime: "09:45",
      }),
    ).toThrow(/常用城市时区/);

    expect(() =>
      parseScheduleSettings({
        timezone: "Asia/Shanghai",
        dailySendTime: "9:45",
      }),
    ).toThrow(/HH:mm/);

    expect(convertDailySendTimeToCron("08:17")).toBe("17 8 * * *");
  });
});

describe("GitHub runtime state", () => {
  it("writes normalized runtime state and detects the latest archive", async () => {
    const rootDir = await mkdtemp(path.join(os.tmpdir(), "gitradar-runtime-"));
    await mkdir(path.join(rootDir, "data", "history"), { recursive: true });
    await writeFile(
      path.join(rootDir, "data", "history", "2026-03-30.json"),
      "{}\n",
    );
    await writeFile(
      path.join(rootDir, "data", "history", "2026-03-31.json"),
      "{}\n",
    );

    const state = await writeGitHubExecutionState(rootDir, {
      workflowName: "Daily Digest",
      trigger: "workflow_dispatch",
      lastRunAt: "2026-03-31T12:00:00.000Z",
      lastRunStatus: "success",
      runUrl: "https://github.com/Noreply1018/GitRadar/actions/runs/123",
      ref: "main",
    });

    expect(state.lastArchiveDate).toBe("2026-03-31");

    const file = await readFile(getGitHubExecutionStatePath(rootDir), "utf8");
    expect(normalizeExecutionState(JSON.parse(file))).toEqual(state);
  });

  it("normalizes invalid runtime payload fields to safe defaults", () => {
    expect(
      normalizeExecutionState({
        workflowName: "",
        trigger: 123,
        lastRunAt: "invalid",
        lastRunStatus: "boom",
        lastArchiveDate: "not-a-date",
        runUrl: 123,
        ref: "",
      }),
    ).toEqual({
      source: "github",
      workflowName: "Daily Digest",
      trigger: null,
      lastRunAt: null,
      lastRunStatus: "unknown",
      lastArchiveDate: null,
      runUrl: null,
      ref: "main",
    });
  });
});

describe("user preferences config", () => {
  it("falls back to empty preferences when no file exists", async () => {
    const rootDir = await mkdtemp(
      path.join(os.tmpdir(), "gitradar-preferences-"),
    );

    expect(readStoredUserPreferencesConfig(rootDir)).toEqual({
      preferredThemes: [],
      customTopics: [],
    });
  });

  it("rejects unknown preferred themes", () => {
    expect(() =>
      parseUserPreferencesConfig(
        {
          preferredThemes: ["Unknown Theme"],
          customTopics: [],
        },
        "test",
      ),
    ).toThrow(/unknown theme/i);
  });
});

describe("feedback store", () => {
  it("falls back to an empty feedback state when no file exists", async () => {
    const rootDir = await mkdtemp(path.join(os.tmpdir(), "gitradar-feedback-"));

    await expect(readStoredFeedbackState(rootDir)).resolves.toEqual({
      repoStates: {},
      themeStats: {},
      recent: [],
    });
  });

  it("records feedback locally and keeps the latest repo state", async () => {
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

    const savedItems = await listStoredFeedbackItems(rootDir, {
      action: "saved",
    });
    const laterItems = await listStoredFeedbackItems(rootDir, {
      action: "later",
    });

    expect(savedItems).toEqual([]);
    expect(laterItems).toHaveLength(1);
    expect(laterItems[0]).toMatchObject({
      repo: "owner/repo-b",
      action: "later",
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

    const state = await readStoredFeedbackState(rootDir);
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
});
