/**
 * interact.mjs — Phase 4: 交互态采集（hover/click/scroll 后截图 + 样式）
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

export async function runInteract(page, outputDir, options = {}) {
  const { hover, click, scroll, screenshot: doScreenshot = true, selector } = options;
  const interactDir = path.join(outputDir, 'interactions');
  fs.mkdirSync(interactDir, { recursive: true });

  const results = [];

  // ── Hover ──────────────────────────
  if (hover) {
    console.log(`  🖱️  Hover: ${hover}`);
    try {
      const el = page.locator(hover).first();
      await el.hover();
      await page.waitForTimeout(300);

      if (doScreenshot) {
        const name = `hover-${hover.replace(/[^a-zA-Z0-9]/g, '-').slice(0, 40)}`;
        await el.screenshot({ path: path.join(interactDir, `${name}.png`) });
        console.log(`  ✅ ${name}.png`);

        // 采集 hover 后的样式
        const hoverStyles = await page.evaluate((sel) => {
          const el = document.querySelector(sel);
          if (!el) return null;
          const cs = getComputedStyle(el);
          return {
            backgroundColor: cs.backgroundColor,
            color: cs.color,
            boxShadow: cs.boxShadow,
            transform: cs.transform,
            opacity: cs.opacity,
            borderColor: cs.borderColor,
            textDecoration: cs.textDecoration,
          };
        }, hover);

        if (hoverStyles) {
          fs.writeFileSync(path.join(interactDir, `${name}-styles.json`), JSON.stringify(hoverStyles, null, 2));
          console.log(`  ✅ ${name}-styles.json`);
        }

        results.push({ type: 'hover', selector: hover, screenshot: `${name}.png` });
      }
    } catch (e) {
      console.warn(`  ⚠️  Hover 失败: ${e.message}`);
    }
  }

  // ── Click ──────────────────────────
  if (click) {
    console.log(`  🖱️  Click: ${click}`);
    try {
      const el = page.locator(click).first();
      await el.click();
      await page.waitForTimeout(500);

      if (doScreenshot) {
        const name = `click-${click.replace(/[^a-zA-Z0-9]/g, '-').slice(0, 40)}`;
        await page.screenshot({ path: path.join(interactDir, `${name}.png`), fullPage: true });
        console.log(`  ✅ ${name}.png`);
        results.push({ type: 'click', selector: click, screenshot: `${name}.png` });
      }
    } catch (e) {
      console.warn(`  ⚠️  Click 失败: ${e.message}`);
    }
  }

  // ── Scroll ─────────────────────────
  if (scroll) {
    const scrollY = parseInt(scroll) || 1000;
    console.log(`  📜 Scroll: ${scrollY}px`);
    try {
      await page.evaluate((y) => window.scrollTo({ top: y, behavior: 'smooth' }), scrollY);
      await page.waitForTimeout(500);

      if (doScreenshot) {
        const name = `scroll-${scrollY}`;
        await page.screenshot({ path: path.join(interactDir, `${name}.png`) });
        console.log(`  ✅ ${name}.png`);
        results.push({ type: 'scroll', y: scrollY, screenshot: `${name}.png` });
      }
      // 滚回顶部
      await page.evaluate(() => window.scrollTo(0, 0));
    } catch (e) {
      console.warn(`  ⚠️  Scroll 失败: ${e.message}`);
    }
  }

  // 更新 meta.json
  const metaPath = path.join(outputDir, 'meta.json');
  if (fs.existsSync(metaPath)) {
    const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
    if (!meta.phases.includes('interact')) meta.phases.push('interact');
    meta.interactions = [...(meta.interactions || []), ...results];
    fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2));
  }

  return results;
}
