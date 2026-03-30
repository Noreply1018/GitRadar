import { useEffect, useState } from "react";

import type { DigestRulesConfig } from "../../src/config/digest-rules";
import type { DailyDigestArchive } from "../../src/core/archive";
import {
  fetchArchiveDetail,
  fetchArchives,
  fetchDigestRules,
  fetchHealth,
  fetchJob,
  fetchJobs,
  saveDigestRules,
  startAnalyzeDigest,
  startGenerateDigest,
  startSendSample,
  startValidateRules,
  validateDigestRules,
  type ArchiveSummary,
  type CommandJob,
  type DigestRulesIssue,
} from "./api";

type TabId = "dashboard" | "rules" | "commands" | "archives";
type CommandKind =
  | "validate"
  | "generate"
  | "generate-send"
  | "analyze"
  | "send-sample";

const TABS: Array<{ id: TabId; label: string; detail: string }> = [
  { id: "dashboard", label: "总览", detail: "运行状态与今日动作" },
  { id: "rules", label: "规则", detail: "主题、阈值、权重" },
  { id: "commands", label: "命令", detail: "任务队列与终端输出" },
  { id: "archives", label: "归档", detail: "日报、候选池与排除原因" },
];

const RULE_SECTIONS: Array<{ id: string; label: string }> = [
  { id: "themes", label: "主题" },
  { id: "blacklists", label: "黑名单" },
  { id: "selection", label: "选择策略" },
  { id: "thresholds", label: "阈值" },
  { id: "weights", label: "权重" },
];

const THRESHOLD_FIELDS: Array<{
  key: keyof DigestRulesConfig["thresholds"];
  label: string;
}> = [
  { key: "maxPushedDays", label: "最大允许未推送天数" },
  { key: "sourceOverlapHighWatermark", label: "高重叠阈值" },
  { key: "sourceOverlapMediumWatermark", label: "中重叠阈值" },
  { key: "strongDescriptionLength", label: "强描述长度" },
  { key: "mediumDescriptionLength", label: "中描述长度" },
  { key: "veryMatureAgeDays", label: "超成熟项目年龄天数" },
  { key: "veryMatureMinStars", label: "超成熟项目最少 stars" },
  { key: "sustainedMomentumAgeDays", label: "持续动量年龄天数" },
  { key: "sustainedMomentumPushDays", label: "持续动量最近 push 天数" },
  { key: "matureMomentumAgeDays", label: "成熟回暖年龄天数" },
  { key: "matureMomentumPushDays", label: "成熟回暖最近 push 天数" },
  { key: "matureMomentumMinStars", label: "成熟回暖最少 stars" },
  { key: "recentCreatedPushBonusDays", label: "新建项目 push 奖励窗口" },
  { key: "evidenceHighStarCount", label: "高 star 证据阈值" },
  { key: "evidenceMediumStarCount", label: "中 star 证据阈值" },
  { key: "evidenceVeryRecentPushDays", label: "极近推送阈值" },
  { key: "evidenceRecentPushDays", label: "近期推送阈值" },
  { key: "evidenceVeryNewProjectDays", label: "极新项目阈值" },
  { key: "evidenceNewProjectDays", label: "新项目阈值" },
];

const WEIGHT_FIELDS = [
  {
    title: "来源信号",
    items: [
      ["weights.sourceSignals.trending.momentum", "Trending 动量"],
      ["weights.sourceSignals.trending.novelty", "Trending 新鲜度"],
      ["weights.sourceSignals.searchRecentlyUpdated.momentum", "最近更新动量"],
      ["weights.sourceSignals.searchRecentlyCreated.novelty", "最近创建新鲜度"],
      [
        "weights.sourceSignals.searchRecentlyCreated.recentPushBonus",
        "最近创建 push 奖励",
      ],
    ],
  },
  {
    title: "来源重叠",
    items: [
      ["weights.sourceOverlap.high.momentum", "高重叠动量"],
      ["weights.sourceOverlap.high.coverage", "高重叠覆盖度"],
      ["weights.sourceOverlap.medium.momentum", "中重叠动量"],
      ["weights.sourceOverlap.medium.coverage", "中重叠覆盖度"],
    ],
  },
  {
    title: "成熟度与覆盖度",
    items: [
      ["weights.maturity.starLogMultiplier", "Star 对数倍率"],
      ["weights.maturity.starCap", "Star 上限"],
      ["weights.maturity.forkLogMultiplier", "Fork 对数倍率"],
      ["weights.maturity.forkCap", "Fork 上限"],
      ["weights.maturity.sustainedMomentumBonus.momentum", "持续动量 bonus"],
      ["weights.maturity.sustainedMomentumBonus.maturity", "持续成熟度 bonus"],
      ["weights.maturity.veryMatureSingleSourcePenalty", "超成熟单源惩罚"],
      ["weights.coverage.topicMultiplier", "Topic 倍率"],
      ["weights.coverage.topicCap", "Topic 上限"],
      ["weights.coverage.strongDescription", "强描述分"],
      ["weights.coverage.mediumDescription", "中描述分"],
      ["weights.coverage.readme", "README 分"],
      ["weights.coverage.missingReadmePenalty", "README 缺失惩罚"],
      ["weights.coverage.language", "语言覆盖分"],
    ],
  },
] as const;

