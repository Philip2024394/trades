// src/app/nex-native/product/[productId]/page.tsx
//
// Bridge 1 · canonical product destination for NEX Directory search.
// -------------------------------------------------------------------------
// A visitor arrives here from /nex-native/search after tapping a product
// card. This page renders the real product from the authoritative NEX
// Supabase and mounts the SAME NexNativeChatClient the business page
// uses — with the product pre-selected so "Chat about this product" is a
// single tap. The chat client hits the existing message API path, so the
// resulting nex_conversation.about_product_id is persisted honestly.
//
// No new chat system. No new product system. No schema change.

import Link from "next/link";
import { notFound } from "next/navigation";
import "../../nex-native.css";
import * as productService from "@/lib/nex-native/product-service";
import * as businessService from "@/lib/nex-native/business-service";
import { NexNativeChatClient } from "../../[businessSlug]/chat-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Basic UUID sanity guard so we don't slam the DB with garbage. The
// canonical NEX product id is a Postgres uuid; anything else is 404.
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function Page({
  params,
}: {
  params: Promise<{ productId: string }>;
}) {
  const { productId } = await params;
  if (!UUID_REGEX.test(productId)) notFound();

  const product = await productService.getProductById(productId);
  if (!product) notFound();
  // Only "live" products are publicly discoverable via canonical URL.
  // Draft / archived remain reachable to their owner via manage surfaces.
  if (product.status !== "live") notFound();

  const business = await businessService.getBusinessById(product.business_id);
  if (!business) notFound();

  const chatProduct = {
    id: product.id,
    name: product.name,
    price_pence: product.price_pence,
    currency: product.currency,
  };

  return (
    <div className="nex-native-root" data-nex-product-page>
      <main className="mx-auto max-w-2xl px-4 py-6">
        <header className="mb-4 border-b border-[var(--nex-neutral-300)] pb-3">
          <p className="text-[10px] font-medium uppercase tracking-wider text-[var(--nex-accent-600)]">
            <Link href={`/nex-native/${business.slug}`} className="hover:underline">
              @{business.slug}.nex
            </Link>
          </p>
          <h1 className="text-xl font-semibold text-[var(--nex-neutral-900)]">
            {product.name}
          </h1>
          <p className="mt-1 text-sm text-[var(--nex-neutral-700)]">
            {product.currency} {(product.price_pence / 100).toFixed(2)}
            {product.stock_status && (
              <span
                className={`ml-2 inline-block rounded border px-1.5 py-0.5 text-[10px] font-medium ${
                  product.stock_status === "in_stock"
                    ? "border-emerald-300 bg-emerald-50 text-emerald-900"
                    : product.stock_status === "low_stock"
                      ? "border-amber-300 bg-amber-50 text-amber-900"
                      : product.stock_status === "made_to_order"
                        ? "border-blue-300 bg-blue-50 text-blue-900"
                        : "border-neutral-300 bg-neutral-100 text-neutral-600 line-through"
                }`}
              >
                {product.stock_status === "in_stock"
                  ? "in stock"
                  : product.stock_status === "low_stock"
                    ? "low stock"
                    : product.stock_status === "made_to_order"
                      ? "made to order"
                      : "sold out"}
              </span>
            )}
          </p>
        </header>

        {product.image_url && (
          <div className="mb-4 overflow-hidden rounded-2xl border border-[var(--nex-neutral-200)] bg-white">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={product.image_url}
              alt={product.name}
              className="w-full object-contain"
              data-nex-product-image
            />
          </div>
        )}

        {product.description && (
          <p className="mb-4 whitespace-pre-wrap text-sm text-[var(--nex-neutral-800)]">
            {product.description}
          </p>
        )}

        {product.gallery_urls && product.gallery_urls.length > 0 && (
          <div className="mb-4 flex flex-wrap gap-2">
            {product.gallery_urls.map((u, i) => (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                key={`${u}-${i}`}
                src={u}
                alt={`${product.name} · image ${i + 2}`}
                className="h-20 w-20 rounded border border-[var(--nex-neutral-200)] object-contain bg-white"
              />
            ))}
          </div>
        )}

        {product.tags && product.tags.length > 0 && (
          <div className="mb-4 flex flex-wrap gap-1.5">
            {product.tags.map((t) => (
              <Link
                key={t}
                href={`/nex-native/search?q=${encodeURIComponent(t)}`}
                className="inline-block rounded border border-[var(--nex-neutral-300)] bg-white px-2 py-0.5 text-xs text-[var(--nex-neutral-700)] hover:border-[var(--nex-accent-500)]"
              >
                {t}
              </Link>
            ))}
          </div>
        )}

        <section className="mb-4 rounded-xl border border-[var(--nex-neutral-200)] bg-white/70 p-3 text-xs text-[var(--nex-neutral-700)]">
          Sold by{" "}
          <Link
            href={`/nex-native/${business.slug}`}
            className="font-medium text-[var(--nex-neutral-900)] hover:underline"
          >
            {business.display_name}
          </Link>
          {business.address && <> · {business.address.split("\n")[0]}</>}
        </section>

        <section id="chat" data-nex-product-chat>
          <h2 className="mb-2 text-xs font-medium uppercase tracking-wider text-[var(--nex-accent-600)]">
            💬 Chat about {product.name}
          </h2>
          <p className="mb-3 text-[11px] text-[var(--nex-neutral-500)]">
            Your message reaches {business.display_name} · no account needed to start.
          </p>
          <NexNativeChatClient
            businessSlug={business.slug}
            businessDisplayName={business.display_name}
            products={[chatProduct]}
            initialSelectedProductId={product.id}
          />
        </section>

        <footer className="mx-auto max-w-2xl px-4 pb-8 pt-6 text-center text-[10px] text-[var(--nex-neutral-500)]">
          Powered by NEX
        </footer>
      </main>
    </div>
  );
}
