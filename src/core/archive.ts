import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Dirent } from "node:fs";

import type { DailyDigest } from "./digest";
import type { CandidateSource, GitHubCandidateRepo } from "../github/types";

export const CURRENT_DAILY_DIGEST_ARCHIVE_SCHEMA_VERSION = 3;
const ARCHIVE_FILE_PATTERN = /^\d{4}-\d{2}-\d{2}\.json$/;
const DEFAULT_THEME = "General OSS";
const LEGACY_RULES_VERSION = "legacy";

export interface ArchiveSelectionEntry {
  repo: string;
  theme: string;
  reason: string;
  evidence: string[];
}

export interface DailyDigestSelection {
  llmCandidateRepos: string[];
  selected: ArchiveSelectionEntry[];
  rejected: ArchiveSelectionEntry[];
}

export interface DailyDigestGenerationMeta {
  sourceCounts: Record<CandidateSource, number>;
  llmCandidateCount: number;
  rulesVersion: string;
  editorialMode?: "llm" | "template_fallback";
  warnings?: string[];
}

export interface DailyDigestArchive {
  schemaVersion: typeof CURRENT_DAILY_DIGEST_ARCHIVE_SCHEMA_VERSION;
  generatedAt: string;
  candidateCount: number;
  shortlistedCount: number;
  digest: DailyDigest;
  candidates: GitHubCandidateRepo[];
  shortlisted: GitHubCandidateRepo[];
  selection: DailyDigestSelection;
  generationMeta: DailyDigestGenerationMeta;
}

export interface ArchiveMigrationSummary {
  scanned: number;
  alreadyCurrent: number;
  migrated: number;
  files: Array<{
    date: string;
    path: string;
    fromSchemaVersion: number | "legacy";
    changed: boolean;
  }>;
}

export async function writeDailyDigestArchive(
  archive: DailyDigestArchive,
  rootDir: string,
): Promise<string> {
  const historyDir = getHistoryDir(rootDir);
  await mkdir(historyDir, { recursive: true });

  const outputPath = getDailyDigestArchivePath(rootDir, archive.digest.date);
  await writeFile(outputPath, stringifyArchive(archive), "utf8");

  return outputPath;
}

export async function readDailyDigestArchive(
  rootDir: string,
  date: string,
): Promise<DailyDigestArchive> {
  const archivePath = getDailyDigestArchivePath(rootDir, date);
  const parsed = await readArchiveJson(archivePath, date);

  if (!isCurrentDailyDigestArchive(parsed)) {
    throw new Error(
      `Daily digest archive schema mismatch for ${date}: ${archivePath}. Expected schemaVersion ${CURRENT_DAILY_DIGEST_ARCHIVE_SCHEMA_VERSION}, found ${getSchemaVersionLabel(parsed)}. Run "npm run migrate:archives".`,
    );
  }

  return cloneCurrentDailyDigestArchive(parsed);
}

