import { readDailyDigestArchive } from "../core/archive";

interface AnalyzeArgs {
  date: string;
  format: "markdown" | "json";
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const archive = await readDailyDigestArchive(process.cwd(), args.date);

  if (args.format === "json") {
    console.log(
      JSON.stringify(
        {
          date: args.date,
          schemaVersion: archive.schemaVersion,
          generatedAt: archive.generatedAt,
          candidateCount: archive.candidateCount,
          shortlistedCount: archive.shortlistedCount,
          llmCandidateRepos: archive.selection.llmCandidateRepos,
          digest: archive.digest,
          selection: archive.selection,
          generationMeta: archive.generationMeta,
        },
        null,
        2,
      ),
    );
    return;
  }

  console.log(renderArchiveAnalysis(args.date, archive));
}

export function parseAnalyzeDigestArgs(argv: string[]): AnalyzeArgs {
  const dateIndex = argv.indexOf("--date");
  const formatIndex = argv.indexOf("--format");
  const date = argv[dateIndex + 1]?.trim();
  const formatValue =
    formatIndex === -1 ? undefined : argv[formatIndex + 1]?.trim();

  if (dateIndex === -1 || !date) {
    throw new Error("Missing value for --date. Use YYYY-MM-DD.");
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error("Invalid --date format. Use YYYY-MM-DD.");
  }

  if (!formatValue) {
    return {
      date,
      format: "markdown",
    };
  }

  if (formatValue !== "markdown" && formatValue !== "json") {
    throw new Error("Invalid --format value. Use markdown or json.");
  }

  return {
    date,
    format: formatValue,
  };
}

function parseArgs(argv: string[]): AnalyzeArgs {
  return parseAnalyzeDigestArgs(argv);
}

export function renderArchiveAnalysis(
  date: string,
  archive: Awaited<ReturnType<typeof readDailyDigestArchive>>,
): string {
  const lines = [
    `# GitRadar Archive Analysis · ${date}`,
    "",
    `生成时间：${archive.generatedAt}`,
    `Schema 版本：${archive.schemaVersion}`,
    `候选数量：${archive.candidateCount}`,
    `Shortlist 数量：${archive.shortlistedCount}`,
    `LLM 候选池：${archive.selection.llmCandidateRepos.length}`,
    `规则版本：${archive.generationMeta.rulesVersion}`,
    `成稿模式：${archive.generationMeta.editorialMode ?? "llm"}`,
    "",
    "## 最终日报",
  ];

  if (archive.generationMeta.warnings?.length) {
    lines.splice(lines.length - 2, 0, "## 运行警告");
    for (const warning of archive.generationMeta.warnings) {
      lines.splice(lines.length - 2, 0, `- ${warning}`);
    }
    lines.splice(lines.length - 2, 0, "");
  }

  for (const [index, item] of archive.digest.items.entries()) {
    lines.push(
      `${index + 1}. ${item.repo} [${item.theme}]`,
      `   做什么：${item.summary}`,
      `   为什么值得看：${item.whyItMatters}`,
      `   为什么是现在：${item.whyNow}`,
      `   证据：${item.evidence.join("；") || "未记录"}`,
      `   新意：${item.novelty}`,
      `   热度：${item.trend}`,
    );
  }

  if (archive.selection.selected.length) {
    lines.push("", "## LLM 候选池");
    for (const [index, item] of archive.selection.selected.entries()) {
      lines.push(
        `${index + 1}. ${item.repo} [${item.theme}]`,
        `   入选原因：${item.reason}`,
        `   证据：${item.evidence.join("；") || "无"}`,
      );
    }
  }

  if (archive.selection.rejected.length) {
    lines.push("", "## 被排除项目");
    for (const item of archive.selection.rejected) {
      lines.push(`- ${item.repo} [${item.theme}]：${item.reason}`);
    }
  }

  if (archive.shortlisted.length) {
    lines.push("", "## Shortlist 预览");
    for (const candidate of archive.shortlisted.slice(0, 5)) {
      lines.push(
        `- ${candidate.repo} [${candidate.theme ?? "General OSS"}] score=${candidate.ruleScore ?? 0}`,
      );
    }
  }

  return lines.join("\n");
}

if (isDirectExecution()) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`GitRadar digest analysis failed: ${message}`);
    process.exitCode = 1;
  });
}

function isDirectExecution(): boolean {
  const entry = process.argv[1];

  if (!entry) {
    return false;
  }

  return /analyze-digest\.(ts|js)$/.test(entry);
}
