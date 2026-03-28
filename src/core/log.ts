import { getIsoTimestamp } from "./date";

export interface WorkflowLogger {
  info(event: string, context?: Record<string, unknown>): void;
  warn(event: string, context?: Record<string, unknown>): void;
  error(event: string, context?: Record<string, unknown>): void;
}

export function createWorkflowLogger(scope: string): WorkflowLogger {
  return {
    info(event, context) {
      writeLog("info", scope, event, context);
    },
    warn(event, context) {
      writeLog("warn", scope, event, context);
    },
    error(event, context) {
      writeLog("error", scope, event, context);
    },
  };
}

function writeLog(
  level: "info" | "warn" | "error",
  scope: string,
  event: string,
  context?: Record<string, unknown>,
): void {
  const line = JSON.stringify({
    ts: getIsoTimestamp(),
    level,
    scope,
    event,
    ...(context ? { context } : {}),
  });

  if (level === "error") {
    console.error(line);
    return;
  }

  console.log(line);
}