const EMPTY_ISSUES: DigestRulesIssue[] = [];

export default function App() {
  const [activeTab, setActiveTab] = useState<TabId>("dashboard");
  const [health, setHealth] = useState<{
    status: string;
    app: string;
    version: string;
    mode: string;
  } | null>(null);
  const [configPath, setConfigPath] = useState("");
  const [config, setConfig] = useState<DigestRulesConfig | null>(null);
  const [issues, setIssues] = useState<DigestRulesIssue[]>(EMPTY_ISSUES);
  const [jobs, setJobs] = useState<CommandJob[]>([]);
  const [archives, setArchives] = useState<ArchiveSummary[]>([]);
  const [selectedArchiveDate, setSelectedArchiveDate] = useState("");
  const [archiveDetail, setArchiveDetail] = useState<DailyDigestArchive | null>(
    null,
  );
  const [selectedJobId, setSelectedJobId] = useState("");
  const [analyzeDate, setAnalyzeDate] = useState("");
  const [busyAction, setBusyAction] = useState("");
  const [statusMessage, setStatusMessage] = useState(
    "正在同步 GitRadar 控制台状态…",
  );
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    void hydrate();
  }, []);

  useEffect(() => {
    if (!jobs.some((job) => job.status === "running")) {
      return;
    }

    const timer = window.setInterval(() => {
      void refreshJobs();
    }, 2000);

    return () => window.clearInterval(timer);
  }, [jobs, selectedJobId]);

  async function hydrate(): Promise<void> {
    try {
      setErrorMessage("");
      const [healthResponse, configResponse, archiveResponse, jobsResponse] =
        await Promise.all([
          fetchHealth(),
          fetchDigestRules(),
          fetchArchives(),
          fetchJobs(),
        ]);
      setHealth(healthResponse);
      setConfigPath(configResponse.path);
      setConfig(configResponse.config);
      setArchives(archiveResponse.archives);
      setJobs(jobsResponse.jobs);
      setStatusMessage("控制台已就绪，规则、命令与归档状态已同步。");

      if (archiveResponse.archives[0]) {
        setSelectedArchiveDate(archiveResponse.archives[0].date);
        const detail = await fetchArchiveDetail(
          archiveResponse.archives[0].date,
        );
        setArchiveDetail(detail.archive);
        setAnalyzeDate(archiveResponse.archives[0].date);
      }

      if (jobsResponse.jobs[0]) {
        setSelectedJobId(jobsResponse.jobs[0].id);
      }
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    }
  }

  async function refreshJobs(): Promise<void> {
    try {
      const response = await fetchJobs();
      setJobs(response.jobs);

      if (selectedJobId) {
        const selected = response.jobs.find((job) => job.id === selectedJobId);

        if (selected && selected.status === "running") {
          const detail = await fetchJob(selectedJobId);
          setJobs((currentJobs) =>
            currentJobs.map((job) =>
              job.id === detail.job.id ? detail.job : job,
            ),
          );
        }
      }
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    }
  }

  async function refreshArchives(): Promise<void> {
    const response = await fetchArchives();
    setArchives(response.archives);
  }

  async function handleValidateConfig(): Promise<void> {
    if (!config) {
      return;
    }

    setBusyAction("validate-config");
    setErrorMessage("");

    try {
      const result = await validateDigestRules(config);
      setIssues(result.issues);
      setStatusMessage(
        result.valid
          ? "当前规则草稿校验通过，可以直接保存或执行日报任务。"
          : "规则草稿存在错误，请按诊断面板逐项修正。",
      );
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setBusyAction("");
    }
  }

  async function handleSaveConfig(): Promise<void> {
    if (!config) {
      return;
    }

    setBusyAction("save-config");
    setErrorMessage("");

    try {
      const validation = await validateDigestRules(config);
      setIssues(validation.issues);

      if (!validation.valid) {
        setStatusMessage("保存已拦截：规则配置仍有未修复的问题。");
        return;
      }

      const result = await saveDigestRules(config);
      setConfig(result.config);
      setConfigPath(result.path);
      setStatusMessage(`规则配置已写回 ${result.path}`);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setBusyAction("");
    }
  }

  async function handleCommand(kind: CommandKind): Promise<void> {
    setBusyAction(kind);
    setErrorMessage("");

    try {
      const result =
        kind === "validate"
          ? await startValidateRules()
          : kind === "generate"
            ? await startGenerateDigest(false)
            : kind === "generate-send"
              ? await startGenerateDigest(true)
              : kind === "analyze"
                ? await startAnalyzeDigest(analyzeDate)
                : await startSendSample();

      setJobs((currentJobs) => [result.job, ...currentJobs]);
      setSelectedJobId(result.job.id);
      setActiveTab("commands");
      setStatusMessage(`任务已启动：${result.job.command}`);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setBusyAction("");
    }
  }

  async function handleSelectArchive(date: string): Promise<void> {
    setSelectedArchiveDate(date);
    setAnalyzeDate(date);

    try {
      const detail = await fetchArchiveDetail(date);
      setArchiveDetail(detail.archive);
      setStatusMessage(`已切换到 ${date} 的归档视图。`);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    }
  }

  const selectedJob = jobs.find((job) => job.id === selectedJobId) ?? null;
  const recentArchive = archives[0] ?? null;
  const latestJob = jobs[0] ?? null;
  const runningJobs = jobs.filter((job) => job.status === "running").length;
  const failingJobs = jobs.filter((job) => job.status === "failed").length;
  const successfulJobs = jobs.filter(
    (job) => job.status === "succeeded",
  ).length;

  return (
    <div className="console-shell">
      <aside className="console-sidebar">
        <div className="sidebar-brand">
          <div className="brand-tag">GitRadar / Control Surface</div>
          <h1>GitRadar</h1>
          <p>
            开源项目发现、证据整理、规则调参和发送链路，现在收口到同一块情报工作台。
          </p>
        </div>

        <nav className="sidebar-nav" aria-label="主导航">
          {TABS.map((tab, index) => (
            <button
              key={tab.id}
              className={tab.id === activeTab ? "nav-item active" : "nav-item"}
              onClick={() => setActiveTab(tab.id)}
              type="button"
            >
              <span className="nav-index">0{index + 1}</span>
              <span className="nav-text">
                <strong>{tab.label}</strong>
                <small>{tab.detail}</small>
              </span>
            </button>
          ))}
        </nav>

        <section className="sidebar-status">
          <div className="status-card">
            <span>服务状态</span>
            <strong>{health?.status ?? "loading"}</strong>
          </div>
          <div className="status-card">
            <span>运行模式</span>
            <strong>{health?.mode ?? "loading"}</strong>
          </div>
          <div className="status-card">
            <span>规则路径</span>
            <strong>{configPath || "loading"}</strong>
          </div>
        </section>
      </aside>

      <main className="console-main">
        <header className="topbar">
          <div className="topbar-title">
            <span className="eyebrow">Open source signal desk</span>
            <h2>{getTabTitle(activeTab)}</h2>
          </div>
          <div className="topbar-metrics">
            <MetricChip
              label="今日归档"
              value={recentArchive?.date ?? "暂无"}
              tone="neutral"
            />
            <MetricChip
              label="运行中"
              value={String(runningJobs)}
              tone="info"
            />
            <MetricChip
              label="失败"
              value={String(failingJobs)}
              tone="danger"
            />
            <MetricChip
              label="成功"
              value={String(successfulJobs)}
              tone="success"
            />
          </div>
        </header>

        <section className="system-banner">
          <div>
            <strong>{statusMessage}</strong>
            <span>
              {health
                ? `版本 ${health.version} · 模式 ${health.mode}`
                : "正在读取健康检查信息"}
            </span>
          </div>
          {errorMessage ? (
            <div className="banner-error">
              <strong>错误</strong>
              <span>{errorMessage}</span>
            </div>
          ) : null}
        </section>

        {activeTab === "dashboard" ? (
          <section className="dashboard-layout">
            <div className="dashboard-commanddeck panel">
              <div className="panel-head compact">
                <div>
                  <span className="eyebrow">Mission Control</span>
                  <h3>今日运行态势</h3>
                </div>
                <span className="inline-note">
                  规则版本 {config?.version ?? "loading"}
                </span>
              </div>

              <div className="commanddeck-grid">
                <div className="commanddeck-copy">
                  <h4>从候选抓取到日报发送，核心动作都在这里。</h4>
                  <p>
                    先校验规则，再决定是否直接生成日报。任务启动后，执行中心会保留完整命令、退出码和终端输出。
                  </p>
                </div>
                <div className="commanddeck-actions">
                  <ActionButton
                    busyAction={busyAction}
                    className="action-primary"
                    currentAction="validate"
                    label="校验规则"
                    onClick={() => void handleCommand("validate")}
                  />
                  <ActionButton
                    busyAction={busyAction}
                    className="action-secondary"
                    currentAction="generate"
                    label="生成日报"
                    onClick={() => void handleCommand("generate")}
                  />
                  <ActionButton
                    busyAction={busyAction}
                    className="action-secondary"
                    currentAction="generate-send"
                    label="生成并发送"
                    onClick={() => void handleCommand("generate-send")}
                  />
                  <ActionButton
                    busyAction={busyAction}
                    className="action-ghost"
                    currentAction="send-sample"
                    label="发送样例"
                    onClick={() => void handleCommand("send-sample")}
                  />
                </div>
              </div>
            </div>

            <div className="dashboard-stats panel">
              <div className="panel-head">
                <div>
                  <span className="eyebrow">Snapshot</span>
                  <h3>系统快照</h3>
                </div>
              </div>
              <div className="stats-grid">
                <StatBlock
                  label="主题数"
                  value={String(config?.themes.length ?? 0)}
                  detail="当前参与 shortlist 和候选池多样性控制"
                />
                <StatBlock
                  label="最近归档"
                  value={recentArchive?.date ?? "暂无"}
                  detail={recentArchive?.title ?? "还没有可浏览的日报归档"}
                />
                <StatBlock
                  label="最近命令"
                  value={latestJob?.status ?? "暂无"}
                  detail={latestJob?.command ?? "尚未从网页触发任务"}
                />
                <StatBlock
                  label="归档数量"
                  value={String(archives.length)}
                  detail="页面会优先展示最新一条归档"
                />
              </div>
            </div>

            <div className="dashboard-columns">
              <section className="panel">
                <div className="panel-head">
                  <div>
                    <span className="eyebrow">Activity</span>
                    <h3>最近任务</h3>
                  </div>
                  <button
                    className="text-button"
                    onClick={() => setActiveTab("commands")}
                    type="button"
                  >
                    打开执行中心
                  </button>
                </div>
                <div className="stack-list">
                  {jobs.slice(0, 5).map((job) => (
                    <button
                      key={job.id}
                      className="stack-item"
                      onClick={() => {
                        setSelectedJobId(job.id);
                        setActiveTab("commands");
                      }}
                      type="button"
                    >
                      <div className="stack-primary">
                        <strong>{job.command}</strong>
                        <StatusPill status={job.status} />
                      </div>
                      <small>{formatDateTime(job.startedAt)}</small>
                    </button>
                  ))}
                  {jobs.length === 0 ? (
                    <div className="empty-panel">还没有任务记录。</div>
                  ) : null}
                </div>
              </section>

              <section className="panel">
                <div className="panel-head">
                  <div>
                    <span className="eyebrow">Archive Feed</span>
                    <h3>最近归档</h3>
                  </div>
                  <button
                    className="text-button"
                    onClick={() => setActiveTab("archives")}
                    type="button"
                  >
                    打开归档浏览
                  </button>
                </div>
                <div className="stack-list">
                  {archives.slice(0, 5).map((archive) => (
                    <button
                      key={archive.date}
                      className="stack-item"
                      onClick={() => {
                        void handleSelectArchive(archive.date);
                        setActiveTab("archives");
                      }}
                      type="button"
                    >
                      <div className="stack-primary">
                        <strong>{archive.date}</strong>
                        <span className="mono-tag">
                          {archive.digestCount} 条
                        </span>
                      </div>
                      <small>
                        {archive.topRepos.join(" · ") || archive.title}
                      </small>
                    </button>
                  ))}
                  {archives.length === 0 ? (
                    <div className="empty-panel">还没有可浏览的归档。</div>
                  ) : null}
                </div>
              </section>
            </div>
          </section>
        ) : null}

        {activeTab === "rules" && config ? (
          <section className="rules-workspace">
            <div className="rules-header panel">
              <div className="panel-head">
                <div>
                  <span className="eyebrow">Rule Editor</span>
                  <h3>digest-rules 配置编辑器</h3>
                  <p className="subtle-copy">
                    所有保存动作都会复用后端解析逻辑，草稿不会绕过真实校验。
                  </p>
                </div>
                <div className="rules-actions">
                  <div className="rules-meta">
                    <span>路径</span>
                    <strong>{configPath}</strong>
                  </div>
                  <ActionButton
                    busyAction={busyAction}
                    className="action-ghost"
                    currentAction="validate-config"
                    label="校验草稿"
                    onClick={() => void handleValidateConfig()}
                  />
                  <ActionButton
                    busyAction={busyAction}
                    className="action-primary"
                    currentAction="save-config"
                    label="保存配置"
                    onClick={() => void handleSaveConfig()}
                  />
                </div>
              </div>

              <div
                className="section-pills"
                role="navigation"
                aria-label="规则分区"
              >
                {RULE_SECTIONS.map((section) => (
                  <a
                    key={section.id}
                    className="section-pill"
                    href={`#${section.id}`}
                  >
                    {section.label}
                  </a>
                ))}
              </div>
            </div>

            <div className="rules-grid">
              <section className="panel rules-main" id="themes">
                <div className="panel-head">
                  <div>
                    <span className="eyebrow">Themes</span>
                    <h3>主题与关键词</h3>
                  </div>
                </div>
                <div className="theme-list">
                  {config.themes.map((theme, index) => (
                    <article
                      key={`${theme.theme}-${index}`}
                      className="theme-row"
                    >
                      <div className="theme-row-head">
                        <span className="mono-tag">
                          T-{String(index + 1).padStart(2, "0")}
                        </span>
                        <input
                          className="theme-title-input"
                          value={theme.theme}
                          onChange={(event) =>
                            setConfig(
                              updateTheme(
                                config,
                                index,
                                "theme",
                                event.target.value,
                              ),
                            )
                          }
                        />
                      </div>
                      <textarea
                        rows={4}
                        value={theme.keywords.join("\n")}
                        onChange={(event) =>
                          setConfig(
                            updateTheme(
                              config,
                              index,
                              "keywords",
                              parseMultiline(event.target.value),
                            ),
                          )
                        }
                      />
                    </article>
                  ))}
                </div>
              </section>

              <aside className="rules-side">
                <section className="panel diagnostics-panel">
                  <div className="panel-head">
                    <div>
                      <span className="eyebrow">Diagnostics</span>
                      <h3>草稿诊断</h3>
                    </div>
                  </div>
                  <div className="diagnostic-list">
                    {issues.length === 0 ? (
                      <div className="empty-panel">当前没有校验问题。</div>
                    ) : (
                      issues.map((issue) => (
                        <div
                          key={`${issue.path}-${issue.message}`}
                          className="diagnostic-item"
                        >
                          <strong>{issue.path}</strong>
                          <span>{issue.message}</span>
                        </div>
                      ))
                    )}
                  </div>
                </section>

                <section className="panel" id="selection">
                  <div className="panel-head">
                    <div>
                      <span className="eyebrow">Selection</span>
                      <h3>选择策略</h3>
                    </div>
                  </div>
                  <div className="compact-form">
                    <label>
                      <span>Shortlist 每主题上限</span>
                      <input
                        type="number"
                        value={config.selection.shortlistMaxPerTheme}
                        onChange={(event) =>
                          setConfig({
                            ...config,
                            selection: {
                              ...config.selection,
                              shortlistMaxPerTheme: Number(event.target.value),
                            },
                          })
                        }
                      />
                    </label>
                    <label>
                      <span>候选池每主题上限</span>
                      <input
                        type="number"
                        value={config.selection.poolMaxPerTheme}
                        onChange={(event) =>
                          setConfig({
                            ...config,
                            selection: {
                              ...config.selection,
                              poolMaxPerTheme: Number(event.target.value),
                            },
                          })
                        }
                      />
                    </label>
                    <label className="switch-row">
                      <span>保留成熟回暖项目</span>
                      <input
                        checked={config.selection.ensureMatureMomentum}
                        onChange={(event) =>
                          setConfig({
                            ...config,
                            selection: {
                              ...config.selection,
                              ensureMatureMomentum: event.target.checked,
                            },
                          })
                        }
                        type="checkbox"
                      />
                    </label>
                  </div>
                </section>
              </aside>
            </div>

            <section className="panel" id="blacklists">
              <div className="panel-head">
                <div>
                  <span className="eyebrow">Blacklists</span>
                  <h3>黑名单词库</h3>
                </div>
              </div>
              <div className="triple-grid">
                <label>
                  <span>描述黑名单</span>
                  <textarea
                    rows={8}
                    value={config.blacklists.descriptionKeywords.join("\n")}
                    onChange={(event) =>
                      setConfig({
                        ...config,
                        blacklists: {
                          ...config.blacklists,
                          descriptionKeywords: parseMultiline(
                            event.target.value,
                          ),
                        },
                      })
                    }
                  />
                </label>
                <label>
                  <span>README 黑名单</span>
                  <textarea
                    rows={8}
                    value={config.blacklists.readmeKeywords.join("\n")}
                    onChange={(event) =>
                      setConfig({
                        ...config,
                        blacklists: {
                          ...config.blacklists,
                          readmeKeywords: parseMultiline(event.target.value),
                        },
                      })
                    }
                  />
                </label>
                <label>
                  <span>Topic 黑名单</span>
                  <textarea
                    rows={8}
                    value={config.blacklists.topics.join("\n")}
                    onChange={(event) =>
                      setConfig({
                        ...config,
                        blacklists: {
                          ...config.blacklists,
                          topics: parseMultiline(event.target.value),
                        },
                      })
                    }
                  />
                </label>
              </div>
            </section>

            <section className="panel" id="thresholds">
              <div className="panel-head">
                <div>
                  <span className="eyebrow">Thresholds</span>
                  <h3>阈值与 bucket</h3>
                </div>
              </div>
              <div className="dense-grid">
                {THRESHOLD_FIELDS.map((field) => (
                  <label key={field.key}>
                    <span>{field.label}</span>
                    <input
                      type="number"
                      value={config.thresholds[field.key] as number}
                      onChange={(event) =>
                        setConfig({
                          ...config,
                          thresholds: {
                            ...config.thresholds,
                            [field.key]: Number(event.target.value),
                          },
                        })
                      }
                    />
                  </label>
                ))}
              </div>
              <div className="bucket-columns">
                <BucketEditor
                  items={config.thresholds.recentPushMomentum}
                  onChange={(items) =>
                    setConfig({
                      ...config,
                      thresholds: {
                        ...config.thresholds,
                        recentPushMomentum: items,
                      },
                    })
                  }
                  title="Recent Push Momentum"
                />
                <BucketEditor
                  items={config.thresholds.recentCreationNovelty}
                  onChange={(items) =>
                    setConfig({
                      ...config,
                      thresholds: {
                        ...config.thresholds,
                        recentCreationNovelty: items,
                      },
                    })
                  }
                  title="Recent Creation Novelty"
                />
              </div>
            </section>

            <section className="panel" id="weights">
              <div className="panel-head">
                <div>
                  <span className="eyebrow">Weights</span>
                  <h3>评分权重</h3>
                </div>
              </div>
              <div className="weight-sections">
                {WEIGHT_FIELDS.map((group) => (
                  <section key={group.title} className="weight-section">
                    <header>
                      <h4>{group.title}</h4>
                    </header>
                    <div className="dense-grid">
                      {group.items.map(([fieldPath, label]) => (
                        <label key={fieldPath}>
                          <span>{label}</span>
                          <input
                            type="number"
                            value={String(getNestedNumber(config, fieldPath))}
                            onChange={(event) =>
                              setConfig(
                                updateNestedNumber(
                                  config,
                                  fieldPath,
                                  Number(event.target.value),
                                ),
                              )
                            }
                          />
                        </label>
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            </section>
          </section>
        ) : null}

        {activeTab === "commands" ? (
          <section className="command-workspace">
            <section className="panel command-toolbar">
              <div className="panel-head">
                <div>
                  <span className="eyebrow">Task Launcher</span>
                  <h3>执行中心</h3>
                </div>
              </div>
              <div className="launcher-grid">
                <div className="launcher-actions">
                  <ActionButton
                    busyAction={busyAction}
                    className="action-primary"
                    currentAction="validate"
                    label="规则校验"
                    onClick={() => void handleCommand("validate")}
                  />
                  <ActionButton
                    busyAction={busyAction}
                    className="action-secondary"
                    currentAction="generate"
                    label="生成日报"
                    onClick={() => void handleCommand("generate")}
                  />
                  <ActionButton
                    busyAction={busyAction}
                    className="action-secondary"
                    currentAction="generate-send"
                    label="生成并发送"
                    onClick={() => void handleCommand("generate-send")}
                  />
                  <ActionButton
                    busyAction={busyAction}
                    className="action-ghost"
                    currentAction="send-sample"
                    label="发送样例"
                    onClick={() => void handleCommand("send-sample")}
                  />
                </div>
                <div className="launcher-analyze">
                  <label>
                    <span>分析归档日期</span>
                    <input
                      type="date"
                      value={analyzeDate}
                      onChange={(event) => setAnalyzeDate(event.target.value)}
                    />
                  </label>
                  <ActionButton
                    busyAction={busyAction}
                    className="action-secondary"
                    currentAction="analyze"
                    disabled={!analyzeDate}
                    label="分析归档"
                    onClick={() => void handleCommand("analyze")}
                  />
                </div>
              </div>
            </section>

            <div className="task-grid">
              <section className="panel">
                <div className="panel-head">
                  <div>
                    <span className="eyebrow">Queue</span>
                    <h3>任务队列</h3>
                  </div>
                </div>
                <div className="task-list">
                  {jobs.map((job) => (
                    <button
                      key={job.id}
                      className={
                        job.id === selectedJobId
                          ? "task-row active"
                          : "task-row"
                      }
                      onClick={() => setSelectedJobId(job.id)}
                      type="button"
                    >
                      <div className="stack-primary">
                        <strong>{job.command}</strong>
                        <StatusPill status={job.status} />
                      </div>
                      <small>{formatDateTime(job.startedAt)}</small>
                    </button>
                  ))}
                  {jobs.length === 0 ? (
                    <div className="empty-panel">
                      还没有从控制台触发过任务。
                    </div>
                  ) : null}
                </div>
              </section>

              <section className="panel terminal-surface">
                {selectedJob ? (
                  <>
                    <div className="panel-head">
                      <div>
                        <span className="eyebrow">Selected Job</span>
                        <h3>{selectedJob.command}</h3>
                      </div>
                      <div className="terminal-summary">
                        <StatusPill status={selectedJob.status} />
                        <span className="mono-tag">
                          exit {selectedJob.exitCode ?? "-"}
                        </span>
                      </div>
                    </div>
                    <div className="terminal-meta-grid">
                      <MetaDatum
                        label="启动时间"
                        value={formatDateTime(selectedJob.startedAt)}
                      />
                      <MetaDatum
                        label="结束时间"
                        value={
                          selectedJob.finishedAt
                            ? formatDateTime(selectedJob.finishedAt)
                            : "running"
                        }
                      />
                    </div>
                    <div className="terminal-stream">
                      <div className="stream-block">
                        <header>
                          <span>stdout</span>
                        </header>
                        <pre>{selectedJob.stdout || "暂无输出"}</pre>
                      </div>
                      <div className="stream-block">
                        <header>
                          <span>stderr</span>
                        </header>
                        <pre>{selectedJob.stderr || "暂无输出"}</pre>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="empty-panel">
                    请选择一条任务查看完整终端输出。
                  </div>
                )}
              </section>
            </div>
          </section>
        ) : null}

        {activeTab === "archives" ? (
          <section className="archive-workspace">
            <section className="panel archive-list-panel">
              <div className="panel-head">
                <div>
                  <span className="eyebrow">Archive Index</span>
                  <h3>归档索引</h3>
                </div>
                <button
                  className="text-button"
                  onClick={() => void refreshArchives()}
                  type="button"
                >
                  刷新列表
                </button>
              </div>
              <div className="archive-feed">
                {archives.map((archive) => (
                  <button
                    key={archive.date}
                    className={
                      archive.date === selectedArchiveDate
                        ? "archive-row active"
                        : "archive-row"
                    }
                    onClick={() => void handleSelectArchive(archive.date)}
                    type="button"
                  >
                    <div className="stack-primary">
                      <strong>{archive.date}</strong>
                      <span className="mono-tag">{archive.digestCount} 条</span>
                    </div>
                    <small>{archive.rulesVersion}</small>
                    <span>{archive.topRepos.join(" · ") || archive.title}</span>
                  </button>
                ))}
                {archives.length === 0 ? (
                  <div className="empty-panel">暂无历史归档。</div>
                ) : null}
              </div>
            </section>

            <section className="panel archive-detail-panel">
              {archiveDetail ? (
                <>
                  <div className="panel-head">
                    <div>
                      <span className="eyebrow">Archive Detail</span>
                      <h3>{archiveDetail.digest.title}</h3>
                      <p className="subtle-copy">
                        生成于 {formatDateTime(archiveDetail.generatedAt)} ·
                        schema {archiveDetail.schemaVersion}
                      </p>
                    </div>
                    <div className="archive-meta">
                      <MetaDatum
                        label="规则版本"
                        value={archiveDetail.generationMeta.rulesVersion}
                      />
                      <MetaDatum
                        label="成稿模式"
                        value={
                          archiveDetail.generationMeta.editorialMode ?? "llm"
                        }
                      />
                    </div>
                  </div>

                  <section className="archive-section">
                    <header className="section-header">
                      <span className="eyebrow">Digest</span>
                      <h4>最终日报</h4>
                    </header>
                    <div className="digest-feed">
                      {archiveDetail.digest.items.map((item, index) => (
                        <article
                          key={`${item.repo}-${index}`}
                          className="digest-row"
                        >
                          <div className="digest-head">
                            <strong>
                              {String(index + 1).padStart(2, "0")} {item.repo}
                            </strong>
                            <span className="mono-tag">{item.theme}</span>
                          </div>
                          <p>{item.summary}</p>
                          <dl>
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
                  </section>

                  <div className="archive-columns">
                    <section className="archive-subsection">
                      <header className="section-header">
                        <span className="eyebrow">LLM Pool</span>
                        <h4>候选池</h4>
                      </header>
                      <div className="note-feed">
                        {archiveDetail.selection.selected.map((item) => (
                          <article key={item.repo} className="note-card">
                            <strong>{item.repo}</strong>
                            <p>{item.reason}</p>
                          </article>
                        ))}
                        {archiveDetail.selection.selected.length === 0 ? (
                          <div className="empty-panel">没有候选池记录。</div>
                        ) : null}
                      </div>
                    </section>
                    <section className="archive-subsection">
                      <header className="section-header">
                        <span className="eyebrow">Rejected</span>
                        <h4>被排除项目</h4>
                      </header>
                      <div className="note-feed">
                        {archiveDetail.selection.rejected.map((item) => (
                          <article key={item.repo} className="note-card">
                            <strong>{item.repo}</strong>
                            <p>{item.reason}</p>
                          </article>
                        ))}
                        {archiveDetail.selection.rejected.length === 0 ? (
                          <div className="empty-panel">没有排除项记录。</div>
                        ) : null}
                      </div>
                    </section>
                  </div>
                </>
              ) : (
                <div className="empty-panel">请选择一个归档查看详情。</div>
              )}
            </section>
          </section>
        ) : null}

        <footer className="console-footer">
          <button
            className="text-button"
            onClick={() => void hydrate()}
            type="button"
          >
            刷新控制台状态
          </button>
          <span>GitRadar v{health?.version ?? "1.3.0"} · local-first</span>
        </footer>
      </main>
    </div>
  );
}

function ActionButton(props: {
  busyAction: string;
  className: string;
  currentAction: string;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  const isBusy = props.busyAction === props.currentAction;

  return (
    <button
      className={props.className}
      disabled={props.busyAction !== "" || props.disabled}
      onClick={props.onClick}
      type="button"
    >
      {isBusy ? "执行中…" : props.label}
    </button>
  );
}

function MetricChip(props: {
  label: string;
  value: string;
  tone: "neutral" | "info" | "success" | "danger";
}) {
  return (
    <div className={`metric-chip ${props.tone}`}>
      <span>{props.label}</span>
      <strong>{props.value}</strong>
    </div>
  );
}

function StatBlock(props: { label: string; value: string; detail: string }) {
  return (
    <article className="stat-block">
      <span>{props.label}</span>
      <strong>{props.value}</strong>
      <small>{props.detail}</small>
    </article>
  );
}

function StatusPill(props: { status: CommandJob["status"] }) {
  return <span className={`status-pill ${props.status}`}>{props.status}</span>;
}

function MetaDatum(props: { label: string; value: string }) {
  return (
    <div className="meta-datum">
      <span>{props.label}</span>
      <strong>{props.value}</strong>
    </div>
  );
}

function BucketEditor(props: {
  title: string;
  items: ReadonlyArray<{ maxDays: number; score: number }>;
  onChange: (items: ReadonlyArray<{ maxDays: number; score: number }>) => void;
}) {
  return (
    <section className="bucket-editor">
      <header>
        <h4>{props.title}</h4>
      </header>
      <div className="bucket-table">
        {props.items.map((item, index) => (
          <div key={`${props.title}-${index}`} className="bucket-row">
            <span className="mono-tag">#{index + 1}</span>
            <label>
              <span>maxDays</span>
              <input
                type="number"
                value={item.maxDays}
                onChange={(event) =>
                  props.onChange(
                    props.items.map((bucket, bucketIndex) =>
                      bucketIndex === index
                        ? { ...bucket, maxDays: Number(event.target.value) }
                        : { ...bucket },
                    ),
                  )
                }
              />
            </label>
            <label>
              <span>score</span>
              <input
                type="number"
                value={item.score}
                onChange={(event) =>
                  props.onChange(
                    props.items.map((bucket, bucketIndex) =>
                      bucketIndex === index
                        ? { ...bucket, score: Number(event.target.value) }
                        : { ...bucket },
                    ),
                  )
                }
              />
            </label>
          </div>
        ))}
      </div>
    </section>
  );
}

function getTabTitle(tab: TabId): string {
  if (tab === "dashboard") {
    return "运行总览";
  }

  if (tab === "rules") {
    return "规则编辑器";
  }

  if (tab === "commands") {
    return "命令与日志";
  }

  return "归档情报";
}

function updateTheme(
  config: DigestRulesConfig,
  index: number,
  field: "theme" | "keywords",
  value: string | string[],
): DigestRulesConfig {
  return {
    ...config,
    themes: config.themes.map((theme, themeIndex) =>
      themeIndex === index ? { ...theme, [field]: value } : { ...theme },
    ),
  };
}

function parseMultiline(value: string): string[] {
  return value
    .split("\n")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString("zh-CN", {
    hour12: false,
  });
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function getNestedNumber(config: DigestRulesConfig, fieldPath: string): number {
  return fieldPath
    .split(".")
    .slice(1)
    .reduce<any>((current, key) => current[key], config) as number;
}

function updateNestedNumber(
  config: DigestRulesConfig,
  fieldPath: string,
  value: number,
): DigestRulesConfig {
  const segments = fieldPath.split(".").slice(1);
  const nextConfig = structuredClone(config) as DigestRulesConfig;
  let cursor: any = nextConfig;

  for (const segment of segments.slice(0, -1)) {
    cursor = cursor[segment];
  }

  cursor[segments[segments.length - 1]] = value;
  return nextConfig;
}
