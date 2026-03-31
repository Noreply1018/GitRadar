import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { DIGEST_RULES_CONFIG } from "../src/config/digest-rules";
import { type DailyDigestArchive } from "../src/core/archive";
import { buildFeedbackInsights } from "../src/feedback/insights";
import { buildArchiveSummary } from "../src/web-api/services/archive-service";
import {
  CommandRunner,
  listCommandSpecs,
} from "../src/web-api/services/command-runner";
import { validateDigestRulesDraft } from "../src/web-api/services/digest-rules-service";
import {
  convertDailySendTimeToCron,
  readScheduleSettings,
  saveScheduleSettings,
} from "../src/web-api/services/schedule-service";
import {
  readUserPreferences,
  saveUserPreferences,
} from "../src/web-api/services/user-preferences-service";
import {
  listFeedbackItems,
  readFeedbackState,
  recordFeedback,
} from "../src/feedback/store";
import {
  readWecomSettings,
  saveWecomSettings,
} from "../src/web-api/services/wecom-settings-service";
import {
  readLlmSettings,
  saveLlmSettings,
  testLlmSettings,
} from "../src/web-api/services/llm-settings-service";
import {
  readGitHubSettings,
  saveGitHubSettings,
  testGitHubSettings,
} from "../src/web-api/services/github-settings-service";
import { readGitHubModeSchedule } from "../src/web-api/services/github-runtime-service";
import { readEnvironmentFingerprints } from "../src/web-api/services/environment-fingerprint-service";

let activeServer: ReturnType<typeof createServer> | null = null;

