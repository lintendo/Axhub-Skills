/**
 * markdown.mjs — HTML → Markdown page content extraction
 *
 * Uses a lightweight DOM-based approach injected via Playwright.
 * The inject script walks the DOM tree and converts visible text
 * and headings into Markdown format.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Extract page content as Markdown.
 *
 * @param {import('playwright').Page} page
 * @param {object} options
 * @returns {string} markdown content
 */
export async function extractMarkdown(page, options = {}) {
  const { selector } = options;

  const injectPath = path.join(__dirname, '..', 'inject', 'extract-markdown.js');
  const injectCode = fs.readFileSync(injectPath, 'utf-8');

  const markdown = await page.evaluate(
    ({ code, sel }) => {
      const fn = new Function(code + '; return __extractMarkdown;')();
      const root = sel ? document.querySelector(sel) : document.body;
      if (!root) throw new Error(`Selector "${sel}" not found`);
      return fn(root);
    },
    { code: injectCode, sel: selector },
  );

  return markdown || '';
}
