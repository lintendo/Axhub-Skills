# Figwright 工具索引

这是 `@figwright/mcp@0.3.0` 中 104 个工具的一级精简索引。工具名称完整列出，但有意省略参数 schema。选择一个领域，读取对应的二级参考，再通过 `schema <tool>` 只获取准确的三级 schema。

## 检查与理解 — 15

读取 `references/tools/inspect.md` 获取路由说明。

`ping`, `get_selection`, `get_document`, `get_node`, `get_nodes_info`, `get_metadata`, `get_pages`, `search_nodes`, `scan_text_nodes`, `scan_nodes_by_types`, `get_viewport`, `get_fonts`, `get_annotations`, `list_files`, `get_design_context`

## 导出与代码映射 — 10

读取 `references/tools/export-and-grounding.md` 获取路由说明。

`get_screenshot`, `save_screenshots`, `save_image_fills`, `export_pdf`, `analyze_project`, `scan_components`, `component_map`, `token_map`, `icon_map`, `design_diff`

## 画布内容与外观 — 17

读取 `references/tools/canvas-content.md` 获取路由说明。

`set_fills`, `set_text`, `set_text_properties`, `set_text_range`, `create_frame`, `set_opacity`, `set_visible`, `rename_node`, `delete_nodes`, `create_text`, `create_rectangle`, `set_corner_radius`, `set_strokes`, `set_effects`, `create_ellipse`, `import_image`, `import_svg`

## 布局与节点结构 — 18

读取 `references/tools/layout-and-structure.md` 获取路由说明。

`move_nodes`, `set_position`, `resize_nodes`, `set_auto_layout`, `set_layout_props`, `set_layout_grids`, `set_blend_mode`, `set_mask`, `set_arc`, `set_constraints`, `rotate_nodes`, `lock_nodes`, `unlock_nodes`, `clone_node`, `group_nodes`, `ungroup_nodes`, `reparent_nodes`, `reorder_nodes`

## 样式与变量 — 21

读取 `references/tools/styles-and-variables.md` 获取路由说明。

`get_styles`, `create_paint_style`, `create_text_style`, `create_effect_style`, `create_grid_style`, `update_paint_style`, `update_text_style`, `update_effect_style`, `apply_style_to_node`, `delete_style`, `get_variable_defs`, `create_variable_collection`, `add_variable_mode`, `create_variable`, `set_variable_value`, `bind_variable_to_node`, `bind_variable_to_paint`, `rename_variable`, `set_variable_code_syntax`, `delete_variable`, `delete_variable_collection`

## 组件与原型 — 15

读取 `references/tools/components-and-prototypes.md` 获取路由说明。

`get_local_components`, `get_component_api`, `get_reactions`, `set_reactions`, `remove_reactions`, `swap_component`, `set_instance_properties`, `add_component_property`, `bind_component_property`, `edit_component_property`, `delete_component_property`, `detach_instance`, `create_component`, `create_instance`, `combine_as_variants`

## 页面与批量操作 — 8

读取 `references/tools/pages-and-batch.md` 获取路由说明。

`add_page`, `delete_page`, `rename_page`, `navigate_to_page`, `find_replace_text`, `batch_rename_nodes`, `create_section`, `batch`

## 实时 schema 为准

本索引只是路由图，不是参数契约。每次调用前运行：

```bash
node "$SKILL_DIR/scripts/figwright-operator.mjs" schema <exact-tool-name>
```

如果未来固定的服务器版本改变工具目录，应运行 `catalog-check`，并同步更新本索引、领域参考、`assets/tool-index.json` 和测试。
