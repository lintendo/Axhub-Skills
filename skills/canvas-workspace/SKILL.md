---
name: canvas-workspace
description: 在 Axhub 画布上进行原型草图绘制、整理灵感、构思方案、画布整理、读取批注/截图/本地图片资源。当用户要在画布上绘图、发散/收敛想法、构思原型/图片/内容/图表、整理画布，或把画布图片作为生成参考/素材文件时使用。
---

# Canvas Workspace — 画布工作区

Axhub 画布基于 Excalidraw，支持标准绘图元素和两种 Axhub 专属节点（原型节点、文档节点），以及元素级批注。本技能覆盖画布的读、写和多种工作场景。

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

### Axhub 专属节点

**原型节点** — 嵌入可交互的原型预览：
- `type: "embeddable"`
- `link` → 原型 URL（如 `http://localhost:<port>/prototypes/<name>`）
- `customData.title` → 原型标题
- `customData.screenshotUrl` → 截图持久化地址

**文档节点** — 嵌入 Markdown 文档：
- `type: "embeddable"`
- `customData.type: "axhub-doc"`
- `link` → 文档 API URL（`/api/markdown-file?path=<encoded-path>`）
- `customData.title` → 文档标题

### 批注

任何元素都可以添加批注，存储在：
- `customData.annotation` — 批注文本
- `customData.annotationUpdatedAt` — 更新时间（ISO 8601）

### 图片与截图资源

原型节点的截图保存在：
```
src/prototypes/<name>/canvas-assets/embed-<elementId>.png
```

画布里的图片资源可能有三种用途：
- **视觉参考**：作为生成、改版、还原时的上下文参考，不一定写入代码。
- **素材文件**：用户明确要“用这张图”“把画布里的图片作为素材”时，需要保留/复制本地图片文件，并在实现中引用。
- **节点截图缓存**：原型节点自动生成的预览图，主要用于画布展示和视觉核对。

## 场景分流

根据用户意图选择对应参考文档：

| 信号 | 场景 | 参考文档 |
|------|------|----------|
| 绘制草图、UI 布局、流程图、架构图、线框图 | 原型草图 | `references/prototype-sketch.md` |
| 整理灵感、构思方案、发散/收敛想法、生成原型/图片/内容/图表 | 灵感与方案 | `references/ideation-planning.md` |
| 整理画布、清理删除、分类排布、优化布局 | 画布整理 | `references/canvas-cleanup.md` |

### 生成意图澄清

用户说“生成图片”“生成 UI 设计稿”“做一张图”时，必须先判断输出形态：
- 可能是画布草图，也可能是真实图片、位图设计稿或素材图。
- 如果需要真实图片，使用图片生成相关工具/技能生成图片。
- 无论最终生成的是草图还是图片，相关内容都要呈现在画布上，便于用户确认。
- 不清楚用户要草图还是真实图片时，马上停下来问用户，不要擅自二选一。

如果场景涉及画布读写操作的具体细节（CLI 命令、文件格式、Bridge 通信），读取 `references/canvas-read-write.md`。

如果需要 Excalidraw 画图基础指导（图类型、布局、复杂度控制），读取 `references/excalidraw-basics.md`。

如果需要创建 Excalidraw 元素的 JSON 模板，读取 `references/element-templates.md`。

## 读写能力速查

优先直接读写 `.excalidraw`。CLI 只用于读取批注、获取当前画布截图、查看在线连接，或热更新异常时兜底。

> 详细的读写参考见 `references/canvas-read-write.md`。

每个元素必须有唯一 `id`。推荐使用 `<timestamp>-<random>` 格式（如 `"1778336862857-19qh357"`），与现有画布保持一致。

## 通用规范

- `roughness: 0` — 干净利落的线条（除非用户要求手绘风格）
- `fontFamily: 3` — Cascadia（等宽字体，适合技术内容）
- `fontFamily: 1` — Virgil（手绘风格）
- `opacity: 100` — 所有元素保持不透明
- 颜色使用 Excalidraw 内置调色板，不要发明新颜色
- 元素间距：水平 200-300px，垂直 100-150px
- 文本 fontSize 至少 16px 确保可读性
- 相关内容必须用 `frame` 元素分组，组内元素通过 `frameId` 归属到对应 Frame

## 交付要求

完成画布操作后，回复至少包含：

- 命中的场景
- 更改的内容
- 可用于用户确认的画布链接（如果当前环境能确定）
- 询问用户是否需要清理相关已处理标注
