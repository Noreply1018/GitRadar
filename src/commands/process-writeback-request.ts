import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  parseDigestRulesConfig,
  type DigestRulesConfig,
} from "../config/digest-rules";
import {
  parseUserPreferencesConfig,
  stringifyUserPreferencesConfig,
  type UserPreferencesConfig,
} from "../config/user-preferences";
import {
  buildFeedbackState,
  parseFeedbackSubmission,
  stringifyEvents,
  stringifyFeedbackState,
} from "../feedback/store";
import { type FeedbackSubmission } from "../feedback/store";
import { type FeedbackEvent } from "../feedback/model";
import {
  parseScheduleSettings,
  stringifyScheduleSettings,
} from "../core/schedule";

type WritebackOperation =
  | "update_digest_rules"
  | "update_schedule"
  | "update_preferences"
  | "record_feedback";

interface WritebackPayloadMap {
  update_digest_rules: DigestRulesConfig;
  update_schedule: ReturnType<typeof parseScheduleSettings>;
  update_preferences: UserPreferencesConfig;
  record_feedback: FeedbackSubmission;
}

async function main(): Promise<void> {
  const rootDir = process.cwd();
  const operation = parseOperation(process.env.GR_WRITEBACK_OPERATION);
  const payload = decodePayload(process.env.GR_WRITEBACK_PAYLOAD_B64);

  switch (operation) {
    case "update_digest_rules":
      await applyDigestRulesWriteback(rootDir, payload);
      break;
    case "update_schedule":
      await applyScheduleWriteback(rootDir, payload);
      break;
    case "update_preferences":
      await applyPreferencesWriteback(rootDir, payload);
      break;
    case "record_feedback":
      await applyFeedbackWriteback(rootDir, payload);
      break;
  }

  console.log(`Applied GitRadar writeback operation: ${operation}`);
}

function parseOperation(value: string | undefined): WritebackOperation {
  if (
    value === "update_digest_rules" ||
    value === "update_schedule" ||
    value === "update_preferences" ||
    value === "record_feedback"
  ) {
    return value;
  }

  throw new Error(`Unsupported writeback operation: ${value ?? "undefined"}`);
}

function decodePayload(value: string | undefined): unknown {
  if (!value) {
    throw new Error("Missing GR_WRITEBACK_PAYLOAD_B64.");
  }

  return JSON.parse(Buffer.from(value, "base64").toString("utf8"));
}

async function applyDigestRulesWriteback(
  rootDir: string,
  payload: unknown,
): Promise<void> {
  const config = parseDigestRulesConfig(payload, "dispatchWriteback");
  const filePath = path.join(rootDir, "config", "digest-rules.json");
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(config, null, 2)}\n`, "utf8");
}

async function applyScheduleWriteback(
  rootDir: string,
  payload: unknown,
): Promise<void> {
  const settings = parseScheduleSettings(payload);
  const filePath = path.join(rootDir, "config", "schedule.json");
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, stringifyScheduleSettings(settings), "utf8");
}

async function applyPreferencesWriteback(
  rootDir: string,
  payload: unknown,
): Promise<void> {
  const preferences = parseUserPreferencesConfig(payload, "dispatchWriteback");
  const filePath = path.join(rootDir, "config", "user-preferences.json");
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(
    filePath,
    stringifyUserPreferencesConfig(preferences),
    "utf8",
  );
}

async function applyFeedbackWriteback(
  rootDir: string,
  payload: unknown,
): Promise<void> {
  const event = parseFeedbackSubmission(payload);
  const eventsPath = path.join(
    rootDir,
    "data",
    "feedback",
    "feedback-events.jsonl",
  );
  const statePath = path.join(
    rootDir,
    "data",
    "feedback",
    "feedback-state.json",
  );

  await mkdir(path.dirname(eventsPath), { recursive: true });
  const currentEvents = await readFeedbackEvents(eventsPath);
  const nextEvents = [...currentEvents, event];
  const nextState = buildFeedbackState(nextEvents);

  await writeFile(eventsPath, stringifyEvents(nextEvents), "utf8");
  await writeFile(statePath, stringifyFeedbackState(nextState), "utf8");
}

async function readFeedbackEvents(
  eventsPath: string,
): Promise<FeedbackEvent[]> {
  try {
    const content = await readFile(eventsPath, "utf8");
    return content
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => JSON.parse(line) as FeedbackEvent);
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      return [];
    }

    throw error;
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`GitRadar writeback failed: ${message}`);
  process.exitCode = 1;
});
