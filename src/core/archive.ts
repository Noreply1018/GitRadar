import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import type { DailyDigest } from "./digest";
import type { CandidateSource, GitHubCandidateRepo } from "../github/types";

export const CURRENT_DAILY_DIGEST_ARCHIVE_SCHEMA_VERSION = 3;
const DEFAULT_THEME = "General OSS";

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
  return parseDailyDigestArchive(parsed, archivePath);
}

export function getDailyDigestArchivePath(
  rootDir: string,
  date: string,
): string {
  return path.join(getHistoryDir(rootDir), `${date}.json`);
}

export function parseDailyDigestArchive(
  value: unknown,
  sourceLabel: string,
): DailyDigestArchive {
  if (!isCurrentDailyDigestArchive(value)) {
    throw new Error(
      `Daily digest archive is not supported for ${sourceLabel}. Only schemaVersion ${CURRENT_DAILY_DIGEST_ARCHIVE_SCHEMA_VERSION} archives are supported.`,
    );
  }

  return cloneCurrentDailyDigestArchive(value);
}

function getHistoryDir(rootDir: string): string {
  return path.join(rootDir, "data", "history");
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
    isValidSourceCounts(meta.sourceCounts) &&
    (meta.editorialMode === undefined ||
      meta.editorialMode === "llm" ||
      meta.editorialMode === "template_fallback") &&
    (meta.warnings === undefined ||
      (Array.isArray(meta.warnings) &&
        meta.warnings.every((entry) => typeof entry === "string")))
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
        theme: item.theme || DEFAULT_THEME,
        evidence: [...item.evidence],
      })),
    },
    candidates: [...archive.candidates],
    shortlisted: [...archive.shortlisted],
    selection: {
      llmCandidateRepos: [...archive.selection.llmCandidateRepos],
      selected: archive.selection.selected.map((entry) => ({
        ...entry,
        theme: entry.theme || DEFAULT_THEME,
        evidence: [...entry.evidence],
      })),
      rejected: archive.selection.rejected.map((entry) => ({
        ...entry,
        theme: entry.theme || DEFAULT_THEME,
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
