# 故障排查与安全

## 连接诊断

1. 运行 `doctor`，先解决 Node 或 `npx` 缺失或版本不支持的问题。
2. 启动任务级 `relay`，确认 Figwright 服务器已经就绪并保持该进程运行。
3. Relay 就绪后生成并提供 Drafito 启动链接，等待用户确认已经运行插件。
4. 运行 `ping`；必须包含 `hop: "e2e"` 和 `plugin` 对象。
5. 运行 `profile`；只有得到 `figwright-full` 后，才能认为插件兼容全部 104 个工具。
6. 如果存在多个插件会话，写入前将目标文件切到前台，再次运行 `ping`。
7. 任务完成、取消或失败后停止本次任务启动的准确 Relay 进程。

Inspector 命令仍是一次性调用，但任务期间必须由 `relay` 命令保持 WebSocket 中继。不要在 Relay 启动前要求用户运行 Drafito，也不要通过端口或模糊进程名清理其他进程。

## `127.0.0.1`、`localhost` 与 `server-only`

`@figwright/mcp@0.3.0` 在 IPv4 地址 `127.0.0.1:3055` 上监听插件中继。因此当前 Drafito 和 Figwright 构建必须连接：

```text
ws://127.0.0.1:3055
```

在 macOS/Figma 上，`localhost` 可能解析为 IPv6 `::1`。如果插件连接 `ws://localhost:3055`，就可能错过仅监听 `127.0.0.1:3055` 的 MCP 服务器，结果为 `server-only` 而不是 `hop: "e2e"`。

遇到这种情况时，确认插件中继 URL 使用 `ws://127.0.0.1:3055`。

## 常见故障

- 缺少 `npx` 或 `node`：安装 Node.js 22.19 或更高版本，并确保其 bin 目录位于 `PATH`。
- 启动期间连接关闭：测试固定版本 `@figwright/mcp` 包的 npm 访问，并检查 registry 或代理配置。
- MCP 启动但 `ping` 为 `server-only`：确认任务级 Relay 在用户打开启动链接之前已经就绪，并检查上述明确的 IPv4 中继 URL；然后重新提供启动链接让用户进入插件。
- 修改了错误文件：立即停止，读取 `ping` 和 `get_selection`，聚焦目标文件并完成验证后再纠正。
- `catalog-check` 报告目录漂移：只有在完成新服务器版本兼容性测试后，才能更新固定索引和文档。

## 上下文隔离

本 Skill 不会向 Codex、Claude、Cursor 或其他宿主写入 MCP 注册。任务级 Relay 只在当前任务期间运行，MCP Inspector CLI 仍按单次调用工作，因此宿主代理只会看到所选命令的输出，而不会加载 104 个 MCP schema。

## 安全边界

回环地址并不是完整的信任边界。保持两个包的版本固定，审查每次升级，也不要削弱 Host/Origin 检查。写入和导出工具可以修改 Figma 或写入本地文件，因此真正有意义的边界是用户授权范围、目标验证和明确输出路径。

上游来源：

- Figwright：<https://github.com/awdr74100/figwright>（MIT）
- MCP Inspector：<https://github.com/modelcontextprotocol/inspector>（MIT）
