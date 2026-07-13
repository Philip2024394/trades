// GET /api/dev/impersonate?slug=<merchant-slug>&next=<path>
//
// [DEV BUTTON] — remove on "remove dev buttons"
//
// Dev-only merchant sign-in. Reads the merchant's `edit_token` from
// hammerex_trade_off_listings and sets the studio session cookie so
// every server-side session helper (loadStudioSession /
// loadMerchantSession) returns that merchant. Redirects to `next`
// with the edit_token appended so URL-token-guarded pages authorise.
//
// Dev-mode auto-seed: if the requested slug starts with "demo-" and
// doesn't have a row, we insert a minimal one on the fly so the
// button always works without a manual `node scripts/seed-*.mjs`
// step. This is why we CAN'T land this endpoint in prod.
//
// Prod (NODE_ENV === "production") returns 404.

import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { setStudioSession } from "@/lib/studio/session";
import { setTradeSessionCookie } from "@/lib/tradeSession";
import { MOCK_CANTEENS } from "@/lib/canteens";

export const dynamic = "force-dynamic";

// Default target — Mike Watson is the most-requested demo merchant.
// Every other slug still works by passing `?slug=`.
const DEFAULT_SLUG = "demo-mike-watson-drywall-manchester";

// Minimal profile stubs for demo merchants we auto-seed. Extend by
// adding a case here; unknown demo slugs still seed with generic
// defaults so no button ever 404s.
// Demo merchant stubs. `canteen_slug` + `canteen_name` are the
// canonical demo-canteen this merchant hosts (from the JS fixture data
// in src/lib/canteens.ts). When set, impersonate seeds that specific
// canteen instead of a generic `${slug}-canteen` — so signed-in demo
// merchants land on the RIGHT canteen matching the mock content.
const DEMO_MERCHANT_STUBS: Record<string, {
  display_name: string;
  primary_trade: string;
  city: string;
  whatsapp: string;
  email: string;
  bio: string;
  avatar_url: string;
  canteen_slug?: string;
  canteen_name?: string;
  canteen_trade_slug?: string;
  canteen_trade_label?: string;
}> = {
  "demo-mike-watson-drywall-manchester": {
    display_name: "Mike Watson",
    primary_trade: "kitchen-fitter",
    city: "Manchester",
    whatsapp: "447700900101",
    email: "mike.watson@thenetworkers.demo",
    bio: "Demo kitchen fitter for development.",
    // Same avatar Mike uses on the demo canteen members list.
    avatar_url: "https://images.unsplash.com/photo-1560250097-0b93528c311a?w=200&h=200&fit=crop&crop=faces",
    // Mike hosts UK Kitchen Fitters — the canonical demo canteen with
    // all the mock members, products and posts (see MOCK_CANTEENS
    // cant_kitchen_uk in src/lib/canteens.ts).
    canteen_slug: "uk-kitchen-fitters",
    canteen_name: "UK Kitchen Fitters",
    canteen_trade_slug: "kitchen-fitter",
    canteen_trade_label: "Kitchen Fitter"
  },
  "demo-stuart-kingsley-building-merchant-hull": {
    display_name: "Stuart Kingsley",
    primary_trade: "building-merchant",
    city: "Hull",
    whatsapp: "447700900201",
    email: "stuart.kingsley@thenetworkers.demo",
    bio: "Demo building merchant for development.",
    avatar_url: "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=200&h=200&fit=crop&crop=faces"
  },
  "demo-craig-mcdermott-electrician-leeds": {
    display_name: "Craig McDermott",
    primary_trade: "electrician",
    city: "Leeds",
    whatsapp: "447700900104",
    email: "craig.mcdermott@thenetworkers.demo",
    bio: "Demo electrician for development.",
    avatar_url: "https://images.unsplash.com/photo-1508214751196-bcfd4ca60f91?w=200&h=200&fit=crop&crop=faces",
    // Craig hosts North UK Sparks — canonical demo canteen for
    // electricians (see MOCK_CANTEENS cant_sparks_north).
    canteen_slug: "north-uk-sparks",
    canteen_name: "North UK Sparks",
    canteen_trade_slug: "electrician",
    canteen_trade_label: "Electrician"
  },
  "demo-jason-hardy-scaffolder-glasgow": {
    display_name: "Jason Hardy",
    primary_trade: "scaffolder",
    city: "Glasgow",
    whatsapp: "447700900109",
    email: "jason.hardy@thenetworkers.demo",
    bio: "Demo scaffolder for development.",
    avatar_url: "https://images.unsplash.com/photo-1548544149-4835e62ee5b3?w=200&h=200&fit=crop&crop=faces",
    // Jason hosts UK Scaffolders — canonical demo canteen for
    // scaffolders (see MOCK_CANTEENS cant_scaffolders).
    canteen_slug: "uk-scaffolders",
    canteen_name: "UK Scaffolders",
    canteen_trade_slug: "scaffolder",
    canteen_trade_label: "Scaffolder"
  }
};

