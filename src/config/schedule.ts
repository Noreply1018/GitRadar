import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export {
  DEFAULT_SCHEDULE_SETTINGS,
  SCHEDULE_TIMEZONE_OPTIONS,
  convertDailySendTimeToCron,
  parseScheduleSettings,
  stringifyScheduleSettings,
  type ScheduleSettings,
  type ScheduleTimezone,
  type TimezoneOption,
} from "../core/schedule";
import {
  DEFAULT_SCHEDULE_SETTINGS,
  parseScheduleSettings,
  stringifyScheduleSettings,
  type ScheduleSettings,
} from "../core/schedule";

export async function readStoredScheduleSettings(
  rootDir: string,
): Promise<ScheduleSettings> {
  const filePath = getScheduleSettingsPath(rootDir);

  try {
    const raw = await readFile(filePath, "utf8");
    return parseScheduleSettings(JSON.parse(raw));
  } catch (error) {
    if (isMissingFileError(error)) {
      return { ...DEFAULT_SCHEDULE_SETTINGS };
    }

    throw error;
  }
}

export async function writeStoredScheduleSettings(
  rootDir: string,
  draft: unknown,
): Promise<ScheduleSettings> {
  const settings = parseScheduleSettings(draft);
  const filePath = getScheduleSettingsPath(rootDir);

  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, stringifyScheduleSettings(settings), "utf8");

  return settings;
}

export function getScheduleSettingsRepoPath(): string {
  return path.join("config", "schedule.json");
}

export function getScheduleSettingsPath(rootDir: string): string {
  return path.join(rootDir, getScheduleSettingsRepoPath());
}

function isMissingFileError(error: unknown): boolean {
  return Boolean(
    error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "ENOENT",
  );
}
