import type { DailyDigestArchive } from "../../core/archive";
import type { DigestRulesConfig } from "../../config/digest-rules";
import type { UserPreferencesConfig } from "../../config/user-preferences";
import type {
  FeedbackAction,
  FeedbackEvent,
  FeedbackState,
} from "../../feedback/model";

export interface HealthResponse {
  status: "ok";
  app: "GitRadar";
  version: string;
  mode: "api-only" | "full-console";
}

export interface DigestRulesIssue {
  path: string;
  message: string;
}

export interface DigestRulesResponse {
  config: DigestRulesConfig;
  path: string;
}

export interface DigestRulesValidationResponse {
  valid: boolean;
  issues: DigestRulesIssue[];
}

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

export interface ScheduleSettingsResponse {
  path: string;
  settings: ScheduleSettings;
  availableTimezones: TimezoneOption[];
}

export interface UserPreferencesResponse {
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
}

export interface FeedbackRecordResponse {
  event: FeedbackEvent;
  state: FeedbackState;
}

export interface CommandStartRequest {
  date?: string;
}

export type CommandStatus = "queued" | "running" | "succeeded" | "failed";

export interface CommandJob {
  id: string;
  commandId:
    | "validate-digest-rules"
    | "generate-digest"
    | "generate-digest-send"
    | "analyze-digest"
    | "send-wecom-sample";
  command: string;
  status: CommandStatus;
  startedAt: string;
  finishedAt?: string;
  exitCode?: number;
  stdout: string;
  stderr: string;
}

export interface CommandListResponse {
  jobs: CommandJob[];
}

export interface CommandStartResponse {
  job: CommandJob;
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
}
