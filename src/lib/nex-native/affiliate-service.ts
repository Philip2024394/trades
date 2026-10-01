// src/lib/nex-native/affiliate-service.ts
//
// NEX Affiliate Network · minimum shippable service · sealed 2026-10-01.
// -----------------------------------------------------------------------------
// Backs the first-user "Join NEX Affiliate Network" path. Subsequent
// bridges extend this file with ledger / attribution / rotation /
// payout helpers · see the sealed NEX Affiliate Network doctrine.
//
// Hard rules enforced here:
//   · One affiliate row per NEX account (UNIQUE account_id)
//   · Referrer immutable once set (DB trigger belt-and-braces)
//   · Self-referral rejected
//   · Terms version REQUIRED · defensible consent evidence
//   · NEX NEVER holds funds · no balance / wallet column
//
// Call sites:
//   · joinAffiliateAction (Server Action) · creates the row
//   · isAffiliateAccount(accountId) · UI gate for the dashboard
//   · getAffiliateByAccountId(accountId) · row lookup

import "server-only";
import { nexSupabaseAdmin } from "./supabase-admin";

export const NEX_AFFILIATE_TERMS_VERSION = "2026-10-01.v1";

export type NexAffiliateStatus = "active" | "paused" | "banned";

export interface NexAffiliateAccountRow {
  id: string;
  account_id: string;
  referred_by_account_id: string | null;
  status: NexAffiliateStatus;
  terms_version: string;
  terms_accepted_at: string;
  joined_at: string;
  updated_at: string;
}

/** Join the affiliate network. Idempotent · if the account is already
 *  an affiliate, returns the existing row untouched (never silently
 *  rewrites the referrer or terms version). */
export async function joinAffiliate(input: {
  accountId: string;
  referredByAccountId?: string | null;
  termsVersion?: string;
}): Promise<NexAffiliateAccountRow> {
  const accountId = String(input.accountId).trim();
  if (!accountId) {
    throw new Error("affiliate-service.joinAffiliate: accountId required");
  }
  const referredBy = input.referredByAccountId
    ? String(input.referredByAccountId).trim() || null
    : null;
  if (referredBy && referredBy === accountId) {
    throw new Error("affiliate-service.joinAffiliate: self-referral rejected");
  }
  // Idempotent · if already joined, return existing row without
  // touching anything. Preserves the sealed-at-join invariants.
  const existing = await getAffiliateByAccountId(accountId);
  if (existing) return existing;

  const termsVersion = (input.termsVersion ?? NEX_AFFILIATE_TERMS_VERSION).trim();
  if (!termsVersion) {
    throw new Error("affiliate-service.joinAffiliate: termsVersion required");
  }

  const { data, error } = await nexSupabaseAdmin
    .from("nex_affiliate_account")
    .insert({
      account_id: accountId,
      referred_by_account_id: referredBy,
      status: "active",
      terms_version: termsVersion,
    })
    .select("*")
    .single();
  if (error || !data) {
    throw new Error(
      `affiliate-service.joinAffiliate: ${error?.message ?? "no row returned"}`,
    );
  }
  return data as NexAffiliateAccountRow;
}

/** Lookup a single affiliate record by account_id · null when the
 *  user hasn't joined the network. */
export async function getAffiliateByAccountId(
  accountId: string,
): Promise<NexAffiliateAccountRow | null> {
  const { data, error } = await nexSupabaseAdmin
    .from("nex_affiliate_account")
    .select("*")
    .eq("account_id", accountId)
    .maybeSingle();
  if (error) {
    console.error(
      `affiliate-service.getAffiliateByAccountId(${accountId}): ${error.message}`,
    );
    return null;
  }
  return (data as NexAffiliateAccountRow | null) ?? null;
}

/** Quick boolean · drives the dashboard route gating. */
export async function isAffiliateAccount(accountId: string): Promise<boolean> {
  const row = await getAffiliateByAccountId(accountId);
  return !!row && row.status === "active";
}
