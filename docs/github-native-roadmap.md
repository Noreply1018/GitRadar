# GitRadar 3.0.0 完全 GitHub Native 升级路线图

## 目标定义

这份路线图采用严格的 GitHub native 标准。GitRadar 3.0.0 的完成态不是“本地工具 + GitHub 托管”，而是：

- 正式执行只由 GitHub Actions 驱动
- 正式配置读写通过 GitHub 平台接口完成，不依赖本地 `git push`
- 正式状态直接来自 GitHub run、repo contents 和环境诊断结果
- 正式管理入口运行在 GitHub 上，不依赖本地常驻控制台
- 本地 CLI 与本地控制台只保留为开发调试工具

## 当前差距总结

当前仓库已经具备 GitHub-native 方向，但还没有完成正式控制面的 GitHub 原生化，主要缺口集中在这些方面：

- 正式读写链路仍依赖本地 `git fetch`、`git show`、`git commit`、`git push`
- 控制台仍依赖本地 Node HTTP 服务，而不是 GitHub Pages 或其他 GitHub 内入口
- 正式写操作没有 GitHub 内闭环入口，配置修改与反馈记录仍由本地 API 服务执行
- 状态面大量依赖仓库文件推断，缺少 GitHub run、环境校验和配置版本的直接聚合
- 仓库、分支与运行上下文仍有默认写死语义，不够平台化
- 发布、补发、手动触发、诊断和归档索引还没有形成完整 GitHub 原生产品闭环

## P0：远端正式闭环

P0 的目标是去掉“看起来 GitHub native、实际上依赖本地 git”的假原生层，把正式控制链路改成真正的远端闭环。

### 1. 替换正式读写链路中的本地 git 依赖

- 删除正式控制链路对 `git fetch`、`git show`、`git add`、`git commit`、`git push` 的依赖
- 为 `config/*`、`data/history/*`、`data/runtime/*`、`data/feedback/*` 建立 GitHub Contents API 读写能力
- 所有正式读操作都直接读取 GitHub 仓库正式内容，而不是先同步到本地副本再读取
- 所有正式写操作都带 commit message、目标 branch 和 sha 冲突检测

### 2. 建立统一的 GitHub 平台客户端层

- 新建统一的平台客户端，承接 GitHub 管理面能力，而不是继续分散在服务层里直接拼接请求
- 平台客户端至少覆盖 repo contents、workflow runs、workflow dispatch、仓库元信息和默认分支查询
- 候选仓库抓取 API 与 GitHub 平台管理 API 分层，避免语义混杂

### 3. 重构正式状态模型

- 将“最近一次运行结果”与“环境是否配置完成”拆成独立状态
- 新增环境状态层，明确 GitHub、LLM、企业微信三个环境面的配置完整性和最近校验结果
- 前端与 API 不再使用“最近一次运行成功”推断“环境已配置”
- 保留 `data/runtime/github-runtime.json`，但把它收敛为执行状态快照，而不是唯一状态来源

### 4. 收敛正式写操作入口

- 配置修改通过 GitHub 平台接口直接落仓库正式文件
- 反馈写入通过 GitHub 平台接口或专用工作流回写仓库数据
- 手动执行和补发通过 workflow dispatch 触发，不再依赖本地命令承担正式职责
- 所有正式动作都必须能追溯到 GitHub commit 或 GitHub Actions run

### P0 验收标准

- 正式读写链路不再依赖本地 `git`
- 没有本地工作树时，仍可读取正式归档和正式配置
- 配置修改与反馈记录都能直接落到 GitHub 仓库
- 状态面可以区分“运行失败”“环境缺失”“尚未校验”三类不同问题

## P1：控制面迁入 GitHub

P1 的目标是把“管理 GitRadar”这件事迁入 GitHub 平台本身，让本地控制台退出正式入口角色。

### 1. 将控制台重构为 GitHub Pages 正式入口

- 把当前前端重构为适合 GitHub Pages 部署的静态控制台
- 控制台正式入口不再要求用户本地运行 `npm run start:console`
- 浏览归档、查看运行状态、查看环境诊断和触发正式动作应当都能从 GitHub 上完成

### 2. 重做配置变更流

- 支持个人模式下直接提交到默认分支
- 支持治理模式下创建配置变更 PR，由用户在 GitHub 中 review 和合并
- 配置变更流保留明确的 commit 记录、审查边界和校验入口

### 3. 拆分正式工作流

- `daily-digest.yml` 只负责定时生成、发送、归档与执行状态回写
- 新增配置校验工作流，专门处理 `config/*.json` 的校验与阻断
- 新增反馈同步工作流，专门处理反馈回写与聚合
- 新增控制台部署工作流，负责 GitHub Pages 构建与发布

