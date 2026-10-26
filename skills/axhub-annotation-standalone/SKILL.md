---
name: axhub-annotation-standalone
description: Use when adding @axhub/annotation to standalone React apps, plain HTML pages, Vite prototypes, or other web hosts that need sidebar documents, prototype navigation, annotation markers, or state controls.
---

# Axhub Annotation Standalone

在独立 Web 项目中使用 `@axhub/annotation` 时，用这个技能。它说明如何把已有需求说明和标注数据接入运行时，展示侧边栏文档、原型目录、页面标注和状态控件。

## 推荐方案

用户未指定标注形式时，优先推荐侧边栏文档，让查看者边操作原型边阅读需求说明。

- PRD、业务流程和完整需求说明放在 `documents.nodes`，优先使用 Markdown；省略 `readerMode` 或设为 `"split"`，默认侧边栏分屏阅读。需要整篇阅读时再设为 `"full"`。
- 文档需要关联页面元素时，用 `[查看元素](#axhub-target:element-id)` 链接到已有标注节点，或通过 `targets[]` 登记只需定位的元素。
- 元素需要独立说明或可切换状态时，再按需添加 `data.nodes[]` marker 和 `controls`；完整 PRD 正文集中在文档中维护。

## 参考案例

| 宿主 | 使用方式 | 文件 |
| --- | --- | --- |
| React | `AnnotationViewer` 组件 | `references/react-example.tsx` |
| 普通 HTML / DOM | browser bundle + `window.AxhubAnnotation.createAnnotationViewer` | `references/axhub-annotation.global.js` + `references/html-example.html` |
| 数据源 | `AnnotationSourceDocument` JSON | `references/annotation-source.json` |

## 接入前提

- 如果相关 API 或功能验收能力缺失，优先提醒用户检查 `@axhub/annotation` 是否因版本过旧而缺少对应能力。
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
- 如果页面必须直接用 `file://` 打开，避免依赖跨文件 fetch/import；运行时仍然必须来自 browser bundle。

## 数据要点

- `directory.nodes` 只放原型导航 `folder` / `route` / `link`，不需要 `locator`。
- `documents.nodes` 放独立文档目录，只用 `folder` / `markdown` / `html`；Markdown 节点可以直接写 `markdown` 正文，也可以写 `markdownPath`，HTML 节点可以直接写 `html` 正文，也可以写 `htmlPath`。未指定 `readerMode` 时默认以侧边栏分屏阅读。
- HTML 节点会在 `sandbox="allow-scripts"` iframe 中执行，支持普通 JavaScript、canvas 图表、动画和交互；脚本不能直接访问父页面 DOM。HTML 中的标准 `#anchor` 会通过运行时桥接，由阅读器像 Markdown 锚点一样控制 iframe 内跳转。
- 文档 Markdown 和 HTML 都可以用 `[查看详情](#axhub-target:modal-close-target)` 定位当前页面的标注或普通目标。HTML 点击该链接会通过运行时桥接到与 Markdown 相同的目标定位逻辑。
- 文档 Markdown 和 HTML 都支持相对 `.md`、`.markdown`、`.html`、`.htm` 链接；只有当前目录中存在唯一匹配路径时才在阅读器内切换文章。
- `data.nodes[]` 放页面 marker，必须有能在宿主页面解析到的 `locator`。
- marker 只属于某些页面或状态时，写 `pageId`。
- 长正文用 `hasMarkdown: true` + `markdownMap[node.id]`。
- 状态标注写节点 `controls`；JSON 里只放可序列化字段。
- `targets[]` 放没有标注正文、但需要被文档链接定位的页面元素；保持 `id` 稳定并提供 `locator`。
- 页面有对话框或遮罩层时，检查实际 DOM，把包含内容的活动层根选择器写入 `presentation.layerSelectors`。
- `sourceReference` 不放在 JSON 数据源里，只描述发布包中的源码清单位置，不内联源码文件。

## 验收

1. 启动宿主预览。
2. 在每个纳入验收的页面/状态执行 `validateAnnotationRuntime(source, { pageId })`；`errors` 阻断交付，`warnings` 只提示改进。
3. 使用文档目录时，验证正文按配置阅读（默认侧边栏分屏）；如有目标链接，点击并确认标注或普通目标能被定位。
4. 使用原型目录时，验证 `route`、`link`。
5. 使用 marker 时，确认目标元素上出现 marker；marker 已正常显示时，静态 locator 或 fingerprint 偏差不单独阻断。
6. 使用 marker 时，点击后能看到短标注或 Markdown 正文；marker 是否指向正确业务元素由视觉或人工复验确认。
7. 使用状态控件时，修改控件并确认 React 状态或普通 DOM 同步变化。
8. 检查控制台是否有 import、peer dependency 或 locator 错误。

## 常见错误

- 不要把函数写进 JSON controls。
- 不要为了让静态页可见而手写标注 UI；HTML 模式也必须使用 `@axhub/annotation` 的 browser runtime。
- 不要在普通 HTML 模式里先跳到 Vite/ESM 接入；最短路径是 browser bundle + `window.AxhubAnnotation.createAnnotationViewer(...)`。
- 不要依赖脆弱的生成 CSS 选择器；能加 `data-annotation-id` 就加。
- 不要把文档 Markdown 放进 `directory`；文档统一放在 `documents`。
- 不要期待 `route` 自动跳转；宿主必须在 `onDirectoryRoute` 里处理。
