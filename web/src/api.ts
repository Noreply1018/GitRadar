import type { DailyDigestArchive } from "../../src/core/archive";
import type {
  EnvironmentCheckStatus,
  EnvironmentReport,
} from "../../src/core/environment-report";
import {
  SCHEDULE_TIMEZONE_OPTIONS,
  type ScheduleSettings,
  type ScheduleTimezone,
  type TimezoneOption,
} from "../../src/core/schedule";

export type {
  ScheduleSettings,
  ScheduleTimezone,
  TimezoneOption,
} from "../../src/core/schedule";

export interface UserPreferences {
  preferredThemes: string[];
  customTopics: string[];
}

export type DispatchWriteOperation =
  | "update_digest_rules"
  | "update_schedule"
  | "update_preferences"
  | "record_feedback";

export interface RemoteSyncMetadata {
  mode: "workflow_dispatch";
  requestAccepted: boolean;
  workflowUrl: string;
  requestId: string;
  requestedAt: string;
  branch: string;
}

export interface GitHubExecution {
  status: "success" | "failure" | "unknown";
  lastRunAt: string | null;
  runUrl: string | null;
}

export interface EnvironmentStatusSummary {
  status: EnvironmentCheckStatus;
  checkedAt: string | null;
  detail: string;
}

export interface GitHubSettings {
  source: "github";
  readonly: boolean;
  configured: boolean;
  maskedToken: string | null;
  apiBaseUrl: string;
  trendingUrl: string;
  managedIn: string;
  note?: string;
  mappedKeys?: string[];
  execution: GitHubExecution;
  environment: EnvironmentStatusSummary & {
    login: string | null;
  };
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
  managedIn: string;
  note?: string;
  mappedKeys?: string[];
  execution: GitHubExecution;
  environment: EnvironmentStatusSummary & {
    maskedWebhookUrl: string | null;
  };
}

