import { getDaysSince } from "../core/date";
import type { GitHubCandidateRepo } from "../github/types";

const DESCRIPTION_BLACKLIST =
  /\b(awesome|curated list|leetcode|dotfiles|personal website|boilerplate|template|tutorial)\b/i;

export function selectCandidatesForDigest(
  candidates: GitHubCandidateRepo[],
  limit = 20,
): GitHubCandidateRepo[] {
  return candidates
    .filter((candidate) => candidate.description)
    .filter(
      (candidate) =>
        !candidate.archived && !candidate.disabled && !candidate.fork,
    )
    .filter((candidate) => getDaysSince(candidate.pushedAt) <= 180)
    .filter((candidate) => !DESCRIPTION_BLACKLIST.test(candidate.description))
    .map((candidate) => ({
      ...candidate,
      ruleScore: scoreCandidate(candidate),
    }))
    .sort(compareCandidates)
    .slice(0, limit);
}

function scoreCandidate(candidate: GitHubCandidateRepo): number {
  let score = 0;

  if (candidate.sources.includes("trending")) {
    score += 40;
  }
  if (candidate.sources.includes("search_recently_updated")) {
    score += 25;
  }
  if (candidate.sources.includes("search_recently_created")) {
    score += 25;
  }

  score += Math.min(30, Math.log10(candidate.stars + 1) * 12);
  score += Math.min(8, candidate.topics.length * 2);

  if (candidate.description.length >= 30) {
    score += 10;
  } else if (candidate.description.length >= 12) {
    score += 5;
  }

  const pushedDays = getDaysSince(candidate.pushedAt);
  if (pushedDays <= 7) {
    score += 20;
  } else if (pushedDays <= 30) {
    score += 10;
  } else if (pushedDays <= 90) {
    score += 5;
  }

  const createdDays = getDaysSince(candidate.createdAt);
  if (createdDays <= 30) {
    score += 15;
  } else if (createdDays <= 90) {
    score += 5;
  }

  if (candidate.language) {
    score += 2;
  }

  return score;
}

function compareCandidates(
  left: GitHubCandidateRepo,
  right: GitHubCandidateRepo,
): number {
  const scoreDelta = (right.ruleScore ?? 0) - (left.ruleScore ?? 0);
  if (scoreDelta !== 0) {
    return scoreDelta;
  }

  const starDelta = right.stars - left.stars;
  if (starDelta !== 0) {
    return starDelta;
  }

  return right.pushedAt.localeCompare(left.pushedAt);
}
