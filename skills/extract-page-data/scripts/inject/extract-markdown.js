/**
 * extract-markdown.js — Browser-injected HTML → Markdown converter
 *
 * This script runs inside the browser page via page.evaluate().
 * It walks the DOM tree and converts visible text content into
 * clean Markdown, detecting headings by font size and weight.
 *
 * Extracted from: chrome-extension/entrypoints/page-script/page.ts → extractMarkdown (Playwright version)
 * and adapted from the page.ts extractPageContentAsMarkdown for a lightweight, dependency-free version.
 *
 * To customise: adjust heading detection thresholds, add table support, etc.
 */

const __extractMarkdown = (function () {
  return function extractMarkdown(root) {
    const SKIP_TAGS = new Set(['script', 'style', 'noscript', 'svg', 'canvas', 'video', 'audio', 'iframe']);

    function toMd(el, depth) {
      if (depth > 50) return ''; // safety limit
      const lines = [];

      for (const child of el.childNodes) {
        if (child.nodeType === Node.TEXT_NODE) {
          const t = child.textContent?.trim();
          if (t) lines.push(t);
        } else if (child.nodeType === Node.ELEMENT_NODE) {
          const tag = child.tagName?.toLowerCase();
          if (SKIP_TAGS.has(tag)) continue;

          const s = getComputedStyle(child);
          if (s.display === 'none' || s.visibility === 'hidden' || s.opacity === '0') continue;

          const text = child.innerText?.trim();
          if (!text) continue;

          // Detect headings from semantic tags
          if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tag)) {
            const level = parseInt(tag[1]);
            lines.push(`\n${'#'.repeat(level)} ${text}\n`);
            continue;
          }

          // Detect headings from visual style
          const fs = parseFloat(s.fontSize);
          const fw = parseInt(s.fontWeight) || (s.fontWeight === 'bold' ? 700 : 400);

          if (fs >= 24 && fw >= 600) {
            lines.push(`\n## ${text}\n`);
          } else if (fs >= 18 && fw >= 600) {
            lines.push(`\n### ${text}\n`);
          } else if (tag === 'a') {
            const href = child.getAttribute('href') || '';
            if (href && href !== '#') {
              lines.push(`[${text}](${href})`);
            } else {
              lines.push(text);
            }
          } else if (tag === 'img') {
            const alt = child.getAttribute('alt') || '';
            const src = child.getAttribute('src') || '';
            if (src) lines.push(`![${alt}](${src})`);
          } else if (tag === 'li') {
            lines.push(`- ${text}`);
          } else if (tag === 'br') {
            lines.push('');
          } else if (tag === 'hr') {
            lines.push('\n---\n');
          } else if (tag === 'p' || tag === 'blockquote') {
            if (tag === 'blockquote') {
              lines.push(`\n> ${text}\n`);
            } else {
              lines.push(`\n${text}\n`);
            }
          } else if (tag === 'code' || tag === 'pre') {
            if (tag === 'pre') {
              lines.push(`\n\`\`\`\n${text}\n\`\`\`\n`);
            } else {
              lines.push(`\`${text}\``);
            }
          } else if (child.children.length === 0) {
            // Leaf element
            lines.push(text);
          } else {
            // Recurse into children
            const sub = toMd(child, depth + 1);
            if (sub) lines.push(sub);
          }
        }
      }

      return lines.join('\n');
    }

    const rawMd = toMd(root, 0);

    // Clean up excessive blank lines
    return rawMd
      .split('\n')
      .reduce((acc, line) => {
        // Collapse multiple blank lines into at most two
        if (line.trim() === '' && acc.length > 0 && acc[acc.length - 1].trim() === '') {
          return acc;
        }
        acc.push(line);
        return acc;
      }, [])
      .join('\n')
      .trim();
  };
})();
