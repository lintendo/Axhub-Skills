# Axhub AI Skills

**Axhub AI Skills** Axhub 出品的 AI Skills 合集

## 🌟 核心技能

目前图谱中集成了以下高度包装的 AI 技能包，涵盖了从网页内容解析、设计体系提取到原型平台双向转换的全生命周期：

| 技能名称 | 一句话能力简介 | 典型魔法召唤场景 |
|---------|-----------|-------------|
| **`clone-page`** | **高精度网页逐级克隆器** | *“参考这个在线 URL，利用 Playwright 帮我 1:1 抓取并还原一个一模一样的静态页面结构。”* |
| **`extract-axure-data`** | **Axure 宇宙解析器** | *“分析这个 Axure 原型链接，深入提取它的精确截图、设计 Token、交互地图和所有的设计标注信息。”* |
| **`extract-page-data`** | **通用网页深度 X 光机** | *“打开这个页面，帮我输出长截图、提取页面视觉色板代码，并把文案骨架直接转成 Markdown。”* |
| **`generate-theme`** | **设计系统自动发电机** | *“分析特定页面的视觉风格，直接生成能够用于开发的 `DESIGN.md` 设计体系规范和 Tailwind v4 主题文件。”* |
| **`genie-editor-client`** | **调整面板属性建模器** | *“帮我把这个页面/元素的 tweak、schema、values、adapter 接上，让它能在 Genie Editor 的调整面板里直接改，并支持页面级属性聚合或多方案 card 切换。”* |
| **`genie-editor-workflow`** | **可视化交互闭环生命线** | *“检测一下我在浏览器版 Genie Editor 上的新标注卡片，作为处理者接管这些待办，改完代码后切回完成状态。”* |
| **`react-to-figma-make`** | **Figma Make 离线铸造师** | *“这个 React 项目开发完了，帮我逆向转换为 Figma Make 项目格式，并打包出可直接扔进 Figma 客户端呈现的 `.fig` 二进制文件。”* |
| **`react-to-axure`** | **Axure 运行时桥接协议** | *“这是一个普通的 React 组件，请帮我套上一层运行时封套，使其能嵌入 Axure 平台并拥有专属的可视化配置属性面板与组件通讯能力。”* |
| **`mcp-installer`** | **上下文协议 (MCP) 极速装配** | *“这里有一个提供服务的工具包，帮我自动化一键将这套 MCP 协议安装并兼容配置到当前主控的 AI IDE 中。”* |

## 🔧 安装与获取

### 方式一：直接对 AI 下达指令

在任何支持网络读取的 AI IDE（如 Cursor / Windsurf / Trae 等）中，直接向 AI 输入以下自然语言提示词：

```text
请帮我安装这个技能合集 https://github.com/lintendo/Axhub-Skills/
```

### 方式二：命令行安装

通过技能包管理工具直接安装：

```bash
npx skills add https://github.com/lintendo/Axhub-Skills/
```

> **💡 最佳实践建议**
> 
> **请勿盲目安装整个合集！**
> 1. **按需引入**：建议针对性地只挑取当前任务所需的独立技能（例如明确指定对应子目录），以免过多的上下文挤占 Token 空间。
> 2. **局部优先**：建议优先将技能安装到当前项目的局部目录（非全局环境），这能确保团队不同工程之间的环境隔离。
