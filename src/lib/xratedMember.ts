// Xrated Trades annual-member lookup.
// Powers the 5%-off Hammerex tools perk: any tradie whose listing is
// tier='app_paid' AND last_payment_plan='annual' AND paid_expires_at
// hasn't lapsed is treated as an active annual member.
//
// Used by:
//   * GET /api/xrated-member/check — the checkout AJAX surface.
//   * src/app/api/quote-requests/route.ts — re-validates server-side
//     before stamping the admin_notes flag.
//
// Lookup is by email OR whatsapp (digits-only suffix match) — checkout
// gives us whichever the buyer typed first.

import "server-only";
import { supabaseAdmin } from "./supabaseAdmin";

export const ANNUAL_MEMBER_DISCOUNT_PCT = 5;

export type AnnualMemberLookup = {
  is_annual_member: boolean;
  listing_id: string | null;
  display_name: string | null;
  slug: string | null;
};

export async function lookupAnnualMember(input: {
  email?: string | null;
  whatsapp?: string | null;
}): Promise<AnnualMemberLookup> {
  const emailLc = (input.email ?? "").trim().toLowerCase();
  const waDigits = (input.whatsapp ?? "").replace(/[^0-9]/g, "");
  if (!emailLc && !waDigits) {
    return { is_annual_member: false, listing_id: null, display_name: null, slug: null };
  }
  // Build the OR filter — case-insensitive email match OR digit-only WA
  // contains-match (covers "+44 7700 900000" vs stored "447700900000").
  const ors: string[] = [];
  if (emailLc) ors.push(`email.ilike.${emailLc}`);
  if (waDigits) ors.push(`whatsapp.ilike.%${waDigits}%`);
  const res = await supabaseAdmin
    .from("hammerex_trade_off_listings")
    .select("id,display_name,slug,tier,last_payment_plan,paid_expires_at")
    .or(ors.join(","))
    .limit(1)
    .maybeSingle();
  const row = res.data;
  if (!row) {
    return { is_annual_member: false, listing_id: null, display_name: null, slug: null };
  }
  const isPaid = row.tier === "app_paid";
  const isAnnual = row.last_payment_plan === "annual";
  const notExpired =
    !row.paid_expires_at ||
    new Date(row.paid_expires_at as string).getTime() > Date.now();
  const ok = isPaid && isAnnual && notExpired;
  return {
    is_annual_member: ok,
    listing_id: ok ? (row.id as string) : null,
    display_name: ok ? (row.display_name as string) : null,
    slug: ok ? (row.slug as string) : null
  };
}
