import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  getUserPreferencesConfigPath,
  loadUserPreferencesConfig,
  parseUserPreferencesConfig,
  stringifyUserPreferencesConfig,
} from "../../config/user-preferences";
import { DIGEST_RULES_CONFIG } from "../../config/digest-rules";
import type { UserPreferencesResponse } from "../types/api";

export function readUserPreferences(rootDir: string): UserPreferencesResponse {
  const path = getUserPreferencesConfigPath(rootDir);
  const preferences = loadUserPreferencesConfig(path);

  return {
    path,
    preferences,
    availableThemes: DIGEST_RULES_CONFIG.themes.map((item) => item.theme),
  };
}

export async function saveUserPreferences(
  rootDir: string,
  draft: unknown,
): Promise<UserPreferencesResponse> {
  const path = getUserPreferencesConfigPath(rootDir);
  const preferences = parseUserPreferencesConfig(draft, "userPreferences");

  await writeUserPreferences(rootDir, preferences);

  return {
    path,
    preferences,
    availableThemes: DIGEST_RULES_CONFIG.themes.map((item) => item.theme),
  };
}

export async function writeUserPreferences(
  rootDir: string,
  preferences: ReturnType<typeof parseUserPreferencesConfig>,
): Promise<void> {
  const path = getUserPreferencesConfigPath(rootDir);
  await mkdir(pathDir(path), { recursive: true });
  await writeFile(path, stringifyUserPreferencesConfig(preferences), "utf8");
}

function pathDir(filePath: string): string {
  return path.dirname(filePath);
}
