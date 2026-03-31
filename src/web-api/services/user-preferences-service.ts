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
import {
  commitAndPushRepoFiles,
  readRemoteRepoJson,
} from "./repo-sync-service";

export function readUserPreferences(rootDir: string): UserPreferencesResponse {
  const path = getUserPreferencesRepoPath();
  const localPath = getUserPreferencesConfigPath(rootDir);
  const preferences = loadUserPreferencesConfig(localPath);

  return {
    path,
    preferences,
    availableThemes: DIGEST_RULES_CONFIG.themes.map((item) => item.theme),
    committed: false,
    commitSha: null,
    targetRef: null,
    pushed: false,
    committedAt: null,
  };
}

export async function readRemoteUserPreferences(
  rootDir: string,
): Promise<UserPreferencesResponse> {
  const path = getUserPreferencesRepoPath();
  const preferences = parseUserPreferencesConfig(
    await readRemoteRepoJson(rootDir, path, {
      preferredThemes: [],
      customTopics: [],
    }),
    path,
  );

  return {
    path,
    preferences,
    availableThemes: DIGEST_RULES_CONFIG.themes.map((item) => item.theme),
    committed: false,
    commitSha: null,
    targetRef: null,
    pushed: false,
    committedAt: null,
  };
}

export async function saveUserPreferences(
  rootDir: string,
  draft: unknown,
): Promise<UserPreferencesResponse> {
  const path = getUserPreferencesConfigPath(rootDir);
  const preferences = parseUserPreferencesConfig(draft, "userPreferences");

  await writeUserPreferences(rootDir, preferences);
  const sync = await commitAndPushRepoFiles(
    rootDir,
    [getUserPreferencesRepoPath()],
    `chore: update GitRadar user preferences`,
  );

  return {
    path: getUserPreferencesRepoPath(),
    preferences,
    availableThemes: DIGEST_RULES_CONFIG.themes.map((item) => item.theme),
    ...sync,
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

function getUserPreferencesRepoPath(): string {
  return path.join("config", "user-preferences.json");
}
