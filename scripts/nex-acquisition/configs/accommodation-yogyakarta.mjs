// NEX Universal Acquisition Engine · vertical config · Accommodation Yogyakarta.
//
// Task #89 Phase A · 2026-08-22
//
// Doctrine anchors:
//   project_nex_task89_accommodation_spec_2026_08_22
//   project_nex_local_directory_engine_architecture_2026_08_22
//   project_nex_walker_stays_pure_acquisition_2026_08_22
//   project_nex_focused_category_directory_architecture_2026_08_22
//
// Philip 2026-08-22 Phase A0 decisions (locked):
//   Q2 · 7 categories: hotel · villa · guesthouse · homestay · resort · hostel · apartment
//   Q3 · Extended OSM scope + conservative classifier · raw tags preserved
//   Q4 · 30-minute cadence (not implemented here · scheduler entry deferred to post-first-batch)
//   Q5 · Accommodation-specific zones · explicit geographic boundaries
//
// GEOGRAPHIC SCOPE (Philip 2026-08-22 verbatim: "make the geography explicit in the config"):
//   Target market: Yogyakarta Special Region (Daerah Istimewa Yogyakarta · DIY)
//                  + Magelang tourism corridor (Borobudur temple approach)
//   Administrative boundaries CROSSED:
//     Malioboro     · Kota Yogyakarta (city proper · DIY)
//     Prawirotaman  · Kota Yogyakarta (south city · DIY)
//     Kaliurang     · Sleman regency  (north slopes · DIY)
//     Borobudur     · Magelang regency (Central Java · OUTSIDE DIY · tourism-adjacent only)
//     YogyaWider    · DIY + inner adjacent (Sleman/Bantul spill · Yogyakarta city core)
//   Every discovered row captures OSM city truth (some Yogyakarta · some Sleman · some Magelang) ·
//   Phase B directory filter decides whether to show by admin city or by tourism_region.

import { osmOverpassSource } from "../sources/osm-overpass.mjs";
import { businessWebsiteSource } from "../sources/business-website.mjs";
import { createHash } from "node:crypto";

// ── 1. Conservative Accommodation classifier (Q3) ───────────────────
// Rules · evaluated top-down · first-match wins:
//
//   tourism=hotel   + hotel=villa      → villa    (explicit subtype)
//   tourism=hotel   + hotel=resort     → resort   (explicit subtype)
//   tourism=chalet                     → villa    (Yogya market: chalet == villa)
//   tourism=guest_house + guest_house=homestay → homestay
//   tourism=guest_house                → guesthouse
//   tourism=hostel                     → hostel
//   tourism=apartment                  → apartment
//   tourism=motel                      → hotel    (motel is hotel-shaped in this 7-taxonomy)
//   tourism=hotel   (no subtag)        → hotel
//   building=hotel  (no tourism)       → hotel    (weaker signal · ambiguous flag captured)
//                                                   in secondary categories for admin review)
//   anything else                      → null (skipped · candidate not created)
//
// Secondary tokens (Task #85 pattern) capture evidence hints WITHOUT overriding primary:
//   hotel=luxury/boutique/budget → added to categories[]
//   accommodation raw tag values from tags.tourism/tags.hotel/tags.building
//   NEX_APPROVED_ACCOMMODATION_SECONDARY whitelist filters noise
export function classifyAccommodationBusiness(amenity, shop, cuisine, tags) {
  const t = tags?.tourism ?? null;
  const h = tags?.hotel ?? null;
  const b = tags?.building ?? null;
  const gh = tags?.guest_house ?? null;
  const nameRaw = tags?.name ?? tags?.["name:id"] ?? tags?.["name:en"] ?? "";
  const name = String(nameRaw).toLowerCase();

  const secondary = [];
  const addSecondary = (v) => {
    if (!v || typeof v !== "string") return;
    const norm = v.trim().toLowerCase();
    if (NEX_APPROVED_ACCOMMODATION_SECONDARY.has(norm)) secondary.push(norm);
  };

  // Task #89 Phase A · Kos detection (Philip 2026-08-22 · CONSERVATIVE · name-only).
  // Indonesian residential monthly rental. Recognised whenever the business name
  // contains one of the accepted kos tokens · never inferred from cheap-looking
  // building or absence of other signals. Wins over generic tourism=guest_house
  // because "Kos" is a more specific Indonesian concept than western guesthouse.
  // Doctrine: if uncertain, better to leave in another category than fabricate a Kos.
  if (KOS_NAME_PATTERN.test(name)) {
    addSecondary("name-based-kos");
    return { primary: "kos", secondary };
  }

  // Explicit OSM subtypes
  if (t === "hotel" && h === "villa")   { addSecondary("hotel-villa-tag"); return { primary: "villa", secondary }; }
  if (t === "hotel" && h === "resort")  { addSecondary("hotel-resort-tag"); return { primary: "resort", secondary }; }
  if (t === "chalet")                    { addSecondary("chalet"); return { primary: "villa", secondary }; }
  if (t === "guest_house" && gh === "homestay") return { primary: "homestay", secondary };
  if (t === "guest_house")               return { primary: "guesthouse", secondary };
  if (t === "hostel")                    return { primary: "hostel", secondary };
  if (t === "apartment")                 return { primary: "apartment", secondary };
  if (t === "motel")                     { addSecondary("motel"); return { primary: "hotel", secondary }; }
  if (t === "hotel")                     { addSecondary(h); return { primary: "hotel", secondary }; }

  // Weaker: building=hotel without tourism tag (ambiguous · could be any accommodation)
  if (b === "hotel")                     { addSecondary("building-only"); return { primary: "hotel", secondary }; }

  return { primary: null, secondary: [] };
}

