// Hammerex Trade Off — Materials Network editor.
//
// Server shell. Validates the magic-link edit_token, loads the
// listing's curated merchant picks + earnings aggregate + recent
// referrals, and hands them to <MaterialsNetworkEditor> (client) and
// <MerchantFulfilmentPanel> (client). Both editors live on the same
// page because a real merchant typically also wears the "I picked
// merchants for my own customers" hat — same dashboard, two roles.
//
// Privacy boundary: the tradie-side earnings list NEVER receives
// customer name / wa / postcode (enforced server-side by the
// referrals/list route when role=tradie).

import type { Metadata } from "next";
import Link from "next/link";
import { XratedHeader } from "@/components/xrated/XratedHeader";
import { XratedFooter } from "@/components/xrated/XratedFooter";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { adminWhatsapp } from "@/lib/whatsapp";
import { effectiveTier } from "@/lib/xratedTrades";
import { isMaterialsNetworkOn } from "@/lib/xratedAddons";
import { MaterialsNetworkEditor } from "@/components/trade-off/MaterialsNetworkEditor";
import { MerchantFulfilmentPanel } from "@/components/trade-off/MerchantFulfilmentPanel";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Materials Network editor | Hammerex Trade Off",
  robots: { index: false, follow: false }
};

type SearchParams = Promise<{ token?: string | string[] }>;
type Params = Promise<{ slug: string }>;

export default async function TradeOffMaterialsNetworkEditPage({
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
      "id, slug, edit_token, display_name, tier, trial_expires_at, addons_enabled, merchant_commission_rate, merchant_commission_min_pence, merchant_commission_terms, materials_network_paused, materials_network_opted_in_at"
    )
    .eq("slug", slug)
    .maybeSingle();

  if (!row.data) return <InvalidLink reason="not-found" />;
  if (row.data.edit_token !== token) return <InvalidLink reason="bad-token" />;

  const tier = effectiveTier({
    tier: row.data.tier ?? "standard",
    trial_expires_at: row.data.trial_expires_at ?? null
  });
  const isPaid = tier === "app_trial" || tier === "app_paid";
  const materialsOn = isMaterialsNetworkOn({
    addons_enabled:
      row.data.addons_enabled && typeof row.data.addons_enabled === "object"
        ? (row.data.addons_enabled as Record<string, boolean>)
        : {}
  });
  const addonsMap =
    row.data.addons_enabled && typeof row.data.addons_enabled === "object"
      ? (row.data.addons_enabled as Record<string, boolean>)
      : {};
  const isMerchantSide = addonsMap.wholesale_mode === true;

  const upgradeHref = `/trade-off/upgrade?slug=${encodeURIComponent(slug)}&token=${encodeURIComponent(token)}`;
  const backHref = `/trade-off/edit/${encodeURIComponent(slug)}?token=${encodeURIComponent(token)}`;

  return (
    <main className="min-h-screen bg-brand-bg text-brand-text">
      <XratedHeader />
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
          Add-on &middot; Materials Network
        </p>
        <h1 className="mt-2 text-3xl font-extrabold leading-tight sm:text-4xl">
          Materials Network
        </h1>
        <p className="mt-3 text-[13px] text-brand-muted">
          {isPaid && materialsOn
            ? "Add-on £3/mo · active"
            : isPaid
              ? "Toggle Materials Network on from your dashboard to go live"
              : "Upgrade to enable Materials Network"}
        </p>
      </section>

      {!isPaid && (
        <section className="mx-auto max-w-3xl px-4 pb-6">
          <div className="rounded-xl border border-brand-accent/40 bg-brand-accent/10 p-4">
            <p className="text-sm font-bold text-brand-accent">
              Materials Network is a paid add-on
            </p>
            <p className="mt-1 text-xs text-brand-muted">
              You can set up your picks now &mdash; they go live once you upgrade
              and switch Materials Network on from your dashboard.
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

      <section className="mx-auto max-w-3xl px-4 pb-10">
        <MaterialsNetworkEditor
          slug={slug}
          editToken={token}
          isPaid={isPaid}
          addonOn={materialsOn}
        />
      </section>

      {isMerchantSide && (
        <section className="mx-auto max-w-3xl px-4 pb-16">
          <MerchantFulfilmentPanel
            slug={slug}
            editToken={token}
            initialCommissionRate={row.data.merchant_commission_rate}
            initialCommissionMinPence={
              row.data.merchant_commission_min_pence ?? 0
            }
            initialCommissionTerms={row.data.merchant_commission_terms}
            initialPaused={row.data.materials_network_paused ?? false}
          />
        </section>
      )}

      <XratedFooter />
    </main>
  );
}

function InvalidLink({ reason }: { reason: string }) {
  const wa = adminWhatsapp().replace(/\D/g, "");
  const msg = encodeURIComponent(
    "Hi Hammerex — I'm trying to edit my Materials Network but my link isn't working. Can you help?"
  );
  return (
    <main className="min-h-screen bg-brand-bg text-brand-text">
      <XratedHeader />
      <section className="mx-auto max-w-xl px-4 pb-16 pt-16 text-center">
        <p className="text-xs font-bold uppercase tracking-widest text-brand-accent">
          Trade Off
        </p>
        <h1 className="mt-2 text-3xl font-extrabold leading-tight">
          This link is invalid or has expired.
        </h1>
        <p className="mt-4 text-xs text-brand-muted">
          The URL you used doesn&rsquo;t match a live profile. Double-check the
          link in your bookmarks &mdash; the token after <code>?token=</code> must
          be exact.
        </p>
        <p className="mt-2 text-[11px] text-brand-muted">Reference: {reason}</p>
        <a
          href={`https://wa.me/${wa}?text=${msg}`}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-6 inline-flex h-11 items-center rounded-lg bg-brand-whatsapp px-6 text-xs font-bold text-white transition hover:opacity-90"
        >
          Message Hammerex on WhatsApp
        </a>
      </section>
      <XratedFooter />
    </main>
  );
}
