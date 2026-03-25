import { request } from "undici";

import type { GitHubCandidateRepo } from "./types";

interface GitHubRepositoryResponse {
  full_name: string;
  html_url: string;
  description: string | null;
  language: string | null;
  stargazers_count: number;
  forks_count: number;
  topics?: string[];
  created_at: string;
  updated_at: string;
  pushed_at: string;
  archived: boolean;
  disabled: boolean;
  fork: boolean;
}

interface GitHubSearchResponse {
  items: GitHubRepositoryResponse[];
}

interface GitHubReadmeResponse {
  content: string;
  encoding: string;
}

export class GitHubClient {
  constructor(
    private readonly token: string,
    private readonly apiBaseUrl: string,
  ) {}

  async getRepository(fullName: string): Promise<GitHubCandidateRepo> {
    const repository = await this.requestJson<GitHubRepositoryResponse>(
      `/repos/${fullName}`,
    );

    return mapRepositoryToCandidate(repository, []);
  }

  async searchRepositories(
    query: string,
    sort: "stars" | "updated",
    perPage: number,
  ): Promise<GitHubCandidateRepo[]> {
    const search = await this.requestJson<GitHubSearchResponse>(
      "/search/repositories",
      {
        q: query,
        sort,
        order: "desc",
        per_page: String(perPage),
      },
    );

    return search.items.map((item) => mapRepositoryToCandidate(item, []));
  }

  async getReadmeExcerpt(fullName: string): Promise<string | null> {
    try {
      const readme = await this.requestJson<GitHubReadmeResponse>(
        `/repos/${fullName}/readme`,
      );

      if (readme.encoding !== "base64") {
        return null;
      }

      const content = Buffer.from(readme.content.replace(/\n/g, ""), "base64")
        .toString("utf8")
        .replace(/\r\n/g, "\n")
        .trim();

      if (!content) {
        return null;
      }

      return content.slice(0, 1200);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes("GitHub request failed with status 404")) {
        return null;
      }
      throw error;
    }
  }

  private async requestJson<T>(
    pathname: string,
    query: Record<string, string> = {},
  ): Promise<T> {
    const url = new URL(`${this.apiBaseUrl}${pathname}`);
    for (const [key, value] of Object.entries(query)) {
      url.searchParams.set(key, value);
    }

    const response = await request(url, {
      method: "GET",
      headers: {
        accept: "application/vnd.github+json",
        authorization: `Bearer ${this.token}`,
        "user-agent": "GitRadar",
        "x-github-api-version": "2022-11-28",
      },
    });

    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw new Error(
        `GitHub request failed with status ${response.statusCode}.`,
      );
    }

    return (await response.body.json()) as T;
  }
}

function mapRepositoryToCandidate(
  repository: GitHubRepositoryResponse,
  sources: GitHubCandidateRepo["sources"],
): GitHubCandidateRepo {
  return {
    repo: repository.full_name,
    url: repository.html_url,
    description: repository.description?.trim() ?? "",
    language: repository.language,
    stars: repository.stargazers_count,
    forks: repository.forks_count,
    topics: repository.topics ?? [],
    createdAt: repository.created_at,
    updatedAt: repository.updated_at,
    pushedAt: repository.pushed_at,
    archived: repository.archived,
    disabled: repository.disabled,
    fork: repository.fork,
    sources,
  };
}
