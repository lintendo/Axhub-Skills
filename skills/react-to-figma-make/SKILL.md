---
name: react-to-figma-make
description: "Use when 需要把现有 React、Vite、Next.js、V0 或 AI Studio 页面转换为 Figma Make 可导入的 .fig 资产，或补齐、更新、验证已有 Figma Make 导出壳和 canvas.fig。"
---

# React 导出到 Figma Make

## 概述

本技能将帮助你把 React 组件或应用经过兼容改造后，转换为符合 Figma Make 项目规范的标准结构。转换完成后，项目将具备：

- **Figma Make 可编辑性**：可在 Figma Make 平台中打开、编辑和迭代
- **`.fig` 导出能力**：生成可下载的 `.fig` 文件
- **双入口架构**：同时支持独立运行和 Figma Make 导出
- **设计 Token 保留**：保持原始设计系统的 CSS 变量和主题定义
- **资产完整性**：包含 `meta.json`、`ai_chat.json`、`images/` 等 Figma Make 要求的元文件

本技能产出一个完整的 Figma Make 兼容项目目录，并默认把可被宿主工具消费的产物写入通用 artifact 目录：

```text
.axhub/make/artifacts/figma/<resource-id>/
├── canvas.fig
├── meta.json
├── ai_chat.json
├── canvas.code-manifest.json
├── manifest.json
├── images/
└── thumbnail.png            # 可选
```

如果目标项目使用 `.axhub/make/project.json` 描述资源，需要在对应 `resources.prototypes[].artifacts.figma` 中登记这些路径，便于 make-server 或其他宿主直接导出 `.fig`。

## 核心原则与当前能力边界

**`canvas-fig-sync.mjs pack` 是模板节点同步器，不是通用的文件系统导入器。**

- `pack` 只更新 `canvas.fig` 中已经存在的 `CODE_FILE.logicalPath`。
- 磁盘上新增但模板中不存在的路径不会自动变成新的 `CODE_FILE`。
- 使用 `--prune-missing` 时，模板中存在、磁盘上不存在的路径会被删除。
- 使用 `--sanitize-for-export` 时，聊天历史和代码快照会被清空；如果源码映射错误，无法依赖清理后的 `.fig` 恢复源码。
- `inspect` 命令退出成功只证明二进制可解析，不证明源码完整或能够运行。

因此，首次生成前必须先 inspect 模板，并让导出源码路径与模板已有逻辑路径对齐。路径由实际 template manifest 决定，不是 Figma Make 的固定文件名。当前 bundled `empty-canvas.fig` 中可以确认的通用入口和可选路径包括：

| 磁盘路径（相对 `--from`） | `CODE_FILE.logicalPath` | 职责 |
|---|---|---|
| `src/App.tsx` | `App.tsx` | 当前模板的 Figma Make 入口，必须保留 |
| `src/styles/globals.css` | `styles/globals.css` | 当前模板已有的可选样式节点 |
| `src/<manifest 中已有路径>` | 对应 `logicalPath` | 可选业务模块或其他资源 |

当前模板中的 `components/Dashboard.tsx` 只是一个历史示例槽位，不是通用规范，也不代表目标页面必须是 Dashboard。只有当本次转换明确选择该现有槽位时才能使用它。如果原页面依赖多个模板未覆盖的本地模块，优先使用项目现有构建工具把业务代码机械打包到 `src/App.tsx`，或打包到本次从 manifest 中明确选定的已有槽位。不要把业务逻辑手工重写成另一套实现；保留原页面入口，把导出壳作为可重复生成、可持续同步的独立适配层。

## 何时使用

- 你有一个现成的 React 项目，希望导入 Figma Make 进行可视化编辑
- 你需要从 React 代码生成 `.fig` 文件用于设计交付
- 你希望在 Figma Make 和代码编辑器之间双向协作
- 你有一个 V0 / AI Studio / 自建 React 项目，想把它纳入 Figma Make 生态

## 环境要求

