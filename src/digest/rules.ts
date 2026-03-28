import { getDaysSince } from "../core/date";
import {
  DIGEST_DESCRIPTION_BLACKLIST,
  DIGEST_README_BLACKLIST,
  DIGEST_RULES_CONFIG,
  DIGEST_TOPIC_BLACKLIST,
} from "../config/digest-rules";
import type {
  CandidateScoreBreakdown,
  GitHubCandidateRepo,
} from "../github/types";

interface DiversityOptions {
  maxPerTheme: number;
  ensureMatureMomentum?: boolean;
}

interface CandidateSelectionResult {
  selected: GitHubCandidateRepo[];
  rejected: Array<{
    candidate: GitHubCandidateRepo;
    reason: string;
  }>;
}

export function selectCandidatesForDigest(
  candidates: GitHubCandidateRepo[],
  limit = 20,
): GitHubCandidateRepo[] {
  const annotated = candidates
    .filter((candidate) => candidate.description)
    .filter(
      (candidate) =>
        !candidate.archived && !candidate.disabled && !candidate.fork,
    )
    .filter(
      (candidate) =>
        getDaysSince(candidate.pushedAt) <=
        DIGEST_RULES_CONFIG.thresholds.maxPushedDays,
    )
    .filter(
      (candidate) => !DIGEST_DESCRIPTION_BLACKLIST.test(candidate.description),
    )
    .filter((candidate) => !hasBlacklistedTopic(candidate.topics))
    .filter((candidate) => !hasBlacklistedReadme(candidate.readmeExcerpt))
    .map(annotateCandidate)
    .sort(compareCandidates);

  return applyDiversity(annotated, limit, {
    maxPerTheme: DIGEST_RULES_CONFIG.selection.shortlistMaxPerTheme,
  }).selected;
}

export function buildDigestCandidatePool(
  candidates: GitHubCandidateRepo[],
  limit = 8,
): CandidateSelectionResult {
  return applyDiversity(candidates, limit, {
    maxPerTheme: DIGEST_RULES_CONFIG.selection.poolMaxPerTheme,
    ensureMatureMomentum: DIGEST_RULES_CONFIG.selection.ensureMatureMomentum,
  });
}

export function getRulesVersion(): string {
  return DIGEST_RULES_CONFIG.version;
}

function annotateCandidate(
  candidate: GitHubCandidateRepo,
): GitHubCandidateRepo {
  const theme = inferTheme(candidate);
  const scoreBreakdown = scoreCandidate(candidate);
  const selectionHints = buildSelectionHints(candidate, scoreBreakdown);

  return {
    ...candidate,
    theme,
    scoreBreakdown,
    selectionHints,
    ruleScore: scoreBreakdown.total,
  };
}

function scoreCandidate(
  candidate: GitHubCandidateRepo,
): CandidateScoreBreakdown {
  const sourceCount = candidate.sources.length;
  const pushedDays = getDaysSince(candidate.pushedAt);
  const createdDays = getDaysSince(candidate.createdAt);
  const hasReadme = Boolean(candidate.readmeExcerpt?.trim());
  const thresholds = DIGEST_RULES_CONFIG.thresholds;
  const weights = DIGEST_RULES_CONFIG.weights;
  const isVeryMature =
    createdDays > thresholds.veryMatureAgeDays &&
    candidate.stars >= thresholds.veryMatureMinStars;
  const sustainedMomentum =
    createdDays > thresholds.sustainedMomentumAgeDays &&
    pushedDays <= thresholds.sustainedMomentumPushDays;
  let momentum = 0;
  let novelty = 0;
  let maturity = 0;
  let coverage = 0;
  let penalties = 0;

  if (candidate.sources.includes("trending")) {
    momentum += weights.sourceSignals.trending.momentum;
    novelty += weights.sourceSignals.trending.novelty;
  }
  if (candidate.sources.includes("search_recently_updated")) {
    momentum += weights.sourceSignals.searchRecentlyUpdated.momentum;
  }
  if (candidate.sources.includes("search_recently_created")) {
    novelty += weights.sourceSignals.searchRecentlyCreated.novelty;
  }

  if (sourceCount >= thresholds.sourceOverlapHighWatermark) {
    momentum += weights.sourceOverlap.high.momentum;
    coverage += weights.sourceOverlap.high.coverage;
  } else if (sourceCount >= thresholds.sourceOverlapMediumWatermark) {
    momentum += weights.sourceOverlap.medium.momentum;
    coverage += weights.sourceOverlap.medium.coverage;
  }

  maturity += Math.min(
    weights.maturity.starCap,
    Math.log10(candidate.stars + 1) * weights.maturity.starLogMultiplier,
  );
  maturity += Math.min(
    weights.maturity.forkCap,
    Math.log10(candidate.forks + 1) * weights.maturity.forkLogMultiplier,
  );
  coverage += Math.min(
    weights.coverage.topicCap,
    candidate.topics.length * weights.coverage.topicMultiplier,
  );

  if (candidate.description.length >= thresholds.strongDescriptionLength) {
    coverage += weights.coverage.strongDescription;
  } else if (
    candidate.description.length >= thresholds.mediumDescriptionLength
  ) {
    coverage += weights.coverage.mediumDescription;
  }

  momentum += getBucketScore(
    pushedDays,
    DIGEST_RULES_CONFIG.thresholds.recentPushMomentum,
  );

  novelty += getBucketScore(
    createdDays,
    DIGEST_RULES_CONFIG.thresholds.recentCreationNovelty,
  );

  if (
    candidate.sources.includes("search_recently_created") &&
    pushedDays <= thresholds.recentCreatedPushBonusDays
  ) {
    novelty += weights.sourceSignals.searchRecentlyCreated.recentPushBonus;
  }

  if (sustainedMomentum) {
    momentum += weights.maturity.sustainedMomentumBonus.momentum;
    maturity += weights.maturity.sustainedMomentumBonus.maturity;
  }

  if (isVeryMature && sourceCount === 1) {
    penalties += weights.maturity.veryMatureSingleSourcePenalty;
  }

  if (hasReadme) {
    coverage += weights.coverage.readme;
  } else {
    penalties += weights.coverage.missingReadmePenalty;
  }

  if (candidate.language) {
    coverage += weights.coverage.language;
  }

  return {
    momentum,
    novelty,
    maturity,
    coverage,
    penalties,
    total: momentum + novelty + maturity + coverage + penalties,
  };
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
  return topics.some((topic) =>
    DIGEST_TOPIC_BLACKLIST.has(topic.toLowerCase()),
  );
}

