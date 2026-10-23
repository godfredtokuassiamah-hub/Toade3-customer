// Regenerates supabase/migrations/0008_catalog_seed.sql from the mock data in
// src/data/mock/*.ts. Runs the seed drift test through jest (which already
// handles TypeScript and the image require()s) with T3_WRITE_SEED=1, so the
// builder in src/lib/backend/seed/buildSeedSql.ts writes the file.
//
// Usage: node scripts/generate-catalog-seed.js
const { spawnSync } = require("child_process");
const path = require("path");

const root = path.join(__dirname, "..");
const jest = path.join(root, "node_modules", "jest", "bin", "jest.js");

const result = spawnSync(
  process.execPath,
  [jest, "--ci", "src/lib/backend/__tests__/seed-drift-test.ts"],
  { cwd: root, stdio: "inherit", env: { ...process.env, T3_WRITE_SEED: "1" } },
);

if (result.status !== 0) {
  console.error("Seed generation failed.");
  process.exit(result.status ?? 1);
}
console.log("Wrote supabase/migrations/0008_catalog_seed.sql");
