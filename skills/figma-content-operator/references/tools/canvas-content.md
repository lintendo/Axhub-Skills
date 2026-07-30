# 画布内容与外观工具

先读取目标，只获取一个准确 schema，应用范围最小的改动，再读取受影响节点验证。

| 工具 | 用途 |
| --- | --- |
| `set_fills` | 替换节点填充。 |
| `set_text` | 替换一个文本节点的全部字符。 |
| `set_text_properties` | 修改字体、段落、尺寸或溢出属性。 |
| `set_text_range` | 为富文本的准确字符范围设置样式。 |
| `create_frame` | 在页面或父节点下创建 Frame。 |
| `set_opacity` | 修改节点透明度。 |
| `set_visible` | 显示或隐藏节点。 |
| `rename_node` | 重命名图层或节点，不修改内容。 |
| `delete_nodes` | 删除已经明确解析的节点 ID；属于破坏性操作。 |
| `create_text` | 创建文本节点。 |
| `create_rectangle` | 创建矩形。 |
| `set_corner_radius` | 设置统一或分别的圆角半径。 |
| `set_strokes` | 替换描边及相关描边属性。 |
| `set_effects` | 替换阴影和模糊效果。 |
| `create_ellipse` | 创建圆形或椭圆。 |
| `import_image` | 将栅格字节或 URL 导入为图片填充矩形。 |
| `import_svg` | 将 SVG 标记导入为可编辑矢量节点。 |

使用 `set_text` 修改内容，使用 `set_text_properties` 或 `set_text_range` 修改样式。需要可编辑矢量时优先使用 `import_svg`，栅格资源使用 `import_image`。不要删除、导入远程内容或扩大到用户请求之外的目标范围。
