#!/usr/bin/env node
/**
 * extract-axure-data.mjs
 *
 * 从 Axure 原型提取结构化数据。
 * 跨平台支持：macOS / Windows / Linux
 * 零构建依赖：直接用 node 运行
 *
 * 用法:
 *   node extract-axure-data.mjs <url> [options]
 */

import * as vm from 'node:vm';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================================================
// Phase 0: 环境检查 & 自动安装（跨平台）
// ============================================================================

/**
 * 获取 Playwright 安装目录（跨平台）
 */
function getRunnerDir() {
  const home = os.homedir();
  return path.join(home, '.cache', 'axure-extractor');
}

const RUNNER_DIR = getRunnerDir();

async function ensureDependencies() {
  const pkgPath = path.join(RUNNER_DIR, 'node_modules', 'playwright');
  if (fs.existsSync(pkgPath)) return;

  console.log('📦 首次运行，正在安装 Playwright (约 1-2 分钟)...');
  fs.mkdirSync(RUNNER_DIR, { recursive: true });
  fs.writeFileSync(
    path.join(RUNNER_DIR, 'package.json'),
    JSON.stringify({ type: 'module', private: true }, null, 2),
  );

  const env = {
    ...process.env,
    PLAYWRIGHT_DOWNLOAD_HOST:
      process.env.PLAYWRIGHT_DOWNLOAD_HOST || 'https://npmmirror.com/mirrors/playwright',
  };

  // npm 命令在 Windows 上是 npm.cmd
  const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const npxCmd = process.platform === 'win32' ? 'npx.cmd' : 'npx';

  try {
    execSync(`${npmCmd} install playwright`, { cwd: RUNNER_DIR, stdio: 'inherit', env });
  } catch {
    console.error('❌ npm install 失败，尝试 --prefix 方式...');
    try {
      execSync(`${npmCmd} install playwright --prefix "${RUNNER_DIR}"`, { stdio: 'inherit', env });
    } catch {
      console.error('❌ Playwright 安装失败。将降级为纯 HTTP 模式（无截图、无主题提取）。');
      console.error('   手动安装:');
      console.error(`   cd "${RUNNER_DIR}"`);
      console.error(`   ${npmCmd} install playwright`);
      console.error(`   ${npxCmd} playwright install chromium`);
      return;
    }
  }

  console.log('🌐 正在安装 Chromium...');
  try {
    execSync(`${npxCmd} playwright install chromium`, { cwd: RUNNER_DIR, stdio: 'inherit', env });
  } catch {
    console.warn('⚠️  Chromium 安装失败，将尝试使用系统浏览器。');
  }

  console.log('✅ Playwright + Chromium 安装完成。');
}

function isPlaywrightAvailable() {
  return fs.existsSync(path.join(RUNNER_DIR, 'node_modules', 'playwright'));
}

async function loadPlaywright() {
  const pwPath = path.join(RUNNER_DIR, 'node_modules', 'playwright', 'index.mjs');
  if (!fs.existsSync(pwPath)) return null;
  return import(pwPath);
}

// ============================================================================
// 纯 Node.js 解析层（不依赖浏览器）
// ============================================================================

/**
 * 在 vm 沙箱中执行 Axure 的 data.js / document.js
 */
function evaluateAxureCode(jsCode) {
  const result = {};
  const sandbox = {
    $axure: {
      loadDocument(fn) {
        const data = typeof fn === 'function' ? fn() : fn;
        Object.assign(result, data);
      },
      loadCurrentPage(fn) {
        const data = typeof fn === 'function' ? fn() : fn;
        result.page = data;
      },
    },
    console: { log() {}, warn() {}, error() {} },
  };
  vm.createContext(sandbox);
  vm.runInContext(jsCode, sandbox, { timeout: 5000 });
  return result;
}

