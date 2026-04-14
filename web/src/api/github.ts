import type {
  GitHubDirectoryEntry,
  GitHubFileResponse,
  GitHubWorkflowRun,
  GitHubWorkflowRunsResponse,
} from "./types";
import { WORKER_URL } from "../config";

export class GitHubClient {
  private readonly baseUrl: string;

  constructor(private readonly session: string) {
    this.baseUrl = `${WORKER_URL}/api/github`;
  }

  async readFile(path: string): Promise<{ content: string; sha: string }> {
    const res = await this.request<GitHubFileResponse>(
      `/repos/contents/${path}`,
    );

    if (res.type !== "file" || !res.content) {
      throw new Error(`Path is not a file: ${path}`);
    }

    const content = decodeBase64(res.content);
    return { content, sha: res.sha };
  }

  async writeFile(
    path: string,
    content: string,
    message: string,
    sha?: string,
  ): Promise<void> {
    const body: Record<string, string> = {
      message,
      content: encodeBase64(content),
    };

    if (sha) {
      body.sha = sha;
    }

    await this.request(`/repos/contents/${path}`, {
      method: "PUT",
      body: JSON.stringify(body),
    });
  }

  async listDirectory(path: string): Promise<GitHubDirectoryEntry[]> {
    return this.request<GitHubDirectoryEntry[]>(
      `/repos/contents/${path}`,
    );
  }

  async triggerWorkflow(workflowId: string, ref = "main"): Promise<void> {
    await this.request(
      `/repos/actions/workflows/${workflowId}/dispatches`,
      {
        method: "POST",
        body: JSON.stringify({ ref }),
      },
    );
  }

  async listWorkflowRuns(
    workflowId: string,
    perPage = 20,
  ): Promise<GitHubWorkflowRun[]> {
    const res = await this.request<GitHubWorkflowRunsResponse>(
      `/repos/actions/workflows/${workflowId}/runs?per_page=${perPage}`,
    );

    return res.workflow_runs;
  }

  async validateConnection(): Promise<boolean> {
    try {
      await this.request("/repos");
      return true;
    } catch {
      return false;
    }
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const res = await fetch(url, {
      ...init,
      headers: {
        authorization: `Bearer ${this.session}`,
        "content-type": "application/json",
        ...init?.headers,
      },
    });

    if (res.status === 401) {
      throw new AuthError("Session is invalid or expired.");
    }

    if (res.status === 404) {
      throw new NotFoundError(`Not found: ${path}`);
    }

    if (res.status === 409) {
      throw new ConflictError(
        "File was modified by another process. Please refresh and try again.",
      );
    }

    if (!res.ok) {
      throw new Error(`API error: ${res.status} ${res.statusText}`);
    }

    if (res.status === 204) {
      return undefined as T;
    }

    return res.json() as Promise<T>;
  }
}

export class AuthError extends Error {
  readonly name = "AuthError";
}

export class NotFoundError extends Error {
  readonly name = "NotFoundError";
}

export class ConflictError extends Error {
  readonly name = "ConflictError";
}

function decodeBase64(encoded: string): string {
  return decodeURIComponent(
    atob(encoded.replace(/\n/g, ""))
      .split("")
      .map((c) => "%" + c.charCodeAt(0).toString(16).padStart(2, "0"))
      .join(""),
  );
}

function encodeBase64(content: string): string {
  return btoa(
    encodeURIComponent(content).replace(/%([0-9A-F]{2})/g, (_, p1) =>
      String.fromCharCode(parseInt(p1, 16)),
    ),
  );
}
