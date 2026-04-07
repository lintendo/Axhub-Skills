/**
 * extract-links.js — Browser-injected interactive element collector
 *
 * This script runs inside the browser page via page.evaluate().
 * It finds <a>, <button>, <form>, and ARIA interactive elements,
 * returning their text, href, visibility, and type.
 *
 * Extracted from: chrome-extension/entrypoints/background/tools/browser/get-page-map.ts
 * and chrome-extension/entrypoints/page-script/page.ts → collectPageMapData
 *
 * To customise: add new element types to the selectors below,
 * or modify the output format.
 */

const __extractLinks = (function () {
  return function extractLinks(root) {
    const nodes = [];
    const seen = new Set();

    const isVisible = (el) => {
      if (!(el instanceof HTMLElement)) return false;
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && el.offsetParent !== null;
    };

    const getText = (el) => {
      return (
        el.innerText?.trim() ||
        el.getAttribute('aria-label') ||
        ''
      );
    };

    const getSelector = (el) => {
      // Build a minimal CSS selector for the element
      if (el.id) return `#${CSS.escape(el.id)}`;
      const tag = el.tagName.toLowerCase();
      const classes = [...el.classList].slice(0, 2).map(c => `.${CSS.escape(c)}`).join('');
      if (classes) return `${tag}${classes}`;
      return tag;
    };

    const register = (el, type, href) => {
      if (!el || seen.has(el)) return;
      const text = getText(el);
      if (!text && !href) return; // skip empty nodes

      const node = {
        type,
        visible: isVisible(el),
      };

      if (text) node.text = text;
      if (href) node.href = href;
      try { node.selector = getSelector(el); } catch {}

      nodes.push(node);
      seen.add(el);
    };

    // 1. <a> links
    root.querySelectorAll('a[href]').forEach((el) => {
      register(el, 'a', el.href);
    });

    // 2. Buttons and clickable elements
    root.querySelectorAll('button,[onclick],[role="button"]').forEach((el) => {
      register(el, 'button');
    });

    // 3. Forms
    root.querySelectorAll('form[action]').forEach((el) => {
      register(el, 'form', el.action);
    });

    // 4. ARIA links
    root.querySelectorAll('[role="link"]').forEach((el) => {
      const href = el.href || el.getAttribute('aria-controls') || undefined;
      register(el, 'a', href);
    });

    // 5. Input elements
    root.querySelectorAll('input, select, textarea').forEach((el) => {
      const type = el.getAttribute('type') || el.tagName.toLowerCase();
      const placeholder = el.getAttribute('placeholder') || '';
      const label = el.getAttribute('aria-label') || placeholder || el.getAttribute('name') || '';
      if (label) {
        const node = {
          type: 'input',
          text: `[${type}] ${label}`,
          visible: isVisible(el),
        };
        try { node.selector = getSelector(el); } catch {}
        if (!seen.has(el)) {
          nodes.push(node);
          seen.add(el);
        }
      }
    });

    const visibleLinks = nodes.filter((n) => n.visible).length;

    return {
      pageUrl: window.location.href,
      pageTitle: document.title,
      links: nodes,
      totalLinks: nodes.length,
      visibleLinks,
    };
  };
})();
