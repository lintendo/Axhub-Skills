/**
 * skeleton.mjs — Phase 2: 提取 DOM 骨架树（不含样式）
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function runSkeleton(page, outputDir, options = {}) {
  const { rootSelector = null } = options;
  fs.mkdirSync(outputDir, { recursive: true });

  console.log('  🦴 提取 DOM 骨架…');

  const injectScript = fs.readFileSync(
    path.join(__dirname, '..', 'inject', 'extract-skeleton.js'),
    'utf-8',
  );

  const skeleton = await page.evaluate(
    (script, selector) => {
      const fn = new Function('return ' + script)();
      return fn(selector);
    },
    injectScript,
    rootSelector,
  );

  if (skeleton.error) {
    console.error(`  ❌ ${skeleton.error}`);
    return null;
  }

  // 追加页面信息
  const pageInfo = await page.evaluate(() => ({
    url: window.location.href,
    title: document.title,
  }));
  skeleton.url = pageInfo.url;
  skeleton.title = pageInfo.title;

  fs.writeFileSync(path.join(outputDir, 'skeleton.json'), JSON.stringify(skeleton, null, 2));
  console.log(`  ✅ skeleton.json (${skeleton.nodeCount} 节点)`);

  // 更新 meta.json
  const metaPath = path.join(outputDir, 'meta.json');
  if (fs.existsSync(metaPath)) {
    const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
    if (!meta.phases.includes('skeleton')) meta.phases.push('skeleton');
    meta.nodeCount = skeleton.nodeCount;
    fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2));
  }

  return skeleton;
}
