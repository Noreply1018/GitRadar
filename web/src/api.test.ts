import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  clearGitHubPat,
  fetchArchives,
  saveGitHubPat,
  saveScheduleSettings,
} from "./api";

class MemoryStorage implements Storage {
  private readonly store = new Map<string, string>();

  get length(): number {
    return this.store.size;
  }

  clear(): void {
    this.store.clear();
  }

  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }

  key(index: number): string | null {
    return [...this.store.keys()][index] ?? null;
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }
}

function encodeGitHubContents(payload: unknown) {
  return {
    content: Buffer.from(JSON.stringify(payload), "utf8").toString("base64"),
    encoding: "base64",
  };
}

function installWindow(url = "https://noreply1018.github.io/GitRadar/"): void {
  const localStorage = new MemoryStorage();
  const location = new URL(url);

  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      location,
      localStorage,
      atob: (value: string) => Buffer.from(value, "base64").toString("utf8"),
      btoa: (value: string) => Buffer.from(value, "utf8").toString("base64"),
    },
  });
}

describe("web console GitHub API integration", () => {
  const originalFetch = globalThis.fetch;
  const originalWindow = (globalThis as { window?: unknown }).window;

  beforeEach(() => {
    installWindow();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    clearGitHubPat();
    globalThis.fetch = originalFetch;

    if (originalWindow === undefined) {
      delete (globalThis as { window?: unknown }).window;
      return;
    }

    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: originalWindow,
    });
  });

  it("dispatches schedule writeback directly from the Pages console", async () => {
    saveGitHubPat("github_pat_test_token");

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ login: "tester" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () =>
          encodeGitHubContents({
            source: "github",
            workflowName: "Daily Digest",
            trigger: "workflow_dispatch",
            lastRunAt: "2026-04-07T09:00:00.000Z",
            lastRunStatus: "success",
            lastArchiveDate: "2026-04-07",
            runUrl: "https://github.com/noreply1018/GitRadar/actions/runs/1",
            ref: "main",
          }),
      });
    globalThis.fetch = fetchMock as typeof globalThis.fetch;

    const response = await saveScheduleSettings({
      timezone: "Asia/Shanghai",
      dailySendTime: "09:45",
    });

    expect(fetchMock).toHaveBeenCalledTimes(3);
    const [, dispatchCall] = fetchMock.mock.calls;
    const [dispatchUrl, dispatchInit] = dispatchCall;
    const dispatchRequest = dispatchInit as RequestInit;

    expect(String(dispatchUrl)).toContain(
      "/repos/noreply1018/GitRadar/actions/workflows/console-writeback.yml/dispatches",
    );

    const body = JSON.parse(String(dispatchRequest.body)) as {
      ref: string;
      inputs: {
        operation: string;
        payload_base64: string;
        request_id: string;
        requested_by: string;
      };
    };

    expect(body.ref).toBe("main");
    expect(body.inputs.operation).toBe("update_schedule");
    expect(body.inputs.requested_by).toBe("tester");
    expect(
      JSON.parse(
        Buffer.from(body.inputs.payload_base64, "base64").toString("utf8"),
      ),
    ).toEqual({
      timezone: "Asia/Shanghai",
      dailySendTime: "09:45",
    });

    expect(response.mode).toBe("workflow_dispatch");
    expect(response.branch).toBe("main");
    expect(response.lastRunStatus).toBe("success");
  });

  it("reads archive summaries directly from GitHub contents without a local server", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [
          { name: "2026-04-05.json", type: "file" },
          { name: "2026-04-06.json", type: "file" },
        ],
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () =>
          encodeGitHubContents({
            schemaVersion: 3,
            generatedAt: "2026-04-06T01:00:00.000Z",
            candidateCount: 30,
            shortlistedCount: 8,
            candidates: [],
            shortlisted: [],
            selection: {
              llmCandidateRepos: ["owner/repo-b"],
              selected: [],
              rejected: [],
            },
            generationMeta: {
              sourceCounts: {
                trending: 5,
                search_recently_updated: 8,
                search_recently_created: 7,
              },
              llmCandidateCount: 1,
              rulesVersion: "2026-04-v1",
              editorialMode: "llm",
            },
            digest: {
              date: "2026-04-06",
              title: "GitRadar · 2026-04-06",
              items: [
                {
                  repo: "owner/repo-b",
                  url: "https://github.com/owner/repo-b",
                  theme: "AI Agents",
                  summary: "B",
                  whyItMatters: "B",
                  whyNow: "B",
                  novelty: "B",
                  trend: "B",
                  evidence: ["B"],
                },
              ],
            },
          }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () =>
          encodeGitHubContents({
            schemaVersion: 3,
            generatedAt: "2026-04-05T01:00:00.000Z",
            candidateCount: 20,
            shortlistedCount: 6,
            candidates: [],
            shortlisted: [],
            selection: {
              llmCandidateRepos: ["owner/repo-a"],
              selected: [],
              rejected: [],
            },
            generationMeta: {
              sourceCounts: {
                trending: 4,
                search_recently_updated: 6,
                search_recently_created: 3,
              },
              llmCandidateCount: 1,
              rulesVersion: "2026-04-v1",
              editorialMode: "llm",
            },
            digest: {
              date: "2026-04-05",
              title: "GitRadar · 2026-04-05",
              items: [
                {
                  repo: "owner/repo-a",
                  url: "https://github.com/owner/repo-a",
                  theme: "Infra & Runtime",
                  summary: "A",
                  whyItMatters: "A",
                  whyNow: "A",
                  novelty: "A",
                  trend: "A",
                  evidence: ["A"],
                },
              ],
            },
          }),
      });
    globalThis.fetch = fetchMock as typeof globalThis.fetch;

    const result = await fetchArchives();

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(result.archives.map((archive) => archive.date)).toEqual([
      "2026-04-06",
      "2026-04-05",
    ]);
    expect(result.archives[0]).toMatchObject({
      title: "GitRadar · 2026-04-06",
      topRepos: ["owner/repo-b"],
      rulesVersion: "2026-04-v1",
    });
  });
});
