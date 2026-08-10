---
name: design-system-search
description: Use when selecting a design system or theme for a product, page, prototype, or implementation through Axhub design knowledge indexes.
---

# Design System Search

## Overview

Turn a design need into a private, structured search; inspect the returned evidence before selecting a theme. Search and scoring run locally after the versioned index is loaded.

## Workflow

1. 先把需求整理为结构化查询。只提取平台、行业、产品类型、页面类型、风格、品牌气质、色系、明暗模式、密度和关键词。不得把用户原文传给脚本或网络端点。
2. 确定平台。用户没有指定时，向用户确认平台，或同时搜索 desktop 和 mobile 两份索引；不要擅自默认。
3. 按 [query-schema.md](references/query-schema.md) 和 [taxonomy.md](references/taxonomy.md) 生成请求，使用 `scripts/cli.mjs search` 在本地检索。
4. 对每个候选读取 `matched`、`unmatched`、`scoreBreakdown`、`reviewStatus` 和 `publishable`，再取得完整的 `DESIGN.md` 并查看 preview。不能只按 score 选择。
5. 结合用户约束说明推荐理由和不匹配项。`deferred` 可用于本地参考，但不得描述为已获公开发布授权。
6. 只有用户工作流需要落地资源时才下载 package；普通选型只读取 DESIGN.md 和 preview。不得发送 use 事件或 analytics 事件。

## Example

将本地整理出的请求写入临时文件：

```json
{
  "schemaVersion": 1,
  "readerVersion": "1.0.0",
  "platform": "desktop",
  "terms": ["analytics", "finance"],
  "hardFilters": { "industries": ["finance-payments"] },
  "softFilters": { "styles": ["professional"], "density": ["high"] },
  "exclude": { "styles": ["playful"] },
  "limit": 4
}
```

```bash
node scripts/cli.mjs search --index /path/to/desktop.json --request /path/to/request.json --local-root /path/to/runtime
```

Then pass one returned result to `scripts/cli.mjs fetch --kind designMd` and read the full body before choosing.

## Quick reference

| Situation | Action |
| --- | --- |
| Platform missing | Confirm, or search both indexes |
| Local deferred result | Read local DESIGN.md and preview; package stays unavailable |
| Online result | Accept only the strict published manifest and verified hashes |
| Too few results | Report `resultSummary.reason`; do not pad or duplicate |
| Stale cache | State it explicitly; do not silently downgrade |

## Common mistakes

- Passing the user's original prose as `terms` instead of extracting a minimal structured query.
- Choosing the top score without reading unmatched constraints and full DESIGN.md.
- Treating `deferred` as publishable or inventing a public artifact URL.
- Downloading a package during exploration when DESIGN.md and preview are sufficient.

Read [response-schema.md](references/response-schema.md) for result fields, artifact behavior, and stable error codes.
