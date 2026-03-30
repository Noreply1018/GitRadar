import { readdir } from "node:fs/promises";
import path from "node:path";

import {
  getDailyDigestArchivePath,
  readDailyDigestArchive,
  type DailyDigestArchive,
} from "../../core/archive";
import type {
  ArchiveDetailResponse,
  ArchiveListResponse,
  ArchiveSummary,
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

  return {
    archive,
    summary: buildArchiveSummary(archive),
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
