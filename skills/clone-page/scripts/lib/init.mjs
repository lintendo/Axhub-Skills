/**
 * init.mjs — Phase 1: 截图 + 页面元信息 + theme
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function runInit(page, outputDir, options = {}) {
  const { viewport = { width: 1440, height: 900 }, scroll = false } = options;
  fs.mkdirSync(outputDir, { recursive: true });

  // ── 1. 截图 ────────────────────────
  console.log('  📸 截图…');
  const screenshotPath = path.join(outputDir, 'screenshot.png');

  if (scroll) {
    // 滚动到底部触发懒加载
    await page.evaluate(async () => {
      const delay = (ms) => new Promise(r => setTimeout(r, ms));
      const step = 800;
      const maxScroll = document.body.scrollHeight;
      for (let y = 0; y < maxScroll; y += step) {
        window.scrollTo(0, y);
        await delay(200);
      }
      window.scrollTo(0, 0);
      await delay(300);
    });
  }

  await page.screenshot({ path: screenshotPath, fullPage: true });
  console.log('  ✅ screenshot.png');

  // ── 2. meta.json ───────────────────
  console.log('  📋 元信息…');
  const meta = await page.evaluate(() => ({
    url: window.location.href,
    title: document.title,
    viewport: { width: window.innerWidth, height: window.innerHeight },
    scrollHeight: document.body.scrollHeight,
    charsetEncoding: document.characterSet,
    language: document.documentElement.lang || '',
    timestamp: new Date().toISOString(),
  }));
  meta.generator = 'clone-page';
  meta.phases = ['init'];

  fs.writeFileSync(path.join(outputDir, 'meta.json'), JSON.stringify(meta, null, 2));
  console.log('  ✅ meta.json');

  // ── 3. theme.json（设计令牌）─────────
  console.log('  🎨 设计令牌…');
  const themeScript = fs.readFileSync(
    path.join(__dirname, '..', '..', '..', 'extract-page-data', 'scripts', 'inject', 'extract-theme.js'),
    'utf-8',
  );
  let theme = null;
  try {
    theme = await page.evaluate(themeScript);
    fs.writeFileSync(path.join(outputDir, 'theme.json'), JSON.stringify(theme, null, 2));
    console.log('  ✅ theme.json');
  } catch (e) {
    console.warn(`  ⚠️  theme 提取失败: ${e.message}`);
    // Fallback: minimal theme
    theme = await page.evaluate(() => {
      const root = document.documentElement;
      const cs = getComputedStyle(root);
      const vars = {};
      for (const sheet of document.styleSheets) {
        try {
          for (const rule of sheet.cssRules) {
            if (rule.selectorText === ':root') {
              for (const prop of rule.style) {
                if (prop.startsWith('--')) vars[prop] = rule.style.getPropertyValue(prop).trim();
              }
            }
          }
        } catch {}
      }
      return { cssVariables: vars, fallback: true };
    });
    fs.writeFileSync(path.join(outputDir, 'theme.json'), JSON.stringify(theme, null, 2));
    console.log('  ✅ theme.json (fallback)');
  }

  return { meta, theme };
}
