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
      ? `证据：${evidence.map(normalizeDigestText).join("；")}`
      : "证据：待补充";

  return [
    `## ${index}. [${normalizeLine(item.repo)}](${item.url})`,
    `主题：${normalizeDigestText(item.theme ?? "General OSS")}`,
    `做什么：${normalizeDigestText(item.summary)}`,
    `为什么值得看：${normalizeDigestText(item.whyItMatters)}`,
    `为什么是现在：${normalizeDigestText(item.whyNow ?? "未记录")}`,
    evidenceLine,
    `新意：${normalizeDigestText(item.novelty)}`,
    `热度：${normalizeDigestText(item.trend)}`,
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
