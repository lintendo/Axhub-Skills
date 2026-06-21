# Canvas MCP 读写

仅当当前环境暴露 Axhub Canvas MCP 时读取本文件；没有 MCP 时不要读取，直接使用 `canvas-read-write.md`。

## 适用场景

- 获取在线画布状态、选区、元素和文件信息。
- 截取当前画布视口或元素。
- 插入、更新、删除画布元素。
- 聚焦选区、元素或整个画布。
- 在线画布需要刷新时触发 refresh。

## 工具能力

| 目标 | MCP 工具 |
|------|----------|
| 读取状态 | `canvas_get_state` |
| 插入元素 | `canvas_insert_elements` |
| 更新元素 | `canvas_update_elements` |
| 删除元素 | `canvas_delete_elements` |
| 截图 | `canvas_capture` |
| 聚焦 | `canvas_focus` |
| 刷新 | `canvas_refresh` |

## 使用原则

- MCP 是在线画布主通道，优先用于当前画布、选区、截图和局部更新。
- MCP 失败、无连接、无对应能力，或需要批量结构化编辑时，回退到 `.excalidraw` 文件读写。
- 不要假设 MCP 一定存在；发现不可用后不要反复探测。
- MCP 返回的数据不完整时，以本地 `.excalidraw` 文件作为最终兜底。

