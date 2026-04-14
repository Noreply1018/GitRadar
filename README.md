# GitRadar

GitRadar 现在只保留一条最小主链路：每天从 GitHub 抓取候选项目，筛选后调用 LLM 生成中文日报，并发送到企业微信。

当前仓库只保留：

1. GitHub Actions 定时运行
2. 抓取候选项目并打分
3. 调用 LLM 生成日报
4. 推送到企业微信
5. 把归档和运行状态写回仓库

## 当前目录

- `src/`：日报主链路代码
- `config/`：规则与调度配置
- `data/`：归档与运行状态
- `.github/workflows/`：日报 workflow 与 CI

## v1 目标

- 每天稳定收到一条企业微信日报
- GitHub Actions 失败时能清楚暴露原因
- 仓库结构尽量简单，只保留主链路资产

## 非目标

- Web 控制台
- 反馈系统与偏好回写
- 环境诊断侧链
- LLM 模板降级

## 常用命令

```bash
npm install
npm run validate:digest-rules -- --format json
npm run generate:digest
npm run generate:digest -- --send
npm run runtime:github
npm run typecheck
```

## 许可证

GitRadar 使用 [MIT License](./LICENSE)。
