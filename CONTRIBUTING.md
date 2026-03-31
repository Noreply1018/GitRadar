# Contributing to GitRadar

感谢你愿意参与 GitRadar。

GitRadar 当前优先保持三件事：判断质量、链路稳定、产品表达清晰。提交改动前，请先确认它是在增强这三件事，而不是单纯扩功能。

## 开始之前

- 先阅读 [`README.md`](./README.md) 和 [`docs/development.md`](./docs/development.md)
- 如果改动会影响用户看到的行为，请在描述里明确区分：
  - 代码已改
  - 测试已过
  - 真实终端已验证
- 不要提交真实 token、webhook、账号信息或本地私有路径

## 工作方式

- 小改动直接提 PR
- 较大改动先开 issue 或 draft PR，对齐目标与边界
- 涉及架构调整时，以 [`docs/architecture-roadmap.md`](./docs/architecture-roadmap.md) 为主参考

## 分支与提交

- 默认从 `main` 拉分支
- 分支名建议表达意图，例如：
  - `feat/pages-landing`
  - `fix/readme-assets`
  - `docs/public-repo-prep`
- 提交信息保持短而明确，直接描述结果

## 提交前检查

在提交 PR 前，至少执行：

```bash
npm run format:check
npm run lint:md
npm run lint:yaml
npm run typecheck
npm run test
```

如果改动了展示素材或 README 主视觉，再补：

```bash
npm run render:assets
```

如果改动了本地控制台截图，再补：

```bash
npm run capture:screenshots
```

## Pull Request 期望

PR 描述里请尽量写清楚：

- 这次改动解决什么问题
- 影响哪些入口或文档
- 如何验证
- 是否有未覆盖的风险或后续事项

如果涉及界面或 README 展示，请附截图。

## 不建议的改动方式

- 为了兼容旧语义而堆很多分支逻辑
- 把职责重新揉回一个大脚本里
- 提交生成数据、运行期缓存或本地临时文件
- 在没有验证的情况下宣称某个用户可见行为“已成功”

## 安全问题

如果你发现的是安全漏洞，不要开公开 issue。请按 [`SECURITY.md`](./SECURITY.md) 中的方式私下提交。
