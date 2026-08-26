#!/usr/bin/env node
// scripts/nex-promotion/_analyse-proposed-scorer.mjs
//
// DRY-RUN of the PROPOSED v0.1 100-point scorer against all 1320 real
// discovered rows. No DB writes. Design tool only.
//
// Design contract: docs/nex/business-listing-scorer-contract-90pct.md
// Doctrine anchor: project_nex_90pct_business_listing_doctrine_2026_08_23
//
// Reports:
//   · Score distribution per vertical (bands ≥90 / 75-89 / 60-74 / 40-59 / <40)
//   · Per-tier average earn (Tier A · B · C · D)
//   · SAFETY signal frequency
//   · Top 5 reasons rows fall short of 90 (per vertical)
//   · What data enrichment would unlock the most rows

import pg from "pg";

const pool = new pg.Pool({ connectionString: process.env.NEX_POSTGRES_URL, max: 2 });

// ── Yogyakarta rough polygon bounding-box (loose but sanity-checking).
// Real polygon check deferred · this catches (0,0) and out-of-country coords.
const YOG_BBOX = { minLat: -8.05, maxLat: -7.55, minLng: 110.15, maxLng: 110.60 };

// ── Helpers · same shape as current scorer where duplicated ───────────
function isNonBlank(s) { return typeof s === "string" && s.trim().length > 0; }
function isRealName(s) {
  if (!isNonBlank(s)) return false;
  const t = s.trim().toLowerCase();
  if (t.length < 3) return false;
  if (["unnamed", "unknown", "n/a", "test", "tbd", "xxx", "example"].includes(t)) return false;
  return true;
}
function coordsValid(lat, lng) {
  const la = Number(lat), lo = Number(lng);
  if (!Number.isFinite(la) || !Number.isFinite(lo)) return false;
  if (la === 0 && lo === 0) return false;
  return la >= -90 && la <= 90 && lo >= -180 && lo <= 180;
}
function coordsInCityBbox(lat, lng) {
  const la = Number(lat), lo = Number(lng);
  return la >= YOG_BBOX.minLat && la <= YOG_BBOX.maxLat && lo >= YOG_BBOX.minLng && lo <= YOG_BBOX.maxLng;
}
function coordPrecision(v) {
  // Return count of decimal places · used for precision credit
  if (v == null) return 0;
  const s = String(v);
  const dot = s.indexOf(".");
  return dot < 0 ? 0 : (s.length - dot - 1);
}
function addressHasStreetNumber(a) { return isNonBlank(a) && /\d/.test(a); }
function daysBetween(a, b) { return (b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24); }
function freshnessAgeDays(v) {
  if (v == null) return null;
  const t = v instanceof Date ? v : new Date(v);
  if (isNaN(t.getTime())) return null;
  return daysBetween(t, new Date());
}
function hasSocial(v) {
  if (!v) return false;
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === "object") return Object.keys(v).length > 0;
  return isNonBlank(v);
}
function nameWordCount(s) { return isNonBlank(s) ? s.trim().split(/\s+/).length : 0; }

// ── Placeholder detection · SAFETY signals ─────────────────────────────
const PLACEHOLDER_NAMES = /^(test|tbd|xxx|example|lorem|todo|dummy|placeholder|business ?name)\b/i;
function isPlaceholderName(s) { return typeof s === "string" && PLACEHOLDER_NAMES.test(s.trim()); }
function isPlaceholderPhone(s) {
  if (!isNonBlank(s)) return false;
  const digits = s.replace(/\D+/g, "");
  if (digits.length < 6) return false;
  if (/^(\d)\1+$/.test(digits)) return true;          // all same digit
  if (/^(01234|12345|11111|00000|99999)/.test(digits)) return true;
  return false;
}
function isPlaceholderWebsite(s) {
  if (!isNonBlank(s)) return false;
  const l = s.trim().toLowerCase();
  return /example\.com|localhost|127\.0\.0\.1|test\.com/.test(l);
}

