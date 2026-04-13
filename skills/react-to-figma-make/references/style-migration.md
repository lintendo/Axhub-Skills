# 样式迁移指南

## 目标架构

Figma Make 项目的样式分三层：

```
style.css                    ← 根入口样式（项目主入口使用）
src/index.css                ← Figma Make 入口样式（导出壳使用）
src/styles/globals.css       ← 主样式文件（两层共享）
```

两个入口样式文件应指向同一个 `globals.css`：

```css
/* style.css */
@import "tailwindcss";
@import "./src/styles/globals.css";

/* src/index.css */
@import "tailwindcss";
@import "./styles/globals.css";
```

## 按源项目样式方案迁移

### Tailwind CSS v4（推荐保留）

Figma Make 原生支持 Tailwind CSS v4 语法。如果源项目已使用 v4，可以几乎直接迁移。

**迁移步骤**：

1. 将 `@theme` 定义和 CSS 变量迁移到 `src/styles/globals.css`
2. 保留组件中的 Tailwind 类名不变
3. 确保两个入口都有 `@import "tailwindcss"`

**示例**：

```css
/* src/styles/globals.css */
@theme inline {
  --color-primary: #3b82f6;
  --color-secondary: #8b5cf6;
  --radius-default: 0.5rem;
  --font-sans: 'Inter', system-ui, sans-serif;
}

@custom-variant dark (&:where(.dark, .dark *));

/* 基础样式 */
body {
  font-family: var(--font-sans);
  background-color: var(--color-background);
}
```

### Tailwind CSS v3

需要迁移到 v4 语法。

**主要变化**：

| v3 语法 | v4 语法 |
|---------|---------|
| `tailwind.config.js` 中的 `theme.extend` | `@theme inline { }` |
| `@apply` 指令 | 直接使用类名或提取 CSS |
| `@tailwind base/components/utilities` | `@import "tailwindcss"` |
| `darkMode: 'class'` | `@custom-variant dark (&:where(.dark, .dark *))` |

**示例迁移**：

```javascript
// ❌ v3 tailwind.config.js
module.exports = {
  theme: {
    extend: {
      colors: {
        primary: '#3b82f6',
        secondary: '#8b5cf6',
      },
      borderRadius: {
        DEFAULT: '0.5rem',
      }
    }
  }
}
```

```css
/* ✅ v4 globals.css */
@theme inline {
  --color-primary: #3b82f6;
  --color-secondary: #8b5cf6;
  --radius-default: 0.5rem;
}
```

### CSS Modules

CSS Modules 需要合并为普通 CSS 类。

**迁移步骤**：

1. 将 `.module.css` 文件重命名为 `.css`
2. 为类名添加组件前缀避免冲突
3. 将 `import styles from './xxx.module.css'` 改为 `import './xxx.css'`
4. 将 `className={styles.xxx}` 改为 `className="prefix-xxx"`

**示例**：

```css
/* ❌ Button.module.css */
.container { padding: 8px; }
.primary { background: blue; }

/* ✅ button.css */
.button-container { padding: 8px; }
.button-primary { background: blue; }
```

```tsx
// ❌ 原始
import styles from './Button.module.css';
<div className={styles.container}>

// ✅ 迁移后
import './button.css';
<div className="button-container">
```

### Styled Components / Emotion

JS-in-CSS 需要提取为纯 CSS。

**迁移步骤**：

1. 提取所有样式定义为 CSS 类
2. 将动态样式改为 CSS 变量 + 内联 style
3. 移除 `styled` / `css` 导入

**示例**：

```tsx
// ❌ Styled Components
const Card = styled.div`
  padding: 16px;
  border-radius: 8px;
  background: ${props => props.variant === 'dark' ? '#1a1a1a' : '#fff'};
`;

// ✅ 提取为 CSS + 内联样式
// card.css
// .card { padding: 16px; border-radius: 8px; }

import './card.css';
<div
  className="card"
  style={{ background: variant === 'dark' ? '#1a1a1a' : '#fff' }}
>
```

### 纯 CSS / SCSS

**CSS**：直接迁移到 `src/styles/globals.css` 或组件同级 CSS 文件。

**SCSS**：
1. 将 SCSS 编译为 CSS（或手动转换简单语法）
2. SCSS 变量 `$xxx` 改为 CSS 变量 `--xxx`
3. 嵌套选择器展平为标准 CSS（或使用 CSS 原生嵌套语法）
4. Mixins 提取为独立的 CSS 类

### CSS 变量 / 设计 Token

CSS 变量应保留并迁移到 `src/styles/globals.css` 的 `:root` 或 `@theme` 中。

```css
/* src/styles/globals.css */

/* 方式 1：使用 CSS :root（通用） */
:root {
  --color-primary: #3b82f6;
  --color-bg: #ffffff;
  --spacing-sm: 8px;
  --spacing-md: 16px;
  --radius-sm: 4px;
}

/* 方式 2：使用 Tailwind @theme（推荐，与 Tailwind 集成） */
@theme inline {
  --color-primary: #3b82f6;
  --color-bg: #ffffff;
  --spacing-sm: 8px;
  --spacing-md: 16px;
  --radius-sm: 4px;
}
```

## 外部字体处理

### Google Fonts

```css
/* src/styles/globals.css 顶部 */
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

body {
  font-family: 'Inter', system-ui, sans-serif;
}
```

### 本地字体

将字体文件复制到 `src/assets/fonts/`，使用 `@font-face`：

```css
@font-face {
  font-family: 'CustomFont';
  src: url('./assets/fonts/custom.woff2') format('woff2');
  font-weight: 400;
  font-style: normal;
}
```

## 注意事项

- **不要直接搬运 Tailwind 构建产物**：Figma Make 导出的 `src/index.css` 有时是 Tailwind 的编译结果（体积很大），不应该直接作为最终样式文件
- **保持两个入口样式同步**：`style.css` 和 `src/index.css` 应指向同一个 `globals.css`
- **避免全局样式污染**：组件样式建议使用带前缀的类名或组件目录同级 CSS 文件
- **保留设计 Token**：CSS 变量和 `@theme` 定义是后续主题提取的重要来源
