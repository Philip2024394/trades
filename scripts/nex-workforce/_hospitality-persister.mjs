// scripts/nex-workforce/_hospitality-persister.mjs
//
// NEX Workforce · Phase 1.5 persister · Philip 2026-08-27.
//
// Unlocks the "Sorry, I'm not allowed to save them" gate on the category
// walker's hotel/guesthouse/restaurant/cafe cycles. These 4 categories
// discover businesses correctly but until Phase 1.5 threw them away.
//
// Contract (mirrors persistServiceBusiness for shape parity):
//   persistHospitalityCandidate(pool, {
//     targetTable,      // 'nex.food_business' | 'nex.accommodation_business'
//     verticalCategory, // 'restaurant' | 'coffee-cafe' | 'hotel' | 'guesthouse'
//     candidate, city, workerId, cycleRunId,
//   })
//   → { insertedRef | null, existingRef | null, rejectionReason | null }
//
// Preserves ALL existing legacy contracts:
//   · Same dedupe_hash formula as scripts/nex-acquisition/engine.mjs
//   · Same #FL-YYYY-XXXXX / #AC-YYYY-XXXXX Crockford Base32 ref format
//   · Same source/source_reference/source_updated_at/last_verified_at layout
//   · Same claim_status='discovered' + owner_status='unknown' defaults
//   · Same source_snapshot + field_provenance side-writes
//   · Application-level dedup (SELECT-then-INSERT) matching engine.mjs
//     matchAgainstExisting() exact-hash-match behaviour
//
// Does NOT do fuzzy match (>=0.85 name+coord scoring) that engine.mjs adds
// on top · that lives in the legacy walker's persist chain and would require
// loading the whole city universe per cycle. Since our category walker is
// Overpass-tag-scoped it's naturally narrower · duplicate collision rate is
// low. Fuzzy match can be added in Phase 1.6 if evidence shows need.

import { createHash } from "node:crypto";
import { REJECTION_REASONS } from "../nex-worker/rejection-reasons.mjs";
import { resolveIdentity, mergeEnrichment } from "../nex-worker/identity-resolver.mjs";

// Crockford Base32 alphabet (excludes I·L·O·U) · matches engine.mjs.
const CROCKFORD = "ABCDEFGHJKMNPQRSTVWXYZ0123456789".split("");

/** Ref prefix per destination table. */
const REF_PREFIX_BY_TABLE = Object.freeze({
  "nex.food_business":          "FL",
  "nex.accommodation_business": "AC",
});

