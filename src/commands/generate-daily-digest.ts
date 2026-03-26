import {
  getGitHubConfigFromEnv,
  getLlmConfigFromEnv,
  getWecomRobotConfigFromEnv,
} from "../config/env";
import { maskWebhookUrl } from "../config/mask";
import { generateDailyDigest } from "../digest/generate";

async function main(): Promise<void> {
  const shouldSend = process.argv.includes("--send");
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
  console.log(`Digest items: ${result.archive.digest.items.length}`);
  console.log(`Archive written to: ${result.archivePath}`);

  if (shouldSend && wecom) {
    console.log(
      `WeCom robot send completed successfully: ${maskWebhookUrl(wecom.webhookUrl)}`,
    );
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`GitRadar digest generation failed: ${message}`);
  process.exitCode = 1;
});
