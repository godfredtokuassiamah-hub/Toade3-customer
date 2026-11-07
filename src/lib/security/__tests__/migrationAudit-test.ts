/// <reference types="jest" />
// Static server-side audit guard (Docs/security/server-audit.md). Reads the
// migration files only; nothing is executed against a database. It pins the
// properties the publishable key relies on:
//   - RLS enabled on every table the migrations create
//   - every client table starts from an explicit `revoke all`
//   - no `grant all`, nothing granted to PUBLIC, anon gets SELECT only
//   - table-wide client writes only where reviewed (column grants elsewhere)
//   - every SECURITY DEFINER function pins `set search_path = ''` and has its
//     EXECUTE revoked from PUBLIC
//   - client-callable definer RPCs derive the caller from auth.uid() and take
//     no caller-supplied user id
import { repoPath } from "../../backend/__fixtures__/nodeFs";

const fs = jest.requireActual<{
  readFileSync(path: string, encoding: "utf8"): string;
  readdirSync(path: string): string[];
}>("fs");

const MIGRATIONS = [
  "0001_profiles.sql",
  "0002_storage.sql",
  "0003_profile_address.sql",
  "0004_catalog.sql",
  "0005_cart_drafts.sql",
  "0006_orders.sql",
  "0007_order_functions.sql",
  "0008_catalog_seed.sql",
  "0009_rate_limits.sql",
  "0010_order_eta.sql",
];

// Table-wide INSERT/UPDATE/DELETE grants to `authenticated` that were
// reviewed (finding S-5). Everything else must use column grants or RPCs.
const TABLE_WIDE_WRITE_ALLOWLIST = new Set(["public.cart_drafts"]);

const stripComments = (sql: string) =>
  sql
    .split("\n")
    .map((line) => line.replace(/--.*$/, ""))
    .join("\n");

const files = MIGRATIONS.map((name) => ({
  name,
  code: stripComments(fs.readFileSync(repoPath(`supabase/migrations/${name}`), "utf8")),
}));
const all = files.map((f) => f.code).join("\n");

type Fn = { file: string; name: string; header: string; body: string };

// `create or replace function <name>(...) ... as $$ <body> $$;`
function functions(): Fn[] {
  const out: Fn[] = [];
  for (const f of files) {
    const parts = f.code.split(/create or replace function\s+/i).slice(1);
    for (const part of parts) {
      const open = part.indexOf("$$");
      const close = part.indexOf("$$", open + 2);
      out.push({
        file: f.name,
        name: part.slice(0, part.indexOf("(")).trim().toLowerCase(),
        header: part.slice(0, open),
        body: part.slice(open + 2, close),
      });
    }
  }
  return out;
}

type Grant = { file: string; privileges: string; object: string; grantees: string[] };

function grants(): Grant[] {
  const out: Grant[] = [];
  for (const f of files) {
    for (const m of f.code.matchAll(/\bgrant\s+([^;]+?)\s+on\s+([^;]+?)\s+to\s+([^;]+);/gi)) {
      out.push({
        file: f.name,
        privileges: m[1].replace(/\s+/g, " ").trim().toLowerCase(),
        object: m[2].replace(/\s+/g, " ").trim().toLowerCase(),
        grantees: m[3].split(",").map((g) => g.trim().toLowerCase()),
      });
    }
  }
  return out;
}