/** Reuses scripts/nex-acquisition/engine.mjs::computeDedupeHash formula EXACTLY. */
function normaliseName(s) {
  return String(s ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}
export function computeDedupeHash({ name, address, phone, lat, lng }) {
  const nameNorm  = normaliseName(name);
  const addrNorm  = normaliseName(address);
  const phoneTail = String(phone ?? "").replace(/\D+/g, "").slice(-6);
  const latR = lat != null ? Number(lat).toFixed(3) : "";
  const lngR = lng != null ? Number(lng).toFixed(3) : "";
  return [nameNorm, addrNorm, phoneTail, latR, lngR].join("|");
}

/** Deterministic 5-char Crockford suffix from the dedupe hash · matches legacy. */
export function generatePublicRef(targetTable, dedupeHash) {
  const prefix = REF_PREFIX_BY_TABLE[targetTable];
  if (!prefix) throw new Error(`unknown target table for public ref: ${targetTable}`);
  const year = new Date().getUTCFullYear();
  const digest = createHash("sha256").update(String(dedupeHash)).digest();
  let out = "";
  for (let i = 0; i < 5; i++) out += CROCKFORD[digest[i] % CROCKFORD.length];
  return `#${prefix}-${year}-${out}`;
}

/**
 * Persist ONE candidate into a hospitality table.
 * Returns { insertedRef, existingRef, rejectionReason }.
 */
export async function persistHospitalityCandidate(pool, {
  targetTable, verticalCategory, candidate, city, workerId, cycleRunId,
}) {
  if (!candidate.name) {
    return { insertedRef: null, existingRef: null, rejectionReason: REJECTION_REASONS.MALFORMED };
  }
  if (candidate.lat == null || candidate.lng == null) {
    return { insertedRef: null, existingRef: null, rejectionReason: REJECTION_REASONS.GEO_MISS };
  }
  if (!REF_PREFIX_BY_TABLE[targetTable]) {
    return { insertedRef: null, existingRef: null, rejectionReason: REJECTION_REASONS.OTHER };
  }

  const dedupeHash = computeDedupeHash({
    name: candidate.name,
    address: candidate.address ?? null,
    phone: candidate.phone ?? null,
    lat: candidate.lat, lng: candidate.lng,
  });
  const publicRef = generatePublicRef(targetTable, dedupeHash);

  // ── Phase 1a · layered identity resolution (Philip 2026-08-27) ────────
  // Replaces legacy exact-hash-only SELECT with the shared resolver's
  // 5-layer strategy (source_ref → website → phone → name+city candidate
  // → geo confirmation). On STRONG match: MERGE via COALESCE, log to
  // identity_merge_log, return existingRef. On CANDIDATE-only match:
  // log the observation (with layer=name_city, skipped) and proceed to
  // INSERT — evidence not sufficient for safe merge, two real businesses
  // can share a name in one city.
  const incomingForLog = {
    source: candidate.sourceType ?? "osm_overpass",
    sourceReference: candidate.sourceReference ?? null,
    name: candidate.name,
    city,
    website: candidate.website ?? null,
    phone: candidate.phone ?? null,
    whatsapp: candidate.whatsapp ?? null,
    lat: candidate.lat,
    lng: candidate.lng,
    extras: {
      address: candidate.address ?? null,
      rawTags: candidate.rawTags ?? null,
      verticalCategory,
    },
  };

  const resolved = await resolveIdentity(pool, {
    table: targetTable,
    candidate: incomingForLog,
  });

  if (resolved.match === "strong") {
    // MERGE · never reject. Enrich existing row with fields incoming has
    // that existing lacks. COALESCE guard prevents overwrite. owner_verified
    // guard prevents any writeback on claimed rows.
    const enrichableFields = [];
    const incomingValues = {};
    if (candidate.address)      { enrichableFields.push("address");           incomingValues.address = candidate.address; }
    if (candidate.phone)        { enrichableFields.push("phone");             incomingValues.phone = candidate.phone; }
    if (candidate.whatsapp)     { enrichableFields.push("whatsapp_number");   incomingValues.whatsapp_number = candidate.whatsapp; }
    if (candidate.website)      { enrichableFields.push("website");           incomingValues.website = candidate.website; }
    if (candidate.lat != null)  { enrichableFields.push("coordinates_lat");   incomingValues.coordinates_lat = candidate.lat; }
    if (candidate.lng != null)  { enrichableFields.push("coordinates_lng");   incomingValues.coordinates_lng = candidate.lng; }

    const merge = await mergeEnrichment(pool, {
      table: targetTable,
      existing: resolved.existing,
      incoming: incomingForLog,
      layer: resolved.layer,
      enrichableFields,
      incomingValues,
      workerId,
      cycleRunId,
    });
    return { insertedRef: null, existingRef: merge.existingRef, rejectionReason: REJECTION_REASONS.MATCHED_EXISTING };
  }

  if (resolved.match === "candidate") {
    // Log the candidate collision — future observations with stronger
    // signals will resolve identity. Insert proceeds to preserve evidence.
    await mergeEnrichment(pool, {
      table: targetTable,
      existing: resolved.existing,
      incoming: incomingForLog,
      layer: "name_city",
      enrichableFields: [],       // no merge — evidence insufficient
      incomingValues: {},
      workerId,
      cycleRunId,
    }).catch((err) => {
      // Non-fatal · candidate logging failure shouldn't block the INSERT.
      console.error(`  [phase1a] candidate log failed: ${err.message}`);
    });
    // Fall through to INSERT.
  }

  // ── INSERT ── uses the exact column set the legacy insertNewRecord uses.
  // On INSERT collision (concurrent cycle race), ON CONFLICT DO NOTHING catches
  // via public_listing_ref UNIQUE (both tables) OR dedupe_hash UNIQUE (accom only).
  let insertRes;
  try {
    // country: hard-coded 'ID' · Indonesia-only workforce for now. Matches
    // legacy walker's `this.country` value on accommodationYogyakartaConfig
    // and foodYogyakartaConfig. When Phase 2 opens up other countries, this
    // must derive from the job registry's `geographic_scope` field.
    insertRes = await pool.query(
      `INSERT INTO ${targetTable} (
         public_listing_ref, business_name, category, categories, address, city, country,
         coordinates_lng, coordinates_lat,
         whatsapp_number, phone, website,
         source, source_reference, source_licence_terms,
         source_updated_at, last_verified_at, verification_source,
         dedupe_hash, claim_status, owner_status, created_by
       ) VALUES (
         $1, $2, $3, $4::text[], $5, $6, 'ID',
         $7, $8,
         $9, $10, $11,
         $12, $13, $14,
         $15, $16, $17,
         $18, 'discovered', 'unknown', $19
       )
       ON CONFLICT DO NOTHING
       RETURNING public_listing_ref`,
      [
        publicRef, candidate.name, verticalCategory,
        Array.isArray(candidate.categories) ? candidate.categories : [],
        candidate.address ?? null, city,
        candidate.lng, candidate.lat,
        candidate.whatsapp ?? null, candidate.phone ?? null, candidate.website ?? null,
        candidate.sourceType ?? "osm_overpass",
        candidate.sourceReference ?? null,
        candidate.sourceLicenceTerms ?? null,
        candidate.sourceUpdatedAt ?? null,
        candidate.lastVerifiedAt ?? null,
        candidate.verificationSource ?? null,
        dedupeHash,
        `agent:workforce-category-walker:${cycleRunId}`,
      ],
    );
  } catch (err) {
    // FK/CHECK/UNIQUE constraint failures land here · treat as row-level rejection
    // so cycle continues with the next candidate.
    console.error(`  [phase1.5] INSERT ${targetTable} failed for ${candidate.sourceReference}: ${err.message}`);
    return { insertedRef: null, existingRef: null, rejectionReason: REJECTION_REASONS.OTHER };
  }
  if (insertRes.rowCount === 0) {
    return { insertedRef: null, existingRef: publicRef, rejectionReason: REJECTION_REASONS.MATCHED_EXISTING };
  }

  // ── Side-write 1: source_snapshot (raw OSM tag preservation) ──────
  const snapshotTable = `${targetTable}_source_snapshot`;
  try {
    await pool.query(
      `INSERT INTO ${snapshotTable}
         (business_ref, source, source_reference, raw_payload, cycle_run_id)
       VALUES ($1, $2, $3, $4::jsonb, $5::uuid)`,
      [
        publicRef, candidate.sourceType ?? "osm_overpass",
        candidate.sourceReference ?? "unknown",
        JSON.stringify({ tags: candidate.rawTags ?? {}, lat: candidate.lat, lng: candidate.lng }),
        cycleRunId,
      ],
    );
  } catch (err) {
    // Non-fatal · row is already persisted.
    console.error(`  [phase1.5] snapshot insert failed for ${publicRef}: ${err.message}`);
  }

  // ── Side-write 2: field_provenance (Direct-Provenance A · Task #74) ──
  const provenanceTable = `${targetTable}_field_provenance`;
  const provenanceFields = ["business_name", "category"];
  if (candidate.address)     provenanceFields.push("address");
  if (candidate.lat != null) provenanceFields.push("coordinates_lat");
  if (candidate.lng != null) provenanceFields.push("coordinates_lng");
  if (candidate.phone)       provenanceFields.push("phone");
  if (candidate.whatsapp)    provenanceFields.push("whatsapp_number");
  if (candidate.website)     provenanceFields.push("website");
  const writtenBy = `agent:workforce-category-walker`;
  const sourceRef = candidate.sourceReference ?? null;
  for (const fieldName of provenanceFields) {
    try {
      await pool.query(
        `INSERT INTO ${provenanceTable}
           (business_ref, field_name, trust_layer, written_at, written_by, source_reference, cycle_run_id)
         VALUES ($1, $2, 'source_import', now(), $3, $4, $5::uuid)
         ON CONFLICT (business_ref, field_name) DO NOTHING`,
        [publicRef, fieldName, writtenBy, sourceRef, cycleRunId],
      );
    } catch (err) {
      console.error(`  [phase1.5] provenance ${fieldName} failed for ${publicRef}: ${err.message}`);
    }
  }

  return { insertedRef: publicRef, existingRef: null, rejectionReason: null };
}
