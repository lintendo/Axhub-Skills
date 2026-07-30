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

1. 先检查目标页面以及本地样式、变量和组件。
2. 规划小型的 Frame 层级和可复用元素。
3. 只查询计划中要使用的工具 schema。
4. 对相关且可逆的写入优先使用原子的 `batch`。
5. 通过聚焦读取和截图验证节点层级及视觉结果。

上游仓库还发布了 `figma-codegen` 和 `figma-build` 工作流 Skill。不要在此重复它们的完整编排；如已安装，可遵循其设计工作流，但应使用本 Skill 的 `call` 命令替代直接 MCP 工具调用。
