import {
  detectLatestArchiveDate,
  writeGitHubExecutionState,
} from "../core/github-execution-state";

async function main(): Promise<void> {
  const rootDir = process.cwd();
  const lastArchiveDate = await detectLatestArchiveDate(rootDir);
  const state = await writeGitHubExecutionState(rootDir, {
    workflowName: process.env.GITRADAR_WORKFLOW_NAME,
    trigger: process.env.GITRADAR_TRIGGER,
    lastRunAt: process.env.GITRADAR_LAST_RUN_AT,
    lastRunStatus: normalizeStatus(process.env.GITRADAR_JOB_STATUS),
    lastArchiveDate,
    runUrl: process.env.WORKFLOW_RUN_URL,
    ref: process.env.GITRADAR_REF_NAME,
  });

  console.log(
    `GitHub runtime state written to data/runtime/github-runtime.json`,
  );
  console.log(`Status: ${state.lastRunStatus}`);
  console.log(`Last archive date: ${state.lastArchiveDate ?? "none"}`);
}

function normalizeStatus(
  value: string | undefined,
): "success" | "failure" | "unknown" {
  if (value === "success" || value === "failure") {
    return value;
  }

  return "unknown";
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`GitRadar runtime persistence failed: ${message}`);
  process.exitCode = 1;
});
