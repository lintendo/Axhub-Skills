# 检查与理解工具

使用能够回答问题的最小范围读取。从当前选区或已知节点 ID 开始；只有当搜索和有范围限制的设计上下文无法回答时，才读取完整页面。

| 工具 | 用途 |
| --- | --- |
| `ping` | 验证服务器、插件和 Figma 的完整链路及当前页面。 |
| `get_selection` | 解析用户当前选区并获取节点 ID。 |
| `get_document` | 读取完整的当前页面树；输出可能非常大。 |
| `get_node` | 以最高保真度读取一个节点及其完整递归子树。 |
| `get_nodes_info` | 在一次聚焦请求中读取多个已知节点 ID。 |
| `get_metadata` | 读取文件名、当前页面和页面引用，同时探测插件的完整支持能力。 |
| `get_pages` | 在页面导航或修改前列出页面 ID 和名称。 |
| `search_nodes` | 按名称子串或准确类型查找节点。 |
| `scan_text_nodes` | 在指定范围内收集文本节点及其可见字体和内容。 |
| `scan_nodes_by_types` | 按一个或多个 Figma 节点类型收集扁平节点集。 |
| `get_viewport` | 读取当前可见画布边界、中心和缩放比例。 |
| `get_fonts` | 盘点当前页面使用的字体。 |
| `get_annotations` | 读取一个节点或页面的 Dev Mode 标注。 |
| `list_files` | 识别插件当前可见的宿主 Figma 文件。 |
| `get_design_context` | 读取有深度限制、节省 token 且包含设计系统信息的映射节点树。 |

常用路径：探索时使用 `get_selection` → `get_design_context`；准确写入前使用 `get_selection` → `get_node`。如果大型上下文返回 section plan，应跟进其中的 section ID，不要重试同一个宽泛请求。
