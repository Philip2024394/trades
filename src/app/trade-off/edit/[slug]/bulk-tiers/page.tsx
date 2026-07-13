// Bulk Tiers — per-product quantity → price ladder editor.
//
// Moved off the Wholesale Mode page (bulk pricing is product pricing,
// not delivery). Reachable from the Shop Mode editor and from the
// Merchant Pro dashboard section grid.

import type { Metadata } from "next";
import Link from "next/link";
import { DashboardHeader } from "@/components/trade-off/DashboardHeader";
import { DashboardFooter } from "@/components/trade-off/DashboardFooter";
import { BulkTiersPanel } from "@/components/trade-off/BulkTiersPanel";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { adminWhatsapp } from "@/lib/whatsapp";
import { whatsappDigits } from "@/lib/tradeOff";
import type { HammerexXratedProduct } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Bulk pricing tiers | Xrated Trades",
  robots: { index: false, follow: false }
};

type SearchParams = Promise<{ token?: string | string[] }>;
type Params = Promise<{ slug: string }>;

export default async function BulkTiersEditPage({
  params,
  searchParams
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const rawToken = Array.isArray(sp.token) ? sp.token[0] : sp.token;
  const token = typeof rawToken === "string" ? rawToken.trim() : "";

  if (!slug || !token) return <InvalidLink reason="missing-token" />;

  const row = await supabaseAdmin
    .from("hammerex_trade_off_listings")
    .select("id, slug, display_name, edit_token")
    .eq("slug", slug)
    .maybeSingle();

  if (!row.data) return <InvalidLink reason="not-found" />;
  if (row.data.edit_token !== token) return <InvalidLink reason="bad-token" />;

  const productsRes = await supabaseAdmin
    .from("hammerex_xrated_products")
    .select("*")
    .eq("listing_id", row.data.id)
    .order("sort_order", { ascending: true });
  const products = (productsRes.data ?? []) as HammerexXratedProduct[];
  const liveProducts = products.filter(
    (p) => (p.kind ?? "product") === "product" && p.status === "live"
  );

  const backHref = `/trade-off/edit/${encodeURIComponent(slug)}/shop-mode?token=${encodeURIComponent(token)}`;

  return (
    <main className="min-h-screen bg-brand-bg text-brand-text">
      <DashboardHeader />
      <section className="mx-auto max-w-3xl px-4 pb-2 pt-10">
        <Link
          href={backHref}
          className="inline-flex h-9 items-center text-xs font-bold text-brand-muted transition hover:text-brand-accent"
        >
          ← Back to Trade Center
        </Link>
      </section>
      <section className="mx-auto max-w-3xl px-4 pb-6 pt-4">
        <p className="text-xs font-bold uppercase tracking-widest text-brand-accent">
          Merchant Pro · included
        </p>
        <h1 className="mt-2 text-3xl font-extrabold leading-tight sm:text-4xl">
          Bulk pricing tiers
        </h1>
        <p className="mt-3 text-[13px] text-brand-muted">
          Quantity-ladder pricing per product — e.g. 1-9 sheets at £8 each,
          10-49 at £7, 50+ at £6. Tradies see the better unit price the
          moment they bump up their quantity in the cart.
        </p>
      </section>

      <section className="mx-auto max-w-3xl px-4 pb-16">
        <BulkTiersPanel
          slug={slug}
          editToken={token}
          initialProducts={liveProducts}
        />
      </section>

      <DashboardFooter />
    </main>
  );
}

function InvalidLink({ reason }: { reason: string }) {
  const wa = adminWhatsapp().replace(/\D/g, "");
  void whatsappDigits;
  const msg = encodeURIComponent(
    "Hi thenetworkers.app — I'm trying to edit my Bulk Tiers but my link isn't working. Can you help?"
  );
  return (
    <main className="min-h-screen bg-brand-bg text-brand-text">
      <DashboardHeader />
      <section className="mx-auto max-w-xl px-4 pb-16 pt-16 text-center">
        <p className="text-xs font-bold uppercase tracking-widest text-brand-accent">
          thenetworkers.app
        </p>
        <h1 className="mt-2 text-3xl font-extrabold leading-tight">
          This link is invalid or has expired.
        </h1>
        <p className="mt-4 text-xs text-brand-muted">
          Reference: {reason}
        </p>
        <a
          href={`https://wa.me/${wa}?text=${msg}`}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-6 inline-flex h-11 items-center rounded-lg bg-brand-whatsapp px-6 text-xs font-bold text-white transition hover:opacity-90"
        >
          Message us on WhatsApp
        </a>
      </section>
      <DashboardFooter />
    </main>
  );
}