function hasBlacklistedReadme(readmeExcerpt?: string | null): boolean {
  return Boolean(readmeExcerpt && DIGEST_README_BLACKLIST.test(readmeExcerpt));
}

function inferTheme(candidate: GitHubCandidateRepo): string {
  const haystack = [
    candidate.description,
    candidate.readmeExcerpt ?? "",
    candidate.language ?? "",
    ...candidate.topics,
  ]
    .join(" ")
    .toLowerCase();

  let bestTheme = "General OSS";
  let bestScore = 0;

  for (const definition of DIGEST_RULES_CONFIG.themes) {
    const score = definition.keywords.reduce((count, keyword) => {
      return haystack.includes(keyword.toLowerCase()) ? count + 1 : count;
    }, 0);

    if (score > bestScore) {
      bestTheme = definition.theme;
      bestScore = score;
    }
  }

  return bestTheme;
}

function buildSelectionHints(
  candidate: GitHubCandidateRepo,
  scoreBreakdown: CandidateScoreBreakdown,
): NonNullable<GitHubCandidateRepo["selectionHints"]> {
  const sourceCount = candidate.sources.length;
  const pushedDays = getDaysSince(candidate.pushedAt);
  const createdDays = getDaysSince(candidate.createdAt);
  const thresholds = DIGEST_RULES_CONFIG.thresholds;
  const matureMomentum =
    createdDays > thresholds.matureMomentumAgeDays &&
    pushedDays <= thresholds.matureMomentumPushDays &&
    candidate.stars >= thresholds.matureMomentumMinStars;
  const evidence = collectEvidence(candidate, matureMomentum);

  return {
    whyNow: buildWhyNow(candidate, matureMomentum, pushedDays, createdDays),
    evidence,
    matureMomentum,
    sourceSummary: describeSources(candidate.sources),
    selectionReason: buildSelectionReason(
      candidate,
      sourceCount,
      matureMomentum,
      scoreBreakdown,
    ),
  };
}

function collectEvidence(
  candidate: GitHubCandidateRepo,
  matureMomentum: boolean,
): string[] {
  const pushedDays = getDaysSince(candidate.pushedAt);
  const createdDays = getDaysSince(candidate.createdAt);
  const thresholds = DIGEST_RULES_CONFIG.thresholds;
  const evidence: string[] = [];

  if (candidate.sources.includes("trending")) {
    evidence.push("GitHub Trending 命中");
  }
  if (candidate.sources.includes("search_recently_updated")) {
    evidence.push("最近 7 天更新活跃");
  }
  if (candidate.sources.includes("search_recently_created")) {
    evidence.push("最近 30 天新建仓库");
  }
  if (matureMomentum) {
    evidence.push("成熟项目近期再次升温");
  }
  if (candidate.sources.length >= 2) {
    evidence.push("多来源同时命中");
  }
  if (candidate.stars >= thresholds.evidenceHighStarCount) {
    evidence.push(`Star ${formatCompactNumber(candidate.stars)}`);
  } else if (candidate.stars >= thresholds.evidenceMediumStarCount) {
    evidence.push(`Star ${formatCompactNumber(candidate.stars)}`);
  }
  if (pushedDays <= thresholds.evidenceVeryRecentPushDays) {
    evidence.push("近 3 天仍在推进");
  } else if (pushedDays <= thresholds.evidenceRecentPushDays) {
    evidence.push("近 7 天仍在推进");
  }
  if (createdDays <= thresholds.evidenceVeryNewProjectDays) {
    evidence.push("两周内新项目");
  } else if (createdDays <= thresholds.evidenceNewProjectDays) {
    evidence.push("一个月内新项目");
  }

  return Array.from(new Set(evidence)).slice(0, 3);
}

