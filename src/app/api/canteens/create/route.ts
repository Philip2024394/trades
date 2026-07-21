// POST /api/canteens/create
//
// Auth-gated. The signed-in merchant creates a new canteen and is
// auto-added as its admin.
//
// Contract:
//   POST { slug, name, tagline, tradeSlug, tradeLabel, headerBgUrl?, hostDisplayName? }
//   → 200 { ok: true, id, slug }
//   → 400 { ok: false, error: "invalid-<field>" }
//   → 401 { ok: false, error: "not-authenticated" }
//   → 409 { ok: false, error: "slug-taken" }

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getMerchantIdentity } from "@/lib/merchantSession";
import { seedCanteenExamples } from "@/lib/canteens/seed";

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const RESERVED_SLUGS = new Set([
  "manage", "new", "edit", "settings", "admin", "api"
]);

type CreatePayload = {
  slug: string;
  name: string;
  tagline?: string;
  tradeSlug: string;
  tradeLabel: string;
  headerBgUrl?: string;
  hostDisplayName?: string;
};

export async function POST(req: Request) {
  const identity = await getMerchantIdentity();
  if (!identity) {
    return NextResponse.json({ ok: false, error: "not-authenticated" }, { status: 401 });
  }

  let payload: CreatePayload;
  try {
    payload = (await req.json()) as CreatePayload;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid-json" }, { status: 400 });
  }

  const slug = String(payload.slug ?? "").trim().toLowerCase();
  const name = String(payload.name ?? "").trim();
  const tradeSlug = String(payload.tradeSlug ?? "").trim().toLowerCase();
  const tradeLabel = String(payload.tradeLabel ?? "").trim();

  if (!slug || slug.length < 3 || slug.length > 60 || !SLUG_RE.test(slug)) {
    return NextResponse.json({ ok: false, error: "invalid-slug" }, { status: 400 });
  }
  if (RESERVED_SLUGS.has(slug)) {
    return NextResponse.json({ ok: false, error: "reserved-slug" }, { status: 400 });
  }
  if (!name || name.length < 3 || name.length > 120) {
    return NextResponse.json({ ok: false, error: "invalid-name" }, { status: 400 });
  }
  if (!tradeSlug || !tradeLabel) {
    return NextResponse.json({ ok: false, error: "invalid-trade" }, { status: 400 });
  }

  // Slug uniqueness — Postgres UNIQUE constraint catches races, but a
  // pre-check gives a nicer error message.
  const exists = await supabaseAdmin
    .from("hammerex_canteens")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();
  if (exists.data) {
    return NextResponse.json({ ok: false, error: "slug-taken" }, { status: 409 });
  }

  const hostDisplayName = String(payload.hostDisplayName ?? identity.slug).trim();

  const insert = await supabaseAdmin
    .from("hammerex_canteens")
    .insert({
      slug,
      name,
      tagline: payload.tagline?.trim() ?? null,
      trade_slug: tradeSlug,
      trade_label: tradeLabel,
      host_slug: identity.slug,
      host_display_name: hostDisplayName,
      header_bg_url: payload.headerBgUrl?.trim() ?? null,
      member_count: 1,
      posts_last_30d: 0,
      activity_streak_months: 0,
      is_founding_100: false
    })
    .select("id")
    .single();

  if (insert.error || !insert.data) {
    // eslint-disable-next-line no-console
    console.error("[canteens.create] insert failed", insert.error);
    if (insert.error?.code === "23505") {
      return NextResponse.json({ ok: false, error: "slug-taken" }, { status: 409 });
    }
    return NextResponse.json(
      { ok: false, error: "db-insert-failed", detail: insert.error?.message },
      { status: 500 }
    );
  }

  // Auto-add the creator as admin member. If this fails the canteen
  // still exists; log and continue so the endpoint stays idempotent
  // for retries.
  await supabaseAdmin
    .from("hammerex_canteen_members")
    .insert({
      canteen_id: insert.data.id,
      member_slug: identity.slug,
      display_name: hostDisplayName,
      trade_label: tradeLabel,
      role: "admin"
    });

  // Seed the canteen with a hero banner + 5 example posts so it never
  // looks empty. Fire-and-forget — canteen creation succeeds even if
  // seeding fails (Philip 2026-07-20 seed system).
  void seedCanteenExamples({
    canteenSlug: slug,
    tradeSlug:   tradeSlug,
    listingId:   identity.listingId
  });

  return NextResponse.json({ ok: true, id: insert.data.id, slug });
}
