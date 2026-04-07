/**
 * section-styles.mjs — Phase 3: 对指定 selector 范围提取完整 computedStyle
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * 将 selector 转成安全的目录名
 */
function selectorToDirName(selector) {
  return selector
    .replace(/^body\s*>\s*/i, '')
    .replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase()
    .slice(0, 60) || 'root';
}

export async function runSectionStyles(page, outputDir, options = {}) {
  const { selector } = options;
  if (!selector) {
    console.error('  ❌ --selector 参数必需');
    return null;
  }

  const sectionsDir = path.join(outputDir, 'sections');
  const dirName = selectorToDirName(selector);
  const sectionDir = path.join(sectionsDir, dirName);
  fs.mkdirSync(sectionDir, { recursive: true });

  console.log(`  🎨 提取样式: ${selector}`);

  // ── 注入提取脚本 ──────────────────
  const injectScript = fs.readFileSync(
    path.join(__dirname, '..', 'inject', 'extract-section-styles.js'),
    'utf-8',
  );

  const result = await page.evaluate(
    (script, sel) => {
      const fn = new Function('return ' + script)();
      return fn(sel);
    },
    injectScript,
    selector,
  );

  if (result.error) {
    console.error(`  ❌ ${result.error}`);
    return null;
  }

  // 写入 nodes.json + styles.json
  fs.writeFileSync(
    path.join(sectionDir, 'nodes.json'),
    JSON.stringify({ selector: result.selector, nodeCount: result.nodeCount, nodes: result.nodes }, null, 2),
  );
  fs.writeFileSync(
    path.join(sectionDir, 'styles.json'),
    JSON.stringify({ styleCount: result.styleCount, styles: result.styles }, null, 2),
  );

  console.log(`  ✅ ${dirName}/nodes.json (${result.nodeCount} 节点)`);
  console.log(`  ✅ ${dirName}/styles.json (${result.styleCount} 样式)`);

  // ── Section 截图 ───────────────────
  try {
    const element = page.locator(selector).first();
    await element.screenshot({ path: path.join(sectionDir, 'screenshot.png') });
    console.log(`  ✅ ${dirName}/screenshot.png`);
  } catch (e) {
    console.warn(`  ⚠️  截图失败: ${e.message}`);
  }

  // 更新 meta.json
  const metaPath = path.join(outputDir, 'meta.json');
  if (fs.existsSync(metaPath)) {
    const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
    if (!meta.phases.includes('styles')) meta.phases.push('styles');
    if (!meta.sections) meta.sections = [];
    if (!meta.sections.includes(dirName)) meta.sections.push(dirName);
    fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2));
  }

  return result;
}
