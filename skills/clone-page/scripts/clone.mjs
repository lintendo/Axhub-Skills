#!/usr/bin/env node
/**
 * clone.mjs — 渐进式页面克隆 CLI
 *
 * 子命令模式，每个 Phase 独立运行，数据增量追加到同一输出目录。
 *
 * Usage:
 *   node clone.mjs <url> <command> [options]
 *
 * Commands:
 *   init        Phase 1: 截图 + 元信息 + 设计令牌
 *   skeleton    Phase 2: DOM 骨架树（不含样式）
 *   styles      Phase 3: 指定 section 的完整样式
 *   interact    Phase 4: 交互态截图（hover/click/scroll）
 *   responsive  Phase 5: 多 viewport 截图
 *   assets      Phase 6: 下载图片/字体/SVG
 *   quick       快速模式: init + skeleton（适合快速还原）
 *   full        全量模式: 所有 Phase（适合高精度还原）
 */

import * as path from 'node:path';
import {
  ensureDependencies,
  isPlaywrightAvailable,
  loadPlaywright,
  openPage,
  closeBrowser,
} from './lib/browser.mjs';

import { runInit } from './lib/init.mjs';
import { runSkeleton } from './lib/skeleton.mjs';
import { runSectionStyles } from './lib/section-styles.mjs';
import { runInteract } from './lib/interact.mjs';
import { runResponsive } from './lib/responsive.mjs';
import { runAssets } from './lib/assets.mjs';

// ── CLI argument parsing ─────────────────────────────────────
function parseArgs(argv) {
  const args = {
    url: null,
    command: null,
    output: './clone-data',
    selector: null,
    viewport: { width: 1440, height: 900 },
    wait: 0,
    scroll: false,
    headless: true,
    connectCdp: null,
    verbose: false,
    help: false,
    // interact options
    hover: null,
    click: null,
    scrollTo: null,
    // responsive options
    viewports: null,
    // assets options
    maxImages: 50,
    maxFonts: 10,
  };

  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--help' || a === '-h') args.help = true;
    else if (a === '-o' || a === '--output') args.output = argv[++i];
    else if (a === '--selector') args.selector = argv[++i];
    else if (a === '--viewport') {
      const [w, h] = (argv[++i] || '1440x900').split('x').map(Number);
      args.viewport = { width: w || 1440, height: h || 900 };
    }
    else if (a === '--wait') args.wait = parseInt(argv[++i]) || 0;
    else if (a === '--scroll') args.scroll = true;
    else if (a === '--no-headless') args.headless = false;
    else if (a === '--connect-cdp') args.connectCdp = argv[++i];
    else if (a === '--verbose') args.verbose = true;
    else if (a === '--hover') args.hover = argv[++i];
    else if (a === '--click') args.click = argv[++i];
    else if (a === '--scroll-to') args.scrollTo = argv[++i];
    else if (a === '--viewports') args.viewports = argv[++i];
    else if (a === '--max-images') args.maxImages = parseInt(argv[++i]) || 50;
    else if (a === '--max-fonts') args.maxFonts = parseInt(argv[++i]) || 10;
    else if (!a.startsWith('-')) {
      if (!args.url) args.url = a;
      else if (!args.command) args.command = a;
    }
  }

  return args;
}

function showHelp() {
  console.log(`
渐进式页面克隆工具

Usage:
  node clone.mjs <url> <command> [options]

Commands:
  init        截图 + 元信息 + 设计令牌
  skeleton    DOM 骨架树（不含样式）
  styles      指定 section 的完整样式（需 --selector）
  interact    交互态截图（需 --hover / --click / --scroll-to）
  responsive  多 viewport 截图
  assets      下载图片/字体/SVG
  quick       快速模式 = init + skeleton
  full        全量模式 = init + skeleton + responsive + assets

Options:
  -o, --output DIR        输出目录 (默认: ./clone-data)
  --selector SEL          CSS selector（styles 命令必需）
  --viewport WxH          视口大小 (默认: 1440x900)
  --wait MS               页面加载后等待 (默认: 0)
  --scroll                滚动页面触发懒加载
  --no-headless           显示浏览器窗口
  --connect-cdp URL       连接已登录的 Chrome
  --verbose               详细输出

interact 选项:
  --hover SEL             hover 到指定元素
  --click SEL             点击指定元素
  --scroll-to PX          滚动到指定位置

responsive 选项:
  --viewports W1,W2,W3    视口宽度列表 (默认: 1440,768,390)

assets 选项:
  --max-images N          最大下载图片数 (默认: 50)
  --max-fonts N           最大下载字体数 (默认: 10)

Examples:
  # 快速概览
  node clone.mjs https://example.com quick

  # 高精度全量采集
  node clone.mjs https://example.com full --scroll

  # 按 section 深入
  node clone.mjs https://example.com styles --selector "header"
  node clone.mjs https://example.com styles --selector "main > section:nth-child(1)"

  # 交互态采集
  node clone.mjs https://example.com interact --hover "nav a:first-child"

  # 多视口截图
  node clone.mjs https://example.com responsive --viewports 1440,768,390

  # 已登录页面
  node clone.mjs https://internal.site.com quick --connect-cdp http://localhost:9222
`);
}

