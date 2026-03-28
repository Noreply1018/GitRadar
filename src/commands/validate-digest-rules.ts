import path from "node:path";

import {
  getDefaultDigestRulesConfigPath,
  loadDigestRulesConfig,
  type DigestRulesConfig,
} from "../config/digest-rules";

interface ValidateDigestRulesArgs {
  configPath?: string;
  format: "text" | "json";
}

interface DigestRulesSummary {
  configPath: string;
  version: string;
  themeCount: number;
  descriptionBlacklistCount: number;
  readmeBlacklistCount: number;
  topicBlacklistCount: number;
  shortlistMaxPerTheme: number;
  poolMaxPerTheme: number;
  ensureMatureMomentum: boolean;
  recentPushMomentumBuckets: number;
  recentCreationNoveltyBuckets: number;
}

async function main(): Promise<void> {
  const args = parseValidateDigestRulesArgs(process.argv.slice(2));
  const configPath = path.resolve(
    process.cwd(),
    args.configPath ?? getDefaultDigestRulesConfigPath(),
  );
  const config = loadDigestRulesConfig(configPath);
  const summary = buildDigestRulesSummary(config, configPath);

  if (args.format === "json") {
    console.log(JSON.stringify(summary, null, 2));
    return;
  }

  console.log(renderDigestRulesSummary(summary));
}

export function parseValidateDigestRulesArgs(
  argv: string[],
): ValidateDigestRulesArgs {
  const pathIndex = argv.indexOf("--path");
  const formatIndex = argv.indexOf("--format");
  const supportedArgs = new Set(["--path", "--format"]);

  for (const [index, arg] of argv.entries()) {
    if (arg.startsWith("--") && !supportedArgs.has(arg)) {
      throw new Error(`Unsupported argument: ${arg}`);
    }

    if (
      (argv[index - 1] === "--path" || argv[index - 1] === "--format") &&
      arg.startsWith("--")
    ) {
      throw new Error(`Missing value for ${argv[index - 1]}.`);
    }
  }

  const configPath = pathIndex === -1 ? undefined : argv[pathIndex + 1]?.trim();
  const formatValue =
    formatIndex === -1 ? "text" : argv[formatIndex + 1]?.trim();

  if (pathIndex !== -1 && !configPath) {
    throw new Error("Missing value for --path.");
  }

  if (formatValue !== "text" && formatValue !== "json") {
    throw new Error("Invalid --format value. Use text or json.");
  }

  return {
    configPath,
    format: formatValue,
  };
}

export function buildDigestRulesSummary(
  config: DigestRulesConfig,
  configPath: string,
): DigestRulesSummary {
  return {
    configPath,
    version: config.version,
    themeCount: config.themes.length,
    descriptionBlacklistCount: config.blacklists.descriptionKeywords.length,
    readmeBlacklistCount: config.blacklists.readmeKeywords.length,
    topicBlacklistCount: config.blacklists.topics.length,
    shortlistMaxPerTheme: config.selection.shortlistMaxPerTheme,
    poolMaxPerTheme: config.selection.poolMaxPerTheme,
    ensureMatureMomentum: config.selection.ensureMatureMomentum,
    recentPushMomentumBuckets: config.thresholds.recentPushMomentum.length,
    recentCreationNoveltyBuckets:
      config.thresholds.recentCreationNovelty.length,
  };
}

export function renderDigestRulesSummary(summary: DigestRulesSummary): string {
  return [
    "GitRadar digest rules config is valid.",
    `Config path: ${summary.configPath}`,
    `Rules version: ${summary.version}`,
    `Themes: ${summary.themeCount}`,
    `Description blacklist keywords: ${summary.descriptionBlacklistCount}`,
    `README blacklist keywords: ${summary.readmeBlacklistCount}`,
    `Topic blacklist keywords: ${summary.topicBlacklistCount}`,
    `Shortlist max per theme: ${summary.shortlistMaxPerTheme}`,
    `Pool max per theme: ${summary.poolMaxPerTheme}`,
    `Ensure mature momentum: ${summary.ensureMatureMomentum ? "yes" : "no"}`,
    `Recent push momentum buckets: ${summary.recentPushMomentumBuckets}`,
    `Recent creation novelty buckets: ${summary.recentCreationNoveltyBuckets}`,
  ].join("\n");
}

if (isDirectExecution()) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`GitRadar digest rules validation failed: ${message}`);
    process.exitCode = 1;
  });
}

function isDirectExecution(): boolean {
  const entry = process.argv[1];

  if (!entry) {
    return false;
  }

  return /validate-digest-rules\.(ts|js)$/.test(entry);
}
