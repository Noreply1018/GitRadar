import { useEffect, useMemo, useState } from "react";

import type { DailyDigestArchive } from "../../src/core/archive";
import type {
  ArchiveSummary,
  FeedbackAction,
  FeedbackListItem,
  FeedbackState,
  GitHubSettings,
  GitHubTestResult,
  LlmSettings,
  LlmTestResult,
  ScheduleSettings,
  TimezoneOption,
  UserPreferences,
  WecomSettings,
} from "./api";
import {
  fetchArchiveDetail,
  fetchArchives,
  fetchFeedback,
  fetchFeedbackItems,
  fetchGitHubSettings,
  fetchHealth,
  fetchLlmSettings,
  fetchPreferences,
  fetchScheduleSettings,
  fetchWecomSettings,
  recordFeedback,
  saveGitHubSettings,
  saveLlmSettings,
  savePreferences,
  saveScheduleSettings,
  saveWecomSettings,
  sendWecomTest,
  testGitHubSettings,
  testLlmSettings,
} from "./api";

type ViewId = "environment" | "preferences" | "saved" | "archives";
type SavedViewFilter = "saved" | "later";
type ValidationState = "idle" | "passed" | "failed";

interface ValidationStatus {
  state: ValidationState;
  detail: string;
}

const VIEWS: Array<{ id: ViewId; label: string }> = [
  { id: "environment", label: "环境配置" },
  { id: "preferences", label: "主题偏好" },
  { id: "saved", label: "收藏与待看" },
  { id: "archives", label: "归档日报" },
];

const EMPTY_PREFERENCES: UserPreferences = {
  preferredThemes: [],
  customTopics: [],
};

const EMPTY_FEEDBACK_STATE: FeedbackState = {
  repoStates: {},
  themeStats: {},
  recent: [],
};

const EMPTY_WECOM_SETTINGS: WecomSettings = {
  configured: false,
  maskedWebhookUrl: null,
  envFilePath: "",
};

const EMPTY_LLM_SETTINGS: LlmSettings = {
  configured: false,
  maskedApiKey: null,
  baseUrl: null,
  model: null,
  envFilePath: "",
};

const EMPTY_GITHUB_SETTINGS: GitHubSettings = {
  configured: false,
  maskedToken: null,
  apiBaseUrl: "https://api.github.com",
  trendingUrl: "https://github.com/trending?since=daily",
  envFilePath: "",
};

const IDLE_VALIDATION: ValidationStatus = {
  state: "idle",
  detail: "尚未验证",
};

