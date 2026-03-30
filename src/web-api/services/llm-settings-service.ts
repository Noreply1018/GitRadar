import { request } from "undici";

import { getLlmConfigFromEnv } from "../../config/env";
import { maskApiKey } from "../../config/mask";
import type {
  LlmSettingsResponse,
  LlmTestResponse,
  SaveLlmSettingsInput,
} from "../types/api";
import {
  getManagedEnvPath,
  readManagedEnv,
  upsertManagedEnvValue,
} from "./managed-env";

const LLM_API_KEY_KEY = "GR_API_KEY";
const LLM_BASE_URL_KEY = "GR_BASE_URL";
const LLM_MODEL_KEY = "GR_MODEL";

interface ChatCompletionResponse {
  choices?: Array<{
    message?: {
      content?: string | null;
    };
  }>;
}

export async function readLlmSettings(
  rootDir: string,
): Promise<LlmSettingsResponse> {
  const env = await readManagedEnv(rootDir);
  const apiKey = env[LLM_API_KEY_KEY]?.trim();
  const baseUrl = env[LLM_BASE_URL_KEY]?.trim() ?? null;
  const model = env[LLM_MODEL_KEY]?.trim() ?? null;

  return {
    configured: Boolean(apiKey && baseUrl && model),
    maskedApiKey: apiKey ? maskApiKey(apiKey) : null,
    baseUrl,
    model,
    envFilePath: getManagedEnvPath(rootDir),
  };
}

export async function saveLlmSettings(
  rootDir: string,
  input: unknown,
): Promise<LlmSettingsResponse> {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("LLM 配置必须是对象。");
  }

  const env = await readManagedEnv(rootDir);
  const currentApiKey = env[LLM_API_KEY_KEY]?.trim();
  const currentBaseUrl = env[LLM_BASE_URL_KEY]?.trim();
  const currentModel = env[LLM_MODEL_KEY]?.trim();
  const draft = input as SaveLlmSettingsInput;

  const apiKey = normalizeOptionalField(draft.apiKey) ?? currentApiKey;
  const baseUrl = normalizeOptionalField(draft.baseUrl) ?? currentBaseUrl;
  const model = normalizeOptionalField(draft.model) ?? currentModel;

  const validated = getLlmConfigFromEnv({
    [LLM_API_KEY_KEY]: apiKey,
    [LLM_BASE_URL_KEY]: baseUrl,
    [LLM_MODEL_KEY]: model,
  });

  await upsertManagedEnvValue(rootDir, LLM_API_KEY_KEY, validated.apiKey);
  await upsertManagedEnvValue(rootDir, LLM_BASE_URL_KEY, validated.baseUrl);
  await upsertManagedEnvValue(rootDir, LLM_MODEL_KEY, validated.model);

  return {
    configured: true,
    maskedApiKey: maskApiKey(validated.apiKey),
    baseUrl: validated.baseUrl,
    model: validated.model,
    envFilePath: getManagedEnvPath(rootDir),
  };
}

export async function testLlmSettings(
  rootDir: string,
): Promise<LlmTestResponse> {
  const env = await readManagedEnv(rootDir);
  const config = getLlmConfigFromEnv(env);

  const response = await request(`${config.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      temperature: 0,
      max_tokens: 8,
      messages: [
        {
          role: "system",
          content: "You are a health check endpoint for GitRadar.",
        },
        {
          role: "user",
          content: "Reply with OK.",
        },
      ],
    }),
  });

  const rawBody = await response.body.text();

  if (response.statusCode < 200 || response.statusCode >= 300) {
    throw new Error(
      `LLM 测试请求失败，HTTP ${response.statusCode}${formatRemoteMessage(rawBody)}`,
    );
  }

  const payload = parseJsonResponse(rawBody);
  const content = payload.choices?.[0]?.message?.content?.trim();

  if (!content) {
    throw new Error("LLM 测试响应未返回有效内容。");
  }

  return {
    ok: true,
    message: "LLM 连通性测试通过。",
    model: config.model,
    baseUrl: config.baseUrl,
  };
}

function normalizeOptionalField(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed || undefined;
}

function parseJsonResponse(value: string): ChatCompletionResponse {
  try {
    return JSON.parse(value) as ChatCompletionResponse;
  } catch {
    throw new Error("LLM 测试响应不是合法 JSON。");
  }
}

function formatRemoteMessage(value: string): string {
  const trimmed = value.trim();

  if (!trimmed) {
    return "";
  }

  return `: ${trimmed.slice(0, 160)}`;
}