export interface LlmSettings {
  source: "github";
  readonly: boolean;
  configured: boolean;
  maskedApiKey: string | null;
  baseUrl: string | null;
  model: string | null;
  managedIn: string;
  note?: string;
  mappedKeys?: string[];
  execution: GitHubExecution;
  environment: EnvironmentStatusSummary & {
    model: string | null;
    baseUrl: string | null;
  };
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

export interface GitHubAuthSession {
  token: string | null;
  login: string | null;
}

interface GitHubRepoContext {
  owner: string;
  repo: string;
  branch: string;
  apiBaseUrl: string;
  actionsBaseUrl: string;
}

interface GitHubRuntimeState {
  source: "github";
  workflowName: string;
  trigger: string | null;
  lastRunAt: string | null;
  lastRunStatus: "success" | "failure" | "unknown";
  lastArchiveDate: string | null;
  runUrl: string | null;
  ref: string;
}

interface DigestRulesConfig {
  version: string;
  themes: Array<{ theme: string }>;
}

const STORAGE_KEY = "gitradar.github.pat";
const DEFAULT_OWNER = import.meta.env.VITE_GITRADAR_REPO_OWNER ?? "Noreply1018";
const DEFAULT_REPO = import.meta.env.VITE_GITRADAR_REPO_NAME ?? "GitRadar";
const DEFAULT_BRANCH = import.meta.env.VITE_GITRADAR_REPO_BRANCH ?? "main";
const DEFAULT_API_BASE_URL =
  import.meta.env.VITE_GITRADAR_API_BASE_URL ?? "https://api.github.com";
const DEFAULT_TRENDING_URL = "https://github.com/trending?since=daily";
const WORKFLOW_ID = "console-writeback.yml";

export function getGitHubRepoContext(): GitHubRepoContext {
  const ownerFromHost = window.location.hostname.endsWith(".github.io")
    ? window.location.hostname.split(".")[0] || DEFAULT_OWNER
    : DEFAULT_OWNER;
  const repoFromPath = window.location.hostname.endsWith(".github.io")
    ? window.location.pathname.split("/").filter(Boolean)[0] || DEFAULT_REPO
    : DEFAULT_REPO;

  return {
    owner: ownerFromHost,
    repo: repoFromPath,
    branch: DEFAULT_BRANCH,
    apiBaseUrl: DEFAULT_API_BASE_URL,
    actionsBaseUrl: `https://github.com/${ownerFromHost}/${repoFromPath}/actions/workflows/${WORKFLOW_ID}`,
  };
}

export function getGitHubAuthSession(): GitHubAuthSession {
  const token = window.localStorage.getItem(STORAGE_KEY);
  return {
    token,
    login: null,
  };
}

export function saveGitHubPat(token: string): void {
  window.localStorage.setItem(STORAGE_KEY, token.trim());
}

export function clearGitHubPat(): void {
  window.localStorage.removeItem(STORAGE_KEY);
}

export async function validateGitHubPat(): Promise<{ login: string }> {
  const token = requirePat();
  return githubRequest<{ login: string }>("/user", { token });
}

export async function fetchHealth(): Promise<{
  status: string;
  app: string;
  version: string;
  source: "github";
  note?: string;
  lastRunAt?: string | null;
  lastRunStatus?: "success" | "failure" | "unknown";
  lastArchiveDate?: string | null;
  runUrl?: string | null;
}> {
  const [runtime, pkg] = await Promise.all([
    readRuntimeState(),
    readRepoJson<{ version?: string }>("package.json", {
      version: "3.0.0",
    }),
  ]);

  return {
    status:
      runtime.lastRunStatus === "success"
        ? "ok"
        : runtime.lastRunStatus === "failure"
          ? "degraded"
          : "unknown",
    app: "GitRadar",
    version: pkg.version ?? "3.0.0",
    source: "github",
    note:
      runtime.lastRunStatus === "success"
        ? "当前展示的是 GitHub 正式归档与运行结果。"
        : runtime.lastRunStatus === "failure"
          ? "最近一次正式运行失败，请优先查看 GitHub Actions 日志。"
          : "当前还没有 GitHub 正式 runtime 记录。",
    lastRunAt: runtime.lastRunAt,
    lastRunStatus: runtime.lastRunStatus,
    lastArchiveDate: runtime.lastArchiveDate,
    runUrl: runtime.runUrl,
  };
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
  const [runtime, settings] = await Promise.all([
    readRuntimeState(),
    readRepoJson<ScheduleSettings>("config/schedule.json", {
      timezone: "Asia/Shanghai",
      dailySendTime: "08:17",
    }),
  ]);

  return {
    source: "github",
    readonly: false,
    path: "config/schedule.json",
    settings,
    availableTimezones: [...TIMEZONE_OPTIONS],
    note: "正式调度由 config/schedule.json 驱动；保存操作会通过 GitHub Actions 创建 PR。",
    cronExpression: `*/5 * * * * (polling) / ${toCron(
      settings.dailySendTime,
    )} (target)`,
    lastRunAt: runtime.lastRunAt,
    lastRunStatus: runtime.lastRunStatus,
  };
}

export async function saveScheduleSettings(draft: ScheduleSettings): Promise<
  {
    source: "github";
    readonly: boolean;
    path: string;
    settings: ScheduleSettings;
    availableTimezones: TimezoneOption[];
    note?: string;
    cronExpression?: string;
    lastRunAt?: string | null;
    lastRunStatus?: "success" | "failure" | "unknown";
  } & RemoteSyncMetadata
> {
  const response = await dispatchWriteback("update_schedule", draft);
  const runtime = await readRuntimeState();

  return {
    source: "github",
    readonly: false,
    path: "config/schedule.json",
    settings: draft,
    availableTimezones: [...TIMEZONE_OPTIONS],
    note: "已提交 GitHub Actions 写入请求，将自动创建 PR。",
    cronExpression: `*/5 * * * * (polling) / ${toCron(
      draft.dailySendTime,
    )} (target)`,
    lastRunAt: runtime.lastRunAt,
    lastRunStatus: runtime.lastRunStatus,
    ...response,
  };
}

export async function fetchPreferences(): Promise<{
  path: string;
  preferences: UserPreferences;
  availableThemes: string[];
}> {
  const [preferences, digestRules] = await Promise.all([
    readRepoJson<UserPreferences>("config/user-preferences.json", {
      preferredThemes: [],
      customTopics: [],
    }),
    readRepoJson<DigestRulesConfig>("config/digest-rules.json", {
      version: "current",
      themes: [],
    }),
  ]);

  return {
    path: "config/user-preferences.json",
    preferences,
    availableThemes: digestRules.themes.map((item) => item.theme),
  };
}

export async function fetchGitHubSettings(): Promise<GitHubSettings> {
  const [runtime, report] = await Promise.all([
    readRuntimeState(),
    readEnvironmentReport(),
  ]);

  return {
    source: "github",
    readonly: true,
    configured: report.github.status === "configured",
    maskedToken: "由 GitHub PAT 或 GitHub Actions Secret 管理",
    apiBaseUrl: DEFAULT_API_BASE_URL,
    trendingUrl: DEFAULT_TRENDING_URL,
    managedIn: ".github/workflows/console-writeback.yml",
    note: "读取可走公开仓库内容；正式写入需要在控制台提供细粒度 PAT，然后通过 workflow dispatch 创建 PR。",
    mappedKeys: ["GITRADAR_GITHUB_TOKEN"],
    execution: {
      status: runtime.lastRunStatus,
      lastRunAt: runtime.lastRunAt,
      runUrl: runtime.runUrl,
    },
    environment: {
      status: report.github.status,
      checkedAt: report.github.checkedAt,
      detail: report.github.detail,
      login: report.github.login,
    },
  };
}

export async function savePreferences(draft: UserPreferences): Promise<
  {
    path: string;
    preferences: UserPreferences;
    availableThemes: string[];
  } & RemoteSyncMetadata
> {
  const [response, digestRules] = await Promise.all([
    dispatchWriteback("update_preferences", draft),
    readRepoJson<DigestRulesConfig>("config/digest-rules.json", {
      version: "current",
      themes: [],
    }),
  ]);

  return {
    path: "config/user-preferences.json",
    preferences: draft,
    availableThemes: digestRules.themes.map((item) => item.theme),
    ...response,
  };
}

export async function fetchFeedback(): Promise<{
  state: FeedbackState;
  insights: FeedbackInsights;
}> {
  const [state, preferences] = await Promise.all([
    readRepoJson<FeedbackState>("data/feedback/feedback-state.json", {
      repoStates: {},
      themeStats: {},
      recent: [],
    }),
    fetchPreferences(),
  ]);

  return {
    state,
    insights: buildFeedbackInsights(state, preferences.preferences),
  };
}

export async function fetchFeedbackItems(action?: FeedbackAction): Promise<{
  items: FeedbackListItem[];
}> {
  const feedback = await fetchFeedback();
  return {
    items: Object.values(feedback.state.repoStates)
      .filter((item) => !action || item.action === action)
      .sort((left, right) => right.recordedAt.localeCompare(left.recordedAt)),
  };
}

export async function recordFeedback(input: {
  repo: string;
  date: string;
  action: FeedbackAction;
  theme?: string;
}): Promise<{ event: FeedbackEvent } & RemoteSyncMetadata> {
  const event: FeedbackEvent = {
    ...input,
    recordedAt: new Date().toISOString(),
  };
  const response = await dispatchWriteback("record_feedback", input);
  return {
    event,
    ...response,
  };
}

export async function acceptPreferenceSuggestion(theme: string): Promise<
  {
    preferences: UserPreferences;
    availableThemes: string[];
    insights: FeedbackInsights;
  } & RemoteSyncMetadata
> {
  const current = await fetchPreferences();
  const nextPreferences = {
    ...current.preferences,
    preferredThemes: Array.from(
      new Set([...current.preferences.preferredThemes, theme]),
    ),
  };
  const response = await savePreferences(nextPreferences);
  const feedback = await fetchFeedback();

  return {
    ...response,
    preferences: nextPreferences,
    availableThemes: current.availableThemes,
    insights: feedback.insights,
  };
}

export async function fetchWecomSettings(): Promise<WecomSettings> {
  const [runtime, report] = await Promise.all([
    readRuntimeState(),
    readEnvironmentReport(),
  ]);

  return {
    source: "github",
    readonly: true,
    configured: report.wecom.status === "configured",
    maskedWebhookUrl: report.wecom.maskedWebhookUrl,
    managedIn: ".github/workflows/environment-diagnose.yml",
    note: "企业微信配置由 GitHub Secrets 管理；控制台显示最近环境诊断结果。",
    mappedKeys: ["GITRADAR_WECOM_WEBHOOK_URL"],
    execution: {
      status: runtime.lastRunStatus,
      lastRunAt: runtime.lastRunAt,
      runUrl: runtime.runUrl,
    },
    environment: {
      status: report.wecom.status,
      checkedAt: report.wecom.checkedAt,
      detail: report.wecom.detail,
      maskedWebhookUrl: report.wecom.maskedWebhookUrl,
    },
  };
}

export async function fetchLlmSettings(): Promise<LlmSettings> {
  const [runtime, report] = await Promise.all([
    readRuntimeState(),
    readEnvironmentReport(),
  ]);

  return {
    source: "github",
    readonly: true,
    configured: report.llm.status === "configured",
    maskedApiKey: "由 GitHub Secrets 管理",
    baseUrl: report.llm.baseUrl,
    model: report.llm.model,
    managedIn: ".github/workflows/environment-diagnose.yml",
    note: "LLM 配置由 GitHub Secrets 管理；控制台显示最近环境诊断结果。",
    mappedKeys: ["GR_API_KEY", "GR_BASE_URL", "GR_MODEL"],
    execution: {
      status: runtime.lastRunStatus,
      lastRunAt: runtime.lastRunAt,
      runUrl: runtime.runUrl,
    },
    environment: {
      status: report.llm.status,
      checkedAt: report.llm.checkedAt,
      detail: report.llm.detail,
      model: report.llm.model,
      baseUrl: report.llm.baseUrl,
    },
  };
}

export async function fetchEnvironmentFingerprints(): Promise<EnvironmentFingerprints> {
  const report = await readEnvironmentReport();
  return {
    github:
      report.github.status === "configured" && report.github.login
        ? {
            login: report.github.login,
            apiBaseUrl: report.github.apiBaseUrl,
            lastValidatedAt:
              report.github.checkedAt ?? new Date().toISOString(),
          }
        : null,
    llm:
      report.llm.status === "configured" &&
      report.llm.model &&
      report.llm.baseUrl
        ? {
            model: report.llm.model,
            baseUrl: report.llm.baseUrl,
            lastValidatedAt: report.llm.checkedAt ?? new Date().toISOString(),
          }
        : null,
    wecom:
      report.wecom.status === "configured" && report.wecom.maskedWebhookUrl
        ? {
            maskedWebhookUrl: report.wecom.maskedWebhookUrl,
            lastValidatedAt: report.wecom.checkedAt ?? new Date().toISOString(),
          }
        : null,
  };
}

export async function fetchArchiveDetail(date: string): Promise<{
  archive: DailyDigestArchive;
  summary: ArchiveSummary;
  readerContext: ArchiveReaderContext;
}> {
  const [archive, feedback, preferences] = await Promise.all([
    readRepoJson<DailyDigestArchive>(`data/history/${date}.json`),
    fetchFeedback(),
    fetchPreferences(),
  ]);
  const insights = buildFeedbackInsights(
    feedback.state,
    preferences.preferences,
  );
  const summary = buildArchiveSummary(archive);

  return {
    archive,
    summary,
    readerContext: {
      editorialIntro: [
        `今日候选总数 ${archive.candidateCount}，最终保留 ${archive.digest.items.length} 条。`,
        `规则版本 ${summary.rulesVersion}，编辑模式 ${summary.editorialMode}。`,
      ],
      preferenceSuggestion: insights.preferenceSuggestion,
      interestTrack: {
        interestedThemes: insights.interestedThemes,
        skippedThemes: insights.skippedThemes,
      },
      explorationRepo:
        archive.digest.items.find((item) => item.readerTag === "exploration")
          ?.repo ?? null,
    },
  };
}

export async function fetchArchives(): Promise<{ archives: ArchiveSummary[] }> {
  const context = getGitHubRepoContext();
  const listing = await githubRequest<Array<{ name: string; type: string }>>(
    `/repos/${context.owner}/${context.repo}/contents/data/history`,
    {
      token: getGitHubAuthSession().token,
      query: { ref: context.branch },
    },
  ).catch(() => [] as Array<{ name: string; type: string }>);

  const files = listing
    .filter(
      (entry) =>
        entry.type === "file" && /^\d{4}-\d{2}-\d{2}\.json$/.test(entry.name),
    )
    .map((entry) => entry.name.replace(/\.json$/, ""))
    .sort((left, right) => right.localeCompare(left));

  const archives = await Promise.all(
    files.map(async (date) =>
      buildArchiveSummary(
        await readRepoJson<DailyDigestArchive>(`data/history/${date}.json`),
      ),
    ),
  );

  return { archives };
}

function buildArchiveSummary(archive: DailyDigestArchive): ArchiveSummary {
  return {
    date: archive.digest.date,
    generatedAt: archive.generatedAt,
    schemaVersion: archive.schemaVersion,
    rulesVersion: archive.generationMeta.rulesVersion,
    digestCount: archive.digest.items.length,
    title: archive.digest.title,
    editorialMode: archive.generationMeta.editorialMode ?? "unknown",
    topRepos: archive.digest.items.slice(0, 3).map((item) => item.repo),
  };
}

function buildFeedbackInsights(
  state: FeedbackState,
  preferences: UserPreferences,
): FeedbackInsights {
  const themeStats = Object.entries(state.themeStats).map(([theme, stats]) => ({
    theme,
    savedCount: stats.saved,
    skippedCount: stats.skipped,
    netScore: stats.saved - stats.skipped,
    reason: `最近保存 ${stats.saved} 次，跳过 ${stats.skipped} 次。`,
  }));
  const interestedThemes = themeStats
    .filter((item) => item.netScore > 0)
    .sort((left, right) => right.netScore - left.netScore)
    .slice(0, 3);
  const skippedThemes = themeStats
    .filter((item) => item.skippedCount > item.savedCount)
    .sort((left, right) => right.skippedCount - left.skippedCount)
    .slice(0, 3);
  const suggestion = interestedThemes.find(
    (item) => !preferences.preferredThemes.includes(item.theme),
  );

  return {
    interestedThemes,
    skippedThemes,
    preferenceSuggestion: suggestion
      ? {
          theme: suggestion.theme,
          suggestedAction: "prefer",
          confidence: suggestion.savedCount >= 2 ? "high" : "medium",
          reason: suggestion.reason,
          sourceWindow: "基于近期正式反馈聚合结果。",
        }
      : null,
  };
}

async function readRuntimeState(): Promise<GitHubRuntimeState> {
  return readRepoJson<GitHubRuntimeState>("data/runtime/github-runtime.json", {
    source: "github",
    workflowName: "Daily Digest",
    trigger: null,
    lastRunAt: null,
    lastRunStatus: "unknown",
    lastArchiveDate: null,
    runUrl: null,
    ref: DEFAULT_BRANCH,
  });
}

async function readEnvironmentReport(): Promise<EnvironmentReport> {
  return readRepoJson<EnvironmentReport>(
    "data/runtime/environment-report.json",
    {
      source: "github",
      github: {
        status: "unknown",
        checkedAt: null,
        detail: "GitHub 环境尚未诊断。",
        login: null,
        apiBaseUrl: DEFAULT_API_BASE_URL,
      },
      llm: {
        status: "unknown",
        checkedAt: null,
        detail: "LLM 环境尚未诊断。",
        model: null,
        baseUrl: null,
      },
      wecom: {
        status: "unknown",
        checkedAt: null,
        detail: "企业微信环境尚未诊断。",
        maskedWebhookUrl: null,
      },
    },
  );
}

async function dispatchWriteback(
  operation: DispatchWriteOperation,
  payload: unknown,
): Promise<RemoteSyncMetadata> {
  const token = requirePat();
  const context = getGitHubRepoContext();
  const viewer = await validateGitHubPat();
  const requestId = createRequestId();
  const requestedAt = new Date().toISOString();

  await githubRequest<void>(
    `/repos/${context.owner}/${context.repo}/actions/workflows/${WORKFLOW_ID}/dispatches`,
    {
      token,
      method: "POST",
      body: {
        ref: context.branch,
        inputs: {
          operation,
          payload_base64: encodePayload(payload),
          request_id: requestId,
          requested_by: viewer.login,
        },
      },
      allowEmpty: true,
    },
  );

  return {
    mode: "workflow_dispatch",
    requestAccepted: true,
    workflowUrl: context.actionsBaseUrl,
    requestId,
    requestedAt,
    branch: context.branch,
  };
}

async function readRepoJson<T>(repoPath: string, fallback?: T): Promise<T> {
  const context = getGitHubRepoContext();
  const response = await githubRequest<
    { content: string; encoding: string } | Array<unknown>
  >(`/repos/${context.owner}/${context.repo}/contents/${repoPath}`, {
    token: getGitHubAuthSession().token,
    query: { ref: context.branch },
  }).catch((error) => {
    if (fallback !== undefined) {
      return null;
    }

    throw error;
  });

  if (!response) {
    return fallback as T;
  }

  if (Array.isArray(response)) {
    return response as T;
  }

  if (response.encoding !== "base64") {
    throw new Error(`GitHub contents encoding for ${repoPath} is unsupported.`);
  }

  return JSON.parse(window.atob(response.content.replace(/\n/g, ""))) as T;
}

async function githubRequest<T>(
  pathname: string,
  options: {
    token?: string | null;
    method?: "GET" | "POST";
    query?: Record<string, string | undefined>;
    body?: unknown;
    allowEmpty?: boolean;
  } = {},
): Promise<T> {
  const context = getGitHubRepoContext();
  const url = new URL(`${context.apiBaseUrl}${pathname}`);
  for (const [key, value] of Object.entries(options.query ?? {})) {
    if (value) {
      url.searchParams.set(key, value);
    }
  }

  const response = await fetch(url, {
    method: options.method ?? "GET",
    headers: {
      accept: "application/vnd.github+json",
      ...(options.body ? { "content-type": "application/json" } : {}),
      ...(options.token ? { authorization: `Bearer ${options.token}` } : {}),
      "x-github-api-version": "2022-11-28",
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as {
      message?: string;
    } | null;
    throw new Error(
      payload?.message ?? `GitHub 请求失败，状态码 ${response.status}。`,
    );
  }

  if (options.allowEmpty) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

function requirePat(): string {
  const token = getGitHubAuthSession().token?.trim();
  if (!token) {
    throw new Error(
      "当前未配置 GitHub PAT。请先在控制台填入细粒度 PAT，再触发正式写入请求。",
    );
  }

  return token;
}

function encodePayload(payload: unknown): string {
  return window.btoa(unescape(encodeURIComponent(JSON.stringify(payload))));
}

function createRequestId(): string {
  return `req-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function toCron(time: string): string {
  const [hour = "0", minute = "0"] = time.split(":");
  return `${Number(minute)} ${Number(hour)} * * *`;
}

const TIMEZONE_OPTIONS: TimezoneOption[] = [...SCHEDULE_TIMEZONE_OPTIONS];
