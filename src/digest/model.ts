import { request } from "undici";

import type { DailyDigest, DigestItem } from "../core/digest";
import type { WorkflowLogger } from "../core/log";
import type { LlmConfig } from "../config/env";
import type { GitHubCandidateRepo } from "../github/types";
import { retryAsync } from "../utils/async";

interface ChatCompletionResponse {
  choices?: Array<{
    message?: {
      content?: string | null;
    };
  }>;
}

interface ModelDigestItem {
  repo: string;
  theme: string;
  summary: string;
  whyItMatters: string;
  whyNow: string;
  evidence: string[];
  novelty: string;
  trend: string;
}

interface ModelDigestResponse {
  items?: ModelDigestItem[];
}

const MIN_DIGEST_ITEMS = 6;
const MAX_DIGEST_ITEMS = 8;
const GENERIC_SUMMARY_PATTERNS = [
  /^.+是一个聚焦.+的开源项目。?$/,
  /^一个聚焦.+的开源项目，?.*$/,
  /^.+方向的开源项目。?$/,
  /^.+方向近期值得持续观察。?$/,
];
const SUMMARY_DETAIL_MARKERS =
  /用于|面向|帮助|支持|提供|把|将|让|连接|整合|统一|自动化|监控|检索|搜索|生成|编排|运行|分析|推理|可视化|知识图谱|研究代理|平台|工具|框架|终端|告警|查询|仪表盘|工作流|运行栈|桥接层|观测|校验|审计|托管/;

export interface GenerateDigestWithResilienceResult {
  digest: DailyDigest;
  mode: "llm" | "template_fallback";
}

export interface GenerateDigestWithResilienceOptions {
  logger?: WorkflowLogger;
  onModelFailure?: (error: unknown) => Promise<void> | void;
}

export async function generateDigestWithModel(
  candidates: GitHubCandidateRepo[],
  date: string,
  llmConfig: LlmConfig,
): Promise<DailyDigest> {
  if (candidates.length === 0) {
    throw new Error("Cannot generate a digest without candidates.");
  }

  const prompt = buildPrompt(candidates, date);
  const response = await request(`${llmConfig.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${llmConfig.apiKey}`,
    },
    body: JSON.stringify({
      model: llmConfig.model,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "你是 GitRadar 的日报编辑。请从候选开源项目里选出少而准、偏前沿、值得点进去深看的项目，并只返回 JSON。",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
    }),
  });

  if (response.statusCode < 200 || response.statusCode >= 300) {
    throw new Error(`LLM request failed with status ${response.statusCode}.`);
  }

  const body = (await response.body.json()) as ChatCompletionResponse;
  const content = body.choices?.[0]?.message?.content?.trim();

  if (!content) {
    throw new Error("LLM response did not include message content.");
  }

  const parsed = parseModelResponse(content);
  const candidateByRepo = new Map(
    candidates.map((candidate) => [candidate.repo, candidate]),
  );
  const seenRepos = new Set<string>();
  const items = parsed.items
    ?.map((item) => mapDigestItem(item, candidateByRepo))
    .filter((item): item is DigestItem => item !== null)
    .filter((item) => {
      if (seenRepos.has(item.repo)) {
        return false;
      }

      seenRepos.add(item.repo);
      return true;
    })
    .slice(0, MAX_DIGEST_ITEMS);

  const minimumItems = Math.min(MIN_DIGEST_ITEMS, candidates.length);
  if (!items || items.length < minimumItems) {
    throw new Error("LLM response did not include any valid digest items.");
  }

  const poolRequiresMature = candidates.some(
    (candidate) => candidate.selectionHints?.matureMomentum,
  );
  const selectedHasMature = items.some(
    (item) => candidateByRepo.get(item.repo)?.selectionHints?.matureMomentum,
  );

  if (poolRequiresMature && !selectedHasMature) {
    throw new Error(
      "LLM response did not keep a mature momentum project from the candidate pool.",
    );
  }

  return {
    date,
    title: `GitRadar · ${date}`,
    items,
  };
}