function stubForSlug(slug: string) {
  if (DEMO_MERCHANT_STUBS[slug]) {
    // Cross-check: if the fixture data (MOCK_CANTEENS) also says this
    // merchant hosts a specific canteen, and the stub doesn't already
    // record it, patch it in. This is defence-in-depth so a future
    // fixture-defined canteen host isn't accidentally sent to a
    // wrongly-named auto-seed just because I forgot to add the
    // canteen_slug to the stub above.
    const explicit = DEMO_MERCHANT_STUBS[slug];
    if (!explicit.canteen_slug) {
      const fixtureCanteen = MOCK_CANTEENS.find((c) => c.hostSlug === slug);
      if (fixtureCanteen) {
        return {
          ...explicit,
          canteen_slug: fixtureCanteen.slug,
          canteen_name: fixtureCanteen.name,
          canteen_trade_slug: fixtureCanteen.tradeSlug,
          canteen_trade_label: fixtureCanteen.tradeLabel
        };
      }
    }
    return explicit;
  }
  // Not in the explicit stubs — try the fixture cross-check for
  // auto-generated stubs too. If MOCK_CANTEENS has a canteen hosted
  // by this slug, land signed-in demos on THAT canteen instead of a
  // generic `${slug}-canteen`.
  const fixtureCanteen = MOCK_CANTEENS.find((c) => c.hostSlug === slug);
  if (fixtureCanteen) {
    // Build a generic stub but with the correct canonical canteen.
    return {
      ...genericStub(slug),
      canteen_slug: fixtureCanteen.slug,
      canteen_name: fixtureCanteen.name,
      canteen_trade_slug: fixtureCanteen.tradeSlug,
      canteen_trade_label: fixtureCanteen.tradeLabel
    };
  }
  return genericStub(slug);
}

function genericStub(slug: string) {
  // Generic stub — slug like "demo-jane-plumber-leeds" → display "Jane Plumber", trade "plumber", city "Leeds"
  const parts = slug.replace(/^demo-/, "").split("-");
  const displayName = parts.slice(0, 2)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(" ") || "Demo Merchant";
  return {
    display_name: displayName,
    primary_trade: parts[parts.length - 2] ?? "handyman",
    city: (parts[parts.length - 1] ?? "London")
      .replace(/\b\w/g, (c) => c.toUpperCase()),
    whatsapp: "447700900999",
    email: `${slug}@thenetworkers.demo`,
    bio: "Auto-seeded demo merchant for development.",
    avatar_url: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&fit=crop&crop=faces"
  };
}

