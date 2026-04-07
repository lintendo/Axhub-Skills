/**
 * theme.mjs — Design token extraction via Playwright page.evaluate()
 *
 * Injects `inject/extract-theme.js` logic into the page and collects
 * computed CSS design tokens (colors, typography, spacing, radius, etc.).
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Extract design tokens from a page or element.
 *
 * @param {import('playwright').Page} page
 * @param {object} options
 * @returns {object} theme tokens
 */
export async function extractTheme(page, options = {}) {
  const { selector } = options;

  // Read the inject script
  const injectPath = path.join(__dirname, '..', 'inject', 'extract-theme.js');
  const injectCode = fs.readFileSync(injectPath, 'utf-8');

  // Evaluate in the page context
  const theme = await page.evaluate(
    ({ code, sel }) => {
      // Execute the injected code to define the function
      const fn = new Function(code + '; return __extractDesignTokens;')();
      const root = sel ? document.querySelector(sel) : document.documentElement;
      if (!root) throw new Error(`Selector "${sel}" not found`);
      return fn(root);
    },
    { code: injectCode, sel: selector },
  );

  return theme;
}
