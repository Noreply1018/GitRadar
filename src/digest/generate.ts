import path from "node:path";

import type { DailyDigestArchive } from "../core/archive";
import {
  CURRENT_DAILY_DIGEST_ARCHIVE_SCHEMA_VERSION,
  getDailyDigestArchivePath,
  readDailyDigestArchive,
  writeDailyDigestArchive,
} from "../core/archive";
import {
  toErrorPayload,
  writeDailyDigestFailureReport,
} from "../core/failure-report";
import { getCurrentDigestDate, getIsoTimestamp } from "../core/date";
import { createWorkflowLogger } from "../core/log";
import {
  getUserPreferencesConfigPath,
  loadUserPreferencesConfig,
} from "../config/user-preferences";
import type { GitHubConfig, LlmConfig, WecomRobotConfig } from "../config/env";
import { buildFeedbackInsights } from "../feedback/insights";
import { readFeedbackStateSync } from "../feedback/store";
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
      onTrendingFailure: async (error) => {
        const failurePath = await writeDailyDigestFailureReport(rootDir, {
          workflow: "generate_daily_digest",
          stage: "source_trending",
          fallbackUsed: true,
          error: toErrorPayload(error),
          context: {
            trendingUrl: options.github.trendingUrl,
          },
          digestDate: date,
        });

        logger.warn("source_trending_failure_recorded", {
          failurePath,
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

    const editorialResult = await generateDigestWithResilience(
      llmPool.selected,
      date,
      options.llm,
      {
        logger,
        onModelFailure: async (error) => {
          const failurePath = await writeDailyDigestFailureReport(rootDir, {
            workflow: "generate_daily_digest",
            stage: "editorial_model",
            fallbackUsed: true,
            error: toErrorPayload(error),
            context: {
              llmCandidateRepos: llmPool.selected.map(
                (candidate) => candidate.repo,
              ),
              llmCandidates: llmPool.selected,
              rulesVersion: getRulesVersion(),
              model: options.llm.model,
            },
            digestDate: date,
          });

          logger.warn("editorial_model_failure_recorded", {
            failurePath,
          });
        },
      },
    );
    const digest = markExplorationItem(
      editorialResult.digest,
      llmPool.selected,
      rootDir,
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
        editorialMode: editorialResult.mode,
        warnings: candidateWarnings.length > 0 ? candidateWarnings : undefined,
      },
      digest,
    };
    const archivePath = await writeDailyDigestArchive(archive, rootDir);

    logger.info("archive_written", {
      archivePath: path.resolve(archivePath),
      editorialMode: editorialResult.mode,
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
        const failurePath = await writeDailyDigestFailureReport(rootDir, {
          workflow: "generate_daily_digest",
          stage: "delivery_wecom",
          fallbackUsed: false,
          error: toErrorPayload(error),
          context: {
            archivePath: path.resolve(archivePath),
            digestTitle: digest.title,
            digestItemRepos: digest.items.map((item) => item.repo),
          },
          digestDate: date,
        });
        logger.error("delivery_wecom_failed", {
          failurePath,
          message: getErrorMessage(error),
        });
        throw error;
      }
    }

    logger.info("daily_digest_completed", {
      archivePath: path.resolve(archivePath),
      candidateCount: candidates.length,
      shortlistedCount: shortlisted.length,
      llmCandidateCount: llmPool.selected.length,
      editorialMode: editorialResult.mode,
    });

    return {
      archivePath: path.resolve(archivePath),
      archive,
      sourceCounts,
    };
  } catch (error) {
    const failurePath = await writeDailyDigestFailureReport(rootDir, {
      workflow: "generate_daily_digest",
      stage: "generate_daily_digest",
      fallbackUsed: false,
      error: toErrorPayload(error),
      context: {
        send: Boolean(options.send),
        sourceCounts,
        candidateWarnings,
        candidateRepos: candidates.map((candidate) => candidate.repo),
        shortlistedRepos: shortlisted.map((candidate) => candidate.repo),
        llmCandidateRepos: llmPool.selected.map((candidate) => candidate.repo),
      },
      digestDate: date,
    });

    logger.error("daily_digest_failed", {
      failurePath,
      message: getErrorMessage(error),
    });
    throw error;
  }
}

function markExplorationItem(
  digest: DailyDigestArchive["digest"],
  candidates: DailyDigestArchive["shortlisted"],
  rootDir: string,
): DailyDigestArchive["digest"] {
  const preferences = loadUserPreferencesConfig(
    getUserPreferencesConfigPath(rootDir),
  );
  const feedbackState = readFeedbackStateSync(rootDir);
  const insights = buildFeedbackInsights(feedbackState, preferences);
  const preferredThemes = new Set(preferences.preferredThemes);
  const interestedThemes = new Set(
    insights.interestedThemes.map((item) => item.theme),
  );
  const skippedThemes = new Set(
    insights.skippedThemes.map((item) => item.theme),
  );
  const candidateByRepo = new Map(
    candidates.map((candidate) => [candidate.repo, candidate]),
  );

  const exploration = digest.items.find((item) => {
    if (preferredThemes.has(item.theme) || interestedThemes.has(item.theme)) {
      return false;
    }

    if (skippedThemes.has(item.theme)) {
      return false;
    }

    const candidate = candidateByRepo.get(item.repo);
    return Boolean(
      candidate &&
        (candidate.sources.length >= 2 ||
          candidate.selectionHints?.matureMomentum),
    );
  });

  if (!exploration) {
    return digest;
  }

  return {
    ...digest,
    items: digest.items.map((item) =>
      item.repo === exploration.repo
        ? {
            ...item,
            readerTag: "exploration",
            readerNote:
              "这条是今天刻意保留的探索位：主题和你最近高频兴趣重合不高，但信号够硬，适合偶尔跳出舒适区。",
          }
        : item,
    ),
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

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
