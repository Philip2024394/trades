// /trade-off/yard/canteens/[slug]/products — full products list.
//
// Reached from the canteen page's "View all N products" link and the
// header's "View products" primary CTA. Renders every product the host
// has listed in this canteen as a card grid — image, name, blurb,
// price, and a per-product WhatsApp contact button.
//
// Clicking the image or name jumps to the larger product-focus view on
// the canteen page (?focus={productId}) — reuses the existing
// CanteenProductFocus surface so we don't fork the product detail UI.

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ShoppingBag, MessageCircle, ChevronRight, Package, Star, Sparkles } from "lucide-react";
import { CanteenTrendingRibbon } from "@/components/xrated/yard/CanteenDashboardSections";
import {
  canteenBySlugFromDb,
  productsForCanteenFromDb,
  adminForCanteenFromDb
} from "@/lib/canteens.server";
import { whatsappDigits } from "@/lib/tradeOff";
import { BRAND, absolute } from "@/lib/seo";
import type { CanteenProduct } from "@/lib/canteens";

export const dynamic = "force-dynamic";

const CREAM = "#FBF6EC";
const BRAND_YELLOW = "#FFB300";
const BRAND_BLACK = "#0A0A0A";
const BRAND_GREEN_DARK = "#166534";

export async function generateMetadata({
  params
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const canteen = await canteenBySlugFromDb(slug);
  if (!canteen) return { title: "Canteen products | Thenetworkers" };
  const title = `${canteen.hostDisplayName}'s products · ${canteen.name} | Thenetworkers`;
  return {
    title,
    description: `All products from ${canteen.hostDisplayName} — full catalogue in the ${canteen.name} canteen.`,
    alternates: { canonical: `/trade-off/yard/canteens/${slug}/products` },
    openGraph: {
      type: "website",
      siteName: BRAND.name,
      title,
      description: canteen.tagline,
      url: absolute(`/trade-off/yard/canteens/${slug}/products`)
    }
  };
}

function productWhatsappUrl(whatsapp: string, hostFirstName: string, productName: string): string {
  const digits = whatsappDigits(whatsapp);
  const message = `Hi ${hostFirstName}, I'm interested in "${productName}" from your canteen on Thenetworkers. Can you tell me more?`;
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

export default async function CanteenProductsPage({
  params
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const canteen = await canteenBySlugFromDb(slug);
  if (!canteen) notFound();

  const [products, admin] = await Promise.all([
    productsForCanteenFromDb(canteen.id),
    adminForCanteenFromDb(canteen.id)
  ]);

  const hostFirstName = canteen.hostDisplayName.split(/\s+/)[0] ?? canteen.hostDisplayName;
  const whatsapp = admin?.whatsapp ?? null;
  // Only show seller-rating badge on cards when the host has earned it
  // (>=5 reviews) — matches the honest-signal rule used on the hero
  // stats card.
  const hostRating = admin?.reviews && admin.reviews.count >= 5 ? admin.reviews : null;

  return (
    <main className="min-h-screen overflow-x-hidden" style={{ backgroundColor: CREAM }}>
      {/* Hero — matches the canteen visual language */}
      <section className="relative min-h-[70vh] overflow-hidden lg:min-h-[80vh]" style={{ backgroundColor: BRAND_BLACK }}>
        {canteen.headerBgUrl ? (
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: `url('${canteen.headerBgUrl}')`,
              backgroundSize: "cover",
              backgroundPosition: "center"
            }}
          />
        ) : (
          <div
            className="absolute inset-0"
            style={{
              background: `radial-gradient(circle at 20% 30%, ${BRAND_YELLOW}22 0%, transparent 55%), radial-gradient(circle at 80% 70%, ${BRAND_YELLOW}18 0%, transparent 55%)`
            }}
          />
        )}
        <div
          className="absolute inset-0"
          style={{
            background: "linear-gradient(180deg, rgba(0,0,0,0.35) 0%, rgba(0,0,0,0.15) 40%, rgba(0,0,0,0.80) 100%)"
          }}
        />
        <div className="relative mx-auto flex min-h-[70vh] max-w-5xl flex-col px-4 pb-8 pt-6 sm:px-6 sm:pb-10 sm:pt-8 lg:min-h-[80vh]">
          <Link
            href={`/trade-off/yard/canteens/${slug}`}
            className="inline-flex w-max items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-white/85 backdrop-blur transition hover:bg-white/15"
          >
            <ArrowLeft size={10} strokeWidth={3}/>
            Back to canteen
          </Link>
          <div className="mt-auto pt-6">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span
                className="rounded-sm px-1.5 py-0.5 text-[10px] font-black uppercase tracking-[0.18em]"
                style={{ backgroundColor: BRAND_YELLOW, color: BRAND_BLACK }}
              >
                {canteen.tradeLabel}
              </span>
            </div>
            <div className="text-[10px] font-black uppercase tracking-[0.22em] text-white/60">
              Library of products
            </div>
            <h1 className="mt-1 text-[26px] font-black leading-[1.05] text-white drop-shadow-md sm:text-[34px] md:text-[38px]">
              All products
            </h1>
            <p className="mt-2 max-w-2xl text-[13px] leading-snug text-white/85 sm:text-[14px]">
              {products.length === 0
                ? `No products listed yet in ${canteen.name}.`
                : `${products.length} product${products.length === 1 ? "" : "s"} from ${canteen.hostDisplayName}. Tap a card to see it larger, or WhatsApp the seller for a bespoke enquiry.`}
            </p>
          </div>
        </div>
      </section>

      {/* Trending ribbon — compact variant. Moved from the canteen home
          page 2026-07-13 so the trending discovery lives on the deep-
          browse page where it belongs. Smaller square tiles per Philip. */}
      <CanteenTrendingRibbon
        tradeLabel={canteen.tradeLabel}
        tradeSlug={canteen.tradeSlug}
        products={products.slice(0, 5).map((p) => ({
          id:       p.id,
          name:     p.name,
          imageUrl: p.imageUrl,
          hrefPath: `/trade-off/yard/canteens/${slug}/products/${encodeURIComponent(p.id)}`
        }))}
        compact
      />

      {/* Grid */}
      <section className="mx-auto max-w-5xl px-3 py-6 sm:px-6 sm:py-8">
        {products.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed py-10 text-center"
            style={{ borderColor: "rgba(139,69,19,0.20)" }}
          >
            <Package size={32} strokeWidth={1.2} className="text-neutral-300"/>
            <div className="text-[14px] font-black text-neutral-900">
              No products yet
            </div>
            <p className="max-w-sm px-6 text-[12px] leading-snug text-neutral-600">
              When {hostFirstName} adds products to this canteen, they&apos;ll appear here as a full catalogue.
            </p>
          </div>
        ) : (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {products.map((p) => (
              <li key={p.id}>
                <ProductCard
                  product={p}
                  canteenSlug={slug}
                  whatsapp={whatsapp}
                  hostFirstName={hostFirstName}
                  hostRating={hostRating}
                />
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

function ProductCard({
  product: p,
  canteenSlug,
  whatsapp,
  hostFirstName,
  hostRating
}: {
  product: CanteenProduct;
  canteenSlug: string;
  whatsapp: string | null;
  hostFirstName: string;
  hostRating: { avg: number; count: number } | null;
}) {
  const detailsHref = `/trade-off/yard/canteens/${canteenSlug}/products/${encodeURIComponent(p.id)}`;
  const waUrl = whatsapp ? productWhatsappUrl(whatsapp, hostFirstName, p.name) : null;
  return (
    <article
      className="flex h-full flex-col overflow-hidden rounded-xl border bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
      style={{ borderColor: "rgba(139,69,19,0.15)" }}
    >
      {/* Full-bleed image with overlaid name + chips. Tap → PDP. */}
      <Link
        href={detailsHref}
        aria-label={`View details of ${p.name}`}
        className="relative block aspect-square w-full"
        style={{
          backgroundImage: `url('${p.imageUrl}')`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundColor: "#F3F4F6"
        }}
      >
        {/* Bottom gradient — for name legibility */}
        <div
          aria-hidden
          className="absolute inset-x-0 bottom-0 h-2/3"
          style={{ background: "linear-gradient(to top, rgba(0,0,0,0.85) 10%, rgba(0,0,0,0.35) 60%, transparent 100%)" }}
        />

        {/* Top-left chip stack */}
        <div className="absolute left-2 top-2 flex flex-col gap-1">
          {p.featured && (
            <span
              className="inline-flex items-center gap-0.5 rounded-sm px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider shadow-md"
              style={{ backgroundColor: BRAND_YELLOW, color: BRAND_BLACK }}
            >
              <Sparkles size={9} strokeWidth={3}/>
              Featured
            </span>
          )}
          {p.bulkBuy && (
            <span
              className="inline-flex items-center rounded-sm px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-white shadow-md"
              style={{ backgroundColor: "#166534" }}
            >
              Bulk · {p.bulkBuy.committedCount}/{p.bulkBuy.targetCount}
            </span>
          )}
        </div>

        {/* Top-right: rating chip */}
        {hostRating && (
          <span
            className="absolute right-2 top-2 inline-flex items-center gap-0.5 rounded-full bg-white/95 px-2 py-0.5 text-[10px] font-black shadow-md backdrop-blur"
            style={{ color: BRAND_BLACK }}
            title={`Seller rating · ${hostRating.count} reviews`}
          >
            <Star size={10} fill={BRAND_BLACK} strokeWidth={0}/>
            {hostRating.avg.toFixed(1)}
          </span>
        )}

        {/* Bottom overlay: name (large) + price chip */}
        <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 p-2.5">
          <div className="min-w-0 flex-1">
            <div className="line-clamp-2 text-[13px] font-black leading-tight text-white drop-shadow-md">
              {p.name}
            </div>
          </div>
          <span
            className="flex-shrink-0 rounded-md px-2 py-0.5 text-[12px] font-black shadow-md"
            style={{ backgroundColor: BRAND_YELLOW, color: BRAND_BLACK }}
          >
            £{p.priceGbp}
          </span>
        </div>
      </Link>

      {/* Body — image already carries name + price + rating overlay,
          so the below-image strip is action-only. */}
      <div className="flex flex-1 flex-col gap-2 p-2">
        <div className="flex flex-col gap-1.5">
          <Link
            href={detailsHref}
            className="inline-flex h-9 items-center justify-center gap-1 rounded-full px-3 text-[10.5px] font-black uppercase tracking-wider shadow-sm transition active:scale-[0.97]"
            style={{ backgroundColor: BRAND_YELLOW, color: BRAND_BLACK }}
          >
            <ShoppingBag size={11} strokeWidth={2.5}/>
            View details
            <ChevronRight size={11}/>
          </Link>
          {waUrl ? (
            <a
              href={waUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex h-9 items-center justify-center gap-1 rounded-full px-3 text-[10.5px] font-black uppercase tracking-wider text-white shadow-sm transition active:scale-[0.97]"
              style={{ backgroundColor: BRAND_GREEN_DARK }}
              title={`WhatsApp ${hostFirstName} about ${p.name}`}
            >
              <MessageCircle size={11} strokeWidth={2.5}/>
              WhatsApp
            </a>
          ) : (
            <span
              className="inline-flex h-9 items-center justify-center gap-1 rounded-full border px-3 text-[10.5px] font-black uppercase tracking-wider text-neutral-500"
              style={{ borderColor: "rgba(139,69,19,0.15)", backgroundColor: "#F9FAFB" }}
              title="Seller hasn't added a WhatsApp number"
            >
              <MessageCircle size={11}/>
              No WhatsApp
            </span>
          )}
        </div>
      </div>
    </article>
  );
}
