# Inject Scripts

These scripts are injected into the browser page via Playwright's `page.evaluate()`.
They run in the page's JavaScript context and have full access to the DOM.

## Files

| File | Purpose | Source |
|------|---------|--------|
| `extract-theme.js` | Extract CSS computed style design tokens | `page.ts → extractDesignTokensV4` |
| `extract-markdown.js` | Convert visible DOM text to Markdown | `page.ts → extractPageContentAsMarkdown` (lightweight version) |
| `extract-links.js` | Collect links, buttons, forms, inputs | `get-page-map.ts` + `page.ts → collectPageMapData` |

## How they work

Each inject script defines a function wrapped in an IIFE pattern:

```js
const __functionName = (function () {
  return function functionName(root) {
    // ... extraction logic ...
    return result;
  };
})();
```

The `lib/*.mjs` modules read these files, inject them via `page.evaluate()`, and call the function:

```js
const fn = new Function(code + '; return __functionName;')();
const result = fn(rootElement);
```

## Customisation

You can freely edit these scripts to:
- Add new CSS properties to extract in `extract-theme.js`
- Change heading detection thresholds in `extract-markdown.js`
- Add new element types to collect in `extract-links.js`

Each script is self-contained with no external dependencies. Test them in your browser's DevTools console.
