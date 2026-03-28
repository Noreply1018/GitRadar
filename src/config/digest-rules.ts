export interface DigestThemeDefinition {
  theme: string;
  keywords: readonly string[];
}

export interface DigestScoreBucket {
  maxDays: number;
  score: number;
}

export interface DigestRulesConfig {
  version: string;
  themes: readonly DigestThemeDefinition[];
  blacklists: {
    descriptionKeywords: readonly string[];
    readmeKeywords: readonly string[];
    topics: readonly string[];
  };
  selection: {
    shortlistMaxPerTheme: number;
    poolMaxPerTheme: number;
    ensureMatureMomentum: boolean;
  };
  thresholds: {
    maxPushedDays: number;
    sourceOverlapHighWatermark: number;
    sourceOverlapMediumWatermark: number;
    strongDescriptionLength: number;
    mediumDescriptionLength: number;
    veryMatureAgeDays: number;
    veryMatureMinStars: number;
    sustainedMomentumAgeDays: number;
    sustainedMomentumPushDays: number;
    matureMomentumAgeDays: number;
    matureMomentumPushDays: number;
    matureMomentumMinStars: number;
    recentCreatedPushBonusDays: number;
    recentPushMomentum: readonly DigestScoreBucket[];
    recentCreationNovelty: readonly DigestScoreBucket[];
    evidenceHighStarCount: number;
    evidenceMediumStarCount: number;
    evidenceVeryRecentPushDays: number;
    evidenceRecentPushDays: number;
    evidenceVeryNewProjectDays: number;
    evidenceNewProjectDays: number;
  };
  weights: {
    sourceSignals: {
      trending: {
        momentum: number;
        novelty: number;
      };
      searchRecentlyUpdated: {
        momentum: number;
      };
      searchRecentlyCreated: {
        novelty: number;
        recentPushBonus: number;
      };
    };
    sourceOverlap: {
      high: {
        momentum: number;
        coverage: number;
      };
      medium: {
        momentum: number;
        coverage: number;
      };
    };
    maturity: {
      starLogMultiplier: number;
      starCap: number;
      forkLogMultiplier: number;
      forkCap: number;
      sustainedMomentumBonus: {
        momentum: number;
        maturity: number;
      };
      veryMatureSingleSourcePenalty: number;
    };
    coverage: {
      topicMultiplier: number;
      topicCap: number;
      strongDescription: number;
      mediumDescription: number;
      readme: number;
      missingReadmePenalty: number;
      language: number;
    };
  };
}

export const DIGEST_RULES_CONFIG = {
  version: "2026-03-evidence-v1",
  themes: [
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
  ],
  blacklists: {
    descriptionKeywords: [
      "awesome",
      "curated list",
      "leetcode",
      "dotfiles",
      "personal website",
      "boilerplate",
      "template",
      "starter",
      "tutorial",
      "cookbook",
      "cheatsheet",
    ],
    readmeKeywords: [
      "awesome list",
      "curated list",
      "boilerplate",
      "template",
      "starter",
      "tutorial",
      "getting started",
      "course",
      "cookbook",
    ],
    topics: [
      "awesome",
      "boilerplate",
      "cheatsheet",
      "course",
      "starter",
      "template",
      "tutorial",
    ],
  },
  selection: {
    shortlistMaxPerTheme: 4,
    poolMaxPerTheme: 2,
    ensureMatureMomentum: true,
  },
  thresholds: {
    maxPushedDays: 180,
    sourceOverlapHighWatermark: 3,
    sourceOverlapMediumWatermark: 2,
    strongDescriptionLength: 30,
    mediumDescriptionLength: 12,
    veryMatureAgeDays: 365,
    veryMatureMinStars: 20000,
    sustainedMomentumAgeDays: 365,
    sustainedMomentumPushDays: 7,
    matureMomentumAgeDays: 365,
    matureMomentumPushDays: 7,
    matureMomentumMinStars: 1000,
    recentCreatedPushBonusDays: 7,
    recentPushMomentum: [
      { maxDays: 3, score: 26 },
      { maxDays: 7, score: 20 },
      { maxDays: 14, score: 14 },
      { maxDays: 30, score: 7 },
      { maxDays: 90, score: 2 },
    ],
    recentCreationNovelty: [
      { maxDays: 14, score: 18 },
      { maxDays: 30, score: 14 },
      { maxDays: 90, score: 6 },
    ],
    evidenceHighStarCount: 10000,
    evidenceMediumStarCount: 1000,
    evidenceVeryRecentPushDays: 3,
    evidenceRecentPushDays: 7,
    evidenceVeryNewProjectDays: 14,
    evidenceNewProjectDays: 30,
  },
  weights: {
    sourceSignals: {
      trending: {
        momentum: 20,
        novelty: 10,
      },
      searchRecentlyUpdated: {
        momentum: 18,
      },
      searchRecentlyCreated: {
        novelty: 18,
        recentPushBonus: 6,
      },
    },
    sourceOverlap: {
      high: {
        momentum: 12,
        coverage: 12,
      },
      medium: {
        momentum: 6,
        coverage: 6,
      },
    },
    maturity: {
      starLogMultiplier: 9,
      starCap: 22,
      forkLogMultiplier: 3,
      forkCap: 8,
      sustainedMomentumBonus: {
        momentum: 8,
        maturity: 4,
      },
      veryMatureSingleSourcePenalty: -10,
    },
    coverage: {
      topicMultiplier: 1.5,
      topicCap: 8,
      strongDescription: 8,
      mediumDescription: 4,
      readme: 4,
      missingReadmePenalty: -5,
      language: 2,
    },
  },
} as const satisfies DigestRulesConfig;

export const DIGEST_DESCRIPTION_BLACKLIST = createKeywordRegex(
  DIGEST_RULES_CONFIG.blacklists.descriptionKeywords,
);
export const DIGEST_README_BLACKLIST = createKeywordRegex(
  DIGEST_RULES_CONFIG.blacklists.readmeKeywords,
);
export const DIGEST_TOPIC_BLACKLIST = new Set(
  DIGEST_RULES_CONFIG.blacklists.topics.map((topic) => topic.toLowerCase()),
);

function createKeywordRegex(keywords: readonly string[]): RegExp {
  return new RegExp(`\\b(${keywords.map(escapeRegex).join("|")})\\b`, "i");
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
