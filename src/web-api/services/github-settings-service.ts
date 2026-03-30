import { request } from "undici";

import { getGitHubConfigFromEnv } from "../../config/env";
import { maskApiKey } from "../../config/mask";
import type {
  GitHubSettingsResponse,
  GitHubTestResponse,
  SaveGitHubSettingsInput,
} from "../types/api";
import {
  getManagedEnvPath,
  readManagedEnv,
  upsertManagedEnvValue,
} from "./managed-env";
import { saveGitHubFingerprint } from "./environment-fingerprint-service";

const GITHUB_TOKEN_KEY = "GITHUB_TOKEN";

interface GitHubViewerResponse {
  login?: string;
}

export async function readGitHubSettings(
  rootDir: string,
): Promise<GitHubSettingsResponse> {
  const env = await readManagedEnv(rootDir);
  const token =
    env.GITHUB_TOKEN?.trim() || env.GITRADAR_GITHUB_TOKEN?.trim() || null;
  const config = getGitHubConfigPreview(env);

  return {
    configured: Boolean(token),
    maskedToken: token ? maskApiKey(token) : null,
    apiBaseUrl: config.apiBaseUrl,
    trendingUrl: config.trendingUrl,
    envFilePath: getManagedEnvPath(rootDir),
  };
}

export async function saveGitHubSettings(
  rootDir: string,
  input: unknown,
): Promise<GitHubSettingsResponse> {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("GitHub 配置必须是对象。");
  }

  const env = await readManagedEnv(rootDir);
  const draft = input as SaveGitHubSettingsInput;
  const token = normalizeOptionalField(draft.token) ?? env.GITHUB_TOKEN?.trim();

  if (!token) {
    throw new Error("GitHub Token 不能为空。");
  }

  const config = getGitHubConfigFromEnv({
    ...env,
    [GITHUB_TOKEN_KEY]: token,
  });

  await upsertManagedEnvValue(rootDir, GITHUB_TOKEN_KEY, config.token);

  return {
    configured: true,
    maskedToken: maskApiKey(config.token),
    apiBaseUrl: config.apiBaseUrl,
    trendingUrl: config.trendingUrl,
    envFilePath: getManagedEnvPath(rootDir),
  };
}

export async function testGitHubSettings(
  rootDir: string,
): Promise<GitHubTestResponse> {
  const env = await readManagedEnv(rootDir);
  const config = getGitHubConfigFromEnv(env);
  const response = await request(`${config.apiBaseUrl}/user`, {
    method: "GET",
    headers: {
      accept: "application/vnd.github+json",
      authorization: `Bearer ${config.token}`,
      "user-agent": "GitRadar",
      "x-github-api-version": "2022-11-28",
    },
  });
  const rawBody = await response.body.text();

  if (response.statusCode < 200 || response.statusCode >= 300) {
    throw new Error(
      `GitHub 测试请求失败，HTTP ${response.statusCode}${formatRemoteMessage(rawBody)}`,
    );
  }

  const payload = parseJsonResponse(rawBody);

  if (!payload.login?.trim()) {
    throw new Error("GitHub 测试响应未返回账号信息。");
  }

  const fingerprint = await saveGitHubFingerprint(rootDir, {
    login: payload.login.trim(),
    apiBaseUrl: config.apiBaseUrl,
  });

  return {
    ok: true,
    message: "GitHub Token 连通性测试通过。",
    login: fingerprint.login,
    apiBaseUrl: fingerprint.apiBaseUrl,
  };
}

function getGitHubConfigPreview(env: NodeJS.ProcessEnv): {
  apiBaseUrl: string;
  trendingUrl: string;
} {
  try {
    const config = getGitHubConfigFromEnv({
      ...env,
      GITHUB_TOKEN:
        env.GITHUB_TOKEN?.trim() ||
        env.GITRADAR_GITHUB_TOKEN?.trim() ||
        "preview-token",
    });

    return {
      apiBaseUrl: config.apiBaseUrl,
      trendingUrl: config.trendingUrl,
    };
  } catch (error) {
    throw new Error(
      error instanceof Error ? error.message : "GitHub 配置预览失败。",
    );
  }
}

function normalizeOptionalField(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed || undefined;
}

function parseJsonResponse(value: string): GitHubViewerResponse {
  try {
    return JSON.parse(value) as GitHubViewerResponse;
  } catch {
    throw new Error("GitHub 测试响应不是合法 JSON。");
  }
}

function formatRemoteMessage(value: string): string {
  const trimmed = value.trim();

  if (!trimmed) {
    return "";
  }

  return `: ${trimmed.slice(0, 160)}`;
}
