import { mkdir, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

import type { GitHubExecutionState } from "../web-api/types/api";

const DEFAULT_BRANCH = "main";
const DEFAULT_WORKFLOW_NAME = "Daily Digest";
const GITHUB_RUNTIME_REPO_PATH = path.join(
  "data",
  "runtime",
  "github-runtime.json",
);

export interface GitHubExecutionStateInput {
  workflowName?: string | null;
  trigger?: string | null;
  lastRunAt?: string | null;
  lastRunStatus?: "success" | "failure" | "unknown" | null;
  lastArchiveDate?: string | null;
  runUrl?: string | null;
  ref?: string | null;
}

export function getGitHubExecutionStateRepoPath(): string {
  return GITHUB_RUNTIME_REPO_PATH;
}

export function getGitHubExecutionStatePath(rootDir: string): string {
  return path.join(rootDir, GITHUB_RUNTIME_REPO_PATH);
}

export function normalizeExecutionState(value: unknown): GitHubExecutionState {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("GitHub execution state is invalid.");
  }

  const record = value as Record<string, unknown>;

  return {
    source: "github",
    workflowName:
      typeof record.workflowName === "string" && record.workflowName.trim()
        ? record.workflowName
        : DEFAULT_WORKFLOW_NAME,
    trigger: typeof record.trigger === "string" ? record.trigger : null,
    lastRunAt:
      typeof record.lastRunAt === "string" && isValidTimestamp(record.lastRunAt)
        ? record.lastRunAt
        : null,
    lastRunStatus:
      record.lastRunStatus === "success" || record.lastRunStatus === "failure"
        ? record.lastRunStatus
        : "unknown",
    lastArchiveDate:
      typeof record.lastArchiveDate === "string" &&
      /^\d{4}-\d{2}-\d{2}$/.test(record.lastArchiveDate)
        ? record.lastArchiveDate
        : null,
    runUrl: typeof record.runUrl === "string" ? record.runUrl : null,
    ref:
      typeof record.ref === "string" && record.ref.trim()
        ? record.ref
        : DEFAULT_BRANCH,
  };
}

export async function detectLatestArchiveDate(
  rootDir: string,
): Promise<string | null> {
  const historyDir = path.join(rootDir, "data", "history");
  const files = await readdir(historyDir).catch(() => [] as string[]);

  return (
    files
      .filter((file) => /^\d{4}-\d{2}-\d{2}\.json$/.test(file))
      .map((file) => file.replace(/\.json$/, ""))
      .sort()
      .at(-1) ?? null
  );
}

export async function writeGitHubExecutionState(
  rootDir: string,
  input: GitHubExecutionStateInput,
): Promise<GitHubExecutionState> {
  const filePath = getGitHubExecutionStatePath(rootDir);
  const state = normalizeExecutionState({
    source: "github",
    workflowName: input.workflowName ?? DEFAULT_WORKFLOW_NAME,
    trigger: input.trigger ?? null,
    lastRunAt: input.lastRunAt ?? new Date().toISOString(),
    lastRunStatus: input.lastRunStatus ?? "unknown",
    lastArchiveDate:
      input.lastArchiveDate ?? (await detectLatestArchiveDate(rootDir)),
    runUrl: input.runUrl ?? null,
    ref: input.ref ?? DEFAULT_BRANCH,
  });

  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(state, null, 2)}\n`, "utf8");

  return state;
}

function isValidTimestamp(value: string): boolean {
  return !Number.isNaN(Date.parse(value));
}
