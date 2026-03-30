import { writeFile } from "node:fs/promises";

import {
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

const DIGEST_RULES_SOURCE = "digestRules";

export function readDigestRulesConfig(): DigestRulesResponse {
  const path = getDefaultDigestRulesConfigPath();
  const config = loadDigestRulesConfig(path);

  return { config, path };
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
  draft: unknown,
): Promise<DigestRulesResponse> {
  const config = parseDigestRulesConfig(draft, DIGEST_RULES_SOURCE);
  const path = getDefaultDigestRulesConfigPath();
  await writeFile(path, stringifyDigestRulesConfig(config), "utf8");

  return {
    config,
    path,
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