async function fetchText(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${url}`);
  return response.text();
}

async function extractSitemap(baseUrl) {
  const jsCode = await fetchText(new URL('data/document.js', baseUrl).href);
  const axure = evaluateAxureCode(jsCode);
  const sitemap = axure.sitemap?.rootNodes || [];
  const logo = axure.configuration?.logoImagePath || '';

  const pages = [];
  function walk(nodes) {
    if (!nodes) return;
    for (const node of nodes) {
      if (node.children) walk(node.children);
      if (node.type !== 'Folder') pages.push(node);
    }
  }
  walk(sitemap);
  return { sitemap, pages, logo };
}

async function extractPageData(baseUrl, pageName) {
  const jsCode = await fetchText(new URL(`files/${pageName}/data.js`, baseUrl).href);
  const axure = evaluateAxureCode(jsCode);
  if (!axure.page) throw new Error(`解析 ${pageName}/data.js 失败: page 为空`);

  const imageRegex = /"images\/[^/]+\/[^,]+."/gi;
  const images = (jsCode.match(imageRegex) || [])
    .map((m) => m.replace(/"/g, ''))
    .filter((img) => !/\.(png|jpg|jpeg|gif|svg|webp)-/.test(img));

  return {
    pageId: axure.page.packageId,
    pageName,
    diagram: axure.page.diagram,
    interactionMap: axure.page.interactionMap,
    pageNotes: axure.page.notes,
    widgetNotes: axure.page.annotations,
    objectPaths: axure.objectPaths,
    generationDate: axure.generationDate,
    url: axure.url,
    jsImages: images,
  };
}

function extractNotes(pageData) {
  const notes = {};
  const idMap = new Map();

  if (pageData.objectPaths) {
    for (const [id, pd] of Object.entries(pageData.objectPaths)) {
      if (pd?.scriptId && pd.scriptId !== id) idMap.set(id, pd.scriptId);
    }
  }
  const opt = (id) => idMap.get(id) || id;

  if (pageData.pageNotes && typeof pageData.pageNotes === 'object') {
    notes['page'] = pageData.pageNotes;
  }
  if (Array.isArray(pageData.widgetNotes)) {
    for (const w of pageData.widgetNotes) {
      if (!w.ownerId) continue;
      const cleaned = {};
      for (const [k, v] of Object.entries(w)) {
        if (!['fn', 'ownerId', 'label'].includes(k)) cleaned[k] = v;
      }
      notes[`id-${opt(w.ownerId)}`] = cleaned;
    }
  } else if (pageData.diagram?.objects) {
    (function walkObj(objs) {
      for (const o of objs) {
        if (o.annotation) notes[`id-${opt(o.id)}`] = o.annotation;
        if (Array.isArray(o.objs)) walkObj(o.objs);
      }
    })(pageData.diagram.objects);
  }
  return notes;
}

/**
 * 下载 Axure 页面引用的图片资源
 */
async function downloadImages(baseUrl, pageName, images, outputDir) {
  const imagesDir = path.join(outputDir, 'images');
  fs.mkdirSync(imagesDir, { recursive: true });
  let downloaded = 0;
  for (const imgPath of images) {
    try {
      const imgUrl = new URL(`files/${pageName}/${imgPath}`, baseUrl).href;
      const res = await fetch(imgUrl);
      if (!res.ok) continue;
      const buffer = Buffer.from(await res.arrayBuffer());
      const filename = path.basename(imgPath);
      fs.writeFileSync(path.join(imagesDir, filename), buffer);
      downloaded++;
    } catch { /* skip broken images */ }
  }
  return downloaded;
}

// ============================================================================
// Playwright 浏览器操作层
// ============================================================================

let _browser = null;

async function getBrowser(playwright, options = {}) {
  if (_browser) return _browser;
  const { headless = true, connectCdp } = options;

  if (connectCdp) {
    console.log(`🔗 连接到 Chrome: ${connectCdp}`);
    _browser = await playwright.chromium.connectOverCDP(connectCdp);
  } else {
    _browser = await playwright.chromium.launch({
      headless,
      args: ['--allow-file-access-from-files', '--disable-web-security'],
    });
  }
  return _browser;
}

async function closeBrowser() {
  if (_browser) { await _browser.close().catch(() => {}); _browser = null; }
}

async function captureScreenshot(playwright, baseUrl, pageName, outputPath, options = {}) {
  const browser = await getBrowser(playwright, options);
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();
  try {
    const pageUrl = pageName ? `${baseUrl}start.html#p=${pageName}` : baseUrl;
    await page.goto(pageUrl, { waitUntil: 'networkidle', timeout: 30000 });
    const mainFrame = page.frame('mainFrame');
    if (mainFrame) {
      await mainFrame.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(1500);
      const el = await page.$('#mainFrame');
      if (el) { await el.screenshot({ path: outputPath, type: 'png' }); return outputPath; }
    }
    await page.screenshot({ path: outputPath, fullPage: true, type: 'png' });
    return outputPath;
  } finally { await context.close(); }
}