本技能分为两部分：

1. **项目结构转换**（通用）：将 React 项目改造为 Figma Make 目录规范 — 任何环境均可执行
2. **canvas.fig 生成与验证**：本技能内置了相关的操作脚本，位于技能自身的目录下：
   - `scripts/canvas-fig-sync.mjs`：canvas.fig 回写与检查工具
   - `assets/empty-canvas.fig`：空白 canvas 模板
   - 脚本运行依赖 `pako` 和 `kiwi-schema`。先直接运行一次；如果出现 `ERR_MODULE_NOT_FOUND`，在脚本所属包中按宿主项目规定的包管理器安装依赖，不要向目标原型的运行时依赖中添加这两个包。

如果有额外的页面渲染验收脚本，也可以在此阶段执行。

## 引用文件

本技能附带以下参考文件，在转换特定技术领域时按需查阅：

- `references/project-structure.md`：Figma Make 项目的完整目录结构和文件职责说明
- `references/meta-json-spec.md`：`meta.json` 的完整字段定义和示例
- `references/style-migration.md`：从各种 CSS 方案迁移到 Figma Make 样式体系的指南

## 转换工作流程

### 第 1 步：分析源项目

分析目标 React 项目的以下方面：

1. **框架识别**：
   - 纯 React（Vite / CRA / 自定义）
   - Next.js（需要移除 SSR、`"use client"`、`next/image` 等）
   - AI Studio（Import Map + CDN 模式）
   - 其他元框架

2. **入口结构**：
   - 主应用组件在哪里（通常是 `App.tsx` 或 `page.tsx`）
   - 挂载入口在哪里（`main.tsx` / `index.tsx`）
   - 是否有路由（多路由需收敛为单入口）

3. **样式方案**：
   - Tailwind CSS（CDN / PostCSS / v4）
   - CSS Modules
   - Styled Components / Emotion
   - 纯 CSS / SCSS
   - CSS 变量 / 设计 Token

4. **依赖分析**：
   - 核心依赖（React、ReactDOM — 外部化，不打包）
   - UI 框架（Ant Design、shadcn/ui、Radix 等 — 保留）
   - 图表库、动画库等 — 保留并确认兼容性
   - 框架特定依赖（Next.js、Vercel — 移除）

5. **静态资源盘点**（对大型项目尤其重要）：
   - 图片：格式、数量、总大小、引用方式（import / public / CDN）
   - 字体：本地文件 vs CDN 引用
   - 视频/音频等其他媒体
   - SVG：是否作为 React 组件使用

输出一份转换清单，列出需要处理的各项转换任务。

### 第 2 步：创建 Figma Make 项目结构

在目标目录 `<output-dir>/<page-name>/` 下创建以下固定结构；最终可消费产物同步到 `.axhub/make/artifacts/figma/<resource-id>/`：

```text
<page-name>/
├── index.tsx              # 项目主入口
├── style.css              # 根入口样式（桥接层）
├── canvas.fig             # Figma 二进制设计数据（第 5 步生成）
├── meta.json              # 项目元数据
├── ai_chat.json           # AI 聊天历史（可为空 {}）
├── canvas.code-manifest.json  # CODE_FILE 索引清单（第 5 步生成）
├── package.json           # Vite 项目依赖声明
├── vite.config.ts         # Vite 构建配置
├── index.html             # Vite HTML 入口
├── images/                # 设计稿图片资源
└── src/
    ├── App.tsx            # Figma Make 导出薄壳（导出入口）
    ├── main.tsx           # Vite 挂载层
    ├── index.css          # Figma Make 入口样式
    ├── components/        # 可选；仅使用 template manifest 已存在的路径
    ├── pages/             # 多页面（如需要）
    └── styles/
        └── globals.css    # 全局样式 / 设计 Token
```

`.axhub/make/project.json` 中的资源元数据示例：

