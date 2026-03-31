import { execFile } from "node:child_process";
import { readdir, readFile } from "node:fs/promises";
import { promisify } from "node:util";
import path from "node:path";

import { parseDailyDigestArchive } from "../../core/archive";
import {
  getGitHubExecutionStateRepoPath,
  normalizeExecutionState,
} from "../../core/github-execution-state";
import { buildFeedbackInsights } from "../../feedback/insights";
import { readRemoteFeedbackState } from "../../feedback/store";
import { buildArchiveSummary } from "./archive-service";
import {
  convertDailySendTimeToCron,
  readScheduleSettings,
} from "./schedule-service";
import { readRemoteUserPreferences } from "./user-preferences-service";
import type {
  ArchiveDetailResponse,
  ArchiveListResponse,
  ArchiveSummary,
  EnvironmentFingerprintResponse,
  GitHubExecutionState,
  GitHubModeSettingsResponse,
  GitHubSettingsResponse,
  HealthResponse,
  LlmSettingsResponse,
  ScheduleSettingsResponse,
  WecomSettingsResponse,
} from "../types/api";

const execFileAsync = promisify(execFile);
const DEFAULT_OWNER = "Noreply1018";
const DEFAULT_REPO = "GitRadar";
const DEFAULT_BRANCH = "main";
const GITHUB_HISTORY_DIR = "data/history";
const REMOTE_SYNC_TTL_MS = 30_000;
const LOCAL_FILESYSTEM_REF = "__local_filesystem__";

let remoteSyncPromise: Promise<void> | null = null;
let lastRemoteSyncAt = 0;

interface RepoRef {
  owner: string;
  repo: string;
  branch: string;
}

interface GitHubWorkflowSummary {
  cronExpression: string;
  triggerIntervalMinutes: number;
}

export async function readGitHubModeHealth(
  rootDir: string,
  packageVersion: string,
): Promise<HealthResponse> {
  const state = await readGitHubExecutionState(rootDir);

  return {
    status:
      state.lastRunStatus === "success"
        ? "ok"
        : state.lastRunStatus === "failure"
          ? "degraded"
          : "unknown",
    app: "GitRadar",
    version: packageVersion,
    source: "github",
    note:
      state.lastRunStatus === "success"
        ? "当前展示的是 GitHub 远端正式运行结果。"
        : state.lastRunStatus === "failure"
          ? "当前展示的是 GitHub 远端正式状态；最近一次正式运行失败，请优先查看该次工作流日志。"
          : "当前还没有 GitHub 远端正式 runtime 记录；首次成功运行后这里会显示正式状态。",
    lastRunAt: state.lastRunAt,
    lastRunStatus: state.lastRunStatus,
    lastArchiveDate: state.lastArchiveDate,
    runUrl: state.runUrl,
  };
}

export async function listGitHubArchiveSummaries(
  rootDir: string,
): Promise<ArchiveListResponse> {
  await resolveRepoRef(rootDir);
  const entries = await fetchGitHubDirectory(rootDir, GITHUB_HISTORY_DIR);
  const archiveEntries = entries
    .filter((entry) => /^\d{4}-\d{2}-\d{2}\.json$/.test(path.basename(entry)))
    .sort((left, right) => right.localeCompare(left));

  const archives: ArchiveSummary[] = [];

  for (const entry of archiveEntries) {
    const fileName = path.basename(entry);
    const raw = await fetchRepoFile(
      rootDir,
      `${GITHUB_HISTORY_DIR}/${fileName}`,
    );
    const parsed = parseDailyDigestArchive(
      JSON.parse(raw),
      `GitHub archive ${fileName}`,
    );
    archives.push(buildArchiveSummary(parsed));
  }

  return { archives };
}