// Kos name detector · word-boundary match on Indonesian tokens.
// Deliberately word-boundary (\b) so "cosmopolitan" isn't caught by "cos".
// Case-insensitive matching handled by lowercase name at call site.
const KOS_NAME_PATTERN = /\b(kos|kost|kosan|indekos|kos-kosan)\b/i;

// Legacy single-value mapping (kept for callers that only want primary · not used in Phase A)
export function accommodationCategoryMapping(amenity, cuisine, tags) {
  const { primary } = classifyAccommodationBusiness(amenity, tags?.shop ?? null, cuisine, tags);
  return primary;
}

// ── Approved secondary tokens (Task #85 pattern · noise filter) ──────
// Small whitelist to prevent OSM tag pollution from surfacing as
// meaningful secondary evidence. Extendable · admin can request additions.
const NEX_APPROVED_ACCOMMODATION_SECONDARY = new Set([
  // subtype markers we capture from raw tags
  "hotel-villa-tag", "hotel-resort-tag", "chalet", "motel", "building-only",
  // quality/style markers seen in Yogyakarta OSM
  "luxury", "boutique", "budget", "backpacker",
  // amenity-family hints (not full amenities array · that's a separate column)
  "family", "business",
]);

// ── 2. Zones (Q5 · accommodation-specific · explicit boundaries) ────
// Each zone: {sw:[lat,lng], ne:[lat,lng], scope: "human-readable admin region"}
// Bboxes intentionally small-medium (safe under Overpass 60s timeout · target
// tourist-dense areas rather than blanket coverage).

