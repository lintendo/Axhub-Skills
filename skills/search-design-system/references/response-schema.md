# Design system search response

> Generated from `apps/make-template/knowledge/schemas/search-response.schema.json`. Do not edit by hand.

searchContractVersion: `1.0.0`

## Top-level fields

| Field | Contract |
| --- | --- |
| `schemaVersion` | const 1 |
| `taxonomyVersion` | const 1.0.0 |
| `searchContractVersion` | const 1.0.0 |
| `cacheStatus` | local \| fresh \| stale |
| `cacheVersion` | string |
| `resultSummary` | object |
| `results` | array |
| `error` | object |

## Result review

Read `matched`, `unmatched`, `scoreBreakdown`, `reviewStatus`, `publishable`, and `artifacts` before choosing. A high score is not a substitute for reading the full `DESIGN.md`. Deferred records may expose local or verified online DESIGN.md and preview artifacts but never a package URL.

## Error codes

- `INVALID_REQUEST`
- `UNSUPPORTED_SCHEMA_VERSION`
- `INCOMPATIBLE_READER_VERSION`
- `INCOMPATIBLE_TAXONOMY_VERSION`
- `INCOMPATIBLE_SEARCH_CONTRACT_VERSION`
- `INVALID_INDEX`
- `INDEX_HASH_MISMATCH`
- `ARTIFACT_HASH_MISMATCH`
- `UNSAFE_ARTIFACT_URL`
- `FETCH_FAILED`
- `CACHE_MISS`
- `STALE_CACHE_DISALLOWED`
- `RESULT_NOT_FOUND`
- `ANNOTATION_INVALID`
- `ANNOTATION_INPUT_HASH_MISMATCH`
