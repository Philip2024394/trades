// scripts/nex-factory/score-candidate.mjs
//
// Directory Factory · Calibration Harness · Era 1 scorer.
// Pure function · reads DB · returns scores + breakdown · does not
// activate anything · does not modify any row.
//
// Implements the §1 signal catalogue and §2 formula from
// docs/nex/directory-factory-scoring-contract.md · placeholder tier
// thresholds from §3 (deliberately unlocked until calibration).
//
// Scorer version discipline: `SCORER_VERSION` is bumped whenever the
// math changes. Score rows in nex.category_candidate_score are stamped
// with the version that produced them so calibration can distinguish
// scores from different scorer generations.

export const SCORER_VERSION = "era1-v1";

// ── Placeholder tier thresholds (Q1-Q4 unlocked per Philip 2026-08-23) ──
export const THRESHOLDS = {
  HIGH_QUALITY:  0.85,
  HIGH_SAFETY:   0.90,
  MEDIUM_QUALITY: 0.50,
  MEDIUM_SAFETY:  0.50,
};

// ── Quality weight table (§2a) · Era 1 ──
const QUALITY_WEIGHTS = {
  business_count:        0.30,  // asymptote at 300
  cycle_count:           0.20,  // asymptote at 8
  observation_span_days: 0.15,  // asymptote at 14 days
  osm_tag_strength:      0.15,  // explicit=1.0 · semi=0.6 · fuzzy=0.2
  completeness:          0.10,  // avg of contact + coord + address
  geographic_clustering: 0.10,  // direct ratio
};

// ── Safety multiplier table (§2b) · Era 1 ──
const SAFETY_MULTIPLIERS = {
  keyword_collision:            0.0,
  route_collision:              0.0,
  duplicate_of_existing:        0.0,
  superseded:                   0.0,
  fuzzy_osm:                    0.6,   // when osm_tag_strength === 'fuzzy'
  low_geographic_clustering:    0.7,   // when geographic_clustering < 0.4
  language_not_bilingual:       0.85,  // when language_coverage !== 'both'
  no_image_evidence:            0.9,   // when image_candidates is empty
};

/**
 * Score a single candidate.
 *
 * @param {{
 *   pool: import('pg').Pool,
 *   candidate: {
 *     id: string,
 *     proposed_category_id: string,
 *     suggested_parent_vertical: 'food'|'accommodation'|'rentals'|'services'|'tourism',
 *     suggested_countries: string[],
 *     brain_keywords: string[],
 *     business_count: number,
 *     cycle_count: number,
 *     image_candidates: unknown[],
 *     duplicate_of_registry_id: string | null,
 *     superseded_by_candidate_id: string | null,
 *   },
 *   registryIds: Set<string>,
 *   registryRoutes: Set<string>,
 *   registryKeywords: Set<string>,
 * }} args
 * @returns {Promise<{
 *   quality_score: number,
 *   safety_score: number,
 *   provisional_tier: 'HIGH'|'MEDIUM'|'LOW',
 *   primary_hazard: string | null,
 *   signals: object,
 *   quality_breakdown: object,
 *   safety_breakdown: object,
 *   scorer_version: string,
 * }>}
 */
