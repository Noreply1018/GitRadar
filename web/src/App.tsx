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

const TABS: Array<{ id: TabId; label: string; detail: string }> = [
  { id: "dashboard", label: "仪表盘", detail: "运行态势与快捷动作" },
  { id: "rules", label: "规则配置", detail: "主题、黑名单、阈值与权重" },
  { id: "commands", label: "执行中心", detail: "真实终端命令与日志" },
  { id: "archives", label: "归档浏览", detail: "日报历史、shortlist 与证据" },
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
  const [statusMessage, setStatusMessage] = useState("正在读取本地控制台状态…");
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
  }, [jobs]);

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
      setStatusMessage("本地控制台已加载，规则、命令和归档状态可查看。");

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
          ? "规则配置校验通过，可以直接保存或生成日报。"
          : "规则配置存在错误，请先按字段提示修正。",
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
        setStatusMessage("保存已拦截：当前规则配置仍有错误。");
        return;
      }

      const result = await saveDigestRules(config);
      setConfig(result.config);
      setConfigPath(result.path);
      setStatusMessage(`规则配置已写入 ${result.path}`);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setBusyAction("");
    }
  }

  async function handleCommand(
    kind: "validate" | "generate" | "generate-send" | "analyze" | "send-sample",
  ): Promise<void> {
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
      setStatusMessage(`已启动命令：${result.job.command}`);
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
      setStatusMessage(`已加载 ${date} 的归档详情。`);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    }
  }

  const selectedJob = jobs.find((job) => job.id === selectedJobId) ?? null;

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand-block">
          <div className="brand-kicker">GitRadar v1.3.0</div>
          <h1>中文控制台</h1>
          <p>
            用结构化规则、真实终端命令和可浏览归档，把日报引擎升级为可操作的
            Radar 工作台。
          </p>
        </div>

        <nav className="tab-list">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              className={tab.id === activeTab ? "tab-link active" : "tab-link"}
              onClick={() => setActiveTab(tab.id)}
              type="button"
            >
              <span>{tab.label}</span>
              <small>{tab.detail}</small>
            </button>
          ))}
        </nav>

        <section className="sidebar-footer">
          <div className="meta-line">
            <span>状态</span>
            <strong>{health?.status ?? "loading"}</strong>
          </div>
          <div className="meta-line">
            <span>运行模式</span>
            <strong>{health?.mode ?? "loading"}</strong>
          </div>
          <div className="meta-line">
            <span>规则路径</span>
            <strong>{configPath || "loading"}</strong>
          </div>
        </section>
      </aside>

      <main className="workspace">
        <header className="hero">
          <div>
            <div className="hero-kicker">本地优先 · 中文优先 · 配置驱动</div>
            <h2>把 `digest-rules.json`、CLI 和归档历史收口到一个工作界面</h2>
          </div>
          <div className="hero-actions">
            <button
              className="primary"
              onClick={() => void handleCommand("validate")}
              type="button"
            >
              校验规则
            </button>
            <button
              className="secondary"
              onClick={() => void handleCommand("generate")}
              type="button"
            >
              生成日报
            </button>
          </div>
        </header>

        <section className="status-strip">
          <span>{statusMessage}</span>
          {errorMessage ? (
            <strong className="error-text">{errorMessage}</strong>
          ) : null}
        </section>

        {activeTab === "dashboard" ? (
          <section className="dashboard-grid">
            <article className="metric-panel">
              <div className="metric-label">规则版本</div>
              <div className="metric-value">{config?.version ?? "-"}</div>
              <p>当前仓库规则配置版本，保存后会直接写回本地文件。</p>
            </article>
            <article className="metric-panel">
              <div className="metric-label">主题数量</div>
              <div className="metric-value">{config?.themes.length ?? 0}</div>
              <p>用于 shortlist 和候选池多样性约束的主题集合。</p>
            </article>
            <article className="metric-panel">
              <div className="metric-label">最近归档</div>
              <div className="metric-value">{archives[0]?.date ?? "暂无"}</div>
              <p>
                {archives[0] ? archives[0].title : "还没有可读取的日报归档。"}
              </p>
            </article>
            <article className="metric-panel">
              <div className="metric-label">命令状态</div>
              <div className="metric-value">{jobs[0]?.status ?? "暂无"}</div>
              <p>{jobs[0] ? jobs[0].command : "尚未从网页触发过命令。"}</p>
            </article>

            <section className="wide-panel">
              <div className="panel-heading">
                <h3>快捷动作</h3>
                <p>这些动作都通过本地 API 白名单转成真实终端命令。</p>
              </div>
              <div className="quick-actions">
                <button
                  className="primary"
                  disabled={busyAction !== ""}
                  onClick={() => void handleCommand("validate")}
                  type="button"
                >
                  规则校验
                </button>
                <button
                  className="secondary"
                  disabled={busyAction !== ""}
                  onClick={() => void handleCommand("generate")}
                  type="button"
                >
                  生成日报
                </button>
                <button
                  className="secondary"
                  disabled={busyAction !== ""}
                  onClick={() => void handleCommand("generate-send")}
                  type="button"
                >
                  生成并发送
                </button>
                <button
                  className="secondary"
                  disabled={busyAction !== ""}
                  onClick={() => void handleCommand("send-sample")}
                  type="button"
                >
                  发送样例
                </button>
              </div>
            </section>

            <section className="wide-panel">
              <div className="panel-heading">
                <h3>最近执行记录</h3>
                <p>执行中心会保留完整 stdout、stderr 与退出码。</p>
              </div>
              <div className="job-list compact">
                {jobs.slice(0, 4).map((job) => (
                  <button
                    key={job.id}
                    className="job-item"
                    onClick={() => {
                      setSelectedJobId(job.id);
                      setActiveTab("commands");
                    }}
                    type="button"
                  >
                    <strong>{job.command}</strong>
                    <span>{job.status}</span>
                    <small>{formatDateTime(job.startedAt)}</small>
                  </button>
                ))}
                {jobs.length === 0 ? (
                  <div className="empty-box">暂无命令记录。</div>
                ) : null}
              </div>
            </section>
          </section>
        ) : null}

        {activeTab === "rules" && config ? (
          <section className="rules-layout">
            <div className="section-toolbar">
              <div>
                <h3>规则配置</h3>
                <p>
                  结构化编辑主题、阈值与权重，保存前会复用后端解析逻辑进行校验。
                </p>
              </div>
              <div className="toolbar-actions">
                <button
                  className="secondary"
                  disabled={busyAction !== ""}
                  onClick={() => void handleValidateConfig()}
                  type="button"
                >
                  {busyAction === "validate-config" ? "校验中…" : "校验草稿"}
                </button>
                <button
                  className="primary"
                  disabled={busyAction !== ""}
                  onClick={() => void handleSaveConfig()}
                  type="button"
                >
                  {busyAction === "save-config" ? "保存中…" : "保存配置"}
                </button>
              </div>
            </div>

            <div className="issue-ribbon">
              {issues.length === 0 ? (
                <span>当前没有规则校验错误。</span>
              ) : (
                issues.map((issue) => (
                  <div
                    key={`${issue.path}-${issue.message}`}
                    className="issue-pill"
                  >
                    <strong>{issue.path}</strong>
                    <span>{issue.message}</span>
                  </div>
                ))
              )}
            </div>

            <section className="rules-panel">
              <div className="panel-heading">
                <h3>主题配置</h3>
                <p>
                  每个主题用独立卡片维护主题名和关键词，多样性逻辑仍由后端执行。
                </p>
              </div>
              <div className="theme-grid">
                {config.themes.map((theme, index) => (
                  <div key={`${theme.theme}-${index}`} className="theme-card">
                    <label>
                      <span>主题名</span>
                      <input
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
                    </label>
                    <label>
                      <span>关键词（每行一个）</span>
                      <textarea
                        rows={6}
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
                    </label>
                  </div>
                ))}
              </div>
            </section>

            <section className="rules-panel two-column">
              <label>
                <span>描述黑名单</span>
                <textarea
                  rows={7}
                  value={config.blacklists.descriptionKeywords.join("\n")}
                  onChange={(event) =>
                    setConfig({
                      ...config,
                      blacklists: {
                        ...config.blacklists,
                        descriptionKeywords: parseMultiline(event.target.value),
                      },
                    })
                  }
                />
              </label>
              <label>
                <span>README 黑名单</span>
                <textarea
                  rows={7}
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
                  rows={7}
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
              <label className="checkbox-row">
                <span>成熟回暖保留</span>
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
            </section>

            <section className="rules-panel">
              <div className="panel-heading">
                <h3>阈值配置</h3>
                <p>常规阈值使用数字输入，分段 bucket 用表格编辑。</p>
              </div>
              <div className="number-grid">
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
              <div className="bucket-grid">
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

            <section className="rules-panel">
              <div className="panel-heading">
                <h3>权重配置</h3>
                <p>保留现有结构，按打分维度分组展示。</p>
              </div>
              <div className="weight-groups">
                {WEIGHT_FIELDS.map((group) => (
                  <div key={group.title} className="weight-group">
                    <h4>{group.title}</h4>
                    <div className="number-grid">
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
                  </div>
                ))}
              </div>
            </section>
          </section>
        ) : null}

        {activeTab === "commands" ? (
          <section className="commands-layout">
            <div className="command-actions">
              <button
                className="primary"
                disabled={busyAction !== ""}
                onClick={() => void handleCommand("validate")}
                type="button"
              >
                规则校验
              </button>
              <button
                className="secondary"
                disabled={busyAction !== ""}
                onClick={() => void handleCommand("generate")}
                type="button"
              >
                生成日报
              </button>
              <button
                className="secondary"
                disabled={busyAction !== ""}
                onClick={() => void handleCommand("generate-send")}
                type="button"
              >
                生成并发送
              </button>
              <button
                className="secondary"
                disabled={busyAction !== ""}
                onClick={() => void handleCommand("send-sample")}
                type="button"
              >
                发送样例
              </button>
              <label className="inline-input">
                <span>分析日期</span>
                <input
                  type="date"
                  value={analyzeDate}
                  onChange={(event) => setAnalyzeDate(event.target.value)}
                />
              </label>
              <button
                className="secondary"
                disabled={busyAction !== "" || analyzeDate.length === 0}
                onClick={() => void handleCommand("analyze")}
                type="button"
              >
                分析归档
              </button>
            </div>

            <div className="command-grid">
              <div className="job-list">
                {jobs.map((job) => (
                  <button
                    key={job.id}
                    className={
                      job.id === selectedJobId ? "job-item active" : "job-item"
                    }
                    onClick={() => setSelectedJobId(job.id)}
                    type="button"
                  >
                    <strong>{job.command}</strong>
                    <span>{job.status}</span>
                    <small>{formatDateTime(job.startedAt)}</small>
                  </button>
                ))}
                {jobs.length === 0 ? (
                  <div className="empty-box">暂无执行记录。</div>
                ) : null}
              </div>

              <div className="terminal-panel">
                {selectedJob ? (
                  <>
                    <div className="terminal-meta">
                      <div>
                        <span>命令</span>
                        <strong>{selectedJob.command}</strong>
                      </div>
                      <div>
                        <span>状态</span>
                        <strong>{selectedJob.status}</strong>
                      </div>
                      <div>
                        <span>退出码</span>
                        <strong>{selectedJob.exitCode ?? "-"}</strong>
                      </div>
                    </div>
                    <div className="terminal-block">
                      <h4>stdout</h4>
                      <pre>{selectedJob.stdout || "暂无输出"}</pre>
                    </div>
                    <div className="terminal-block">
                      <h4>stderr</h4>
                      <pre>{selectedJob.stderr || "暂无输出"}</pre>
                    </div>
                  </>
                ) : (
                  <div className="empty-box">请选择一条命令查看终端日志。</div>
                )}
              </div>
            </div>
          </section>
        ) : null}

        {activeTab === "archives" ? (
          <section className="archives-grid">
            <div className="archive-list">
              {archives.map((archive) => (
                <button
                  key={archive.date}
                  className={
                    archive.date === selectedArchiveDate
                      ? "archive-item active"
                      : "archive-item"
                  }
                  onClick={() => void handleSelectArchive(archive.date)}
                  type="button"
                >
                  <strong>{archive.date}</strong>
                  <span>{archive.digestCount} 条日报</span>
                  <small>{archive.rulesVersion}</small>
                </button>
              ))}
              {archives.length === 0 ? (
                <div className="empty-box">暂无历史归档。</div>
              ) : null}
            </div>

            <div className="archive-detail">
              {archiveDetail ? (
                <>
                  <div className="panel-heading">
                    <h3>{archiveDetail.digest.title}</h3>
                    <p>
                      生成于 {formatDateTime(archiveDetail.generatedAt)} ·
                      schema {archiveDetail.schemaVersion}
                    </p>
                  </div>

                  <section className="archive-section">
                    <h4>最终日报</h4>
                    {archiveDetail.digest.items.map((item, index) => (
                      <article
                        key={`${item.repo}-${index}`}
                        className="digest-item"
                      >
                        <header>
                          <strong>
                            {index + 1}. {item.repo}
                          </strong>
                          <span>{item.theme}</span>
                        </header>
                        <p>{item.summary}</p>
                        <ul>
                          <li>为什么值得看：{item.whyItMatters}</li>
                          <li>为什么是现在：{item.whyNow}</li>
                          <li>证据：{item.evidence.join("；") || "未记录"}</li>
                        </ul>
                      </article>
                    ))}
                  </section>

                  <section className="archive-section split">
                    <div>
                      <h4>LLM 候选池</h4>
                      {archiveDetail.selection.selected.map((item) => (
                        <div key={item.repo} className="archive-note">
                          <strong>{item.repo}</strong>
                          <p>{item.reason}</p>
                        </div>
                      ))}
                    </div>
                    <div>
                      <h4>被排除项目</h4>
                      {archiveDetail.selection.rejected.map((item) => (
                        <div key={item.repo} className="archive-note">
                          <strong>{item.repo}</strong>
                          <p>{item.reason}</p>
                        </div>
                      ))}
                    </div>
                  </section>
                </>
              ) : (
                <div className="empty-box">请选择一个归档查看详情。</div>
              )}
            </div>
          </section>
        ) : null}

        <footer className="footer-bar">
          <button
            className="ghost"
            onClick={() => void hydrate()}
            type="button"
          >
            刷新控制台状态
          </button>
          <button
            className="ghost"
            onClick={() => void refreshArchives()}
            type="button"
          >
            刷新归档列表
          </button>
        </footer>
      </main>
    </div>
  );
}

function BucketEditor(props: {
  title: string;
  items: ReadonlyArray<{ maxDays: number; score: number }>;
  onChange: (items: ReadonlyArray<{ maxDays: number; score: number }>) => void;
}) {
  return (
    <div className="bucket-editor">
      <h4>{props.title}</h4>
      {props.items.map((item, index) => (
        <div key={`${props.title}-${index}`} className="bucket-row">
          <label>
            <span>maxDays</span>
            <input
              type="number"
              value={item.maxDays}
              onChange={(event) =>
                props.onChange(
                  props.items.map((bucket, bucketIndex) =>
                    bucketIndex === index
                      ? {
                          ...bucket,
                          maxDays: Number(event.target.value),
                        }
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
                      ? {
                          ...bucket,
                          score: Number(event.target.value),
                        }
                      : { ...bucket },
                  ),
                )
              }
            />
          </label>
        </div>
      ))}
    </div>
  );
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
      themeIndex === index
        ? {
            ...theme,
            [field]: value,
          }
        : { ...theme },
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
