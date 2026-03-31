import dotenv from "dotenv";

dotenv.config({ quiet: true });

export interface GitHubConfig {
  token: string;
  apiBaseUrl: string;
  trendingUrl: string;
}

export interface LlmConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
}

export interface WecomRobotConfig {
  webhookUrl: string;
}

export function getGitHubConfigFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): GitHubConfig {
  const token = env.GITHUB_TOKEN?.trim() || env.GITRADAR_GITHUB_TOKEN?.trim();

  if (!token) {
    throw new Error(
      "Missing GITHUB_TOKEN. Configure GITHUB_TOKEN or GITRADAR_GITHUB_TOKEN in GitHub Actions Secrets or export it in your shell before running GitRadar.",
    );
  }

  const apiBaseUrl = normalizeUrl(
    env.GR_GH_API_URL?.trim() ?? "https://api.github.com",
    "GR_GH_API_URL",
  );
  const trendingUrl = normalizeUrl(
    env.GR_GH_TRENDING_URL?.trim() ?? "https://github.com/trending?since=daily",
    "GR_GH_TRENDING_URL",
  );

  return { token, apiBaseUrl, trendingUrl };
}

export function getLlmConfigFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): LlmConfig {
  const apiKey = env.GR_API_KEY?.trim();
  const baseUrl = env.GR_BASE_URL?.trim();
  const model = env.GR_MODEL?.trim();

  if (!apiKey) {
    throw new Error(
      "Missing GR_API_KEY. Configure it in GitHub Actions Secrets or export it in your shell before running GitRadar.",
    );
  }

  if (!baseUrl) {
    throw new Error(
      "Missing GR_BASE_URL. Configure it in GitHub Actions Secrets or export it in your shell before running GitRadar.",
    );
  }

  if (!model) {
    throw new Error(
      "Missing GR_MODEL. Configure it in GitHub Actions Secrets or export it in your shell before running GitRadar.",
    );
  }

  return {
    apiKey,
    baseUrl: normalizeUrl(baseUrl, "GR_BASE_URL"),
    model,
  };
}

export function getWecomRobotConfigFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): WecomRobotConfig {
  const webhookUrl = env.GITRADAR_WECOM_WEBHOOK_URL?.trim();

  if (!webhookUrl) {
    throw new Error(
      "Missing GITRADAR_WECOM_WEBHOOK_URL. Configure it in GitHub Actions Secrets or export it in your shell before running GitRadar.",
    );
  }

  try {
    // Validate format without hard-coding a single hostname, so tests can use mock URLs.
    new URL(webhookUrl);
  } catch {
    throw new Error("GITRADAR_WECOM_WEBHOOK_URL is not a valid URL.");
  }

  return { webhookUrl };
}

function normalizeUrl(value: string, key: string): string {
  try {
    return new URL(value).toString().replace(/\/$/, "");
  } catch {
    throw new Error(`${key} is not a valid URL.`);
  }
}
