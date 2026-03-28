import { request } from "undici";

import type { DailyDigest, DigestItem } from "../core/digest";
import type { LlmConfig } from "../config/env";
import type { GitHubCandidateRepo } from "../github/types";

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
    "summary / whyItMatters / whyNow / novelty / trend 都用简洁中文，每个字段控制在一两句话内。",
    JSON.stringify(payload),
  ].join("\n");
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
