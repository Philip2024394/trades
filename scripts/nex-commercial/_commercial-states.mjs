// scripts/nex-commercial/_commercial-states.mjs
//
// NEX Commercial Substrate · shared vocabulary · Philip 2026-08-27.
//
// The 10-state funnel is split across TWO owners:
//
//   QUALIFICATION_STATES (this engine owns) — deterministic promotion based
//     on public-source data quality (name/website/phone/whatsapp/hero image):
//       discovered → qualified → contactable → marketing_ready
//
//   MARKETING_STATES (future Marketing Workforce owns · NEVER touched here):
//       attempted → engaged → invited → trial → paid → declined
//
// This split protects the qualification engine from ever overwriting a state
// the marketing workforce has advanced. Once a row leaves marketing_ready
// (i.e. commercial_status ∉ QUALIFICATION_STATES), qualification skips it.
//
// Cadence doctrine · Philip 2026-08-27: this file NEVER encodes contact
// cadence. "24-hour marketing" means the workforce runs 24/7 · not that a
// business is contacted every 24h. Per-business cadence is a future marketing-
// workforce policy · not a qualification concern.

export const COMMERCIAL_STATES = Object.freeze({
  DISCOVERED:       "discovered",
  QUALIFIED:        "qualified",
  CONTACTABLE:      "contactable",
  MARKETING_READY:  "marketing_ready",
  ATTEMPTED:        "attempted",
  ENGAGED:          "engaged",
  INVITED:          "invited",
  TRIAL:            "trial",
  PAID:             "paid",
  DECLINED:         "declined",
});

export const QUALIFICATION_STATES = Object.freeze([
  COMMERCIAL_STATES.DISCOVERED,
  COMMERCIAL_STATES.QUALIFIED,
  COMMERCIAL_STATES.CONTACTABLE,
  COMMERCIAL_STATES.MARKETING_READY,
]);

export const MARKETING_STATES = Object.freeze([
  COMMERCIAL_STATES.ATTEMPTED,
  COMMERCIAL_STATES.ENGAGED,
  COMMERCIAL_STATES.INVITED,
  COMMERCIAL_STATES.TRIAL,
  COMMERCIAL_STATES.PAID,
  COMMERCIAL_STATES.DECLINED,
]);

/**
 * Return true when the qualification engine may write to this row's state.
 * False for rows the marketing workforce has already advanced.
 */
export function isQualificationOwned(currentStatus) {
  return QUALIFICATION_STATES.includes(currentStatus);
}

/**
 * Basic Indonesian phone shape checker · not a validator, just a "looks
 * dialable" gate. Accepts:
 *   +62... (E.164 Indonesia)
 *   62... (bare country code)
 *   0... (local trunk prefix)
 * Rejects: obvious junk (all zeros, all same digit, <7 digits).
 */
export function looksLikeDialablePhone(raw) {
  if (raw == null) return false;
  const cleaned = String(raw).replace(/[^\d+]/g, "");
  if (!cleaned) return false;
  const digitsOnly = cleaned.replace(/\D/g, "");
  if (digitsOnly.length < 7 || digitsOnly.length > 15) return false;
  if (/^(\d)\1+$/.test(digitsOnly)) return false;   // all same digit
  // Accept Indonesian shapes explicitly; be permissive for foreign +... too.
  if (cleaned.startsWith("+62")) return true;
  if (cleaned.startsWith("62"))  return true;
  if (cleaned.startsWith("0"))   return true;
  if (cleaned.startsWith("+"))   return true;
  return false;
}

/**
 * WhatsApp value looks usable when it's a dialable phone OR a wa.me URL.
 */
export function looksLikeUsableWhatsApp(raw) {
  if (raw == null) return false;
  const s = String(raw).trim();
  if (!s) return false;
  if (/wa\.me\/\d{7,}/i.test(s)) return true;
  return looksLikeDialablePhone(s);
}

/**
 * Deterministic qualification engine · PURE function.
 *
 * Inputs (from nex.service_business row):
 *   business_name, website, phone, whatsapp_number, hero_image_url,
 *   commercial_status (current)
 *
 * Output:
 *   {
 *     newStatus: <one of QUALIFICATION_STATES> | <unchanged marketing state>,
 *     reason: { has_name, has_website, has_phone, has_whatsapp, has_hero_image, ... },
 *     changed: boolean
 *   }
 *
 * Rules (top-to-bottom · first matching band wins):
 *   marketing_ready: contactable AND has_hero_image
 *   contactable:     qualified   AND (has_whatsapp OR has_phone)
 *   qualified:       discovered  AND has_name AND (has_website OR has_phone OR has_whatsapp)
 *   discovered:      default
 *
 * If currentStatus is a MARKETING_STATE, engine returns {changed:false} ·
 * marketing workforce owns those transitions.
 */
export function qualify({
  business_name,
  website,
  phone,
  whatsapp_number,
  hero_image_url,
  commercial_status = COMMERCIAL_STATES.DISCOVERED,
}) {
  // Marketing workforce owns · never overwrite.
  if (!isQualificationOwned(commercial_status)) {
    return { newStatus: commercial_status, reason: { skipped: "marketing-owned" }, changed: false };
  }

  const has_name       = !!(business_name && String(business_name).trim().length >= 2);
  const has_website    = !!(website && String(website).trim().length >= 4);
  const has_phone      = looksLikeDialablePhone(phone);
  const has_whatsapp   = looksLikeUsableWhatsApp(whatsapp_number);
  const has_hero_image = !!(hero_image_url && String(hero_image_url).trim().length > 0);

  const reason = { has_name, has_website, has_phone, has_whatsapp, has_hero_image };

  // Compute band from data.
  let derived;
  if (has_name && (has_whatsapp || has_phone) && has_hero_image) {
    derived = COMMERCIAL_STATES.MARKETING_READY;
  } else if (has_name && (has_whatsapp || has_phone)) {
    derived = COMMERCIAL_STATES.CONTACTABLE;
  } else if (has_name && (has_website || has_phone || has_whatsapp)) {
    derived = COMMERCIAL_STATES.QUALIFIED;
  } else {
    derived = COMMERCIAL_STATES.DISCOVERED;
  }

  const changed = derived !== commercial_status;
  return { newStatus: derived, reason, changed };
}
