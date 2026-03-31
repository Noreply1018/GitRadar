import type { DailyDigestArchive } from "../../core/archive";
import type { DigestRulesConfig } from "../../config/digest-rules";
import type { UserPreferencesConfig } from "../../config/user-preferences";
import type {
  FeedbackAction,
  FeedbackEvent,
  FeedbackStateEntry,
  FeedbackState,
} from "../../feedback/model";

export interface HealthResponse {
  status: "ok" | "degraded" | "unknown";
  app: "GitRadar";
  version: string;
  source: "github";
  note?: string;
  lastRunAt?: string | null;
  lastRunStatus?: "success" | "failure" | "unknown";
  lastArchiveDate?: string | null;
  runUrl?: string | null;
}

export interface RemoteSyncMetadata {
  committed: boolean;
  commitSha?: string | null;
  targetRef?: string | null;
  pushed?: boolean;
  committedAt?: string | null;
}

export interface DigestRulesIssue {
  path: string;
  message: string;
}

export interface DigestRulesResponse extends RemoteSyncMetadata {
  config: DigestRulesConfig;
  path: string;
}

export interface DigestRulesValidationResponse {
  valid: boolean;
  issues: DigestRulesIssue[];
}

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

export interface ScheduleSettingsResponse extends RemoteSyncMetadata {
  source: "github";
  readonly: boolean;
  path: string;
  settings: ScheduleSettings;
  availableTimezones: TimezoneOption[];
  note?: string;
  cronExpression?: string;
  lastRunAt?: string | null;
  lastRunStatus?: "success" | "failure" | "unknown";
}

export interface UserPreferencesResponse extends RemoteSyncMetadata {
  path: string;
  preferences: UserPreferencesConfig;
  availableThemes: string[];
}

export interface FeedbackRequest {
  repo: string;
  date: string;
  action: FeedbackAction;
  theme?: string;
}

export interface FeedbackResponse {
  state: FeedbackState;
  insights: FeedbackInsights;
}

export interface FeedbackRecordResponse extends RemoteSyncMetadata {
  event: FeedbackEvent;
  state: FeedbackState;
}

export interface FeedbackListItem extends FeedbackStateEntry {}

export interface FeedbackItemsResponse {
  items: FeedbackListItem[];
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

export interface FeedbackSuggestionAcceptResponse {
  committed: boolean;
  commitSha?: string | null;
  targetRef?: string | null;
  pushed?: boolean;
  committedAt?: string | null;
  preferences: UserPreferencesConfig;
  availableThemes: string[];
  insights: FeedbackInsights;
}

export interface WecomSettingsResponse {
  source: "github";
  readonly: boolean;
  configured: boolean;
  maskedWebhookUrl: string | null;
  managedIn: string;
  note?: string;
  mappedKeys?: string[];
  lastRunAt?: string | null;
  lastRunStatus?: "success" | "failure" | "unknown";
}

export interface GitHubSettingsResponse {
  source: "github";
  readonly: boolean;
  configured: boolean;
  maskedToken: string | null;
  apiBaseUrl: string;
  trendingUrl: string;
  managedIn: string;
  note?: string;
  mappedKeys?: string[];
  lastRunAt?: string | null;
  lastRunStatus?: "success" | "failure" | "unknown";
}

export interface LlmSettingsResponse {
  source: "github";
  readonly: boolean;
  configured: boolean;
  maskedApiKey: string | null;
  baseUrl: string | null;
  model: string | null;
  managedIn: string;
  note?: string;
  mappedKeys?: string[];
  lastRunAt?: string | null;
  lastRunStatus?: "success" | "failure" | "unknown";
}

export interface GitHubFingerprint {
  login: string;
  apiBaseUrl: string;
  lastValidatedAt: string;
}

export interface LlmFingerprint {
  model: string;
  baseUrl: string;
  lastValidatedAt: string;
}

export interface WecomFingerprint {
  maskedWebhookUrl: string;
  lastValidatedAt: string;
}

export interface EnvironmentFingerprintResponse {
  github: GitHubFingerprint | null;
  llm: LlmFingerprint | null;
  wecom: WecomFingerprint | null;
}

export interface GitHubExecutionState {
  source: "github";
  workflowName: string;
  trigger: string | null;
  lastRunAt: string | null;
  lastRunStatus: "success" | "failure" | "unknown";
  lastArchiveDate: string | null;
  runUrl: string | null;
  ref: string;
}

export interface GitHubModeSettingsResponse {
  source: "github";
  workflowName: string;
  trigger: string | null;
  lastRunAt: string | null;
  lastRunStatus: "success" | "failure" | "unknown";
  lastArchiveDate: string | null;
  runUrl: string | null;
  cronExpression: string;
  timezone: ScheduleTimezone;
  mappedSecrets: string[];
}

export interface LlmTestResponse {
  ok: true;
  message: string;
  model: string;
  baseUrl: string;
}

export interface GitHubTestResponse {
  ok: true;
  message: string;
  login: string;
  apiBaseUrl: string;
}

export interface WecomTestResponse {
  ok: true;
  message: string;
  maskedWebhookUrl: string;
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

export interface ArchiveListResponse {
  archives: ArchiveSummary[];
}

export interface ArchiveDetailResponse {
  archive: DailyDigestArchive;
  summary: ArchiveSummary;
  readerContext: ArchiveReaderContext;
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