async function extractThemeTokens(playwright, baseUrl, pageName, options = {}) {
  const browser = await getBrowser(playwright, options);
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();
  try {
    const pageUrl = pageName ? `${baseUrl}start.html#p=${pageName}` : baseUrl;
    await page.goto(pageUrl, { waitUntil: 'networkidle', timeout: 30000 });
    const mainFrame = page.frame('mainFrame');
    const target = mainFrame || page;
    if (mainFrame) { await mainFrame.waitForLoadState('domcontentloaded'); await page.waitForTimeout(1000); }

    return await target.evaluate(() => {
      const bucket = () => new Map();
      const add = (b, v, t) => { if (!v) return; if (!b.has(v)) b.set(v, { count: 0, tags: new Set() }); const i = b.get(v); i.count++; if (t) i.tags.add(t); };
      const clear = (v) => { if (!v) return false; const l = v.trim().toLowerCase(); return l === 'transparent' || l === 'rgba(0, 0, 0, 0)' || l === 'rgba(0,0,0,0)'; };
      const zero = (v) => { if (!v) return false; const t = v.trim(); return t === '0' || t === '0px'; };

      const colors = { bg: bucket(), text: bucket(), border: bucket() };
      const typo = { family: bucket(), style: bucket() };
      const spacing = bucket(), radius = bucket();

      const w = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT);
      let el = w.currentNode;
      while (el) {
        const tag = el.tagName?.toLowerCase() || '';
        const s = getComputedStyle(el);
        if (s.backgroundColor && !clear(s.backgroundColor)) add(colors.bg, s.backgroundColor, tag);
        if (s.color && !clear(s.color)) add(colors.text, s.color, tag);
        if (s.borderColor && !clear(s.borderColor)) add(colors.border, s.borderColor, tag);
        add(typo.family, s.fontFamily, tag);
        if (s.fontSize && s.fontWeight && s.lineHeight) add(typo.style, `${s.fontSize}|${s.lineHeight}|${s.fontWeight}`, tag);
        if (s.margin && !zero(s.margin)) add(spacing, s.margin, tag);
        if (s.padding && !zero(s.padding)) add(spacing, s.padding, tag);
        if (s.borderRadius && !zero(s.borderRadius)) add(radius, s.borderRadius, tag);
        el = w.nextNode();
      }

      const sort = (b) => [...b.entries()].sort((a, b) => b[1].count - a[1].count).slice(0, 10)
        .map(([v, { count, tags }]) => ({ value: v, count, tags: [...tags] }));
      return {
        colors: { background: sort(colors.bg), text: sort(colors.text), border: sort(colors.border) },
        typography: {
          families: sort(typo.family),
          textStyles: sort(typo.style).map(({ value, count, tags }) => { const [size, lineHeight, weight] = value.split('|'); return { size, lineHeight, weight, count, tags }; }),
        },
        spacing: sort(spacing), radius: sort(radius),
      };
    });
  } finally { await context.close(); }
}

async function extractMarkdown(playwright, baseUrl, pageName, options = {}) {
  const browser = await getBrowser(playwright, options);
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();
  try {
    const pageUrl = pageName ? `${baseUrl}start.html#p=${pageName}` : baseUrl;
    await page.goto(pageUrl, { waitUntil: 'networkidle', timeout: 30000 });
    const mainFrame = page.frame('mainFrame');
    if (!mainFrame) return await page.evaluate(() => document.body?.innerText || '');
    await mainFrame.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1000);

    return await mainFrame.evaluate(() => {
      function toMd(el) {
        const lines = [];
        for (const child of el.childNodes) {
          if (child.nodeType === Node.TEXT_NODE) { const t = child.textContent?.trim(); if (t) lines.push(t); }
          else if (child.nodeType === Node.ELEMENT_NODE) {
            const tag = child.tagName?.toLowerCase();
            const s = getComputedStyle(child);
            if (s.display === 'none' || s.visibility === 'hidden') continue;
            if (['script', 'style', 'noscript'].includes(tag)) continue;
            const text = child.innerText?.trim(); if (!text) continue;
            const fs = parseFloat(s.fontSize);
            const fw = parseInt(s.fontWeight) || (s.fontWeight === 'bold' ? 700 : 400);
            if (fs >= 24 && fw >= 600) lines.push(`\n## ${text}\n`);
            else if (fs >= 18 && fw >= 600) lines.push(`\n### ${text}\n`);
            else if (child.children.length === 0) lines.push(text);
            else { const sub = toMd(child); if (sub) lines.push(sub); }
          }
        }
        return lines.join('\n');
      }
      return toMd(document.body);
    });
  } finally { await context.close(); }
}

