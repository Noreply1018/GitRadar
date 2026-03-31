import type { DailyDigestArchive } from "../../src/core/archive";

export type ScheduleTimezone =
  | "UTC"
  | "Asia/Shanghai"
  | "Asia/Tokyo"
  | "Europe/Berlin"
  | "Europe/London"
  | "America/New_York"
  | "America/Los_Angeles";

export type RuntimeSource = "github" | "local";

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
  source: RuntimeSource;
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
  source: RuntimeSource;
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
  source: RuntimeSource;
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

export interface WecomTestResult {
  ok: true;
  message: string;
  maskedWebhookUrl: string;
}

export interface LlmTestResult {
  ok: true;
  message: string;
  model: string;
  baseUrl: string;
}

export interface GitHubTestResult {
  ok: true;
  message: string;
  login: string;
  apiBaseUrl: string;
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

export async function fetchHealth(source: RuntimeSource): Promise<{
  status: string;
  app: string;
  version: string;
  mode: string;
  source: RuntimeSource;
  note?: string;
  lastRunAt?: string | null;
  lastRunStatus?: "success" | "failure" | "unknown";
  lastArchiveDate?: string | null;
  runUrl?: string | null;
}> {
  return fetchJson(`/api/health?source=${encodeURIComponent(source)}`);
}

export async function fetchScheduleSettings(source: RuntimeSource): Promise<{
  source: RuntimeSource;
  readonly: boolean;
  path: string;
  settings: ScheduleSettings;
  availableTimezones: TimezoneOption[];
  note?: string;
  cronExpression?: string;
  lastRunAt?: string | null;
  lastRunStatus?: "success" | "failure" | "unknown";
}> {
  return fetchJson(
    `/api/settings/schedule?source=${encodeURIComponent(source)}`,
  );
}

export async function saveScheduleSettings(draft: ScheduleSettings): Promise<{
  source: RuntimeSource;
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

export async function fetchGitHubSettings(
  source: RuntimeSource,
): Promise<GitHubSettings> {
  return fetchJson(`/api/settings/github?source=${encodeURIComponent(source)}`);
}

export async function saveGitHubSettings(input: {
  token?: string;
}): Promise<GitHubSettings> {
  return fetchJson("/api/settings/github", {
    method: "PUT",
    body: JSON.stringify(input),
  });
}

export async function testGitHubSettings(): Promise<GitHubTestResult> {
  return fetchJson("/api/settings/github/test", {
    method: "POST",
  });
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

export async function fetchWecomSettings(
  source: RuntimeSource,
): Promise<WecomSettings> {
  return fetchJson(`/api/settings/wecom?source=${encodeURIComponent(source)}`);
}

export async function fetchLlmSettings(
  source: RuntimeSource,
): Promise<LlmSettings> {
  return fetchJson(`/api/settings/llm?source=${encodeURIComponent(source)}`);
}

export async function fetchEnvironmentFingerprints(
  source: RuntimeSource,
): Promise<EnvironmentFingerprints> {
  return fetchJson(
    `/api/environment/fingerprints?source=${encodeURIComponent(source)}`,
  );
}

export async function saveLlmSettings(input: {
  apiKey?: string;
  baseUrl: string;
  model: string;
}): Promise<LlmSettings> {
  return fetchJson("/api/settings/llm", {
    method: "PUT",
    body: JSON.stringify(input),
  });
}

export async function testLlmSettings(): Promise<LlmTestResult> {
  return fetchJson("/api/settings/llm/test", {
    method: "POST",
  });
}

export async function saveWecomSettings(input: {
  webhookUrl: string;
}): Promise<WecomSettings> {
  return fetchJson("/api/settings/wecom", {
    method: "PUT",
    body: JSON.stringify(input),
  });
}

export async function sendWecomTest(): Promise<WecomTestResult> {
  return fetchJson("/api/settings/wecom/test", {
    method: "POST",
  });
}

export async function fetchArchiveDetail(
  date: string,
  source: RuntimeSource,
): Promise<{
  archive: DailyDigestArchive;
  summary: ArchiveSummary;
  readerContext: ArchiveReaderContext;
}> {
  return fetchJson(
    `/api/archives/${date}?source=${encodeURIComponent(source)}`,
  );
}

export async function fetchArchives(
  source: RuntimeSource,
): Promise<{ archives: ArchiveSummary[] }> {
  return fetchJson(`/api/archives?source=${encodeURIComponent(source)}`);
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
