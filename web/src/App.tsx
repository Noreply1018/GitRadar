import { useEffect, useMemo, useState } from "react";

import type { DailyDigestArchive } from "../../src/core/archive";
import type {
  ArchiveReaderContext,
  ArchiveSummary,
  EnvironmentFingerprints,
  FeedbackAction,
  FeedbackInsights,
  FeedbackListItem,
  FeedbackState,
  GitHubSettings,
  GitHubTestResult,
  LlmSettings,
  LlmTestResult,
  RuntimeSource,
  ScheduleSettings,
  TimezoneOption,
  UserPreferences,
  WecomSettings,
} from "./api";
import {
  acceptPreferenceSuggestion,
  fetchArchiveDetail,
  fetchArchives,
  fetchEnvironmentFingerprints,
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
import {
  ArchiveWorkspace,
  LibraryWorkspace,
  OverviewWorkspace,
  RuntimeWorkspace,
  type HealthState,
  type ValidationStatus,
  type WorkspaceId,
} from "./workspaces";

type SavedViewFilter = "saved" | "later";

const WORKSPACES: Array<{ id: WorkspaceId; label: string; eyebrow: string }> = [
  { id: "overview", label: "概览", eyebrow: "Overview" },
  { id: "archives", label: "归档", eyebrow: "Archive" },
  { id: "runtime", label: "运行配置", eyebrow: "Runtime" },
  { id: "library", label: "偏好与收藏", eyebrow: "Library" },
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

const EMPTY_FEEDBACK_INSIGHTS: FeedbackInsights = {
  interestedThemes: [],
  skippedThemes: [],
  preferenceSuggestion: null,
};

const EMPTY_ENVIRONMENT_FINGERPRINTS: EnvironmentFingerprints = {
  github: null,
  llm: null,
  wecom: null,
};

const EMPTY_ARCHIVE_READER_CONTEXT: ArchiveReaderContext = {
  editorialIntro: [],
  preferenceSuggestion: null,
  interestTrack: {
    interestedThemes: [],
    skippedThemes: [],
  },
  explorationRepo: null,
};

const EMPTY_WECOM_SETTINGS: WecomSettings = {
  source: "local",
  readonly: false,
  configured: false,
  maskedWebhookUrl: null,
  envFilePath: "",
};

const EMPTY_LLM_SETTINGS: LlmSettings = {
  source: "local",
  readonly: false,
  configured: false,
  maskedApiKey: null,
  baseUrl: null,
  model: null,
  envFilePath: "",
};

const EMPTY_GITHUB_SETTINGS: GitHubSettings = {
  source: "local",
  readonly: false,
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
  const [activeWorkspace, setActiveWorkspace] =
    useState<WorkspaceId>("overview");
  const [runtimeSource, setRuntimeSource] = useState<RuntimeSource>("github");
  const [health, setHealth] = useState<HealthState | null>(null);
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
  const [feedbackInsights, setFeedbackInsights] = useState<FeedbackInsights>(
    EMPTY_FEEDBACK_INSIGHTS,
  );
  const [savedItems, setSavedItems] = useState<FeedbackListItem[]>([]);
  const [laterItems, setLaterItems] = useState<FeedbackListItem[]>([]);
  const [savedViewFilter, setSavedViewFilter] =
    useState<SavedViewFilter>("saved");
  const [archives, setArchives] = useState<ArchiveSummary[]>([]);
  const [selectedArchiveDate, setSelectedArchiveDate] = useState("");
  const [archiveDetail, setArchiveDetail] = useState<DailyDigestArchive | null>(
    null,
  );
  const [archiveReaderContext, setArchiveReaderContext] =
    useState<ArchiveReaderContext>(EMPTY_ARCHIVE_READER_CONTEXT);
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
  const [environmentFingerprints, setEnvironmentFingerprints] =
    useState<EnvironmentFingerprints>(EMPTY_ENVIRONMENT_FINGERPRINTS);
  const [wecomWebhookInput, setWecomWebhookInput] = useState("");
  const [wecomValidation, setWecomValidation] =
    useState<ValidationStatus>(IDLE_VALIDATION);
  const [busyAction, setBusyAction] = useState<
    | ""
    | "hydrate"
    | "validate-environment"
    | "save-schedule"
    | "save-preferences"
    | "record-feedback"
    | "save-github"
    | "test-github"
    | "save-llm"
    | "test-llm"
    | "save-wecom"
    | "test-wecom"
    | "accept-suggestion"
  >("hydrate");
  const [statusMessage, setStatusMessage] = useState(
    "正在同步 GitRadar 当前状态…",
  );
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    void hydrate(runtimeSource);
  }, [runtimeSource]);

  useEffect(() => {
    if (activeWorkspace !== "archives" || !archiveDetail) {
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
  }, [activeWorkspace, archiveDetail]);

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
  const isGitHubMode = runtimeSource === "github";

  async function hydrate(source: RuntimeSource = runtimeSource): Promise<void> {
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
        fingerprintResponse,
      ] = await Promise.all([
        fetchHealth(source),
        fetchScheduleSettings(source),
        fetchPreferences(),
        fetchFeedback(),
        fetchArchives(source),
        fetchFeedbackItems("saved"),
        fetchFeedbackItems("later"),
        fetchGitHubSettings(source),
        fetchLlmSettings(source),
        fetchWecomSettings(source),
        fetchEnvironmentFingerprints(source),
      ]);

      setHealth(healthResponse);
      setScheduleDraft(scheduleResponse.settings);
      setTimezoneOptions(scheduleResponse.availableTimezones);
      setPreferencesDraft(preferencesResponse.preferences);
      setAvailableThemes(preferencesResponse.availableThemes);
      setFeedbackState(feedbackResponse.state);
      setFeedbackInsights(feedbackResponse.insights);
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
      setEnvironmentFingerprints(fingerprintResponse);
      setWecomWebhookInput("");
      setWecomValidation(IDLE_VALIDATION);

      const initialDate = archiveResponse.archives[0]?.date ?? "";
      setSelectedArchiveDate(initialDate);
      setCurrentItemIndex(0);

      if (initialDate) {
        const detailResponse = await fetchArchiveDetail(initialDate, source);
        setArchiveDetail(detailResponse.archive);
        setArchiveReaderContext(detailResponse.readerContext);
      } else {
        setArchiveDetail(null);
        setArchiveReaderContext(EMPTY_ARCHIVE_READER_CONTEXT);
      }

      setStatusMessage(
        source === "github"
          ? "当前查看的是 GitHub Actions 运行源。远端归档、调度和只读配置已经同步。"
          : "当前查看的是本地运行源。配置、测试和本地归档都可直接操作。",
      );
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setBusyAction("");
    }
  }

  async function refreshFeedbackCollections(): Promise<void> {
    const [savedResponse, laterResponse, feedbackResponse] = await Promise.all([
      fetchFeedbackItems("saved"),
      fetchFeedbackItems("later"),
      fetchFeedback(),
    ]);

    setSavedItems(savedResponse.items);
    setLaterItems(laterResponse.items);
    setFeedbackState(feedbackResponse.state);
    setFeedbackInsights(feedbackResponse.insights);
  }

  async function handleSaveSchedule(): Promise<void> {
    if (!scheduleDraft || isGitHubMode) {
      return;
    }

    setBusyAction("save-schedule");
    setErrorMessage("");

    try {
      const response = await saveScheduleSettings(scheduleDraft);
      setScheduleDraft(response.settings);
      setTimezoneOptions(response.availableTimezones);
      setStatusMessage("本地调度已写入配置文件，重启本地运行源后生效。");
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
      setStatusMessage("偏好与自定义主题词已保存，后续筛选会继续使用。");
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setBusyAction("");
    }
  }

  async function handleSaveGitHubSettings(): Promise<void> {
    if (isGitHubMode) {
      return;
    }

    setBusyAction("save-github");
    setErrorMessage("");

    try {
      const response = await saveGitHubSettings({
        token: githubTokenInput.trim() || undefined,
      });
      setGitHubSettings(response);
      setGitHubTokenInput("");
      setGitHubValidation(IDLE_VALIDATION);
      setStatusMessage("本地 GitHub Token 已保存，但尚未验证可用性。");
    } catch (error) {
      const message = getErrorMessage(error);
      setErrorMessage(message);
      setGitHubValidation({ state: "failed", detail: message });
    } finally {
      setBusyAction("");
    }
  }

  async function handleTestGitHubSettings(): Promise<void> {
    if (isGitHubMode) {
      return;
    }

    setBusyAction("test-github");
    setErrorMessage("");

    const validation = await runGitHubValidation();

    if (validation.state === "passed") {
      setStatusMessage(`GitHub 连通性测试通过。${validation.detail}`);
    } else {
      setErrorMessage(validation.detail);
    }

    setBusyAction("");
  }

  async function handleSaveLlmSettings(): Promise<void> {
    if (isGitHubMode) {
      return;
    }

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
      setStatusMessage("本地 LLM 配置已保存，但尚未验证连通性。");
    } catch (error) {
      const message = getErrorMessage(error);
      setLlmValidation({ state: "failed", detail: message });
      setErrorMessage(message);
    } finally {
      setBusyAction("");
    }
  }

  async function handleTestLlmSettings(): Promise<void> {
    if (isGitHubMode) {
      return;
    }

    setBusyAction("test-llm");
    setErrorMessage("");

    const validation = await runLlmValidation();

    if (validation.state === "passed") {
      setStatusMessage(`LLM 连通性测试通过。${validation.detail}`);
    } else {
      setErrorMessage(validation.detail);
    }

    setBusyAction("");
  }

  async function handleSaveWecomSettings(): Promise<void> {
    if (isGitHubMode) {
      return;
    }

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
      setStatusMessage("本地企业微信 Webhook 已保存，但尚未测试发送。");
    } catch (error) {
      const message = getErrorMessage(error);
      setWecomValidation({ state: "failed", detail: message });
      setErrorMessage(message);
    } finally {
      setBusyAction("");
    }
  }

  async function handleSendWecomTest(): Promise<void> {
    if (isGitHubMode) {
      return;
    }

    setBusyAction("test-wecom");
    setErrorMessage("");

    const validation = await runWecomValidation();

    if (validation.state === "passed") {
      setStatusMessage(`企业微信测试消息发送成功。${validation.detail}`);
    } else {
      setErrorMessage(validation.detail);
    }

    setBusyAction("");
  }

  async function handleValidateEnvironment(): Promise<void> {
    if (isGitHubMode) {
      setStatusMessage(
        "GitHub 运行源只展示远端结果与 workflow 配置，不提供本地写入与即时测试。",
      );
      return;
    }

    setBusyAction("validate-environment");
    setErrorMessage("");

    try {
      const results = [
        { label: "GitHub", validation: await runGitHubValidation() },
        { label: "LLM", validation: await runLlmValidation() },
        { label: "企业微信", validation: await runWecomValidation() },
        {
          label: "调度",
          validation: validateScheduleConfiguration(
            scheduleDraft,
            timezoneOptions,
          ),
        },
      ];

      const failedResults = results.filter(
        (result) => result.validation.state === "failed",
      );
      const passedResults = results.filter(
        (result) => result.validation.state === "passed",
      );

      if (failedResults.length > 0) {
        setErrorMessage(
          failedResults
            .map((result) => `${result.label}：${result.validation.detail}`)
            .join("；"),
        );
        setStatusMessage(
          `环境验证完成：${passedResults.length} 项通过，${failedResults.length} 项需要处理。`,
        );
        return;
      }

      setStatusMessage("环境验证完成：GitHub、LLM、企业微信与调度均通过。");
    } finally {
      setBusyAction("");
    }
  }

  async function runGitHubValidation(): Promise<ValidationStatus> {
    try {
      const response: GitHubTestResult = await testGitHubSettings();
      setEnvironmentFingerprints(await fetchEnvironmentFingerprints("local"));
      const validation = {
        state: "passed" as const,
        detail: `账号 ${response.login} · ${response.apiBaseUrl}`,
      };
      setGitHubValidation(validation);
      return validation;
    } catch (error) {
      const validation = {
        state: "failed" as const,
        detail: getErrorMessage(error),
      };
      setGitHubValidation(validation);
      return validation;
    }
  }

  async function runLlmValidation(): Promise<ValidationStatus> {
    try {
      const response: LlmTestResult = await testLlmSettings();
      setEnvironmentFingerprints(await fetchEnvironmentFingerprints("local"));
      const validation = {
        state: "passed" as const,
        detail: `${response.model} · ${response.baseUrl}`,
      };
      setLlmValidation(validation);
      setLlmSettings((current) => ({
        ...current,
        configured: true,
        baseUrl: response.baseUrl,
        model: response.model,
      }));
      return validation;
    } catch (error) {
      const validation = {
        state: "failed" as const,
        detail: getErrorMessage(error),
      };
      setLlmValidation(validation);
      return validation;
    }
  }

  async function runWecomValidation(): Promise<ValidationStatus> {
    try {
      const response = await sendWecomTest();
      setEnvironmentFingerprints(await fetchEnvironmentFingerprints("local"));
      const validation = {
        state: "passed" as const,
        detail: `目标 ${response.maskedWebhookUrl}`,
      };
      setWecomValidation(validation);
      setWecomSettings((current) => ({
        ...current,
        configured: true,
        maskedWebhookUrl: response.maskedWebhookUrl,
      }));
      return validation;
    } catch (error) {
      const validation = {
        state: "failed" as const,
        detail: getErrorMessage(error),
      };
      setWecomValidation(validation);
      return validation;
    }
  }

  async function handleSelectArchive(date: string): Promise<void> {
    setSelectedArchiveDate(date);
    setCurrentItemIndex(0);
    setErrorMessage("");

    try {
      const detailResponse = await fetchArchiveDetail(date, runtimeSource);
      setArchiveDetail(detailResponse.archive);
      setArchiveReaderContext(detailResponse.readerContext);
      setStatusMessage(`已切换到 ${date} 的归档。`);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    }
  }

  async function handleOpenArchiveFromCollection(
    date: string,
    repo: string,
  ): Promise<void> {
    setActiveWorkspace("archives");
    setSelectedArchiveDate(date);
    setCurrentItemIndex(0);
    setErrorMessage("");

    try {
      const detailResponse = await fetchArchiveDetail(date, runtimeSource);
      const matchedIndex = detailResponse.archive.digest.items.findIndex(
        (item) => item.repo === repo,
      );

      setArchiveDetail(detailResponse.archive);
      setArchiveReaderContext(detailResponse.readerContext);

      if (matchedIndex >= 0) {
        setCurrentItemIndex(matchedIndex);
        setStatusMessage(`已打开 ${date} 的归档，并定位到 ${repo}。`);
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
      setStatusMessage("这条归档反馈已记录，偏好与收藏区已同步更新。");
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setBusyAction("");
    }
  }

  async function handleAcceptPreferenceSuggestion(
    theme: string,
  ): Promise<void> {
    setBusyAction("accept-suggestion");
    setErrorMessage("");

    try {
      const response = await acceptPreferenceSuggestion(theme);
      setPreferencesDraft(response.preferences);
      setAvailableThemes(response.availableThemes);
      setFeedbackInsights(response.insights);
      setArchiveReaderContext((current) => ({
        ...current,
        preferenceSuggestion: response.insights.preferenceSuggestion,
        interestTrack: {
          interestedThemes: response.insights.interestedThemes,
          skippedThemes: response.insights.skippedThemes,
        },
      }));
      setStatusMessage(`已把 ${theme} 加入关心主题。`);
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
    <div className="console-shell">
      <div className="console-halo" aria-hidden="true" />

      <header className="hero-band">
        <div className="hero-copy">
          <p className="hero-kicker">Open Source Daily Editing Desk</p>
          <h1>GitRadar</h1>
          <p className="hero-summary">
            把运行源、归档阅读、配置链路和个人偏好放回各自的位置。
          </p>
          <p className="hero-note">
            {health?.note ??
              "先确定当前运行源，再进入归档、运行配置或个人偏好工作区。"}
          </p>
        </div>

        <div className="hero-controls">
          <div className="source-switch" role="tablist" aria-label="运行源">
            <button
              className={
                runtimeSource === "github"
                  ? "source-chip active"
                  : "source-chip"
              }
              disabled={busyAction === "hydrate"}
              onClick={() => setRuntimeSource("github")}
              type="button"
            >
              GitHub 运行源
            </button>
            <button
              className={
                runtimeSource === "local" ? "source-chip active" : "source-chip"
              }
              disabled={busyAction === "hydrate"}
              onClick={() => setRuntimeSource("local")}
              type="button"
            >
              Local 运行源
            </button>
          </div>

          <button
            className="refresh-button"
            disabled={busyAction === "hydrate"}
            onClick={() => void hydrate(runtimeSource)}
            type="button"
          >
            {busyAction === "hydrate" ? "同步中…" : "刷新当前运行源"}
          </button>
        </div>
      </header>

      <div className="console-grid">
        <aside className="side-rail">
          <div className="rail-block">
            <p className="rail-label">Workspace</p>
            <nav className="workspace-nav" aria-label="工作区">
              {WORKSPACES.map((workspace) => (
                <button
                  key={workspace.id}
                  className={
                    workspace.id === activeWorkspace
                      ? "workspace-link active"
                      : "workspace-link"
                  }
                  onClick={() => setActiveWorkspace(workspace.id)}
                  type="button"
                >
                  <span>{workspace.eyebrow}</span>
                  <strong>{workspace.label}</strong>
                </button>
              ))}
            </nav>
          </div>

          <div className="rail-block">
            <p className="rail-label">Status</p>
            <div className="status-stack">
              <div className="status-chip">
                <span>运行源</span>
                <strong>
                  {runtimeSource === "github" ? "GitHub" : "Local"}
                </strong>
              </div>
              <div className="status-chip">
                <span>服务状态</span>
                <strong>{health?.status ?? "loading"}</strong>
              </div>
              <div className="status-chip">
                <span>版本</span>
                <strong>{health ? `v${health.version}` : "loading"}</strong>
              </div>
              <div className="status-chip">
                <span>归档数</span>
                <strong>
                  {busyAction === "hydrate" ? "..." : archives.length}
                </strong>
              </div>
            </div>
          </div>

          <div className="rail-block rail-message">
            <p className="rail-label">Session</p>
            <strong>{statusMessage}</strong>
            <span>
              {isGitHubMode
                ? "当前是远端只读视角，重点看 workflow 与归档是否真正落库。"
                : "当前是本地可操作视角，配置写入和连通性验证都在这里完成。"}
            </span>
          </div>
        </aside>

        <main className="workspace-stage">
          {activeWorkspace === "overview" ? (
            <OverviewWorkspace
              archives={archives}
              environmentFingerprints={environmentFingerprints}
              githubSettings={githubSettings}
              health={health}
              llmSettings={llmSettings}
              onJumpToWorkspace={setActiveWorkspace}
              runtimeSource={runtimeSource}
              scheduleDraft={scheduleDraft}
              timezoneOptions={timezoneOptions}
              wecomSettings={wecomSettings}
            />
          ) : null}

          {activeWorkspace === "runtime" ? (
            <RuntimeWorkspace
              busyAction={busyAction}
              environmentFingerprints={environmentFingerprints}
              githubSettings={githubSettings}
              githubTokenInput={githubTokenInput}
              githubValidation={githubValidation}
              isGitHubMode={isGitHubMode}
              llmApiKeyInput={llmApiKeyInput}
              llmBaseUrlInput={llmBaseUrlInput}
              llmModelInput={llmModelInput}
              llmSettings={llmSettings}
              llmValidation={llmValidation}
              onChangeGitHubToken={setGitHubTokenInput}
              onChangeLlmApiKey={setLlmApiKeyInput}
              onChangeLlmBaseUrl={setLlmBaseUrlInput}
              onChangeLlmModel={setLlmModelInput}
              onChangeSchedule={setScheduleDraft}
              onChangeWecomWebhook={setWecomWebhookInput}
              onSaveGitHub={handleSaveGitHubSettings}
              onSaveLlm={handleSaveLlmSettings}
              onSaveSchedule={handleSaveSchedule}
              onSaveWecom={handleSaveWecomSettings}
              onTestAll={handleValidateEnvironment}
              onTestGitHub={handleTestGitHubSettings}
              onTestLlm={handleTestLlmSettings}
              onTestWecom={handleSendWecomTest}
              runtimeSource={runtimeSource}
              scheduleDraft={scheduleDraft}
              timezoneOptions={timezoneOptions}
              wecomSettings={wecomSettings}
              wecomValidation={wecomValidation}
              wecomWebhookInput={wecomWebhookInput}
            />
          ) : null}

          {activeWorkspace === "library" ? (
            <LibraryWorkspace
              availableThemes={availableThemes}
              busyAction={busyAction}
              customTopicInput={customTopicInput}
              feedbackInsights={feedbackInsights}
              laterItems={laterItems}
              onAddCustomTopic={handleAddCustomTopic}
              onChangeCustomTopicInput={setCustomTopicInput}
              onOpenArchive={handleOpenArchiveFromCollection}
              onRemoveCustomTopic={handleRemoveCustomTopic}
              onSavePreferences={handleSavePreferences}
              onToggleTheme={handleToggleTheme}
              preferencesDraft={preferencesDraft}
              runtimeSource={runtimeSource}
              savedItems={savedItems}
              savedViewFilter={savedViewFilter}
              setSavedViewFilter={setSavedViewFilter}
            />
          ) : null}

          {activeWorkspace === "archives" ? (
            <ArchiveWorkspace
              archiveDetail={archiveDetail}
              archiveReaderContext={archiveReaderContext}
              archives={archives}
              busyAction={busyAction}
              currentDigestItem={currentDigestItem}
              currentFeedback={currentFeedback}
              currentItemIndex={currentItemIndex}
              onAcceptPreferenceSuggestion={handleAcceptPreferenceSuggestion}
              onNextItem={() =>
                setCurrentItemIndex((current) =>
                  archiveDetail
                    ? Math.min(
                        current + 1,
                        archiveDetail.digest.items.length - 1,
                      )
                    : current,
                )
              }
              onPreviousItem={() =>
                setCurrentItemIndex((current) => Math.max(current - 1, 0))
              }
              onRecordFeedback={handleRecordFeedback}
              onSelectArchive={handleSelectArchive}
              runtimeSource={runtimeSource}
              selectedArchiveDate={selectedArchiveDate}
              selectedArchiveSummary={selectedArchiveSummary}
            />
          ) : null}
        </main>
      </div>

      {errorMessage ? (
        <div className="error-strip">
          <strong>当前错误</strong>
          <span>{errorMessage}</span>
        </div>
      ) : null}
    </div>
  );
}

function validateScheduleConfiguration(
  schedule: ScheduleSettings | null,
  options: TimezoneOption[],
): ValidationStatus {
  if (!schedule?.dailySendTime || !schedule.timezone) {
    return {
      state: "failed",
      detail: "尚未配置发送时间或时区",
    };
  }

  return {
    state: "passed",
    detail: `${schedule.dailySendTime} · ${describeTimezone(
      schedule.timezone,
      options,
    )}`,
  };
}

function describeTimezone(
  timezone: ScheduleSettings["timezone"],
  options: TimezoneOption[],
): string {
  return options.find((option) => option.value === timezone)?.label ?? timezone;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
