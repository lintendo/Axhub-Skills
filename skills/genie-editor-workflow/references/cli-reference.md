# CLI 命令参考

所有命令通过 `npx @axhub/genie` 调用，要求版本 ≥ 0.2.4。

建议在 shell 中定义变量减少重复输入：

```bash
CHANNEL=""
TARGET_CLIENT_ID=""
```

## 1. 服务检查

```bash
npx @axhub/genie status --json
```

确认 `running: true`，记录 `endpoint.apiBaseUrl`。

## 2. 列出在线客户端

```bash
npx @axhub/genie editor clients list \
  --channel "$CHANNEL"
```

重点关注：`clientId`、`sessionId`、`pageUrl`、`capabilities`、`source`。

只有目标客户端在线且具备 `editor.*` 能力时，后续命令才有意义。

Chrome 扩展客户端会在 `source` 字段标识为 `chrome-extension`。

## 3. 获取编辑器快照

```bash
npx @axhub/genie editor snapshot \
  --channel "$CHANNEL" \
  --target-client-id "$TARGET_CLIENT_ID"
```

关注字段：`resource`、`selectedElement`、`modifiedElements`、`textChanges`、`styleChanges`、`statusSummary`。

## 4. 列出待处理节点

### 处理待办

```bash
npx @axhub/genie editor nodes list \
  --channel "$CHANNEL" \
  --target-client-id "$TARGET_CLIENT_ID" \
  --status pending-dispatch,dirty
```

### 排查卡住节点

```bash
npx @axhub/genie editor nodes list \
  --channel "$CHANNEL" \
  --target-client-id "$TARGET_CLIENT_ID" \
  --status editing,error,completed
```

### 精确查询

```bash
npx @axhub/genie editor nodes list \
  --channel "$CHANNEL" \
  --target-client-id "$TARGET_CLIENT_ID" \
  --element-key "hero-card"
```

每个节点的关键字段：

| 字段 | 说明 |
|------|------|
| `elementKey` | 节点唯一标识 |
| `label` | CSS 选择器路径 |
| `changeState` | `clean` / `dirty` / `handled` |
| `taskState` | `idle` / `editing` / `completed` / `error` |
| `hasNote` | 是否有标注文字 |
| `hasImages` | 是否附带图片 |
| `changeKinds` | 修改类型：`text` / `style` / `class` |
| `dirtySince` | 变脏时间戳 |
| `lastHandledAt` | 上次处理时间 |

状态别名：

- `pending-dispatch` = `changeState=dirty && taskState=idle`
- `dirty` / `handled` / `editing` / `completed` / `error` 直接匹配对应字段

## 5. 节点截图

```bash
npx @axhub/genie editor node screenshot \
  --channel "$CHANNEL" \
  --target-client-id "$TARGET_CLIENT_ID" \
  --element-key "hero-card" \
  --output-dir /tmp/axhub-genie-shot
```

返回 `absolutePath`（本地文件路径）、`mimeType`、`width`、`height`、`size`。

用途：仅靠 `label` 无法定位节点时，通过截图视觉确认。

## 6. 导出上下文图片

```bash
npx @axhub/genie editor context-images export \
  --channel "$CHANNEL" \
  --target-client-id "$TARGET_CLIENT_ID" \
  --output-dir /tmp/axhub-genie-context
```

返回每张图片的 `absolutePath`、`mimeType`、`size`。

注意：这是页面级共享上下文，未必能精准映射到单个 `elementKey`，需结合 note、label、截图交叉判断。

交叉对比策略：
1. 先读 `nodes list` 获取有标注的节点（`hasNote=true` 或 `hasImages=true`）
2. 导出 `context-images`，用每张图片的 `createdAt` 与节点的 `dirtySince` 做时间关联
3. 不确定时为关键节点拉 `node screenshot`，视觉比对上下文图中的元素
4. 仍无法对应时，将所有上下文图片作为"全局参考"提供给 AI，不做强制映射

## 7. 设置节点编辑状态

### 开始处理

```bash
npx @axhub/genie editor editing set \
  --channel "$CHANNEL" \
  --target-client-id "$TARGET_CLIENT_ID" \
  --element-key "hero-card" \
  --state editing \
  --provider codex \
  --session-id "$SESSION_ID" \
  --task-request-id "codex_hero-card_$(date +%s)"
```

