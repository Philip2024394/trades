// xratedtrade.com Trade Off — Online Payments editor.
//
// Phase 1: Payment Link mode fully working (paste a hosted-pay URL from
// any UK provider — Worldpay / SumUp / Klarna / Mollie / Revolut / Tide
// / etc.). Phases 2-5 layer native OAuth for Stripe, PayPal, Square.
//
// Hard rule: this page never accepts card details. It only stores
// merchant-supplied identifiers (provider account IDs once OAuth lands;
// payment-link templates for the manual path).

import type { Metadata } from "next";
import Link from "next/link";
import { DashboardHeader } from "@/components/trade-off/DashboardHeader";
import { DashboardFooter } from "@/components/trade-off/DashboardFooter";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { effectiveTier } from "@/lib/xratedTrades";
import { PaymentsEditorIsland } from "@/components/trade-off/PaymentsEditorIsland";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Online Payments | xratedtrade.com",
  robots: { index: false, follow: false }
};

type SearchParams = Promise<{ token?: string | string[] }>;
type Params = Promise<{ slug: string }>;

export default async function TradeOffPaymentsEditPage({
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
      "id, slug, edit_token, display_name, tier, trial_expires_at, addons_enabled, payment_provider, payment_provider_data, payment_link_template, payment_link_provider_name"
    )
    .eq("slug", slug)
    .maybeSingle();

  if (!row.data) return <InvalidLink reason="not-found" />;
  if (row.data.edit_token !== token) return <InvalidLink reason="bad-token" />;

  const tier = effectiveTier({
    tier: row.data.tier ?? "standard",
    trial_expires_at: row.data.trial_expires_at ?? null
  });
  const isPaid = tier === "app_trial" || tier === "app_paid" || tier === "app_verified";
  const addonsMap =
    row.data.addons_enabled && typeof row.data.addons_enabled === "object"
      ? (row.data.addons_enabled as Record<string, boolean>)
      : {};
  const addonOn = addonsMap.online_payments === true;

  const upgradeHref = `/trade-off/upgrade?slug=${encodeURIComponent(slug)}&token=${encodeURIComponent(token)}`;
  const backHref = `/trade-off/edit/${encodeURIComponent(slug)}?token=${encodeURIComponent(token)}`;

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
          Add-on &middot; Online Payments
        </p>
        <h1 className="mt-2 text-3xl font-extrabold leading-tight sm:text-4xl">
          Online Payments
        </h1>
        <p className="mt-3 max-w-2xl text-[13px] text-brand-muted">
          Connect any UK payment provider. Funds settle direct to your
          bank — we never touch the money, we hold no card data. Stripe,
          PayPal and Square get one-click connect in the next release.
          For now, paste a hosted-pay link from any provider and you&rsquo;re
          live in 60 seconds.
        </p>
      </section>

      <PaymentsEditorIsland
        slug={slug}
        token={token}
        addonOn={addonOn}
        isPaid={isPaid}
        upgradeHref={upgradeHref}
        initialProvider={(row.data.payment_provider ?? null) as string | null}
        initialLinkTemplate={row.data.payment_link_template ?? ""}
        initialLinkProviderName={row.data.payment_link_provider_name ?? ""}
        initialStripeInfo={buildStripeInfo(row.data.payment_provider_data)}
        initialPaypalInfo={buildPaypalInfo(row.data.payment_provider_data)}
        initialSquareInfo={buildSquareInfo(row.data.payment_provider_data)}
      />

      <DashboardFooter slug={slug} token={token} />
    </main>
  );
}

function asRec(x: unknown): Record<string, unknown> {
  return x && typeof x === "object" ? (x as Record<string, unknown>) : {};
}
function buildStripeInfo(raw: unknown) {
  const d = asRec(raw);
  const saved = typeof d.stripe_key_encrypted === "string" && d.stripe_key_encrypted.length > 0;
  return {
    saved,
    account_name: (d.stripe_account_name as string | null) ?? null,
    country: (d.stripe_country as string | null) ?? null,
    charges_enabled: d.stripe_charges_enabled === true,
    mode: (d.stripe_key_mode as "live" | "test" | undefined) ?? undefined,
    masked: undefined
  };
}
function buildPaypalInfo(raw: unknown) {
  const d = asRec(raw);
  const saved = typeof d.paypal_client_secret_encrypted === "string" && d.paypal_client_secret_encrypted.length > 0;
  return {
    saved,
    client_id: (d.paypal_client_id as string | undefined) ?? undefined,
    env: (d.paypal_env as "sandbox" | "live" | undefined) ?? undefined
  };
}
function buildSquareInfo(raw: unknown) {
  const d = asRec(raw);
  const saved = typeof d.square_access_token_encrypted === "string" && d.square_access_token_encrypted.length > 0;
  return {
    saved,
    location_id: (d.square_location_id as string | undefined) ?? undefined,
    location_name: (d.square_location_name as string | null) ?? null,
    country: (d.square_country as string | null) ?? null,
    env: (d.square_env as "sandbox" | "production" | undefined) ?? undefined
  };
}

function InvalidLink({ reason }: { reason: string }) {
  return (
    <main className="min-h-screen bg-brand-bg text-brand-text">
      <DashboardHeader />
      <section className="mx-auto max-w-md px-4 pb-24 pt-16 text-center">
        <h1 className="text-2xl font-extrabold">Link expired or invalid</h1>
        <p className="mt-3 text-[13px] text-brand-muted">
          Re-open your dashboard from the link in your email to manage
          Online Payments. ({reason})
        </p>
      </section>
    </main>
  );
}
