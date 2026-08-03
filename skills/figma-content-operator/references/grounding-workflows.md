# 设计映射工作流

使用当前版本的 Drafito 或上游 Figwright 进行设计到代码、代码到设计或设计系统映射时，读取本参考。

## Figma 到代码

1. 读取当前选区。
2. 对选中根节点调用 `get_design_context`；节点树较大时先使用精简模式。
3. 生成代码前，先在本地检查用户项目。
4. 只在与当前设计和代码库映射有关时使用 `analyze_project`、`scan_components`、`component_map`、`token_map` 和 `icon_map`。
5. 复用已验证的组件和 token；不要仅因为值看起来相似就生成映射。
6. 更新现有代码时，如果已有基线，使用 `design_diff` 聚焦真实设计变化。

## 代码或规格到 Figma

1. 新设计但交付路径不明确时，先询问是生成网页（HTML/React/Vue）还是直接修改 Figma；完整页面、响应式和多状态设计推荐网页优先，已有画布的局部调整推荐直接修改。
2. 网页路径先得到浏览器可访问 URL，再按 `references/webpage-to-figma.md` 执行。该路径不启动 MCP，用户自行粘贴到目标文件。
3. 用户在新设计场景中选择直接生成 Figma 内容时，读取 <https://github.com/awdr74100/figwright/blob/v0.3.0/skills/figma-build/SKILL.md>，再按其中的构建工作流写入当前连接的 Figma 文件。
4. 用户明确要求修改当前画布、选区或已有节点时，直接使用 Figwright；先检查目标页面以及本地样式、变量和组件，不重新导入整页，也不读取上述构建 Skill。
5. 只查询计划使用的工具 schema，并通过聚焦读取和截图验证 MCP 修改结果。
