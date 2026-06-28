// Insights sub-page — Trust Score gauge + Tier Status + Welcome Knife
// voucher. Pulled off the main edit page so editing data stays
// distraction-free. A tradesperson checks their score and tier here
// when they want to, instead of having it stare at them every time
// they open the dashboard.

import type { Metadata } from "next";
import Link from "next/link";
import { XratedHeader } from "@/components/xrated/XratedHeader";
import { XratedFooter } from "@/components/xrated/XratedFooter";
import { DashboardDrawer } from "@/components/trade-off/DashboardDrawer";
import { TrustScorePanel } from "@/components/trade-off/TrustScorePanel";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { adminWhatsapp } from "@/lib/whatsapp";
import { whatsappDigits } from "@/lib/tradeOff";
import { effectiveTier, trialDaysRemaining } from "@/lib/xratedTrades";
import { maybeExpireListingTier } from "@/lib/xratedTier";
import type { HammerexXratedVoucher } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Insights | Xrated Trades",
  robots: { index: false, follow: false }
};

type SearchParams = Promise<{ token?: string | string[] }>;
type Params = Promise<{ slug: string }>;

export default async function InsightsPage({
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

  const voucherRes = await supabaseAdmin
    .from("hammerex_xrated_vouchers")
    .select(
      "id, listing_id, code, product_slug, status, issued_at, expires_at, redeemed_at, redeemed_order_ref, admin_note"
    )
    .eq("listing_id", row.data.id)
    .order("issued_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const voucher = (voucherRes.data ?? null) as HammerexXratedVoucher | null;
  const trialDays =
    tier === "app_trial" ? trialDaysRemaining(row.data.trial_expires_at) : null;
  const upgradeHref = `/trade-off/upgrade?slug=${encodeURIComponent(slug)}&token=${encodeURIComponent(token)}`;
  const adminWaDigits = whatsappDigits(adminWhatsapp());
  const billingWaUrl = `https://wa.me/${adminWaDigits}?text=${encodeURIComponent(
    `Hi Xrated Trades — manage billing for ${row.data.display_name} (${row.data.slug}).`
  )}`;

  return (
    <main className="min-h-screen bg-white text-neutral-900">
      <XratedHeader />
      <DashboardDrawer slug={slug} token={token} current="insights" />

      <section className="mx-auto max-w-3xl px-4 pb-6 pt-10 sm:px-6">
        <p
          className="text-[10px] font-extrabold uppercase tracking-[0.22em]"
          style={{ color: "#FFB300" }}
        >
          Insights
        </p>
        <h1 className="mt-2 text-3xl font-extrabold leading-tight sm:text-4xl">
          How {row.data.display_name} is doing
        </h1>
        <p className="mt-3 max-w-2xl text-[13px] leading-relaxed text-neutral-500 sm:text-sm">
          Your live Trust Score, tier status, and any active rewards.
          Check in here when you want to — none of this affects how
          buyers see your profile right now.
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
        <TrustScorePanel
          listing={row.data}
          tier={tier === "app_trial" || tier === "app_paid" || tier === "app_verified" ? "paid" : "free"}
        />
        <TierStatusCard
          tier={tier}
          trialDays={trialDays}
          upgradeHref={upgradeHref}
          billingWaUrl={billingWaUrl}
        />
        {voucher && <WelcomeKnifeCard voucher={voucher} />}
      </section>

      <XratedFooter />
    </main>
  );
}

function TierStatusCard({
  tier,
  trialDays,
  upgradeHref,
  billingWaUrl
}: {
  tier: string;
  trialDays: number | null;
  upgradeHref: string;
  billingWaUrl: string;
}) {
  const label =
    tier === "app_verified"
      ? "Xrated App · Verified"
      : tier === "app_paid"
        ? "Xrated App · Paid"
        : tier === "app_trial"
          ? `Xrated App · Trial${trialDays !== null ? ` (${trialDays} day${trialDays === 1 ? "" : "s"} left)` : ""}`
          : tier === "app_expired"
            ? "Xrated App · Expired"
            : "Standard tier";
  const isPaid = tier === "app_paid" || tier === "app_verified";
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm sm:p-6">
      <p
        className="text-[10px] font-extrabold uppercase tracking-[0.22em]"
        style={{ color: "var(--trade-accent, #FFB300)" }}
      >
        Plan
      </p>
      <h2 className="mt-1 text-xl font-extrabold text-neutral-900">
        {label}
      </h2>
      <p className="mt-1 text-[13px] leading-snug text-neutral-500">
        {isPaid
          ? "Your Xrated App is fully active. Manage billing on WhatsApp."
          : tier === "app_trial"
            ? "All app features unlocked for free during your trial. Upgrade any time to keep them on."
            : tier === "app_expired"
              ? "Premium features turned off after the trial expired. Upgrade to bring them back."
              : "Free standard listing. Upgrade to unlock theme, hero text, animations, products, and more."}
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        {!isPaid && (
          <a
            href={upgradeHref}
            className="inline-flex h-11 items-center rounded-xl px-4 text-[13px] font-extrabold text-neutral-900 shadow-sm"
            style={{ background: "var(--trade-accent, #FFB300)" }}
          >
            Upgrade plan
          </a>
        )}
        <a
          href={billingWaUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-11 items-center rounded-xl border border-neutral-200 bg-white px-4 text-[13px] font-bold text-neutral-900 transition hover:border-neutral-400"
        >
          Manage billing on WhatsApp
        </a>
      </div>
    </div>
  );
}

function WelcomeKnifeCard({ voucher }: { voucher: HammerexXratedVoucher }) {
  const expiry = (() => {
    if (!voucher.expires_at) return "no expiry";
    const d = new Date(voucher.expires_at);
    if (!Number.isFinite(d.getTime())) return voucher.expires_at;
    return d.toLocaleDateString("en-GB");
  })();
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm sm:p-6">
      <p
        className="text-[10px] font-extrabold uppercase tracking-[0.22em]"
        style={{ color: "var(--trade-accent, #FFB300)" }}
      >
        Welcome gift
      </p>
      <h2 className="mt-1 text-xl font-extrabold text-neutral-900">
        Voucher · {voucher.status.toUpperCase()}
      </h2>
      <p className="mt-2 font-mono text-base font-extrabold text-neutral-900">
        {voucher.code}
      </p>
      <p className="mt-1 text-[13px] leading-snug text-neutral-500">
        {voucher.status === "unused"
          ? `Use this on your next Hammerex order. Expires ${expiry}.`
          : voucher.status === "redeemed"
            ? `Redeemed${voucher.redeemed_order_ref ? ` on order ${voucher.redeemed_order_ref}` : ""}.`
            : "This voucher is no longer redeemable."}
      </p>
    </div>
  );
}

function InvalidLink({ reason }: { reason: "missing-token" | "not-found" | "bad-token" }) {
  const adminWaDigits = whatsappDigits(adminWhatsapp());
  const waUrl = `https://wa.me/${adminWaDigits}?text=${encodeURIComponent(
    "Hi Xrated Trades — I need help opening Insights."
  )}`;
  const copy: Record<typeof reason, string> = {
    "missing-token":
      "This Insights link is missing its secure token. Use the link in your welcome email or message us to get a new one.",
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
          Insights
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
