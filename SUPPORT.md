# Support

如果 GitRadar 3.0.0 出现问题，请先按正式链路排查。

## 1. 先看核心文档

- [`README.md`](./README.md)
- [`docs/architecture-roadmap.md`](./docs/architecture-roadmap.md)
- [`docs/development.md`](./docs/development.md)
- [`config/README.md`](./config/README.md)

## 2. 先检查远端工作流

优先确认：

- `Daily Digest` 工作流是否启用
- 最近一次 GitHub Actions 运行是否成功
- GitHub Secrets 是否完整
- 仓库里是否已经生成 `data/history/*.json`
- `data/runtime/github-runtime.json` 是否有最近状态

## 3. 检查正式配置

- `config/schedule.json` 是否符合预期
- `config/digest-rules.json` 是否被错误修改
- `config/user-preferences.json` 是否符合当前偏好
- `GITRADAR_GITHUB_TOKEN`、`GR_API_KEY`、`GR_BASE_URL`、`GR_MODEL`、`GITRADAR_WECOM_WEBHOOK_URL` 是否已在 GitHub Secrets 中配置

## 4. 提 issue 时请附带

- GitHub Actions 运行链接
- 失败步骤名称
- 日志中的可见报错
- 涉及的归档日期
- 控制台页面看到的状态或截图

## 5. 安全问题不要公开提

如果你发现的是安全漏洞，请不要开公开 issue，改为使用 [`SECURITY.md`](./SECURITY.md) 中的私密提交通道。
