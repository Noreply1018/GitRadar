export type ScheduleTimezone =
  | "Asia/Shanghai"
  | "Asia/Tokyo"
  | "Europe/Berlin"
  | "Europe/London"
  | "America/New_York"
  | "America/Los_Angeles";

export interface TimezoneOption {
  value: ScheduleTimezone;
  label: string;
}

export interface ScheduleSettings {
  timezone: ScheduleTimezone;
  dailySendTime: string;
}

export const SCHEDULE_TIMEZONE_OPTIONS: readonly TimezoneOption[] = [
  { value: "Asia/Shanghai", label: "上海" },
  { value: "Asia/Tokyo", label: "东京" },
  { value: "Europe/Berlin", label: "柏林" },
  { value: "Europe/London", label: "伦敦" },
  { value: "America/New_York", label: "纽约" },
  { value: "America/Los_Angeles", label: "洛杉矶" },
];

export const DEFAULT_SCHEDULE_SETTINGS: ScheduleSettings = {
  timezone: "Asia/Shanghai",
  dailySendTime: "08:17",
};

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

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
