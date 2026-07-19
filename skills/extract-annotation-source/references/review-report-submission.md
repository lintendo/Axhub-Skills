# Review Report Submission

This flow is optional. Use it only when the user asks to submit a Markdown review report back to the prototype.

## Authoritative Context

First evaluate `window.__AXHUB_REVIEW_SUBMIT__`. The explicitly injected value is the 唯一事实来源 for review submission:

```ts
type ReviewSubmitContext = {
  url: string;
  existsUrl: string;
  projectId: string;
  prototypeId: string;
};
```

The caller must 不识别或区分局域网与 Axhub. It must not infer a channel from the hostname, reconstruct an endpoint, or probe a channel-specific configuration API. Both hosting modes use the same context shape, JSON payload, success response, and report-id verification flow; only the injected URLs differ.

`url` and `existsUrl` are direct endpoints. They already contain the hosted path plus `projectId` and `prototypeId` query fallback when required. Always keep the IDs from the same injected object together.

If the object or any required field is missing, do not guess IDs or endpoints from the page URL or title. Return the Markdown report to the user and explain that review submission is unavailable for this published page.

## Resolve Reviewer

Before submitting, determine the reviewer signature from the user:

- Prefer a reviewer value only when the user explicitly provided or confirmed it.
- If no reviewer was explicitly provided or confirmed, ask the user what reviewer name to use before submission.
- Do not invent, infer, or default the reviewer to the agent name, model name, `AI`, or a generic placeholder.

## Submit The Shared Payload

POST the same payload to `submitContext.url` for every hosting mode:

```js
const payload = {
  projectId: submitContext.projectId,
  prototypeId: submitContext.prototypeId,
  "title": "需求评审 - 首页原型",
  "reviewer": "<user-confirmed reviewer>",
  "score": 86,
  "content": "<markdown>",
  "source": "ai-agent",
};

const submitResponse = await fetch(submitContext.url, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(payload),
});
const submitResult = await submitResponse.json();
if (!submitResponse.ok || !submitResult?.report?.id) {
  throw new Error(submitResult?.error || `Review submission failed (${submitResponse.status})`);
}
const report = submitResult.report;
```

`title`, `reviewer`, `score`, and `source` are optional protocol fields, but include values that are available and user-confirmed. `content` is required and must contain Markdown. The success response is always:

```json
{
  "projectId": "<projectId>",
  "prototypeId": "<prototypeId>",
  "report": {
    "id": "<reportId>",
    "title": "<title>",
    "reviewer": "<reviewer>",
    "createdAt": "<iso-time>",
    "score": 86,
    "source": "ai-agent",
    "path": "<stored-path>"
  }
}
```

The response intentionally omits the Markdown body.

## Verify The Returned Report ID

Verify only the `report.id` returned by the successful POST. Do not fetch the report list or report body:

```js
const verifyUrl = new URL(submitContext.existsUrl);
verifyUrl.searchParams.set('reportId', report.id);
const verifyResponse = await fetch(verifyUrl);
const verification = await verifyResponse.json();
if (!verifyResponse.ok || verification?.exists !== true) {
  throw new Error(verification?.error || 'The submitted report could not be verified by id');
}
```

The verification response is intentionally minimal:

```json
{
  "projectId": "<projectId>",
  "prototypeId": "<prototypeId>",
  "reportId": "<reportId>",
  "exists": true
}
```

Treat `exists: true` as successful verification. Otherwise, tell the user the POST response was received but the saved report could not be verified by ID.

## Markdown Metadata

Frontmatter is optional because the shared JSON payload already carries metadata. When included, keep it consistent with the payload:

```md
---
title: "需求评审 - 首页原型"
reviewer: "<user-confirmed reviewer>"
source: "ai-agent"
score: 86
---

# 需求评审 - 首页原型

...
```

Keep the title descriptive. Use `score` as a single overall quality score from 0 to 100; do not calculate it mechanically from finding counts. The server supplies the authoritative creation time.
