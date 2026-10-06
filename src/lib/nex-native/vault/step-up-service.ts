// src/lib/nex-native/vault/step-up-service.ts
//
// Vault Phase A · Commit A.2 · step-up freshness service (server-only).
//
// Reads nex_session.last_password_verified_at / last_webauthn_verified_at
// / last_vault_unlock_at (added by migration 141) and enforces the
// per-operation freshness matrix from Phase A design §H.
//
// The functions here do NOT perform authentication themselves · they
// only READ the three freshness timestamps that A.3+ unlock routes will
// WRITE after successful password / WebAuthn / unlock verification.
// Writer helpers (markPasswordVerified / markWebauthnVerified /
// markVaultUnlocked) live here too so A.3+ can import them.
//
// Freshness windows locked at Phase A birth per design §H:
//
//   last_password_verified_at   → 10 min
//   last_webauthn_verified_at   → 10 min
//   last_vault_unlock_at        →  5 min
//
// Session resolution happens upstream. The caller passes the resolved
// session's id in; this service never trusts a client-supplied id.
//
// Zero commercial code · no `bisnis` / `tier` / `plan` / `subscription`
// / `entitlement` / `quota` / `allowance` references.

import "server-only";
import { nexSupabaseAdmin } from "../supabase-admin";
import type { NexTimestamp, NexUuid } from "../types";

// ---------------------------------------------------------------------------
// Freshness windows (seconds)
// ---------------------------------------------------------------------------

export const FRESH_PASSWORD_SECONDS = 600; // 10 min
export const FRESH_WEBAUTHN_SECONDS = 600; // 10 min
export const FRESH_VAULT_UNLOCK_SECONDS = 300; // 5 min

export type StepUpFactor = "password" | "webauthn" | "vault_unlock";

export interface StepUpRequirement {
  password?: "fresh";
  webauthn?: "fresh";
  vault_unlock?: "fresh";
}

export interface StepUpVerdict {
  ok: boolean;
  missing: StepUpFactor[];
  freshness: {
    password?: { ageSeconds: number | null; window: number; fresh: boolean };
    webauthn?: { ageSeconds: number | null; window: number; fresh: boolean };
    vault_unlock?: { ageSeconds: number | null; window: number; fresh: boolean };
  };
}

// ---------------------------------------------------------------------------
// Session timestamp read
// ---------------------------------------------------------------------------

interface SessionFreshnessRow {
  id: NexUuid;
  account_id: NexUuid;
  last_password_verified_at: NexTimestamp | null;
  last_webauthn_verified_at: NexTimestamp | null;
  last_vault_unlock_at: NexTimestamp | null;
  revoked_at: NexTimestamp | null;
}

async function readSessionFreshness(
  sessionId: NexUuid,
): Promise<SessionFreshnessRow | null> {
  const { data, error } = await nexSupabaseAdmin
    .from("nex_session")
    .select(
      "id, account_id, last_password_verified_at, last_webauthn_verified_at, last_vault_unlock_at, revoked_at",
    )
    .eq("id", sessionId)
    .maybeSingle();
  if (error) {
    throw new Error(`vault/step-up-service.readSessionFreshness: ${error.message}`);
  }
  return (data as SessionFreshnessRow | null) ?? null;
}

function ageSecondsFrom(timestamp: NexTimestamp | null, now: Date): number | null {
  if (!timestamp) return null;
  const t = new Date(timestamp).getTime();
  if (!Number.isFinite(t)) return null;
  return Math.max(0, Math.floor((now.getTime() - t) / 1000));
}

// ---------------------------------------------------------------------------
// requireStepUp · the matrix enforcer
// ---------------------------------------------------------------------------

/**
 * Evaluate step-up freshness for a session against the required set of
 * factors. Returns a verdict object the caller can either `assert()` on
 * or inspect in-depth to produce a precise 403 response per design §H.
 *
 * Behaviour:
 *   · Session not found → verdict with every requested factor missing.
 *   · Session revoked   → verdict with every requested factor missing.
 *   · Required factor's timestamp is NULL → missing.
 *   · Required factor's age > window → missing (stale).
 *   · Required factor's age ≤ window → fresh.
 *
 * Example:
 *   const v = await requireStepUp(session.id, { webauthn: 'fresh' });
 *   if (!v.ok) return respond403({ error: 'step_up_required', missing: v.missing });
 */
