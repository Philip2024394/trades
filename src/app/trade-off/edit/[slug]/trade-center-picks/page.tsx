// thenetworkers.app Trade Off — Trade Center Picks editor.
// Server shell. Validates the magic-link edit_token, loads the
// listing's picks + the merchant's xrated products (for the picker
// dropdown), and hands them to <TradeCenterPicksEditor> (client
// component) which renders the picks list + add / edit modal.
//
// Gated to merchant-grade trades — service trades get redirected
// back to the dashboard. The add-on toggle itself is gated by the
// AddOnsHub audience filter (so a service trade never sees the
// "Subscribe" tile in the first place) but we double-defend here.

import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { DashboardHeader } from "@/components/trade-off/DashboardHeader";
import { DashboardFooter } from "@/components/trade-off/DashboardFooter";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { adminWhatsapp } from "@/lib/whatsapp";
import { effectiveTier } from "@/lib/xratedTrades";
import { isTradeCenterPicksOn } from "@/lib/xratedAddons";
import { isMerchantGradeTrade } from "@/lib/tradeOff";
import { TradeCenterPicksEditor } from "@/components/trade-off/TradeCenterPicksEditor";
import type {
  HammerexXratedTradeCenterPick,
  HammerexXratedProduct
} from "@/lib/supabase";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Trade Center Picks editor | thenetworkers.app",
  robots: { index: false, follow: false }
};

type SearchParams = Promise<{ token?: string | string[] }>;
type Params = Promise<{ slug: string }>;

export default async function TradeOffTradeCenterPicksEditPage({
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
      "id, slug, edit_token, display_name, primary_trade, tier, trial_expires_at, addons_enabled"
    )
    .eq("slug", slug)
    .maybeSingle();

  if (!row.data) return <InvalidLink reason="not-found" />;
  if (row.data.edit_token !== token) return <InvalidLink reason="bad-token" />;

  // Visibility gate — Trade Center Picks is merchant-only. If the
  // listing isn't merchant-grade, bounce back to the dashboard so the
  // service trade never lands on an editor for an add-on they can't see.
  if (!isMerchantGradeTrade(row.data.primary_trade)) {
    redirect(
      `/trade-off/edit/${encodeURIComponent(slug)}?token=${encodeURIComponent(token)}&msg=trade-center-picks-merchant-only`
    );
  }

  const tier = effectiveTier({
    tier: row.data.tier ?? "standard",
    trial_expires_at: row.data.trial_expires_at ?? null
  });
  const isPaid = tier === "app_trial" || tier === "app_paid" || tier === "app_verified";
  const picksOn = isTradeCenterPicksOn({
    addons_enabled:
      row.data.addons_enabled && typeof row.data.addons_enabled === "object"
        ? (row.data.addons_enabled as Record<string, boolean>)
        : {}
  });

  const upgradeHref = `/trade-off/upgrade?slug=${encodeURIComponent(slug)}&token=${encodeURIComponent(token)}`;
  const backHref = `/trade-off/edit/${encodeURIComponent(slug)}?token=${encodeURIComponent(token)}`;

  const picksRes = await supabaseAdmin
    .from("hammerex_xrated_trade_center_picks")
    .select("*")
    .eq("listing_id", row.data.id)
    .order("sort_order", { ascending: true })
    .order("effective_at", { ascending: false });
  const picks = (picksRes.data ?? []) as HammerexXratedTradeCenterPick[];

  // Merchant's product catalogue — the picker dropdown only lists
  // products the merchant actually sells. Lean projection (id / name
  // / slug / cover_url) so the dashboard payload stays small.
  const prodRes = await supabaseAdmin
    .from("hammerex_xrated_products")
    .select("id, name, slug, cover_url")
    .eq("listing_id", row.data.id)
    .eq("status", "live")
    .order("created_at", { ascending: false });
  const products = (prodRes.data ?? []) as Pick<
    HammerexXratedProduct,
    "id" | "name" | "slug" | "cover_url"
  >[];

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
          Add-on &middot; Trade Center Picks
        </p>
        <h1 className="mt-2 text-3xl font-extrabold leading-tight sm:text-4xl">
          Trade Center Picks &mdash; pin your hot products
        </h1>
        <p className="mt-3 text-[13px] text-brand-muted">
          {picks.length} pick{picks.length === 1 ? "" : "s"} &middot;{" "}
          {isPaid && picksOn
            ? "Add-on £4/mo · active"
            : isPaid
              ? "Toggle Trade Center Picks on from your dashboard to go live"
              : "Upgrade to enable Trade Center Picks"}
        </p>
      </section>

      {!isPaid && (
        <section className="mx-auto max-w-3xl px-4 pb-6">
          <div className="rounded-xl border border-brand-accent/40 bg-brand-accent/10 p-4">
            <p className="text-sm font-bold text-brand-accent">
              Trade Center Picks is a paid add-on
            </p>
            <p className="mt-1 text-xs text-brand-muted">
              You can set up picks now &mdash; the banners go live on your
              profile once you upgrade and switch the add-on on from your
              dashboard.
            </p>
            <Link
              href={upgradeHref}
              className="mt-3 inline-flex h-11 items-center rounded-lg bg-brand-accent px-4 text-xs font-bold text-black transition hover:opacity-90"
            >
              See upgrade options &rarr;
            </Link>
          </div>
        </section>
      )}

      <section className="mx-auto max-w-3xl px-4 pb-16">
        <TradeCenterPicksEditor
          slug={slug}
          editToken={token}
          initialPicks={picks}
          products={products}
        />
      </section>

      <DashboardFooter />
    </main>
  );
}

function InvalidLink({ reason }: { reason: string }) {
  const wa = adminWhatsapp().replace(/\D/g, "");
  const msg = encodeURIComponent(
    "Hi thenetworkers.app — I'm trying to edit my Trade Center Picks but my link isn't working. Can you help?"
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
          The URL you used doesn&rsquo;t match a live profile. Double-check
          the link in your bookmarks &mdash; the token after{" "}
          <code>?token=</code> must be exact.
        </p>
        <p className="mt-2 text-[11px] text-brand-muted">Reference: {reason}</p>
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
