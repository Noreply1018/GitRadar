import { getDaysSince } from "../core/date";
import type {
  CandidateScoreBreakdown,
  GitHubCandidateRepo,
} from "../github/types";

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

const RULES_VERSION = "2026-03-evidence-v1";

const THEME_DEFINITIONS = [
  {
    theme: "AI Agents",
    keywords: [
      "agent",
      "agentic",
      "assistant",
      "copilot",
      "workflow",
      "orchestration",
      "autonomous",
      "tool calling",
      "multi-agent",
      "openshell",
    ],
  },
  {
    theme: "AI Research",
    keywords: [
      "research",
      "training",
      "paper",
      "benchmark",
      "evaluation",
      "citation",
      "finetune",
      "fine-tune",
      "self-evolving",
      "model",
    ],
  },
  {
    theme: "Infra & Runtime",
    keywords: [
      "runtime",
      "scheduler",
      "sandbox",
      "orchestrator",
      "deployment",
      "kubernetes",
      "server",
      "distributed",
      "operating system",
      "platform",
    ],
  },
  {
    theme: "Developer Tools",
    keywords: [
      "cli",
      "terminal",
      "developer",
      "tooling",
      "editor",
      "git",
      "automation",
      "productivity",
      "electron",
      "command line",
    ],
  },
  {
    theme: "Data & Search",
    keywords: [
      "search",
      "retrieval",
      "rag",
      "vector",
      "database",
      "data",
      "analytics",
      "index",
      "crawler",
      "knowledge",
    ],
  },
  {
    theme: "Observability & Security",
    keywords: [
      "observability",
      "monitoring",
      "trace",
      "profiling",
      "security",
      "audit",
      "policy",
      "compliance",
      "risk",
      "guardrail",
    ],
  },
  {
    theme: "Frontend & Design",
    keywords: [
      "ui",
      "frontend",
      "design",
      "component",
      "animation",
      "css",
      "web",
      "visual",
      "interaction",
      "design system",
    ],
  },
] as const;

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
    .filter((candidate) => getDaysSince(candidate.pushedAt) <= 180)
    .filter((candidate) => !DESCRIPTION_BLACKLIST.test(candidate.description))
    .filter((candidate) => !hasBlacklistedTopic(candidate.topics))
    .filter((candidate) => !hasBlacklistedReadme(candidate.readmeExcerpt))
    .map(annotateCandidate)
    .sort(compareCandidates);

  return applyDiversity(annotated, limit, {
    maxPerTheme: 4,
  }).selected;
}

export function buildDigestCandidatePool(
  candidates: GitHubCandidateRepo[],
  limit = 8,
): CandidateSelectionResult {
  return applyDiversity(candidates, limit, {
    maxPerTheme: 2,
    ensureMatureMomentum: true,
  });
}

export function getRulesVersion(): string {
  return RULES_VERSION;
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
  const isVeryMature = createdDays > 365 && candidate.stars >= 20000;
  const sustainedMomentum = createdDays > 365 && pushedDays <= 7;
  let momentum = 0;
  let novelty = 0;
  let maturity = 0;
  let coverage = 0;
  let penalties = 0;

  if (candidate.sources.includes("trending")) {
    momentum += 20;
    novelty += 10;
  }
  if (candidate.sources.includes("search_recently_updated")) {
    momentum += 18;
  }
  if (candidate.sources.includes("search_recently_created")) {
    novelty += 18;
  }

  if (sourceCount >= 3) {
    momentum += 12;
    coverage += 12;
  } else if (sourceCount === 2) {
    momentum += 6;
    coverage += 6;
  }

  maturity += Math.min(22, Math.log10(candidate.stars + 1) * 9);
  maturity += Math.min(8, Math.log10(candidate.forks + 1) * 3);
  coverage += Math.min(8, candidate.topics.length * 1.5);

  if (candidate.description.length >= 30) {
    coverage += 8;
  } else if (candidate.description.length >= 12) {
    coverage += 4;
  }

  if (pushedDays <= 3) {
    momentum += 26;
  } else if (pushedDays <= 7) {
    momentum += 20;
  } else if (pushedDays <= 14) {
    momentum += 14;
  } else if (pushedDays <= 30) {
    momentum += 7;
  } else if (pushedDays <= 90) {
    momentum += 2;
  }

  if (createdDays <= 14) {
    novelty += 18;
  } else if (createdDays <= 30) {
    novelty += 14;
  } else if (createdDays <= 90) {
    novelty += 6;
  }

  if (
    candidate.sources.includes("search_recently_created") &&
    pushedDays <= 7
  ) {
    novelty += 6;
  }

  if (sustainedMomentum) {
    momentum += 8;
    maturity += 4;
  }

  if (isVeryMature && sourceCount === 1) {
    penalties -= 10;
  }

  if (hasReadme) {
    coverage += 4;
  } else {
    penalties -= 5;
  }

  if (candidate.language) {
    coverage += 2;
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
  return topics.some((topic) => TOPIC_BLACKLIST.has(topic.toLowerCase()));
}

function hasBlacklistedReadme(readmeExcerpt?: string | null): boolean {
  return Boolean(readmeExcerpt && README_BLACKLIST.test(readmeExcerpt));
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

  for (const definition of THEME_DEFINITIONS) {
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
  const matureMomentum =
    createdDays > 365 && pushedDays <= 7 && candidate.stars >= 1000;
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
  if (candidate.stars >= 10000) {
    evidence.push(`Star ${formatCompactNumber(candidate.stars)}`);
  } else if (candidate.stars >= 1000) {
    evidence.push(`Star ${formatCompactNumber(candidate.stars)}`);
  }
  if (pushedDays <= 3) {
    evidence.push("近 3 天仍在推进");
  } else if (pushedDays <= 7) {
    evidence.push("近 7 天仍在推进");
  }
  if (createdDays <= 14) {
    evidence.push("两周内新项目");
  } else if (createdDays <= 30) {
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
