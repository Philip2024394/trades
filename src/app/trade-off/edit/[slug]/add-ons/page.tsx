// Add-ons sub-page. For Merchant Pro listings (building-merchant and
// builders-supplies on £14.99/mo) this is the canonical DASHBOARD — a
// live banner + next-best-step + section grid where every feature is
// already bundled in the tier. For every other trade, the original
// AddOnsHub renders as it always did.

import type { Metadata } from "next";
import Link from "next/link";
import { DashboardHeader } from "@/components/trade-off/DashboardHeader";
import { DashboardFooter } from "@/components/trade-off/DashboardFooter";
import { DashboardDrawer } from "@/components/trade-off/DashboardDrawer";
import { AddOnsHub } from "@/components/trade-off/AddOnsHub";
import { MerchantProLiveBanner } from "@/components/trade-off/MerchantProLiveBanner";
import { MerchantProSectionGrid } from "@/components/trade-off/MerchantProSectionGrid";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { adminWhatsapp } from "@/lib/whatsapp";
import { isMerchantProTrade, whatsappDigits } from "@/lib/tradeOff";
import { effectiveTier } from "@/lib/xratedTrades";
import { maybeExpireListingTier } from "@/lib/xratedTier";
import {
  MERCHANT_PRO_SECTIONS,
  nextBestStep,
  profileProgress,
  type MerchantProSectionCounts
} from "@/lib/merchantProDashboard";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Apps | Xrated Trades",
  robots: { index: false, follow: false }
};

type SearchParams = Promise<{ token?: string | string[] }>;
type Params = Promise<{ slug: string }>;

