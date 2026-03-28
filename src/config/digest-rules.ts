import fs from "node:fs";
import path from "node:path";

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

const MAX_KEYWORD_THEME_REUSE = 2;
const DEFAULT_DIGEST_RULES_PATH = path.resolve(
  __dirname,
  "../../config/digest-rules.json",
);

export const DIGEST_RULES_CONFIG = loadDigestRulesConfig();
export const DIGEST_DESCRIPTION_BLACKLIST = createKeywordRegex(
  DIGEST_RULES_CONFIG.blacklists.descriptionKeywords,
);
export const DIGEST_README_BLACKLIST = createKeywordRegex(
  DIGEST_RULES_CONFIG.blacklists.readmeKeywords,
);
export const DIGEST_TOPIC_BLACKLIST = new Set(
  DIGEST_RULES_CONFIG.blacklists.topics.map((topic) => topic.toLowerCase()),
);

export function loadDigestRulesConfig(
  filePath = DEFAULT_DIGEST_RULES_PATH,
): DigestRulesConfig {
  let content: string;

  try {
    content = fs.readFileSync(filePath, "utf8");
  } catch (error) {
    throw new Error(
      `Failed to read digest rules config at ${filePath}: ${getErrorMessage(error)}`,
    );
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(content) as unknown;
  } catch (error) {
    throw new Error(
      `Failed to parse digest rules config at ${filePath}: ${getErrorMessage(error)}`,
    );
  }

  return parseDigestRulesConfig(parsed, filePath);
}

export function getDefaultDigestRulesConfigPath(): string {
  return DEFAULT_DIGEST_RULES_PATH;
}

