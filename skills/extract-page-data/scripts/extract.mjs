#!/usr/bin/env node
/**
 * extract.mjs — Main CLI for extract-page-data skill
 *
 * Extract structured data from any web page using Playwright.
 * Supports: screenshots, design tokens, Markdown, links, data packs.
 *
 * Usage:
 *   node extract.mjs <url> [options]
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ── Imports (lazy: these depend on Playwright being installed) ──
import {
  ensureDependencies,
  isPlaywrightAvailable,
  loadPlaywright,
  openPage,
  closeBrowser,
} from './lib/browser.mjs';

import { captureScreenshot } from './lib/screenshot.mjs';
import { extractTheme } from './lib/theme.mjs';
import { extractMarkdown } from './lib/markdown.mjs';
import { collectLinks } from './lib/links.mjs';
import { createDataPack } from './lib/pack.mjs';

// ── CLI argument parsing ─────────────────────────────────────
function parseArgs(argv) {
  const args = {
    url: null,
    output: './page-export',
    selector: null,
    screenshot: false,
    theme: false,
    markdown: false,
    links: false,
    pack: false,
    all: false,
    viewport: { width: 1280, height: 720 },
    wait: 0,
    scroll: false,
    scrollStep: 800,
    scrollDelay: 200,
    headless: true,
    connectCdp: null,
    format: 'png',
    verbose: false,
    help: false,
  };

  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--help' || a === '-h') args.help = true;
    else if (a === '-o' || a === '--output') args.output = argv[++i];
    else if (a === '--selector') args.selector = argv[++i];
    else if (a === '--screenshot') args.screenshot = true;
    else if (a === '--theme') args.theme = true;
    else if (a === '--markdown') args.markdown = true;
    else if (a === '--links') args.links = true;
    else if (a === '--pack') args.pack = true;
    else if (a === '--all') args.all = true;
    else if (a === '--viewport') {
      const [w, h] = (argv[++i] || '1280x720').split('x').map(Number);
      args.viewport = { width: w || 1280, height: h || 720 };
    }
    else if (a === '--wait') args.wait = parseInt(argv[++i]) || 0;
    else if (a === '--scroll') args.scroll = true;
    else if (a === '--scroll-step') args.scrollStep = parseInt(argv[++i]) || 800;
    else if (a === '--scroll-delay') args.scrollDelay = parseInt(argv[++i]) || 200;
    else if (a === '--no-headless') args.headless = false;
    else if (a === '--connect-cdp') args.connectCdp = argv[++i];
    else if (a === '--format') args.format = argv[++i] === 'jpeg' ? 'jpeg' : 'png';
    else if (a === '--verbose') args.verbose = true;
    else if (!a.startsWith('-') && !args.url) args.url = a;
  }

  // --all enables everything
  if (args.all) {
    args.screenshot = true;
    args.theme = true;
    args.markdown = true;
    args.links = true;
  }

  // --pack implies full extraction
  if (args.pack) {
    args.screenshot = true;
    args.theme = true;
    args.markdown = true;
    args.links = true;
  }

  // If nothing specified, default to screenshot + theme
  if (!args.screenshot && !args.theme && !args.markdown && !args.links && !args.pack) {
    args.screenshot = true;
    args.theme = true;
  }

  return args;
}

function showHelp() {
  console.log(`
Web Page Data Extraction Tool

Usage:
  node extract.mjs <url> [options]

Extraction modes:
  --screenshot     Capture page screenshot
  --theme          Extract design tokens (colors, fonts, spacing)
  --markdown       Convert page to Markdown
  --links          Collect interactive elements
  --pack           Export full data pack (all above)
  --all            Same as --screenshot --theme --markdown --links

Options:
  -o, --output DIR      Output directory (default: ./page-export)
  --selector SEL        CSS selector to scope extraction
  --viewport WxH        Viewport size (default: 1280x720)
  --wait MS             Wait after page load (default: 0)
  --scroll              Scroll page to trigger lazy content
  --scroll-step PX      Pixels per scroll (default: 800)
  --scroll-delay MS     Delay between scrolls (default: 200)
  --format png|jpeg     Screenshot format (default: png)
  --no-headless         Show browser window
  --connect-cdp URL     Connect to running Chrome
  --verbose             Detailed logging
  -h, --help            Show this help

Examples:
  # Screenshot whole page
  node extract.mjs https://example.com --screenshot

  # Screenshot a specific element
  node extract.mjs https://example.com --screenshot --selector "#hero"

  # Extract design tokens from a component
  node extract.mjs https://example.com --theme --selector ".card"

  # Full extraction
  node extract.mjs https://example.com --all -o ./my-export

  # Authenticated page (connect to logged-in Chrome)
  node extract.mjs https://internal.example.com --all --connect-cdp http://localhost:9222
`);
}

// ── Main ─────────────────────────────────────────────────────
async function main() {
  const args = parseArgs(process.argv);
  if (args.help) { showHelp(); process.exit(0); }
  if (!args.url) { console.error('❌ URL required'); showHelp(); process.exit(1); }

  const outputDir = path.resolve(args.output);
  const log = args.verbose ? console.log.bind(console) : () => {};

  console.log('🚀 Page Data Extraction');
  console.log(`   URL: ${args.url}`);
  console.log(`   Output: ${outputDir}`);
  if (args.selector) console.log(`   Selector: ${args.selector}`);

  // Ensure Playwright is installed
  await ensureDependencies();
  if (!isPlaywrightAvailable()) {
    console.error('❌ Playwright not available. Cannot proceed.');
    process.exit(1);
  }

  const playwright = await loadPlaywright();
  if (!playwright) {
    console.error('❌ Failed to load Playwright.');
    process.exit(1);
  }

  fs.mkdirSync(outputDir, { recursive: true });

  // Open the page
  console.log('\n🌐 Opening page…');
  const { page, context } = await openPage(playwright, args.url, {
    headless: args.headless,
    connectCdp: args.connectCdp,
    viewport: args.viewport,
    waitMs: args.wait,
  });

  const pageTitle = await page.title();
  const pageUrl = page.url();
  console.log(`   ✅ Page loaded: "${pageTitle}"`);

  // Collect results for pack
  const results = {
    screenshot: null,
    theme: null,
    markdown: null,
    links: null,
    pageUrl,
    pageTitle,
    viewport: args.viewport,
  };

  try {
    // ── Screenshot ──────────────────────────────────────────
    if (args.screenshot) {
      console.log('\n📸 Capturing screenshot…');
      const ext = args.format === 'jpeg' ? 'jpg' : 'png';
      const screenshotPath = path.join(outputDir, `screenshot.${ext}`);
      try {
        await captureScreenshot(page, screenshotPath, {
          selector: args.selector,
          format: args.format,
          scroll: args.scroll,
          scrollStep: args.scrollStep,
          scrollDelay: args.scrollDelay,
        });
        results.screenshot = { path: screenshotPath };
        console.log(`   ✅ Screenshot → screenshot.${ext}`);
      } catch (e) {
        console.error(`   ❌ Screenshot failed: ${e.message}`);
      }
    }

    // ── Design tokens ──────────────────────────────────────
    if (args.theme) {
      console.log('\n🎨 Extracting design tokens…');
      try {
        const theme = await extractTheme(page, { selector: args.selector });
        results.theme = theme;
        fs.writeFileSync(path.join(outputDir, 'theme.json'), JSON.stringify(theme, null, 2));
        console.log('   ✅ Theme → theme.json');
      } catch (e) {
        console.error(`   ❌ Theme extraction failed: ${e.message}`);
      }
    }

    // ── Markdown ────────────────────────────────────────────
    if (args.markdown) {
      console.log('\n📝 Extracting Markdown…');
      try {
        const md = await extractMarkdown(page, { selector: args.selector });
        results.markdown = md;
        if (md) {
          fs.writeFileSync(path.join(outputDir, 'content.md'), md);
          console.log(`   ✅ Markdown → content.md (${md.length} chars)`);
        } else {
          console.log('   ⚠️  No content extracted');
        }
      } catch (e) {
        console.error(`   ❌ Markdown extraction failed: ${e.message}`);
      }
    }

    // ── Links ───────────────────────────────────────────────
    if (args.links) {
      console.log('\n🔗 Collecting links…');
      try {
        const linksData = await collectLinks(page, { selector: args.selector });
        results.links = linksData;
        fs.writeFileSync(path.join(outputDir, 'links.json'), JSON.stringify(linksData, null, 2));
        console.log(`   ✅ Links → links.json (${linksData.totalLinks} total, ${linksData.visibleLinks} visible)`);
      } catch (e) {
        console.error(`   ❌ Links collection failed: ${e.message}`);
      }
    }

    // ── Data pack ───────────────────────────────────────────
    if (args.pack) {
      console.log('\n📦 Creating data pack…');
      try {
        await createDataPack(outputDir, results);
        console.log('   ✅ Data pack created');
      } catch (e) {
        console.error(`   ❌ Data pack failed: ${e.message}`);
      }
    }
  } finally {
    await context.close();
  }

  await closeBrowser();

  console.log(`\n${'═'.repeat(50)}`);
  console.log('✅ Extraction complete!');
  console.log(`   Output: ${outputDir}`);
}

main().catch((e) => {
  console.error('❌ Fatal error:', e);
  closeBrowser().then(() => process.exit(1));
});
