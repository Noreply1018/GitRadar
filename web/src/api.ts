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

export interface GitHubSettings {
  configured: boolean;
  maskedToken: string | null;
  apiBaseUrl: string;
  trendingUrl: string;
  envFilePath: string;
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
  configured: boolean;
  maskedWebhookUrl: string | null;
  envFilePath: string;
}

export interface LlmSettings {
  configured: boolean;
  maskedApiKey: string | null;
  baseUrl: string | null;
  model: string | null;
  envFilePath: string;
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

export async function fetchGitHubSettings(): Promise<GitHubSettings> {
  return fetchJson("/api/settings/github");
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

export async function fetchFeedback(): Promise<{ state: FeedbackState }> {
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

export async function fetchArchives(): Promise<{ archives: ArchiveSummary[] }> {
  return fetchJson("/api/archives");
}

export async function fetchWecomSettings(): Promise<WecomSettings> {
  return fetchJson("/api/settings/wecom");
}

export async function fetchLlmSettings(): Promise<LlmSettings> {
  return fetchJson("/api/settings/llm");
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
