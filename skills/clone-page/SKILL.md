---
name: clone-page
description: >
  高精度克隆网页。使用 Playwright 渐进式采集页面数据（DOM 结构、样式、截图、资源），
  然后分阶段构建完整的 HTML/CSS 还原。支持快速还原和高精度还原两种模式。
  当用户需要克隆、复刻、还原、仿制网页时使用此技能。
  当用户提供 URL 并要求"做一个一样的页面"、"把这个页面克隆过来"、
  "参考这个网站的设计"、"还原这个页面"时，务必使用此技能。
---

# 克隆网页

使用 Playwright 渐进式采集页面数据，然后分阶段还原 HTML/CSS。

**前置条件：** Node.js >= 18（Playwright + Chromium 首次运行自动安装）

## 采集脚本

从技能目录下的 `scripts/` 运行：

```bash
node scripts/clone.mjs <url> <command> [options]
```

## 两种还原模式

### 🚀 快速还原（推荐先用这个）

适合快速出原型，token 消耗少，几分钟完成。

**采集：**
```bash
node scripts/clone.mjs <url> quick -o ./clone-data --scroll
```

**数据源优先级：**
1. ⭐⭐⭐⭐⭐ `screenshot.png` — 视觉真相，以它为准
2. ⭐⭐⭐⭐ `theme.json` — 颜色、字体、间距等设计令牌
3. ⭐⭐⭐ `skeleton.json` — DOM 骨架（了解层级和语义标签）

**还原步骤：**

1. 看 `screenshot.png`，理解页面整体布局
2. 读 `theme.json`，提取关键设计令牌（主色、字体、间距、圆角、阴影）
3. 粗读 `skeleton.json --depth=2`，了解大的 section 划分
4. 按 header → main → footer 的顺序，参照截图逐 section 写 HTML/CSS
5. 使用 theme.json 中的值作为 CSS 变量

```bash
# 渐进式读取数据
node scripts/query.mjs ./clone-data summary
node scripts/query.mjs ./clone-data skeleton --depth=2
```

---

### 🎨 高精度还原

适合生产环境，还原到像素级别。在快速还原的基础上追加采集。

**采集：**
```bash
# 先执行 quick（如果还没有）
node scripts/clone.mjs <url> quick -o ./clone-data --scroll

# 然后逐 section 深入采集样式
node scripts/clone.mjs <url> styles -o ./clone-data --selector "header"
node scripts/clone.mjs <url> styles -o ./clone-data --selector "main > section:nth-child(1)"
node scripts/clone.mjs <url> styles -o ./clone-data --selector "main > section:nth-child(2)"
node scripts/clone.mjs <url> styles -o ./clone-data --selector "footer"

# 需要时：交互态
node scripts/clone.mjs <url> interact -o ./clone-data --hover "nav a:first-child"

# 需要时：响应式截图
node scripts/clone.mjs <url> responsive -o ./clone-data

# 最后：下载资源
node scripts/clone.mjs <url> assets -o ./clone-data
```

**数据源优先级：**
1. ⭐⭐⭐⭐⭐ `screenshot.png` — 还是以截图为准
2. ⭐⭐⭐⭐⭐ `sections/*/nodes.json` — 精确的 DOM 结构 + selector
3. ⭐⭐⭐⭐⭐ `sections/*/styles.json` — 完整的 computedStyle
4. ⭐⭐⭐⭐ `theme.json` — 设计令牌
5. ⭐⭐⭐ `sections/*/screenshot.png` — 单 section 截图对比

**还原步骤：**

1. 同快速还原 Step 1-3
2. 查看已采集的 section 列表：
   ```bash
   node scripts/query.mjs ./clone-data sections
   ```
3. 逐 section 还原：
   ```bash
   # 查看 section 的完整数据（DOM + 样式）
   node scripts/query.mjs ./clone-data section header
   ```
   - 按 `nodes.json` 中的 `children` 严格构建层级
   - 按 `styles.json` 中的 `styleId` 应用精确样式
   - 对比 `screenshot.png` 微调
4. 如果 section 样式不够精确，可以进一步缩小 selector 范围重新采集
5. 如果需要 hover/focus 态，使用 `interact` 命令采集
6. 使用 `assets/` 目录中的图片和字体

---

## 采集命令速查

| 命令 | 用途 | 产出 |
|------|------|------|
| `quick` | 快速模式 = init + skeleton | screenshot + meta + theme + skeleton |
| `full` | 全量模式 = init + skeleton + responsive + assets | 上述 + 响应式截图 + 资源 |
| `init` | 截图 + 元信息 + 设计令牌 | screenshot.png, meta.json, theme.json |
| `skeleton` | DOM 骨架（不含样式） | skeleton.json |
| `styles --selector "X"` | 指定区域的完整样式 | sections/X/nodes.json + styles.json + screenshot.png |
| `interact` | 交互态截图 | interactions/*.png + *-styles.json |
| `responsive` | 多 viewport 截图 | responsive/*.png |
| `assets` | 下载图片/字体/SVG | assets/ |

## 查询命令速查

```bash
node scripts/query.mjs <dir> summary                  # 概览
node scripts/query.mjs <dir> skeleton --depth=2        # 骨架（前 2 层）
node scripts/query.mjs <dir> subtree n2 --depth=3      # 某节点子树
node scripts/query.mjs <dir> node n15                  # 单节点（含已采集样式）
node scripts/query.mjs <dir> sections                  # 已采集的 section 列表
node scripts/query.mjs <dir> section header            # 某 section 的完整数据
node scripts/query.mjs <dir> find --tag=button         # 按标签查找
node scripts/query.mjs <dir> find --text="登录"        # 按文本查找
node scripts/query.mjs <dir> find --interactive        # 交互元素
node scripts/query.mjs <dir> file theme.json           # 读取任意文件
```

## 产出目录结构

```
clone-data/
├── meta.json              # 元信息（url, title, phases, sections）
├── screenshot.png         # 全页截图
├── theme.json             # 设计令牌
├── skeleton.json          # DOM 骨架树（含 selector）
│
├── sections/              # 按 section 的样式（逐步追加）
│   ├── header/
│   │   ├── nodes.json     # DOM + selector + bbox + styleId
│   │   ├── styles.json    # computedStyle 去重池
│   │   └── screenshot.png
│   └── main-section-nth-child-1/
│       └── ...
│
├── interactions/           # 交互态数据
│   ├── hover-nav-a.png
│   └── hover-nav-a-styles.json
│
├── responsive/             # 多视口截图
│   ├── desktop.png
│   ├── tablet.png
│   └── mobile.png
│
└── assets/                 # 下载的资源
    ├── images/
    ├── fonts/
    ├── svgs/
    └── manifest.json
```

## 需要登录的页面

```bash
# 方法 1: 连接已登录的 Chrome（推荐）
# 先启动 Chrome:
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --remote-debugging-port=9222
# 在 Chrome 中登录后运行:
node scripts/clone.mjs https://internal.site.com quick --connect-cdp http://localhost:9222

# 方法 2: 显示浏览器窗口手动登录
node scripts/clone.mjs https://internal.site.com quick --no-headless
```

## 提示

- **截图是最终真相** — 如果数据与截图冲突，以截图为准
- **渐进式采集** — 不需要一次 full，先 quick 看效果，再按需 styles
- **selector 是桥梁** — skeleton.json 中每个节点都有 CSS selector，用于后续精确定位
- **每个 Phase 独立** — 数据增量追加，不会覆盖已有内容
- **先粗后细** — 快速还原出大框架 → 对比截图 → 精细调整
