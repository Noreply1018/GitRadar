import { describe, expect, it } from "vitest";
import {
  getRulesVersion,
  selectCandidatesForDigest,
  buildDigestCandidatePool,
} from "../../src/digest/rules";
import type { GitHubCandidateRepo } from "../../src/github/types";

function buildCandidate(
  overrides: Partial<GitHubCandidateRepo> = {},
): GitHubCandidateRepo {
  const now = new Date().toISOString();
  return {
    repo: "owner/test-repo",
    url: "https://github.com/owner/test-repo",
    description: "A solid open-source project for testing purposes",
    language: "TypeScript",
    stars: 500,
    forks: 50,
    topics: ["testing"],
    createdAt: new Date(Date.now() - 60 * 86400000).toISOString(),
    updatedAt: now,
    pushedAt: now,
    archived: false,
    disabled: false,
    fork: false,
    sources: ["trending"],
    ...overrides,
  };
}

describe("getRulesVersion", () => {
  it("returns a non-empty string", () => {
    const version = getRulesVersion();
    expect(version).toBeTruthy();
    expect(typeof version).toBe("string");
    expect(version.length).toBeGreaterThan(0);
  });
});

describe("selectCandidatesForDigest", () => {
  it("filters out archived repos", () => {
    const candidates = [
      buildCandidate({ repo: "a/good", archived: false }),
      buildCandidate({ repo: "b/archived", archived: true }),
    ];
    const result = selectCandidatesForDigest(candidates, 10);
    const repos = result.map((c) => c.repo);
    expect(repos).toContain("a/good");
    expect(repos).not.toContain("b/archived");
  });

  it("filters out forked repos", () => {
    const candidates = [
      buildCandidate({ repo: "a/original", fork: false }),
      buildCandidate({ repo: "b/forked", fork: true }),
    ];
    const result = selectCandidatesForDigest(candidates, 10);
    const repos = result.map((c) => c.repo);
    expect(repos).toContain("a/original");
    expect(repos).not.toContain("b/forked");
  });

  it("filters out disabled repos", () => {
    const candidates = [
      buildCandidate({ repo: "a/enabled", disabled: false }),
      buildCandidate({ repo: "b/disabled", disabled: true }),
    ];
    const result = selectCandidatesForDigest(candidates, 10);
    const repos = result.map((c) => c.repo);
    expect(repos).toContain("a/enabled");
    expect(repos).not.toContain("b/disabled");
  });

  it("filters out repos without description", () => {
    const candidates = [
      buildCandidate({ repo: "a/described", description: "Has a description" }),
      buildCandidate({ repo: "b/empty", description: "" }),
    ];
    const result = selectCandidatesForDigest(candidates, 10);
    const repos = result.map((c) => c.repo);
    expect(repos).toContain("a/described");
    expect(repos).not.toContain("b/empty");
  });

  it("respects the maxCount limit", () => {
    const candidates = Array.from({ length: 10 }, (_, i) =>
      buildCandidate({
        repo: `owner/repo-${i}`,
        description: `Project number ${i} for open-source usage`,
      }),
    );
    const result = selectCandidatesForDigest(candidates, 3);
    expect(result.length).toBeLessThanOrEqual(3);
  });

  it("returns empty array when all candidates are filtered out", () => {
    const candidates = [
      buildCandidate({ archived: true }),
      buildCandidate({ fork: true }),
      buildCandidate({ disabled: true }),
      buildCandidate({ description: "" }),
    ];
    const result = selectCandidatesForDigest(candidates, 10);
    expect(result).toEqual([]);
  });

  it("returns empty array for empty input", () => {
    const result = selectCandidatesForDigest([], 10);
    expect(result).toEqual([]);
  });
});

describe("buildDigestCandidatePool", () => {
  it("splits into selected and rejected arrays", () => {
    const candidates = Array.from({ length: 5 }, (_, i) =>
      buildCandidate({
        repo: `owner/repo-${i}`,
        theme: `Theme-${i}`,
      }),
    );
    const result = buildDigestCandidatePool(candidates, 3);
    expect(result).toHaveProperty("selected");
    expect(result).toHaveProperty("rejected");
    expect(Array.isArray(result.selected)).toBe(true);
    expect(Array.isArray(result.rejected)).toBe(true);
  });

  it("selected length does not exceed maxSize", () => {
    const candidates = Array.from({ length: 10 }, (_, i) =>
      buildCandidate({
        repo: `owner/repo-${i}`,
        theme: `Theme-${i}`,
      }),
    );
    const result = buildDigestCandidatePool(candidates, 4);
    expect(result.selected.length).toBeLessThanOrEqual(4);
  });

  it("total of selected + rejected equals input length", () => {
    const candidates = Array.from({ length: 6 }, (_, i) =>
      buildCandidate({
        repo: `owner/repo-${i}`,
        theme: `Theme-${i}`,
      }),
    );
    const result = buildDigestCandidatePool(candidates, 3);
    expect(result.selected.length + result.rejected.length).toBe(
      candidates.length,
    );
  });

  it("rejected entries include a reason string", () => {
    const candidates = Array.from({ length: 5 }, (_, i) =>
      buildCandidate({
        repo: `owner/repo-${i}`,
        theme: `Theme-${i}`,
      }),
    );
    const result = buildDigestCandidatePool(candidates, 2);
    for (const entry of result.rejected) {
      expect(entry.reason).toBeTruthy();
      expect(typeof entry.reason).toBe("string");
    }
  });

  it("returns all candidates as selected when under limit", () => {
    const candidates = Array.from({ length: 2 }, (_, i) =>
      buildCandidate({
        repo: `owner/repo-${i}`,
        theme: `Theme-${i}`,
      }),
    );
    const result = buildDigestCandidatePool(candidates, 10);
    expect(result.selected.length).toBe(2);
    expect(result.rejected.length).toBe(0);
  });
});
