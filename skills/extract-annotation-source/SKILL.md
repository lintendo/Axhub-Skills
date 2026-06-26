---
name: extract-annotation-source
description: Use when an Axhub prototype URL needs its PRD, directory, or annotation context read from window.__AXHUB_ANNOTATION_SOURCE__, especially for prototype-as-PRD review, agent context gathering, or annotation extraction with Playwright, Browser, Chrome, or an equivalent page evaluator.
---

# Extract Annotation Source

Read Axhub prototype context from the runtime snapshot. Treat the page as read-only.

## Workflow

1. Open the requested prototype URL with Playwright, Browser, Chrome, or an equivalent tool that can evaluate page JavaScript.
2. Wait until the app renders, then poll briefly for `window.__AXHUB_ANNOTATION_SOURCE__`.
3. Evaluate and return that value. Do not modify the object or write anything back to `window`.
4. If the value is missing, report the URL, page title, relevant console errors, and that the annotation runtime snapshot was not published.

Minimal page evaluation:

```js
await page.waitForFunction(() => window.__AXHUB_ANNOTATION_SOURCE__, { timeout: 10000 });
const source = await page.evaluate(() => window.__AXHUB_ANNOTATION_SOURCE__);
```

## What To Report

- Directory / PRD outline from `source.directory`.
- Markdown or PRD entries from directory nodes with `type: "markdown"`.
- Annotation count and the important node fields: `id`, `title`, `pageId`, `locator`, `annotationText`, `aiPrompt`, `color`, and `controls`.
- Source handoff from `source.source` when present. Report `root` and `manifest`; when source is needed, read the manifest and relevant files via `root`.
- Mention whether images are attached by checking `images.length`; do not download images unless the user asks.

## Data Shape

```ts
type AnnotationSourceRuntimeSnapshot = {
  directory: AnnotationDirectory | null;
  nodes: AnnotationNode[];
  source?: {
    root?: string;
    manifest?: string;
  };
};
```

- `directory.nodes` is the prototype tree. Node types are `folder`, `route`, `link`, and `markdown`.
- `nodes` is the full annotation list, independent of current page, selected state, and color filter.
- Each annotation node includes `id`, `index`, optional `title`, optional `pageId`, `locator`, `aiPrompt`, `annotationText`, `hasMarkdown`, `color`, `images`, optional `controls`, `createdAt`, and `updatedAt`.
- `source` is only a source-code discovery reference. In HTML published with source included, `manifest` points to `source/manifest.json`; resolve its paths relative to `source.root`.
