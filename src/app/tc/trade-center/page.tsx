// /tc/trade-center — Trade Center landing.
//
// Lands on "All Products" by default so the viewer sees the full
// catalogue and picks the category that fits their job. Individual
// category slugs still resolve via `/tc/trade-center/[category]/`.
//
// When `?q=` is present the page becomes a search-results view over the
// same product fixtures (name/spec/subCategory/category substring match).
// The page title + count update accordingly; sub-category chips are
// suppressed because the results span every category.
//
// No hero, no marketing banner — density is the value prop per the
// Trade Center design constitution.

import { bootstrapPlatform } from "@/platform/bootstrap";
import { MarketplaceHeader } from "@/apps/marketplace/components/MarketplaceHeader";
import { CategoryRail } from "@/apps/marketplace/components/CategoryRail";
import { CategoryPageBody } from "@/apps/marketplace/components/CategoryPageBody";
import { BlockedFeatureToast } from "@/apps/marketplace/components/BlockedFeatureToast";
import { DiyWelcomeBanner } from "@/apps/marketplace/components/DiyWelcomeBanner";
import { FreshSignupWelcome } from "@/apps/marketplace/components/FreshSignupWelcome";
import { ViewScopeBadge } from "@/apps/hub/components/ViewScopeBadge";
import { PRODUCT_FIXTURES, searchProductsFixture } from "@/apps/marketplace/data/products";

bootstrapPlatform();

export const dynamic = "force-dynamic";

export default async function TradeCenterLanding({
  searchParams
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const searching = typeof q === "string" && q.trim().length > 0;
  const products = searching ? searchProductsFixture(q.trim()) : PRODUCT_FIXTURES;
  const categoryLabel = searching ? `Results for "${q.trim()}"` : "All Products";

  return (
    <div className="flex min-h-screen flex-col bg-[#FBF6EC]">
      <MarketplaceHeader activeCategorySlug={null}/>
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