// ============================================================================
// CLI
// ============================================================================

function parseArgs(argv) {
  const args = {
    url: null, output: './axure-export', pages: [], all: false,
    advanced: false, screenshot: true, headless: true,
    connectCdp: null, verbose: false, help: false,
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--help' || a === '-h') args.help = true;
    else if (a === '-o' || a === '--output') args.output = argv[++i];
    else if (a === '--pages') args.pages = argv[++i]?.split(',').map(s => s.trim()) || [];
    else if (a === '--all') args.all = true;
    else if (a === '--advanced') args.advanced = true;
    else if (a === '--no-screenshot') args.screenshot = false;
    else if (a === '--no-headless') args.headless = false;
    else if (a === '--connect-cdp') args.connectCdp = argv[++i];
    else if (a === '--verbose') args.verbose = true;
    else if (!a.startsWith('-') && !args.url) args.url = a;
  }
  return args;
}

/**
 * 获取启动 Chrome 调试端口的命令（跨平台）
 */
function getChromeDebugCommand() {
  switch (process.platform) {
    case 'darwin':
      return '/Applications/Google\\ Chrome.app/Contents/MacOS/Google\\ Chrome --remote-debugging-port=9222';
    case 'win32':
      return 'start chrome --remote-debugging-port=9222';
    default:
      return 'google-chrome --remote-debugging-port=9222';
  }
}

function showHelp() {
  console.log(`
Axure 原型数据提取工具

用法:
  node extract-axure-data.mjs <url> [options]

数据级别:
  (默认)       截图 + 设计主题 Token
  --advanced   追加交互数据、组件标注、页面文本

选项:
  -o, --output DIR    输出目录 (默认: ./axure-export)
  --pages P1,P2       只提取指定页面 (逗号分隔)
  --all               提取全部页面
  --advanced          追加提取交互、标注、文本
  --no-screenshot     跳过截图
  --no-headless       显示浏览器窗口
  --connect-cdp URL   连接已运行的 Chrome (复用登录态)
  --verbose           详细日志
  -h, --help          显示帮助

示例:
  # 提取截图 + 主题
  node extract-axure-data.mjs http://localhost:8080/ --all

  # 提取所有数据
  node extract-axure-data.mjs http://localhost:8080/ --all --advanced

  # 连接已登录的 Chrome
  # 先启动 Chrome: ${getChromeDebugCommand()}
  node extract-axure-data.mjs https://example.com/axure --connect-cdp http://localhost:9222
`);
}

