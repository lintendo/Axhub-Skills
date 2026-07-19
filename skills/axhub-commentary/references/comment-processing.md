# 页面批注处理子流程

当用户要落实 Axhub Commentary 页面批注、处理 `annotations.json`、更新任务状态或清理已完成节点时，走这里。

## 目标

把批注意图准确落实到实现代码，并让批注文档与真实执行结果保持一致。代码修改、验证、任务状态和节点清理是同一条完成链路，不能只做其中一半。

## 文件定位与读取

Commentary 的项目文件位于：

```text
.axhub/chrome/pages/<page-id>/
  page.json
  annotations.json
  assets/
  captures/
```

按以下顺序定位：

1. Prompt 明确给出 `page-id` 或批注文档路径时直接使用。
2. 否则用 Prompt 中的页面 URL 匹配各目录的 `page.json.url`。
3. URL 不能唯一匹配时，再结合 `page.json.title`、`origin`、当前实现文件和用户上下文判断。
4. 仍不确定时保留候选，不猜测目录，也不更新任何任务状态。

读取 `annotations.json` 后先校验：

- `schemaVersion` 为 `1`
- `kind` 为 `axhub-chrome-annotations`
- `identityVersion` 为 `1`
- `page.pageId` 与目录名及 `page.json.pageId` 一致
- `annotations`、`tasks`、`assets` 都是数组

记录读取时的完整文件内容和 `documentRevision`。写回前重新读取；如果文件已经变化，在最新文档上重新应用当前节点的最小更新，不能用旧快照覆盖并发修改。

## 文档结构

- `annotations[]`：批注正文、`pageScope`、`elementKey`、locator、label，以及文案、样式或 tweak 修改信息
- `tasks[]`：任务 `id`、`pageScope`、`state`、provider、request/session、时间和消息
- `assets[]`：`assetId`、关联节点 `annotationId`、工作区相对 `relativePath`、MIME、大小和 hash

图片只通过 `assets[].relativePath` 读取。路径必须位于当前页面目录的 `assets/` 下；不要把 Base64、data URL、绝对路径或带凭据的 URL 写回 JSON。

## 节点身份

用 `pageScope + elementKey` 标识一个批注节点：

- `elementKey` 是主键，清理和状态更新都以它为准。
- `pageScope` 用来隔离同一页面聚合中的不同路由或视图；有值时必须精确匹配。
- 原批注缺少 `elementKey` 时，只能用稳定 `id`、locator、label 和当前文本辅助确认。无法唯一确认时保留记录，不执行清理。

有 `pageScope` 时，任务 `id` 按下面的稳定格式对应节点：

```text
page-scope:<encodeURIComponent(pageScope)>:<encodeURIComponent(elementKey)>
```

没有 `pageScope` 时，任务 `id` 直接使用 `elementKey`。

## 任务状态

状态只使用 `idle`、`editing`、`error`、`completed`。

### 开始处理

1. 检查相同节点是否已有 `editing` 任务。
2. 如果它属于不同的 `requestId` 或 `sessionId`，视为其他执行者正在处理，不抢占也不清理。
3. 否则新增或更新对应任务为 `editing`，写入当前 provider、requestId、sessionId、`updatedAt` 和简短消息“AI 编辑中”。
4. 只更新当前节点任务，不改其他节点的状态。

### 处理失败

- 保留对应 `annotations[]` 和 `assets[]`，以便重试。
- 把任务更新为 `error`，刷新 `updatedAt`，在 `message` 写入可操作的简短原因。
- 不因为定位失败、测试失败或部分完成而清理节点。

### 处理完成

完成必须同时满足：修改已落地、目标批注逐条核对完成、必要验证已通过。

连接 Commentary 状态接口时，优先调用 `setNodeEditingState(elementKey, nextState, taskRef, targetRef)` 完成 `editing / error / completed` 更新；宿主会按相同规则持久化和同步。接口没有确认 `applied: true` 时，不要假设状态已经写入。没有状态接口而需要直接维护文档时，完成后直接执行节点清理，不在 `tasks[]` 中长期保留 `completed` 记录。

## 已完成节点清理

先构造本次确认完成的 `targetKeys`。通常只有原始 `elementKey`；如果修改后 DOM 身份漂移，但 locator 能明确证明是同一节点，可同时加入原 key 和当前 live key。不能仅凭相似文案扩大清理范围。

对每个 `targetKey` 按顺序处理：

1. 从 `annotations[]` 删除 `elementKey` 命中且 `pageScope` 与当前任务一致的记录。
2. 从 `tasks[]` 删除该节点对应的直接或 page-scoped 任务，不论其原状态是 `idle`、`editing`、`error` 还是遗留的 `completed`。
3. 找出 `assets[].annotationId` 命中该节点的资源。只有当剩余批注不再引用该节点或资源时，才删除对应 `assets[]` 记录。
4. 对被移除资源的 `relativePath`，只有当它不再被任何剩余 `assets[]` 引用、路径位于当前页面 `assets/` 目录且文件确实存在时，才删除本地文件。
5. 不删除 `captures/`、`page.json`、其他 page-id 的文件，或任何无法证明属于当前节点的资源。

清理必须限定在当前 `pageScope`。同一个 `elementKey` 出现在其他 scope 时，保留其他 scope 的 annotation、task 和仍被使用的 asset。

## 写回规则

- 使用 JSON 解析和结构化写入，不做字符串替换。
- 在最新文件上应用最小节点更新；发现 `documentRevision` 或文件内容变化时先合并再写。
- 更新顶层 `updatedAt`，保留 `schemaVersion`、`kind`、`identityVersion`、`page` 和现有 `documentRevision`，不要伪造扩展内部 revision。
- 保持 JSON 中没有 Base64、data URL、绝对路径或凭据。
- 先安全写回 `annotations.json`，再删除已确认无引用的资源文件，避免文档引用不存在的图片。

## 实施与验证

1. 读取仓库和目标目录规则，确认实现文件和验证方式。
2. 认领当前节点并更新为 `editing`。
3. 根据批注正文、修改前后值、locator 和关联图片实施代码修改。
4. 逐条核对明确要求，未提及内容保持不动。
5. 运行与风险相称的测试、构建或真实页面验证。
6. 成功后清理节点；失败则写入 `error` 并保留上下文。
7. 再次读取文档，确认目标节点已清理或错误状态已保存，其他节点未变化。

## 完成回复

简要说明完成了哪些界面修改、是否还有未处理或异常节点、做了哪些验证。除非同步冲突直接影响结果，不要把 pageId、revision、任务状态或文件操作日志作为主要回复内容。
