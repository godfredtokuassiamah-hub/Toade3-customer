# Server-side audit: Supabase migrations 0001-0009

Static review only. No SQL was executed against any database. Scope: every file in `supabase/migrations/` (0001_profiles … 0009_rate_limits). Automated guard: `src/lib/security/__tests__/migrationAudit-test.ts` (fails CI if a later migration breaks the pass criteria below).

## Why this is the main control

Everything in the app (Hermes bytecode, `EXPO_PUBLIC_*` values) can be extracted. The publishable key is public by design: anyone can call the Data API with it plus their own user JWT, from `curl`, skipping every client check. The data stays safe only because of RLS, grants and the SECURITY DEFINER functions reviewed here.

## Pass criteria checked

| Check | Result |
|---|---|
| RLS enabled on every table the migrations create (`profiles`, `vendors`, `categories`, `products`, `product_categories`, `option_groups`, `options`, `cart_drafts`, `orders`, `order_items`, `ratelimit.limits`, `ratelimit.counters`) | Pass |
| Every `public` table starts from `revoke all ... from anon, authenticated` | Pass |
| No `grant all`; nothing granted to PUBLIC; anon gets SELECT only (catalog tables) | Pass |
| Column grants where intended: `profiles` insert/update are column lists (0001, 0003); `role`, `created_at`, `updated_at` not client-writable | Pass |
| Table-wide client writes only where reviewed: `cart_drafts` (S-5) | Pass (with S-5) |
| Every SECURITY DEFINER function has `set search_path = ''` (`handle_new_user`, `quote_delivery`, `place_order`, `cancel_order`, `ratelimit.subject/hit/check/enforce_trigger/prune`, `public.ratelimit_consume`) | Pass |
| Every SECURITY DEFINER function has EXECUTE revoked from PUBLIC (per function, or per schema for `ratelimit`) | Pass |
| Client-callable RPCs derive the caller from `auth.uid()` and accept no client-supplied user id | Pass (`quote_delivery`, `place_order`, `cancel_order`) |
| Prices / fees / totals computed only in the database | Pass (`place_order` reprices from `products` / `options`) |
| No private schema exposed | Pass: `ratelimit` has no USAGE for anon/authenticated and must never be added to the Data API exposed schemas |
| `public.ratelimit_consume` (service work) | Granted to `service_role` only |

## Findings

Severity: High = data exposure or privilege escalation; Medium = abuse with real cost; Low = hardening gap with limited impact; Info = acceptable, documented.

No High findings.

