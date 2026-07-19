// /trade-off/yard/canteens/[slug] — Canteen detail page.
// Two-column on desktop: main feed on the left, The Counter on the right.
// Mobile: header → side-lane horizontal strip → main feed stack.

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { canteenProductById, RETURN_ORIGINS } from "@/lib/canteens";
import type { ReturnOriginSlug } from "@/lib/canteens";
// Real DB reads with mock fallback — see src/lib/canteens.server.ts.
import {
  canteenBySlugFromDb,
  membersForCanteenFromDb,
  adminForCanteenFromDb,
  productsForCanteenFromDb,
  designsForCanteenFromDb,
  platformSideLaneFromDb,
  canteenPostsFromDb
} from "@/lib/canteens.server";
import { loadMerchantPalette } from "@/lib/paletteTokens.server";
import { PALETTES, DEFAULT_PALETTE, applyIntensity, type PaletteSlug } from "@/lib/paletteTokens";
import { generatePalette, BASE_HUES, type BaseHue } from "@/lib/paletteHsl";
import { resolveTemplate } from "@/templates/_registry";
import { CanteenInviteOverlay } from "@/components/homeowners/CanteenInviteOverlay";
import { HomeBackPill } from "@/components/HomeBackPill";
import { getHomeownerFromCookie } from "@/lib/homeowners/auth";
import { resolveHomeBackContext } from "@/lib/homeBackContext";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { BRAND, absolute } from "@/lib/seo";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const canteen = await canteenBySlugFromDb(slug);
  if (!canteen) return { title: "Canteen not found — Thenetworkers" };
  const title = `${canteen.name} — Canteen | Thenetworkers`;
  return {
    title,
    description: canteen.tagline,
    alternates: { canonical: `/trade-off/yard/canteens/${slug}` },
    openGraph: {
      type: "website",
      siteName: BRAND.name,
      title,
      description: canteen.tagline,
      url: absolute(`/trade-off/yard/canteens/${slug}`)
    }
  };
}

