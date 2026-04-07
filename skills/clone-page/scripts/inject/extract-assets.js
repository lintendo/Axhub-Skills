/**
 * extract-assets.js
 * 在浏览器内执行，收集页面中所有可下载资源的 URL。
 *
 * @returns {{ images: Array, fonts: Array, svgs: Array }}
 */
(function extractAssets() {
  const images = [];
  const fonts = new Set();
  const svgs = [];
  const seenUrls = new Set();

  // ── Images ──────────────────────
  document.querySelectorAll('img').forEach(img => {
    const src = img.src || img.dataset?.src;
    if (src && !seenUrls.has(src)) {
      seenUrls.add(src);
      images.push({
        src,
        alt: img.alt || '',
        width: img.naturalWidth || img.width || 0,
        height: img.naturalHeight || img.height || 0,
      });
    }
  });

  // ── Background images ──────────
  document.querySelectorAll('*').forEach(el => {
    const bg = getComputedStyle(el).backgroundImage;
    if (bg && bg !== 'none') {
      const urls = bg.match(/url\(["']?([^"')]+)["']?\)/g);
      if (urls) {
        urls.forEach(u => {
          const match = u.match(/url\(["']?([^"')]+)["']?\)/);
          if (match && match[1] && !seenUrls.has(match[1])) {
            const url = match[1];
            if (!url.startsWith('data:')) {
              seenUrls.add(url);
              images.push({ src: url, alt: '', width: 0, height: 0, type: 'background' });
            }
          }
        });
      }
    }
  });

  // ── Inline SVGs ─────────────────
  document.querySelectorAll('svg').forEach((svg, i) => {
    try {
      const serializer = new XMLSerializer();
      const svgStr = serializer.serializeToString(svg);
      if (svgStr.length < 50000) { // Skip huge SVGs
        svgs.push({
          index: i,
          viewBox: svg.getAttribute('viewBox') || '',
          width: svg.getAttribute('width') || '',
          height: svg.getAttribute('height') || '',
          content: svgStr,
        });
      }
    } catch {}
  });

  // ── Fonts from @font-face ───────
  try {
    for (const sheet of document.styleSheets) {
      try {
        for (const rule of sheet.cssRules) {
          if (rule instanceof CSSFontFaceRule) {
            const src = rule.style.getPropertyValue('src');
            const family = rule.style.getPropertyValue('font-family');
            const urls = src.match(/url\(["']?([^"')]+)["']?\)/g);
            if (urls) {
              urls.forEach(u => {
                const match = u.match(/url\(["']?([^"')]+)["']?\)/);
                if (match && match[1] && !match[1].startsWith('data:')) {
                  fonts.add(JSON.stringify({ url: match[1], family: family.replace(/['"]/g, '') }));
                }
              });
            }
          }
        }
      } catch {} // CORS blocked sheets
    }
  } catch {}

  return {
    images,
    fonts: Array.from(fonts).map(s => JSON.parse(s)),
    svgs,
    totalImages: images.length,
    totalFonts: fonts.size,
    totalSvgs: svgs.length,
  };
})
