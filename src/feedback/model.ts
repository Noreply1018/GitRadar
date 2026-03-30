export type FeedbackAction = "saved" | "skipped" | "later";

export interface FeedbackEvent {
  repo: string;
  date: string;
  action: FeedbackAction;
  theme?: string;
  recordedAt: string;
}

export interface FeedbackStateEntry {
  repo: string;
  date: string;
  action: FeedbackAction;
  theme?: string;
  recordedAt: string;
}

export interface ThemeFeedbackStats {
  saved: number;
  skipped: number;
}

export interface FeedbackState {
  repoStates: Record<string, FeedbackStateEntry>;
  themeStats: Record<string, ThemeFeedbackStats>;
  recent: FeedbackEvent[];
}

export const EMPTY_FEEDBACK_STATE: FeedbackState = {
  repoStates: {},
  themeStats: {},
  recent: [],
};

export function isFeedbackAction(value: unknown): value is FeedbackAction {
  return value === "saved" || value === "skipped" || value === "later";
}
