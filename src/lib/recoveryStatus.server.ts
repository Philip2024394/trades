// Server-side helper for reading a merchant's recovery status. Used
// by the reviews page hero + profile focus verified stack.

import { supabaseAdmin } from "@/lib/supabaseAdmin";

export type RecoveryStatus = {
  awardedAt: string;
  reason: string;
} | null;

export async function recoveryStatusForMerchant(merchantSlug: string): Promise<RecoveryStatus> {
  const res = await supabaseAdmin
    .from("hammerex_merchant_recovery")
    .select("awarded_at, reason")
    .eq("merchant_slug", merchantSlug)
    .maybeSingle();
  if (res.error || !res.data) return null;
  return { awardedAt: res.data.awarded_at, reason: res.data.reason };
}
