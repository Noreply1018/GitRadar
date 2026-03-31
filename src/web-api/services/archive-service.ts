import {
  getDailyDigestArchivePath,
  type DailyDigestArchive,
} from "../../core/archive";
import type { ArchiveSummary } from "../types/api";

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