export default async function AddOnsEditPage({
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
    .select("*")
    .eq("slug", slug)
    .maybeSingle();

  if (!row.data) return <InvalidLink reason="not-found" />;
  if (row.data.edit_token !== token) return <InvalidLink reason="bad-token" />;

  await maybeExpireListingTier(row.data.id);
  const refreshed = await supabaseAdmin
    .from("hammerex_trade_off_listings")
    .select("*")
    .eq("id", row.data.id)
    .maybeSingle();
  if (refreshed.data) row.data = refreshed.data;

  const tier = effectiveTier({
    tier: row.data.tier ?? "standard",
    trial_expires_at: row.data.trial_expires_at ?? null
  });

  const isMerchantPro = isMerchantProTrade(row.data.primary_trade);

  return (
    <main className="min-h-screen bg-white text-neutral-900">
      <DashboardHeader />
      <DashboardDrawer slug={slug} token={token} current="add-ons" />

      {isMerchantPro ? (
        <MerchantProDashboardBody listing={row.data} token={token} />
      ) : (
        <LegacyAddOnsBody listing={row.data} token={token} tier={tier} />
      )}

      <DashboardFooter />
    </main>
  );
}

async function MerchantProDashboardBody({
  listing,
  token
}: {
  // Loose type — page already verified the row exists. We use the same
  // HammerexTradeOffListing shape the AddOnsHub uses; cast at use.
  listing: Record<string, unknown> & {
    id: string;
    slug: string;
    display_name: string | null;
    addons_enabled: Record<string, boolean> | null;
    recommendations: unknown;
    custom_domain_status: string | null;
  };
  token: string;
}) {
  // Pull every section count in parallel — head=true counts only, no
  // payload. Failures degrade to 0 so a missing/empty table never breaks
  // the dashboard render. Trusted Trades is sourced from the JSONB
  // recommendations array on the listing itself.
  const [
    productsRes,
    categorisedRes,
    newsletterRes,
    downloadsRes,
    faqRes,
    picksRes,
    materialsRes,
    zonesRes,
    pushRes
  ] = await Promise.all([
    supabaseAdmin
      .from("hammerex_xrated_products")
      .select("id", { count: "exact", head: true })
      .eq("listing_id", listing.id)
      .eq("status", "live"),
    supabaseAdmin
      .from("hammerex_xrated_products")
      .select("id", { count: "exact", head: true })
      .eq("listing_id", listing.id)
      .eq("status", "live")
      .not("merchant_category", "is", null),
    supabaseAdmin
      .from("hammerex_xrated_newsletter_subscribers")
      .select("id", { count: "exact", head: true })
      .eq("listing_id", listing.id),
    supabaseAdmin
      .from("hammerex_xrated_downloads")
      .select("id", { count: "exact", head: true })
      .eq("listing_id", listing.id),
    supabaseAdmin
      .from("hammerex_xrated_faq_items")
      .select("id", { count: "exact", head: true })
      .eq("listing_id", listing.id),
    supabaseAdmin
      .from("hammerex_xrated_trade_center_picks")
      .select("id", { count: "exact", head: true })
      .eq("listing_id", listing.id),
    supabaseAdmin
      .from("hammerex_xrated_merchant_picks")
      .select("id", { count: "exact", head: true })
      .eq("listing_id", listing.id),
    supabaseAdmin
      .from("hammerex_xrated_shipping_zones")
      .select("id", { count: "exact", head: true })
      .eq("listing_id", listing.id),
    supabaseAdmin
      .from("hammerex_xrated_push_subscriptions")
      .select("id", { count: "exact", head: true })
      .eq("listing_id", listing.id)
  ]);

  const recommendations = Array.isArray(listing.recommendations)
    ? listing.recommendations
    : [];

  const counts: MerchantProSectionCounts = {
    live_products: productsRes.count ?? 0,
    categorised_products: categorisedRes.count ?? 0,
    newsletter_subscribers: newsletterRes.count ?? 0,
    downloads_count: downloadsRes.count ?? 0,
    faq_page_items: faqRes.count ?? 0,
    picks_count: picksRes.count ?? 0,
    materials_picks: materialsRes.count ?? 0,
    wholesale_zones: zonesRes.count ?? 0,
    trusted_trades_count: recommendations.length,
    lead_alerts_subscriptions: pushRes.count ?? 0,
    custom_domain_status:
      typeof listing.custom_domain_status === "string"
        ? listing.custom_domain_status
        : null
  };

  const addonsMap =
    listing.addons_enabled && typeof listing.addons_enabled === "object"
      ? (listing.addons_enabled as Record<string, boolean>)
      : {};
  const listingForHelpers = { addons_enabled: addonsMap };
  const next = nextBestStep(listingForHelpers, counts);
  const progress = profileProgress(listingForHelpers, counts);

  // Build the public URL from request origin. We don't have headers()
  // imported here, so we construct from the slug using the canonical
  // thenetworkers.app host in production and localhost:3008 in dev.
  const origin =
    process.env.XRATED_PUBLIC_ORIGIN ??
    process.env.NEXT_PUBLIC_XRATED_ORIGIN ??
    "https://thenetworkers.app";
  const publicUrl = `${origin}/trade/${encodeURIComponent(listing.slug)}`;

  const adminDigits = whatsappDigits(adminWhatsapp());

  return (
    <>
      <section className="mx-auto max-w-3xl px-4 pb-2 pt-10 sm:px-6">
        <p
          className="text-[10px] font-extrabold uppercase tracking-[0.22em]"
          style={{ color: "#FFB300" }}
        >
          Merchant Pro · £14.99/mo
        </p>
        <h1 className="mt-2 text-3xl font-extrabold leading-tight sm:text-4xl">
          Your dashboard
        </h1>
        <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-neutral-500 sm:text-sm">
          Everything below is bundled with your plan. Fill what you'll
          use, switch off what you won't — empty sections stay hidden
          from customers.
        </p>
      </section>

      <section className="mx-auto max-w-3xl px-4 pb-4 sm:px-6">
        <MerchantProLiveBanner
          displayName={listing.display_name ?? listing.slug}
          publicUrl={publicUrl}
          filled={progress.filled}
          total={progress.total}
        />
      </section>

      {next && (
        <section className="mx-auto max-w-3xl px-4 pb-4 sm:px-6">
          <Link
            href={
              next.editorPath === "trusted-trades"
                ? `/trade-off/edit/${encodeURIComponent(listing.slug)}?token=${encodeURIComponent(token)}#trusted-trades`
                : `/trade-off/edit/${encodeURIComponent(listing.slug)}/${next.editorPath}?token=${encodeURIComponent(token)}`
            }
            className="block rounded-2xl border border-brand-accent bg-brand-accent/15 p-5 transition hover:bg-brand-accent/20 sm:p-6"
          >
            <p className="text-[10px] font-extrabold uppercase tracking-widest text-brand-accent">
              Next best step
            </p>
            <h3 className="mt-2 flex items-center gap-3 text-lg font-extrabold text-brand-text sm:text-xl">
              <span aria-hidden="true" className="text-2xl">
                {next.glyph}
              </span>
              {next.name}
            </h3>
            <p className="mt-1 text-xs text-brand-muted">{next.tagline}</p>
            <span className="mt-3 inline-flex h-9 items-center text-[13px] font-bold text-brand-accent">
              Set up →
            </span>
          </Link>
        </section>
      )}

      <section className="mx-auto max-w-3xl px-4 pb-6 sm:px-6">
        <MerchantProSectionGrid
          listing={listing as Parameters<typeof MerchantProSectionGrid>[0]["listing"]}
          editToken={token}
          counts={counts}
          adminWhatsappDigits={adminDigits}
        />
      </section>

      <section className="mx-auto max-w-3xl px-4 pb-24 sm:px-6">
        <div className="rounded-2xl border border-brand-line bg-brand-surface p-5 sm:p-6">
          <p className="text-[10px] font-bold uppercase tracking-widest text-brand-accent">
            Site Office
          </p>
          <h3 className="mt-2 text-base font-extrabold text-brand-text sm:text-lg">
            Need a hand? We'll set the whole thing up for you.
          </h3>
          <p className="mt-1 text-xs text-brand-muted">
            From £297 one-off — we upload your products, configure delivery,
            write your copy. You go from signup to live storefront in 3-5
            days without lifting a finger.
          </p>
          <Link
            href="/site-office"
            className="mt-3 inline-flex h-11 items-center rounded-lg border border-brand-line bg-brand-bg px-4 text-[13px] font-bold text-brand-text transition hover:border-brand-accent hover:text-brand-accent"
          >
            Talk to Site Office →
          </Link>
        </div>
      </section>
    </>
  );
}

function LegacyAddOnsBody({
  listing,
  token,
  tier
}: {
  listing: Record<string, unknown> & {
    slug: string;
    display_name: string | null;
  };
  token: string;
  tier: ReturnType<typeof effectiveTier>;
}) {
  return (
    <>
      <section className="mx-auto max-w-3xl px-4 pb-6 pt-10 sm:px-6">
        <p
          className="text-[10px] font-extrabold uppercase tracking-[0.22em]"
          style={{ color: "#FFB300" }}
        >
          Add-ons
        </p>
        <h1 className="mt-2 text-3xl font-extrabold leading-tight sm:text-4xl">
          Make {listing.display_name} do more
        </h1>
        <p className="mt-3 max-w-2xl text-[13px] leading-relaxed text-neutral-500 sm:text-sm">
          Your base profile already works. Add-ons layer on top — sell
          products, point your own domain, get SMS lead alerts. Stack
          any combination. Toggle on, pay only for what&rsquo;s on.
        </p>
        <p className="mt-3 text-[13px] text-neutral-500">
          <Link
            href={`/trade-off/edit/${listing.slug}?token=${encodeURIComponent(token)}`}
            className="font-bold text-neutral-900 underline-offset-4 hover:underline"
          >
            ← Back to profile dashboard
          </Link>
        </p>
      </section>

      <section className="mx-auto max-w-3xl px-4 pb-24 sm:px-6">
        <AddOnsHub
          listing={listing as Parameters<typeof AddOnsHub>[0]["listing"]}
          editToken={token}
          tier={tier}
        />
      </section>
    </>
  );
}

// Make sure the section-list import isn't tree-shaken out — referenced
// indirectly via MERCHANT_PRO_SECTIONS in the helper; this no-op
// re-export keeps the module graph honest.
export const _sections = MERCHANT_PRO_SECTIONS;

function InvalidLink({ reason }: { reason: "missing-token" | "not-found" | "bad-token" }) {
  const adminWaDigits = whatsappDigits(adminWhatsapp());
  const waUrl = `https://wa.me/${adminWaDigits}?text=${encodeURIComponent(
    "Hi Xrated Trades — I need help opening Add-ons."
  )}`;
  const copy: Record<typeof reason, string> = {
    "missing-token":
      "This Add-ons link is missing its secure token. Use the link in your welcome email or message us to get a new one.",
    "not-found":
      "We couldn't find this listing. Double-check the URL or message us.",
    "bad-token":
      "This token doesn't match. Use the original link in your welcome email, or message us for a fresh one."
  };
  return (
    <main className="min-h-screen bg-white text-neutral-900">
      <DashboardHeader />
      <section className="mx-auto max-w-xl px-4 py-16 text-center sm:px-6">
        <p
          className="text-[10px] font-extrabold uppercase tracking-[0.22em]"
          style={{ color: "#FFB300" }}
        >
          Add-ons
        </p>
        <h1 className="mt-2 text-2xl font-extrabold sm:text-3xl">
          We need a valid link.
        </h1>
        <p className="mt-3 text-[13px] text-neutral-500">{copy[reason]}</p>
        <a
          href={waUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-6 inline-flex h-12 items-center gap-2 rounded-xl px-6 text-sm font-extrabold text-white shadow-lg"
          style={{ background: "#0F7A3F" }}
        >
          Message us on WhatsApp
        </a>
      </section>
      <DashboardFooter />
    </main>
  );
}
