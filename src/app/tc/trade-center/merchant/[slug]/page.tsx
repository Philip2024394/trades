// /tc/trade-center/merchant/[slug] — Merchant storefront page.
//
// Composition (matches the merchant mock):
//   TradeCenterHeader
//     Left: CategoryRail (same 17 categories, matches marketplace)
//     Right of rail:
//       MerchantHero
//       MerchantTabs
//       Main content:
//         Left column: MerchantProductGrid (SAME as marketplace grid)
//         Right column: MerchantSidebar (About / Shop Info / CTA)
//       MerchantTrustBand
//
// Product grid primitive is unchanged from marketplace per Philip's
// directive.

import { notFound } from "next/navigation";
import { bootstrapPlatform } from "@/platform/bootstrap";
import { TradeCenterHeader } from "@/apps/tradecenter/components/TradeCenterHeader";
import { CategoryRail } from "@/apps/tradecenter/components/CategoryRail";
import { MerchantHero } from "@/apps/tradecenter/components/MerchantHero";
import { MerchantTabs } from "@/apps/tradecenter/components/MerchantTabs";
import { MerchantProductGrid } from "@/apps/tradecenter/components/MerchantProductGrid";
import { MerchantSidebar } from "@/apps/tradecenter/components/MerchantSidebar";
import { MerchantTrustBand } from "@/apps/tradecenter/components/MerchantTrustBand";
import { findMerchant } from "@/apps/tradecenter/data/merchants";
import { PRODUCT_FIXTURES } from "@/apps/tradecenter/data/products";

bootstrapPlatform();

export const dynamic = "force-dynamic";

export default async function MerchantStorefrontPage({
  params
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const merchant = findMerchant(slug);
  if (!merchant) notFound();
  const products = PRODUCT_FIXTURES.filter((p) => p.merchantSlug === merchant.slug);

  return (
    <div className="flex min-h-screen flex-col bg-[#FBF6EC]">
      <TradeCenterHeader/>
      <div className="flex w-full flex-1">
        {/* Left category rail — no active category selected on merchant
            pages (the rail's active state is a marketplace concept). */}
        <CategoryRail activeSlug={null}/>

        {/* Main content column */}
        <div className="min-w-0 flex-1 px-4 py-4 md:px-6 md:py-5">
          <MerchantHero merchant={merchant}/>
          <MerchantTabs reviewCount={merchant.reviewCount}/>

          {/* Mobile-only category strip lives inside CategoryPageBody
              on marketplace pages; the merchant page mirrors it here
              so mobile users can hop to a category from the merchant
              context. */}

          {/* Product grid + right sidebar — stack on mobile, side by
              side from lg: up. */}
          <div className="mt-4 flex flex-col gap-6 lg:flex-row">
            <div className="min-w-0 flex-1">
              <MerchantProductGrid merchant={merchant} products={products}/>
            </div>
            <MerchantSidebar merchant={merchant} productCount={products.length}/>
          </div>

          <MerchantTrustBand/>
        </div>
      </div>
    </div>
  );
}
