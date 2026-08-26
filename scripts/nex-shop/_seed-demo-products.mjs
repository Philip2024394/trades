#!/usr/bin/env node
// scripts/nex-shop/_seed-demo-products.mjs
//
// Seed the minimum demo data for the marketplace vertical slice:
//   · 1 seller (Toko NEX Demo · status='active' for demo visibility)
//   · 5 products covering different variant patterns
//     - T-shirt (color × size)
//     - Phone (model × storage × color)
//     - Helmet (size × color × type)
//     - Chair (material × color × size)
//     - Hammer (no variants)
//
// Idempotent · uses ON CONFLICT keys · never generates fake numbers beyond
// what's necessary to prove the pipeline.

import pg from "pg";
const pool = new pg.Pool({ connectionString: process.env.NEX_POSTGRES_URL, max: 3 });

const IMG = {
  tshirt: "https://placehold.co/600x600/1a1a1a/ffffff.webp?text=T-Shirt",
  phone:  "https://placehold.co/600x600/0f172a/ffffff.webp?text=Phone",
  helmet: "https://placehold.co/600x600/374151/ffffff.webp?text=Helmet",
  chair:  "https://placehold.co/600x600/78716c/ffffff.webp?text=Chair",
  hammer: "https://placehold.co/600x600/475569/ffffff.webp?text=Hammer",
};

async function upsertSeller() {
  const q = await pool.query(`
    INSERT INTO nex.mp_seller (slug, display_name, city, jurisdiction, status, bio)
    VALUES ('toko-nex-demo', 'Toko NEX Demo', 'Yogyakarta', 'ID/DIY/Yogyakarta', 'active',
            'Demo seller · this is a NEX Marketplace vertical-slice fixture.')
    ON CONFLICT (slug) DO UPDATE SET display_name = EXCLUDED.display_name, updated_at = now()
    RETURNING seller_id`,
  );
  return q.rows[0].seller_id;
}

async function categoryIdByKey(key) {
  const q = await pool.query(`SELECT category_id FROM nex.mp_category WHERE key=$1`, [key]);
  return q.rows[0]?.category_id ?? null;
}

async function upsertProduct(sellerId, categoryId, slug, name, description, condition, hasVariants, basePriceIdr, baseStock, baseSku, imageUrl) {
  const p = await pool.query(`
    INSERT INTO nex.mp_product (seller_id, category_id, slug, name, description, condition, has_variants, base_price_idr, base_stock, base_sku, active)
    VALUES ($1,$2,$3,$4,$5,$6::nex.mp_product_condition,$7,$8,$9,$10,true)
    ON CONFLICT (slug) DO UPDATE SET
      seller_id=EXCLUDED.seller_id, category_id=EXCLUDED.category_id, name=EXCLUDED.name,
      description=EXCLUDED.description, condition=EXCLUDED.condition, has_variants=EXCLUDED.has_variants,
      base_price_idr=EXCLUDED.base_price_idr, base_stock=EXCLUDED.base_stock, base_sku=EXCLUDED.base_sku, updated_at=now()
    RETURNING product_id`,
    [sellerId, categoryId, slug, name, description, condition, hasVariants, basePriceIdr, baseStock, baseSku],
  );
  const productId = p.rows[0].product_id;
  await pool.query(`DELETE FROM nex.mp_product_image WHERE product_id=$1`, [productId]);
  if (imageUrl) {
    await pool.query(`INSERT INTO nex.mp_product_image (product_id, url, sort_order) VALUES ($1,$2,10)`, [productId, imageUrl]);
  }
  return productId;
}

async function upsertOption(productId, name, sortOrder) {
  const q = await pool.query(`
    INSERT INTO nex.mp_product_option (product_id, name, sort_order) VALUES ($1,$2,$3)
    ON CONFLICT (product_id, name) DO UPDATE SET sort_order = EXCLUDED.sort_order
    RETURNING option_id`,
    [productId, name, sortOrder],
  );
  return q.rows[0].option_id;
}

