import { Hono } from "hono";
import type { Env } from "./types";
import { verifySessionToken } from "./session";
import { getInstallationToken } from "./github-app";

const proxy = new Hono<{ Bindings: Env }>();

/**
 * Middleware: extract and verify session JWT from Authorization header.
 * Attaches session payload to c.set("session", ...).
 */
proxy.use("*", async (c, next) => {
  const authHeader = c.req.header("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return c.json({ error: "Missing or invalid authorization header" }, 401);
  }

  const token = authHeader.slice(7);
  try {
    const session = await verifySessionToken(token, c.env);
    c.set("session" as never, session as never);
  } catch {
    return c.json({ error: "Invalid or expired session" }, 401);
  }

  await next();
});

/**
 * Proxy all requests under /api/github/* to the GitHub API.
 * Maps:
 *   /api/github/repos/contents/path  -> /repos/{owner}/{repo}/contents/path
 *   /api/github/repos/actions/...    -> /repos/{owner}/{repo}/actions/...
 *   /api/github/repos                -> /repos/{owner}/{repo}
 */
proxy.all("/*", async (c) => {
  const session = c.get("session" as never) as {
    iid: number;
    owner: string;
    repo: string;
  };

  const installToken = await getInstallationToken(session.iid, c.env);

  // Strip the /api/github prefix to get the relative path
  const url = new URL(c.req.url);
  const relativePath = url.pathname.replace(/^\/api\/github/, "");

  // Build the GitHub API path: prepend /repos/{owner}/{repo}
  let githubPath: string;
  if (relativePath === "/repos" || relativePath === "/repos/") {
    githubPath = `/repos/${session.owner}/${session.repo}`;
  } else if (relativePath.startsWith("/repos/")) {
    githubPath = `/repos/${session.owner}/${session.repo}${relativePath.slice(6)}`;
  } else {
    return c.json({ error: "Invalid API path" }, 400);
  }

  const githubUrl = `https://api.github.com${githubPath}${url.search}`;

  const headers: Record<string, string> = {
    authorization: `token ${installToken}`,
    accept: "application/vnd.github.v3+json",
    "user-agent": "GitRadar-Worker",
  };

  // Forward content-type and body for non-GET requests
  const method = c.req.method;
  let body: string | undefined;

  if (method !== "GET" && method !== "HEAD") {
    headers["content-type"] = "application/json";
    body = await c.req.text();
  }

  const ghRes = await fetch(githubUrl, { method, headers, body });

  // Forward the response status and body
  const responseHeaders = new Headers();
  responseHeaders.set(
    "content-type",
    ghRes.headers.get("content-type") ?? "application/json",
  );

  return new Response(ghRes.body, {
    status: ghRes.status,
    headers: responseHeaders,
  });
});

export default proxy;
