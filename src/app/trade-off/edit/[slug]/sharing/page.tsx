// Sharing sub-page — the Business Card share tool + Lead Alerts
// notification subscribe. Pulled off the main edit page so editing
// data stays calm. Both surfaces are about *reaching buyers* (sharing
// your URL, getting pinged when one messages) so they sit together.

import type { Metadata } from "next";
import Link from "next/link";
import { XratedHeader } from "@/components/xrated/XratedHeader";
import { XratedFooter } from "@/components/xrated/XratedFooter";
import { DashboardDrawer } from "@/components/trade-off/DashboardDrawer";
import { BusinessCardPanel } from "@/components/trade-off/BusinessCardPanel";
import { LeadAlertsSetupCard } from "@/components/trade-off/LeadAlertsSetupCard";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { adminWhatsapp } from "@/lib/whatsapp";
import { whatsappDigits } from "@/lib/tradeOff";
import { effectiveTier } from "@/lib/xratedTrades";
import { maybeExpireListingTier } from "@/lib/xratedTier";
import { isLeadAlertsOn } from "@/lib/xratedAddons";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Sharing | Xrated Trades",
  robots: { index: false, follow: false }
};

type SearchParams = Promise<{ token?: string | string[] }>;
type Params = Promise<{ slug: string }>;

export default async function SharingPage({
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

  const upgradeHref = `/trade-off/upgrade?slug=${encodeURIComponent(slug)}&token=${encodeURIComponent(token)}`;

  return (
    <main className="min-h-screen bg-white text-neutral-900">
      <XratedHeader />
      <DashboardDrawer slug={slug} token={token} current="sharing" />

      <section className="mx-auto max-w-3xl px-4 pb-6 pt-10 sm:px-6">
        <p
          className="text-[10px] font-extrabold uppercase tracking-[0.22em]"
          style={{ color: "#FFB300" }}
        >
          Sharing
        </p>
        <h1 className="mt-2 text-3xl font-extrabold leading-tight sm:text-4xl">
          Reach more buyers
        </h1>
        <p className="mt-3 max-w-2xl text-[13px] leading-relaxed text-neutral-500 sm:text-sm">
          Two tools that put your profile in front of the right people:
          share your business card on WhatsApp, and get a phone alert
          the moment a buyer messages you.
        </p>
        <p className="mt-3 text-[13px] text-neutral-500">
          <Link
            href={`/trade-off/edit/${slug}?token=${encodeURIComponent(token)}`}
            className="font-bold text-neutral-900 underline-offset-4 hover:underline"
          >
            ← Back to profile dashboard
          </Link>
        </p>
      </section>

      <section className="mx-auto max-w-3xl space-y-4 px-4 pb-24 sm:px-6">
        <BusinessCardPanel
          slug={slug}
          displayName={row.data.display_name ?? ""}
          primaryTrade={row.data.primary_trade ?? ""}
          city={row.data.city ?? ""}
          whatsapp={row.data.whatsapp ?? ""}
          tradingName={row.data.trading_name ?? null}
        />
        <LeadAlertsSetupCard
          slug={slug}
          editToken={token}
          vapidPublicKey={process.env.NEXT_PUBLIC_XRATED_VAPID_PUBLIC_KEY ?? ""}
          isPaidTier={tier === "app_trial" || tier === "app_paid" || tier === "app_verified"}
          addonEnabled={isLeadAlertsOn(row.data)}
          upgradeHref={upgradeHref}
        />
      </section>

      <XratedFooter />
    </main>
  );
}

function InvalidLink({ reason }: { reason: "missing-token" | "not-found" | "bad-token" }) {
  const adminWaDigits = whatsappDigits(adminWhatsapp());
  const waUrl = `https://wa.me/${adminWaDigits}?text=${encodeURIComponent(
    "Hi Xrated Trades — I need help opening Sharing."
  )}`;
  const copy: Record<typeof reason, string> = {
    "missing-token":
      "This Sharing link is missing its secure token. Use the link in your welcome email or message us to get a new one.",
    "not-found":
      "We couldn't find this listing. Double-check the URL or message us.",
    "bad-token":
      "This token doesn't match. Use the original link in your welcome email, or message us for a fresh one."
  };
  return (
    <main className="min-h-screen bg-white text-neutral-900">
      <XratedHeader />
      <section className="mx-auto max-w-xl px-4 py-16 text-center sm:px-6">
        <p
          className="text-[10px] font-extrabold uppercase tracking-[0.22em]"
          style={{ color: "#FFB300" }}
        >
          Sharing
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
      <XratedFooter />
    </main>
  );
}
