import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { getIsoTimestamp } from "../../core/date";
import type {
  EnvironmentFingerprintResponse,
  GitHubFingerprint,
  LlmFingerprint,
  WecomFingerprint,
} from "../types/api";

interface EnvironmentFingerprintStore {
  github: GitHubFingerprint | null;
  llm: LlmFingerprint | null;
  wecom: WecomFingerprint | null;
}

const EMPTY_FINGERPRINTS: EnvironmentFingerprintStore = {
  github: null,
  llm: null,
  wecom: null,
};

export async function readEnvironmentFingerprints(
  rootDir: string,
): Promise<EnvironmentFingerprintResponse> {
  const filePath = getEnvironmentFingerprintPath(rootDir);

  try {
    const content = await readFile(filePath, "utf8");
    return normalizeFingerprints(JSON.parse(content));
  } catch (error) {
    if (isMissingFileError(error)) {
      return { ...EMPTY_FINGERPRINTS };
    }

    throw error;
  }
}

export async function saveGitHubFingerprint(
  rootDir: string,
  value: Omit<GitHubFingerprint, "lastValidatedAt">,
): Promise<GitHubFingerprint> {
  const current = await readEnvironmentFingerprints(rootDir);
  const nextValue: GitHubFingerprint = {
    ...value,
    lastValidatedAt: getIsoTimestamp(),
  };

  await writeFingerprints(rootDir, {
    ...current,
    github: nextValue,
  });

  return nextValue;
}

export async function saveLlmFingerprint(
  rootDir: string,
  value: Omit<LlmFingerprint, "lastValidatedAt">,
): Promise<LlmFingerprint> {
  const current = await readEnvironmentFingerprints(rootDir);
  const nextValue: LlmFingerprint = {
    ...value,
    lastValidatedAt: getIsoTimestamp(),
  };

  await writeFingerprints(rootDir, {
    ...current,
    llm: nextValue,
  });

  return nextValue;
}

export async function saveWecomFingerprint(
  rootDir: string,
  value: Omit<WecomFingerprint, "lastValidatedAt">,
): Promise<WecomFingerprint> {
  const current = await readEnvironmentFingerprints(rootDir);
  const nextValue: WecomFingerprint = {
    ...value,
    lastValidatedAt: getIsoTimestamp(),
  };

  await writeFingerprints(rootDir, {
    ...current,
    wecom: nextValue,
  });

  return nextValue;
}

export function getEnvironmentFingerprintPath(rootDir: string): string {
  return path.join(rootDir, "data", "runtime", "environment-fingerprints.json");
}

async function writeFingerprints(
  rootDir: string,
  value: EnvironmentFingerprintStore,
): Promise<void> {
  const filePath = getEnvironmentFingerprintPath(rootDir);
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function normalizeFingerprints(value: unknown): EnvironmentFingerprintStore {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ...EMPTY_FINGERPRINTS };
  }

  const record = value as Record<string, unknown>;

  return {
    github: normalizeNamedFingerprint(record.github, ["login", "apiBaseUrl"]),
    llm: normalizeNamedFingerprint(record.llm, ["model", "baseUrl"]),
    wecom: normalizeNamedFingerprint(record.wecom, ["maskedWebhookUrl"]),
  } as EnvironmentFingerprintStore;
}

function normalizeNamedFingerprint(
  value: unknown,
  requiredKeys: string[],
): Record<string, string> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;

  if (
    requiredKeys.some((key) => typeof record[key] !== "string") ||
    typeof record.lastValidatedAt !== "string"
  ) {
    return null;
  }

  return record as Record<string, string>;
}

function isMissingFileError(error: unknown): boolean {
  return Boolean(
    error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "ENOENT",
  );
}
