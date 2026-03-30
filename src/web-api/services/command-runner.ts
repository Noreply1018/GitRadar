import { spawn } from "node:child_process";

import type {
  CommandJob,
  CommandListResponse,
  CommandStartRequest,
} from "../types/api";

interface CommandSpec {
  id: CommandJob["commandId"];
  command: string[];
  requiresDate?: boolean;
}

const MAX_OUTPUT_LENGTH = 200_000;

const COMMAND_SPECS: Record<CommandJob["commandId"], CommandSpec> = {
  "validate-digest-rules": {
    id: "validate-digest-rules",
    command: ["npm", "run", "validate:digest-rules"],
  },
  "generate-digest": {
    id: "generate-digest",
    command: ["npm", "run", "generate:digest"],
  },
  "generate-digest-send": {
    id: "generate-digest-send",
    command: ["npm", "run", "generate:digest", "--", "--send"],
  },
  "analyze-digest": {
    id: "analyze-digest",
    command: ["npm", "run", "analyze:digest"],
    requiresDate: true,
  },
  "send-wecom-sample": {
    id: "send-wecom-sample",
    command: ["npm", "run", "send:wecom:sample"],
  },
};

export class CommandRunner {
  private readonly jobs = new Map<string, CommandJob>();

  constructor(private readonly rootDir: string) {}

  listJobs(): CommandListResponse {
    return {
      jobs: Array.from(this.jobs.values()).sort((left, right) =>
        right.startedAt.localeCompare(left.startedAt),
      ),
    };
  }

  getJob(jobId: string): CommandJob | undefined {
    return this.jobs.get(jobId);
  }

  startJob(
    commandId: CommandJob["commandId"],
    request: CommandStartRequest = {},
  ): CommandJob {
    const spec = COMMAND_SPECS[commandId];

    if (!spec) {
      throw new Error(`Unsupported command id: ${commandId}`);
    }

    const args = [...spec.command];

    if (spec.requiresDate) {
      if (!request.date?.trim()) {
        throw new Error(`Command ${commandId} requires a date.`);
      }

      args.push("--", "--date", request.date.trim());
    }

    const id = createJobId();
    const startedAt = new Date().toISOString();
    const job: CommandJob = {
      id,
      commandId,
      command: args.join(" "),
      status: "running",
      startedAt,
      stdout: "",
      stderr: "",
    };

    this.jobs.set(id, job);

    const child = spawn(resolveExecutable(args[0]), args.slice(1), {
      cwd: this.rootDir,
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });

    child.stdout.on("data", (chunk) => {
      job.stdout = appendOutput(job.stdout, String(chunk));
    });

    child.stderr.on("data", (chunk) => {
      job.stderr = appendOutput(job.stderr, String(chunk));
    });

    child.on("error", (error) => {
      job.status = "failed";
      job.finishedAt = new Date().toISOString();
      job.stderr = appendOutput(
        job.stderr,
        `\nFailed to start command: ${error.message}\n`,
      );
      job.exitCode = -1;
    });

    child.on("close", (exitCode) => {
      job.finishedAt = new Date().toISOString();
      job.exitCode = exitCode ?? -1;
      job.status = exitCode === 0 ? "succeeded" : "failed";
    });

    return job;
  }
}

export function listCommandSpecs(): CommandSpec[] {
  return Object.values(COMMAND_SPECS);
}

function createJobId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function appendOutput(current: string, chunk: string): string {
  const next = current + chunk;

  if (next.length <= MAX_OUTPUT_LENGTH) {
    return next;
  }

  return next.slice(next.length - MAX_OUTPUT_LENGTH);
}

function resolveExecutable(command: string): string {
  if (command !== "npm") {
    return command;
  }

  return process.platform === "win32" ? "npm.cmd" : "npm";
}
