# 场景 4: 画布整理

用于分类、排布、清理无用元素、优化文件大小。

## 适用信号

- 用户要整理、清理、排布、对齐画布
- 用户要删除特定元素或批量清理
- 用户要优化画布文件大小

## 先分析

读取 `.excalidraw` 后先统计：

- 活跃元素数量、历史 `isDeleted` 元素数量
- 元素类型分布
- 含 `customData.annotation` 的元素
- 画布边界范围
- `canvas-assets/` 中是否有未被原型节点引用的截图

## 可清理内容

| 清理类型 | 处理方式 |
|----------|----------|
| 历史 `isDeleted: true` 元素 | 从 `elements` 中移除 |
| 空文本 | 删除 |
| 零尺寸元素 | 删除或修正 |
| 孤立绑定 | 移除无效引用 |
| 重叠重复元素 | 谨慎合并，必要时先确认 |
| 未使用截图 | 删除无对应 embeddable 元素的 `canvas-assets/embed-*.png` |

删除元素时直接从 `elements` 移除，不新增 `isDeleted: true`。

## 排布策略

- 按原型节点、文档节点、草图/笔记分区。
- 同组元素对齐到 `appState.gridSize`，没有则按 20px 网格。
- 同一行/列保持均匀间距。
- 带批注的元素优先保留，移动时保持批注不变。
- 清理绑定时检查 `boundElements`、`containerId`、`startBinding`、`endBinding`、`groupIds`。

## 完成后

1. 写入 `.excalidraw`。
2. 依赖热更新同步；只有热更新失效时才用 `axhub-make canvas refresh` 兜底。
3. 汇报删除/清理/重排数量，以及保留了多少批注。
