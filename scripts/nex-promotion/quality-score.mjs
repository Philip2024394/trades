// NEX Promotion · quality-score.mjs · pure scoring function (Task #88 Phase 1)
//
// Doctrine anchors:
//   project_nex_task88_promotion_pipeline_spec_2026_08_22
//   Philip 2026-08-22 Q2: "Do NOT require a contact channel for a business to enter
//   the queue. Score determines priority/readiness, not automatic promotion."
//
// Pure function · zero DB access · zero side effects · testable in isolation.
// Consumed by scripts/nex-promotion/run-quality-check.mjs.
//
// Score range: 0-100
// Bands:
//   score >= 70  → ready_for_promotion  (🟢)
//   40 <= s < 70 → needs_enrichment      (🟡)
//   score <  40  → poor_evidence         (🔴)
//
// Every criterion is 0-or-max · no partial credit inside a criterion except
// where explicitly noted. Total is deterministic sum · admin queue UI shows
// the breakdown so the reason for the score is legible.

/** @typedef {Object} FoodBusinessInput
 *  Row from nex.food_business restricted to columns this scorer needs.
 *  All fields nullable except business_ref.
 *  @property {string}   business_ref
 *  @property {string?}  business_name
 *  @property {string?}  category
 *  @property {number?}  coordinates_lat
 *  @property {number?}  coordinates_lng
 *  @property {string?}  address
 *  @property {string?}  phone
 *  @property {string?}  whatsapp_number
 *  @property {string?}  website
 *  @property {any?}     public_social_links
 *  @property {string[]?} categories
 *  @property {string?}  last_verified_at
 */

// ── Criterion weights (sum = 100) ────────────────────────────────────
const WEIGHT_NAME       = 15;   // has a real business name (not blank, not "unnamed")
const WEIGHT_COORDS     = 20;   // has valid coordinates
const WEIGHT_CATEGORY   = 10;   // has a category (validated by DB CHECK when inserted)
const WEIGHT_ADDR_ANY   = 5;    // has any address string at all
const WEIGHT_ADDR_DETAIL= 5;    // address contains a street number (basic quality hint)
const WEIGHT_CONTACT_WA = 15;   // WhatsApp — full contact weight
const WEIGHT_CONTACT_PH = 10;   // Phone only — partial contact weight
const WEIGHT_WEBSITE    = 10;
const WEIGHT_SOCIAL     = 5;
const WEIGHT_SECONDARY  = 5;    // Task #85 secondary tokens populated
const WEIGHT_FRESHNESS  = 10;   // OSM last_verified_at within 2 years

const MAX_SCORE = WEIGHT_NAME + WEIGHT_COORDS + WEIGHT_CATEGORY
                + WEIGHT_ADDR_ANY + WEIGHT_ADDR_DETAIL
                + WEIGHT_CONTACT_WA + WEIGHT_WEBSITE + WEIGHT_SOCIAL
                + WEIGHT_SECONDARY + WEIGHT_FRESHNESS; // = 100

// ── Thresholds ──────────────────────────────────────────────────────
export const THRESHOLD_READY = 70;   // 🟢 ready_for_promotion
export const THRESHOLD_MID   = 40;   // 🟡 needs_enrichment

const FRESHNESS_WINDOW_DAYS = 730;   // ~2 years · OSM element edit recency

// ── Helpers ─────────────────────────────────────────────────────────
function isNonBlank(s) { return typeof s === "string" && s.trim().length > 0; }

function isRealName(s) {
  if (!isNonBlank(s)) return false;
  const trimmed = s.trim().toLowerCase();
  if (trimmed.length < 3) return false;
  if (trimmed === "unnamed" || trimmed === "unknown" || trimmed === "n/a") return false;
  return true;
}

function isCoordValid(lat, lng) {
  const la = typeof lat === "string" ? Number(lat) : lat;
  const lo = typeof lng === "string" ? Number(lng) : lng;
  if (!Number.isFinite(la) || !Number.isFinite(lo)) return false;
  if (la === 0 && lo === 0) return false;                    // 0,0 is null island
  if (la < -90 || la > 90 || lo < -180 || lo > 180) return false;
  return true;
}

function isAddressStreetDetail(addr) {
  if (!isNonBlank(addr)) return false;
  return /\d/.test(addr);                                    // contains any digit (housenumber hint)
}

function hasSocialLinks(v) {
  if (!v) return false;
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === "object") return Object.keys(v).length > 0;
  if (typeof v === "string") return v.trim().length > 0;
  return false;
}

function isFresh(v) {
  // pg (node-postgres) returns TIMESTAMPTZ columns as JS Date objects · not strings.
  // Accept both so this scorer is safe for direct-from-pg rows AND ISO-string test inputs.
  if (v == null) return false;
  let t;
  if (v instanceof Date)                                 t = v.getTime();
  else if (typeof v === "string" && v.trim().length > 0) t = Date.parse(v);
  else                                                   return false;
  if (!Number.isFinite(t)) return false;
  const ageDays = (Date.now() - t) / (1000 * 60 * 60 * 24);
  return ageDays >= 0 && ageDays <= FRESHNESS_WINDOW_DAYS;
}

// ── Main scorer ────────────────────────────────────────────────────
/** @param {FoodBusinessInput} row */
export function scoreBusiness(row) {
  const breakdown = {};

  breakdown.name        = isRealName(row.business_name)                                      ? WEIGHT_NAME        : 0;
  breakdown.coord       = isCoordValid(row.coordinates_lat, row.coordinates_lng)             ? WEIGHT_COORDS      : 0;
  breakdown.category    = isNonBlank(row.category)                                           ? WEIGHT_CATEGORY    : 0;
  breakdown.addr_any    = isNonBlank(row.address)                                            ? WEIGHT_ADDR_ANY    : 0;
  breakdown.addr_detail = isAddressStreetDetail(row.address)                                 ? WEIGHT_ADDR_DETAIL : 0;

  // Contact · WhatsApp > Phone (never both credited)
  if (isNonBlank(row.whatsapp_number))    breakdown.contact = WEIGHT_CONTACT_WA;
  else if (isNonBlank(row.phone))         breakdown.contact = WEIGHT_CONTACT_PH;
  else                                    breakdown.contact = 0;

  breakdown.website     = isNonBlank(row.website)                                            ? WEIGHT_WEBSITE     : 0;
  breakdown.social      = hasSocialLinks(row.public_social_links)                            ? WEIGHT_SOCIAL      : 0;
  breakdown.secondary   = Array.isArray(row.categories) && row.categories.length > 0         ? WEIGHT_SECONDARY   : 0;
  breakdown.freshness   = isFresh(row.last_verified_at)                                      ? WEIGHT_FRESHNESS   : 0;

  const total = Object.values(breakdown).reduce((s, n) => s + n, 0);
  breakdown.total = total;

  return { score: total, breakdown };
}

/** Given a numeric score, return the promotion state.
 *  Pure · used both by the worker (write path) and future admin UI (display).
 */
export function deriveState(score) {
  if (typeof score !== "number" || !Number.isFinite(score)) return "quality_pending";
  if (score >= THRESHOLD_READY) return "ready_for_promotion";
  if (score >= THRESHOLD_MID)   return "needs_enrichment";
  return "poor_evidence";
}

/** Max possible score · surfaced for progress bars / percentages. */
export const MAX_SCORE_EXPORT = MAX_SCORE;
