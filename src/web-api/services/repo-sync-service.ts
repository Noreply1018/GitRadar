import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const DEFAULT_BRANCH = "main";
const REMOTE_NAME = "origin";
const REMOTE_SYNC_TTL_MS = 30_000;

let remoteSyncPromise: Promise<string> | null = null;
let lastRemoteSyncAt = 0;
let lastRemoteRef = "FETCH_HEAD";

export interface RepoWriteResult {
  committed: boolean;
  commitSha: string | null;
  targetRef: string | null;
  pushed: boolean;
  committedAt: string | null;
}

export async function commitAndPushRepoFiles(
  rootDir: string,
  files: string[],
  message: string,
): Promise<RepoWriteResult> {
  if (!(await isGitRepository(rootDir))) {
    return emptyWriteResult();
  }

  const branch = await resolveCurrentBranch(rootDir);
  const normalizedFiles = uniqueFiles(files);

  if (normalizedFiles.length === 0) {
    return {
      ...emptyWriteResult(),
      targetRef: branch,
    };
  }

  await execFileAsync("git", ["add", "--", ...normalizedFiles], {
    cwd: rootDir,
  });

  const hasChanges = await hasStagedChanges(rootDir, normalizedFiles);

  if (!hasChanges) {
    return {
      ...emptyWriteResult(),
      targetRef: branch,
    };
  }

  await execFileAsync("git", ["commit", "-m", message], {
    cwd: rootDir,
    maxBuffer: 10 * 1024 * 1024,
  });

  const commitSha = (
    await execFileAsync("git", ["rev-parse", "HEAD"], {
      cwd: rootDir,
    })
  ).stdout.trim();
  const hasOrigin = await hasGitRemote(rootDir, REMOTE_NAME);

  if (hasOrigin) {
    await execFileAsync("git", ["push", REMOTE_NAME, `HEAD:${branch}`], {
      cwd: rootDir,
      maxBuffer: 10 * 1024 * 1024,
    });
  }

  return {
    committed: true,
    commitSha,
    targetRef: branch,
    pushed: hasOrigin,
    committedAt: new Date().toISOString(),
  };
}

export async function readRemoteRepoFile(
  rootDir: string,
  repoPath: string,
): Promise<string> {
  if (!(await isGitRepository(rootDir))) {
    return readLocalRepoFile(rootDir, repoPath);
  }

  if (!(await hasGitRemote(rootDir, REMOTE_NAME))) {
    return readLocalRepoFile(rootDir, repoPath);
  }

  const ref = await syncRemoteRef(rootDir);
  const spec = `${ref}:${repoPath}`;

  try {
    const { stdout } = await execFileAsync("git", ["show", spec], {
      cwd: rootDir,
      maxBuffer: 10 * 1024 * 1024,
    });
    return stdout;
  } catch (error) {
    if (isMissingGitPathError(error)) {
      return readLocalRepoFile(rootDir, repoPath);
    }

    throw new Error(
      `Failed to read remote repo file ${repoPath}: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}

export async function readRemoteRepoJson<T>(
  rootDir: string,
  repoPath: string,
  fallback: T,
): Promise<T> {
  try {
    const raw = await readRemoteRepoFile(rootDir, repoPath);
    return JSON.parse(raw) as T;
  } catch (error) {
    if (isMissingFileError(error)) {
      return fallback;
    }

    throw error;
  }
}

async function readLocalRepoFile(
  rootDir: string,
  repoPath: string,
): Promise<string> {
  return readFile(path.join(rootDir, repoPath), "utf8");
}

async function syncRemoteRef(rootDir: string): Promise<string> {
  if (Date.now() - lastRemoteSyncAt < REMOTE_SYNC_TTL_MS) {
    return lastRemoteRef;
  }

  if (!remoteSyncPromise) {
    remoteSyncPromise = (async () => {
      const branch = await resolveCurrentBranch(rootDir);
      await execFileAsync("git", ["fetch", REMOTE_NAME, branch], {
        cwd: rootDir,
        maxBuffer: 10 * 1024 * 1024,
      });
      lastRemoteSyncAt = Date.now();
      lastRemoteRef = "FETCH_HEAD";
      return lastRemoteRef;
    })().finally(() => {
      remoteSyncPromise = null;
    });
  }

  return remoteSyncPromise;
}

async function hasStagedChanges(
  rootDir: string,
  files: string[],
): Promise<boolean> {
  try {
    await execFileAsync(
      "git",
      ["diff", "--cached", "--quiet", "--", ...files],
      {
        cwd: rootDir,
      },
    );
    return false;
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === 1
    ) {
      return true;
    }

    throw error;
  }
}

async function resolveCurrentBranch(rootDir: string): Promise<string> {
  if (!(await isGitRepository(rootDir))) {
    return DEFAULT_BRANCH;
  }

  try {
    const { stdout } = await execFileAsync(
      "git",
      ["rev-parse", "--abbrev-ref", "HEAD"],
      { cwd: rootDir },
    );
    const branch = stdout.trim();
    return branch && branch !== "HEAD" ? branch : DEFAULT_BRANCH;
  } catch {
    return DEFAULT_BRANCH;
  }
}

async function isGitRepository(rootDir: string): Promise<boolean> {
  try {
    await execFileAsync("git", ["rev-parse", "--is-inside-work-tree"], {
      cwd: rootDir,
    });
    return true;
  } catch {
    return false;
  }
}

async function hasGitRemote(
  rootDir: string,
  remoteName: string,
): Promise<boolean> {
  try {
    await execFileAsync("git", ["remote", "get-url", remoteName], {
      cwd: rootDir,
    });
    return true;
  } catch {
    return false;
  }
}

function uniqueFiles(files: string[]): string[] {
  return [...new Set(files.map((file) => file.trim()).filter(Boolean))];
}

function emptyWriteResult(): RepoWriteResult {
  return {
    committed: false,
    commitSha: null,
    targetRef: null,
    pushed: false,
    committedAt: null,
  };
}

function isMissingGitPathError(error: unknown): boolean {
  return (
    Boolean(
      error &&
        typeof error === "object" &&
        "stderr" in error &&
        typeof error.stderr === "string" &&
        error.stderr.includes("exists on disk, but not in"),
    ) ||
    Boolean(
      error &&
        typeof error === "object" &&
        "stderr" in error &&
        typeof error.stderr === "string" &&
        error.stderr.includes("does not exist in"),
    )
  );
}

function isMissingFileError(error: unknown): boolean {
  return Boolean(
    error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "ENOENT",
  );
}
