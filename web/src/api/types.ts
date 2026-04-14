export interface GitHubFileResponse {
  name: string;
  path: string;
  sha: string;
  size: number;
  content?: string;
  encoding?: string;
  html_url: string;
  download_url: string | null;
  type: "file" | "dir" | "symlink" | "submodule";
}

export interface GitHubDirectoryEntry {
  name: string;
  path: string;
  sha: string;
  type: "file" | "dir" | "symlink" | "submodule";
}

export interface GitHubWorkflowRun {
  id: number;
  name: string | null;
  status: string | null;
  conclusion: string | null;
  event: string;
  created_at: string;
  updated_at: string;
  html_url: string;
  run_started_at?: string;
}

export interface GitHubWorkflowRunsResponse {
  total_count: number;
  workflow_runs: GitHubWorkflowRun[];
}
