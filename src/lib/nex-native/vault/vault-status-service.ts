// src/lib/nex-native/vault/vault-status-service.ts
//
// Vault Phase A · Commit A.3 · vault-status service (server-only).
//
// Resolves the per-session Vault state for routes and UI pages so a
// single source of truth decides which surface to render / permit:
//
//   configured ↔ an nex_vault_setup row exists for the account
//   unlocked   ↔ the current session has a fresh last_vault_unlock_at
//                (within FRESH_VAULT_UNLOCK_SECONDS)
//
// Deliberately thin · it composes getVaultSetupForAccount (A.2
// envelope-service) with the sealed step-up freshness window from
// step-up-service. No duplicate query logic.
//
// Owner-scoped. Session resolution happens upstream · callers pass
// session.account.id and session.id. Zero commercial code.

import "server-only";
import { nexSupabaseAdmin } from "../supabase-admin";
import type { NexUuid } from "../types";
import { getVaultSetupForAccount } from "./envelope-service";
import {
  FRESH_VAULT_UNLOCK_SECONDS,
  requireStepUp,
} from "./step-up-service";

/**
 * Look up the current session's nex_session.id by (account_id,
 * supabase_session_key hex). Required by step-up writes (which key by
 * UUID) when the resolver returned only account context. Returns null
 * when no matching row exists (e.g. the session resolver has not yet
 * written the touch row · routes should treat null as "step-up not
 * recordable this request" and fail-closed rather than making a bogus
 * write).
 */
export async function lookupNexSessionId(input: {
  accountId: NexUuid;
  supabaseSessionKey: string;
}): Promise<NexUuid | null> {
  const { data, error } = await nexSupabaseAdmin
    .from("nex_session")
    .select("id")
    .eq("account_id", input.accountId)
    .eq("supabase_session_key", input.supabaseSessionKey)
    .is("revoked_at", null)
    .maybeSingle();
  if (error) {
    throw new Error(`vault/vault-status-service.lookupNexSessionId: ${error.message}`);
  }
  return (data?.id as NexUuid | undefined) ?? null;
}

export interface VaultSessionState {
  /** True iff an nex_vault_setup row exists for the account. */
  configured: boolean;
  /** True iff the current session has a vault_unlock timestamp inside
   *  the sealed 5-minute freshness window (requireStepUp verdict). */
  unlocked: boolean;
  /** Age of the last unlock in seconds, or null if never unlocked
   *  in this session. */
  unlockedAgeSeconds: number | null;
  /** The window the UI uses to render idle-timer countdowns. */
  unlockWindowSeconds: number;
  /** For UI · what mode the account configured ('pin' | 'passphrase'
   *  | null when not configured). */
  mode: "pin" | "passphrase" | null;
}

/**
 * Resolve the complete Vault state for a single session. Used by:
 *   · GET /api/nex-native/vault/status (UI poll)
 *   · the Vault page server-render decision (setup vs locked vs unlocked)
 *   · every route that needs to decide "is this request allowed?"
 *
 * Does NOT mutate state. Does NOT touch the client. Pure read-only
 * server-side resolution.
 */
export async function resolveVaultStateForSession(input: {
  accountId: NexUuid;
  sessionId: NexUuid;
  now?: Date;
}): Promise<VaultSessionState> {
  const [setup, verdict] = await Promise.all([
    getVaultSetupForAccount(input.accountId),
    requireStepUp(
      input.sessionId,
      { vault_unlock: "fresh" },
      input.now ? { now: input.now } : {},
    ),
  ]);

  return {
    configured: setup !== null,
    unlocked: verdict.ok,
    unlockedAgeSeconds: verdict.freshness.vault_unlock?.ageSeconds ?? null,
    unlockWindowSeconds: FRESH_VAULT_UNLOCK_SECONDS,
    mode: setup?.pin_mode ?? null,
  };
}

/** Convenience · callers that only need "configured" avoid the
 *  step-up query. Used by setup-route to detect double-setup. */
export async function isVaultConfigured(accountId: NexUuid): Promise<boolean> {
  const setup = await getVaultSetupForAccount(accountId);
  return setup !== null;
}
