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

// Find Aisha's Leica M3 · fallback to her first product if the name doesn't match.
const found = await pg.query<{ id: string; name: string }>(
  `SELECT p.id, p.name
   FROM nex_product p
   JOIN nex_business b ON b.id = p.business_id
   WHERE b.slug = 'aisha-vintage-cameras'
   ORDER BY p.created_at ASC
   LIMIT 5`,
);
console.log("Aisha products:", found.rows);

const leica = found.rows.find((r) => /leica/i.test(r.name)) ?? found.rows[0];
if (!leica) {
  console.log("no products found for aisha-vintage-cameras");
  await pg.end();
  process.exit(0);
}

const spec = {
  brand: "Leica",
  model: "M3 Double-Stroke",
  condition: "vintage",
  authenticity: "authenticated_vintage",
  origin: "Wetzlar, Germany",
  year_produced: 1954,
  materials: ["brass", "vulcanite", "chrome-plated steel", "leather"],
  dimensions: { w: 138, h: 77, d: 33, unit: "mm" },
  weight: { value: 580, unit: "g" },
  included: [
    "Leica M3 body (serial no. 785943)",
    "50mm Summicron f/2 collapsible lens",
    "Original leather case (mild wear)",
    "Original manual (Bahasa Inggris)",
    "CLA service certificate · 2024 · Prakosa Camera Service Jakarta",
  ],
  warranty: "30-day return · CLA'd + tested by an authorised Leica technician",
  certifications: ["Prakosa Camera CLA · 2024"],
  care_instructions:
    "Store in low humidity · use rear cap when not shooting · CLA every 5-8 years",
};

await pg.query(
  `UPDATE nex_product SET spec = $1::jsonb WHERE id = $2`,
  [JSON.stringify(spec), leica.id],
);
console.log(`Updated spec on ${leica.name} (${leica.id})`);
await pg.end();
