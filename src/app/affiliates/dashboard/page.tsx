// Affiliate dashboard — Overview tab.
//
// Computes the big stats grid from clicks / commissions, renders the
// referral link + QR code, and surfaces the "Payment is due" yellow
// banner when approved commission >= £50 AND payment details are
// incomplete.
import Link from "next/link";
import { readAffiliateSessionServer } from "@/lib/affiliateSession";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { CopyButton } from "./CopyButton";
import {
  LEVEL_META,
  computeLevelFromPaidCount,
  progressToNextLevel,
  type AffiliateLevel
} from "@/lib/affiliateLevel";
import { listActiveCampaigns } from "@/lib/affiliateCampaigns";
import { PageExplainer } from "@/components/xrated/affiliate/PageExplainer";
import { SetupChecklist } from "@/components/xrated/affiliate/SetupChecklist";

export const dynamic = "force-dynamic";

function pounds(pence: number): string {
  return `£${(pence / 100).toFixed(2)}`;
}

function pct(num: number, den: number): string {
  if (!den) return "—";
  return `${((num / den) * 100).toFixed(1)}%`;
}

export default async function AffiliateOverviewPage() {
  const session = await readAffiliateSessionServer();
  if (!session) return null;
  const id = session.affiliate_id;

  // Stats — done in parallel as small targeted queries. Each returns
  // a count or sum; we never load full rowsets here.
  const [clicks, distinctIps, signups, paidSignups, commissionsByStatus, payments, affiliateBio] =
    await Promise.all([
      supabaseAdmin
        .from("hammerex_affiliate_clicks")
        .select("id", { count: "exact", head: true })
        .eq("affiliate_id", id),
      supabaseAdmin
        .from("hammerex_affiliate_clicks")
        .select("ip")
        .eq("affiliate_id", id),
      supabaseAdmin
        .from("hammerex_trade_off_listings")
        .select("id", { count: "exact", head: true })
        .eq("affiliate_referrer_id", id),
      supabaseAdmin
        .from("hammerex_trade_off_listings")
        .select("id", { count: "exact", head: true })
        .eq("affiliate_referrer_id", id)
        .in("tier", ["app_paid", "app_verified"]),
      supabaseAdmin
        .from("hammerex_affiliate_commissions")
        .select("status, amount_pence")
        .eq("affiliate_id", id),
      supabaseAdmin
        .from("hammerex_affiliates")
        .select("payment_details_completed_at")
        .eq("affiliate_id", id)
        .maybeSingle(),
      supabaseAdmin
        .from("hammerex_affiliates")
        .select("bio")
        .eq("affiliate_id", id)
        .maybeSingle()
    ]);
  const bio = affiliateBio.data?.bio ?? null;

  const clickCount = clicks.count ?? 0;
  const distinctVisitors = new Set(
    (distinctIps.data ?? []).map((r) => r.ip).filter(Boolean)
  ).size;
  const signupCount = signups.count ?? 0;
  const paidCount = paidSignups.count ?? 0;

  const commissions = commissionsByStatus.data ?? [];
  let pendingPence = 0;
  let approvedPence = 0;
  let paidPence = 0;
  let paidCommissionCount = 0;
  for (const c of commissions) {
    if (c.status === "pending") pendingPence += c.amount_pence;
    else if (c.status === "approved") approvedPence += c.amount_pence;
    else if (c.status === "paid") {
      paidPence += c.amount_pence;
      paidCommissionCount += 1;
    }
  }
  const level: AffiliateLevel = computeLevelFromPaidCount(paidCommissionCount);
  const levelMeta = LEVEL_META[level];
  const progress = progressToNextLevel(paidCommissionCount);
  const activeCampaigns = await listActiveCampaigns();

  // Monthly = paid commissions in current calendar month.
  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);
  const monthlyRows = await supabaseAdmin
    .from("hammerex_affiliate_commissions")
    .select("amount_pence")
    .eq("affiliate_id", id)
    .eq("status", "paid")
    .gte("paid_at", monthStart.toISOString());
  const monthlyPence = (monthlyRows.data ?? []).reduce(
    (sum, c) => sum + c.amount_pence,
    0
  );

  const referralUrl = `https://xratedtrade.com/?ref=${id}`;
  const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&margin=4&data=${encodeURIComponent(referralUrl)}`;

  const paymentDetailsMissing = !payments.data?.payment_details_completed_at;
  const showPaymentBanner = paymentDetailsMissing && approvedPence >= 5000;

  // Setup checklist data — light-touch existence checks for the four
  // onboarding steps. The link generator is stateless (no DB table) so
  // we treat "has any click recorded" as a proxy for "has shared a
  // generated link at least once".
  const [setupAff, socialLinksCount] = await Promise.all([
    supabaseAdmin
      .from("hammerex_affiliates")
      .select("avatar_url")
      .eq("affiliate_id", id)
      .maybeSingle(),
    supabaseAdmin
      .from("hammerex_affiliate_social_links")
      .select("id", { count: "exact", head: true })
      .eq("affiliate_id", id)
  ]);
  const hasAvatar = Boolean(setupAff.data?.avatar_url);
  const hasPaymentDetails = !paymentDetailsMissing;
  const hasCustomLinks = clickCount > 0;
  const hasSocialLinks = (socialLinksCount.count ?? 0) > 0;

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-extrabold sm:text-3xl">Overview</h1>
        <p className="mt-1 text-[13px] text-brand-muted">
          Your affiliate ID is <strong>#{id}</strong>. Share the link below
          — when someone signs up as a tradesperson and upgrades, you earn
          £10.
        </p>
        {bio && (
          <p className="mt-3 max-w-2xl text-[13px] leading-relaxed text-brand-text">
            {bio}
          </p>
        )}
      </header>

      <PageExplainer
        title="Your at-a-glance affiliate dashboard"
        description="This page shows everything you've earned, who you've referred, and how close you are to your next level. Stats update in real-time as your referrals grow."
        steps={[
          "Copy your referral link from below",
          "Share it on social media or with friends",
          "Track new clicks and signups here",
          "Get paid once your earnings hit £50"
        ]}
      />

      <SetupChecklist
        hasAvatar={hasAvatar}
        hasPaymentDetails={hasPaymentDetails}
        hasCustomLinks={hasCustomLinks}
        hasSocialLinks={hasSocialLinks}
      />

      <section
        className="rounded-xl border bg-brand-surface p-5"
        style={{ borderColor: levelMeta.accent }}
      >
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[13px] uppercase tracking-wider text-brand-muted">
              Current level
            </p>
            <p
              className="mt-1 text-2xl font-extrabold"
              style={{ color: levelMeta.accent }}
            >
              {levelMeta.label}
            </p>
            <p className="mt-1 text-[13px] text-brand-muted">
              {paidCommissionCount} paid referral{paidCommissionCount === 1 ? "" : "s"} lifetime.
            </p>
          </div>
          <div className="min-w-[220px] flex-1">
            {progress.next ? (
              <>
                <p className="text-[13px] text-brand-muted">
                  {progress.needed} more paid referral{progress.needed === 1 ? "" : "s"} to{" "}
                  <strong style={{ color: LEVEL_META[progress.next].accent }}>
                    {LEVEL_META[progress.next].label}
                  </strong>
                </p>
                <div
                  className="mt-2 h-2 w-full overflow-hidden rounded-full bg-brand-bg"
                  aria-label="Progress to next level"
                >
                  <div
                    className="h-full"
                    style={{
                      width: `${progress.percent}%`,
                      backgroundColor: levelMeta.accent
                    }}
                  />
                </div>
              </>
            ) : (
              <p className="text-[13px] text-brand-muted">
                Top tier reached — Platinum perks unlocked.
              </p>
            )}
            <p className="mt-3 text-[13px] leading-snug text-brand-muted">
              {levelMeta.perks}
            </p>
          </div>
        </div>
      </section>

      {activeCampaigns.length > 0 && (
        <section className="rounded-xl border border-brand-accent bg-brand-accent/10 p-5">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.22em] text-brand-accent">
            Active promotions
          </p>
          <ul className="mt-2 space-y-2 text-[13px] leading-snug text-brand-text">
            {activeCampaigns.map((c) => (
              <li key={c.id}>
                <strong>{c.title}</strong>
                {c.description ? <> — {c.description}</> : null}{" "}
                <span className="text-brand-muted">
                  · Ends {new Date(c.ends_at).toLocaleDateString("en-GB")}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {showPaymentBanner && (
        <div className="rounded-xl border border-brand-accent bg-brand-accent/15 p-4 text-[13px] leading-relaxed text-brand-text">
          <p className="font-bold text-brand-accent">Payment is due.</p>
          <p className="mt-1">
            You have {pounds(approvedPence)} of approved commission waiting.
            Complete your payment details so we can pay you in the next
            payout cycle.
          </p>
          <Link
            href="/affiliates/dashboard/payment-details"
            className="mt-3 inline-flex h-10 items-center justify-center rounded-lg bg-brand-accent px-4 text-[13px] font-bold text-black"
          >
            Complete payment details →
          </Link>
        </div>
      )}

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <Stat label="Clicks" value={String(clickCount)} />
        <Stat label="Visitors" value={String(distinctVisitors)} />
        <Stat label="Free signups" value={String(signupCount)} />
        <Stat label="Paid members" value={String(paidCount)} />
        <Stat label="Conversion" value={pct(paidCount, clickCount)} />
        <Stat label="Pending commission" value={pounds(pendingPence)} />
        <Stat label="Approved commission" value={pounds(approvedPence)} />
        <Stat label="Paid commission" value={pounds(paidPence)} />
        <Stat label="Monthly earnings" value={pounds(monthlyPence)} />
        <Stat
          label="Lifetime earnings"
          value={pounds(approvedPence + paidPence)}
        />
      </section>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_auto]">
        <div className="rounded-xl border border-brand-line bg-brand-surface p-5">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.22em] text-brand-accent">
            Your referral link
          </p>
          <p className="mt-2 break-all text-[13px] font-mono text-brand-text">
            {referralUrl}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <CopyButton text={referralUrl} />
            <Link
              href="/affiliates/dashboard/links"
              className="inline-flex h-10 items-center justify-center rounded-lg border border-brand-line bg-brand-bg px-3 text-[13px] font-bold text-brand-text hover:bg-brand-line"
            >
              Build a deep link
            </Link>
          </div>
          <p className="mt-3 text-[13px] leading-relaxed text-brand-muted">
            Cookie lasts 30 days from the visitor&apos;s first click. If they
            sign up as a tradesperson and upgrade within that window, you
            earn £10.
          </p>
        </div>
        <div className="flex flex-col items-center rounded-xl border border-brand-line bg-brand-surface p-5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={qrSrc}
            alt="QR code for your affiliate link"
            width={200}
            height={200}
            className="block rounded-md bg-white p-2"
          />
          <p className="mt-3 text-[13px] text-brand-muted">Scan to share</p>
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-brand-line bg-brand-surface p-4">
      <p className="text-[13px] uppercase tracking-wider text-brand-muted">
        {label}
      </p>
      <p className="mt-1 text-xl font-extrabold text-brand-text">{value}</p>
    </div>
  );
}
