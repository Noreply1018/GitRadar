# CLAUDE.md

本文件为 Claude Code 在本仓库中工作时提供约束与背景说明。

## 用户约束

- 使用中文回复用户。
- 大量改动代码后记得 `git commit`。

## GitRadar 是什么

GitRadar 是一个单用户、GitHub-native 的开源项目日报工具。

它只做一条最小主链路：

1. 从 GitHub 抓取候选项目
2. 进行规则筛选与排序
3. 调用 LLM 生成中文日报
4. 推送到企业微信
5. 将归档和运行状态写回仓库

生产环境完全运行在 GitHub Actions 上，本地只用于调试和验证。

## 当前状态

仓库已经做过一次大清扫，当前只保留最小日报主链路。

这些内容已经不再属于当前仓库：

- Web 控制台
- 反馈系统
- 配置回写工作流
- 环境诊断侧链
- `SPEC/v1/`、`SPEC/v2/`
- 自动化测试目录

不要再按旧的多子系统结构扩展本仓库。

## 常用命令

```bash
# 依赖安装
npm install

# 类型检查
npm run typecheck

# 校验日报规则配置
npm run validate:digest-rules -- --format json

# 本地生成日报
npm run generate:digest

# 本地生成并发送到企业微信
npm run generate:digest -- --send

# 写入 GitHub runtime 状态
npm run runtime:github

# 将归档与 runtime 文件通过 GitHub API 写回仓库
npm run persist:github
```

## 架构

当前主链路可分为五层：

1. **数据来源**：`src/github/candidates.ts`、`src/github/trending.ts`
   - 从 GitHub Trending 和 Search API 获取候选仓库
2. **规则筛选**：`src/digest/rules.ts`
   - 主题推断、评分、黑名单过滤、主题多样性控制
3. **成稿**：`src/digest/model.ts`
   - 调用 OpenAI 兼容接口，解析 JSON，校验成稿质量
4. **归档**：`src/core/archive.ts`
   - 写入 `data/history/YYYY-MM-DD.json`
5. **投递**：`src/notifiers/wecom-robot.ts`
   - 渲染企业微信 Markdown，并按字节限制分页

编排入口：

- `src/digest/generate.ts`
- `src/commands/generate-daily-digest.ts`

GitHub 仓库读写统一通过：

- `src/github/platform-client.ts`

不要引入 git CLI 作为正式写回手段。

## 关键约束

- **LLM 必须成功**
  - 不允许模板降级
  - 失败时重试 3 次，之后直接抛错
- **非命中时间槽必须安静退出**
  - 定时工作流每 5 分钟触发一次
  - 只有命中配置时间的那次才真正执行主链路
- **LLM 失败就是失败**
  - 不生成正式日报归档
  - 工作流应失败退出
  - 可发送企业微信失败通知
- **Node 版本统一**
  - 当前工作流统一使用 Node 24

## 目录说明

```text
src/commands/   命令入口
src/core/       核心模型、日期工具、日志、归档 schema
src/digest/     主链路编排、LLM 成稿、规则筛选
src/github/     GitHub API 获取与写回
src/config/     环境变量、规则配置、调度配置
src/notifiers/  企业微信机器人
src/utils/      通用异步工具
config/         仓库内配置文件
data/runtime/   运行状态
.github/workflows/
                GitHub Actions 工作流
```

## 配置文件

- `config/schedule.json`
  - 发送时间与时区
- `config/digest-rules.json`
  - 主题、黑名单、阈值、评分权重

敏感信息不入库，只通过 GitHub Secrets 或本地环境变量提供：

- `GITRADAR_GITHUB_TOKEN`
- `GR_API_KEY`
- `GR_BASE_URL`
- `GR_MODEL`
- `GITRADAR_WECOM_WEBHOOK_URL`

本地环境变量模板见：

- `docs/examples/development.env.example`

## 工作方式

- 优先保持仓库简单，不要为了“以后可能用到”重新引入已删除系统。
- 修改主链路时，优先维护现有最小结构，而不是补回历史功能。
- 如果需要新增能力，先判断它是否属于“日报主链路”；不属于时应谨慎，默认不加。