describe("migration audit (static)", () => {
  test("the audited list matches the migrations folder", () => {
    const onDisk = fs
      .readdirSync(repoPath("supabase/migrations"))
      .filter((n) => n.endsWith(".sql"))
      .sort();
    expect(onDisk).toEqual(MIGRATIONS);
  });

  test("every created table enables row level security", () => {
    const tables = [...all.matchAll(/create table (?:if not exists )?([a-z_]+\.[a-z_]+)/gi)].map((m) =>
      m[1].toLowerCase(),
    );
    expect(tables.length).toBeGreaterThan(0);
    for (const t of tables) {
      const rls = new RegExp(`alter table ${t.replace(".", "\\.")} enable row level security`, "i");
      expect({ table: t, rls: rls.test(all) }).toEqual({ table: t, rls: true });
    }
  });

  test("every public table starts from an explicit revoke all", () => {
    const tables = [...all.matchAll(/create table (?:if not exists )?(public\.[a-z_]+)/gi)].map((m) =>
      m[1].toLowerCase(),
    );
    for (const t of tables) {
      const revoke = new RegExp(
        `revoke all on ${t.replace(".", "\\.")} from (public, )?anon, authenticated`,
        "i",
      );
      expect({ table: t, revoked: revoke.test(all) }).toEqual({ table: t, revoked: true });
    }
  });

  test("no grant all, nothing to PUBLIC, anon gets SELECT only", () => {
    const list = grants();
    expect(list.length).toBeGreaterThan(0);
    for (const g of list) {
      const label = `${g.file}: grant ${g.privileges} on ${g.object}`;
      expect({ label, all: /^all\b/.test(g.privileges) }).toEqual({ label, all: false });
      expect({ label, toPublic: g.grantees.includes("public") }).toEqual({ label, toPublic: false });
      if (g.grantees.includes("anon")) {
        expect({ label, privileges: g.privileges }).toEqual({ label, privileges: "select" });
      }
    }
  });

  test("table-wide client writes only on reviewed tables", () => {
    for (const g of grants()) {
      if (!g.grantees.includes("authenticated") || g.object.startsWith("function ")) continue;
      // Column grants look like `insert (a, b)`; table-wide ones have no list.
      const tableWide = g.privileges
        .split(/,(?![^(]*\))/)
        .map((p) => p.trim())
        .filter((p) => /^(insert|update|delete)$/.test(p));
      if (tableWide.length === 0) continue;
      expect({ table: g.object, allowed: TABLE_WIDE_WRITE_ALLOWLIST.has(g.object) }).toEqual({
        table: g.object,
        allowed: true,
      });
    }
  });

  test("every SECURITY DEFINER function pins an empty search_path", () => {
    const definers = functions().filter((f) => /security definer/i.test(f.header));
    expect(definers.length).toBeGreaterThanOrEqual(10);
    for (const f of definers) {
      expect({ fn: f.name, searchPath: /set search_path = ''/i.test(f.header) }).toEqual({
        fn: f.name,
        searchPath: true,
      });
    }
  });

  test("every SECURITY DEFINER function has EXECUTE revoked from PUBLIC", () => {
    for (const f of functions().filter((fn) => /security definer/i.test(fn.header))) {
      const schema = f.name.split(".")[0];
      const own = new RegExp(
        `revoke execute on function ${f.name.replace(".", "\\.")}\\([^)]*\\)\\s+from public\\b`,
        "i",
      );
      const bySchema = new RegExp(
        `revoke execute on all functions in schema ${schema} from public\\b`,
        "i",
      );
      const revoked = own.test(all) || (schema !== "public" && bySchema.test(all));
      expect({ fn: f.name, revoked }).toEqual({ fn: f.name, revoked: true });
    }
  });

  test("client-callable definer RPCs use auth.uid() and take no user id", () => {
    const clientFns = new Set(
      grants()
        .filter((g) => g.privileges === "execute" && g.grantees.includes("authenticated"))
        .map((g) => g.object.replace(/^function\s+/, "").split("(")[0]),
    );
    expect(clientFns.size).toBeGreaterThan(0);
    for (const f of functions().filter((fn) => clientFns.has(fn.name))) {
      const params = f.header.slice(f.header.indexOf("("), f.header.indexOf(")") + 1);
      expect({ fn: f.name, usesAuthUid: /auth\.uid\(\)/i.test(f.body) }).toEqual({
        fn: f.name,
        usesAuthUid: true,
      });
      expect({ fn: f.name, userParam: /\bp_(user|customer|owner)(_id)?\b|\bp_uid\b/i.test(params) }).toEqual({
        fn: f.name,
        userParam: false,
      });
    }
  });

  test("service-only functions are granted to service_role only", () => {
    for (const g of grants().filter((x) => /ratelimit_consume/.test(x.object))) {
      expect(g.grantees).toEqual(["service_role"]);
    }
  });
});
