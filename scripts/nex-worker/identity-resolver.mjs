// scripts/nex-worker/identity-resolver.mjs
//
// NEX Identity Resolution · Phase 1a · Philip 2026-08-27.
//
// Doctrine: project_nex_dedup_and_identity_resolution_doctrine_2026_08_27.md
//
// SINGLE identity authority for the four business tables (food_business,
// accommodation_business, service_business, mp_seller). Every writer
// MUST call resolveIdentity() before INSERT. On match: caller MUST call
// mergeEnrichment() to enrich the existing row (never create a second).
// On no match: caller inserts a fresh row with the incoming source_reference.
//
// Layered strategy (in order of trust, first hit wins):
//   Layer 1: (source, source_reference) exact match         · STRONG
//   Layer 2: normalized website match                        · STRONG
//   Layer 3: normalized phone/whatsapp match (last 9 digits) · STRONG
//   Layer 4: normalized (name, city) match                   · CANDIDATE
//   Layer 5: geographic confirmation upgrades Layer 4 to STRONG (dist<200m)
//
// CANDIDATE means: we believe this MIGHT be the same business but confidence
// is not high enough to auto-merge without more evidence. Caller should
// enrich if additional signals (website/phone) match, otherwise treat as
// new row. Multiple candidates returned so caller can pick or defer.
//
// Anti-pattern: NEVER treat (name, city) as absolute identity. Two real
// businesses can share a name in one city (restaurant + laundry, ABC
// Services × 2, etc.).
//
// Provenance: mergeEnrichment() writes to nex.identity_merge_log with the
// full incoming payload + layer that fired + enriched fields. Philip:
// "never lose useful source data simply because we're deduplicating."

// ── Column-name mapping per table ──────────────────────────────────────
// (mp_seller uses different column names than the business tables.)

const TABLE_SCHEMA = Object.freeze({
  "nex.food_business": {
    refCol: "public_listing_ref",
    nameCol: "business_name",
    cityCol: "city",
    latCol: "coordinates_lat",
    lngCol: "coordinates_lng",
    phoneCol: "phone",
    whatsappCol: "whatsapp_number",
    websiteCol: "website",
    ownerVerifiedGuard: "owner_status <> 'verified'",
  },
  "nex.accommodation_business": {
    refCol: "public_listing_ref",
    nameCol: "business_name",
    cityCol: "city",
    latCol: "coordinates_lat",
    lngCol: "coordinates_lng",
    phoneCol: "phone",
    whatsappCol: "whatsapp_number",
    websiteCol: "website",
    ownerVerifiedGuard: "owner_status <> 'verified'",
  },
  "nex.service_business": {
    refCol: "public_listing_ref",
    nameCol: "business_name",
    cityCol: "city",
    latCol: "coordinates_lat",
    lngCol: "coordinates_lng",
    phoneCol: "phone",
    whatsappCol: "whatsapp_number",
    websiteCol: "website",
    ownerVerifiedGuard: "owner_status <> 'verified'",
  },
  "nex.mp_seller": {
    refCol: "slug",
    nameCol: "display_name",
    cityCol: "city",
    latCol: null,        // mp_seller has no coordinates yet
    lngCol: null,
    phoneCol: null,      // mp_seller has no phone yet (comms_contact FK optional)
    whatsappCol: null,
    websiteCol: null,    // mp_seller has no website yet
    ownerVerifiedGuard: "status NOT IN ('verified', 'active')",
  },
});

// ── Normalization helpers (deterministic, unicode-aware) ───────────────

export function normalizeName(s) {
  if (s == null) return "";
  return String(s)
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")   // strip combining marks (café → cafe)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function normalizeCity(s) {
  return normalizeName(s);
}

export function normalizeWebsite(s) {
  if (s == null) return null;
  const trimmed = String(s).trim();
  if (!trimmed) return null;
  try {
    const withProto = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    const u = new URL(withProto);
    const host = u.hostname.toLowerCase().replace(/^www\./, "");
    if (!host || host === "localhost") return null;
    const path = u.pathname.replace(/\/+$/, "");
    return path ? `${host}${path}` : host;
  } catch {
    return null;
  }
}

export function normalizePhone(s) {
  if (s == null) return null;
  const digits = String(s).replace(/\D+/g, "");
  if (digits.length < 9) return null;
  return digits.slice(-9);   // last 9 digits (drops country-code variance)
}

