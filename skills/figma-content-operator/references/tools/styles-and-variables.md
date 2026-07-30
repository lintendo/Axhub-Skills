# 样式与变量工具

创建新定义前先读取现有内容。复用语义正确的样式或变量；原始值相同并不能证明两个 token 具有相同含义。

## 样式

| 工具 | 用途 |
| --- | --- |
| `get_styles` | 盘点本地 Paint、Text、Effect 和 Grid Style。 |
| `create_paint_style` | 创建可复用 Paint Style。 |
| `create_text_style` | 创建可复用字体样式。 |
| `create_effect_style` | 创建可复用阴影或模糊样式。 |
| `create_grid_style` | 创建可复用布局网格样式。 |
| `update_paint_style` | 修改现有 Paint Style。 |
| `update_text_style` | 修改现有 Text Style。 |
| `update_effect_style` | 修改现有 Effect Style。 |
| `apply_style_to_node` | 将样式绑定到匹配的节点字段。 |
| `delete_style` | 删除已明确解析的本地样式；属于破坏性操作。 |

## 变量

| 工具 | 用途 |
| --- | --- |
| `get_variable_defs` | 盘点本地集合、模式、值、别名和代码语法。 |
| `create_variable_collection` | 创建变量集合及其默认模式。 |
| `add_variable_mode` | 在 Figma 套餐允许时添加模式。 |
| `create_variable` | 在集合中创建指定类型的变量。 |
| `set_variable_value` | 为一个模式设置变量值或别名。 |
| `bind_variable_to_node` | 绑定或取消绑定尺寸、圆角等节点标量字段。 |
| `bind_variable_to_paint` | 在 Fill 或 Stroke Paint 上绑定或取消绑定颜色变量。 |
| `rename_variable` | 重命名变量，同时保留 ID 和绑定。 |
| `set_variable_code_syntax` | 设置各平台权威的代码侧名称。 |
| `delete_variable` | 删除一个变量；属于破坏性操作并会影响绑定。 |
| `delete_variable_collection` | 删除集合、模式和变量；属于破坏性操作。 |

创建顺序为：集合 → 可选模式 → 变量 → 各模式的值 → 绑定和代码语法。写入后通过 `get_variable_defs` 和受影响节点验证。
