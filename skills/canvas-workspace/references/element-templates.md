# Excalidraw 元素模板

只记录 Agent 写画布时最常用的最小字段。不要复制过大的完整元素样例；优先沿用现有画布里的同类元素字段，再按这里补关键字段。

## 通用规则

- 每个元素必须有唯一 `id`，推荐 `<timestamp>-<random>`。
- 新元素设置 `version: 1`、新的 `versionNonce`、当前毫秒 `updated`。
- 默认 `roughness: 0`、`opacity: 100`、`strokeStyle: "solid"`。
- 删除元素时直接从 `elements` 移除，不新写 `isDeleted: true`。
- 修改绑定、容器、分组时同步检查引用是否存在。

## 基础形状

矩形、椭圆、菱形共用这类结构：

```json
{
  "id": "<id>",
  "type": "rectangle",
  "x": 100,
  "y": 100,
  "width": 200,
  "height": 100,
  "strokeColor": "#1e1e1e",
  "backgroundColor": "#a5d8ff",
  "fillStyle": "solid",
  "strokeWidth": 2,
  "strokeStyle": "solid",
  "roughness": 0,
  "opacity": 100,
  "roundness": { "type": 3 },
  "seed": 100001,
  "version": 1,
  "versionNonce": 1234567890,
  "updated": 1778336862857,
  "groupIds": [],
  "frameId": null,
  "boundElements": null,
  "link": null,
  "locked": false
}
```

把 `type` 改为 `ellipse` 或 `diamond` 即可。圆角：直角用 `roundness: null`，圆角用 `{ "type": 3 }`。

## 文本

```json
{
  "id": "<id>",
  "type": "text",
  "x": 100,
  "y": 100,
  "width": 220,
  "height": 28,
  "text": "标题",
  "originalText": "标题",
  "fontSize": 20,
  "fontFamily": 3,
  "textAlign": "left",
  "verticalAlign": "top",
  "containerId": null,
  "autoResize": true,
  "lineHeight": 1.25,
  "strokeColor": "#1e1e1e",
  "backgroundColor": "transparent",
  "roughness": 0,
  "opacity": 100,
  "seed": 100002,
  "version": 1,
  "versionNonce": 1234567890,
  "updated": 1778336862857,
  "groupIds": [],
  "frameId": null
}
```

`text` 和 `originalText` 保持一致，且只放纯文本。

## 箭头与线

```json
{
  "id": "<id>",
  "type": "arrow",
  "x": 300,
  "y": 150,
  "width": 200,
  "height": 0,
  "points": [[0, 0], [200, 0]],
  "startBinding": null,
  "endBinding": null,
  "startArrowhead": null,
  "endArrowhead": "arrow",
  "strokeColor": "#1e1e1e",
  "strokeWidth": 2,
  "roughness": 0,
  "opacity": 100,
  "seed": 100003,
  "version": 1,
  "versionNonce": 1234567890,
  "updated": 1778336862857,
  "groupIds": [],
  "frameId": null
}
```

线条用 `type: "line"`，并把 `endArrowhead` 设为 `null`。

绑定到元素时：

```json
{
  "startBinding": { "elementId": "<source-id>", "focus": 0, "gap": 1 },
  "endBinding": { "elementId": "<target-id>", "focus": 0, "gap": 1 }
}
```

同时在被绑定元素的 `boundElements` 中添加箭头引用。

## 预览节点

```json
{
  "id": "<id>",
  "type": "embeddable",
  "x": 100,
  "y": 100,
  "width": 720,
  "height": 480,
  "link": "<open-url-or-preview-url>",
  "customData": {
    "title": "预览标题",
    "previewUrl": "<preview-url>",
    "openUrl": "<open-url-or-preview-url>",
    "previewKind": "web",
    "resourceType": "preview",
    "resourceId": "<optional-resource-id>",
    "embedViewMode": "preview",
    "embedSizePreset": "free",
    "storedPreviewSize": { "width": 720, "height": 480 },
    "previewStrokeColor": "#008F5D"
  },
  "strokeColor": "#008F5D",
  "backgroundColor": "transparent",
  "roughness": 0,
  "opacity": 100,
  "roundness": { "type": 3 },
  "seed": 200001,
  "version": 1,
  "versionNonce": 1234567890,
  "updated": 1778336862857,
  "groupIds": [],
  "frameId": null,
  "boundElements": null
}
```

新建嵌入类节点统一使用 `customData.resourceType: "preview"`。`previewUrl` 可以是任意 HTTP(S)、相对路径或本地预览 API URL；如果只是外部/任意链接，不要写 `sourceResourceType`。

### 原型来源预览

```json
{
  "id": "<id>",
  "type": "embeddable",
  "x": 100,
  "y": 100,
  "width": 1280,
  "height": 800,
  "link": "/prototypes/<name>",
  "customData": {
    "title": "原型标题",
    "previewUrl": "/prototypes/<name>",
    "openUrl": "/prototypes/<name>",
    "previewKind": "web",
    "resourceType": "preview",
    "sourceResourceType": "prototype",
    "resourceId": "<name>",
    "embedViewMode": "preview",
    "embedSizePreset": "desktop",
    "storedPreviewSize": { "width": 1280, "height": 800 },
    "previewStrokeColor": "#008F5D"
  },
  "strokeColor": "#008F5D",
  "backgroundColor": "transparent",
  "roughness": 0,
  "opacity": 100,
  "roundness": { "type": 3 },
  "seed": 300001,
  "version": 1,
  "versionNonce": 1234567890,
  "updated": 1778336862857,
  "groupIds": [],
  "frameId": null,
  "boundElements": null
}
```

截图字段由运行时维护。不要手写 `screenshotUrl`，除非正在修复已有截图缓存。

### 文档或 HTML 来源预览

Markdown 文档可保留 `customData.type: "axhub-doc"`，HTML 或任意可访问文档可用 `previewKind: "web"`。

```json
{
  "customData": {
    "type": "axhub-doc",
    "title": "文档标题",
    "previewUrl": "/api/markdown-file?path=<url-encoded-path>",
    "openUrl": "/api/markdown-file?path=<url-encoded-path>",
    "previewKind": "doc",
    "resourceType": "preview",
    "sourceResourceType": "doc",
    "resourceId": "<doc-id-or-path>",
    "embedViewMode": "preview"
  }
}
```

`path` 参数必须 URL 编码。

## Frame

```json
{
  "id": "<id>",
  "type": "frame",
  "x": 80,
  "y": 80,
  "width": 600,
  "height": 400,
  "name": "功能模块",
  "strokeColor": "#bbb",
  "backgroundColor": "transparent",
  "roughness": 0,
  "opacity": 100,
  "seed": 400001,
  "version": 1,
  "versionNonce": 1234567890,
  "updated": 1778336862857,
  "groupIds": [],
  "frameId": null
}
```

子元素通过 `frameId` 引用 frame 的 `id`。

## 批注

给任意元素补：

```json
{
  "customData": {
    "annotation": "这里需要确认",
    "annotationUpdatedAt": "2026-05-11T09:00:00.000Z"
  }
}
```
