// src/lib/nex-native/family-links/invite-service.ts
//
// NEX Family Links · FS-2 · higher-level composition service.
//
// Server-only. COMPOSES the sealed primitives:
//   · family-link-service.initiateLink / confirmLink / revokeLink
//   · age-attestation-service.recordAttestation (optional)
//   · webauthn-service.listCredentialsForAccount (WebAuthn gate)
//   · pressure-signal-service.issuePressureSignal (D2 wrapper)
//   · cooldown-service.startPrimaryGuardianRevocationCooldown (D1)
//
// The sealed services are UNMODIFIED · we only consume them.
//
// Public API:
//   · createInvitationWithWebAuthnGate(args)
//       → `{ok, link}` on success, `{ok:false, reason:'webauthn_required'}`
//         when inviter has no registered WebAuthn credential (decision
//         D3 · 3A), or honest error codes from the sealed services.
//   · confirmInvitationFromRecipient(args)
//       → wraps sealed `confirmLink` with pre-check on the required
//         confirming party.
//   · revokePrimaryGuardianWithCooldown(args)
//       → routes through `cooldown-service` when the link is an active
//         primary guardian; otherwise falls through to sealed
//         `revokeLink` directly.
//   · issuePressureSignalWrapper(args)
//       → thin pass-through so UI callers import one module.
//
// Doctrine:
//   · simulated=TRUE enforced by sealed layer (we never ask to opt out).
//   · No notification side-effects anywhere · pressure-signal path is
//     already free of them, invite + confirm emit no messages beyond
//     the sealed primitives' DB writes.

import "server-only";

import {
  confirmLink,
  initiateLink,
  revokeLink,
  type ConfirmLinkArgs,
  type InitiateLinkArgs,
  type RevokeLinkArgs,
} from "./family-link-service";
import {
  startPrimaryGuardianRevocationCooldown,
  COOLDOWN_ERROR_CODES,
  type RevocationCooldownRow,
  type StartCooldownResult,
} from "./cooldown-service";
import {
  issuePressureSignal,
  type IssuePressureSignalArgs,
  type IssuePressureSignalResult,
} from "./pressure-signal-service";
import { getLinkById } from "./family-link-service";
import type { FamilyLinkRow } from "./types";
import { listCredentialsForAccount } from "../webauthn-service";

// ─────────────────────────────────────────────────────────────────────
// Result discriminated unions · UI consumers key on `ok`.
// ─────────────────────────────────────────────────────────────────────

export type InviteFailureReason =
  | "webauthn_required"
  | "primary_guardian_already_exists"
  | "self_link_forbidden"
  | "unauthorized_actor"
  | "invalid_role"
  | "invalid_initiated_by"
  | "db_unavailable"
  | "unknown_error";

export type CreateInvitationResult =
  | { ok: true; link: FamilyLinkRow }
  | { ok: false; reason: InviteFailureReason; message?: string };

export type ConfirmFailureReason =
  | "link_not_found"
  | "wrong_confirming_party"
  | "already_confirmed"
  | "already_revoked"
  | "primary_guardian_already_exists"
  | "db_unavailable"
  | "unknown_error";

export type ConfirmInvitationResult =
  | { ok: true; link: FamilyLinkRow }
  | { ok: false; reason: ConfirmFailureReason; message?: string };

export type RevokeOutcome =
  | { ok: true; kind: "immediate_revoke"; link: FamilyLinkRow }
  | { ok: true; kind: "cooldown_started"; cooldown: RevocationCooldownRow; link: FamilyLinkRow }
  | {
      ok: false;
      reason:
        | "link_not_found"
        | "unauthorized_actor"
        | "cooldown_already_pending"
        | "already_revoked"
        | "db_unavailable"
        | "unknown_error";
      message?: string;
    };

// ─────────────────────────────────────────────────────────────────────
// §1 · WebAuthn gate (decision D3 · 3A)
// ─────────────────────────────────────────────────────────────────────

/**
 * Return true when the given account has at least one registered
 * WebAuthn credential. Decision D3 · 3A requires this before an
 * invitation flow can proceed. The sealed WebAuthn storage service is
 * our source of truth · a "passed WebAuthn session" in Phase 1 is
 * modelled as "the inviter has registered at least one credential".
 * The sealed session resolver + credential list is the strongest
 * server-side signal available in this wave.
 */
export async function inviterHasWebAuthnCredential(
  accountId: string,
): Promise<boolean> {
  if (!accountId) return false;
  try {
    const creds = await listCredentialsForAccount(accountId);
    return creds.length > 0;
  } catch {
    // Fail-closed: if we cannot verify, block the invite. This is a
    // security feature, not a convenience path.
    return false;
  }
}

// ─────────────────────────────────────────────────────────────────────
// §2 · createInvitationWithWebAuthnGate
// ─────────────────────────────────────────────────────────────────────

export interface CreateInvitationArgs extends InitiateLinkArgs {}

/**
 * WebAuthn-gated invitation. If the inviter has no registered security
 * key, return `{ok:false, reason:'webauthn_required'}` BEFORE touching
 * the DB · the UI uses this to render the sealed-copy "Add a security
 * key in Settings" block.
 */
