import { request } from "undici";

import type { DailyDigest, DigestItem } from "../core/digest";
import { maskWebhookUrl } from "../config/mask";
import type { Notifier } from "./notifier";

const WECOM_MARKDOWN_LIMIT_BYTES = 4096;
const WECOM_FOOTER = "\n\n更多内容请查看 GitHub 或本地归档。";

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
    await this.sendPayload(renderWecomMarkdownPayload(digest));
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
  return {
    msgtype: "markdown",
    markdown: {
      content: renderWecomMarkdown(digest),
    },
  };
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

export function renderWecomMarkdown(digest: DailyDigest): string {
  if (digest.items.length === 0) {
    throw new Error("Cannot render a digest without items.");
  }

  const header = [
    `# ${normalizeLine(digest.title)}`,
    "",
    `日期：${normalizeLine(digest.date)}`,
  ].join("\n");

  let content = header;
  let includedItems = 0;
  let hasOverflow = false;

  for (const [index, item] of digest.items.entries()) {
    const block = renderItem(index + 1, item);
    const isLastItem = index === digest.items.length - 1;
    const reservedFooter = isLastItem ? 0 : utf8ByteLength(WECOM_FOOTER);

    if (
      utf8ByteLength(`${content}\n\n${block}`) + reservedFooter <=
      WECOM_MARKDOWN_LIMIT_BYTES
    ) {
      content = `${content}\n\n${block}`;
      includedItems += 1;
      continue;
    }

    hasOverflow = true;

    if (includedItems === 0) {
      const availableBytes =
        WECOM_MARKDOWN_LIMIT_BYTES -
        utf8ByteLength(`${content}\n\n`) -
        utf8ByteLength(WECOM_FOOTER);

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
      includedItems = 1;
    }

    break;
  }

  if (hasOverflow) {
    content = appendFooterWithinLimit(content, WECOM_FOOTER);
  }

  if (utf8ByteLength(content) > WECOM_MARKDOWN_LIMIT_BYTES) {
    throw new Error("Rendered markdown exceeds WeCom robot message limit.");
  }

  return content;
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
      ? `证据：${evidence.map(normalizeLine).join("；")}`
      : "证据：待补充";

  return [
    `## ${index}. [${normalizeLine(item.repo)}](${item.url})`,
    `主题：${normalizeLine(item.theme ?? "General OSS")}`,
    `做什么：${normalizeLine(item.summary)}`,
    `为什么值得看：${normalizeLine(item.whyItMatters)}`,
    `为什么是现在：${normalizeLine(item.whyNow ?? "未记录")}`,
    evidenceLine,
    `新意：${normalizeLine(item.novelty)}`,
    `热度：${normalizeLine(item.trend)}`,
  ].join("\n");
}

function appendFooterWithinLimit(content: string, footer: string): string {
  if (
    utf8ByteLength(content) + utf8ByteLength(footer) <=
    WECOM_MARKDOWN_LIMIT_BYTES
  ) {
    return `${content}${footer}`;
  }

  const availableBytes = WECOM_MARKDOWN_LIMIT_BYTES - utf8ByteLength(footer);

  const trimmedContent = truncateUtf8(content, availableBytes);
  return `${trimmedContent}${footer}`;
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
