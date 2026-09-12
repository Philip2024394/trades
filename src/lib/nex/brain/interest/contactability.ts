// src/lib/nex/brain/interest/contactability.ts
//
// NEX Entity → Interest → Owner Conversation Slice
// Philip 2026-09-06 · CEREMONIAL AUTHORIZE
//
// PURPOSE (§3 · §4 · §22)
//   Determine whether the entity has a verified usable communication
//   route. This is the HARD GATE — no route means no Interest-send
//   capability. Never fabricates a contact.
//
// STATES
//   VERIFIED_CONTACT     · KNOWN_YES on ≥1 channel (phone/whatsapp/website)
//   NO_VERIFIED_CONTACT  · all channels KNOWN_NO or absent + no claim
//   UNKNOWN_CONTACT      · all channels UNKNOWN (never negatively claimed)
//   STALE_CONTACT        · KNOWN_YES existed but data past freshness window
//   CONFLICTING_CONTACT  · multiple channels report different values
//
// SEPARATION (§22)
//   SOURCE ≠ CAPABILITY. This module ONLY assesses whether a route
//   exists · it does NOT decide "user should be able to interest" ·
//   the interest-gate composes that decision from Contactability +
//   Interest intent + Entity resolution.

import type { WorldRecord } from "../world-adapters/types";

// ─── Types ──────────────────────────────────────────────────────

export type ContactabilityState =
  | "VERIFIED_CONTACT"
  | "NO_VERIFIED_CONTACT"
  | "UNKNOWN_CONTACT"
  | "STALE_CONTACT"
  | "CONFLICTING_CONTACT";

export type ContactChannel = "phone" | "whatsapp" | "website" | "email";

export type ContactChannelState = {
  channel: ContactChannel;
  present: boolean;                     // raw field populated on the record
  verified: boolean;                    // owner-claimed / verified state
  value?: string;                       // the raw value · never fabricated
};

export type ContactabilityAssessment = {
  state: ContactabilityState;
  channels: readonly ContactChannelState[];
  interest_send_enabled: boolean;       // final gate output
  reason: string;
};

// ─── Assessor ───────────────────────────────────────────────────

/** Assess contactability from a WorldRecord.
 *
 *  Rules:
 *    · VERIFIED_CONTACT requires ≥1 channel with present=true AND
 *      verified=true. Verified means either
 *      (a) claimStatus === "claimed" AND record.verified === true, OR
 *      (b) the channel was explicitly captured with an owner-tier
 *          provenance marker. Field presence alone is NOT verification.
 *    · NO_VERIFIED_CONTACT · at least one channel is present but not
 *      verified · OR no channels present AND record is unclaimed.
 *    · UNKNOWN_CONTACT · no channels present · no claim state at all.
 *    · STALE_CONTACT / CONFLICTING_CONTACT · reserved for future
 *      enrichment. Current adapters don't expose freshness or
 *      conflict per channel · state remains stable as NO_VERIFIED_CONTACT
 *      or UNKNOWN_CONTACT for now.
 *
 *  interest_send_enabled is TRUE ONLY when state === VERIFIED_CONTACT.
 *  This is the immutable gate for the Interest send flow. Never fires
 *  when a channel is merely PRESENT but not owner-verified. */
export function assessContactability(record: WorldRecord): ContactabilityAssessment {
  const rec = record as unknown as {
    phone?: string;
    whatsapp?: string;
    website?: string;
    email?: string;
    verified?: boolean;
    claimStatus?: string;
  };

  const ownerVerified = record.claimStatus === "claimed" && record.verified === true;

  const channels: ContactChannelState[] = [
    { channel: "phone",    present: !!rec.phone,    verified: ownerVerified && !!rec.phone,    value: typeof rec.phone === "string" ? rec.phone : undefined },
    { channel: "whatsapp", present: !!rec.whatsapp, verified: ownerVerified && !!rec.whatsapp, value: typeof rec.whatsapp === "string" ? rec.whatsapp : undefined },
    { channel: "website",  present: !!rec.website,  verified: ownerVerified && !!rec.website,  value: typeof rec.website === "string" ? rec.website : undefined },
    { channel: "email",    present: !!rec.email,    verified: ownerVerified && !!rec.email,    value: typeof rec.email === "string" ? rec.email : undefined },
  ];

  const anyVerified = channels.some((c) => c.verified);
  const anyPresent  = channels.some((c) => c.present);

  if (anyVerified) {
    return {
      state: "VERIFIED_CONTACT",
      channels,
      interest_send_enabled: true,
      reason: `verified_channels:${channels.filter((c) => c.verified).map((c) => c.channel).join(",")}`,
    };
  }
  if (anyPresent) {
    return {
      state: "NO_VERIFIED_CONTACT",
      channels,
      interest_send_enabled: false,
      reason: `channels_present_but_unverified:${channels.filter((c) => c.present).map((c) => c.channel).join(",")}`,
    };
  }
  return {
    state: "UNKNOWN_CONTACT",
    channels,
    interest_send_enabled: false,
    reason: "no_channels_populated",
  };
}

/** Convenience predicate matching the immutable gate rule. */
export function canInterestFireSend(assessment: ContactabilityAssessment): boolean {
  return assessment.interest_send_enabled === true && assessment.state === "VERIFIED_CONTACT";
}
