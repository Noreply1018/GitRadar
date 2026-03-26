# Changelog

All notable changes to this project will be documented in this file.

The format is based on Keep a Changelog, adapted for a personal project workflow.

## [Unreleased]

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