| ID | Sev | Where | Finding | Fix | Owner |
|---|---|---|---|---|---|
| S-1 | Medium | all write paths | No server-side rate limiting before 0009 | Fixed by `0009_rate_limits.sql` (profile + cart triggers). `place_order` / `cancel_order` need one line each (integration snippets 1-2), shipped in a new migration after 0009 | this workflow (done) + orders owner |
| S-2 | Medium | process / dashboard | Supabase default privileges grant new `public` tables, sequences and functions to anon/authenticated (and functions to PUBLIC). Each migration revokes explicitly today; one forgotten revoke exposes a table | Dashboard: Data API settings, turn off automatic exposure of new tables; revoke the default privileges per [Hardening the Data API](https://supabase.com/docs/guides/database/hardening-data-api). Keep explicit `revoke all` in every migration (guarded by the audit test) | orchestrator (release gate) |
| S-3 | Medium | Auth | `signInWithOtp({ shouldCreateUser: true })` lets anyone create accounts and trigger emails | Auth rate limits + custom SMTP + CAPTCHA (release gates) | orchestrator |
| S-12 | Medium | `0007` `place_order` | Orders are unpaid and decrement `products.stock` at `pending`. A scripted user can hold stock with many pending orders (cancel restores it), blocking real customers. 0009 caps at 5 orders/min once the owner line lands, which still allows thousands per day | Cap open orders per customer inside `place_order`, after the replay block: `if (select count(*) from public.orders o where o.customer_id = v_uid and o.status in ('pending','accepted')) >= 3 then raise exception 'TOO_MANY_OPEN_ORDERS' using errcode = 'T3013'; end if;` (new error code + client mapping), or decrement stock only at `accepted` | orders owner (product decision on the cap) |
| S-4 | Low | `0004` `products` | anon can read `stock`, `disabled`, `weight_g` and promo flags: inventory disclosure to competitors/scrapers | Column-level `grant select (…)` without `stock`, or a `products_public` view; the app needs `stock` only as "available" | catalog owner |
| S-5 | Low | `0005` `cart_drafts` | Table-wide `select, insert, update, delete` incl. client-set `updated_at`. RLS pins `customer_id`; size is bounded (50 lines, < 32 KB). A client can set a far-future `updated_at` and win last-write-wins on its own cart only | New owner migration with a BEFORE INSERT OR UPDATE trigger that clamps it: `new.updated_at := least(new.updated_at, now() + interval '5 minutes');`. A `check (updated_at <= now() + …)` also works at write time, but Postgres assumes CHECK conditions are immutable, so a dump/restore can fail on it; the trigger avoids that | cart owner |
| S-7 | Low | `0002` storage | Buckets have no `file_size_limit` / `allowed_mime_types`, so a signed-in user can upload any file of any size into their own `avatars/<uid>/` folder (storage cost). Avatar policies call `auth.uid()` per row instead of `(select auth.uid())` (performance only) | Owner migration: `update storage.buckets set file_size_limit = 2097152, allowed_mime_types = array['image/jpeg','image/png','image/webp'] where id = 'avatars';` and wrap `auth.uid()` in `(select …)` | storage owner |
| S-10 | Low | `0007` `quote_delivery` | STABLE, so PostgREST runs it READ ONLY and it can't be DB-rate-limited. Cheap (one vendor lookup) | Leave; if abused, make it `volatile` + `perform ratelimit.check('order.quote')` + a limits row | orders owner |
| S-13 | Low | `0007` `place_order` | Products are locked `for update` before the `published` / vendor check, so a caller can briefly lock unpublished product rows by id. Same error either way (no existence leak) | Add `and p.published` to the locking select | orders owner |
| S-6 | Info | `0001`/`0004` | `product_search_text` and `set_updated_at` keep PUBLIC EXECUTE. Pure text helper / trigger-only function; not definer | Acceptable | - |
| S-8 | Info | `0001`/`0003`/`0006`/`0007` | RLS on every client table; profiles use column grants; orders are read-only to clients; definer functions derive the user from `auth.uid()`; `t3_*` helpers revoked; errors don't reveal unpublished vendors/products | Pass | - |
| S-9 | Info | `0004` child policies | `product_categories` / `option_groups` / `options` policies check `p.published` only, but the subquery is itself filtered by the `products` policy (vendor published), so access is equivalent | Add a pgTAP case | catalog owner |
| S-11 | Info | schemas | No private schema exposed by 0001-0008; `ratelimit` (0009) has no client USAGE | Never add `ratelimit` to exposed schemas | - |
| S-14 | Info | `0006` | `orders.order_number` identity sequence gets Supabase's default sequence grants. Sequences are not reachable through PostgREST and `nextval` needs an exposed function, so no client path exists | Covered by S-2 default-privilege revoke | orchestrator |
| S-15 | Info | `0002` `food-images` | Public bucket with a public SELECT policy: anyone can list object names | Acceptable for menu photos; never put private files there | - |

## What this audit does not cover

- The live project: dashboard settings (exposed schemas, Auth limits, CAPTCHA, PostgREST version) can differ from the files. Verify before release.
- Runtime behaviour: nothing here was executed. Run `supabase test db` (pgTAP in `supabase/tests/`) on a local stack.
- Edge Functions: none exist yet (`supabase/functions/**` is owned by the notification workflow). They hold the secret key, so they need their own review: verify the JWT, never trust a body-supplied user id, call `public.ratelimit_consume` before work.
