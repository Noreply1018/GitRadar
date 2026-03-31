import fs from "node:fs";
import path from "node:path";

import { DIGEST_RULES_CONFIG } from "./digest-rules";

export interface UserPreferencesConfig {
  preferredThemes: readonly string[];
  customTopics: readonly string[];
}

const DEFAULT_USER_PREFERENCES_PATH = path.resolve(
  __dirname,
  "../../config/user-preferences.json",
);

export const DEFAULT_USER_PREFERENCES: UserPreferencesConfig = {
  preferredThemes: [],
  customTopics: [],
};

export function loadUserPreferencesConfig(
  filePath = DEFAULT_USER_PREFERENCES_PATH,
): UserPreferencesConfig {
  try {
    const content = fs.readFileSync(filePath, "utf8");
    return parseUserPreferencesConfig(JSON.parse(content), filePath);
  } catch (error) {
    if (isMissingFileError(error)) {
      return { ...DEFAULT_USER_PREFERENCES };
    }

    if (error instanceof SyntaxError) {
      throw new Error(
        `Failed to parse user preferences config at ${filePath}: ${error.message}`,
      );
    }

    if (error instanceof Error && error.message.includes(filePath)) {
      throw error;
    }

    throw new Error(
      `Failed to read user preferences config at ${filePath}: ${getErrorMessage(error)}`,
    );
  }
}

export function getDefaultUserPreferencesConfigPath(): string {
  return DEFAULT_USER_PREFERENCES_PATH;
}

export function getUserPreferencesConfigPath(rootDir: string): string {
  return path.join(rootDir, "config", "user-preferences.json");
}

export function readStoredUserPreferencesConfig(
  rootDir: string,
): UserPreferencesConfig {
  return loadUserPreferencesConfig(getUserPreferencesConfigPath(rootDir));
}

export function parseUserPreferencesConfig(
  value: unknown,
  source = "user preferences config",
): UserPreferencesConfig {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${source} must be an object.`);
  }

  const config = value as Record<string, unknown>;
  const availableThemes = new Set(
    DIGEST_RULES_CONFIG.themes.map((item) => item.theme),
  );
  const preferredThemes = uniqueTrimmedStrings(
    config.preferredThemes,
    `${source}.preferredThemes`,
  );
  const customTopics = uniqueTrimmedStrings(
    config.customTopics,
    `${source}.customTopics`,
  );

  for (const theme of preferredThemes) {
    if (!availableThemes.has(theme)) {
      throw new Error(
        `${source}.preferredThemes contains an unknown theme: ${theme}.`,
      );
    }
  }

  return {
    preferredThemes,
    customTopics,
  };
}

export function stringifyUserPreferencesConfig(
  preferences: UserPreferencesConfig,
): string {
  return `${JSON.stringify(preferences, null, 2)}\n`;
}

function uniqueTrimmedStrings(value: unknown, source: string): string[] {
  if (value == null) {
    return [];
  }

  if (!Array.isArray(value)) {
    throw new Error(`${source} must be an array.`);
  }

  const seen = new Set<string>();
  const items: string[] = [];

  for (const entry of value) {
    if (typeof entry !== "string" || entry.trim() === "") {
      throw new Error(`${source} must contain non-empty strings.`);
    }

    const trimmed = entry.trim();
    const key = trimmed.toLowerCase();

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    items.push(trimmed);
  }

  return items;
}

function isMissingFileError(error: unknown): boolean {
  return Boolean(
    error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "ENOENT",
  );
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
