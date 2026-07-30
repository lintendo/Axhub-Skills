# 读取与检查 Figma

使用能够回答问题的最小范围读取。

## 推荐顺序

1. 当用户提到“这个”“选中的 Frame”或当前设计时，先运行 `get_selection`。
2. 将返回的节点 ID 交给 `get_node`，读取小型目标子树。
3. 对大型 Frame 或代码生成任务，优先使用 `get_design_context`。先使用 `detail: "compact"` 并限制 `depth`，再只对相关部分请求完整细节。
4. 在页面中查找名称、文案或节点类型时，使用搜索或扫描工具代替 `get_document`。
5. 只有需要视觉证据时才截图；属性仍应以语义节点数据为准。

调用 `get_screenshot` 时，包装器会把 MCP 返回的图片内容块保存到临时目录，并在 `images[].path` 中返回绝对路径。必须使用宿主的图片查看能力打开该路径后再做视觉判断；终端中的 JSON 只提供元数据，不代表模型已经看到图片。

## 示例

```bash
node "$SKILL_DIR/scripts/figwright-operator.mjs" call get_selection '{}'
node "$SKILL_DIR/scripts/figwright-operator.mjs" schema get_node
node "$SKILL_DIR/scripts/figwright-operator.mjs" call get_node '{"nodeId":"1:42"}'
```

节省上下文的读取方式：

```bash
node "$SKILL_DIR/scripts/figwright-operator.mjs" schema get_design_context
node "$SKILL_DIR/scripts/figwright-operator.mjs" call get_design_context '{"nodeId":"1:42","depth":3,"detail":"compact","dedupeComponents":true}'
```

如果 `get_design_context` 返回 `sectionPlan`，应逐个跟进其中的 section 节点 ID，不要重试同一个无范围限制的请求。

## 结果报告

- 报告页面名称和节点 ID，确保后续写入可审计。
- 按层级、尺寸、布局、字体、颜色以及组件/变量绑定总结大型节点树。
- 区分明确的 Figma 绑定和推断匹配。原始颜色值与 token 值一致只是证据，不代表一定存在变量绑定。
