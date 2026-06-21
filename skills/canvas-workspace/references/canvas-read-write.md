# 画布文件读写

仅在 Axhub Canvas MCP 不存在、连接失败、能力不覆盖，或需要离线/批量/修复文件时读取本文件。

## 快速判断

| 目标 | 方式 |
|------|------|
| 读取画布元素、批注、节点信息 | 读 `.excalidraw` |
| 批量修改画布内容 | 改 `.excalidraw` |
| 从画布链接定位元素 | 提取画布名和元素 ID，再读文件 |
| 修复脏数据或历史删除元素 | 结构化编辑 JSON |

## 文件位置

常见路径：

```text
src/prototypes/<prototype-name>/canvas.excalidraw
src/prototypes/<prototype-name>/canvas-assets/embed-<elementId>.png
```

`.excalidraw` 是 JSON。主要关注：

- `elements`：所有画布元素。
- `files`：嵌入图片数据或图片元信息。
- `appState.gridSize`：整理/对齐时参考。

## 读取画布

最常用字段：

| 字段 | 用途 |
|------|------|
| `id` | 元素唯一标识，链接定位和截图文件名会用到 |
| `type` | 元素类型，如 `text`、`image`、`embeddable`、`arrow` |
| `x` / `y` / `width` / `height` | 位置和尺寸 |
| `isDeleted` | 为 true 时跳过 |
| `link` | 预览节点的打开链接或预览链接 |
| `customData` | 批注、标题、预览来源、截图地址等 Axhub 扩展信息 |
| `fileId` | 图片元素对应的 `files[fileId]` |

识别常见节点：

| 类型 | 判断方式 |
|------|----------|
| 预览节点 | `type == "embeddable"` 且 `customData.resourceType == "preview"` |
| 原型来源预览 | `customData.sourceResourceType == "prototype"` |
| 文档来源预览 | `customData.sourceResourceType == "doc"` |
| 主题来源预览 | `customData.sourceResourceType == "theme"` |
| Draw.io 节点 | `type == "image"` 且 `customData.type == "axhub-drawio"` |
| 图片元素 | `type == "image"` |
| 批注元素 | `customData.annotation` 有值 |

嵌入类节点统一写 `customData.resourceType: "preview"`。

## 从链接定位

用户可能给一个带节点 ID 的画布链接。处理步骤：

1. 从 URL 中提取画布名和元素 ID。
2. 找到对应 `.excalidraw` 文件。
3. 在 `elements` 中找同 ID 元素。
4. 如果是原型来源预览节点，预览截图通常在 `canvas-assets/embed-<elementId>.png`。
5. 如果是图片元素，按 `fileId` 找 `files[fileId]`；只有用户明确要作为素材使用时，才导出或复制为稳定文件引用。

## 写入画布

直接修改 `.excalidraw` 的 `elements` 数组。

### 添加元素

追加到 `elements`。必须有唯一 `id`，推荐沿用现有格式：`<timestamp>-<random>`。

### 修改元素

更新目标字段后，同时更新：

- `version` 加 1
- `versionNonce` 换成新的随机整数
- `updated` 设为当前毫秒时间戳

### 删除元素

默认直接从 `elements` 中移除。不要为了删除而设置 `isDeleted: true`，这会让画布文件持续膨胀。

如果遇到历史遗留的 `isDeleted: true` 元素，读取时跳过；整理画布时可以一并移除。

### 关系检查

修改连接、容器、分组时检查引用是否仍然存在：

- `boundElements`
- `containerId`
- `startBinding` / `endBinding`
- `groupIds`

## 同步

当前画布支持热更新。写入 `.excalidraw` 后，正在打开的画布通常会自动同步，不要默认触发刷新。

如果热更新没有生效，且 MCP 可用，使用 `canvas_refresh`；否则告知用户刷新浏览器页面。
