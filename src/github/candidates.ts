import { getDateDaysAgo } from "../core/date";
import { mapWithConcurrency } from "../utils/async";
import { GitHubClient } from "./client";
import { fetchTrendingRepositoryNames } from "./trending";
import type {
  CandidateFetchResult,
  CandidateSource,
  GitHubCandidateRepo,
} from "./types";

export async function fetchGitHubCandidates(options: {
  token: string;
  apiBaseUrl: string;
  trendingUrl: string;
}): Promise<CandidateFetchResult> {
  const client = new GitHubClient(options.token, options.apiBaseUrl);
  const sourceCounts: Record<CandidateSource, number> = {
    trending: 0,
    search_recently_updated: 0,
    search_recently_created: 0,
  };

  const trendingNames = (
    await fetchTrendingRepositoryNames(options.trendingUrl)
  ).slice(0, 20);
  sourceCounts.trending = trendingNames.length;

  const trendingCandidates = await mapWithConcurrency(
    trendingNames,
    5,
    async (name) => {
      const candidate = await client.getRepository(name);
      candidate.sources = ["trending"];
      return candidate;
    },
  );

  const updatedCandidates = await client.searchRepositories(
    `archived:false fork:false pushed:>=${getDateDaysAgo(7)} stars:>=50`,
    "updated",
    20,
  );
  updatedCandidates.forEach((candidate) => {
    candidate.sources = ["search_recently_updated"];
  });
  sourceCounts.search_recently_updated = updatedCandidates.length;

  const createdCandidates = await client.searchRepositories(
    `archived:false fork:false created:>=${getDateDaysAgo(30)} stars:>=20`,
    "stars",
    20,
  );
  createdCandidates.forEach((candidate) => {
    candidate.sources = ["search_recently_created"];
  });
  sourceCounts.search_recently_created = createdCandidates.length;

  const merged = mergeCandidates([
    ...trendingCandidates,
    ...updatedCandidates,
    ...createdCandidates,
  ]);

  return {
    candidates: merged,
    sourceCounts,
  };
}

export async function enrichCandidatesWithReadmes(
  candidates: GitHubCandidateRepo[],
  options: {
    token: string;
    apiBaseUrl: string;
  },
): Promise<GitHubCandidateRepo[]> {
  const client = new GitHubClient(options.token, options.apiBaseUrl);

  return mapWithConcurrency(candidates, 5, async (candidate) => ({
    ...candidate,
    readmeExcerpt: await client.getReadmeExcerpt(candidate.repo),
  }));
}

function mergeCandidates(
  candidates: GitHubCandidateRepo[],
): GitHubCandidateRepo[] {
  const byRepo = new Map<string, GitHubCandidateRepo>();

  for (const candidate of candidates) {
    const existing = byRepo.get(candidate.repo);

    if (!existing) {
      byRepo.set(candidate.repo, candidate);
      continue;
    }

    const mergedSources = Array.from(
      new Set([...existing.sources, ...candidate.sources]),
    );

    byRepo.set(candidate.repo, {
      ...existing,
      ...candidate,
      description: pickLonger(existing.description, candidate.description),
      topics:
        candidate.topics.length > existing.topics.length
          ? candidate.topics
          : existing.topics,
      sources: mergedSources,
    });
  }

  return Array.from(byRepo.values());
}

function pickLonger(left: string, right: string): string {
  return right.length > left.length ? right : left;
}
