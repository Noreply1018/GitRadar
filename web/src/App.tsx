import { useEffect, useMemo, useState } from "react";

import type { DailyDigestArchive } from "../../src/core/archive";
import type { ArchiveSummary, ScheduleSettings } from "./api";
import {
  fetchArchiveDetail,
  fetchArchives,
  fetchHealth,
  fetchScheduleSettings,
  saveScheduleSettings,
} from "./api";

type ViewId = "schedule" | "archives";

const VIEWS: Array<{ id: ViewId; label: string; detail: string }> = [
  {
    id: "schedule",
    label: "发送设置",
    detail: "每日时间与重启提示",
  },
  {
    id: "archives",
    label: "归档日报",
    detail: "按日期阅读最终成稿",
  },
];

export default function App() {
  const [activeView, setActiveView] = useState<ViewId>("schedule");
  const [health, setHealth] = useState<{
    status: string;
    app: string;
    version: string;
    mode: string;
  } | null>(null);
  const [schedulePath, setSchedulePath] = useState("");
  const [scheduleDraft, setScheduleDraft] = useState<ScheduleSettings | null>(
    null,
  );
  const [archives, setArchives] = useState<ArchiveSummary[]>([]);
  const [selectedArchiveDate, setSelectedArchiveDate] = useState("");
  const [archiveDetail, setArchiveDetail] = useState<DailyDigestArchive | null>(
    null,
  );
  const [busyAction, setBusyAction] = useState<
    "" | "save-schedule" | "hydrate"
  >("hydrate");
  const [statusMessage, setStatusMessage] = useState(
    "正在读取 GitRadar 当前配置与归档…",
  );
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    void hydrate();
  }, []);

  const selectedArchiveSummary = useMemo(
    () =>
      archives.find((archive) => archive.date === selectedArchiveDate) ?? null,
    [archives, selectedArchiveDate],
  );

  async function hydrate(): Promise<void> {
    setBusyAction("hydrate");
    setErrorMessage("");

    try {
      const [healthResponse, scheduleResponse, archiveResponse] =
        await Promise.all([
          fetchHealth(),
          fetchScheduleSettings(),
          fetchArchives(),
        ]);

      setHealth(healthResponse);
      setSchedulePath(scheduleResponse.path);
      setScheduleDraft(scheduleResponse.settings);
      setArchives(archiveResponse.archives);

      const initialDate = archiveResponse.archives[0]?.date ?? "";
      setSelectedArchiveDate(initialDate);

      if (initialDate) {
        const detailResponse = await fetchArchiveDetail(initialDate);
        setArchiveDetail(detailResponse.archive);
      } else {
        setArchiveDetail(null);
      }

      setStatusMessage("极简日报面板已就绪。");
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
      setSchedulePath(response.path);
      setStatusMessage(
        "每日发送时间已保存。请重启 Docker 容器或重新启动 GitRadar 后生效。",
      );
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setBusyAction("");
    }
  }

  async function handleSelectArchive(date: string): Promise<void> {
    setSelectedArchiveDate(date);
    setErrorMessage("");

    try {
      const detailResponse = await fetchArchiveDetail(date);
      setArchiveDetail(detailResponse.archive);
      setStatusMessage(`已切换到 ${date} 的归档日报。`);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    }
  }

  return (
    <div className="app-shell">
      <div className="page-backdrop" aria-hidden="true" />

      <header className="hero">
        <div className="hero-copy">
          <p className="eyebrow">GitRadar / Daily Digest Desk</p>
          <h1>只保留每天真正要看的两件事。</h1>
          <p className="hero-summary">
            一处调整每日发送时间，一处阅读已经生成的日报归档。其余复杂控制从网页里退出，留给命令行和底层配置。
          </p>
        </div>

        <div className="hero-meta">
          <MetaStrip label="服务状态" value={health?.status ?? "loading"} />
          <MetaStrip
            label="当前版本"
            value={health ? `v${health.version}` : "loading"}
          />
          <MetaStrip label="运行模式" value={health?.mode ?? "loading"} />
        </div>
      </header>

      <section className="status-bar">
        <div>
          <strong>{statusMessage}</strong>
          <span>
            {schedulePath
              ? `配置文件：${schedulePath}`
              : "正在定位发送时间配置文件"}
          </span>
        </div>

        {errorMessage ? (
          <div className="status-error">
            <strong>错误</strong>
            <span>{errorMessage}</span>
          </div>
        ) : null}
      </section>

      <main className="workspace">
        <aside className="workspace-nav">
          <div className="nav-header">
            <span className="eyebrow">Views</span>
            <h2>极简面板</h2>
          </div>

          <nav className="view-switcher" aria-label="页面视图">
            {VIEWS.map((view) => (
              <button
                key={view.id}
                className={
                  view.id === activeView ? "view-button active" : "view-button"
                }
                onClick={() => setActiveView(view.id)}
                type="button"
              >
                <strong>{view.label}</strong>
                <span>{view.detail}</span>
              </button>
            ))}
          </nav>

          <div className="nav-note">
            <strong>这版网页不再承担完整控制台职责。</strong>
            <p>
              规则调参、任务执行、日志排错和候选池分析仍保留在项目内部，但不再放进默认网页界面。
            </p>
          </div>
        </aside>

        <section className="workspace-main">
          {activeView === "schedule" ? (
            <section className="surface schedule-surface">
              <header className="surface-header">
                <div>
                  <span className="eyebrow">Schedule</span>
                  <h2>每日发送时间</h2>
                </div>
                <button
                  className="ghost-button"
                  onClick={() => void hydrate()}
                  type="button"
                >
                  刷新
                </button>
              </header>

              <div className="schedule-layout">
                <div className="schedule-form">
                  <label>
                    <span>发送时间</span>
                    <input
                      type="time"
                      value={scheduleDraft?.dailySendTime ?? ""}
                      onChange={(event) =>
                        setScheduleDraft((current) =>
                          current
                            ? {
                                ...current,
                                dailySendTime: event.target.value,
                              }
                            : current,
                        )
                      }
                    />
                  </label>

                  <label>
                    <span>时区</span>
                    <input
                      type="text"
                      value={scheduleDraft?.timezone ?? "Asia/Shanghai"}
                      disabled
                    />
                  </label>

                  <button
                    className="primary-button"
                    disabled={!scheduleDraft || busyAction !== ""}
                    onClick={() => void handleSaveSchedule()}
                    type="button"
                  >
                    {busyAction === "save-schedule"
                      ? "保存中…"
                      : "保存发送时间"}
                  </button>
                </div>

                <div className="schedule-guide">
                  <article>
                    <h3>生效方式</h3>
                    <p>
                      保存后会写入
                      `config/schedule.json`，不会即时热更新运行中的定时器。
                    </p>
                  </article>
                  <article>
                    <h3>Docker 用户</h3>
                    <p>
                      执行 `docker compose restart
                      gitradar`，新的每日发送时间会在容器启动时写入 cron。
                    </p>
                  </article>
                  <article>
                    <h3>Windows 双击启动</h3>
                    <p>
                      先关闭 GitRadar，再重新双击 `start-gitradar.bat`
                      启动即可。
                    </p>
                  </article>
                </div>
              </div>
            </section>
          ) : null}

          {activeView === "archives" ? (
            <section className="surface archive-surface">
              <header className="surface-header">
                <div>
                  <span className="eyebrow">Archive Reader</span>
                  <h2>归档日报</h2>
                </div>
                <button
                  className="ghost-button"
                  onClick={() => void hydrate()}
                  type="button"
                >
                  刷新
                </button>
              </header>

              <div className="archive-layout">
                <aside className="archive-index">
                  {archives.map((archive) => (
                    <button
                      key={archive.date}
                      className={
                        archive.date === selectedArchiveDate
                          ? "archive-link active"
                          : "archive-link"
                      }
                      onClick={() => void handleSelectArchive(archive.date)}
                      type="button"
                    >
                      <strong>{archive.date}</strong>
                      <span>{archive.title}</span>
                    </button>
                  ))}

                  {archives.length === 0 ? (
                    <div className="empty-state">
                      当前还没有可阅读的归档日报。
                    </div>
                  ) : null}
                </aside>

                <section className="archive-reader">
                  {archiveDetail && selectedArchiveSummary ? (
                    <>
                      <header className="reader-header">
                        <div>
                          <p className="eyebrow">Selected Digest</p>
                          <h3>{archiveDetail.digest.title}</h3>
                        </div>
                        <div className="reader-meta">
                          <MetaStrip
                            label="日期"
                            value={archiveDetail.digest.date}
                          />
                          <MetaStrip
                            label="生成时间"
                            value={formatDateTime(archiveDetail.generatedAt)}
                          />
                          <MetaStrip
                            label="规则版本"
                            value={selectedArchiveSummary.rulesVersion}
                          />
                        </div>
                      </header>

                      <div className="digest-list">
                        {archiveDetail.digest.items.map((item, index) => (
                          <article
                            key={`${item.repo}-${index}`}
                            className="digest-item"
                          >
                            <div className="digest-title-row">
                              <strong>
                                {String(index + 1).padStart(2, "0")} {item.repo}
                              </strong>
                              <span className="theme-tag">{item.theme}</span>
                            </div>

                            <p className="digest-summary">{item.summary}</p>

                            <dl className="digest-facts">
                              <div>
                                <dt>为什么值得看</dt>
                                <dd>{item.whyItMatters}</dd>
                              </div>
                              <div>
                                <dt>为什么是现在</dt>
                                <dd>{item.whyNow}</dd>
                              </div>
                              <div>
                                <dt>证据</dt>
                                <dd>{item.evidence.join("；") || "未记录"}</dd>
                              </div>
                            </dl>
                          </article>
                        ))}
                      </div>
                    </>
                  ) : (
                    <div className="empty-state">
                      请选择一条归档日报开始阅读。
                    </div>
                  )}
                </section>
              </div>
            </section>
          ) : null}
        </section>
      </main>
    </div>
  );
}

function MetaStrip(props: { label: string; value: string }) {
  return (
    <div className="meta-strip">
      <span>{props.label}</span>
      <strong>{props.value}</strong>
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
