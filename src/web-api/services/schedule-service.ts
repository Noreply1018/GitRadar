import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import type {
  ScheduleSettings,
  ScheduleSettingsResponse,
  ScheduleTimezone,
} from "../types/api";

export const SCHEDULE_TIMEZONE_OPTIONS = [
  { value: "Asia/Shanghai", label: "上海" },
  { value: "Asia/Tokyo", label: "东京" },
  { value: "Europe/Berlin", label: "柏林" },
  { value: "Europe/London", label: "伦敦" },
  { value: "America/New_York", label: "纽约" },
  { value: "America/Los_Angeles", label: "洛杉矶" },
] as const;

export const DEFAULT_SCHEDULE_SETTINGS: ScheduleSettings = {
  timezone: "Asia/Shanghai",
  dailySendTime: "08:17",
};

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

export async function readScheduleSettings(
  rootDir: string,
): Promise<ScheduleSettingsResponse> {
  const filePath = getScheduleSettingsPath(rootDir);

  try {
    const raw = await readFile(filePath, "utf8");
    return {
      path: filePath,
      settings: parseScheduleSettings(JSON.parse(raw)),
      availableTimezones: [...SCHEDULE_TIMEZONE_OPTIONS],
    };
  } catch (error) {
    if (isMissingFileError(error)) {
      return {
        path: filePath,
        settings: { ...DEFAULT_SCHEDULE_SETTINGS },
        availableTimezones: [...SCHEDULE_TIMEZONE_OPTIONS],
      };
    }

    throw error;
  }
}

export async function saveScheduleSettings(
  rootDir: string,
  draft: unknown,
): Promise<ScheduleSettingsResponse> {
  const filePath = getScheduleSettingsPath(rootDir);
  const settings = parseScheduleSettings(draft);

  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, stringifyScheduleSettings(settings), "utf8");

  return {
    path: filePath,
    settings,
    availableTimezones: [...SCHEDULE_TIMEZONE_OPTIONS],
  };
}

export function parseScheduleSettings(input: unknown): ScheduleSettings {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("scheduleSettings 必须是对象。");
  }

  const timezone =
    "timezone" in input ? (input.timezone as unknown) : undefined;
  const dailySendTime =
    "dailySendTime" in input ? (input.dailySendTime as unknown) : undefined;

  if (
    typeof timezone !== "string" ||
    !SCHEDULE_TIMEZONE_OPTIONS.some((option) => option.value === timezone)
  ) {
    throw new Error("scheduleSettings.timezone 必须是受支持的常用城市时区。");
  }

  if (typeof dailySendTime !== "string" || !TIME_PATTERN.test(dailySendTime)) {
    throw new Error(
      "scheduleSettings.dailySendTime 必须是 HH:mm 格式的 24 小时制时间。",
    );
  }

  return {
    timezone: timezone as ScheduleTimezone,
    dailySendTime,
  };
}

export function stringifyScheduleSettings(settings: ScheduleSettings): string {
  return `${JSON.stringify(settings, null, 2)}\n`;
}

export function convertDailySendTimeToCron(dailySendTime: string): string {
  const matched = dailySendTime.match(TIME_PATTERN);

  if (!matched) {
    throw new Error("dailySendTime 必须是 HH:mm 格式。");
  }

  const [, hour, minute] = matched;
  return `${Number(minute)} ${Number(hour)} * * *`;
}

export function getScheduleSettingsPath(rootDir: string): string {
  return path.join(rootDir, "config", "schedule.json");
}

function isMissingFileError(error: unknown): boolean {
  return Boolean(
    error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "ENOENT",
  );
}
