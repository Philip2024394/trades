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
import { PALETTES, type PaletteSlug } from "@/lib/paletteTokens";
import { CanteenPageShell } from "./CanteenPageShell";
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
  searchParams: Promise<{ focus?: string; from?: string; preview_palette?: string; override_accent?: string; hero_shade?: string }>;
}) {
  const { slug } = await params;
  const { focus, from, preview_palette, override_accent, hero_shade } = await searchParams;
  const canteen = await canteenBySlugFromDb(slug);
  if (!canteen) notFound();
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

  // Palette resolution order (first wins):
  //   1. `?preview_palette=` query override — powers the templates
  //      picker "Live" button; lets a merchant preview any palette on
  //      any canteen without persisting.
  //   2. Canteen's native `paletteSlug` — set on demo canteens so a
  //      direct visit to /uk-master-carpenters renders in Oak, not
  //      Chalk. Real merchant canteens leave this undefined.
  //   3. `merchantPalette` — the merchant's persisted choice from
  //      their hammerex_trade_off_listings row.
  //   4. Chalk default (handled inside loadMerchantPalette).
  const canteenNativePalette =
    canteen.paletteSlug && canteen.paletteSlug in PALETTES
      ? PALETTES[canteen.paletteSlug as PaletteSlug]
      : null;
  const basePalette =
    preview_palette && preview_palette in PALETTES
      ? PALETTES[preview_palette as PaletteSlug]
      : (canteenNativePalette ?? merchantPalette);

  // [DEV BUTTON] override_accent + hero_shade — dev-only palette
  // tuner. Strip this whole branch when the palette tuning phase
  // completes ("remove dev buttons" command).
  const HEX_RE = /^#[0-9A-Fa-f]{6}$/;
  const patchedAccent = override_accent && HEX_RE.test(override_accent)
    ? { accent: override_accent, heroLastWord: override_accent, chip: override_accent }
    : {};
  const palette = { ...basePalette, ...patchedAccent };
  // hero_shade 0-100 → veil opacity multiplier (0-1). 100 = current
  // veil overlay fully applied (default), 0 = veil transparent so the
  // hero photo is 100% clear (no cream overlay). Passed down to
  // CanteenHeroWow to modulate the two cream-veil gradient alphas.
  const shadeNum = hero_shade ? Number(hero_shade) : NaN;
  const heroVeilOpacity =
    Number.isFinite(shadeNum) && shadeNum >= 0 && shadeNum <= 100
      ? shadeNum / 100
      : 1;
  // [/DEV BUTTON]

  // Validate `?focus=` — only pass through if the product actually
  // belongs to this canteen (prevents mis-embedded links from cross-
  // rendering a product in the wrong host's rail).
  const focusProduct = focus ? canteenProductById(focus) : null;
  const initialFocusProductId = focusProduct && focusProduct.canteenId === canteen.id ? focus : undefined;

  // Map `?from=` slug to a back-pill config via RETURN_ORIGINS.
  const returnOrigin = from && (from in RETURN_ORIGINS)
    ? RETURN_ORIGINS[from as ReturnOriginSlug]
    : null;

  return (
    <CanteenPageShell
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
    />
  );
}