const MALIOBORO_BBOX = {
  sw: [-7.7970, 110.360],
  ne: [-7.7870, 110.372],
  scope: "Malioboro · Yogyakarta city centre · Kota Yogyakarta (DIY)",
};
const PRAWIROTAMAN_BBOX = {
  sw: [-7.8180, 110.360],
  ne: [-7.8060, 110.378],
  scope: "Prawirotaman · south Yogyakarta · Kota Yogyakarta (DIY)",
};
const KALIURANG_BBOX = {
  sw: [-7.6100, 110.410],
  ne: [-7.5850, 110.440],
  scope: "Kaliurang · Merapi slopes · Sleman regency (DIY) · villa/resort belt",
};
const BOROBUDUR_APPROACH_BBOX = {
  sw: [-7.6250, 110.190],
  ne: [-7.5900, 110.225],
  // Explicit administrative note per Philip's Q5 caution.
  scope: "Borobudur temple approach · Magelang regency (Central Java · OUTSIDE DIY) · tourism-adjacent",
};
const YOGYA_WIDER_URBAN_BBOX = {
  sw: [-7.8500, 110.330],
  ne: [-7.7500, 110.420],
  scope: "Yogyakarta wider urban · DIY city + inner Sleman/Bantul spill (fallback coverage)",
};

