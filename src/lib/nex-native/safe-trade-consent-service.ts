// src/lib/nex-native/safe-trade-consent-service.ts
//
// Bridge 16b · records the account-level acknowledgement of the
// NEX safe-trade doctrine + terms of service. Users see a JIT modal
// the first time they enter a commerce interaction (a chat with a
// seller who owns a business, or eventually the first order-quote).
// Accepting stamps nex_account.safe_trade_consent_at + the version.
//
// Legal purpose: shift the responsibility for choosing an
// off-doctrine payment path (direct bank transfer to seller before
// delivery) onto the user, not NEX. When someone later complains
// support can quote the acknowledged version + date.

import "server-only";
import { nexSupabaseAdmin } from "./supabase-admin";
import type { NexUuid, NexAccountRow } from "./types";

/** The current terms version · bump when the doctrine changes
 *  materially. Format YYYY-MM-DD. This constant IS the source of
 *  truth for what "current terms" means · the /nex-native/terms
 *  page reads from here so the header matches the DB. */
export const CURRENT_SAFE_TRADE_TERMS_VERSION = "2026-09-28";

/** Fetch just the consent fields for the current account. Returns
 *  `null` if the row is missing. */
export async function getSafeTradeConsent(
  accountId: NexUuid,
): Promise<{
  consented_at: string | null;
  version: string | null;
} | null> {
  const { data, error } = await nexSupabaseAdmin
    .from("nex_account")
    .select("safe_trade_consent_at, safe_trade_consent_version")
    .eq("id", accountId)
    .maybeSingle();
  if (error) {
    throw new Error(
      `safe-trade-consent-service.getSafeTradeConsent: ${error.message}`,
    );
  }
  if (!data) return null;
  return {
    consented_at: (data as { safe_trade_consent_at: string | null })
      .safe_trade_consent_at,
    version: (data as { safe_trade_consent_version: string | null })
      .safe_trade_consent_version,
  };
}

/** True when the user has acknowledged the CURRENT terms version.
 *  False if they've never acknowledged, or acknowledged an older
 *  version (we re-prompt in that case). */
export async function hasCurrentSafeTradeConsent(
  accountId: NexUuid,
): Promise<boolean> {
  const consent = await getSafeTradeConsent(accountId);
  if (!consent) return false;
  if (!consent.consented_at) return false;
  return consent.version === CURRENT_SAFE_TRADE_TERMS_VERSION;
}

/** Record acknowledgement of the current terms version. Idempotent ·
 *  callable multiple times without effect (updated_at effectively
 *  refreshes but there's no updated_at column · we just re-stamp
 *  the timestamp + version). */
export async function recordSafeTradeConsent(
  accountId: NexUuid,
): Promise<NexAccountRow> {
  const nowIso = new Date().toISOString();
  const { data, error } = await nexSupabaseAdmin
    .from("nex_account")
    .update({
      safe_trade_consent_at: nowIso,
      safe_trade_consent_version: CURRENT_SAFE_TRADE_TERMS_VERSION,
    })
    .eq("id", accountId)
    .select("*")
    .single();
  if (error || !data) {
    throw new Error(
      `safe-trade-consent-service.recordSafeTradeConsent: ${error?.message ?? "no row"}`,
    );
  }
  return data as NexAccountRow;
}
