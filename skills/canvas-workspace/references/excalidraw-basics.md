# Excalidraw 基础指导

这份只说明如何把内容组织成 Excalidraw 图，不规定 Axhub 画布流程。基础思路参考 `excalidraw-diagram-generator`：先判断图类型，再抽取元素、关系和复杂度，最后生成清晰布局。

参考来源：https://www.skills.sh/github/awesome-copilot/excalidraw-diagram-generator

## 先判断图类型

| 用户意图 | 适合图形 |
|----------|----------|
| 流程、步骤、审批、状态流转 | Flowchart |
| 模块关系、依赖、信息结构 | Relationship diagram |
| 概念拆解、头脑风暴 | Mind map |
| 系统、页面、组件、服务结构 | Architecture diagram |
| 数据输入、处理、输出 | Data flow diagram |
| 多角色协作流程 | Swimlane |

如果用户要真实图片或 UI 设计稿，按主技能里的生成意图澄清处理；生成后的内容仍应呈现在画布上。

## 抽取信息

动手画之前先明确：

- 关键元素：节点、步骤、角色、页面、模块。
- 关系：先后、依赖、父子、输入输出、跳转。
- 复杂度：元素太多时拆成多个 Frame 或多张图。
- 主次：优先画主路径，细节放到旁边补充。

## 布局原则

- 流程图：从左到右或从上到下。
- 关系图：核心元素居中，相关元素围绕或分组。
- 架构图：按层级、职责或数据流分区。
- 思维导图：中心主题 + 4-6 个主分支。
- Swimlane：角色用列或行，活动放进对应泳道。

相关内容使用 Frame 分组，组内元素用 `frameId` 归属到对应 Frame。

## 控制复杂度

- 单张图优先控制在 20 个核心元素以内。
- 复杂请求先画高层图，再按模块拆详细图。
- 避免把长文档逐句搬进画布；画结构和决策点。
- 颜色只表达语义，不做装饰。

## 与 Axhub 规范的边界

- 画布文件仍写入 `src/prototypes/<prototype-name>/canvas.excalidraw`。
- 字体、颜色、节点、资源和交付口径仍按本技能主文档与其他 references 执行。
