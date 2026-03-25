export type CandidateSource =
  | "trending"
  | "search_recently_updated"
  | "search_recently_created";

export interface GitHubCandidateRepo {
  repo: string;
  url: string;
  description: string;
  language: string | null;
  stars: number;
  forks: number;
  topics: string[];
  createdAt: string;
  updatedAt: string;
  pushedAt: string;
  archived: boolean;
  disabled: boolean;
  fork: boolean;
  sources: CandidateSource[];
  readmeExcerpt?: string | null;
  ruleScore?: number;
}

export interface CandidateFetchResult {
  candidates: GitHubCandidateRepo[];
  sourceCounts: Record<CandidateSource, number>;
}
