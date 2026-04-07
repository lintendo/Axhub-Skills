---
name: generate-theme
description: >
  从网页中采集设计令牌并生成完整的 DESIGN.md 设计规范文档 + Tailwind CSS 主题文件。
  当用户提供 URL 并要求"提取主题"、"生成设计规范"、"导出设计系统"、
  "提取这个网站的设计令牌"、"帮我做一个主题"、"分析这个页面的设计风格"时使用。
  产出包含 DESIGN.md（Google Stitch 格式）和 globals.css（Tailwind CSS v4），
  每个 token 类别均有推荐/允许/禁止三级规范，可直接放入项目根目录供 AI 编码工具使用。
---

# 生成主题

从目标网页采集设计令牌，生成 DESIGN.md 设计规范 + Tailwind CSS 主题。

## 前置条件

- Node.js >= 18
- 已安装 `extract-page-data` 或 `clone-page` 技能（用于数据采集）

## 工作流

### Step 1: 采集设计数据 + 截图

使用 `extract-page-data` 或 `clone-page` 技能采集 theme.json + 多维度截图：

```bash
# 方式 A: extract-page-data（快速采集）
node <extract-page-data>/scripts/extract.mjs <url> --theme --screenshot --scroll -o ./theme-data

# 方式 B: clone-page（采集 + 多视口截图 + section 截图，推荐）
node <clone-page>/scripts/clone.mjs <url> quick -o ./theme-data --scroll
node <clone-page>/scripts/clone.mjs <url> responsive -o ./theme-data
# 按需采集关键 section 的截图
node <clone-page>/scripts/clone.mjs <url> styles -o ./theme-data --selector "header"
node <clone-page>/scripts/clone.mjs <url> styles -o ./theme-data --selector "main > section:nth-child(1)"
node <clone-page>/scripts/clone.mjs <url> styles -o ./theme-data --selector "footer"
```

采集后 `theme-data/` 中应有：
- `theme.json` — 设计令牌（颜色、字体、间距、圆角、阴影、动画…）
- `screenshot.png` — **全页截图（最重要的参考）**
- `responsive/` — 多视口截图（desktop/tablet/mobile）
- `sections/*/screenshot.png` — 各 section 的独立截图

### Step 2: 截图分析（最关键的一步）

**截图是设计规范的最终真相**。很多关键设计信息只存在于截图中，无法从 CSS 属性提取：

#### 必须从截图中观察的设计维度

| 维度 | 截图中观察什么 | theme.json 能否提供 |
|------|--------------|-------------------|
| 🎨 品牌调性 | 整体视觉风格——极简/科技/温暖/高端/活泼 | ❌ 无法 |
| 📐 布局节奏 | Section 之间的留白比例、内容密度、对齐方式 | ❌ 无法 |
| 🖼️ 视觉层级 | 哪些元素突出、视觉重心在哪里、信息优先级 | ❌ 无法 |
| 🎭 装饰元素 | 背景图案、渐变方向、毛玻璃效果、光影效果 | ⚠️ 部分 |
| 📱 响应式策略 | 不同视口下的布局变化、元素隐藏/重排规则 | ❌ 无法 |
| 🧩 组件风格 | 按钮形状/大小、卡片样式、导航模式、表单风格 | ⚠️ 部分 |
| 🔤 字体排版 | 标题层级视觉感受、段落间距、文本对齐 | ⚠️ 部分 |
| 🌈 渐变方向 | 从左到右/从上到下/径向，渐变色的过渡感 | ❌ 无法 |
| 📸 图片风格 | 摄影/插画/3D/图标风格、图片圆角、纵横比 | ❌ 无法 |
| ☀️ 明暗氛围 | 页面整体是亮色系还是暗色系、色彩饱和度倾向 | ⚠️ 部分 |

#### 截图分析步骤

1. **看全页截图** `screenshot.png`：
   - 判断品牌调性（3-5 个关键词描述）
   - 识别主色调和辅色调
   - 观察整体布局模式（单栏/双栏/网格/卡片流）
   - 注意装饰元素（渐变背景/噪点纹理/光效/几何图案）

