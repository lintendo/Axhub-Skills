# 编辑 Figma 画布

将节点 ID 和实时 schema 视为操作契约。先读取目标，执行范围最小的改动，再次读取验证。

## 基础编辑闭环

1. 使用 `get_selection` 或 `get_node` 记录当前状态。
2. 使用 `schema <write-tool>` 获取必需参数。
3. 只有当目标值、目标节点或破坏性范围不明确时，才向用户确认。
4. 调用写入工具。
5. 使用 `get_node` 验证返回的节点 ID。

示例：

```bash
node "$SKILL_DIR/scripts/figwright-operator.mjs" call get_node '{"nodeId":"1:42"}'
node "$SKILL_DIR/scripts/figwright-operator.mjs" schema set_text
node "$SKILL_DIR/scripts/figwright-operator.mjs" call set_text '{"nodeId":"1:42","characters":"更新后的文案"}'
node "$SKILL_DIR/scripts/figwright-operator.mjs" call get_node '{"nodeId":"1:42"}'
```

## 关联编辑

对于多个相关编辑，检查 schema 后优先使用 `batch`。如果某一步失败，它会回滚受支持的可逆操作。删除等破坏性操作会被 `batch` 主动拒绝，必须单独限定范围并验证。

## 破坏性或大范围改动

- 调用 `delete_nodes`、删除页面、分离实例、取消分组或删除变量/样式前，先解析每个目标 ID。
- 除非用户明确要求这种结构变化，否则不要仅为了方便其他编辑而转换组件实例或移除绑定。
- 写入超时后如需重试，应先读取节点。超时不代表上一次调用一定失败。
