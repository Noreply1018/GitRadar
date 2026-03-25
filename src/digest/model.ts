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
  summary: string;
  whyItMatters: string;
  novelty: string;
  trend: string;
}

interface ModelDigestResponse {
  items?: ModelDigestItem[];
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
  const items = parsed.items
    ?.map((item) => mapDigestItem(item, candidateByRepo))
    .filter((item): item is DigestItem => item !== null)
    .slice(0, 5);

  if (!items || items.length === 0) {
    throw new Error("LLM response did not include any valid digest items.");
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
    ruleScore: candidate.ruleScore,
    readmeExcerpt: candidate.readmeExcerpt ?? "",
  }));

  return [
    `今天的日期是 ${date}。`,
    "请从下面的候选项目中挑选 3 到 5 个最值得关注的项目，要求少而准、有意思、前沿。",
    "请严格只返回 JSON，结构为：",
    '{"items":[{"repo":"owner/repo","summary":"...","whyItMatters":"...","novelty":"...","trend":"..."}]}',
    "repo 必须从候选列表里原样选择，不要自造项目。",
    "summary / whyItMatters / novelty / trend 都用简洁中文，每个字段控制在一两句话内。",
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
    !item.summary?.trim() ||
    !item.whyItMatters?.trim() ||
    !item.novelty?.trim() ||
    !item.trend?.trim()
  ) {
    return null;
  }

  return {
    repo: candidate.repo,
    url: candidate.url,
    summary: item.summary.trim(),
    whyItMatters: item.whyItMatters.trim(),
    novelty: item.novelty.trim(),
    trend: item.trend.trim(),
  };
}
