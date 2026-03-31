# 架构设计与演进方向

## 产品定位

GitRadar 3.0.0 的正式定位是：

- 面向个人和小团队的 GitHub-native 开源日报系统
- 由 GitHub Actions 驱动的定时抓取、成稿、发送与归档链路
- 以 GitHub 仓库作为正式归档与非敏感配置载体
- 以前端控制台作为阅读、检查状态和轻量管理入口

它不再以“本地常驻工具”作为主产品定义。

## 核心原则

- 单一正式执行器：GitHub Actions
- 单一正式归档源：GitHub 仓库
- 单一正式配置源：仓库配置文件 + GitHub Secrets
- 控制台默认展示正式远端数据，而不是本地副本
- Local 只保留开发、调试、预览职责

## 当前正式架构

### 1. Source Layer

负责候选发现与补充证据。

当前来源：

- GitHub Trending
- GitHub Search recently updated
- GitHub Search recently created

### 2. Scoring Layer

负责规则筛选、主题识别和候选池构建。

要求：

- 保留结构化打分
- 保持配置化权重
- 支持主题多样性与成熟项目保留
- 持续让规则层在模型前完成主收敛

### 3. Editorial Layer

负责最终日报成稿。

要求：

- 模型只在受限候选池中工作
- 模型只使用系统提供的证据
- 模型失败时可以回退模板输出
- 生成结果必须可校验、可归档、可复盘

### 4. Archive Layer

负责把每日结果沉淀为长期资产。

正式落点：

- `data/history/*.json`
- `data/runtime/github-runtime.json`

要求：

- 归档必须带 schema version
- 运行状态必须能反映最近一次正式执行
- 前端默认读取这套正式远端数据

### 5. Delivery Layer

负责把同一份日报交付到目标通道。

当前正式通道：

- 企业微信群机器人

### 6. Feedback Layer

负责收集用户行为并反哺排序。

当前策略：

- 收藏 / 稍后看 / 跳过
- 主题兴趣轨迹
- 偏好学习提示

反馈目前仍由控制台维护，但不再改变“正式归档在 GitHub”这一事实源。

## 3.0.0 之后不再鼓励的方向

- 把 Docker 常驻当成正式运行形态
- 把本地 `.env` 当成正式配置源
- 把 GitHub / Local 做成双平级正式模式
- 为了平台化而过早引入数据库、队列和重后台
- 围绕本地副本组织前端默认展示逻辑
