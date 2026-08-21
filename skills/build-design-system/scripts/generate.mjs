#!/usr/bin/env node
/**
 * generate.mjs — 从 theme.json 生成 DESIGN.md + globals.css
 *
 * Usage:
 *   node generate.mjs <theme-data-dir> [options]
 *
 * Options:
 *   -o, --output DIR      输出目录 (默认: ./design-system)
 *   --name NAME           品牌/项目名称 (默认: 从页面 title 推断)
 *   --url URL             原始页面 URL (默认: 从 meta.json 读取)
 *   --dark                生成深色模式变量 (默认: true)
 *   --no-dark             不生成深色模式
 *   --help                显示帮助
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

// ── CLI ──────────────────────────────────────────────────────
function parseArgs(argv) {
  const args = {
    inputDir: null,
    output: './design-system',
    name: null,
    url: null,
    dark: true,
    help: false,
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--help' || a === '-h') args.help = true;
    else if (a === '-o' || a === '--output') args.output = argv[++i];
    else if (a === '--name') args.name = argv[++i];
    else if (a === '--url') args.url = argv[++i];
    else if (a === '--dark') args.dark = true;
    else if (a === '--no-dark') args.dark = false;
    else if (!a.startsWith('-') && !args.inputDir) args.inputDir = a;
  }
  return args;
}

function showHelp() {
  console.log(`
主题生成工具 — 从 theme.json 生成 DESIGN.md + globals.css

Usage:
  node generate.mjs <theme-data-dir> [options]

Arguments:
  theme-data-dir        包含 theme.json 的目录（extract-page-data 或 clone-page 的输出）

Options:
  -o, --output DIR      输出目录 (默认: ./design-system)
  --name NAME           品牌名称 (默认: 从 meta.json 推断)
  --url URL             原始页面 URL (默认: 从 meta.json 读取)
  --no-dark             不生成深色模式
  -h, --help            显示帮助

Examples:
  # 先采集，再生成
  node <extract-page-data>/scripts/extract.mjs https://example.com --theme --screenshot -o ./data
  node generate.mjs ./data -o ./my-theme

  # 指定品牌名称
  node generate.mjs ./data -o ./my-theme --name "My Brand"
`);
}

// ── Color utilities ──────────────────────────────────────────

function rgbToHex(rgb) {
  if (!rgb) return '#000000';
  if (rgb.startsWith('#')) return rgb;
  const match = rgb.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (!match) return rgb;
  const [, r, g, b] = match.map(Number);
  return '#' + [r, g, b].map(c => c.toString(16).padStart(2, '0')).join('');
}

function hexToRgb(hex) {
  hex = hex.replace('#', '');
  if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
  const num = parseInt(hex, 16);
  return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
}

function luminance(hex) {
  const { r, g, b } = hexToRgb(hex);
  const [rs, gs, bs] = [r, g, b].map(c => {
    c = c / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

function isDark(hex) {
  return luminance(hex) < 0.5;
}

function invertForDark(hex) {
  const { r, g, b } = hexToRgb(hex);
  return '#' + [255 - r, 255 - g, 255 - b].map(c => c.toString(16).padStart(2, '0')).join('');
}

function darkenHex(hex, amount = 0.2) {
  const { r, g, b } = hexToRgb(hex);
  const darken = c => Math.max(0, Math.round(c * (1 - amount)));
  return '#' + [darken(r), darken(g), darken(b)].map(c => c.toString(16).padStart(2, '0')).join('');
}

function lightenHex(hex, amount = 0.2) {
  const { r, g, b } = hexToRgb(hex);
  const lighten = c => Math.min(255, Math.round(c + (255 - c) * amount));
  return '#' + [lighten(r), lighten(g), lighten(b)].map(c => c.toString(16).padStart(2, '0')).join('');
}

// ── Token extraction ─────────────────────────────────────────

function extractTokens(theme, cssVars) {
  const tokens = {};

  // Colors
  const bgColors = (theme.colors?.background || []).map(c => ({ ...c, hex: rgbToHex(c.value) }));
  const textColors = (theme.colors?.text || []).map(c => ({ ...c, hex: rgbToHex(c.value) }));
  const borderColors = (theme.colors?.border || []).map(c => ({ ...c, hex: rgbToHex(c.value) }));

  tokens.background = bgColors[0]?.hex || '#ffffff';
  tokens.foreground = textColors[0]?.hex || '#0f172a';

  // Try to find primary from CSS variables first
  const primaryFromVar = cssVars['--primary'] || cssVars['--color-primary'] || cssVars['--brand-color'];
  if (primaryFromVar) {
    tokens.primary = rgbToHex(primaryFromVar);
  } else if (textColors.length > 1) {
    // Use second most common text color as primary (often brand color)
    tokens.primary = textColors[1]?.hex || '#3b82f6';
  } else {
    tokens.primary = '#3b82f6';
  }

  tokens.secondary = bgColors.length > 1 ? bgColors[1]?.hex : lightenHex(tokens.primary, 0.8);
  tokens.muted = bgColors.length > 2 ? bgColors[2]?.hex : lightenHex(tokens.foreground, 0.9);
  tokens.mutedForeground = textColors.length > 2 ? textColors[2]?.hex : lightenHex(tokens.foreground, 0.4);
  tokens.accent = cssVars['--accent'] ? rgbToHex(cssVars['--accent']) : lightenHex(tokens.primary, 0.6);
  tokens.destructive = cssVars['--destructive'] ? rgbToHex(cssVars['--destructive']) : '#ef4444';
  tokens.border = borderColors[0]?.hex || lightenHex(tokens.foreground, 0.85);
  tokens.ring = tokens.primary;

  // Primary/accent foreground (contrast color)
  tokens.primaryForeground = isDark(tokens.primary) ? '#ffffff' : '#000000';
  tokens.secondaryForeground = isDark(tokens.secondary) ? '#ffffff' : tokens.foreground;
  tokens.accentForeground = isDark(tokens.accent) ? '#ffffff' : tokens.foreground;

  // Dark mode
  tokens.darkBackground = cssVars['--dark-bg'] ? rgbToHex(cssVars['--dark-bg']) : '#0a0a0a';
  tokens.darkForeground = cssVars['--dark-fg'] ? rgbToHex(cssVars['--dark-fg']) : '#fafafa';
  tokens.darkMuted = '#262626';
  tokens.darkMutedForeground = '#a3a3a3';
  tokens.darkBorder = '#262626';
  tokens.darkSecondary = '#1a1a1a';

  // Typography
  const families = (theme.typography?.families || []).map(f => f.value);
  tokens.fontSans = families[0] || 'system-ui, -apple-system, sans-serif';
  tokens.fontMono = families.find(f => /mono|consolas|courier/i.test(f)) || 'ui-monospace, monospace';

  // Text styles
  tokens.textStyles = (theme.typography?.textStyles || []).map(ts => ({
    size: ts.size,
    lineHeight: ts.lineHeight,
    weight: ts.weight,
    count: ts.count,
  }));

  // Spacing
  tokens.spacing = (theme.spacing || []).map(s => ({ value: s.value, count: s.count }));

  // Radius
  const radii = (theme.radius || []).map(r => r.value);
  tokens.radius = radii[0] || '8px';
  tokens.allRadii = radii;

  // Shadows
  tokens.boxShadows = (theme.shadow?.box || []).map(s => ({ value: s.value, count: s.count }));
  tokens.textShadows = (theme.shadow?.text || []);

  // Line widths (borders)
  tokens.lineWidths = (theme.lineWidth || []).map(l => ({ value: l.value, count: l.count }));

  // Transitions & Animations
  tokens.transitions = (theme.transitions || []).map(t => ({ value: t.value, count: t.count, tags: t.tags }));
  tokens.animations = (theme.animations || []).map(a => {
    const [name, duration, timing] = (a.value || '').split('|');
    return { name, duration, timing, count: a.count, tags: a.tags };
  });

  // CSS Variables (pass through)
  tokens.cssVariables = cssVars;

  // All colors for reference
  tokens.allBgColors = bgColors;
  tokens.allTextColors = textColors;
  tokens.allBorderColors = borderColors;

  return tokens;
}

// ── DESIGN.md generator ──────────────────────────────────────

function generateDesignMd(tokens, meta) {
  const name = meta.name || 'Design System';
  const url = meta.url || '';

  const lines = [];
  const add = (...args) => lines.push(...args);

  add(`# ${name} 设计系统`);
  add('');
  if (url) add(`> 从 ${url} 提取的设计规范`);
  add('');
  add('## 设计原则');
  add('');
  add('- **一致性** — 使用统一的 token 保持视觉一致');
  add('- **可读性** — 合理的对比度和字号层级');
  add('- **响应式** — 适配多端多视口');
  add('');
  add('---');
  add('');

  // ── Colors ───────────────────
  add('## 🎨 色彩系统');
  add('');
  add('### 基础色板');
  add('');
  add('| 名称 | 值 | Tailwind | 用途 |');
  add('|------|----|---------|----- |');
  add(`| Primary | \`${tokens.primary}\` | \`bg-primary\` / \`text-primary\` | 品牌主色、CTA 按钮 |`);
  add(`| Background | \`${tokens.background}\` | \`bg-background\` | 页面底色 |`);
  add(`| Foreground | \`${tokens.foreground}\` | \`text-foreground\` | 主要文本 |`);
  add(`| Secondary | \`${tokens.secondary}\` | \`bg-secondary\` | 辅助区域底色 |`);
  add(`| Muted | \`${tokens.muted}\` | \`bg-muted\` / \`text-muted-foreground\` | 次要文本、禁用态 |`);
  add(`| Accent | \`${tokens.accent}\` | \`bg-accent\` | 高亮、标签 |`);
  add(`| Border | \`${tokens.border}\` | \`border-border\` | 分割线、边框 |`);
  add(`| Destructive | \`${tokens.destructive}\` | \`bg-destructive\` | 错误、删除 |`);
  add('');

  // Extra colors from extraction
  if (tokens.allBgColors.length > 3) {
    add('### 扩展色板（页面提取）');
    add('');
    add('| 值 | 出现次数 | 标签 |');
    add('|----|---------|----- |');
    tokens.allBgColors.slice(0, 6).forEach(c => {
      add(`| \`${c.hex}\` | ${c.count} | ${(c.tags || []).join(', ')} |`);
    });
    add('');
  }

  add('### 色彩规范');
  add('');
  add('| 级别 | 规则 |');
  add('|------|------|');
  add('| ✅ 推荐 | 使用语义化变量 `bg-primary`, `text-foreground` 而非硬编码色值 |');
  add('| ✅ 推荐 | 深色模式通过 `.dark` 类切换 |');
  add('| ⚠️ 允许 | 在装饰场景使用渐变色 |');
  add('| 🚫 禁止 | 硬编码 `#RRGGBB` 值，必须使用 CSS 变量 |');
  add('| 🚫 禁止 | 文本对比度低于 4.5:1 |');
  add('');
  add('---');
  add('');

  // ── Typography ───────────────
  add('## 📝 字体系统');
  add('');
  add('### 字体家族');
  add('');
  add('| 名称 | 字体 | Tailwind | 用途 |');
  add('|------|------|---------|----- |');
  add(`| Sans | \`${tokens.fontSans}\` | \`font-sans\` | 正文、UI 组件 |`);
  add(`| Mono | \`${tokens.fontMono}\` | \`font-mono\` | 代码块 |`);
  add('');

  if (tokens.textStyles.length > 0) {
    add('### 文字样式');
    add('');
    add('| 大小 | 行高 | 字重 | 出现次数 | 建议 Tailwind |');
    add('|------|------|------|---------|--------------|');
    tokens.textStyles.slice(0, 8).forEach(ts => {
      const sizeNum = parseInt(ts.size);
      let tw = 'text-base';
      if (sizeNum >= 36) tw = 'text-4xl';
      else if (sizeNum >= 30) tw = 'text-3xl';
      else if (sizeNum >= 24) tw = 'text-2xl';
      else if (sizeNum >= 20) tw = 'text-xl';
      else if (sizeNum >= 18) tw = 'text-lg';
      else if (sizeNum >= 16) tw = 'text-base';
      else if (sizeNum >= 14) tw = 'text-sm';
      else if (sizeNum >= 12) tw = 'text-xs';

      const weightNum = parseInt(ts.weight);
      let twWeight = '';
      if (weightNum >= 700) twWeight = ' font-bold';
      else if (weightNum >= 600) twWeight = ' font-semibold';
      else if (weightNum >= 500) twWeight = ' font-medium';

      add(`| ${ts.size} | ${ts.lineHeight} | ${ts.weight} | ${ts.count} | \`${tw}${twWeight}\` |`);
    });
    add('');
  }

  add('### 字体规范');
  add('');
  add('| 级别 | 规则 |');
  add('|------|------|');
  add('| ✅ 推荐 | 标题使用 font-semibold 或 font-bold |');
  add('| ✅ 推荐 | 正文行高 1.5（如 16px/24px） |');
  add('| ⚠️ 允许 | Hero 区域使用更大标题（最大 48px） |');
  add('| 🚫 禁止 | 使用超过 3 种字体 |');
  add('| 🚫 禁止 | 正文字号低于 14px |');
  add('');
  add('---');
  add('');

  // ── Spacing ──────────────────
  add('## 📏 间距系统');
  add('');
  if (tokens.spacing.length > 0) {
    add('### 间距标尺（页面提取）');
    add('');
    add('| 值 | 出现次数 | Tailwind 近似 |');
    add('|----|---------|--------------  |');
    tokens.spacing.slice(0, 10).forEach(s => {
      const px = parseInt(s.value);
      let tw = `p-[${s.value}]`;
      if (px <= 4) tw = 'p-1';
      else if (px <= 8) tw = 'p-2';
      else if (px <= 12) tw = 'p-3';
      else if (px <= 16) tw = 'p-4';
      else if (px <= 20) tw = 'p-5';
      else if (px <= 24) tw = 'p-6';
      else if (px <= 32) tw = 'p-8';
      else if (px <= 40) tw = 'p-10';
      else if (px <= 48) tw = 'p-12';
      else if (px <= 64) tw = 'p-16';
      add(`| ${s.value} | ${s.count} | \`${tw}\` |`);
    });
    add('');
  }

  add('### 间距规范');
  add('');
  add('| 级别 | 规则 |');
  add('|------|------|');
  add('| ✅ 推荐 | 使用 4px 的倍数（4, 8, 12, 16, 24, 32...） |');
  add('| ✅ 推荐 | 同级元素间距保持一致 |');
  add('| 🚫 禁止 | 使用奇数 px 值（如 5px, 7px, 13px） |');
  add('');
  add('---');
  add('');

  // ── Radius ───────────────────
  add('## 🔲 圆角系统');
  add('');
  add('### 圆角标尺');
  add('');
  add(`| 名称 | 值 | Tailwind |`);
  add(`|------|----|---------  |`);

  const radiusPx = parseInt(tokens.radius);
  add(`| SM | ${Math.round(radiusPx * 0.5)}px | \`rounded-sm\` |`);
  add(`| MD (基准) | ${tokens.radius} | \`rounded-md\` |`);
  add(`| LG | ${Math.round(radiusPx * 1.5)}px | \`rounded-lg\` |`);
  add(`| XL | ${Math.round(radiusPx * 2)}px | \`rounded-xl\` |`);
  add(`| Full | 9999px | \`rounded-full\` |`);
  add('');

  if (tokens.allRadii.length > 1) {
    add('*页面中实际出现的圆角值：* ' + tokens.allRadii.map(r => `\`${r}\``).join(', '));
    add('');
  }

  add('### 圆角规范');
  add('');
  add('| 级别 | 规则 |');
  add('|------|------|');
  add('| ✅ 推荐 | 按钮统一使用 `rounded-md` |');
  add('| ✅ 推荐 | 卡片统一使用 `rounded-lg` |');
  add('| 🚫 禁止 | 同一页面混用超过 4 种圆角值 |');
  add('');
  add('---');
  add('');

  // ── Shadows ──────────────────
  add('## 🌑 阴影系统');
  add('');
  if (tokens.boxShadows.length > 0) {
    add('### 阴影值（页面提取）');
    add('');
    add('| 值 | 出现次数 | 建议层级 |');
    add('|----|---------|---------|');
    tokens.boxShadows.slice(0, 5).forEach((s, i) => {
      const level = i === 0 ? 'shadow-sm' : i === 1 ? 'shadow-md' : 'shadow-lg';
      add(`| \`${s.value.slice(0, 50)}${s.value.length > 50 ? '...' : ''}\` | ${s.count} | \`${level}\` |`);
    });
    add('');
  }

  add('### 阴影规范');
  add('');
  add('| 级别 | 规则 |');
  add('|------|------|');
  add('| ✅ 推荐 | 交互元素 hover 时提升 1 级阴影 |');
  add('| ⚠️ 允许 | 在强调区域使用彩色阴影 |');
  add('| 🚫 禁止 | 使用 opacity > 0.3 的重阴影 |');
  add('');
  add('---');
  add('');

  // ── Animations ───────────────
  add('## 🎞️ 动画 & 过渡');
  add('');
  if (tokens.transitions.length > 0) {
    add('### 过渡（页面提取）');
    add('');
    add('| 值 | 出现次数 | 标签 |');
    add('|----|---------|------|');
    tokens.transitions.slice(0, 5).forEach(t => {
      add(`| \`${t.value.slice(0, 60)}\` | ${t.count} | ${(t.tags || []).join(', ')} |`);
    });
    add('');
  }

  if (tokens.animations.length > 0) {
    add('### 动画（页面提取）');
    add('');
    add('| 名称 | 时长 | 缓动 | 出现次数 |');
    add('|------|------|------|---------|');
    tokens.animations.forEach(a => {
      add(`| ${a.name || '—'} | ${a.duration || '—'} | ${a.timing || '—'} | ${a.count} |`);
    });
    add('');
  }

  add('### 动画规范');
  add('');
  add('| 级别 | 规则 |');
  add('|------|------|');
  add('| ✅ 推荐 | 交互反馈使用 200ms 过渡 |');
  add('| ✅ 推荐 | 页面进场动画使用 300-500ms |');
  add('| ⚠️ 允许 | Hero 区域使用循环动画 |');
  add('| 🚫 禁止 | 动画时长超过 1s |');
  add('| 🚫 禁止 | `animation-delay` 超过 500ms |');
  add('');
  add('---');
  add('');

  // ── Border widths ────────────
  if (tokens.lineWidths.length > 0) {
    add('## 📐 边框');
    add('');
    add('| 值 | 出现次数 | Tailwind |');
    add('|----|---------|---------  |');
    tokens.lineWidths.forEach(l => {
      const px = parseInt(l.value);
      const tw = px <= 1 ? 'border' : `border-${px}`;
      add(`| ${l.value} | ${l.count} | \`${tw}\` |`);
    });
    add('');
    add('---');
    add('');
  }

  // ── Components ───────────────
  add('## 🧩 组件规范');
  add('');
  add('### Button');
  add('');
  add('| 变体 | Tailwind 类 |');
  add('|------|------------|');
  add('| Primary | `bg-primary text-primary-foreground rounded-md px-4 py-2 shadow-sm hover:shadow-md transition-shadow` |');
  add('| Secondary | `bg-secondary text-secondary-foreground rounded-md px-4 py-2` |');
  add('| Ghost | `bg-transparent hover:bg-muted text-foreground rounded-md px-4 py-2` |');
  add('| Destructive | `bg-destructive text-white rounded-md px-4 py-2` |');
  add('');
  add('### Card');
  add('');
  add('```');
  add('bg-background border border-border rounded-lg p-6 shadow-sm hover:shadow-md transition-shadow');
  add('```');
  add('');
  add('### Input');
  add('');
  add('```');
  add('bg-background border border-border rounded-md px-3 py-2 text-foreground');
  add('focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors');
  add('```');
  add('');
  add('---');
  add('');

  // ── Global constraints ───────
  add('## 使用约束');
  add('');
  add('### ✅ 推荐');
  add('');
  add('- 所有颜色使用 CSS 变量 / Tailwind 语义类');
  add('- 保持 4px 间距基准');
  add('- 交互元素添加 hover/focus 反馈');
  add('- 使用语义化 HTML 标签');
  add('');
  add('### 🚫 禁止');
  add('');
  add('- 硬编码色值');
  add('- 使用 `!important`');
  add('- 内联样式代替 Tailwind 类');
  add('- 未定义的 magic number（如 `margin: 13px`）');
  add('');

  // ── CSS Variables reference ──
  if (Object.keys(tokens.cssVariables).length > 0) {
    add('---');
    add('');
    add('## 📎 原始 CSS 变量');
    add('');
    add('以下是原始页面 `:root` 中定义的 CSS 变量（可直接复用）：');
    add('');
    add('| 变量 | 值 |');
    add('|------|------|');
    Object.entries(tokens.cssVariables).slice(0, 30).forEach(([k, v]) => {
      add(`| \`${k}\` | \`${v}\` |`);
    });
    add('');
  }

  return lines.join('\n');
}

// ── globals.css generator ────────────────────────────────────

function generateGlobalsCss(tokens, includeDark) {
  const lines = [];
  const add = (...args) => lines.push(...args);

  add('@import "tailwindcss";');
  add('');
  if (includeDark) {
    add('@custom-variant dark (&:is(.dark *));');
    add('');
  }

  add(':root {');
  add(`  --background: ${tokens.background};`);
  add(`  --foreground: ${tokens.foreground};`);
  add('');
  add(`  --primary: ${tokens.primary};`);
  add(`  --primary-foreground: ${tokens.primaryForeground};`);
  add('');
  add(`  --secondary: ${tokens.secondary};`);
  add(`  --secondary-foreground: ${tokens.secondaryForeground};`);
  add('');
  add(`  --muted: ${tokens.muted};`);
  add(`  --muted-foreground: ${tokens.mutedForeground};`);
  add('');
  add(`  --accent: ${tokens.accent};`);
  add(`  --accent-foreground: ${tokens.accentForeground};`);
  add('');
  add(`  --destructive: ${tokens.destructive};`);
  add('');
  add(`  --border: ${tokens.border};`);
  add(`  --ring: ${tokens.ring};`);
  add('');
  add(`  --radius: ${tokens.radius};`);
  add('');
  add(`  --font-sans: ${tokens.fontSans};`);
  add(`  --font-mono: ${tokens.fontMono};`);
  add('}');
  add('');

  if (includeDark) {
    add('.dark {');
    add(`  --background: ${tokens.darkBackground};`);
    add(`  --foreground: ${tokens.darkForeground};`);
    add('');
    add(`  --primary: ${tokens.primary};`);
    add(`  --primary-foreground: ${tokens.primaryForeground};`);
    add('');
    add(`  --secondary: ${tokens.darkSecondary};`);
    add(`  --secondary-foreground: ${tokens.darkForeground};`);
    add('');
    add(`  --muted: ${tokens.darkMuted};`);
    add(`  --muted-foreground: ${tokens.darkMutedForeground};`);
    add('');
    add(`  --accent: ${darkenHex(tokens.accent, 0.3)};`);
    add(`  --accent-foreground: ${tokens.darkForeground};`);
    add('');
    add(`  --destructive: ${tokens.destructive};`);
    add('');
    add(`  --border: ${tokens.darkBorder};`);
    add(`  --ring: ${tokens.ring};`);
    add('}');
    add('');
  }

  add('@theme inline {');
  add('  --color-background: var(--background);');
  add('  --color-foreground: var(--foreground);');
  add('  --color-primary: var(--primary);');
  add('  --color-primary-foreground: var(--primary-foreground);');
  add('  --color-secondary: var(--secondary);');
  add('  --color-secondary-foreground: var(--secondary-foreground);');
  add('  --color-muted: var(--muted);');
  add('  --color-muted-foreground: var(--muted-foreground);');
  add('  --color-accent: var(--accent);');
  add('  --color-accent-foreground: var(--accent-foreground);');
  add('  --color-destructive: var(--destructive);');
  add('  --color-border: var(--border);');
  add('  --color-ring: var(--ring);');
  add('');
  add('  --radius-sm: calc(var(--radius) * 0.5);');
  add('  --radius-md: var(--radius);');
  add('  --radius-lg: calc(var(--radius) * 1.5);');
  add('  --radius-xl: calc(var(--radius) * 2);');
  add('');
  add('  --font-sans: var(--font-sans);');
  add('  --font-mono: var(--font-mono);');
  add('}');
  add('');

  // Base styles
  add('body {');
  add('  background-color: var(--background);');
  add('  color: var(--foreground);');
  add('  font-family: var(--font-sans);');
  add('}');

  return lines.join('\n');
}

// ── Main ─────────────────────────────────────────────────────

function main() {
  const args = parseArgs(process.argv);
  if (args.help) { showHelp(); process.exit(0); }
  if (!args.inputDir) { console.error('❌ 需要输入目录'); showHelp(); process.exit(1); }

  const inputDir = path.resolve(args.inputDir);
  const outputDir = path.resolve(args.output);

  // Read theme.json
  const themePath = path.join(inputDir, 'theme.json');
  if (!fs.existsSync(themePath)) {
    console.error(`❌ theme.json 不存在: ${themePath}`);
    console.error('   请先运行 extract-page-data 或 clone-page 采集数据');
    process.exit(1);
  }

  console.log('🎨 主题生成');
  console.log(`   输入: ${inputDir}`);
  console.log(`   输出: ${outputDir}`);

  const theme = JSON.parse(fs.readFileSync(themePath, 'utf-8'));

  // Read meta.json if exists
  const metaPath = path.join(inputDir, 'meta.json');
  const meta = fs.existsSync(metaPath) ? JSON.parse(fs.readFileSync(metaPath, 'utf-8')) : {};

  const brandName = args.name || meta.title || meta.pageName || 'Extracted Theme';
  const url = args.url || meta.url || meta.pageUrl || '';

  // Extract tokens
  const cssVars = theme.cssVariables || {};
  const tokens = extractTokens(theme, cssVars);

  fs.mkdirSync(outputDir, { recursive: true });

  // Generate DESIGN.md
  console.log('  📄 生成 DESIGN.md…');
  const designMd = generateDesignMd(tokens, { name: brandName, url });
  fs.writeFileSync(path.join(outputDir, 'DESIGN.md'), designMd);
  console.log(`  ✅ DESIGN.md (${designMd.length} 字符)`);

  // Generate globals.css
  console.log('  🎨 生成 globals.css…');
  const globalsCss = generateGlobalsCss(tokens, args.dark);
  fs.writeFileSync(path.join(outputDir, 'globals.css'), globalsCss);
  console.log(`  ✅ globals.css (${globalsCss.length} 字符)`);

  // ── Collect all screenshots ─────────────────────────────────
  console.log('  📸 收集截图…');
  const screenshotsDir = path.join(outputDir, 'screenshots');
  fs.mkdirSync(screenshotsDir, { recursive: true });
  let screenshotCount = 0;

  // Full page screenshot
  const fullPageSrc = path.join(inputDir, 'screenshot.png');
  if (fs.existsSync(fullPageSrc)) {
    fs.copyFileSync(fullPageSrc, path.join(screenshotsDir, 'full-page.png'));
    screenshotCount++;
  }

  // Responsive screenshots
  const responsiveDir = path.join(inputDir, 'responsive');
  if (fs.existsSync(responsiveDir)) {
    for (const file of fs.readdirSync(responsiveDir)) {
      if (file.endsWith('.png')) {
        fs.copyFileSync(path.join(responsiveDir, file), path.join(screenshotsDir, file));
        screenshotCount++;
      }
    }
  }

  // Section screenshots
  const sectionsDir = path.join(inputDir, 'sections');
  if (fs.existsSync(sectionsDir)) {
    for (const section of fs.readdirSync(sectionsDir)) {
      const sectionScreenshot = path.join(sectionsDir, section, 'screenshot.png');
      if (fs.existsSync(sectionScreenshot)) {
        fs.copyFileSync(sectionScreenshot, path.join(screenshotsDir, `${section}.png`));
        screenshotCount++;
      }
    }
  }

  if (screenshotCount > 0) {
    console.log(`  ✅ screenshots/ (${screenshotCount} 张截图)`);
  } else {
    console.warn('  ⚠️  未找到截图。建议使用 clone-page 采集 (quick + responsive + styles --selector)');
  }

  console.log(`\n${'═'.repeat(50)}`);
  console.log('✅ 完成！');
  console.log(`   DESIGN.md     → ${path.join(outputDir, 'DESIGN.md')}`);
  console.log(`   globals.css   → ${path.join(outputDir, 'globals.css')}`);
  console.log(`   screenshots/  → ${screenshotCount} 张视觉参考`);
  console.log('\n💡 将 DESIGN.md 放入项目根目录，AI 编码工具即可自动读取');
  if (screenshotCount === 0) {
    console.log('⚠️  强烈建议用 clone-page 技能采集截图后重新生成！');
  }
}

main();
