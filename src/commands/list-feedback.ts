import { listFeedbackEvents, type FeedbackQuery } from "../feedback/store";
import type { FeedbackAction, FeedbackEvent } from "../feedback/model";

interface ListFeedbackArgs extends FeedbackQuery {
  format: "text" | "json";
}

const DEFAULT_LIMIT = 20;

async function main(): Promise<void> {
  const args = parseListFeedbackArgs(process.argv.slice(2));
  const events = await listFeedbackEvents(process.cwd(), {
    action: args.action,
    theme: args.theme,
    repo: args.repo,
    limit: args.limit,
  });

  if (args.format === "json") {
    console.log(JSON.stringify(events, null, 2));
    return;
  }

  console.log(renderFeedbackList(events, args));
}

export function parseListFeedbackArgs(argv: string[]): ListFeedbackArgs {
  const action = parseActionValue(readOptionalFlagValue(argv, "--action"));
  const theme = readOptionalFlagValue(argv, "--theme");
  const repo = readOptionalFlagValue(argv, "--repo");
  const formatValue = readOptionalFlagValue(argv, "--format");
  const limitValue = readOptionalFlagValue(argv, "--limit");

  if (!formatValue) {
    return {
      action,
      theme,
      repo,
      limit: limitValue ? parseLimit(limitValue) : DEFAULT_LIMIT,
      format: "text",
    };
  }

  if (formatValue !== "text" && formatValue !== "json") {
    throw new Error("Invalid --format value. Use text or json.");
  }

  return {
    action,
    theme,
    repo,
    limit: limitValue ? parseLimit(limitValue) : DEFAULT_LIMIT,
    format: formatValue,
  };
}

export function renderFeedbackList(
  events: FeedbackEvent[],
  args: Pick<ListFeedbackArgs, "action" | "theme" | "repo" | "limit">,
): string {
  const lines = [
    "# GitRadar Feedback",
    "",
    `总记录数：${events.length}`,
    `动作筛选：${args.action ? describeAction(args.action) : "全部"}`,
    `主题筛选：${args.theme ?? "全部"}`,
    `仓库筛选：${args.repo ?? "全部"}`,
    `显示上限：${args.limit ?? "不限"}`,
  ];

  if (events.length === 0) {
    lines.push("", "没有匹配的反馈记录。");
    return lines.join("\n");
  }

  lines.push("", "## 反馈列表");

  for (const [index, event] of events.entries()) {
    lines.push(
      `${index + 1}. [${describeAction(event.action)}] ${event.repo}${event.theme ? ` [${event.theme}]` : ""}`,
      `   日报日期：${event.date}`,
      `   记录时间：${event.recordedAt}`,
    );
  }

  return lines.join("\n");
}

function parseLimit(value: string): number {
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error("Invalid --limit value. Use a positive integer.");
  }

  return parsed;
}

function readOptionalFlagValue(
  argv: string[],
  flag: "--action" | "--theme" | "--repo" | "--format" | "--limit",
): string | undefined {
  const index = argv.indexOf(flag);

  if (index === -1) {
    return undefined;
  }

  const value = argv[index + 1]?.trim();

  if (!value) {
    throw new Error(`Missing value for ${flag}.`);
  }

  return value;
}

function isFeedbackAction(value: string): value is FeedbackAction {
  return value === "saved" || value === "later" || value === "skipped";
}

function parseActionValue(
  value: string | undefined,
): FeedbackAction | undefined {
  if (!value) {
    return undefined;
  }

  if (!isFeedbackAction(value)) {
    throw new Error("Invalid --action value. Use saved, later, or skipped.");
  }

  return value;
}

function describeAction(action: FeedbackAction): string {
  switch (action) {
    case "saved":
      return "收藏";
    case "later":
      return "稍后看";
    case "skipped":
      return "跳过";
  }
}

if (isDirectExecution()) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`GitRadar feedback list failed: ${message}`);
    process.exitCode = 1;
  });
}

function isDirectExecution(): boolean {
  const entry = process.argv[1];

  if (!entry) {
    return false;
  }

  return /list-feedback\.(ts|js)$/.test(entry);
}
