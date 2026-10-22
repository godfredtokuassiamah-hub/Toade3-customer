# ADR-0004: Edge Function source isolation and sharing the pure core with Deno

Status: Proposed (Phase A, 20 Oct 2026; revised 21 Oct 2026 for design review). Workflow decision 2: "Put pure worker logic… in shared TS that's unit-tested with jest in this repo", and "type-check the Edge Function sources if feasible".

## Context

- Root `tsconfig.json` includes `**/*.ts` with no `exclude`, so `supabase/functions/**` would be type-checked by `npx tsc --noEmit` against React Native types and fail on `Deno`, `npm:` and `jsr:` specifiers.
- `eslint.config.js` (expo flat config) lints everything except `dist/*`.
- Jest `roots: ["<rootDir>/src"]`, so it never sees `supabase/`.
- Supabase docs (`guides/functions/dependencies`, `development-tips`): each function has its own `deno.json` with an `imports` map. Shared code goes in a `_shared` folder inside `supabase/functions`. The docs don't cover importing files outside `supabase/functions`, so that is not relied on.
- Deno requires explicit file extensions on relative imports. The app's Metro, TS and Jest code uses extensionless imports.
- No Deno and no Supabase CLI are installed here. Node is 22.14.

## Decision

1. **Single source of truth:** `src/shared/notifications/core/**`. Pure TS with relative extensionless imports inside `core/` only. Allowed globals (same list as design §2.1 and the purity test): `Math`, `Date`, `JSON`, `Intl`, `URL`, `TextEncoder`. No `react-native`, `expo-*`, `@supabase/*` or Node imports. Enforced by a jest import-scan test.
2. **Generated Deno copy:** `supabase/functions/_shared/notifications-core/**`. Each file is the core file with relative specifiers rewritten `./x` → `./x.ts` and a header `// GENERATED from src/shared/notifications/core/<path>. Do not edit.`. Test files are excluded.
3. **One generator, inside jest:** `src/shared/notifications/__tests__/generatedArtifacts-test.ts` renders (a) the Deno copy and (b) `supabase/migrations/0005_messaging_policy_seed.sql` (registry JSON, `POLICY_VERSION`, content hash) from the core.
   - Normal run: asserts the files on disk equal the rendered output, so drift fails the suite.
   - With `NOTIF_WRITE_ARTIFACTS=1` it writes them. PowerShell: `$env:NOTIF_WRITE_ARTIFACTS='1'; npx jest generatedArtifacts; Remove-Item Env:NOTIF_WRITE_ARTIFACTS`.
   No new script runtime or dependency.
   - 0005 is idempotent and atomic: inside one explicit `begin; … commit;` it first deactivates every other version (`update … set active = false where active and version <> POLICY_VERSION`), then upserts the current row with `active = true` (`on conflict (version) do update`). Two statements rather than one because the partial unique index on `active` is checked per row and a single flipping UPDATE could hit a transient violation. Capability rows use `on conflict do nothing` so operator choices survive.
   - Run order after a registry change (SETUP and runbook): re-run 0005, then deploy `messaging-worker`. Between the two, consume stops with `policy_mismatch` (messages stay queued, health degraded). That pause is expected and ends on deploy.
4. **Root isolation:**
   - `tsconfig.json`: add `"exclude"` re-listing the base entries plus `supabase/functions`: `["node_modules", "babel.config.js", "metro.config.js", "jest.config.js", "android", "ios", "supabase/functions"]`. A local `exclude` replaces the base one.
   - `eslint.config.js`: `ignores: ['dist/*', 'supabase/functions/**']`.
   - Jest needs no change.
5. **Separate type-check:** `supabase/functions/tsconfig.json` with `strict`, `noEmit`, `allowImportingTsExtensions`, `module: "preserve"`, `moduleResolution: "bundler"`, `target: "ES2022"`, `lib: ["ES2022", "DOM", "DOM.Iterable"]` (fetch, Request, Response, crypto.subtle), `types: []`, `skipLibCheck`, `include: ["**/*.ts"]`. Run with `npx tsc -p supabase/functions/tsconfig.json`.
   - `_shared/deno-shim.d.ts` declares only what is used: `Deno.env.get` and `Deno.serve`.
   - Functions import `@supabase/supabase-js` by bare specifier. Each function's `deno.json` maps it to `npm:@supabase/supabase-js@2.118.0` (pinned to the app's installed version). tsc resolves the bare specifier from the root `node_modules`, so both toolchains see the same types.
   - No other third-party imports. `@supabase/server` is not used: auth checks are written out explicitly (design §7).
6. **Release gate R-9:** `deno check supabase/functions/*/index.ts` and a local `supabase functions serve` smoke test on a machine with Deno and the CLI. tsc against shims is not proof that the Deno runtime resolves everything.

## Consequences

- One source, jest-tested once. Deno gets byte-identical logic apart from specifiers.
- Forgetting to regenerate fails CI and local `npm test`. It never ships stale.
- Root tsc, lint and jest baselines stay unaffected by Deno code.
- If the docs later confirm out-of-tree imports work in the bundler, the copy can be replaced by direct imports. Only the generator test changes.
