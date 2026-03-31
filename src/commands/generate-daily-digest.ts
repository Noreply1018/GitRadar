import {
  getGitHubConfigFromEnv,
  getLlmConfigFromEnv,
  getWecomRobotConfigFromEnv,
} from "../config/env";
import { maskWebhookUrl } from "../config/mask";
import { generateDailyDigest } from "../digest/generate";

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  const shouldSend = args.shouldSend;
  const github = getGitHubConfigFromEnv();
  const llm = getLlmConfigFromEnv();
  const wecom = shouldSend ? getWecomRobotConfigFromEnv() : undefined;

  console.log("Generating GitRadar daily digest...");
  console.log(`WeCom send enabled: ${shouldSend ? "yes" : "no"}`);

  if (shouldSend && wecom) {
    console.log(`WeCom target: ${maskWebhookUrl(wecom.webhookUrl)}`);
  }

  const result = await generateDailyDigest({
    github,
    llm,
    wecom,
    send: shouldSend,
    rootDir: process.cwd(),
  });

  console.log(`Trending candidates: ${result.sourceCounts.trending}`);
  console.log(
    `Search(updated) candidates: ${result.sourceCounts.search_recently_updated}`,
  );
  console.log(
    `Search(created) candidates: ${result.sourceCounts.search_recently_created}`,
  );
  console.log(`Merged candidates: ${result.archive.candidateCount}`);
  console.log(`Shortlisted candidates: ${result.archive.shortlistedCount}`);
  console.log(
    `LLM candidate pool: ${result.archive.selection?.llmCandidateRepos.length ?? 0}`,
  );
  console.log(`Digest items: ${result.archive.digest.items.length}`);
  console.log(`Archive written to: ${result.archivePath}`);

  if (shouldSend && wecom) {
    console.log(
      `WeCom robot send completed successfully: ${maskWebhookUrl(wecom.webhookUrl)}`,
    );
  }
}

function parseArgs(argv: string[]): {
  shouldSend: boolean;
} {
  for (const arg of argv) {
    if (arg === "--send") {
      continue;
    }

    if (arg === "--resend-date") {
      throw new Error("The --resend-date option is no longer supported.");
    }

    if (arg.startsWith("--")) {
      throw new Error(`Unsupported argument: ${arg}`);
    }
  }

  return { shouldSend: argv.includes("--send") };
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`GitRadar digest generation failed: ${message}`);
  process.exitCode = 1;
});
