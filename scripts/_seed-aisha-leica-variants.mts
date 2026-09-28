import { Client as PgClient } from "pg";
import * as fs from "node:fs";
import * as path from "node:path";

const envPath = path.join(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (m && !process.env[m[1]!]) {
      process.env[m[1]!] = m[2]!.replace(/^["']|["']$/g, "");
    }
  }
}

const pg = new PgClient({ connectionString: process.env.DATABASE_URL! });
await pg.connect();
const leicaId = "d3e7f000-0002-b001-4a00-000000000101";

// Wipe any existing variants first so re-runs are idempotent.
await pg.query(`DELETE FROM nex_product_variant WHERE product_id = $1`, [leicaId]);

const variants: Array<{
  name: string;
  attribute: string;
  price_pence: number | null;
  stock_status: string | null;
  position: number;
}> = [
  // Finish axis
  { name: "Chrome", attribute: "finish", price_pence: null, stock_status: null, position: 0 },
  { name: "Black paint", attribute: "finish", price_pence: 35_000_000, stock_status: null, position: 1 },
  { name: "Olive (rare)", attribute: "finish", price_pence: 65_000_000, stock_status: "sold_out", position: 2 },

  // Package axis
  { name: "Body only", attribute: "package", price_pence: null, stock_status: null, position: 0 },
  { name: "Body + Summicron 50mm", attribute: "package", price_pence: 42_000_000, stock_status: null, position: 1 },
  { name: "Body + Summicron + case", attribute: "package", price_pence: 48_000_000, stock_status: "low_stock", position: 2 },
];

for (const v of variants) {
  await pg.query(
    `INSERT INTO nex_product_variant (product_id, name, attribute, price_pence, stock_status, position)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [leicaId, v.name, v.attribute, v.price_pence, v.stock_status, v.position],
  );
}
console.log(`Seeded ${variants.length} variants on Leica M3`);
await pg.end();
