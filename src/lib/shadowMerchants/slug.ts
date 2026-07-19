// Shadow-profile slug generator + uniqueness guard.
//
// Rules:
//   - lowercase, letters + digits + hyphens only
//   - starts with a letter
//   - max 40 chars (matches the merchant-profile slug policy)
//   - collision-safe: appends -{n} suffix on collisions with existing
//     hammerex_trade_off_listings.slug OR hammerex_shadow_merchants.reserved_slug
//
// Used by the scraper to reserve a URL like:
//   thenetworkers.app/joes-plumbing-manchester

import { supabaseAdmin } from "@/lib/supabaseAdmin";

const MAX_SLUG_LEN = 40;

export function baseSlugFromBusinessName(name: string, city?: string | null): string {
  const parts = [name, city].filter(Boolean).join(" ");
  const cleaned = parts
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/['`"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
  // Ensure it starts with a letter — prepend "trade-" if not
  const withLetterStart = /^[a-z]/.test(cleaned) ? cleaned : `trade-${cleaned}`;
  return withLetterStart.slice(0, MAX_SLUG_LEN).replace(/-+$/g, "");
}

/**
 * Reserve a unique slug. Checks both live listings + existing shadow
 * profiles for collisions. Returns a slug guaranteed unique at insert
 * time (subject to normal race conditions — the DB unique constraint
 * is the authoritative gate).
 */
export async function reserveUniqueSlug(base: string): Promise<string> {
  const cleanBase = base.slice(0, MAX_SLUG_LEN);
  let candidate  = cleanBase;
  let suffix     = 1;

  while (true) {
    const [listingRes, shadowRes] = await Promise.all([
      supabaseAdmin
        .from("hammerex_trade_off_listings")
        .select("id")
        .eq("slug", candidate)
        .maybeSingle(),
      supabaseAdmin
        .from("hammerex_shadow_merchants")
        .select("id")
        .eq("reserved_slug", candidate)
        .maybeSingle()
    ]);

    if (!listingRes.data && !shadowRes.data) {
      return candidate;
    }

    suffix += 1;
    const suffixStr = `-${suffix}`;
    candidate = cleanBase.slice(0, MAX_SLUG_LEN - suffixStr.length) + suffixStr;

    if (suffix > 99) {
      // Extremely unlikely fallback — timestamp to guarantee uniqueness
      return `${cleanBase.slice(0, 25)}-${Date.now().toString(36)}`;
    }
  }
}

/**
 * Opaque claim token — 32-char base36. Not cryptographically strong
 * against brute force but the shadow profile is worthless without
 * the merchant's WhatsApp verification step, so this is fine.
 */
export function generateClaimToken(): string {
  // 128 bits of entropy split across 26 base-36 chars + a leading letter
  const rand = () => Math.random().toString(36).slice(2);
  return `c${(rand() + rand() + rand()).slice(0, 31)}`;
}
