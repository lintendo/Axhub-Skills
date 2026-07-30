# 布局与节点结构工具

区分几何属性、父级布局规则和节点树结构。视觉上相似的结果可能具有完全不同的语义层级，因此要同时验证节点属性和父子关系。

| 工具 | 用途 |
| --- | --- |
| `move_nodes` | 按相对位移移动多个节点。 |
| `set_position` | 设置绝对 x/y 坐标。 |
| `resize_nodes` | 设置节点尺寸。 |
| `set_auto_layout` | 为容器启用、配置或移除 Auto Layout。 |
| `set_layout_props` | 修改子节点尺寸、对齐、定位或网格子项属性。 |
| `set_layout_grids` | 替换 Frame 的列、行或基线布局网格。 |
| `set_blend_mode` | 修改节点与下方图层的混合方式。 |
| `set_mask` | 启用或禁用蒙版，并选择蒙版类型。 |
| `set_arc` | 将椭圆配置为弧形、饼图、仪表或圆环。 |
| `set_constraints` | 设置普通 Frame 内的缩放约束。 |
| `rotate_nodes` | 设置节点的绝对旋转角度。 |
| `lock_nodes` | 锁定节点，防止在画布中选中或编辑。 |
| `unlock_nodes` | 解除 `lock_nodes`。 |
| `clone_node` | 复制节点及其子树。 |
| `group_nodes` | 用 Group 包裹同级节点。 |
| `ungroup_nodes` | 移除 Group 容器；属于结构性和破坏性操作。 |
| `reparent_nodes` | 将节点移动到另一个父节点，并可指定索引。 |
| `reorder_nodes` | 修改同一父节点内的层叠顺序。 |

在 Auto Layout 中，应优先修改布局属性，避免使用自由 x/y 定位。重新指定父节点会让坐标相对新父级，从而改变视觉位置。分组、取消分组或重新指定父节点前先读取父级和目标，操作后验证层级与几何属性。
