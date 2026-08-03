# 安装与连接

仅在插件尚未连接、用户询问如何启动，或 `ping`/`profile` 失败时读取本文件。

## 前置条件

- Node.js `22.19+`。
- `PATH` 中存在 `npx`。

下载或修改任何内容前先运行 `doctor`。包装器通过 `npx` 调用 `@modelcontextprotocol/inspector@2.0.0`，后者再根据随附配置启动 `@figwright/mcp@0.3.0`。两者都无需全局安装，也不会向宿主代理添加 MCP 注册。
在 Windows 上，包装器通过 `%ComSpec%`（通常为 `cmd.exe`）使用固定参数向量调用 `npx.cmd`。随附的 MCP 配置同样明确使用 `cmd.exe /d /s /c npx.cmd`，而不是尝试把 `.cmd` 文件当作原生可执行文件启动。

```bash
node "$SKILL_DIR/scripts/figwright-operator.mjs" doctor
```

对于依赖 Figma 的任务，先在独立进程中启动任务级 Relay，并保留该进程的准确句柄：

```bash
node "$SKILL_DIR/scripts/figwright-operator.mjs" relay
```

Relay 就绪后再发送插件启动链接。Relay 必须保持运行到任务完成、取消或失败；之后只停止本次任务启动的准确进程。

## 方案 A：Drafito

当前 Drafito 源码内置完整的 Figwright 插件注册表，并支持固定的 104 工具服务器契约。当用户已经使用 Axhub 插件时，优先选择它。

1. 获取当前 Figma Web 设计文件 URL，其中应包含 `/design/<file-id>/` 或 `/file/<file-id>/`。
2. 运行 `doctor`，再按上述方式启动任务级 Relay 并确认服务器就绪。
3. 生成发布候选插件的启动 URL：

   ```bash
   node "$SKILL_DIR/scripts/figwright-operator.mjs" launch-url '<figma-design-url>'
   ```

4. 将 URL 作为可点击链接提供；如果浏览器导航在任务范围内，也可以使用可用的浏览器控制器打开。
5. 请用户在 Figma 中确认 **Run Drafito** 对话框，并等待用户明确表示插件已经运行。
6. 依次运行 `ping` 和 `profile`。成功结果必须包含 `hop: "e2e"` 和 `profile: "figwright-full"`。
7. 在同一个 Relay 存活期间完成任务；任务完成、取消或失败后停止该 Relay 进程。

Inspector 工具调用仍是一次性的，但任务级 Relay 会在整个任务期间保持插件连接。Relay 停止后的插件状态由 Figma 和用户管理，本 Skill 不负责启动或关闭插件本身。

## 方案 B：上游 Figwright 开发插件

当用户更愿意使用上游插件或 Drafito 不可用时，采用此方案。

1. 先运行 `doctor` 并启动任务级 Relay，确认服务器就绪。
2. 从 <https://github.com/awdr74100/figwright/releases/latest> 下载并解压最新版本。
3. 在 **Figma Desktop** 中选择 **Menu → Plugins → Development → Import plugin from manifest…**。
4. 选择发布包中的 `manifest.json`。
5. 打开目标设计，运行 **Plugins → Development → Figwright**。
6. 保持插件窗口或后台会话运行。
7. 依次运行 `ping` 和 `profile`；必须得到 `profile: "figwright-full"`。
8. 任务完成、取消或失败后停止本次任务的 Relay。

不要假定上游插件存在 Community URL，也不要虚构一个。只需导入一次开发版 manifest，之后从 **Plugins → Development** 启动。

## 成功标准

不要把 MCP 服务器成功启动作为最终检查，因为这无法证明插件已经连通。本 Skill 会调用 Figwright 的 `ping` 工具，成功结果必须满足：

```bash
node "$SKILL_DIR/scripts/figwright-operator.mjs" ping
node "$SKILL_DIR/scripts/figwright-operator.mjs" profile
```

```json
{
  "ok": true,
  "hop": "e2e",
  "plugin": {
    "editorType": "figma",
    "currentPageId": "...",
    "currentPageName": "..."
  }
}
```

随后，`profile` 会通过该连接调用 `get_metadata`，证明已加载插件实现当前完整注册表。任何写入前都要确认返回页面就是用户的目标页面。
