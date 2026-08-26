// NEX Universal Acquisition Engine · vertical config · Food · Yogyakarta.
//
// CONFIG DATA ONLY. No framework code. Adding a second vertical (Hotels ·
// Villas · Drivers · Trades · Shops · Services) means adding a sibling
// config file in this directory — never touching engine.mjs or gates.mjs
// or sources/*.
//
// Doctrine reference:
//   project_nex_product_architecture_4_roles_6_subsystems_2026_08_21
//   (Universal-engine anti-pattern: never fork per vertical.)

import { osmOverpassSource } from "../sources/osm-overpass.mjs";
import { businessWebsiteSource } from "../sources/business-website.mjs";

// Task #85 (2026-08-22) · classifyFoodBusiness returns { primary, secondary }.
//
// Doctrine anchors:
//   Q1=B · primary stays single-value (existing 4-enum CHECK on food_business.category)
//         · richer classification lands in food_business.categories text[] (migration 075)
//   Q2=C · never widens the existing CHECK · protects /food directory + filter behavior
//   Q3=AGGRESSIVE · handles amenity=* AND shop=* families AND cuisine tokens AND name heuristics (warung/warteg/angkring)
//   Bakery bug fix · was incorrectly mapping to "ice-cream-dessert" primary via a
//     stale rule · now primary=ice-cream-dessert (unchanged for compatibility) but
//     secondary includes "bakery"+"pastry" so downstream can distinguish.
//
// Task #85 follow-up (2026-08-22 · Philip) · categories[] is a NEX-USER-FACING
// ontology, NOT a raw dump of OSM cuisine tokens. Only whitelisted tokens
// survive into categories[]. Raw OSM values continue to live in
// nex.food_business_source_snapshot.raw_payload (JSONB · full tags preserved)
// so no evidence is lost. This keeps categories[] usable for future filter
// chips without polluting with fragments like "chicken", "regional", "asian",
// "local", "friture", "_fish", "drinks" which are not meaningful NEX categories.
//
// Evidence-based · never invents. Only tags returned by OSM go into secondary.
// Duplicates de-duped via Set. Empty secondary is fine.

// NEX-approved user-facing secondary category ontology (Task #85 follow-up · 2026-08-22).
// All tokens hyphenated form · underscores normalised at classification time.
// Adding a new token = editing this set only · no schema change needed.
const NEX_APPROVED_SECONDARY = new Set([
  // Business form
  "restaurant", "cafe", "coffee", "coffee-shop",
  "fast-food",
  "ice-cream", "bakery", "pastry", "chocolate", "confectionery",
  "warung", "warteg", "street-food",
  "beverages", "tea", "juice", "smoothie", "bubble-tea",
  "food-court", "marketplace",
  "deli", "butcher", "cheese", "seafood", "dairy", "greengrocer", "frozen-food",
  "specialty-food",
  // National/regional cuisines
  "indonesian", "javanese", "sundanese", "padang", "balinese",
  "chinese", "japanese", "korean", "indian", "thai", "vietnamese", "malaysian",
  "italian", "french", "spanish", "mediterranean", "greek",
  "western", "european", "american", "mexican",
  "pizza", "sushi", "ramen", "noodle",
  // Dietary
  "vegetarian", "vegan", "halal",
  // Service model (informational · never a primary)
  "takeaway", "delivery",
]);

// Normalise a raw token to canonical NEX form.
// - lowercase
// - trim whitespace
// - underscores → hyphens
// - drop leading/trailing non-alphanumeric noise (e.g. "_fish" → "fish")
function normaliseToken(raw) {
  if (typeof raw !== "string") return "";
  return raw
    .trim()
    .toLowerCase()
    .replace(/_/g, "-")
    .replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, "");
}

// Filter a token through the NEX-approved ontology.
// Returns "" (filtered out) or the canonical form.
function adoptSecondary(raw) {
  const t = normaliseToken(raw);
  return NEX_APPROVED_SECONDARY.has(t) ? t : "";
}

