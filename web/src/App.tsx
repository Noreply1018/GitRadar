import { useEffect, useMemo, useState } from "react";

import type { DailyDigestArchive } from "../../src/core/archive";
import type {
  ArchiveSummary,
  ScheduleSettings,
  TimezoneOption,
  UserPreferences,
} from "./api";
import {
  fetchArchiveDetail,
  fetchArchives,
  fetchHealth,
  fetchPreferences,
  fetchScheduleSettings,
  savePreferences,
  saveScheduleSettings,
} from "./api";

type ViewId = "schedule" | "archives";

const VIEWS: Array<{ id: ViewId; label: string }> = [
  { id: "schedule", label: "调度与主题" },
  { id: "archives", label: "归档日报" },
];

const EMPTY_PREFERENCES: UserPreferences = {
  preferredThemes: [],
  customTopics: [],
};

export default function App() {
  const [activeView, setActiveView] = useState<ViewId>("schedule");
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
  const [archives, setArchives] = useState<ArchiveSummary[]>([]);
  const [selectedArchiveDate, setSelectedArchiveDate] = useState("");
  const [archiveDetail, setArchiveDetail] = useState<DailyDigestArchive | null>(
    null,
  );
  const [currentItemIndex, setCurrentItemIndex] = useState(0);
  const [busyAction, setBusyAction] = useState<
    "" | "hydrate" | "save-schedule" | "save-preferences"
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

  async function hydrate(): Promise<void> {
    setBusyAction("hydrate");
    setErrorMessage("");

    try {
      const [
        healthResponse,
        scheduleResponse,
        preferencesResponse,
        archiveResponse,
      ] = await Promise.all([
        fetchHealth(),
        fetchScheduleSettings(),
        fetchPreferences(),
        fetchArchives(),
      ]);

      setHealth(healthResponse);
      setScheduleDraft(scheduleResponse.settings);
      setTimezoneOptions(scheduleResponse.availableTimezones);
      setPreferencesDraft(preferencesResponse.preferences);
      setAvailableThemes(preferencesResponse.availableThemes);
      setArchives(archiveResponse.archives);

      const initialDate = archiveResponse.archives[0]?.date ?? "";
      setSelectedArchiveDate(initialDate);
      setCurrentItemIndex(0);

      if (initialDate) {
        const detailResponse = await fetchArchiveDetail(initialDate);
        setArchiveDetail(detailResponse.archive);
      } else {
        setArchiveDetail(null);
      }

      setStatusMessage("GitRadar 已同步到当前配置与归档状态。");
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setBusyAction("");
    }
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
      setStatusMessage("发送时间已更新，重启 GitRadar 后生效。");
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
          <span>保存设置后重新启动 GitRadar，即可让新的调度配置生效。</span>
        </div>

        {errorMessage ? (
          <div className="feedback-error">
            <strong>错误</strong>
            <span>{errorMessage}</span>
          </div>
        ) : null}
      </section>

      {activeView === "schedule" ? (
        <main className="schedule-page">
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
                  type="time"
                  value={scheduleDraft?.dailySendTime ?? ""}
                  onChange={(event) =>
                    setScheduleDraft((current) =>
                      current
                        ? { ...current, dailySendTime: event.target.value }
                        : current,
                    )
                  }
                />
              </label>

              <label className="field">
                <span>时区</span>
                <select
                  value={scheduleDraft?.timezone ?? "Asia/Shanghai"}
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
                >
                  {timezoneOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
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
                    type="text"
                    placeholder="例如：Fabric, FPGA, agents runtime"
                    value={customTopicInput}
                    onChange={(event) =>
                      setCustomTopicInput(event.target.value)
                    }
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        handleAddCustomTopic();
                      }
                    }}
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

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString("zh-CN", {
    hour12: false,
  });
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
