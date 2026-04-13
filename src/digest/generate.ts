import path from "node:path";

import type { DailyDigestArchive } from "../core/archive";
import {
  CURRENT_DAILY_DIGEST_ARCHIVE_SCHEMA_VERSION,
  writeDailyDigestArchive,
} from "../core/archive";
import { getCurrentDigestDate, getIsoTimestamp } from "../core/date";
import { createWorkflowLogger } from "../core/log";
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
import { generateDigestWithResilience } from "./model";

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

const DEFAULT_LLM_POOL_SIZE = 12;

export async function generateDailyDigest(
  options: GenerateDigestOptions,
): Promise<GenerateDigestResult> {
  const rootDir = options.rootDir ?? process.cwd();
  const date = getCurrentDigestDate();
  const logger = createWorkflowLogger("daily_digest");
  let sourceCounts = emptySourceCounts();
  let candidateWarnings: string[] = [];
  let candidates = [] as Awaited<
    ReturnType<typeof fetchGitHubCandidates>
  >["candidates"];
  let enrichedCandidates = candidates;
  let shortlisted = [] as typeof candidates;
  let llmPool = {
    selected: [] as typeof candidates,
    rejected: [] as Array<{
      candidate: (typeof candidates)[number];
      reason: string;
    }>,
  };

  logger.info("daily_digest_started", {
    date,
    send: Boolean(options.send),
  });

  try {
    const fetched = await fetchGitHubCandidates({
      ...options.github,
      logger,
      onTrendingFailure: (error) => {
        logger.warn("source_trending_failed", {
          message: getErrorMessage(error),
          trendingUrl: options.github.trendingUrl,
        });
      },
    });
    candidates = fetched.candidates;
    sourceCounts = fetched.sourceCounts;
    candidateWarnings = fetched.warnings ?? [];

    logger.info("candidate_fetch_completed", {
      candidateCount: candidates.length,
      sourceCounts,
      warnings: candidateWarnings,
    });

    enrichedCandidates = await enrichCandidatesWithReadmes(
      candidates,
      options.github,
    );
    shortlisted = selectCandidatesForDigest(enrichedCandidates, 20);
    llmPool = buildDigestCandidatePool(shortlisted, DEFAULT_LLM_POOL_SIZE);

    logger.info("candidate_pool_built", {
      shortlistedCount: shortlisted.length,
      llmCandidateCount: llmPool.selected.length,
      rejectedCount: llmPool.rejected.length,
    });

    const digest = await generateDigestWithResilience(
      llmPool.selected,
      date,
      options.llm,
      { logger },
    );

    const archive: DailyDigestArchive = {
      schemaVersion: CURRENT_DAILY_DIGEST_ARCHIVE_SCHEMA_VERSION,
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
        warnings: candidateWarnings.length > 0 ? candidateWarnings : undefined,
      },
      digest,
    };
    const archivePath = await writeDailyDigestArchive(archive, rootDir);

    logger.info("archive_written", {
      archivePath: path.resolve(archivePath),
    });

    if (options.send) {
      if (!options.wecom) {
        throw new Error("WeCom config is required when send=true.");
      }

      try {
        const notifier = new WecomRobotNotifier(options.wecom.webhookUrl);
        await notifier.sendDailyDigest(digest);
        logger.info("delivery_wecom_succeeded", {
          itemCount: digest.items.length,
        });
      } catch (error) {
        logger.error("delivery_wecom_failed", {
          message: getErrorMessage(error),
          archivePath: path.resolve(archivePath),
        });
        throw error;
      }
    }

    logger.info("daily_digest_completed", {
      archivePath: path.resolve(archivePath),
      candidateCount: candidates.length,
      shortlistedCount: shortlisted.length,
      llmCandidateCount: llmPool.selected.length,
    });

    return {
      archivePath: path.resolve(archivePath),
      archive,
      sourceCounts,
    };
  } catch (error) {
    logger.error("daily_digest_failed", {
      message: getErrorMessage(error),
      send: Boolean(options.send),
      sourceCounts,
      candidateWarnings,
      candidateRepos: candidates.map((candidate) => candidate.repo),
      shortlistedRepos: shortlisted.map((candidate) => candidate.repo),
      llmCandidateRepos: llmPool.selected.map((candidate) => candidate.repo),
    });
    throw error;
  }
}

function emptySourceCounts() {
  return {
    trending: 0,
    search_recently_updated: 0,
    search_recently_created: 0,
  };
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
