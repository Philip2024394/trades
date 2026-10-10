"use server";

// src/lib/nex-native/family-links/_server-actions.ts
//
// NEX Family Links · FS-2 · Server Actions.
//
// These are the ONLY mutation entry points reachable from the client
// components. Every action:
//   · Resolves the current session via the sealed resolver.
//   · Checks the authoritative actor id · never trusts the client arg
//     to decide "who am I".
//   · Composes the FS-2 service layer (invite-service, cooldown-service,
//     pressure-signal-service) which COMPOSES the sealed primitives.
//
// The sealed family-link-service / age-attestation-service /
// family-role-reader are NEVER modified.

import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import {
  confirmInvitationFromRecipient,
  createInvitationWithWebAuthnGate,
  inviterHasWebAuthnCredential,
  issuePressureSignalFromInviteSurface,
  revokePrimaryGuardianWithCooldown,
  type ConfirmInvitationResult,
  type CreateInvitationResult,
  type RevokeOutcome,
} from "./invite-service";
import type {
  FamilyLinkInitiatedBy,
  FamilyLinkRow,
  FamilyRole,
} from "./types";
import type { IssuePressureSignalResult } from "./pressure-signal-service";
import {
  cancelPendingCooldown,
  confirmCooldownBypass,
  readPendingCooldownForLink,
  type RevocationCooldownRow,
} from "./cooldown-service";
import type { PressureReasonCode } from "./pressure-signal-service";
import { getLinkById } from "./family-link-service";

// ─────────────────────────────────────────────────────────────────────
// Session helpers.
// ─────────────────────────────────────────────────────────────────────

type NoSession = { ok: false; reason: "no_session" };

async function requireActor(): Promise<
  { ok: true; actorAccountId: string } | NoSession
> {
  const sess = await resolveNexAppSessionFromContext();
  if (!sess) return { ok: false, reason: "no_session" };
  return { ok: true, actorAccountId: sess.account.id };
}

// ─────────────────────────────────────────────────────────────────────
// Action results.
// ─────────────────────────────────────────────────────────────────────

export type ActionResult<T> = T | NoSession;

export interface CreateInvitationActionArgs {
  readonly otherPartyAccountId: string;
  readonly role: FamilyRole;
  readonly initiatedBy: FamilyLinkInitiatedBy;
  readonly expiresAt?: string | null;
}

export async function createInvitationAction(
  args: CreateInvitationActionArgs,
): Promise<ActionResult<CreateInvitationResult>> {
  const auth = await requireActor();
  if (!auth.ok) return auth;
  const { actorAccountId } = auth;

  // Compose: the actor is always the inviter. For a guardian_invite
  // the actor IS the guardian; for a child_invite the actor IS the
  // child. system_setup uses the actor as the guardian (sealed
  // service enforces this authorisation).
  let guardianAccountId: string;
  let childAccountId: string;
  switch (args.initiatedBy) {
    case "guardian_invite":
    case "system_setup":
      guardianAccountId = actorAccountId;
      childAccountId = args.otherPartyAccountId;
      break;
    case "child_invite":
      childAccountId = actorAccountId;
      guardianAccountId = args.otherPartyAccountId;
      break;
    default:
      // Defence-in-depth · sealed service rejects unknown values too.
      return {
        ok: false,
        reason: "invalid_initiated_by",
        message: "unknown initiated_by value",
      };
  }

  return await createInvitationWithWebAuthnGate({
    guardianAccountId,
    childAccountId,
    role: args.role,
    initiatedBy: args.initiatedBy,
    actorAccountId,
    expiresAt: args.expiresAt ?? null,
  });
}

export interface ConfirmInvitationActionArgs {
  readonly linkId: string;
}

export async function confirmInvitationAction(
  args: ConfirmInvitationActionArgs,
): Promise<ActionResult<ConfirmInvitationResult>> {
  const auth = await requireActor();
  if (!auth.ok) return auth;
  return await confirmInvitationFromRecipient({
    linkId: args.linkId,
    actorAccountId: auth.actorAccountId,
  });
}

export interface RevokeInvitationActionArgs {
  readonly linkId: string;
  readonly reason?: string;
}

export async function revokeInvitationAction(
  args: RevokeInvitationActionArgs,
): Promise<ActionResult<RevokeOutcome>> {
  const auth = await requireActor();
  if (!auth.ok) return auth;
  return await revokePrimaryGuardianWithCooldown({
    linkId: args.linkId,
    actorAccountId: auth.actorAccountId,
    reason: args.reason,
  });
}

export interface IssuePressureSignalActionArgs {
  readonly linkId: string;
  readonly reasonCode: PressureReasonCode;
  readonly reasonNotes?: string;
}

export async function issuePressureSignalAction(
  args: IssuePressureSignalActionArgs,
): Promise<
  ActionResult<
    | { ok: true; result: IssuePressureSignalResult }
    | { ok: false; reason: string; message?: string }
  >
> {
  const auth = await requireActor();
  if (!auth.ok) return auth;
  try {
    const result = await issuePressureSignalFromInviteSurface({
      linkId: args.linkId,
      actorAccountId: auth.actorAccountId,
      reasonCode: args.reasonCode,
      reasonNotes: args.reasonNotes,
    });
    return { ok: true, result };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, reason: "pressure_signal_failed", message: msg };
  }
}

export interface ConfirmCooldownBypassActionArgs {
  readonly cooldownId: string;
}

export async function confirmCooldownBypassAction(
  args: ConfirmCooldownBypassActionArgs,
): Promise<
  ActionResult<
    | { ok: true; cooldown: RevocationCooldownRow }
    | { ok: false; reason: string; message?: string }
  >
> {
  const auth = await requireActor();
  if (!auth.ok) return auth;
  try {
    const cooldown = await confirmCooldownBypass({
      cooldownId: args.cooldownId,
      actorAccountId: auth.actorAccountId,
    });
    return { ok: true, cooldown };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, reason: "bypass_failed", message: msg };
  }
}

export interface CancelCooldownActionArgs {
  readonly cooldownId: string;
}

export async function cancelCooldownAction(
  args: CancelCooldownActionArgs,
): Promise<
  ActionResult<
    | { ok: true; cooldown: RevocationCooldownRow }
    | { ok: false; reason: string; message?: string }
  >
> {
  const auth = await requireActor();
  if (!auth.ok) return auth;
  try {
    const cooldown = await cancelPendingCooldown({
      cooldownId: args.cooldownId,
      actorAccountId: auth.actorAccountId,
    });
    return { ok: true, cooldown };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, reason: "cancel_failed", message: msg };
  }
}

// ─────────────────────────────────────────────────────────────────────
// Read-side helpers · for Server Component shells.
// ─────────────────────────────────────────────────────────────────────

export async function readLinkWithCooldown(linkId: string): Promise<
  ActionResult<{
    link: FamilyLinkRow | null;
    cooldown: RevocationCooldownRow | null;
  }>
> {
  const auth = await requireActor();
  if (!auth.ok) return auth;
  const link = await getLinkById(linkId);
  const cooldown = link ? await readPendingCooldownForLink(linkId) : null;
  return { link, cooldown };
}

export async function readInviterWebAuthnState(): Promise<
  ActionResult<{ hasWebAuthn: boolean; actorAccountId: string }>
> {
  const auth = await requireActor();
  if (!auth.ok) return auth;
  const hasWebAuthn = await inviterHasWebAuthnCredential(auth.actorAccountId);
  return { hasWebAuthn, actorAccountId: auth.actorAccountId };
}