export async function scoreCandidate({ pool, candidate, registryIds, registryRoutes, registryKeywords }) {
  const { proposed_category_id: propId, suggested_countries: countries = [], suggested_parent_vertical: vertical } = candidate;
  const country = countries[0] ?? "ID";

  // Only food vertical has real data today · other verticals fall back
  // to candidate.business_count etc. without live DB completeness signals.
  const meta = pickTableMeta(vertical);
  const liveSignals = meta
    ? await liveSignalsFromDb(pool, meta, propId, country)
    : null;

  // ── Signal computation ───────────────────────────────────────────
  const s1_businessCount = candidate.business_count;
  const s2_cycleCount    = candidate.cycle_count;

  const s3_observationSpanDays = liveSignals?.observation_span_days ?? 0;
  const s4_osmTagStrength      = liveSignals ? deriveOsmTagStrength(liveSignals.secondary_evidence_ratio) : "fuzzy";
  const s5_contactCompleteness = liveSignals?.contact_completeness ?? 0;
  const s6_coordCompleteness   = liveSignals?.coord_completeness ?? 0;
  const s7_addressCompleteness = liveSignals?.address_completeness ?? 0;
  const s8_languageCoverage    = deriveLanguageCoverage(candidate.brain_keywords);
  const s9_keywordCollision    = anyKeywordIn(candidate.brain_keywords, registryKeywords);
  const s10_routeCollision     = registryIds.has(propId) || registryRoutes.has(`/${propId}`);
  const s11_imageEvidenceCount = Array.isArray(candidate.image_candidates) ? candidate.image_candidates.length : 0;
  const s12_geographicClustering = liveSignals?.geographic_clustering ?? 0;
  const s13_duplicateOfExisting = Boolean(candidate.duplicate_of_registry_id);
  const s14_superseded          = Boolean(candidate.superseded_by_candidate_id);

  const signals = {
    business_count:        s1_businessCount,
    cycle_count:           s2_cycleCount,
    observation_span_days: round3(s3_observationSpanDays),
    osm_tag_strength:      s4_osmTagStrength,
    contact_completeness:  round3(s5_contactCompleteness),
    coord_completeness:    round3(s6_coordCompleteness),
    address_completeness:  round3(s7_addressCompleteness),
    language_coverage:     s8_languageCoverage,
    keyword_collision_risk: s9_keywordCollision,
    route_collision_risk:  s10_routeCollision,
    image_evidence_count:  s11_imageEvidenceCount,
    geographic_clustering: round3(s12_geographicClustering),
    duplicate_of_existing: s13_duplicateOfExisting,
    superseded:            s14_superseded,
  };

  // ── Quality score (§2a) ─────────────────────────────────────────
  const q_business = Math.min(s1_businessCount / 300, 1.0);
  const q_cycles   = Math.min(s2_cycleCount / 8, 1.0);
  const q_span     = Math.min(s3_observationSpanDays / 14, 1.0);
  const q_osm      = s4_osmTagStrength === "explicit-tag" ? 1.0
                   : s4_osmTagStrength === "semi-explicit" ? 0.6
                   : 0.2;
  const q_complete = (s5_contactCompleteness + s6_coordCompleteness + s7_addressCompleteness) / 3;
  const q_geo      = s12_geographicClustering;

  const quality_breakdown = {
    business_count:        { weight: QUALITY_WEIGHTS.business_count,        raw: round3(q_business), contribution: round4(q_business * QUALITY_WEIGHTS.business_count) },
    cycle_count:           { weight: QUALITY_WEIGHTS.cycle_count,           raw: round3(q_cycles),   contribution: round4(q_cycles   * QUALITY_WEIGHTS.cycle_count) },
    observation_span_days: { weight: QUALITY_WEIGHTS.observation_span_days, raw: round3(q_span),     contribution: round4(q_span     * QUALITY_WEIGHTS.observation_span_days) },
    osm_tag_strength:      { weight: QUALITY_WEIGHTS.osm_tag_strength,      raw: q_osm,               contribution: round4(q_osm     * QUALITY_WEIGHTS.osm_tag_strength) },
    completeness:          { weight: QUALITY_WEIGHTS.completeness,          raw: round3(q_complete), contribution: round4(q_complete * QUALITY_WEIGHTS.completeness) },
    geographic_clustering: { weight: QUALITY_WEIGHTS.geographic_clustering, raw: round3(q_geo),      contribution: round4(q_geo      * QUALITY_WEIGHTS.geographic_clustering) },
  };
  const quality_score = round4(clamp01(
    Object.values(quality_breakdown).reduce((sum, b) => sum + b.contribution, 0),
  ));

  // ── Safety score (§2b · multiplicative penalties) ───────────────
  const safety_breakdown = {};
  let safety = 1.0;

  if (s9_keywordCollision) {
    safety_breakdown.keyword_collision = { multiplier: SAFETY_MULTIPLIERS.keyword_collision, reason: "brain_keyword overlaps with active Registry entry" };
    safety *= SAFETY_MULTIPLIERS.keyword_collision;
  }
  if (s10_routeCollision) {
    safety_breakdown.route_collision = { multiplier: SAFETY_MULTIPLIERS.route_collision, reason: "proposed id or /route already in Registry" };
    safety *= SAFETY_MULTIPLIERS.route_collision;
  }
  if (s13_duplicateOfExisting) {
    safety_breakdown.duplicate_of_existing = { multiplier: SAFETY_MULTIPLIERS.duplicate_of_existing, reason: "human flagged duplicate_of_registry_id" };
    safety *= SAFETY_MULTIPLIERS.duplicate_of_existing;
  }
  if (s14_superseded) {
    safety_breakdown.superseded = { multiplier: SAFETY_MULTIPLIERS.superseded, reason: "human flagged superseded_by_candidate_id" };
    safety *= SAFETY_MULTIPLIERS.superseded;
  }
  if (s4_osmTagStrength === "fuzzy") {
    safety_breakdown.fuzzy_osm = { multiplier: SAFETY_MULTIPLIERS.fuzzy_osm, reason: "osm_tag_strength=fuzzy · signal is name-based not tag-based" };
    safety *= SAFETY_MULTIPLIERS.fuzzy_osm;
  }
  if (s12_geographicClustering < 0.4) {
    safety_breakdown.low_geographic_clustering = { multiplier: SAFETY_MULTIPLIERS.low_geographic_clustering, reason: `only ${round3(s12_geographicClustering * 100)}% of businesses in median-district bbox` };
    safety *= SAFETY_MULTIPLIERS.low_geographic_clustering;
  }
  if (s8_languageCoverage !== "both") {
    safety_breakdown.language_not_bilingual = { multiplier: SAFETY_MULTIPLIERS.language_not_bilingual, reason: `brain_keywords are ${s8_languageCoverage} only` };
    safety *= SAFETY_MULTIPLIERS.language_not_bilingual;
  }
  if (s11_imageEvidenceCount === 0) {
    safety_breakdown.no_image_evidence = { multiplier: SAFETY_MULTIPLIERS.no_image_evidence, reason: "no image_candidates on the row" };
    safety *= SAFETY_MULTIPLIERS.no_image_evidence;
  }

  const safety_score = round4(clamp01(safety));

  // ── Tier assignment (§3 · placeholder thresholds) ───────────────
  let provisional_tier;
  let primary_hazard = null;
  if (quality_score >= THRESHOLDS.HIGH_QUALITY && safety_score >= THRESHOLDS.HIGH_SAFETY) {
    provisional_tier = "HIGH";
  } else if (quality_score >= THRESHOLDS.MEDIUM_QUALITY && safety_score >= THRESHOLDS.MEDIUM_SAFETY) {
    provisional_tier = "MEDIUM";
    primary_hazard = deriveHazard({ quality_score, safety_score, safety_breakdown, thresholdMet: "medium" });
  } else {
    provisional_tier = "LOW";
    primary_hazard = deriveHazard({ quality_score, safety_score, safety_breakdown, thresholdMet: "low" });
  }

  return {
    quality_score,
    safety_score,
    provisional_tier,
    primary_hazard,
    signals,
    quality_breakdown,
    safety_breakdown,
    scorer_version: SCORER_VERSION,
  };
}