export async function migrateDailyDigestArchives(
  rootDir: string,
  options?: {
    dryRun?: boolean;
  },
): Promise<ArchiveMigrationSummary> {
  const historyDir = getHistoryDir(rootDir);
  let entries: Dirent[];

  try {
    entries = await readdir(historyDir, { withFileTypes: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      return {
        scanned: 0,
        alreadyCurrent: 0,
        migrated: 0,
        files: [],
      };
    }

    throw new Error(`Failed to read archive history directory: ${message}`);
  }

  const files = entries
    .filter((entry) => entry.isFile() && ARCHIVE_FILE_PATTERN.test(entry.name))
    .map((entry) => entry.name)
    .sort();

  const summary: ArchiveMigrationSummary = {
    scanned: files.length,
    alreadyCurrent: 0,
    migrated: 0,
    files: [],
  };

  for (const fileName of files) {
    const date = fileName.replace(/\.json$/, "");
    const archivePath = path.join(historyDir, fileName);
    const parsed = await readArchiveJson(archivePath, date);
    const fromSchemaVersion = getSchemaVersionLabel(parsed);
    const migratedArchive = migrateDailyDigestArchive(parsed);
    const changed =
      !isCurrentDailyDigestArchive(parsed) ||
      stringifyArchive(parsed) !== stringifyArchive(migratedArchive);

    summary.files.push({
      date,
      path: archivePath,
      fromSchemaVersion,
      changed,
    });

    if (changed) {
      summary.migrated += 1;

      if (!options?.dryRun) {
        await writeFile(archivePath, stringifyArchive(migratedArchive), "utf8");
      }

      continue;
    }

    summary.alreadyCurrent += 1;
  }

  return summary;
}

export function getDailyDigestArchivePath(
  rootDir: string,
  date: string,
): string {
  return path.join(getHistoryDir(rootDir), `${date}.json`);
}

function getHistoryDir(rootDir: string): string {
  return path.join(rootDir, "data", "history");
}

export function migrateDailyDigestArchive(value: unknown): DailyDigestArchive {
  if (!isReadableDailyDigestArchive(value)) {
    throw new Error("Daily digest archive is invalid.");
  }

  const archive = value as unknown as Record<string, unknown>;
  const digest = archive.digest as Record<string, unknown>;
  const normalizedItems = normalizeDigestItems(digest.items);
  const fallbackSelection = buildSelectionFromDigestItems(normalizedItems);

  return {
    schemaVersion: CURRENT_DAILY_DIGEST_ARCHIVE_SCHEMA_VERSION,
    generatedAt: archive.generatedAt as string,
    candidateCount: archive.candidateCount as number,
    shortlistedCount: archive.shortlistedCount as number,
    digest: {
      date: digest.date as string,
      title: digest.title as string,
      items: normalizedItems,
    },
    candidates: normalizeCandidateArray(archive.candidates),
    shortlisted: normalizeCandidateArray(archive.shortlisted),
    selection: normalizeSelection(archive.selection, fallbackSelection),
    generationMeta: normalizeGenerationMeta(
      archive.generationMeta,
      fallbackSelection.selected.length,
    ),
  };
}

function isReadableDailyDigestArchive(
  value: unknown,
): value is DailyDigestArchive {
  if (!value || typeof value !== "object") {
    return false;
  }

  const archive = value as Record<string, unknown>;
  const digest = archive.digest;

  if (!digest || typeof digest !== "object") {
    return false;
  }

  const items = (digest as Record<string, unknown>).items;

  return (
    typeof archive.generatedAt === "string" &&
    typeof archive.candidateCount === "number" &&
    typeof archive.shortlistedCount === "number" &&
    typeof (digest as Record<string, unknown>).date === "string" &&
    typeof (digest as Record<string, unknown>).title === "string" &&
    Array.isArray(items)
  );
}

function isCurrentDailyDigestArchive(
  value: unknown,
): value is DailyDigestArchive {
  if (!isReadableDailyDigestArchive(value)) {
    return false;
  }

  const archive = value as unknown as Record<string, unknown>;
  const digest = archive.digest as Record<string, unknown>;
  const items = digest.items;

  return (
    archive.schemaVersion === CURRENT_DAILY_DIGEST_ARCHIVE_SCHEMA_VERSION &&
    Array.isArray(archive.candidates) &&
    Array.isArray(archive.shortlisted) &&
    isValidSelection(archive.selection) &&
    isValidGenerationMeta(archive.generationMeta) &&
    Array.isArray(items) &&
    items.every(isValidDigestItem)
  );
}

function normalizeDigestItems(value: unknown): DailyDigest["items"] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map((item) => normalizeDigestItem(item));
}

function normalizeDigestItem(value: unknown): DailyDigest["items"][number] {
  if (!value || typeof value !== "object") {
    throw new Error("Daily digest item is invalid.");
  }

  const item = value as Record<string, unknown>;

  if (
    typeof item.repo !== "string" ||
    typeof item.url !== "string" ||
    typeof item.summary !== "string" ||
    typeof item.whyItMatters !== "string" ||
    typeof item.novelty !== "string" ||
    typeof item.trend !== "string"
  ) {
    throw new Error("Daily digest item is invalid.");
  }

  return {
    repo: item.repo,
    url: item.url,
    theme: typeof item.theme === "string" ? item.theme : DEFAULT_THEME,
    summary: item.summary,
    whyItMatters: item.whyItMatters,
    whyNow: typeof item.whyNow === "string" ? item.whyNow : "未记录",
    evidence: Array.isArray(item.evidence)
      ? item.evidence.filter(
          (entry): entry is string => typeof entry === "string",
        )
      : [],
    novelty: item.novelty,
    trend: item.trend,
    readerTag: item.readerTag === "exploration" ? "exploration" : undefined,
    readerNote:
      typeof item.readerNote === "string" && item.readerNote.trim()
        ? item.readerNote
        : undefined,
  };
}

