import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export type EnvironmentCheckStatus =
  | "configured"
  | "missing"
  | "invalid"
  | "unknown";

export interface EnvironmentCheckReport {
  status: EnvironmentCheckStatus;
  checkedAt: string | null;
  detail: string;
}

export interface GitHubEnvironmentCheckReport extends EnvironmentCheckReport {
  login: string | null;
  apiBaseUrl: string;
}

export interface LlmEnvironmentCheckReport extends EnvironmentCheckReport {
  model: string | null;
  baseUrl: string | null;
}

export interface WecomEnvironmentCheckReport extends EnvironmentCheckReport {
  maskedWebhookUrl: string | null;
}

export interface EnvironmentReport {
  source: "github";
  github: GitHubEnvironmentCheckReport;
  llm: LlmEnvironmentCheckReport;
  wecom: WecomEnvironmentCheckReport;
}

const ENVIRONMENT_REPORT_REPO_PATH = path.join(
  "data",
  "runtime",
  "environment-report.json",
);

export function getEnvironmentReportRepoPath(): string {
  return ENVIRONMENT_REPORT_REPO_PATH;
}

export function getEnvironmentReportPath(rootDir: string): string {
  return path.join(rootDir, ENVIRONMENT_REPORT_REPO_PATH);
}

export function normalizeEnvironmentReport(value: unknown): EnvironmentReport {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Environment report is invalid.");
  }

  const record = value as Record<string, unknown>;

  return {
    source: "github",
    github: normalizeGitHubCheck(record.github),
    llm: normalizeLlmCheck(record.llm),
    wecom: normalizeWecomCheck(record.wecom),
  };
}

export async function writeEnvironmentReport(
  rootDir: string,
  report: EnvironmentReport,
): Promise<EnvironmentReport> {
  const filePath = getEnvironmentReportPath(rootDir);
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  return report;
}

export async function readStoredEnvironmentReport(
  rootDir: string,
): Promise<EnvironmentReport | null> {
  try {
    const content = await readFile(getEnvironmentReportPath(rootDir), "utf8");
    return normalizeEnvironmentReport(JSON.parse(content));
  } catch (error) {
    if (isMissingFileError(error)) {
      return null;
    }

    throw error;
  }
}

function normalizeGitHubCheck(value: unknown): GitHubEnvironmentCheckReport {
  const record =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};

  return {
    status: normalizeStatus(record.status),
    checkedAt: normalizeNullableString(record.checkedAt),
    detail: normalizeString(record.detail, "GitHub 环境尚未诊断。"),
    login: normalizeNullableString(record.login),
    apiBaseUrl: normalizeString(record.apiBaseUrl, "https://api.github.com"),
  };
}

function normalizeLlmCheck(value: unknown): LlmEnvironmentCheckReport {
  const record =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};

  return {
    status: normalizeStatus(record.status),
    checkedAt: normalizeNullableString(record.checkedAt),
    detail: normalizeString(record.detail, "LLM 环境尚未诊断。"),
    model: normalizeNullableString(record.model),
    baseUrl: normalizeNullableString(record.baseUrl),
  };
}

function normalizeWecomCheck(value: unknown): WecomEnvironmentCheckReport {
  const record =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};

  return {
    status: normalizeStatus(record.status),
    checkedAt: normalizeNullableString(record.checkedAt),
    detail: normalizeString(record.detail, "企业微信环境尚未诊断。"),
    maskedWebhookUrl: normalizeNullableString(record.maskedWebhookUrl),
  };
}

function normalizeStatus(value: unknown): EnvironmentCheckStatus {
  if (value === "configured" || value === "missing" || value === "invalid") {
    return value;
  }

  return "unknown";
}

function normalizeNullableString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function normalizeString(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function isMissingFileError(error: unknown): boolean {
  return Boolean(
    error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "ENOENT",
  );
}