2. **看响应式截图** `responsive/`：
   - 对比 desktop vs tablet vs mobile 的布局变化
   - 记录哪些元素在小屏隐藏/折叠
   - 观察导航模式变化（横排 → 汉堡菜单）

3. **看 section 截图** `sections/*/screenshot.png`：
   - 每个区域的独立视觉风格
   - 组件的具体形态（按钮样式、卡片样式、表单样式）
   - 图片和装饰的使用方式

**分析结果应直接写入 DESIGN.md 的「设计原则」和「视觉风格」章节。**

### Step 3: 分析 theme.json

读取 `theme.json`，对每个 token 类别进行分析和归类：

```bash
# 查看采集的设计令牌
cat theme-data/theme.json
```

理解要点：
- `colors.background[0]` — 主背景色
- `colors.text[0]` — 主文本色
- `typography.families[0]` — 主字体
- `spacing` — 间距体系
- `radius` — 圆角体系
- `shadow.box` — 阴影体系
- `transitions` — 过渡动画
- `animations` — CSS 动画
- `cssVariables` — 页面已有的 CSS 变量（如果有，优先使用）

**⚠️ 注意：** theme.json 的数据是机器提取的属性值，可能有遗漏或偏差。当 theme.json 的值与截图中观察到的视觉效果冲突时，**以截图为准**。

### Step 4: 生成产物

输出目录结构：

```
<output>/
├── DESIGN.md            # 设计规范文档（Google Stitch / DESIGN.md 格式）
├── globals.css          # Tailwind CSS v4 主题定义
└── screenshots/         # 视觉参考截图
    ├── full-page.png    # 全页截图
    ├── desktop.png      # 桌面视图
    ├── tablet.png       # 平板视图
    ├── mobile.png       # 手机视图
    ├── header.png       # 头部截图
    └── ...              # 其他 section 截图
```

---

## DESIGN.md 生成规范

**格式遵循 Google Stitch 的 DESIGN.md 标准**：纯 Markdown，面向 AI 和人类双重可读。

### 文档结构模板

```markdown
# [品牌名] 设计系统

> 从 [原始 URL] 提取的设计规范

## 视觉风格

> 👁️ 以下内容基于截图观察总结，是本设计系统的灵魂。

- **品牌调性**: [从截图推断，如：科技感/极简/温暖/高端/活泼]
- **色彩氛围**: [亮色系/暗色系/高饱和/低饱和]
- **布局风格**: [宽松留白/紧凑密集/卡片式/列表式]
- **装饰特征**: [渐变背景/毛玻璃/几何图案/纯色块/无装饰]
- **图片风格**: [摄影/插画/3D/图标/无图]

## 设计原则

- [从截图和品牌调性推断 3-5 条设计原则]

---

## 🎨 色彩系统

### 基础色板

| 名称 | 值 | Tailwind | 用途 |
|------|----|---------|----- |
| Primary | #XXXX | `bg-primary` / `text-primary` | 品牌主色、CTA 按钮 |
| Secondary | #XXXX | `bg-secondary` | 辅助强调 |
| Background | #XXXX | `bg-background` | 页面底色 |
| Foreground | #XXXX | `text-foreground` | 主要文本 |
| Muted | #XXXX | `bg-muted` / `text-muted` | 次要文本、禁用态 |
| Border | #XXXX | `border-border` | 分割线、边框 |
| Accent | #XXXX | `bg-accent` | 高亮、标签 |
| Destructive | #XXXX | `bg-destructive` | 错误、删除 |

### 色彩规范

| 级别 | 规则 |
|------|------|
| ✅ 推荐 | 使用语义化变量 `bg-primary`, `text-foreground` 而非硬编码色值 |
| ✅ 推荐 | 深色模式通过 `.dark` 类切换，不使用 `prefers-color-scheme` |
| ⚠️ 允许 | 在特殊装饰场景下使用渐变色 |
| 🚫 禁止 | 硬编码 `#RRGGBB` 值，必须使用 CSS 变量 |
| 🚫 禁止 | 在文本上使用低对比度颜色（对比度 < 4.5:1） |

