#!/usr/bin/env node
// NEX Food · Phase 8.0 · promote high-confidence evidence to typed columns.
//
// Respects the trust hierarchy:
//   - Never overwrite owner_verified or admin_verified fields
//   - Only promotes evidence with confidence ≥ 0.80
//   - When multiple evidence rows exist for the same field · newest wins
//   - Only writes when the typed column is currently NULL/empty (never
//     downgrades a real value to a re-extracted one)
//
// Writes to nex.food_business_field_provenance as 'source_import' so future
// enrichment runs know this field was set by an automated agent.
//
// USAGE
//   NEX_POSTGRES_URL=... node scripts/nex-food/promote-evidence-to-typed.mjs [--dry-run]
import pg from "pg";

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");

const url = process.env.NEX_POSTGRES_URL;
if (!url) { console.error("NEX_POSTGRES_URL not set"); process.exit(1); }
const pool = new pg.Pool({ connectionString: url });

// Fields we know how to promote into nex.food_business typed columns.
// Everything else stays in evidence-only for now (dietary · service · wheelchair
// · internet_access · addr:* · name:en/id · brand · description).
const PROMOTABLE_TYPED = {
  whatsapp_number: { column: "whatsapp_number", type: "text" },
  phone:           { column: "phone",            type: "text" },
  website:         { column: "website",          type: "text" },
};

// Social-platform evidence buckets into nex.food_business.public_social_links (jsonb).
const SOCIAL_FIELDS = {
  "social:instagram": "instagram",
  "social:facebook":  "facebook",
  "social:tiktok":    "tiktok",
  "social:youtube":   "youtube",
};

// Opening-hours evidence buckets into nex.food_business.opening_information (jsonb).
const HOURS_FIELD = "opening_hours";

// Load high-confidence evidence with newest-first per (business, field)
const evidenceRows = (await pool.query(`
  WITH ranked AS (
    SELECT
      business_ref, field_name, value, source, source_type, confidence,
      discovered_at, agent_name,
      ROW_NUMBER() OVER (PARTITION BY business_ref, field_name ORDER BY discovered_at DESC) AS rn
    FROM nex.food_enrichment_evidence
    WHERE confidence >= 0.80
  )
  SELECT * FROM ranked WHERE rn = 1
`)).rows;

// Existing provenance · never overwrite owner_verified or admin_verified
const provenance = new Map();
(await pool.query(`SELECT business_ref, field_name, trust_layer FROM nex.food_business_field_provenance`))
  .rows.forEach((r) => provenance.set(`${r.business_ref}|${r.field_name}`, r.trust_layer));

// Current typed-column state (so we never downgrade / overwrite)
const currentRows = (await pool.query(`
  SELECT public_listing_ref, whatsapp_number, phone, website,
         public_social_links, opening_information
  FROM nex.food_business
`)).rows;
const current = new Map(currentRows.map((r) => [r.public_listing_ref, r]));

let promoted = 0;
let blockedByOwner = 0;
let skippedExistingValue = 0;
let socialsWritten = 0;
let hoursWritten = 0;

// Group evidence by business for jsonb merges
const socialByBiz = new Map();   // biz_ref → { platform → value }
const hoursByBiz  = new Map();   // biz_ref → raw string

