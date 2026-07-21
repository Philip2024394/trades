// /tc/trade-center — Trade Center landing.
//
// Data source order:
//   1. Real DB via browseAllProductsFromDb() — every canteen product
//      with show_in_trade_center=true, live across the whole platform.
//   2. Fallback to PRODUCT_FIXTURES when the DB is empty (cold-start
//      phase — the page still shows a filled marketplace so the tab
//      never looks abandoned).
//
// When `?q=` is present the page becomes a search view. DB path uses
// the browse function's ilike; fixture fallback uses the local matcher.
//
// No hero, no marketing banner — density is the value prop per the
// Trade Center design constitution.

import { bootstrapPlatform } from "@/platform/bootstrap";
import { TradeCenterHeader } from "@/apps/tradecenter/components/TradeCenterHeader";
import { CategoryRail } from "@/apps/tradecenter/components/CategoryRail";
import { CategoryPageBody } from "@/apps/tradecenter/components/CategoryPageBody";
import { BlockedFeatureToast } from "@/apps/tradecenter/components/BlockedFeatureToast";
import { DiyWelcomeBanner } from "@/apps/tradecenter/components/DiyWelcomeBanner";
import { FreshSignupWelcome } from "@/apps/tradecenter/components/FreshSignupWelcome";
import { TradeCenterViewTabs } from "@/apps/tradecenter/components/TradeCenterViewTabs";
import { ViewScopeBadge } from "@/apps/hub/components/ViewScopeBadge";
import { PRODUCT_FIXTURES, searchProductsFixture } from "@/apps/tradecenter/data/products";
import { browseAllProductsFromDb, platformSideLaneFromDb } from "@/lib/canteens.server";
import type { BrowseProductRow } from "@/lib/canteens";
import type { TradeCenterProduct, ProductCategorySlug } from "@/apps/tradecenter/types";
import { CounterStreamShell } from "@/app/counter/CounterStreamShell";

bootstrapPlatform();

export const dynamic = "force-dynamic";

// Map DB-side category slugs (open-ended taxonomy from category_slug)
// onto the four buckets the fixture cards understand. Anything unknown
// falls back to "site-materials" — the widest generic bucket.
const ALLOWED_CATEGORIES: readonly ProductCategorySlug[] = [
  "hand-tools",
  "power-tools",
  "site-materials",
  "safety-ppe"
];
function coerceCategory(slug: string | undefined): ProductCategorySlug {
  if (slug && (ALLOWED_CATEGORIES as readonly string[]).includes(slug)) {
    return slug as ProductCategorySlug;
  }
  return "site-materials";
}

function slugifyId(id: string, name: string): string {
  const base = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return base ? `${base}-${id.slice(0, 6)}` : id;
}

function adaptDbRow(row: BrowseProductRow): TradeCenterProduct {
  return {
    id: row.product.id,
    slug: slugifyId(row.product.id, row.product.name),
    name: row.product.name,
    spec: row.product.blurb || "",
    category: coerceCategory(row.product.categorySlug),
    subCategory: row.product.categorySlug || "general",
    merchantSlug: row.hostSlug,
    priceGbp: row.product.priceGbp,
    currency: "GBP",
    imageUrl: row.product.imageUrl || undefined,
    stockState: "in",
    deliveryPromise: "Contact merchant",
    collectAvailable: true,
    starRating: row.hostRating?.avg ?? 4.8,
    reviewCount: row.hostRating?.count ?? 0,
    badges: row.isBoosted ? ["new"] : undefined
  };
}

export default async function TradeCenterLanding({
  searchParams
}: {
  searchParams: Promise<{ q?: string; view?: string }>;
}) {
  const { q, view } = await searchParams;
  const searching = typeof q === "string" && q.trim().length > 0;
  const isLiveView = view === "live";

  // Live view — merged Counter feed. Shares the Trade Center chrome
  // (top nav via layout + TradeCenterHeader + view-tabs) so users get
  // one marketplace surface with two lenses (Catalogue vs Live). This
  // is the Facebook Marketplace / eBay / StockX standard — one nav
  // slot for browse, tabs inside for different content shapes.
  if (isLiveView) {
    const posts = await platformSideLaneFromDb();
    return (
      <div className="flex min-h-screen flex-col bg-[#FBF6EC]">
        <TradeCenterHeader activeCategorySlug={null}/>
        <TradeCenterViewTabs/>
        <CounterStreamShell posts={posts}/>
        <ViewScopeBadge scope="customer"/>
      </div>
    );
  }

  // Try DB first. On empty result set, fall through to fixtures so the
  // page always renders a populated grid during cold-start.
  let products: TradeCenterProduct[] = [];
  try {
    const dbRows = await browseAllProductsFromDb({
      q: searching ? q!.trim() : undefined,
      sort: "boosted"
    });
    products = dbRows.map(adaptDbRow);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[trade-center] DB fetch failed, using fixtures", err);
  }
  if (products.length === 0) {
    products = searching ? searchProductsFixture(q!.trim()) : PRODUCT_FIXTURES;
  }

  const categoryLabel = searching ? `Results for "${q!.trim()}"` : "All Products";

  return (
    <div className="flex min-h-screen flex-col bg-[#FBF6EC]">
      <TradeCenterHeader activeCategorySlug={null}/>
      <TradeCenterViewTabs/>
      <BlockedFeatureToast/>
      <DiyWelcomeBanner/>
      <FreshSignupWelcome/>
      <div className="flex w-full flex-1">
        <CategoryRail activeSlug={null}/>
        <CategoryPageBody
          categorySlug={null}
          categoryLabel={categoryLabel}
          products={products}
          subCategories={[]}
        />
      </div>
      <ViewScopeBadge scope="customer"/>
    </div>
  );
}
