import fs from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { getIsoTimestamp } from "../core/date";
import {
  EMPTY_FEEDBACK_STATE,
  isFeedbackAction,
  type FeedbackAction,
  type FeedbackEvent,
  type FeedbackState,
  type FeedbackStateEntry,
  type ThemeFeedbackStats,
} from "./model";

const FEEDBACK_EVENTS_FILE = "feedback-events.jsonl";
const FEEDBACK_STATE_FILE = "feedback-state.json";
const MAX_RECENT_EVENTS = 12;

export interface FeedbackSubmission {
  repo: string;
  date: string;
  action: FeedbackAction;
  theme?: string;
}

export function getFeedbackEventsPath(rootDir: string): string {
  return path.join(rootDir, "data", "runtime", FEEDBACK_EVENTS_FILE);
}

export function getFeedbackStatePath(rootDir: string): string {
  return path.join(rootDir, "data", "runtime", FEEDBACK_STATE_FILE);
}

export async function readFeedbackState(
  rootDir: string,
): Promise<FeedbackState> {
  const statePath = getFeedbackStatePath(rootDir);

  try {
    const content = await readFile(statePath, "utf8");
    return parseFeedbackState(JSON.parse(content));
  } catch (error) {
    if (isMissingFileError(error)) {
      return { ...EMPTY_FEEDBACK_STATE };
    }

    throw error;
  }
}

export function readFeedbackStateSync(rootDir: string): FeedbackState {
  const statePath = getFeedbackStatePath(rootDir);

  try {
    const content = fs.readFileSync(statePath, "utf8");
    return parseFeedbackState(JSON.parse(content));
  } catch (error) {
    if (isMissingFileError(error)) {
      return { ...EMPTY_FEEDBACK_STATE };
    }

    throw error;
  }
}

export async function recordFeedback(
  rootDir: string,
  submission: FeedbackSubmission,
): Promise<{ event: FeedbackEvent; state: FeedbackState }> {
  const event = parseFeedbackSubmission(submission);
  const eventsPath = getFeedbackEventsPath(rootDir);
  const statePath = getFeedbackStatePath(rootDir);

  await mkdir(path.dirname(eventsPath), { recursive: true });

  const currentEvents = await readFeedbackEvents(rootDir);
  const nextEvents = [...currentEvents, event];
  const nextState = buildFeedbackState(nextEvents);

  await writeFile(eventsPath, stringifyEvents(nextEvents), "utf8");
  await writeFile(statePath, stringifyFeedbackState(nextState), "utf8");

  return {
    event,
    state: nextState,
  };
}

export async function readFeedbackEvents(
  rootDir: string,
): Promise<FeedbackEvent[]> {
  const eventsPath = getFeedbackEventsPath(rootDir);

  try {
    const content = await readFile(eventsPath, "utf8");

    return content
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => parseFeedbackEvent(JSON.parse(line)));
  } catch (error) {
    if (isMissingFileError(error)) {
      return [];
    }

    throw error;
  }
}

export function parseFeedbackSubmission(input: unknown): FeedbackEvent {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("feedback 必须是对象。");
  }

  const value = input as Record<string, unknown>;
  const repo = requireNonEmptyString(value.repo, "feedback.repo");
  const date = requireDateString(value.date, "feedback.date");
  const action = value.action;
  const theme = normalizeOptionalString(value.theme);

  if (!isFeedbackAction(action)) {
    throw new Error("feedback.action 必须是 saved、skipped 或 later。");
  }

  return {
    repo,
    date,
    action,
    theme,
    recordedAt: getIsoTimestamp(),
  };
}

export function parseFeedbackEvent(input: unknown): FeedbackEvent {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("feedback event 必须是对象。");
  }

  const value = input as Record<string, unknown>;
  const action = value.action;

  if (!isFeedbackAction(action)) {
    throw new Error("feedback event action 非法。");
  }

  return {
    repo: requireNonEmptyString(value.repo, "feedbackEvent.repo"),
    date: requireDateString(value.date, "feedbackEvent.date"),
    action,
    theme: normalizeOptionalString(value.theme),
    recordedAt: requireIsoString(value.recordedAt, "feedbackEvent.recordedAt"),
  };
}

export function parseFeedbackState(input: unknown): FeedbackState {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("feedback state 必须是对象。");
  }

  const value = input as Record<string, unknown>;
  const repoStates = normalizeRepoStates(value.repoStates);
  const themeStats = normalizeThemeStats(value.themeStats);
  const recent = Array.isArray(value.recent)
    ? value.recent.map((item) => parseFeedbackEvent(item))
    : [];

  return {
    repoStates,
    themeStats,
    recent,
  };
}

export function buildFeedbackState(events: FeedbackEvent[]): FeedbackState {
  const repoStates: Record<string, FeedbackStateEntry> = {};
  const themeStats = new Map<string, ThemeFeedbackStats>();

  for (const event of events) {
    repoStates[event.repo] = {
      repo: event.repo,
      date: event.date,
      action: event.action,
      theme: event.theme,
      recordedAt: event.recordedAt,
    };
  }

  for (const state of Object.values(repoStates)) {
    if (!state.theme) {
      continue;
    }

    const current = themeStats.get(state.theme) ?? { saved: 0, skipped: 0 };

    if (state.action === "saved") {
      current.saved += 1;
    } else if (state.action === "skipped") {
      current.skipped += 1;
    }

    themeStats.set(state.theme, current);
  }

  return {
    repoStates,
    themeStats: Object.fromEntries(themeStats),
    recent: [...events].slice(-MAX_RECENT_EVENTS).reverse(),
  };
}

export function stringifyFeedbackState(state: FeedbackState): string {
  return `${JSON.stringify(state, null, 2)}\n`;
}

function stringifyEvents(events: FeedbackEvent[]): string {
  return `${events.map((event) => JSON.stringify(event)).join("\n")}\n`;
}

function normalizeRepoStates(
  value: unknown,
): Record<string, FeedbackStateEntry> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([repo, entry]) => {
      const parsed = parseFeedbackEvent(entry);
      return [repo, parsed];
    }),
  );
}

function normalizeThemeStats(
  value: unknown,
): Record<string, ThemeFeedbackStats> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([theme, stats]) => {
      const record =
        stats && typeof stats === "object" && !Array.isArray(stats)
          ? (stats as Record<string, unknown>)
          : {};

      return [
        theme,
        {
          saved: typeof record.saved === "number" ? record.saved : 0,
          skipped: typeof record.skipped === "number" ? record.skipped : 0,
        },
      ];
    }),
  );
}

function requireNonEmptyString(value: unknown, source: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${source} 必须是非空字符串。`);
  }

  return value.trim();
}

function requireDateString(value: unknown, source: string): string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`${source} 必须是 YYYY-MM-DD 格式。`);
  }

  return value;
}

function requireIsoString(value: unknown, source: string): string {
  if (typeof value !== "string" || Number.isNaN(Date.parse(value))) {
    throw new Error(`${source} 必须是合法时间字符串。`);
  }

  return value;
}

function normalizeOptionalString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
}

function isMissingFileError(error: unknown): boolean {
  return Boolean(
    error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "ENOENT",
  );
}
