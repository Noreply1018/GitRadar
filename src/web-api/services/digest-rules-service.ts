import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  DIGEST_RULES_CONFIG,
  getDefaultDigestRulesConfigPath,
  loadDigestRulesConfig,
  parseDigestRulesConfig,
  type DigestRulesConfig,
} from "../../config/digest-rules";
import type {
  DigestRulesIssue,
  DigestRulesResponse,
  DigestRulesValidationResponse,
} from "../types/api";
import {
  commitAndPushRepoFiles,
  readRemoteRepoJson,
} from "./repo-sync-service";

const DIGEST_RULES_SOURCE = "digestRules";

export function readDigestRulesConfig(): DigestRulesResponse {
  const filePath = getDefaultDigestRulesConfigPath();
  const config = loadDigestRulesConfig(filePath);

  return {
    config,
    path: path.relative(process.cwd(), filePath) || "config/digest-rules.json",
    committed: false,
    commitSha: null,
    targetRef: null,
    pushed: false,
    committedAt: null,
  };
}

export async function readRemoteDigestRulesConfig(
  rootDir: string,
): Promise<DigestRulesResponse> {
  const repoPath = path.join("config", "digest-rules.json");
  const config = parseDigestRulesConfig(
    await readRemoteRepoJson(rootDir, repoPath, DIGEST_RULES_CONFIG),
    repoPath,
  );

  return {
    config,
    path: repoPath,
    committed: false,
    commitSha: null,
    targetRef: null,
    pushed: false,
    committedAt: null,
  };
}

export function validateDigestRulesDraft(
  draft: unknown,
): DigestRulesValidationResponse {
  try {
    parseDigestRulesConfig(draft, DIGEST_RULES_SOURCE);

    return {
      valid: true,
      issues: [],
    };
  } catch (error) {
    return {
      valid: false,
      issues: [normalizeDigestRulesIssue(error)],
    };
  }
}

export async function saveDigestRulesConfig(
  rootDir: string,
  draft: unknown,
): Promise<DigestRulesResponse> {
  const config = parseDigestRulesConfig(draft, DIGEST_RULES_SOURCE);
  const filePath = getDigestRulesConfigPath(rootDir);
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, stringifyDigestRulesConfig(config), "utf8");
  const repoPath = "config/digest-rules.json";
  const sync = await commitAndPushRepoFiles(
    rootDir,
    [repoPath],
    `chore: update GitRadar digest rules`,
  );

  return {
    config,
    path: repoPath,
    ...sync,
  };
}

export function stringifyDigestRulesConfig(config: DigestRulesConfig): string {
  return `${JSON.stringify(config, null, 2)}\n`;
}

export function normalizeDigestRulesIssue(error: unknown): DigestRulesIssue {
  const message = error instanceof Error ? error.message : String(error);
  const pathMatch = message.match(/^(digestRules(?:\.[^\s:]+)?)/);

  return {
    path: pathMatch?.[1] ?? DIGEST_RULES_SOURCE,
    message,
  };
}

function getDigestRulesConfigPath(rootDir: string): string {
  return path.join(rootDir, "config", "digest-rules.json");
}
