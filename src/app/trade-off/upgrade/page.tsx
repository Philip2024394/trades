// Xrated Trades — upgrade landing.
// Server component. Query params: ?slug=<slug>&token=<edit_token>.
//
// Renders the tier explainer + pricing grid. If a valid token is supplied
// we surface the in-page upgrade buttons; otherwise we show a "paste your
// edit link" hint. Tier flips to `app_paid` happen offline (manual review)
// — this page only opens the WhatsApp deep link.

import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { XratedHeader } from "@/components/xrated/XratedHeader";
import { XratedFooter } from "@/components/xrated/XratedFooter";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  XRATED_BRAND,
  XRATED_PRICING,
  effectiveTier,
  trialDaysRemaining
} from "@/lib/xratedTrades";
import { maybeExpireListingTier } from "@/lib/xratedTier";
import { UpgradeActions } from "./UpgradeActions";
import { XratedViewTracker } from "@/components/trade-off/XratedViewTracker";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Upgrade to Xrated App | Trade Off",
  description:
    "Unlock custom theme colours, animated hero text, avatar frames and CTA effects for your Trade Off profile.",
  robots: { index: false, follow: false }
};

type SearchParams = Promise<{
  slug?: string | string[];
  token?: string | string[];
}>;

function pickStr(v: string | string[] | undefined): string {
  if (Array.isArray(v)) return (v[0] ?? "").trim();
  return (v ?? "").trim();
}

const TIER_LABEL: Record<string, string> = {
  standard: "Standard (free)",
  app_trial: "Xrated App — Trial",
  app_paid: "Xrated App — Paid",
  app_expired: "Trial expired (Standard)"
};

