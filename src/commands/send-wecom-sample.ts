import { getWecomRobotConfigFromEnv } from "../config/env";
import { maskWebhookUrl } from "../config/mask";
import type { DailyDigest } from "../core/digest";
import { WecomRobotNotifier } from "../notifiers/wecom-robot";

async function main(): Promise<void> {
  const { webhookUrl } = getWecomRobotConfigFromEnv();
  const digest = buildSampleDigest();
  const notifier = new WecomRobotNotifier(webhookUrl);

  console.log(
    `Sending sample digest to WeCom robot: ${maskWebhookUrl(webhookUrl)}`,
  );
  console.log(`Digest date: ${digest.date}`);
  console.log(`Digest items: ${digest.items.length}`);

  await notifier.sendDailyDigest(digest);

  console.log("WeCom robot send completed successfully.");
}

function buildSampleDigest(): DailyDigest {
  return {
    date: "2026-03-25",
    title: "GitRadar Sample Digest",
    items: [
      {
        repo: "owner/alpha-agent",
        url: "https://github.com/owner/alpha-agent",
        summary: "一个面向自动化任务的 AI Agent 框架。",
        whyItMatters: "把复杂工具调用和工作流编排收进了统一抽象里。",
        novelty: "强调低样板代码的 agent runtime 设计。",
        trend: "过去 24 小时星标增长明显。",
      },
      {
        repo: "owner/rust-observatory",
        url: "https://github.com/owner/rust-observatory",
        summary: "用于分析 Rust 服务性能瓶颈的观测工具。",
        whyItMatters: "定位线上问题的视角清晰，适合工程型项目关注。",
        novelty: "把 profiling、trace 和 flamegraph 组合成一套更顺手的工作流。",
        trend: "最近在性能工程圈内被频繁提及。",
      },
      {
        repo: "owner/ui-lab",
        url: "https://github.com/owner/ui-lab",
        summary: "一个强调交互实验和动态视觉效果的 Web UI 项目。",
        whyItMatters: "不只是组件库，更像一个值得借鉴的前端表达样板。",
        novelty: "把设计系统和实验性动效结合得比较自然。",
        trend: "本周热度持续上升。",
      },
    ],
  };
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`WeCom robot send failed: ${message}`);
  process.exitCode = 1;
});
