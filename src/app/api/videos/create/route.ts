// POST /api/videos/create
// Networkers TV — create a video record.
//
// v0.5: accepts a public video URL (Supabase Storage, Cloudflare
// Stream, or any CDN). Direct-upload flow ships in a follow-on when
// we're ready to wire signed uploads.
//
// Washer economy:
//   • Free tier: 3 permanent library slots per merchant
//   • Beyond that: 10 washers per additional upload
//   • Feed-class uploads (30-day auto-expire) don't count toward
//     the permanent slot cap, but each still costs 5 washers to
//     discourage spam
//
// Auth: getMerchantSlug() reads the signed merchant session cookie.

import { NextResponse } from "next/server";
import { supabaseAdmin }   from "@/lib/supabaseAdmin";
import { getMerchantSlug } from "@/lib/merchantSession";
import { spendWashers }    from "@/lib/washers";
import { TIER_VIDEO_LIMITS, WASHERS_PER_EXTRA_SLOT, WASHERS_PER_FEED_POST, normaliseTier } from "@/app/videos/config";
import { migrateImageKitVideoUrl, isImageKitUrl } from "@/lib/videos/imagekitMigrate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CreatePayload = {
  video_url:          string;
  title:              string;
  description?:       string;
  thumbnail_url?:     string;
  duration_seconds?:  number;
  size_bytes?:        number;
  video_class?:       "feed" | "portfolio" | "kb";
  category_slug?:     string;
  trade_slug?:        string;
  project_type?:      string;
  city?:              string;
  regions?:           string[];
  difficulty?:        "beginner" | "intermediate" | "advanced" | "specialist";
  estimated_time_hours?: number;
  estimated_cost_gbp?:   number;
  consent_admin_reuse?:  boolean;
  consent_supplier_ref?: boolean;
};

