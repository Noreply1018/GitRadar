import { appendFile } from "node:fs/promises";

import {
  GitHubPlatformClient,
  type GitHubContentsFileResponse,
} from "../github/platform-client";
import {
  collectChangedWritebackFiles,
  parseRepositoryTarget,
  parseWritebackFileList,
} from "../github/writeback-artifacts";

type PersistMode = "direct" | "pull_request";

async function main(): Promise<void> {
  const config = readConfigFromEnv();
  const client = new GitHubPlatformClient({
    token: config.token,
    apiBaseUrl: config.apiBaseUrl,
  });
  const repository = parseRepositoryTarget(config.repository);
  const metadata = await client.getRepository(
    repository.owner,
    repository.repo,
  );
  const baseBranch = config.baseBranch || metadata.default_branch;
  const baseReference = await client.getReference(
    repository.owner,
    repository.repo,
    `heads/${baseBranch}`,
  );
  const baseCommit = await client.getCommit(
    repository.owner,
    repository.repo,
    baseReference.object.sha,
  );

  const changedFiles = await collectChangedWritebackFiles(
    process.cwd(),
    config.filePaths,
    async (repoPath) =>
      readRemoteContents(
        client,
        repository.owner,
        repository.repo,
        repoPath,
        baseBranch,
      ),
  );

  if (changedFiles.length === 0) {
    await writeOutput("changed", "false");
    return;
  }

  const targetBranch =
    config.mode === "pull_request" ? config.branchName : baseBranch;
  const targetReference = await ensureTargetReference(
    client,
    repository.owner,
    repository.repo,
    targetBranch,
    baseReference.object.sha,
  );
  const targetCommit = await client.getCommit(
    repository.owner,
    repository.repo,
    targetReference.object.sha,
  );

  const treeEntries = await Promise.all(
    changedFiles.map(async (file) => ({
      path: file.path,
      mode: "100644" as const,
      type: "blob" as const,
      sha: (
        await client.createBlob(
          repository.owner,
          repository.repo,
          file.contentBase64,
        )
      ).sha,
    })),
  );

  const nextTree = await client.createTree(
    repository.owner,
    repository.repo,
    targetCommit.tree.sha,
    treeEntries,
  );
  const nextCommit = await client.createCommit(
    repository.owner,
    repository.repo,
    config.commitMessage,
    nextTree.sha,
    [targetReference.object.sha],
  );

  await client.updateReference(
    repository.owner,
    repository.repo,
    `heads/${targetBranch}`,
    nextCommit.sha,
  );

  await writeOutput("changed", "true");
  await writeOutput("commit_sha", nextCommit.sha);
  await writeOutput("branch", targetBranch);

  if (config.mode !== "pull_request") {
    return;
  }

  const existingPullRequest = await client.findOpenPullRequest(
    repository.owner,
    repository.repo,
    {
      head: targetBranch,
      base: baseBranch,
    },
  );

  if (existingPullRequest) {
    await writeOutput("pull_request_url", existingPullRequest.html_url);
    return;
  }

  const pullRequest = await client.createPullRequest(
    repository.owner,
    repository.repo,
    {
      title: config.prTitle,
      head: targetBranch,
      base: baseBranch,
      body: config.prBody,
    },
  );

  await writeOutput("pull_request_url", pullRequest.html_url);
}

function readConfigFromEnv(): {
  token: string;
  apiBaseUrl?: string;
  repository: string;
  mode: PersistMode;
  baseBranch?: string;
  branchName: string;
  filePaths: string[];
  commitMessage: string;
  prTitle: string;
  prBody: string;
} {
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  if (!token) {
    throw new Error("Missing GITHUB_TOKEN or GH_TOKEN.");
  }

  const mode = normalizeMode(process.env.GITRADAR_PERSIST_MODE);
  const branchName =
    process.env.GITRADAR_BRANCH_NAME?.trim() ||
    process.env.GITHUB_REF_NAME?.trim() ||
    "main";

  return {
    token,
    apiBaseUrl: process.env.GITRADAR_GITHUB_API_BASE_URL?.trim(),
    repository: process.env.GITHUB_REPOSITORY ?? "",
    mode,
    baseBranch: process.env.GITRADAR_BASE_BRANCH?.trim() || undefined,
    branchName,
    filePaths: parseWritebackFileList(process.env.GITRADAR_FILE_PATHS),
    commitMessage:
      process.env.GITRADAR_COMMIT_MESSAGE?.trim() ||
      "chore: persist GitRadar artifacts",
    prTitle:
      process.env.GITRADAR_PR_TITLE?.trim() ||
      "chore: apply GitRadar writeback request",
    prBody:
      process.env.GITRADAR_PR_BODY?.trim() ||
      "This PR was created by the GitRadar GitHub-native writeback flow.",
  };
}

function normalizeMode(value: string | undefined): PersistMode {
  if (!value || value === "direct") {
    return "direct";
  }

  if (value === "pull_request") {
    return value;
  }

  throw new Error(`Unsupported GITRADAR_PERSIST_MODE: ${value}`);
}

async function ensureTargetReference(
  client: GitHubPlatformClient,
  owner: string,
  repo: string,
  branchName: string,
  baseSha: string,
) {
  try {
    return await client.getReference(owner, repo, `heads/${branchName}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!message.includes("status 404")) {
      throw error;
    }
  }

  return client.createReference(owner, repo, `heads/${branchName}`, baseSha);
}

async function readRemoteContents(
  client: GitHubPlatformClient,
  owner: string,
  repo: string,
  repoPath: string,
  ref: string,
): Promise<GitHubContentsFileResponse | null> {
  try {
    return await client.getContents(owner, repo, repoPath, ref);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("status 404")) {
      return null;
    }

    throw error;
  }
}

async function writeOutput(name: string, value: string): Promise<void> {
  const outputPath = process.env.GITHUB_OUTPUT;
  if (!outputPath) {
    return;
  }

  await appendFile(outputPath, `${name}=${value}\n`, "utf8");
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`GitRadar GitHub file persistence failed: ${message}`);
  process.exitCode = 1;
});
