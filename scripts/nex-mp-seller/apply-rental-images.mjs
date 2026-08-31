// scripts/nex-mp-seller/apply-rental-images.mjs · Philip 2026-08-28.
//
// STRICT 1:1 · 1 image = 1 seller (no duplicate images).
// Apply Philip-provided ImageKit URLs to mp_seller rentals that have no image.
//
// Usage:
//   node scripts/nex-mp-seller/apply-rental-images.mjs           # dry run
//   node scripts/nex-mp-seller/apply-rental-images.mjs --apply   # write

import pg from "pg";

const APPLY = process.argv.includes("--apply");

// ─── PHILIP'S IMAGE SETS (2026-08-28 · pasted from chat) ──────────────────

const MOTORBIKE_HIRE_URLS = [
  "https://ik.imagekit.io/nepgaxllc/ChatGPT%20Image%20May%2029,%202026,%2005_11_26%20AM.png?updatedAt=1780006300363",
  "https://ik.imagekit.io/nepgaxllc/ChatGPT%20Image%20May%2029,%202026,%2004_29_28%20AM.png?updatedAt=1780003782219",
  "https://ik.imagekit.io/nepgaxllc/ChatGPT%20Image%20May%2029,%202026,%2004_25_59%20AM.png?updatedAt=1780003571366",
  "https://ik.imagekit.io/nepgaxllc/ChatGPT%20Image%20May%2029,%202026,%2004_23_57%20AM.png?updatedAt=1780003452461",
  "https://ik.imagekit.io/nepgaxllc/ChatGPT%20Image%20May%2029,%202026,%2004_19_37%20AM.png?updatedAt=1780003190633",
  "https://ik.imagekit.io/nepgaxllc/ChatGPT%20Image%20May%2029,%202026,%2004_19_14%20AM.png?updatedAt=1780003168245",
  "https://ik.imagekit.io/nepgaxllc/ChatGPT%20Image%20May%2029,%202026,%2004_17_32%20AM.png?updatedAt=1780003065448",
  "https://ik.imagekit.io/nepgaxllc/ChatGPT%20Image%20May%2029,%202026,%2004_15_44%20AM.png?updatedAt=1780002958218",
  "https://ik.imagekit.io/nepgaxllc/ChatGPT%20Image%20May%2029,%202026,%2004_14_50%20AM.png?updatedAt=1780002903980",
];

const CAR_RENTAL_URLS = [
  "https://ik.imagekit.io/nepgaxllc/ChatGPT%20Image%20May%2028,%202026,%2004_11_40%20AM.png?updatedAt=1779916315939",
  "https://ik.imagekit.io/nepgaxllc/ChatGPT%20Image%20May%2028,%202026,%2004_08_53%20AM.png?updatedAt=1779916147705",
  "https://ik.imagekit.io/nepgaxllc/ChatGPT%20Image%20May%2028,%202026,%2004_07_14%20AM.png?updatedAt=1779916048442",
  "https://ik.imagekit.io/nepgaxllc/ChatGPT%20Image%20May%2028,%202026,%2004_05_49%20AM.png?updatedAt=1779915964469",
  "https://ik.imagekit.io/nepgaxllc/ChatGPT%20Image%20May%2028,%202026,%2004_04_14%20AM.png?updatedAt=1779915868566",
  "https://ik.imagekit.io/nepgaxllc/ChatGPT%20Image%20May%2028,%202026,%2004_02_54%20AM.png?updatedAt=1779915787682",
  "https://ik.imagekit.io/nepgaxllc/ChatGPT%20Image%20May%2028,%202026,%2004_00_27%20AM.png?updatedAt=1779915641010",
  "https://ik.imagekit.io/nepgaxllc/ChatGPT%20Image%20May%2028,%202026,%2003_57_48%20AM.png?updatedAt=1779915481382",
  "https://ik.imagekit.io/nepgaxllc/ChatGPT%20Image%20May%2028,%202026,%2003_55_26%20AM.png?updatedAt=1779915339577",
  "https://ik.imagekit.io/nepgaxllc/ChatGPT%20Image%20May%2028,%202026,%2003_53_47%20AM.png?updatedAt=1779915242282",
  "https://ik.imagekit.io/nepgaxllc/ChatGPT%20Image%20May%2028,%202026,%2003_52_28%20AM.png?updatedAt=1779915162933",
  "https://ik.imagekit.io/nepgaxllc/ChatGPT%20Image%20May%2028,%202026,%2003_50_36%20AM.png?updatedAt=1779915051307",
  "https://ik.imagekit.io/nepgaxllc/ChatGPT%20Image%20May%2028,%202026,%2003_38_55%20AM.png?updatedAt=1779914352758",
  "https://ik.imagekit.io/nepgaxllc/ChatGPT%20Image%20May%2028,%202026,%2003_35_27%20AM.png?updatedAt=1779914146784",
  "https://ik.imagekit.io/nepgaxllc/ChatGPT%20Image%20May%2029,%202026,%2003_53_26%20PM.png?updatedAt=1780044829074",
];

// Match patterns · exclude motor-SHOPS (batteries, dealers, spare parts)
const MOTO_RENTAL_PATTERN = "(lower(display_name) ~ 'scooter rental|motorbike rental|motor rental|rental motor|sewa motor|bike rent|bike rental|motor sewa|motorbike hire')";
const CAR_RENTAL_PATTERN  = "(lower(display_name) ~ 'car rental|car rent|rental car|rent car|sewa mobil|mobil sewa|rental mobil|mobil rental|car hire|rent a car|hire car|self drive')";

const pool = new pg.Pool({
  connectionString: process.env.NEX_POSTGRES_URL
    ?? "postgresql://postgres:Admin1phil@localhost:5433/nex_dev",
  max: 2,
});

async function assign(label, urls, matchPattern) {
  console.log(`\n─ ${label} · ${urls.length} images available`);
  const candidates = await pool.query(
    `SELECT seller_id::text AS id, display_name, city
       FROM nex.mp_seller
      WHERE cover_image_ref IS NULL
        AND ${matchPattern}
      ORDER BY created_at ASC
      LIMIT $1`,
    [urls.length],   // strict 1:1 · at most as many candidates as images
  );
  console.log(`  candidates found: ${candidates.rowCount} / ${urls.length}`);
  candidates.rows.forEach((r, i) => {
    console.log(`    [${i + 1}] ${r.id.slice(0, 8)} · ${r.display_name} (${r.city})`);
  });

  if (!APPLY) {
    console.log(`  (dry run · add --apply to write)`);
    return;
  }
  let applied = 0;
  for (let i = 0; i < candidates.rowCount; i++) {
    const seller = candidates.rows[i];
    const url    = urls[i];
    await pool.query(
      `UPDATE nex.mp_seller
          SET cover_image_ref = $1,
              updated_at      = NOW()
        WHERE seller_id = $2::uuid`,
      [url, seller.id],
    );
    applied++;
  }
  console.log(`  applied: ${applied}`);
  if (candidates.rowCount < urls.length) {
    console.log(`  UNUSED IMAGES: ${urls.length - candidates.rowCount} (no more matching candidates)`);
  }
}

async function main() {
  console.log(`[apply-rental-images] mode: ${APPLY ? "WRITE" : "DRY RUN"}`);
  await assign("MOTORBIKE HIRE", MOTORBIKE_HIRE_URLS, MOTO_RENTAL_PATTERN);
  await assign("CAR RENTAL",     CAR_RENTAL_URLS,     CAR_RENTAL_PATTERN);
  await pool.end();
  console.log("\n[done]");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
