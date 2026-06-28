// POST /api/trade-off/addons/toggle
// Magic-link authenticated. Body: { slug, edit_token, addon_slug, enabled }.
// Validates addon_slug against the XRATED_ADDONS registry, rejects paid
// add-ons for non-paid listings, then merges the flag into addons_enabled.

import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { XRATED_ADDONS } from "@/lib/xratedAddons";
import { effectiveTier } from "@/lib/xratedTrades";

export const runtime = "nodejs";

function constantTimeEq(a: string, b: string): boolean {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return timingSafeEqual(aBuf, bBuf);
}

function s(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const slug = s(body.slug);
  const token = s(body.edit_token);
  const addonSlug = s(body.addon_slug);
  const enabled = body.enabled === true || body.enabled === "true" || body.enabled === 1;

  if (!slug || !token || !addonSlug) {
    return NextResponse.json(
      { ok: false, error: "Missing slug, edit_token, or addon_slug." },
      { status: 400 }
    );
  }

  const addon = XRATED_ADDONS.find((a) => a.slug === addonSlug);
  if (!addon) {
    return NextResponse.json({ ok: false, error: "Unknown add-on." }, { status: 400 });
  }
  if (addon.availability === "coming_soon") {
    return NextResponse.json(
      { ok: false, error: "This add-on is coming soon." },
      { status: 400 }
    );
  }

  // Gate — this endpoint is only for free add-ons (or add-ons included
  // with paid tier, e.g. Trusted Trades). Paid add-ons must go through
  // /api/stripe/addon-attach so the subscription is mutated and the
  // customer is billed. 402 Payment Required is the right status here.
  if (addon.pricing.kind === "paid" && !addon.includedWithPaid) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Use /api/stripe/addon-attach (or /api/stripe/addon-detach) for paid add-ons."
      },
      { status: 402 }
    );
  }

  const listing = await supabaseAdmin
    .from("hammerex_trade_off_listings")
    .select("id, edit_token, tier, trial_expires_at, addons_enabled")
    .eq("slug", slug)
    .maybeSingle();

  if (!listing.data) {
    return NextResponse.json({ ok: false, error: "Listing not found." }, { status: 404 });
  }
  if (!constantTimeEq(listing.data.edit_token, token)) {
    return NextResponse.json({ ok: false, error: "Invalid edit token." }, { status: 403 });
  }

  const tier = effectiveTier({
    tier: listing.data.tier ?? "standard",
    trial_expires_at: listing.data.trial_expires_at ?? null
  });
  const isPaid = tier === "app_trial" || tier === "app_paid" || tier === "app_verified";

  if (addon.pricing.kind === "paid" && enabled && !isPaid) {
    return NextResponse.json(
      { ok: false, error: "Upgrade required to enable this add-on." },
      { status: 403 }
    );
  }

  const current =
    listing.data.addons_enabled && typeof listing.data.addons_enabled === "object"
      ? (listing.data.addons_enabled as Record<string, boolean>)
      : {};
  const wasOn = current[addonSlug] === true;
  const next: Record<string, boolean> = { ...current, [addonSlug]: enabled };

  const upd = await supabaseAdmin
    .from("hammerex_trade_off_listings")
    .update({ addons_enabled: next })
    .eq("id", listing.data.id)
    .select("addons_enabled")
    .maybeSingle();

  if (upd.error || !upd.data) {
    console.error("[trade-off/addons/toggle] update failed:", upd.error);
    return NextResponse.json(
      { ok: false, error: upd.error?.message ?? "Update failed" },
      { status: 500 }
    );
  }

  // FAQ Page seeded migration — when the tradesperson first switches
  // FAQ Page ON, copy any existing free-tier faq_items JSONB rows into
  // the new normalised table. Idempotent: if a FAQ already exists in
  // hammerex_xrated_faq_items for this listing, we skip (the
  // tradesperson has already started curating the new surface and we
  // don't want to overwrite their work). The JSONB column stays put
  // as an immutable backup so a future toggle-off reverts cleanly.
  if (addonSlug === "faq_page" && enabled && !wasOn) {
    try {
      await seedFaqPageFromJsonb(listing.data.id);
    } catch (err) {
      // Seed failure is non-fatal — the add-on toggle itself succeeded.
      // The tradesperson can re-create FAQs by hand from the editor.
      console.error("[trade-off/addons/toggle] FAQ seed failed:", err);
    }
  }

  return NextResponse.json({ ok: true, addons_enabled: upd.data.addons_enabled });
}

/** One-shot seed — copy faq_items JSONB into hammerex_xrated_faq_items.
 *  Skipped when the listing already has any rows in the new table (the
 *  tradesperson has either already enabled-then-disabled the add-on or
 *  manually populated). */
async function seedFaqPageFromJsonb(listingId: string): Promise<void> {
  const existing = await supabaseAdmin
    .from("hammerex_xrated_faq_items")
    .select("id", { count: "exact", head: true })
    .eq("listing_id", listingId);
  if (existing.error) throw existing.error;
  if ((existing.count ?? 0) > 0) return;

  const listingRow = await supabaseAdmin
    .from("hammerex_trade_off_listings")
    .select("faq_items")
    .eq("id", listingId)
    .maybeSingle();
  if (listingRow.error) throw listingRow.error;
  const raw = (listingRow.data?.faq_items ?? []) as Array<{ q?: string; a?: string }>;
  if (!Array.isArray(raw) || raw.length === 0) return;

  // Filter to entries that satisfy the new table's length CHECKs. A
  // sloppy 3-char question (q='?') from the old free-tier accordion
  // would fail the 5-200 CHECK and abort the seed; better to skip the
  // outliers than lose every legal row.
  const rows = raw
    .filter(
      (it) =>
        typeof it?.q === "string" &&
        typeof it?.a === "string" &&
        it.q.trim().length >= 5 &&
        it.q.trim().length <= 200 &&
        it.a.trim().length >= 5 &&
        it.a.trim().length <= 2000
    )
    .map((it, idx) => ({
      listing_id: listingId,
      ref_code: `FAQ-${String(idx + 1).padStart(3, "0")}`,
      question: (it.q as string).trim(),
      answer: (it.a as string).trim(),
      category: "general" as const,
      status: "live" as const,
      sort_order: (idx + 1) * 10
    }));
  if (rows.length === 0) return;

  // Trigger enforces a 50-row LIVE cap; older free-tier FAQs are
  // unlikely to exceed that, but slice defensively.
  const capped = rows.slice(0, 50);
  const ins = await supabaseAdmin
    .from("hammerex_xrated_faq_items")
    .insert(capped);
  if (ins.error) throw ins.error;
}
