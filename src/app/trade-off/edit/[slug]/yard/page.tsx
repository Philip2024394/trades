// Yard composer sub-route. Validates the magic-link token, loads the
// member's live Yard posts + a quick "do they have a shop?" check so
// the composer drawer is only offered when there's a catalogue to draw
// from, and renders the client composer.

import type { Metadata } from "next";
import Link from "next/link";
import { XratedHeader } from "@/components/xrated/XratedHeader";
import { XratedFooter } from "@/components/xrated/XratedFooter";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { adminWhatsapp } from "@/lib/whatsapp";
import { effectiveTier } from "@/lib/xratedTrades";
import { isBuilderGradeTrade } from "@/lib/yardAccess";
import { YardComposer } from "@/components/trade-off/YardComposer";
import type { HammerexTradeOffYardPost } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Post to The Yard | Xrated Trades",
  robots: { index: false, follow: false }
};

type SearchParams = Promise<{ token?: string | string[] }>;
type Params = Promise<{ slug: string }>;

export default async function YardEditPage({
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
    .select(
      "id, slug, edit_token, display_name, primary_trade, city, tier, trial_expires_at"
    )
    .eq("slug", slug)
    .maybeSingle();

  if (!row.data) return <InvalidLink reason="not-found" />;
  if (row.data.edit_token !== token)
    return <InvalidLink reason="bad-token" />;

  const tier = effectiveTier({
    tier: row.data.tier ?? "standard",
    trial_expires_at: row.data.trial_expires_at ?? null
  });
  const builderFree = isBuilderGradeTrade(row.data.primary_trade);
  const allowed = tier === "app_paid" || tier === "app_trial" || builderFree;

  const backHref = `/trade-off/edit/${encodeURIComponent(slug)}?token=${encodeURIComponent(token)}`;

  if (!allowed) {
    return (
      <main className="min-h-screen bg-brand-bg text-brand-text">
        <XratedHeader />
        <section className="mx-auto max-w-3xl px-4 pb-2 pt-10">
          <Link
            href={backHref}
            className="inline-flex h-9 items-center text-[13px] font-bold text-brand-muted transition hover:text-brand-accent"
          >
            &larr; Back to dashboard
          </Link>
        </section>
        <section className="mx-auto max-w-3xl px-4 pb-16 pt-4">
          <p className="text-[13px] font-extrabold uppercase tracking-[0.22em] text-brand-accent">
            The Yard &middot; Paid members only
          </p>
          <h1 className="mt-2 text-3xl font-extrabold leading-tight sm:text-4xl">
            Upgrade to post.
          </h1>
          <p className="mt-3 text-[13px] text-brand-muted">
            The Yard is the trades-only private board. Reading is free
            to browse, but posting and reacting are reserved for paid
            members and builder-grade trades (general builder, building
            merchant, builders supplies).
          </p>
          <Link
            href={`/trade-off/upgrade?slug=${encodeURIComponent(slug)}&token=${encodeURIComponent(token)}`}
            className="mt-5 inline-flex h-12 items-center rounded-xl bg-brand-accent px-5 text-[13px] font-extrabold text-black transition hover:opacity-90"
          >
            See upgrade options &rarr;
          </Link>
        </section>
        <XratedFooter />
      </main>
    );
  }

  // My current posts
  const myPostsRes = await supabaseAdmin
    .from("hammerex_trade_off_yard_posts")
    .select(
      "id, listing_id, kind, trade_slug, title, body, country, region, start_date, end_date, crew_size_needed, day_rate_pence, is_sample, status, parent_id, image_urls, attachment_url, attachment_name, attachment_kind, link_url, link_title, product_price_pence, source_product_id, created_at, expires_at"
    )
    .eq("listing_id", row.data.id)
    .eq("status", "live")
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(20);
  const myPosts = (myPostsRes.data ?? []) as HammerexTradeOffYardPost[];

  // Does the member have any published Shop Mode products to pick from?
  const shopRes = await supabaseAdmin
    .from("hammerex_xrated_products")
    .select("id", { count: "exact", head: true })
    .eq("listing_id", row.data.id)
    .eq("status", "live");
  const canSellProducts = (shopRes.count ?? 0) > 0;

  return (
    <main className="min-h-screen bg-brand-bg text-brand-text">
      <XratedHeader />
      <section className="mx-auto max-w-3xl px-4 pb-2 pt-10">
        <Link
          href={backHref}
          className="inline-flex h-9 items-center text-[13px] font-bold text-brand-muted transition hover:text-brand-accent"
        >
          &larr; Back to dashboard
        </Link>
      </section>
      <section className="mx-auto max-w-3xl px-4 pb-6 pt-4">
        <p className="text-[13px] font-extrabold uppercase tracking-[0.22em] text-brand-accent">
          The Yard &middot; Post
        </p>
        <h1 className="mt-2 text-3xl font-extrabold leading-tight sm:text-4xl">
          Post to The Yard.
        </h1>
        <p className="mt-3 text-[13px] text-brand-muted">
          14-day auto-vanish. Only paying members + builder-grade trades
          see it. No public footprint.
        </p>
      </section>

      <section className="mx-auto max-w-3xl px-4 pb-16">
        <YardComposer
          slug={slug}
          editToken={token}
          initialTrade={row.data.primary_trade ?? "general-builder"}
          initialRegion={row.data.city ?? ""}
          myPosts={myPosts}
          canSellProducts={canSellProducts}
        />
      </section>

      <XratedFooter />
    </main>
  );
}

function InvalidLink({ reason }: { reason: string }) {
  const wa = adminWhatsapp().replace(/\D/g, "");
  const msg = encodeURIComponent(
    "Hi Xrated — I'm trying to post to The Yard but my link isn't working. Can you help?"
  );
  return (
    <main className="min-h-screen bg-brand-bg text-brand-text">
      <XratedHeader />
      <section className="mx-auto max-w-xl px-4 pb-16 pt-16 text-center">
        <p className="text-[13px] font-bold uppercase tracking-widest text-brand-accent">
          Xrated Trades
        </p>
        <h1 className="mt-2 text-3xl font-extrabold leading-tight">
          This link is invalid or has expired.
        </h1>
        <p className="mt-4 text-[13px] text-brand-muted">
          The URL you used doesn&rsquo;t match a live profile. Reference:{" "}
          {reason}.
        </p>
        <a
          href={`https://wa.me/${wa}?text=${msg}`}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-6 inline-flex h-11 items-center rounded-lg bg-brand-whatsapp px-6 text-[13px] font-bold text-white transition hover:opacity-90"
        >
          Message Xrated on WhatsApp
        </a>
      </section>
      <XratedFooter />
    </main>
  );
}
