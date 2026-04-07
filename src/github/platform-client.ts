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

export interface GitHubReference {
  ref: string;
  object: {
    sha: string;
    type: string;
  };
}

export interface GitHubCommit {
  sha: string;
  tree: {
    sha: string;
  };
}

export interface GitHubBlob {
  sha: string;
}

export interface GitHubTree {
  sha: string;
}

export interface GitHubTreeEntryInput {
  path: string;
  mode: "100644";
  type: "blob";
  sha: string;
}

export interface GitHubCreatedCommit {
  sha: string;
}

export interface GitHubPullRequest {
  html_url: string;
  number: number;
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

  async getReference(
    owner: string,
    repo: string,
    ref: string,
  ): Promise<GitHubReference> {
    const normalizedRef = trimLeadingSlash(ref).replace(/^refs\//, "");
    return this.requestJson<GitHubReference>(
      "GET",
      `/repos/${owner}/${repo}/git/ref/${normalizedRef}`,
    );
  }

  async createReference(
    owner: string,
    repo: string,
    ref: string,
    sha: string,
  ): Promise<GitHubReference> {
    return this.requestJson<GitHubReference>(
      "POST",
      `/repos/${owner}/${repo}/git/refs`,
      {},
      {
        body: JSON.stringify({
          ref: normalizeRefPath(ref),
          sha,
        }),
      },
    );
  }

  async updateReference(
    owner: string,
    repo: string,
    ref: string,
    sha: string,
    force = false,
  ): Promise<GitHubReference> {
    const normalizedRef = trimLeadingSlash(ref).replace(/^refs\//, "");
    return this.requestJson<GitHubReference>(
      "PATCH",
      `/repos/${owner}/${repo}/git/refs/${normalizedRef}`,
      {},
      {
        body: JSON.stringify({ sha, force }),
      },
    );
  }

  async getCommit(
    owner: string,
    repo: string,
    sha: string,
  ): Promise<GitHubCommit> {
    return this.requestJson<GitHubCommit>(
      "GET",
      `/repos/${owner}/${repo}/git/commits/${sha}`,
    );
  }

  async createBlob(
    owner: string,
    repo: string,
    contentBase64: string,
  ): Promise<GitHubBlob> {
    return this.requestJson<GitHubBlob>(
      "POST",
      `/repos/${owner}/${repo}/git/blobs`,
      {},
      {
        body: JSON.stringify({
          content: contentBase64,
          encoding: "base64",
        }),
      },
    );
  }

  async createTree(
    owner: string,
    repo: string,
    baseTree: string,
    tree: GitHubTreeEntryInput[],
  ): Promise<GitHubTree> {
    return this.requestJson<GitHubTree>(
      "POST",
      `/repos/${owner}/${repo}/git/trees`,
      {},
      {
        body: JSON.stringify({
          base_tree: baseTree,
          tree,
        }),
      },
    );
  }

  async createCommit(
    owner: string,
    repo: string,
    message: string,
    treeSha: string,
    parents: string[],
  ): Promise<GitHubCreatedCommit> {
    return this.requestJson<GitHubCreatedCommit>(
      "POST",
      `/repos/${owner}/${repo}/git/commits`,
      {},
      {
        body: JSON.stringify({
          message,
          tree: treeSha,
          parents,
        }),
      },
    );
  }

  async createPullRequest(
    owner: string,
    repo: string,
    input: {
      title: string;
      head: string;
      base: string;
      body: string;
    },
  ): Promise<GitHubPullRequest> {
    return this.requestJson<GitHubPullRequest>(
      "POST",
      `/repos/${owner}/${repo}/pulls`,
      {},
      {
        body: JSON.stringify(input),
      },
    );
  }

  async findOpenPullRequest(
    owner: string,
    repo: string,
    input: {
      head: string;
      base: string;
    },
  ): Promise<GitHubPullRequest | null> {
    const matches = await this.requestJson<GitHubPullRequest[]>(
      "GET",
      `/repos/${owner}/${repo}/pulls`,
      {
        state: "open",
        head: `${owner}:${input.head}`,
        base: input.base,
      },
    );

    return matches[0] ?? null;
  }

  private async requestJson<T>(
    method: "GET" | "POST" | "PATCH",
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
    method: "GET" | "POST" | "PATCH",
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

function normalizeRefPath(value: string): string {
  const normalized = trimLeadingSlash(value);
  return normalized.startsWith("refs/") ? normalized : `refs/${normalized}`;
}