// ── Vertical table metadata ─────────────────────────────────────────
function pickTableMeta(vertical) {
  if (vertical === "food") {
    return {
      businessTable:   "nex.food_business",
      provenanceTable: "nex.food_business_field_provenance",
    };
  }
  if (vertical === "accommodation") {
    return {
      businessTable:   "nex.accommodation_business",
      provenanceTable: "nex.accommodation_business_field_provenance",
    };
  }
  return null;
}

// ── Live signal aggregation (one PG round-trip per candidate) ─────
async function liveSignalsFromDb(pool, meta, categoryId, country) {
  // observation_span_days: earliest vs latest provenance write for this category
  const spanRes = await pool.query(
    `SELECT
        EXTRACT(EPOCH FROM (MAX(p.written_at) - MIN(p.written_at))) / 86400.0 AS span_days
       FROM ${meta.provenanceTable} p
       JOIN ${meta.businessTable} b ON b.public_listing_ref = p.business_ref
      WHERE b.category = $1 AND b.country = $2 AND p.cycle_run_id IS NOT NULL`,
    [categoryId, country],
  );
  const observation_span_days = Number(spanRes.rows[0]?.span_days ?? 0);

  // Completeness + secondary evidence
  const compRes = await pool.query(
    `SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE whatsapp_number IS NOT NULL OR phone IS NOT NULL)::int AS with_contact,
        COUNT(*) FILTER (WHERE coordinates_lat IS NOT NULL AND coordinates_lng IS NOT NULL)::int AS with_coord,
        COUNT(*) FILTER (WHERE address IS NOT NULL)::int AS with_address,
        COUNT(*) FILTER (WHERE array_length(categories, 1) >= 2)::int AS with_secondary
       FROM ${meta.businessTable}
      WHERE category = $1 AND country = $2`,
    [categoryId, country],
  );
  const c = compRes.rows[0] ?? { total: 0, with_contact: 0, with_coord: 0, with_address: 0, with_secondary: 0 };
  const total = Number(c.total);
  const contact_completeness       = total > 0 ? Number(c.with_contact)   / total : 0;
  const coord_completeness         = total > 0 ? Number(c.with_coord)     / total : 0;
  const address_completeness       = total > 0 ? Number(c.with_address)   / total : 0;
  const secondary_evidence_ratio   = total > 0 ? Number(c.with_secondary) / total : 0;

  // Geographic clustering: fraction within median±0.03 bbox
  const geoRes = await pool.query(
    `WITH coords AS (
        SELECT coordinates_lat::float AS lat, coordinates_lng::float AS lng
          FROM ${meta.businessTable}
         WHERE category = $1 AND country = $2
           AND coordinates_lat IS NOT NULL AND coordinates_lng IS NOT NULL
      ),
      stats AS (
        SELECT
          percentile_cont(0.5) WITHIN GROUP (ORDER BY lat) AS med_lat,
          percentile_cont(0.5) WITHIN GROUP (ORDER BY lng) AS med_lng,
          COUNT(*)::int AS total
        FROM coords
      )
      SELECT
        s.total,
        COUNT(c.*) FILTER (
          WHERE c.lat BETWEEN s.med_lat - 0.03 AND s.med_lat + 0.03
            AND c.lng BETWEEN s.med_lng - 0.03 AND s.med_lng + 0.03
        )::int AS within_bbox
      FROM coords c, stats s
      GROUP BY s.total`,
    [categoryId, country],
  );
  const g = geoRes.rows[0];
  const geographic_clustering = g && g.total > 0
    ? Number(g.within_bbox) / Number(g.total)
    : 0;

  return {
    observation_span_days,
    contact_completeness,
    coord_completeness,
    address_completeness,
    secondary_evidence_ratio,
    geographic_clustering,
  };
}

