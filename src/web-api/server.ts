import fs from "node:fs/promises";
import path from "node:path";
import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";

import {
  getArchiveDetail,
  listArchiveSummaries,
} from "./services/archive-service";
import { CommandRunner } from "./services/command-runner";
import {
  readDigestRulesConfig,
  saveDigestRulesConfig,
  validateDigestRulesDraft,
} from "./services/digest-rules-service";
import {
  parseScheduleSettings,
  readScheduleSettings,
  saveScheduleSettings,
} from "./services/schedule-service";
import {
  readUserPreferences,
  saveUserPreferences,
} from "./services/user-preferences-service";
import type { HealthResponse } from "./types/api";

const DEFAULT_HOST = "127.0.0.1";
const DEFAULT_PORT = 3210;
const ROOT_DIR = path.resolve(__dirname, "../..");
const DIST_DIR = path.join(ROOT_DIR, "web", "dist");
const PACKAGE_JSON_PATH = path.join(ROOT_DIR, "package.json");

async function main(): Promise<void> {
  const commandRunner = new CommandRunner(ROOT_DIR);
  const packageVersion = await readPackageVersion();
  const server = createServer((request, response) =>
    handleRequest(request, response, commandRunner, packageVersion),
  );
  const { host, port } = parseServerOptions(process.argv.slice(2));

  server.listen(port, host, () => {
    console.log(`GitRadar web API listening on http://${host}:${port}`);
  });
}

