import type { UserPreferencesConfig } from "../config/user-preferences";
import type { FeedbackEvent, FeedbackState } from "./model";

export interface ThemeInsight {
  theme: string;
  savedCount: number;
  skippedCount: number;
  netScore: number;
  reason: string;
}

export interface PreferenceSuggestion {
  theme: string;
  suggestedAction: "prefer";
  confidence: "medium" | "high";
  reason: string;
  sourceWindow: string;
}

export interface FeedbackInsights {
  interestedThemes: ThemeInsight[];
  skippedThemes: ThemeInsight[];
  preferenceSuggestion: PreferenceSuggestion | null;
}

const THEME_LIMIT = 3;
const SUGGESTION_MIN_SAVED = 2;
const RECENT_WINDOW = 8;

export function buildFeedbackInsights(
  feedbackState: FeedbackState,
  preferences: UserPreferencesConfig,
): FeedbackInsights {
  const interestedThemes = buildInterestedThemes(feedbackState);
  const skippedThemes = buildSkippedThemes(feedbackState);

  return {
    interestedThemes,
    skippedThemes,
    preferenceSuggestion: buildPreferenceSuggestion(
      feedbackState.recent,
      preferences,
      interestedThemes,
    ),
  };
}

function buildInterestedThemes(feedbackState: FeedbackState): ThemeInsight[] {
  return Object.entries(feedbackState.themeStats)
    .map(([theme, stats]) => ({
      theme,
      savedCount: stats.saved,
      skippedCount: stats.skipped,
      netScore: stats.saved * 2 - stats.skipped,
      reason: buildInterestedReason(stats.saved, stats.skipped),
    }))
    .filter((item) => item.savedCount > 0)
    .sort(compareThemeInsight)
    .slice(0, THEME_LIMIT);
}

function buildSkippedThemes(feedbackState: FeedbackState): ThemeInsight[] {
  return Object.entries(feedbackState.themeStats)
    .map(([theme, stats]) => ({
      theme,
      savedCount: stats.saved,
      skippedCount: stats.skipped,
      netScore: stats.saved - stats.skipped * 2,
      reason: buildSkippedReason(stats.saved, stats.skipped),
    }))
    .filter((item) => item.skippedCount > 0)
    .sort((left, right) => {
      const skippedDelta = right.skippedCount - left.skippedCount;
      if (skippedDelta !== 0) {
        return skippedDelta;
      }

      return left.savedCount - right.savedCount;
    })
    .slice(0, THEME_LIMIT);
}

function buildPreferenceSuggestion(
  recent: FeedbackEvent[],
  preferences: UserPreferencesConfig,
  interestedThemes: ThemeInsight[],
): PreferenceSuggestion | null {
  const preferredThemeSet = new Set(preferences.preferredThemes);
  const recentEvents = recent.slice(0, RECENT_WINDOW);
  const streakByTheme = new Map<string, number>();

  for (const event of recentEvents) {
    if (!event.theme || event.action !== "saved") {
      continue;
    }

    streakByTheme.set(event.theme, (streakByTheme.get(event.theme) ?? 0) + 1);
  }

  for (const theme of interestedThemes) {
    const recentSaved = streakByTheme.get(theme.theme) ?? 0;
    if (
      preferredThemeSet.has(theme.theme) ||
      recentSaved < SUGGESTION_MIN_SAVED
    ) {
      continue;
    }

    return {
      theme: theme.theme,
      suggestedAction: "prefer",
      confidence: recentSaved >= 3 ? "high" : "medium",
      reason: `你最近连续收藏了 ${theme.theme}，可以把它加入关心主题，后续日报会更主动保留这类项目。`,
      sourceWindow: `最近 ${Math.min(recentEvents.length, RECENT_WINDOW)} 条反馈`,
    };
  }

  return null;
}

function compareThemeInsight(left: ThemeInsight, right: ThemeInsight): number {
  const netDelta = right.netScore - left.netScore;
  if (netDelta !== 0) {
    return netDelta;
  }

  const savedDelta = right.savedCount - left.savedCount;
  if (savedDelta !== 0) {
    return savedDelta;
  }

  return left.skippedCount - right.skippedCount;
}

function buildInterestedReason(saved: number, skipped: number): string {
  if (saved >= 3 && skipped === 0) {
    return "连续收藏，已经形成稳定兴趣。";
  }

  if (saved >= 2 && skipped <= 1) {
    return "近期多次收藏，相关性持续偏高。";
  }

  return "收藏反馈多于跳过，值得继续跟踪。";
}

function buildSkippedReason(saved: number, skipped: number): string {
  if (skipped >= 3 && saved === 0) {
    return "最近连续跳过，短期兴趣明显偏低。";
  }

  if (skipped >= 2) {
    return "近期多次跳过，建议降低阅读预期。";
  }

  return "最近更容易被你略过。";
}
