// scripts/nex-canonical/_rule-5m-fixture-builder.mjs
//
// Rule-5m fixture builder · reads sampled real rows from .nex-probe/
// and produces:
//   · tests/fixtures/canonical/seed-cohort-v1.jsonl
//   · tests/fixtures/canonical/eval-corpus-1.jsonl   (accommodation)
//   · tests/fixtures/canonical/eval-corpus-2.jsonl   (service)
//   · tests/fixtures/canonical/eval-corpus-3.jsonl   (mp_seller)
//
// Also produces split-by-label eval files that the existing
// eval-measurement-runner.ts expects:
//   · tests/fixtures/eval/positive-pairs-v1.jsonl
//   · tests/fixtures/eval/negative-pairs-v1.jsonl
//   · tests/fixtures/eval/ambiguous-pairs-v1.jsonl
//
// PROVENANCE HONESTY
// -------------------
// Rows were sampled read-only from nex.food_business, nex.accommodation_business,
// nex.service_business, nex.mp_seller. They are NOT founder-approved — the
// provenance.approved_by field is deliberately `"rule-5m-fixture-sampling"`.
// This means Proof 1 will FAIL on `approved_by === "founder"`, which is the
// correct honest surface: the sealed doctrine requires founder-level approval,
// and this sampling run has none. Fixing this requires founder/admin action,
// which is outside the agent-6 scope.

import fs from "node:fs";
import path from "node:path";

const PROBE_DIR = "D:/trades/.nex-probe";
const OUT_CANONICAL = "D:/trades/tests/fixtures/canonical";
const OUT_EVAL = "D:/trades/tests/fixtures/eval";
fs.mkdirSync(OUT_CANONICAL, { recursive: true });
fs.mkdirSync(OUT_EVAL, { recursive: true });

