import path from "node:path";

import type { DailyDigestArchive } from "../core/archive";
import {
  getDailyDigestArchivePath,
  readDailyDigestArchive,
  writeDailyDigestArchive,
} from "../core/archive";
import { getCurrentDigestDate, getIsoTimestamp } from "../core/date";
import type { GitHubConfig, LlmConfig, WecomRobotConfig } from "../config/env";
import {
  enrichCandidatesWithReadmes,
  fetchGitHubCandidates,
} from "../github/candidates";
import { WecomRobotNotifier } from "../notifiers/wecom-robot";
import {
  buildDigestCandidatePool,
  getRulesVersion,
  selectCandidatesForDigest,
} from "./rules";
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
  const enrichedCandidates = await enrichCandidatesWithReadmes(
    candidates,
    options.github,
  );
  const shortlisted = selectCandidatesForDigest(enrichedCandidates, 20);
  const llmPool = buildDigestCandidatePool(shortlisted, 8);
  const date = getCurrentDigestDate();
  const digest = await generateDigestWithModel(
    llmPool.selected,
    date,
    options.llm,
  );

  const archive: DailyDigestArchive = {
    generatedAt: getIsoTimestamp(),
    candidateCount: candidates.length,
    shortlistedCount: shortlisted.length,
    candidates: enrichedCandidates,
    shortlisted,
    selection: {
      llmCandidateRepos: llmPool.selected.map((candidate) => candidate.repo),
      selected: llmPool.selected.map((candidate) => ({
        repo: candidate.repo,
        theme: candidate.theme ?? "General OSS",
        reason:
          candidate.selectionHints?.selectionReason ??
          "综合评分和主题代表性更强。",
        evidence: candidate.selectionHints?.evidence ?? [],
      })),
      rejected: llmPool.rejected.map(({ candidate, reason }) => ({
        repo: candidate.repo,
        theme: candidate.theme ?? "General OSS",
        reason,
        evidence: candidate.selectionHints?.evidence ?? [],
      })),
    },
    generationMeta: {
      sourceCounts,
      llmCandidateCount: llmPool.selected.length,
      rulesVersion: getRulesVersion(),
    },
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

export interface ResendArchivedDigestOptions {
  rootDir?: string;
  date: string;
  wecom: WecomRobotConfig;
}

export async function resendArchivedDigest(
  options: ResendArchivedDigestOptions,
): Promise<{ archivePath: string; archive: DailyDigestArchive }> {
  const rootDir = options.rootDir ?? process.cwd();
  const archive = await readDailyDigestArchive(rootDir, options.date);

  if (archive.digest.items.length === 0) {
    throw new Error(
      `Daily digest archive has no items for ${options.date}: ${getDailyDigestArchivePath(rootDir, options.date)}.`,
    );
  }

  const notifier = new WecomRobotNotifier(options.wecom.webhookUrl);
  await notifier.sendDailyDigest(archive.digest);

  return {
    archivePath: path.resolve(getDailyDigestArchivePath(rootDir, options.date)),
    archive,
  };
}

function emptySourceCounts() {
  return {
    trending: 0,
    search_recently_updated: 0,
    search_recently_created: 0,
  };
}
