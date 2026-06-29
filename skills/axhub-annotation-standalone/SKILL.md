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
| 普通 HTML / DOM | browser bundle + `window.AxhubAnnotation.createAnnotationViewer` | `references/axhub-annotation.global.js` + `references/html-example.html` + `references/html-example.ts` |
| 数据源 | `AnnotationSourceDocument` JSON | `references/annotation-source.json` |

## 接入前提

- 标注数据使用一份 `AnnotationSourceDocument`，静态 import 或由宿主 loader 返回。
- 被标注元素优先加稳定属性，例如 `data-annotation-id`。
- React 18 / Vite 等现代宿主可以安装 `@axhub/annotation` 并走 ESM。
- 普通 HTML、DOM-only、React 17、Vue、Angular、托管注入或 `file://` 静态页，优先走 standalone browser bundle，不要求宿主安装 React / ReactDOM / antd。

## 入口选择

- 用户明确说 React 18、Vite、ESM 或已有前端工程时，使用 `AnnotationViewer` 或 ESM `createAnnotationViewer`。
- 用户说普通 HTML、静态 HTML、DOM、无构建、`file://`、只想打开 HTML 看效果，必须使用 browser bundle，可从本 skill 的 `references/axhub-annotation.global.js` 或 npm 包 / 本地构建产物里的 `dist/browser/axhub-annotation.global.js` 复制。
- HTML 模式只接入包提供的 runtime：`window.AxhubAnnotation.createAnnotationViewer(...)`。
- 不要在宿主里手写 marker、浮层面板、目录、Markdown 渲染或状态控件的等价 UI；如果缺少 browser bundle，先构建或复制 bundle，而不是重做 UI。

## React 接入

- 挂载 `AnnotationViewer`。
- 多页面时传 `options.currentPageId`。
- 目录 `route` 在 `options.onDirectoryRoute` 中交给宿主切页。
- 状态标注用 `useProtoDevState()` 读取 `controls` 值。
- 发布为带源码 HTML 后，发布产物会注入 `sourceReference`，指向 `source/manifest.json`；宿主接入代码不需要生成它。

## 普通 HTML 接入

- 从 npm 包、本地构建产物或本 skill 的 `references/axhub-annotation.global.js` 复制 browser bundle 到静态资源目录；npm / 本地构建路径为 `dist/browser/axhub-annotation.global.js`。
- 在页面里先加载 `<script src="./axhub-annotation.global.js"></script>`，实际路径按静态资源目录调整。
- 用 `window.AxhubAnnotation.createAnnotationViewer()` 创建运行时。
- 用 `getCurrentPageId` 返回当前页面。
- 切页后调用 `viewer.refresh()`。
- 状态控件可订阅 `window.__AXHUB_PROTO_DEV__`，从 `getState()` 读值并更新 DOM。
- 参考示例里的 `html-example.ts` 仍可用 Vite 处理 JSON import；纯静态页则把标注数据内联到脚本或从同源 URL fetch。
- 如果页面必须直接用 `file://` 打开，避免依赖跨文件 fetch/import；运行时仍然必须来自 browser bundle。

## 数据要点

- `directory.nodes` 放 `folder` / `route` / `markdown` / `link`，不需要 `locator`。
- `type: "markdown"` 目录文档可以直接写 `markdown` 正文。
- 需要把目录文档拆成 `.md` 文件时，可以写 `markdownPath`，例如 `docs/prd-03-status.md`；这是构建侧约定，运行时仍读取内联后的 `markdown`。
- `markdownPath` 只用于目录文档，不用于 marker 标注节点。
- `data.nodes[]` 放页面 marker，必须有能在宿主页面解析到的 `locator`。
- marker 只属于某些页面或状态时，写 `pageId`。
- 长正文用 `hasMarkdown: true` + `markdownMap[node.id]`。
- 状态标注写节点 `controls`；JSON 里只放可序列化字段。
- `sourceReference` 不放在 JSON 数据源里，只描述发布包中的源码清单位置，不内联源码文件。

## 验收

1. 启动宿主预览。
2. 确认目标元素上出现 marker。
3. 点击 marker，能看到短标注或 Markdown 正文。
4. 打开目录，验证 `route`、`markdown`、`link`。
5. 修改状态控件，确认 React 状态或普通 DOM 同步变化。
6. 检查控制台是否有 import、peer dependency 或 locator 错误。

## 常见错误

- 不要把函数写进 JSON controls。
- 不要为了让静态页可见而手写标注 UI；HTML 模式也必须使用 `@axhub/annotation` 的 browser runtime。
- 不要在普通 HTML 模式里先跳到 Vite/ESM 接入；最短路径是 browser bundle + `window.AxhubAnnotation.createAnnotationViewer(...)`。
- 不要依赖脆弱的生成 CSS 选择器；能加 `data-annotation-id` 就加。
- 不要期待 `route` 自动跳转；宿主必须在 `onDirectoryRoute` 里处理。
