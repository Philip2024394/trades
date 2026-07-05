// Server-side storm-mode loader.
//
// Called at site-render time. Returns the merchant's storm banner
// payload if it's enabled + not expired, otherwise null (banner
// silently absent).

import { supabaseAdmin } from "@/lib/supabaseAdmin";

export type ActiveStormMode = {
  message: string;
  ctaLabel: string | null;
  ctaHref: string | null;
  expiresAt: string | null;
};

export async function loadActiveStormMode(
  brandId: string
): Promise<ActiveStormMode | null> {
  const res = await supabaseAdmin
    .from("studio_brand_storm_mode")
    .select("enabled, message, cta_label, cta_href, expires_at")
    .eq("brand_id", brandId)
    .maybeSingle();
  const row = res.data as {
    enabled: boolean;
    message: string | null;
    cta_label: string | null;
    cta_href: string | null;
    expires_at: string | null;
  } | null;
  if (!row || !row.enabled || !row.message) return null;
  if (row.expires_at && new Date(row.expires_at).getTime() < Date.now()) {
    return null;
  }
  return {
    message: row.message,
    ctaLabel: row.cta_label,
    ctaHref: row.cta_href,
    expiresAt: row.expires_at
  };
}