async function upsertOptionValue(optionId, value, sortOrder) {
  const q = await pool.query(`
    INSERT INTO nex.mp_product_option_value (option_id, value, sort_order) VALUES ($1,$2,$3)
    ON CONFLICT (option_id, value) DO UPDATE SET sort_order = EXCLUDED.sort_order
    RETURNING option_value_id`,
    [optionId, value, sortOrder],
  );
  return q.rows[0].option_value_id;
}

async function upsertVariant(productId, sku, priceIdr, stock, optionValueIds) {
  const sortedIds = [...optionValueIds].sort();
  await pool.query(`
    INSERT INTO nex.mp_product_variant (product_id, sku, price_idr, stock, active, option_value_ids)
    VALUES ($1,$2,$3,$4,true,$5::uuid[])
    ON CONFLICT (product_id, sku) DO UPDATE SET
      price_idr=EXCLUDED.price_idr, stock=EXCLUDED.stock, active=true, option_value_ids=EXCLUDED.option_value_ids`,
    [productId, sku, priceIdr, stock, sortedIds],
  );
}

async function seedTshirt(sellerId) {
  const catId = await categoryIdByKey("fashion");
  const productId = await upsertProduct(sellerId, catId, "nex-premium-tshirt",
    "NEX Premium T-shirt",
    "Soft cotton T-shirt · demo fixture for the NEX Marketplace variant engine.",
    "new", true, null, null, null, IMG.tshirt);

  const colorOpt = await upsertOption(productId, "Color", 10);
  const sizeOpt  = await upsertOption(productId, "Size", 20);
  const black = await upsertOptionValue(colorOpt, "Black", 10);
  const white = await upsertOptionValue(colorOpt, "White", 20);
  const m = await upsertOptionValue(sizeOpt, "M", 10);
  const l = await upsertOptionValue(sizeOpt, "L", 20);
  const xl = await upsertOptionValue(sizeOpt, "XL", 30);

  // 4 of the 6 possible combinations listed (2 intentionally unavailable)
  await upsertVariant(productId, "NEX-BLK-M",  145000, 3, [black, m]);
  await upsertVariant(productId, "NEX-BLK-L",  150000, 8, [black, l]);
  await upsertVariant(productId, "NEX-WHT-L",  150000, 0, [white, l]);   // out of stock demo
  await upsertVariant(productId, "NEX-WHT-XL", 155000, 3, [white, xl]);
  console.log(`  · T-shirt seeded (id=${productId})`);
}

async function seedPhone(sellerId) {
  const catId = await categoryIdByKey("phones");
  const productId = await upsertProduct(sellerId, catId, "nex-phone-a1",
    "NEX Phone A1",
    "Demo phone · model × storage × colour · showing 3-option variant support.",
    "new", true, null, null, null, IMG.phone);
  const modelOpt = await upsertOption(productId, "Model", 10);
  const storageOpt = await upsertOption(productId, "Storage", 20);
  const colorOpt = await upsertOption(productId, "Color", 30);
  const std = await upsertOptionValue(modelOpt, "Standard", 10);
  const pro = await upsertOptionValue(modelOpt, "Pro", 20);
  const s128 = await upsertOptionValue(storageOpt, "128GB", 10);
  const s256 = await upsertOptionValue(storageOpt, "256GB", 20);
  const black = await upsertOptionValue(colorOpt, "Black", 10);
  const silver = await upsertOptionValue(colorOpt, "Silver", 20);
  await upsertVariant(productId, "NEX-A1-STD-128-BLK", 3200000, 6, [std, s128, black]);
  await upsertVariant(productId, "NEX-A1-STD-256-BLK", 3600000, 4, [std, s256, black]);
  await upsertVariant(productId, "NEX-A1-PRO-256-BLK", 4400000, 2, [pro, s256, black]);
  await upsertVariant(productId, "NEX-A1-PRO-256-SLV", 4400000, 1, [pro, s256, silver]);
  console.log(`  · Phone seeded (id=${productId})`);
}

