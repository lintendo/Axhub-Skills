---
name: figma-content-operator
description: 用于处理涉及检查、读取、创建、编辑、导出或代码映射的 Figma 内容任务，也用于将 HTML/React/Vue 等网页复制到 Figma，尤其适用于当前选区、设计系统、Figma MCP、Drafito、Figwright 或需要避免 MCP 工具污染上下文的场景。当用户需要可批注 Figma 链接或要求同时绑定工作目录时，也应与 axhub-commentary 组合。
---

# Figma 内容操作器

画布操作通过官方 MCP Inspector CLI 驱动 `@figwright/mcp`；网页转换则写入 Figma 剪贴板，不经过 MCP，也不替用户粘贴到画布。

## 运行要求

- Node.js `22.19+`
- `npx`
- 网页复制需要本机 Chromium 浏览器；使用 Axhub 扩展时可直接在目标网页操作
- 依赖 Figma 画布读写的任务，需要在目标文件中运行当前版本的 Drafito 或上游 Figwright 插件

将 `SKILL_DIR` 解析为包含本 `SKILL.md` 的目录，再按任务执行相应脚本。

## 先选交付路径

这里的“网页”包括静态 HTML、React、Vue、其他前端框架以及已部署 URL；判断依据是浏览器中实际渲染的页面，不是源码扩展名。

- 用户明确要求修改当前画布、选区或已有节点时，直接走 Figwright MCP。不要再询问是否先生成网页。
- 用户明确要求先做网页、响应式页面、多页面或浏览器状态时，先完成可运行网页，再走网页剪贴板流程。
- 用户提出新设计但没有说明交付路径时，先问：“这次先生成网页（HTML/React/Vue），还是直接修改 Figma 画布？”同时给出推荐：完整页面、响应式和多状态设计优先生成网页；已有设计上的局部调整、组件/变量复用优先直接修改画布。
- 需要网页初稿后继续做语义化微调时，先让用户把剪贴板内容粘贴到 Figma；只有用户确认继续修改画布后，才启动 MCP 读取和编辑流程。

## 网页复制到 Figma

网页交付统一读取 `references/webpage-to-figma.md`。该路径不启动 Relay 或调用 MCP，最终由用户把剪贴板内容粘贴到目标 Figma 文件。

## 渐进式工具发现

本节只适用于 MCP 画布任务。按三个层级探索，避免加载所有 schema：

1. 读取 `references/tools/index.md`，了解七个领域中的 104 个工具名。
2. 只读取当前领域参考文档。
3. 仅对即将调用的工具运行 `schema <exact-tool-name>`；名称不确定时运行 `tools <keyword>`。

不要输出完整 `tools/list` 或把全部 schema 放进上下文。`catalog-check` 只比较精简索引与固定版本服务器。

## MCP 画布流程

1. 确认目标 Figma Web 设计文件、页面和操作范围；写入前先读取目标。
2. 运行 `doctor`，再在独立且可保持运行的进程中启动 `relay`，保留准确进程句柄。
3. Relay 就绪后运行 `launch-url`。等待用户确认已在 Figma 中运行 Drafito，再依次运行 `ping` 和 `profile`；服务器启动不代表插件已经连通。
4. 建立连接时读取 `references/setup-and-connect.md`。Drafito 与上游 Figwright 提供相同的完整契约。
5. 按需读取工作流参考：
   - 选区、节点树、元数据、截图：`references/read-and-inspect.md`
   - 画布写入与验证：`references/edit-canvas.md`
   - 样式、变量、组件、页面、资源、原型交互：`references/design-systems-and-advanced.md`
   - 设计到代码或代码到设计的映射：`references/grounding-workflows.md`
6. 执行范围最小的写入，再通过 `get_node`、`get_selection` 或相应设计系统查询聚焦验证。
7. 报告当前页面和文件上下文、调用、节点 ID 或文件路径及验证结果；部分失败时明确说明。
8. 任务完成、取消或失败后，停止本次启动的准确 Relay 进程；不要尝试启动、关闭或替用户管理 Drafito 插件本身。

仅服务器本地运行的 `analyze_project` 和 `scan_components` 不需要 Figma。其他映射工具会结合本地项目和实时 Figma 数据，需要端到端插件连接。

## 批注 Figma

涉及批注或可批注链接时，参考 [axhub-commentary](https://github.com/lintendo/Axhub-Skills/blob/main/skills/axhub-commentary/SKILL.md)。

只在原始 Figma URL 上追加绝对 `projectPath`，不要预先追加 `try-plugin-*`。Axhub 扩展会先绑定工作目录，再自行启动 Drafito。

## 安全与效率

- 将创建、更新、移动、删除、导入、批处理和导出调用视为修改操作，严格限制在用户指定范围。
- 优先聚焦读取，避免直接调用 `get_document`。
- 不猜节点 ID 或参数结构；先读取 ID，再获取实时 schema。
- `batch` 只用于相关且可逆的编辑；破坏性操作单独限定范围并验证。
- 失败、版本偏差、文件不明确或安全问题时读取 `references/troubleshooting-and-security.md`。
