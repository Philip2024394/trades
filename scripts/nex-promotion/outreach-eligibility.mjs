// scripts/nex-promotion/outreach-eligibility.mjs
//
// Task #88 Phase 4A · outreach eligibility engine · pure functions (2026-08-22)
//
// Doctrine anchors:
//   project_nex_task88_promotion_pipeline_spec_2026_08_22
//   project_nex_task88_phase3_shipped_2026_08_22
//   Philip 2026-08-22 Phase 4 lock: "discovered → evidence → admin-approved →
//   outreach eligible. NOT merely discovered."
//   Philip 2026-08-22: "Do not send live outreach until those gates are
//   demonstrated and explicitly approved."
//
// Pure eligibility check · zero DB access · zero side effects · testable.
// Consumed by scripts/nex-promotion/run-outreach-dryrun.mjs (this session)
// and eventually the live-send worker (deferred · needs Philip's explicit
// per-batch approval + Task #32 Meta template approval).
//
// SEVEN eligibility gates, evaluated in order (short-circuit on first fail).
// Each row reports which gate blocked it — funnel breakdown is honest.

/** @typedef {Object} EligibilityInput
 *  @property {string}   businessRef
 *  @property {string}   claimStatus
 *  @property {string}   ownerStatus
 *  @property {string?}  whatsappNumber
 *  @property {string?}  phone
 *  @property {string?}  website
 *  @property {number}   recentAttempts30d       (COUNT from nex.food_outreach_attempt)
 *  @property {boolean}  isSuppressed            (EXISTS in nex.food_outreach_suppression)
 *  @property {boolean}  metaTemplateApproved    (from Task #32 policy config · false by default)
 *  @property {boolean}  smsProviderConfigured   (env-driven · false by default)
 */

// ── Gate constants (locked · aligned with Philip's Phase 4 spec) ──
export const GATE_ORDER = [
  "admin_adjudicated",         // 1. business.claim_status IN listed/invited (admin has passed judgement)
  "not_owner_owned",           // 2. owner_status is unknown/contacted (owner hasn't yet verified · outreach makes sense)
  "has_verifiable_contact",    // 3. WhatsApp or valid-looking phone
  "no_recent_outreach",        // 4. zero outreach_attempt rows in last 30d (idempotency · anti-spam)
  "not_suppressed",            // 5. not in outreach_suppression list
  "policy_allows_channel",     // 6. Task #32 Meta template approved OR SMS provider configured
  "channel_matches_contact",   // 7. business has the channel policy allows (e.g. WA policy on · business has WA)
];

const RECENT_OUTREACH_WINDOW_DAYS = 30;
const PHONE_MIN_DIGITS = 8;
const PHONE_MAX_DIGITS = 15;

// ── Helpers ─────────────────────────────────────────────────────────

function isNonBlank(s) { return typeof s === "string" && s.trim().length > 0; }

function digits(s) { return typeof s === "string" ? s.replace(/\D+/g, "") : ""; }

function isValidPhoneShape(s) {
  const d = digits(s);
  return d.length >= PHONE_MIN_DIGITS && d.length <= PHONE_MAX_DIGITS;
}

// ── Main eligibility check ──────────────────────────────────────────

/** @param {EligibilityInput} row
 *  @returns {{ eligible: boolean, blockedByGate: string|null, availableChannels: string[], reason: string }}
 */