// ── Derived signals ─────────────────────────────────────────────────

function deriveOsmTagStrength(secondaryEvidenceRatio) {
  // Task #85 · secondary tokens come from OSM amenity/shop/cuisine parsing.
  // Businesses with >=2 secondary tokens had a strong OSM signal that the
  // classifier could split into primary + secondaries. Proxy metric.
  if (secondaryEvidenceRatio >= 0.7) return "explicit-tag";
  if (secondaryEvidenceRatio >= 0.3) return "semi-explicit";
  return "fuzzy";
}

function deriveLanguageCoverage(keywords) {
  if (!Array.isArray(keywords) || keywords.length === 0) return "en-only";
  const hasEn = keywords.some((k) => /^[a-z][a-z -]*$/i.test(k) && !isBahasa(k));
  const hasId = keywords.some(isBahasa);
  if (hasEn && hasId) return "both";
  if (hasId) return "id-only";
  return "en-only";
}
function isBahasa(k) {
  // Rough heuristic · known Bahasa markers among current Registry keywords
  const bahasaMarkers = ["makanan", "restoran", "penginapan", "menginap", "wisma", "kosan", "indekos", "kos", "kost", "rumah", "warga", "makan", "apartemen"];
  const lower = String(k).toLowerCase();
  return bahasaMarkers.some((m) => lower.includes(m));
}

function anyKeywordIn(candidateKeywords, registryKeywords) {
  if (!Array.isArray(candidateKeywords)) return false;
  for (const k of candidateKeywords) {
    if (registryKeywords.has(String(k).toLowerCase())) return true;
  }
  return false;
}

function deriveHazard({ quality_score, safety_score, safety_breakdown, thresholdMet }) {
  // Order matters: pick the MOST severe blocker.
  if (safety_breakdown.keyword_collision) return "keyword-collision";
  if (safety_breakdown.route_collision) return "route-collision";
  if (safety_breakdown.duplicate_of_existing) return "duplicate";
  if (safety_breakdown.superseded) return "superseded";
  if (safety_breakdown.fuzzy_osm) return "fuzzy-osm-signal";
  if (safety_breakdown.low_geographic_clustering) return "low-geographic-clustering";
  if (safety_breakdown.language_not_bilingual) return "language-not-bilingual";
  if (safety_breakdown.no_image_evidence) return "no-image-evidence";
  if (thresholdMet === "low") return quality_score < THRESHOLDS.MEDIUM_QUALITY ? "below-quality-threshold" : "below-safety-threshold";
  if (quality_score < THRESHOLDS.HIGH_QUALITY) return "below-high-quality-threshold";
  if (safety_score < THRESHOLDS.HIGH_SAFETY) return "below-high-safety-threshold";
  return null;
}

// ── Load Registry snapshots (called once per batch by the recorder) ──
export async function loadRegistrySnapshot(pool) {
  const res = await pool.query(
    `SELECT id, route, brain_keywords, active FROM nex.category_registry`,
  );
  const registryIds     = new Set(res.rows.map((r) => r.id));
  const registryRoutes  = new Set(res.rows.map((r) => r.route));
  const registryKeywords = new Set();
  for (const r of res.rows) {
    if (!r.active) continue;  // only ACTIVE Registry keywords collide
    const kws = r.brain_keywords ?? [];
    for (const kw of kws) registryKeywords.add(String(kw).toLowerCase());
  }
  return { registryIds, registryRoutes, registryKeywords };
}

// ── Utilities ─────────────────────────────────────────────────────
function clamp01(x) { return Math.max(0, Math.min(1, x)); }
function round3(x) { return Math.round(x * 1000) / 1000; }
function round4(x) { return Math.round(x * 10000) / 10000; }