export async function generateDigestWithResilience(
  candidates: GitHubCandidateRepo[],
  date: string,
  llmConfig: LlmConfig,
  options: GenerateDigestWithResilienceOptions = {},
): Promise<GenerateDigestWithResilienceResult> {
  try {
    const digest = await retryAsync(
      async (attempt) => {
        options.logger?.info("editorial_model_attempt_started", {
          attempt,
          candidateCount: candidates.length,
        });

        const result = await generateDigestWithModel(
          candidates,
          date,
          llmConfig,
        );
        options.logger?.info("editorial_model_attempt_succeeded", {
          attempt,
          itemCount: result.items.length,
        });
        return result;
      },
      {
        attempts: 3,
        delayMs: 200,
        onRetry: (error, nextAttempt) => {
          options.logger?.warn("editorial_model_retry_scheduled", {
            nextAttempt,
            message: getErrorMessage(error),
          });
        },
      },
    );

    return {
      digest,
      mode: "llm",
    };
  } catch (error) {
    options.logger?.warn("editorial_model_fallback_activated", {
      message: getErrorMessage(error),
      candidateCount: candidates.length,
    });
    await options.onModelFailure?.(error);

    return {
      digest: generateDigestWithTemplate(candidates, date),
      mode: "template_fallback",
    };
  }
}

function buildPrompt(candidates: GitHubCandidateRepo[], date: string): string {
  const payload = candidates.map((candidate) => ({
    repo: candidate.repo,
    url: candidate.url,
    description: candidate.description,
    language: candidate.language,
    stars: candidate.stars,
    topics: candidate.topics,
    createdAt: candidate.createdAt,
    pushedAt: candidate.pushedAt,
    sources: candidate.sources,
    theme: candidate.theme,
    ruleScore: candidate.ruleScore,
    scoreBreakdown: candidate.scoreBreakdown,
    selectionHints: candidate.selectionHints,
    readmeExcerpt: candidate.readmeExcerpt ?? "",
  }));

  return [
    `今天的日期是 ${date}。`,
    `请从下面的候选项目中挑选 ${MIN_DIGEST_ITEMS} 到 ${MAX_DIGEST_ITEMS} 个最值得关注的项目，要求少而准、有意思、前沿，并保持主题多样性。`,
    "请严格只返回 JSON，结构为：",
    '{"items":[{"repo":"owner/repo","theme":"...","summary":"...","whyItMatters":"...","whyNow":"...","evidence":["..."],"novelty":"...","trend":"..."}]}',
    "repo 必须从候选列表里原样选择，不要自造项目。",
    "theme 必须与候选里给出的 theme 完全一致。",
    "evidence 只能从候选的 selectionHints.evidence 中原样选择 2 到 3 条，不要自造新证据。",
    "trend 只能基于候选里已有的时间、来源和 star 信号来写，不要引用外部信息。",
    "如果候选中存在 matureMomentum=true 的项目，最终结果至少保留 1 个这类项目。",
    "summary 必须具体回答项目做什么，至少交代下面三者之一：它提供什么能力、把什么流程串起来、主要面向谁。",
    "summary 不能写空泛套话，例如“某某是一个聚焦某方向的开源项目”“一个值得关注的工具”“某方向的平台”。",
    "如果候选信息不足以写出具体能力或流程，就不要选择该项目。",
    "summary / whyItMatters / whyNow / novelty / trend 都用简洁中文，每个字段控制在一两句话内。",
    JSON.stringify(payload),
  ].join("\n");
}

function generateDigestWithTemplate(
  candidates: GitHubCandidateRepo[],
  date: string,
): DailyDigest {
  const limit = Math.min(MAX_DIGEST_ITEMS, candidates.length);
  const items = candidates.slice(0, limit).map((candidate) => ({
    repo: candidate.repo,
    url: candidate.url,
    theme: candidate.theme ?? "General OSS",
    summary: buildTemplateSummary(candidate),
    whyItMatters: buildTemplateWhyItMatters(candidate),
    whyNow: candidate.selectionHints?.whyNow ?? buildFallbackWhyNow(candidate),
    evidence: buildFallbackEvidence(candidate),
    novelty: buildTemplateNovelty(candidate),
    trend: buildTemplateTrend(candidate),
  }));

  return {
    date,
    title: `GitRadar · ${date}（模板降级）`,
    items,
  };
}