afterEach(async () => {
  if (!activeServer) {
    return;
  }

  await new Promise<void>((resolve, reject) => {
    activeServer?.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
  activeServer = null;
});

describe("validateDigestRulesDraft", () => {
  it("accepts the current repository config", () => {
    const result = validateDigestRulesDraft(DIGEST_RULES_CONFIG);

    expect(result.valid).toBe(true);
    expect(result.issues).toEqual([]);
  });

  it("returns a structured path when validation fails", () => {
    const result = validateDigestRulesDraft({
      ...DIGEST_RULES_CONFIG,
      thresholds: {
        ...DIGEST_RULES_CONFIG.thresholds,
        maxPushedDays: -1,
      },
    });

    expect(result.valid).toBe(false);
    expect(result.issues[0]?.path).toBe("digestRules.thresholds.maxPushedDays");
  });
});

describe("buildArchiveSummary", () => {
  it("extracts top-level archive data for the dashboard", () => {
    const archive: DailyDigestArchive = {
      schemaVersion: 3,
      generatedAt: "2026-03-30T07:00:00.000Z",
      candidateCount: 12,
      shortlistedCount: 6,
      candidates: [],
      shortlisted: [],
      selection: {
        llmCandidateRepos: ["owner/a", "owner/b"],
        selected: [],
        rejected: [],
      },
      generationMeta: {
        sourceCounts: {
          trending: 1,
          search_recently_updated: 2,
          search_recently_created: 3,
        },
        llmCandidateCount: 2,
        rulesVersion: "2026-03-evidence-v1",
        editorialMode: "llm",
      },
      digest: {
        date: "2026-03-30",
        title: "GitRadar Daily Digest",
        items: [
          {
            repo: "owner/a",
            url: "https://github.com/owner/a",
            summary: "A",
            whyItMatters: "B",
            whyNow: "C",
            novelty: "D",
            trend: "E",
            evidence: ["F"],
            theme: "AI Agents",
          },
          {
            repo: "owner/b",
            url: "https://github.com/owner/b",
            summary: "A",
            whyItMatters: "B",
            whyNow: "C",
            novelty: "D",
            trend: "E",
            evidence: ["F"],
            theme: "AI Research",
          },
        ],
      },
    };

    expect(buildArchiveSummary(archive)).toEqual({
      date: "2026-03-30",
      generatedAt: "2026-03-30T07:00:00.000Z",
      schemaVersion: 3,
      rulesVersion: "2026-03-evidence-v1",
      digestCount: 2,
      title: "GitRadar Daily Digest",
      editorialMode: "llm",
      topRepos: ["owner/a", "owner/b"],
    });
  });
});

describe("CommandRunner", () => {
  it("documents the supported command whitelist", () => {
    const specs = listCommandSpecs();

    expect(specs.map((item) => item.id)).toContain("generate-digest");
    expect(
      specs.find((item) => item.id === "analyze-digest")?.requiresDate,
    ).toBe(true);
  });

  it("rejects analyze requests without a date", () => {
    const runner = new CommandRunner(process.cwd());

    expect(() => runner.startJob("analyze-digest")).toThrow(/requires a date/);
  });
});

describe("schedule settings", () => {
  it("falls back to the default daily send time when no file exists", async () => {
    const rootDir = await mkdtemp(path.join(os.tmpdir(), "gitradar-schedule-"));

    await expect(readScheduleSettings(rootDir)).resolves.toMatchObject({
      source: "local",
      readonly: false,
      settings: {
        timezone: "Asia/Shanghai",
        dailySendTime: "08:17",
      },
      availableTimezones: expect.arrayContaining([
        expect.objectContaining({ value: "Asia/Shanghai" }),
        expect.objectContaining({ value: "America/New_York" }),
      ]),
    });
  });

  it("saves a valid daily send time and timezone to config/schedule.json", async () => {
    const rootDir = await mkdtemp(path.join(os.tmpdir(), "gitradar-schedule-"));

    const saved = await saveScheduleSettings(rootDir, {
      timezone: "America/New_York",
      dailySendTime: "09:45",
    });

    expect(saved.settings.dailySendTime).toBe("09:45");
    expect(saved.settings.timezone).toBe("America/New_York");
    expect(saved.path).toBe(path.join(rootDir, "config", "schedule.json"));

    const file = await readFile(saved.path, "utf8");
    expect(JSON.parse(file)).toEqual({
      timezone: "America/New_York",
      dailySendTime: "09:45",
    });
  });

  it("rejects unsupported time formats", async () => {
    const rootDir = await mkdtemp(path.join(os.tmpdir(), "gitradar-schedule-"));

    await expect(
      saveScheduleSettings(rootDir, {
        timezone: "Asia/Shanghai",
        dailySendTime: "9:45",
      }),
    ).rejects.toThrow(/HH:mm/);
  });

  it("rejects unsupported timezone values", async () => {
    const rootDir = await mkdtemp(path.join(os.tmpdir(), "gitradar-schedule-"));

    await expect(
      saveScheduleSettings(rootDir, {
        timezone: "UTC" as "Asia/Shanghai",
        dailySendTime: "09:45",
      }),
    ).rejects.toThrow(/常用城市时区/);
  });

  it("converts a saved time into the cron expression used by Docker", () => {
    expect(convertDailySendTimeToCron("08:17")).toBe("17 8 * * *");
    expect(convertDailySendTimeToCron("21:05")).toBe("5 21 * * *");
  });

  it("uses repo schedule.json as the formal GitHub schedule source", async () => {
    const rootDir = await mkdtemp(path.join(os.tmpdir(), "gitradar-gh-mode-"));
    await mkdir(path.join(rootDir, "config"), { recursive: true });
    await mkdir(path.join(rootDir, ".github", "workflows"), {
      recursive: true,
    });

    await writeFile(
      path.join(rootDir, "config", "schedule.json"),
      JSON.stringify(
        {
          timezone: "America/New_York",
          dailySendTime: "09:45",
        },
        null,
        2,
      ),
      "utf8",
    );
    await writeFile(
      path.join(rootDir, ".github", "workflows", "daily-digest.yml"),
      [
        "name: Daily Digest",
        "on:",
        "  schedule:",
        '    - cron: "*/5 * * * *"',
        "",
      ].join("\n"),
      "utf8",
    );

    await expect(readGitHubModeSchedule(rootDir)).resolves.toMatchObject({
      source: "github",
      readonly: false,
      path: "config/schedule.json",
      settings: {
        timezone: "America/New_York",
        dailySendTime: "09:45",
      },
      cronExpression: "*/5 * * * * (polling) / 45 9 * * * (target)",
    });
  });
});

describe("user preferences", () => {
  it("falls back to empty preferences when no file exists", async () => {
    const rootDir = await mkdtemp(
      path.join(os.tmpdir(), "gitradar-preferences-"),
    );

    expect(readUserPreferences(rootDir)).toMatchObject({
      preferences: {
        preferredThemes: [],
        customTopics: [],
      },
      availableThemes: expect.arrayContaining(["AI Agents", "AI Research"]),
    });
  });

  it("saves preferred themes and custom topics", async () => {
    const rootDir = await mkdtemp(
      path.join(os.tmpdir(), "gitradar-preferences-"),
    );

    const saved = await saveUserPreferences(rootDir, {
      preferredThemes: ["AI Agents", "Frontend & Design"],
      customTopics: ["Fabric", "FPGA"],
    });

    expect(saved.preferences).toEqual({
      preferredThemes: ["AI Agents", "Frontend & Design"],
      customTopics: ["Fabric", "FPGA"],
    });

    const file = await readFile(saved.path, "utf8");
    expect(JSON.parse(file)).toEqual({
      preferredThemes: ["AI Agents", "Frontend & Design"],
      customTopics: ["Fabric", "FPGA"],
    });
  });

  it("rejects unknown preferred themes", async () => {
    const rootDir = await mkdtemp(
      path.join(os.tmpdir(), "gitradar-preferences-"),
    );

    await expect(
      saveUserPreferences(rootDir, {
        preferredThemes: ["Unknown Theme"],
        customTopics: [],
      }),
    ).rejects.toThrow(/unknown theme/i);
  });
});

describe("feedback store", () => {
  it("falls back to an empty feedback state when no file exists", async () => {
    const rootDir = await mkdtemp(path.join(os.tmpdir(), "gitradar-feedback-"));

    await expect(readFeedbackState(rootDir)).resolves.toEqual({
      repoStates: {},
      themeStats: {},
      recent: [],
    });
  });

  it("records feedback events and keeps the latest repo state", async () => {
    const rootDir = await mkdtemp(path.join(os.tmpdir(), "gitradar-feedback-"));

    await recordFeedback(rootDir, {
      repo: "owner/repo-a",
      date: "2026-03-30",
      action: "saved",
      theme: "Frontend & Design",
    });
    const result = await recordFeedback(rootDir, {
      repo: "owner/repo-a",
      date: "2026-03-31",
      action: "skipped",
      theme: "Frontend & Design",
    });

    expect(result.state.repoStates["owner/repo-a"]).toMatchObject({
      action: "skipped",
      date: "2026-03-31",
      theme: "Frontend & Design",
    });
    expect(result.state.themeStats["Frontend & Design"]).toEqual({
      saved: 0,
      skipped: 1,
    });
    expect(result.state.recent[0]?.repo).toBe("owner/repo-a");
  });

  it("rejects invalid feedback actions", async () => {
    const rootDir = await mkdtemp(path.join(os.tmpdir(), "gitradar-feedback-"));

    await expect(
      recordFeedback(rootDir, {
        repo: "owner/repo-a",
        date: "2026-03-30",
        action: "opened" as "saved",
      }),
    ).rejects.toThrow(/saved、skipped 或 later/);
  });

  it("lists current saved and later items from the latest repo state", async () => {
    const rootDir = await mkdtemp(path.join(os.tmpdir(), "gitradar-feedback-"));

    await recordFeedback(rootDir, {
      repo: "owner/repo-a",
      date: "2026-03-30",
      action: "saved",
      theme: "AI Agents",
    });
    await recordFeedback(rootDir, {
      repo: "owner/repo-b",
      date: "2026-03-30",
      action: "later",
      theme: "Frontend & Design",
    });
    await recordFeedback(rootDir, {
      repo: "owner/repo-a",
      date: "2026-03-31",
      action: "skipped",
      theme: "AI Agents",
    });

    const savedItems = await listFeedbackItems(rootDir, { action: "saved" });
    const laterItems = await listFeedbackItems(rootDir, { action: "later" });

    expect(savedItems).toEqual([]);
    expect(laterItems).toHaveLength(1);
    expect(laterItems[0]).toMatchObject({
      repo: "owner/repo-b",
      action: "later",
      theme: "Frontend & Design",
    });
  });

  it("derives interest insights and preference suggestions from recent saves", async () => {
    const rootDir = await mkdtemp(path.join(os.tmpdir(), "gitradar-feedback-"));

    await recordFeedback(rootDir, {
      repo: "owner/repo-a",
      date: "2026-03-30",
      action: "saved",
      theme: "Infra & Runtime",
    });
    await recordFeedback(rootDir, {
      repo: "owner/repo-b",
      date: "2026-03-31",
      action: "saved",
      theme: "Infra & Runtime",
    });
    await recordFeedback(rootDir, {
      repo: "owner/repo-c",
      date: "2026-03-31",
      action: "skipped",
      theme: "Frontend & Design",
    });

    const state = await readFeedbackState(rootDir);
    const insights = buildFeedbackInsights(state, {
      preferredThemes: [],
      customTopics: [],
    });

    expect(insights.interestedThemes[0]).toMatchObject({
      theme: "Infra & Runtime",
    });
    expect(insights.skippedThemes[0]).toMatchObject({
      theme: "Frontend & Design",
    });
    expect(insights.preferenceSuggestion).toMatchObject({
      theme: "Infra & Runtime",
      suggestedAction: "prefer",
    });
  });
});

describe("wecom settings", () => {
  it("returns an unconfigured state when .env does not exist", async () => {
    const rootDir = await mkdtemp(path.join(os.tmpdir(), "gitradar-wecom-"));

    await expect(readWecomSettings(rootDir)).resolves.toMatchObject({
      source: "local",
      readonly: false,
      configured: false,
      maskedWebhookUrl: null,
      envFilePath: path.join(rootDir, ".env"),
    });
  });

  it("saves the webhook into .env and returns the masked value", async () => {
    const rootDir = await mkdtemp(path.join(os.tmpdir(), "gitradar-wecom-"));

    const response = await saveWecomSettings(rootDir, {
      webhookUrl:
        "https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=test-key",
    });

    expect(response).toEqual({
      source: "local",
      readonly: false,
      configured: true,
      maskedWebhookUrl: "https://qyapi.weixin.qq.com/cgi-bin/webhook/send?***",
      envFilePath: path.join(rootDir, ".env"),
    });

    const envFile = await readFile(path.join(rootDir, ".env"), "utf8");
    expect(envFile).toContain(
      "GITRADAR_WECOM_WEBHOOK_URL=https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=test-key",
    );
  });

  it("rejects an invalid webhook url", async () => {
    const rootDir = await mkdtemp(path.join(os.tmpdir(), "gitradar-wecom-"));

    await expect(
      saveWecomSettings(rootDir, { webhookUrl: "not-a-url" }),
    ).rejects.toThrow(/valid URL/);
  });
});

describe("github settings", () => {
  it("returns an unconfigured state when .env does not exist", async () => {
    const rootDir = await mkdtemp(path.join(os.tmpdir(), "gitradar-github-"));

    await expect(readGitHubSettings(rootDir)).resolves.toMatchObject({
      source: "local",
      readonly: false,
      configured: false,
      maskedToken: null,
      apiBaseUrl: "https://api.github.com",
      trendingUrl: "https://github.com/trending?since=daily",
      envFilePath: path.join(rootDir, ".env"),
    });
  });

  it("saves github token into .env and returns masked data", async () => {
    const rootDir = await mkdtemp(path.join(os.tmpdir(), "gitradar-github-"));

    const response = await saveGitHubSettings(rootDir, {
      token: "github-token-sample-value",
    });

    expect(response).toEqual({
      source: "local",
      readonly: false,
      configured: true,
      maskedToken: "gith***alue",
      apiBaseUrl: "https://api.github.com",
      trendingUrl: "https://github.com/trending?since=daily",
      envFilePath: path.join(rootDir, ".env"),
    });

    const envFile = await readFile(path.join(rootDir, ".env"), "utf8");
    expect(envFile).toContain("GITHUB_TOKEN=github-token-sample-value");
  });

  it("tests the current github token with a real http request", async () => {
    const rootDir = await mkdtemp(path.join(os.tmpdir(), "gitradar-github-"));
    const server = createServer((request, response) => {
      expect(request.url).toBe("/user");
      expect(request.headers.authorization).toBe(
        "Bearer github-token-sample-value",
      );
      expect(request.headers["user-agent"]).toBe("GitRadar");
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify({ login: "gitradar-bot" }));
    });
    activeServer = server;

    const address = await new Promise<{ port: number }>((resolve, reject) => {
      server.listen(0, "127.0.0.1", () => {
        const value = server.address();

        if (!value || typeof value === "string") {
          reject(new Error("Failed to bind test server."));
          return;
        }

        resolve({ port: value.port });
      });
    });

    const apiBaseUrl = `http://127.0.0.1:${address.port}`;
    await saveGitHubSettings(rootDir, {
      token: "github-token-sample-value",
    });
    const currentEnvFile = await readFile(path.join(rootDir, ".env"), "utf8");
    await writeFile(
      path.join(rootDir, ".env"),
      `${currentEnvFile}GR_GH_API_URL=${apiBaseUrl}\n`,
      "utf8",
    );

    await expect(testGitHubSettings(rootDir)).resolves.toEqual({
      ok: true,
      message: "GitHub Token 连通性测试通过。",
      login: "gitradar-bot",
      apiBaseUrl,
    });

    await expect(readEnvironmentFingerprints(rootDir)).resolves.toMatchObject({
      github: {
        login: "gitradar-bot",
        apiBaseUrl,
      },
    });
  });
});

describe("llm settings", () => {
  it("returns an unconfigured state when .env does not exist", async () => {
    const rootDir = await mkdtemp(path.join(os.tmpdir(), "gitradar-llm-"));

    await expect(readLlmSettings(rootDir)).resolves.toMatchObject({
      source: "local",
      readonly: false,
      configured: false,
      maskedApiKey: null,
      baseUrl: null,
      model: null,
      envFilePath: path.join(rootDir, ".env"),
    });
  });

  it("saves llm settings into .env and returns masked data", async () => {
    const rootDir = await mkdtemp(path.join(os.tmpdir(), "gitradar-llm-"));

    const response = await saveLlmSettings(rootDir, {
      apiKey: "llm-token-sample-value",
      baseUrl: "https://example.com/v1/",
      model: "gpt-test",
    });

    expect(response).toEqual({
      source: "local",
      readonly: false,
      configured: true,
      maskedApiKey: "llm-***alue",
      baseUrl: "https://example.com/v1",
      model: "gpt-test",
      envFilePath: path.join(rootDir, ".env"),
    });

    const envFile = await readFile(path.join(rootDir, ".env"), "utf8");
    expect(envFile).toContain("GR_API_KEY=llm-token-sample-value");
    expect(envFile).toContain("GR_BASE_URL=https://example.com/v1");
    expect(envFile).toContain("GR_MODEL=gpt-test");
  });

  it("keeps the existing api key when only base url and model are updated", async () => {
    const rootDir = await mkdtemp(path.join(os.tmpdir(), "gitradar-llm-"));

    await saveLlmSettings(rootDir, {
      apiKey: "llm-token-sample-value",
      baseUrl: "https://example.com/v1",
      model: "gpt-test",
    });

    await saveLlmSettings(rootDir, {
      baseUrl: "https://gateway.example.com/v1",
      model: "gpt-next",
    });

    const envFile = await readFile(path.join(rootDir, ".env"), "utf8");
    expect(envFile).toContain("GR_API_KEY=llm-token-sample-value");
    expect(envFile).toContain("GR_BASE_URL=https://gateway.example.com/v1");
    expect(envFile).toContain("GR_MODEL=gpt-next");
  });

  it("rejects an invalid llm base url", async () => {
    const rootDir = await mkdtemp(path.join(os.tmpdir(), "gitradar-llm-"));

    await expect(
      saveLlmSettings(rootDir, {
        apiKey: "llm-token-sample-value",
        baseUrl: "not-a-url",
        model: "gpt-test",
      }),
    ).rejects.toThrow(/valid URL/);
  });

  it("tests the current llm settings with a real http request", async () => {
    const rootDir = await mkdtemp(path.join(os.tmpdir(), "gitradar-llm-"));
    const server = createServer((request, response) => {
      expect(request.url).toBe("/v1/chat/completions");
      expect(request.headers.authorization).toBe(
        "Bearer llm-token-sample-value",
      );
      response.writeHead(200, { "content-type": "application/json" });
      response.end(
        JSON.stringify({
          choices: [{ message: { content: "OK" } }],
        }),
      );
    });
    activeServer = server;

    const address = await new Promise<{ port: number }>((resolve, reject) => {
      server.listen(0, "127.0.0.1", () => {
        const value = server.address();

        if (!value || typeof value === "string") {
          reject(new Error("Failed to bind test server."));
          return;
        }

        resolve({ port: value.port });
      });
    });

    await saveLlmSettings(rootDir, {
      apiKey: "llm-token-sample-value",
      baseUrl: `http://127.0.0.1:${address.port}/v1`,
      model: "gpt-test",
    });

    await expect(testLlmSettings(rootDir)).resolves.toEqual({
      ok: true,
      message: "LLM 连通性测试通过。",
      model: "gpt-test",
      baseUrl: `http://127.0.0.1:${address.port}/v1`,
    });

    await expect(readEnvironmentFingerprints(rootDir)).resolves.toMatchObject({
      llm: {
        model: "gpt-test",
        baseUrl: `http://127.0.0.1:${address.port}/v1`,
      },
    });
  });
});
