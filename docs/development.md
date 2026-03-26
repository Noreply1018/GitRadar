# 开发规范

## 当前阶段

GitRadar 当前处于 `1.0.0` 稳定版阶段，目标是保持“个人可稳定日用”。

当前已经落地的能力：

- GitHub 候选抓取
- 规则筛选
- 模型摘要生成
- 本地历史归档
- 企业微信群机器人发送
- GitHub Actions 定时与手动触发
- 按日期重发已有归档

后续开发默认围绕“把这条链路做稳、做准、做易维护”推进，而不是盲目扩功能面。

## 目录约定

- `src/`：应用核心逻辑与命令入口
- `tests/`：单元和集成测试
- `scripts/`：手动运维、重发、调试脚本
- `config/`：配置说明和模板约定
- `data/history/`：日报归档
- `data/runtime/`：运行期临时数据，不入库
- `data/cache/`：抓取缓存，不入库
- `data/exports/`：导出结果，不入库

根目录只保留仓库级文件，不把运行结果和一次性脚本直接堆在顶层。

## 开发原则

- 所有对用户可见的发送行为，都要区分“代码已改”“测试已过”“真实终端已验证”
- 没有真实终端复现和群内可见结果时，不报告“企业微信已成功跑通”
- 新增入口优先复用已有主流程，避免本地命令和 CI 工作流出现两套逻辑
- 敏感配置不入库，统一通过 `.env` 或 GitHub Secrets 注入
- 本地环境变量名和 CI 运行时环境变量名尽量保持一致；GitHub token 因平台限制在 Actions 中使用 `GITRADAR_GITHUB_TOKEN`

## CI 与自动化

当前仓库包含两类工作流：

- `CI`：格式、Markdown、YAML、类型检查、测试、workflow lint
- `Daily Digest`：日报生成、企业微信发送、失败告警

涉及代码或架构改动时，推送到 `main` 后需要等待 CI 完成。

## 运行约定

- 日报默认每天 `08:00` 中国时间触发一次
- 也支持 GitHub Actions 手动触发
- 本地主入口是 `npm run generate:digest`
- 真实发送入口是 `npm run generate:digest -- --send`
- 补发入口是 `npm run generate:digest -- --resend-date YYYY-MM-DD`
- 失败告警和成功日报使用不同消息标题，避免群里混淆

## 验证约定

每次涉及推送链路的改动，至少做以下核验：

1. `npm run format:check`
2. `npm run lint:md`
3. `npm run lint:yaml`
4. `npm run typecheck`
5. `npm test`

如果本机具备真实凭据，还应补一次真实终端验证，并保留：

- 执行命令
- 可见输出
- 归档文件路径
- 企业微信群内实际收到的消息
