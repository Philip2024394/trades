// /trade-off/yard/canteens/[slug]/products/[productId] — canteen PDP.
//
// Dedicated product detail page for a canteen product. Reached from the
// product grid's "View details" CTA on each card. Composition mirrors
// the Trade Center PDP (gallery + buy column, description below) but
// scoped to the canteen — seller is the canteen host, contact is
// WhatsApp deep-link, no Stripe cart because canteen products aren't
// on the marketplace unless the host also lists them on Trade Center
// (in which case we surface a "Buy on Trade Center" secondary CTA).

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ShoppingBag,
  MessageCircle,
  ChevronRight,
  ShieldCheck,
  Home,
  Info
} from "lucide-react";
import {
  canteenBySlugFromDb,
  canteenProductByIdFromDb,
  productsForCanteenFromDb,
  adminForCanteenFromDb
} from "@/lib/canteens.server";
import { whatsappDigits } from "@/lib/tradeOff";
import { BRAND, absolute } from "@/lib/seo";

export const dynamic = "force-dynamic";

const CREAM = "#FBF6EC";
const BRAND_YELLOW = "#FFB300";
const BRAND_BLACK = "#0A0A0A";
const BRAND_GREEN_DARK = "#166534";

export async function generateMetadata({
  params
}: {
  params: Promise<{ slug: string; productId: string }>;
}): Promise<Metadata> {
  const { slug, productId } = await params;
  const [canteen, product] = await Promise.all([
    canteenBySlugFromDb(slug),
    canteenProductByIdFromDb(productId)
  ]);
  if (!canteen || !product) return { title: "Product | Thenetworkers" };
  const title = `${product.name} · ${canteen.hostDisplayName} | Thenetworkers`;
  return {
    title,
    description: product.blurb,
    alternates: { canonical: `/trade-off/yard/canteens/${slug}/products/${productId}` },
    openGraph: {
      type: "website",
      siteName: BRAND.name,
      title,
      description: product.blurb,
      url: absolute(`/trade-off/yard/canteens/${slug}/products/${productId}`),
      images: [{ url: product.imageUrl }]
    }
  };
}

