---
name: canvas-workspace
description: 仅当任务明确涉及 Axhub 画布、原型草稿、Excalidraw 画布文件、画布节点/批注/截图/图片，或需要在画布/原型草稿中创建、整理、读取 Drawio 图表时使用。
---

# Canvas Workspace — 画布工作区

Axhub 画布基于 Excalidraw，支持标准绘图元素、Axhub 预览节点、图片/Drawio 节点，以及元素级批注。本技能只覆盖明确的画布、原型草稿和画布内 Drawio 图表场景。

## 核心概念

### 画布文件位置

每个原型都有独立画布：

```
src/prototypes/<prototype-name>/canvas.excalidraw   ← 原型专属画布
```

画布文件就是标准 Excalidraw JSON，可以直接读写。

画布确认链接通常是：

```
http://localhost:<port>/?projectId=<project-id>&p=<prototype-name>&v=canvas
```

例如 `http://localhost:53817/?projectId=make-project&p=rpa&v=canvas`。端口和 `projectId` 以当前项目运行环境为准。

### Axhub 预览节点

新建嵌入类节点统一叫预览节点，可承载原型、设计主题、Markdown/HTML 文档、图片资源入口或任意 URL：
- `type: "embeddable"`
- `customData.resourceType: "preview"` — 新节点统一写这个值
- `customData.sourceResourceType` — 仅当来源是本地资源时写 `prototype`、`doc` 或 `theme`
- `customData.previewKind` — `web`、`doc`、`image` 或 `none`，决定渲染方式
- `customData.previewUrl` / `customData.openUrl` / `link` — 可预览或打开的 URL，普通 preview 节点允许任意链接
- `customData.title` → 节点标题

来源示例：
- 原型来源：`resourceType: "preview"` + `sourceResourceType: "prototype"` + `previewKind: "web"`
- 文档来源：`resourceType: "preview"` + `sourceResourceType: "doc"` + `previewKind: "doc"`，Markdown 可继续使用 `customData.type: "axhub-doc"`
- 主题来源：`resourceType: "preview"` + `sourceResourceType: "theme"` + `previewKind: "web"`，可继续使用 `customData.type: "axhub-theme"`
- 任意链接：`resourceType: "preview"`，不写 `sourceResourceType`，`previewUrl` 直接放目标 URL

### 批注

任何元素都可以添加批注，存储在：
- `customData.annotation` — 批注文本
- `customData.annotationUpdatedAt` — 更新时间（ISO 8601）

### 图片与截图资源

原型来源预览节点的截图通常保存在：
```
src/prototypes/<name>/canvas-assets/embed-<elementId>.png
```

画布里的图片资源可能有三种用途：
- **视觉参考**：作为生成、改版、还原时的上下文参考，不一定写入代码。
- **素材文件**：用户明确要“用这张图”“把画布里的图片作为素材”时，需要保留/复制本地图片文件，并在实现中引用。
- **节点截图缓存**：预览节点自动生成的预览图，主要用于画布展示和视觉核对。

## 分流规则

- 画布读写：优先 Axhub Canvas MCP；无 MCP 或能力不覆盖时直接读写 `.excalidraw`。
- 图表：流程图、关系图、思维导图、架构图、数据流图默认使用 Draw.io / drawio 节点。
- Excalidraw：只有用户明确要求 Excalidraw、手绘风、线框草图或普通画布元素时，才读取 `references/excalidraw-basics.md`。
- 结构化元素：需要 Excalidraw JSON 模板时，读取 `references/element-templates.md`。

### 生成意图澄清

用户说“生成图片”“生成 UI 设计稿”“做一张图”时，必须先判断输出形态：
- 可能是画布草图，也可能是真实图片、位图设计稿或素材图。
- 当前画布不提供 AI 图片节点；如果需要图片素材，只使用普通图片资源放回画布。
- 无论最终生成的是草图还是图片，相关内容都要呈现在画布上，便于用户确认。
- 不清楚用户要草图还是真实图片时，马上停下来问用户，不要擅自二选一。

### 读写分流

如果当前环境暴露 Axhub Canvas MCP，优先读取 `references/canvas-mcp.md` 并通过 MCP 操作画布。

只有 MCP 不存在、连接失败、能力不覆盖，或需要离线/批量/修复 `.excalidraw` 文件时，才读取 `references/canvas-read-write.md`。

## 读写能力速查

优先级：Axhub Canvas MCP → 直接读写 `.excalidraw` 文件。

不要使用画布 CLI。MCP 可用才读 MCP 分文档；无 MCP 时直接走文件兜底。

每个元素必须有唯一 `id`。推荐使用 `<timestamp>-<random>` 格式（如 `"1778336862857-19qh357"`），与现有画布保持一致。

## 通用规范

- 用户正在处理画布时，相关图片、原型页面、Markdown/Draw.io 文档、图表等产物原则上应落入或更新到当前画布，便于用户确认。
- `roughness: 0` — 干净利落的线条（除非用户要求手绘风格）
- `fontFamily: 3` — Cascadia（等宽字体，适合技术内容）
- `fontFamily: 1` — Virgil（手绘风格）
- `opacity: 100` — 所有元素保持不透明
- 颜色使用 Excalidraw 内置调色板，不要发明新颜色
- 元素间距：水平 200-300px，垂直 100-150px
- 文本 fontSize 至少 16px 确保可读性
- 相关内容必须用 `frame` 元素分组，组内元素通过 `frameId` 归属到对应 Frame
- 清理画布时直接移除废弃元素，不新增 `isDeleted: true`

## 交付要求

完成画布操作后，回复至少包含：

- 处理路径（MCP / 文件兜底 / Draw.io / Excalidraw）
- 更改的内容
- 可用于用户确认的画布链接（如果当前环境能确定）
- 询问用户是否需要清理相关已处理标注