// ── Scorer v0.1 · vertical-agnostic base + per-vertical tier D ─────────
function scoreListingV2(row, vertical) {
  const failReasons = [];
  const tiers = { A: {}, B: {}, C: {}, D: {} };
  const mandatoryFail = [];

  // Mandatory floors
  if (!isRealName(row.business_name))                             mandatoryFail.push("MAND_NAME");
  if (!coordsValid(row.coordinates_lat, row.coordinates_lng))     mandatoryFail.push("MAND_COORD");
  if (!isNonBlank(row.category))                                  mandatoryFail.push("MAND_CATEGORY");

  // Tier A · Core identity (40)
  const identityStrength = (isRealName(row.business_name) ? 5 : 0)
                         + ((row.business_name && row.business_name.length >= 8 && nameWordCount(row.business_name) >= 2) ? 5 : 0);
  const inBbox = coordsValid(row.coordinates_lat, row.coordinates_lng) && coordsInCityBbox(row.coordinates_lat, row.coordinates_lng);
  const precisionOK = coordPrecision(row.coordinates_lat) >= 5 && coordPrecision(row.coordinates_lng) >= 5;
  const locationPrecision = (coordsValid(row.coordinates_lat, row.coordinates_lng) ? 5 : 0)
                          + (inBbox ? 5 : 0)
                          + (precisionOK ? 5 : 0);
  const addressQuality = (isNonBlank(row.address) ? 3 : 0)
                       + (addressHasStreetNumber(row.address) ? 3 : 0)
                       + (isNonBlank(row.district) ? 2 : 0)
                       + (isNonBlank(row.city) ? 2 : 0);
  // Category confidence: we don't currently persist per-row category-source metadata,
  // so proxy as follows:
  //   5 if categories[] non-empty (classifier confident enough to write secondary tokens)
  //   3 otherwise but non-blank category (base classifier fired)
  //   0 if blank (mandatory floor already caught this)
  const categoryConfidence = (Array.isArray(row.categories) && row.categories.length > 0) ? 5
                           : (isNonBlank(row.category) ? 3 : 0);
  tiers.A = { identityStrength, locationPrecision, addressQuality, categoryConfidence };
  const A_total = identityStrength + locationPrecision + addressQuality + categoryConfidence;

  // Tier B · Contactability with compensation (20 cap)
  const channels = {
    whatsapp: isNonBlank(row.whatsapp_number) ? 12 : 0,
    phone:    isNonBlank(row.phone) ? 8 : 0,
    website:  isNonBlank(row.website) ? 8 : 0,
    social:   hasSocial(row.public_social_links) ? 5 : 0,
  };
  const rawContact = channels.whatsapp + channels.phone + channels.website + channels.social;
  tiers.B = { ...channels, capped_at: Math.min(20, rawContact) };
  const B_total = Math.min(20, rawContact);

  // Tier C · Freshness + Provenance (20)
  const ageDays = freshnessAgeDays(row.last_verified_at);
  const freshness = ageDays == null ? 0
                  : ageDays <= 365 ? 10
                  : ageDays <= 730 ? 6
                  : ageDays <= 1095 ? 3
                  : 0;
  // Provenance depth + source agreement · we don't have multi-source data yet,
  // so both score 0 today. Structural placeholder · the analysis surfaces
  // exactly HOW MUCH score is left on the table due to single-source data.
  const provenanceDepth = row.provenance_source_count >= 3 ? 5
                        : row.provenance_source_count >= 2 ? 3 : 0;
  const sourceAgreement = row.source_agreement_count >= 2 ? 5
                        : row.source_agreement_count >= 1 ? 3 : 0;
  tiers.C = { freshness, provenanceDepth, sourceAgreement };
  const C_total = freshness + provenanceDepth + sourceAgreement;

  // Tier D · Vertical evidence (20)
  let D_total = 0;
  if (vertical === "accommodation") {
    const starRatingWithSource = (row.star_rating != null && isNonBlank(row.star_rating_source)) ? 6 : 0;
    const roomCount = (row.room_count != null && row.room_count > 0) ? 3 : 0;
    const amenityCount = Array.isArray(row.amenities) ? row.amenities.length : 0;
    const amenities = amenityCount === 0 ? 0 : amenityCount <= 2 ? 2 : amenityCount <= 5 ? 4 : 6;
    const thirdPartyRating = (row.rating != null && row.review_count != null && row.review_count >= 3) ? 5 : 0;
    tiers.D = { starRatingWithSource, roomCount, amenities, thirdPartyRating };
    D_total = starRatingWithSource + roomCount + amenities + thirdPartyRating;
  } else if (vertical === "food") {
    const openingInfo = (row.opening_information && Object.keys(row.opening_information).length > 0) ? 8 : 0;
    const secondaryTokens = !Array.isArray(row.categories) || row.categories.length === 0 ? 0
                          : row.categories.length >= 2 ? 8 : 4;
    const thirdPartyRating = (row.rating != null && row.review_count != null && row.review_count >= 3) ? 4 : 0;
    tiers.D = { openingInfo, secondaryTokens, thirdPartyRating };
    D_total = openingInfo + secondaryTokens + thirdPartyRating;
  }

  // Total & mandatory-floor cap
  let quality = A_total + B_total + C_total + D_total;
  if (mandatoryFail.length > 0) quality = Math.min(40, quality);

  // SAFETY axis
  const safety = { verdict: "PASS", signals: [] };
  if (isPlaceholderName(row.business_name))           { safety.verdict = "FAIL"; safety.signals.push("SAFETY_NAME_PLACEHOLDER"); }
  if (isPlaceholderPhone(row.phone))                  { safety.verdict = "FAIL"; safety.signals.push("SAFETY_PHONE_PLACEHOLDER"); }
  if (isPlaceholderWebsite(row.website))              { safety.verdict = "FAIL"; safety.signals.push("SAFETY_WEBSITE_PLACEHOLDER"); }
  if (!coordsValid(row.coordinates_lat, row.coordinates_lng)) { safety.verdict = "FAIL"; safety.signals.push("SAFETY_COORD_INVALID"); }
  if (coordsValid(row.coordinates_lat, row.coordinates_lng) && !coordsInCityBbox(row.coordinates_lat, row.coordinates_lng)) {
    safety.verdict = "FAIL"; safety.signals.push("SAFETY_COORD_OUT_OF_CITY");
  }
  // SAFETY REVIEW signals (soft) — only downgrade PASS to REVIEW
  const softSignals = [];
  const provCount = row.provenance_source_count ?? 1;
  if (provCount < 2 && quality >= 90) softSignals.push("SAFETY_THIN_PROVENANCE_AT_HIGH_QUALITY");
  if (ageDays != null && ageDays > 1095) softSignals.push("SAFETY_STALE_ONLY");
  if (safety.verdict === "PASS" && softSignals.length > 0) {
    safety.verdict = "REVIEW";
    safety.signals.push(...softSignals);
  }

  return {
    quality,
    safety,
    tiers: { A: A_total, B: B_total, C: C_total, D: D_total },
    tierBreakdowns: tiers,
    mandatoryFail,
  };
}

