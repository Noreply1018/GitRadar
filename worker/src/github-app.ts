import * as jose from "jose";
import type { Env } from "./types";

// Cache installation tokens in module-level Map (per-isolate, not persistent)
const tokenCache = new Map<number, { token: string; expiresAt: number }>();

/**
 * Generate a short-lived JWT for authenticating as the GitHub App itself.
 * This JWT is used to request installation access tokens.
 */
async function createAppJwt(env: Env): Promise<string> {
  const privateKey = await jose.importPKCS8(env.GITHUB_APP_PRIVATE_KEY, "RS256");
  return new jose.SignJWT({})
    .setProtectedHeader({ alg: "RS256" })
    .setIssuer(env.GITHUB_APP_ID)
    .setIssuedAt(Math.floor(Date.now() / 1000) - 60) // 60s clock skew
    .setExpirationTime("10m")
    .sign(privateKey);
}

/**
 * Get an installation access token, using cache when possible.
 * Installation tokens are valid for 1 hour; we cache for 50 minutes.
 */
export async function getInstallationToken(
  installationId: number,
  env: Env,
): Promise<string> {
  const cached = tokenCache.get(installationId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.token;
  }

  const appJwt = await createAppJwt(env);
  const res = await fetch(
    `https://api.github.com/app/installations/${installationId}/access_tokens`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${appJwt}`,
        accept: "application/vnd.github+json",
        "user-agent": "GitRadar-Worker",
      },
    },
  );

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Failed to get installation token: ${res.status} ${body}`);
  }

  const data = (await res.json()) as { token: string; expires_at: string };

  // Cache for 50 minutes (installation tokens expire in 60 min)
  tokenCache.set(installationId, {
    token: data.token,
    expiresAt: Date.now() + 50 * 60 * 1000,
  });

  return data.token;
}

/**
 * Exchange the OAuth code from GitHub App installation flow for
 * the installation_id. Returns owner, repo, and installation_id.
 */
export async function exchangeCodeForInstallation(
  code: string,
  env: Env,
): Promise<{ installationId: number; owner: string; repo: string }> {
  // Exchange code for user access token (GitHub App OAuth)
  const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      client_id: env.GITHUB_CLIENT_ID,
      client_secret: env.GITHUB_CLIENT_SECRET,
      code,
    }),
  });

  if (!tokenRes.ok) {
    throw new Error(`OAuth token exchange failed: ${tokenRes.status}`);
  }

  const tokenData = (await tokenRes.json()) as {
    access_token?: string;
    error?: string;
    error_description?: string;
  };

  if (tokenData.error || !tokenData.access_token) {
    throw new Error(
      `OAuth error: ${tokenData.error_description ?? tokenData.error}`,
    );
  }

  // List installations accessible to this user via the App
  const installRes = await fetch(
    "https://api.github.com/user/installations",
    {
      headers: {
        authorization: `token ${tokenData.access_token}`,
        accept: "application/vnd.github+json",
        "user-agent": "GitRadar-Worker",
      },
    },
  );

  if (!installRes.ok) {
    throw new Error(`Failed to list installations: ${installRes.status}`);
  }

  const installData = (await installRes.json()) as {
    installations: Array<{
      id: number;
      account: { login: string };
    }>;
  };

  if (installData.installations.length === 0) {
    throw new Error("No installations found. Please install the GitHub App first.");
  }

  // Use the first installation (single-user tool)
  const installation = installData.installations[0];

  // Get repositories for this installation to find the repo name
  const repoRes = await fetch(
    `https://api.github.com/user/installations/${installation.id}/repositories`,
    {
      headers: {
        authorization: `token ${tokenData.access_token}`,
        accept: "application/vnd.github+json",
        "user-agent": "GitRadar-Worker",
      },
    },
  );

  if (!repoRes.ok) {
    throw new Error(`Failed to list installation repos: ${repoRes.status}`);
  }

  const repoData = (await repoRes.json()) as {
    repositories: Array<{ name: string; owner: { login: string } }>;
  };

  if (repoData.repositories.length === 0) {
    throw new Error("No repositories found for this installation.");
  }

  const repo = repoData.repositories[0];

  return {
    installationId: installation.id,
    owner: repo.owner.login,
    repo: repo.name,
  };
}
