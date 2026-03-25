const DEFAULT_TIME_ZONE = "Asia/Shanghai";

export function getCurrentDigestDate(
  date: Date = new Date(),
  timeZone = DEFAULT_TIME_ZONE,
): string {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function getIsoTimestamp(date: Date = new Date()): string {
  return date.toISOString();
}

export function getDateDaysAgo(daysAgo: number, from = new Date()): string {
  const date = new Date(from);
  date.setUTCDate(date.getUTCDate() - daysAgo);
  return date.toISOString().slice(0, 10);
}

export function getDaysSince(isoDate: string, from = new Date()): number {
  const target = new Date(isoDate);
  return Math.max(
    0,
    Math.floor((from.getTime() - target.getTime()) / 86400000),
  );
}
