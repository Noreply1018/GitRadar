import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  collectChangedWritebackFiles,
  normalizeBase64,
  parseRepositoryTarget,
  parseWritebackFileList,
} from "../src/github/writeback-artifacts";

describe("GitHub writeback artifact helpers", () => {
  it("parses repository and file list inputs", () => {
    expect(parseRepositoryTarget("Noreply1018/GitRadar")).toEqual({
      owner: "Noreply1018",
      repo: "GitRadar",
    });

    expect(
      parseWritebackFileList("config/a.json\nconfig/b.json,config/a.json"),
    ).toEqual(["config/a.json", "config/b.json"]);
  });

  it("detects only files whose local content differs from remote contents", async () => {
    const rootDir = await mkdtemp(
      path.join(os.tmpdir(), "gitradar-writeback-"),
    );
    await mkdir(path.join(rootDir, "config"), { recursive: true });
    await writeFile(
      path.join(rootDir, "config", "schedule.json"),
      '{ "a": 1 }\n',
      "utf8",
    );
    await writeFile(
      path.join(rootDir, "config", "prefs.json"),
      '{ "b": 2 }\n',
      "utf8",
    );

    const changed = await collectChangedWritebackFiles(
      rootDir,
      ["config/schedule.json", "config/prefs.json"],
      async (repoPath) => {
        if (repoPath === "config/schedule.json") {
          return {
            path: repoPath,
            sha: "sha-1",
            encoding: "base64",
            content: Buffer.from('{ "a": 1 }\n', "utf8").toString("base64"),
          };
        }

        return null;
      },
    );

    expect(changed).toHaveLength(1);
    expect(changed[0]).toMatchObject({
      path: "config/prefs.json",
    });
    expect(
      Buffer.from(normalizeBase64(changed[0].contentBase64), "base64").toString(
        "utf8",
      ),
    ).toBe('{ "b": 2 }\n');
  });

  it("skips listed files that were not produced locally", async () => {
    const rootDir = await mkdtemp(
      path.join(os.tmpdir(), "gitradar-writeback-"),
    );
    await mkdir(path.join(rootDir, "config"), { recursive: true });
    await writeFile(
      path.join(rootDir, "config", "schedule.json"),
      '{ "a": 1 }\n',
      "utf8",
    );

    const changed = await collectChangedWritebackFiles(
      rootDir,
      ["config/schedule.json", "data/runtime/github-runtime.json"],
      async () => null,
    );

    expect(changed).toHaveLength(1);
    expect(changed[0]?.path).toBe("config/schedule.json");
  });
});