```json
{
  "artifacts": {
    "figma": {
      "resourceId": "home",
      "canvasFigPath": ".axhub/make/artifacts/figma/home/canvas.fig",
      "metaPath": ".axhub/make/artifacts/figma/home/meta.json",
      "aiChatPath": ".axhub/make/artifacts/figma/home/ai_chat.json",
      "codeManifestPath": ".axhub/make/artifacts/figma/home/canvas.code-manifest.json",
      "imagesDir": ".axhub/make/artifacts/figma/home/images",
      "manifestPath": ".axhub/make/artifacts/figma/home/manifest.json"
    }
  }
}
```

**职责分层约束**（这是验收约束，不是建议）：

| 文件 | 职责 | 不应包含 |
|------|------|----------|
| `index.tsx` | 项目主入口 | 页面视觉实现 |
| `src/App.tsx` | Figma 导出薄壳，复用共享组件 | 独立于根入口的业务逻辑 |
| `src/main.tsx` | Vite 开发挂载，`ReactDOM.createRoot` | 业务代码 |
| `src/components/**` | 页面视觉与交互的真实主体 | 入口适配逻辑 |
| `style.css` | 根入口样式转发 | 大量业务样式 |
| `src/index.css` | Figma 入口样式层 | 独立于 style.css 的独立样式 |

### 第 3 步：迁移和改造源代码

#### 3.1 收敛入口

将源项目的所有页面逻辑收敛为两个薄入口 + 一套共享组件。

**根目录 `index.tsx`**（项目主入口）：

```tsx
/**
 * 项目主入口
 */
import './style.css';
import React from 'react';
import App from './src/App';

export default function PageName() {
  return <App />;
}
```

**`src/App.tsx`**（Figma Make 导出壳）：

```tsx
/**
 * Figma Make 导出薄壳
 * 将根入口及其本地依赖机械同步到这个入口，
 * 或同步到 template manifest 中明确存在的其他逻辑路径。
 */
import React from 'react';
import './styles/globals.css';

export default function App() {
  return <main>{/* 机械同步或打包后的页面主体 */}</main>;
}
```

**`src/main.tsx`**（Vite 挂载层）：

```tsx
/**
 * Vite 开发挂载层
 * 仅用于 Figma Make 独立开发预览
 */
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

**关键原则**：

- 两个入口（`index.tsx` 和 `src/App.tsx`）必须渲染相同的页面内容
- 页面主体可以直接机械打包到 `src/App.tsx`，也可以拆分到 template manifest 已存在的逻辑路径
- 不要硬编码 `Dashboard.tsx`、`AppContent.tsx` 或其他项目语义文件名；先检查模板再选择路径
- 不要创建模板中不存在的路径后假设 `pack` 会自动加入
- 若源项目有多页路由，收敛为单页面或选择核心页面

#### 3.2 处理框架特定代码

根据源项目的框架类型，进行针对性清理：

**Next.js 项目**：
```typescript
// ❌ 移除
"use client"
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import type { Metadata } from 'next'

// ✅ 替换
// 删除 "use client"
// 删除 useRouter，改用 useState 管理页面状态
<img> 替代 <Image>
<a> 替代 <Link>
```

**AI Studio 项目**：
```typescript
// ❌ 移除
// Import Map 依赖（CDN URL）
// index.html 中的 <script type="importmap">

// ✅ 替换
// CDN 导入改为 npm 包导入
// process.env.* 改为 import.meta.env.VITE_*
```

**通用清理**：
```typescript
// ❌ 移除
import { Analytics } from '@vercel/analytics/next'
// 所有 SSR 相关代码

// ✅ 保留
// React Hooks
// 第三方 UI 组件
// 样式文件导入
```

#### 3.3 处理路径别名

将所有非标准路径别名转换为相对路径：

```typescript
// 源代码中的 @/ 别名
import { Button } from '@/components/ui/button'