---

## 📝 字体系统

### 字体家族

| 名称 | 字体 | Tailwind | 用途 |
|------|------|---------|----- |
| Sans | Inter, system-ui, sans-serif | `font-sans` | 正文、UI 组件 |
| Mono | JetBrains Mono, monospace | `font-mono` | 代码块 |

### 文字样式

| 层级 | 大小 | 行高 | 字重 | Tailwind |
|------|------|------|------|---------|
| H1 | 36px | 44px | 700 | `text-4xl font-bold` |
| H2 | 30px | 36px | 600 | `text-3xl font-semibold` |
| H3 | 24px | 32px | 600 | `text-2xl font-semibold` |
| Body | 16px | 24px | 400 | `text-base` |
| Small | 14px | 20px | 400 | `text-sm` |
| Caption | 12px | 16px | 400 | `text-xs` |

### 字体规范

| 级别 | 规则 |
|------|------|
| ✅ 推荐 | 标题使用 font-semibold 或 font-bold |
| ✅ 推荐 | 正文行高 1.5（24px / 16px） |
| ⚠️ 允许 | 在 Hero 区域使用更大的标题（最大 48px） |
| 🚫 禁止 | 使用超过 3 种字体 |
| 🚫 禁止 | 正文字号低于 14px |

---

## 📏 间距系统

### 间距标尺

| 级别 | 值 | Tailwind | 用途 |
|------|----|---------|----- |
| xs | 4px | `p-1` / `gap-1` | 图标与文字间距 |
| sm | 8px | `p-2` / `gap-2` | 紧凑元素间距 |
| md | 16px | `p-4` / `gap-4` | 默认内边距 |
| lg | 24px | `p-6` / `gap-6` | Section 间距 |
| xl | 32px | `p-8` / `gap-8` | 大区块间隔 |
| 2xl | 48px | `p-12` / `gap-12` | Section 分隔 |

### 间距规范

| 级别 | 规则 |
|------|------|
| ✅ 推荐 | 使用 4px 的倍数（4, 8, 12, 16, 24, 32...） |
| ✅ 推荐 | 同级元素间距保持一致 |
| 🚫 禁止 | 使用奇数 px 值（如 5px, 7px, 13px） |

---

## 🔲 圆角系统

| 名称 | 值 | Tailwind | 用途 |
|------|----|---------|----- |
| None | 0 | `rounded-none` | 表格、分割线 |
| SM | 4px | `rounded-sm` | 小按钮、标签 |
| MD | 8px | `rounded-md` | 默认按钮、输入框 |
| LG | 12px | `rounded-lg` | 卡片、弹窗 |
| XL | 16px | `rounded-xl` | 大卡片、面板 |
| Full | 9999px | `rounded-full` | 头像、药丸按钮 |

### 圆角规范

| 级别 | 规则 |
|------|------|
| ✅ 推荐 | 按钮统一使用 `rounded-md` |
| ✅ 推荐 | 卡片统一使用 `rounded-lg` |
| 🚫 禁止 | 同一页面混用超过 4 种圆角值 |

---

## 🌑 阴影系统

| 名称 | 值 | Tailwind | 用途 |
|------|----|---------|----- |
| SM | 0 1px 2px rgba(0,0,0,0.05) | `shadow-sm` | 按钮默认态 |
| MD | 0 4px 6px rgba(0,0,0,0.1) | `shadow-md` | 卡片悬浮态 |
| LG | 0 10px 15px rgba(0,0,0,0.1) | `shadow-lg` | 弹窗、下拉菜单 |

### 阴影规范

| 级别 | 规则 |
|------|------|
| ✅ 推荐 | 交互元素 hover 时提升 1 级阴影 |
| ⚠️ 允许 | 在强调区域使用彩色阴影 |
| 🚫 禁止 | 使用黑色（opacity > 0.3）的重阴影 |

