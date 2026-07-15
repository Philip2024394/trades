// /tc/trade-center/[category] — Marketplace landing per mock.
//
// Composition (matches the ImageKit mock):
//   TradeCenterHeader   (top bar — burger + wordmark + search + icons)
//   CategoryRail        (17-cat rail + Filters block on the left)
//   CategoryPageBody    (header + sub-chip row + 4-col product grid)
//
// No hero area anywhere. The category name is a slim page-title row;
// everything else is product density.

import { notFound } from "next/navigation";
import { bootstrapPlatform } from "@/platform/bootstrap";
import { TradeCenterHeader } from "@/apps/tradecenter/components/TradeCenterHeader";
import { CategoryRail } from "@/apps/tradecenter/components/CategoryRail";
import { CategoryPageBody } from "@/apps/tradecenter/components/CategoryPageBody";
import {
  RAIL_CATEGORIES,
  SUB_CATEGORIES,
  productsForRailCategory,
  type RailCategorySlug
} from "@/apps/tradecenter/data/categoryTaxonomy";

bootstrapPlatform();

export const dynamic = "force-dynamic";

export default async function CategoryLandingPage({
  params,
  searchParams
}: {
  params: Promise<{ category: string }>;
  searchParams: Promise<{ q?: string }>;
}) {
  const { category } = await params;
  const { q } = await searchParams;
  // Root `/tc/trade-center` renders All Products; every rail slug
  // (Plastering, Machinery, PPE etc.) resolves here.
  const railEntry = RAIL_CATEGORIES.find((c) => c.slug === category);
  if (!railEntry) notFound();
  const slug = railEntry.slug as RailCategorySlug;
  // In-category search: narrow the category products by substring
  // match on name/spec/subCategory when ?q= is present.
  const searching = typeof q === "string" && q.trim().length > 0;
  const query = searching ? q!.trim().toLowerCase() : "";
  const baseProducts = productsForRailCategory(slug);
  const products = searching
    ? baseProducts.filter(
        (p) =>
          p.name.toLowerCase().includes(query) ||
          p.spec.toLowerCase().includes(query) ||
          p.subCategory.toLowerCase().includes(query)
      )
    : baseProducts;
  const categoryLabel = searching
    ? `Results for "${q!.trim()}" in ${railEntry.label}`
    : railEntry.label;
  const subCategories = searching ? [] : SUB_CATEGORIES[slug] ?? [];

  return (
    <div className="flex min-h-screen flex-col bg-[#FBF6EC]">
      <TradeCenterHeader activeCategorySlug={slug}/>
      <div className="flex w-full flex-1">
        <CategoryRail activeSlug={slug}/>
        <CategoryPageBody
          categorySlug={slug}
          categoryLabel={categoryLabel}
          products={products}
          subCategories={subCategories}
        />
      </div>
    </div>
  );
}
