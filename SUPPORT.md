# Support

如果你在使用 GitRadar 3.0.0 时遇到问题，先按下面顺序排查。

## 1. 先看文档

- [`README.md`](./README.md)
- [`docs/architecture-roadmap.md`](./docs/architecture-roadmap.md)
- [`docs/development.md`](./docs/development.md)
- [`config/README.md`](./config/README.md)

## 2. 先确认你走的是哪条链路

GitRadar 3.0.0 的正式链路是 GitHub Actions。

优先确认：

- `Daily Digest` 工作流是否启用
- GitHub Secrets 是否完整
- 仓库里是否已经生成 `data/history/*.json`
- `data/runtime/github-runtime.json` 是否有最近状态

如果你只是本地打开控制台，请不要把“本地服务能打开”误认为“正式日报已经成功运行”。

## 3. 自查关键配置

- `config/schedule.json` 是否符合预期
- `config/digest-rules.json` 是否被错误修改
- `config/user-preferences.json` 是否符合当前偏好
- `GITRADAR_GITHUB_TOKEN`、`GR_API_KEY`、`GR_BASE_URL`、`GR_MODEL`、`GITRADAR_WECOM_WEBHOOK_URL` 是否已在 GitHub Secrets 中配置

## 4. 提 issue 时请附上这些信息

- GitHub Actions 运行链接
- 失败步骤名称
- 终端或 Actions 日志中的可见报错
- 涉及的归档日期
- 是否是本地开发态复现，还是远端正式链路复现

## 5. 安全问题不要公开提

如果你发现的是安全漏洞，请不要开公开 issue，改为使用 [`SECURITY.md`](./SECURITY.md) 里的私密提交通道。