---

## 🎞️ 动画 & 过渡

### 过渡 Transition

| 属性 | 值 | Tailwind | 用途 |
|------|----|---------|----- |
| Default | all 0.2s ease | `transition-all duration-200` | 按钮、链接 hover |
| Slow | all 0.3s ease-out | `transition-all duration-300` | 卡片展开、面板 |

### 动画 Animation

| 名称 | 描述 | Tailwind |
|------|------|---------|
| fadeIn | 淡入（opacity 0→1） | `animate-in fade-in` |
| slideUp | 上滑进入 | `animate-in slide-in-from-bottom` |

### 动画规范

| 级别 | 规则 |
|------|------|
| ✅ 推荐 | 交互反馈使用 200ms 过渡 |
| ✅ 推荐 | 页面进场动画使用 300-500ms |
| ⚠️ 允许 | 在 Hero 区域使用循环动画 |
| 🚫 禁止 | 动画时长超过 1s（用户感知为卡顿） |
| 🚫 禁止 | 使用 `animation-delay` 超过 500ms |

---

## 📐 布局

### 容器宽度

| 断点 | 宽度 | Tailwind |
|------|------|---------|
| sm | 640px | `max-w-screen-sm` |
| md | 768px | `max-w-screen-md` |
| lg | 1024px | `max-w-screen-lg` |
| xl | 1280px | `max-w-screen-xl` |

### 布局规范

| 级别 | 规则 |
|------|------|
| ✅ 推荐 | 主容器使用 `max-w-screen-xl` 居中 |
| ✅ 推荐 | 使用 flexbox / grid 布局，不使用 float |
| 🚫 禁止 | 内容区宽度超过 1440px |

---

## 🧩 组件规范

### Button

| 变体 | 样式 |
|------|------|
| Primary | `bg-primary text-white rounded-md px-4 py-2 shadow-sm hover:shadow-md` |
| Secondary | `bg-secondary text-secondary-foreground rounded-md px-4 py-2` |
| Ghost | `bg-transparent hover:bg-muted text-foreground rounded-md px-4 py-2` |
| Destructive | `bg-destructive text-white rounded-md px-4 py-2` |

### Card

```
bg-background border border-border rounded-lg p-6 shadow-sm hover:shadow-md transition-shadow
```

### Input

```
bg-background border border-border rounded-md px-3 py-2 text-foreground
focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors
```

---

## 使用约束

### ✅ 推荐

- 所有颜色使用 CSS 变量 / Tailwind 语义类
- 保持 4px 间距基准
- 交互元素添加 hover/focus 反馈
- 使用语义化 HTML 标签

### 🚫 禁止

- 硬编码色值
- 使用 `!important`
- 内联样式代替 Tailwind 类
- 未定义的 magic number（如 `margin: 13px`）
```

---

## globals.css 生成规范

**强制使用 Tailwind CSS v4 语法：**

```css
@import "tailwindcss";

@custom-variant dark (&:is(.dark *));

:root {
  /* ── 色彩 ──────────────────── */
  --background: <从 theme.json colors.background[0] 提取>;
  --foreground: <从 theme.json colors.text[0] 提取>;
  --primary: <从 theme.json colors.text[1] 或 CSS 变量中推断>;
  --primary-foreground: <对比色计算>;
  --secondary: <从 theme.json 推断>;
  --secondary-foreground: <对比色>;
  --muted: <从 theme.json 推断浅色>;
  --muted-foreground: <次要文本色>;
  --accent: <强调色>;
  --accent-foreground: <对比色>;
  --destructive: <错误/危险色，若无则默认 #ef4444>;
  --border: <从 theme.json colors.border[0] 提取>;
  --ring: <焦点环色，通常 = primary 带透明度>;

  /* ── 圆角 ──────────────────── */
  --radius: <从 theme.json radius[0] 提取>;

  /* ── 字体 ──────────────────── */
  --font-sans: <从 theme.json typography.families[0] 提取>;
  --font-mono: <从 theme.json typography.families 提取 monospace>;
}

