---
name: extract-page-data
description: Extract structured data from any web page using Playwright — screenshots, design tokens, page text as Markdown, interactive element maps, and full page data packs. Use this skill whenever the user wants to capture a web page screenshot (full page or element), extract CSS design tokens or theme information, convert page content to Markdown, collect links and interactive elements from a page, or export a complete page analysis package. Triggers on any URL that isn't an Axure prototype — for Axure URLs use extract-axure-data instead.
---

# Extract Page Data

Extract structured data from any web page for design analysis, page reconstruction, or content review. The script handles dependency installation automatically — just point it at a URL.

## When to use this

- User shares a web page URL and wants to capture screenshots
- User asks to extract design tokens, CSS theme, or color palette from a page
- User wants page content as Markdown text
- User wants to know what links, buttons, and interactive elements are on a page
- User asks to export or analyze any web page's structure
- User wants to take a screenshot of a specific element on a page (use `--selector`)

**Do NOT use for Axure prototypes** — use `extract-axure-data` instead.

## Quick start

Run the extraction script from `scripts/extract.mjs` relative to this skill directory.

```bash
# Full page screenshot
node scripts/extract.mjs https://example.com --screenshot

# Screenshot of a specific element
node scripts/extract.mjs https://example.com --screenshot --selector "#hero"

# Extract design tokens (colors, typography, spacing, etc.)
node scripts/extract.mjs https://example.com --theme

# Extract page content as Markdown
node scripts/extract.mjs https://example.com --markdown

# Collect all links and interactive elements
node scripts/extract.mjs https://example.com --links

# Extract everything
node scripts/extract.mjs https://example.com --all

# Export full data pack (screenshot + theme + markdown + links as zip)
node scripts/extract.mjs https://example.com --pack
```

First run auto-installs Playwright + Chromium to `~/.cache/page-extractor/`. This takes 1-2 minutes and happens once.

## Parameters

| Flag | What it does | Default |
|---|---|---|
| `<url>` | Web page URL (required) | — |
| `--screenshot` | Capture page screenshot | off |
| `--theme` | Extract design tokens | off |
| `--markdown` | Convert page to Markdown | off |
| `--links` | Collect interactive elements | off |
| `--pack` | Export full data pack (zip) | off |
| `--all` | Run all extractions | off |
| `--selector SEL` | CSS selector to scope extraction | whole page |
| `-o DIR` | Output directory | `./page-export` |
| `--viewport WxH` | Viewport size | `1280x720` |
| `--wait MS` | Extra wait after page load (ms) | `0` |
| `--scroll` | Scroll page to trigger lazy content | off |
| `--scroll-step PX` | Pixels per scroll step | `800` |
| `--scroll-delay MS` | Delay between scroll steps (ms) | `200` |
| `--no-headless` | Show browser window | headless |
| `--connect-cdp URL` | Attach to running Chrome (for auth) | — |
| `--format FMT` | Screenshot format: png or jpeg | `png` |
| `--verbose` | Detailed logging | off |

## Output structure

```
page-export/
├── screenshot.png       # Page or element screenshot    (--screenshot)
├── theme.json           # Design tokens                 (--theme)
├── content.md           # Page text as Markdown          (--markdown)
├── links.json           # Links and interactive elements (--links)
└── page-data.zip        # Full data pack                 (--pack)
    ├── screenshot.png
    ├── theme.json
    ├── content.md
    ├── links.json
    └── meta.json        # Page metadata (title, url, viewport)
```

## Selector support

All extraction modes support `--selector` to scope to a specific element:

```bash
# Screenshot only the header
node scripts/extract.mjs https://example.com --screenshot --selector "header"

# Extract design tokens from a card component
node scripts/extract.mjs https://example.com --theme --selector ".card"

# Get Markdown from the main content area
node scripts/extract.mjs https://example.com --markdown --selector "main"

# Collect links from the navigation
node scripts/extract.mjs https://example.com --links --selector "nav"
```

## Authenticated pages

Some pages require login. Two approaches:

**Connect to an existing Chrome session** (recommended — reuses cookies):

macOS:
```bash
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --remote-debugging-port=9222
```

Windows:
```powershell
start chrome --remote-debugging-port=9222
```

Then log in via that Chrome window and run:
```bash
node scripts/extract.mjs https://example.com --all --connect-cdp http://localhost:9222
```

**Show the browser window** (manual login during extraction):
```bash
node scripts/extract.mjs https://example.com --all --no-headless
```

## Dependency installation

The script auto-installs on first run. If it fails:

```bash
# Manual install
cd ~/.cache/page-extractor
npm install playwright
npx playwright install chromium

# If Chromium download is slow (e.g. behind GFW):
PLAYWRIGHT_DOWNLOAD_HOST=https://npmmirror.com/mirrors/playwright npx playwright install chromium
```

## Output data formats

