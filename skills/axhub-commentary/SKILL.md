---
name: axhub-commentary
description: 处理 Axhub Commentary 完整工作流，包括读取页面批注文档、落实文案/样式/布局/交互修改、更新任务状态、清理已完成节点，以及接入调整面板属性、页面级聚合、多方案比稿和页面资源上下文。当用户提到 Axhub Commentary、Axhub Chrome 扩展页面批注、annotations.json、根据 Commentary 意见改代码、更新或清理批注任务、让页面“能在调整面板改”、方案切换或页面定位信息时使用。
---

# Axhub Commentary 工作流

覆盖两类相邻工作：一类是读取 Commentary 批注、落实代码修改并维护任务文档；另一类是补齐页面侧接入，让 Axhub Chrome 扩展或预览环境里的编辑器能识别、定位、读取可调整属性并回写。

这个技能不负责安装编辑器 runtime。默认编辑器由 Axhub Chrome 扩展或宿主预览环境提供。页面侧只补必要的上下文声明和 tweak 协议；如果目标项目已经可用 `@axhub/commentary-react`，可以把它作为 React helper 使用，但不要把安装 NPM 包写成前置条件。

## 工作分流

先判断任务属于哪条工作线，只读取对应参考文件。

### 1. 批注读取与处理

任务涉及页面批注、改稿意见、批注图片、任务状态或已完成节点清理时，读 `references/comment-processing.md`。

### 2. 页面侧接入

按目标继续分流：

- 调整面板属性、页面级属性聚合 → 读 `references/property-editing.md`
- 多方案设计比稿、页面内方案切换 → 读 `references/design-bid.md`
- 页面定位、实现文件和资源上下文 → 读 `references/environment-context.md`

批注要求新增接入能力时可以跨工作线：先读批注处理流程确定任务，再按具体目标补读一个页面侧接入参考。

## 实施原则

### 批注读取与处理

- 批注处理按 `references/comment-processing.md` 完成读取、任务认领、状态更新和节点清理；不要只改代码却把任务文档留在处理中
- 有 Commentary 状态接口时优先通过接口更新；没有接口但任务要求维护持久化文档时，使用结构化 JSON 读写并做并发保护
- 完成清理前先验证修改；失败或无法定位时保留批注并记录错误状态

### 页面侧接入

- tweak / schema / values / adapter / update / card 方案切换优先接入 `window.__AXHUB_COMMENTARY_TWEAK_PROTOCOL__`
- React 宿主如果已经能使用 `@axhub/commentary-react`，优先用它的 store / adapter / hook 简化注册；否则直接实现同一套全局 tweak protocol
- 页面资源上下文 / `filePath` / `targetPath` / `projectPath` 优先走页面声明 `window.__COMMENTARY_HOST__`；如果当前项目本来就手动初始化 Commentary runtime，再走 `createCommentary(...).host.getResourceContext()`
- 术语对齐 `schema`、`values`、`adapter`、`update`
- 页面环境信息优先提供最小必要的资源上下文，不堆临时调试噪音
- 宿主负责业务字段、默认值和回写语义
- 页面级属性聚合不是另造一套全局静态配置，而是基于元素级 tweak 注册结果做聚合展示
- 如果当前环境支持子代理，可把独立实现拆出去；主代理保留整体约束与最终复核

## 交付要求

最终回复按命中的子流程包含必要信息：

- 批注处理：完成了哪些界面修改、是否还有未处理或异常批注、做了哪些验证
- 页面接入：修改了哪些文件、暴露了哪些属性或方案字段、做了哪些验证
- 回复保持面向用户，不要把内部批注状态、同步细节或命令日志当作主要内容

## 参考

- `references/comment-processing.md`
- `references/property-editing.md`
- `references/design-bid.md`
- `references/environment-context.md`