function parseModelResponse(content: string): ModelDigestResponse {
  const json = extractJsonObject(content);
  return JSON.parse(json) as ModelDigestResponse;
}

function extractJsonObject(content: string): string {
  const start = content.indexOf("{");
  const end = content.lastIndexOf("}");

  if (start === -1 || end === -1 || end <= start) {
    throw new Error("LLM response did not contain a JSON object.");
  }

  return content.slice(start, end + 1);
}

function mapDigestItem(
  item: ModelDigestItem,
  candidateByRepo: Map<string, GitHubCandidateRepo>,
): DigestItem | null {
  const candidate = candidateByRepo.get(item.repo);

  if (!candidate) {
    return null;
  }

  if (
    item.theme !== candidate.theme ||
    !item.summary?.trim() ||
    !isActionableSummary(item.summary) ||
    !item.whyItMatters?.trim() ||
    !item.whyNow?.trim() ||
    !Array.isArray(item.evidence) ||
    item.evidence.length === 0 ||
    !item.novelty?.trim() ||
    !item.trend?.trim()
  ) {
    return null;
  }

  const allowedEvidence = new Set(candidate.selectionHints?.evidence ?? []);
  const evidence = item.evidence
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);

  if (
    evidence.length === 0 ||
    evidence.some((entry) => !allowedEvidence.has(entry))
  ) {
    return null;
  }

  return {
    repo: candidate.repo,
    url: candidate.url,
    theme: candidate.theme ?? item.theme,
    summary: item.summary.trim(),
    whyItMatters: item.whyItMatters.trim(),
    whyNow: item.whyNow.trim(),
    evidence: Array.from(new Set(evidence)).slice(0, 3),
    novelty: item.novelty.trim(),
    trend: item.trend.trim(),
  };
}

function isActionableSummary(summary: string): boolean {
  const trimmed = summary.trim();

  if (!trimmed) {
    return false;
  }

  if (GENERIC_SUMMARY_PATTERNS.some((pattern) => pattern.test(trimmed))) {
    return false;
  }

  if (trimmed.length < 10) {
    return false;
  }

  return SUMMARY_DETAIL_MARKERS.test(trimmed);
}

function buildTemplateSummary(candidate: GitHubCandidateRepo): string {
  const themeLabel = formatThemeLabel(candidate.theme);

  if (candidate.selectionHints?.matureMomentum) {
    return `一个聚焦${themeLabel}的成熟开源项目，近期活跃度重新上升。`;
  }

  if (candidate.sources.includes("search_recently_created")) {
    return `一个聚焦${themeLabel}的新项目，最近仍在持续迭代。`;
  }

  if (candidate.sources.includes("trending")) {
    return `一个聚焦${themeLabel}的开源项目，今天在 GitHub 热榜信号中表现突出。`;
  }

  return `一个聚焦${themeLabel}的开源项目，近期保持稳定活跃。`;
}

function buildTemplateWhyItMatters(candidate: GitHubCandidateRepo): string {
  return (
    candidate.selectionHints?.selectionReason ??
    `${formatThemeLabel(candidate.theme)}方向近期值得持续观察。`
  );
}

function buildTemplateNovelty(candidate: GitHubCandidateRepo): string {
  const themeLabel = formatThemeLabel(candidate.theme);

  if (candidate.sources.includes("search_recently_created")) {
    return `它在${themeLabel}方向切入明确，当前仍处在快速成形阶段。`;
  }

  if (candidate.selectionHints?.matureMomentum) {
    return `它在${themeLabel}方向已经形成一定积累，最近又出现了新的活跃信号。`;
  }

  return `它在${themeLabel}方向具备清晰定位，适合作为近期样本持续跟踪。`;
}

