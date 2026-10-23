// 0008_catalog_seed.sql must equal what the builder generates from the
// current mock data. With T3_WRITE_SEED=1 (scripts/generate-catalog-seed.js)
// it (re)writes the file instead of comparing.
import { ITEMS, VENDORS } from "../../../data/mock/catalog";
import { getCompareAtMinor, getOptionGroups } from "../../../data/mock/itemOptions";
import { STORES } from "../../../data/mock/stores";
import { buildSeedSql, seedCounts } from "../seed/buildSeedSql";
import { fs, repoPath } from "../__fixtures__/nodeFs";

const SEED_PATH = repoPath("supabase/migrations/0008_catalog_seed.sql");

describe("catalog seed", () => {
  const sql = buildSeedSql();

  it("is up to date with the mock data", () => {
    if (process.env.T3_WRITE_SEED === "1") {
      fs.writeFileSync(SEED_PATH, sql, "utf8");
    }
    const onDisk = fs.readFileSync(SEED_PATH, "utf8").replace(/\r\n/g, "\n");
    expect(onDisk).toBe(sql);
  });

  it("covers every mock vendor, store and item by legacy id", () => {
    for (const v of VENDORS) expect(sql).toContain(`'${v.vendor_id}'`);
    for (const s of STORES) expect(sql).toContain(`'${s.id}'`);
    for (const i of ITEMS) expect(sql).toContain(`'${i.item_id}'`);
    const counts = seedCounts();
    expect(counts.products).toBe(ITEMS.length);
    expect(sql).toContain(`${counts.products} products`);
  });

  it("satisfies the 0004 check constraints (so the seed can't fail on insert)", () => {
    for (const i of ITEMS) {
      expect(i.price_minor).toBeGreaterThanOrEqual(0);
      expect(i.stock).toBeGreaterThanOrEqual(0);
      if (i.weight_g != null) expect(i.weight_g).toBeGreaterThan(0);
      expect(i.eta_mins).toBeGreaterThanOrEqual(0);
      expect(i.eta_mins).toBeLessThanOrEqual(240);
      if (i.discountPercent != null) {
        expect(i.discountPercent).toBeGreaterThanOrEqual(1);
        expect(i.discountPercent).toBeLessThanOrEqual(90);
      }
      const compareAt = getCompareAtMinor(i.item_id, i.price_minor);
      if (compareAt != null) expect(compareAt).toBeGreaterThan(i.price_minor);
      expect(VENDORS.some((v) => v.vendor_id === i.vendor_id)).toBe(true);
      for (const g of getOptionGroups(i.item_id, i.category_ids)) {
        expect(g.max).toBeGreaterThanOrEqual(1);
        expect(g.min).toBeLessThanOrEqual(g.max);
        expect(g.required ? g.min >= 1 : g.min === 0).toBe(true);
        for (const o of g.options) expect(o.priceMinor).toBeGreaterThanOrEqual(0);
      }
    }
    for (const s of STORES) {
      expect(s.prepMins[0]).toBeLessThanOrEqual(s.prepMins[1]);
      expect(s.id).toMatch(/^[a-z0-9][a-z0-9-]{0,79}$/);
      if (s.vendorId) expect(VENDORS.some((v) => v.vendor_id === s.vendorId)).toBe(true);
    }
    for (const v of VENDORS) expect(v.vendor_id).toMatch(/^[a-z0-9][a-z0-9-]{0,79}$/);
  });

  it("never seeds image paths", () => {
    expect(sql).not.toMatch(/image_path = excluded/);
  });

  it("has balanced quotes per statement", () => {
    // Every statement ends with ';' and has an even number of single quotes
    // (doubled '' escapes keep parity).
    const body = sql.replace(/^--.*$/gm, "");
    for (const stmt of body.split(/;\s*\n/).filter((s) => s.trim())) {
      expect((stmt.match(/'/g) ?? []).length % 2).toBe(0);
    }
  });
});
