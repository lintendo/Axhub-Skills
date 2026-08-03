# 页面与批量操作工具

先解析当前页面和操作范围。批量调用虽然方便，但也会放大目标选择错误，因此必须验证返回的受影响 ID。

| 工具 | 用途 |
| --- | --- |
| `add_page` | 创建顶层 Figma 页面。 |
| `delete_page` | 删除非当前且非最后一个页面；属于破坏性操作。 |
| `rename_page` | 重命名顶层页面。 |
| `navigate_to_page` | 切换插件的当前页面，供后续调用使用。 |
| `find_replace_text` | 在明确的子树或页面范围内替换匹配文本。 |
| `batch_rename_nodes` | 一次重命名多个已知节点 ID。 |
| `create_section` | 创建画布级 Section，用于组织流程或区域。 |
| `batch` | 以原子方式执行受支持的可逆写入，失败时回滚。 |

页面导航、重命名或删除前读取 `get_pages`。组合操作前检查 `batch` schema；破坏性或不可逆工具会被主动拒绝，必须单独处理。

```bash
node "$SKILL_DIR/scripts/figwright-operator.mjs" schema batch
node "$SKILL_DIR/scripts/figwright-operator.mjs" call batch @/absolute/path/to/ops.json
```