export function parseDigestRulesConfig(
  value: unknown,
  source = "digest rules config",
): DigestRulesConfig {
  const config = requireObject(value, source);

  const themes = requireArray(config.themes, `${source}.themes`).map(
    (item, index) => {
      const themeConfig = requireObject(item, `${source}.themes[${index}]`);
      const theme = requireNonEmptyString(
        themeConfig.theme,
        `${source}.themes[${index}].theme`,
      );
      const keywords = requireStringArray(
        themeConfig.keywords,
        `${source}.themes[${index}].keywords`,
      );
      const uniqueKeywords = new Set(
        keywords.map((keyword) => normalizeKeyword(keyword)),
      );

      if (uniqueKeywords.size !== keywords.length) {
        throw new Error(
          `${source}.themes[${index}].keywords contains duplicate keywords.`,
        );
      }

      return {
        theme,
        keywords,
      };
    },
  );

  if (themes.length === 0) {
    throw new Error(`${source}.themes must contain at least one theme.`);
  }

  validateKeywordReuse(themes, source);

  const blacklistsObject = requireObject(
    config.blacklists,
    `${source}.blacklists`,
  );
  const selectionObject = requireObject(
    config.selection,
    `${source}.selection`,
  );
  const thresholdsObject = requireObject(
    config.thresholds,
    `${source}.thresholds`,
  );
  const weightsObject = requireObject(config.weights, `${source}.weights`);
  const sourceSignalsObject = requireObject(
    weightsObject.sourceSignals,
    `${source}.weights.sourceSignals`,
  );
  const sourceOverlapObject = requireObject(
    weightsObject.sourceOverlap,
    `${source}.weights.sourceOverlap`,
  );
  const maturityObject = requireObject(
    weightsObject.maturity,
    `${source}.weights.maturity`,
  );
  const coverageObject = requireObject(
    weightsObject.coverage,
    `${source}.weights.coverage`,
  );

  const parsed: DigestRulesConfig = {
    version: requireNonEmptyString(config.version, `${source}.version`),
    themes,
    blacklists: {
      descriptionKeywords: requireStringArray(
        blacklistsObject.descriptionKeywords,
        `${source}.blacklists.descriptionKeywords`,
      ),
      readmeKeywords: requireStringArray(
        blacklistsObject.readmeKeywords,
        `${source}.blacklists.readmeKeywords`,
      ),
      topics: requireStringArray(
        blacklistsObject.topics,
        `${source}.blacklists.topics`,
      ),
    },
    selection: {
      shortlistMaxPerTheme: requireNonNegativeNumber(
        selectionObject.shortlistMaxPerTheme,
        `${source}.selection.shortlistMaxPerTheme`,
      ),
      poolMaxPerTheme: requireNonNegativeNumber(
        selectionObject.poolMaxPerTheme,
        `${source}.selection.poolMaxPerTheme`,
      ),
      ensureMatureMomentum: requireBoolean(
        selectionObject.ensureMatureMomentum,
        `${source}.selection.ensureMatureMomentum`,
      ),
    },
    thresholds: {
      maxPushedDays: requireNonNegativeNumber(
        thresholdsObject.maxPushedDays,
        `${source}.thresholds.maxPushedDays`,
      ),
      sourceOverlapHighWatermark: requireNonNegativeNumber(
        thresholdsObject.sourceOverlapHighWatermark,
        `${source}.thresholds.sourceOverlapHighWatermark`,
      ),
      sourceOverlapMediumWatermark: requireNonNegativeNumber(
        thresholdsObject.sourceOverlapMediumWatermark,
        `${source}.thresholds.sourceOverlapMediumWatermark`,
      ),
      strongDescriptionLength: requireNonNegativeNumber(
        thresholdsObject.strongDescriptionLength,
        `${source}.thresholds.strongDescriptionLength`,
      ),
      mediumDescriptionLength: requireNonNegativeNumber(
        thresholdsObject.mediumDescriptionLength,
        `${source}.thresholds.mediumDescriptionLength`,
      ),
      veryMatureAgeDays: requireNonNegativeNumber(
        thresholdsObject.veryMatureAgeDays,
        `${source}.thresholds.veryMatureAgeDays`,
      ),
      veryMatureMinStars: requireNonNegativeNumber(
        thresholdsObject.veryMatureMinStars,
        `${source}.thresholds.veryMatureMinStars`,
      ),
      sustainedMomentumAgeDays: requireNonNegativeNumber(
        thresholdsObject.sustainedMomentumAgeDays,
        `${source}.thresholds.sustainedMomentumAgeDays`,
      ),
      sustainedMomentumPushDays: requireNonNegativeNumber(
        thresholdsObject.sustainedMomentumPushDays,
        `${source}.thresholds.sustainedMomentumPushDays`,
      ),
      matureMomentumAgeDays: requireNonNegativeNumber(
        thresholdsObject.matureMomentumAgeDays,
        `${source}.thresholds.matureMomentumAgeDays`,
      ),
      matureMomentumPushDays: requireNonNegativeNumber(
        thresholdsObject.matureMomentumPushDays,
        `${source}.thresholds.matureMomentumPushDays`,
      ),
      matureMomentumMinStars: requireNonNegativeNumber(
        thresholdsObject.matureMomentumMinStars,
        `${source}.thresholds.matureMomentumMinStars`,
      ),
      recentCreatedPushBonusDays: requireNonNegativeNumber(
        thresholdsObject.recentCreatedPushBonusDays,
        `${source}.thresholds.recentCreatedPushBonusDays`,
      ),
      recentPushMomentum: requireScoreBuckets(
        thresholdsObject.recentPushMomentum,
        `${source}.thresholds.recentPushMomentum`,
      ),
      recentCreationNovelty: requireScoreBuckets(
        thresholdsObject.recentCreationNovelty,
        `${source}.thresholds.recentCreationNovelty`,
      ),
      evidenceHighStarCount: requireNonNegativeNumber(
        thresholdsObject.evidenceHighStarCount,
        `${source}.thresholds.evidenceHighStarCount`,
      ),
      evidenceMediumStarCount: requireNonNegativeNumber(
        thresholdsObject.evidenceMediumStarCount,
        `${source}.thresholds.evidenceMediumStarCount`,
      ),
      evidenceVeryRecentPushDays: requireNonNegativeNumber(
        thresholdsObject.evidenceVeryRecentPushDays,
        `${source}.thresholds.evidenceVeryRecentPushDays`,
      ),
      evidenceRecentPushDays: requireNonNegativeNumber(
        thresholdsObject.evidenceRecentPushDays,
        `${source}.thresholds.evidenceRecentPushDays`,
      ),
      evidenceVeryNewProjectDays: requireNonNegativeNumber(
        thresholdsObject.evidenceVeryNewProjectDays,
        `${source}.thresholds.evidenceVeryNewProjectDays`,
      ),
      evidenceNewProjectDays: requireNonNegativeNumber(
        thresholdsObject.evidenceNewProjectDays,
        `${source}.thresholds.evidenceNewProjectDays`,
      ),
    },
    weights: {
      sourceSignals: {
        trending: {
          momentum: requireNumber(
            requireObject(
              sourceSignalsObject.trending,
              `${source}.weights.sourceSignals.trending`,
            ).momentum,
            `${source}.weights.sourceSignals.trending.momentum`,
          ),
          novelty: requireNumber(
            requireObject(
              sourceSignalsObject.trending,
              `${source}.weights.sourceSignals.trending`,
            ).novelty,
            `${source}.weights.sourceSignals.trending.novelty`,
          ),
        },
        searchRecentlyUpdated: {
          momentum: requireNumber(
            requireObject(
              sourceSignalsObject.searchRecentlyUpdated,
              `${source}.weights.sourceSignals.searchRecentlyUpdated`,
            ).momentum,
            `${source}.weights.sourceSignals.searchRecentlyUpdated.momentum`,
          ),
        },
        searchRecentlyCreated: {
          novelty: requireNumber(
            requireObject(
              sourceSignalsObject.searchRecentlyCreated,
              `${source}.weights.sourceSignals.searchRecentlyCreated`,
            ).novelty,
            `${source}.weights.sourceSignals.searchRecentlyCreated.novelty`,
          ),
          recentPushBonus: requireNumber(
            requireObject(
              sourceSignalsObject.searchRecentlyCreated,
              `${source}.weights.sourceSignals.searchRecentlyCreated`,
            ).recentPushBonus,
            `${source}.weights.sourceSignals.searchRecentlyCreated.recentPushBonus`,
          ),
        },
      },
      sourceOverlap: {
        high: {
          momentum: requireNumber(
            requireObject(
              sourceOverlapObject.high,
              `${source}.weights.sourceOverlap.high`,
            ).momentum,
            `${source}.weights.sourceOverlap.high.momentum`,
          ),
          coverage: requireNumber(
            requireObject(
              sourceOverlapObject.high,
              `${source}.weights.sourceOverlap.high`,
            ).coverage,
            `${source}.weights.sourceOverlap.high.coverage`,
          ),
        },
        medium: {
          momentum: requireNumber(
            requireObject(
              sourceOverlapObject.medium,
              `${source}.weights.sourceOverlap.medium`,
            ).momentum,
            `${source}.weights.sourceOverlap.medium.momentum`,
          ),
          coverage: requireNumber(
            requireObject(
              sourceOverlapObject.medium,
              `${source}.weights.sourceOverlap.medium`,
            ).coverage,
            `${source}.weights.sourceOverlap.medium.coverage`,
          ),
        },
      },
      maturity: {
        starLogMultiplier: requireNumber(
          maturityObject.starLogMultiplier,
          `${source}.weights.maturity.starLogMultiplier`,
        ),
        starCap: requireNumber(
          maturityObject.starCap,
          `${source}.weights.maturity.starCap`,
        ),
        forkLogMultiplier: requireNumber(
          maturityObject.forkLogMultiplier,
          `${source}.weights.maturity.forkLogMultiplier`,
        ),
        forkCap: requireNumber(
          maturityObject.forkCap,
          `${source}.weights.maturity.forkCap`,
        ),
        sustainedMomentumBonus: {
          momentum: requireNumber(
            requireObject(
              maturityObject.sustainedMomentumBonus,
              `${source}.weights.maturity.sustainedMomentumBonus`,
            ).momentum,
            `${source}.weights.maturity.sustainedMomentumBonus.momentum`,
          ),
          maturity: requireNumber(
            requireObject(
              maturityObject.sustainedMomentumBonus,
              `${source}.weights.maturity.sustainedMomentumBonus`,
            ).maturity,
            `${source}.weights.maturity.sustainedMomentumBonus.maturity`,
          ),
        },
        veryMatureSingleSourcePenalty: requireNumber(
          maturityObject.veryMatureSingleSourcePenalty,
          `${source}.weights.maturity.veryMatureSingleSourcePenalty`,
        ),
      },
      coverage: {
        topicMultiplier: requireNumber(
          coverageObject.topicMultiplier,
          `${source}.weights.coverage.topicMultiplier`,
        ),
        topicCap: requireNumber(
          coverageObject.topicCap,
          `${source}.weights.coverage.topicCap`,
        ),
        strongDescription: requireNumber(
          coverageObject.strongDescription,
          `${source}.weights.coverage.strongDescription`,
        ),
        mediumDescription: requireNumber(
          coverageObject.mediumDescription,
          `${source}.weights.coverage.mediumDescription`,
        ),
        readme: requireNumber(
          coverageObject.readme,
          `${source}.weights.coverage.readme`,
        ),
        missingReadmePenalty: requireNumber(
          coverageObject.missingReadmePenalty,
          `${source}.weights.coverage.missingReadmePenalty`,
        ),
        language: requireNumber(
          coverageObject.language,
          `${source}.weights.coverage.language`,
        ),
      },
    },
  };

  return parsed;
}