// 转换为相对路径（基于文件位置）
import { Button } from './components/ui/button'   // 从 src/App.tsx
import { Button } from '../components/ui/button'  // 从 src/pages/xxx.tsx
```

如果源项目使用 `package@version` 格式的导入（Figma Make 导出特征），改为裸包名：

```typescript
// ❌
import { motion } from 'framer-motion@11.0.0'

// ✅
import { motion } from 'framer-motion'
```

#### 3.4 处理大型静态资源

React 项目通常包含大量图片、字体和其他二进制文件。转换时需要妥善处理这些资源：

**图片资源迁移**：

| 源项目引用方式 | 迁移策略 |
|----------------|----------|
| `import logo from './assets/logo.png'` | 保留在 `src/assets/`，import 路径不变 |
| `<img src="/images/hero.png">` (public 目录) | 复制到 `images/`，更新路径为 `./images/hero.png` |
| `<img src="https://cdn.example.com/img.png">` (CDN) | 保留 CDN 链接不变 |
| SVG 作为 React 组件 (`import { ReactComponent as Icon }`) | 保留在 `src/components/` 或 `src/assets/` |
| CSS 中的 `url('./bg.png')` | 保持相对路径正确即可 |

**`images/` 目录规则**：
- Figma Make 的 `images/` 目录存放设计稿关联图片，通常以 hash 命名（如 `a3f2c1d.png`）
- 源项目的业务图片优先保留在 `src/assets/`，不必强制移到 `images/`
- 只有从 Figma Make 导入时自带的 `images/` 内容才需要保留原始 hash 名

**字体文件**：
- 本地字体文件放入 `src/assets/fonts/`
- 在 `src/styles/globals.css` 中用 `@font-face` 引用
- Google Fonts 等 CDN 字体直接保留 `@import url(...)` 链接

**大文件注意事项**：
- `canvas.fig` 是二进制文件（通常几百 KB 到几 MB），不能手动编辑，只能通过工具生成
- 不要把源项目的 `node_modules/`、`build/`、`.next/` 等目录复制到产物中
- 如果源项目的图片总量超过 50 张或 10 MB，考虑精简为核心页面所需的子集

#### 3.5 迁移样式

**目标**：根入口 `style.css` 和导出入口 `src/index.css` 使用同一套样式来源。

**style.css**（根入口样式）：

```css
@import "tailwindcss";

/* 如果有 globals.css，通过 import 引入 */
@import "./src/styles/globals.css";
```

**src/index.css**（Figma 导出样式）：

```css
@import "tailwindcss";