export default async function UpgradePage({
  searchParams
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const slug = pickStr(sp.slug);
  const token = pickStr(sp.token);

  type ListingRow = {
    id: string;
    slug: string;
    display_name: string;
    edit_token: string;
    tier: "standard" | "app_trial" | "app_paid" | "app_expired";
    trial_expires_at: string | null;
  };
  let listing: ListingRow | null = null;

  if (slug) {
    const row = await supabaseAdmin
      .from("hammerex_trade_off_listings")
      .select("id, slug, display_name, edit_token, tier, trial_expires_at")
      .eq("slug", slug)
      .maybeSingle();
    if (row.data) {
      // Inline lazy expiry — keeps render and DB in sync without a cron.
      await maybeExpireListingTier(row.data.id);
      const refreshed = await supabaseAdmin
        .from("hammerex_trade_off_listings")
        .select("id, slug, display_name, edit_token, tier, trial_expires_at")
        .eq("id", row.data.id)
        .maybeSingle();
      listing = ((refreshed.data ?? row.data) as unknown) as ListingRow;
    }
  }

  const tokenValid = !!(listing && token && listing.edit_token === token);
  const effective = listing ? effectiveTier(listing) : null;
  const trialDays =
    listing && listing.tier === "app_trial"
      ? trialDaysRemaining(listing.trial_expires_at)
      : null;
  const canStartTrial =
    tokenValid &&
    listing !== null &&
    (listing.tier === "standard" || effective === "app_expired");

  return (
    <main className="min-h-screen bg-brand-bg text-brand-text">
      <XratedViewTracker page="upgrade" listingId={listing?.id ?? null} />
      <XratedHeader />

      <section className="mx-auto max-w-3xl px-4 pt-10 pb-6">
        <div className="flex items-center gap-3">
          <Image
            src={XRATED_BRAND.logoUrl}
            alt={XRATED_BRAND.name}
            width={48}
            height={48}
            unoptimized
            className="h-12 w-12 rounded-md object-contain"
          />
          <div>
            <p
              className="text-xs font-bold uppercase tracking-widest"
              style={{ color: XRATED_BRAND.accent }}
            >
              {XRATED_BRAND.name}
            </p>
            <h1 className="text-2xl font-extrabold leading-tight sm:text-4xl">
              Upgrade to Xrated App
            </h1>
          </div>
        </div>
        <p className="mt-4 text-sm text-brand-muted">
          Premium profile features — custom theme, animated hero text, avatar
          frame, CTA effects and a running marquee. 30 days free, then £
          {XRATED_PRICING.monthlyGbp}/month or £{XRATED_PRICING.annualGbp}/year.
        </p>
      </section>

      {/* Tier explainer */}
      <section className="mx-auto max-w-3xl px-4 pb-6">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-brand-line bg-brand-surface p-4">
            <p className="text-xs font-bold uppercase tracking-widest text-brand-muted">
              Standard · Free
            </p>
            <ul className="mt-3 space-y-1.5 text-sm text-brand-text">
              <li>· Basic profile + photos</li>
              <li>· WhatsApp + phone contact</li>
              <li>· Hammerex Standard badge (if matched)</li>
              <li>· Listed on directory pages</li>
            </ul>
          </div>
          <div
            className="rounded-xl border-2 p-4"
            style={{
              borderColor: XRATED_BRAND.accent,
              backgroundColor: "rgb(var(--brand-surface) / 1)"
            }}
          >
            <p
              className="text-xs font-bold uppercase tracking-widest"
              style={{ color: XRATED_BRAND.accent }}
            >
              App · Premium
            </p>
            <ul className="mt-3 space-y-1.5 text-sm text-brand-text">
              <li>· Custom theme colour + CTA effects</li>
              <li>· Animated hero text (shimmer / dance / underline)</li>
              <li>· Avatar frame styles (ring / pulse / dance)</li>
              <li>· Running marquee strip</li>
              <li>· Premium mini-app layout</li>
            </ul>
          </div>
        </div>
      </section>

      {/* Pricing grid — annual is the headline plan; monthly sits beside it
          as the lower-commitment alternative. The 5%-off Hammerex perk is
          only attached to annual, which is the wedge to push that plan. */}
      <section className="mx-auto max-w-3xl px-4 pb-6">
        <div className="grid gap-3 sm:grid-cols-2">
          <div
            className="relative rounded-xl border-2 p-5"
            style={{ borderColor: XRATED_BRAND.accent }}
          >
            <span
              className="absolute -top-3 right-4 rounded-full px-2 py-0.5 text-[11px] font-bold uppercase tracking-widest text-black"
              style={{ backgroundColor: XRATED_BRAND.accent }}
            >
              Save £{XRATED_PRICING.monthlyGbp * 12 - XRATED_PRICING.annualGbp}
            </span>
            <p
              className="text-xs font-bold uppercase tracking-widest"
              style={{ color: XRATED_BRAND.accent }}
            >
              Annual · Recommended
            </p>
            <p className="mt-2 text-3xl font-extrabold">
              £{XRATED_PRICING.annualGbp}
              <span className="ml-1 text-sm font-medium text-brand-muted">/year</span>
            </p>
            <p className="mt-2 text-xs text-brand-muted">
              Equivalent to £{(XRATED_PRICING.annualGbp / 12).toFixed(2)}/month.
            </p>
            <ul className="mt-3 space-y-1.5 text-[13px] text-brand-text">
              <li>· All Xrated App premium features</li>
              <li>
                <span className="font-bold text-brand-accent">
                  + 5% off Hammerex tools forever
                </span>{" "}
                while annual membership is active.
              </li>
            </ul>
          </div>
          <div className="rounded-xl border border-brand-line bg-brand-surface p-5">
            <p className="text-xs font-bold uppercase tracking-widest text-brand-muted">
              Monthly
            </p>
            <p className="mt-2 text-3xl font-extrabold">
              £{XRATED_PRICING.monthlyGbp}
              <span className="ml-1 text-sm font-medium text-brand-muted">/month</span>
            </p>
            <p className="mt-2 text-xs text-brand-muted">Cancel any time.</p>
          </div>
        </div>
        <p className="mt-3 text-[11px] text-brand-muted">
          {XRATED_PRICING.whatsappPaymentInstructions}
        </p>
      </section>

      {/* Tier status + actions */}
      <section className="mx-auto max-w-3xl px-4 pb-16">
        {!listing && (
          <div className="rounded-xl border border-brand-line bg-brand-surface p-4 text-sm text-brand-muted">
            Missing or unknown slug. Open this page from your edit link to see
            your current tier and upgrade options.
          </div>
        )}

        {listing && (
          <div className="rounded-xl border border-brand-line bg-brand-surface p-5">
            <p className="text-xs font-bold uppercase tracking-widest text-brand-muted">
              Currently on
            </p>
            <p className="mt-1 text-lg font-extrabold">
              {effective ? TIER_LABEL[effective] : TIER_LABEL.standard}
            </p>
            {trialDays !== null && (
              <p className="mt-1 text-xs text-brand-muted">
                {trialDays} day{trialDays === 1 ? "" : "s"} left of your free trial.
              </p>
            )}

            {!tokenValid && (
              <div className="mt-4 rounded-md border border-brand-line bg-brand-bg p-3 text-xs text-brand-muted">
                Paste your edit link in the browser address bar (including the
                <code className="mx-1">?token=…</code>) to enable the upgrade
                buttons. We need that token to confirm it's really you.
              </div>
            )}

            {tokenValid && (
              <UpgradeActions
                slug={listing.slug}
                token={token}
                canStartTrial={canStartTrial}
              />
            )}

            <p className="mt-4 text-[11px] text-brand-muted">
              Tradie: <span className="font-semibold text-brand-text">{listing.display_name}</span>
              {" · "}
              <Link
                href={`/trade/${encodeURIComponent(listing.slug)}`}
                className="underline hover:text-brand-accent"
              >
                View public profile
              </Link>
            </p>
          </div>
        )}
      </section>

      <XratedFooter />
    </main>
  );
}
