// /tc/trade-center/product/[slug] — Product Detail Page.
//
// Ported from Hammerex PDP structure (hammer/src/app/product/[slug]).
// SKIPPED per Philip's directive 2026-07-11: "In the box" section.
// Hammerex-specific extras (belt add-ons, deal breakers, custom branding,
// repair cover, WhatsApp FAB, retail shops) are NOT ported — those are
// Hammerex's own commerce model, not Trade Center's.
//
// Composition (top → bottom):
//   Breadcrumb
//   Two-column: ProductGallery | BuyColumn (+ MultiBuySwitcher inside BuyColumn)
//   BundleBlock ("Bundle & Save" accordion)
//   PairsWithBlock ("Buy with this product" 3-col)
//   KeyFeaturesAndSpecs
//   CompareBlock
//   ReviewsBlock
//   ProductFaqBlock
//   ShippingReturnsBlock
//   StickyBuyBar (bottom-fixed on scroll)

import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { MarketplaceHeader } from "@/apps/marketplace/components/MarketplaceHeader";
import { ProductGallery } from "@/apps/marketplace/components/pdp/ProductGallery";
import { BuyColumn } from "@/apps/marketplace/components/pdp/BuyColumn";
import { BundleBlock } from "@/apps/marketplace/components/pdp/BundleBlock";
import { PairsWithBlock } from "@/apps/marketplace/components/pdp/PairsWithBlock";
import { KeyFeaturesAndSpecs } from "@/apps/marketplace/components/pdp/KeyFeaturesAndSpecs";
import { CompareBlock } from "@/apps/marketplace/components/pdp/CompareBlock";
import { ReviewsBlock } from "@/apps/marketplace/components/pdp/ReviewsBlock";
import {
  ProductFaqBlock,
  ShippingReturnsBlock
} from "@/apps/marketplace/components/pdp/ProductFaqAndShipping";
import { StickyBuyBar } from "@/apps/marketplace/components/pdp/StickyBuyBar";
import { PRODUCT_FIXTURES } from "@/apps/marketplace/data/products";
import { findMerchant } from "@/apps/marketplace/data/merchants";
import { findProductDetails } from "@/apps/marketplace/data/productDetails";

export const dynamic = "force-dynamic";

export default async function ProductDetailPage({
  params
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const product = PRODUCT_FIXTURES.find((p) => p.slug === slug);
  if (!product) notFound();
  const merchant = findMerchant(product.merchantSlug);
  if (!merchant) notFound();

  // Rich details are optional — fall back to a synthesised minimal set
  // so any product renders a working PDP even without curated content.
  const details = findProductDetails(slug) ?? {
    productSlug: slug,
    gallery: product.imageUrl
      ? [{ id: "fb", kind: "image" as const, url: product.imageUrl, alt: product.name }]
      : [],
    keyFeatures: [],
    specs: [],
    pairsWith: [],
    compareWithSlugs: [],
    reviews: [],
    faq: [],
    overview: product.spec,
    warrantyYears: 1
  };

  return (
    <div className="flex min-h-screen flex-col bg-[#FBF6EC] pb-[calc(72px+env(safe-area-inset-bottom,0px))] md:pb-0">
      <MarketplaceHeader activeCategorySlug={null}/>

      {/* Breadcrumb */}
      <nav
        className="mx-auto w-full max-w-6xl px-4 pt-4 text-[11px] text-neutral-500"
        aria-label="Breadcrumb"
      >
        <ol className="flex flex-wrap items-center gap-1">
          <li><Link href="/tc/trade-center/plastering" className="hover:text-neutral-900">Marketplace</Link></li>
          <li><ChevronRight size={11}/></li>
          <li>
            <Link href={`/tc/trade-center/${product.category === "hand-tools" ? "plastering" : product.category}`} className="hover:text-neutral-900">
              {product.subCategory.replace(/-/g, " ")}
            </Link>
          </li>
          <li><ChevronRight size={11}/></li>
          <li className="text-neutral-900 font-bold line-clamp-1">{product.name}</li>
        </ol>
      </nav>

      {/* Top: gallery + buy column */}
      <section className="mx-auto w-full max-w-6xl px-4 pt-4 md:pt-6">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
          <ProductGallery
            media={details.gallery}
            fallbackImageUrl={product.imageUrl}
            productName={product.name}
          />
          <div id="pdp-buy-sentinel">
            <BuyColumn
              product={product}
              merchant={merchant}
              details={details}
              viewerTier="free"
            />
          </div>
        </div>
      </section>

      {/* Bundle & Save (Hammerex BundleBlock) */}
      {details.bundle && (
        <BundleBlock anchor={product} bundle={details.bundle}/>
      )}

      {/* Buy with this product (Hammerex PairsWith) */}
      <PairsWithBlock pairs={details.pairsWith}/>

      {/* Key features + specs */}
      <KeyFeaturesAndSpecs features={details.keyFeatures} specs={details.specs}/>

      {/* Compare */}
      <CompareBlock current={product} compareSlugs={details.compareWithSlugs}/>

      {/* Reviews */}
      <ReviewsBlock
        reviews={details.reviews}
        productAvgStars={product.starRating}
        productReviewCount={product.reviewCount}
      />

      {/* FAQ */}
      <ProductFaqBlock faq={details.faq}/>

      {/* Shipping & returns */}
      <ShippingReturnsBlock
        dispatchLeadDays={details.dispatchLeadDays}
        freeDeliveryOver={details.freeDeliveryOver}
        warrantyYears={details.warrantyYears}
      />

      {/* Sticky bottom bar (mobile-first) */}
      <StickyBuyBar product={product}/>
    </div>
  );
}
