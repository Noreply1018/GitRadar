import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import type { DailyDigest } from "./digest";
import type { CandidateSource, GitHubCandidateRepo } from "../github/types";

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
}

export interface DailyDigestArchive {
  generatedAt: string;
  candidateCount: number;
  shortlistedCount: number;
  digest: DailyDigest;
  candidates?: GitHubCandidateRepo[];
  shortlisted?: GitHubCandidateRepo[];
  selection?: DailyDigestSelection;
  generationMeta?: DailyDigestGenerationMeta;
}

export async function writeDailyDigestArchive(
  archive: DailyDigestArchive,
  rootDir: string,
): Promise<string> {
  const historyDir = getHistoryDir(rootDir);
  await mkdir(historyDir, { recursive: true });

  const outputPath = getDailyDigestArchivePath(rootDir, archive.digest.date);
  await writeFile(outputPath, `${JSON.stringify(archive, null, 2)}\n`, "utf8");

  return outputPath;
}

export async function readDailyDigestArchive(
  rootDir: string,
  date: string,
): Promise<DailyDigestArchive> {
  const archivePath = getDailyDigestArchivePath(rootDir, date);
  let content: string;

  try {
    content = await readFile(archivePath, "utf8");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Daily digest archive not found for ${date}: ${archivePath}. ${message}`,
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Daily digest archive is not valid JSON for ${date}: ${message}`,
    );
  }

  if (!isDailyDigestArchive(parsed)) {
    throw new Error(
      `Daily digest archive is invalid for ${date}: ${archivePath}.`,
    );
  }

  return normalizeDailyDigestArchive(parsed);
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

function isDailyDigestArchive(value: unknown): value is DailyDigestArchive {
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

function normalizeDailyDigestArchive(
  archive: DailyDigestArchive,
): DailyDigestArchive {
  const digest = {
    ...archive.digest,
    items: archive.digest.items.map((item) => ({
      ...item,
      theme: item.theme ?? "General OSS",
      whyNow: item.whyNow ?? "未记录",
      evidence: item.evidence ?? [],
    })),
  };

  return {
    ...archive,
    digest,
    candidates: archive.candidates ?? [],
    shortlisted: archive.shortlisted ?? [],
    selection: archive.selection ?? {
      llmCandidateRepos: digest.items.map((item) => item.repo),
      selected: digest.items.map((item) => ({
        repo: item.repo,
        theme: item.theme,
        reason: item.whyNow || item.whyItMatters,
        evidence: item.evidence,
      })),
      rejected: [],
    },
    generationMeta: archive.generationMeta ?? {
      sourceCounts: {
        trending: 0,
        search_recently_updated: 0,
        search_recently_created: 0,
      },
      llmCandidateCount: digest.items.length,
      rulesVersion: "legacy",
    },
  };
}