// ── Data loaders (include potential enrichment fields even if 0 today) ─
async function loadFood() {
  const q = await pool.query(`
    SELECT public_listing_ref, business_name, category, categories,
           coordinates_lat, coordinates_lng, address, district, city,
           phone, whatsapp_number, website, public_social_links,
           opening_information, rating, review_count,
           last_verified_at, source,
           1 AS provenance_source_count, 1 AS source_agreement_count
      FROM nex.food_business
     WHERE city='Yogyakarta' AND claim_status='discovered'
  `);
  return q.rows;
}
async function loadAccom() {
  const q = await pool.query(`
    SELECT public_listing_ref, business_name, category, categories,
           coordinates_lat, coordinates_lng, address, district, city,
           phone, whatsapp_number, website, public_social_links,
           star_rating, star_rating_source, room_count, amenities,
           rating, review_count,
           last_verified_at, source,
           1 AS provenance_source_count, 1 AS source_agreement_count
      FROM nex.accommodation_business
     WHERE city='Yogyakarta' AND claim_status='discovered'
  `);
  return q.rows;
}

// ── Report generator ──────────────────────────────────────────────────
function analyse(rows, vertical) {
  const bands = { "ge_90_PASS": 0, "ge_90_notPASS": 0, "75_89": 0, "60_74": 0, "40_59": 0, "lt_40": 0 };
  const safetyCounts = { PASS: 0, REVIEW: 0, FAIL: 0 };
  const signalCounts = {};
  const tierAverages = { A: 0, B: 0, C: 0, D: 0 };
  // Track top gap-to-90 contributors — for each row scoring < 90, count which tier had the biggest headroom
  const nearMiss70to89 = { A: 0, B: 0, C: 0, D: 0 };

  const perRow = [];
  for (const row of rows) {
    const r = scoreListingV2(row, vertical);
    tierAverages.A += r.tiers.A;
    tierAverages.B += r.tiers.B;
    tierAverages.C += r.tiers.C;
    tierAverages.D += r.tiers.D;
    if (r.quality >= 90) {
      if (r.safety.verdict === "PASS") bands.ge_90_PASS++;
      else bands.ge_90_notPASS++;
    } else if (r.quality >= 75) bands["75_89"]++;
    else if (r.quality >= 60) bands["60_74"]++;
    else if (r.quality >= 40) bands["40_59"]++;
    else bands.lt_40++;
    safetyCounts[r.safety.verdict]++;
    for (const s of r.safety.signals) signalCounts[s] = (signalCounts[s] ?? 0) + 1;
    if (r.quality >= 60 && r.quality < 90) {
      // What was the biggest headroom that would have pushed to 90?
      const gaps = { A: 40 - r.tiers.A, B: 20 - r.tiers.B, C: 20 - r.tiers.C, D: 20 - r.tiers.D };
      const biggest = Object.entries(gaps).sort((a, b) => b[1] - a[1])[0][0];
      nearMiss70to89[biggest]++;
    }
    perRow.push(r);
  }
  const n = rows.length;
  for (const k of Object.keys(tierAverages)) tierAverages[k] = Number((tierAverages[k] / n).toFixed(2));

  return { vertical, n, bands, safetyCounts, signalCounts, tierAverages, nearMiss70to89, perRow };
}