function validateKeywordReuse(
  themes: readonly DigestThemeDefinition[],
  source: string,
): void {
  const keywordThemes = new Map<string, Set<string>>();

  for (const theme of themes) {
    for (const keyword of theme.keywords) {
      const normalized = normalizeKeyword(keyword);
      const ownerThemes = keywordThemes.get(normalized) ?? new Set<string>();
      ownerThemes.add(theme.theme);
      keywordThemes.set(normalized, ownerThemes);
    }
  }

  for (const [keyword, ownerThemes] of keywordThemes) {
    if (ownerThemes.size > MAX_KEYWORD_THEME_REUSE) {
      throw new Error(
        `${source}.themes reuses keyword "${keyword}" across ${ownerThemes.size} themes, exceeding the limit of ${MAX_KEYWORD_THEME_REUSE}.`,
      );
    }
  }
}

function requireScoreBuckets(
  value: unknown,
  fieldPath: string,
): DigestScoreBucket[] {
  const buckets = requireArray(value, fieldPath).map((item, index) => {
    const bucket = requireObject(item, `${fieldPath}[${index}]`);

    return {
      maxDays: requireNonNegativeNumber(
        bucket.maxDays,
        `${fieldPath}[${index}].maxDays`,
      ),
      score: requireNumber(bucket.score, `${fieldPath}[${index}].score`),
    };
  });

  if (buckets.length === 0) {
    throw new Error(`${fieldPath} must contain at least one bucket.`);
  }

  for (let index = 1; index < buckets.length; index += 1) {
    if (buckets[index].maxDays <= buckets[index - 1].maxDays) {
      throw new Error(
        `${fieldPath} maxDays must be strictly increasing at index ${index}.`,
      );
    }
  }

  return buckets;
}