function normalizeBaseUrl(url) {
  try {
    const u = new URL(url);
    if (u.pathname.endsWith('.html')) u.pathname = u.pathname.replace(/\/[^/]+\.html$/, '/');
    if (!u.pathname.endsWith('/')) u.pathname += '/';
    u.hash = '';
    return u.href;
  } catch { return url.endsWith('/') ? url : url + '/'; }
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.help) { showHelp(); process.exit(0); }
  if (!args.url) { console.error('❌ 请提供 Axure 原型 URL'); showHelp(); process.exit(1); }

  const baseUrl = normalizeBaseUrl(args.url);
  const outputDir = path.resolve(args.output);
  const log = args.verbose ? console.log.bind(console) : () => {};
  const mode = args.advanced ? '高级' : '初级';

  console.log(`🚀 Axure 数据提取 (${mode}转化)`);
  console.log(`   URL: ${baseUrl}`);
  console.log(`   输出: ${outputDir}`);

  await ensureDependencies();
  let playwright = null;
  if (isPlaywrightAvailable()) {
    playwright = await loadPlaywright();
    log('✅ Playwright 已加载');
  } else {
    console.warn('⚠️  Playwright 不可用，将跳过截图和主题提取');
  }

  fs.mkdirSync(outputDir, { recursive: true });

  // ── Sitemap（纯 Node.js）───────────────────────────
  console.log('\n📄 提取 Sitemap...');
  let sitemapData;
  try {
    sitemapData = await extractSitemap(baseUrl);
    fs.writeFileSync(path.join(outputDir, 'sitemap.json'), JSON.stringify(sitemapData, null, 2));
    console.log(`   ✅ ${sitemapData.pages.length} 个页面 → sitemap.json`);
  } catch (e) {
    console.error(`   ❌ Sitemap 提取失败: ${e.message}`);
    process.exit(1);
  }

  // 页面列表
  let pagesToProcess = [];
  if (args.all) pagesToProcess = sitemapData.pages;
  else if (args.pages.length > 0) {
    pagesToProcess = sitemapData.pages.filter(p => {
      const name = (p.pageName || p.url || '').replace('.html', '');
      return args.pages.includes(name);
    });
  } else if (sitemapData.pages.length > 0) {
    pagesToProcess = [sitemapData.pages[0]];
  }

  if (pagesToProcess.length === 0) { console.log('   ⚠️  没有要处理的页面'); process.exit(0); }

  console.log(`\n📑 ${mode}转化: ${pagesToProcess.length} 个页面\n`);

  const browserOpts = { headless: args.headless, connectCdp: args.connectCdp };

  for (const pg of pagesToProcess) {
    const pageName = (pg.url || pg.pageName || '').replace('.html', '');
    const pageDir = path.join(outputDir, 'pages', pageName);
    fs.mkdirSync(pageDir, { recursive: true });

    console.log(`📖 ${pageName}`);

    // ── 截图 + 主题（默认） ──────────────────────────
    if (playwright) {
      if (args.screenshot) {
        try {
          await captureScreenshot(playwright, baseUrl, pageName, path.join(pageDir, 'screenshot.png'), browserOpts);
          console.log(`   ✅ 截图 → screenshot.png`);
        } catch (e) { console.error(`   ❌ 截图失败: ${e.message}`); }
      }
      try {
        const tokens = await extractThemeTokens(playwright, baseUrl, pageName, browserOpts);
        fs.writeFileSync(path.join(pageDir, 'theme.json'), JSON.stringify(tokens, null, 2));
        console.log(`   ✅ 主题 → theme.json`);
      } catch (e) { console.error(`   ❌ 主题提取失败: ${e.message}`); }
    } else {
      console.log(`   ⏭️  跳过截图和主题（Playwright 不可用）`);
    }

    // ── 交互 + 标注 + 文本（--advanced） ─────────────
    if (args.advanced) {
      try {
        const pageData = await extractPageData(baseUrl, pageName);
        fs.writeFileSync(path.join(pageDir, 'data.json'), JSON.stringify(pageData, null, 2));
        log(`   ✅ 页面数据 → data.json`);

        const notes = extractNotes(pageData);
        if (Object.keys(notes).length > 0) {
          fs.writeFileSync(path.join(pageDir, 'notes.json'), JSON.stringify(notes, null, 2));
          console.log(`   ✅ 标注 → notes.json (${Object.keys(notes).length} 条)`);
        }
        if (pageData.interactionMap) {
          fs.writeFileSync(path.join(pageDir, 'interactions.json'), JSON.stringify(pageData.interactionMap, null, 2));
          console.log(`   ✅ 交互 → interactions.json`);
        }
      } catch (e) { console.error(`   ❌ 页面数据提取失败: ${e.message}`); }

      // 下载引用的图片
      if (pageData?.jsImages?.length > 0) {
        try {
          const count = await downloadImages(baseUrl, pageName, pageData.jsImages, pageDir);
          if (count > 0) console.log(`   ✅ 图片 → images/ (${count} 个)`);
        } catch (e) { console.error(`   ❌ 图片下载失败: ${e.message}`); }
      }

      if (playwright) {
        try {
          const md = await extractMarkdown(playwright, baseUrl, pageName, browserOpts);
          if (md) {
            fs.writeFileSync(path.join(pageDir, 'content.md'), md);
            console.log(`   ✅ 文本 → content.md (${md.length} 字符)`);
          }
        } catch (e) { console.error(`   ❌ 文本提取失败: ${e.message}`); }
      }
    }
  }

  await closeBrowser();

  console.log(`\n${'═'.repeat(50)}`);
  console.log(`✅ ${mode}转化完成！`);
  console.log(`   输出目录: ${outputDir}`);

  if (!args.advanced) {
    console.log(`\n💡 已提取截图和设计主题。`);
    console.log(`   如需追加交互和标注数据，添加 --advanced 参数重新运行。`);
  }
}

main().catch((e) => {
  console.error('❌ 致命错误:', e);
  closeBrowser().then(() => process.exit(1));
});
