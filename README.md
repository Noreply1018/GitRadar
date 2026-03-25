# GitRadar

GitRadar 是一个面向个人使用的开源项目发现工具。

目标是每天自动抓取 GitHub 上值得关注的开源项目，并以一种低维护、低噪音的方式呈现出来，帮助我快速判断今天有哪些项目值得看、值得收藏、值得后续跟进。

## 项目状态

当前处于产品定义阶段，功能尚未开始实现。

已经确定的方向：

- 面向个人使用，不做多用户产品
- 第一版只看 `GitHub`
- 追求 `少而准`，不是全量热门搬运
- 每天推送 `5 个以内`
- 推送通道优先级：`Telegram` 和 `企业微信`
- 支持 `每天早上 8 点固定推送 + 手动触发补抓`
- 至少保留 `本地历史归档`
- 可接入模型 API 做摘要和筛选增强

## GitRadar v1 定义

GitRadar v1 是一个“每日精选开源项目雷达”：

- 每天自动抓取 GitHub 候选项目
- 自动筛出少量真正值得看的项目
- 通过手机上方便查看的推送通道直接发给我
- 每个项目除了链接，还要解释为什么值得看
- 本地保存每天的历史结果，方便后续回看和演进

## 每条项目卡片要回答的问题

- 它是干什么的
- 为什么值得看
- 和别的项目相比新在哪
- 我适不适合点进去深看
- 最近热度是否明显上升

## 文档索引

- [产品蓝图](./docs/blueprint.md)
- [推送方案](./docs/push-delivery.md)
- [版本管理说明](./docs/versioning.md)
- [变更记录](./CHANGELOG.md)
- [开发规范](./docs/development.md)

## 目录结构

```text
GitRadar/
├── .github/workflows/   # CI 工作流
├── config/              # 配置模板与示例配置
├── data/
│   ├── cache/           # 本地缓存，默认不入库
│   ├── exports/         # 导出结果，默认不入库
│   ├── history/         # 历史归档说明和结构定义
│   └── runtime/         # 运行期临时文件，默认不入库
├── docs/                # 蓝图、规范、版本文档
├── scripts/             # 手动触发和运维脚本入口
├── src/                 # 业务实现代码
├── CHANGELOG.md
├── package.json
└── README.md
```

当前仓库已经按这个结构预留目录，后续实现会沿着这个布局推进，避免脚本、配置和数据混放在根目录。

## 当前可运行能力

当前已经实现了企业微信群机器人的最小可用发送链路：

- 统一的 `DailyDigest` 数据结构
- `Notifier` 抽象
- `WecomRobotNotifier` 实现
- 示例日报手动发送命令
- Markdown 长度控制和 webhook 脱敏日志

本地试跑方式：

```bash
cp .env.example .env
# 填入真实 webhook
npm run send:wecom:sample
```

如果未配置 webhook，命令会直接报错退出；只有在真实终端执行并在企业微信群看到消息后，才算完成真实发送验证。

## 当前可运行数据链路

当前已经支持一条完整的手动生成链路：

- 抓取 GitHub Trending
- 调 GitHub Search API 补充候选
- 规则初筛到约 20 个候选项目
- 调模型生成最终 `DailyDigest`
- 写入 `data/history/YYYY-MM-DD.json`
- 显式加 `--send` 时再推送到企业微信

本地生成方式：

```bash
cp .env.example .env
# 填入 GITHUB_TOKEN / GR_API_KEY / GR_BASE_URL / GR_MODEL
npm run generate:digest
```

生成后可选发送：

```bash
npm run generate:digest -- --send
```

调试时如果需要把 GitHub Trending、GitHub API 或模型接口指到本地 mock 服务，可以使用：

- `GR_GH_API_URL`
- `GR_GH_TRENDING_URL`
- `GR_BASE_URL`

## 当前约束

第一版优先考虑：

- 每日定时抓取
- 基础筛选和排序
- 生成少量高质量项目卡片
- Telegram 推送
- 企业微信群机器人推送
- 本地历史归档

第一版暂不默认纳入：

- 多用户系统
- 社交互动
- 复杂推荐算法
- 大而全的数据平台
- 过度依赖高成本外部服务

## 下一步

下一轮会继续明确这些实现细节：

1. GitHub 候选项目的抓取口径
2. “有意思”和“前沿”的实际筛选规则
3. 推送消息的最终版式
4. 本地历史归档的存储格式
5. 模型 API 在流程里的具体位置