.dark {
  --background: <深色模式背景>;
  --foreground: <深色模式文本>;
  /* ... 所有变量的深色模式值 ... */
}

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-destructive: var(--destructive);
  --color-border: var(--border);
  --color-ring: var(--ring);
  --radius-sm: calc(var(--radius) * 0.5);
  --radius-md: var(--radius);
  --radius-lg: calc(var(--radius) * 1.5);
  --radius-xl: calc(var(--radius) * 2);
  --font-sans: var(--font-sans);
  --font-mono: var(--font-mono);
}
```

### globals.css 生成要点

1. **CSS 变量名遵循 shadcn/ui 命名规范**（background, foreground, primary, muted, accent, destructive, border, ring）
2. **颜色值从 theme.json 映射**：
   - `colors.background[0].value` → `--background`
   - `colors.text[0].value` → `--foreground`
   - `cssVariables` 中的值优先使用（保留原始设计系统命名）
3. **`@theme inline` 映射到 Tailwind**
4. **必须包含深色模式**（如果 theme.json 无法推断，使用反转色）
5. **圆角从 `radius[0]` 提取，其他级别用 calc 推导**

---

## token 类别对照表

从 theme.json 到 DESIGN.md 的映射：

| theme.json 字段 | DESIGN.md 章节 | globals.css 变量 |
|-----------------|---------------|-----------------|
| `colors.background` | 色彩系统 > 基础色板 | `--background` |
| `colors.text` | 色彩系统 > 基础色板 | `--foreground`, `--primary` |
| `colors.border` | 色彩系统 > 基础色板 | `--border` |
| `typography.families` | 字体系统 > 字体家族 | `--font-sans`, `--font-mono` |
| `typography.textStyles` | 字体系统 > 文字样式 | — |
| `spacing` | 间距系统 | — |
| `radius` | 圆角系统 | `--radius` |
| `shadow.box` | 阴影系统 | — |
| `shadow.text` | 阴影系统 | — |
| `transitions` | 动画 & 过渡 | — |
| `animations` | 动画 & 过渡 | — |
| `lineWidth` | 边框 | — |
| `cssVariables` | 全局 — 优先复用 | 直接使用 |
| `assets.images` | （参考） | — |

---

## 数据来源优先级

| 优先级 | 数据来源 | 提供什么 | 可信度 |
|--------|---------|---------|--------|
| ⭐⭐⭐⭐⭐ | **截图（全页 + 响应式 + section）** | 品牌调性、布局节奏、视觉层级、装饰元素、组件形态 | 最高 — 视觉真相 |
| ⭐⭐⭐⭐ | **cssVariables（:root 变量）** | 原始设计系统的命名和值 | 高 — 开发者意图 |
| ⭐⭐⭐ | **theme.json（颜色/字体/间距/阴影）** | 属性值的统计频率 | 中 — 机器提取，可能有遗漏 |

## 提示

- **截图是最终真相** — 当 token 数据和截图冲突时，**永远以截图为准**。截图中能看到的渐变、装饰、排版节奏无法从 CSS 属性中提取
- **先看截图再读数据** — 工作流中截图分析在 theme.json 分析之前，这是故意的。先建立视觉直觉，再用数据验证
- **响应式截图揭示布局策略** — desktop/tablet/mobile 三张图对比能发现断点布局逻辑、元素隐显规则
- **section 截图精准定位组件风格** — 全页截图太小看不清细节，section 截图是观察按钮/卡片/表单风格的关键
- **cssVariables 是金矿** — 如果页面已经定义了 `:root` 变量，优先使用它们，因为这是原始设计系统的意图
- **count 越高越重要** — theme.json 中的 count 字段表示该值出现次数，次数多 = 该设计系统的核心值
- **推荐/允许/禁止** — 每个 token 类别必须包含三级规范表格
- **Tailwind 类名映射** — DESIGN.md 中每个 token 必须给出对应的 Tailwind 类名
