# 可批注地址与页面定位子流程

当用户要求“生成一个可批注的地址”、给现有预览链接补页面定位，或排查批注页为什么找不到实现文件时，走这里。

这条流程独立于页面侧接入。推荐的临时方案只在现有地址上拼接参数，不修改当前页面文件或项目配置；只有稳定入口方案才需要修改项目。

## 只处理两个参数

- `projectPath`：当前项目根目录的绝对路径
- `filePath`：当前页面实现文件，通常写相对于 `projectPath` 的路径

当前客户端只消费这两个字段。不要添加兼容字段或旧的页面宿主声明；没有真实实现文件时也不要伪造 `filePath`。

开始本流程前，必须已经按主文档“0. 核心前置：ACP UI”确认服务健康并保持运行。

## 临时方案：拼接 URL 参数（推荐）

这是默认方案，不修改项目配置，最适合一次性生成可批注地址。

使用标准 `URL` API，在现有页面地址上设置两个参数，并保留已有 query 和 hash：

```ts
const url = new URL(pageUrl);
url.searchParams.set('projectPath', projectPath);
url.searchParams.set('filePath', filePath);
const commentaryUrl = url.toString();
```

例如：

```text
https://example.com/orders/42?projectPath=%2FUsers%2Fme%2Fshop&filePath=src%2Fpages%2Forder-detail.tsx
```

`URLSearchParams` 会负责编码路径。显式参数会覆盖客户端从地址推断出的值。

## 固定方案：固化到预览入口

只有用户明确需要团队长期复用的稳定入口时，才修改项目。让项目的预览、启动或打开页面逻辑持续生成带有相同 `projectPath` 和 `filePath` 的 URL；不要恢复旧的页面上下文协议。

固定方案仍然只传两个参数：

- `projectPath` 使用当前项目真实根目录
- `filePath` 随页面或路由映射到真实实现文件

如果不同路由对应不同实现文件，不要把一个固定 `filePath` 写死给所有页面。优先在已有的预览 URL 构造函数或路由打开逻辑中集中处理。

## 本地文件地址

`file://` 地址可以自动推断：所在目录作为 `projectPath`，文件名作为 `filePath`。显式传参时仍以参数为准。使用前还要确认扩展具有“允许访问文件网址”的权限。

## 最小验证

1. ACP UI 已按主文档的核心前置流程确认健康。
2. 最终 URL 能正常打开，原有 query 和 hash 未丢失。
3. 解码后的 `projectPath` 指向真实项目根目录，`filePath` 指向对应实现文件。
4. 打开批注后，AI 工作目录和文件定位与当前页面一致。
