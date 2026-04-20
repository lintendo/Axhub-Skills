---
name: genie-editor-client
description: 使用 `@axhub/genie-editor-client` 处理属性/tweak 编辑、调整面板字段暴露、页面级属性聚合、多方案设计比稿，以及将比稿方向做成可在调整面板切换的 card 选项。当用户要让元素或页面“能在调整面板改”、整理 schema / values / adapter / update、补页面级属性能力，或在 Genie 后端不在线时完成属性编辑与比稿实现时使用。
---

# Genie Editor Client 工作流

专注 `@axhub/genie-editor-client` 的接入与使用，目标是把属性编辑、多方案比稿和 card 方案切换能力落实到当前项目里。

这个技能不依赖 Genie 在线闭环。Genie 后端在线时可以复用在线上下文；不在线时，也可以直接根据当前代码、页面结构、宿主状态和用户需求完成实现。

## 适用场景

命中这些信号时，优先使用本技能：

- 用户提到属性、props、tweak、调整、schema、values、adapter、update、property panel
- 用户要“暴露可编辑项”“让它能在调整面板改”
- 用户要做页面级属性聚合
- 用户要多方案比稿
- 用户要把比稿方向做成 card 型可切换选项
- Genie 后端不在线，但仍要完成属性编辑或比稿实现

## 快速分流

- 属性编辑、页面级属性聚合 → 读 `references/property-editing.md`
- 多方案设计比稿、card 方案切换 → 读 `references/design-bid.md`

## 实施原则

- 优先复用 `@axhub/genie-editor-client`
- 术语对齐 `schema`、`values`、`adapter`、`update`
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
