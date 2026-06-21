---
name: axhub-annotation-standalone
description: Use when adding @axhub/annotation to standalone React apps, plain HTML pages, Vite prototypes, or other web hosts that need annotation markers, directories, Markdown notes, or state controls.
---

# Axhub Annotation Standalone

在独立 Web 项目中使用 `@axhub/annotation` 时，用这个技能。它只说明运行时接入：页面已有标注数据，只需要展示 marker、标注面板、目录和状态控件。

## 参考案例

| 宿主 | 使用方式 | 文件 |
| --- | --- | --- |
| React | `AnnotationViewer` 组件 | `references/react-example.tsx` |
| 普通 HTML / DOM | `createAnnotationViewer` | `references/html-example.html` + `references/html-example.ts` |
| 数据源 | `AnnotationSourceDocument` JSON | `references/annotation-source.json` |

## 接入前提

- 安装 `@axhub/annotation`，并确保项目里有 React 18 / ReactDOM 18。
- 使用能导入 ESM/TS/JSON 的构建工具，例如 Vite。
- 标注数据使用一份 `AnnotationSourceDocument`，静态 import 或由宿主 loader 返回。
- 被标注元素优先加稳定属性，例如 `data-annotation-id`。

## React 接入

- 挂载 `AnnotationViewer`。
- 多页面时传 `options.currentPageId`。
- 目录 `route` 在 `options.onDirectoryRoute` 中交给宿主切页。
- 状态标注用 `useProtoDevState()` 读取 `controls` 值。

## 普通 HTML 接入

- 用 `createAnnotationViewer()` 创建运行时。
- 用 `getCurrentPageId` 返回当前页面。
- 切页后调用 `viewer.refresh()`。
- 状态控件可订阅 `window.__AXHUB_PROTO_DEV__`，从 `getState()` 读值并更新 DOM。

## 数据要点

- `directory.nodes` 放 `folder` / `route` / `markdown` / `link`，不需要 `locator`。
- `data.nodes[]` 放页面 marker，必须有能在宿主页面解析到的 `locator`。
- marker 只属于某些页面或状态时，写 `pageId`。
- 长正文用 `hasMarkdown: true` + `markdownMap[node.id]`。
- 状态标注写节点 `controls`；JSON 里只放可序列化字段。

## 验收

1. 启动宿主预览。
2. 确认目标元素上出现 marker。
3. 点击 marker，能看到短标注或 Markdown 正文。
4. 打开目录，验证 `route`、`markdown`、`link`。
5. 修改状态控件，确认 React 状态或普通 DOM 同步变化。
6. 检查控制台是否有 import、peer dependency 或 locator 错误。

## 常见错误

- 不要把函数写进 JSON controls。
- 不要依赖脆弱的生成 CSS 选择器；能加 `data-annotation-id` 就加。
- 不要期待 `route` 自动跳转；宿主必须在 `onDirectoryRoute` 里处理。