function classifyFoodBusiness(amenity, shop, cuisine, tags) {
  const secondary = new Set();

  // ── PRIMARY · maps every recognised food-domain tag to one of the 4 legacy
  //             enum values (restaurant · coffee-cafe · ice-cream-dessert · fast-food).
  //             Never introduces new primary values · CHECK constraint remains intact.
  let primary = null;

  // Amenity-driven primary
  if (amenity === "restaurant")                         primary = "restaurant";
  else if (amenity === "cafe" || amenity === "coffee_shop") primary = "coffee-cafe";
  else if (amenity === "fast_food")                     primary = "fast-food";
  else if (amenity === "ice_cream")                     primary = "ice-cream-dessert";
  else if (amenity === "bakery")                        primary = "ice-cream-dessert";
  else if (amenity === "food_court")                    primary = "restaurant";
  else if (amenity === "marketplace")                   primary = "restaurant";
  // Shop-driven primary (Task #85 · shop=* family)
  else if (shop === "bakery" || shop === "pastry")      primary = "ice-cream-dessert";
  else if (shop === "confectionery" || shop === "chocolate" || shop === "ice_cream") primary = "ice-cream-dessert";
  else if (shop === "coffee" || shop === "tea")         primary = "coffee-cafe";
  else if (shop === "beverages")                        primary = "coffee-cafe";
  else if (shop === "deli" || shop === "butcher" || shop === "cheese" || shop === "seafood" || shop === "dairy" || shop === "greengrocer" || shop === "frozen_food") primary = "restaurant";
  else                                                   primary = "restaurant";

  // ── SECONDARY · every additional evidence signal that survives dedup ──
  // Task #85 follow-up (2026-08-22) · every candidate token passes through
  // adoptSecondary() which normalises + whitelists. Anything not in the
  // NEX-approved ontology is dropped here. Raw evidence is preserved in
  // nex.food_business_source_snapshot.raw_payload (never lost).
  const addIfApproved = (raw) => {
    const t = adoptSecondary(raw);
    if (t) secondary.add(t);
  };

  // Raw amenity + shop tokens
  if (amenity) addIfApproved(amenity);
  if (shop)    addIfApproved(shop);

  // Cuisine tokens (semicolon/comma-separated per OSM convention)
  const cLc = String(cuisine ?? "").toLowerCase();
  if (cLc) {
    for (const token of cLc.split(/[;,]/).map((t) => t.trim()).filter(Boolean)) {
      addIfApproved(token);
    }
  }

  // Indonesian-specific heuristics from name (warung / warteg / angkring).
  // These bypass adoptSecondary because we know they're in the whitelist.
  const nameLc = String(tags?.name ?? tags?.["name:id"] ?? "").toLowerCase();
  if (/\bwarung\b/.test(nameLc))   secondary.add("warung");
  if (/\bwarteg\b/.test(nameLc))   secondary.add("warteg");
  if (/\bangkring/.test(nameLc))   secondary.add("street-food");

  // Service signals (takeaway · delivery)
  if (tags?.takeaway === "yes")    secondary.add("takeaway");
  if (tags?.delivery === "yes")    secondary.add("delivery");

  // Return · secondary de-duplicated · never includes primary duplicate
  return {
    primary,
    secondary: [...secondary].filter((s) => s !== primary && s.length > 0),
  };
}

// Legacy single-value signature preserved for callers still relying on it.
// Delegates to the new classifier and returns primary only.
function foodCategoryMapping(amenity, cuisine, tags) {
  const { primary } = classifyFoodBusiness(amenity, tags?.shop ?? null, cuisine, tags);
  return primary;
}

// Kota Yogyakarta full bbox (same as existing OSM importer).
const YOGYA_FULL_BBOX = { sw: [-7.85, 110.35], ne: [-7.75, 110.42] };

// Prawirotaman neighborhood smoke-test bbox (~600m × 600m).
// Small tourist-food area · good sample density · quick to iterate.
// Fully covered by earlier full-city OSM ingest → dedupe validation, not
// gate exercise.
const PRAWIROTAMAN_BBOX = { sw: [-7.821, 110.360], ne: [-7.815, 110.368] };