export default function App() {
  const [activeView, setActiveView] = useState<ViewId>("environment");
  const [health, setHealth] = useState<{
    status: string;
    app: string;
    version: string;
    mode: string;
  } | null>(null);
  const [scheduleDraft, setScheduleDraft] = useState<ScheduleSettings | null>(
    null,
  );
  const [timezoneOptions, setTimezoneOptions] = useState<TimezoneOption[]>([]);
  const [preferencesDraft, setPreferencesDraft] =
    useState<UserPreferences>(EMPTY_PREFERENCES);
  const [availableThemes, setAvailableThemes] = useState<string[]>([]);
  const [customTopicInput, setCustomTopicInput] = useState("");
  const [feedbackState, setFeedbackState] =
    useState<FeedbackState>(EMPTY_FEEDBACK_STATE);
  const [savedItems, setSavedItems] = useState<FeedbackListItem[]>([]);
  const [laterItems, setLaterItems] = useState<FeedbackListItem[]>([]);
  const [savedViewFilter, setSavedViewFilter] =
    useState<SavedViewFilter>("saved");
  const [archives, setArchives] = useState<ArchiveSummary[]>([]);
  const [selectedArchiveDate, setSelectedArchiveDate] = useState("");
  const [archiveDetail, setArchiveDetail] = useState<DailyDigestArchive | null>(
    null,
  );
  const [currentItemIndex, setCurrentItemIndex] = useState(0);
  const [githubSettings, setGitHubSettings] = useState<GitHubSettings>(
    EMPTY_GITHUB_SETTINGS,
  );
  const [githubTokenInput, setGitHubTokenInput] = useState("");
  const [githubValidation, setGitHubValidation] =
    useState<ValidationStatus>(IDLE_VALIDATION);
  const [llmSettings, setLlmSettings] =
    useState<LlmSettings>(EMPTY_LLM_SETTINGS);
  const [llmApiKeyInput, setLlmApiKeyInput] = useState("");
  const [llmBaseUrlInput, setLlmBaseUrlInput] = useState("");
  const [llmModelInput, setLlmModelInput] = useState("");
  const [llmValidation, setLlmValidation] =
    useState<ValidationStatus>(IDLE_VALIDATION);
  const [wecomSettings, setWecomSettings] =
    useState<WecomSettings>(EMPTY_WECOM_SETTINGS);
  const [wecomWebhookInput, setWecomWebhookInput] = useState("");
  const [wecomValidation, setWecomValidation] =
    useState<ValidationStatus>(IDLE_VALIDATION);
  const [busyAction, setBusyAction] = useState<
    | ""
    | "hydrate"
    | "save-schedule"
    | "save-preferences"
    | "record-feedback"
    | "save-github"
    | "test-github"
    | "save-llm"
    | "test-llm"
    | "save-wecom"
    | "test-wecom"
  >("hydrate");
  const [statusMessage, setStatusMessage] = useState(
    "正在同步 GitRadar 当前状态…",
  );
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    void hydrate();
  }, []);

  useEffect(() => {
    if (activeView !== "archives" || !archiveDetail) {
      return;
    }

    const maxIndex = archiveDetail.digest.items.length - 1;

    function handleKeydown(event: KeyboardEvent): void {
      if (event.key === "ArrowLeft") {
        setCurrentItemIndex((current) => Math.max(current - 1, 0));
      }

      if (event.key === "ArrowRight") {
        setCurrentItemIndex((current) => Math.min(current + 1, maxIndex));
      }
    }

    window.addEventListener("keydown", handleKeydown);
    return () => window.removeEventListener("keydown", handleKeydown);
  }, [activeView, archiveDetail]);

  const selectedArchiveSummary = useMemo(
    () =>
      archives.find((archive) => archive.date === selectedArchiveDate) ?? null,
    [archives, selectedArchiveDate],
  );

  const currentDigestItem =
    archiveDetail?.digest.items[currentItemIndex] ?? null;
  const currentFeedback = currentDigestItem
    ? feedbackState.repoStates[currentDigestItem.repo]
    : null;
  const feedbackItems = savedViewFilter === "saved" ? savedItems : laterItems;

  const environmentCards = [
    buildEnvironmentCard(
      "GitHub 源",
      githubSettings.configured,
      githubValidation,
    ),
    buildEnvironmentCard("LLM 模型", llmSettings.configured, llmValidation),
    buildEnvironmentCard("企业微信", wecomSettings.configured, wecomValidation),
    {
      label: "调度",
      configured: Boolean(scheduleDraft),
      status: scheduleDraft ? "已配置" : "待配置",
      detail: scheduleDraft
        ? `${scheduleDraft.dailySendTime} · ${describeTimezone(
            scheduleDraft.timezone,
            timezoneOptions,
          )}`
        : "尚未读取配置",
    },
  ];

  async function hydrate(): Promise<void> {
    setBusyAction("hydrate");
    setErrorMessage("");

    try {
      const [
        healthResponse,
        scheduleResponse,
        preferencesResponse,
        feedbackResponse,
        archiveResponse,
        savedResponse,
        laterResponse,
        githubResponse,
        llmResponse,
        wecomResponse,
      ] = await Promise.all([
        fetchHealth(),
        fetchScheduleSettings(),
        fetchPreferences(),
        fetchFeedback(),
        fetchArchives(),
        fetchFeedbackItems("saved"),
        fetchFeedbackItems("later"),
        fetchGitHubSettings(),
        fetchLlmSettings(),
        fetchWecomSettings(),
      ]);

      setHealth(healthResponse);
      setScheduleDraft(scheduleResponse.settings);
      setTimezoneOptions(scheduleResponse.availableTimezones);
      setPreferencesDraft(preferencesResponse.preferences);
      setAvailableThemes(preferencesResponse.availableThemes);
      setFeedbackState(feedbackResponse.state);
      setArchives(archiveResponse.archives);
      setSavedItems(savedResponse.items);
      setLaterItems(laterResponse.items);
      setGitHubSettings(githubResponse);
      setGitHubTokenInput("");
      setGitHubValidation(IDLE_VALIDATION);
      setLlmSettings(llmResponse);
      setLlmApiKeyInput("");
      setLlmBaseUrlInput(llmResponse.baseUrl ?? "");
      setLlmModelInput(llmResponse.model ?? "");
      setLlmValidation(IDLE_VALIDATION);
      setWecomSettings(wecomResponse);
      setWecomWebhookInput("");
      setWecomValidation(IDLE_VALIDATION);

      const initialDate = archiveResponse.archives[0]?.date ?? "";
      setSelectedArchiveDate(initialDate);
      setCurrentItemIndex(0);

      if (initialDate) {
        const detailResponse = await fetchArchiveDetail(initialDate);
        setArchiveDetail(detailResponse.archive);
      } else {
        setArchiveDetail(null);
      }

      setStatusMessage("GitRadar 已同步到当前配置、反馈与归档状态。");
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setBusyAction("");
    }
  }

  async function refreshFeedbackCollections(): Promise<void> {
    const [savedResponse, laterResponse] = await Promise.all([
      fetchFeedbackItems("saved"),
      fetchFeedbackItems("later"),
    ]);

    setSavedItems(savedResponse.items);
    setLaterItems(laterResponse.items);
  }

  async function handleSaveSchedule(): Promise<void> {
    if (!scheduleDraft) {
      return;
    }

    setBusyAction("save-schedule");
    setErrorMessage("");

    try {
      const response = await saveScheduleSettings(scheduleDraft);
      setScheduleDraft(response.settings);
      setTimezoneOptions(response.availableTimezones);
      setStatusMessage("调度设置已写入配置文件，重启 GitRadar 后生效。");
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setBusyAction("");
    }
  }

  async function handleSavePreferences(): Promise<void> {
    setBusyAction("save-preferences");
    setErrorMessage("");

    try {
      const response = await savePreferences(preferencesDraft);
      setPreferencesDraft(response.preferences);
      setAvailableThemes(response.availableThemes);
      setStatusMessage("关心主题已保存，后续日报会按偏好增加权重。");
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setBusyAction("");
    }
  }

  async function handleSaveGitHubSettings(): Promise<void> {
    setBusyAction("save-github");
    setErrorMessage("");

    try {
      const response = await saveGitHubSettings({
        token: githubTokenInput.trim() || undefined,
      });
      setGitHubSettings(response);
      setGitHubTokenInput("");
      setGitHubValidation(IDLE_VALIDATION);
      setStatusMessage("GitHub Token 已写入 .env，尚未验证可用性。");
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
      setGitHubValidation({
        state: "failed",
        detail: getErrorMessage(error),
      });
    } finally {
      setBusyAction("");
    }
  }

  async function handleTestGitHubSettings(): Promise<void> {
    setBusyAction("test-github");
    setErrorMessage("");

    try {
      const response: GitHubTestResult = await testGitHubSettings();
      setGitHubValidation({
        state: "passed",
        detail: `账号 ${response.login}`,
      });
      setStatusMessage(
        `${response.message} 账号：${response.login} · 地址：${response.apiBaseUrl}`,
      );
    } catch (error) {
      setGitHubValidation({
        state: "failed",
        detail: getErrorMessage(error),
      });
      setErrorMessage(getErrorMessage(error));
    } finally {
      setBusyAction("");
    }
  }

  async function handleSaveLlmSettings(): Promise<void> {
    setBusyAction("save-llm");
    setErrorMessage("");

    try {
      const response = await saveLlmSettings({
        apiKey: llmApiKeyInput.trim() || undefined,
        baseUrl: llmBaseUrlInput.trim(),
        model: llmModelInput.trim(),
      });
      setLlmSettings(response);
      setLlmApiKeyInput("");
      setLlmBaseUrlInput(response.baseUrl ?? "");
      setLlmModelInput(response.model ?? "");
      setLlmValidation(IDLE_VALIDATION);
      setStatusMessage("LLM 配置已写入 .env，尚未验证连通性。");
    } catch (error) {
      setLlmValidation({
        state: "failed",
        detail: getErrorMessage(error),
      });
      setErrorMessage(getErrorMessage(error));
    } finally {
      setBusyAction("");
    }
  }

  async function handleTestLlmSettings(): Promise<void> {
    setBusyAction("test-llm");
    setErrorMessage("");

    try {
      const response: LlmTestResult = await testLlmSettings();
      setLlmValidation({
        state: "passed",
        detail: `${response.model}`,
      });
      setStatusMessage(
        `${response.message} 模型：${response.model} · 地址：${response.baseUrl}`,
      );
      setLlmSettings((current) => ({
        ...current,
        configured: true,
        baseUrl: response.baseUrl,
        model: response.model,
      }));
    } catch (error) {
      setLlmValidation({
        state: "failed",
        detail: getErrorMessage(error),
      });
      setErrorMessage(getErrorMessage(error));
    } finally {
      setBusyAction("");
    }
  }

  async function handleSaveWecomSettings(): Promise<void> {
    const webhookUrl = wecomWebhookInput.trim();

    if (!webhookUrl) {
      setErrorMessage("请输入新的企业微信 Webhook 链接。");
      setWecomValidation({
        state: "failed",
        detail: "Webhook 不能为空",
      });
      return;
    }

    setBusyAction("save-wecom");
    setErrorMessage("");

    try {
      const response = await saveWecomSettings({ webhookUrl });
      setWecomSettings(response);
      setWecomWebhookInput("");
      setWecomValidation(IDLE_VALIDATION);
      setStatusMessage("企业微信 Webhook 已写入 .env，尚未验证发送。");
    } catch (error) {
      setWecomValidation({
        state: "failed",
        detail: getErrorMessage(error),
      });
      setErrorMessage(getErrorMessage(error));
    } finally {
      setBusyAction("");
    }
  }

  async function handleSendWecomTest(): Promise<void> {
    setBusyAction("test-wecom");
    setErrorMessage("");

    try {
      const response = await sendWecomTest();
      setWecomValidation({
        state: "passed",
        detail: response.maskedWebhookUrl,
      });
      setStatusMessage(
        `${response.message} 目标：${response.maskedWebhookUrl}`,
      );
      setWecomSettings((current) => ({
        ...current,
        configured: true,
        maskedWebhookUrl: response.maskedWebhookUrl,
      }));
    } catch (error) {
      setWecomValidation({
        state: "failed",
        detail: getErrorMessage(error),
      });
      setErrorMessage(getErrorMessage(error));
    } finally {
      setBusyAction("");
    }
  }

  async function handleSelectArchive(date: string): Promise<void> {
    setSelectedArchiveDate(date);
    setCurrentItemIndex(0);
    setErrorMessage("");

    try {
      const detailResponse = await fetchArchiveDetail(date);
      setArchiveDetail(detailResponse.archive);
      setStatusMessage("已切换到新的归档日报。");
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    }
  }

  async function handleOpenArchiveFromCollection(
    date: string,
    repo: string,
  ): Promise<void> {
    setActiveView("archives");
    setSelectedArchiveDate(date);
    setCurrentItemIndex(0);
    setErrorMessage("");

    try {
      const detailResponse = await fetchArchiveDetail(date);
      const matchedIndex = detailResponse.archive.digest.items.findIndex(
        (item) => item.repo === repo,
      );

      setArchiveDetail(detailResponse.archive);

      if (matchedIndex >= 0) {
        setCurrentItemIndex(matchedIndex);
        setStatusMessage(`已跳转到 ${date} 的归档，并定位到 ${repo}。`);
        return;
      }

      setStatusMessage(
        `已打开 ${date} 的归档，但没有定位到 ${repo}，当前展示当日首条。`,
      );
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    }
  }

  async function handleRecordFeedback(action: FeedbackAction): Promise<void> {
    if (!currentDigestItem || !archiveDetail) {
      return;
    }

    setBusyAction("record-feedback");
    setErrorMessage("");

    try {
      const response = await recordFeedback({
        repo: currentDigestItem.repo,
        date: archiveDetail.digest.date,
        action,
        theme: currentDigestItem.theme,
      });
      setFeedbackState(response.state);
      await refreshFeedbackCollections();
      setStatusMessage("反馈已记录，收藏与待看列表已同步更新。");
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setBusyAction("");
    }
  }

  function handleToggleTheme(theme: string): void {
    setPreferencesDraft((current) => {
      const exists = current.preferredThemes.includes(theme);
      return {
        ...current,
        preferredThemes: exists
          ? current.preferredThemes.filter((item) => item !== theme)
          : [...current.preferredThemes, theme],
      };
    });
  }

  function handleAddCustomTopic(): void {
    const topic = customTopicInput.trim();

    if (!topic) {
      return;
    }

    setPreferencesDraft((current) => {
      if (
        current.customTopics.some(
          (item) => item.toLowerCase() === topic.toLowerCase(),
        )
      ) {
        return current;
      }

      return {
        ...current,
        customTopics: [...current.customTopics, topic],
      };
    });
    setCustomTopicInput("");
  }

  function handleRemoveCustomTopic(topic: string): void {
    setPreferencesDraft((current) => ({
      ...current,
      customTopics: current.customTopics.filter((item) => item !== topic),
    }));
  }

  return (
    <div className="page-shell">
      <div className="page-texture" aria-hidden="true" />

      <header className="masthead">
        <div className="masthead-copy">
          <p className="eyebrow">Open Source Daily Digest</p>
          <h1>GitRadar</h1>
          <p className="masthead-subtitle">每日开源雷达与归档阅读</p>
        </div>

        <div className="masthead-meta">
          <MetaPill label="服务状态" value={health?.status ?? "loading"} />
          <MetaPill
            label="版本"
            value={health ? `v${health.version}` : "loading"}
          />
          <MetaPill label="模式" value={health?.mode ?? "loading"} />
        </div>
      </header>

      <section className="toolbar">
        <nav className="view-tabs" aria-label="页面视图">
          {VIEWS.map((view) => (
            <button
              key={view.id}
              className={
                view.id === activeView ? "view-tab active" : "view-tab"
              }
              onClick={() => setActiveView(view.id)}
              type="button"
            >
              {view.label}
            </button>
          ))}
        </nav>

        <button
          className="ghost-button"
          onClick={() => void hydrate()}
          type="button"
        >
          刷新
        </button>
      </section>

      <section className="feedback-bar">
        <div className="feedback-main">
          <strong>{statusMessage}</strong>
          <span>
            已区分配置写入、测试验证与归档反馈，不把按钮点击当成链路成功。
          </span>
        </div>

        {errorMessage ? (
          <div className="feedback-error">
            <strong>错误</strong>
            <span>{errorMessage}</span>
          </div>
        ) : null}
      </section>

      {activeView === "environment" ? (
        <main className="environment-page">
          <section className="panel environment-summary-panel">
            <header className="panel-header compact">
              <div>
                <p className="eyebrow">Environment</p>
                <h2>环境摘要</h2>
              </div>
            </header>

            <div className="environment-card-grid">
              {environmentCards.map((card) => (
                <article key={card.label} className="environment-card">
                  <span>{card.label}</span>
                  <strong>{card.status}</strong>
                  <p>{card.detail}</p>
                </article>
              ))}
            </div>
          </section>

          <section className="panel github-panel">
            <header className="panel-header compact">
              <div>
                <p className="eyebrow">GitHub</p>
                <h2>GitHub 源配置</h2>
              </div>
              <StatusBadge
                configured={githubSettings.configured}
                validation={githubValidation}
              />
            </header>

            <div className="wecom-details">
              <div className="wecom-row">
                <span>当前 Token</span>
                <strong>{githubSettings.maskedToken ?? "尚未配置"}</strong>
              </div>
              <div className="wecom-row">
                <span>API 地址</span>
                <strong>{githubSettings.apiBaseUrl}</strong>
              </div>
              <div className="wecom-row">
                <span>Trending 地址</span>
                <strong>{githubSettings.trendingUrl}</strong>
              </div>
              <div className="wecom-row">
                <span>配置文件</span>
                <strong>{githubSettings.envFilePath || "--"}</strong>
              </div>
            </div>

            <label className="field">
              <span>新的 GitHub Token</span>
              <input
                autoComplete="off"
                onChange={(event) => setGitHubTokenInput(event.target.value)}
                placeholder="留空表示保留当前 Token，不会回显旧值"
                type="password"
                value={githubTokenInput}
              />
            </label>

            <ValidationHint validation={githubValidation} />

            <div className="action-row dual-actions">
              <button
                className="primary-button"
                disabled={busyAction !== ""}
                onClick={() => void handleSaveGitHubSettings()}
                type="button"
              >
                {busyAction === "save-github" ? "保存中…" : "保存 GitHub Token"}
              </button>
              <button
                className="ghost-button"
                disabled={busyAction !== ""}
                onClick={() => void handleTestGitHubSettings()}
                type="button"
              >
                {busyAction === "test-github"
                  ? "测试中…"
                  : "测试 GitHub 连通性"}
              </button>
            </div>
          </section>

          <section className="panel llm-panel">
            <header className="panel-header compact">
              <div>
                <p className="eyebrow">LLM</p>
                <h2>模型配置</h2>
              </div>
              <StatusBadge
                configured={llmSettings.configured}
                validation={llmValidation}
              />
            </header>

            <div className="wecom-details">
              <div className="wecom-row">
                <span>当前 API Key</span>
                <strong>{llmSettings.maskedApiKey ?? "尚未配置"}</strong>
              </div>
              <div className="wecom-row">
                <span>Base URL</span>
                <strong>{llmSettings.baseUrl ?? "尚未配置"}</strong>
              </div>
              <div className="wecom-row">
                <span>Model</span>
                <strong>{llmSettings.model ?? "尚未配置"}</strong>
              </div>
              <div className="wecom-row">
                <span>配置文件</span>
                <strong>{llmSettings.envFilePath || "--"}</strong>
              </div>
            </div>

            <label className="field">
              <span>新的 API Key</span>
              <input
                autoComplete="off"
                onChange={(event) => setLlmApiKeyInput(event.target.value)}
                placeholder="留空表示保留当前 API Key，不会回显旧值"
                type="password"
                value={llmApiKeyInput}
              />
            </label>

            <div className="schedule-grid">
              <label className="field">
                <span>Base URL</span>
                <input
                  onChange={(event) => setLlmBaseUrlInput(event.target.value)}
                  placeholder="例如：https://your-openai-compatible-endpoint/v1"
                  type="url"
                  value={llmBaseUrlInput}
                />
              </label>

              <label className="field">
                <span>Model</span>
                <input
                  onChange={(event) => setLlmModelInput(event.target.value)}
                  placeholder="例如：gpt-4.1-mini"
                  type="text"
                  value={llmModelInput}
                />
              </label>
            </div>

            <ValidationHint validation={llmValidation} />

            <div className="action-row dual-actions">
              <button
                className="primary-button"
                disabled={busyAction !== ""}
                onClick={() => void handleSaveLlmSettings()}
                type="button"
              >
                {busyAction === "save-llm" ? "保存中…" : "保存 LLM 配置"}
              </button>
              <button
                className="ghost-button"
                disabled={busyAction !== ""}
                onClick={() => void handleTestLlmSettings()}
                type="button"
              >
                {busyAction === "test-llm" ? "测试中…" : "测试连通性"}
              </button>
            </div>
          </section>

          <section className="panel wecom-panel">
            <header className="panel-header compact">
              <div>
                <p className="eyebrow">WeCom</p>
                <h2>企业微信机器人</h2>
              </div>
              <StatusBadge
                configured={wecomSettings.configured}
                validation={wecomValidation}
              />
            </header>

            <div className="wecom-details">
              <div className="wecom-row">
                <span>当前 Webhook</span>
                <strong>{wecomSettings.maskedWebhookUrl ?? "尚未配置"}</strong>
              </div>
              <div className="wecom-row">
                <span>配置文件</span>
                <strong>{wecomSettings.envFilePath || "--"}</strong>
              </div>
            </div>

            <label className="field">
              <span>新的 Webhook 链接</span>
              <input
                onChange={(event) => setWecomWebhookInput(event.target.value)}
                placeholder="输入新的企业微信 Webhook 链接，保存后会覆盖当前配置"
                type="url"
                value={wecomWebhookInput}
              />
            </label>

            <ValidationHint validation={wecomValidation} />

            <div className="action-row dual-actions">
              <button
                className="primary-button"
                disabled={busyAction !== ""}
                onClick={() => void handleSaveWecomSettings()}
                type="button"
              >
                {busyAction === "save-wecom" ? "保存中…" : "保存 Webhook"}
              </button>
              <button
                className="ghost-button"
                disabled={busyAction !== ""}
                onClick={() => void handleSendWecomTest()}
                type="button"
              >
                {busyAction === "test-wecom" ? "发送中…" : "发送测试消息"}
              </button>
            </div>
          </section>

          <section className="panel schedule-panel">
            <header className="panel-header">
              <div>
                <p className="eyebrow">Schedule</p>
                <h2>发送时间</h2>
              </div>
              <SchedulePreview
                schedule={scheduleDraft}
                timezones={timezoneOptions}
              />
            </header>

            <div className="schedule-grid">
              <label className="field">
                <span>时间</span>
                <input
                  onChange={(event) =>
                    setScheduleDraft((current) =>
                      current
                        ? { ...current, dailySendTime: event.target.value }
                        : current,
                    )
                  }
                  type="time"
                  value={scheduleDraft?.dailySendTime ?? ""}
                />
              </label>

              <label className="field">
                <span>时区</span>
                <select
                  onChange={(event) =>
                    setScheduleDraft((current) =>
                      current
                        ? {
                            ...current,
                            timezone: event.target
                              .value as ScheduleSettings["timezone"],
                          }
                        : current,
                    )
                  }
                  value={scheduleDraft?.timezone ?? "Asia/Shanghai"}
                >
                  {timezoneOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="environment-inline-note">
              调度属于本地运行配置。保存表示已写入，实际生效依赖后续重启或容器重建。
            </div>

            <div className="action-row">
              <button
                className="primary-button"
                disabled={!scheduleDraft || busyAction !== ""}
                onClick={() => void handleSaveSchedule()}
                type="button"
              >
                {busyAction === "save-schedule" ? "保存中…" : "保存调度设置"}
              </button>
            </div>
          </section>
        </main>
      ) : null}

      {activeView === "preferences" ? (
        <main className="preferences-page">
          <section className="panel preferences-panel">
            <header className="panel-header">
              <div>
                <p className="eyebrow">Preferences</p>
                <h2>关心主题</h2>
              </div>
            </header>

            <div className="theme-picker">
              {availableThemes.map((theme) => {
                const active = preferencesDraft.preferredThemes.includes(theme);
                return (
                  <button
                    key={theme}
                    className={active ? "theme-chip active" : "theme-chip"}
                    onClick={() => handleToggleTheme(theme)}
                    type="button"
                  >
                    {theme}
                  </button>
                );
              })}
            </div>

            <div className="custom-topic-block">
              <div className="custom-topic-input">
                <label className="field">
                  <span>自定义主题词</span>
                  <input
                    onChange={(event) =>
                      setCustomTopicInput(event.target.value)
                    }
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        handleAddCustomTopic();
                      }
                    }}
                    placeholder="例如：Fabric, FPGA, agents runtime"
                    type="text"
                    value={customTopicInput}
                  />
                </label>
                <button
                  className="ghost-button"
                  onClick={handleAddCustomTopic}
                  type="button"
                >
                  添加
                </button>
              </div>

              <div className="custom-topic-list">
                {preferencesDraft.customTopics.map((topic) => (
                  <button
                    key={topic}
                    className="topic-tag"
                    onClick={() => handleRemoveCustomTopic(topic)}
                    type="button"
                  >
                    {topic}
                    <span>移除</span>
                  </button>
                ))}
                {preferencesDraft.customTopics.length === 0 ? (
                  <div className="empty-inline">还没有添加自定义主题词。</div>
                ) : null}
              </div>
            </div>

            <div className="action-row">
              <button
                className="primary-button"
                disabled={busyAction !== ""}
                onClick={() => void handleSavePreferences()}
                type="button"
              >
                {busyAction === "save-preferences" ? "保存中…" : "保存关心主题"}
              </button>
            </div>
          </section>
        </main>
      ) : null}

      {activeView === "saved" ? (
        <main className="saved-page">
          <section className="panel saved-panel">
            <header className="panel-header">
              <div>
                <p className="eyebrow">Collection</p>
                <h2>收藏与待看</h2>
                <p className="reader-meta-line">
                  只展示当前仍然生效的状态集合，按最新记录时间倒序排列。
                </p>
              </div>

              <div className="collection-summary">
                <MetaPill label="已收藏" value={String(savedItems.length)} />
                <MetaPill label="待会看" value={String(laterItems.length)} />
              </div>
            </header>

            <div
              className="saved-filter-tabs"
              role="tablist"
              aria-label="收藏筛选"
            >
              <button
                className={
                  savedViewFilter === "saved" ? "view-tab active" : "view-tab"
                }
                onClick={() => setSavedViewFilter("saved")}
                type="button"
              >
                已收藏
              </button>
              <button
                className={
                  savedViewFilter === "later" ? "view-tab active" : "view-tab"
                }
                onClick={() => setSavedViewFilter("later")}
                type="button"
              >
                待会看
              </button>
            </div>

            <div className="saved-list">
              {feedbackItems.map((item) => (
                <article
                  key={`${item.repo}-${item.recordedAt}`}
                  className="saved-item"
                >
                  <div className="saved-item-main">
                    <div className="saved-item-heading">
                      <span className="story-theme">
                        {item.theme ?? "未分类"}
                      </span>
                      <h3>{item.repo}</h3>
                    </div>
                    <p className="saved-item-meta">
                      来源日报 {item.date} · 记录于{" "}
                      {formatDateTime(item.recordedAt)}
                    </p>
                  </div>

                  <div className="saved-item-side">
                    <span className="saved-item-state">
                      {describeFeedbackAction(item.action)}
                    </span>
                    <div className="saved-item-actions">
                      <a
                        className="ghost-button link-button"
                        href={toRepoUrl(item.repo)}
                        rel="noreferrer"
                        target="_blank"
                      >
                        打开仓库
                      </a>
                      <button
                        className="ghost-button"
                        onClick={() =>
                          void handleOpenArchiveFromCollection(
                            item.date,
                            item.repo,
                          )
                        }
                        type="button"
                      >
                        查看归档
                      </button>
                    </div>
                  </div>
                </article>
              ))}

              {feedbackItems.length === 0 ? (
                <div className="empty-state">
                  当前还没有{savedViewFilter === "saved" ? "已收藏" : "待会看"}
                  项目。
                </div>
              ) : null}
            </div>
          </section>
        </main>
      ) : null}

      {activeView === "archives" ? (
        <main className="archive-page">
          <aside className="panel archive-index">
            <header className="panel-header compact">
              <div>
                <p className="eyebrow">Archive</p>
                <h2>归档日期</h2>
              </div>
            </header>

            <div className="archive-date-list">
              {archives.map((archive) => (
                <button
                  key={archive.date}
                  className={
                    archive.date === selectedArchiveDate
                      ? "archive-date active"
                      : "archive-date"
                  }
                  onClick={() => void handleSelectArchive(archive.date)}
                  type="button"
                >
                  <strong>{archive.date}</strong>
                  <span>{archive.digestCount} 条项目</span>
                </button>
              ))}

              {archives.length === 0 ? (
                <div className="empty-inline">当前还没有归档日报。</div>
              ) : null}
            </div>
          </aside>

          <section className="panel archive-reader">
            {archiveDetail && currentDigestItem && selectedArchiveSummary ? (
              <>
                <header className="reader-header">
                  <div>
                    <p className="eyebrow">Reader</p>
                    <h2>{archiveDetail.digest.title}</h2>
                    <p className="reader-meta-line">
                      生成于 {formatDateTime(archiveDetail.generatedAt)} ·
                      规则版本 {selectedArchiveSummary.rulesVersion}
                    </p>
                  </div>

                  <div className="reader-counter">
                    第 {currentItemIndex + 1} 篇 / 共{" "}
                    {archiveDetail.digest.items.length} 篇
                  </div>
                </header>

                <div className="reader-body">
                  <button
                    className="pager-button"
                    disabled={currentItemIndex === 0}
                    onClick={() =>
                      setCurrentItemIndex((current) => Math.max(current - 1, 0))
                    }
                    type="button"
                  >
                    上一篇
                  </button>

                  <article className="story-sheet">
                    <div className="story-heading">
                      <span className="story-theme">
                        {currentDigestItem.theme}
                      </span>
                      <h3>{currentDigestItem.repo}</h3>
                    </div>

                    <div className="feedback-actions">
                      <button
                        className={
                          currentFeedback?.action === "saved"
                            ? "feedback-button active"
                            : "feedback-button"
                        }
                        disabled={busyAction !== ""}
                        onClick={() => void handleRecordFeedback("saved")}
                        type="button"
                      >
                        收藏
                      </button>
                      <button
                        className={
                          currentFeedback?.action === "later"
                            ? "feedback-button active"
                            : "feedback-button"
                        }
                        disabled={busyAction !== ""}
                        onClick={() => void handleRecordFeedback("later")}
                        type="button"
                      >
                        稍后看
                      </button>
                      <button
                        className={
                          currentFeedback?.action === "skipped"
                            ? "feedback-button active"
                            : "feedback-button"
                        }
                        disabled={busyAction !== ""}
                        onClick={() => void handleRecordFeedback("skipped")}
                        type="button"
                      >
                        跳过
                      </button>
                      <a
                        className="ghost-button link-button inline-action-link"
                        href={currentDigestItem.url}
                        rel="noreferrer"
                        target="_blank"
                      >
                        打开仓库
                      </a>
                    </div>

                    <p className="story-lead">{currentDigestItem.summary}</p>

                    <div className="story-columns">
                      <section>
                        <h4>为什么值得看</h4>
                        <p>{currentDigestItem.whyItMatters}</p>
                      </section>
                      <section>
                        <h4>为什么是现在</h4>
                        <p>{currentDigestItem.whyNow}</p>
                      </section>
                      <section className="evidence-section">
                        <h4>证据</h4>
                        <ul>
                          {currentDigestItem.evidence.map((item) => (
                            <li key={item}>{item}</li>
                          ))}
                        </ul>
                      </section>
                    </div>
                  </article>

                  <button
                    className="pager-button"
                    disabled={
                      currentItemIndex >= archiveDetail.digest.items.length - 1
                    }
                    onClick={() =>
                      setCurrentItemIndex((current) =>
                        Math.min(
                          current + 1,
                          archiveDetail.digest.items.length - 1,
                        ),
                      )
                    }
                    type="button"
                  >
                    下一篇
                  </button>
                </div>
              </>
            ) : (
              <div className="empty-state">请选择一条归档日报开始阅读。</div>
            )}
          </section>
        </main>
      ) : null}
    </div>
  );
}