export function haversineMetres(lat1, lng1, lat2, lng2) {
  if ([lat1, lng1, lat2, lng2].some((v) => v == null)) return null;
  const R = 6371e3;
  const toRad = (d) => (Number(d) * Math.PI) / 180;
  const dLat = toRad(Number(lat2) - Number(lat1));
  const dLng = toRad(Number(lng2) - Number(lng1));
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(Number(lat1))) * Math.cos(toRad(Number(lat2))) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── Core resolver ──────────────────────────────────────────────────────
//
// Args:
//   pool        pg.Pool
//   table       one of TABLE_SCHEMA keys (e.g. 'nex.food_business')
//   candidate   {
//     source, sourceReference,
//     name, city,
//     website, phone, whatsapp,
//     lat, lng,
//   }
// Returns:
//   { match: 'strong', layer: 'source_ref'|'website'|'phone'|'geo_confirmed', existing }
//   { match: 'candidate', layer: 'name_city', existing, candidates: [...] }
//   { match: 'none' }

export async function resolveIdentity(pool, { table, candidate }) {
  const schema = TABLE_SCHEMA[table];
  if (!schema) throw new Error(`identity-resolver · unknown table: ${table}`);

  // Layer 1: source + source_reference (strongest)
  if (candidate.source && candidate.sourceReference) {
    const r = await pool.query(
      `SELECT * FROM ${table}
        WHERE source = $1 AND source_reference = $2
        LIMIT 1`,
      [candidate.source, candidate.sourceReference],
    );
    if (r.rowCount > 0) {
      return { match: "strong", layer: "source_ref", existing: r.rows[0] };
    }
  }

  // Layer 2: normalized website (strong, when trustworthy)
  const web = normalizeWebsite(candidate.website);
  if (web && schema.websiteCol) {
    const r = await pool.query(
      `SELECT * FROM ${table}
        WHERE ${schema.websiteCol} IS NOT NULL
          AND ${schema.websiteCol} <> ''
          AND LOWER(REGEXP_REPLACE(REGEXP_REPLACE(${schema.websiteCol}, '^https?://(www\\.)?', ''), '/+$', '')) = $1
        LIMIT 1`,
      [web],
    );
    if (r.rowCount > 0) {
      return { match: "strong", layer: "website", existing: r.rows[0] };
    }
  }

  // Layer 3: normalized phone / whatsapp (strong)
  const phone = normalizePhone(candidate.phone) ?? normalizePhone(candidate.whatsapp);
  if (phone && (schema.phoneCol || schema.whatsappCol)) {
    const cols = [schema.phoneCol, schema.whatsappCol].filter(Boolean);
    const conds = cols.map((c) =>
      `RIGHT(REGEXP_REPLACE(COALESCE(${c}, ''), '[^0-9]+', '', 'g'), 9) = $1`
    ).join(" OR ");
    const r = await pool.query(
      `SELECT * FROM ${table} WHERE (${conds}) LIMIT 1`,
      [phone],
    );
    if (r.rowCount > 0) {
      return { match: "strong", layer: "phone", existing: r.rows[0] };
    }
  }

  // Layer 4: normalized (name, city) as CANDIDATE
  const nameNorm = normalizeName(candidate.name);
  const cityNorm = normalizeCity(candidate.city);
  if (nameNorm.length >= 2 && cityNorm) {
    // Match on normalized name AND normalized city.
    const r = await pool.query(
      `SELECT * FROM ${table}
        WHERE LOWER(REGEXP_REPLACE(COALESCE(${schema.nameCol}, ''), '[^a-zA-Z0-9]+', ' ', 'g')) = $1
          AND LOWER(REGEXP_REPLACE(COALESCE(${schema.cityCol}, ''), '[^a-zA-Z0-9]+', ' ', 'g')) = $2
        LIMIT 5`,
      [nameNorm, cityNorm],
    );

    if (r.rowCount > 0) {
      // Layer 5: geographic confirmation upgrades candidate → strong.
      if (candidate.lat != null && candidate.lng != null && schema.latCol && schema.lngCol) {
        for (const ex of r.rows) {
          if (ex[schema.latCol] != null && ex[schema.lngCol] != null) {
            const dist = haversineMetres(ex[schema.latCol], ex[schema.lngCol], candidate.lat, candidate.lng);
            if (dist != null && dist < 200) {
              return {
                match: "strong",
                layer: "geo_confirmed",
                existing: ex,
                distanceMetres: Math.round(dist),
              };
            }
          }
        }
      }

      // No geo confirmation. Only one candidate → still CANDIDATE, not strong.
      // Rationale: "ABC Services" + "Yogyakarta" could be two real businesses.
      // Caller decides what to do (usually: treat as new row, log the collision).
      return {
        match: "candidate",
        layer: "name_city",
        existing: r.rows[0],
        candidates: r.rows,
      };
    }
  }

  return { match: "none" };
}

