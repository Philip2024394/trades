// NEX Comms Centre · Social · Phase 10.1 · cross-cutting tier gate.
//
// Lives OUTSIDE src/lib/nex/comms-social/** because the Charter §0 rule
// R2 forbids comms-social from importing the Hammerex Supabase admin
// client. Tier is a cross-cutting concern: the merchant's identity lives
// in Hammerex (hammerex_trade_off_listings), the Social tenant lives in
// Postgres (nex.social_tenants). This module bridges the two.
//
// Two lookup paths:
//   1. FAST · nex.social_tenants.merchant_slug → hammerex_trade_off_listings.tier
//   2. AUTO-LINK · nex_user.email → hammerex_trade_off_listings.email
//                  (on match · backfill merchant_slug on the tenant so
//                   future calls hit path 1)
//
// Access decision is centralised in `hasSocialAccess()`.

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { withClient } from "@/lib/nex/db";
import { tierFromDbValue, type TierKey } from "@/lib/tierCatalog";

export const SOCIAL_ACCESS_TIERS: ReadonlySet<TierKey> = new Set<TierKey>([
  "professional",
  "business",
  "works",
]);

export function hasSocialAccess(tier: TierKey): boolean {
  return SOCIAL_ACCESS_TIERS.has(tier);
}

export type TierSource = "linked_slug" | "auto_linked_by_email" | "no_link" | "no_email";

export interface ResolvedTier {
  tier:           TierKey;
  source:         TierSource;
  merchant_slug:  string | null;
  has_access:     boolean;
}

export async function resolveTierForTenant(input: {
  tenant_id:     string;
  email?:        string | null;
}): Promise<ResolvedTier> {
  const { tenant_id, email } = input;

  const merchantSlug = await readMerchantSlug(tenant_id);

  if (merchantSlug) {
    const tier = await readListingTier(merchantSlug);
    if (tier) {
      return { tier, source: "linked_slug", merchant_slug: merchantSlug, has_access: hasSocialAccess(tier) };
    }
  }

  if (email && email.trim()) {
    const found = await findListingByEmail(email.trim());
    if (found) {
      await writeMerchantSlug(tenant_id, found.slug);
      return { tier: found.tier, source: "auto_linked_by_email", merchant_slug: found.slug, has_access: hasSocialAccess(found.tier) };
    }
    return { tier: "free", source: "no_link", merchant_slug: null, has_access: false };
  }

  return { tier: "free", source: "no_email", merchant_slug: null, has_access: false };
}

// ── Internals ───────────────────────────────────────────────────

async function readMerchantSlug(tenant_id: string): Promise<string | null> {
  return await withClient(async (c) => {
    await c.query("BEGIN");
    try {
      await c.query("SET LOCAL ROLE nex_social_app");
      await c.query("SELECT set_config('nex.social_admin_bypass', 'on', true)");
      const r = await c.query(
        `SELECT merchant_slug FROM nex.social_tenants WHERE tenant_id = $1::uuid AND status <> 'deleted'`,
        [tenant_id],
      );
      await c.query("COMMIT");
      const v = r.rows[0]?.merchant_slug as string | null | undefined;
      return v ? String(v) : null;
    } catch (e) {
      await c.query("ROLLBACK");
      throw e;
    }
  });
}

async function writeMerchantSlug(tenant_id: string, merchant_slug: string): Promise<void> {
  await withClient(async (c) => {
    await c.query("BEGIN");
    try {
      await c.query("SET LOCAL ROLE nex_social_app");
      await c.query("SELECT set_config('nex.social_tenant_id', $1, true)", [tenant_id]);
      await c.query(
        `UPDATE nex.social_tenants SET merchant_slug = $2::text, updated_at = NOW() WHERE tenant_id = $1::uuid`,
        [tenant_id, merchant_slug],
      );
      await c.query("COMMIT");
    } catch (e) {
      await c.query("ROLLBACK");
      throw e;
    }
  });
}

async function readListingTier(slug: string): Promise<TierKey | null> {
  const sb = supabaseAdmin as unknown as { from: (t: string) => { select: (c: string) => { eq: (col: string, v: string) => { maybeSingle: () => Promise<{ data: { tier: string | null } | null; error: unknown }> } } } };
  const r = await sb.from("hammerex_trade_off_listings").select("tier").eq("slug", slug).maybeSingle();
  const raw = r.data?.tier ?? null;
  if (!raw) return null;
  return tierFromDbValue(raw).key;
}

async function findListingByEmail(email: string): Promise<{ slug: string; tier: TierKey } | null> {
  const sb = supabaseAdmin as unknown as { from: (t: string) => { select: (c: string) => { eq: (col: string, v: string) => { maybeSingle: () => Promise<{ data: { slug: string | null; tier: string | null } | null; error: unknown }> } } } };
  const r = await sb.from("hammerex_trade_off_listings").select("slug, tier").eq("email", email).maybeSingle();
  if (!r.data?.slug) return null;
  const tier = tierFromDbValue(r.data.tier).key;
  return { slug: String(r.data.slug), tier };
}
