/**
 * assets.mjs — Phase 6: 下载页面资源（图片/字体/SVG）
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import https from 'node:https';
import http from 'node:http';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * 下载单个文件
 */
function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    if (!url || url.startsWith('data:')) return resolve(false);

    const client = url.startsWith('https') ? https : http;
    const request = client.get(url, { timeout: 10000 }, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        // 跟随重定向
        const redirectUrl = res.headers.location;
        if (redirectUrl) return downloadFile(redirectUrl, destPath).then(resolve).catch(reject);
        return resolve(false);
      }
      if (res.statusCode !== 200) return resolve(false);

      const fileStream = fs.createWriteStream(destPath);
      res.pipe(fileStream);
      fileStream.on('finish', () => { fileStream.close(); resolve(true); });
      fileStream.on('error', () => resolve(false));
    });
    request.on('error', () => resolve(false));
    request.on('timeout', () => { request.destroy(); resolve(false); });
  });
}

/**
 * 从 URL 提取文件名
 */
function urlToFilename(url, index, ext) {
  try {
    const u = new URL(url);
    const base = path.basename(u.pathname);
    if (base && base.includes('.')) return base;
  } catch {}
  return `asset-${index}.${ext || 'bin'}`;
}

export async function runAssets(page, outputDir, options = {}) {
  const { maxImages = 50, maxFonts = 10 } = options;
  const assetsDir = path.join(outputDir, 'assets');
  const imagesDir = path.join(assetsDir, 'images');
  const fontsDir = path.join(assetsDir, 'fonts');
  const svgsDir = path.join(assetsDir, 'svgs');

  fs.mkdirSync(imagesDir, { recursive: true });
  fs.mkdirSync(fontsDir, { recursive: true });
  fs.mkdirSync(svgsDir, { recursive: true });

  console.log('  📥 收集资源 URL…');

  const injectScript = fs.readFileSync(
    path.join(__dirname, '..', 'inject', 'extract-assets.js'),
    'utf-8',
  );

  const assetData = await page.evaluate((script) => {
    const fn = new Function('return ' + script)();
    return fn();
  }, injectScript);

  const stats = { images: 0, fonts: 0, svgs: 0, failed: 0 };

  // ── Download images ────────────────
  console.log(`  🖼️  下载图片 (${Math.min(assetData.images.length, maxImages)}/${assetData.images.length})…`);
  for (let i = 0; i < Math.min(assetData.images.length, maxImages); i++) {
    const img = assetData.images[i];
    const ext = img.src.match(/\.(png|jpg|jpeg|gif|webp|svg|avif)/i)?.[1] || 'png';
    const filename = urlToFilename(img.src, i, ext);
    const destPath = path.join(imagesDir, filename);
    const ok = await downloadFile(img.src, destPath);
    if (ok) {
      stats.images++;
      assetData.images[i].localPath = `assets/images/${filename}`;
    } else {
      stats.failed++;
    }
  }
  console.log(`  ✅ ${stats.images} 张图片`);

  // ── Download fonts ─────────────────
  console.log(`  🔤 下载字体 (${Math.min(assetData.fonts.length, maxFonts)}/${assetData.fonts.length})…`);
  for (let i = 0; i < Math.min(assetData.fonts.length, maxFonts); i++) {
    const font = assetData.fonts[i];
    const ext = font.url.match(/\.(woff2?|ttf|otf|eot)/i)?.[1] || 'woff2';
    const filename = `${font.family}-${i}.${ext}`;
    const destPath = path.join(fontsDir, filename);
    const ok = await downloadFile(font.url, destPath);
    if (ok) {
      stats.fonts++;
      assetData.fonts[i].localPath = `assets/fonts/${filename}`;
    } else {
      stats.failed++;
    }
  }
  console.log(`  ✅ ${stats.fonts} 个字体`);

  // ── Save inline SVGs ───────────────
  for (let i = 0; i < assetData.svgs.length; i++) {
    const svg = assetData.svgs[i];
    fs.writeFileSync(path.join(svgsDir, `svg-${i}.svg`), svg.content);
    stats.svgs++;
  }
  if (stats.svgs > 0) console.log(`  ✅ ${stats.svgs} 个 SVG`);

  // 保存 assets manifest
  fs.writeFileSync(
    path.join(assetsDir, 'manifest.json'),
    JSON.stringify({
      images: assetData.images,
      fonts: assetData.fonts,
      svgCount: assetData.svgs.length,
      stats,
    }, null, 2),
  );

  // 更新 meta.json
  const metaPath = path.join(outputDir, 'meta.json');
  if (fs.existsSync(metaPath)) {
    const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
    if (!meta.phases.includes('assets')) meta.phases.push('assets');
    meta.assetStats = stats;
    fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2));
  }

  return stats;
}