// ── Main ─────────────────────────────────────────────────────
async function main() {
  const args = parseArgs(process.argv);
  if (args.help) { showHelp(); process.exit(0); }
  if (!args.url) { console.error('❌ URL 必需'); showHelp(); process.exit(1); }
  if (!args.command) { console.error('❌ 命令必需（init / skeleton / styles / quick / full）'); showHelp(); process.exit(1); }

  const outputDir = path.resolve(args.output);
  console.log('🚀 页面克隆');
  console.log(`   URL: ${args.url}`);
  console.log(`   命令: ${args.command}`);
  console.log(`   输出: ${outputDir}`);

  // 安装 Playwright
  await ensureDependencies();
  if (!isPlaywrightAvailable()) {
    console.error('❌ Playwright 不可用');
    process.exit(1);
  }

  const playwright = await loadPlaywright();
  if (!playwright) {
    console.error('❌ Playwright 加载失败');
    process.exit(1);
  }

  // 打开页面
  console.log('\n🌐 打开页面…');
  const { page, context } = await openPage(playwright, args.url, {
    headless: args.headless,
    connectCdp: args.connectCdp,
    viewport: args.viewport,
    waitMs: args.wait,
  });

  const title = await page.title();
  console.log(`   ✅ "${title}"\n`);

  try {
    switch (args.command) {
      case 'init':
        await runInit(page, outputDir, { viewport: args.viewport, scroll: args.scroll });
        break;

      case 'skeleton':
        await runSkeleton(page, outputDir, { rootSelector: args.selector });
        break;

      case 'styles':
        if (!args.selector) {
          console.error('❌ styles 命令需要 --selector 参数');
          process.exit(1);
        }
        await runSectionStyles(page, outputDir, { selector: args.selector });
        break;

      case 'interact':
        await runInteract(page, outputDir, {
          hover: args.hover,
          click: args.click,
          scroll: args.scrollTo,
        });
        break;

      case 'responsive':
        await runResponsive(page, outputDir, { viewports: args.viewports });
        break;

      case 'assets':
        await runAssets(page, outputDir, { maxImages: args.maxImages, maxFonts: args.maxFonts });
        break;

      case 'quick':
        console.log('── Phase 1: Init ──');
        await runInit(page, outputDir, { viewport: args.viewport, scroll: args.scroll });
        console.log('\n── Phase 2: Skeleton ──');
        await runSkeleton(page, outputDir, { rootSelector: args.selector });
        break;

      case 'full':
        console.log('── Phase 1: Init ──');
        await runInit(page, outputDir, { viewport: args.viewport, scroll: args.scroll });
        console.log('\n── Phase 2: Skeleton ──');
        await runSkeleton(page, outputDir, { rootSelector: args.selector });
        console.log('\n── Phase 5: Responsive ──');
        await runResponsive(page, outputDir, { viewports: args.viewports });
        console.log('\n── Phase 6: Assets ──');
        await runAssets(page, outputDir, { maxImages: args.maxImages, maxFonts: args.maxFonts });
        break;

      default:
        console.error(`❌ 未知命令: ${args.command}`);
        showHelp();
        process.exit(1);
    }
  } finally {
    await context.close();
  }

  await closeBrowser();
  console.log(`\n${'═'.repeat(50)}`);
  console.log(`✅ 完成！输出目录: ${outputDir}`);
}

main().catch((e) => {
  console.error('❌ 致命错误:', e);
  closeBrowser().then(() => process.exit(1));
});