function fmtObj(o) { return Object.entries(o).map(([k, v]) => `${k}=${v}`).join("  "); }

async function main() {
  console.log("╔════════════════════════════════════════════════════════════════════════════╗");
  console.log("║  PROPOSED SCORER v0.1 · DRY-RUN AGAINST REAL DATA · no writes              ║");
  console.log("║  Design contract: docs/nex/business-listing-scorer-contract-90pct.md       ║");
  console.log("╚════════════════════════════════════════════════════════════════════════════╝");
  console.log("");

  const food  = await loadFood();
  const accom = await loadAccom();

  const foodResult  = analyse(food,  "food");
  const accomResult = analyse(accom, "accommodation");

  for (const r of [foodResult, accomResult]) {
    console.log("════════════════════════════════════════════════════════════════════════════");
    console.log(`VERTICAL: ${r.vertical}   ·   rows: ${r.n}`);
    console.log("─────────────────────────────────────────────────────────────────────────");
    console.log(`  quality bands · with SAFETY split:`);
    console.log(`    ≥90 + SAFETY=PASS  (AUTO-LIST)     : ${r.bands.ge_90_PASS}`);
    console.log(`    ≥90 + SAFETY≠PASS  (blocked)       : ${r.bands.ge_90_notPASS}`);
    console.log(`    75-89              (HQ · fast)     : ${r.bands["75_89"]}`);
    console.log(`    60-74              (HQ · enrich)   : ${r.bands["60_74"]}`);
    console.log(`    40-59              (invisible)     : ${r.bands["40_59"]}`);
    console.log(`    <40                (mandatory fail): ${r.bands.lt_40}`);
    console.log("");
    console.log(`  SAFETY verdict counts:  ${fmtObj(r.safetyCounts)}`);
    console.log(`  SAFETY signal frequency:`);
    for (const [k, v] of Object.entries(r.signalCounts).sort((a, b) => b[1] - a[1])) {
      console.log(`    ${k.padEnd(45)} ${v}`);
    }
    console.log("");
    console.log(`  Tier averages (max A=40 · B=20 · C=20 · D=20):`);
    console.log(`    A · core identity      : ${r.tierAverages.A} / 40`);
    console.log(`    B · contactability     : ${r.tierAverages.B} / 20`);
    console.log(`    C · freshness+provenance: ${r.tierAverages.C} / 20`);
    console.log(`    D · vertical evidence  : ${r.tierAverages.D} / 20`);
    console.log("");
    console.log(`  Near-miss (60-89 rows · biggest tier headroom to reach 90):`);
    for (const [k, v] of Object.entries(r.nearMiss70to89).sort((a, b) => b[1] - a[1])) {
      console.log(`    Tier ${k}: ${v} rows blocked here`);
    }
    console.log("");
  }

  // Enrichment-what-if · what if every row had TWO sources agreeing (Tier C +8 pts)?
  console.log("════════════════════════════════════════════════════════════════════════════");
  console.log("ENRICHMENT WHAT-IF · if every row had 2-source agreement AND fresh verification:");
  console.log("─────────────────────────────────────────────────────────────────────────");
  for (const [vertical, rows] of [["food", food], ["accommodation", accom]]) {
    let wouldHit90 = 0;
    for (const row of rows) {
      const r = scoreListingV2(row, vertical);
      // Assume: Tier C freshness → 10 (as if just re-verified) + provenance → 5 + agreement → 5 = +20 total
      // Real freshness might already contribute · so cap Tier C at 20.
      const boostedC = 20;
      const boostedQuality = r.tiers.A + r.tiers.B + boostedC + r.tiers.D;
      const finalQ = r.mandatoryFail.length > 0 ? Math.min(40, boostedQuality) : boostedQuality;
      if (finalQ >= 90 && r.safety.verdict === "PASS") wouldHit90++;
    }
    console.log(`  ${vertical.padEnd(15)}: ${wouldHit90} / ${rows.length} would AUTO-LIST if Tier C were saturated`);
  }
  console.log("");

  // Enrichment-what-if · what if every row had contact info (Tier B → 20)?
  console.log("ENRICHMENT WHAT-IF · if every row had 2+ contact channels:");
  console.log("─────────────────────────────────────────────────────────────────────────");
  for (const [vertical, rows] of [["food", food], ["accommodation", accom]]) {
    let wouldHit90 = 0;
    for (const row of rows) {
      const r = scoreListingV2(row, vertical);
      const boostedB = 20;
      const boostedQuality = r.tiers.A + boostedB + r.tiers.C + r.tiers.D;
      const finalQ = r.mandatoryFail.length > 0 ? Math.min(40, boostedQuality) : boostedQuality;
      if (finalQ >= 90 && r.safety.verdict === "PASS") wouldHit90++;
    }
    console.log(`  ${vertical.padEnd(15)}: ${wouldHit90} / ${rows.length} would AUTO-LIST if Tier B were saturated`);
  }
  console.log("");

  // Combined: contact + provenance
  console.log("ENRICHMENT WHAT-IF · if BOTH Tier B AND Tier C were saturated:");
  console.log("─────────────────────────────────────────────────────────────────────────");
  for (const [vertical, rows] of [["food", food], ["accommodation", accom]]) {
    let wouldHit90 = 0;
    for (const row of rows) {
      const r = scoreListingV2(row, vertical);
      const boostedQuality = r.tiers.A + 20 + 20 + r.tiers.D;
      const finalQ = r.mandatoryFail.length > 0 ? Math.min(40, boostedQuality) : boostedQuality;
      if (finalQ >= 90 && r.safety.verdict === "PASS") wouldHit90++;
    }
    console.log(`  ${vertical.padEnd(15)}: ${wouldHit90} / ${rows.length} would AUTO-LIST if Tier B + C saturated`);
  }
  console.log("");

  await pool.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