function MetaPill(props: { label: string; value: string }) {
  return (
    <div className="meta-pill">
      <span>{props.label}</span>
      <strong>{props.value}</strong>
    </div>
  );
}

function StatusBadge(props: {
  configured: boolean;
  validation: ValidationStatus;
}) {
  return (
    <div className="wecom-status">
      {buildStatusLabel(props.configured, props.validation)}
    </div>
  );
}

function ValidationHint(props: { validation: ValidationStatus }) {
  const className =
    props.validation.state === "failed"
      ? "validation-hint failed"
      : "validation-hint";

  return <div className={className}>{props.validation.detail}</div>;
}

function SchedulePreview(props: {
  schedule: ScheduleSettings | null;
  timezones: TimezoneOption[];
}) {
  const label =
    props.timezones.find((option) => option.value === props.schedule?.timezone)
      ?.label ?? "上海";

  return (
    <div className="schedule-preview">
      <strong>{props.schedule?.dailySendTime ?? "--:--"}</strong>
      <span>{label}</span>
    </div>
  );
}

function buildEnvironmentCard(
  label: string,
  configured: boolean,
  validation: ValidationStatus,
) {
  return {
    label,
    configured,
    status: buildStatusLabel(configured, validation),
    detail: validation.detail,
  };
}

function buildStatusLabel(
  configured: boolean,
  validation: ValidationStatus,
): string {
  if (!configured) {
    return "未配置";
  }

  if (validation.state === "passed") {
    return "已验证";
  }

  if (validation.state === "failed") {
    return "验证失败";
  }

  return "已配置未验证";
}

function describeTimezone(
  timezone: ScheduleSettings["timezone"],
  options: TimezoneOption[],
): string {
  return options.find((option) => option.value === timezone)?.label ?? timezone;
}

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString("zh-CN", {
    hour12: false,
  });
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function describeFeedbackAction(action: FeedbackAction): string {
  if (action === "saved") {
    return "已收藏";
  }

  if (action === "skipped") {
    return "已跳过";
  }

  return "稍后看";
}

function toRepoUrl(repo: string): string {
  return `https://github.com/${repo}`;
}
