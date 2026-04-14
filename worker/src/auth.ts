import { Hono } from "hono";
import type { Env } from "./types";
import { exchangeCodeForInstallation } from "./github-app";
import { createSessionToken } from "./session";

const auth = new Hono<{ Bindings: Env }>();

/**
 * GET /auth/login
 * Generate a random state, store it in a cookie, redirect to GitHub App installation page.
 */
auth.get("/login", async (c) => {
  const state = crypto.randomUUID();
  const clientId = c.env.GITHUB_CLIENT_ID;
  const redirectUrl = `https://github.com/login/oauth/authorize?client_id=${clientId}&state=${state}`;

  // Set state cookie for CSRF protection (5 min TTL)
  c.header(
    "set-cookie",
    `oauth_state=${state}; HttpOnly; SameSite=Lax; Secure; Path=/; Max-Age=300`,
  );

  return c.redirect(redirectUrl);
});

/**
 * GET /auth/callback
 * GitHub redirects here after user authorizes. Exchange code for installation info,
 * create session JWT, redirect back to frontend.
 */
auth.get("/callback", async (c) => {
  const code = c.req.query("code");
  const state = c.req.query("state");
  const frontendUrl = c.env.FRONTEND_URL;

  // Validate state against cookie
  const cookies = c.req.header("cookie") ?? "";
  const stateCookie = cookies
    .split(";")
    .map((s) => s.trim())
    .find((s) => s.startsWith("oauth_state="));
  const savedState = stateCookie?.split("=")[1];

  if (!code || !state || state !== savedState) {
    return c.redirect(`${frontendUrl}/setup?error=invalid_state`);
  }

  // Clear the state cookie
  c.header(
    "set-cookie",
    "oauth_state=; HttpOnly; SameSite=Lax; Secure; Path=/; Max-Age=0",
  );

  try {
    const { installationId, owner, repo } =
      await exchangeCodeForInstallation(code, c.env);

    const session = await createSessionToken(
      { iid: installationId, owner, repo },
      c.env,
    );

    return c.redirect(
      `${frontendUrl}/setup/callback?session=${encodeURIComponent(session)}`,
    );
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Unknown error during login";
    return c.redirect(
      `${frontendUrl}/setup?error=${encodeURIComponent(message)}`,
    );
  }
});

export default auth;
