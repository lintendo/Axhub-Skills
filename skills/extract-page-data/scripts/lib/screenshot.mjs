/**
 * screenshot.mjs — Page & element screenshot capture
 *
 * Supports:
 *  - Full page screenshot
 *  - Element screenshot via CSS selector
 *  - Lazy-load triggering via scroll
 *  - png / jpeg formats
 */

import * as path from 'node:path';

/**
 * Capture a screenshot of the full page or a specific element.
 *
 * @param {import('playwright').Page} page
 * @param {string} outputPath — file path for the screenshot
 * @param {object} options
 * @returns {string} outputPath
 */
export async function captureScreenshot(page, outputPath, options = {}) {
  const {
    selector,
    format = 'png',
    scroll = false,
    scrollStep = 800,
    scrollDelay = 200,
    maxScrolls = 30,
  } = options;

  // Trigger lazy-loaded content by scrolling
  if (scroll) {
    console.log('   📜 Scrolling to trigger lazy content…');
    await autoScroll(page, { scrollStep, scrollDelay, maxScrolls });
    // Scroll back to top for the screenshot
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(500);
  }

  if (selector) {
    // Element screenshot
    const element = await page.$(selector);
    if (!element) {
      throw new Error(`Selector "${selector}" not found on page`);
    }
    await element.screenshot({ path: outputPath, type: format });
  } else {
    // Full page screenshot
    await page.screenshot({ path: outputPath, fullPage: true, type: format });
  }

  return outputPath;
}

/**
 * Auto-scroll the page to trigger lazy loading.
 */
async function autoScroll(page, { scrollStep, scrollDelay, maxScrolls }) {
  await page.evaluate(
    async ({ step, delay, max }) => {
      await new Promise((resolve) => {
        let totalHeight = 0;
        let scrolls = 0;
        const timer = setInterval(() => {
          const scrollHeight = document.body.scrollHeight;
          window.scrollBy(0, step);
          totalHeight += step;
          scrolls++;
          if (totalHeight >= scrollHeight || scrolls >= max) {
            clearInterval(timer);
            resolve();
          }
        }, delay);
      });
    },
    { step: scrollStep, delay: scrollDelay, max: maxScrolls },
  );
}
