# GitRadar v1 审计结论

本文件审计的是当前 `SPEC/v1` 方案是否符合“只做一个最简单的产品，保持目录简单、有层次”的目标。

结论先说：

- 现在的 v1 计划并不够小
- 文档目标写的是“最简单产品”，但执行范围仍然包含 Web 控制台、配置回写、反馈闭环、Pages 部署、环境诊断、历史兼容等次级系统
- 如果按当前计划推进，结果大概率不是一个简单产品，而是一个被拆成多个 Phase 的复杂系统

## 1. 欠缺

### 1.1 缺少真正的 v1 砍线

当前规格没有明确写出：

- 哪些功能必须进 v1
- 哪些功能明确延后
- 哪些目录只是历史遗留，不属于 v1

结果是“Phase 1 是核心，后面再补”看起来像收敛，实际上仍然把大量非核心系统留在 v1 范围内。

建议直接把 v1 定义为：

1. GitHub Actions 定时运行
2. GitHub Trending / Search 抓候选
3. 评分筛选
4. LLM 生成日报
5. 企业微信推送
6. 归档到 `data/history/`
7. 回写 `data/runtime/github-runtime.json`

除这 7 项外，全部默认不属于 v1。

### 1.2 缺少目录级别的删减目标

`deletion-plan.md` 主要删的是语义和局部代码，但没有把“哪些目录整个不该继续扩张”说清楚。

至少应该补一个目录级别结论：

- `web/` 不是 v1 核心
- `data/feedback/` 不是 v1 核心
- `.github/workflows/console-writeback.yml` 不是 v1 核心
- `.github/workflows/pages-deploy.yml` 不是 v1 核心
- `.github/workflows/environment-diagnose.yml` 不是 v1 核心

### 1.3 缺少“完成定义”

当前 Phase 1 的验收偏运行结果，但没有一个极简的 DoD。

建议补成：

- 连续 3 天准时收到企微日报
- 非命中时间槽的 cron run 全部 `exit 0`
- 当日失败时有清晰日志和失败通知
- 归档与 runtime 文件成功回写
- 删除与主链路无关的仓库治理残留和工具缓存

## 2. 冲突

### 2.1 “最简单产品” 和 “完整保留 Web 控制台 + 反馈系统” 冲突

`SPEC/v1/README.md` 和 `product-design.md` 把以下内容定为保留：

- 完整 Web 控制台
- 配置修改
- 反馈提交
- 反馈闭环
- GitHub Pages 部署

这和“只做最简单产品”直接冲突。

如果主目标是“每天稳定收到企微日报”，那 Web 控制台和反馈系统都应降级为 v1 之后再考虑，而不是写进 v1 主体。

### 2.2 “纯 GitHub-native” 和 “本地端到端验收是核心步骤” 表述冲突

ADR-003 说生产模式是纯 GitHub-native，但 `rebuild-plan.md` 仍把本地端到端作为关键任务项。

本地运行可以保留为调试手段，但不应被写成核心里程碑，否则会让人误以为本地跑通等于正式链路成立。

### 2.3 “保持简单” 和 “cron 每 5 分钟轮询 + 环境诊断每小时运行” 冲突

两个周期性 workflow 同时存在：

- `daily-digest.yml`：每 5 分钟
- `environment-diagnose.yml`：每小时

对于最小产品，这属于明显扩张。主链路还没跑稳之前，不应再维护第二条定时诊断链路。

### 2.4 “删除不需要的治理文件” 和 “README 仍把治理当正式入口” 冲突

在清理前，README 仍然把：

- `SECURITY.md`
- `CONTRIBUTING.md`
- `CODE_OF_CONDUCT.md`
- PR 模板

列为正式项目治理入口。这和个人单用户产品定位冲突。

## 3. 语义不明确

### 3.1 “v1” 到底是最小可用版，还是完整产品版

当前文档同时表达了两种意思：

- v1 是“先跑通企微日报”的最小版
- v1 又包含 Web、反馈、Pages、写回、稳定化、发布等完整产品面

这会直接导致优先级失真。需要二选一。

建议定义为：

- v1 = 最小可运行日报链路
- v1.1 或后续版本 = Web 浏览、反馈、写回

### 3.2 “当日跳过” 的系统语义不明确

文档多处写“LLM 失败则当日跳过”，但没明确：

- 是否写 failure archive
- 是否写 runtime failure
- 是否发企微失败通知
- workflow 最终应标记 success 还是 failure

这些都必须明确，否则代码会各自实现一套理解。

建议固定为：

- 不生成正式日报归档
- 必须写 runtime failure
- 可以发失败通知
- workflow 应失败退出，便于定位

### 3.3 “GitHub 不发大量垃圾邮件” 的实现语义不明确

文档把它当验收标准，但没有把技术动作写清楚。

至少要说明：

- 非命中时间槽必须 `exit 0`
- 非执行 run 不发送任何失败通知
- 真正失败才允许 workflow 失败

### 3.4 “Web 控制台可用” 的定义过宽

如果以后真的要做 Web，这里的“可用”至少应拆成：

- 只读浏览
- 配置修改
- 反馈提交

这三者复杂度不同，不该被写成同一层级任务。

## 4. 删除不干净

### 4.1 已确认的治理残留

这批文件不属于最简单产品，已经删除：

- `CODE_OF_CONDUCT.md`
- `CONTRIBUTING.md`
- `SUPPORT.md`
- `SECURITY.md`
- `.github/ISSUE_TEMPLATE/*`
- `.github/pull_request_template.md`
- `.github/CODEOWNERS`
- `.github/dependabot.yml`
- `.omx/`

### 4.2 仍然没有删干净的方向性残留

下面这些虽然还没删，但从“最简单产品”角度看，已经应被降级为非 v1：

- `web/`
- `src/feedback/`
- `data/feedback/`
- `.github/workflows/console-writeback.yml`
- `.github/workflows/pages-deploy.yml`
- `.github/workflows/environment-diagnose.yml`

这些不是说必须立刻物理删除，而是不能再继续被写成 v1 必做。

## 5. 可以优化的点

### 5.1 把 Phase 重写成两段，而不是五段

更合适的版本：

#### Phase A: 最小日报主链路

- 删除 fallback
- 统一 Node 版本
- 跑通 GitHub Actions 主链路
- 跑通企业微信发送
- 跑通归档和 runtime 回写
- 清理治理文档和工具残留

#### Phase B: 可选增强

- environment diagnose
- Web 浏览
- 配置回写
- 反馈系统
- Pages 部署

这样优先级才不会漂移。

### 5.2 先冻结目录，再做代码重构

现在的计划偏向“边删边重构”。更稳妥的顺序是：

1. 先决定 v1 保留哪些目录
2. 再决定哪些 workflow 还算正式链路
3. 再改代码

否则目录和规格会持续打架。

### 5.3 把 README 收缩成产品说明，不再兼任治理入口

README 应只保留：

- 项目是什么
- v1 只做什么
- 目录说明
- 常用命令

不要再承载社区治理、复杂控制台、长期路线图的入口语义。

## 6. 建议的最终 v1 边界

建议你把 GitRadar v1 明确定义成下面这版：

- 一个单用户、单仓库、单推送渠道的日报工具
- 只有一条正式主链路：抓取 -> 评分 -> 成稿 -> 推送 -> 归档
- 只有一个核心目标：每天稳定收到企微日报
- Web、反馈、写回、Pages 都不进入 v1 完成定义

如果按这个边界推进，仓库会明显更简单，后续每次删东西也会更有依据。
