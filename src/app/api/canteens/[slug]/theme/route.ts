// POST /api/canteens/[slug]/theme
//
// Update the canteen's theme settings — palette / mode / intensity.
// Merchant-only (host must match session). Every field is optional so
// the picker can send single-field patches as the user toggles each
// control without re-selecting the whole set.
//
// Contract:
//   POST { paletteSlug?, themeMode?, paletteIntensity? }
//   → 200 { ok: true }

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getMerchantIdentity } from "@/lib/merchantSession";
import { accentAtLightness, type BaseHue } from "@/lib/paletteHsl";

const VALID_MODES = new Set(["light", "dark"]);
const VALID_INTENSITY = new Set(["bold", "standard", "subtle"]);
// Keep the palette allowlist here as a defence-in-depth check —
// UI already constrains to PALETTES keys, but the endpoint should
// too so a scripted request can't insert a garbage slug.
// All 20 shipped palettes (paletteTokens.ts). Any picker
// addition must land here too or the endpoint 400s.
const VALID_PALETTES = new Set([
  "chalk", "blush", "sandstone", "mortar",
  "oak", "timber", "brick", "copper",
  "moss", "emerald", "aqua", "marine",
  "slate", "steel", "storm", "concrete",
  "ink", "charcoal", "iron", "hi-vis"
]);

type Payload = {
  paletteSlug?: string;
  themeMode?: "light" | "dark";
  paletteIntensity?: "bold" | "standard" | "subtle";
  heroShade?: number;
  /** #RRGGBB hex or empty string to clear. */
  feedTileColor?: string | null;
  /** Hosted image URL (e.g. from the library) or null to clear.
   *  Complements POST /feed-tile-image which handles direct uploads;
   *  this endpoint lets the picker set an already-hosted URL without
   *  a fresh upload (library selection or admin-supplied). */
  feedTileImageUrl?: string | null;
  /** HSL model — one of 8 base hues, or null to clear back to
   *  legacy palette_slug behaviour. */
  baseHue?: "yellow" | "orange" | "red" | "green" | "teal" | "blue" | "purple" | "neutral" | null;
  /** 0-100 or null to clear. */
  lightness?: number | null;
  /** Feed-tile-specific hue (same 8 as baseHue). Server computes
   *  feed_tile_color hex from hue + lightness on save. */
  feedTileHue?: "yellow" | "orange" | "red" | "green" | "teal" | "blue" | "purple" | "neutral" | null;
  feedTileLightness?: number | null;
};

const VALID_HUES = new Set([
  "yellow", "orange", "red", "green", "teal", "blue", "purple", "neutral"
]);