export function checkEligibility(row) {
  // Gate 1 · admin has adjudicated
  if (row.claimStatus !== "listed" && row.claimStatus !== "invited") {
    return {
      eligible: false,
      blockedByGate: "admin_adjudicated",
      availableChannels: [],
      reason: `claim_status='${row.claimStatus}' · needs admin promotion to 'listed' first (per Phase 3 gate)`,
    };
  }

  // Gate 2 · owner hasn't already verified
  if (row.ownerStatus === "verified") {
    return {
      eligible: false,
      blockedByGate: "not_owner_owned",
      availableChannels: [],
      reason: "owner_status='verified' · owner already claimed · no outreach needed",
    };
  }

  // Gate 3 · has verifiable contact channel
  const availableChannels = [];
  if (isNonBlank(row.whatsappNumber) && isValidPhoneShape(row.whatsappNumber)) availableChannels.push("whatsapp");
  if (isNonBlank(row.phone)          && isValidPhoneShape(row.phone))          availableChannels.push("phone_sms");
  // website contact-form isn't machine-outreach · humans submit forms · exclude
  if (availableChannels.length === 0) {
    return {
      eligible: false,
      blockedByGate: "has_verifiable_contact",
      availableChannels: [],
      reason: "no verifiable WhatsApp or phone (website contact-form is human-only · excluded)",
    };
  }

  // Gate 4 · idempotency (no outreach within 30d cooldown)
  if ((row.recentAttempts30d ?? 0) > 0) {
    return {
      eligible: false,
      blockedByGate: "no_recent_outreach",
      availableChannels,
      reason: `${row.recentAttempts30d} outreach attempt(s) in last ${RECENT_OUTREACH_WINDOW_DAYS} days · cooldown active`,
    };
  }

  // Gate 5 · not in suppression list
  if (row.isSuppressed) {
    return {
      eligible: false,
      blockedByGate: "not_suppressed",
      availableChannels,
      reason: "listed in nex.food_outreach_suppression",
    };
  }

  // Gate 6 · policy allows at least one channel this business has
  const policyChannels = [];
  if (row.metaTemplateApproved)  policyChannels.push("whatsapp");
  if (row.smsProviderConfigured) policyChannels.push("phone_sms");
  if (policyChannels.length === 0) {
    return {
      eligible: false,
      blockedByGate: "policy_allows_channel",
      availableChannels,
      reason: "NO channel authorised by policy · Meta WhatsApp template pending (Task #32) · SMS provider not configured",
    };
  }

  // Gate 7 · intersection · business has a channel the policy allows
  const eligibleChannels = availableChannels.filter((c) => policyChannels.includes(c));
  if (eligibleChannels.length === 0) {
    return {
      eligible: false,
      blockedByGate: "channel_matches_contact",
      availableChannels,
      reason: `policy allows [${policyChannels.join(",")}] but business only has [${availableChannels.join(",")}]`,
    };
  }

  return {
    eligible: true,
    blockedByGate: null,
    availableChannels: eligibleChannels,
    reason: `ELIGIBLE via ${eligibleChannels.join(" or ")}`,
  };
}

// ── Aggregate a batch into the funnel Philip specified ──────────────
//
// Philip 2026-08-22 verbatim funnel shape:
//   410 discovered
//    37 evidence-qualified
//    19 admin-approved
//    11 outreach-eligible
//     8 blocked by policy
//     3 missing usable contact

/** @param {EligibilityInput[]} rows */
export function summariseFunnel(rows) {
  const funnel = {
    considered:               rows.length,
    admin_adjudicated:        0,   // passed Gate 1
    owner_still_open:         0,   // passed Gate 2
    has_verifiable_contact:   0,   // passed Gate 3
    no_recent_outreach:       0,   // passed Gate 4
    not_suppressed:           0,   // passed Gate 5
    policy_allows:            0,   // passed Gate 6
    eligible:                 0,   // passed Gate 7 (ELIGIBLE)
    // Blockers · by gate (mutually exclusive · first-failed-gate wins)
    blocked_by: {
      admin_adjudicated:      0,
      not_owner_owned:        0,
      has_verifiable_contact: 0,
      no_recent_outreach:     0,
      not_suppressed:         0,
      policy_allows_channel:  0,
      channel_matches_contact:0,
    },
  };

  for (const row of rows) {
    const r = checkEligibility(row);

    // Count what the row PASSED before its blocker (or all, if eligible).
    const passedUntil = r.eligible ? GATE_ORDER.length : GATE_ORDER.indexOf(r.blockedByGate);
    if (passedUntil >= 1) funnel.admin_adjudicated++;
    if (passedUntil >= 2) funnel.owner_still_open++;
    if (passedUntil >= 3) funnel.has_verifiable_contact++;
    if (passedUntil >= 4) funnel.no_recent_outreach++;
    if (passedUntil >= 5) funnel.not_suppressed++;
    if (passedUntil >= 6) funnel.policy_allows++;
    if (r.eligible) funnel.eligible++;
    if (!r.eligible && r.blockedByGate) funnel.blocked_by[r.blockedByGate]++;
  }

  return funnel;
}
