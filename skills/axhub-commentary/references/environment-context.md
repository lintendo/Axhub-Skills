# 可批注地址与页面定位子流程

当用户要求“生成一个可批注的地址”、给现有预览链接补页面定位，或排查批注页为什么找不到实现文件时，走这里。

这条流程独立于页面侧接入。推荐的临时方案只在现有地址上拼接参数，不修改当前页面文件或项目配置；只有稳定入口方案才需要修改项目。

## 页面定位参数

- `projectPath`：当前项目根目录的绝对路径
- `filePath`：当前页面实现文件，通常写相对于 `projectPath` 的路径
- `annotationSourcePath`：可选；标注源路径，相对路径以当前 `filePath` 所在目录为基准

普通 Commentary 页面定位只需要前两个字段。标注辅助优先从 URL 查询参数读取 `annotationSourcePath`，也可以读取 `window.__AXHUB_COMMENTARY_CONTEXT__.annotationSourcePath`；不要再增加独立的路径全局变量、兼容字段或旧的页面宿主声明。没有真实实现文件时也不要伪造 `filePath`。

标注源的推荐位置是当前 `filePath` 同目录下的 `annotation-source.json`。未声明 `annotationSourcePath` 时客户端自动尝试该位置；这是普通 HTML 和前端工程共同使用的零配置约定。

开始本流程前，必须已经按主文档“0. 核心前置：ACP UI”确认服务健康并保持运行。

## 临时方案：拼接 URL 参数（推荐）

这是默认方案，不修改项目配置，最适合一次性生成可批注地址。

使用标准 `URL` API，在现有页面地址上设置定位参数，并保留已有 query 和 hash：

```ts
const url = new URL(pageUrl);
url.searchParams.set('projectPath', projectPath);
url.searchParams.set('filePath', filePath);
if (annotationSourcePath) {
  url.searchParams.set('annotationSourcePath', annotationSourcePath);
}
const commentaryUrl = url.toString();
```

例如：

```text
https://example.com/orders/42?projectPath=%2FUsers%2Fme%2Fshop&filePath=src%2Fpages%2Forder-detail.tsx
```

需要标注内容编辑时可以追加：

```text
&annotationSourcePath=.%2Fannotation-source.json
```

`URLSearchParams` 会负责编码路径。显式参数会覆盖客户端从地址或页面上下文推断出的值。

## 固定方案：固化到预览入口

只有用户明确需要团队长期复用的稳定入口时，才修改项目。让项目的预览、启动或打开页面逻辑持续生成带有相同 `projectPath` 和 `filePath` 的 URL；不要恢复旧的页面上下文协议。

固定方案保持相同字段语义：

- `projectPath` 使用当前项目真实根目录
- `filePath` 随页面或路由映射到真实实现文件
- `annotationSourcePath` 只在标注源不位于推荐位置，或单 HTML 使用内嵌源时声明

如果不同路由对应不同实现文件，不要把一个固定 `filePath` 写死给所有页面。优先在已有的预览 URL 构造函数或路由打开逻辑中集中处理。

## 本地文件地址

`file://` 地址可以自动推断：所在目录作为 `projectPath`，文件名作为 `filePath`。显式传参时仍以参数为准。使用前还要确认扩展具有“允许访问文件网址”的权限。

单 HTML 页面把标注源内嵌在当前文件时，让 `annotationSourcePath` 指向当前 HTML；外部 JSON 继续使用同目录的 `annotation-source.json`。具体接入方式和数据格式转到 [axhub-annotation-standalone](https://github.com/lintendo/Axhub-Skills/blob/main/skills/axhub-annotation-standalone/SKILL.md)。

## 最小验证

1. ACP UI 已按主文档的核心前置流程确认健康。
2. 最终 URL 能正常打开，原有 query 和 hash 未丢失。
3. 解码后的 `projectPath` 指向真实项目根目录，`filePath` 指向对应实现文件。
4. 打开批注后，AI 工作目录和文件定位与当前页面一致。
5. 使用 `annotationSourcePath` 时，确认它指向页面 Runtime 实际使用的权威标注源，而不是未被页面加载的副本。
