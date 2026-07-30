---
name: figma-content-operator
description: 用于处理涉及检查、读取、创建、编辑、导出或代码映射的 Figma 内容任务，尤其适用于当前选区操作、设计系统处理、Figma MCP、Drafito、Figwright 或需要避免 MCP 工具污染上下文的场景。当用户需要可批注 Figma 链接或要求同时绑定工作目录时，也应与 axhub-commentary 组合。
---

# Figma 内容操作器

这是一个第三方 Skill，并非 Figwright 官方 CLI。它通过官方 MCP Inspector CLI 驱动 `@figwright/mcp`，无需在宿主代理中注册包含 104 个工具的服务器。随附脚本只提供稳定的一次性命令；MCP Inspector 仍是客户端，`@figwright/mcp` 仍是服务器。

## 运行要求

- Node.js `22.19+`
- `npx`
- 对于依赖 Figma 的操作，需要在目标 Figma 文件中运行当前版本的 Drafito 或上游 Figwright 插件

将 `SKILL_DIR` 解析为包含本 `SKILL.md` 的目录，然后执行：

```bash
node "$SKILL_DIR/scripts/figwright-operator.mjs" <command>
```

### Windows（PowerShell）

先明确解析 Skill 目录，再通过 Node.js 调用同一个包装器：

```powershell
$skillDir = (Resolve-Path '<path-to-skill>').Path
node "$skillDir/scripts/figwright-operator.mjs" doctor
node "$skillDir/scripts/figwright-operator.mjs" relay
node "$skillDir/scripts/figwright-operator.mjs" call get_selection '{}'
```

## 渐进式工具发现

按三个层级探索，让模型了解完整能力范围，同时避免加载所有 schema：

1. 读取 `references/tools/index.md`。其中按七个领域列出了全部 104 个工具名，但不包含参数 schema。
2. 只读取与当前任务相关的领域参考文档，其中提供该领域工具的简短路由说明。
3. 仅对即将调用的工具运行 `schema <exact-tool-name>`。如果仍不知道准确名称，运行 `tools <keyword>` 获取少量实时搜索结果。

不要直接通过 MCP Inspector 输出完整的 `tools/list` 结果，也不要把完整实时工具目录粘贴进上下文。随附的 `catalog-check` 命令会比较精简索引和固定版本的实时服务器，且不会输出 schema。

## 工作流程

1. 判断任务是依赖 Figma、只读、修改画布、导出文件，还是仅对本地代码库做映射分析。任何写入前都要确认目标 Figma 文件和页面。
2. 对于依赖 Figma 的任务，先确认目标 Figma Web 设计文件 URL 并运行 `doctor`，再在一个独立、可保持运行的进程中启动 `relay`。保留该进程的准确句柄，直到任务完成、取消或失败。
3. Relay 就绪后，普通 Figma 操作运行 `launch-url`；可批注 Figma 场景按下方组合规则交付链接。等待用户确认已经在 Figma 中运行 Drafito，再依次运行 `ping` 和 `profile`；MCP 进程成功启动，并不代表插件或 Figma 沙箱已经连通。
4. 如需建立连接或启动插件，读取 `references/setup-and-connect.md`。Drafito 与上游 Figwright 提供相同的完整 Figwright 契约。
5. 按前述方式渐进发现工具，并只在需要时读取相应工作流参考：
   - 选区、节点树、元数据、截图：`references/read-and-inspect.md`
   - 画布写入与验证：`references/edit-canvas.md`
   - 样式、变量、组件、页面、资源、原型交互：`references/design-systems-and-advanced.md`
   - 设计到代码或代码到设计的映射：`references/grounding-workflows.md`
6. 修改前先读取目标。执行范围最小的写入，再通过 `get_node`、`get_selection` 或相应设计系统查询做聚焦验证。
7. 报告当前页面和文件上下文、执行过的调用、返回的节点 ID 或文件路径，以及验证结果。遇到部分失败或不确定性时应明确说明，不要悄悄换用其他操作。
8. 任务完成、取消或失败后，停止本次启动的准确 Relay 进程；不要尝试启动、关闭或替用户管理 Drafito 插件本身。

仅在服务器本地运行的 `analyze_project` 和 `scan_components` 不需要 Figma。其他映射工具会结合本地项目数据和实时 Figma 数据，因此需要端到端插件连接。

## 可批注 Figma 链接

只在原始 Figma URL 上追加绝对 `projectPath`，不要预先追加 `try-plugin-*`。Axhub 扩展会先把目录绑定到稳定的 Figma 文件身份，确认写入后再自行启动 Drafito；Figma 重定向清除参数后，扩展从该绑定恢复目录。

## 命令

```bash
# 检查本地依赖；不会连接 Figma
node "$SKILL_DIR/scripts/figwright-operator.mjs" doctor

# 在发送 Drafito 启动链接前启动任务级 MCP Relay；保持运行到任务结束
node "$SKILL_DIR/scripts/figwright-operator.mjs" relay

# 检查 stdio → MCP 服务器 → WebSocket → 插件 → Figma 沙箱的完整链路
node "$SKILL_DIR/scripts/figwright-operator.mjs" ping

# 验证已连接的插件构建是否支持完整契约
node "$SKILL_DIR/scripts/figwright-operator.mjs" profile

# 比较随附的 104 工具索引与固定版本服务器的实时目录
node "$SKILL_DIR/scripts/figwright-operator.mjs" catalog-check

# 根据 Figma Web 设计文件 URL 生成 Drafito 启动 URL
node "$SKILL_DIR/scripts/figwright-operator.mjs" launch-url 'https://www.figma.com/design/FILE/NAME'

# 渐进式实时发现
node "$SKILL_DIR/scripts/figwright-operator.mjs" tools selection
node "$SKILL_DIR/scripts/figwright-operator.mjs" schema get_selection

# 直接调用；参数可使用内联 JSON、@file 或 - 从 stdin 读取
node "$SKILL_DIR/scripts/figwright-operator.mjs" call get_selection '{}'
node "$SKILL_DIR/scripts/figwright-operator.mjs" call get_node '{"nodeId":"1:42"}'
node "$SKILL_DIR/scripts/figwright-operator.mjs" call batch @/absolute/path/to/ops.json
```

始终通过包装器执行工具发现和调用，避免向上下文直接输出完整目录。

## 安全与效率

- 将创建、更新、移动、删除、导入、批处理和导出调用都视为修改操作。严格限制在用户指定的文件和范围内。
- 优先使用聚焦读取，避免直接调用 `get_document`；从 `get_selection`、搜索或扫描工具，或有范围限制的 `get_design_context` 开始。
- 检查 schema 后，可使用 `batch` 处理相关且可逆的编辑。`batch` 会拒绝破坏性操作；这类操作必须单独限定范围并验证。
- 不要猜测节点 ID 或参数结构。先通过读取获取 ID，并在调用前获取实时 schema。
- 原始输出有助于提供证据时应保留，但大型节点树应总结，不要整段粘贴。
- 只停止本次任务启动并保留了准确句柄的 Relay 进程；不要按端口或模糊进程名批量终止进程。
- 仅在遇到失败、版本偏差、当前文件不明确或安全问题时读取 `references/troubleshooting-and-security.md`。

## 固定版本

配置固定使用 `@figwright/mcp@0.3.0`，并为其 104 个工具建立索引。包装器固定使用 `@modelcontextprotocol/inspector@2.0.0`。升级任一依赖时，必须同步更新精简索引、连接兼容性和回归测试。
