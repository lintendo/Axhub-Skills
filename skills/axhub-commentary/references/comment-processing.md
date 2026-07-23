# 页面批注处理子流程

当用户要求落实 Commentary 批注、更新批注状态或删除批注时，走这里。

## 定位批注

批注文件位于：

```text
.axhub/chrome/pages/<page-id>/
  page.json
  comments.json
  assets/
```

用户给出 `page-id` 或文件路径时直接使用；否则用页面 URL 匹配 `page.json.url`。无法唯一定位时不要猜测，也不要更新状态。

读取 `comments.json` 后确认它是 `schemaVersion: 3`、`kind: axhub-chrome-comments`、`identityVersion: 1` 的文档，并包含 `comments`、`assets` 数组。每条批注必须有非空 `id`，每个资源必须有非空 `assetId`、`commentId`、`relativePath`、`mimeType` 和 `sha256`；目录名、`comments.json.page.pageId` 和 `page.json.pageId` 必须一致。同页旧 schema、格式损坏或缺少稳定身份时，由扩展用有效本地 v3 状态覆盖后重新读取；文件类型、`pageId`、更高 schema 不匹配，或重读后仍不满足 v3 约束时停止写回。

`comments[].id` 是批注合并、状态和删除的唯一持久身份，资源通过 `assets[].commentId` 与它关联。`pageScope`、locator 和运行时 `elementKey` 只用于定位页面目标，可能随刷新变化，不得用来合并、去重或覆盖另一条批注。

处理前按记录状态筛选：`deletedAt > 0` 或 `state: completed` 的记录直接跳过；`state: idle` 可以处理；`state: error` 只在用户明确要求重试时处理；`state: editing` 只允许相同 `requestId` 和 `sessionId` 的当前执行继续，其他情况保留且不覆盖。缺少状态或状态值不合法时停止处理该记录。

图片只通过 `assets[].relativePath` 读取。该值必须是相对当前页面目录且位于其 `assets/` 子目录内的非空相对路径；拒绝绝对路径和包含 `..` 的路径。读取前分别解析 `assets/` 根目录和候选文件的真实路径，并确认候选仍包含在真实根目录内；文件不存在、无法解析或通过符号链接逃逸时不读取。

## 处理流程

1. 写回前重新读取最新文档，避免用旧内容覆盖并发修改。
2. 按原 `comments[].id` 在最新文档中重新取得目标，再核对可处理条件；不同 `requestId` 或 `sessionId` 的 `editing` 记录不覆盖。
3. 通过状态接口或结构化写入，将该 `id` 对应的批注更新为 `editing`；不要新增任务集合。
4. 根据批注实施代码修改并完成必要验证。
5. 成功后写入 `completed`，失败则写入 `error` 和简短原因。状态接口没有返回 `applied: true` 时，不算更新成功。
6. 确认 `completed` 已写入后，询问用户是否清除这批已完成批注；未明确确认时保留所有记录。
7. 用户确认后，只给本次确认完成的批注 `id` 写入同一个毫秒时间戳 `deletedAt`，确认标记已落盘后停止，由扩展按 `commentId` 关联统一完成后续清理。

状态信息直接保存在每条批注上，包括 `state`、provider、request/session、更新时间和消息。状态只使用 `idle`、`editing`、`completed`、`error`，`completed` 在界面中自动收起也不代表批注已删除。

直接维护 `comments.json` 时使用 JSON 解析和结构化写入，保留文档身份、`documentRevision`、所有批注 `id` 和资源 `commentId`，只更新顶层 `updatedAt` 和目标批注，不伪造扩展内部 revision，也不写入 Base64、绝对路径或凭据。

AI 不执行删除：不要移除数组记录，不修改或删除 asset，不压缩文档，也不删除本地文件或 `page.json`。

## 完成回复

简要说明修改和验证结果。尚未询问时，在回复末尾询问是否清除；删除标记已写入时，只说明已交由扩展处理。
