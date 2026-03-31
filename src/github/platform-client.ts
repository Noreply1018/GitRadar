import { request } from "undici";

export interface GitHubPlatformClientOptions {
  token: string;
  apiBaseUrl?: string;
}

export interface GitHubWorkflowDispatchInput {
  ref: string;
  inputs?: Record<string, string>;
}

export interface GitHubContentsFileResponse {
  path: string;
  sha: string;
  content: string;
  encoding: string;
}

export interface GitHubRepositoryMetadata {
  default_branch: string;
  full_name: string;
  private: boolean;
}

export interface GitHubViewer {
  login: string;
}

export class GitHubPlatformClient {
  private readonly token: string;
  private readonly apiBaseUrl: string;

  constructor(options: GitHubPlatformClientOptions) {
    this.token = options.token;
    this.apiBaseUrl = normalizeApiBaseUrl(options.apiBaseUrl);
  }

  async getViewer(): Promise<GitHubViewer> {
    return this.requestJson<GitHubViewer>("GET", "/user");
  }

  async getRepository(
    owner: string,
    repo: string,
  ): Promise<GitHubRepositoryMetadata> {
    return this.requestJson<GitHubRepositoryMetadata>(
      "GET",
      `/repos/${owner}/${repo}`,
    );
  }

  async getContents(
    owner: string,
    repo: string,
    repoPath: string,
    ref?: string,
  ): Promise<GitHubContentsFileResponse> {
    const normalizedPath = trimLeadingSlash(repoPath);
    const pathname = `/repos/${owner}/${repo}/contents/${normalizedPath}`;

    return this.requestJson<GitHubContentsFileResponse>("GET", pathname, {
      ref,
    });
  }

  async dispatchWorkflow(
    owner: string,
    repo: string,
    workflowId: string,
    input: GitHubWorkflowDispatchInput,
  ): Promise<void> {
    await this.request(
      "POST",
      `/repos/${owner}/${repo}/actions/workflows/${workflowId}/dispatches`,
      {
        body: JSON.stringify(input),
      },
    );
  }

  private async requestJson<T>(
    method: "GET" | "POST",
    pathname: string,
    query: Record<string, string | undefined> = {},
    init: { body?: string } = {},
  ): Promise<T> {
    const response = await this.request(method, pathname, {
      query,
      body: init.body,
    });
    return (await response.body.json()) as T;
  }

  private async request(
    method: "GET" | "POST",
    pathname: string,
    init: {
      query?: Record<string, string | undefined>;
      body?: string;
    } = {},
  ) {
    const url = new URL(`${this.apiBaseUrl}${pathname}`);
    for (const [key, value] of Object.entries(init.query ?? {})) {
      if (value) {
        url.searchParams.set(key, value);
      }
    }

    const response = await request(url, {
      method,
      headers: {
        accept: "application/vnd.github+json",
        authorization: `Bearer ${this.token}`,
        "content-type": "application/json",
        "user-agent": "GitRadar",
        "x-github-api-version": "2022-11-28",
      },
      body: init.body,
    });

    if (response.statusCode < 200 || response.statusCode >= 300) {
      const body = await response.body.text();
      throw new Error(
        `GitHub platform request failed with status ${response.statusCode}: ${
          body || "empty response"
        }`,
      );
    }

    return response;
  }
}

function trimLeadingSlash(value: string): string {
  return value.replace(/^\/+/, "");
}

function normalizeApiBaseUrl(value?: string): string {
  const apiBaseUrl = value?.trim() || "https://api.github.com";
  return apiBaseUrl.replace(/\/$/, "");
}
