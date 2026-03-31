import { request } from "undici";

import {
  getGitHubConfigFromEnv,
  getLlmConfigFromEnv,
  getWecomRobotConfigFromEnv,
} from "../config/env";
import { maskWebhookUrl } from "../config/mask";
import {
  type EnvironmentReport,
  writeEnvironmentReport,
} from "../core/environment-report";

async function main(): Promise<void> {
  const rootDir = process.cwd();
  const checkedAt = new Date().toISOString();
  const report: EnvironmentReport = {
    source: "github",
    github: {
      status: "unknown",
      checkedAt,
      detail: "GitHub 环境尚未诊断。",
      login: null,
      apiBaseUrl: "https://api.github.com",
    },
    llm: {
      status: "unknown",
      checkedAt,
      detail: "LLM 环境尚未诊断。",
      model: null,
      baseUrl: null,
    },
    wecom: {
      status: "unknown",
      checkedAt,
      detail: "企业微信环境尚未诊断。",
      maskedWebhookUrl: null,
    },
  };

  try {
    const github = getGitHubConfigFromEnv();
    const response = await request(`${github.apiBaseUrl}/user`, {
      method: "GET",
      headers: {
        accept: "application/vnd.github+json",
        authorization: `Bearer ${github.token}`,
        "user-agent": "GitRadar",
        "x-github-api-version": "2022-11-28",
      },
    });
    if (response.statusCode >= 200 && response.statusCode < 300) {
      const payload = (await response.body.json()) as { login?: string };
      report.github = {
        status: "configured",
        checkedAt,
        detail: "GitHub token 已通过 `/user` 校验。",
        login: payload.login ?? null,
        apiBaseUrl: github.apiBaseUrl,
      };
    } else {
      report.github = {
        status: "invalid",
        checkedAt,
        detail: `GitHub token 校验失败，状态码 ${response.statusCode}。`,
        login: null,
        apiBaseUrl: github.apiBaseUrl,
      };
    }
  } catch (error) {
    report.github = {
      status: "missing",
      checkedAt,
      detail: error instanceof Error ? error.message : String(error),
      login: null,
      apiBaseUrl: "https://api.github.com",
    };
  }

  try {
    const llm = getLlmConfigFromEnv();
    report.llm = {
      status: "configured",
      checkedAt,
      detail: "已检测到 LLM 配置字段。",
      model: llm.model,
      baseUrl: llm.baseUrl,
    };
  } catch (error) {
    report.llm = {
      status: "missing",
      checkedAt,
      detail: error instanceof Error ? error.message : String(error),
      model: null,
      baseUrl: null,
    };
  }

  try {
    const wecom = getWecomRobotConfigFromEnv();
    report.wecom = {
      status: "configured",
      checkedAt,
      detail: "已检测到企业微信 Webhook 配置。",
      maskedWebhookUrl: maskWebhookUrl(wecom.webhookUrl),
    };
  } catch (error) {
    report.wecom = {
      status: "missing",
      checkedAt,
      detail: error instanceof Error ? error.message : String(error),
      maskedWebhookUrl: null,
    };
  }

  await writeEnvironmentReport(rootDir, report);
  console.log(
    "GitRadar environment report written to data/runtime/environment-report.json",
  );
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`GitRadar environment diagnostics failed: ${message}`);
  process.exitCode = 1;
});
