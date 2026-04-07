---
name: extract-axure-data
description: Extract structured data from Axure prototypes using Playwright — screenshots, design tokens, interaction maps, annotations, and page text. Use this skill whenever the user wants to extract data from an Axure prototype, reconstruct or clone an Axure page, analyze Axure design tokens, export Axure content, or work with Axure prototype URLs (even if they don't say "Axure" explicitly — look for AxShare links, /start.html#p= URLs, or mentions of wireframes/prototypes hosted online).
---

# Extract Axure Data

Extract structured data from Axure prototypes for page reconstruction, content analysis, or design review. The script handles dependency installation automatically — just point it at a URL.

## When to use this

- User shares an Axure prototype URL and wants to extract or rebuild it
- User asks to clone, reconstruct, or analyze a wireframe/prototype
- User mentions AxShare, Axure Cloud, or prototype URLs with `start.html#p=`
- User wants design tokens, screenshots, or interaction data from a prototype

## How it works

Axure stores page data in static JS files (`data/document.js`, `files/{page}/data.js`). The script parses these directly in Node.js without needing a browser — this is fast and works for sitemap, interactions, and annotations. Screenshots and design tokens require rendering, so Playwright launches a Chromium instance for those.

## Quick start

Run the extraction script from `scripts/extract.mjs` relative to this skill directory.

```bash
# Basic extraction — screenshot + design tokens (default)
node scripts/extract.mjs <AXURE_URL> --all

# Full extraction — add interactions, annotations, page text
node scripts/extract.mjs <AXURE_URL> --all --advanced

# Specific pages only
node scripts/extract.mjs <AXURE_URL> --pages login,dashboard
```

First run auto-installs Playwright + Chromium to `~/.cache/axure-extractor/`. This takes 1-2 minutes and happens once.

## Parameters

| Flag | What it does | Default |
|---|---|---|
| `<url>` | Axure prototype URL (required) | — |
| `--all` | Process all pages | first page only |
| `--advanced` | Add interactions, annotations, page text | off |
| `-o DIR` | Output directory | `./axure-export` |
| `--pages P1,P2` | Process only named pages | — |
| `--no-screenshot` | Skip screenshots | screenshots on |
| `--no-headless` | Show browser window | headless |
| `--connect-cdp URL` | Attach to running Chrome (for auth) | — |
| `--verbose` | Detailed logging | off |

## Output structure

```
axure-export/
├── sitemap.json           # Page tree and hierarchy (always produced)
└── pages/{pageName}/
    ├── screenshot.png      # Page screenshot
    ├── theme.json          # Design tokens (colors, fonts, spacing, radii)
    ├── data.json           # Page metadata and diagram        (--advanced)
    ├── notes.json          # Component annotations            (--advanced)
    ├── interactions.json   # Event map (clicks, navigations)  (--advanced)
    └── content.md          # Rendered page text as Markdown   (--advanced)
```

## Recommended workflow: page reconstruction

When the goal is to rebuild an Axure prototype as a real web page, use a two-step approach. The reason for splitting is that screenshots + theme tokens are enough for ~80% visual fidelity, and the additional data only helps when fine-tuning details — so extracting everything upfront wastes time if the basic result is already good.

**Step 1 — Basic extraction:**
```bash
node scripts/extract.mjs <URL> --pages <target>
```
Use `screenshot.png` as the visual reference and `theme.json` for exact colors, fonts, and spacing. Build the page.

**Step 2 — Refine if needed:**
```bash
node scripts/extract.mjs <URL> --pages <target> --advanced
```
If interactions are missing or annotations are wrong, the additional files (`interactions.json`, `notes.json`, `content.md`) provide the detail to fix them.

## Authenticated prototypes

Some Axure prototypes require login (AxShare, corporate SSO). Two approaches:

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
node scripts/extract.mjs <URL> --all --connect-cdp http://localhost:9222
```

**Show the browser window** (manual login during extraction):
```bash
node scripts/extract.mjs <URL> --all --no-headless
```

## Dependency installation

The script auto-installs on first run. If it fails:

```bash
# Manual install
cd ~/.cache/axure-extractor   # macOS/Linux
# or: cd %USERPROFILE%\.cache\axure-extractor   (Windows)

npm install playwright
npx playwright install chromium

# If Chromium download is slow (e.g. behind GFW):
PLAYWRIGHT_DOWNLOAD_HOST=https://npmmirror.com/mirrors/playwright npx playwright install chromium
```

If Playwright can't be installed at all, the script degrades gracefully — it still extracts sitemap, page data, annotations, and interactions (everything that doesn't need a browser), but skips screenshots and theme tokens.

## Output data formats

### theme.json
Design system tokens extracted from computed styles:
```json
{
  "colors": {
    "background": [{"value": "rgb(255,255,255)", "count": 42, "tags": ["div"]}],
    "text": [{"value": "rgb(51,51,51)", "count": 28, "tags": ["p","span"]}],
    "border": [{"value": "rgb(221,221,221)", "count": 12}]
  },
  "typography": {
    "families": [{"value": "\"PingFang SC\", sans-serif", "count": 56}],
    "textStyles": [{"size": "14px", "lineHeight": "22px", "weight": "400", "count": 20}]
  },
  "spacing": [{"value": "16px", "count": 15}],
  "radius": [{"value": "4px", "count": 8}]
}
```

### notes.json
Component annotations authored in Axure:
```json
{
  "page": {"description": "User login page"},
  "id-username-input": {"description": "Username field", "placeholder": "Enter username"},
  "id-submit-btn": {"description": "Login button", "action": "Submit form"}
}
```

### interactions.json
Event mappings defined in Axure's interaction designer:
```json
{
  "onClick": {"targetPage": "dashboard", "action": "navigate"}
}
```

## Playwright 查缺补漏

导出数据基于静态 JS 解析和快照采集，某些动态内容（交互状态、条件面板、动态面板切换等）可能不完整。可使用 Playwright CLI 回到原型页面补充采集。

```bash
# 打开 Axure 原型
playwright-cli open <AXURE_URL>
playwright-cli snapshot

# 点击交互元素查看动态面板切换
playwright-cli click e12
playwright-cli screenshot --filename=panel-state-2.png

# 获取元素的精确样式
playwright-cli eval "el => getComputedStyle(el).cssText" e5

playwright-cli close
```

> **完整命令参考**: [Playwright CLI 官方技能文档](https://github.com/microsoft/playwright-cli/blob/main/skills/playwright-cli/SKILL.md)

### 典型补充场景

| 场景 | Playwright 做什么 |
|------|------------------|
| 动态面板状态 | 点击触发切换后截图 |
| 条件显示/隐藏 | 触发条件后采集 DOM |
| 交互动画 | 录制交互过程 |
| 需要登录的原型 | 复用已登录的 Chrome 会话 |
| Axure 母版内容 | 进入页面后完整采集 |

## Troubleshooting

| Problem | Fix |
|---|---|
| `HTTP 404: .../data/document.js` | URL isn't an Axure prototype, or wrong base URL |
| `Sitemap 提取失败` | Check URL is reachable: `curl -I <url>` |
| Screenshots are blank | Page needs longer to render — try `--no-headless` to watch |
| Need login | Use `--connect-cdp` (see Authenticated prototypes above) |
| Playwright install fails | Manual install, or set `PLAYWRIGHT_DOWNLOAD_HOST` for mirror |