function buildWhyNow(
  candidate: GitHubCandidateRepo,
  matureMomentum: boolean,
  pushedDays: number,
  createdDays: number,
): string {
  if (candidate.sources.length >= 2 && pushedDays <= 7) {
    return "多来源同时命中，且近期更新活跃。";
  }

  if (createdDays <= 30 && pushedDays <= 7) {
    return "新项目仍在快速迭代，正处于出圈窗口。";
  }

  if (matureMomentum) {
    return "成熟项目近期恢复高频更新，值得重新关注。";
  }

  if (candidate.sources.includes("trending")) {
    return "当前社区讨论度上升，且具备明确项目形态。";
  }

  return "近期活跃度和可读性同时具备，适合今天点进去深看。";
}

function buildSelectionReason(
  candidate: GitHubCandidateRepo,
  sourceCount: number,
  matureMomentum: boolean,
  scoreBreakdown: CandidateScoreBreakdown,
): string {
  if (matureMomentum) {
    return "保留一条成熟但重新升温的项目位。";
  }

  if (sourceCount >= 2) {
    return "多来源重合且综合评分靠前。";
  }

  if (scoreBreakdown.novelty >= scoreBreakdown.maturity) {
    return "新鲜度和近期动量更强。";
  }

  return "主题代表性和近期活跃度更均衡。";
}

function applyDiversity(
  candidates: GitHubCandidateRepo[],
  limit: number,
  options: DiversityOptions,
): CandidateSelectionResult {
  const themeCounts = new Map<string, number>();
  const selected: GitHubCandidateRepo[] = [];
  const rejected: CandidateSelectionResult["rejected"] = [];

  for (const candidate of candidates) {
    if (selected.length >= limit) {
      rejected.push({
        candidate,
        reason: "已达到当前阶段的候选数量上限。",
      });
      continue;
    }

    const theme = candidate.theme ?? "General OSS";
    const themeCount = themeCounts.get(theme) ?? 0;

    if (themeCount >= options.maxPerTheme) {
      rejected.push({
        candidate,
        reason: `同主题名额已满（${theme}）。`,
      });
      continue;
    }

    selected.push(candidate);
    themeCounts.set(theme, themeCount + 1);
  }

  if (options.ensureMatureMomentum) {
    ensureMatureMomentum(candidates, selected, rejected, themeCounts);
  }

  return {
    selected,
    rejected,
  };
}

function ensureMatureMomentum(
  allCandidates: GitHubCandidateRepo[],
  selected: GitHubCandidateRepo[],
  rejected: CandidateSelectionResult["rejected"],
  themeCounts: Map<string, number>,
): void {
  if (
    selected.some((candidate) => candidate.selectionHints?.matureMomentum) ||
    !allCandidates.some((candidate) => candidate.selectionHints?.matureMomentum)
  ) {
    return;
  }

  const matureCandidate = allCandidates.find(
    (candidate) => candidate.selectionHints?.matureMomentum,
  );

  if (!matureCandidate) {
    return;
  }

  const replaceIndex = [...selected]
    .reverse()
    .findIndex((candidate) => !candidate.selectionHints?.matureMomentum);

  if (replaceIndex === -1) {
    return;
  }

  const index = selected.length - 1 - replaceIndex;
  const removed = selected[index];
  const removedTheme = removed.theme ?? "General OSS";
  const matureTheme = matureCandidate.theme ?? "General OSS";

  themeCounts.set(
    removedTheme,
    Math.max((themeCounts.get(removedTheme) ?? 1) - 1, 0),
  );
  themeCounts.set(matureTheme, (themeCounts.get(matureTheme) ?? 0) + 1);
  selected[index] = matureCandidate;
  const rejectedIndex = rejected.findIndex(
    (entry) => entry.candidate.repo === matureCandidate.repo,
  );

  if (rejectedIndex !== -1) {
    rejected.splice(rejectedIndex, 1);
  }

  rejected.unshift({
    candidate: removed,
    reason: "为保留一条成熟但持续升温的项目位而被替换。",
  });
}

function describeSources(sources: GitHubCandidateRepo["sources"]): string {
  if (sources.length >= 3) {
    return "Trending + 最近更新 + 最近创建";
  }

  return sources
    .map((source) => {
      switch (source) {
        case "trending":
          return "Trending";
        case "search_recently_updated":
          return "最近更新";
        case "search_recently_created":
          return "最近创建";
      }
    })
    .join(" + ");
}

function formatCompactNumber(value: number): string {
  if (value >= 10000) {
    return `${(value / 1000).toFixed(1).replace(/\.0$/, "")}k`;
  }

  return String(value);
}

function getBucketScore(
  days: number,
  buckets: ReadonlyArray<{ maxDays: number; score: number }>,
): number {
  const matchedBucket = buckets.find((bucket) => days <= bucket.maxDays);

  return matchedBucket?.score ?? 0;
}
