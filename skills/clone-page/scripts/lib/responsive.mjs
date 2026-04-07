/**
 * responsive.mjs — Phase 5: 多 viewport 截图
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

const DEFAULT_VIEWPORTS = [
  { width: 1440, height: 900, name: 'desktop' },
  { width: 768, height: 1024, name: 'tablet' },
  { width: 390, height: 844, name: 'mobile' },
];

export async function runResponsive(page, outputDir, options = {}) {
  const { viewports: viewportStr } = options;
  const respDir = path.join(outputDir, 'responsive');
  fs.mkdirSync(respDir, { recursive: true });

  let viewports = DEFAULT_VIEWPORTS;
  if (viewportStr) {
    viewports = viewportStr.split(',').map(v => {
      const w = parseInt(v.trim());
      const preset = DEFAULT_VIEWPORTS.find(vp => vp.width === w);
      return preset || { width: w, height: Math.round(w * 0.625), name: `${w}` };
    });
  }

  console.log(`  📱 响应式截图 (${viewports.length} 个视口)…`);
  const results = [];

  for (const vp of viewports) {
    try {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.waitForTimeout(500);
      const filename = `${vp.name || vp.width}.png`;
      await page.screenshot({ path: path.join(respDir, filename), fullPage: true });
      console.log(`  ✅ ${filename} (${vp.width}×${vp.height})`);
      results.push({ width: vp.width, height: vp.height, name: vp.name, file: filename });
    } catch (e) {
      console.warn(`  ⚠️  ${vp.width}px 截图失败: ${e.message}`);
    }
  }

  // Restore original viewport
  await page.setViewportSize({ width: 1440, height: 900 });

  // 更新 meta.json
  const metaPath = path.join(outputDir, 'meta.json');
  if (fs.existsSync(metaPath)) {
    const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
    if (!meta.phases.includes('responsive')) meta.phases.push('responsive');
    meta.responsiveScreenshots = results;
    fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2));
  }

  return results;
}