function productWhatsappUrl(whatsapp: string, hostFirstName: string, productName: string): string {
  const digits = whatsappDigits(whatsapp);
  const message = `Hi ${hostFirstName}, I'm interested in "${productName}" from your canteen on Thenetworkers. Can you tell me more?`;
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

export default async function CanteenProductDetailPage({
  params
}: {
  params: Promise<{ slug: string; productId: string }>;
}) {
  const { slug, productId } = await params;
  const [canteen, product] = await Promise.all([
    canteenBySlugFromDb(slug),
    canteenProductByIdFromDb(productId)
  ]);
  if (!canteen || !product) notFound();
  // Guard — product must belong to THIS canteen (never render a
  // cross-canteen product on the wrong host's PDP).
  if (product.canteenId !== canteen.id) notFound();

  const [admin, allProducts] = await Promise.all([
    adminForCanteenFromDb(canteen.id),
    productsForCanteenFromDb(canteen.id)
  ]);
  const relatedProducts = allProducts.filter((p) => p.id !== product.id).slice(0, 4);

  const hostFirstName = canteen.hostDisplayName.split(/\s+/)[0] ?? canteen.hostDisplayName;
  const whatsapp = admin?.whatsapp ?? null;
  const waUrl = whatsapp ? productWhatsappUrl(whatsapp, hostFirstName, product.name) : null;

  const galleryImages = [product.imageUrl, ...(product.galleryUrls ?? [])].filter(Boolean);

  return (
    <main className="min-h-screen overflow-x-hidden" style={{ backgroundColor: CREAM }}>
      {/* Hero — same visual language as CanteenHeader. Dark banner
          (canteen's own bg if set, otherwise brand gradient), then a
          trade tag + product name + blurb + action row with the green
          "Home" primary + glass "About us" secondary — mirroring the
          canteen page's non-member CTA row so the two surfaces feel
          like one product. */}
      <section className="relative overflow-hidden" style={{ backgroundColor: BRAND_BLACK }}>
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

        <div className="relative mx-auto max-w-6xl px-4 pb-6 pt-6 sm:px-6 sm:pb-8 sm:pt-8">
          {/* Trade tag */}
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span
              className="rounded-sm px-1.5 py-0.5 text-[10px] font-black uppercase tracking-[0.18em]"
              style={{ backgroundColor: BRAND_YELLOW, color: BRAND_BLACK }}
            >
              {canteen.tradeLabel}
            </span>
          </div>

          {/* Host chip */}
          <div className="text-[10px] font-black uppercase tracking-[0.22em] text-white/60">
            Library of products
          </div>

          {/* Product name — hero heading */}
          <h1 className="mt-1 text-[26px] font-black leading-[1.05] text-white drop-shadow-md sm:text-[34px] md:text-[40px]">
            {product.name}
          </h1>
          {product.blurb && (
            <p className="mt-2 max-w-2xl text-[13px] leading-snug text-white/85 sm:text-[14px]">
              {product.blurb}
            </p>
          )}

          {/* Action row — mirrors CanteenHeader's non-member CTA row.
              Green primary (was "View products" on the canteen; here
              it's "Home" — this surface IS a product page, so the
              primary action becomes returning to the canteen). */}
          <div className="mt-5 flex flex-wrap items-center gap-2">
            <Link
              href={`/trade-off/yard/canteens/${slug}`}
              className="inline-flex h-11 items-center gap-1.5 rounded-full px-4 text-[13px] font-black uppercase tracking-wider text-white shadow-lg transition active:scale-[0.97]"
              style={{ backgroundColor: BRAND_GREEN_DARK }}
            >
              <Home size={13} strokeWidth={2.5}/>
              Home
            </Link>
            <Link
              href={`/trade-off/yard/canteens/${slug}/about`}
              className="inline-flex h-11 items-center gap-1 rounded-full border border-white/25 bg-white/10 px-3 text-[12px] font-black uppercase tracking-wider text-white backdrop-blur transition hover:bg-white/20"
            >
              <Info size={12} strokeWidth={2.5}/>
              About us
            </Link>
          </div>
        </div>

        {/* Cream hairline — reads clean against the cream page below */}
        <div className="relative h-1" style={{ backgroundColor: CREAM }}/>
      </section>

      {/* Main two-column */}
      <section className="mx-auto max-w-6xl px-3 py-4 sm:px-6 sm:py-6">
        <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_360px] md:gap-6 lg:grid-cols-[minmax(0,1fr)_400px] lg:gap-8">
          {/* Gallery */}
          <ProductGallery
            images={galleryImages}
            alt={product.name}
          />

          {/* Buy column — the hero above carries name + blurb + host,
              so this column focuses on the commerce actions. */}
          <aside className="flex flex-col gap-4">
            {/* Price */}
            <div className="flex items-baseline gap-2">
              <span className="text-[28px] font-black text-neutral-900 sm:text-[32px]">
                £{product.priceGbp}
              </span>
              <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-500">
                {product.currency ?? "GBP"} · price from seller
              </span>
            </div>

            {/* Bulk-buy strip */}
            {product.bulkBuy && (
              <div
                className="rounded-xl border-2 p-3"
                style={{ borderColor: BRAND_GREEN_DARK, backgroundColor: "#F0FDF4" }}
              >
                <div className="text-[10px] font-black uppercase tracking-[0.18em]" style={{ color: BRAND_GREEN_DARK }}>
                  Bulk-buy unlocked at £{product.bulkBuy.discountedPriceGbp}
                </div>
                <div className="mt-1 text-[12px] leading-snug text-neutral-700">
                  {product.bulkBuy.committedCount} / {product.bulkBuy.targetCount} committed. When the target is reached, everyone gets the discounted price.
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex flex-col gap-2">
              {waUrl ? (
                <a
                  href={waUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-full px-5 text-[13px] font-black uppercase tracking-wider text-white shadow-lg transition active:scale-[0.98]"
                  style={{ backgroundColor: BRAND_GREEN_DARK }}
                >
                  <MessageCircle size={14} strokeWidth={2.5}/>
                  WhatsApp {hostFirstName}
                </a>
              ) : (
                <span
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-full border px-5 text-[12px] font-black uppercase tracking-wider text-neutral-500"
                  style={{ borderColor: "rgba(139,69,19,0.15)", backgroundColor: "#F9FAFB" }}
                >
                  <MessageCircle size={13}/>
                  No WhatsApp on file
                </span>
              )}
              {product.tradeCenterListingId && (
                <Link
                  href={`/tc/trade-center/product/${product.tradeCenterListingId}`}
                  className="inline-flex h-12 items-center justify-center gap-1.5 rounded-full px-5 text-[13px] font-black uppercase tracking-wider text-neutral-900 shadow-sm transition active:scale-[0.98]"
                  style={{ backgroundColor: BRAND_YELLOW }}
                >
                  <ShoppingBag size={13} strokeWidth={2.5}/>
                  Buy on Trade Center
                </Link>
              )}
            </div>

            {/* Trust strip */}
            <div
              className="flex items-start gap-2 rounded-lg border p-3"
              style={{ borderColor: "rgba(139,69,19,0.15)", backgroundColor: "#FFFFFF" }}
            >
              <ShieldCheck size={14} className="mt-0.5 flex-shrink-0" style={{ color: BRAND_GREEN_DARK }}/>
              <div className="text-[11px] leading-snug text-neutral-700">
                Direct from the seller. Quote and payment handled between you and {hostFirstName} — Thenetworkers doesn&apos;t hold funds.
              </div>
            </div>
          </aside>
        </div>
      </section>

      {/* Description + specs */}
      <section className="mx-auto max-w-6xl px-3 pb-4 sm:px-6 sm:pb-6">
        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_360px] md:gap-6 lg:grid-cols-[minmax(0,1fr)_400px] lg:gap-8">
          <div>
            <div
              className="rounded-xl border bg-white p-4 shadow-sm sm:p-5"
              style={{ borderColor: "rgba(139,69,19,0.15)" }}
            >
              <div className="text-[10px] font-black uppercase tracking-[0.18em] text-neutral-500">
                Product details
              </div>
              <p className="mt-2 whitespace-pre-wrap text-[13px] leading-relaxed text-neutral-800">
                {product.description || product.blurb}
              </p>
            </div>
          </div>
          <div>
            {product.specs && product.specs.length > 0 && (
              <div
                className="rounded-xl border bg-white p-4 shadow-sm sm:p-5"
                style={{ borderColor: "rgba(139,69,19,0.15)" }}
              >
                <div className="text-[10px] font-black uppercase tracking-[0.18em] text-neutral-500">
                  Specs
                </div>
                <ul className="mt-2 flex flex-col gap-1.5">
                  {product.specs.map((s, i) => (
                    <li key={i} className="flex items-start gap-2 text-[12px] leading-snug text-neutral-700">
                      <span
                        aria-hidden
                        className="mt-1.5 inline-block h-1.5 w-1.5 flex-shrink-0 rounded-full"
                        style={{ backgroundColor: BRAND_YELLOW }}
                      />
                      {s}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* About the seller */}
      {admin && (
        <section className="mx-auto max-w-6xl px-3 pb-4 sm:px-6 sm:pb-6">
          <div
            className="overflow-hidden rounded-xl border bg-white shadow-sm"
            style={{ borderColor: "rgba(139,69,19,0.15)" }}
          >
            <div className="flex items-start gap-3 p-4 sm:p-5">
              {admin.avatarUrl ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={admin.avatarUrl}
                  alt=""
                  className="h-14 w-14 flex-shrink-0 rounded-full object-cover"
                />
              ) : (
                <div
                  className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-full text-[18px] font-black"
                  style={{ backgroundColor: BRAND_YELLOW, color: BRAND_BLACK }}
                >
                  {admin.displayName.charAt(0)}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="text-[10px] font-black uppercase tracking-[0.18em] text-neutral-500">
                  Sold by
                </div>
                <div className="text-[15px] font-black text-neutral-900">
                  {admin.displayName}
                </div>
                <div className="text-[11px] font-bold text-neutral-500">
                  {admin.tradeLabel} · {admin.city}
                </div>
                {admin.bioShort && (
                  <p className="mt-1.5 text-[12px] leading-snug text-neutral-700">
                    {admin.bioShort}
                  </p>
                )}
              </div>
              <Link
                href={`/trade-off/yard/canteens/${slug}`}
                className="inline-flex h-9 flex-shrink-0 items-center gap-1 rounded-full px-3 text-[11px] font-black uppercase tracking-wider text-neutral-900 shadow-sm"
                style={{ backgroundColor: BRAND_YELLOW }}
              >
                <Home size={11}/>
                Home
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* More from this canteen */}
      {relatedProducts.length > 0 && (
        <section className="mx-auto max-w-6xl px-3 pb-8 sm:px-6 sm:pb-12">
          <div className="mb-3 flex items-center justify-between">
            <div className="text-[10px] font-black uppercase tracking-[0.18em] text-neutral-500">
              More from {canteen.hostDisplayName}
            </div>
            <Link
              href={`/trade-off/yard/canteens/${slug}/products`}
              className="text-[10px] font-black uppercase tracking-wider text-neutral-600 hover:text-neutral-900"
            >
              View all →
            </Link>
          </div>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {relatedProducts.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/trade-off/yard/canteens/${slug}/products/${p.id}`}
                  className="flex h-full flex-col overflow-hidden rounded-xl border bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                  style={{ borderColor: "rgba(139,69,19,0.15)" }}
                >
                  <div
                    className="relative aspect-square w-full"
                    style={{
                      backgroundImage: `url('${p.imageUrl}')`,
                      backgroundSize: "cover",
                      backgroundPosition: "center",
                      backgroundColor: "#F3F4F6"
                    }}
                  >
                    <span
                      className="absolute bottom-1.5 right-1.5 rounded-sm px-1.5 py-0.5 text-[11px] font-black shadow-md"
                      style={{ backgroundColor: BRAND_YELLOW, color: BRAND_BLACK }}
                    >
                      £{p.priceGbp}
                    </span>
                  </div>
                  <div className="p-3">
                    <div className="line-clamp-2 text-[12px] font-black leading-tight text-neutral-900">
                      {p.name}
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Sticky back-to-canteen on mobile so users always have a way out */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-white/95 backdrop-blur md:hidden"
        style={{ borderColor: "rgba(139,69,19,0.15)" }}
      >
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-3 py-2">
          <Link
            href={`/trade-off/yard/canteens/${slug}`}
            className="inline-flex h-10 items-center gap-1 rounded-full border px-3 text-[11px] font-black uppercase tracking-wider text-neutral-700"
            style={{ borderColor: "rgba(139,69,19,0.15)" }}
          >
            <Home size={12}/>
            Home
          </Link>
          {waUrl && (
            <a
              href={waUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex h-10 items-center gap-1.5 rounded-full px-4 text-[11.5px] font-black uppercase tracking-wider text-white shadow-sm"
              style={{ backgroundColor: BRAND_GREEN_DARK }}
            >
              <MessageCircle size={13} strokeWidth={2.5}/>
              WhatsApp
            </a>
          )}
        </div>
      </div>
      <div className="h-14 md:hidden" aria-hidden/>
    </main>
  );
}

// ─── Gallery ────────────────────────────────────────────────────

function ProductGallery({ images, alt }: { images: string[]; alt: string }) {
  const [primary, ...rest] = images.length > 0
    ? images
    : ["/window.svg"]; // literal fallback keeps the layout stable
  return (
    <div className="flex flex-col gap-2">
      <div
        className="relative aspect-square w-full overflow-hidden rounded-xl border bg-white shadow-sm"
        style={{
          backgroundImage: `url('${primary}')`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          borderColor: "rgba(139,69,19,0.15)",
          backgroundColor: "#F3F4F6"
        }}
        aria-label={alt}
      />
      {rest.length > 0 && (
        <ul className="grid grid-cols-4 gap-2">
          {rest.slice(0, 4).map((url, i) => (
            <li
              key={`${url}-${i}`}
              className="relative aspect-square overflow-hidden rounded-lg border"
              style={{
                borderColor: "rgba(139,69,19,0.15)",
                backgroundImage: `url('${url}')`,
                backgroundSize: "cover",
                backgroundPosition: "center",
                backgroundColor: "#F3F4F6"
              }}
              aria-label={`${alt} — image ${i + 2}`}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