function buildSelectionFromDigestItems(
  items: DailyDigest["items"],
): DailyDigestSelection {
  return {
    llmCandidateRepos: items.map((item) => item.repo),
    selected: items.map((item) => ({
      repo: item.repo,
      theme: item.theme,
      reason: item.whyNow === "未记录" ? item.whyItMatters : item.whyNow,
      evidence: item.evidence,
    })),
    rejected: [],
  };
}

function normalizeSelection(
  value: unknown,
  fallback: DailyDigestSelection,
): DailyDigestSelection {
  if (!value || typeof value !== "object") {
    return fallback;
  }

  const selection = value as Record<string, unknown>;

  return {
    llmCandidateRepos: Array.isArray(selection.llmCandidateRepos)
      ? selection.llmCandidateRepos.filter(
          (repo): repo is string => typeof repo === "string",
        )
      : fallback.llmCandidateRepos,
    selected: Array.isArray(selection.selected)
      ? selection.selected.map((entry) => normalizeSelectionEntry(entry))
      : fallback.selected,
    rejected: Array.isArray(selection.rejected)
      ? selection.rejected.map((entry) => normalizeSelectionEntry(entry))
      : fallback.rejected,
  };
}

function normalizeSelectionEntry(value: unknown): ArchiveSelectionEntry {
  if (!value || typeof value !== "object") {
    throw new Error("Archive selection entry is invalid.");
  }

  const entry = value as Record<string, unknown>;

  if (typeof entry.repo !== "string") {
    throw new Error("Archive selection entry is invalid.");
  }

  return {
    repo: entry.repo,
    theme: typeof entry.theme === "string" ? entry.theme : DEFAULT_THEME,
    reason:
      typeof entry.reason === "string" && entry.reason.trim()
        ? entry.reason
        : "未记录",
    evidence: Array.isArray(entry.evidence)
      ? entry.evidence.filter(
          (item): item is string => typeof item === "string",
        )
      : [],
  };
}

function normalizeGenerationMeta(
  value: unknown,
  fallbackLlmCandidateCount: number,
): DailyDigestGenerationMeta {
  const fallbackSourceCounts = emptySourceCounts();

  if (!value || typeof value !== "object") {
    return {
      sourceCounts: fallbackSourceCounts,
      llmCandidateCount: fallbackLlmCandidateCount,
      rulesVersion: LEGACY_RULES_VERSION,
    };
  }

  const generationMeta = value as Record<string, unknown>;

  return {
    sourceCounts: normalizeSourceCounts(generationMeta.sourceCounts),
    llmCandidateCount:
      typeof generationMeta.llmCandidateCount === "number"
        ? generationMeta.llmCandidateCount
        : fallbackLlmCandidateCount,
    rulesVersion:
      typeof generationMeta.rulesVersion === "string"
        ? generationMeta.rulesVersion
        : LEGACY_RULES_VERSION,
    editorialMode:
      generationMeta.editorialMode === "llm" ||
      generationMeta.editorialMode === "template_fallback"
        ? generationMeta.editorialMode
        : undefined,
    warnings: Array.isArray(generationMeta.warnings)
      ? generationMeta.warnings.filter(
          (entry): entry is string => typeof entry === "string",
        )
      : undefined,
  };
}

function normalizeSourceCounts(
  value: unknown,
): Record<CandidateSource, number> {
  const fallback = emptySourceCounts();

  if (!value || typeof value !== "object") {
    return fallback;
  }

  const sourceCounts = value as Record<string, unknown>;

  return {
    trending:
      typeof sourceCounts.trending === "number"
        ? sourceCounts.trending
        : fallback.trending,
    search_recently_updated:
      typeof sourceCounts.search_recently_updated === "number"
        ? sourceCounts.search_recently_updated
        : fallback.search_recently_updated,
    search_recently_created:
      typeof sourceCounts.search_recently_created === "number"
        ? sourceCounts.search_recently_created
        : fallback.search_recently_created,
  };
}

function normalizeCandidateArray(value: unknown): GitHubCandidateRepo[] {
  return Array.isArray(value) ? (value as GitHubCandidateRepo[]) : [];
}

