import { request } from "undici";

import type { DailyDigest, DigestItem } from "../core/digest";
import { maskWebhookUrl } from "../config/mask";
import type { Notifier } from "./notifier";

const WECOM_MARKDOWN_LIMIT_BYTES = 4096;

interface WecomRobotPayload {
  msgtype: "markdown";
  markdown: {
    content: string;
  };
}

interface WecomResponse {
  errcode?: number;
  errmsg?: string;
}

export interface WecomWorkflowFailureAlert {
  workflowName: string;
  trigger: string;
  failedAt: string;
  runUrl: string;
  details?: string;
}

export class WecomRobotNotifier implements Notifier {
  constructor(private readonly webhookUrl: string) {}

  async sendDailyDigest(digest: DailyDigest): Promise<void> {
    for (const payload of renderWecomMarkdownPayloads(digest)) {
      await this.sendPayload(payload);
    }
  }

  async sendWorkflowFailureAlert(
    alert: WecomWorkflowFailureAlert,
  ): Promise<void> {
    await this.sendPayload(renderWecomWorkflowFailurePayload(alert));
  }

  getMaskedWebhook(): string {
    return maskWebhookUrl(this.webhookUrl);
  }

  private async sendPayload(payload: WecomRobotPayload): Promise<void> {
    const response = await request(this.webhookUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw new Error(
        `WeCom robot request failed with status ${response.statusCode}.`,
      );
    }

    const body = (await response.body.json()) as WecomResponse;

    if (body.errcode !== 0) {
      throw new Error(
        `WeCom robot responded with errcode=${body.errcode ?? "unknown"} errmsg=${body.errmsg ?? "unknown"}.`,
      );
    }
  }
}

export function renderWecomMarkdownPayload(
  digest: DailyDigest,
): WecomRobotPayload {
  return renderWecomMarkdownPayloads(digest)[0];
}

export function renderWecomMarkdownPayloads(
  digest: DailyDigest,
): WecomRobotPayload[] {
  return renderWecomMarkdownPages(digest).map((content) => ({
    msgtype: "markdown",
    markdown: {
      content,
    },
  }));
}

export function renderWecomMarkdown(digest: DailyDigest): string {
  return renderWecomMarkdownPages(digest)[0];
}

export function renderWecomMarkdownPages(digest: DailyDigest): string[] {
  if (digest.items.length === 0) {
    throw new Error("Cannot render a digest without items.");
  }

  const pages: string[] = [];
  let pageNumber = 1;
  let content = renderPageHeader(digest, pageNumber);
  let includedItems = 0;

  for (const [index, item] of digest.items.entries()) {
    const block = renderItem(index + 1, item);

    if (
      utf8ByteLength(`${content}\n\n${block}`) <= WECOM_MARKDOWN_LIMIT_BYTES
    ) {
      content = `${content}\n\n${block}`;
      includedItems += 1;
      continue;
    }

    if (includedItems === 0) {
      const availableBytes =
        WECOM_MARKDOWN_LIMIT_BYTES - utf8ByteLength(`${content}\n\n`);

      if (availableBytes <= 0) {
        throw new Error(
          "Digest header is too long to fit within WeCom limits.",
        );
      }

      const truncatedBlock = truncateUtf8(block, availableBytes);

      if (!truncatedBlock.trim()) {
        throw new Error("Digest item is too long to fit within WeCom limits.");
      }

      content = `${content}\n\n${truncatedBlock}`;
      pages.push(content);
      pageNumber += 1;
      content = renderPageHeader(digest, pageNumber);
      includedItems = 0;
      continue;
    }

    pages.push(content);
    pageNumber += 1;
    content = renderPageHeader(digest, pageNumber);
    includedItems = 0;

    if (utf8ByteLength(`${content}\n\n${block}`) > WECOM_MARKDOWN_LIMIT_BYTES) {
      const availableBytes =
        WECOM_MARKDOWN_LIMIT_BYTES - utf8ByteLength(`${content}\n\n`);
      const truncatedBlock = truncateUtf8(block, availableBytes);

      if (!truncatedBlock.trim()) {
        throw new Error("Digest item is too long to fit within WeCom limits.");
      }

      content = `${content}\n\n${truncatedBlock}`;
      pages.push(content);
      pageNumber += 1;
      content = renderPageHeader(digest, pageNumber);
      continue;
    }

    content = `${content}\n\n${block}`;
    includedItems = 1;
  }

  if (includedItems > 0) {
    pages.push(content);
  }

  return pages;
}

export function renderWecomWorkflowFailurePayload(
  alert: WecomWorkflowFailureAlert,
): WecomRobotPayload {
  return {
    msgtype: "markdown",
    markdown: {
      content: renderWecomWorkflowFailureMarkdown(alert),
    },
  };
}

export function renderWecomWorkflowFailureMarkdown(
  alert: WecomWorkflowFailureAlert,
): string {
  const lines = [
    "# GitRadar 任务失败",
    "",
    `工作流：${normalizeLine(alert.workflowName)}`,
    `触发方式：${normalizeLine(alert.trigger)}`,
    `失败时间：${normalizeLine(alert.failedAt)}`,
  ];

  if (alert.details?.trim()) {
    lines.push(`详情：${normalizeLine(alert.details)}`);
  }

  lines.push(`查看日志：[GitHub Actions](${alert.runUrl})`);

  return lines.join("\n");
}