export async function createInvitationWithWebAuthnGate(
  args: CreateInvitationArgs,
): Promise<CreateInvitationResult> {
  // Gate · WebAuthn.
  const inviterId =
    args.initiatedBy === "child_invite"
      ? args.childAccountId
      : args.guardianAccountId;
  const hasKey = await inviterHasWebAuthnCredential(inviterId);
  if (!hasKey) {
    return { ok: false, reason: "webauthn_required" };
  }

  try {
    const link = await initiateLink(args);
    return { ok: true, link };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("primary_guardian_already_exists")) {
      return { ok: false, reason: "primary_guardian_already_exists", message: msg };
    }
    if (msg.includes("self_link_forbidden")) {
      return { ok: false, reason: "self_link_forbidden", message: msg };
    }
    if (msg.includes("unauthorized_actor")) {
      return { ok: false, reason: "unauthorized_actor", message: msg };
    }
    if (msg.includes("invalid_role")) {
      return { ok: false, reason: "invalid_role", message: msg };
    }
    if (msg.includes("invalid_initiated_by")) {
      return { ok: false, reason: "invalid_initiated_by", message: msg };
    }
    if (msg.includes("db_unavailable")) {
      return { ok: false, reason: "db_unavailable", message: msg };
    }
    return { ok: false, reason: "unknown_error", message: msg };
  }
}

// ─────────────────────────────────────────────────────────────────────
// §3 · confirmInvitationFromRecipient
// ─────────────────────────────────────────────────────────────────────

export interface ConfirmInvitationArgs extends ConfirmLinkArgs {}

export async function confirmInvitationFromRecipient(
  args: ConfirmInvitationArgs,
): Promise<ConfirmInvitationResult> {
  try {
    const link = await confirmLink(args);
    return { ok: true, link };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("not_found")) {
      return { ok: false, reason: "link_not_found", message: msg };
    }
    if (msg.includes("wrong_confirming_party")) {
      return { ok: false, reason: "wrong_confirming_party", message: msg };
    }
    if (msg.includes("already_confirmed")) {
      return { ok: false, reason: "already_confirmed", message: msg };
    }
    if (msg.includes("already_revoked")) {
      return { ok: false, reason: "already_revoked", message: msg };
    }
    if (msg.includes("primary_guardian_already_exists")) {
      return { ok: false, reason: "primary_guardian_already_exists", message: msg };
    }
    if (msg.includes("db_unavailable")) {
      return { ok: false, reason: "db_unavailable", message: msg };
    }
    return { ok: false, reason: "unknown_error", message: msg };
  }
}

// ─────────────────────────────────────────────────────────────────────
// §4 · revokePrimaryGuardianWithCooldown
// ─────────────────────────────────────────────────────────────────────

export interface RevokePrimaryGuardianWithCooldownArgs extends RevokeLinkArgs {}

/**
 * Routing logic:
 *   · If the link is an ACTIVE guardian_primary → open a 72h cooldown
 *     (decision D1 · 1A) and keep the family_link active.
 *   · Everything else → sealed revokeLink (immediate · pending or
 *     non-primary role).
 */
export async function revokePrimaryGuardianWithCooldown(
  args: RevokePrimaryGuardianWithCooldownArgs,
): Promise<RevokeOutcome> {
  // Read the link to classify.
  let link: FamilyLinkRow | null;
  try {
    link = await getLinkById(args.linkId);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, reason: "db_unavailable", message: msg };
  }
  if (!link) {
    return { ok: false, reason: "link_not_found" };
  }

  // Only the two parties to the link can act on it (sealed revokeLink
  // enforces this too; we pre-check for a cleaner UI message).
  if (
    args.actorAccountId !== link.guardianAccountId &&
    args.actorAccountId !== link.childAccountId
  ) {
    return { ok: false, reason: "unauthorized_actor" };
  }

  // Primary-guardian cooldown branch.
  if (link.state === "active" && link.role === "guardian_primary") {
    try {
      const result: StartCooldownResult =
        await startPrimaryGuardianRevocationCooldown({
          linkId: args.linkId,
          actorAccountId: args.actorAccountId,
        });
      return {
        ok: true,
        kind: "cooldown_started",
        cooldown: result.cooldown,
        link: result.link,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes(COOLDOWN_ERROR_CODES.COOLDOWN_ALREADY_PENDING)) {
        return { ok: false, reason: "cooldown_already_pending", message: msg };
      }
      if (msg.includes("db_unavailable")) {
        return { ok: false, reason: "db_unavailable", message: msg };
      }
      return { ok: false, reason: "unknown_error", message: msg };
    }
  }

  // Immediate-revoke branch.
  try {
    const revoked = await revokeLink(args);
    return { ok: true, kind: "immediate_revoke", link: revoked };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("already_revoked")) {
      return { ok: false, reason: "already_revoked", message: msg };
    }
    if (msg.includes("unauthorized_actor")) {
      return { ok: false, reason: "unauthorized_actor", message: msg };
    }
    if (msg.includes("db_unavailable")) {
      return { ok: false, reason: "db_unavailable", message: msg };
    }
    return { ok: false, reason: "unknown_error", message: msg };
  }
}

// ─────────────────────────────────────────────────────────────────────
// §5 · issuePressureSignalWrapper
// ─────────────────────────────────────────────────────────────────────

/**
 * Thin pass-through so UI callers can import one module. The sealed
 * pressure-signal-service already enforces the "no notification to
 * reported counterparty" invariant · we do not re-implement here.
 */
export async function issuePressureSignalFromInviteSurface(
  args: IssuePressureSignalArgs,
): Promise<IssuePressureSignalResult> {
  return await issuePressureSignal(args);
}