// Kaliurang fringe bbox (~2km × 2km · ~15km north of Yogyakarta city).
// Mountain-resort area with cafes/restaurants. OUTSIDE earlier full-city
// ingest bbox → yields actual NEW candidates that exercise Gates 3-4.
// Needs live Overpass (fallback cache is city-only).
const KALIURANG_BBOX = { sw: [-7.605, 110.415], ne: [-7.585, 110.435] };

// Prambanan corridor fringe bbox (~5km × 5km · east of Yogyakarta).
// Historic tourist area near Prambanan temple · higher expected
// contactability than Kaliurang (tourist businesses more likely to
// publish contact tags). OUTSIDE earlier full-city ingest bbox
// (east of 110.42) → yields genuinely new candidates.
const PRAMBANAN_BBOX = { sw: [-7.780, 110.450], ne: [-7.740, 110.500] };

// Task #84 · 2026-08-22 · Four uncovered expansion zones for Walker rotation.
// Each is outside the earlier full-city ingest (which produced 806 rows in the
// kota-yogya area) AND outside the currently populated fringes (Prambanan 110 rows,
// Kaliurang 5 rows). Sized ~5-10km × 5-10km each · comparable to Prambanan bbox ·
// safe under Overpass 60s timeout · genuine new-business potential.
// Geographic coverage matrix (Yogyakarta DIY special region):
//   north of city  → SLEMAN_NORTH_BBOX  (Kaliurang road corridor · Cangkringan)
//   south of city  → BANTUL_SOUTH_BBOX  (Bantul town · Sewon · Pandak)
//   east of city   → KLATEN_EAST_BBOX   (Klaten corridor beyond Prambanan)
//   west of city   → GAMPING_WEST_BBOX  (Gamping · Godean fringe)
// Together with PRAMBANAN_BBOX these 5 zones give Walker systematic coverage
// of the wider Yogyakarta area rather than repeatedly hammering one bbox.
const SLEMAN_NORTH_BBOX = { sw: [-7.720, 110.350], ne: [-7.640, 110.450] };
const BANTUL_SOUTH_BBOX = { sw: [-7.950, 110.300], ne: [-7.860, 110.400] };
const KLATEN_EAST_BBOX  = { sw: [-7.780, 110.550], ne: [-7.700, 110.650] };
const GAMPING_WEST_BBOX = { sw: [-7.820, 110.240], ne: [-7.740, 110.340] };

