import type { DailyDigestArchive } from "../../src/core/archive";

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

export interface ScheduleSettings {
  timezone: "Asia/Shanghai";
  dailySendTime: string;
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
}> {
  return fetchJson("/api/settings/schedule");
}

export async function saveScheduleSettings(draft: ScheduleSettings): Promise<{
  path: string;
  settings: ScheduleSettings;
}> {
  return fetchJson("/api/settings/schedule", {
    method: "PUT",
    body: JSON.stringify(draft),
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
