// scripts/nex-workforce/_marketplace-persister.mjs
//
// NEX Workforce · Phase 2 marketplace persister · Philip 2026-08-27.
//
// Writes retail sellers discovered by the category walker into nex.mp_seller.
// One row per Overpass shop=* element · deterministic slug for idempotent
// re-runs · dedup via UNIQUE(slug) constraint.
//
// Contract (mirrors persistServiceBusiness / persistHospitalityCandidate):
//   persistMarketplaceSeller(pool, {
//     candidate, city, workerId, cycleRunId, categorySlug,
//   })
//   → { insertedSlug | null, existingSlug | null, rejectionReason | null }
//
// Schema notes (nex.mp_seller):
//   · seller_id UUID (auto)
//   · slug TEXT UNIQUE          ← dedup key · we generate deterministically
//   · display_name TEXT NOT NULL
//   · city TEXT
//   · jurisdiction TEXT NOT NULL DEFAULT 'ID/DIY/Yogyakarta'  ← overridden per city
//   · status ENUM('discovered', ...) DEFAULT 'discovered'      ← visibility gate
//   · bio · cover_image_ref · logo_image_ref · contact_ref TEXT (all nullable)
//   · discovered_from TEXT
//   · worker_id · cycle_run_id (attribution)
//
// Not written yet · reserved for later phases:
//   · address · phone · whatsapp (would need a `contact_ref` FK setup)
//   · coordinates (mp_seller has no lat/lng columns · geo lives on products)
//   · cover_image_ref (image enrichment · Phase 3 marketplace)

import { REJECTION_REASONS } from "../nex-worker/rejection-reasons.mjs";
import {
  resolveIdentity, mergeEnrichment, buildMpSellerSlug,
} from "../nex-worker/identity-resolver.mjs";

/**
 * Deterministic seller slug · Phase 1a unification (Philip 2026-08-27).
 * Delegates to buildMpSellerSlug so this writer and _market-walker-discover
 * produce the SAME slug for the SAME real-world business, closing the
 * root cause of 2,324 mp_seller dupes (44%).
 */
export function generateSellerSlug({ name, city, source, sourceReference }) {
  return buildMpSellerSlug({
    displayName: name, city,
    source: source ?? "osm_overpass",
    sourceReference,
  });
}

/** Build the 3-level jurisdiction string mp_seller expects. */
function buildJurisdiction(city) {
  // Best-effort · matches the format the legacy default uses ('ID/DIY/Yogyakarta').
  // Non-Yogyakarta cities land as 'ID/<city>/<city>' · admin can re-jurisdict later.
  if (!city) return "ID/DIY/Yogyakarta";
  if (city === "Yogyakarta") return "ID/DIY/Yogyakarta";
  return `ID/${city}/${city}`;
}

/**
 * Persist ONE marketplace seller candidate into nex.mp_seller.
 * Returns { insertedSlug, existingSlug, rejectionReason }.
 * Cutover 5 preserves owner_status semantics · legacy mp_seller uses a
 * `status` ENUM instead · we always insert with default 'discovered'.
 */
export async function persistMarketplaceSeller(pool, {
  candidate, city, workerId, cycleRunId, categorySlug,
}) {
  if (!candidate.name) {
    return { insertedSlug: null, existingSlug: null, rejectionReason: REJECTION_REASONS.MALFORMED };
  }
  // mp_seller doesn't require coordinates but we insist on them so the future
  // per-city browse (once /nex-market gets a city grid) has a real anchor.
  if (candidate.lat == null || candidate.lng == null) {
    return { insertedSlug: null, existingSlug: null, rejectionReason: REJECTION_REASONS.GEO_MISS };
  }

  const source = candidate.sourceType ?? "osm_overpass";
  const sourceReference = candidate.sourceReference ?? null;
  const slug = generateSellerSlug({
    name: candidate.name, city, source, sourceReference,
  });
  const jurisdiction = buildJurisdiction(city);
  const discoveredFrom = `agent:workforce-category-walker/${categorySlug}`;

  // ── Phase 1a resolver pre-check (Philip 2026-08-27) ──────────────────
  const incomingForLog = {
    source, sourceReference,
    name: candidate.name, city,
    website: null, phone: null, whatsapp: null,
    lat: candidate.lat, lng: candidate.lng,
    extras: { categorySlug, jurisdiction },
  };
  const resolved = await resolveIdentity(pool, {
    table: "nex.mp_seller", candidate: incomingForLog,
  });
  if (resolved.match === "strong") {
    await mergeEnrichment(pool, {
      table: "nex.mp_seller", existing: resolved.existing,
      incoming: incomingForLog, layer: resolved.layer,
      enrichableFields: ["city", "jurisdiction"],
      incomingValues: { city, jurisdiction },
      workerId, cycleRunId,
    });
    return { insertedSlug: null, existingSlug: resolved.existing.slug, rejectionReason: REJECTION_REASONS.MATCHED_EXISTING };
  }
  if (resolved.match === "candidate") {
    await mergeEnrichment(pool, {
      table: "nex.mp_seller", existing: resolved.existing,
      incoming: incomingForLog, layer: "name_city",
      enrichableFields: [], incomingValues: {},
      workerId, cycleRunId,
    }).catch(() => {});
    // Fall through to INSERT.
  }

  let insertRes;
  try {
    insertRes = await pool.query(
      `INSERT INTO nex.mp_seller
         (slug, display_name, city, jurisdiction, status, discovered_from,
          source, source_reference, worker_id, cycle_run_id)
       VALUES ($1, $2, $3, $4, 'discovered', $5, $6, $7, $8, $9::uuid)
       ON CONFLICT (slug) DO NOTHING
       RETURNING slug`,
      [
        slug, candidate.name, city, jurisdiction, discoveredFrom,
        source, sourceReference, workerId, cycleRunId,
      ],
    );
  } catch (err) {
    // Unique(source, source_reference) or unique(slug) collision from concurrent race.
    // Try resolver again to enrich the row that just won the race.
    if (err.code === "23505") {
      const secondPass = await resolveIdentity(pool, {
        table: "nex.mp_seller", candidate: incomingForLog,
      });
      if (secondPass.match === "strong") {
        await mergeEnrichment(pool, {
          table: "nex.mp_seller", existing: secondPass.existing,
          incoming: incomingForLog, layer: secondPass.layer,
          enrichableFields: [], incomingValues: {},
          workerId, cycleRunId,
        });
        return { insertedSlug: null, existingSlug: secondPass.existing.slug, rejectionReason: REJECTION_REASONS.MATCHED_EXISTING };
      }
    }
    console.error(`  [marketplace] INSERT mp_seller failed for ${sourceReference}: ${err.message}`);
    return { insertedSlug: null, existingSlug: null, rejectionReason: REJECTION_REASONS.OTHER };
  }

  if (insertRes.rowCount === 0) {
    return { insertedSlug: null, existingSlug: slug, rejectionReason: REJECTION_REASONS.MATCHED_EXISTING };
  }

  return { insertedSlug: slug, existingSlug: null, rejectionReason: null };
}
