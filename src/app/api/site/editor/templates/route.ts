// GET /api/site/editor/templates
//
// Lists all active editor templates. Filters by category via
// ?category= (optional). Anonymous callers get free-tier templates
// only; signed-in merchants get everything gated to their tier.
//
// Response: { templates: [{ id, slug, label, category, frame_slug,
//   state, thumbnail_url }] }

import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getMerchantSlug } from "@/lib/merchantSession";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TIER_RANK: Record<string, number> = {
  standard:  0,
  app_trial: 1,
  app_paid:  2,
  verified:  3
};

export async function GET(req: NextRequest): Promise<NextResponse> {
  const category = req.nextUrl.searchParams.get("category")?.trim() || null;

  let query = supabaseAdmin
    .from("hammerex_site_editor_templates")
    .select("id, slug, label, category, frame_slug, state_json, thumbnail_url, min_tier, display_order, sibling_group_slug, is_crown, trade_slugs, image_url, phone_slot, edit_slots")
    .eq("active", true)
    .order("display_order", { ascending: true })
    .order("created_at", { ascending: true })
    .limit(120);
  if (category) query = query.eq("category", category);

  const res = await query;
  if (res.error) {
    console.error("[editor/templates] list failed:", res.error.message);
    return NextResponse.json({ templates: [] });
  }

  // Tier gating — look up caller's tier once, then filter.
  const merchantSlug = await getMerchantSlug();
  let callerRank = 0;
  if (merchantSlug) {
    const listing = await supabaseAdmin
      .from("hammerex_trade_off_listings")
      .select("tier")
      .eq("slug", merchantSlug)
      .maybeSingle();
    const tier = (listing.data as { tier?: string } | null)?.tier ?? "standard";
    callerRank = TIER_RANK[tier] ?? 0;
  }

  const templates = (res.data ?? [])
    .filter((r) => {
      const min = (r.min_tier as string | null) ?? null;
      if (!min) return true;
      return (TIER_RANK[min] ?? 0) <= callerRank;
    })
    .map((r) => ({
      id:                 r.id                 as string,
      slug:               r.slug               as string,
      label:              r.label              as string,
      category:           r.category           as string,
      frame_slug:         r.frame_slug         as string,
      state:              r.state_json         as unknown,
      thumbnail_url:      r.thumbnail_url      as string | null,
      sibling_group_slug: (r.sibling_group_slug ?? null) as string | null,
      // Crown banner metadata — populated for premium burnt-in
      // banners, undefined otherwise. Consumer (TemplatesDrawer +
      // pick handler in EditorClient) branches on isCrown.
      isCrown:            (r.is_crown ?? false) as boolean,
      tradeSlugs:         ((r.trade_slugs as string[] | null) ?? []) as string[],
      imageUrl:           (r.image_url ?? undefined) as string | undefined,
      phoneSlot:          (r.phone_slot ?? undefined) as unknown,
      // Multi-slot metadata — array of edit slots for banners with
      // more than one editable field (e.g. "WAS £249 / NOW ONLY £179"
      // pine-doors banners). Pick handler prefers editSlots when set,
      // falls back to phoneSlot for single-slot legacy banners.
      editSlots:          (r.edit_slots ?? undefined) as unknown
    }));

  return NextResponse.json({ templates });
}
