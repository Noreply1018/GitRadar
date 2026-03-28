# 开发规范

## 当前阶段

GitRadar 当前处于：

`稳定日报引擎 -> 可探索发现系统`

的过渡阶段。

当前开发默认以 [架构设计与版本路线](./architecture-roadmap.md) 为最高优先级参考，不再沿用早期只围绕“先把推送做通”的项目规划。

## 当前开发重点

当前阶段默认优先推进这些事情：

- 把推荐做准
- 把证据留全
- 把链路做稳
- 把归档做成长期资产

不优先推进：

- 为了扩面而盲目接更多低质量数据源
- 为了复杂而复杂的多 agent 采编系统
- 过早引入数据库、任务队列和平台化基础设施

## 目录约定

- `src/`：应用核心逻辑与命令入口
- `tests/`：单元和集成测试
- `scripts/`：手动运维、重发、调试和迁移脚本
- `config/`：规则、主题、配置说明和模板约定
- `data/history/`：日报归档
- `data/runtime/`：运行期临时数据，不入库
- `data/cache/`：抓取缓存，不入库
- `data/exports/`：分析导出结果，不入库
- `docs/`：架构、运行约定和版本路线

根目录只保留仓库级文件，不把运行结果和一次性调试文件堆在顶层。

## 开发原则

- 所有用户可见行为都要区分“代码已改”“测试已过”“真实终端已验证”
- 没有真实终端复现前，不对发送链路报告“已成功”
- 结构化证据优先于模型自由发挥
- 新能力优先挂到现有主流程，避免本地命令和 CI 工作流分叉
- 历史归档必须可读、可分析、可重发，结构升级不能直接打断旧数据
- 配置和规则尽量外置，不把长期会调整的权重与阈值硬编码在实现里

## 架构约束

GitRadar 当前默认保持以下边界：

- Source Layer：负责候选抓取和补充信号
- Scoring Layer：负责规则筛选、主题推断和候选池构建
- Editorial Layer：负责最终中文成稿
- Archive Layer：负责归档、迁移和分析
- Delivery Layer：负责企业微信等发送器
- Feedback Layer：后续引入，负责事件采集和轻量个性化

开发时不要把这些职责重新揉回一个大脚本里。

## CI 与自动化

当前仓库包含两类工作流：

- `CI`：格式、Markdown、YAML、类型检查、测试、workflow lint
- `Daily Digest`：日报生成、企业微信发送、失败告警

涉及代码或架构改动时，推送到 `main` 后需要等待 CI 完成。

纯文本文档改动不要求等待 CI 后再继续版本推进，但仍应确保本地文档检查通过。

## 运行约定

- 日报默认每天 `08:17` 中国时间触发一次
- 也支持 GitHub Actions 手动触发
- 本地主入口是 `npm run generate:digest`
- 真实发送入口是 `npm run generate:digest -- --send`
- 补发入口是 `npm run generate:digest -- --resend-date YYYY-MM-DD`
- 分析入口是 `npm run analyze:digest -- --date YYYY-MM-DD`
- 运行期失败报告默认写入 `data/runtime/failures/`

## 归档约定

- 新归档默认带 `schemaVersion`，并保留候选、shortlist、LLM 候选池、最终 digest 和规则元数据
- 归档中的证据字段优先保存硬信号，不保存模型自造推断
- 新增归档字段时必须考虑 schema version 和迁移策略
- 旧归档在结构升级后应先执行 `npm run migrate:archives`，而不是长期依赖运行时 `legacy` 兼容路径

## 验证约定

每次涉及代码、规则或工作流改动，至少执行：

1. `npm run format:check`
2. `npm run lint:md`
3. `npm run lint:yaml`
4. `npm run typecheck`
5. `npm test`

如果涉及真实发送链路且本机具备凭据，还应补一次真实终端验证，并保留：

- 执行命令
- 终端可见输出
- 归档文件路径
- 失败时对应的 `data/runtime/failures/*.json`
- GitHub Actions run 链接
- 企业微信群里的可见消息
