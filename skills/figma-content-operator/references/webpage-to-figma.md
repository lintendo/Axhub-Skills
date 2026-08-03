# 网页复制到 Figma

## 执行

- 使用浏览器中实际渲染的页面。React、Vue 等项目先启动开发服务器并传入 URL。
- 运行 `scripts/webpage-to-figma.mjs`；该流程写入 Figma HTML 剪贴板，不通过 MCP 创建节点。
- 默认使用 Axhub 自有 `axhub-export-core` H2D 实现。
- 写入会覆盖当前剪贴板，执行前提醒用户先处理其中的重要内容。
- Figma 官方 `capture.js` 不随技能内置；用户明确提供链接时才下载到技能的 `.cache` 目录，后续使用 `--official-script cached`。

```bash
node "$SKILL_DIR/scripts/webpage-to-figma.mjs" --source <URL-or-HTML-file> [--selector <CSS-selector>]
node "$SKILL_DIR/scripts/webpage-to-figma.mjs" --source <URL-or-HTML-file> --manual
node "$SKILL_DIR/scripts/webpage-to-figma.mjs" --source <URL-or-HTML-file> --official-script <官方-capture.js-URL>
```

## 判断结果

- 检查 `assetCount`、`embeddedAssetCount` 和 `missingAssetCount`。存在缺失资源时不要报告成功。
- `clipboardHtmlVerified: true` 仅表示脚本已回读并确认生成的 HTML 剪贴板字节和 SHA-256 一致；`null` 表示复制请求未验证，不代表画布已经修改。
- 自动写入失败时使用页面上的复制按钮；官方脚本使用它自己的按钮。
- 页面不可用或无法完成复制时，提供目标页面和 [Axhub 扩展](https://axhub.im/chrome/) 链接，让用户自行复制。

## 交付

让用户在目标 Figma 文件中按 `Cmd/Ctrl+V`。不要报告节点 ID，也不要声称剪贴板内容已经写入某个 Figma 文件。
