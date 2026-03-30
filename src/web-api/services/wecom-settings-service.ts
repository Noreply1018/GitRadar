import { getWecomRobotConfigFromEnv } from "../../config/env";
import { maskWebhookUrl } from "../../config/mask";
import type { DailyDigest } from "../../core/digest";
import { WecomRobotNotifier } from "../../notifiers/wecom-robot";
import type { WecomSettingsResponse, WecomTestResponse } from "../types/api";
import {
  getManagedEnvPath,
  readManagedEnv,
  upsertManagedEnvValue,
} from "./managed-env";

const WECOM_WEBHOOK_KEY = "GITRADAR_WECOM_WEBHOOK_URL";

export async function readWecomSettings(
  rootDir: string,
): Promise<WecomSettingsResponse> {
  const env = await readManagedEnv(rootDir);
  const rawWebhookUrl = env[WECOM_WEBHOOK_KEY]?.trim();

  return {
    configured: Boolean(rawWebhookUrl),
    maskedWebhookUrl: rawWebhookUrl ? maskWebhookUrl(rawWebhookUrl) : null,
    envFilePath: getManagedEnvPath(rootDir),
  };
}

export async function saveWecomSettings(
  rootDir: string,
  input: unknown,
): Promise<WecomSettingsResponse> {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("企业微信配置必须是对象。");
  }

  const webhookUrl = String(
    (input as { webhookUrl?: unknown }).webhookUrl ?? "",
  ).trim();

  if (!webhookUrl) {
    throw new Error("webhookUrl 不能为空。");
  }

  getWecomRobotConfigFromEnv({
    [WECOM_WEBHOOK_KEY]: webhookUrl,
  });

  const envPath = await upsertManagedEnvValue(
    rootDir,
    WECOM_WEBHOOK_KEY,
    webhookUrl,
  );

  return {
    configured: true,
    maskedWebhookUrl: maskWebhookUrl(webhookUrl),
    envFilePath: envPath,
  };
}

export async function sendWecomTestMessage(
  rootDir: string,
): Promise<WecomTestResponse> {
  const env = await readManagedEnv(rootDir);
  const { webhookUrl } = getWecomRobotConfigFromEnv(env);
  const notifier = new WecomRobotNotifier(webhookUrl);
  const digest = buildSampleDigest();

  await notifier.sendDailyDigest(digest);

  return {
    ok: true,
    message: "企业微信测试消息发送完成。",
    maskedWebhookUrl: notifier.getMaskedWebhook(),
  };
}

function buildSampleDigest(): DailyDigest {
  return {
    date: "2026-03-25",
    title: "GitRadar Sample Digest",
    items: [
      {
        repo: "owner/alpha-agent",
        url: "https://github.com/owner/alpha-agent",
        theme: "AI Agents",
        summary: "一个面向自动化任务的 AI Agent 框架。",
        whyItMatters: "把复杂工具调用和工作流编排收进了统一抽象里。",
        whyNow: "多来源同时命中，且近期更新活跃。",
        evidence: ["GitHub Trending 命中", "最近 7 天更新活跃", "Star 4.2k"],
        novelty: "强调低样板代码的 agent runtime 设计。",
        trend: "过去 24 小时星标增长明显。",
      },
      {
        repo: "owner/rust-observatory",
        url: "https://github.com/owner/rust-observatory",
        theme: "Observability & Security",
        summary: "用于分析 Rust 服务性能瓶颈的观测工具。",
        whyItMatters: "定位线上问题的视角清晰，适合工程型项目关注。",
        whyNow: "成熟项目近期恢复高频更新，值得重新关注。",
        evidence: ["最近 7 天更新活跃", "成熟项目近期再次升温", "Star 3.2k"],
        novelty: "把 profiling、trace 和 flamegraph 组合成一套更顺手的工作流。",
        trend: "最近在性能工程圈内被频繁提及。",
      },
      {
        repo: "owner/ui-lab",
        url: "https://github.com/owner/ui-lab",
        theme: "Frontend & Design",
        summary: "一个强调交互实验和动态视觉效果的 Web UI 项目。",
        whyItMatters: "不只是组件库，更像一个值得借鉴的前端表达样板。",
        whyNow: "新项目仍在快速迭代，正处于出圈窗口。",
        evidence: ["GitHub Trending 命中", "一个月内新项目", "近 7 天仍在推进"],
        novelty: "把设计系统和实验性动效结合得比较自然。",
        trend: "本周热度持续上升。",
      },
    ],
  };
}