// ── 3. Config object · consumed by scripts/nex-acquisition/engine.mjs ──
export const accommodationYogyakartaConfig = {
  vertical: "accommodation",
  city: "Yogyakarta",              // used as default · row-level city preserved from OSM truth
  country: "ID",                   // Country Foundation Step 4 (2026-08-22) · every INSERT explicitly declares country · NEVER inferred from city
  publicRefPrefix: "#AC",          // Accommodation prefix · parallel to Food's "#FL"

  defaultBbox: YOGYA_WIDER_URBAN_BBOX,
  smokeBbox: MALIOBORO_BBOX,       // Q5 · first-batch target · smallest tourist-dense area

  smokeBboxes: {
    "malioboro":       MALIOBORO_BBOX,
    "prawirotaman":    PRAWIROTAMAN_BBOX,
    "kaliurang":       KALIURANG_BBOX,
    "borobudur":       BOROBUDUR_APPROACH_BBOX,
    "yogya-wider":     YOGYA_WIDER_URBAN_BBOX,
  },

  tables: {
    business:    "nex.accommodation_business",
    evidence:    "nex.accommodation_enrichment_evidence",
    snapshot:    "nex.accommodation_business_source_snapshot",
    provenance:  "nex.accommodation_business_field_provenance",
  },

  osmOverpass: {
    // Q3 · base tourism=* family
    tourismTypes: [
      "hotel",          // → hotel · villa · resort (via subtype detection)
      "guest_house",    // → guesthouse · homestay (via guest_house=homestay)
      "hostel",         // → hostel
      "chalet",         // → villa
      "motel",          // → hotel
      "apartment",      // → apartment
    ],
    // Q3 · extended tag pairs
    extendedTagPairs: [
      ["building", "hotel"],
      ["hotel", "resort"],
      ["hotel", "villa"],
    ],
    // Food-specific fields left unset (null-safe in osm-overpass.mjs).
    amenities: [],
    shopTypes: [],

    categoryMapping: accommodationCategoryMapping,
    classifier:      classifyAccommodationBusiness,
  },

  sources: [
    osmOverpassSource(),
    // 2026-08-27 · Chief Architect enrichment pivot · Phase C now writes gains
    // BACK to existing accommodation_business rows via applyEnrichmentToExisting.
    // Same source as food · own-domain public info · no ToS/rate concerns.
    businessWebsiteSource(),
  ],

  killSwitchEngaged: false,

  // ── Persistence contract 2026-08-26 · P5 rollout (mirrors food config) ──
  // Engine owns the CONTRACT (verify + invariant). Config owns the STRUCTURE
  // (table shape, INSERT column list, per-vertical side-writes).
  persistence: {
    destinationTable: "nex.accommodation_business",
    primaryKeyColumn: "internal_id",

    buildInsert(candidate, { workerId, cycleRunId, sourceName }) {
      // Assemble deterministic public_listing_ref if caller hasn't set one.
      if (!candidate.publicRef) {
        candidate.publicRef = generatePublicRef(candidate.dedupeHash);
      }
      const secondaryCategories = Array.isArray(candidate.categories) ? candidate.categories : [];
      const rawTags = candidate.rawTags ?? {};
      const starRating = parseStarRating(rawTags);
      const roomCount  = parseRoomCount(rawTags);
      const amenities  = parseAmenities(rawTags);
      return {
        sql: `INSERT INTO nex.accommodation_business (
                public_listing_ref, business_name, category, categories, address, city,
                coordinates_lng, coordinates_lat,
                whatsapp_number, phone, website,
                star_rating, star_rating_source, room_count, amenities,
                source, source_reference, source_ingested_at, source_licence_terms,
                source_updated_at, last_verified_at, verification_source,
                dedupe_hash, claim_status, owner_status, created_by, country,
                worker_id, cycle_run_id
              ) VALUES (
                $1, $2, $3, $4::text[], $5, $6, $7, $8, $9, $10, $11,
                $12, $13, $14, $15::text[],
                $16, $17, now(), $18,
                $19, $20, $21,
                $22, 'discovered', 'unknown', $23, $24,
                $25, $26
              )
              ON CONFLICT DO NOTHING
              RETURNING internal_id`,
        values: [
          candidate.publicRef, candidate.name, candidate.category, secondaryCategories,
          candidate.address, this.city,
          candidate.lng, candidate.lat,
          candidate.whatsapp, candidate.phone, candidate.website,
          starRating, starRating != null ? "osm_stars_tag" : null, roomCount, amenities,
          candidate.sourceType, candidate.sourceReference, candidate.sourceLicenceTerms,
          candidate.sourceUpdatedAt ?? null,
          candidate.lastVerifiedAt ?? null,
          candidate.verificationSource ?? null,
          candidate.dedupeHash,
          `agent:universal-acquisition:${sourceName}:${cycleRunId}`,
          this.country,
          workerId,           // $25 · persistence contract
          cycleRunId,         // $26 · persistence contract
        ],
      };
    },

    // Enrichment pivot 2026-08-27 · Chief Architect · same shape as food.
    // COALESCE · never overwrites non-null · owner_status='verified' guarded.
    // Image extraction pivot 2026-08-27 · writes to universal nex.business_image
    // (business_type='accommodation') + COALESCE hero_image_url on this table.
    async applyEnrichmentToExisting(pool, existing, gain, { workerId, cycleRunId, sourceName }) {
      const socials = (gain.instagram || gain.facebook)
        ? { instagram: gain.instagram ?? null, facebook: gain.facebook ?? null }
        : null;
      let totalWrites = 0;

      const textUpdate = await pool.query(
        `UPDATE nex.accommodation_business SET
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

      if (gain.image_url) {
        const provenance = {
          source_url:    gain._sourceReference ?? null,
          method:        gain.image_source_method ?? "unknown",
          extracted_at:  new Date().toISOString(),
          worker_id:     workerId,
          cycle_run_id:  cycleRunId,
        };
        const imgInsert = await pool.query(
          `INSERT INTO nex.business_image (
             business_type, business_country, business_ref, image_type,
             url, source, provenance, confidence, cycle_run_id, approved, owner_approved
           ) VALUES (
             'accommodation', 'ID', $1, 'VERIFIED_REAL',
             $2, 'official_website', $3::jsonb, 0.8, $4, false, false
           )
           ON CONFLICT (business_type, business_country, business_ref, image_type) DO NOTHING
           RETURNING id`,
          [existing.public_listing_ref, gain.image_url, JSON.stringify(provenance), cycleRunId]
        );
        totalWrites += imgInsert.rowCount;

        const heroUpdate = await pool.query(
          `UPDATE nex.accommodation_business SET
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
      const rawTags = candidate.rawTags ?? {};
      const starRating = parseStarRating(rawTags);
      const roomCount  = parseRoomCount(rawTags);
      const amenities  = parseAmenities(rawTags);

      await pool.query(
        `INSERT INTO ${this.tables.snapshot} (business_ref, source, source_reference, raw_payload, cycle_run_id)
         VALUES ($1, $2, $3, $4::jsonb, $5)`,
        [candidate.publicRef, candidate.sourceType, candidate.sourceReference,
         JSON.stringify({ tags: rawTags, osmId: candidate.osmId, lat: candidate.lat, lng: candidate.lng }),
         cycleRunId]
      );

      const provenanceFields = [];
      provenanceFields.push(["business_name"]);
      provenanceFields.push(["category"]);
      if (candidate.address)         provenanceFields.push(["address"]);
      if (candidate.lat != null)     provenanceFields.push(["coordinates_lat"]);
      if (candidate.lng != null)     provenanceFields.push(["coordinates_lng"]);
      if (candidate.phone)           provenanceFields.push(["phone"]);
      if (candidate.whatsapp)        provenanceFields.push(["whatsapp_number"]);
      if (candidate.website)         provenanceFields.push(["website"]);
      if (starRating != null)        provenanceFields.push(["star_rating"]);
      if (roomCount != null)         provenanceFields.push(["room_count"]);
      if (amenities.length > 0)      provenanceFields.push(["amenities"]);

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

  // ── LEGACY insertNewRecord · superseded by persistence block above ──
  // Retained temporarily · engine branches on config.persistence FIRST.
  async insertNewRecord(pool, candidate, { jobId, sourceName }) {
    // Assemble the deterministic public_listing_ref (#AC-YYYY-XXXXX).
    // Uses SHA-256 hash of dedupe_hash truncated to 5 Crockford base-32 chars.
    // Matches Food's pattern (#FL-YYYY-XXXXX) · Accommodation prefix.
    if (!candidate.publicRef) {
      candidate.publicRef = generatePublicRef(candidate.dedupeHash);
    }

    const secondaryCategories = Array.isArray(candidate.categories) ? candidate.categories : [];

    // Extract accommodation-specific attributes from raw OSM tags where present.
    // Never inferred · never fabricated · empty defaults when tag absent.
    const rawTags = candidate.rawTags ?? {};
    const starRating = parseStarRating(rawTags);
    const roomCount  = parseRoomCount(rawTags);
    const amenities  = parseAmenities(rawTags);

    // Country Foundation Step 4 (2026-08-22) · country ($24) sourced from this.country (config).
    // NEVER derived from city. Any attempt to add city→country inference here violates the
    // Truth Invariant + Country three-layer doctrine.
    const ins = await pool.query(
      `INSERT INTO ${this.tables.business} (
         public_listing_ref, business_name, category, categories, address, city,
         coordinates_lng, coordinates_lat,
         whatsapp_number, phone, website,
         star_rating, star_rating_source, room_count, amenities,
         source, source_reference, source_ingested_at, source_licence_terms,
         source_updated_at, last_verified_at, verification_source,
         dedupe_hash, claim_status, owner_status, created_by, country
       ) VALUES (
         $1, $2, $3, $4::text[], $5, $6, $7, $8, $9, $10, $11,
         $12, $13, $14, $15::text[],
         $16, $17, now(), $18,
         $19, $20, $21,
         $22, 'discovered', 'unknown', $23, $24
       )
       ON CONFLICT DO NOTHING
       RETURNING public_listing_ref`,
      [
        candidate.publicRef, candidate.name, candidate.category, secondaryCategories, candidate.address, this.city,
        candidate.lng, candidate.lat,
        candidate.whatsapp, candidate.phone, candidate.website,
        starRating, starRating != null ? "osm_stars_tag" : null, roomCount, amenities,
        candidate.sourceType, candidate.sourceReference, candidate.sourceLicenceTerms,
        candidate.sourceUpdatedAt ?? null,
        candidate.lastVerifiedAt ?? null,
        candidate.verificationSource ?? null,
        candidate.dedupeHash, `agent:universal-acquisition:${sourceName}:${jobId}`,
        this.country,   // Country Foundation Step 4 · $24 · from config, never inferred
      ]
    );
    if (ins.rowCount === 0) return false;

    // Snapshot raw payload (Task #85 pattern · enables Phase C enrichment without re-querying OSM).
    await pool.query(
      `INSERT INTO ${this.tables.snapshot} (business_ref, source, source_reference, raw_payload, cycle_run_id)
       VALUES ($1, $2, $3, $4::jsonb, $5)`,
      [candidate.publicRef, candidate.sourceType, candidate.sourceReference,
       JSON.stringify({ tags: rawTags, osmId: candidate.osmId, lat: candidate.lat, lng: candidate.lng }),
       jobId ?? null]
    );

    // Direct-Provenance A (Task #74) · per-field provenance with cycle_run_id FK.
    const provenanceFields = [
      ["business_name", true],
      ["category", true],
    ];
    if (candidate.address)         provenanceFields.push(["address", true]);
    if (candidate.lat != null)     provenanceFields.push(["coordinates_lat", true]);
    if (candidate.lng != null)     provenanceFields.push(["coordinates_lng", true]);
    if (candidate.phone)           provenanceFields.push(["phone", true]);
    if (candidate.whatsapp)        provenanceFields.push(["whatsapp_number", true]);
    if (candidate.website)         provenanceFields.push(["website", true]);
    if (starRating != null)        provenanceFields.push(["star_rating", true]);
    if (roomCount != null)         provenanceFields.push(["room_count", true]);
    if (amenities.length > 0)      provenanceFields.push(["amenities", true]);

    const writtenBy = `agent:universal-acquisition:${sourceName}`;
    const sourceRef = candidate.sourceReference ?? null;

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

// ── Helpers ────────────────────────────────────────────────────────

// Crockford Base32 alphabet (excludes I·L·O·U · same as Food's #FL pattern).
const CROCKFORD = "ABCDEFGHJKMNPQRSTVWXYZ0123456789".split("");

function generatePublicRef(dedupeHash) {
  const year = new Date().getUTCFullYear();
  const digest = createHash("sha256").update(String(dedupeHash)).digest();
  let out = "";
  for (let i = 0; i < 5; i++) out += CROCKFORD[digest[i] % CROCKFORD.length];
  return `#AC-${year}-${out}`;
}

// Parse OSM stars tag · returns integer 1-5 or null.
function parseStarRating(tags) {
  const raw = tags?.stars;
  if (raw == null) return null;
  const n = parseInt(String(raw).match(/\d+/)?.[0] ?? "", 10);
  return Number.isFinite(n) && n >= 1 && n <= 5 ? n : null;
}

// Parse OSM rooms tag · returns positive integer or null.
function parseRoomCount(tags) {
  const raw = tags?.rooms;
  if (raw == null) return null;
  const n = parseInt(String(raw), 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

// Parse OSM amenity-related tags that are TRUE/YES → include in amenities[].
// Never fabricates · never assumes · only extracts when OSM explicitly flags.
function parseAmenities(tags) {
  const found = [];
  const AMENITY_TAGS = {
    "internet_access":       "wifi",
    "internet_access:wifi":  "wifi",
    "wifi":                  "wifi",
    "swimming_pool":         "pool",
    "pool":                  "pool",
    "breakfast":             "breakfast",
    "air_conditioning":      "air_conditioning",
    "parking":               "parking",
    "wheelchair":            "wheelchair_accessible",
    "restaurant":            "on_site_restaurant",
    "bar":                   "on_site_bar",
    "spa":                   "spa",
    "gym":                   "gym",
    "laundry_service":       "laundry",
    "smoking":               "smoking_allowed",
  };
  for (const [key, label] of Object.entries(AMENITY_TAGS)) {
    const v = tags?.[key];
    if (v == null) continue;
    const lower = String(v).toLowerCase();
    if (lower === "yes" || lower === "true" || lower === "1" || lower === "wlan" || lower === "wifi") {
      if (!found.includes(label)) found.push(label);
    }
  }
  return found;
}
