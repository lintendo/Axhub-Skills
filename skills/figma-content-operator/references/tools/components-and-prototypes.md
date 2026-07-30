# 组件与原型工具

修改组件或原型交互前，先检查组件 API 或现有 reactions。组件属性键必须直接取自实时读取，不要自行重建自动生成的后缀。

| 工具 | 用途 |
| --- | --- |
| `get_local_components` | 盘点选区或子树中的组件和组件集。 |
| `get_component_api` | 读取一个组件、组件集或实例的属性契约。 |
| `get_reactions` | 读取节点当前的原型交互。 |
| `set_reactions` | 替换节点上的全部原型交互。 |
| `remove_reactions` | 清除节点上的全部原型交互。 |
| `swap_component` | 将实例指向另一个本地或已发布组件。 |
| `set_instance_properties` | 设置变体、布尔、文本或实例交换属性。 |
| `add_component_property` | 声明可复用的 BOOLEAN、TEXT 或 INSTANCE_SWAP 属性。 |
| `bind_component_property` | 将声明的属性绑定到兼容的子图层字段。 |
| `edit_component_property` | 重命名属性，或修改默认值和首选值。 |
| `delete_component_property` | 删除属性及其子图层引用；属于破坏性操作。 |
| `detach_instance` | 断开实例链接并生成可直接编辑的图层；属于破坏性操作。 |
| `create_component` | 创建空组件，或把现有节点转换为组件。 |
| `create_instance` | 实例化本地或已发布组件。 |
| `combine_as_variants` | 将现有组件合并为组件集。 |

`set_reactions` 会替换而不是追加，因此除非明确要完全替换，否则先通过 `get_reactions` 做往返读取。目标只是更换组件来源时，优先使用 `swap_component`，不要分离实例。