function requireObject(
  value: unknown,
  fieldPath: string,
): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${fieldPath} must be an object.`);
  }

  return value as Record<string, unknown>;
}

function requireArray(value: unknown, fieldPath: string): unknown[] {
  if (!Array.isArray(value)) {
    throw new Error(`${fieldPath} must be an array.`);
  }

  return value;
}

function requireBoolean(value: unknown, fieldPath: string): boolean {
  if (typeof value !== "boolean") {
    throw new Error(`${fieldPath} must be a boolean.`);
  }

  return value;
}

function requireNumber(value: unknown, fieldPath: string): number {
  if (typeof value !== "number" || Number.isNaN(value)) {
    throw new Error(`${fieldPath} must be a valid number.`);
  }

  return value;
}

function requireNonNegativeNumber(value: unknown, fieldPath: string): number {
  const parsed = requireNumber(value, fieldPath);

  if (parsed < 0) {
    throw new Error(`${fieldPath} must be a non-negative number.`);
  }

  return parsed;
}

function requireNonEmptyString(value: unknown, fieldPath: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${fieldPath} must be a non-empty string.`);
  }

  return value.trim();
}

function requireStringArray(value: unknown, fieldPath: string): string[] {
  const items = requireArray(value, fieldPath).map((item, index) =>
    requireNonEmptyString(item, `${fieldPath}[${index}]`),
  );

  if (items.length === 0) {
    throw new Error(`${fieldPath} must contain at least one string.`);
  }

  return items;
}

function createKeywordRegex(keywords: readonly string[]): RegExp {
  return new RegExp(`\\b(${keywords.map(escapeRegex).join("|")})\\b`, "i");
}

function normalizeKeyword(value: string): string {
  return value.trim().toLowerCase();
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
