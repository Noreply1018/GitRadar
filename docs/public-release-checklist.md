# GitHub 公开前检查清单

这份清单只覆盖 GitRadar 对外公开前最容易露怯的项目入口、治理和仓库后台设置。

## 仓库内容

- [ ] `README.md` 已是对外介绍版本，而不是内部变更说明
- [ ] README、Showcase、Release 使用的主视觉均为 PNG，GitHub 页面可稳定显示
- [ ] `docs/index.html` 与 `docs/site.css` 已可作为 GitHub Pages 首页
- [ ] `CONTRIBUTING.md`、`CODE_OF_CONDUCT.md`、`SECURITY.md`、`SUPPORT.md` 已补齐
- [ ] `.env.example`、截图、文档、脚本输出中无私有 token、账号或本地私有路径

## GitHub About

- [ ] Description 已改成公开仓库使用的一句话介绍
- [ ] Topics 已精简到高相关关键词
- [ ] Homepage 已改成 GitHub Pages 地址
- [ ] Social preview 已上传 `docs/assets/github-pinned-preview.png`

## Release 与入口

- [ ] 默认入口是仓库首页 README
- [ ] GitHub Pages 已部署成功
- [ ] Release 说明页首图已换成 `docs/assets/release-cover-v2.0.0.png`
- [ ] README、Pages、Release 三个入口彼此能跳转

## `main` 保护

注意：当前账号在私有且非 Pro 仓库下无法提前启用 branch protection 或 ruleset。仓库切为公开后，立刻执行下面配置：

- [ ] Require a pull request before merging
- [ ] Require approvals: 1
- [ ] Require status checks:
  - `Secret Scan`
  - `Repo Quality Checks`
- [ ] Require branches to be up to date before merging
- [ ] Include administrators
- [ ] 关闭 `Merge commit`
- [ ] 关闭 `Rebase merge`
- [ ] 保留 `Squash merge`
- [ ] 开启 `Delete branch on merge`

## 公开切换后验证

- [ ] `gh repo view Noreply1018/GitRadar --json visibility,homepageUrl`
- [ ] `gh api repos/Noreply1018/GitRadar/branches/main/protection`
- [ ] 打开仓库首页确认 README 图片正常显示
- [ ] 打开 GitHub Pages 首页确认样式和截图都正常加载
