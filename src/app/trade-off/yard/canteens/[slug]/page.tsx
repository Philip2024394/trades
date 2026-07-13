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
  platformSideLaneFromDb,
  canteenPostsFromDb
} from "@/lib/canteens.server";
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
  searchParams: Promise<{ focus?: string; from?: string }>;
}) {
  const { slug } = await params;
  const { focus, from } = await searchParams;
  const canteen = await canteenBySlugFromDb(slug);
  if (!canteen) notFound();
  // Platform-wide feed + members + admin + products — 5 concurrent
  // reads. Mock fallback per source when the tables are empty.
  const [sideLane, members, admin, featuredProducts, allProducts, chatPosts] = await Promise.all([
    platformSideLaneFromDb(canteen.tradeSlug),
    membersForCanteenFromDb(canteen.id),
    adminForCanteenFromDb(canteen.id),
    productsForCanteenFromDb(canteen.id, { featuredOnly: true }),
    productsForCanteenFromDb(canteen.id),
    canteenPostsFromDb(canteen.id)
  ]);
  const totalProducts = allProducts.length;

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
      initialFocusProductId={initialFocusProductId}
      returnHref={returnOrigin?.href}
      returnLabel={returnOrigin?.label}
    />
  );
}