for (const ev of evidenceRows) {
  const biz = ev.business_ref;
  const field = ev.field_name;
  const cur = current.get(biz);

  // Guard · owner/admin verified fields untouchable
  const targetField =
    PROMOTABLE_TYPED[field]?.column ??
    (SOCIAL_FIELDS[field] ? "public_social_links" : null) ??
    (field === HOURS_FIELD ? "opening_information" : null);
  if (!targetField) continue;

  const provLayer = provenance.get(`${biz}|${targetField}`);
  if (provLayer === "owner_verified" || provLayer === "admin_verified") {
    blockedByOwner++;
    continue;
  }

  // Route 1 · simple text columns (whatsapp / phone / website)
  if (PROMOTABLE_TYPED[field]) {
    const col = PROMOTABLE_TYPED[field].column;
    if (cur && cur[col] && String(cur[col]).trim() !== "") {
      skippedExistingValue++;
      continue;
    }
    if (!dryRun) {
      await pool.query(
        `UPDATE nex.food_business SET ${col} = $1 WHERE public_listing_ref = $2`,
        [ev.value, biz]
      );
      await pool.query(
        `INSERT INTO nex.food_business_field_provenance
           (business_ref, field_name, trust_layer, written_at, written_by, source_reference)
         VALUES ($1, $2, 'source_import', now(), 'agent:osm_reextract:promote', $3)
         ON CONFLICT (business_ref, field_name)
         DO UPDATE SET trust_layer='source_import', written_at=now(),
                       written_by=EXCLUDED.written_by,
                       source_reference=EXCLUDED.source_reference
         WHERE food_business_field_provenance.trust_layer NOT IN ('owner_verified','admin_verified')`,
        [biz, col, ev.source]
      );
    }
    promoted++;
    continue;
  }

  // Route 2 · social platform · bucket into jsonb
  if (SOCIAL_FIELDS[field]) {
    if (!socialByBiz.has(biz)) socialByBiz.set(biz, {});
    socialByBiz.get(biz)[SOCIAL_FIELDS[field]] = ev.value;
    continue;
  }

  // Route 3 · opening_hours · bucket into jsonb
  if (field === HOURS_FIELD) {
    hoursByBiz.set(biz, ev.value);
    continue;
  }
}

// Apply socials in batch
for (const [biz, socials] of socialByBiz.entries()) {
  const cur = current.get(biz);
  if (cur?.public_social_links && Object.keys(cur.public_social_links).length > 0) {
    skippedExistingValue++;
    continue;
  }
  if (!dryRun) {
    await pool.query(
      `UPDATE nex.food_business SET public_social_links = $1 WHERE public_listing_ref = $2`,
      [JSON.stringify(socials), biz]
    );
    await pool.query(
      `INSERT INTO nex.food_business_field_provenance
         (business_ref, field_name, trust_layer, written_at, written_by)
       VALUES ($1, 'public_social_links', 'source_import', now(), 'agent:osm_reextract:promote')
       ON CONFLICT (business_ref, field_name)
       DO UPDATE SET trust_layer='source_import', written_at=now()
       WHERE food_business_field_provenance.trust_layer NOT IN ('owner_verified','admin_verified')`,
      [biz]
    );
  }
  socialsWritten++;
}

// Apply opening_hours in batch
for (const [biz, raw] of hoursByBiz.entries()) {
  const cur = current.get(biz);
  if (cur?.opening_information && cur.opening_information.notes) {
    // already have hours info from Phase 2 initial import (raw OSM string in notes)
    skippedExistingValue++;
    continue;
  }
  const jsonVal = { timezone: "Asia/Jakarta", notes: `OSM opening_hours: ${raw}`, raw };
  if (!dryRun) {
    await pool.query(
      `UPDATE nex.food_business SET opening_information = $1 WHERE public_listing_ref = $2`,
      [JSON.stringify(jsonVal), biz]
    );
    await pool.query(
      `INSERT INTO nex.food_business_field_provenance
         (business_ref, field_name, trust_layer, written_at, written_by)
       VALUES ($1, 'opening_information', 'source_import', now(), 'agent:osm_reextract:promote')
       ON CONFLICT (business_ref, field_name)
       DO UPDATE SET trust_layer='source_import', written_at=now()
       WHERE food_business_field_provenance.trust_layer NOT IN ('owner_verified','admin_verified')`,
      [biz]
    );
  }
  hoursWritten++;
}

console.log("── Evidence promotion summary ──");
console.log(`  mode: ${dryRun ? "DRY RUN" : "APPLY"}`);
console.log(`  simple typed columns promoted (whatsapp/phone/website): ${promoted}`);
console.log(`  social-platform buckets written:                        ${socialsWritten}`);
console.log(`  opening_hours buckets written:                          ${hoursWritten}`);
console.log(`  blocked by owner/admin verified:                        ${blockedByOwner}`);
console.log(`  skipped (typed column already had value):               ${skippedExistingValue}`);

await pool.end();
