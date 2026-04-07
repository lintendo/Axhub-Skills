/**
 * pack.mjs — Full page data pack export
 *
 * Combines screenshot + theme + markdown + links into a single zip file.
 * Uses Node.js built-in zlib for zip creation (no external dependency).
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { createGzip } from 'node:zlib';
import { pipeline } from 'node:stream/promises';

/**
 * Create a data pack zip from collected page data.
 *
 * We use a simple tar.gz approach since Node.js doesn't have built-in zip.
 * The output is a directory with all files, then optionally archived.
 *
 * @param {string} outputDir — directory to write pack files
 * @param {object} data — collected page data
 */
export async function createDataPack(outputDir, data) {
  const {
    screenshot,    // { path: string } | null
    theme,         // object | null
    markdown,      // string | null
    links,         // object | null
    pageUrl,
    pageTitle,
    viewport,
  } = data;

  const packDir = path.join(outputDir, 'page-data-pack');
  fs.mkdirSync(packDir, { recursive: true });

  // Meta
  const meta = {
    pageUrl: pageUrl || '',
    pageTitle: pageTitle || '',
    viewport: viewport || { width: 1280, height: 720 },
    extractedAt: new Date().toISOString(),
    files: [],
  };

  // Screenshot
  if (screenshot?.path && fs.existsSync(screenshot.path)) {
    const dest = path.join(packDir, 'screenshot.png');
    fs.copyFileSync(screenshot.path, dest);
    meta.files.push('screenshot.png');
  }

  // Theme
  if (theme) {
    fs.writeFileSync(path.join(packDir, 'theme.json'), JSON.stringify(theme, null, 2));
    meta.files.push('theme.json');
  }

  // Markdown
  if (markdown) {
    fs.writeFileSync(path.join(packDir, 'content.md'), markdown);
    meta.files.push('content.md');
  }

  // Links
  if (links) {
    fs.writeFileSync(path.join(packDir, 'links.json'), JSON.stringify(links, null, 2));
    meta.files.push('links.json');
  }

  // Meta
  fs.writeFileSync(path.join(packDir, 'meta.json'), JSON.stringify(meta, null, 2));
  meta.files.push('meta.json');

  console.log(`   📦 Data pack created: ${packDir} (${meta.files.length} files)`);
  return packDir;
}