### 4. 建立 GitHub 原生手动操作入口

- 支持手动触发当天 digest
- 支持指定日期补发归档
- 支持手动重建 runtime 状态
- 支持手动验证 secrets 与环境连通性
- 所有正式手动动作都通过 GitHub Actions dispatch 入口执行

### P1 验收标准

- 用户不启动本地服务也能完成正式管理
- GitHub Pages 成为正式控制台入口
- 正式手动操作都可通过 GitHub 内入口完成
- 工作流职责边界清晰，不再把所有动作塞进单一日报工作流

## P2：补齐完整产品闭环

P2 的目标是把 GitRadar 从“架构上已原生”补完为“作为 GitHub 原生产品可长期使用、治理和发布”。

### 1. 建立正式归档索引与运行历史

- 新增归档索引数据，供控制台高效展示历史日报
- 新增运行历史数据，沉淀最近多次正式执行结果
- 控制台可直接展示最近归档、运行成功率、失败原因和配置影响范围

### 2. 建立环境诊断报告

- 新增正式环境诊断产物，覆盖 GitHub token、LLM、企业微信和默认分支上下文
- 明确区分“secret 缺失”“权限不足”“网络不可达”“上游返回异常”等错误类型
- 控制台直接展示最近一次正式环境诊断，而不是仅展示映射说明

### 3. 接入 GitHub Release 与版本化发布

- 版本 tag、release notes 和发布产物进入 GitHub Release 正式流程
- 版本变更与 schema 或数据语义变更同步记录
- 控制台和 README 统一展示当前稳定版本和发布入口

### 4. 完成 GitHub 原生治理

- 为配置、工作流和正式数据目录补齐 CODEOWNERS 与保护边界
- 配置校验进入 PR 必过检查
- 发布、回滚、配置变更和问题追踪都纳入 GitHub 原生治理流程

### P2 验收标准

- 归档、运行历史、环境诊断和版本发布全部 GitHub 化
- GitRadar 的正式使用路径不要求本地终端
- README 可以明确声明“本地仅开发调试，GitHub 即正式产品本体”

## 具体重构顺序

建议按下面顺序推进，避免在旧控制面上叠新功能：

1. 抽象 GitHub 平台客户端，替换正式读路径中的本地 `git`
2. 替换配置和反馈写路径中的本地 `git` 提交与推送
3. 重构 runtime 与 environment 状态模型
4. 让前端面向 GitHub 平台数据模型，弱化本地 `server.ts`
5. 拆分正式工作流：日报、配置校验、反馈同步、Pages 部署
6. 部署 GitHub Pages 控制台，形成正式入口
7. 增加 dispatch 类正式动作：重跑、补发、环境诊断
8. 增加归档索引、运行历史与环境诊断报告
9. 接入 release、tag 和 GitHub 治理规则

## 实施清单

### P0 清单

- 新增 GitHub 平台客户端模块，统一封装 repo contents、workflow runs 和 dispatch
- 删除正式读写链路中对本地 `git` 命令的直接依赖
- 重写配置保存、反馈写入和远端归档读取的正式实现
- 为正式状态新增环境层模型和 API 返回字段
- 重写控制台环境页的状态判断逻辑，去掉“最近一次成功即已配置”的推断

### P1 清单

- 把控制台改造成可部署到 GitHub Pages 的静态前端
- 为配置修改建立“直接提交”和“PR 提交”两种 GitHub 原生流
- 拆分 `daily-digest.yml`，新增配置校验、反馈同步和 Pages 部署工作流
- 为手动重跑、补发、环境校验设计 workflow dispatch 输入
- 调整 README 和文档，明确本地控制台退出正式入口角色

### P2 清单

- 新增归档索引和运行历史正式数据文件
- 新增正式环境诊断报告与展示逻辑
- 接入 GitHub Releases 发布流程
- 补齐 CODEOWNERS、必过检查与发布治理约束
- 重写 README，明确 GitHub 是正式产品入口，本地命令仅用于开发复现

## 默认决策

这份路线图默认采用以下决策，后续实现时不再重复犹豫：

- “完全 GitHub native”按严格标准定义，而不是“GitHub 承载即可”
- 优先删掉旧的本地控制面语义，而不是继续兼容双正式入口
- GitHub Pages 是默认正式控制台入口
- GitHub Actions dispatch 是默认正式手动操作入口
- 本地 CLI 与本地 Web API 保留为开发调试设施，不再承担正式管理职责