export async function requireStepUp(
  sessionId: NexUuid,
  requirement: StepUpRequirement,
  options: { now?: Date } = {},
): Promise<StepUpVerdict> {
  const now = options.now ?? new Date();
  const session = await readSessionFreshness(sessionId);
  const verdict: StepUpVerdict = { ok: true, missing: [], freshness: {} };

  const sessionDead =
    !session || (session.revoked_at !== null && session.revoked_at !== undefined);

  for (const factor of ["password", "webauthn", "vault_unlock"] as StepUpFactor[]) {
    const needed = requirement[factor] === "fresh";
    if (!needed) continue;
    const col =
      factor === "password"
        ? "last_password_verified_at"
        : factor === "webauthn"
          ? "last_webauthn_verified_at"
          : "last_vault_unlock_at";
    const window =
      factor === "password"
        ? FRESH_PASSWORD_SECONDS
        : factor === "webauthn"
          ? FRESH_WEBAUTHN_SECONDS
          : FRESH_VAULT_UNLOCK_SECONDS;
    const ts = sessionDead
      ? null
      : ((session as SessionFreshnessRow)[col as keyof SessionFreshnessRow] as
          | NexTimestamp
          | null);
    const age = ageSecondsFrom(ts, now);
    const fresh = age !== null && age <= window;
    verdict.freshness[factor] = { ageSeconds: age, window, fresh };
    if (!fresh) {
      verdict.ok = false;
      verdict.missing.push(factor);
    }
  }

  return verdict;
}

// ---------------------------------------------------------------------------
// Writers · A.3 unlock routes call these after a verification succeeds
// ---------------------------------------------------------------------------

async function updateSessionTimestamp(input: {
  sessionId: NexUuid;
  accountId: NexUuid;
  column:
    | "last_password_verified_at"
    | "last_webauthn_verified_at"
    | "last_vault_unlock_at";
  at: Date;
}): Promise<void> {
  const { error } = await nexSupabaseAdmin
    .from("nex_session")
    .update({ [input.column]: input.at.toISOString() })
    .eq("id", input.sessionId)
    .eq("account_id", input.accountId)
    .is("revoked_at", null);
  if (error) {
    throw new Error(
      `vault/step-up-service.updateSessionTimestamp(${input.column}): ${error.message}`,
    );
  }
}

/** Called by A.3 after a successful password re-verify. Writes the
 *  freshness column; next call to requireStepUp with password:'fresh'
 *  will see this timestamp. */
export async function markPasswordVerified(input: {
  sessionId: NexUuid;
  accountId: NexUuid;
  at?: Date;
}): Promise<void> {
  await updateSessionTimestamp({
    ...input,
    column: "last_password_verified_at",
    at: input.at ?? new Date(),
  });
}

/** Called by A.3 after a successful WebAuthn assertion (sign-in OR
 *  step-up challenge). */
export async function markWebauthnVerified(input: {
  sessionId: NexUuid;
  accountId: NexUuid;
  at?: Date;
}): Promise<void> {
  await updateSessionTimestamp({
    ...input,
    column: "last_webauthn_verified_at",
    at: input.at ?? new Date(),
  });
}

/** Called by A.3 after Vault is unlocked by any factor (PIN /
 *  WebAuthn-PRF / device envelope / recovery). */
export async function markVaultUnlocked(input: {
  sessionId: NexUuid;
  accountId: NexUuid;
  at?: Date;
}): Promise<void> {
  await updateSessionTimestamp({
    ...input,
    column: "last_vault_unlock_at",
    at: input.at ?? new Date(),
  });
}

// ---------------------------------------------------------------------------
// Password-reset lock sweep · design §G.1
// ---------------------------------------------------------------------------

/**
 * Clear all three freshness timestamps for every session owned by an
 * account. Called by the password-reset / account-recovery hook that
 * will land with Commit A.5. Combined with
 * nex_account.sessions_invalidated_at bump (Phase 1.0 primitive), this
 * forces every active session to drop VMK on next request and re-unlock
 * via a factor.
 *
 * Does NOT destroy envelopes · VMK / files / devices survive the
 * password reset. Only the fresh-unlock-state is invalidated.
 */
export async function clearAllStepUpForAccount(accountId: NexUuid): Promise<void> {
  const { error } = await nexSupabaseAdmin
    .from("nex_session")
    .update({
      last_password_verified_at: null,
      last_webauthn_verified_at: null,
      last_vault_unlock_at: null,
    })
    .eq("account_id", accountId);
  if (error) {
    throw new Error(
      `vault/step-up-service.clearAllStepUpForAccount: ${error.message}`,
    );
  }
}

/** Clear vault_unlock_at only · used when the client's idle timer or
 *  visibility-hidden timer fires server-side (not called in A.2 · A.3
 *  wires the beacon). */
export async function clearVaultUnlockForSession(input: {
  sessionId: NexUuid;
  accountId: NexUuid;
}): Promise<void> {
  const { error } = await nexSupabaseAdmin
    .from("nex_session")
    .update({ last_vault_unlock_at: null })
    .eq("id", input.sessionId)
    .eq("account_id", input.accountId);
  if (error) {
    throw new Error(
      `vault/step-up-service.clearVaultUnlockForSession: ${error.message}`,
    );
  }
}
