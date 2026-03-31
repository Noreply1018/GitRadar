import type { DailyDigestArchive } from "../../src/core/archive";

export type ScheduleTimezone =
  | "UTC"
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

export interface GitHubSettings {
  source: "github";
  readonly: boolean;
  configured: boolean;
  maskedToken: string | null;
  apiBaseUrl: string;
  trendingUrl: string;
  envFilePath: string;
  note?: string;
  mappedKeys?: string[];
  lastRunAt?: string | null;
  lastRunStatus?: "success" | "failure" | "unknown";
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

export interface ThemeInsight {
  theme: string;
  savedCount: number;
  skippedCount: number;
  netScore: number;
  reason: string;
}

export interface PreferenceSuggestion {
  theme: string;
  suggestedAction: "prefer";
  confidence: "medium" | "high";
  reason: string;
  sourceWindow: string;
}

export interface FeedbackInsights {
  interestedThemes: ThemeInsight[];
  skippedThemes: ThemeInsight[];
  preferenceSuggestion: PreferenceSuggestion | null;
}

export interface FeedbackListItem {
  repo: string;
  date: string;
  action: FeedbackAction;
  theme?: string;
  recordedAt: string;
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

export interface WecomSettings {
  source: "github";
  readonly: boolean;
  configured: boolean;
  maskedWebhookUrl: string | null;
  envFilePath: string;
  note?: string;
  mappedKeys?: string[];
  lastRunAt?: string | null;
  lastRunStatus?: "success" | "failure" | "unknown";
}

export interface LlmSettings {
  source: "github";
  readonly: boolean;
  configured: boolean;
  maskedApiKey: string | null;
  baseUrl: string | null;
  model: string | null;
  envFilePath: string;
  note?: string;
  mappedKeys?: string[];
  lastRunAt?: string | null;
  lastRunStatus?: "success" | "failure" | "unknown";
}

export interface EnvironmentFingerprints {
  github: {
    login: string;
    apiBaseUrl: string;
    lastValidatedAt: string;
  } | null;
  llm: {
    model: string;
    baseUrl: string;
    lastValidatedAt: string;
  } | null;
  wecom: {
    maskedWebhookUrl: string;
    lastValidatedAt: string;
  } | null;
}

export interface ArchiveReaderContext {
  editorialIntro: string[];
  preferenceSuggestion: PreferenceSuggestion | null;
  interestTrack: {
    interestedThemes: ThemeInsight[];
    skippedThemes: ThemeInsight[];
  };
  explorationRepo: string | null;
}

export async function fetchHealth(): Promise<{
  status: string;
  app: string;
  version: string;
  mode: string;
  source: "github";
  note?: string;
  lastRunAt?: string | null;
  lastRunStatus?: "success" | "failure" | "unknown";
  lastArchiveDate?: string | null;
  runUrl?: string | null;
}> {
  return fetchJson(`/api/health`);
}

export async function fetchScheduleSettings(): Promise<{
  source: "github";
  readonly: boolean;
  path: string;
  settings: ScheduleSettings;
  availableTimezones: TimezoneOption[];
  note?: string;
  cronExpression?: string;
  lastRunAt?: string | null;
  lastRunStatus?: "success" | "failure" | "unknown";
}> {
  return fetchJson(`/api/settings/schedule`);
}

export async function saveScheduleSettings(draft: ScheduleSettings): Promise<{
  source: "github";
  readonly: boolean;
  path: string;
  settings: ScheduleSettings;
  availableTimezones: TimezoneOption[];
  note?: string;
  cronExpression?: string;
  lastRunAt?: string | null;
  lastRunStatus?: "success" | "failure" | "unknown";
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

export async function fetchGitHubSettings(): Promise<GitHubSettings> {
  return fetchJson(`/api/settings/github`);
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

export async function fetchFeedback(): Promise<{
  state: FeedbackState;
  insights: FeedbackInsights;
}> {
  return fetchJson("/api/feedback");
}

export async function fetchFeedbackItems(action?: FeedbackAction): Promise<{
  items: FeedbackListItem[];
}> {
  const query = action ? `?action=${encodeURIComponent(action)}` : "";
  return fetchJson(`/api/feedback/items${query}`);
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

export async function acceptPreferenceSuggestion(theme: string): Promise<{
  preferences: UserPreferences;
  availableThemes: string[];
  insights: FeedbackInsights;
}> {
  return fetchJson(
    `/api/feedback/suggestions/${encodeURIComponent(theme)}/accept`,
    {
      method: "POST",
    },
  );
}

export async function fetchWecomSettings(): Promise<WecomSettings> {
  return fetchJson(`/api/settings/wecom`);
}

export async function fetchLlmSettings(): Promise<LlmSettings> {
  return fetchJson(`/api/settings/llm`);
}

export async function fetchEnvironmentFingerprints(): Promise<EnvironmentFingerprints> {
  return fetchJson(`/api/environment/fingerprints`);
}

export async function fetchArchiveDetail(date: string): Promise<{
  archive: DailyDigestArchive;
  summary: ArchiveSummary;
  readerContext: ArchiveReaderContext;
}> {
  return fetchJson(`/api/archives/${date}`);
}

export async function fetchArchives(): Promise<{ archives: ArchiveSummary[] }> {
  return fetchJson(`/api/archives`);
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
