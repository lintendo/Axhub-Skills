# 导出与代码映射工具

导出工具会返回视觉字节或写入文件。代码映射工具会检查本地项目，使生成代码能够复用现有组件、token 和图标。

| 工具 | 用途 |
| --- | --- |
| `get_screenshot` | 保存渲染后的节点图片并返回临时文件路径，供宿主的图片查看能力进行视觉检查。 |
| `save_screenshots` | 将节点渲染为 PNG、JPG 或 SVG，并写入明确的输出目录。 |
| `save_image_fills` | 提取原始图片填充字节，而不是渲染后的组合结果。 |
| `export_pdf` | 将一个节点或当前页面导出为矢量 PDF 文件。 |
| `analyze_project` | 在本地检测框架、语言、样式、组件和 SVG 约定。 |
| `scan_components` | 使用项目感知解析盘点可复用的本地 UI 组件。 |
| `component_map` | 将已分析的 Figma 组件映射到本地代码组件。 |
| `token_map` | 将 Figma 变量和 Paint Style 映射到项目设计 token。 |
| `icon_map` | 将 Figma 图标节点匹配到现有 SVG 资源或图标库。 |
| `design_diff` | 为增量代码更新创建或比较已保存的 Figma 节点基线。 |

`analyze_project` 和 `scan_components` 仅在服务器本地运行，不需要 Figma。映射和差异工具需要实时设计连接。将输出路径、基线文件和映射文件都视为写入；应限定在用户指定的工作区并报告结果。
