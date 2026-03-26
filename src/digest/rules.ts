import { getDaysSince } from "../core/date";
import type { GitHubCandidateRepo } from "../github/types";

const DESCRIPTION_BLACKLIST =
  /\b(awesome|curated list|leetcode|dotfiles|personal website|boilerplate|template|starter|tutorial|cookbook|cheatsheet)\b/i;
const README_BLACKLIST =
  /\b(awesome list|curated list|boilerplate|template|starter|tutorial|getting started|course|cookbook)\b/i;
const TOPIC_BLACKLIST = new Set([
  "awesome",
  "boilerplate",
  "cheatsheet",
  "course",
  "starter",
  "template",
  "tutorial",
]);

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
    .filter((candidate) => !hasBlacklistedTopic(candidate.topics))
    .filter((candidate) => !hasBlacklistedReadme(candidate.readmeExcerpt))
    .map((candidate) => ({
      ...candidate,
      ruleScore: scoreCandidate(candidate),
    }))
    .sort(compareCandidates)
    .slice(0, limit);
}

function scoreCandidate(candidate: GitHubCandidateRepo): number {
  let score = 0;
  const sourceCount = candidate.sources.length;
  const pushedDays = getDaysSince(candidate.pushedAt);
  const createdDays = getDaysSince(candidate.createdAt);
  const hasReadme = Boolean(candidate.readmeExcerpt?.trim());
  const isVeryMature = createdDays > 365 && candidate.stars >= 20000;
  const sustainedMomentum = createdDays > 365 && pushedDays <= 7;

  if (candidate.sources.includes("trending")) {
    score += 28;
  }
  if (candidate.sources.includes("search_recently_updated")) {
    score += 22;
  }
  if (candidate.sources.includes("search_recently_created")) {
    score += 20;
  }

  if (sourceCount >= 3) {
    score += 24;
  } else if (sourceCount === 2) {
    score += 12;
  }

  score += Math.min(24, Math.log10(candidate.stars + 1) * 10);
  score += Math.min(6, Math.log10(candidate.forks + 1) * 3);
  score += Math.min(6, candidate.topics.length * 1.5);

  if (candidate.description.length >= 30) {
    score += 8;
  } else if (candidate.description.length >= 12) {
    score += 4;
  }

  if (pushedDays <= 3) {
    score += 24;
  } else if (pushedDays <= 7) {
    score += 18;
  } else if (pushedDays <= 14) {
    score += 12;
  } else if (pushedDays <= 30) {
    score += 6;
  } else if (pushedDays <= 90) {
    score += 2;
  }

  if (createdDays <= 14) {
    score += 14;
  } else if (createdDays <= 30) {
    score += 10;
  } else if (createdDays <= 90) {
    score += 4;
  }

  if (
    candidate.sources.includes("search_recently_created") &&
    pushedDays <= 7
  ) {
    score += 8;
  }

  if (sustainedMomentum) {
    score += 8;
  }

  if (isVeryMature && sourceCount === 1) {
    score -= 10;
  }

  if (hasReadme) {
    score += 4;
  } else {
    score -= 5;
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

function hasBlacklistedTopic(topics: string[]): boolean {
  return topics.some((topic) => TOPIC_BLACKLIST.has(topic.toLowerCase()));
}

function hasBlacklistedReadme(readmeExcerpt?: string | null): boolean {
  return Boolean(readmeExcerpt && README_BLACKLIST.test(readmeExcerpt));
}