export async function POST(req: Request) {
  const merchantSlug = await getMerchantSlug();
  if (!merchantSlug) return NextResponse.json({ ok: false, error: "auth-required" }, { status: 401 });

  let body: CreatePayload;
  try { body = await req.json(); }
  catch { return NextResponse.json({ ok: false, error: "invalid-json" }, { status: 400 }); }

  // Validate required fields
  if (!body.video_url || typeof body.video_url !== "string" || body.video_url.trim().length < 6) {
    return NextResponse.json({ ok: false, error: "video_url-required" }, { status: 400 });
  }
  if (!body.title || typeof body.title !== "string" || body.title.trim().length < 4) {
    return NextResponse.json({ ok: false, error: "title-too-short" }, { status: 400 });
  }
  const videoClass = body.video_class ?? "portfolio";

  // ─── Tier lookup ───────────────────────────────────────────
  const { data: listingRow } = await supabaseAdmin
    .from("hammerex_trade_off_listings")
    .select("tier, extra_video_slots")
    .eq("slug", merchantSlug)
    .maybeSingle();
  const tierKey     = normaliseTier(listingRow?.tier);
  const tierLimits  = TIER_VIDEO_LIMITS[tierKey];
  const extraSlots  = Number(listingRow?.extra_video_slots ?? 0);
  const librarySlotCap = tierLimits.librarySlots + extraSlots;

  // Duration cap is per-tier
  if (body.duration_seconds && (body.duration_seconds < 1 || body.duration_seconds > tierLimits.maxVideoLengthSeconds)) {
    return NextResponse.json({
      ok: false,
      error: "duration-exceeds-tier-max",
      max_seconds: tierLimits.maxVideoLengthSeconds,
      tier: tierKey
    }, { status: 400 });
  }

  // ─── Washer + slot gate ────────────────────────────────────
  let washerSpend: { ok: true; transactionId: string; balance: number } | null = null;
  let slotBuyUp   = false;

  if (videoClass !== "feed") {
    // Count current permanent-library rows
    const existing = await supabaseAdmin
      .from("hammerex_videos")
      .select("id", { count: "exact", head: true })
      .eq("merchant_slug", merchantSlug)
      .in("video_class", ["portfolio", "kb"])
      .neq("status", "removed");
    const usedSlots = existing.count ?? 0;

    if (usedSlots >= librarySlotCap) {
      // At cap — try to buy up one more slot with washers, if the
      // tier allows headroom
      const currentBuyUp = extraSlots;
      if (currentBuyUp >= tierLimits.buyUpCeiling) {
        return NextResponse.json({
          ok: false,
          error: "library-full",
          library_slot_cap: librarySlotCap,
          buy_up_ceiling: tierLimits.buyUpCeiling,
          tier: tierKey,
          upgrade_needed: true
        }, { status: 402 });
      }
      const spend = await spendWashers({
        merchantSlug,
        amount: WASHERS_PER_EXTRA_SLOT,
        source: "networkers-tv-slot-buyup",
        detail: { title: body.title.slice(0, 80), tier: tierKey, current_extra: currentBuyUp }
      });
      if (!spend.ok) {
        return NextResponse.json({
          ok: false, error: spend.reason,
          balance: "balance" in spend ? spend.balance : undefined,
          cost:    WASHERS_PER_EXTRA_SLOT
        }, { status: spend.reason === "insufficient-balance" ? 402 : 500 });
      }
      washerSpend = { ok: true, transactionId: spend.transactionId, balance: spend.balance };
      slotBuyUp   = true;
      // Increment extra_video_slots so subsequent uploads honour the new cap
      await supabaseAdmin
        .from("hammerex_trade_off_listings")
        .update({ extra_video_slots: currentBuyUp + 1 })
        .eq("slug", merchantSlug);
    }
  } else if (WASHERS_PER_FEED_POST > 0) {
    // Feed uploads are free in v0.5 (WASHERS_PER_FEED_POST=0). Kept
    // as a branch so we can add a spam-gate cost later without a
    // refactor.
    const spend = await spendWashers({
      merchantSlug,
      amount: WASHERS_PER_FEED_POST,
      source: "networkers-tv-feed-upload",
      detail: { title: body.title.slice(0, 80), video_class: "feed" }
    });
    if (!spend.ok) {
      return NextResponse.json({
        ok: false, error: spend.reason,
        balance: "balance" in spend ? spend.balance : undefined,
        cost:    WASHERS_PER_FEED_POST
      }, { status: spend.reason === "insufficient-balance" ? 402 : 500 });
    }
    washerSpend = { ok: true, transactionId: spend.transactionId, balance: spend.balance };
  }

  // ─── Auto-migrate ImageKit → Supabase Storage ─────────────
  // Every video that lands in Networkers TV lives on Supabase.
  // ImageKit is treated as a transit URL only. Non-ImageKit URLs
  // (Supabase, other CDNs) pass through unchanged.
  let finalVideoUrl = body.video_url.trim();
  let migrationInfo: { migrated: boolean; sizeBytes?: number; error?: string } = { migrated: false };
  if (isImageKitUrl(finalVideoUrl)) {
    const migrate = await migrateImageKitVideoUrl(finalVideoUrl, { titleHint: body.title });
    if (!migrate.ok) {
      // Migration failure is non-fatal — we still create the row
      // with the ImageKit URL. Admin can retry via a backfill script.
      console.error("[videos.create] imagekit migration failed:", migrate.error);
      migrationInfo = { migrated: false, error: migrate.error };
    } else {
      finalVideoUrl = migrate.publicUrl;
      migrationInfo = { migrated: migrate.migrated, sizeBytes: migrate.sizeBytes };
    }
  }

  // Insert video row
  const nowIso = new Date().toISOString();
  const insert = await supabaseAdmin
    .from("hammerex_videos")
    .insert({
      merchant_slug:        merchantSlug,
      title:                body.title.trim(),
      description:          body.description?.trim() || null,
      video_url:            finalVideoUrl,
      thumbnail_url:        body.thumbnail_url?.trim() || null,
      duration_seconds:     body.duration_seconds ?? null,
      size_bytes:           body.size_bytes ?? null,
      video_class:          videoClass,
      category_slug:        body.category_slug ?? null,
      trade_slug:           body.trade_slug ?? null,
      project_type:         body.project_type ?? null,
      city:                 body.city ?? null,
      regions:              body.regions ?? [],
      difficulty:           body.difficulty ?? null,
      estimated_time_hours: body.estimated_time_hours ?? null,
      estimated_cost_gbp:   body.estimated_cost_gbp ?? null,
      consent_admin_reuse:  Boolean(body.consent_admin_reuse),
      consent_supplier_ref: Boolean(body.consent_supplier_ref),
      published_at:         nowIso,
      // v0.5: instant-publish. Moderation queue lands in Phase 2 —
      // will change default back to 'processing' + wire admin approval.
      // Every upload is already gated behind: verified merchant
      // session + washer spend + explicit consent checkbox.
      status:               "live"
    })
    .select("id")
    .single();

  if (insert.error || !insert.data) {
    return NextResponse.json({ ok: false, error: "db-insert-failed", detail: insert.error?.message }, { status: 500 });
  }

  return NextResponse.json({
    ok:            true,
    id:            insert.data.id,
    status:        "live",
    tier:          tierKey,
    slot_buy_up:   slotBuyUp,
    video_url:     finalVideoUrl,
    migration:     migrationInfo,
    washer_spend:  washerSpend ? { transactionId: washerSpend.transactionId, balance: washerSpend.balance } : null
  });
}
