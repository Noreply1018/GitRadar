import path from "node:path";

import type { DailyDigestArchive } from "../core/archive";
import { writeDailyDigestArchive } from "../core/archive";
import { getCurrentDigestDate, getIsoTimestamp } from "../core/date";
import type { GitHubConfig, LlmConfig, WecomRobotConfig } from "../config/env";
import {
  enrichCandidatesWithReadmes,
  fetchGitHubCandidates,
} from "../github/candidates";
import { WecomRobotNotifier } from "../notifiers/wecom-robot";
import { selectCandidatesForDigest } from "./rules";
import { generateDigestWithModel } from "./model";

export interface GenerateDigestOptions {
  rootDir?: string;
  github: GitHubConfig;
  llm: LlmConfig;
  wecom?: WecomRobotConfig;
  send?: boolean;
}

export interface GenerateDigestResult {
  archivePath: string;
  archive: DailyDigestArchive;
  sourceCounts: ReturnType<typeof emptySourceCounts>;
}

export async function generateDailyDigest(
  options: GenerateDigestOptions,
): Promise<GenerateDigestResult> {
  const rootDir = options.rootDir ?? process.cwd();
  const { candidates, sourceCounts } = await fetchGitHubCandidates(
    options.github,
  );
  const shortlisted = selectCandidatesForDigest(candidates, 20);
  const enriched = await enrichCandidatesWithReadmes(
    shortlisted,
    options.github,
  );
  const date = getCurrentDigestDate();
  const digest = await generateDigestWithModel(enriched, date, options.llm);

  const archive: DailyDigestArchive = {
    generatedAt: getIsoTimestamp(),
    candidateCount: candidates.length,
    shortlistedCount: enriched.length,
    digest,
  };
  const archivePath = await writeDailyDigestArchive(archive, rootDir);

  if (options.send) {
    if (!options.wecom) {
      throw new Error("WeCom config is required when send=true.");
    }

    const notifier = new WecomRobotNotifier(options.wecom.webhookUrl);
    await notifier.sendDailyDigest(digest);
  }

  return {
    archivePath: path.resolve(archivePath),
    archive,
    sourceCounts,
  };
}

function emptySourceCounts() {
  return {
    trending: 0,
    search_recently_updated: 0,
    search_recently_created: 0,
  };
}