export async function GET(req: Request) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const url = new URL(req.url);
  const slug = url.searchParams.get("slug") ?? DEFAULT_SLUG;
  const next = url.searchParams.get("next") ?? `/trade-off/yard`;

  let { data } = await supabaseAdmin
    .from("hammerex_trade_off_listings")
    .select("id, slug, display_name, edit_token, status")
    .eq("slug", slug)
    .maybeSingle();

  // Auto-seed demo merchants that don't have a row yet. Any slug is
  // acceptable in dev — we synthesise sensible defaults so the button
  // never dead-ends.
  if (!data?.edit_token) {
    const stub = stubForSlug(slug);
    const insertRes = await supabaseAdmin
      .from("hammerex_trade_off_listings")
      .insert({
        slug,
        display_name: stub.display_name,
        primary_trade: stub.primary_trade,
        city: stub.city,
        whatsapp: stub.whatsapp,
        email: stub.email,
        bio: stub.bio,
        avatar_url: stub.avatar_url,
        status: "live"
      })
      .select("id, slug, display_name, edit_token, status")
      .single();
    if (insertRes.error || !insertRes.data?.edit_token) {
      // Redirect back to the login page with a visible error rather
      // than dumping raw JSON — merchant-login UX shows this cleanly.
      const errUrl = new URL("/trade-off/login", url.origin);
      errUrl.searchParams.set("dev_error", "seed_failed");
      errUrl.searchParams.set("dev_slug", slug);
      return NextResponse.redirect(errUrl);
    }
    data = insertRes.data;
  }

  // Ensure the merchant is live — some legacy rows exist with status
  // "draft" which blocks the merchant edit surface.
  if (data.status !== "live") {
    await supabaseAdmin
      .from("hammerex_trade_off_listings")
      .update({ status: "live" })
      .eq("slug", data.slug);
  }

  // Force-sync avatar_url — profile image is canonical across every
  // surface (Yard post cards, canteen page, mobile app view, header
  // drawer, burger drop-down). We always overwrite both tables with
  // the stub's canonical URL, not just backfill nulls. Reason: earlier
  // impersonate calls may have created rows with wrong/stale URLs; a
  // stale non-null value is worse than no value because backfill-if-
  // null skips it. Overwriting on every impersonate guarantees demo
  // merchants ALWAYS have the correct portrait everywhere.
  //
  // Trade-off: this overwrites any manual avatar edit the merchant
  // made through the profile editor. Acceptable in dev mode — real
  // merchants aren't impersonated.
  let backfilledAvatar = false;
  {
    const stub = stubForSlug(data.slug);
    if (stub.avatar_url) {
      // Table 1 — listings. Force-write the canonical URL.
      const { data: currentListing } = await supabaseAdmin
        .from("hammerex_trade_off_listings")
        .select("avatar_url")
        .eq("id", data.id)
        .maybeSingle();
      if (currentListing && currentListing.avatar_url !== stub.avatar_url) {
        await supabaseAdmin
          .from("hammerex_trade_off_listings")
          .update({ avatar_url: stub.avatar_url })
          .eq("id", data.id);
        backfilledAvatar = true;
      }
      // Table 2 — canteen_members. Same force-sync so the two tables
      // are always identical. Idempotent when already correct.
      const { data: memberRows } = await supabaseAdmin
        .from("hammerex_canteen_members")
        .select("id, avatar_url")
        .eq("member_slug", data.slug);
      for (const row of memberRows ?? []) {
        if (row.avatar_url !== stub.avatar_url) {
          await supabaseAdmin
            .from("hammerex_canteen_members")
            .update({ avatar_url: stub.avatar_url })
            .eq("id", row.id);
          backfilledAvatar = true;
        }
      }
    }
  }
  // Bust the Yard's 60s revalidation cache so freshly-backfilled
  // avatar_url shows on Mike's post cards immediately after Dev · Pass
  // sign-in (otherwise cards render the last-cached poster row for up
  // to 60s and the merchant sees a broken/placeholder avatar).
  if (backfilledAvatar) {
    try { revalidatePath("/trade-off/yard"); } catch { /* best-effort */ }
  }

  // Ensure the merchant's canonical canteen exists in the DB. For
  // known demo merchants (Mike → UK Kitchen Fitters etc.), we use the
  // fixture-defined slug so the redirect lands on the right canteen
  // matching the mock members / products / posts.
  //
  // For unknown demo merchants, fall back to `${slug}-canteen`.
  //
  // Bonus: if we recognise the merchant AND find a wrongly-named
  // auto-seed from a previous impersonate call (e.g. `demo-mike-...-canteen`
  // when the correct slug is `uk-kitchen-fitters`), delete the wrong
  // row so the redirect doesn't pick it up.
  {
    const stub = stubForSlug(data.slug);
    // Is this merchant a canonical fixture host? (Mike → UK Kitchen
    // Fitters, Craig → North UK Sparks, Jason → UK Scaffolders).
    const isFixtureHost = MOCK_CANTEENS.some((c) => c.hostSlug === data.slug);

    if (isFixtureHost) {
      // Fixture-defined canteens carry a full mock content payload —
      // members, products, posts, designs — but only under their
      // fixture id (e.g. "cant_kitchen_uk"). If we INSERT a DB row
      // for `uk-kitchen-fitters`, the canteen page reads that DB
      // row (with a UUID id), then looks up members/products/etc.
      // by UUID and finds nothing → empty canteen.
      //
      // Fix: for fixture hosts, DELETE any DB row for their canonical
      // slug so canteenBySlugFromDb falls back to canteenBySlugMock
      // and the whole fixture render lights up correctly.
      //
      // Also delete any wrongly-named auto-seed rows the earlier
      // impersonate versions left behind.
      await supabaseAdmin
        .from("hammerex_canteens")
        .delete()
        .eq("host_slug", data.slug);
    } else {
      // Non-fixture merchant. Auto-seed a canteen so the products
      // editor works end-to-end. Idempotent.
      const canonicalSlug = stub.canteen_slug ?? `${data.slug}-canteen`;
      const canonicalName = stub.canteen_name ?? `${stub.display_name}'s Canteen`;
      const canonicalTradeSlug = stub.canteen_trade_slug ?? stub.primary_trade;
      const canonicalTradeLabel = stub.canteen_trade_label
        ?? stub.primary_trade.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

      const { data: existingCanonical } = await supabaseAdmin
        .from("hammerex_canteens")
        .select("id")
        .eq("slug", canonicalSlug)
        .maybeSingle();
      if (!existingCanonical) {
        await supabaseAdmin
          .from("hammerex_canteens")
          .insert({
            slug: canonicalSlug,
            name: canonicalName,
            trade_slug: canonicalTradeSlug,
            trade_label: canonicalTradeLabel,
            host_slug: data.slug,
            host_display_name: stub.display_name
          });
      }
      if (stub.canteen_slug) {
        await supabaseAdmin
          .from("hammerex_canteens")
          .delete()
          .eq("host_slug", data.slug)
          .neq("slug", stub.canteen_slug);
      }
    }
  }

  // Set BOTH cookies:
  //   - Studio session (edit_token, used by /studio/* + some editor
  //     server helpers)
  //   - Trade session (HMAC-signed listing_id/slug, read by
  //     /api/trade-off/session which powers the header + BurgerMenu
  //     signed-in state)
  // Without the second cookie the header keeps rendering "Log in"
  // even though the merchant is signed in via impersonate.
  await setStudioSession(data.edit_token);

  const nextUrl = new URL(next, url.origin);
  if (!nextUrl.searchParams.get("token")) {
    nextUrl.searchParams.set("token", data.edit_token);
  }
  const response = NextResponse.redirect(nextUrl);
  setTradeSessionCookie(response, data.id, data.slug);
  return response;
}