export async function getGitHubArchiveDetail(
  rootDir: string,
  date: string,
): Promise<ArchiveDetailResponse> {
  await resolveRepoRef(rootDir);
  const raw = await fetchRepoFile(
    rootDir,
    `${GITHUB_HISTORY_DIR}/${date}.json`,
  );
  const archive = parseDailyDigestArchive(
    JSON.parse(raw),
    `GitHub archive ${date}`,
  );
  const feedbackState = await readRemoteFeedbackState(rootDir);
  const preferences = await readRemoteUserPreferences(rootDir);
  const insights = buildFeedbackInsights(
    feedbackState,
    preferences.preferences,
  );

  return {
    archive,
    summary: buildArchiveSummary(archive),
    readerContext: {
      editorialIntro: buildGitHubEditorialIntro(archive),
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

export async function readGitHubExecutionState(
  rootDir: string,
): Promise<GitHubExecutionState> {
  const repo = await resolveRepoRef(rootDir);

  try {
    const raw = await fetchRepoFile(rootDir, getGitHubExecutionStateRepoPath());
    return normalizeExecutionState(JSON.parse(raw));
  } catch {
    return {
      source: "github",
      workflowName: "Daily Digest",
      trigger: null,
      lastRunAt: null,
      lastRunStatus: "unknown",
      lastArchiveDate: null,
      runUrl: null,
      ref: repo.branch,
    };
  }
}

export async function readGitHubModeSchedule(
  rootDir: string,
): Promise<ScheduleSettingsResponse> {
  const workflow = await readGitHubWorkflowSummary(rootDir);
  const state = await readGitHubExecutionState(rootDir);
  const config = await readScheduleSettings(rootDir);

  return {
    source: "github",
    readonly: false,
    path: "config/schedule.json",
    settings: {
      timezone: config.settings.timezone,
      dailySendTime: config.settings.dailySendTime,
    },
    availableTimezones: config.availableTimezones,
    note: `正式调度读取仓库中的 config/schedule.json。GitHub Actions 每 ${workflow.triggerIntervalMinutes} 分钟轮询一次，并在命中配置时间槽时执行日报。`,
    cronExpression: `${workflow.cronExpression} (polling) / ${convertDailySendTimeToCron(config.settings.dailySendTime)} (target)`,
    lastRunAt: state.lastRunAt,
    lastRunStatus: state.lastRunStatus,
    committed: false,
    commitSha: null,
    targetRef: null,
    pushed: false,
    committedAt: null,
  };
}

export async function readGitHubModeGitHubSettings(
  rootDir: string,
): Promise<GitHubSettingsResponse> {
  const state = await readGitHubExecutionState(rootDir);

  return {
    source: "github",
    readonly: true,
    configured: state.lastRunStatus === "success",
    maskedToken: "由 GitHub Actions Secret 管理",
    apiBaseUrl: "https://api.github.com",
    trendingUrl: "https://github.com/trending?since=daily",
    managedIn: ".github/workflows/daily-digest.yml",
    note: "GitHub 访问凭据由 GitHub Actions Secrets 管理；这里展示的是远端正式配置映射。",
    mappedKeys: ["GITRADAR_GITHUB_TOKEN"],
    lastRunAt: state.lastRunAt,
    lastRunStatus: state.lastRunStatus,
  };
}

export async function readGitHubModeLlmSettings(
  rootDir: string,
): Promise<LlmSettingsResponse> {
  const state = await readGitHubExecutionState(rootDir);

  return {
    source: "github",
    readonly: true,
    configured: state.lastRunStatus === "success",
    maskedApiKey: "由 GitHub Actions Secret 管理",
    baseUrl: null,
    model: null,
    managedIn: ".github/workflows/daily-digest.yml",
    note: "LLM 配置由 GitHub Actions Secrets 管理；前端只读展示远端正式映射。",
    mappedKeys: ["GR_API_KEY", "GR_BASE_URL", "GR_MODEL"],
    lastRunAt: state.lastRunAt,
    lastRunStatus: state.lastRunStatus,
  };
}

export async function readGitHubModeWecomSettings(
  rootDir: string,
): Promise<WecomSettingsResponse> {
  const state = await readGitHubExecutionState(rootDir);

  return {
    source: "github",
    readonly: true,
    configured: state.lastRunStatus === "success",
    maskedWebhookUrl: "由 GitHub Actions Secret 管理",
    managedIn: ".github/workflows/daily-digest.yml",
    note: "企业微信 Webhook 由 GitHub Actions Secrets 管理；前端只读展示远端正式映射。",
    mappedKeys: ["GITRADAR_WECOM_WEBHOOK_URL"],
    lastRunAt: state.lastRunAt,
    lastRunStatus: state.lastRunStatus,
  };
}

export async function readGitHubModeEnvironmentFingerprints(
  rootDir: string,
): Promise<EnvironmentFingerprintResponse> {
  const state = await readGitHubExecutionState(rootDir);

  if (state.lastRunStatus !== "success" || !state.lastRunAt) {
    return {
      github: null,
      llm: null,
      wecom: null,
    };
  }

  return {
    github: {
      login: "GitHub Actions",
      apiBaseUrl: "https://api.github.com",
      lastValidatedAt: state.lastRunAt,
    },
    llm: {
      model: "由 GitHub Secrets 管理",
      baseUrl: "由 GitHub Secrets 管理",
      lastValidatedAt: state.lastRunAt,
    },
    wecom: {
      maskedWebhookUrl: "由 GitHub Secrets 管理",
      lastValidatedAt: state.lastRunAt,
    },
  };
}

export async function readGitHubModeSettingsOverview(
  rootDir: string,
): Promise<GitHubModeSettingsResponse> {
  const state = await readGitHubExecutionState(rootDir);
  const workflow = await readGitHubWorkflowSummary(rootDir);
  const config = await readScheduleSettings(rootDir);

  return {
    source: "github",
    workflowName: state.workflowName,
    trigger: state.trigger,
    lastRunAt: state.lastRunAt,
    lastRunStatus: state.lastRunStatus,
    lastArchiveDate: state.lastArchiveDate,
    runUrl: state.runUrl,
    cronExpression: `${workflow.cronExpression} (polling) / ${convertDailySendTimeToCron(config.settings.dailySendTime)} (target)`,
    timezone: config.settings.timezone,
    mappedSecrets: [
      "GITRADAR_GITHUB_TOKEN",
      "GR_API_KEY",
      "GR_BASE_URL",
      "GR_MODEL",
      "GITRADAR_WECOM_WEBHOOK_URL",
    ],
  };
}

async function resolveRepoRef(rootDir: string): Promise<RepoRef> {
  try {
    const { stdout } = await execFileAsync(
      "git",
      ["remote", "get-url", "origin"],
      { cwd: rootDir },
    );
    const parsed = parseGitRemote(stdout.trim());
    if (parsed) {
      return parsed;
    }
  } catch {
    // ignore
  }

  return {
    owner: DEFAULT_OWNER,
    repo: DEFAULT_REPO,
    branch: DEFAULT_BRANCH,
  };
}

function parseGitRemote(remote: string): RepoRef | null {
  const sshMatch = remote.match(/github\.com[:/](.+?)\/(.+?)(?:\.git)?$/);

  if (!sshMatch) {
    return null;
  }

  return {
    owner: sshMatch[1],
    repo: sshMatch[2],
    branch: DEFAULT_BRANCH,
  };
}

async function fetchGitHubDirectory(
  rootDir: string,
  repoPath: string,
): Promise<string[]> {
  const ref = await syncRemoteRef(rootDir);

  if (ref === LOCAL_FILESYSTEM_REF) {
    return listLocalRepoFiles(rootDir, repoPath);
  }

  try {
    const { stdout } = await execFileAsync(
      "git",
      ["ls-tree", "-r", "--name-only", ref, "--", repoPath],
      { cwd: rootDir },
    );

    return stdout
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

async function fetchRepoFile(
  rootDir: string,
  repoPath: string,
): Promise<string> {
  const ref = await syncRemoteRef(rootDir);

  if (ref === LOCAL_FILESYSTEM_REF) {
    return readFile(path.join(rootDir, repoPath), "utf8");
  }

  const spec = `${ref}:${repoPath}`;

  try {
    const { stdout } = await execFileAsync("git", ["show", spec], {
      cwd: rootDir,
      maxBuffer: 10 * 1024 * 1024,
    });
    return stdout;
  } catch (error) {
    throw new Error(
      `Failed to read GitHub file ${repoPath}: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}

async function syncRemoteRef(rootDir: string): Promise<string> {
  const hasGitDir = await isGitRepository(rootDir);
  const hasOrigin = hasGitDir ? await hasGitRemote(rootDir, "origin") : false;

  if (!hasGitDir || !hasOrigin) {
    return LOCAL_FILESYSTEM_REF;
  }

  if (Date.now() - lastRemoteSyncAt < REMOTE_SYNC_TTL_MS) {
    return "FETCH_HEAD";
  }

  if (!remoteSyncPromise) {
    remoteSyncPromise = execFileAsync(
      "git",
      ["fetch", "origin", DEFAULT_BRANCH],
      { cwd: rootDir, maxBuffer: 10 * 1024 * 1024 },
    )
      .then(() => {
        lastRemoteSyncAt = Date.now();
      })
      .finally(() => {
        remoteSyncPromise = null;
      });
  }

  await remoteSyncPromise;
  return "FETCH_HEAD";
}

async function listLocalRepoFiles(
  rootDir: string,
  repoPath: string,
): Promise<string[]> {
  const absolutePath = path.join(rootDir, repoPath);

  try {
    return await walkLocalDirectory(absolutePath, rootDir);
  } catch {
    return [];
  }
}

async function walkLocalDirectory(
  absolutePath: string,
  rootDir: string,
): Promise<string[]> {
  const entries = await readdir(absolutePath, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const entryPath = path.join(absolutePath, entry.name);

    if (entry.isDirectory()) {
      files.push(...(await walkLocalDirectory(entryPath, rootDir)));
      continue;
    }

    if (entry.isFile()) {
      files.push(path.relative(rootDir, entryPath));
    }
  }

  return files;
}

async function isGitRepository(rootDir: string): Promise<boolean> {
  try {
    await execFileAsync("git", ["rev-parse", "--is-inside-work-tree"], {
      cwd: rootDir,
    });
    return true;
  } catch {
    return false;
  }
}

async function hasGitRemote(
  rootDir: string,
  remoteName: string,
): Promise<boolean> {
  try {
    await execFileAsync("git", ["remote", "get-url", remoteName], {
      cwd: rootDir,
    });
    return true;
  } catch {
    return false;
  }
}

async function readGitHubWorkflowSummary(
  rootDir: string,
): Promise<GitHubWorkflowSummary> {
  const workflowPath = path.join(
    rootDir,
    ".github",
    "workflows",
    "daily-digest.yml",
  );
  const content = await fetchWorkflowFile(rootDir, workflowPath);
  const cronExpression =
    content.match(/cron:\s*"([^"]+)"/)?.[1] ?? "*/5 * * * *";

  return {
    cronExpression,
    triggerIntervalMinutes: readCronPollingInterval(cronExpression),
  };
}

function readCronPollingInterval(cronExpression: string): number {
  const everyNMinutes = cronExpression.match(/^\*\/(\d+)\s+\*\s+\*\s+\*\s+\*$/);

  if (!everyNMinutes) {
    return 5;
  }

  return Number.parseInt(everyNMinutes[1] ?? "5", 10);
}

async function fetchWorkflowFile(
  rootDir: string,
  workflowPath: string,
): Promise<string> {
  const repoPath = path.relative(rootDir, workflowPath);
  return fetchRepoFile(rootDir, repoPath);
}

function buildGitHubEditorialIntro(
  archive: ArchiveDetailResponse["archive"],
): string[] {
  const themeCounts = new Map<string, number>();

  for (const item of archive.digest.items) {
    themeCounts.set(item.theme, (themeCounts.get(item.theme) ?? 0) + 1);
  }

  const leadingTheme = [...themeCounts.entries()].sort(
    (left, right) => right[1] - left[1],
  )[0];

  return [
    leadingTheme
      ? `GitHub 远端执行最近一次归档偏向 ${leadingTheme[0]}，本期该主题占了 ${leadingTheme[1]} 条。`
      : "GitHub 远端执行最近一次归档更强调少而准，优先保留近期信号明确的仓库。",
    "当前阅读的是 GitHub Actions 持久化回仓库的正式归档，不依赖本地机器当时是否在线。",
    "兴趣轨迹和偏好提示目前仍由控制台侧维护，因此远端正式归档与当前偏好会同时出现。",
  ];
}
