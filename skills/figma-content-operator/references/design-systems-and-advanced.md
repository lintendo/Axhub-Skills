# 设计系统与高级操作

Drafito 和上游 Figwright 通过相同的完整工具契约提供这些领域能力。规划写入前先运行 `profile`，确认契约可用。

## 样式与变量

1. 创建等价项之前，先读取 `get_styles` 和/或 `get_variable_defs`。
2. 现有样式或变量在语义上符合目标设计时，应优先复用。
3. 对创建、更新、绑定、重命名或删除操作，查询对应工具的准确 schema。
4. 写入后，同时验证受影响节点以及样式或变量定义。

不要仅凭原始值相同就推断绑定关系。优先使用 Figma 返回的明确变量或样式 ID。

## 组件与实例

- 使用 `get_local_components` 和 `get_component_api` 发现组件。
- 调用 `swap_component` 或 `set_instance_properties` 前先检查实例属性。
- 只有当用户确实需要可复用组件 API 时，才创建新的组件属性。
- 将 `detach_instance`、删除组件属性以及重新组合变体视为结构性改动，必须明确限定范围。

## 资源与导出

- 仅对用户提供或任务范围内的资源使用 `import_image` 和 `import_svg`。
- 导出工具会写入文件。应在用户指定的工作区内解析明确的输出路径，并报告该路径。
- 截图用于视觉验证，不能替代语义验证。

## 页面与原型交互

- 页面导航、重命名或删除前先读取 `get_pages`。
- 修改原型行为前先读取 `get_reactions`。
- 调用 `set_reactions` 后验证导航目标以及触发器和动作语义。

渐进发现工具：

```bash
node "$SKILL_DIR/scripts/figwright-operator.mjs" tools variable
node "$SKILL_DIR/scripts/figwright-operator.mjs" schema bind_variable_to_node
```
