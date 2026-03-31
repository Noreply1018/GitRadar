import type { DailyDigestArchive } from "../../src/core/archive";
import type {
  ArchiveReaderContext,
  ArchiveSummary,
  EnvironmentFingerprints,
  FeedbackAction,
  FeedbackListItem,
  GitHubSettings,
  LlmSettings,
  RuntimeSource,
  ScheduleSettings,
  TimezoneOption,
  UserPreferences,
  WecomSettings,
} from "./api";

export type WorkspaceId = "overview" | "archives" | "runtime" | "library";

export interface ValidationStatus {
  state: "idle" | "passed" | "failed";
  detail: string;
}

export interface HealthState {
  status: string;
  app: string;
  version: string;
  mode: string;
  source: RuntimeSource;
  note?: string;
  lastRunAt?: string | null;
  lastRunStatus?: "success" | "failure" | "unknown";
  lastArchiveDate?: string | null;
  runUrl?: string | null;
}

export function OverviewWorkspace(props: {
  archives: ArchiveSummary[];
  environmentFingerprints: EnvironmentFingerprints;
  githubSettings: GitHubSettings;
  health: HealthState | null;
  llmSettings: LlmSettings;
  onJumpToWorkspace: (workspace: WorkspaceId) => void;
  runtimeSource: RuntimeSource;
  scheduleDraft: ScheduleSettings | null;
  timezoneOptions: TimezoneOption[];
  wecomSettings: WecomSettings;
}) {
  const latestArchive = props.archives[0] ?? null;
  const sourceTitle =
    props.runtimeSource === "github" ? "GitHub 远端运行源" : "Local 本地运行源";

  return (
    <section className="workspace workspace-overview">
      <WorkspaceHeader
        eyebrow="Current View"
        title={sourceTitle}
        summary={
          props.runtimeSource === "github"
            ? "这里展示 GitHub Actions 已提交回仓库的运行结果与只读配置映射。"
            : "这里展示本地运行源的可写配置、测试链路与本地归档数据。"
        }
      />

      <section className="overview-hero">
        <div className="overview-hero-main">
          <p className="hero-panel-label">当前判断</p>
          <h3>
            {props.health?.lastRunStatus === "success"
              ? "这条运行链路最近一次是成功的。"
              : props.runtimeSource === "github"
                ? "远端归档还没有真正落到仓库。"
                : "本地运行源已接管，但是否完成发送还取决于你的链路测试。"}
          </h3>
          <p>{props.health?.note ?? "等待当前运行源返回更完整的状态信息。"}</p>
        </div>

        <div className="overview-stat-grid">
          <StatBlock
            label="服务状态"
            value={props.health?.status ?? "loading"}
          />
          <StatBlock
            label="最近运行"
            value={formatMaybeDate(props.health?.lastRunAt) ?? "尚无记录"}
          />
          <StatBlock
            label="最近归档"
            value={
              props.health?.lastArchiveDate ?? latestArchive?.date ?? "暂无"
            }
          />
          <StatBlock label="工作模式" value={props.health?.mode ?? "loading"} />
        </div>
      </section>

      <section className="overview-grid">
        <article className="surface-block">
          <SectionHeading
            eyebrow="Archive & Schedule"
            title="归档与执行"
            summary="先确认这条运行源最近有没有真正生成归档，再判断配置是否需要改动。"
          />
          <dl className="definition-list">
            <DefinitionRow
              label="归档数量"
              value={`${props.archives.length} 份`}
            />
            <DefinitionRow
              label="最近归档标题"
              value={latestArchive?.title ?? "当前没有归档"}
            />
            <DefinitionRow
              label="发送时间"
              value={props.scheduleDraft?.dailySendTime ?? "--:--"}
            />
            <DefinitionRow
              label="时区"
              value={describeTimezone(
                props.scheduleDraft?.timezone,
                props.timezoneOptions,
              )}
            />
          </dl>
        </article>

        <article className="surface-block">
          <SectionHeading
            eyebrow="Pipeline"
            title="环境摘要"
            summary="配置页只负责修改；这里先看三条链路有没有基本就绪。"
          />
          <div className="mini-status-list">
            <MiniStatus
              label="GitHub 数据源"
              status={buildConfiguredLabel(props.githubSettings.configured)}
              detail={
                props.environmentFingerprints.github?.login ??
                props.githubSettings.maskedToken ??
                "尚未配置"
              }
            />
            <MiniStatus
              label="摘要模型"
              status={buildConfiguredLabel(props.llmSettings.configured)}
              detail={
                props.environmentFingerprints.llm?.model ??
                props.llmSettings.model ??
                "尚未配置"
              }
            />
            <MiniStatus
              label="企业微信"
              status={buildConfiguredLabel(props.wecomSettings.configured)}
              detail={
                props.environmentFingerprints.wecom?.maskedWebhookUrl ??
                props.wecomSettings.maskedWebhookUrl ??
                "尚未配置"
              }
            />
          </div>
        </article>
      </section>

      <section className="surface-block">
        <SectionHeading
          eyebrow="Jump In"
          title="进入工作区"
          summary="归档和配置已经拆开，先选你现在要处理的是内容、链路还是个人偏好。"
        />
        <div className="workspace-entry-grid">
          <EntryButton
            title="归档"
            detail="阅读当前运行源下的日报、选择理由与反馈记录。"
            onClick={() => props.onJumpToWorkspace("archives")}
          />
          <EntryButton
            title="运行配置"
            detail="查看或修改调度、数据源、模型与发送链路。"
            onClick={() => props.onJumpToWorkspace("runtime")}
          />
          <EntryButton
            title="偏好与收藏"
            detail="维护主题偏好，查看已收藏与稍后看。"
            onClick={() => props.onJumpToWorkspace("library")}
          />
        </div>
      </section>
    </section>
  );
}

