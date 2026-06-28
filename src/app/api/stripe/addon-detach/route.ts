// POST /api/stripe/addon-detach
//
// Removes a paid add-on from an existing subscription. Used when a
// tradesperson clicks "Disable" on a paid add-on from the AddOnsHub.
// Calls `stripe.subscriptions.update` with the matching subscription-item
// flagged `deleted: true` — Stripe handles the proration automatically.
//
// Request body:
//   { listing_slug: string, edit_token: string, addon_slug: string }
//
// Response: { ok: true } on success, { ok: false, error: string } on failure.
//
// Source of truth: the webhook (`customer.subscription.updated`) reads
// the resulting subscription's remaining line items back into the
// listing's `addons_enabled` map. We don't mutate addons_enabled here.
import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "crypto";
import { getStripe } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { resolveAddonPriceId } from "@/lib/stripePrices";
import { XRATED_ADDONS } from "@/lib/xratedAddons";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function constantTimeEq(a: string, b: string): boolean {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return timingSafeEqual(aBuf, bBuf);
}

function s(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const slug = s(body.listing_slug);
  const token = s(body.edit_token);
  const addonSlug = s(body.addon_slug);

  if (!slug || !token || !addonSlug) {
    return NextResponse.json(
      { ok: false, error: "listing_slug, edit_token, and addon_slug are required" },
      { status: 400 }
    );
  }

  const addon = XRATED_ADDONS.find((a) => a.slug === addonSlug);
  if (!addon) {
    return NextResponse.json(
      { ok: false, error: "Unknown add-on." },
      { status: 400 }
    );
  }
  if (addon.pricing.kind !== "paid") {
    return NextResponse.json(
      {
        ok: false,
        error: "Free add-ons must use /api/trade-off/addons/toggle, not addon-detach."
      },
      { status: 400 }
    );
  }

  const priceId = resolveAddonPriceId(addonSlug);
  if (!priceId) {
    return NextResponse.json(
      {
        ok: false,
        error: `Stripe price not configured for add-on "${addonSlug}".`
      },
      { status: 400 }
    );
  }

  const listing = await supabaseAdmin
    .from("hammerex_trade_off_listings")
    .select("id, edit_token, stripe_subscription_id")
    .eq("slug", slug)
    .maybeSingle();

  if (listing.error) {
    return NextResponse.json(
      { ok: false, error: `Listing lookup failed: ${listing.error.message}` },
      { status: 500 }
    );
  }
  if (!listing.data) {
    return NextResponse.json(
      { ok: false, error: "Listing not found." },
      { status: 404 }
    );
  }
  if (!constantTimeEq(listing.data.edit_token ?? "", token)) {
    return NextResponse.json(
      { ok: false, error: "Invalid edit token." },
      { status: 403 }
    );
  }

  const subId = listing.data.stripe_subscription_id;
  if (!subId) {
    return NextResponse.json(
      {
        ok: false,
        error: "No active Stripe subscription on file for this listing."
      },
      { status: 409 }
    );
  }

  try {
    const stripe = getStripe();
    const existing = await stripe.subscriptions.retrieve(subId);
    const item = existing.items.data.find(
      (it) => it.price?.id === priceId
    );
    if (!item) {
      // Already detached — return ok so the UI doesn't show a spurious error.
      return NextResponse.json({ ok: true, already_detached: true });
    }

    await stripe.subscriptions.update(subId, {
      items: [{ id: item.id, deleted: true }],
      proration_behavior: "create_prorations"
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[stripe/addon-detach] subscription update failed:", message);
    return NextResponse.json(
      { ok: false, error: `Stripe addon-detach failed: ${message}` },
      { status: 500 }
    );
  }
}
