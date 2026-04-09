# 通信稳定性参考

## 架构概述

```
AI Agent (CLI)                  Backend (WS Hub)                  Editor (Frontend)
     │                               │                                  │
     │──editing.set(editing)─────────▶│──forward──────────────────────▶│  
     │                               │◁──────────editing.result──────│
     │◁──editing.result──────────────│                                  │
     │                               │                                  │
     │  ... AI 修改代码 ...            │                                  │
     │                               │                                  │
     │──editing.set(completed)───────▶│──forward──────────────────────▶│
     │                               │◁──────────editing.result──────│
     │◁──editing.result──────────────│                                  │
```

三方角色：
- **AI Agent**：通过 CLI 发送编辑指令
- **Backend (AI-Web-UI)**：WebSocket 消息转发中枢 + 编辑状态缓存
- **Editor (Chrome Extension)**：接收指令 → 更新 UI overlay → 返回结果

## 编辑状态四状态生命周期

| 状态 | 含义 | 前端 overlay | 持久化 |
|------|------|-------------|--------|
| `editing` | AI 已领取，正在处理 | 扫描线动画 + "AI 编辑中" | ✓ 写入 localStorage |
| `idle` | 释放节点（兜底/正常清理） | 清除 overlay | ✓ 从 localStorage 移除 |
| `completed` | AI 处理完成 | 绿色勾 ✓ + "修改完成"，1.8s 后自动消除 | ✓ 30min TTL |
| `error` | AI 处理失败 | 红色叉 ✕ + "AI 修改失败"，保留不消除 | ✓ 30min TTL |

## 前端连接稳定性

### 连接状态跟踪

`integration-ws` 暴露三态连接状态：`connected` / `disconnected` / `reconnecting`。

通过 `getConnectionStatus()` 方法可获取当前状态，状态变化时触发 `onConnectionStatusChange` 回调。

### 指数退避重连

断线后重连策略：

| 重试次数 | 延迟 |
|---------|------|
| 1 | 3s |
| 2 | 6s |
| 3 | 12s |
| 4 | 24s |
| 5+ | 48s |

最多重试 10 次。超过后状态变为 `disconnected`。

连接成功后重置重试计数器。

### 标签页可见性感知

监听 `visibilitychange` 事件：
- 标签页从后台切回前台时，如果 WebSocket 已断开，**立即发起重连**并重置重试计数器
- 避免 Chrome Tab Throttling 冻结 WS 连接导致的消息丢失

### 重连后身份标识

重连成功后，`integration.connect` payload 会携带 `source: 'chrome-extension'`，后端可据此识别客户端来源。

## CLI 稳定性

### 自动重试

对以下错误码自动重试一次（1s 延迟）：
- `CONNECTION_ERROR` — WebSocket 连接失败
- `CONNECTION_CLOSED` — WebSocket 在等待响应时断开
- `REQUEST_TIMEOUT` — 服务端转发后等待前端超时

非网络错误（如 `FRONTEND_NOT_ONLINE`、`INVALID_PAYLOAD`）不会重试。

## 后端缓存

### 编辑状态缓存

后端在 `editing.result` 成功转发后，会缓存最新的编辑状态：

```
key: channel::targetClientId::elementKey
value: { state, taskRef, updatedAt }
TTL: 30 分钟
清理频率: 每 5 分钟
```

用途：
- AI Agent 断线重连后可查询之前设置的节点状态
- 为未来的 `editing.states.query` 批量查询接口提供数据源

## 任务持久化与恢复

### 持久化范围

| 任务来源 | 持久化条件 |
|---------|----------|
| Genie Bridge (内置) | running + 有 sessionId + 有 provider |
| External editing (CLI) | running 状态（无需 sessionId） |
| External editing (CLI) | error/completed 且 updatedAt 在 30min 内 |

### 恢复行为

页面刷新后：
1. 从 localStorage 读回任务数据
2. 内置任务 → 标记 `recoveryPending: true`，通过 `sendStateQueries()` 向 AI Agent 确认状态
3. 外部编辑任务 → **直接恢复**，不需要远程验证（`recoveryPending: false`）
4. 恢复的外部编辑任务同步到 `externalEditingTaskByElementKey` map
5. 超时（8s）未响应的内置任务自动清除

### 阶段感知消息

内置任务通过 `agent.state.changed` 的 `phase` 字段映射为用户可见文案：

```
thinking  → "AI 正在分析"
coding    → "正在修改代码"
reviewing → "正在检查修改"
running   → "Genie 正在执行"
waiting   → "等待 AI 响应"
(default) → "Genie 正在修改"
```

overlay 中优先使用 `task.message`，不再硬编码文案，确保阶段信息实时透传到 UI。
