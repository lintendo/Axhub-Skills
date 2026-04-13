---
name: react-to-figma-make
description: "将任意 React 组件或应用转换为可在 Figma Make 中编辑和导出的标准项目结构。适用于已有 React 项目需要导入 Figma Make 进行可视化编辑、团队协作或产出 .fig 文件的场景。当用户提到将 React 转为 Figma、导出 Figma Make、生成 .fig 文件、或希望在 Figma Make 中编辑现有 React 代码时使用。"
---

# React 导出到 Figma Make

## 概述

本技能将帮助你把**任意 React 组件或应用**转换为符合 Figma Make 项目规范的标准结构。转换完成后，项目将具备：

- **Figma Make 可编辑性**：可在 Figma Make 平台中打开、编辑和迭代
- **`.fig` 导出能力**：生成可下载的 `.fig` 文件
- **双入口架构**：同时支持独立运行和 Figma Make 导出
- **设计 Token 保留**：保持原始设计系统的 CSS 变量和主题定义
- **资产完整性**：包含 `meta.json`、`ai_chat.json`、`images/` 等 Figma Make 要求的元文件

本技能产出一个完整的 Figma Make 兼容项目目录，而非单个组件文件。

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
   （运行脚本前，请先在技能的 `scripts` 目录下执行 `npm install` 安装依赖 `pako` 和 `kiwi-schema`。）

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

在目标目录 `<output-dir>/<page-name>/` 下创建以下固定结构：

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
    ├── components/        # 页面视觉与交互主体
    ├── pages/             # 多页面（如需要）
    └── styles/
        └── globals.css    # 全局样式 / 设计 Token
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
import AppContent from './src/components/AppContent';

export default function PageName() {
  return <AppContent />;
}
```

**`src/App.tsx`**（Figma Make 导出壳）：

```tsx
/**
 * Figma Make 导出薄壳
 * 复用 components/ 中的共享组件，保持与根目录 index.tsx 同步
 */
import React from 'react';
import AppContent from './components/AppContent';

export default function App() {
  return <AppContent />;
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
- 页面真实视觉和交互主体应沉淀到 `src/components/**`
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

> 运行本步骤前，请确保已经在技能包的 `scripts/` 目录下执行过 `npm install` 以安装依赖。

使用本技能自带的 `canvas-fig-sync.mjs` 脚本生成可导出的 `.fig` 文件。

以下命令假设你当前在终端中定位在目标项目根目录，且本技能的存放位置为 `<skill-dir>`：

**首次生成**（没有现有 `canvas.fig`）：

```bash
# ① 从模板创建基础 canvas.fig
cp <skill-dir>/assets/empty-canvas.fig <output-dir>/<page-name>/canvas.fig

# ② 将源码回写到 canvas.fig
node <skill-dir>/scripts/canvas-fig-sync.mjs pack \
  --fig <output-dir>/<page-name>/canvas.fig \
  --from <output-dir>/<page-name> \
  --prune-missing \
  --sanitize-for-export

# ③ 生成 manifest
node <skill-dir>/scripts/canvas-fig-sync.mjs inspect \
  --fig <output-dir>/<page-name>/canvas.fig \
  --manifest <output-dir>/<page-name>/canvas.code-manifest.json
```

**参数说明**：
- `<output-dir>`：项目输出目录，根据你的项目约定选择（如 `src/prototypes`、`src/pages` 等）
- `--prune-missing`：裁掉磁盘上不存在的旧 `CODE_FILE` 节点
- `--sanitize-for-export`：清空旧聊天/历史缓存，重建 `importedCodeFiles`

**canvas.fig 关键特性**：
- 二进制 ZIP 格式文件，内含 Figma 节点树和 CODE_FILE 节点
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

1. 复制 `src/` 目录内容到目标 `src/`
2. 将 `App.tsx` 改造为薄壳模式
3. 创建根目录 `index.tsx`
4. 迁移样式到 `src/styles/globals.css`
5. 补齐元文件
6. 生成 `canvas.fig`

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
4. 重新执行 pack 回写 `canvas.fig`
5. 刷新 `canvas.code-manifest.json` 和 `meta.json.exported_at`

## 常见注意点

### 产物和资源
- 不要把 `src/index.css`（Figma Make 的 Tailwind 构建产物）直接当最终 `style.css`，它可能有数万行
- 如果目录内已有 `canvas.fig`、`meta.json`、`images/` 等原始资产，不要删除它们
- `images/` 下的文件通常是 hash 命名的 Figma 关联图片，不要随意重命名
- `canvas.fig` 是二进制文件，不能手动编辑

### 入口同步
- 修改根目录页面后，必须同步更新 `src/App.tsx`，否则导出的 `.fig` 会与当前页面不一致
- 两个入口长期不同步是最常见的"漂移"问题 — 保持 `src/App.tsx` 尽量薄，只做包装

### 依赖和路径
- 不要继续保留对 `package@version` alias 的运行时依赖
- 不要把多页面路由壳层原封不动塞进最终页面组件
- `@/` 别名应通过 `vite.config.ts` 的 `resolve.alias` 配置，而非依赖外部构建环境