export function RuntimeWorkspace(props: {
  busyAction: string;
  environmentFingerprints: EnvironmentFingerprints;
  githubSettings: GitHubSettings;
  githubTokenInput: string;
  githubValidation: ValidationStatus;
  isGitHubMode: boolean;
  llmApiKeyInput: string;
  llmBaseUrlInput: string;
  llmModelInput: string;
  llmSettings: LlmSettings;
  llmValidation: ValidationStatus;
  onChangeGitHubToken: (value: string) => void;
  onChangeLlmApiKey: (value: string) => void;
  onChangeLlmBaseUrl: (value: string) => void;
  onChangeLlmModel: (value: string) => void;
  onChangeSchedule: (value: ScheduleSettings | null) => void;
  onChangeWecomWebhook: (value: string) => void;
  onSaveGitHub: () => Promise<void>;
  onSaveLlm: () => Promise<void>;
  onSaveSchedule: () => Promise<void>;
  onSaveWecom: () => Promise<void>;
  onTestAll: () => Promise<void>;
  onTestGitHub: () => Promise<void>;
  onTestLlm: () => Promise<void>;
  onTestWecom: () => Promise<void>;
  runtimeSource: RuntimeSource;
  scheduleDraft: ScheduleSettings | null;
  timezoneOptions: TimezoneOption[];
  wecomSettings: WecomSettings;
  wecomValidation: ValidationStatus;
  wecomWebhookInput: string;
}) {
  return (
    <section className="workspace workspace-runtime">
      <WorkspaceHeader
        eyebrow="Runtime"
        title="运行配置"
        summary={
          props.isGitHubMode
            ? "GitHub 运行源只展示 workflow 和 secrets 的映射关系，不在这里直接修改。"
            : "本地运行源可以直接修改调度、模型、数据源和发送链路。"
        }
        actions={
          !props.isGitHubMode ? (
            <button
              className="primary-button"
              disabled={props.busyAction !== ""}
              onClick={() => void props.onTestAll()}
              type="button"
            >
              {props.busyAction === "validate-environment"
                ? "验证中…"
                : "一键验证本地链路"}
            </button>
          ) : null
        }
      />

      <section className="runtime-grid">
        <article className="surface-block">
          <SectionHeading
            eyebrow="Schedule"
            title="运行与调度"
            summary={
              props.isGitHubMode
                ? "这里显示 workflow 的调度，不支持在前端直接编辑。"
                : "本地运行源的调度写入配置文件，修改后需要后续重启生效。"
            }
          />
          <div className="form-grid">
            <Field label="时间">
              <input
                disabled={props.isGitHubMode}
                onChange={(event) =>
                  props.onChangeSchedule(
                    props.scheduleDraft
                      ? {
                          ...props.scheduleDraft,
                          dailySendTime: event.target.value,
                        }
                      : props.scheduleDraft,
                  )
                }
                type="time"
                value={props.scheduleDraft?.dailySendTime ?? ""}
              />
            </Field>
            <Field label="时区">
              <select
                disabled={props.isGitHubMode}
                onChange={(event) =>
                  props.onChangeSchedule(
                    props.scheduleDraft
                      ? {
                          ...props.scheduleDraft,
                          timezone: event.target
                            .value as ScheduleSettings["timezone"],
                        }
                      : props.scheduleDraft,
                  )
                }
                value={props.scheduleDraft?.timezone ?? "Asia/Shanghai"}
              >
                {props.timezoneOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <InlineNote>
            {props.isGitHubMode
              ? "当前为 GitHub Actions 远端调度视角。归档是否出现取决于 workflow 是否真正跑完并提交产物。"
              : "当前为本地调度视角。保存表示配置已写入，不代表终端链路已经真实跑通。"}
          </InlineNote>
          {!props.isGitHubMode ? (
            <div className="panel-actions">
              <button
                className="primary-button"
                disabled={!props.scheduleDraft || props.busyAction !== ""}
                onClick={() => void props.onSaveSchedule()}
                type="button"
              >
                {props.busyAction === "save-schedule" ? "保存中…" : "保存调度"}
              </button>
            </div>
          ) : null}
        </article>

        <article className="surface-block">
          <SectionHeading
            eyebrow="Source & Delivery"
            title="数据源与发送链路"
            summary="GitHub 数据源和企业微信发送都放在这里，避免和模型配置混成一团。"
          />

          <ConfigSection
            title="GitHub"
            status={buildStatusLabel(
              props.githubSettings.configured,
              props.githubValidation,
            )}
          >
            <dl className="definition-list">
              <DefinitionRow
                label="当前 Token"
                value={props.githubSettings.maskedToken ?? "尚未配置"}
              />
              <DefinitionRow
                label="已验证账号"
                value={
                  props.environmentFingerprints.github?.login ?? "尚未验证"
                }
              />
              <DefinitionRow
                label="API 地址"
                value={props.githubSettings.apiBaseUrl}
              />
              <DefinitionRow
                label="配置来源"
                value={props.githubSettings.envFilePath || "--"}
              />
            </dl>
            {props.isGitHubMode ? (
              <InlineNote>
                {props.githubSettings.note ??
                  "GitHub 运行源由 workflow secrets 驱动，这里只做映射展示。"}
              </InlineNote>
            ) : (
              <>
                <Field label="新的 GitHub Token">
                  <input
                    autoComplete="off"
                    onChange={(event) =>
                      props.onChangeGitHubToken(event.target.value)
                    }
                    placeholder="留空表示保留当前 Token"
                    type="password"
                    value={props.githubTokenInput}
                  />
                </Field>
                <ValidationHint validation={props.githubValidation} />
                <div className="panel-actions">
                  <button
                    className="primary-button"
                    disabled={props.busyAction !== ""}
                    onClick={() => void props.onSaveGitHub()}
                    type="button"
                  >
                    {props.busyAction === "save-github"
                      ? "保存中…"
                      : "保存 Token"}
                  </button>
                  <button
                    className="ghost-button"
                    disabled={props.busyAction !== ""}
                    onClick={() => void props.onTestGitHub()}
                    type="button"
                  >
                    {props.busyAction === "test-github"
                      ? "测试中…"
                      : "测试 GitHub"}
                  </button>
                </div>
              </>
            )}
          </ConfigSection>

          <ConfigSection
            title="企业微信"
            status={buildStatusLabel(
              props.wecomSettings.configured,
              props.wecomValidation,
            )}
          >
            <dl className="definition-list">
              <DefinitionRow
                label="当前 Webhook"
                value={props.wecomSettings.maskedWebhookUrl ?? "尚未配置"}
              />
              <DefinitionRow
                label="最近验证"
                value={
                  formatMaybeDate(
                    props.environmentFingerprints.wecom?.lastValidatedAt,
                  ) ?? "尚无记录"
                }
              />
              <DefinitionRow
                label="配置来源"
                value={props.wecomSettings.envFilePath || "--"}
              />
            </dl>
            {props.isGitHubMode ? (
              <InlineNote>
                {props.wecomSettings.note ??
                  "GitHub 运行源下的发送配置来自 secrets，不在这里直接变更。"}
              </InlineNote>
            ) : (
              <>
                <Field label="新的 Webhook">
                  <input
                    onChange={(event) =>
                      props.onChangeWecomWebhook(event.target.value)
                    }
                    placeholder="输入新的企业微信 Webhook"
                    type="url"
                    value={props.wecomWebhookInput}
                  />
                </Field>
                <ValidationHint validation={props.wecomValidation} />
                <div className="panel-actions">
                  <button
                    className="primary-button"
                    disabled={props.busyAction !== ""}
                    onClick={() => void props.onSaveWecom()}
                    type="button"
                  >
                    {props.busyAction === "save-wecom"
                      ? "保存中…"
                      : "保存 Webhook"}
                  </button>
                  <button
                    className="ghost-button"
                    disabled={props.busyAction !== ""}
                    onClick={() => void props.onTestWecom()}
                    type="button"
                  >
                    {props.busyAction === "test-wecom"
                      ? "发送中…"
                      : "发送测试消息"}
                  </button>
                </div>
              </>
            )}
          </ConfigSection>
        </article>

        <article className="surface-block">
          <SectionHeading
            eyebrow="Model"
            title="模型与摘要生成"
            summary="模型设置独立出来，避免和 GitHub / WeCom 产生误读。"
          />
          <ConfigSection
            title="LLM"
            status={buildStatusLabel(
              props.llmSettings.configured,
              props.llmValidation,
            )}
          >
            <dl className="definition-list">
              <DefinitionRow
                label="当前 API Key"
                value={props.llmSettings.maskedApiKey ?? "尚未配置"}
              />
              <DefinitionRow
                label="Base URL"
                value={props.llmSettings.baseUrl ?? "尚未配置"}
              />
              <DefinitionRow
                label="Model"
                value={
                  props.environmentFingerprints.llm?.model ??
                  props.llmSettings.model ??
                  "尚未配置"
                }
              />
              <DefinitionRow
                label="配置来源"
                value={props.llmSettings.envFilePath || "--"}
              />
            </dl>
            {props.isGitHubMode ? (
              <InlineNote>
                {props.llmSettings.note ??
                  "GitHub 运行源下的模型配置来自 workflow secrets。"}
              </InlineNote>
            ) : (
              <>
                <Field label="新的 API Key">
                  <input
                    autoComplete="off"
                    onChange={(event) =>
                      props.onChangeLlmApiKey(event.target.value)
                    }
                    placeholder="留空表示保留当前 API Key"
                    type="password"
                    value={props.llmApiKeyInput}
                  />
                </Field>
                <div className="form-grid">
                  <Field label="Base URL">
                    <input
                      onChange={(event) =>
                        props.onChangeLlmBaseUrl(event.target.value)
                      }
                      placeholder="例如：https://endpoint/v1"
                      type="url"
                      value={props.llmBaseUrlInput}
                    />
                  </Field>
                  <Field label="Model">
                    <input
                      onChange={(event) =>
                        props.onChangeLlmModel(event.target.value)
                      }
                      placeholder="例如：gpt-4.1-mini"
                      type="text"
                      value={props.llmModelInput}
                    />
                  </Field>
                </div>
                <ValidationHint validation={props.llmValidation} />
                <div className="panel-actions">
                  <button
                    className="primary-button"
                    disabled={props.busyAction !== ""}
                    onClick={() => void props.onSaveLlm()}
                    type="button"
                  >
                    {props.busyAction === "save-llm"
                      ? "保存中…"
                      : "保存模型配置"}
                  </button>
                  <button
                    className="ghost-button"
                    disabled={props.busyAction !== ""}
                    onClick={() => void props.onTestLlm()}
                    type="button"
                  >
                    {props.busyAction === "test-llm"
                      ? "测试中…"
                      : "测试模型链路"}
                  </button>
                </div>
              </>
            )}
          </ConfigSection>
        </article>
      </section>
    </section>
  );
}

export function LibraryWorkspace(props: {
  availableThemes: string[];
  busyAction: string;
  customTopicInput: string;
  feedbackInsights: {
    interestedThemes: Array<{ theme: string; reason: string }>;
    skippedThemes: Array<{ theme: string; reason: string }>;
  };
  laterItems: FeedbackListItem[];
  onAddCustomTopic: () => void;
  onChangeCustomTopicInput: (value: string) => void;
  onOpenArchive: (date: string, repo: string) => Promise<void>;
  onRemoveCustomTopic: (topic: string) => void;
  onSavePreferences: () => Promise<void>;
  onToggleTheme: (theme: string) => void;
  preferencesDraft: UserPreferences;
  runtimeSource: RuntimeSource;
  savedItems: FeedbackListItem[];
  savedViewFilter: "saved" | "later";
  setSavedViewFilter: (value: "saved" | "later") => void;
}) {
  const feedbackItems =
    props.savedViewFilter === "saved" ? props.savedItems : props.laterItems;

  return (
    <section className="workspace workspace-library">
      <WorkspaceHeader
        eyebrow="Library"
        title="偏好与收藏"
        summary={`这里始终使用个人侧数据，不跟随 ${
          props.runtimeSource === "github" ? "GitHub" : "Local"
        } 运行源切换。`}
      />

      <section className="library-grid">
        <article className="surface-block">
          <SectionHeading
            eyebrow="Preferences"
            title="主题偏好"
            summary="主题偏好和自定义主题词统一放在这里，不再单独占一个页面。"
          />
          <div className="theme-cloud">
            {props.availableThemes.map((theme) => {
              const active =
                props.preferencesDraft.preferredThemes.includes(theme);
              return (
                <button
                  key={theme}
                  className={active ? "theme-toggle active" : "theme-toggle"}
                  onClick={() => props.onToggleTheme(theme)}
                  type="button"
                >
                  {theme}
                </button>
              );
            })}
          </div>

          <div className="custom-topic-composer">
            <Field label="自定义主题词">
              <input
                onChange={(event) =>
                  props.onChangeCustomTopicInput(event.target.value)
                }
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    props.onAddCustomTopic();
                  }
                }}
                placeholder="例如：Fabric, FPGA, agents runtime"
                type="text"
                value={props.customTopicInput}
              />
            </Field>
            <button
              className="ghost-button"
              onClick={props.onAddCustomTopic}
              type="button"
            >
              添加
            </button>
          </div>

          <div className="topic-list">
            {props.preferencesDraft.customTopics.map((topic) => (
              <button
                key={topic}
                className="topic-token"
                onClick={() => props.onRemoveCustomTopic(topic)}
                type="button"
              >
                <strong>{topic}</strong>
                <span>移除</span>
              </button>
            ))}
            {props.preferencesDraft.customTopics.length === 0 ? (
              <div className="empty-inline">还没有自定义主题词。</div>
            ) : null}
          </div>

          <div className="panel-actions">
            <button
              className="primary-button"
              disabled={props.busyAction !== ""}
              onClick={() => void props.onSavePreferences()}
              type="button"
            >
              {props.busyAction === "save-preferences" ? "保存中…" : "保存偏好"}
            </button>
          </div>
        </article>

        <article className="surface-block">
          <SectionHeading
            eyebrow="Collections"
            title="收藏与稍后看"
            summary="列表只保留仍然生效的状态，用来快速回到归档。"
          />
          <div className="collection-switch">
            <button
              className={
                props.savedViewFilter === "saved"
                  ? "filter-chip active"
                  : "filter-chip"
              }
              onClick={() => props.setSavedViewFilter("saved")}
              type="button"
            >
              已收藏 {props.savedItems.length}
            </button>
            <button
              className={
                props.savedViewFilter === "later"
                  ? "filter-chip active"
                  : "filter-chip"
              }
              onClick={() => props.setSavedViewFilter("later")}
              type="button"
            >
              稍后看 {props.laterItems.length}
            </button>
          </div>

          <div className="collection-list">
            {feedbackItems.map((item) => (
              <article
                key={`${item.repo}-${item.recordedAt}`}
                className="collection-row"
              >
                <div>
                  <p className="collection-theme">{item.theme ?? "未分类"}</p>
                  <h3>{item.repo}</h3>
                  <p className="collection-meta">
                    来源日报 {item.date} · 记录于{" "}
                    {formatDateTime(item.recordedAt)}
                  </p>
                </div>
                <div className="collection-actions">
                  <span className="collection-state">
                    {describeFeedbackAction(item.action)}
                  </span>
                  <div className="row-actions">
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
                        void props.onOpenArchive(item.date, item.repo)
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
              <div className="empty-inline">当前列表还没有内容。</div>
            ) : null}
          </div>
        </article>

        <article className="surface-block">
          <SectionHeading
            eyebrow="Signals"
            title="兴趣轨迹"
            summary="把最近真正偏好和连续跳过的主题放在一页里看。"
          />
          <div className="signals-grid">
            <SignalList
              emptyText="还没形成明显兴趣轨迹。"
              items={props.feedbackInsights.interestedThemes}
              title="最近真正感兴趣的主题"
            />
            <SignalList
              emptyText="目前还没有明显被连续跳过的主题。"
              items={props.feedbackInsights.skippedThemes}
              title="最近被连续跳过的主题"
            />
          </div>
        </article>
      </section>
    </section>
  );
}

