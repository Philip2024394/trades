// xratedtrade.com — Shop Categories editor.
//
// Merchant reorders / renames / toggles / uploads images for the
// horizontal category strip that sits under their hero. Save button
// commits the full array to the listing's shop_categories JSONB
// column via /api/trade-off/shop-categories/save.

import type { Metadata } from "next";
import Link from "next/link";
import { DashboardHeader } from "@/components/trade-off/DashboardHeader";
import { DashboardFooter } from "@/components/trade-off/DashboardFooter";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { ShopCategoriesEditor } from "@/components/trade-off/ShopCategoriesEditor";
import type { ShopCategory } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Shop Categories | xratedtrade.com",
  robots: { index: false, follow: false }
};

type SearchParams = Promise<{ token?: string | string[] }>;
type Params = Promise<{ slug: string }>;

export default async function ShopCategoriesEditPage({
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
    .select("id, slug, edit_token, display_name, shop_categories")
    .eq("slug", slug)
    .maybeSingle();
  if (!row.data) return <InvalidLink reason="not-found" />;
  if (row.data.edit_token !== token) return <InvalidLink reason="bad-token" />;

  const backHref = `/trade-off/edit/${encodeURIComponent(slug)}?token=${encodeURIComponent(token)}`;
  const initial: ShopCategory[] = Array.isArray(row.data.shop_categories)
    ? (row.data.shop_categories as ShopCategory[])
    : [];

  return (
    <main className="min-h-screen bg-brand-bg text-brand-text">
      <DashboardHeader />
      <section className="mx-auto max-w-3xl px-4 pb-2 pt-10">
        <Link
          href={backHref}
          className="inline-flex h-9 items-center text-xs font-bold text-brand-muted transition hover:text-brand-accent"
        >
          &larr; Back to dashboard
        </Link>
      </section>
      <section className="mx-auto max-w-3xl px-4 pb-6 pt-4">
        <p className="text-xs font-bold uppercase tracking-widest text-brand-accent">
          Add-on &middot; Shop Categories
        </p>
        <h1 className="mt-2 text-3xl font-extrabold leading-tight sm:text-4xl">
          Shop Categories
        </h1>
        <p className="mt-3 max-w-2xl text-[13px] text-brand-muted">
          The horizontal strip under your hero. Drag to reorder, toggle on/off,
          rename or swap the image. Each category is a shortcut into your shop
          filtered to just those products. Add unlimited categories, delete
          any you don&rsquo;t sell.
        </p>
        <div className="mt-4 flex gap-3">
          <Link
            href={`/${slug}`}
            target="_blank"
            className="inline-flex h-11 items-center rounded-xl bg-brand-accent px-4 text-[12px] font-extrabold uppercase tracking-widest text-black transition hover:opacity-90"
          >
            Preview live →
          </Link>
        </div>
      </section>

      <ShopCategoriesEditor slug={slug} token={token} initial={initial} />

      <DashboardFooter slug={slug} token={token} />
    </main>
  );
}

function InvalidLink({ reason }: { reason: string }) {
  return (
    <main className="min-h-screen bg-brand-bg text-brand-text">
      <DashboardHeader />
      <section className="mx-auto max-w-md px-4 pb-24 pt-16 text-center">
        <h1 className="text-2xl font-extrabold">Link expired or invalid</h1>
        <p className="mt-3 text-[13px] text-brand-muted">Re-open your dashboard from the link in your email. ({reason})</p>
      </section>
    </main>
  );
}
