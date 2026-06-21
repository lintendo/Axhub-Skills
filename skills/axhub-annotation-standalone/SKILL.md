---
name: axhub-annotation-standalone
description: Use when integrating @axhub/annotation outside Axhub Make, including standalone React apps, plain HTML pages, Vite prototypes, or non-Make hosts that need annotation markers, directories, or state controls.
---

# Axhub Annotation Standalone

在 Axhub Make 以外使用 `@axhub/annotation` 时，用这个技能。它只说明运行时接入方式：页面已有标注数据，只需要展示 marker、标注面板、目录和状态控件。

不要假设 Make 客户端目录、`/prototypes/*` 路由、Make 预览命令或 Make 专属 helper。

## 接入选择

| 宿主 | 使用方式 | 参考文件 |
| --- | --- | --- |
| React | `AnnotationViewer` 组件 | `packages/axhub-annotation/examples/react/src/App.tsx` |
| 普通 HTML / DOM | `createAnnotationViewer` | `packages/axhub-annotation/examples/html/src/main.ts` |
| 共享数据 | `AnnotationSourceDocument` JSON | `packages/axhub-annotation/examples/shared/annotation-source.json` |

## 接入前提

- 宿主需要提供 React 18 和 ReactDOM 18。
- 使用能导入 ESM/TS/JSON 的构建工具，例如 Vite。
- 标注数据用一份 `AnnotationSourceDocument`，静态 import 或由宿主 loader 返回。
- 被标注元素要有稳定选择器，优先加 `data-annotation-id`。

## React 接入

```tsx
import { AnnotationViewer, type AnnotationSourceDocument } from '@axhub/annotation';
import annotationSource from './annotation-source.json';

<AnnotationViewer
  source={annotationSource as AnnotationSourceDocument}
  options={{
    currentPageId,
    showToolbar: true,
    showThemeToggle: true,
    showColorFilter: true,
    onDirectoryRoute: (node) => setCurrentPageId(String(node.route || 'overview')),
  }}
/>
```

如果标注 `controls` 要驱动页面状态，用 `useProtoDevState()` 读取控件值并渲染页面。

## 普通 HTML 接入

```ts
import { createAnnotationViewer, type AnnotationSourceDocument } from '@axhub/annotation';
import annotationSource from './annotation-source.json';

let currentPageId = 'overview';

const viewer = createAnnotationViewer({
  source: annotationSource as AnnotationSourceDocument,
  options: {
    getCurrentPageId: () => currentPageId,
    showToolbar: true,
    showThemeToggle: true,
    showColorFilter: true,
    onDirectoryRoute: (node) => {
      currentPageId = String(node.route || currentPageId);
      viewer.refresh();
    },
  },
});

void viewer.start();
```

普通 HTML 的状态控件：viewer 启动后订阅 `window.__AXHUB_PROTO_DEV__`，从 `getState()` 读值并更新 DOM。

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

- 不要在外部宿主里使用 Make-only 路径、脚本或 `/prototypes/<id>` 假设。
- 不要把函数写进 JSON controls。
- 不要依赖脆弱的生成 CSS 选择器；能加 `data-annotation-id` 就加。
- 不要期待 `route` 自动跳转；宿主必须在 `onDirectoryRoute` 里处理。
