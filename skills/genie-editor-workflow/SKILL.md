---
name: genie-editor-workflow
description: 通过 Axhub AI Extension（Chrome 扩展）配合 @axhub/genie CLI 实现网页编辑器待办的完整闭环处理流程。引导用户安装扩展和检测连接状态、发现在线编辑器客户端、读取用户标注和待办节点、导出上下文截图和图片、设置编辑状态（editing/idle/completed/error 四状态生命周期）、完成代码修改并回写终态。支持 CLI 自动重试、指数退避重连、标签页可见性感知、任务状态持久化等通信稳定性保障。当用户通过 Genie Editor 标注了网页修改待办并希望 AI 代为处理时使用。
---

# Genie Editor 快速编辑工作流

通过 Chrome 扩展注入编辑器 → CLI 读取待办 → 修改代码 → 设置终态 → 复核。

## 前置条件

### 1. CLI 环境

需要 `@axhub/genie` ≥ 0.2.4：

```bash
# 安装
npm install -g @axhub/genie

# 启动服务并指定项目目录
npx @axhub/genie --cwd /path/to/project

# 确认服务在线
npx @axhub/genie status --json
```

确认 `running: true` 后继续。

### 2. Chrome 扩展

用户需要安装 Axhub AI Extension。安装地址：[https://axhub.im/chrome/](https://axhub.im/chrome/)

扩展安装后，用户在浏览器中打开目标网页，扩展会自动注入 Genie Editor。

### 3. 连接检测

通过 CLI 验证扩展是否已成功连接到后端服务：

```bash
npx @axhub/genie editor clients list
```

检查返回结果：
- `total > 0` → 至少有一个客户端在线
- 查看 `source` 字段确认是否来自 Chrome 扩展（`source: "chrome-extension"`）
- 查看 `capabilities` 确认包含 `editor.snapshot`、`editor.nodes.list` 等

如果列表为空，引导用户：
1. 确认扩展已安装并启用
2. 在目标页面上打开 Genie Editor（点击扩展图标 → 启动编辑器）
3. 确认后端服务正在运行（`npx @axhub/genie status --json`）

> 详细的扩展安装与检测流程见 `references/extension-setup.md`

## 快速分流

- 需要具体 CLI 命令模板和字段说明 → 打开 `references/cli-reference.md`
- 需要了解扩展安装与连接检测 → 打开 `references/extension-setup.md`
- 直接处理编辑器待办 → 按下方主流程执行

## 主流程

### 1. 确认服务与扩展连接

```bash
npx @axhub/genie status --json
npx @axhub/genie editor clients list
```

确认 `running: true`，且有在线客户端。记录本次任务使用的 `channel` 和 `targetClientId`。

- 只有一个客户端 → 直接使用
- 多个客户端 → 用 `pageUrl`、`sessionId`、`source` 缩小范围
- 无法安全判断 → 向用户补一个简短问题

整个任务复用同一个 `channel + targetClientId`。

### 2. 全局扫描

至少拿这两份数据：

```bash
npx @axhub/genie editor snapshot --channel <ch> --target-client-id <id>
npx @axhub/genie editor nodes list --channel <ch> --target-client-id <id> --status pending-dispatch,dirty
```

按此优先级处理节点：`pending-dispatch` → `dirty` → `error` → 疑似卡住的 `editing`。

扫描结果为空时，告诉用户当前没有可消费的编辑器待办，不要硬编待办。

### 3. 领取节点

开始处理某节点前将其标记为 `editing`：

```bash
npx @axhub/genie editor editing set \
  --channel <ch> --target-client-id <id> \
  --element-key <key> --state editing \
  --provider codex --task-request-id <unique-id>
```

要求：
- 每个节点生成唯一 `taskRequestId`
- `provider` 固定用 `codex`
- 修改成功 → `--state completed`（前端显示绿色勾 ✓，1.8s 后自动消除）
- 修改失败 → `--state error`（前端显示红色叉 ✕，保留在 overlay 上）
- 异常退出 → `--state idle`（兜底释放）
- 设置 `editing` 后，任务状态会持久化到 localStorage，页面刷新后可恢复

> CLI 具备自动重试能力：如果遇到 `CONNECTION_ERROR`、`CONNECTION_CLOSED` 或 `REQUEST_TIMEOUT` 错误，会在 1 秒后自动重试一次，无需手动干预。

### 4. 收集上下文

每个节点至少看 `elementKey`、`label`、`changeState`、`taskState`、`hasNote`、`hasImages`、`changeKinds`。

按需补充：
1. 有上下文图片 → `editor context-images export --output-dir <dir>`
2. 节点位置不明确 → `editor node screenshot --element-key <key> --output-dir <dir>`
3. 截图返回的是 `absolutePath`，直接用 `view_file` 查看

注意 `context-images` 是页面级共享上下文，不一定能精确映射到单个节点。推荐交叉对比策略：
- 先读 `nodes list` 获取有标注的节点（`hasNote=true` 或 `hasImages=true`）
- 导出 `context-images`，用 `createdAt` 时间戳与节点的 `dirtySince` 关联
- 不确定时拉 `node screenshot` 进行视觉比对
- 仍无法对应时，将所有上下文图片作为全局参考

### 5. 实施代码修改

拿到节点信息后，在当前项目里完成编辑。

原则：
- 优先处理用户明确要求或影响最大的节点
- 多个节点属于同一块 UI → 合并为一个实现批次
- 多个节点互相独立 → 可拆给子代理（仅负责实现，不负责客户端发现和状态回写）
- 无法安全定位节点 → 先截图 → 再交叉判断 → 仍不行就告诉用户阻塞点

### 6. 验证

至少做一轮回读：

```bash
npx @axhub/genie editor snapshot --channel <ch> --target-client-id <id>
npx @axhub/genie editor nodes list --channel <ch> --target-client-id <id> --status pending-dispatch,dirty,error,editing
```

如果节点代码已改但 backlog 仍显示 `dirty`/`pending-dispatch`，不要假装已完成。明确说明：
- 页面实现已完成
- 编辑器 backlog 仍显示未消费
- 将节点标记为 `--state completed` 表示 AI 已处理完毕

### 7. 设置终态

对每个已领取节点设置终态：

修改成功：
```bash
npx @axhub/genie editor editing set \
  --channel <ch> --target-client-id <id> \
  --element-key <key> --state completed \
  --provider codex --task-request-id <unique-id>
```

修改失败或跳过：
```bash
npx @axhub/genie editor editing set \
  --channel <ch> --target-client-id <id> \
  --element-key <key> --state error \
  --provider codex --task-request-id <unique-id>
```

异常退出时兜底释放（`idle`）：
```bash
npx @axhub/genie editor editing set \
  --channel <ch> --target-client-id <id> \
  --element-key <key> --state idle \
  --provider codex
```

任务未完成也要设置终态，同时在总结里写清未完成原因。

## 通信稳定性

### 连接状态

编辑器前端会实时跟踪 WebSocket 连接状态（`connected` / `disconnected` / `reconnecting`），并在 UI 上展示：
- 断线时：黄色脉搏点 + "重连中…"
- 重连失败：红色 badge + "连接失败"
- 重连成功：自动消失

前端采用**指数退避**重连策略（3s → 6s → 12s → ... → 48s，最多 10 次），避免服务端重启时被瞬间洪泛。

当用户**切换回标签页**时，前端会立即检查连接，已断线则立刻发起重连并重置计数器。

### CLI 重试

CLI 内置自动重试：`CONNECTION_ERROR` / `CONNECTION_CLOSED` / `REQUEST_TIMEOUT` 会在 1s 后自动重试一次。对 AI Agent 透明无感。

### 任务持久化

通过 `editing.set --state editing` 设置的外部编辑任务会同步持久化到 localStorage：
- **页面刷新**后任务状态自动恢复（overlay 保留 "AI 编辑中"）
- **error 终态** 持久化 30 分钟，刷新后仍可见
- **completed 终态** 1.8s 后自动消除

### 阶段感知 overlay

当 AI Agent 通过内置 Genie Bridge 执行时，编辑器 overlay 会根据 AI 的处理阶段显示不同文案：

| 阶段 | 显示文案 |
|------|----------|
| thinking | AI 正在分析 |
| coding | 正在修改代码 |
| reviewing | 正在检查修改 |
| running | Genie 正在执行 |
| waiting | 等待 AI 响应 |
| completed | 修改完成 ✓ |
| error | AI 修改失败 ✕ |

对于通过 CLI `editing.set` 发起的外部任务，overlay 显示固定的 "AI 编辑中" 文案（可通过 taskRef 携带自定义 message）。

## 效率优化建议

当使用 AI Agent 处理编辑器待办时，推荐以下策略加速响应：

1. **尽早 editing.set**：在读取 snapshot 后立即标记 `editing`，让用户第一时间看到 AI 已领取
2. **批量扫描一次，分批处理**：先一次性读完所有待办，再逐个处理，避免反复 round-trip
3. **小节点优先**：先处理改动范围小的节点，让用户快速看到成果
4. **并行截图**：如果需要多个节点的截图，可以并行发起多个 `node screenshot` 请求
5. **节流 context-images**：全局上下文图片只导出一次，后续节点复用

## 多节点并行策略

适合并行：不同页面区块、改动文件不重叠、上下文已足够清楚。

不适合并行：同一组件树深度耦合、依赖同一套重构、还没搞清各节点位置。

主代理保留：客户端选择、节点领取/释放、最终复核。

## 失败处理

遇到以下情况，优先说明问题，不要伪造完成：
- 服务离线 → 引导用户启动 `npx @axhub/genie --cwd <path>`
- 找不到客户端 → 引导用户检查扩展连接（见 `references/extension-setup.md`）
- 节点不存在 / 截图失败 / 无法定位节点 → 如实报告阻塞点
- 扩展 WS 断开重连 → 等待几秒后重新检查 `clients list`

部分完成时，清楚列出已完成/未完成节点及原因。

## 交付要求

最终回复至少包含：
- 使用的 `channel + targetClientId`
- 本轮处理过的 `elementKey`
- 修改了哪些文件
- 各节点的终态（`completed` / `error` / `idle`）
- 做了哪些验证
- 还有哪些节点仍未处理或状态异常

## 参考