export const foodYogyakartaConfig = {
  vertical: "food",
  city: "Yogyakarta",
  country: "ID",                     // Country Foundation Step 4 (2026-08-22) · every INSERT explicitly declares country · NEVER inferred from city
  publicRefPrefix: "#FL",
  defaultBbox: YOGYA_FULL_BBOX,
  smokeBbox: PRAWIROTAMAN_BBOX,
  smokeBboxes: {
    prawirotaman: PRAWIROTAMAN_BBOX,
    kaliurang: KALIURANG_BBOX,
    prambanan: PRAMBANAN_BBOX,
    // Task #84 · expansion zones · geographic rotation targets
    "sleman-north": SLEMAN_NORTH_BBOX,
    "bantul-south": BANTUL_SOUTH_BBOX,
    "klaten-east":  KLATEN_EAST_BBOX,
    "gamping-west": GAMPING_WEST_BBOX,
  },
  tables: {
    business: "nex.food_business",
    evidence: "nex.food_enrichment_evidence",
    snapshot: "nex.food_business_source_snapshot",
    provenance: "nex.food_business_field_provenance",
  },
  osmOverpass: {
    // Task #85 (2026-08-22) · Q3=AGGRESSIVE · widened from 6 amenities to
    // amenities + shopTypes covering the sensible food/beverage universe.
    // Deliberately excludes pub/bar/nightclub (Philip 2026-08-22 · would pollute
    // food directory with nightlife venues that only sometimes serve food).
    amenities: [
      // Original 6 (kept)
      "restaurant", "cafe", "fast_food", "ice_cream", "bakery", "coffee_shop",
      // Task #85 additions · unambiguously food
      "food_court", "marketplace",
    ],
    shopTypes: [
      // Task #85 · shop=* family · unambiguously food/beverage
      "bakery", "confectionery", "pastry", "chocolate", "ice_cream",
      "coffee", "tea", "beverages",
      "butcher", "deli", "cheese", "seafood", "dairy", "greengrocer", "frozen_food",
    ],
    categoryMapping: foodCategoryMapping,        // legacy single-value · still used by older callers
    classifier:      classifyFoodBusiness,        // Task #85 · returns { primary, secondary[] }
  },
  sources: [
    osmOverpassSource(),
    businessWebsiteSource(),
  ],
  killSwitchEngaged: false,

  // ── Persistence contract 2026-08-26 · Philip's production launch directive ──
  // Engine owns the CONTRACT (verify, invariant). Config owns the STRUCTURE
  // (table shape, INSERT column list, per-vertical side-writes).
  // Doctrine anchor: project_nex_walker_production_launch_directive_2026_08_26.
  persistence: {
    destinationTable: "nex.food_business",
    primaryKeyColumn: "internal_id",

    // Returns { sql, values } for a single INSERT with worker_id + cycle_run_id
    // stamped. Engine calls with `this` bound to the outer config so
    // this.city / this.country resolve normally.
    buildInsert(candidate, { workerId, cycleRunId, sourceName }) {
      const secondaryCategories = Array.isArray(candidate.categories) ? candidate.categories : [];
      return {
        sql: `INSERT INTO nex.food_business (
                public_listing_ref, business_name, category, categories, address, city,
                coordinates_lng, coordinates_lat,
                whatsapp_number, phone, website,
                source, source_reference, source_ingested_at, source_licence_terms,
                source_updated_at, last_verified_at, verification_source,
                dedupe_hash, claim_status, owner_status, created_by, country,
                worker_id, cycle_run_id
              ) VALUES (
                $1, $2, $3, $4::text[], $5, $6, $7, $8, $9, $10, $11,
                $12, $13, now(), $14,
                $15, $16, $17,
                $18, 'discovered', 'unknown', $19, $20,
                $21, $22
              )
              ON CONFLICT DO NOTHING
              RETURNING internal_id`,
        values: [
          candidate.publicRef, candidate.name, candidate.category, secondaryCategories,
          candidate.address, this.city,
          candidate.lng, candidate.lat,
          candidate.whatsapp, candidate.phone, candidate.website,
          candidate.sourceType, candidate.sourceReference, candidate.sourceLicenceTerms,
          candidate.sourceUpdatedAt ?? null,
          candidate.lastVerifiedAt ?? null,
          candidate.verificationSource ?? null,
          candidate.dedupeHash,
          `agent:universal-acquisition:${sourceName}:${cycleRunId}`,
          this.country,
          workerId,           // $21 · persistence contract
          cycleRunId,         // $22 · persistence contract
        ],
      };
    },

    // Snapshot + provenance side-writes · fired only after INSERT+verify succeed.
    // Preserves the Task #85 (raw OSM payload), Task #53 (per-field OSM provenance),
    // Task #74 (cycle_run_id on provenance rows) semantics from the legacy path.
    // Enrichment pivot 2026-08-27 · Chief Architect · fills NULL fields on
    // EXISTING rows using data extracted from business_website source.
    // COALESCE semantics · never overwrites non-null · owner_status='verified'
    // rows protected in the WHERE clause (Discovery ≠ Outreach doctrine ·
    // owner_verified fields must NEVER be modified by walkers).
    //
    // Image extraction pivot 2026-08-27 (added same day · narrowly scoped):
    // If gain.image_url present, write to universal nex.business_image
    // (VERIFIED_REAL · approved=false · owner-review gate) AND COALESCE the
    // denormalised hero_image_url on food_business (fast lookup for HQ).
    // Never overwrites existing image · ON CONFLICT DO NOTHING on business_image.
    //
    // Returns total rowCount across all writes (engine.mjs counts >0 as one applied write).
    async applyEnrichmentToExisting(pool, existing, gain, { workerId, cycleRunId, sourceName }) {
      const socials = (gain.instagram || gain.facebook)
        ? { instagram: gain.instagram ?? null, facebook: gain.facebook ?? null }
        : null;
      let totalWrites = 0;

      const textUpdate = await pool.query(
        `UPDATE nex.food_business SET
           phone               = COALESCE(phone, $1),
           whatsapp_number     = COALESCE(whatsapp_number, $2),
           public_social_links = COALESCE(public_social_links, $3::jsonb),
           last_verified_at    = now(),
           verification_source = COALESCE(verification_source, 'official_website'),
           updated_at          = now()
         WHERE public_listing_ref = $4
           AND owner_status != 'verified'
         RETURNING internal_id`,
        [
          gain.phone ?? null,
          gain.whatsapp ?? null,
          socials ? JSON.stringify(socials) : null,
          existing.public_listing_ref,
        ]
      );
      totalWrites += textUpdate.rowCount;

      // Image write-back · only if we found a legitimate image on the own site.
      if (gain.image_url) {
        const provenance = {
          source_url:    gain._sourceReference ?? null,
          method:        gain.image_source_method ?? "unknown",
          extracted_at:  new Date().toISOString(),
          worker_id:     workerId,
          cycle_run_id:  cycleRunId,
        };
        // Universal image system · state=VERIFIED_REAL · approved=false so an
        // admin/owner review must gate publication (Universal Image Doctrine).
        const imgInsert = await pool.query(
          `INSERT INTO nex.business_image (
             business_type, business_country, business_ref, image_type,
             url, source, provenance, confidence, cycle_run_id, approved, owner_approved
           ) VALUES (
             'food', 'ID', $1, 'VERIFIED_REAL',
             $2, 'official_website', $3::jsonb, 0.8, $4, false, false
           )
           ON CONFLICT (business_type, business_country, business_ref, image_type) DO NOTHING
           RETURNING id`,
          [existing.public_listing_ref, gain.image_url, JSON.stringify(provenance), cycleRunId]
        );
        totalWrites += imgInsert.rowCount;

        // COALESCE-UPDATE denormalised hero_image_url on food_business row.
        // Fast-lookup for directory rendering. NEVER overwrites existing image.
        // hero_image_approved stays false · UI treats as advisory until admin gate.
        const heroUpdate = await pool.query(
          `UPDATE nex.food_business SET
             hero_image_url        = COALESCE(hero_image_url, $1),
             hero_image_source     = COALESCE(hero_image_source, 'official_website'),
             hero_image_provenance = COALESCE(hero_image_provenance, $2::jsonb),
             updated_at            = now()
           WHERE public_listing_ref = $3
             AND owner_status != 'verified'
             AND hero_image_url IS NULL
           RETURNING internal_id`,
          [gain.image_url, JSON.stringify(provenance), existing.public_listing_ref]
        );
        totalWrites += heroUpdate.rowCount;
      }

      return totalWrites;
    },

    async writeSideEffects(pool, candidate, { workerId, cycleRunId, sourceName, primaryKeyValue }) {
      // Raw OSM snapshot (Priority 2 · 2026-08-23) · food-parity with accommodation Task #89.
      const rawTags = candidate.rawTags ?? {};
      await pool.query(
        `INSERT INTO ${this.tables.snapshot}
           (business_ref, source, source_reference, source_ingested_at,
            source_licence_terms, raw_payload, ingested_by)
         VALUES ($1, $2, $3, now(), $4, $5::jsonb, $6)`,
        [
          candidate.publicRef,
          candidate.sourceType,
          candidate.sourceReference,
          candidate.sourceLicenceTerms ?? "ODbL-1.0",
          JSON.stringify({
            tags: rawTags,
            osmId: candidate.osmId ?? null,
            lat: candidate.lat,
            lng: candidate.lng,
            cycle_run_id: cycleRunId,
          }),
          `agent:universal-acquisition:${sourceName}`,
        ],
      );

      // Per-field provenance (Task #53 · Task #74 · cycle_run_id stamped).
      const provenanceFields = [];
      provenanceFields.push(["business_name"]);
      provenanceFields.push(["category"]);
      if (candidate.address)         provenanceFields.push(["address"]);
      if (candidate.lat != null)     provenanceFields.push(["coordinates_lat"]);
      if (candidate.lng != null)     provenanceFields.push(["coordinates_lng"]);
      if (candidate.phone)           provenanceFields.push(["phone"]);
      if (candidate.whatsapp)        provenanceFields.push(["whatsapp_number"]);
      if (candidate.website)         provenanceFields.push(["website"]);

      const writtenBy = `agent:universal-acquisition:${sourceName}`;
      const sourceRef = candidate.sourceReference ?? null;
      for (const [fieldName] of provenanceFields) {
        await pool.query(
          `INSERT INTO ${this.tables.provenance}
             (business_ref, field_name, trust_layer, written_at, written_by, source_reference, cycle_run_id)
           VALUES ($1, $2, 'source_import', now(), $3, $4, $5)
           ON CONFLICT (business_ref, field_name) DO NOTHING`,
          [candidate.publicRef, fieldName, writtenBy, sourceRef, cycleRunId]
        );
      }
    },
  },

  // ── LEGACY insertNewRecord · superseded by persistence block above ──────
  // Retained temporarily for any caller still using the old signature.
  // Engine branches on config.persistence FIRST, so this is dead code on the
  // food path. Will be removed after P5 rolls the contract to all verticals.
  async insertNewRecord(pool, candidate, { jobId, sourceName }) {
    // Freshness doctrine (Philip 2026-08-21): capture source_updated_at +
    // last_verified_at at insert time. Freshness is derived from evidence,
    // NEVER from discovery date. If OSM didn't expose a timestamp, these
    // stay NULL and the record is UNVERIFIED until re-verify runs.
    // Task #85 (2026-08-22) · write secondary categories[] alongside primary category.
    // categories[] defaults to empty array in migration 075 · Walker fills it
    // when the classifier returns evidence-based secondary tokens.
    const secondaryCategories = Array.isArray(candidate.categories) ? candidate.categories : [];
    const ins = await pool.query(
      // Country Foundation Step 4 (2026-08-22) · country ($20) sourced from this.country (config).
      // NEVER derived from city. Any attempt to add city→country inference here violates the
      // Truth Invariant + Country three-layer doctrine.
      `INSERT INTO ${this.tables.business} (
         public_listing_ref, business_name, category, categories, address, city,
         coordinates_lng, coordinates_lat,
         whatsapp_number, phone, website,
         source, source_reference, source_ingested_at, source_licence_terms,
         source_updated_at, last_verified_at, verification_source,
         dedupe_hash, claim_status, owner_status, created_by, country
       ) VALUES (
         $1, $2, $3, $4::text[], $5, $6, $7, $8, $9, $10, $11,
         $12, $13, now(), $14,
         $15, $16, $17,
         $18, 'discovered', 'unknown', $19, $20
       )
       ON CONFLICT DO NOTHING
       RETURNING public_listing_ref`,
      [
        candidate.publicRef, candidate.name, candidate.category, secondaryCategories, candidate.address, this.city,
        candidate.lng, candidate.lat,
        candidate.whatsapp, candidate.phone, candidate.website,
        candidate.sourceType, candidate.sourceReference, candidate.sourceLicenceTerms,
        candidate.sourceUpdatedAt ?? null,
        candidate.lastVerifiedAt ?? null,
        candidate.verificationSource ?? null,
        candidate.dedupeHash, `agent:universal-acquisition:${sourceName}:${jobId}`,
        this.country,   // Country Foundation Step 4 · $20 · from config, never inferred
      ]
    );
    if (ins.rowCount === 0) return false;

    // 2026-08-23 · Priority 2 (Philip greenlight · food Walker raw-tag preservation).
    // Preserve raw OSM payload in snapshot table, matching the accommodation Walker's
    // Task #89 pattern. This closes the food-snapshot architecture gap discovered in
    // the 2026-08-23 Walker Intelligence Audit — historically food snapshots existed
    // in flat/typed form (never containing raw OSM tags), so Path A re-parse could
    // not recover the OSM richness (description · brand · operator · wikidata etc.)
    // for food rows. From this cycle forward, every new food discovery preserves the
    // raw OSM tags in the same {lat, lng, tags, osmId} shape accommodation uses.
    //
    // Existing 806 flat-format food snapshots are UNCHANGED (backfill is Priority 3).
    // Dedupe (ON CONFLICT DO NOTHING above) means this only fires for genuinely new
    // discoveries · not repeat OSM tags for businesses already in the database.
    //
    // Doctrine:
    //   · Walker remains pure acquisition (no scoring · no decision · no ranking)
    //   · Snapshot IS the raw evidence · never modified after write
    //   · Provenance chain preserved via source_reference + cycle_run_id
    //
    // Schema note (verified 2026-08-23 during Priority 3 smoke test):
    // nex.food_business_source_snapshot uses source_ingested_at +
    // source_licence_terms + ingested_by (NOT captured_at + cycle_run_id like
    // accommodation). Same intent · different columns. cycle_run_id from jobId
    // is retained in the raw_payload jsonb for provenance rather than a typed
    // column since food's snapshot schema pre-dates cycle_run_id preservation.
    const rawTags = candidate.rawTags ?? {};
    await pool.query(
      `INSERT INTO ${this.tables.snapshot}
         (business_ref, source, source_reference, source_ingested_at,
          source_licence_terms, raw_payload, ingested_by)
       VALUES ($1, $2, $3, now(), $4, $5::jsonb, $6)`,
      [
        candidate.publicRef,
        candidate.sourceType,
        candidate.sourceReference,
        candidate.sourceLicenceTerms ?? "ODbL-1.0",
        JSON.stringify({
          tags: rawTags,
          osmId: candidate.osmId ?? null,
          lat: candidate.lat,
          lng: candidate.lng,
          cycle_run_id: jobId ?? null,   // preserved in payload since schema lacks column
        }),
        `agent:universal-acquisition:${sourceName}`,
      ],
    );

    // Task #53 · Per-field OSM provenance on initial insert.
    // Trust hierarchy (nex_food_field_trust enum · verified 2026-08-22):
    // source_import < nex_curated < admin_verified < owner_verified.
    // For OSM-sourced fields, trust_layer is 'source_import' (lowest tier).
    // The source-of-origin is separately captured in source_reference.
    // Write a per-field provenance row for every field populated from OSM data.
    // ON CONFLICT DO NOTHING preserves any pre-existing higher-trust provenance
    // (owner_verified would trump this; owner_verified rows come from Layer 3 claim).
    //
    // This closes Philip's stated condition for turning acquisition scheduler
    // on 24/7 (per project_nex_food_flywheel_over_scraping + Walker doctrine).
    const provenanceFields = [];
    provenanceFields.push(["business_name", true]);
    provenanceFields.push(["category", true]);
    if (candidate.address) provenanceFields.push(["address", true]);
    if (candidate.lat != null) provenanceFields.push(["coordinates_lat", true]);
    if (candidate.lng != null) provenanceFields.push(["coordinates_lng", true]);
    if (candidate.phone) provenanceFields.push(["phone", true]);
    if (candidate.whatsapp) provenanceFields.push(["whatsapp_number", true]);
    if (candidate.website) provenanceFields.push(["website", true]);

    const writtenBy = `agent:universal-acquisition:${sourceName}`;
    const sourceRef = candidate.sourceReference ?? null;
    // Task #74 · Direct-Provenance A (2026-08-22): stamp the active
    // worker_cycle_run.id onto every provenance row so the six-criteria
    // evaluator can JOIN by cycle_run_id for output/state evidence.
    // jobId is the cycle_run_id emitted by scripts/nex-worker/reliability.mjs
    // → scripts/nex-acquisition/run-live-cycle.mjs::startCycleRun. Nullable
    // for callers that don't have a cycle (smoke tests, backfill scripts).
    for (const [fieldName] of provenanceFields) {
      await pool.query(
        `INSERT INTO ${this.tables.provenance}
           (business_ref, field_name, trust_layer, written_at, written_by, source_reference, cycle_run_id)
         VALUES ($1, $2, 'source_import', now(), $3, $4, $5)
         ON CONFLICT (business_ref, field_name) DO NOTHING`,
        [candidate.publicRef, fieldName, writtenBy, sourceRef, jobId ?? null]
      );
    }
    return true;
  },
};
