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
  getGitHubExecutionStatePath,
  normalizeExecutionState,
  writeGitHubExecutionState,
} from "../src/core/github-execution-state";

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
