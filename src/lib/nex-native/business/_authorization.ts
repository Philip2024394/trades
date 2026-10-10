// src/lib/nex-native/business/_authorization.ts
//
// NEX Business NEX · authorization helpers.
// Phase 2 · Rev 6 clarification #3 (2026-10-02).
//
// TWO DISTINCT AUTHORIZATIONS govern Business NEX surfaces:
//
//   READ the universal catalog     · any signed-in NEX account
//   WRITE business configuration   · only the authenticated OWNER of
//                                    the target nex_business.id
//
// Navigation visibility hides /manage/* from free users, but direct
// URL access must still render the universal catalog (read is open).
// Writes are refused with a precise error that the UI translates into
// an "Activate your Business NEX first" affordance.
//
// Doctrine: `profile IS NULL` means NEVER ACTIVATED (clarification #1).
// Phase 2 code must never null a non-null profile.

import "server-only";
import { nexSupabaseAdmin } from "../supabase-admin";
import type { NexAppSession } from "../app/session";

export class BusinessAuthorizationError extends Error {
  code:
    | "unauthenticated"
    | "not_authorized"
    | "not_activated"
    | "already_activated_mismatch"
    | "business_not_found";
  constructor(
    code: BusinessAuthorizationError["code"],
    message: string,
  ) {
    super(message);
    this.code = code;
    this.name = "BusinessAuthorizationError";
  }
}

/** READ the universal catalog · any signed-in NEX account. The function
 *  is intentionally sync + session-only so it can be called from server
 *  components rendering /manage/* without a DB round-trip. */
export function canReadUniversalCatalog(session: NexAppSession | null): boolean {
  return !!session?.account?.id;
}

/** Returns the id of the nex_business row owned by this session's
 *  account, if any. Returns null if there is no owned business. Does
 *  NOT create a row. */
export async function getOwnedBusinessId(
  session: NexAppSession,
): Promise<string | null> {
  if (!session?.account?.id) return null;
  const { data, error } = await nexSupabaseAdmin
    .from("nex_business")
    .select("id")
    .eq("owner_account_id", session.account.id)
    .maybeSingle();
  if (error) {
    throw new Error(
      `_authorization.getOwnedBusinessId: ${error.message}`,
    );
  }
  return data?.id ?? null;
}

/** Returns the full ownership context for a session's business row ·
 *  used by activation + reclassification server actions. */
export async function getOwnedBusinessContext(
  session: NexAppSession,
): Promise<{
  business_id: string;
  profile_is_active: boolean;
} | null> {
  if (!session?.account?.id) return null;
  const { data, error } = await nexSupabaseAdmin
    .from("nex_business")
    .select("id, profile")
    .eq("owner_account_id", session.account.id)
    .maybeSingle();
  if (error) {
    throw new Error(
      `_authorization.getOwnedBusinessContext: ${error.message}`,
    );
  }
  if (!data) return null;
  return {
    business_id: data.id,
    profile_is_active: data.profile !== null,
  };
}

/** Enforce ACTIVATION authorization · the owner must be authenticated and
 *  own the target business row. Profile may be null (first-time activation).
 *  Returns the business_id on success; throws otherwise. */
export async function assertCanActivateBusinessFor(
  session: NexAppSession | null,
  business_id?: string,
): Promise<string> {
  if (!session?.account?.id) {
    throw new BusinessAuthorizationError(
      "unauthenticated",
      "You must be signed in to activate Business NEX.",
    );
  }
  const ctx = await getOwnedBusinessContext(session);
  if (!ctx) {
    throw new BusinessAuthorizationError(
      "business_not_found",
      "No business row exists for this account yet.",
    );
  }
  if (business_id && business_id !== ctx.business_id) {
    throw new BusinessAuthorizationError(
      "not_authorized",
      "That business belongs to a different account.",
    );
  }
  return ctx.business_id;
}

/** Enforce WRITE authorization for an EXISTING active business · owner
 *  must be authenticated, own the business, and the profile must already
 *  be set (= Business NEX already activated). Throws otherwise. */
export async function assertCanWriteBusinessConfig(
  session: NexAppSession | null,
  business_id: string,
): Promise<void> {
  if (!session?.account?.id) {
    throw new BusinessAuthorizationError(
      "unauthenticated",
      "You must be signed in.",
    );
  }
  const ctx = await getOwnedBusinessContext(session);
  if (!ctx) {
    throw new BusinessAuthorizationError(
      "business_not_found",
      "No business row exists for this account.",
    );
  }
  if (ctx.business_id !== business_id) {
    throw new BusinessAuthorizationError(
      "not_authorized",
      "That business belongs to a different account.",
    );
  }
  if (!ctx.profile_is_active) {
    throw new BusinessAuthorizationError(
      "not_activated",
      "Activate your Business NEX first to configure it.",
    );
  }
}
