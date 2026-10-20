# Discovery API (client contract, ENG-TOADE3-HOME-DISCOVERY-2026-V1 §11/§12)

Types: `src/lib/discovery/types.ts`. Client: `src/services/discovery.ts`.
Today a local mock oracle (`src/lib/discovery/oracle.ts`) answers both calls; the Edge
endpoints replace only the oracle call inside the service. Money is integer pesewas.

## POST /v1/customer/discovery/query

```json
{
  "context_id": "5.65060,-0.19620", "context_revision": 3,
  "q": "jollof", "scope": "all|food|groceries",
  "sort": "best_match|price_asc|price_desc",
  "filters": { "category_ids": ["rice-meals"], "min_price_minor": null, "max_price_minor": 5000,
               "open_now": false, "in_stock_only": false, "offers_only": false },
  "surface": "home|search", "purpose": "preview|results", "limit": 20, "cursor": null
}
```

Response: `q, scope, sort, filters` (canonical), `item_count` (COUNT DISTINCT item_id after all
filters, before pagination), `facets.categories[{id,label,count}]` (all filters except category),
`facets.price{buckets[{lower,upper,count}],min,max}` (all filters except min/max; <=20 buckets,
`[lower,upper)`, last bucket includes `upper`), `coverage`, `empty_reason`
(`not_covered|no_query_matches|stores_closed|filters_exclude|null`),
`query_interpretation{normalized_q,corrected_q,suggested_q}`, `context_revision`, `revision`,
`computed_at`, `freshness`, and either `modules[]` (surface=home) or `items[]` + `next_cursor`
(surface=search). `purpose=preview` returns no items. One snapshot per response.

## POST /v1/customer/discovery/suggestions

Request: `context_id, context_revision, q (>=2 chars after normalization), scope, filters, limit`.
Response: `queries[{text}]`, `items[{item_id,name,vendor_name}]`, `stores[{vendor_id,name}]`
(a store needs >= 1 eligible item under the filters), `context_revision`, `revision`.

## Errors

| status | code | client behaviour |
|---|---|---|
| 401 / 403 | UNAUTHENTICATED / FORBIDDEN | re-auth (TODO) |
| 409 | CURSOR_STALE | refetch page one, "Results refreshed as availability changed." |
| 409 | CONTEXT_STALE | refetch under the current delivery context |
| 422 | VALIDATION + `field_errors` | field-level message, focus the field |
| 429 | RATE_LIMITED | keep the draft, offer Try again |
| 0 | NETWORK | "Results could not load. Check your connection and try again." |

## Cursor and races

The cursor is opaque: `c1.<offset36>.<data revision>.<fnv1a(query fingerprint)>`. A different
revision or fingerprint is `CURSOR_STALE`; pages are never mixed. Clients accept a response only
when request sequence, query fingerprint and context revision all match the latest request.
