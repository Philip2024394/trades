// src/lib/nex/live/rights-declaration.ts
//
// NEX LIVE · MUSIC/VIDEO slice · Rights declaration workflow
// Philip 2026-09-06 · FOUNDER AUTHORIZATION · §5 · §6 · §10 · §11
//
// LAYERS ON Phase A rights.ts. Does NOT replace it.
//   · Phase A rights.ts models the SYSTEM'S ASSESSED state
//     (KNOWN_OWNED / KNOWN_LICENSED / UNVERIFIED / UNKNOWN / DISPUTED / EXPIRED / CONFLICTING).
//   · This module models the USER'S DECLARATION — what the uploader
//     asserts at publish time. §10 immutable: declaration ≠ verified.
//
// FOUNDER TAXONOMY (§6)
//   OWNER_DECLARED     — user asserted ownership · NOT verified
//   LICENSED           — user asserted licence · NOT verified
//   PUBLIC_DOMAIN      — user asserted public domain · NOT verified
//   CREATIVE_COMMONS   — user asserted CC · NOT verified
//   PENDING_REVIEW     — declaration made but held pending moderation
//   DISPUTED           — a report challenges the declaration
//   REMOVED            — declaration invalidated by review
//
// The mapping to Phase A's assessed state is EXPLICIT — a declaration
// alone can only ever produce UNVERIFIED, not KNOWN_OWNED. §10.

import type { RightsState } from "./rights";

// ── Founder's declaration taxonomy ─────────────────────────────────

export type DeclaredRightsKind =
  | "OWNER_DECLARED"
  | "LICENSED"
  | "PUBLIC_DOMAIN"
  | "CREATIVE_COMMONS"
  | "PENDING_REVIEW"
  | "DISPUTED"
  | "REMOVED";

// ── The declaration record ─────────────────────────────────────────

export type MediaRightsDeclaration = {
  /** ULID-like or UUID · unique per declaration event · a media may have
   *  multiple declaration versions over its lifetime (dispute → new
   *  declaration → dispute cleared, etc.). */
  declaration_id: string;

  /** The media this declaration is about. Never guessed — supplied at
   *  upload time. */
  media_id: string;

  /** The user who made the declaration. From authenticated session. */
  uploader_user_id: string;

  /** Which category did the uploader claim? */
  declared_kind: DeclaredRightsKind;

  /** Free-text declaration statement the uploader signed. Never trusted
   *  as evidence — only kept for audit + moderator context. */
  declared_statement: string;

  /** Optional external evidence URL / licence reference the uploader
   *  supplied (e.g. CC BY link, custom-agreement doc). Not verified. */
  supporting_reference: string | null;

  /** ISO timestamp of the declaration. */
  declared_at_iso: string;

  /** Whether this declaration is the currently effective one for the
   *  media (an old declaration may be superseded by a review or a new
   *  uploader-issued correction). */
  is_active: boolean;
};

// ── Assessed state mapping (§10) ───────────────────────────────────
// The core discipline: convert a declaration to Phase A's RightsState.
// A DECLARATION ALONE never becomes KNOWN_OWNED. That upgrade requires
// external evidence beyond user attestation — deferred to a future
// verifier system.

export function assessedStateForDeclaration(kind: DeclaredRightsKind): RightsState {
  switch (kind) {
    case "OWNER_DECLARED":     return "UNVERIFIED";
    case "LICENSED":           return "UNVERIFIED";
    case "PUBLIC_DOMAIN":      return "UNVERIFIED";
    case "CREATIVE_COMMONS":   return "UNVERIFIED";
    case "PENDING_REVIEW":     return "UNVERIFIED";
    case "DISPUTED":           return "DISPUTED";
    case "REMOVED":            return "UNKNOWN";
  }
}

// ── Publish gate (§10 · §11) ───────────────────────────────────────
// The single question the upload endpoint asks. Publishing is
// ALLOWED for user-declared content — but the publish path must ALSO
// route the media through the appropriate lifecycle state (LiveContent
// v2 has PUBLISHED_PENDING that carries the honest "not verified" tag
// downstream).

export function mayPublishDeclaredMedia(kind: DeclaredRightsKind): {
  allowed: boolean;
  reason: string;
  visible_to_public: boolean;
} {
  if (kind === "REMOVED" || kind === "DISPUTED") {
    return {
      allowed: false,
      reason: `declaration_state_blocks_publish:${kind}`,
      visible_to_public: false,
    };
  }
  return {
    allowed: true,
    reason: `declared:${kind}`,
    // Visible YES, but internal state remains UNVERIFIED — customer-
    // facing labels must reflect that per §10 (never call declared
    // ownership verified).
    visible_to_public: true,
  };
}

// ── Customer-facing label (§10) ────────────────────────────────────
// The single function all UI code should use to render rights status.
// Never accepts "verified" language for a declaration alone.

export function customerFacingRightsLabel(kind: DeclaredRightsKind): string {
  switch (kind) {
    case "OWNER_DECLARED":     return "Uploader-declared ownership";
    case "LICENSED":           return "Uploader-declared licence";
    case "PUBLIC_DOMAIN":      return "Uploader-declared public domain";
    case "CREATIVE_COMMONS":   return "Uploader-declared Creative Commons";
    case "PENDING_REVIEW":     return "Held pending review";
    case "DISPUTED":           return "Rights disputed · under review";
    case "REMOVED":            return "Removed following review";
  }
}

// ── Constructor · always safe by default ──────────────────────────

export function newDeclaration(input: {
  declaration_id: string;
  media_id: string;
  uploader_user_id: string;
  declared_kind: DeclaredRightsKind;
  declared_statement: string;
  supporting_reference?: string | null;
  now_iso?: string;
}): MediaRightsDeclaration {
  return {
    declaration_id: input.declaration_id,
    media_id: input.media_id,
    uploader_user_id: input.uploader_user_id,
    declared_kind: input.declared_kind,
    declared_statement: input.declared_statement,
    supporting_reference: input.supporting_reference ?? null,
    declared_at_iso: input.now_iso ?? new Date().toISOString(),
    is_active: true,
  };
}
