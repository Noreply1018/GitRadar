# 数据目录

GitRadar 3.0.0 把 GitHub 仓库视为正式数据载体。

当前约定如下：

- `history/`：正式日报归档，可入库
- `feedback/`：正式反馈状态，可入库
- `runtime/`：正式运行状态，可入库

其中：

- `data/history/*.json` 是前端默认展示的正式归档源
- `data/feedback/*` 是前端默认读取的正式反馈与兴趣轨迹源
- `data/runtime/github-runtime.json` 是前端默认展示的正式运行状态

GitRadar 3.0.0 中，`data/` 表示仓库内的数据工作区：正式远端产物和开发调试产物都在这里分区管理。
