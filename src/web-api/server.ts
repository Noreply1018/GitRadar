import fs from "node:fs/promises";
import path from "node:path";
import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";

import {
  getGitHubArchiveDetail,
  listGitHubArchiveSummaries,
  readGitHubExecutionState,
  readGitHubModeEnvironmentFingerprints,
  readGitHubModeGitHubSettings,
  readGitHubModeHealth,
  readGitHubModeLlmSettings,
  readGitHubModeSchedule,
  readGitHubModeSettingsOverview,
  readGitHubModeWecomSettings,
} from "./services/github-runtime-service";
import {
  readRemoteDigestRulesConfig,
  saveDigestRulesConfig,
  validateDigestRulesDraft,
} from "./services/digest-rules-service";
import { buildFeedbackInsights } from "../feedback/insights";
import {
  parseScheduleSettings,
  saveScheduleSettings,
} from "./services/schedule-service";
import {
  readRemoteUserPreferences,
  saveUserPreferences,
} from "./services/user-preferences-service";
import {
  listRemoteFeedbackItems,
  readRemoteFeedbackState,
  recordFeedback,
} from "../feedback/store";
import type { HealthResponse } from "./types/api";

const DEFAULT_HOST = "127.0.0.1";
const DEFAULT_PORT = 3210;
const ROOT_DIR = path.resolve(__dirname, "../..");
const DIST_DIR = path.join(ROOT_DIR, "web", "dist");
const PACKAGE_JSON_PATH = path.join(ROOT_DIR, "package.json");

async function main(): Promise<void> {
  const packageVersion = await readPackageVersion();
  const server = createServer((request, response) =>
    handleRequest(request, response, packageVersion),
  );
  const { host, port } = parseServerOptions(process.argv.slice(2));

  server.listen(port, host, () => {
    console.log(`GitRadar web API listening on http://${host}:${port}`);
  });
}

async function handleRequest(
  request: IncomingMessage,
  response: ServerResponse,
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
      return sendJson<HealthResponse>(
        response,
        200,
        await readGitHubModeHealth(ROOT_DIR, packageVersion),
      );
    }

    if (request.method === "GET" && pathname === "/api/config/digest-rules") {
      return sendJson(
        response,
        200,
        await readRemoteDigestRulesConfig(ROOT_DIR),
      );
    }

    if (request.method === "GET" && pathname === "/api/settings/schedule") {
      return sendJson(response, 200, await readGitHubModeSchedule(ROOT_DIR));
    }

    if (request.method === "GET" && pathname === "/api/settings/preferences") {
      return sendJson(response, 200, await readRemoteUserPreferences(ROOT_DIR));
    }

    if (request.method === "GET" && pathname === "/api/settings/github") {
      return sendJson(
        response,
        200,
        await readGitHubModeGitHubSettings(ROOT_DIR),
      );
    }

    if (request.method === "GET" && pathname === "/api/settings/llm") {
      return sendJson(response, 200, await readGitHubModeLlmSettings(ROOT_DIR));
    }

    if (request.method === "GET" && pathname === "/api/settings/wecom") {
      return sendJson(
        response,
        200,
        await readGitHubModeWecomSettings(ROOT_DIR),
      );
    }

    if (
      request.method === "GET" &&
      pathname === "/api/environment/fingerprints"
    ) {
      return sendJson(
        response,
        200,
        await readGitHubModeEnvironmentFingerprints(ROOT_DIR),
      );
    }

    if (request.method === "GET" && pathname === "/api/runtime/github") {
      return sendJson(
        response,
        200,
        await readGitHubModeSettingsOverview(ROOT_DIR),
      );
    }

    if (request.method === "GET" && pathname === "/api/feedback") {
      const feedbackState = await readRemoteFeedbackState(ROOT_DIR);
      const preferences = await readRemoteUserPreferences(ROOT_DIR);
      return sendJson(response, 200, {
        state: feedbackState,
        insights: buildFeedbackInsights(feedbackState, preferences.preferences),
      });
    }

    if (request.method === "GET" && pathname === "/api/feedback/items") {
      const action = url.searchParams.get("action") ?? undefined;
      return sendJson(response, 200, {
        items: await listRemoteFeedbackItems(ROOT_DIR, {
          action:
            action === "saved" || action === "later" || action === "skipped"
              ? action
              : undefined,
        }),
      });
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

      return sendJson(
        response,
        200,
        await saveDigestRulesConfig(ROOT_DIR, body),
      );
    }

    if (request.method === "PUT" && pathname === "/api/settings/schedule") {
      const body = await readJsonBody(request);

      try {
        parseScheduleSettings(body);
        const saved = await saveScheduleSettings(ROOT_DIR, body);
        return sendJson(response, 200, {
          ...saved,
          source: "github",
          note: "已写入仓库配置文件。后续 GitHub Actions 轮询命中配置时间槽时会按新时间执行。",
        });
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

    if (request.method === "POST" && pathname === "/api/feedback") {
      const body = await readJsonBody(request);

      try {
        return sendJson(response, 200, await recordFeedback(ROOT_DIR, body));
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return sendJson(response, 400, { message });
      }
    }

    if (
      request.method === "POST" &&
      pathname.startsWith("/api/feedback/suggestions/")
    ) {
      const theme = decodeURIComponent(
        pathname
          .replace("/api/feedback/suggestions/", "")
          .replace(/\/accept$/, ""),
      );

      if (!pathname.endsWith("/accept")) {
        return sendJson(response, 404, {
          message: `Route not found: ${pathname}`,
        });
      }

      try {
        const preferencesResponse = await readRemoteUserPreferences(ROOT_DIR);
        const nextPreferences = {
          ...preferencesResponse.preferences,
          preferredThemes: Array.from(
            new Set([
              ...preferencesResponse.preferences.preferredThemes,
              theme,
            ]),
          ),
        };
        await saveUserPreferences(ROOT_DIR, nextPreferences);
        const feedbackState = await readRemoteFeedbackState(ROOT_DIR);

        return sendJson(response, 200, {
          preferences: nextPreferences,
          availableThemes: preferencesResponse.availableThemes,
          insights: buildFeedbackInsights(feedbackState, nextPreferences),
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return sendJson(response, 400, { message });
      }
    }

    if (request.method === "GET" && pathname === "/api/archives") {
      return sendJson(
        response,
        200,
        await listGitHubArchiveSummaries(ROOT_DIR),
      );
    }

    if (request.method === "GET" && pathname.startsWith("/api/archives/")) {
      const date = pathname.replace("/api/archives/", "");
      return sendJson(
        response,
        200,
        await getGitHubArchiveDetail(ROOT_DIR, date),
      );
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
