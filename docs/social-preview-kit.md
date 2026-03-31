# GitRadar 社交传播套件

这页用于统一 GitRadar 在 GitHub Profile、Release 页面和社交平台上的视觉与文案素材。

## 资产清单

- GitHub 仓库置顶预览图：
  [github-pinned-preview.png](./assets/github-pinned-preview.png)
- Release 封面图：
  [release-cover-v2.0.0.png](./assets/release-cover-v2.0.0.png)
- 控制台截图：
  [console-home-github.png](./assets/console/console-home-github.png)
  [console-environment-github.png](./assets/console/console-environment-github.png)
  [console-saved-github.png](./assets/console/console-saved-github.png)
  [console-archive-reader-github.png](./assets/console/console-archive-reader-github.png)
- 企业微信实发样例图：
  [wecom-sample-digest.png](./assets/wecom-sample-digest.png)
- 传播文案：
  [promo-copy.md](./promo-copy.md)
- GitHub Profile 置顶配置清单：
  [profile-pinned-checklist.md](./profile-pinned-checklist.md)

## About 短描述中文版

适合中文语境下介绍 GitRadar 的一句话短描述：

```text
一个带证据化中文日报、反馈闭环、可复盘归档和本地控制台的 GitHub 开源项目发现雷达。
```

更偏产品口径的一版：

```text
一个可解释的 GitHub 开源兴趣雷达，不只告诉你今天什么项目热，还会逐渐学会你真正关心什么。
```

## GitHub 仓库置顶图建议

适用场景：

- GitHub Profile pinned repo 截图
- 发群或发帖时作为仓库卡片配图
- 用作 README / showcase 的附加视觉素材

建议使用：

- [github-pinned-preview.png](./assets/github-pinned-preview.png)

## Release 封面图建议

适用场景：

- GitHub Release 说明页首图
- 社交平台发版海报
- 发群同步版本更新时的封面图

建议使用：

- [release-cover-v2.0.0.png](./assets/release-cover-v2.0.0.png)

## 控制台截图建议

适用场景：

- README 首页展示
- 展示页说明当前产品状态
- 向别人证明“这已经不是概念图，而是真实本地控制台”

建议组合：

1. 首页总览：`console-home-github.png`
2. 环境配置：`console-environment-github.png`
3. 收藏与轨迹：`console-saved-github.png`
4. 归档阅读：`console-archive-reader-github.png`

## 组合使用建议

如果你要在 GitHub 和社交平台同步发布 GitRadar，推荐顺序：

1. GitHub About 使用中文版短描述
2. README 与展示页优先使用真实控制台截图
3. Profile pinned repo 或仓库推广使用置顶预览图
4. Release 页面使用 `release-cover-v2.0.0.svg`
5. 想强调“这不是概念图”时，再补企业微信实发样例图

## 兼容性约定

- GitHub README、Showcase、Release 和 Social Preview 默认优先使用 PNG
- 同名 SVG 保留为设计源文件，便于后续重新导出
- 更新 SVG 后，执行 `npm run render:assets` 同步生成公开展示所用 PNG

## 关联文档

- [README](../README.md)
- [展示页](./showcase.md)
- [传播文案](./promo-copy.md)
- [GitHub Profile 置顶配置清单](./profile-pinned-checklist.md)
