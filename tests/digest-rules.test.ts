import { describe, expect, it } from "vitest";

import { selectCandidatesForDigest } from "../src/digest/rules";
import type { GitHubCandidateRepo } from "../src/github/types";

function createCandidate(
  overrides: Partial<GitHubCandidateRepo>,
): GitHubCandidateRepo {
  return {
    repo: "owner/repo",
    url: "https://github.com/owner/repo",
    description: "一个很有意思的项目，最近更新活跃。",
    language: "TypeScript",
    stars: 1200,
    forks: 100,
    topics: ["ai", "agent"],
    createdAt: "2026-03-01T00:00:00Z",
    updatedAt: "2026-03-25T00:00:00Z",
    pushedAt: "2026-03-25T00:00:00Z",
    archived: false,
    disabled: false,
    fork: false,
    sources: ["trending"],
    ...overrides,
  };
}

describe("selectCandidatesForDigest", () => {
  it("filters obvious low-quality repositories", () => {
    const selected = selectCandidatesForDigest([
      createCandidate({ repo: "good/repo" }),
      createCandidate({
        repo: "bad/repo",
        description: "awesome curated list for everything",
      }),
    ]);

    expect(selected).toHaveLength(1);
    expect(selected[0].repo).toBe("good/repo");
  });

  it("limits the shortlisted candidates", () => {
    const candidates = Array.from({ length: 30 }, (_, index) =>
      createCandidate({
        repo: `owner/repo-${index}`,
        stars: 2000 - index,
      }),
    );

    expect(selectCandidatesForDigest(candidates, 20)).toHaveLength(20);
  });
});
