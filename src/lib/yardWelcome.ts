// Yard welcome-message helper. Called from the Stripe webhook on a
// successful checkout.session.completed (tier → app_paid). Drops a
// single Trade Off team post addressed to the new member.
//
// Why this lives in lib (not the webhook route): the helper is
// idempotent and self-contained, so the webhook stays narrowly about
// the Stripe contract, and an admin-side "resend welcome" surface can
// reuse the same code later.
//
// Idempotency: we look up an existing welcome for this listing_id by
// scanning the team-authored posts whose metadata.target_listing_id
// matches, and bail if one already exists. Cheap because
// is_admin_announcement is a small slice of the table.
//
// Demo profiles (slug LIKE 'demo-%') are skipped — they're seeded for
// the Yard feed to look live, not real new members.

import "server-only";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { ADMIN_LISTING_ID, ADMIN_DISPLAY_NAME } from "@/lib/yardAdmin";

const WELCOME_EXPIRY_DAYS = 30;

function firstName(displayName: string | null | undefined): string {
  if (!displayName) return "there";
  const first = displayName.trim().split(/\s+/)[0];
  return first || "there";
}

function buildWelcomeBody(name: string): string {
  return [
    `Welcome to The Yard, ${name}! 👋`,
    "",
    "The Yard is where trades chat — share job tips, ask questions, post wins, find help with quirky problems. Pinned posts at the top are from the thenetworkers.app team.",
    "",
    "New here? Try saying hi in the next 24 hours — the community will welcome you back. Be respectful, no spam, no hard sells. We moderate flagged posts within a few hours.",
    "",
    "Have fun."
  ].join("\n");
}

export type CreateYardWelcomeResult =
  | { ok: true; created: true; id: string }
  | { ok: true; created: false; reason: "exists" | "demo" | "no_listing" };

/**
 * Insert a single admin-authored welcome post for a freshly-paid
 * member. Idempotent: if a welcome already exists for the same
 * listing_id (via metadata.target_listing_id), this is a no-op.
 *
 * - is_admin_announcement = true  (so the public feed renders the
 *   yellow rim + Trade Off branding)
 * - is_pinned = false             (the welcome sits in the chat feed,
 *   it doesn't squat the top of the board)
 * - listing_id = ADMIN_LISTING_ID (sentinel — no real listing behind
 *   the post)
 * - metadata.target_listing_id = the new member's listing id
 */
export async function createYardWelcomeMessage(
  listingId: string
): Promise<CreateYardWelcomeResult> {
  if (!listingId) {
    return { ok: true, created: false, reason: "no_listing" };
  }

  // Look up the new member's slug + display_name. Demo seeds are
  // skipped — they wear `slug LIKE 'demo-%'` so the public feed has
  // density without spawning seed welcome messages.
  const listing = await supabaseAdmin
    .from("hammerex_trade_off_listings")
    .select("id, slug, display_name")
    .eq("id", listingId)
    .maybeSingle();
  if (!listing.data) {
    return { ok: true, created: false, reason: "no_listing" };
  }
  if ((listing.data.slug ?? "").startsWith("demo-")) {
    return { ok: true, created: false, reason: "demo" };
  }

  // Idempotency check — has a welcome already been posted to this
  // member's id? We rely on the metadata jsonb column and the
  // is_admin_announcement flag to keep the scan tight.
  const existing = await supabaseAdmin
    .from("hammerex_trade_off_yard_posts")
    .select("id")
    .eq("is_admin_announcement", true)
    .eq("listing_id", ADMIN_LISTING_ID)
    .contains("metadata", { target_listing_id: listingId })
    .limit(1)
    .maybeSingle();

  if (existing.data) {
    return { ok: true, created: false, reason: "exists" };
  }

  const name = firstName(listing.data.display_name);
  const expires_at = new Date(
    Date.now() + WELCOME_EXPIRY_DAYS * 24 * 60 * 60 * 1000
  ).toISOString();

  const ins = await supabaseAdmin
    .from("hammerex_trade_off_yard_posts")
    .insert({
      listing_id: ADMIN_LISTING_ID,
      kind: "chat",
      trade_slug: "general-builder",
      title: `Welcome to The Yard, ${name}!`,
      body: buildWelcomeBody(name),
      country: "UK",
      region: null,
      is_sample: false,
      status: "live",
      is_admin_announcement: true,
      is_pinned: false,
      moderation_status: "live",
      expires_at,
      metadata: {
        posted_by: "trade_off_team",
        display_name: ADMIN_DISPLAY_NAME,
        target_listing_id: listingId,
        type: "welcome"
      }
    })
    .select("id")
    .single();

  if (ins.error || !ins.data) {
    console.error("[yardWelcome] insert failed:", ins.error);
    // Don't throw — the Stripe webhook must still 200. The welcome
    // is a nice-to-have, not a critical path.
    return { ok: true, created: false, reason: "no_listing" };
  }

  return { ok: true, created: true, id: ins.data.id };
}
