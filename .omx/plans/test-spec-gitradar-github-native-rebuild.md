# Test Spec — GitRadar GitHub-native 重构

## Scope
验证 GitRadar 从“混合本地/远端语义”收敛为“GitHub 单正式控制面”的全过程，重点覆盖：
- 正式读路径
- 正式写路径
- workflow 回写
- Pages 前端正式体验
- 企业微信交付

## Test Strategy
采用 **unit + integration + workflow evidence + product evidence** 四层验证，禁止仅凭代码自洽宣布成功。

---

## A. Unit Tests

### A1. GitHub 平台客户端
- repo contents 文件读取
- 目录 listing
- workflow dispatch 调用
- 文件写入 sha 冲突处理
- 多文件写入提交构造（若采用 Git Data API）
- 错误响应规范化

### A2. 配置与反馈领域模型
- `config/schedule.json` 解析/序列化
- `config/user-preferences.json` 解析/序列化
- `config/digest-rules.json` 解析/校验
- feedback event / state 构建与聚合
- runtime / environment report normalize

### A3. 前端 API 层
- `web/src/api.ts`：
  - 公共只读读取成功/失败路径
  - PAT 存储与校验
  - writeback payload 编码
  - dispatch 输入组装
  - fallback / 空数据路径

---

## B. Integration Tests

### B1. 正式读路径不再依赖 git CLI
**证明方式**
- 搜索正式代码路径，不应再存在 `git fetch/show/add/commit/push` 依赖
- 针对平台读取适配层做集成测试，验证可直接读取 repo contents / runtime / feedback / archives

**通过标准**
- 正式读路径只通过 GitHub 平台客户端或浏览器 GitHub API 完成

### B2. 正式写路径平台化
**证明方式**
- 配置写入：模拟/集成测试验证 workflow dispatch 或 API 写入成功构造
- 反馈写入：验证 feedback event/state 正确写入目标文件并形成正式提交/PR
- runtime / environment report：验证 workflow 可回写目标文件并保留 run 关联

**通过标准**
- 正式写路径不再经过 `commitAndPushRepoFiles()` 或其他 git CLI 包装

### B3. Pages 前端能力
**证明方式**
- build 后静态站点可运行
- 可读取 archive list / archive detail / runtime / environment report
- 提供 PAT 后可触发 schedule / preferences / feedback 写入请求
- 正确展示“已提交请求”与“正式已生效”的差别

**通过标准**
- 用户无需本地 server 即可完成正式阅读与写入请求

---

## C. Workflow Verification

### C1. Console Writeback Workflow
**步骤**
1. 使用测试 PAT 在 Pages 或 API 触发一次 schedule/preferences/feedback 写入
2. 检查 workflow run 成功
3. 检查是否创建 PR 或正式 commit
4. 检查目标文件内容是否正确

**证据**
- workflow run URL
- PR URL / commit SHA
- 目标文件 diff

### C2. Daily Digest Workflow
**步骤**
1. 手动 dispatch 一次 Daily Digest
2. 检查 digest 生成、企业微信发送、归档写入、runtime 回写
3. 若发送失败，检查 runtime 和告警是否正确

**证据**
- workflow run URL
- `data/history/<date>.json`
- `data/runtime/github-runtime.json`
- 企业微信实际消息或失败告警截图/日志

### C3. Environment Diagnose Workflow
**步骤**
1. 手动 dispatch 一次 environment diagnose
2. 检查环境诊断结果回写仓库
3. 检查 Pages 环境页是否展示最新状态

**证据**
- workflow run URL
- `data/runtime/environment-report.json`
- Pages 页面展示

---

## D. Product Evidence

### D1. 归档阅读
- Pages 能列出归档
- 可进入某天详情页
- 可读取 reader context / interest track

### D2. 收藏与待看
- 在 Pages 上对某条 repo 执行 saved / later
- 仓库反馈数据更新
- 刷新后仍能读到正式结果

### D3. 配置修改
- 修改 schedule 或 preferences
- 形成 GitHub 正式写入证据
- 合并后正式结果可被下次 workflow 使用

### D4. 企业微信日报
- 至少一次真实消息交付证据
- 至少一次失败告警链路证据（可通过受控失败演练）

---

## Regression Checks
1. README / docs 不再把本地 server 当正式路径
2. `npm run dev:console-api` 即便保留，也只能被描述为开发调试工具
3. 旧 git-based 正式服务删除后，前端功能不回退
4. CI 继续通过：
   - `npm run format:check`
   - `npm run lint:md`
   - `npm run lint:yaml`
   - `npm run typecheck`
   - `npm run test`
   - `npm run build:web`

---

## Release Readiness Gate
以下全部满足才允许宣称本阶段完成：
1. 无本地正式控制面残留
2. 无 git CLI 正式回写残留
3. Pages 前端可完成正式阅读与写入请求
4. GitHub workflow 可真实留下 run + commit/PR 证据
5. 企业微信日报真实可达
6. 文档与产品行为一致

---

## Suggested Execution Order
1. 先写平台客户端与读写适配层测试
2. 再删 `src/web-api/*` 正式语义并更新前端/文档
3. 再改 workflows 回写
4. 最后做真实 GitHub 证据验证
