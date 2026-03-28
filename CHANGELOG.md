# Changelog

All notable changes to this project will be documented in this file.

The format is based on Keep a Changelog, adapted for a personal project workflow.

## [Unreleased]

## [1.2.0] - 2026-03-28

### Added

- 新增 `config/digest-rules.json` 仓库级 digest 规则配置文件，集中维护主题、黑名单、阈值和打分权重
- 新增 `npm run validate:digest-rules` 规则配置校验命令，支持文本和 JSON 摘要输出
- 新增规则配置结构校验，覆盖空主题、重复关键词、负阈值、非递增 bucket 和缺失权重字段
- 新增 `schemaVersion` 归档模型和 `npm run migrate:archives` 迁移命令，用于批量升级历史归档
- 新增 GitHub Trending 抓取重试、LLM 成稿重试、模板降级和运行期失败报告

### Changed

- Digest 规则从代码常量升级为仓库级可编辑配置，并在加载时强制校验
- CI 现在显式执行 digest 规则配置校验，不再依赖主流程间接暴露配置错误
- 分析与重发主路径现在只接受当前归档 schema，旧归档需要先迁移再使用
- 生成日报时现在会输出结构化日志，并把失败上下文写入 `data/runtime/failures/`
- README 已重写为当前 `1.2.0` 产品形态
- 重写项目规划文档，新增 `docs/architecture-roadmap.md` 作为当前主架构设计与版本路线
- 更新开发规范、推送设计和版本管理文档，替代旧的早期阶段规划

## [1.1.1] - 2026-03-28

### Fixed

- 企业微信群 `markdown` 超过单条字节限制时，改为自动分页发送，而不是截断最后几条日报内容
- 已通过真实终端和真实企业微信群确认分页后的完整消息可见

## [1.1.0] - 2026-03-28

### Added

- 归档新增候选列表、shortlist、LLM 候选池、入选原因、排除原因和规则元数据
- 日报新增 `theme`、`whyNow` 和 `evidence` 字段，支持更可解释的推荐结果
- 新增 `npm run analyze:digest -- --date YYYY-MM-DD` 归档分析命令
- 新增模型输出校验与成熟项目保留约束，避免自由发挥式成稿

### Changed

- 候选筛选从单一排序升级为结构化评分、主题识别和多样性控制
- 企业微信群消息渲染增加主题和证据摘要
- 每日日报默认目标条数从 `3-5` 提高到 `6-8`
- README 与开发文档已收口到证据化日报的当前产品形态

## [1.0.0] - 2026-03-26

### Added

- GitHub Trending + Search 的候选抓取链路
- 基于规则的 shortlist 筛选和基于模型的最终日报生成
- 企业微信群机器人发送、失败告警和历史 JSON 归档
- GitHub Actions 的 `Daily Digest` workflow，支持手动触发和定时触发
- 按日期重发已有归档的 CLI 能力
- 真实终端与真实企业微信群的发送验证流程

### Changed

- 规则筛选增强为更偏向多来源交集、近期活跃和可读 README 的项目
- README、开发规范和版本文档已收口到 `1.0.0` 的产品状态
- 运行日志现在能更清楚地区分生成发送与归档重发

## [0.1.0] - 2026-03-25

### Added

- Initialized the `GitRadar` repository
- Captured the first confirmed product direction for v1