/* 保持与 style.css 一致的样式来源 */
@import "./styles/globals.css";
```

**src/styles/globals.css**（主样式文件）：

将源项目中的以下内容迁移到此文件：
- CSS 变量 / 设计 Token
- `@theme` 定义（Tailwind v4）
- 全局基础样式
- 自定义字体引用
- 自定义动画定义

**样式迁移策略**（详细指南见 `references/style-migration.md`）：

| 源样式方案 | 迁移方式 |
|------------|----------|
| Tailwind CSS v4 | 直接保留 `@import "tailwindcss"` + `@theme` |
| Tailwind CSS v3 | 迁移到 v4 语法，`@theme inline` 替代 `@apply` |
| CSS Modules | 合并到组件同级 CSS 文件，改用带前缀的普通类名 |
| Styled Components / Emotion | 提取为 CSS 类，移除 JS-in-CSS 依赖 |
| 纯 CSS / SCSS | 直接迁移，SCSS 编译为 CSS |
| CSS 变量 | 保留到 `globals.css` 的 `:root` 或 `@theme` 中 |

**大型样式文件注意事项**：
- Figma Make 导出的 `src/index.css` 有时是 Tailwind 的完整编译产物（可达数万行），**不要直接使用它作为最终样式**
- 应以 `src/styles/globals.css` 为主样式源，`src/index.css` 仅做样式桥接

### 第 4 步：创建 Figma Make 元文件

#### 4.1 `meta.json`

```json
{
  "client_meta": {
    "background_color": { "r": 0.96, "g": 0.96, "b": 0.96, "a": 1 },
    "thumbnail_size": { "width": 400, "height": 300 },
    "render_coordinates": { "x": 0, "y": 0, "width": 1280, "height": 960 }
  },
  "file_name": "<项目显示名称>",
  "developer_related_links": [],
  "exported_at": "<ISO 8601 时间>"
}
```

- `file_name`：最终导出的 `.fig` 文件显示名称
- `render_coordinates`：页面视口尺寸，根据实际页面调整 `width` 和 `height`（详见 `references/meta-json-spec.md`）
- `exported_at`：使用当前 ISO 8601 时间（`new Date().toISOString()`）

#### 4.2 `ai_chat.json`

```json
{}
```

新建项目时为空对象即可。

#### 4.3 `package.json`

```json
{
  "name": "<page-name>",
  "private": true,
  "version": "0.0.1",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
  },
  "devDependencies": {
    "vite": "^6.0.0",
    "@vitejs/plugin-react": "^4.0.0",
    "typescript": "^5.0.0"
  }
}
```

**依赖规则**：
- **排除**：`react`、`react-dom`、`next`、`next-*`、`@vercel/*`、`next-themes`
- **保留**：所有其他运行时依赖（UI 库、工具库、图标库等）
- 使用项目所用的包管理器安装依赖（npm / yarn / pnpm 均可）

#### 4.4 `vite.config.ts`

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': '/src'
    }
  }
});
```

#### 4.5 `index.html`

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title><项目名称></title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

#### 4.6 `images/` 目录

创建空的 `images/` 目录。此目录用于存放 Figma Make 设计稿关联的图片资源。

- 如果是从 Figma Make 导入的项目，保留 `images/` 下已有的 hash 命名图片
- 源项目的业务图片建议保留在 `src/assets/` 中，不必移入 `images/`

### 第 5 步：生成 `canvas.fig`

> 在执行任何带 `--prune-missing` 的命令前，必须先完成导出壳和模板路径映射。不要用正式 `canvas.fig` 直接试错。

使用本技能自带的 `canvas-fig-sync.mjs` 脚本生成可导出的 `.fig` 文件。

以下命令假设你当前在终端中定位在目标项目根目录，且本技能的存放位置为 `<skill-dir>`：

**首次生成**（没有现有 `canvas.fig`）按以下顺序执行：

1. inspect 空白模板，确认本次准备使用的逻辑路径确实存在。
2. 在目标源码目录内创建并保留模板兼容的 `src/**` 导出壳。
3. 将空白模板复制为候选文件，在候选文件上 pack。
4. 验证候选文件的节点、引用和可运行性，通过后再替换正式 `canvas.fig`。

```bash
# ① 检查模板已有 CODE_FILE 路径
node <skill-dir>/scripts/canvas-fig-sync.mjs inspect \
  --fig <skill-dir>/assets/empty-canvas.fig \
  --manifest <artifact-dir>/template.code-manifest.json

# ② 使用 Node 跨平台复制模板，避免覆盖正式产物
node -e "require('node:fs').copyFileSync(process.argv[1], process.argv[2])" \
  <skill-dir>/assets/empty-canvas.fig \
  <artifact-dir>/canvas.candidate.fig

# ③ 将已经对齐模板路径的源码写入候选文件
node <skill-dir>/scripts/canvas-fig-sync.mjs pack \
  --fig <artifact-dir>/canvas.candidate.fig \
  --from <source-dir> \
  --prune-missing \
  --sanitize-for-export \
  --manifest <artifact-dir>/canvas.pack-manifest.json

# ④ 生成候选文件的最终 CODE_FILE 清单
node <skill-dir>/scripts/canvas-fig-sync.mjs inspect \
  --fig <artifact-dir>/canvas.candidate.fig \
  --manifest <artifact-dir>/canvas.code-manifest.json
```

`<source-dir>` 是包含持久化 `src/App.tsx` 的页面源码目录；`<artifact-dir>` 是 `.axhub/make/artifacts/figma/<resource-id>/`。两者通常不是同一个目录。Make 服务端下载时会再次以 `<source-dir>` 执行 pack，因此不能在首次生成后删除导出壳。

在提升候选文件为正式 `canvas.fig` 前，读取两个 manifest 并强制满足：

- `canvas.pack-manifest.json.updatedLogicalPathCount > 0`
- `canvas.code-manifest.json.summary.totalCodeFiles > 0`
- `canvas.code-manifest.json.entries` 包含 `App.tsx` 以及 `App.tsx` 的全部本地相对依赖
- pack warnings 中不存在 `Unresolved relative import`
- 除 `App.tsx` 外，只要求本次导出入口实际引用的模板已有路径；不要要求固定存在 `Dashboard.tsx`

任何一项不满足都必须停止，不要覆盖已有 `canvas.fig`，也不要把空壳记录为成功导出。验证通过后再用跨平台文件操作把 `canvas.candidate.fig` 替换为 `canvas.fig`。

**参数说明**：
- `<source-dir>`：页面源码目录；脚本会从其 `src/` 子目录读取代码
- `<artifact-dir>`：Figma Make 资产目录，不等同于源码目录
- `--prune-missing`：裁掉磁盘上不存在的旧 `CODE_FILE` 节点
- `--sanitize-for-export`：清空旧聊天/历史缓存，重建 `importedCodeFiles`

**canvas.fig 关键特性**：
- `fig-make` 专用二进制容器，内含 Figma 节点树和 CODE_FILE 节点；不是普通 ZIP
- 不可手动编辑，仅能通过 `canvas-fig-sync.mjs` 的 pack / inspect / extract 命令操作
- 文件大小通常在几百 KB 到几 MB，取决于代码文件数量
- 每次页面内容变更后需要重新 pack，否则导出的 `.fig` 会与当前页面不一致

### 第 6 步：验证清单

转换完成后，逐项检查：

**结构验证**：
- [ ] 项目目录符合固定结构（`index.tsx` + `src/App.tsx` + `src/main.tsx` + `src/components/`）
- [ ] `index.tsx` 顶部有职责注释
- [ ] `src/App.tsx` 顶部有职责注释："Figma Make 导出薄壳"
- [ ] `src/main.tsx` 顶部有职责注释："Vite 挂载层"
- [ ] 两个入口渲染同一套 `src/components/**` 中的共享组件

**元文件验证**：
- [ ] `meta.json` 存在，包含 `file_name`、`exported_at`、`client_meta`
- [ ] `ai_chat.json` 存在（至少为 `{}`）
- [ ] `package.json` 存在，不包含 `react` / `react-dom` 依赖
- [ ] `vite.config.ts` 存在
- [ ] `index.html` 存在
- [ ] `images/` 目录存在

**canvas.fig 验证**：
- [ ] `canvas.fig` 存在
- [ ] `canvas.code-manifest.json` 存在
- [ ] inspect 命令可成功执行
- [ ] pack manifest 的 `updatedLogicalPathCount > 0`
- [ ] `summary.totalCodeFiles > 0`
- [ ] manifest 包含入口及其全部本地相对依赖
- [ ] pack warnings 不包含 `Unresolved relative import`
- [ ] 用 `extract` 反向提取到临时目录，关键源码与导出壳内容一致
- [ ] 实际下载接口返回的二进制与正式 `canvas.fig` 一致；不能只以 `probe.hasMakeAssets === true` 作为内容验收

**样式验证**：
- [ ] `style.css` 和 `src/index.css` 使用同一套样式来源
- [ ] 不直接搬运 Tailwind 构建产物作为最终样式

**依赖验证**：
- [ ] 不依赖 `@/` 或 `package@version` 别名才能运行
- [ ] 不残留 Next.js / Vercel 特定代码
- [ ] 所有必要依赖已安装

**资源完整性验证**：
- [ ] 所有图片引用路径正确（无 404 断链）
- [ ] 字体文件已复制或 CDN 链接可访问
- [ ] 不包含 `node_modules/`、`build/`、`.next/` 等冗余目录

**渲染验证**：

在目标项目目录中：
```bash
cd <output-dir>/<page-name>
npm install   # 或 yarn / pnpm install
npm run dev   # 启动 Vite 开发服务器
# 浏览器中检查页面渲染是否正常
```

- [ ] 页面正常渲染
- [ ] 无控制台错误
- [ ] 主视觉与原项目基本一致

## 常见场景

### 场景 A：纯 React + Vite 项目

这是最简单的场景，因为源项目和目标结构都基于 Vite。

1. inspect 模板，确认可用的 `CODE_FILE.logicalPath`
2. 保留原业务入口，创建模板兼容的薄导出壳
3. 将业务主体及本地依赖机械打包到 `src/App.tsx`，或同步到本次选定的模板已有路径
4. 创建根目录 `index.tsx`
5. 迁移样式到 `src/styles/globals.css`
6. 补齐元文件
7. 生成 `canvas.fig`

### 场景 B：Next.js 项目（V0 等）

1. 移除所有 Next.js 特定代码（`"use client"`、`next/image`、`next/link`、路由等）
2. 将 `app/page.tsx` 或 `pages/index.tsx` 的内容迁移到 `src/components/`
3. 将 `app/globals.css` 迁移到 `src/styles/globals.css`
4. 将 `public/` 下的静态资源迁移到 `src/assets/` 或 `images/`
5. 排除 Next.js 专属依赖（`next`、`@vercel/*`），保留 UI 组件依赖
6. 创建双入口（`index.tsx` + `src/App.tsx`），补齐元文件

### 场景 C：AI Studio 项目

1. 从 `index.html` 的 Import Map 提取依赖，转为 npm 包安装
2. 提取 `<style>` 标签内容到 `src/styles/globals.css`
3. `process.env.*` 改为 `import.meta.env.VITE_*`
4. CDN 图片引用可保留，或下载到 `src/assets/`
5. 创建双入口，补齐元文件

### 场景 D：已有 Figma Make 导入的项目（补齐导出能力）

此时重点不是从头创建结构，而是确保现有项目的导出壳子与当前页面同步。

1. 检查 `index.tsx`（根入口）和 `src/App.tsx`（导出壳子）是否同步
2. 如果不同步，让 `src/App.tsx` 复用根入口的共享组件
3. **不要删除**已有的 `canvas.fig`、`meta.json`、`images/` 等原始资产
4. pack 到候选文件并完成严格验证，不要直接覆盖原始 `canvas.fig`
5. 验证通过后替换正式文件，刷新 `canvas.code-manifest.json` 和 `meta.json.exported_at`

## 常见注意点

### 产物和资源
- 不要把 `src/index.css`（Figma Make 的 Tailwind 构建产物）直接当最终 `style.css`，它可能有数万行
- 如果目录内已有 `canvas.fig`、`meta.json`、`images/` 等原始资产，不要删除它们
- `images/` 下的文件通常是 hash 命名的 Figma 关联图片，不要随意重命名
- `canvas.fig` 是二进制文件，不能手动编辑

### 入口同步
- 修改根目录页面后，必须同步更新 `src/App.tsx`，否则导出的 `.fig` 会与当前页面不一致
- 两个入口长期不同步是最常见的"漂移"问题 — 保持 `src/App.tsx` 尽量薄，只做包装
- 默认模板不能自动新增任意本地文件路径；新增拆分文件前先检查 template manifest
- `inspect` 成功但 `totalCodeFiles` 为 0、入口依赖缺失或存在 unresolved import，仍然是失败产物

### 依赖和路径
- 不要继续保留对 `package@version` alias 的运行时依赖
- 不要把多页面路由壳层原封不动塞进最终页面组件
- `@/` 别名应通过 `vite.config.ts` 的 `resolve.alias` 配置，而非依赖外部构建环境