async function seedHelmet(sellerId) {
  const catId = await categoryIdByKey("motorbike");
  const productId = await upsertProduct(sellerId, catId, "nex-helmet-atlas",
    "NEX Atlas Motorbike Helmet",
    "Demo helmet · size × colour × type. Certified is a demo attribute · not an evidence claim.",
    "new", true, null, null, null, IMG.helmet);
  const sizeOpt = await upsertOption(productId, "Size", 10);
  const colorOpt = await upsertOption(productId, "Color", 20);
  const typeOpt = await upsertOption(productId, "Type", 30);
  const s = await upsertOptionValue(sizeOpt, "S", 10);
  const m = await upsertOptionValue(sizeOpt, "M", 20);
  const l = await upsertOptionValue(sizeOpt, "L", 30);
  const black = await upsertOptionValue(colorOpt, "Black", 10);
  const red = await upsertOptionValue(colorOpt, "Red", 20);
  const openface = await upsertOptionValue(typeOpt, "Open Face", 10);
  const fullface = await upsertOptionValue(typeOpt, "Full Face", 20);
  await upsertVariant(productId, "NEX-HELM-S-BLK-OF", 380000, 5, [s, black, openface]);
  await upsertVariant(productId, "NEX-HELM-M-BLK-OF", 380000, 8, [m, black, openface]);
  await upsertVariant(productId, "NEX-HELM-M-BLK-FF", 495000, 4, [m, black, fullface]);
  await upsertVariant(productId, "NEX-HELM-L-RED-FF", 520000, 2, [l, red, fullface]);
  console.log(`  · Helmet seeded (id=${productId})`);
}

async function seedChair(sellerId) {
  const catId = await categoryIdByKey("furniture");
  const productId = await upsertProduct(sellerId, catId, "nex-office-chair",
    "NEX Office Chair",
    "Demo office chair · material × colour × size. Local Yogyakarta workshop demo fixture.",
    "new", true, null, null, null, IMG.chair);
  const matOpt = await upsertOption(productId, "Material", 10);
  const colorOpt = await upsertOption(productId, "Color", 20);
  const sizeOpt = await upsertOption(productId, "Size", 30);
  const fabric = await upsertOptionValue(matOpt, "Fabric", 10);
  const leather = await upsertOptionValue(matOpt, "Faux Leather", 20);
  const black = await upsertOptionValue(colorOpt, "Black", 10);
  const grey = await upsertOptionValue(colorOpt, "Grey", 20);
  const regular = await upsertOptionValue(sizeOpt, "Regular", 10);
  const tall = await upsertOptionValue(sizeOpt, "Tall", 20);
  await upsertVariant(productId, "NEX-CHR-FAB-BLK-REG", 1250000, 3, [fabric, black, regular]);
  await upsertVariant(productId, "NEX-CHR-FAB-GRY-REG", 1250000, 2, [fabric, grey, regular]);
  await upsertVariant(productId, "NEX-CHR-LTH-BLK-TAL", 1650000, 1, [leather, black, tall]);
  console.log(`  · Chair seeded (id=${productId})`);
}

async function seedHammer(sellerId) {
  const catId = await categoryIdByKey("tools");
  await upsertProduct(sellerId, catId, "nex-classic-hammer",
    "NEX Classic Hammer",
    "Demo hammer · no variants · proves the simple-product path.",
    "new", false, 85000, 12, "NEX-HAMMER", IMG.hammer);
  console.log(`  · Hammer seeded (no variants)`);
}

async function main() {
  console.log("╔══════════════════════════════════════════════════════════════════════════╗");
  console.log("║  NEX MARKETPLACE · demo product seeder                                    ║");
  console.log("║  1 seller · 5 products · covers variant + no-variant patterns             ║");
  console.log("╚══════════════════════════════════════════════════════════════════════════╝\n");
  const sellerId = await upsertSeller();
  console.log(`Seller ready · id=${sellerId}`);
  await seedTshirt(sellerId);
  await seedPhone(sellerId);
  await seedHelmet(sellerId);
  await seedChair(sellerId);
  await seedHammer(sellerId);
  console.log("\nDone. Visit /nex-shop to see the marketplace.");
  await pool.end();
}
main().catch((e) => { console.error(e); process.exit(1); });
