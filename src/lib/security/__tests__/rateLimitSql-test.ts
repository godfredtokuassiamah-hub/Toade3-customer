/// <reference types="jest" />
// Static guard for supabase/migrations/0009_rate_limits.sql (never executed
// here): the seeded limits equal SERVER_RATE_LIMITS, every SECURITY DEFINER
// function pins an empty search_path, no client role is granted anything,
// and the error contract matches rateLimitError.ts.
import { fs, repoPath } from "../../backend/__fixtures__/nodeFs";
import { SERVER_RATE_LIMITS } from "../rateLimit";
import { RATE_LIMIT_CODE, RATE_LIMITED } from "../rateLimitError";

const MIGRATION = "supabase/migrations/0009_rate_limits.sql";
const sql = fs.readFileSync(repoPath(MIGRATION), "utf8");

// SQL without `--` comments (so commented examples don't satisfy checks).
const code = sql
  .split("\n")
  .map((line) => line.replace(/--.*$/, ""))
  .join("\n");

describe("0009_rate_limits.sql", () => {
  test("RATE_LIMITS block equals SERVER_RATE_LIMITS", () => {
    const start = sql.indexOf("-- RATE_LIMITS_BEGIN");
    const end = sql.indexOf("-- RATE_LIMITS_END");
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    const rows = [...sql.slice(start, end).matchAll(/\(\s*'([a-z][a-z0-9_.]+)',\s*(\d+),\s*(\d+),/g)].map(
      (m) => [m[1], { max: Number(m[2]), windowSeconds: Number(m[3]) }] as const,
    );
    expect(Object.fromEntries(rows)).toEqual(SERVER_RATE_LIMITS);
  });

  test("every function is SECURITY DEFINER with set search_path = ''", () => {
    const fns = code.split(/create or replace function/i).slice(1);
    expect(fns.length).toBeGreaterThanOrEqual(6);
    for (const fn of fns) {
      const header = fn.slice(0, fn.indexOf("$$"));
      const name = header.trim().split("(")[0];
      expect({ name, definer: /security definer/i.test(header) }).toEqual({ name, definer: true });
      expect({ name, searchPath: /set search_path = ''/i.test(header) }).toEqual({ name, searchPath: true });
    }
  });

  test("no grants to anon / authenticated / public; schema and functions revoked", () => {
    expect(code).not.toMatch(/grant[^;]*\bto\s+(anon|authenticated|public)\b/i);
    expect(code).toMatch(/revoke all on schema ratelimit from public, anon, authenticated;/);
    expect(code).toMatch(/revoke execute on all functions in schema ratelimit from public, anon, authenticated;/);
    expect(code).toMatch(/revoke all on all tables in schema ratelimit from public, anon, authenticated;/);
    expect(code).toMatch(
      /revoke execute on function public\.ratelimit_consume\(text, text\) from public, anon, authenticated;/,
    );
    expect(code).toMatch(/grant execute on function public\.ratelimit_consume\(text, text\) to service_role;/);
  });

  test("only ratelimit_consume is created in public", () => {
    const publicFns = [...code.matchAll(/create or replace function public\.(\w+)/gi)].map((m) => m[1]);
    expect(publicFns).toEqual(["ratelimit_consume"]);
    expect(code).not.toMatch(/create table[^;]*public\./i);
  });

  test("RLS is enabled on both ratelimit tables", () => {
    expect(code).toMatch(/alter table ratelimit\.limits enable row level security;/);
    expect(code).toMatch(/alter table ratelimit\.counters enable row level security;/);
  });

  test("error contract matches the client (T3429, RATE_LIMITED, 429, Retry-After)", () => {
    expect(code).toMatch(/raise sqlstate 'PGRST'/);
    expect(code).toContain(`'code', '${RATE_LIMIT_CODE}'`);
    expect(code).toContain(`'message', '${RATE_LIMITED}'`);
    expect(code).toContain("'status', 429");
    expect(code).toContain("'Retry-After'");
    expect(code).toContain("'retry_after'");
  });

  test("triggers are AFTER row triggers on profiles and cart_drafts", () => {
    expect(code).toMatch(
      /create trigger profiles_rate_limit\s+after insert or update on public\.profiles\s+for each row execute function ratelimit\.enforce_trigger\('profile\.write'\)/,
    );
    expect(code).toMatch(
      /create trigger cart_drafts_rate_limit\s+after insert or update on public\.cart_drafts\s+for each row execute function ratelimit\.enforce_trigger\('cart\.write'\)/,
    );
  });

  test("the pgTAP file exists and plans its tests", () => {
    const t = fs.readFileSync(repoPath("supabase/tests/ratelimit/01_ratelimit.test.sql"), "utf8");
    const planned = Number(/select plan\((\d+)\);/.exec(t)?.[1]);
    // Every assertion is a top-level `select <fn>(` statement.
    const assertions = (
      t.match(
        /^select (has_schema|ok|is|results_eq|has_trigger|throws_ok|lives_ok)\(/gm,
      ) ?? []
    ).length;
    expect(planned).toBe(assertions);
  });
});
