---
name: genie-editor-client
description: 使用 `@axhub/genie-editor-client` 处理调整面板可编辑项、页面级属性整理、多方案设计比稿、页面内方案切换，以及页面环境信息补齐。当用户要让元素或页面“能在调整面板改”、按页面统一整理可编辑项、先出多版方向再切换对比，或补页面定位信息以便调试时快速找到当前页和对应实现时使用。
---

# Genie Editor Client 工作流

专注 `@axhub/genie-editor-client` 的接入与使用，目标是把属性编辑、多方案比稿、card 方案切换和页面环境信息声明能力落实到当前项目里。

这个技能不依赖 Genie 在线闭环。Genie 后端在线时可以复用在线上下文；不在线时，也可以直接根据当前代码、页面结构、宿主状态和用户需求完成实现。

## 适用场景

命中这些信号时，优先使用本技能：

- 用户要“暴露可编辑项”“让它能在调整面板改”
- 用户要按页面统一整理可编辑项
- 用户要先出多版方向，再比较后决定推进哪一版
- 用户要把多个方向做成页面里可切换的方案
- 用户要补页面定位信息，便于调试时快速找到当前页和对应实现
- Genie 后端不在线，但仍要完成属性编辑、比稿或方案切换实现

## 快速分流

- 属性编辑、页面级属性聚合 → 读 `references/property-editing.md`
- 多方案设计比稿、card 方案切换 → 读 `references/design-bid.md`
- 页面环境信息、调试定位、宿主资源上下文 → 读 `references/environment-context.md`

## 实施原则

- 优先复用 `@axhub/genie-editor-client`
- 术语对齐 `schema`、`values`、`adapter`、`update`
- 页面环境信息优先提供最小必要的资源上下文，不堆临时调试噪音
- 宿主负责业务字段、默认值和回写语义
- 页面级属性聚合继续按节点组织，不另造全局静态配置
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
