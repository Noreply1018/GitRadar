# Support

如果你在使用 GitRadar 时遇到问题，先按下面顺序处理：

## 1. 先看文档

- [`README.md`](./README.md)：产品介绍、启动方式、核心入口
- [`docs/development.md`](./docs/development.md)：开发与验证约定
- [`docs/architecture-roadmap.md`](./docs/architecture-roadmap.md)：架构边界与演进方向

## 2. 自查运行环境

优先确认：

- `.env` 是否已按 `.env.example` 配置
- `GITHUB_TOKEN`、`GR_API_KEY`、`GR_BASE_URL`、`GR_MODEL` 是否有效
- 如需发送企业微信，`GITRADAR_WECOM_WEBHOOK_URL` 是否有效
- 本地控制台 `http://127.0.0.1:3210/api/health` 是否可达

## 3. 提 issue

适合提公开 issue 的情况：

- Bug
- 文档错误
- 体验问题
- 新功能建议

提 issue 时请尽量附上：

- 操作系统与 Node.js 版本
- 执行命令
- 终端可见输出
- 是否在 Docker / 本地 Node / Windows 双击启动下复现
- 如果有归档路径，也一起附上

## 4. 安全问题不要公开提

如果你发现的是安全漏洞，请不要开公开 issue，改为使用 [`SECURITY.md`](./SECURITY.md) 里的私密提交通道。
