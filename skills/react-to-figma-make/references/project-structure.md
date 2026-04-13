# Figma Make 项目完整目录结构

## 标准目录

```text
<page-name>/
├── index.tsx                      # [必须] 项目主入口
├── style.css                      # [必须] 根入口样式桥接层
├── canvas.fig                     # [必须] Figma 二进制设计数据
├── meta.json                      # [必须] 项目元数据
├── ai_chat.json                   # [必须] AI 聊天历史（可为空 {}）
├── canvas.code-manifest.json      # [必须] CODE_FILE 索引清单
├── package.json                   # [必须] Vite 项目依赖声明
├── vite.config.ts                 # [必须] Vite 构建配置
├── index.html                     # [必须] Vite HTML 入口模板
├── thumbnail.png                  # [可选] 项目缩略图
├── Attributions.md                # [可选] Figma 原始导出属性说明
├── README.md                      # [可选] 项目说明
├── images/                        # [必须] 设计稿图片资源目录
└── src/
    ├── App.tsx                    # [必须] Figma Make 导出薄壳
    ├── main.tsx                   # [必须] Vite 开发挂载入口
    ├── index.css                  # [必须] Figma Make 入口样式
    ├── DESIGN_SYSTEM_GUIDE.md     # [可选] 设计系统文档
    ├── TOKEN_REFERENCE.md         # [可选] Token 参考文档
    ├── components/                # [推荐] 页面视觉与交互主体
    │   ├── AppContent.tsx         # 主页面内容组件
    │   ├── Header.tsx
    │   ├── Footer.tsx
    │   └── ...
    ├── pages/                     # [可选] 多页面内容
    ├── styles/                    # [推荐] 共享样式
    │   └── globals.css            # 全局样式 / 设计 Token
    ├── guidelines/                # [可选] 设计指南文档
    ├── assets/                    # [可选] 组件内使用的静态资源
    └── lib/                       # [可选] 工具函数
```

## 文件职责详解

### 根目录文件

#### `index.tsx` — 项目主入口

项目的对外入口。默认是一个普通 React 组件，导入并渲染 `src/components/` 中的共享组件。


**不应该包含**：页面视觉实现、大量业务逻辑。

#### `style.css` — 根入口样式

根入口的样式桥接点。通常内容很简单：

```css
@import "tailwindcss";
@import "./src/styles/globals.css";
```

目的是让根入口和 Figma 导出入口共享同一套样式来源。

#### `canvas.fig` — Figma 二进制设计数据

Figma Make 的核心产物。这是一个 ZIP 格式的二进制文件，内部包含 `canvas.json`（Figma 节点树）和 CODE_FILE 节点（关联的源代码文件）。

- **不能手动编辑**
- 只能通过 `canvas-fig-sync.mjs pack` 更新
- 通过 `canvas-fig-sync.mjs inspect` 查看内容
- 通过 `canvas-fig-sync.mjs extract` 提取代码

#### `meta.json` — 项目元数据

见 `meta-json-spec.md`。

#### `canvas.code-manifest.json` — CODE_FILE 索引

记录 `canvas.fig` 中所有 CODE_FILE 节点的路径和 ID 映射。由 `canvas-fig-sync.mjs inspect --manifest` 自动生成。

### `src/` 目录文件

#### `src/App.tsx` — Figma Make 导出薄壳

Figma Make 平台编辑和预览时的入口组件。它应该：

- 尽量薄，只做包装
- 直接复用 `src/components/` 中的共享组件
- 与根目录 `index.tsx` 渲染同一套内容

#### `src/main.tsx` — Vite 挂载层

标准的 Vite 应用挂载代码。仅用于 Figma Make 独立开发预览。

#### `src/index.css` — Figma Make 入口样式

Figma 导出时使用的样式入口。应与 `style.css` 保持一致或指向相同来源。

#### `src/components/` — 页面主体

所有页面的视觉和交互实现都应放在这里。这是两个入口共享的真实代码。

#### `src/styles/globals.css` — 全局样式

CSS 变量、设计 Token、全局基础样式的存放位置。

## Figma Make 导出的原始项目标记

从 Figma Make 导出的 ZIP 包通常还会包含以下文件，这些文件是正常组成部分，不应误删：

- `Attributions.md` — 许可证和归属说明
- `guidelines/Guidelines.md` — 自动生成的设计指南
- `DESIGN_SYSTEM_GUIDE.md` — 设计系统说明文档
- `TOKEN_REFERENCE.md` — 设计 Token 参考文档
- `README.md` — 项目说明

## 文件保护规则

以下文件一旦存在就不应删除（即使当前不直接使用）：

| 文件 | 原因 |
|------|------|
| `canvas.fig` | 后续导出 `.fig` 的源数据 |
| `meta.json` | 导出接口需要读取 |
| `ai_chat.json` | Figma Make 平台要求 |
| `thumbnail.png` | 项目缩略图 |
| `canvas.code-manifest.json` | `canvas.fig` 的索引 |
| `images/*` | 设计稿关联图片，hash 命名不可随意改 |