### theme.json
Design system tokens extracted from computed CSS styles:
```json
{
  "colors": {
    "background": [{"value": "rgb(255,255,255)", "count": 42, "tags": ["div"]}],
    "text": [{"value": "rgb(51,51,51)", "count": 28, "tags": ["p","span"]}],
    "border": [{"value": "rgb(221,221,221)", "count": 12}]
  },
  "typography": {
    "families": [{"value": "\"Inter\", sans-serif", "count": 56}],
    "textStyles": [{"size": "14px", "lineHeight": "22px", "weight": "400", "count": 20}]
  },
  "spacing": [{"value": "16px", "count": 15}],
  "radius": [{"value": "4px", "count": 8}],
  "lineWidth": [{"value": "1px", "count": 10}],
  "shadow": {
    "box": [{"value": "0 2px 8px rgba(0,0,0,0.1)", "count": 5}],
    "text": []
  },
  "transitions": [{"value": "all 0.2s ease", "count": 38, "tags": ["button","a"]}],
  "animations": [{"value": "fadeIn|0.3s|ease", "count": 5, "tags": ["div"]}],
  "cssVariables": {
    "--color-primary": "#6366f1",
    "--radius": "0.5rem",
    "--font-sans": "Inter, sans-serif"
  },
  "assets": {
    "backgroundImages": [{"value": "url(hero.webp)", "count": 1, "tags": ["section"]}],
    "images": [
      {"src": "https://example.com/logo.svg", "alt": "Logo", "position": "static", "zIndex": "auto", "siblingImgCount": 1},
      {"src": "https://example.com/hero.png", "alt": "", "position": "absolute", "zIndex": "2", "siblingImgCount": 2}
    ],
    "svgCount": 12
  }
}
```

### links.json
Interactive elements on the page:
```json
{
  "pageUrl": "https://example.com",
  "pageTitle": "Example",
  "links": [
    {"type": "a", "text": "Home", "href": "https://example.com/", "visible": true},
    {"type": "button", "text": "Sign Up", "visible": true},
    {"type": "form", "href": "https://example.com/login", "visible": true}
  ],
  "totalLinks": 3,
  "visibleLinks": 3
}
```

## Customization

The extraction logic is modular. Each feature lives in its own file under `scripts/`:

| File | Purpose | Customization |
|---|---|---|
| `lib/browser.mjs` | Playwright browser management | Change browser launch args, proxy |
| `lib/screenshot.mjs` | Screenshot capture | Modify scroll behavior, format |
| `lib/theme.mjs` | Design token extraction | Adjust token categories, limits |
| `lib/markdown.mjs` | HTML → Markdown | Change conversion rules |
| `lib/links.mjs` | Element collection | Add new element types |
| `lib/pack.mjs` | Zip packaging | Change pack contents |
| `inject/extract-theme.js` | Browser-injected theme logic | Edit CSS properties to extract |
| `inject/extract-markdown.js` | Browser-injected markdown logic | Customize text extraction |
| `inject/extract-links.js` | Browser-injected links logic | Add custom selectors |

## Theme Clone Workflow

When the user wants to clone or replicate a website's design language, run in this order:

### Step 1: Extract all data
```bash
node extract.mjs <url> --all --scroll --viewport 1440x900
```

### Step 2: Interpret theme.json
| Field | Maps to | CSS Variable |
|---|---|---|
| `colors.background[0]` | Primary surface | `--color-bg` |
| `colors.text[0]` | Body text | `--color-text` |
| `colors.text[1]` | Accent / brand | `--color-primary` |
| `typography.families[0]` | Main font | Google Fonts import |
| `spacing` (top 5) | Spacing scale | `--spacing-1` … |
| `radius[0]` | Default radius | `--radius-base` |
| `transitions[0]` | Hover timing | apply to `.card, a, button` |
| `cssVariables` | Design tokens (if :root vars exist) | use names directly |

### Step 3: Generate CSS variables
```css
:root {
  --color-bg:       <colors.background[0].value>;
  --color-text:     <colors.text[0].value>;
  --color-primary:  <colors.text[1].value>;
  --font-sans:      <typography.families[0].value>;
  --radius-base:    <radius[0].value>;
  --transition:     <transitions[0].value>;
}
```
If `cssVariables` is non-empty, prefer those names — they reflect the original design system's intent.

### Step 4: Restore animations
- `transitions[0].value` → apply as `transition: <value>` on interactive elements
- `animations` → reconstruct `@keyframes` blocks by animation name; apply to entry elements

### Step 5: Handle layered assets
Images with `position: absolute` and `zIndex > 0` in `assets.images` are overlay layers.
Reconstruct with CSS `position: relative` on the parent and `position: absolute` on overlays.

## Playwright 查缺补漏

导出数据是 best-effort 快照，有时需要回到原始页面补充信息（hover 态样式、懒加载内容、动画效果等）。可使用 Playwright CLI 进行交互式补充采集。

```bash
# 打开页面并获取快照
playwright-cli open https://example.com
playwright-cli snapshot

# 交互后采集（如 hover 态）
playwright-cli hover e15
playwright-cli screenshot --filename=hover-state.png

# 获取元素属性
playwright-cli eval "el => getComputedStyle(el).backdropFilter" e5

playwright-cli close
```

> **完整命令参考**: [Playwright CLI 官方技能文档](https://github.com/microsoft/playwright-cli/blob/main/skills/playwright-cli/SKILL.md)

### 何时需要 Playwright

| 场景 | Playwright 做什么 |
|------|------------------|
| 截图模糊/不完整 | 对指定元素高分辨率截图 |
| 样式数据缺失 | 获取完整 computedStyle |
| hover/focus/active 态 | 触发交互后采集样式 |
| 懒加载内容 | 滚动触发后截图 |
| 动画/过渡效果 | 定时截图或录屏 |
| 响应式断点校验 | 设置 viewport 后截图 |

## Troubleshooting

| Problem | Fix |
|---|---|
| Blank screenshot | Page needs time to render — add `--wait 2000` |
| Missing lazy content | Use `--scroll` to trigger lazy loading |
| Need login | Use `--connect-cdp` (see Authenticated pages above) |
| Playwright install fails | Manual install, or set `PLAYWRIGHT_DOWNLOAD_HOST` |
| Wrong element selected | Check selector with browser DevTools first |
