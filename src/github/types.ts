export type CandidateSource =
  | "trending"
  | "search_recently_updated"
  | "search_recently_created";

export interface CandidateScoreBreakdown {
  momentum: number;
  novelty: number;
  maturity: number;
  coverage: number;
  penalties: number;
  total: number;
}

export interface CandidateSelectionHints {
  whyNow: string;
  evidence: string[];
  matureMomentum: boolean;
  sourceSummary: string;
  selectionReason: string;
}

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
  theme?: string;
  scoreBreakdown?: CandidateScoreBreakdown;
  selectionHints?: CandidateSelectionHints;
  ruleScore?: number;
}

export interface CandidateFetchResult {
  candidates: GitHubCandidateRepo[];
  sourceCounts: Record<CandidateSource, number>;
  warnings?: string[];
}