function buildTemplateTrend(candidate: GitHubCandidateRepo): string {
  if (candidate.selectionHints?.sourceSummary) {
    return `当前信号：${localizeSourceSummary(candidate.selectionHints.sourceSummary)}。`;
  }

  return `当前信号：${formatSources(candidate.sources)}。`;
}

function buildFallbackWhyNow(candidate: GitHubCandidateRepo): string {
  return `当前主要依据 ${formatSources(candidate.sources)} 等结构化信号入选。`;
}

function buildFallbackEvidence(candidate: GitHubCandidateRepo): string[] {
  const evidence = candidate.selectionHints?.evidence
    ?.map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);

  if (evidence && evidence.length > 0) {
    return Array.from(new Set(evidence)).slice(0, 3);
  }

  return candidate.sources
    .map((source) => mapSourceToEvidence(source))
    .slice(0, 3);
}

function extractReadableLine(input?: string | null): string | null {
  if (!input?.trim()) {
    return null;
  }

  const lines = input
    .replace(/\r\n/g, "\n")
    .replace(/<!--[\s\S]*?-->/g, "\n")
    .split("\n");

  for (const line of lines) {
    const cleaned = sanitizeReadmeLine(line);
    if (isReadableReadmeLine(line, cleaned)) {
      return cleaned.slice(0, 90);
    }
  }

  const fallback = sanitizeReadmeLine(input);
  if (!isReadableReadmeLine(input, fallback)) {
    return null;
  }

  return fallback.slice(0, 90);
}

function sanitizeReadmeLine(input: string): string {
  return decodeHtmlEntities(
    input
      .replace(/!\[[^\]]*]\([^)]*\)/g, " ")
      .replace(/\[([^\]]+)]\([^)]*\)/g, "$1")
      .replace(/<\/?[^>\n]+>/g, " ")
      .replace(/https?:\/\/\S+/gi, " ")
      .replace(/^\s{0,3}(?:#{1,6}\s+|[-*+]\s+|\d+\.\s+)/, "")
      .replace(/[`*_~]/g, " ")
      .replace(/\s+/g, " ")
      .trim(),
  );
}

function isReadableReadmeLine(rawLine: string, cleanedLine: string): boolean {
  if (!cleanedLine) {
    return false;
  }

  const normalizedRawLine = rawLine.trim();
  if (
    /^\s*</.test(normalizedRawLine) ||
    /^\s*!\[/.test(normalizedRawLine) ||
    /(?:href=|src=|align=|width=|height=|readme[-_\s]?top|shields\.io|badge|utm[_-])/i.test(
      normalizedRawLine,
    )
  ) {
    return false;
  }

  if (!/[A-Za-z\u4e00-\u9fff]/.test(cleanedLine)) {
    return false;
  }

  if (
    cleanedLine.length < 20 &&
    cleanedLine.split(/\s+/).filter(Boolean).length < 4
  ) {
    return false;
  }

  return true;
}

function decodeHtmlEntities(input: string): string {
  return input
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
}

function formatSources(sources: GitHubCandidateRepo["sources"]): string {
  return sources.map((source) => mapSourceToEvidence(source)).join("、");
}

function formatThemeLabel(theme?: string): string {
  switch (theme) {
    case "AI Agents":
      return "智能体";
    case "AI Research":
      return "人工智能研究";
    case "Infra & Runtime":
      return "基础设施与运行时";
    case "Developer Tools":
      return "开发者工具";
    case "Data & Search":
      return "数据与搜索";
    case "Observability & Security":
      return "可观测性与安全";
    case "Frontend & Design":
      return "前端与设计";
    case "General OSS":
    case undefined:
      return "通用开源";
    default:
      return theme;
  }
}

function localizeSourceSummary(summary: string): string {
  return summary.replace(/Trending/g, "GitHub 热榜").replace(/\s+\+\s+/g, "、");
}

function mapSourceToEvidence(
  source: GitHubCandidateRepo["sources"][number],
): string {
  switch (source) {
    case "trending":
      return "GitHub Trending";
    case "search_recently_updated":
      return "最近更新搜索";
    case "search_recently_created":
      return "最近创建搜索";
    default:
      return source;
  }
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
