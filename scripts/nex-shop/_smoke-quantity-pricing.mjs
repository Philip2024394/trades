// End-to-end smoke: insert a product with tiers · read it back · confirm tiers survive.
import pg from "pg";
const pool = new pg.Pool({ connectionString: process.env.NEX_POSTGRES_URL ?? "postgresql://postgres:Admin1phil@localhost:5433/nex_dev" });

const sellerQ = await pool.query(`SELECT seller_id FROM nex.mp_seller WHERE slug = 'toko-nex-demo' LIMIT 1`);
if (sellerQ.rowCount === 0) { console.log("No demo seller · run seed first"); process.exit(1); }
const sellerId = sellerQ.rows[0].seller_id;

const slug = "smoke-helmet-" + Math.random().toString(36).slice(2, 6);
const tiers = JSON.stringify([{ minQty: 2, pricePerUnitIdr: 142500 }, { minQty: 3, pricePerUnitIdr: 135000 }, { minQty: 5, pricePerUnitIdr: 125000 }]);

console.log("── INSERT test product with 3 tiers ──");
const ins = await pool.query(
  `INSERT INTO nex.mp_product (seller_id, slug, name, condition, has_variants, base_price_idr, base_stock, base_sku, qty_price_tiers, active)
   VALUES ($1,$2,$3,'new'::nex.mp_product_condition,false,150000,20,'NEX-HELMET-SMOKE',$4::jsonb,true)
   RETURNING product_id, slug, base_price_idr, qty_price_tiers`,
  [sellerId, slug, "Smoke Test Helmet", tiers],
);
console.log("  product_id      :", ins.rows[0].product_id);
console.log("  slug            :", ins.rows[0].slug);
console.log("  base_price_idr  :", ins.rows[0].base_price_idr);
console.log("  qty_price_tiers :", JSON.stringify(ins.rows[0].qty_price_tiers));

console.log("\n── RE-READ from DB ──");
const rd = await pool.query(`SELECT qty_price_tiers FROM nex.mp_product WHERE slug=$1`, [slug]);
console.log("  qty_price_tiers :", JSON.stringify(rd.rows[0].qty_price_tiers));
console.log("  match           :", JSON.stringify(rd.rows[0].qty_price_tiers) === tiers);

console.log("\n── Test DB CHECK rejects broken shapes ──");
const badCases = [
  { name: "minQty < 2",                 t: '[{"minQty":1,"pricePerUnitIdr":140000}]' },
  { name: "non-descending price",       t: '[{"minQty":2,"pricePerUnitIdr":140000},{"minQty":3,"pricePerUnitIdr":145000}]' },
  { name: "non-ascending minQty",       t: '[{"minQty":3,"pricePerUnitIdr":140000},{"minQty":2,"pricePerUnitIdr":135000}]' },
  { name: "zero price",                 t: '[{"minQty":2,"pricePerUnitIdr":0}]' },
  { name: "not an array",               t: '{"minQty":2,"pricePerUnitIdr":140000}' },
];
for (const c of badCases) {
  try {
    await pool.query(
      `INSERT INTO nex.mp_product (seller_id, slug, name, condition, has_variants, base_price_idr, base_stock, base_sku, qty_price_tiers, active)
       VALUES ($1,$2,'reject-test','new'::nex.mp_product_condition,false,150000,1,'X',$3::jsonb,true)`,
      [sellerId, "reject-" + Math.random().toString(36).slice(2, 8), c.t],
    );
    console.log(`  ✗ CHECK failed to reject: ${c.name}`);
  } catch (e) {
    console.log(`  ✓ CHECK rejected: ${c.name}`);
  }
}

console.log("\n── Test qty_tiers_only_when_no_variants ──");
try {
  await pool.query(
    `INSERT INTO nex.mp_product (seller_id, slug, name, condition, has_variants, qty_price_tiers, active)
     VALUES ($1,$2,'variant+tiers','new'::nex.mp_product_condition,true,'[{"minQty":2,"pricePerUnitIdr":140000}]'::jsonb,true)`,
    [sellerId, "variant-reject-" + Math.random().toString(36).slice(2, 8)],
  );
  console.log("  ✗ CHECK failed to reject variant product with tiers");
} catch {
  console.log("  ✓ CHECK rejected variant product with tiers");
}

console.log("\n── Cleanup smoke product ──");
await pool.query(`DELETE FROM nex.mp_product WHERE slug=$1`, [slug]);
console.log("  deleted");

await pool.end();
console.log("\n✓ end-to-end smoke complete");