function isValidDigestItem(value: unknown): boolean {
  if (!value || typeof value !== "object") {
    return false;
  }

  const item = value as Record<string, unknown>;

  return (
    typeof item.repo === "string" &&
    typeof item.url === "string" &&
    typeof item.theme === "string" &&
    typeof item.summary === "string" &&
    typeof item.whyItMatters === "string" &&
    typeof item.whyNow === "string" &&
    Array.isArray(item.evidence) &&
    item.evidence.every((entry) => typeof entry === "string") &&
    typeof item.novelty === "string" &&
    typeof item.trend === "string" &&
    (item.readerTag === undefined || item.readerTag === "exploration") &&
    (item.readerNote === undefined || typeof item.readerNote === "string")
  );
}

function isValidSelection(value: unknown): boolean {
  if (!value || typeof value !== "object") {
    return false;
  }

  const selection = value as Record<string, unknown>;

  return (
    Array.isArray(selection.llmCandidateRepos) &&
    selection.llmCandidateRepos.every((repo) => typeof repo === "string") &&
    Array.isArray(selection.selected) &&
    selection.selected.every(isValidSelectionEntry) &&
    Array.isArray(selection.rejected) &&
    selection.rejected.every(isValidSelectionEntry)
  );
}

function isValidSelectionEntry(value: unknown): boolean {
  if (!value || typeof value !== "object") {
    return false;
  }

  const entry = value as Record<string, unknown>;

  return (
    typeof entry.repo === "string" &&
    typeof entry.theme === "string" &&
    typeof entry.reason === "string" &&
    Array.isArray(entry.evidence) &&
    entry.evidence.every((item) => typeof item === "string")
  );
}

function isValidGenerationMeta(value: unknown): boolean {
  if (!value || typeof value !== "object") {
    return false;
  }

  const meta = value as Record<string, unknown>;

  return (
    typeof meta.llmCandidateCount === "number" &&
    typeof meta.rulesVersion === "string" &&
    isValidSourceCounts(meta.sourceCounts)
  );
}

function isValidSourceCounts(value: unknown): boolean {
  if (!value || typeof value !== "object") {
    return false;
  }

  const sourceCounts = value as Record<string, unknown>;

  return (
    typeof sourceCounts.trending === "number" &&
    typeof sourceCounts.search_recently_updated === "number" &&
    typeof sourceCounts.search_recently_created === "number"
  );
}

function cloneCurrentDailyDigestArchive(
  archive: DailyDigestArchive,
): DailyDigestArchive {
  return {
    schemaVersion: archive.schemaVersion,
    generatedAt: archive.generatedAt,
    candidateCount: archive.candidateCount,
    shortlistedCount: archive.shortlistedCount,
    digest: {
      date: archive.digest.date,
      title: archive.digest.title,
      items: archive.digest.items.map((item) => ({
        ...item,
        evidence: [...item.evidence],
      })),
    },
    candidates: [...archive.candidates],
    shortlisted: [...archive.shortlisted],
    selection: {
      llmCandidateRepos: [...archive.selection.llmCandidateRepos],
      selected: archive.selection.selected.map((entry) => ({
        ...entry,
        evidence: [...entry.evidence],
      })),
      rejected: archive.selection.rejected.map((entry) => ({
        ...entry,
        evidence: [...entry.evidence],
      })),
    },
    generationMeta: {
      sourceCounts: {
        ...archive.generationMeta.sourceCounts,
      },
      llmCandidateCount: archive.generationMeta.llmCandidateCount,
      rulesVersion: archive.generationMeta.rulesVersion,
      editorialMode: archive.generationMeta.editorialMode,
      warnings: archive.generationMeta.warnings
        ? [...archive.generationMeta.warnings]
        : undefined,
    },
  };
}

function stringifyArchive(archive: DailyDigestArchive): string {
  return `${JSON.stringify(archive, null, 2)}\n`;
}

async function readArchiveJson(
  archivePath: string,
  date: string,
): Promise<unknown> {
  let content: string;

  try {
    content = await readFile(archivePath, "utf8");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Daily digest archive not found for ${date}: ${archivePath}. ${message}`,
    );
  }

  try {
    return JSON.parse(content);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Daily digest archive is not valid JSON for ${date}: ${message}`,
    );
  }
}

function getSchemaVersionLabel(value: unknown): number | "legacy" {
  if (value && typeof value === "object" && "schemaVersion" in value) {
    const schemaVersion = (value as Record<string, unknown>).schemaVersion;

    if (typeof schemaVersion === "number") {
      return schemaVersion;
    }
  }

  return "legacy";
}

function emptySourceCounts(): Record<CandidateSource, number> {
  return {
    trending: 0,
    search_recently_updated: 0,
    search_recently_created: 0,
  };
}