export function ArchiveWorkspace(props: {
  archiveDetail: DailyDigestArchive | null;
  archiveReaderContext: ArchiveReaderContext;
  archives: ArchiveSummary[];
  busyAction: string;
  currentDigestItem: DailyDigestArchive["digest"]["items"][number] | null;
  currentFeedback: {
    action: FeedbackAction;
  } | null;
  currentItemIndex: number;
  onAcceptPreferenceSuggestion: (theme: string) => Promise<void>;
  onNextItem: () => void;
  onPreviousItem: () => void;
  onRecordFeedback: (action: FeedbackAction) => Promise<void>;
  onSelectArchive: (date: string) => Promise<void>;
  runtimeSource: RuntimeSource;
  selectedArchiveDate: string;
  selectedArchiveSummary: ArchiveSummary | null;
}) {
  return (
    <section className="workspace workspace-archive">
      <WorkspaceHeader
        eyebrow="Archive Desk"
        title="归档阅读"
        summary={
          props.runtimeSource === "github"
            ? "当前阅读的是 GitHub 远端运行源视角下的归档。"
            : "当前阅读的是 Local 运行源视角下的归档。"
        }
      />

      <section className="archive-layout">
        <aside className="surface-block archive-column">
          <SectionHeading
            eyebrow="Index"
            title="归档索引"
            summary="按日期切换，左侧只保留索引，不再混入配置说明。"
          />
          <div className="archive-index-list">
            {props.archives.map((archive) => (
              <button
                key={archive.date}
                className={
                  archive.date === props.selectedArchiveDate
                    ? "archive-index-row active"
                    : "archive-index-row"
                }
                onClick={() => void props.onSelectArchive(archive.date)}
                type="button"
              >
                <strong>{archive.date}</strong>
                <span>{archive.digestCount} 条项目</span>
              </button>
            ))}
            {props.archives.length === 0 ? (
              <div className="empty-inline">当前运行源还没有归档日报。</div>
            ) : null}
          </div>
        </aside>

        <section className="surface-block archive-reader-column">
          {props.archiveDetail &&
          props.currentDigestItem &&
          props.selectedArchiveSummary ? (
            <>
              <header className="reader-header">
                <div>
                  <p className="hero-panel-label">Reader</p>
                  <h3>{props.archiveDetail.digest.title}</h3>
                  <p className="reader-meta-line">
                    生成于 {formatDateTime(props.archiveDetail.generatedAt)} ·
                    规则版本 {props.selectedArchiveSummary.rulesVersion}
                  </p>
                </div>
                <div className="reader-counter">
                  第 {props.currentItemIndex + 1} 篇 / 共{" "}
                  {props.archiveDetail.digest.items.length} 篇
                </div>
              </header>

              <div className="reader-actions">
                <button
                  className="ghost-button"
                  disabled={props.currentItemIndex === 0}
                  onClick={props.onPreviousItem}
                  type="button"
                >
                  上一篇
                </button>
                <button
                  className="ghost-button"
                  disabled={
                    props.currentItemIndex >=
                    props.archiveDetail.digest.items.length - 1
                  }
                  onClick={props.onNextItem}
                  type="button"
                >
                  下一篇
                </button>
              </div>

              <article className="story-sheet">
                <div className="story-heading">
                  <span className="story-theme">
                    {props.currentDigestItem.theme}
                  </span>
                  {props.currentDigestItem.readerTag === "exploration" ? (
                    <span className="story-flag">探索位</span>
                  ) : null}
                  <h3>{props.currentDigestItem.repo}</h3>
                </div>

                {props.currentDigestItem.readerNote ? (
                  <p className="story-note">
                    {props.currentDigestItem.readerNote}
                  </p>
                ) : null}

                <div className="feedback-actions">
                  <FeedbackButton
                    active={props.currentFeedback?.action === "saved"}
                    busy={props.busyAction !== ""}
                    label="收藏"
                    onClick={() => void props.onRecordFeedback("saved")}
                  />
                  <FeedbackButton
                    active={props.currentFeedback?.action === "later"}
                    busy={props.busyAction !== ""}
                    label="稍后看"
                    onClick={() => void props.onRecordFeedback("later")}
                  />
                  <FeedbackButton
                    active={props.currentFeedback?.action === "skipped"}
                    busy={props.busyAction !== ""}
                    label="跳过"
                    onClick={() => void props.onRecordFeedback("skipped")}
                  />
                  <a
                    className="ghost-button link-button"
                    href={props.currentDigestItem.url}
                    rel="noreferrer"
                    target="_blank"
                  >
                    打开仓库
                  </a>
                </div>

                <p className="story-lead">{props.currentDigestItem.summary}</p>

                <div className="story-columns">
                  <section>
                    <h4>为什么值得看</h4>
                    <p>{props.currentDigestItem.whyItMatters}</p>
                  </section>
                  <section>
                    <h4>为什么是现在</h4>
                    <p>{props.currentDigestItem.whyNow}</p>
                  </section>
                  <section className="evidence-section">
                    <h4>证据</h4>
                    <ul>
                      {props.currentDigestItem.evidence.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </section>
                </div>
              </article>
            </>
          ) : (
            <div className="empty-inline">请选择一条归档日报开始阅读。</div>
          )}
        </section>

        <aside className="surface-block archive-side-column">
          <SectionHeading
            eyebrow="Context"
            title="阅读侧栏"
            summary="选择原因、偏好提示和运行源说明被集中到右侧，不再打断正文。"
          />

          <div className="side-stack">
            <InfoPanel
              title="今天为什么是这几条"
              items={props.archiveReaderContext.editorialIntro}
            />

            {props.archiveReaderContext.preferenceSuggestion ? (
              <div className="suggestion-card">
                <span className="story-theme">
                  {props.archiveReaderContext.preferenceSuggestion.theme}
                </span>
                <strong>偏好学习提示</strong>
                <p>{props.archiveReaderContext.preferenceSuggestion.reason}</p>
                <p className="reader-meta-line">
                  {props.archiveReaderContext.preferenceSuggestion.sourceWindow}
                </p>
                <button
                  className="primary-button"
                  disabled={props.busyAction !== ""}
                  onClick={() =>
                    void props.onAcceptPreferenceSuggestion(
                      props.archiveReaderContext.preferenceSuggestion!.theme,
                    )
                  }
                  type="button"
                >
                  {props.busyAction === "accept-suggestion"
                    ? "更新中…"
                    : "加入关心主题"}
                </button>
              </div>
            ) : null}

            <InfoPanel
              title="运行源说明"
              items={[
                props.runtimeSource === "github"
                  ? "当前是 GitHub 远端归档视角，重点看远端有没有真正落库。"
                  : "当前是本地归档视角，重点看本地分析和反馈是否顺手。",
                props.archiveReaderContext.explorationRepo
                  ? `本期探索位：${props.archiveReaderContext.explorationRepo}`
                  : "本期没有单独标出的探索位。",
              ]}
            />
          </div>
        </aside>
      </section>
    </section>
  );
}

function WorkspaceHeader(props: {
  actions?: React.ReactNode;
  eyebrow: string;
  summary: string;
  title: string;
}) {
  return (
    <header className="workspace-header">
      <div>
        <p className="hero-panel-label">{props.eyebrow}</p>
        <h2>{props.title}</h2>
        <p className="workspace-summary">{props.summary}</p>
      </div>
      {props.actions ? (
        <div className="workspace-actions">{props.actions}</div>
      ) : null}
    </header>
  );
}

function SectionHeading(props: {
  eyebrow: string;
  summary: string;
  title: string;
}) {
  return (
    <header className="section-heading">
      <p>{props.eyebrow}</p>
      <h3>{props.title}</h3>
      <span>{props.summary}</span>
    </header>
  );
}

function StatBlock(props: { label: string; value: string }) {
  return (
    <article className="stat-block">
      <span>{props.label}</span>
      <strong>{props.value}</strong>
    </article>
  );
}

function MiniStatus(props: { detail: string; label: string; status: string }) {
  return (
    <article className="mini-status">
      <div>
        <span>{props.label}</span>
        <strong>{props.status}</strong>
      </div>
      <p>{props.detail}</p>
    </article>
  );
}

function EntryButton(props: {
  detail: string;
  onClick: () => void;
  title: string;
}) {
  return (
    <button className="entry-button" onClick={props.onClick} type="button">
      <strong>{props.title}</strong>
      <span>{props.detail}</span>
    </button>
  );
}

function Field(props: { children: React.ReactNode; label: string }) {
  return (
    <label className="field">
      <span>{props.label}</span>
      {props.children}
    </label>
  );
}

function InlineNote(props: { children: React.ReactNode }) {
  return <p className="inline-note">{props.children}</p>;
}

function ConfigSection(props: {
  children: React.ReactNode;
  status: string;
  title: string;
}) {
  return (
    <section className="config-section">
      <div className="config-section-head">
        <h4>{props.title}</h4>
        <span>{props.status}</span>
      </div>
      {props.children}
    </section>
  );
}

function ValidationHint(props: { validation: ValidationStatus }) {
  const className =
    props.validation.state === "failed"
      ? "validation-hint failed"
      : "validation-hint";

  const detail =
    props.validation.state === "failed"
      ? `上次验证失败：${props.validation.detail}`
      : props.validation.detail;

  return <div className={className}>{detail}</div>;
}

function SignalList(props: {
  emptyText: string;
  items: Array<{ reason: string; theme: string }>;
  title: string;
}) {
  return (
    <section className="signal-card">
      <h4>{props.title}</h4>
      {props.items.length > 0 ? (
        <div className="signal-list">
          {props.items.map((item) => (
            <article key={item.theme} className="signal-item">
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

function FeedbackButton(props: {
  active: boolean;
  busy: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      className={props.active ? "feedback-button active" : "feedback-button"}
      disabled={props.busy}
      onClick={props.onClick}
      type="button"
    >
      {props.label}
    </button>
  );
}

function InfoPanel(props: { items: string[]; title: string }) {
  return (
    <section className="info-panel">
      <h4>{props.title}</h4>
      {props.items.length > 0 ? (
        props.items.map((item) => <p key={item}>{item}</p>)
      ) : (
        <p>暂无内容。</p>
      )}
    </section>
  );
}

function DefinitionRow(props: { label: string; value: string }) {
  return (
    <div className="definition-row">
      <dt>{props.label}</dt>
      <dd>{props.value}</dd>
    </div>
  );
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
    return "上次验证失败";
  }

  return "已配置未验证";
}

function buildConfiguredLabel(configured: boolean): string {
  return configured ? "已配置" : "未配置";
}

function describeTimezone(
  timezone: ScheduleSettings["timezone"] | undefined,
  options: TimezoneOption[],
): string {
  if (!timezone) {
    return "--";
  }

  return options.find((option) => option.value === timezone)?.label ?? timezone;
}

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString("zh-CN", {
    hour12: false,
  });
}

function formatMaybeDate(value: string | null | undefined): string | null {
  return value ? formatDateTime(value) : null;
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