### 处理成功

```bash
npx @axhub/genie editor editing set \
  --channel "$CHANNEL" \
  --target-client-id "$TARGET_CLIENT_ID" \
  --element-key "hero-card" \
  --state completed \
  --provider codex \
  --session-id "$SESSION_ID" \
  --task-request-id "codex_hero-card_done_$(date +%s)"
```

### 处理失败

```bash
npx @axhub/genie editor editing set \
  --channel "$CHANNEL" \
  --target-client-id "$TARGET_CLIENT_ID" \
  --element-key "hero-card" \
  --state error \
  --provider codex \
  --session-id "$SESSION_ID" \
  --task-request-id "codex_hero-card_error_$(date +%s)"
```

### 异常退出兜底释放

```bash
npx @axhub/genie editor editing set \
  --channel "$CHANNEL" \
  --target-client-id "$TARGET_CLIENT_ID" \
  --element-key "hero-card" \
  --state idle \
  --provider codex
```

说明：
- `--state` 允许 `editing`、`idle`、`completed`、`error`
- `editing.set` 控制 `taskState`，不直接改变 `changeState`
- `--session-id` 和 `--task-request-id` 可选，用于任务追踪
- 结束后仍需重新读 `nodes list` 确认节点最终状态

## 8. 推荐执行顺序

```bash
npx @axhub/genie status --json
npx @axhub/genie editor clients list --channel "$CHANNEL"
npx @axhub/genie editor snapshot --channel "$CHANNEL" --target-client-id "$TARGET_CLIENT_ID"
npx @axhub/genie editor nodes list --channel "$CHANNEL" --target-client-id "$TARGET_CLIENT_ID" --status pending-dispatch,dirty
```

然后按节点循环：

1. `editor editing set --state editing`
2. 如有需要，拉 `context-images export`
3. 如仍难定位，拉 `node screenshot`
4. 修改代码
5. 重新拉 `snapshot` 与 `nodes list`
6. 成功 → `editor editing set --state completed`；失败 → `--state error`；异常 → `--state idle`

## 9. 最终复核

结束前至少再跑一次：

```bash
npx @axhub/genie editor nodes list \
  --channel "$CHANNEL" \
  --target-client-id "$TARGET_CLIENT_ID" \
  --status pending-dispatch,dirty,error,editing
```

如果列表仍有项，区分说明：
- 页面改动是否已完成
- 编辑器 backlog 是否仍残留
- 各节点的终态（`completed` / `error` / `idle`）

## 10. CLI 通用参数

| 参数 | 说明 |
|------|------|
| `--api-base <url>` | 显式指定 API Base，默认自动发现 |
| `--api-key <key>` | API Key（如开启鉴权） |
| `--channel <name>` | 目标业务通道 |
| `--target-client-id <id>` | 目标前端页面实例 |
| `--timeout-ms <ms>` | 请求超时 |
| `--json` | 显式声明 JSON 输出（editor 命令默认 JSON） |
| `--output-dir <path>` | 截图/图片导出目录 |

统一成功返回格式：

```json
{
  "ok": true,
  "requestId": "editor_001",
  "channel": "project-a",
  "targetClientId": "figma-123",
  "data": { ... }
}
```

失败时 `ok: false` + `error.code` + `error.message`，CLI 以非 0 退出码结束。

常见错误码：

| 错误码 | 说明 | 是否自动重试 |
|--------|------|------------|
| `FRONTEND_NOT_ONLINE` | 目标客户端不在线 | ✗ |
| `UNSUPPORTED_FRONTEND_CAPABILITY` | 客户端不支持该 editor 指令 | ✗ |
| `REQUEST_TIMEOUT` | 服务端已转发但等待前端响应超时 | ✓ 1s 后重试 |
| `CONNECTION_ERROR` | 无法连接到后端服务 WebSocket | ✓ 1s 后重试 |
| `CONNECTION_CLOSED` | WebSocket 在收到响应前关闭 | ✓ 1s 后重试 |

CLI 内置自动重试：对 `CONNECTION_ERROR`、`CONNECTION_CLOSED`、`REQUEST_TIMEOUT` 会在 1 秒后自动重试一次（最多 1 次）。对 AI Agent 完全透明，无需额外处理。