async function handleRequest(
  request: IncomingMessage,
  response: ServerResponse,
  commandRunner: CommandRunner,
  packageVersion: string,
): Promise<void> {
  addCorsHeaders(response);

  if (request.method === "OPTIONS") {
    response.writeHead(204);
    response.end();
    return;
  }

  try {
    const url = new URL(request.url ?? "/", "http://localhost");
    const pathname = url.pathname;

    if (request.method === "GET" && pathname === "/api/health") {
      return sendJson<HealthResponse>(response, 200, {
        status: "ok",
        app: "GitRadar",
        version: packageVersion,
        mode: (await hasBuiltConsole()) ? "full-console" : "api-only",
      });
    }

    if (request.method === "GET" && pathname === "/api/config/digest-rules") {
      return sendJson(response, 200, readDigestRulesConfig());
    }

    if (request.method === "GET" && pathname === "/api/settings/schedule") {
      return sendJson(response, 200, await readScheduleSettings(ROOT_DIR));
    }

    if (request.method === "GET" && pathname === "/api/settings/preferences") {
      return sendJson(response, 200, readUserPreferences(ROOT_DIR));
    }

    if (
      request.method === "POST" &&
      pathname === "/api/config/digest-rules/validate"
    ) {
      const body = await readJsonBody(request);
      return sendJson(response, 200, validateDigestRulesDraft(body));
    }

    if (request.method === "PUT" && pathname === "/api/config/digest-rules") {
      const body = await readJsonBody(request);
      const validation = validateDigestRulesDraft(body);

      if (!validation.valid) {
        return sendJson(response, 400, validation);
      }

      return sendJson(response, 200, await saveDigestRulesConfig(body));
    }

    if (request.method === "PUT" && pathname === "/api/settings/schedule") {
      const body = await readJsonBody(request);

      try {
        parseScheduleSettings(body);
        return sendJson(
          response,
          200,
          await saveScheduleSettings(ROOT_DIR, body),
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return sendJson(response, 400, { message });
      }
    }

    if (request.method === "PUT" && pathname === "/api/settings/preferences") {
      const body = await readJsonBody(request);

      try {
        return sendJson(
          response,
          200,
          await saveUserPreferences(ROOT_DIR, body),
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return sendJson(response, 400, { message });
      }
    }

    if (request.method === "GET" && pathname === "/api/commands") {
      return sendJson(response, 200, commandRunner.listJobs());
    }

    if (
      request.method === "POST" &&
      pathname === "/api/commands/validate-digest-rules"
    ) {
      return sendJson(response, 202, {
        job: commandRunner.startJob("validate-digest-rules"),
      });
    }

    if (
      request.method === "POST" &&
      pathname === "/api/commands/generate-digest"
    ) {
      const body = await readJsonBody(request);
      const shouldSend = body?.send === true;
      return sendJson(response, 202, {
        job: commandRunner.startJob(
          shouldSend ? "generate-digest-send" : "generate-digest",
        ),
      });
    }

    if (
      request.method === "POST" &&
      pathname === "/api/commands/analyze-digest"
    ) {
      const body = await readJsonBody(request);
      return sendJson(response, 202, {
        job: commandRunner.startJob("analyze-digest", {
          date: typeof body?.date === "string" ? body.date : undefined,
        }),
      });
    }

    if (
      request.method === "POST" &&
      pathname === "/api/commands/send-wecom-sample"
    ) {
      return sendJson(response, 202, {
        job: commandRunner.startJob("send-wecom-sample"),
      });
    }

    if (request.method === "GET" && pathname.startsWith("/api/commands/")) {
      const jobId = pathname.replace("/api/commands/", "");
      const job = commandRunner.getJob(jobId);

      if (!job) {
        return sendJson(response, 404, {
          message: `Command job not found: ${jobId}`,
        });
      }

      return sendJson(response, 200, { job });
    }

    if (request.method === "GET" && pathname === "/api/archives") {
      return sendJson(response, 200, await listArchiveSummaries(ROOT_DIR));
    }

    if (request.method === "GET" && pathname.startsWith("/api/archives/")) {
      const date = pathname.replace("/api/archives/", "");
      return sendJson(response, 200, await getArchiveDetail(ROOT_DIR, date));
    }

    if (!pathname.startsWith("/api/")) {
      return serveConsoleAsset(pathname, response);
    }

    return sendJson(response, 404, { message: `Route not found: ${pathname}` });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return sendJson(response, 500, { message });
  }
}

async function readPackageVersion(): Promise<string> {
  const packageJson = JSON.parse(
    await fs.readFile(PACKAGE_JSON_PATH, "utf8"),
  ) as {
    version?: string;
  };

  return packageJson.version ?? "unknown";
}

async function serveConsoleAsset(
  pathname: string,
  response: ServerResponse,
): Promise<void> {
  if (!(await hasBuiltConsole())) {
    response.writeHead(200, { "content-type": "text/plain; charset=utf-8" });
    response.end(
      [
        "GitRadar web API is running.",
        "The frontend build was not found at web/dist.",
        "Use `npm run dev:web` for local development or `npm run build:web` before opening the full console here.",
      ].join("\n"),
    );
    return;
  }

  const assetPath =
    pathname === "/"
      ? path.join(DIST_DIR, "index.html")
      : path.join(DIST_DIR, pathname);

  try {
    const file = await fs.readFile(assetPath);
    response.writeHead(200, { "content-type": getContentType(assetPath) });
    response.end(file);
    return;
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      const indexFile = await fs.readFile(path.join(DIST_DIR, "index.html"));
      response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      response.end(indexFile);
      return;
    }

    throw error;
  }
}

async function hasBuiltConsole(): Promise<boolean> {
  try {
    await fs.access(path.join(DIST_DIR, "index.html"));
    return true;
  } catch {
    return false;
  }
}

function parseServerOptions(argv: string[]): { host: string; port: number } {
  const hostIndex = argv.indexOf("--host");
  const portIndex = argv.indexOf("--port");

  const host =
    hostIndex === -1 ? DEFAULT_HOST : (argv[hostIndex + 1] ?? DEFAULT_HOST);
  const port =
    portIndex === -1
      ? DEFAULT_PORT
      : Number.parseInt(argv[portIndex + 1] ?? "", 10);

  if (!Number.isFinite(port) || port <= 0) {
    throw new Error("Invalid --port value.");
  }

  return { host, port };
}

async function readJsonBody(request: IncomingMessage): Promise<any> {
  const chunks: Buffer[] = [];

  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  if (chunks.length === 0) {
    return {};
  }

  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function addCorsHeaders(response: ServerResponse): void {
  response.setHeader("access-control-allow-origin", "*");
  response.setHeader("access-control-allow-methods", "GET,POST,PUT,OPTIONS");
  response.setHeader("access-control-allow-headers", "content-type");
}

function sendJson<T>(
  response: ServerResponse,
  statusCode: number,
  body: T,
): void {
  response.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
  });
  response.end(JSON.stringify(body, null, 2));
}

function getContentType(filePath: string): string {
  if (filePath.endsWith(".html")) {
    return "text/html; charset=utf-8";
  }

  if (filePath.endsWith(".css")) {
    return "text/css; charset=utf-8";
  }

  if (filePath.endsWith(".js")) {
    return "text/javascript; charset=utf-8";
  }

  if (filePath.endsWith(".svg")) {
    return "image/svg+xml";
  }

  return "application/octet-stream";
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`GitRadar web API failed: ${message}`);
  process.exitCode = 1;
});
