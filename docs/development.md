# 开发规范

## 当前目标

GitRadar 当前以三个方向为主：

- 把推荐做准
- 把证据留全
- 把链路做稳

默认不要把仓库再次扩成展示站、宣传页或与主流程平行的旁路系统。

## 目录约定

- `src/`：应用核心逻辑与命令入口
- `src/web-api/`：本地控制台 API 与命令执行边界
- `tests/`：单元和集成测试
- `web/`：本地控制台前端
- `scripts/`：容器、Windows 和运维辅助脚本
- `config/`：规则、调度和配置说明
- `data/history/`：示例归档与历史结构样本
- `data/runtime/`：运行期临时数据，不入库
- `data/cache/`：抓取缓存，不入库
- `data/exports/`：导出结果，不入库
- `docs/`：架构、开发和交付说明

根目录只保留仓库级文件，不提交构建产物、截图、运行缓存和一次性调试输出。

## 开发原则

- 所有用户可见行为都要区分“代码已改”“测试已过”“真实终端已验证”
- 没有真实终端复现前，不对发送链路报告“已成功”
- 结构化证据优先于模型自由发挥
- 新能力优先挂到现有主流程，避免命令、Web UI 和 CI 分叉
- 历史归档必须可读、可分析、可重发，结构升级不能直接打断旧数据
- 配置和规则尽量外置，不把长期会调整的阈值与权重硬编码

## 架构边界

GitRadar 默认保持这些边界：

- Source Layer：候选抓取与补充信号
- Scoring Layer：规则筛选、主题识别和候选池构建
- Editorial Layer：中文成稿
- Archive Layer：归档、迁移和分析
- Delivery Layer：企业微信等发送器
- Feedback Layer：反馈采集与轻量个性化

不要把这些职责重新揉回一个大脚本里。

## 工作流与验证

当前仓库保留两类工作流：

- `CI`：格式、Markdown、YAML、类型检查、测试
- `Daily Digest`：日报生成、企业微信发送、失败告警

每次涉及代码、规则、工作流或架构改动，至少执行：

1. `npm run format:check`
2. `npm run lint:md`
3. `npm run lint:yaml`
4. `npm run typecheck`
5. `npm run test`

如果涉及本地控制台或启动链路，还应额外验证：

- `npm run build:web`
- `npm run start:console`
- `http://127.0.0.1:3210/api/health`

如果涉及 Docker 或 Windows 启动器，再补：

- `docker compose up --build`
- `start-gitradar.bat`
- `stop-gitradar.bat`
