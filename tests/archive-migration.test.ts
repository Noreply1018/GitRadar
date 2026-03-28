import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { parseMigrateArchivesArgs } from "../src/commands/migrate-archives";
import {
  CURRENT_DAILY_DIGEST_ARCHIVE_SCHEMA_VERSION,
  migrateDailyDigestArchive,
  migrateDailyDigestArchives,
  readDailyDigestArchive,
} from "../src/core/archive";

describe("archive migration", () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    await Promise.all(
      tempDirs.map((directory) =>
        rm(directory, { recursive: true, force: true }),
      ),
    );
    tempDirs.length = 0;
  });

  it("migrates legacy archives into the current schema", () => {
    const archive = migrateDailyDigestArchive({
      generatedAt: "2026-03-25T10:21:26.904Z",
      candidateCount: 4,
      shortlistedCount: 4,
      digest: {
        date: "2026-03-25",
        title: "GitRadar · 2026-03-25",
        items: [
          {
            repo: "owner/alpha-agent",
            url: "https://github.com/owner/alpha-agent",
            summary: "一个面向自动化任务的 AI Agent 框架。",
            whyItMatters: "抽象清晰，适合持续关注。",
            novelty: "把 agent runtime 做得很轻。",
            trend: "今天热度增长明显。",
          },
        ],
      },
    });

    expect(archive.schemaVersion).toBe(
      CURRENT_DAILY_DIGEST_ARCHIVE_SCHEMA_VERSION,
    );
    expect(archive.digest.items[0].theme).toBe("General OSS");
    expect(archive.digest.items[0].whyNow).toBe("未记录");
    expect(archive.selection.selected[0].reason).toBe(
      "抽象清晰，适合持续关注。",
    );
    expect(archive.generationMeta.rulesVersion).toBe("legacy");
  });

  it("rejects legacy archives on the main read path until migrated", async () => {
    const rootDir = await mkdtemp(path.join(os.tmpdir(), "gitradar-archive-"));
    const historyDir = path.join(rootDir, "data", "history");
    tempDirs.push(rootDir);

    await mkdir(historyDir, { recursive: true });
    await writeFile(
      path.join(historyDir, "2026-03-25.json"),
      `${JSON.stringify(
        {
          generatedAt: "2026-03-25T10:21:26.904Z",
          candidateCount: 4,
          shortlistedCount: 4,
          digest: {
            date: "2026-03-25",
            title: "GitRadar · 2026-03-25",
            items: [],
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    await expect(readDailyDigestArchive(rootDir, "2026-03-25")).rejects.toThrow(
      'Run "npm run migrate:archives"',
    );
  });

  it("rewrites legacy files in place", async () => {
    const rootDir = await mkdtemp(path.join(os.tmpdir(), "gitradar-migrate-"));
    const historyDir = path.join(rootDir, "data", "history");
    tempDirs.push(rootDir);

    await mkdir(historyDir, { recursive: true });
    await writeFile(
      path.join(historyDir, "2026-03-25.json"),
      `${JSON.stringify(
        {
          generatedAt: "2026-03-25T10:21:26.904Z",
          candidateCount: 4,
          shortlistedCount: 4,
          digest: {
            date: "2026-03-25",
            title: "GitRadar · 2026-03-25",
            items: [
              {
                repo: "owner/alpha-agent",
                url: "https://github.com/owner/alpha-agent",
                summary: "一个面向自动化任务的 AI Agent 框架。",
                whyItMatters: "抽象清晰，适合持续关注。",
                novelty: "把 agent runtime 做得很轻。",
                trend: "今天热度增长明显。",
              },
            ],
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    const summary = await migrateDailyDigestArchives(rootDir);
    const content = await readFile(
      path.join(historyDir, "2026-03-25.json"),
      "utf8",
    );

    expect(summary.scanned).toBe(1);
    expect(summary.migrated).toBe(1);
    expect(content).toContain(
      `"schemaVersion": ${CURRENT_DAILY_DIGEST_ARCHIVE_SCHEMA_VERSION}`,
    );
  });
});

describe("parseMigrateArchivesArgs", () => {
  it("parses --dry-run", () => {
    expect(parseMigrateArchivesArgs(["--dry-run"])).toEqual({ dryRun: true });
  });

  it("rejects unsupported arguments", () => {
    expect(() => parseMigrateArchivesArgs(["--unknown"])).toThrow(
      "Unsupported argument: --unknown",
    );
  });
});
