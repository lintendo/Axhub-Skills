/**
 * links.mjs — Collect interactive elements and links from a page
 *
 * Finds <a>, <button>, <form>, and ARIA interactive elements,
 * returning their text, href, visibility, and type.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Collect links and interactive elements from the page.
 *
 * @param {import('playwright').Page} page
 * @param {object} options
 * @returns {object} { links, totalLinks, visibleLinks }
 */
export async function collectLinks(page, options = {}) {
  const { selector } = options;

  const injectPath = path.join(__dirname, '..', 'inject', 'extract-links.js');
  const injectCode = fs.readFileSync(injectPath, 'utf-8');

  const result = await page.evaluate(
    ({ code, sel }) => {
      const fn = new Function(code + '; return __extractLinks;')();
      const root = sel ? document.querySelector(sel) : document.body;
      if (!root) throw new Error(`Selector "${sel}" not found`);
      return fn(root);
    },
    { code: injectCode, sel: selector },
  );

  return result;
}
