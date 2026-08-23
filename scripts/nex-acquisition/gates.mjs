// NEX Universal Acquisition Engine · Commercial Gates (constitutional).
//
// Every candidate record passes every gate in order. No bypass. No skip.
// No combining. This is a HARD invariant of the acquisition machine.
//
// Governing doctrine:
//   project_nex_acquisition_machine_scheduled_agents_2026_08_21
//
// GATE ORDER (never re-arrange):
//   1. DISCOVERED    — agent found the record (implicit · candidate exists)
//   2. VALIDATED     — dedupe + shape check (done in engine matchAgainstExisting)
//   3. CONTACTABLE   — has verifiable channel (WhatsApp / phone)
//   4. ELIGIBLE      — not suppressed · not in cooldown · not over cap ·
//                      WhatsApp policy would pass · kill switch not engaged
//   5. OUTREACH      — templated + rate-limited + audit-logged send
//
// Discovery ≠ Outreach: Gates 1-4 can run continuously in any acquisition run.
// Gate 5 is NEVER invoked from smoke mode. In production, outreach lives in a
// separate worker with its own kill-switch check at the START of every attempt.
//
// Vertical-agnostic: no food/hotel/villa-specific logic in this file.

function isNonEmptyString(v) { return typeof v === "string" && v.trim().length > 0; }

export function gate3_contactable(record) {
  const hasWhatsApp = isNonEmptyString(record.whatsapp);
  const hasPhone = isNonEmptyString(record.phone);
  if (hasWhatsApp) return { pass: true, channel: "whatsapp", value: record.whatsapp };
  if (hasPhone) return { pass: true, channel: "phone", value: record.phone };
  return { pass: false, reason: "no verifiable contact channel (no WhatsApp · no phone)" };
}

export function gate4_eligible(record, opts = {}) {
  // Full eligibility engine is Task #48 — deferred until owner-claim Layer 3
  // ships. This stub enforces the shape and the ordering; production impl
  // will extend it with suppression list, per-business cooldowns, daily/monthly
  // caps, WhatsApp template validity, and HQ kill switch check.
  if (opts.killSwitchEngaged) return { pass: false, reason: "kill switch engaged" };
  if (opts.suppressed) return { pass: false, reason: "in suppression list" };
  if (opts.cooldownActive) return { pass: false, reason: "cooldown active" };
  if (opts.dailyCapReached) return { pass: false, reason: "daily outreach cap reached" };
  return { pass: true };
}

export function gate5_outreach(record, opts = {}) {
  // CONSTITUTIONAL: this function DOES NOT SEND from an acquisition run.
  // Outreach is a separate worker with its own kill-switch recheck at start,
  // its own audit, its own rate limiter. The acquisition engine only marks
  // candidates as "outreach-ready" — the outreach worker picks them up.
  if (opts.smokeMode) {
    return { attempted: false, blockedBySmoke: true, reason: "smoke mode · outreach hard-noop" };
  }
  // Even in non-smoke mode, this function must not send from here — return
  // marker only. This preserves Discovery ≠ Outreach at the engine level.
  return { attempted: false, markedReady: true };
}

export function runGates(record, { smokeMode, config } = {}) {
  const result = {
    passedDiscovered: true,
    passedValidated: true,
    passedContactable: false,
    passedEligible: false,
    outreachAttempted: false,
    outreachBlockedBySmoke: false,
    reason: null,
  };

  const g3 = gate3_contactable(record);
  if (!g3.pass) { result.reason = g3.reason; return result; }
  result.passedContactable = true;
  result.contactChannel = g3.channel;

  const g4 = gate4_eligible(record, {
    killSwitchEngaged: config?.killSwitchEngaged ?? false,
    suppressed: false,
    cooldownActive: false,
    dailyCapReached: false,
  });
  if (!g4.pass) { result.reason = g4.reason; return result; }
  result.passedEligible = true;

  const g5 = gate5_outreach(record, { smokeMode });
  result.outreachAttempted = g5.attempted;
  result.outreachBlockedBySmoke = Boolean(g5.blockedBySmoke);

  return result;
}
