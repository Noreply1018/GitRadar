import {
  getGitHubConfigFromEnv,
  getLlmConfigFromEnv,
  getWecomRobotConfigFromEnv,
} from "../config/env";
import { maskWebhookUrl } from "../config/mask";
import { generateDailyDigest, resendArchivedDigest } from "../digest/generate";

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  if (args.resendDate) {
    const wecom = getWecomRobotConfigFromEnv();
    console.log(`Resending archived GitRadar digest for ${args.resendDate}...`);
    console.log(`WeCom target: ${maskWebhookUrl(wecom.webhookUrl)}`);

    const result = await resendArchivedDigest({
      date: args.resendDate,
      wecom,
      rootDir: process.cwd(),
    });

    console.log(`Archive loaded from: ${result.archivePath}`);
    console.log(`Digest items: ${result.archive.digest.items.length}`);
    console.log(
      `WeCom robot resend completed successfully: ${maskWebhookUrl(wecom.webhookUrl)}`,
    );
    return;
  }

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
  resendDate?: string;
} {
  const shouldSend = argv.includes("--send");
  const resendIndex = argv.indexOf("--resend-date");

  if (resendIndex === -1) {
    return { shouldSend };
  }

  const resendDate = argv[resendIndex + 1]?.trim();

  if (!resendDate) {
    throw new Error("Missing value for --resend-date. Use YYYY-MM-DD.");
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(resendDate)) {
    throw new Error("Invalid --resend-date format. Use YYYY-MM-DD.");
  }

  return {
    shouldSend,
    resendDate,
  };
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`GitRadar digest generation failed: ${message}`);
  process.exitCode = 1;
});