// ============================================================
// Pure helpers that MIRROR the TS `selectionNameKey` / extractOsmId /
// extractWebsiteApex in `scripts/nex-canonical/generate-candidates.ts`.
// Byte-equal to the sealed TS mirror of nex.name_norm.
// ============================================================
function selectionNameKey(name) {
  const lower = (name ?? "").toLowerCase();
  const noQuotes = lower.replace(/[‘’']/g, "");
  const spaced = noQuotes.replace(/[^a-z0-9\s]/g, " ");
  return spaced.replace(/\s+/g, " ").trim();
}
function extractOsmId(sr) {
  if (!sr) return null;
  const m = String(sr).match(/^(node|way|relation)\/\d+/);
  return m ? m[0] : null;
}
function extractWebsiteApex(url) {
  if (!url) return null;
  try {
    const u = new URL(String(url).startsWith("http") ? url : `https://${url}`);
    return u.host.replace(/^www\./, "").toLowerCase();
  } catch { return null; }
}

// E.164 best-effort normalisation. Null if the raw phone isn't already E.164-shaped.
function toE164(raw) {
  if (!raw) return null;
  const s = String(raw).replace(/[\s\-()]/g, "");
  // Already in +XXXXXXXXX form?
  if (/^\+[1-9][0-9]{6,14}$/.test(s)) return s;
  // Indonesian local-prefixed phone (0812...) → +62812...
  if (/^0[1-9][0-9]{6,14}$/.test(s)) {
    const candidate = "+62" + s.slice(1);
    if (/^\+[1-9][0-9]{6,14}$/.test(candidate)) return candidate;
  }
  return null;
}

// Deterministic approver timestamp — fixed to make fixtures byte-stable.
const APPROVED_AT = "2026-10-09T00:00:00.000Z";

// ============================================================
// Build seed cohort from food-sample-50.json
// ============================================================
function buildSeedCohort() {
  const raw = JSON.parse(fs.readFileSync(path.join(PROBE_DIR, "food-sample-50.json"), "utf8"));
  const seeds = raw.map((r, i) => {
    const nameNorm = selectionNameKey(r.business_name ?? "");
    const osmId = r.source === "osm_overpass" ? extractOsmId(r.source_reference) : null;
    const websiteApex = extractWebsiteApex(r.website);
    const phoneE164 = toE164(r.phone);
    const lat = r.lat;
    const lng = r.lng;
    const coordinates = (lat !== null && lng !== null && Number.isFinite(lat) && Number.isFinite(lng))
      ? { lat, lng } : null;

    // Deterministic seed_id derived from the real internal_id.
    const seedId = r.internal_id; // Already a UUID in the DB.

    return {
      seed_id: seedId,
      entity_type: "food",
      country: r.country ?? "ID",
      identity: {
        name_canonical: r.business_name ?? "",
        name_norm: nameNorm,
        aliases: [],
        phone_e164: phoneE164,
        website_apex: websiteApex,
        osm_id: osmId,
        wikidata_qid: null,
        city: r.city ?? null,
        district: r.district ?? null,
        coordinates,
      },
      provenance: {
        approved_by: "rule-5m-fixture-sampling",
        approved_at: APPROVED_AT,
        created_by: "rule-5m-fixture-sampling",
        created_at: APPROVED_AT,
        legacy_source_table: "nex.food_business",
        legacy_source_ref: r.public_listing_ref ?? r.internal_id,
        risk_categories: inferRiskCategories(r),
        high_confidence_rationale:
          "Sampled read-only from nex.food_business for Rule-5m fixture authoring. Not founder-approved — Proof 1 WILL correctly fail on approved_by until a founder review pass elevates these.",
        notes: `source=${r.source ?? "unknown"} source_reference=${r.source_reference ?? ""} claim_status=${r.claim_status ?? ""} owner_status=${r.owner_status ?? ""}`,
      },
    };
  });
  return seeds;
}

// Rule-5i inference of risk categories per row — simple heuristic that
// ensures R1–R10 coverage is at least partially exercised.
function inferRiskCategories(r) {
  const cats = [];
  // R1 · proven live
  if (r.claim_status && ["claimed", "owner_verified", "verified"].includes(r.claim_status)) cats.push("R1");
  // R2 · OSM / wikidata linked
  if (r.source === "osm_overpass" && r.source_reference) cats.push("R2");
  // R3 · duplicate-source representations · we can't verify without joining; omit by default
  // R6 · thin evidence (no phone, no website)
  if (!r.phone && !r.website) cats.push("R6");
  // R8 · website-presence axis
  if (r.website) cats.push("R8");
  // R10 · geographic collision — flagged for rows with city but no district
  if (r.city && !r.district) cats.push("R10");
  // Everything else gets R2 by default (OSM-linked food dominates the sample).
  if (cats.length === 0) cats.push("R2");
  return cats;
}

// ============================================================
// Build per-vertical eval corpus files · each one holds MATCH /
// NO_MATCH / AMBIGUOUS pairs for its vertical, synthesised against
// the seed cohort.
// ============================================================
function buildEvalCorpus(samplePath, verticalTag, entityTypeHint) {
  const raw = JSON.parse(fs.readFileSync(samplePath, "utf8"));
  const pairs = [];
  const runId = `rule-5m-fixture-${verticalTag}`;

  // Positive pairs: identical identity on both sides (self-pairs). These
  // should resolve MATCH when the seed cohort contains the same identity.
  // Food-seeded cohort cannot MATCH an accommodation row (different
  // entity_type) — so the per-vertical pairs are LABELED against the
  // vertical's own identity. The measurement runner will build the pool
  // from the seed cohort (food) · pairs with a food-vertical identity
  // target the food cohort; non-food pairs are labelled NO_MATCH because
  // there is no same-vertical seed in the pool.

  for (let i = 0; i < raw.length; i++) {
    const r = raw[i];
    const nameNorm = selectionNameKey(r.business_name ?? r.display_name ?? "");
    const osmId = extractOsmId(r.source_reference);
    const websiteApex = extractWebsiteApex(r.website);
    const phoneE164 = toE164(r.phone);
    const lat = r.lat;
    const lng = r.lng;
    const coordinates = (lat !== null && lng !== null && Number.isFinite(lat) && Number.isFinite(lng))
      ? { lat, lng } : null;

    const candidate = {
      candidate_id: `cand-${verticalTag}-${String(i).padStart(4, "0")}`,
      status: "pending_founder_review",
      entity_type: entityTypeHint,
      country: r.country ?? "ID",
      identity: {
        name_canonical: r.business_name ?? r.display_name ?? "",
        aliases: [],
        phone_e164: phoneE164,
        website_apex: websiteApex,
        osm_id: osmId,
        wikidata_qid: null,
        city: r.city ?? null,
        district: r.district ?? null,
        coordinates,
      },
      legacy_source: {
        table: `nex.${verticalTag === "mp_seller" ? "mp_seller" : verticalTag + "_business"}`,
        ref: r.public_listing_ref ?? r.seller_id ?? r.internal_id ?? null,
        internal_id: r.internal_id ?? r.seller_id ?? null,
      },
      risk_categories: ["R6"],
      selection_score: 0.5,
      selection_rationale: [{ risk_category: "R6", contribution: 0.5, note: "fixture synthesis" }],
      generation_source: {
        generator: "scripts/nex-canonical/_rule-5m-fixture-builder.mjs",
        generated_at: APPROVED_AT,
        generation_run_id: runId,
      },
      caveats: [],
    };

    // Expected verdict logic:
    //
    //   The resolver's seed cohort pool contains food seeds. If this
    //   vertical's candidate is non-food, the resolver should NO_MATCH
    //   (entity_type_mismatch_cap caps score at 0.3 < AMBIGUOUS_THRESHOLD).
    //
    //   HOWEVER the resolver ABSTAINS when the candidate carries no osm_id,
    //   wikidata_qid, phone_e164, website_apex, OR coordinates. For such
    //   rows the test must mark expected as MISSING_EXPECTED_OUTPUT so a
    //   false pass is impossible.
    const hasSignal =
      candidate.identity.osm_id !== null ||
      candidate.identity.wikidata_qid !== null ||
      candidate.identity.phone_e164 !== null ||
      candidate.identity.website_apex !== null ||
      candidate.identity.coordinates !== null;

    let expected_verdict;
    let expected_target = null;

    if (!hasSignal) {
      // Resolver abstains (insufficient_signal) — not scored by the
      // precision/recall/false-merge gates in the measurement runner.
      // Keep the pair but mark it ABSTAIN-OK so it isn't a false-pass.
      // The measurement runner treats abstention as neutral.
      expected_verdict = "MISSING_EXPECTED_OUTPUT";
    } else if (entityTypeHint !== "food") {
      // Pool is food-only → cross-type cap → NO_MATCH.
      expected_verdict = "NO_MATCH";
    } else {
      // Food vertical would MATCH the identical seed by osm_id · but we
      // don't source food here (that's the seed cohort). For a food
      // eval corpus we'd need distinct sampling. Keep NO_MATCH as a
      // conservative label when candidate's osm_id doesn't appear in
      // the seed cohort — which is TRUE in a different-row sample.
      expected_verdict = "NO_MATCH";
    }

    pairs.push({
      pair_id: `pair-${verticalTag}-${String(i).padStart(4, "0")}`,
      seed_id: null,
      candidate_payload: candidate,
      expected_target_canonical_business_id: expected_target,
      label_decision: {
        expected_verdict,
        labelled_by: "rule-5m-fixture-sampling",
        labelled_at: APPROVED_AT,
        label_version: 1,
      },
      candidate_source: {
        generator: "scripts/nex-canonical/_rule-5m-fixture-builder.mjs",
        generation_run_id: runId,
      },
      vertical: verticalTag,
      sampled_from_table: `nex.${verticalTag === "mp_seller" ? "mp_seller" : verticalTag + "_business"}`,
    });
  }
  return pairs;
}

// ============================================================
// Also build positive + negative + ambiguous files for the sealed
// eval-measurement-runner contract. We build FOOD-vertical pairs
// because the pool is the food seed cohort.
//
// Positives are harder: we need pairs whose candidate identity SHOULD
// match a seed. We synthesise positives by taking seed identities,
// pushing them through the Candidate shape (so osm_id/coords/city
// agree) and labelling MATCH with target_canonical_business_id = seed_id.
// ============================================================
function buildPositivePairs(seeds) {
  const pairs = [];
  seeds.forEach((seed, i) => {
    const id = seed.identity;
    // Only emit a positive when the seed carries enough signal for the
    // resolver to not abstain.
    const hasSignal =
      id.osm_id !== null || id.wikidata_qid !== null ||
      id.phone_e164 !== null || id.website_apex !== null ||
      id.coordinates !== null;
    if (!hasSignal) return;

    const candidate = {
      candidate_id: `pos-cand-${String(i).padStart(4, "0")}`,
      status: "pending_founder_review",
      entity_type: seed.entity_type,
      country: seed.country,
      identity: {
        name_canonical: id.name_canonical,
        aliases: id.aliases ?? [],
        phone_e164: id.phone_e164,
        website_apex: id.website_apex,
        osm_id: id.osm_id,
        wikidata_qid: id.wikidata_qid,
        city: id.city,
        district: id.district,
        coordinates: id.coordinates,
      },
      legacy_source: {
        table: seed.provenance.legacy_source_table,
        ref: seed.provenance.legacy_source_ref,
        internal_id: null,
      },
      risk_categories: seed.provenance.risk_categories,
      selection_score: 0.9,
      selection_rationale: [{ risk_category: seed.provenance.risk_categories[0] ?? "R1", contribution: 0.9, note: "fixture positive synthesis" }],
      generation_source: {
        generator: "scripts/nex-canonical/_rule-5m-fixture-builder.mjs",
        generated_at: APPROVED_AT,
        generation_run_id: "rule-5m-fixture-positive",
      },
      caveats: [],
    };
    pairs.push({
      pair_id: `pos-${String(i).padStart(4, "0")}`,
      seed_id: seed.seed_id,
      candidate_payload: candidate,
      expected_target_canonical_business_id: seed.seed_id,
      label_decision: {
        expected_verdict: "MATCH",
        labelled_by: "rule-5m-fixture-sampling",
        labelled_at: APPROVED_AT,
        label_version: 1,
      },
      candidate_source: {
        generator: "scripts/nex-canonical/_rule-5m-fixture-builder.mjs",
        generation_run_id: "rule-5m-fixture-positive",
      },
    });
  });
  return pairs;
}

// Negatives: non-food candidates (service/accommodation/mp_seller) against a food pool.
// Pool is food-only → entity_type_mismatch_cap → NO_MATCH expected.
function buildNegativePairs() {
  const pairs = [];
  const sources = [
    { tag: "accommodation", file: "accommodation_business-sample.json", type: "accommodation" },
    { tag: "service", file: "service_business-sample.json", type: "service" },
    { tag: "mp_seller", file: "mp_seller-sample.json", type: "marketplace_seller" },
  ];
  for (const src of sources) {
    const raw = JSON.parse(fs.readFileSync(path.join(PROBE_DIR, src.file), "utf8"));
    raw.forEach((r, i) => {
      const osmId = extractOsmId(r.source_reference);
      const websiteApex = extractWebsiteApex(r.website);
      const phoneE164 = toE164(r.phone);
      const lat = r.lat;
      const lng = r.lng;
      const coordinates = (lat !== null && lng !== null && Number.isFinite(lat) && Number.isFinite(lng))
        ? { lat, lng } : null;
      const hasSignal = osmId !== null || websiteApex !== null || phoneE164 !== null || coordinates !== null;
      if (!hasSignal) return; // skip insufficient-signal rows — resolver would abstain.

      const candidate = {
        candidate_id: `neg-${src.tag}-${String(i).padStart(4, "0")}`,
        status: "pending_founder_review",
        entity_type: src.type,
        country: r.country ?? "ID",
        identity: {
          name_canonical: r.business_name ?? r.display_name ?? `fixture-${i}`,
          aliases: [],
          phone_e164: phoneE164,
          website_apex: websiteApex,
          osm_id: osmId,
          wikidata_qid: null,
          city: r.city ?? null,
          district: r.district ?? null,
          coordinates,
        },
        legacy_source: {
          table: `nex.${src.tag === "mp_seller" ? "mp_seller" : src.tag + "_business"}`,
          ref: r.public_listing_ref ?? r.seller_id ?? null,
          internal_id: r.internal_id ?? r.seller_id ?? null,
        },
        risk_categories: ["R5"],
        selection_score: 0.5,
        selection_rationale: [{ risk_category: "R5", contribution: 0.5, note: "cross-vertical negative" }],
        generation_source: {
          generator: "scripts/nex-canonical/_rule-5m-fixture-builder.mjs",
          generated_at: APPROVED_AT,
          generation_run_id: "rule-5m-fixture-negative",
        },
        caveats: [],
      };
      pairs.push({
        pair_id: `neg-${src.tag}-${String(i).padStart(4, "0")}`,
        seed_id: null,
        candidate_payload: candidate,
        expected_target_canonical_business_id: null,
        label_decision: {
          expected_verdict: "NO_MATCH",
          labelled_by: "rule-5m-fixture-sampling",
          labelled_at: APPROVED_AT,
          label_version: 1,
        },
        candidate_source: {
          generator: "scripts/nex-canonical/_rule-5m-fixture-builder.mjs",
          generation_run_id: "rule-5m-fixture-negative",
        },
      });
    });
  }
  return pairs;
}

// Ambiguous: synthesised near-duplicates. Taken from the food seeds —
// we take seeds with an osm_id and swap it to a different osm_id to
// construct an "osm contradiction" case, OR we take name+city only to
// land in the AMBIGUOUS band.
function buildAmbiguousPairs(seeds) {
  const pairs = [];
  seeds.forEach((seed, i) => {
    const id = seed.identity;
    // Case: name+city only, drop all other signals. The resolver's
    // insufficient-signal gate ABSTAINS without strong/medium signal
    // → but coordinates DO provide signal. We keep coordinates alone
    // (no osm_id, phone, website) + same city as seed. This should
    // trigger the AMBIGUOUS band for a food candidate if coords near
    // the seed. Otherwise NO_MATCH is expected.
    if (id.coordinates === null) return;

    const candidate = {
      candidate_id: `amb-${String(i).padStart(4, "0")}`,
      status: "pending_founder_review",
      entity_type: "food",
      country: seed.country,
      identity: {
        name_canonical: id.name_canonical,
        aliases: [],
        phone_e164: null,
        website_apex: null,
        osm_id: null,            // drop osm — forces reliance on name + coords
        wikidata_qid: null,
        city: id.city,
        district: null,
        coordinates: id.coordinates,
      },
      legacy_source: {
        table: "nex.food_business",
        ref: `${seed.provenance.legacy_source_ref}-amb`,
        internal_id: null,
      },
      risk_categories: ["R6", "R10"],
      selection_score: 0.5,
      selection_rationale: [{ risk_category: "R6", contribution: 0.5, note: "thin-evidence ambiguous synthesis" }],
      generation_source: {
        generator: "scripts/nex-canonical/_rule-5m-fixture-builder.mjs",
        generated_at: APPROVED_AT,
        generation_run_id: "rule-5m-fixture-ambiguous",
      },
      caveats: [],
    };
    pairs.push({
      pair_id: `amb-${String(i).padStart(4, "0")}`,
      seed_id: seed.seed_id,
      candidate_payload: candidate,
      expected_target_canonical_business_id: null,
      label_decision: {
        expected_verdict: "AMBIGUOUS",
        labelled_by: "rule-5m-fixture-sampling",
        labelled_at: APPROVED_AT,
        label_version: 1,
      },
      candidate_source: {
        generator: "scripts/nex-canonical/_rule-5m-fixture-builder.mjs",
        generation_run_id: "rule-5m-fixture-ambiguous",
      },
    });
  });
  return pairs;
}

function writeJsonl(abs, records) {
  const body = records.map((r) => JSON.stringify(r)).join("\n") + (records.length > 0 ? "\n" : "");
  fs.writeFileSync(abs, body);
  console.log(`wrote ${abs} · ${records.length} records`);
}

// ============================================================
// Main
// ============================================================
const seeds = buildSeedCohort();
writeJsonl(path.join(OUT_CANONICAL, "seed-cohort-v1.jsonl"), seeds);

// Per-vertical corpora as declared by the task.
const corpus1 = buildEvalCorpus(path.join(PROBE_DIR, "accommodation_business-sample.json"), "accommodation", "accommodation");
writeJsonl(path.join(OUT_CANONICAL, "eval-corpus-1.jsonl"), corpus1);

const corpus2 = buildEvalCorpus(path.join(PROBE_DIR, "service_business-sample.json"), "service", "service");
writeJsonl(path.join(OUT_CANONICAL, "eval-corpus-2.jsonl"), corpus2);

const corpus3 = buildEvalCorpus(path.join(PROBE_DIR, "mp_seller-sample.json"), "mp_seller", "marketplace_seller");
writeJsonl(path.join(OUT_CANONICAL, "eval-corpus-3.jsonl"), corpus3);

// Split-by-label files for the sealed eval-measurement-runner contract.
const positives = buildPositivePairs(seeds);
writeJsonl(path.join(OUT_EVAL, "positive-pairs-v1.jsonl"), positives);
const negatives = buildNegativePairs();
writeJsonl(path.join(OUT_EVAL, "negative-pairs-v1.jsonl"), negatives);
const ambiguous = buildAmbiguousPairs(seeds);
writeJsonl(path.join(OUT_EVAL, "ambiguous-pairs-v1.jsonl"), ambiguous);

console.log("fixtures authored.");
