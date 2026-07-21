// POST /api/counter/create
//
// Publish a listing to The Counter (cross-canteen live marketplace
// stream). Backed by hammerex_canteen_posts with kind='counter'.
//
// Auth: signed-in merchant. Must have a canteen (canteen row where
// host_slug = viewer.slug) — that canteen becomes the listing's home
// canteen. Ban check: if counter_banned_until > now, block with the
// remaining countdown so the composer can render a timer.
//
// Body: {
//   title:  string,
//   body:   string,
//   kind:   "counter" | "make-offer",
//   priceGbp?: number,
//   photoUrls?: string[]
// }

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getMerchantIdentity } from "@/lib/merchantSession";
import { validateCounterPost, counterBanState, applyCounterBan } from "@/lib/counter/validate";
import { trackLiquidity } from "@/lib/analytics/track";
import { flagContent } from "@/lib/moderation/engine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const identity = await getMerchantIdentity();
  if (!identity) {
    return NextResponse.json({ ok: false, error: "not-authenticated" }, { status: 401 });
  }

  const body = await req.json().catch(() => null) as {
    title?:     string;
    body?:      string;
    kind?:      "counter" | "make-offer" | "wanted";
    priceGbp?:  number;
    photoUrls?: string[];
  } | null;
  if (!body?.title || !body?.body) {
    return NextResponse.json({ ok: false, error: "title-and-body-required" }, { status: 400 });
  }
  const kind: "counter" | "make-offer" | "wanted" =
    body.kind === "make-offer" ? "make-offer"
    : body.kind === "wanted"    ? "wanted"
    :                             "counter";

  // Ban check — short-circuit before validation so the composer can
  // render the remaining countdown for the user.
  if (identity.listingId) {
    const ban = await counterBanState(identity.listingId);
    if (ban) {
      return NextResponse.json({
        ok:          false,
        error:       "counter-banned",
        bannedUntil: ban.bannedUntil,
        reason:      ban.reason
      }, { status: 423 });
    }
  }

  // Resolve the poster's own canteen slug (whitelist it in the
  // canteen-name validator so they can reference their own brand).
  const canteen = await supabaseAdmin
    .from("hammerex_canteens")
    .select("id, slug")
    .eq("host_slug", identity.slug)
    .maybeSingle();
  if (!canteen.data) {
    return NextResponse.json({
      ok:    false,
      error: "no-canteen",
      hint:  "Create a canteen before posting to The Counter."
    }, { status: 400 });
  }

  // Content validation. On failure with a real content rule, apply
  // the 72h ban AND drop a flag into the Moderation Engine so admins
  // can review + adjust the rules over time.
  const check = await validateCounterPost({
    title:              body.title,
    body:               body.body,
    posterCanteenSlug:  canteen.data.slug as string
  });
  if (!check.ok) {
    const isContentRule = check.ruleId === "canteen_name" || check.ruleId === "off_topic";
    if (isContentRule && identity.listingId) {
      await applyCounterBan({ listingId: identity.listingId, reason: check.reason });
      void flagContent({
        subjectKind:    "chat_message",   // no counter subject kind yet — chat closest
        subjectId:      identity.listingId,
        subjectDisplay: `Counter draft: ${body.title.slice(0, 60)}`,
        flagKind:       check.ruleId === "canteen_name" ? "spam" : "off_topic",
        flagSource:     "auto_heuristic",
        flagNote:       check.reason,
        reporterKind:   "system",
        reporterId:     "counter-validator",
        severity:       "normal"
      });
    }
    return NextResponse.json({
      ok:      false,
      error:   check.reason,
      ruleId:  check.ruleId,
      banned:  isContentRule
    }, { status: 400 });
  }

  // Insert as a canteen post with kind='counter'. This is the same
  // table platformSideLaneFromDb() reads, so the listing appears on
  // every canteen's Counter strip AND at /counter automatically.
  const insert = await supabaseAdmin
    .from("hammerex_canteen_posts")
    .insert({
      canteen_id:          canteen.data.id,
      author_slug:         identity.slug,
      author_display_name: identity.slug,   // dashboard should hydrate real name; slug is fallback
      kind,
      body:                `${body.title}\n\n${body.body}`,
      photo_urls:          body.photoUrls ?? [],
      price_gbp:           typeof body.priceGbp === "number" ? Math.round(body.priceGbp) : null,
      currency:            typeof body.priceGbp === "number" ? "GBP" : null,
      status:              "live",
      is_sample:           false
    })
    .select("id")
    .maybeSingle();

  if (insert.error) {
    return NextResponse.json({ ok: false, error: insert.error.message }, { status: 500 });
  }

  void trackLiquidity({
    slug:           "counter.post_created",
    product:        "trade_center",
    actorKind:      "merchant",
    actorId:        identity.slug,
    lifecycleStage: "supply_available",
    targetKind:     "counter_post",
    targetId:       insert.data?.id ?? null,
    metadata:       { canteen_slug: canteen.data.slug, kind }
  });

  return NextResponse.json({ ok: true, id: insert.data?.id });
}
