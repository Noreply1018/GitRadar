import type { DailyDigestArchive } from "../../src/core/archive";

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

export interface UserPreferences {
  preferredThemes: string[];
  customTopics: string[];
}

export type FeedbackAction = "saved" | "skipped" | "later";

export interface FeedbackEvent {
  repo: string;
  date: string;
  action: FeedbackAction;
  theme?: string;
  recordedAt: string;
}

export interface FeedbackStateEntry {
  repo: string;
  date: string;
  action: FeedbackAction;
  theme?: string;
  recordedAt: string;
}

export interface FeedbackState {
  repoStates: Record<string, FeedbackStateEntry>;
  themeStats: Record<string, { saved: number; skipped: number }>;
  recent: FeedbackEvent[];
}

export interface ArchiveSummary {
  date: string;
  generatedAt: string;
  schemaVersion: number;
  rulesVersion: string;
  digestCount: number;
  title: string;
  editorialMode: string;
  topRepos: string[];
}

export async function fetchHealth(): Promise<{
  status: string;
  app: string;
  version: string;
  mode: string;
}> {
  return fetchJson("/api/health");
}

export async function fetchScheduleSettings(): Promise<{
  path: string;
  settings: ScheduleSettings;
  availableTimezones: TimezoneOption[];
}> {
  return fetchJson("/api/settings/schedule");
}

export async function saveScheduleSettings(draft: ScheduleSettings): Promise<{
  path: string;
  settings: ScheduleSettings;
  availableTimezones: TimezoneOption[];
}> {
  return fetchJson("/api/settings/schedule", {
    method: "PUT",
    body: JSON.stringify(draft),
  });
}

export async function fetchPreferences(): Promise<{
  path: string;
  preferences: UserPreferences;
  availableThemes: string[];
}> {
  return fetchJson("/api/settings/preferences");
}

export async function savePreferences(draft: UserPreferences): Promise<{
  path: string;
  preferences: UserPreferences;
  availableThemes: string[];
}> {
  return fetchJson("/api/settings/preferences", {
    method: "PUT",
    body: JSON.stringify(draft),
  });
}

export async function fetchFeedback(): Promise<{ state: FeedbackState }> {
  return fetchJson("/api/feedback");
}

export async function recordFeedback(input: {
  repo: string;
  date: string;
  action: FeedbackAction;
  theme?: string;
}): Promise<{ event: FeedbackEvent; state: FeedbackState }> {
  return fetchJson("/api/feedback", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function fetchArchives(): Promise<{ archives: ArchiveSummary[] }> {
  return fetchJson("/api/archives");
}

export async function fetchArchiveDetail(date: string): Promise<{
  archive: DailyDigestArchive;
  summary: ArchiveSummary;
}> {
  return fetchJson(`/api/archives/${date}`);
}

async function fetchJson<T>(input: string, init?: RequestInit): Promise<T> {
  const response = await fetch(input, {
    headers: {
      "content-type": "application/json",
      ...(init?.headers ?? {}),
    },
    ...init,
  });
  const payload = (await response.json()) as T | { message?: string };

  if (!response.ok) {
    throw new Error(
      (payload as { message?: string }).message ??
        "请求失败，请检查本地服务日志。",
    );
  }

  return payload as T;
}
