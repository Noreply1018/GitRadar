import { useEffect, useMemo, useState } from "react";

import type { DailyDigestArchive } from "../../src/core/archive";
import type {
  ArchiveReaderContext,
  ArchiveSummary,
  EnvironmentFingerprints,
  FeedbackAction,
  FeedbackEvent,
  FeedbackInsights,
  FeedbackListItem,
  FeedbackState,
  GitHubSettings,
  LlmSettings,
  RemoteSyncMetadata,
  ScheduleSettings,
  TimezoneOption,
  UserPreferences,
  WecomSettings,
} from "./api";
import {
  acceptPreferenceSuggestion,
  clearGitHubPat,
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
  getGitHubAuthSession,
  getGitHubRepoContext,
  recordFeedback,
  saveGitHubPat,
  savePreferences,
  saveScheduleSettings,
  validateGitHubPat,
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

const EMPTY_GITHUB_SETTINGS: GitHubSettings = {
  source: "github",
  readonly: true,
  configured: false,
  maskedToken: null,
  apiBaseUrl: "https://api.github.com",
  trendingUrl: "https://github.com/trending?since=daily",
  managedIn: ".github/workflows/console-writeback.yml",
  execution: {
    status: "unknown",
    lastRunAt: null,
    runUrl: null,
  },
  environment: {
    status: "unknown",
    checkedAt: null,
    detail: "GitHub 环境尚未诊断。",
    login: null,
  },
};

const EMPTY_LLM_SETTINGS: LlmSettings = {
  source: "github",
  readonly: true,
  configured: false,
  maskedApiKey: null,
  baseUrl: null,
  model: null,
  managedIn: ".github/workflows/environment-diagnose.yml",
  execution: {
    status: "unknown",
    lastRunAt: null,
    runUrl: null,
  },
  environment: {
    status: "unknown",
    checkedAt: null,
    detail: "LLM 环境尚未诊断。",
    model: null,
    baseUrl: null,
  },
};

const EMPTY_WECOM_SETTINGS: WecomSettings = {
  source: "github",
  readonly: true,
  configured: false,
  maskedWebhookUrl: null,
  managedIn: ".github/workflows/environment-diagnose.yml",
  execution: {
    status: "unknown",
    lastRunAt: null,
    runUrl: null,
  },
  environment: {
    status: "unknown",
    checkedAt: null,
    detail: "企业微信环境尚未诊断。",
    maskedWebhookUrl: null,
  },
};

const IDLE_VALIDATION: ValidationStatus = {
  state: "idle",
  detail: "尚未验证当前浏览器里的 PAT。",
};

export default function App() {
  const repoContext = getGitHubRepoContext();
  const [activeView, setActiveView] = useState<ViewId>("environment");
  const [health, setHealth] = useState<{
    status: string;
    app: string;
    version: string;
    source: "github";
    note?: string;
    lastRunAt?: string | null;
    lastRunStatus?: "success" | "failure" | "unknown";
    lastArchiveDate?: string | null;
    runUrl?: string | null;
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
  const [llmSettings, setLlmSettings] =
    useState<LlmSettings>(EMPTY_LLM_SETTINGS);
  const [wecomSettings, setWecomSettings] =
    useState<WecomSettings>(EMPTY_WECOM_SETTINGS);
  const [environmentFingerprints, setEnvironmentFingerprints] =
    useState<EnvironmentFingerprints>(EMPTY_ENVIRONMENT_FINGERPRINTS);
  const [githubValidation, setGitHubValidation] =
    useState<ValidationStatus>(IDLE_VALIDATION);
  const [patInput, setPatInput] = useState("");
  const [githubLogin, setGitHubLogin] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<
    | ""
    | "hydrate"
    | "auth"
    | "save-schedule"
    | "save-preferences"
    | "record-feedback"
    | "accept-suggestion"
  >("hydrate");
  const [statusMessage, setStatusMessage] = useState(
    "正在同步 GitHub 正式归档、状态与配置…",
  );
  const [errorMessage, setErrorMessage] = useState("");

  const hasPat = Boolean(getGitHubAuthSession().token);
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

  useEffect(() => {
    void hydrate();
  }, []);

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
        fingerprintResponse,
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
        fetchEnvironmentFingerprints(),
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
      setLlmSettings(llmResponse);
      setWecomSettings(wecomResponse);
      setEnvironmentFingerprints(fingerprintResponse);

      const date = archiveResponse.archives[0]?.date ?? "";
      setSelectedArchiveDate(date);
      if (date) {
        const detailResponse = await fetchArchiveDetail(date);
        setArchiveDetail(detailResponse.archive);
        setArchiveReaderContext(detailResponse.readerContext);
      } else {
        setArchiveDetail(null);
        setArchiveReaderContext(EMPTY_ARCHIVE_READER_CONTEXT);
      }

      setStatusMessage(
        "已同步 GitHub 正式状态。写操作会通过 GitHub Actions 自动创建 PR。",
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

  async function handleSavePat(): Promise<void> {
    setBusyAction("auth");
    setErrorMessage("");

    try {
      saveGitHubPat(patInput);
      const result = await validateGitHubPat();
      setGitHubLogin(result.login);
      setGitHubValidation({
        state: "passed",
        detail: `PAT 已校验，当前账号 ${result.login}`,
      });
      setPatInput("");
      setStatusMessage(
        `已在浏览器本地保存 PAT，并验证账号 ${result.login}。正式写入将触发 ${repoContext.actionsBaseUrl}。`,
      );
    } catch (error) {
      clearGitHubPat();
      setGitHubLogin(null);
      setGitHubValidation({
        state: "failed",
        detail: getErrorMessage(error),
      });
      setErrorMessage(getErrorMessage(error));
    } finally {
      setBusyAction("");
    }
  }

  async function handleValidatePat(): Promise<void> {
    setBusyAction("auth");
    setErrorMessage("");

    try {
      const result = await validateGitHubPat();
      setGitHubLogin(result.login);
      setGitHubValidation({
        state: "passed",
        detail: `PAT 已校验，当前账号 ${result.login}`,
      });
      setStatusMessage(
        `当前 PAT 仍然可用，之后的保存会触发 workflow dispatch。`,
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

  function handleClearPat(): void {
    clearGitHubPat();
    setPatInput("");
    setGitHubLogin(null);
    setGitHubValidation(IDLE_VALIDATION);
    setStatusMessage(
      "已清除浏览器本地 PAT。现在仍可读取公开正式数据，但不能提交写入请求。",
    );
  }

  async function handleSaveSchedule(): Promise<void> {
    if (!scheduleDraft) {
      return;
    }

    setBusyAction("save-schedule");
    setErrorMessage("");

    try {
      const response = await saveScheduleSettings(scheduleDraft);
      setStatusMessage(
        `调度改动已提交为正式写入请求。${describeRepoSync(response, "请在自动创建的 PR 合并后让正式调度生效。")}`,
      );
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
      setStatusMessage(
        `偏好改动已提交为正式写入请求。${describeRepoSync(response, "请在 PR 合并后让正式偏好生效。")}`,
      );
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setBusyAction("");
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
      setFeedbackState((current) =>
        applyOptimisticFeedback(current, response.event),
      );
      setStatusMessage(
        `反馈已提交为正式写入请求。${describeRepoSync(response, "合并前，当前界面仅显示本地预览，不代表正式反馈已生效。")}`,
      );
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
      setStatusMessage(
        `偏好学习建议已提交为正式写入请求。${describeRepoSync(response, "合并 PR 后，GitRadar 才会正式按新偏好加权。")}`,
      );
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setBusyAction("");
    }
  }

  async function handleSelectArchive(date: string): Promise<void> {
    setErrorMessage("");
    setSelectedArchiveDate(date);
    setCurrentItemIndex(0);

    try {
      const detailResponse = await fetchArchiveDetail(date);
      setArchiveDetail(detailResponse.archive);
      setArchiveReaderContext(detailResponse.readerContext);
      setStatusMessage(`已切换到 ${date} 的正式归档。`);
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
      setArchiveDetail(detailResponse.archive);
      setArchiveReaderContext(detailResponse.readerContext);
      const matchedIndex = detailResponse.archive.digest.items.findIndex(
        (item) => item.repo === repo,
      );
      setCurrentItemIndex(matchedIndex >= 0 ? matchedIndex : 0);
      setStatusMessage(`已打开 ${date} 的正式归档。`);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
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

    setPreferencesDraft((current) => ({
      ...current,
      customTopics: current.customTopics.includes(topic)
        ? current.customTopics
        : [...current.customTopics, topic],
    }));
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
          <p className="eyebrow">GitHub Native Console</p>
          <h1>GitRadar</h1>
          <p className="masthead-subtitle">
            Pages 读取正式归档，PAT 触发 Actions，Actions 自动创建 PR
          </p>
        </div>

        <div className="masthead-meta">
          <MetaPill label="服务状态" value={health?.status ?? "loading"} />
          <MetaPill label="运行源" value="GitHub Pages" />
          <MetaPill
            label="版本"
            value={health ? `v${health.version}` : "loading"}
          />
          <MetaPill label="归档数" value={String(archives.length)} />
        </div>
      </header>

      <section className="toolbar">
        <nav className="view-tabs" aria-label="页面视图">
          {VIEWS.map((view) => (
            <button
              key={view.id}
              className={
                activeView === view.id ? "view-tab active" : "view-tab"
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
          disabled={busyAction !== ""}
          onClick={() => void hydrate()}
          type="button"
        >
          {busyAction === "hydrate" ? "同步中…" : "刷新"}
        </button>
      </section>

      <section className="feedback-bar">
        <div className="feedback-main">
          <strong>{statusMessage}</strong>
          <span>
            这里明确区分“已提交写入请求”和“已正式生效”。只有 PR
            合并后，正式配置和反馈才算真正落仓库。
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
                <h2>正式环境摘要</h2>
              </div>
            </header>

            <div className="environment-card-grid">
              {buildEnvironmentCards(
                githubSettings,
                llmSettings,
                wecomSettings,
                environmentFingerprints,
                scheduleDraft,
                timezoneOptions,
              ).map((card) => (
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
                <h2>PAT 与工作流写入</h2>
              </div>
              <StatusBadge
                configured={githubSettings.configured}
                validation={githubValidation}
              />
            </header>

            <div className="wecom-details">
              <Row
                label="正式仓库"
                value={`${repoContext.owner}/${repoContext.repo}`}
              />
              <Row label="默认分支" value={repoContext.branch} />
              <Row label="Actions 入口" value={githubSettings.managedIn} />
              <Row
                label="当前 PAT"
                value={hasPat ? "已保存在浏览器本地" : "尚未提供"}
              />
              <Row
                label="当前账号"
                value={
                  githubLogin ?? githubSettings.environment.login ?? "尚未验证"
                }
              />
              <Row
                label="最近诊断"
                value={
                  githubSettings.environment.checkedAt
                    ? formatDateTime(githubSettings.environment.checkedAt)
                    : "尚未诊断"
                }
              />
            </div>

            <ValidationHint validation={githubValidation} />
            <div className="environment-inline-note">{githubSettings.note}</div>

            <div className="custom-topic-input auth-inline">
              <label className="field">
                <span>细粒度 GitHub PAT</span>
                <input
                  onChange={(event) => setPatInput(event.target.value)}
                  placeholder="仅保存在本地浏览器，不写回仓库"
                  type="password"
                  value={patInput}
                />
              </label>
              <button
                className="primary-button"
                disabled={!patInput.trim() || busyAction !== ""}
                onClick={() => void handleSavePat()}
                type="button"
              >
                {busyAction === "auth" ? "验证中…" : "保存并验证"}
              </button>
            </div>

            <div className="action-row dual-actions">
              <button
                className="primary-button"
                disabled={!hasPat || busyAction !== ""}
                onClick={() => void handleValidatePat()}
                type="button"
              >
                验证当前 PAT
              </button>
              <button
                className="ghost-button"
                disabled={!hasPat || busyAction !== ""}
                onClick={handleClearPat}
                type="button"
              >
                清除本地 PAT
              </button>
              <a
                className="ghost-button link-button"
                href={repoContext.actionsBaseUrl}
                rel="noreferrer"
                target="_blank"
              >
                打开 Actions 工作流
              </a>
            </div>
          </section>

          <section className="panel llm-panel">
            <header className="panel-header compact">
              <div>
                <p className="eyebrow">LLM</p>
                <h2>模型环境</h2>
              </div>
              <StatusBadge
                configured={llmSettings.configured}
                validation={IDLE_VALIDATION}
              />
            </header>

            <div className="wecom-details">
              <Row
                label="模型"
                value={llmSettings.environment.model ?? "尚未诊断"}
              />
              <Row
                label="Base URL"
                value={llmSettings.environment.baseUrl ?? "尚未诊断"}
              />
              <Row
                label="最近诊断"
                value={
                  llmSettings.environment.checkedAt
                    ? formatDateTime(llmSettings.environment.checkedAt)
                    : "尚未诊断"
                }
              />
            </div>

            <div className="environment-inline-note">{llmSettings.note}</div>
          </section>

          <section className="panel wecom-panel">
            <header className="panel-header compact">
              <div>
                <p className="eyebrow">WeCom</p>
                <h2>企业微信环境</h2>
              </div>
              <StatusBadge
                configured={wecomSettings.configured}
                validation={IDLE_VALIDATION}
              />
            </header>

            <div className="wecom-details">
              <Row
                label="Webhook"
                value={wecomSettings.environment.maskedWebhookUrl ?? "尚未诊断"}
              />
              <Row
                label="最近诊断"
                value={
                  wecomSettings.environment.checkedAt
                    ? formatDateTime(wecomSettings.environment.checkedAt)
                    : "尚未诊断"
                }
              />
            </div>

            <div className="environment-inline-note">{wecomSettings.note}</div>
          </section>

          <section className="panel schedule-panel">
            <header className="panel-header">
              <div>
                <p className="eyebrow">Schedule</p>
                <h2>发送调度</h2>
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
              保存不会直接改默认分支，而是触发 Actions 创建 PR。
            </div>

            <div className="action-row">
              <button
                className="primary-button"
                disabled={!scheduleDraft || !hasPat || busyAction !== ""}
                onClick={() => void handleSaveSchedule()}
                type="button"
              >
                {busyAction === "save-schedule" ? "提交中…" : "提交调度变更"}
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
              {availableThemes.map((theme) => (
                <button
                  key={theme}
                  className={
                    preferencesDraft.preferredThemes.includes(theme)
                      ? "theme-chip active"
                      : "theme-chip"
                  }
                  onClick={() => handleToggleTheme(theme)}
                  type="button"
                >
                  {theme}
                </button>
              ))}
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
              </div>
            </div>

            <div className="action-row">
              <button
                className="primary-button"
                disabled={!hasPat || busyAction !== ""}
                onClick={() => void handleSavePreferences()}
                type="button"
              >
                {busyAction === "save-preferences" ? "提交中…" : "提交偏好变更"}
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
                  默认展示正式反馈聚合结果；刚刚提交但尚未合并 PR
                  的反馈不会在这里立即成为正式状态。
                </p>
              </div>
            </header>

            <div className="insight-grid">
              <InsightCard
                title="最近真正感兴趣的主题"
                items={feedbackInsights.interestedThemes}
                emptyText="还没形成明显兴趣轨迹。"
              />
              <InsightCard
                title="最近被连续跳过的主题"
                items={feedbackInsights.skippedThemes}
                emptyText="目前还没有明显被连续跳过的主题。"
              />
            </div>

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

                <section className="editorial-intro">
                  <div className="editorial-intro-copy">
                    <p className="eyebrow">Editorial Intro</p>
                    <h3>今天为什么是这几条</h3>
                    {archiveReaderContext.editorialIntro.map((line) => (
                      <p key={line}>{line}</p>
                    ))}
                  </div>

                  {archiveReaderContext.preferenceSuggestion ? (
                    <div className="preference-suggestion">
                      <span className="story-theme">
                        {archiveReaderContext.preferenceSuggestion.theme}
                      </span>
                      <strong>偏好学习提示</strong>
                      <p>{archiveReaderContext.preferenceSuggestion.reason}</p>
                      <button
                        className="primary-button"
                        disabled={!hasPat || busyAction !== ""}
                        onClick={() =>
                          void handleAcceptPreferenceSuggestion(
                            archiveReaderContext.preferenceSuggestion!.theme,
                          )
                        }
                        type="button"
                      >
                        {busyAction === "accept-suggestion"
                          ? "提交中…"
                          : "提交关心主题变更"}
                      </button>
                    </div>
                  ) : null}
                </section>

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
                      {(["saved", "later", "skipped"] as FeedbackAction[]).map(
                        (action) => (
                          <button
                            key={action}
                            className={
                              currentFeedback?.action === action
                                ? "feedback-button active"
                                : "feedback-button"
                            }
                            disabled={!hasPat || busyAction !== ""}
                            onClick={() => void handleRecordFeedback(action)}
                            type="button"
                          >
                            {describeFeedbackAction(action)}
                          </button>
                        ),
                      )}
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

function Row(props: { label: string; value: string }) {
  return (
    <div className="wecom-row">
      <span>{props.label}</span>
      <strong>{props.value}</strong>
    </div>
  );
}

function InsightCard(props: {
  title: string;
  items: Array<{ theme: string; reason: string }>;
  emptyText: string;
}) {
  return (
    <section className="insight-card">
      <h3>{props.title}</h3>
      {props.items.length > 0 ? (
        <div className="insight-list">
          {props.items.map((item) => (
            <article key={item.theme} className="insight-item">
              <strong>{item.theme}</strong>
              <p>{item.reason}</p>
            </article>
          ))}
        </div>
      ) : (
        <div className="empty-inline">{props.emptyText}</div>
      )}
    </section>
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

function buildStatusLabel(
  configured: boolean,
  validation: ValidationStatus,
): string {
  if (validation.state === "failed") {
    return "验证失败";
  }
  if (validation.state === "passed") {
    return "PAT 已验证";
  }
  return configured ? "已配置" : "未配置";
}

function buildEnvironmentCards(
  githubSettings: GitHubSettings,
  llmSettings: LlmSettings,
  wecomSettings: WecomSettings,
  fingerprints: EnvironmentFingerprints,
  schedule: ScheduleSettings | null,
  timezones: TimezoneOption[],
) {
  return [
    {
      label: "GitHub",
      status: githubSettings.environment.status,
      detail: fingerprints.github?.login ?? githubSettings.environment.detail,
    },
    {
      label: "LLM",
      status: llmSettings.environment.status,
      detail: fingerprints.llm
        ? `${fingerprints.llm.model} · ${fingerprints.llm.baseUrl}`
        : llmSettings.environment.detail,
    },
    {
      label: "企业微信",
      status: wecomSettings.environment.status,
      detail:
        fingerprints.wecom?.maskedWebhookUrl ??
        wecomSettings.environment.detail,
    },
    {
      label: "调度",
      status: schedule ? "configured" : "missing",
      detail: schedule
        ? `${schedule.dailySendTime} · ${
            timezones.find((option) => option.value === schedule.timezone)
              ?.label ?? schedule.timezone
          }`
        : "尚未读取到正式调度配置。",
    },
  ];
}

function applyOptimisticFeedback(
  state: FeedbackState,
  event: FeedbackEvent,
): FeedbackState {
  return {
    ...state,
    repoStates: {
      ...state.repoStates,
      [event.repo]: {
        repo: event.repo,
        date: event.date,
        action: event.action,
        theme: event.theme,
        recordedAt: event.recordedAt,
      },
    },
    recent: [event, ...state.recent].slice(0, 12),
  };
}

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString("zh-CN", { hour12: false });
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function describeRepoSync(sync: RemoteSyncMetadata, fallback: string): string {
  return `已提交 request ${sync.requestId} 到 ${sync.branch}，工作流入口：${sync.workflowUrl}。${fallback}`;
}

function describeFeedbackAction(action: FeedbackAction): string {
  if (action === "saved") {
    return "收藏";
  }
  if (action === "later") {
    return "稍后看";
  }
  return "跳过";
}

function toRepoUrl(repo: string): string {
  return `https://github.com/${repo}`;
}
