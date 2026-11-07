/// <reference types="jest" />
// The client ETA model and the SQL public.t3_order_eta (0010) must use the
// same constants. Parsed from the ETA_MODEL_BEGIN/END block of 0010.
import { fs, repoPath } from "../../backend/__fixtures__/nodeFs";
import { ETA_MODEL } from "../etaModel";

const sql = fs.readFileSync(repoPath("supabase/migrations/0010_order_eta.sql"), "utf8");
const start = sql.indexOf("-- ETA_MODEL_BEGIN");
const end = sql.indexOf("-- ETA_MODEL_END");

const snake = (k: string) => k.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);

describe("ETA model: client vs SQL", () => {
  test("block exists", () => {
    expect(start).toBeGreaterThan(0);
    expect(end).toBeGreaterThan(start);
  });

  test("every constant matches", () => {
    const block = sql.slice(start, end);
    const parsed = Object.fromEntries(
      [...block.matchAll(/c_(\w+) constant double precision := ([\d.]+);/g)].map((m) => [m[1], Number(m[2])]),
    );
    const expected = Object.fromEntries(Object.entries(ETA_MODEL).map(([k, v]) => [snake(k), v]));
    expect(parsed).toEqual(expected);
  });

  test("accept deadline matches acceptTimeoutMins", () => {
    expect(sql).toContain(`p_order.created_at + interval '${ETA_MODEL.acceptTimeoutMins} minutes'`);
  });
});