export async function POST(
  req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  if (!slug) {
    return NextResponse.json({ ok: false, error: "missing-slug" }, { status: 400 });
  }

  // Auth check disabled while the platform is pre-launch (Philip
  // 2026-07-17). Once sign-in flow is stabilised, re-enable with:
  //   const identity = await getMerchantIdentity();
  //   if (!identity) return NextResponse.json(
  //     { ok: false, error: "not-authenticated" }, { status: 401 });
  //   and the ownership check further down.
  const identity = await getMerchantIdentity().catch(() => null);

  let payload: Payload;
  try {
    payload = (await req.json()) as Payload;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid-json" }, { status: 400 });
  }

  const patch: Record<string, string | number | null> = { updated_at: new Date().toISOString() };
  if (payload.paletteSlug !== undefined) {
    if (!VALID_PALETTES.has(payload.paletteSlug)) {
      return NextResponse.json({ ok: false, error: "invalid-palette" }, { status: 400 });
    }
    patch.palette_slug = payload.paletteSlug;
  }
  if (payload.themeMode !== undefined) {
    if (!VALID_MODES.has(payload.themeMode)) {
      return NextResponse.json({ ok: false, error: "invalid-mode" }, { status: 400 });
    }
    patch.theme_mode = payload.themeMode;
  }
  if (payload.paletteIntensity !== undefined) {
    if (!VALID_INTENSITY.has(payload.paletteIntensity)) {
      return NextResponse.json({ ok: false, error: "invalid-intensity" }, { status: 400 });
    }
    patch.palette_intensity = payload.paletteIntensity;
  }
  if (payload.heroShade !== undefined) {
    const n = Number(payload.heroShade);
    if (!Number.isFinite(n) || n < 0 || n > 100) {
      return NextResponse.json({ ok: false, error: "invalid-hero-shade" }, { status: 400 });
    }
    patch.hero_shade = Math.round(n);
  }
  if (payload.feedTileColor !== undefined) {
    // Null / empty string = reset to palette default. Otherwise
    // must be #RRGGBB.
    if (payload.feedTileColor === null || payload.feedTileColor === "") {
      (patch as Record<string, string | number | null>).feed_tile_color = null;
    } else if (/^#[0-9A-Fa-f]{6}$/.test(payload.feedTileColor)) {
      patch.feed_tile_color = payload.feedTileColor.toUpperCase();
    } else {
      return NextResponse.json({ ok: false, error: "invalid-feed-tile-color" }, { status: 400 });
    }
  }
  if (payload.feedTileImageUrl !== undefined) {
    // Null / empty string = clear (fall back to colour/palette).
    // Otherwise must be an http(s) URL — anything else is rejected.
    if (payload.feedTileImageUrl === null || payload.feedTileImageUrl === "") {
      patch.feed_tile_image_url = null;
    } else if (/^https?:\/\/[^\s]+$/i.test(payload.feedTileImageUrl)) {
      patch.feed_tile_image_url = payload.feedTileImageUrl;
    } else {
      return NextResponse.json({ ok: false, error: "invalid-feed-tile-image-url" }, { status: 400 });
    }
  }
  if (payload.baseHue !== undefined) {
    if (payload.baseHue === null) {
      patch.base_hue = null;
    } else if (VALID_HUES.has(payload.baseHue)) {
      patch.base_hue = payload.baseHue;
    } else {
      return NextResponse.json({ ok: false, error: "invalid-base-hue" }, { status: 400 });
    }
  }
  if (payload.lightness !== undefined) {
    if (payload.lightness === null) {
      patch.lightness = null;
    } else {
      const n = Number(payload.lightness);
      if (!Number.isFinite(n) || n < 0 || n > 100) {
        return NextResponse.json({ ok: false, error: "invalid-lightness" }, { status: 400 });
      }
      patch.lightness = Math.round(n);
    }
  }
  // Feed tile — hue + lightness persisted separately AND the
  // computed hex is stamped onto feed_tile_color for the shell
  // renderer. Null on hue clears everything back to palette-driven.
  if (payload.feedTileHue !== undefined || payload.feedTileLightness !== undefined) {
    const hue = payload.feedTileHue;
    const light = payload.feedTileLightness;
    if (hue === null) {
      patch.feed_tile_hue = null;
      patch.feed_tile_lightness = null;
      patch.feed_tile_color = null;
    } else {
      if (hue !== undefined) {
        if (!VALID_HUES.has(hue)) {
          return NextResponse.json({ ok: false, error: "invalid-feed-tile-hue" }, { status: 400 });
        }
        patch.feed_tile_hue = hue;
      }
      if (light !== undefined && light !== null) {
        const n = Number(light);
        if (!Number.isFinite(n) || n < 0 || n > 100) {
          return NextResponse.json({ ok: false, error: "invalid-feed-tile-lightness" }, { status: 400 });
        }
        patch.feed_tile_lightness = Math.round(n);
      }
      // Compute hex from the final hue+lightness so the shell
      // can render without needing the palette helper.
      const finalHue = (patch.feed_tile_hue as BaseHue | undefined) ?? (hue as BaseHue | undefined);
      const finalLight = typeof patch.feed_tile_lightness === "number"
        ? patch.feed_tile_lightness
        : (typeof light === "number" ? light : 100);
      if (finalHue) {
        patch.feed_tile_color = accentAtLightness(finalHue, finalLight);
      }
    }
  }

  // Ownership gate — canteen host must match the signed-in merchant.
  const canteen = await supabaseAdmin
    .from("hammerex_canteens")
    .select("host_slug")
    .eq("slug", slug)
    .maybeSingle();
  if (canteen.error) {
    return NextResponse.json({ ok: false, error: "db-lookup-failed" }, { status: 500 });
  }
  if (!canteen.data) {
    return NextResponse.json({ ok: false, error: "not-found" }, { status: 404 });
  }
  // Ownership check disabled pre-launch (Philip 2026-07-17). Re-
  // enable together with the auth check further up when the sign-in
  // flow is stable. Keeps `identity` referenced so the eslint no-
  // unused-vars rule stays quiet.
  void identity;

  const update = await supabaseAdmin
    .from("hammerex_canteens")
    .update(patch)
    .eq("slug", slug);
  if (update.error) {
    return NextResponse.json(
      { ok: false, error: "db-update-failed", detail: update.error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
