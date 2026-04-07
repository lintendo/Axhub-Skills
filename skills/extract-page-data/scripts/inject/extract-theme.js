/**
 * extract-theme.js — Browser-injected design token extraction
 *
 * This script runs inside the browser page via page.evaluate().
 * It walks the DOM tree and collects computed CSS values to build
 * a design token summary (colors, typography, spacing, radius, etc.).
 *
 * Extracted from: chrome-extension/entrypoints/page-script/page.ts → extractDesignTokensV4
 *
 * New fields (synced with page.ts):
 *   - animations    : named CSS animations (name|duration|easing)
 *   - transitions   : CSS transition values
 *   - cssVariables  : CSS custom properties from :root
 *   - assets        : backgroundImages, images (with position/zIndex), svgCount
 *
 * top-N limits are now per-category (no longer a uniform 10).
 */

const __extractDesignTokens = (function () {
  return function extractDesignTokens(root) {
    const makeBucket = () => new Map();

    const add = (bucket, value, tag) => {
      if (!value) return;
      if (!bucket.has(value)) bucket.set(value, { count: 0, tags: new Set() });
      const item = bucket.get(value);
      item.count += 1;
      if (tag) item.tags.add(tag);
    };

    const isZeroish = (value) => {
      if (!value) return false;
      const trimmed = value.trim();
      if (trimmed === '0' || trimmed === '0px' || trimmed === '0%') return true;
      const parts = trimmed.split(/\s+/);
      return parts.length > 1 && parts.every((p) => p === '0' || p === '0px' || p === '0%');
    };

    const isTransparentColor = (value) => {
      if (!value) return false;
      const v = value.trim().toLowerCase();
      return (
        v === 'transparent' ||
        v === 'rgba(0, 0, 0, 0)' ||
        v === 'rgba(0,0,0,0)' ||
        v === 'hsla(0, 0%, 0%, 0)' ||
        v === 'hsla(0,0%,0%,0)'
      );
    };

    const normalizeTags = (tags) => (tags.has('body') ? ['body'] : [...tags]);

    const spacingBucket = makeBucket();
    const colorBuckets = { background: makeBucket(), text: makeBucket(), border: makeBucket() };
    const typographyBuckets = { family: makeBucket(), textStyle: makeBucket() };
    const radiusBucket = makeBucket();
    const lineWidthBucket = makeBucket();
    const shadowBuckets = { box: makeBucket(), text: makeBucket() };
    const animationBucket = makeBucket();
    const transitionBucket = makeBucket();
    const bgImageBucket = makeBucket();

    const walkRoot = root.tagName === 'HTML' ? document.body : root;
    const walker = document.createTreeWalker(walkRoot, NodeFilter.SHOW_ELEMENT);
    let el = walker.currentNode;

    while (el) {
      const tag = el.tagName?.toLowerCase() || '';
      const s = getComputedStyle(el);

      const bg = s.backgroundColor || s.background;
      if (bg && !isTransparentColor(bg)) add(colorBuckets.background, bg, tag);

      const text = s.color;
      if (text && !isTransparentColor(text)) add(colorBuckets.text, text, tag);

      [s.borderColor, s.borderTopColor, s.borderRightColor, s.borderBottomColor, s.borderLeftColor].forEach((c) => {
        if (c && !isTransparentColor(c)) add(colorBuckets.border, c, tag);
      });

      add(typographyBuckets.family, s.fontFamily, tag);
      if (s.fontSize && s.fontWeight && s.lineHeight) {
        add(typographyBuckets.textStyle, `${s.fontSize}||${s.lineHeight}||${s.fontWeight}`, tag);
      }

      const addSpacingParts = (val) => {
        if (!val) return;
        val.trim().split(/\s+/).filter(Boolean).forEach((p) => {
          if (!isZeroish(p)) add(spacingBucket, p, tag);
        });
      };
      addSpacingParts(s.margin);
      addSpacingParts(s.padding);
      if (s.gap && s.gap !== 'normal') addSpacingParts(s.gap);

      if (s.borderRadius && !isZeroish(s.borderRadius)) add(radiusBucket, s.borderRadius, tag);

      ['borderWidth', 'borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth'].forEach((w) => {
        const val = s[w];
        if (val && !isZeroish(val)) add(lineWidthBucket, val, tag);
      });

      if (s.boxShadow && s.boxShadow !== 'none') add(shadowBuckets.box, s.boxShadow, tag);
      if (s.textShadow && s.textShadow !== 'none') add(shadowBuckets.text, s.textShadow, tag);

      // ── Animation & transition extraction ─────────────────────
      const anim = s.animationName;
      if (anim && anim !== 'none') {
        add(animationBucket, `${anim}|${s.animationDuration}|${s.animationTimingFunction}`, tag);
      }
      const trans = s.transition;
      if (trans && trans !== 'none' && !trans.startsWith('all 0s')) {
        add(transitionBucket, trans, tag);
      }

      // ── Background image extraction ────────────────────────────
      const bgImg = s.backgroundImage;
      if (bgImg && bgImg !== 'none') add(bgImageBucket, bgImg, tag);

      el = walker.nextNode();
    }

    // ── CSS custom properties (:root variables) ──────────────────
    const cssVariables = {};
    const rootStyle = getComputedStyle(document.documentElement);
    for (const sheet of [...document.styleSheets]) {
      try {
        for (const rule of [...(sheet.cssRules || [])]) {
          if (rule instanceof CSSStyleRule && rule.selectorText === ':root') {
            for (const prop of [...rule.style]) {
              if (prop.startsWith('--')) {
                cssVariables[prop] = rootStyle.getPropertyValue(prop).trim();
              }
            }
          }
        }
      } catch {
        // cross-origin stylesheet — skip
      }
    }

    // ── Image asset enumeration ──────────────────────────────────
    const images = [...document.querySelectorAll('img')].map((img) => {
      const imgStyle = getComputedStyle(img);
      return {
        src: img.src,
        alt: img.alt,
        position: imgStyle.position,
        zIndex: imgStyle.zIndex,
        siblingImgCount: img.parentElement ? img.parentElement.querySelectorAll('img').length : 0,
      };
    });

    const sortTop = (bucket, n = 10) =>
      [...bucket.entries()]
        .sort((a, b) => b[1].count - a[1].count)
        .slice(0, n)
        .map(([value, obj]) => ({ value, count: obj.count, tags: normalizeTags(obj.tags) }));

    const sortTextStyles = (bucket, n = 10) =>
      [...bucket.entries()]
        .sort((a, b) => b[1].count - a[1].count)
        .slice(0, n)
        .map(([value, obj]) => {
          const [size, lineHeight, weight] = value.split('||');
          return { size, lineHeight, weight, count: obj.count, tags: normalizeTags(obj.tags) };
        });

    return {
      colors: {
        background: sortTop(colorBuckets.background, 8),
        text: sortTop(colorBuckets.text, 8),
        border: sortTop(colorBuckets.border, 6),
      },
      typography: {
        families: sortTop(typographyBuckets.family, 5),
        textStyles: sortTextStyles(typographyBuckets.textStyle, 10),
      },
      spacing: sortTop(spacingBucket, 15),
      radius: sortTop(radiusBucket, 6),
      lineWidth: sortTop(lineWidthBucket, 4),
      shadow: {
        box: sortTop(shadowBuckets.box, 6),
        text: sortTop(shadowBuckets.text, 4),
      },
      animations: sortTop(animationBucket, 8),
      transitions: sortTop(transitionBucket, 8),
      cssVariables,
      assets: {
        backgroundImages: sortTop(bgImageBucket, 10),
        images,
        svgCount: document.querySelectorAll('svg').length,
      },
    };
  };
})();