export default async function CanteenDetailPage({
  params,
  searchParams
}: {
  params: Promise<{ slug: string }>;
  /** Query params:
   *   - `focus={productId}` opens the canteen in product-focus mode
   *     on first paint (SSR — no client-side flicker).
   *   - `from={slug}` sets the "Back to X" sticky pill in
   *     product-focus so buyers return to whichever surface routed
   *     them here (Trade Center, Yard, Warehouse, etc.). */
  searchParams: Promise<{ focus?: string; from?: string; preview_palette?: string; override_accent?: string; hero_shade?: string; theme_mode?: string; embed?: string; previewInvite?: string }>;
}) {
  const { slug } = await params;
  const { focus, from, preview_palette, override_accent, hero_shade, theme_mode, embed, previewInvite } = await searchParams;
  const canteen = await canteenBySlugFromDb(slug);
  if (!canteen) notFound();

  // ─── Invite-mode detection (mirrors /trade-off/yard/canteens) ───
  // Homeowner cookie OR ?previewInvite=1 activates the floating
  // "Invite to project" overlay. Anonymous browsers + merchants see
  // no overlay so the canteen page is unchanged for them.
  const homeownerForInvite = await getHomeownerFromCookie();
  const inviteActive = !!homeownerForInvite || previewInvite === "1";
  let inviteProjects: Array<{ id: string; title: string; city: string | null; budgetMin: number | null; budgetMax: number | null }> = [];
  if (inviteActive) {
    if (homeownerForInvite) {
      const pr = await supabaseAdmin
        .from("hammerex_sitebook_projects")
        .select("id, title, address_city, budget_min_gbp, budget_max_gbp, status")
        .eq("homeowner_id", homeownerForInvite.id)
        .in("status", ["active", "in-progress"])
        .order("created_at", { ascending: false });
      type Row = { id: string; title: string; address_city: string | null; budget_min_gbp: number | null; budget_max_gbp: number | null };
      inviteProjects = ((pr.data as Row[]) ?? []).map((r) => ({
        id: r.id, title: r.title, city: r.address_city,
        budgetMin: r.budget_min_gbp, budgetMax: r.budget_max_gbp
      }));
    } else {
      // Preview fixture — matches the /sitebook-showcase mock owner
      // so designers see realistic projects in the invite modal.
      inviteProjects = [
        { id: "prev-ensuite",  title: "En-suite plumbing",  city: "Manchester", budgetMin: 3500,  budgetMax: 5500 },
        { id: "prev-kitchen",  title: "Kitchen refit",      city: "Manchester", budgetMin: 25000, budgetMax: 45000 },
        { id: "prev-boiler",   title: "Boiler service",     city: "Manchester", budgetMin: 120,   budgetMax: 180 },
        { id: "prev-lock",     title: "Front door lock",    city: "Manchester", budgetMin: 60,    budgetMax: 120 }
      ];
    }
  }
  const homeownerFirstNameForInvite = homeownerForInvite?.first_name ?? (previewInvite === "1" ? "Sarah" : null);

  // ─── Route split ──────────────────────────────────────
  //
  // Two surfaces, one URL:
  //   • `?embed=1`  → mobile-app preview iframe on the templates
  //                   picker. Keeps the full palette pipeline
  //                   (base_hue, lightness, theme_mode, hero_shade,
  //                   feed_tile_*). These editing tools live here
  //                   and here only (Philip 2026-07-17).
  //   • default     → public canteen page. IGNORES every style
  //                   column and renders with hardcoded platform
  //                   defaults. The templates picker CANNOT change
  //                   canteen UI. Ever.
  //
  // Data (name, tagline, posts, products, members, reviews, host
  // WhatsApp) flows into BOTH surfaces identically — only the
  // styling side is decoupled.
  const isEmbedded = embed === "1";
  // Platform-wide feed + members + admin + products — 5 concurrent
  // reads. Mock fallback per source when the tables are empty.
  const [sideLane, members, admin, featuredProducts, allProducts, chatPosts, designs, merchantPalette] = await Promise.all([
    platformSideLaneFromDb(canteen.tradeSlug),
    membersForCanteenFromDb(canteen.id),
    adminForCanteenFromDb(canteen.id),
    productsForCanteenFromDb(canteen.id, { featuredOnly: true }),
    productsForCanteenFromDb(canteen.id),
    canteenPostsFromDb(canteen.id),
    designsForCanteenFromDb(canteen.id),
    loadMerchantPalette(canteen.hostSlug)
  ]);
  const totalProducts = allProducts.length;

  // ─── Palette resolution — EMBED PATH ONLY ─────────────
  //
  // The canteen page renders with hardcoded platform defaults and
  // never touches these values. Everything below runs solely so the
  // mobile-app iframe (?embed=1) can render the merchant's chosen
  // palette / hero shade / dark mode. Split enforced 2026-07-17
  // (Philip: "template app 100% separated from canteen ui").
  let palette;
  let heroVeilOpacity: number;
  let darkMode: boolean;
  if (isEmbedded) {
    const isKnownHue = (h: unknown): h is BaseHue =>
      typeof h === "string" && (BASE_HUES as readonly string[]).includes(h);
    const hslPalette = isKnownHue(canteen.baseHue)
      ? generatePalette({
          hue:       canteen.baseHue,
          lightness: typeof canteen.lightness === "number" ? canteen.lightness : 50,
          intensity: canteen.paletteIntensity,
          mode:      canteen.themeMode
        })
      : null;
    const canteenNativePalette =
      canteen.paletteSlug && canteen.paletteSlug in PALETTES
        ? PALETTES[canteen.paletteSlug as PaletteSlug]
        : null;
    const basePalette =
      preview_palette && preview_palette in PALETTES
        ? PALETTES[preview_palette as PaletteSlug]
        : (hslPalette ?? canteenNativePalette ?? merchantPalette);
    const HEX_RE = /^#[0-9A-Fa-f]{6}$/;
    const patchedAccent = override_accent && HEX_RE.test(override_accent)
      ? { accent: override_accent, heroLastWord: override_accent, chip: override_accent }
      : {};
    palette = { ...applyIntensity(basePalette, canteen.paletteIntensity), ...patchedAccent };
    const urlShade = hero_shade ? Number(hero_shade) : NaN;
    const dbShade  = typeof canteen.heroShade === "number" ? canteen.heroShade : 100;
    const resolvedShade = Number.isFinite(urlShade) && urlShade >= 0 && urlShade <= 100
      ? urlShade
      : dbShade;
    heroVeilOpacity = resolvedShade / 100;
    darkMode = theme_mode === "dark" || (!theme_mode && canteen.themeMode === "dark");
  } else {
    // CANTEEN PAGE — locked to platform defaults regardless of what
    // the merchant has saved. Any style column in hammerex_canteens
    // is intentionally IGNORED on this path.
    palette = DEFAULT_PALETTE;
    heroVeilOpacity = 1;
    darkMode = false;
  }
  // Silence unused-var lints for values only consumed in the embed
  // branch above. Kept in the destructure so their existence is
  // visible in one place.
  void merchantPalette;

  // Validate `?focus=` — only pass through if the product actually
  // belongs to this canteen (prevents mis-embedded links from cross-
  // rendering a product in the wrong host's rail).
  const focusProduct = focus ? canteenProductById(focus) : null;
  const initialFocusProductId = focusProduct && focusProduct.canteenId === canteen.id ? focus : undefined;

  // Map `?from=` slug to a back-pill config via RETURN_ORIGINS.
  const returnOrigin = from && (from in RETURN_ORIGINS)
    ? RETURN_ORIGINS[from as ReturnOriginSlug]
    : null;

  // Resolve the template component from the registry. Every canteen
  // renders through a Template file (src/templates/<slug>/). Falls
  // back to Template 1 (Chalk) when template_slug is missing/unknown.
  // Templates are FIXED UI — merchants edit their canteen data here
  // and it flows into whatever template they've picked. Swapping
  // templates = one column change, zero data touched.
  const Template = resolveTemplate(canteen.templateSlug).Component;

  // Home-back pill — hidden when embedded (mobile-app preview) or
  // when the viewer IS on their own canteen (resolveHomeBackContext
  // handles that check via the current path). In preview-invite mode
  // (no real cookie) the pill routes back to the /sitebook-showcase
  // mock so designers can round-trip cleanly.
  let backCtx = isEmbedded ? null : await resolveHomeBackContext(`/trade-off/yard/canteens/${slug}`);
  if (!backCtx && previewInvite === "1" && !isEmbedded) {
    backCtx = {
      label: "Back to my SiteBook",
      href:  "/sitebook-showcase/the-old-rectory",
      kind:  "homeowner"
    };
  }

  return (
    <>
      {backCtx && <HomeBackPill ctx={backCtx}/>}
      <Template
        canteen={canteen}
        sideLane={sideLane}
        members={members}
        admin={admin}
        featuredProducts={featuredProducts}
        totalProducts={totalProducts}
        initialChatPosts={chatPosts}
        designs={designs}
        initialFocusProductId={initialFocusProductId}
        returnHref={returnOrigin?.href}
        returnLabel={returnOrigin?.label}
        palette={palette}
        heroVeilOpacity={heroVeilOpacity}
        darkMode={darkMode}
      />
      {/* Floating invite overlay — floats above the template, only
          renders in invite mode. Handles its own modal state so we
          don't need context plumbing per canteen page. */}
      {inviteActive && !isEmbedded && (
        <CanteenInviteOverlay
          tradeName={canteen.name}
          tradeSlug={canteen.hostSlug}
          projects={inviteProjects}
          homeownerFirstName={homeownerFirstNameForInvite}
        />
      )}
    </>
  );
}