// ── Merge enrichment ───────────────────────────────────────────────────
//
// Called by writers when resolveIdentity() returns match='strong'. Applies
// COALESCE semantics: only fills fields where existing row has NULL. Never
// overwrites when the row is owner-verified. Writes to identity_merge_log.
//
// Args:
//   pool
//   table
//   existing               the existing row (from resolver result)
//   incoming               same candidate shape as resolveIdentity
//   layer                  which resolver layer fired ('source_ref' | ...)
//   enrichableFields       array of column names the caller wants to try
//                          e.g. ['phone', 'whatsapp_number', 'website',
//                                'coordinates_lat', 'coordinates_lng']
//   incomingValues         { <colName>: value } — values to potentially write
//   workerId, cycleRunId
// Returns:
//   { updatedRefs, enrichedFields, skippedReason }

export async function mergeEnrichment(pool, {
  table,
  existing,
  incoming,
  layer,
  enrichableFields = [],
  incomingValues = {},
  workerId = null,
  cycleRunId = null,
}) {
  const schema = TABLE_SCHEMA[table];
  if (!schema) throw new Error(`identity-resolver · unknown table: ${table}`);

  const existingRef = existing[schema.refCol];
  if (!existingRef) throw new Error(`identity-resolver · existing row missing ${schema.refCol}`);

  // Compute which fields we can actually enrich (only fill NULL/empty).
  const toWrite = [];
  for (const col of enrichableFields) {
    const val = incomingValues[col];
    if (val == null || val === "") continue;
    const cur = existing[col];
    if (cur == null || cur === "") toWrite.push({ col, val });
  }

  let enrichedFields = [];
  let skippedReason = null;

  if (toWrite.length > 0) {
    // Build UPDATE with COALESCE guard + owner-verified guard.
    const setClauses = toWrite.map((f, i) => `${f.col} = COALESCE(${f.col}, $${i + 2})`);
    const params = [existingRef, ...toWrite.map((f) => f.val)];
    const updRes = await pool.query(
      `UPDATE ${table}
          SET ${setClauses.join(", ")}, updated_at = now()
        WHERE ${schema.refCol} = $1
          AND ${schema.ownerVerifiedGuard}
        RETURNING ${schema.refCol}`,
      params,
    );
    if (updRes.rowCount > 0) {
      enrichedFields = toWrite.map((f) => f.col);
    } else {
      skippedReason = "owner_verified · no writeback allowed";
    }
  }

  // Log EVERY merge — even zero-enrichment matches (proves observation
  // was seen and the resolver correctly identified the entity).
  await pool.query(
    `INSERT INTO nex.identity_merge_log (
       table_name, existing_ref, match_layer,
       incoming_source, incoming_source_reference,
       incoming_name, incoming_city,
       incoming_website, incoming_phone, incoming_whatsapp,
       incoming_lat, incoming_lng, incoming_extras,
       enriched_fields, skipped_reason,
       worker_id, cycle_run_id
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)`,
    [
      table, existingRef, layer,
      incoming.source ?? null, incoming.sourceReference ?? null,
      incoming.name ?? null, incoming.city ?? null,
      incoming.website ?? null, incoming.phone ?? null, incoming.whatsapp ?? null,
      incoming.lat ?? null, incoming.lng ?? null,
      JSON.stringify(incoming.extras ?? {}),
      enrichedFields,
      skippedReason,
      workerId, cycleRunId,
    ],
  );

  return { existingRef, enrichedFields, skippedReason };
}

// ── Deterministic slug builder for mp_seller (unify writers) ───────────
//
// Root cause of 2,324 mp_seller dupes: two writers used different slug
// formulas. Both now call this function. Slug is deterministic across
// sources: normalized name + normalized city + short hash of source_ref.
// Same real-world business found via two providers → same slug → INSERT
// hits UNIQUE(slug) → walker calls resolveIdentity to enrich instead.

import { createHash } from "node:crypto";

export function buildMpSellerSlug({ displayName, city, source, sourceReference }) {
  const nameSlug = normalizeName(displayName).replace(/\s+/g, "-");
  const citySlug = normalizeCity(city).replace(/\s+/g, "-");
  // Short hash of (source, source_reference) so genuinely different OSM
  // nodes with the same name in the same city produce different slugs.
  // But if source/source_reference are absent, hash empty → same slug
  // for same (name, city), which is exactly what causes intended dedup.
  const hashSrc = `${source ?? ""}|${sourceReference ?? ""}`;
  const shortHash = createHash("sha256").update(hashSrc).digest("hex").slice(0, 8);
  const parts = [nameSlug, citySlug];
  if (source && sourceReference) parts.push(shortHash);
  return parts.filter(Boolean).join("-").slice(0, 120);
}

// Convenience: pre-check by slug before INSERT (used by mp_seller writers
// when they need to unify BEFORE calling resolveIdentity).
export async function findMpSellerBySlug(pool, slug) {
  const r = await pool.query(
    `SELECT * FROM nex.mp_seller WHERE slug = $1 LIMIT 1`,
    [slug],
  );
  return r.rowCount > 0 ? r.rows[0] : null;
}