function renderItem(index: number, item: DigestItem): string {
  const evidence = item.evidence ?? [];
  const evidenceLine =
    evidence.length > 0
      ? `证据：${evidence.map((entry) => renderEvidenceText(entry)).join("；")}`
      : "证据：待补充";
  const themeLabel = localizeTheme(item.theme ?? "General OSS");

  return [
    `## ${index}. [${normalizeLine(item.repo)}](${item.url})`,
    `主题：${themeLabel}`,
    `做什么：${renderDigestField("summary", item.summary, item)}`,
    `为什么值得看：${renderDigestField("whyItMatters", item.whyItMatters, item)}`,
    `为什么是现在：${renderDigestField("whyNow", item.whyNow ?? "未记录", item)}`,
    evidenceLine,
    `新意：${renderDigestField("novelty", item.novelty, item)}`,
    `热度：${renderDigestField("trend", item.trend, item)}`,
  ].join("\n");
}

function renderPageHeader(digest: DailyDigest, pageNumber: number): string {
  const title =
    pageNumber === 1
      ? normalizeLine(digest.title)
      : `${normalizeLine(digest.title)}（第 ${pageNumber} 页）`;

  return [`# ${title}`, "", `日期：${normalizeLine(digest.date)}`].join("\n");
}

function truncateUtf8(input: string, maxBytes: number): string {
  let output = "";

  for (const char of input) {
    const next = `${output}${char}`;
    if (utf8ByteLength(next) > maxBytes) {
      break;
    }
    output = next;
  }

  return output.trimEnd();
}

function utf8ByteLength(input: string): number {
  return Buffer.byteLength(input, "utf8");
}

function normalizeLine(input: string): string {
  return input.replace(/\r\n/g, "\n").replace(/\n+/g, " ").trim();
}

function normalizeDigestText(input: string): string {
  return normalizeLine(
    input
      .replace(/!\[[^\]]*]\([^)]*\)/g, " ")
      .replace(/\[([^\]]+)]\([^)]*\)/g, "$1")
      .replace(/<\/?[^>\n]+>/g, " ")
      .replace(/https?:\/\/\S+/gi, " ")
      .replace(/[`*_~]/g, " ")
      .replace(/\s+/g, " "),
  );
}

function renderDigestField(
  field: "summary" | "whyItMatters" | "whyNow" | "novelty" | "trend",
  value: string,
  item: DigestItem,
): string {
  const localized = normalizeDigestText(value)
    .replace(/GitHub Trending 命中/g, "GitHub 热榜命中")
    .replace(/GitHub Trending/g, "GitHub 热榜")
    .replace(/\bTrending\b/g, "GitHub 热榜")
    .replace(/\bStar\s+/g, "星标 ");

  if (containsChinese(localized) && !shouldFallbackToChinese(localized)) {
    return localized;
  }

  const themeLabel = localizeTheme(item.theme ?? "General OSS");
  switch (field) {
    case "summary":
      return `${normalizeLine(item.repo)} 是一个聚焦${themeLabel}的开源项目。`;
    case "whyItMatters":
      return `它在${themeLabel}方向具备持续跟踪价值。`;
    case "whyNow":
      return buildChineseWhyNow(item);
    case "novelty":
      return `它在${themeLabel}方向的定位清晰，适合作为近期样本继续观察。`;
    case "trend":
      return buildChineseTrend(item);
  }
}

function renderEvidenceText(value: string): string {
  return normalizeDigestText(value)
    .replace(/GitHub Trending 命中/g, "GitHub 热榜命中")
    .replace(/GitHub Trending/g, "GitHub 热榜")
    .replace(/\bTrending\b/g, "GitHub 热榜")
    .replace(/\bStar\s+/g, "星标 ");
}

function buildChineseWhyNow(item: DigestItem): string {
  const evidence = item.evidence.join(" ");

  if (/新建仓库|新项目/.test(evidence)) {
    return "新项目仍在快速迭代，正处于出圈窗口。";
  }

  if (/成熟项目近期再次升温/.test(evidence)) {
    return "成熟项目近期恢复高频更新，值得重新关注。";
  }

  if (
    /Trending|热榜|最近 7 天更新活跃|近 7 天仍在推进|近 3 天仍在推进/.test(
      evidence,
    )
  ) {
    return "近期活跃信号明显，值得今天优先关注。";
  }

  return "近期活跃度和可读性同时具备，适合今天点进去深看。";
}

function buildChineseTrend(item: DigestItem): string {
  const evidence = item.evidence.map(renderEvidenceText);
  const prioritized = evidence.filter((entry) =>
    /热榜|更新活跃|仍在推进|新建仓库|成熟项目近期再次升温|星标/.test(entry),
  );

  if (prioritized.length > 0) {
    return `当前信号：${prioritized.join("、")}。`;
  }

  return "当前信号：近期活跃度和关注度均有支撑。";
}

function localizeTheme(theme: string): string {
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
      return "通用开源";
    default:
      return normalizeDigestText(theme);
  }
}

function containsChinese(input: string): boolean {
  return /[\u4e00-\u9fff]/.test(input);
}

function shouldFallbackToChinese(input: string): boolean {
  return /[A-Za-z]{3,}/.test(input.replace(/GitHub/g, ""));
}
