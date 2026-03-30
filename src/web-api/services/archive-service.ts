import { readdir } from "node:fs/promises";
import path from "node:path";

import {
  getDailyDigestArchivePath,
  readDailyDigestArchive,
  type DailyDigestArchive,
} from "../../core/archive";
import { loadUserPreferencesConfig } from "../../config/user-preferences";
import { buildFeedbackInsights } from "../../feedback/insights";
import { readFeedbackState } from "../../feedback/store";
import type {
  ArchiveDetailResponse,
  ArchiveListResponse,
  ArchiveSummary,
  ArchiveReaderContext,
} from "../types/api";

const ARCHIVE_FILE_PATTERN = /^\d{4}-\d{2}-\d{2}\.json$/;

export async function listArchiveSummaries(
  rootDir: string,
): Promise<ArchiveListResponse> {
  const historyDir = path.join(rootDir, "data", "history");

  let fileNames: string[];

  try {
    fileNames = (await readdir(historyDir))
      .filter((fileName) => ARCHIVE_FILE_PATTERN.test(fileName))
      .sort()
      .reverse();
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      return { archives: [] };
    }

    throw error;
  }

  const archives: ArchiveSummary[] = [];

  for (const fileName of fileNames) {
    const date = fileName.replace(/\.json$/, "");
    const archive = await readDailyDigestArchive(rootDir, date);
    archives.push(buildArchiveSummary(archive));
  }

  return { archives };
}

export async function getArchiveDetail(
  rootDir: string,
  date: string,
): Promise<ArchiveDetailResponse> {
  const archive = await readDailyDigestArchive(rootDir, date);
  const feedbackState = await readFeedbackState(rootDir);
  const preferences = loadUserPreferencesConfig(
    path.join(rootDir, "config", "user-preferences.json"),
  );
  const insights = buildFeedbackInsights(feedbackState, preferences);

  return {
    archive,
    summary: buildArchiveSummary(archive),
    readerContext: buildReaderContext(archive, insights),
  };
}

export function buildArchiveSummary(
  archive: DailyDigestArchive,
): ArchiveSummary {
  return {
    date: archive.digest.date,
    generatedAt: archive.generatedAt,
    schemaVersion: archive.schemaVersion,
    rulesVersion: archive.generationMeta.rulesVersion,
    digestCount: archive.digest.items.length,
    title: archive.digest.title,
    editorialMode: archive.generationMeta.editorialMode ?? "llm",
    topRepos: archive.digest.items.slice(0, 3).map((item) => item.repo),
  };
}

export function getArchivePath(rootDir: string, date: string): string {
  return getDailyDigestArchivePath(rootDir, date);
}

function buildReaderContext(
  archive: DailyDigestArchive,
  insights: ReturnType<typeof buildFeedbackInsights>,
): ArchiveReaderContext {
  return {
    editorialIntro: buildEditorialIntro(archive),
    preferenceSuggestion: insights.preferenceSuggestion,
    interestTrack: {
      interestedThemes: insights.interestedThemes,
      skippedThemes: insights.skippedThemes,
    },
    explorationRepo:
      archive.digest.items.find((item) => item.readerTag === "exploration")
        ?.repo ?? null,
  };
}

function buildEditorialIntro(archive: DailyDigestArchive): string[] {
  const lines: string[] = [];
  const themeCounts = countThemes(archive);
  const leadingTheme = [...themeCounts.entries()].sort(
    (left, right) => right[1] - left[1],
  )[0];
  const multiSourceCount = archive.digest.items.filter((item) =>
    item.evidence.some((entry) => entry.includes("多来源")),
  ).length;
  const matureCount = archive.digest.items.filter((item) =>
    item.evidence.some((entry) => entry.includes("成熟项目近期再次升温")),
  ).length;
  const explorationItem = archive.digest.items.find(
    (item) => item.readerTag === "exploration",
  );

  if (leadingTheme) {
    lines.push(
      `今天偏向 ${leadingTheme[0]}，因为这一类候选在当前信号池里最集中，最终成稿里占了 ${leadingTheme[1]} 条。`,
    );
  } else {
    lines.push(
      "今天这期更强调少而准，优先保留近期信号和项目形态都更明确的仓库。",
    );
  }

  if (matureCount > 0) {
    lines.push(
      `这期保留了 ${matureCount} 条成熟项目回暖位，避免日报只追新而错过重新升温的老牌仓库。`,
    );
  } else if (multiSourceCount > 0) {
    lines.push(
      `其中 ${multiSourceCount} 条同时命中多来源信号，今天整体更偏“近期活跃且证据够硬”的编辑判断。`,
    );
  } else {
    lines.push("今天的入选更看重近期推进节奏和可读性，而不是单一热度。");
  }

  if (explorationItem) {
    lines.push(
      `另外补了一条探索位 ${explorationItem.theme}，刻意给阅读范围留出一点跳出舒适区的空间。`,
    );
  } else {
    lines.push(
      "整体仍然保持主题分散，尽量让今天的列表既有判断也不失横向视野。",
    );
  }

  return lines.slice(0, 3);
}

function countThemes(archive: DailyDigestArchive): Map<string, number> {
  const counts = new Map<string, number>();

  for (const item of archive.digest.items) {
    counts.set(item.theme, (counts.get(item.theme) ?? 0) + 1);
  }

  return counts;
}
