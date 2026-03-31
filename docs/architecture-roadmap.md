# 架构设计与演进方向

## 产品定位

GitRadar 3.0.0 是面向个人和小团队的 GitHub-native 开源日报系统：

- GitHub Actions 负责定时抓取、成稿、发送与归档
- GitHub 仓库负责承载正式归档、运行状态与版本化配置
- 控制台负责阅读、检查状态和轻量管理

## 核心原则

- 单一正式执行器：GitHub Actions
- 单一正式归档源：GitHub 仓库
- 单一正式配置源：仓库配置文件 + GitHub Secrets
- 单一正式状态面：控制台聚合远端正式数据
- 正式链路的任何状态判断，都以仓库内沉淀结果为准

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
- 在模型前完成主要收敛

### 3. Editorial Layer

负责最终日报成稿。

要求：

- 模型只在受限候选池中工作
- 模型只使用系统提供的证据
- 模型失败时可回退模板输出
- 生成结果必须可校验、可归档、可复盘

### 4. Archive Layer

负责把每日结果沉淀为长期资产。

正式落点：

- `data/history/*.json`
- `data/runtime/github-runtime.json`

要求：

- 归档必须带 schema version
- 运行状态必须反映最近一次正式执行
- 控制台默认读取这套远端正式数据

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

反馈数据以仓库中的 `data/feedback/*` 为正式来源，并与归档一起长期沉淀。

## 设计边界

GitRadar 继续保持这些边界：

- 不引入第二套正式运行模式
- 不把敏感配置写入仓库
- 不把前端状态建立在本地副本之上
- 不为了“平台化”过早引入数据库、队列和重后台

## 3.0.0 升级路线图

当前架构方向已经成立，但距离严格意义上的“完全 GitHub native”还有控制面和状态面的改造工作。正式路线图见：

- [`docs/github-native-roadmap.md`](./github-native-roadmap.md)

该路线图按 `P0 / P1 / P2` 收敛了 GitRadar 3.0.0 的具体重构顺序、验收标准和实施清单，用于指导后续去除本地 git 依赖、迁移正式控制面，并补齐 GitHub 原生产品闭环。
