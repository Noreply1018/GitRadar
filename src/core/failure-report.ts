import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { getCurrentDigestDate, getIsoTimestamp } from "./date";

export interface DailyDigestFailureReport {
  occurredAt: string;
  digestDate: string;
  workflow: "generate_daily_digest";
  stage:
    | "source_trending"
    | "editorial_model"
    | "generate_daily_digest"
    | "delivery_wecom";
  fallbackUsed: boolean;
  error: {
    message: string;
    stack?: string;
  };
  context: Record<string, unknown>;
}

export async function writeDailyDigestFailureReport(
  rootDir: string,
  report: Omit<DailyDigestFailureReport, "occurredAt" | "digestDate"> & {
    digestDate?: string;
  },
): Promise<string> {
  const occurredAt = getIsoTimestamp();
  const digestDate = report.digestDate ?? getCurrentDigestDate();
  const failuresDir = path.join(rootDir, "data", "runtime", "failures");
  await mkdir(failuresDir, { recursive: true });

  const fileName = `${toFileTimestamp(occurredAt)}-${sanitizePathComponent(report.stage)}.json`;
  const outputPath = path.join(failuresDir, fileName);
  const payload: DailyDigestFailureReport = {
    occurredAt,
    digestDate,
    workflow: report.workflow,
    stage: report.stage,
    fallbackUsed: report.fallbackUsed,
    error: report.error,
    context: report.context,
  };

  await writeFile(outputPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");

  return outputPath;
}

export function toErrorPayload(
  error: unknown,
): DailyDigestFailureReport["error"] {
  if (error instanceof Error) {
    return {
      message: error.message,
      stack: error.stack,
    };
  }

  return {
    message: String(error),
  };
}

function toFileTimestamp(isoTimestamp: string): string {
  return isoTimestamp.replace(/[:.]/g, "-");
}

function sanitizePathComponent(input: string): string {
  return input.replace(/[^a-z0-9_-]+/gi, "-");
}
