# Review Report Submission

This is optional. Use it only when the user asks to submit a Markdown review report back to Axhub Make.

## Resolve Context

First evaluate `window.__AXHUB_REVIEW_SUBMIT__`.

When present, use it as the submit context:

```ts
type ReviewSubmitContext = {
  url: string;
  projectId: string;
  prototypeId: string;
};
```

`url` is the direct POST endpoint and already includes `projectId` and `prototypeId` query fallback.

If it is missing, resolve context manually:

- `baseUrl`: the Axhub Make LAN/admin origin, for example `http://192.168.x.x:5174`.
- `projectId`: prefer the `projectId` query value from the opened URL; otherwise ask the user.
- `prototypeId`: prefer the `p` query value, or the `/prototypes/<prototypeId>` route segment; otherwise ask the user.

Do not guess IDs from page titles.

## Check Enabled

```http
GET /api/review-reports/lan-submit-config?projectId=<projectId>&prototypeId=<prototypeId>
```

Submission is enabled only when both are true:

- `lanSubmitEnabled === true`
- `projectLanAllowed !== false`

If it is not enabled, return the report content to the user and ask them to enable LAN submission or upload the Markdown manually.

## Verify Existing Reports

Use this before or after submission when you need to verify the list:

```http
GET /api/review-reports?projectId=<projectId>&prototypeId=<prototypeId>
```

The list is newest first. Match by `id`, `title`, `reviewer`, and `createdAt`.
If a report has `score`, it is an optional 0-100 overall score.

## Submit

Submit only Markdown:

```http
POST <window.__AXHUB_REVIEW_SUBMIT__.url or /api/review-reports/submit>
Content-Type: application/json

{
  "projectId": "<projectId>",
  "prototypeId": "<prototypeId>",
  "content": "<markdown>",
  "source": "ai-agent"
}
```

The response contains the saved `report`. After submission, query the list once to verify it appears.

## Markdown Metadata

Use frontmatter when possible:

```md
---
title: "需求评审 - 首页原型"
reviewer: "Claude Code"
source: "ai-agent"
score: 86
---

# 需求评审 - 首页原型

...
```

Axhub Make recognizes:

- Title: `frontmatter.title`, then first H1, then filename fallback.
- Reviewer: `frontmatter.reviewer`, then `AI`.
- Score: optional `frontmatter.score`, an integer from 0 to 100.
- Created time: server submit time for LAN submissions.

Keep the title descriptive because the review list does not show separate design/requirements categories.
Use `score` as a single overall quality score; do not calculate it mechanically from finding counts.
