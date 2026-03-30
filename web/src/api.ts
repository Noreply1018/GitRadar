import type { DigestRulesConfig } from "../../src/config/digest-rules";
import type { DailyDigestArchive } from "../../src/core/archive";

export interface DigestRulesIssue {
  path: string;
  message: string;
}

export interface CommandJob {
  id: string;
  commandId:
    | "validate-digest-rules"
    | "generate-digest"
    | "generate-digest-send"
    | "analyze-digest"
    | "send-wecom-sample";
  command: string;
  status: "queued" | "running" | "succeeded" | "failed";
  startedAt: string;
  finishedAt?: string;
  exitCode?: number;
  stdout: string;
  stderr: string;
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

export async function fetchDigestRules(): Promise<{
  config: DigestRulesConfig;
  path: string;
}> {
  return fetchJson("/api/config/digest-rules");
}

export async function validateDigestRules(
  draft: DigestRulesConfig,
): Promise<{ valid: boolean; issues: DigestRulesIssue[] }> {
  return fetchJson("/api/config/digest-rules/validate", {
    method: "POST",
    body: JSON.stringify(draft),
  });
}

export async function saveDigestRules(draft: DigestRulesConfig): Promise<{
  config: DigestRulesConfig;
  path: string;
}> {
  return fetchJson("/api/config/digest-rules", {
    method: "PUT",
    body: JSON.stringify(draft),
  });
}

export async function fetchJobs(): Promise<{ jobs: CommandJob[] }> {
  return fetchJson("/api/commands");
}

export async function fetchJob(jobId: string): Promise<{ job: CommandJob }> {
  return fetchJson(`/api/commands/${jobId}`);
}

export async function startValidateRules(): Promise<{ job: CommandJob }> {
  return fetchJson("/api/commands/validate-digest-rules", {
    method: "POST",
  });
}

export async function startGenerateDigest(send = false): Promise<{
  job: CommandJob;
}> {
  return fetchJson("/api/commands/generate-digest", {
    method: "POST",
    body: JSON.stringify({ send }),
  });
}

export async function startAnalyzeDigest(date: string): Promise<{
  job: CommandJob;
}> {
  return fetchJson("/api/commands/analyze-digest", {
    method: "POST",
    body: JSON.stringify({ date }),
  });
}

export async function startSendSample(): Promise<{ job: CommandJob }> {
  return fetchJson("/api/commands/send-wecom-sample", {
    method: "POST",
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
