import { readFile } from "node:fs/promises";
import path from "node:path";

import type { GitHubContentsFileResponse } from "./platform-client";

export interface GitHubRepositoryTarget {
  owner: string;
  repo: string;
}

export interface WritebackFileChange {
  path: string;
  contentBase64: string;
}

export async function collectChangedWritebackFiles(
  rootDir: string,
  repoPathList: string[],
  readRemoteContents: (
    repoPath: string,
  ) => Promise<GitHubContentsFileResponse | null>,
): Promise<WritebackFileChange[]> {
  const changedFiles: WritebackFileChange[] = [];

  for (const repoPath of repoPathList) {
    const localAbsolutePath = path.join(rootDir, repoPath);
    const localBuffer = await readFile(localAbsolutePath).catch((error) => {
      if (isMissingFileError(error)) {
        return null;
      }

      throw error;
    });

    if (!localBuffer) {
      continue;
    }

    const localContentBase64 = localBuffer.toString("base64");
    const remoteContents = await readRemoteContents(repoPath);

    if (
      remoteContents &&
      remoteContents.encoding === "base64" &&
      normalizeBase64(remoteContents.content) === localContentBase64
    ) {
      continue;
    }

    changedFiles.push({
      path: repoPath,
      contentBase64: localContentBase64,
    });
  }

  return changedFiles;
}

export function parseRepositoryTarget(
  repository: string | undefined,
): GitHubRepositoryTarget {
  if (!repository) {
    throw new Error("Missing GITHUB_REPOSITORY.");
  }

  const [owner, repo] = repository.split("/");
  if (!owner || !repo) {
    throw new Error(`Invalid GITHUB_REPOSITORY: ${repository}`);
  }

  return { owner, repo };
}

export function parseWritebackFileList(value: string | undefined): string[] {
  if (!value) {
    throw new Error("Missing GITRADAR_FILE_PATHS.");
  }

  const items = value
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);

  if (items.length === 0) {
    throw new Error("GITRADAR_FILE_PATHS did not include any files.");
  }

  return [...new Set(items)];
}

export function normalizeBase64(value: string): string {
  return value.replace(/\n/g, "").trim();
}

function isMissingFileError(error: unknown): boolean {
  return Boolean(
    error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "ENOENT",
  );
}
