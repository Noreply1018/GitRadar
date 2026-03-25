import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import type { DailyDigest } from "./digest";

export interface DailyDigestArchive {
  generatedAt: string;
  candidateCount: number;
  shortlistedCount: number;
  digest: DailyDigest;
}

export async function writeDailyDigestArchive(
  archive: DailyDigestArchive,
  rootDir: string,
): Promise<string> {
  const historyDir = path.join(rootDir, "data", "history");
  await mkdir(historyDir, { recursive: true });

  const outputPath = path.join(historyDir, `${archive.digest.date}.json`);
  await writeFile(outputPath, `${JSON.stringify(archive, null, 2)}\n`, "utf8");

  return outputPath;
}
