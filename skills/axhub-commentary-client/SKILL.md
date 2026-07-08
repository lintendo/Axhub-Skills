---
name: axhub-commentary-client
description: 处理 Axhub Commentary 页面侧接入工作流，包括调整面板可编辑项、页面级属性聚合、多方案设计比稿与方案切换，以及页面资源上下文与定位信息补齐。当用户要让页面配合 Axhub Chrome 扩展或 Make 预览环境“能在调整面板改”、按页面统一整理可编辑项、先出多版方向再切换对比，或补页面定位信息以便调试时快速找到当前页和对应实现时使用。
---

# Axhub Commentary 页面侧接入工作流

专注 Axhub Commentary 的页面侧接入，目标是让页面能被 Axhub Chrome 扩展或 Make 预览环境里的编辑器识别、定位、读取可调整属性并回写。

这个技能不负责安装编辑器 runtime。默认编辑器由 Axhub Chrome 扩展注入，或由 Make 预览环境提供。页面侧只补必要的上下文声明和 tweak 协议；如果目标项目已经可用 `@axhub/commentary-react`，可以把它作为 React helper 使用，但不要把安装 NPM 包写成前置条件。

## 适用场景

命中这些信号时，优先使用本技能：

- 用户要“暴露可编辑项”“让它能在调整面板改”
- 用户要按页面统一整理可编辑项
- 用户要先出多版方向，再比较后决定推进哪一版
- 用户要把多个方向做成页面里可切换的方案
- 用户要补页面定位信息，便于调试时快速找到当前页和对应实现
- 用户使用 Axhub Chrome 扩展或 Make 预览环境打开页面，但页面缺少可识别的上下文或调整项

## 快速分流

- 属性编辑、页面级属性聚合 → 读 `references/property-editing.md`
- 多方案设计比稿、card 方案切换 → 读 `references/design-bid.md`
- 页面环境信息、调试定位、宿主资源上下文 → 读 `references/environment-context.md`

## 实施原则

- tweak / schema / values / adapter / update / card 方案切换优先接入 `window.__AXHUB_COMMENTARY_TWEAK_PROTOCOL__`
- React 宿主如果已经能使用 `@axhub/commentary-react`，优先用它的 store / adapter / hook 简化注册；否则直接实现同一套全局 tweak protocol
- 页面资源上下文 / `filePath` / `targetPath` / `projectPath` 优先走页面声明 `window.__COMMENTARY_HOST__`；如果当前项目本来就手动初始化 Commentary runtime，再走 `createCommentary(...).host.getResourceContext()`
- 术语对齐 `schema`、`values`、`adapter`、`update`
- 页面环境信息优先提供最小必要的资源上下文，不堆临时调试噪音
- 宿主负责业务字段、默认值和回写语义
- 页面级属性聚合不是另造一套全局静态配置，而是基于元素级 tweak 注册结果做聚合展示
- 如果当前环境支持子代理，可把独立实现拆出去；主代理保留整体约束与最终复核

## 交付要求

最终回复至少包含：

- 命中的子流程
- 修改了哪些文件
- 暴露了哪些属性或方案字段
- 做了哪些验证

## 参考

- `references/property-editing.md`
- `references/design-bid.md`
- `references/environment-context.md`
- Axhub Runtime: `packages/axhub-commentary/PUBLIC-API.md`
- Axhub Runtime: `packages/axhub-commentary-react/README.md`
