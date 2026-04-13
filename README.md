# GitRadar

GitRadar 现在只聚焦一件事：每天从 GitHub 挑出少量值得看的开源项目，生成中文摘要，并发送到企业微信。

v1 的最小产品链路是：

1. GitHub Actions 定时运行
2. 抓取候选项目并打分
3. 调用 LLM 生成日报
4. 推送到企业微信
5. 把归档和运行状态写回仓库

## 当前目录

- `src/`：核心逻辑和命令入口
- `tests/`：测试
- `config/`：调度、规则、偏好
- `data/`：归档、运行状态、反馈数据
- `web/`：现有前端代码，暂时不是 v1 核心
- `SPEC/v1/`：v1 规格、删除计划和审计结论

## v1 目标

- 每天稳定收到一条企业微信日报
- GitHub Actions 失败时能清楚暴露原因
- 仓库结构尽量简单，不保留无关治理文件和工具缓存

## 非目标

- 多用户
- 社区治理流程
- 复杂的 Web 控制台优先级高于主链路
- 为 LLM 失败提供模板降级

## 常用命令

```bash
npm install
npm run validate:digest-rules -- --format json
npm run generate:digest
npm run generate:digest -- --send
npm run runtime:github
npm run diagnose:environment
npm run test
npm run typecheck
```

如果需要本地环境变量模板，见 [`docs/examples/development.env.example`](./docs/examples/development.env.example)。

## 许可证

GitRadar 使用 [MIT License](./LICENSE)。
