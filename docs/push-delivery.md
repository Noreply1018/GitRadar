# 推送方案

## 目标

GitRadar 的推送层要满足这几个条件：

- 手机上打开就能看
- 个人自用成本低
- 尽量用官方能力
- 不把核心流程绑死在某一个平台

## 当前结论

当前建议采用两级方案：

1. 第一阶段支持：
   - `Telegram`
   - `企业微信群机器人`
2. 第二阶段预留：
   - `企业微信应用消息`

当前不建议作为第一阶段方案：

- 微信服务号模板消息
- 微信小程序订阅消息
- 非官方个人微信自动化方案

## 为什么这样选

### Telegram

优点：

- 对个人项目最直接
- Bot 创建和推送实现简单
- 调试成本低
- 适合先把 GitRadar 的内容链路做通

不足：

- 更偏开发者工具风格
- 不如微信生态贴近日常使用习惯

### 企业微信群机器人

这是当前最适合“微信里看 GitRadar”的第一阶段方案。

优点：

- 使用官方能力
- 开发成本低
- 只需要一个机器人 `webhook`
- 很适合每天固定推送一条精选结果
- 可以直接发 `markdown`、`text`、`news` 类型消息

不足：

- 不是发到个人微信私聊，而是发到企业微信群
- 样式能力比网页弱，但足够做日报卡片

适配结论：

- 如果你的目标是“在微信里看”
- 又不想一开始就做很重的平台接入
- 企业微信群机器人是最合适的方案

官方参考：

- [企业微信消息推送配置说明](https://developer.work.weixin.qq.com/document/path/91770)

### 企业微信应用消息

这是更正式、控制力更强的企业微信方案。

优点：

- 可以按应用方式发送消息
- 更适合后续扩展成命令交互和状态通知
- 更适合长期演进

不足：

- 要准备 `corpid`、`corpsecret`、`agentid`
- 需要先获取 `access_token`
- 配置和维护成本高于群机器人

适配结论：

- 适合作为第二阶段能力
- 不适合在 GitRadar 第一版就先上

官方参考：

- [发送应用消息](https://developer.work.weixin.qq.com/document/path/90236)
- [获取 access_token](https://developer.work.weixin.qq.com/document/path/91039)

### 微信服务号模板消息

不建议作为当前阶段方案。

原因：

- 更依赖公众号体系
- 模板和行业配置链路更重
- 对“个人自用、每日推送 GitRadar”来说过度复杂

官方参考：

- [模板消息](https://developers.weixin.qq.com/doc/offiaccount/Message_Management/Template_Message_Interface.html)

### 微信小程序订阅消息

也不建议作为当前阶段方案。

原因：

- 更适合小程序场景
- 订阅消息机制本身更强调模板和用户订阅动作
- 为了 GitRadar 每日推送去先做小程序壳子，收益太低

官方参考：

- [发送订阅消息](https://developers.weixin.qq.com/miniprogram/dev/OpenApiDoc/mp-message-management/subscribe-message/sendMessage.html)

## GitRadar 内部实现建议

推送能力不应该写死在抓取流程里，而应该抽象成一个统一接口。

建议结构：

```ts
interface Notifier {
  sendDailyDigest(digest: DailyDigest): Promise<void>;
}
```

第一阶段实现：

- `TelegramNotifier`
- `WecomRobotNotifier`

第二阶段可扩展：

- `WecomAppNotifier`

这样可以保证：

- 抓取和筛选逻辑不依赖具体平台
- 以后切换或增加推送通道时，不需要改主流程

## 建议的数据流

1. 定时任务在每天 `08:00` 触发
2. 抓取 GitHub 候选项目
3. 过滤、排序、模型摘要
4. 产出当天最终 digest
5. 交给推送适配器发送
6. 写入本地历史归档

## 第一阶段建议落地顺序

1. 先把 `Telegram` 做通
2. 再加 `企业微信群机器人`
3. 之后再决定是否升级到 `企业微信应用消息`

这样做的好处是：

- 最快能看到真实结果
- 不会因为微信接入把主流程拖慢
- 后续保留迁移空间

## 当前项目决策

当前 GitRadar 的推送决策收敛如下：

- `Telegram`：保留，作为最快可用通道
- `企业微信群机器人`：加入第一阶段范围
- `企业微信应用消息`：作为第二阶段预留
- `微信公众号 / 小程序`：不进入第一阶段
