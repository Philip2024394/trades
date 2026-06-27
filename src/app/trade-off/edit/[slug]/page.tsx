// Hammerex Trade Off — edit flow
// Server shell that validates the magic-link token, loads the listing,
// and hands it to the shared TradeOffForm in "edit" mode.
//
// If the token is missing or invalid, we render a friendly error with a
// WhatsApp escape hatch — not a 404, so tradies who fat-finger the URL
// still get a useful page.

import type { Metadata } from "next";
import Link from "next/link";
import { XratedHeader } from "@/components/xrated/XratedHeader";
import { XratedFooter } from "@/components/xrated/XratedFooter";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { adminWhatsapp } from "@/lib/whatsapp";
import { whatsappDigits } from "@/lib/tradeOff";
import { effectiveTier, trialDaysRemaining } from "@/lib/xratedTrades";
import { maybeExpireListingTier } from "@/lib/xratedTier";
import { TradeOffForm, type TradeOffFormInitial } from "../../signup/TradeOffForm";
import { PremiumCustomisationPanel } from "./PremiumCustomisationPanel";
import { AddOnsHub } from "@/components/trade-off/AddOnsHub";
import { VideoUploadInput } from "@/components/trade-off/VideoUploadInput";
import { WhatsappLeadsNudge } from "@/components/trade-off/WhatsappLeadsNudge";
import { LossAversionPreview } from "@/components/trade-off/LossAversionPreview";
import { TrustScorePanel } from "@/components/trade-off/TrustScorePanel";
import { BusinessCardPanel } from "@/components/trade-off/BusinessCardPanel";
import { LeadAlertsSetupCard } from "@/components/trade-off/LeadAlertsSetupCard";
import { isLeadAlertsOn } from "@/lib/xratedAddons";
import type { HammerexXratedVoucher } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Edit your Trade Off profile | Hammerex",
  robots: { index: false, follow: false }
};

type SearchParams = Promise<{ token?: string | string[] }>;
type Params = Promise<{ slug: string }>;

export default async function TradeOffEditPage({
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

  // Lazy tier expiry — keeps the dashboard accurate without a cron.
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

  // Welcome Knife voucher — best-effort fetch. Tradies who signed up
  // before the voucher feature shipped (or whose listing went 'live' via
  // an edit rather than first submit) may not have one yet; the card
  // simply hides in that case.
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
  const upgradeAnnualHref = `${upgradeHref}&plan=annual`;
  // ── Conversion mechanics ───────────────────────────────────────────────
  // Mechanic 1 — nudge modal when a trial tradie's profile has earned at
  //              least 3 WhatsApp clicks and they haven't dismissed in the
  //              last 7 days.
  // Mechanic 2 — day-25 loss-aversion banner when the trial has 1-5 days
  //              left, regardless of click count.
  const whatsappClickCount =
    typeof row.data.whatsapp_click_count === "number"
      ? row.data.whatsapp_click_count
      : 0;
  const nudgeDismissedAt =
    typeof row.data.upgrade_nudge_dismissed_at === "string"
      ? row.data.upgrade_nudge_dismissed_at
      : null;
  const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
  const dismissedRecently =
    !!nudgeDismissedAt &&
    Date.now() - new Date(nudgeDismissedAt).getTime() < SEVEN_DAYS_MS;
  const showLeadsNudge =
    tier === "app_trial" && whatsappClickCount >= 3 && !dismissedRecently;
  const showLossPreview =
    tier === "app_trial" &&
    typeof trialDays === "number" &&
    trialDays >= 1 &&
    trialDays <= 5;
  const previewHref = `/trade/${encodeURIComponent(slug)}?preview=standard`;
  const adminWaDigits = whatsappDigits(adminWhatsapp());
  const billingWaUrl = `https://wa.me/${adminWaDigits}?text=${encodeURIComponent(
    `Hi Xrated Trades — manage billing for ${row.data.display_name} (${row.data.slug}).`
  )}`;

  const initial: TradeOffFormInitial = {
    display_name: row.data.display_name ?? "",
    trading_name: row.data.trading_name ?? "",
    primary_trade: row.data.primary_trade ?? "",
    secondary_trades: Array.isArray(row.data.secondary_trades) ? row.data.secondary_trades : [],
    city: row.data.city ?? "",
    country: row.data.country ?? "United Kingdom",
    postcode_prefix: row.data.postcode_prefix ?? "",
    service_postcodes: Array.isArray(row.data.service_postcodes)
      ? row.data.service_postcodes.join(", ")
      : "",
    whatsapp: row.data.whatsapp ?? "",
    phone: row.data.phone ?? "",
    email: row.data.email ?? "",
    website: row.data.website ?? "",
    instagram: row.data.instagram ?? "",
    facebook: row.data.facebook ?? "",
    tiktok: row.data.tiktok ?? "",
    youtube: row.data.youtube ?? "",
    twitter: row.data.twitter ?? "",
    snapchat: row.data.snapchat ?? "",
    reddit: row.data.reddit ?? "",
    google: row.data.google ?? "",
    bio: row.data.bio === "(draft)" ? "" : row.data.bio ?? "",
    years_in_trade:
      row.data.years_in_trade === null || row.data.years_in_trade === undefined
        ? ""
        : String(row.data.years_in_trade),
    start_year:
      row.data.start_year === null || row.data.start_year === undefined
        ? ""
        : String(row.data.start_year),
    avatar_url: row.data.avatar_url ?? "",
    photos: Array.isArray(row.data.photos) ? row.data.photos : []
  };

  return (
    <main className="min-h-screen bg-brand-bg text-brand-text">
      <XratedHeader />
      <section className="mx-auto max-w-3xl px-4 pb-6 pt-10">
        <p className="text-xs font-bold uppercase tracking-widest text-brand-accent">
          Trade Off · Edit profile
        </p>
        <h1 className="mt-2 text-3xl font-extrabold leading-tight sm:text-4xl">
          {row.data.display_name}
        </h1>
        <p className="mt-3 text-xs text-brand-muted">
          Status:{" "}
          <span
            className={
              row.data.status === "live"
                ? "font-semibold text-brand-success"
                : "font-semibold text-brand-text"
            }
          >
            {row.data.status.toUpperCase()}
          </span>
          {row.data.status === "hidden" && (
            <span className="ml-2 text-brand-muted">
              (hidden — message Hammerex on WhatsApp to appeal)
            </span>
          )}
        </p>
      </section>
      <section className="mx-auto max-w-3xl px-4 pb-4">
        <a
          href={`/trade-off/edit/${encodeURIComponent(slug)}/projects?token=${encodeURIComponent(token)}`}
          className="inline-flex h-11 items-center rounded-lg border border-brand-accent bg-brand-accent/10 px-4 text-xs font-bold text-brand-accent transition hover:bg-brand-accent hover:text-black"
        >
          Manage your verified work →
        </a>
      </section>

      {/* My Business Card — free for every tier. One-tap WhatsApp share
          of a server-generated card PNG. Placed high in the dashboard
          because it's the viral lever (every shared card carries the
          slug URL + QR). */}
      <section className="mx-auto max-w-3xl px-4 pb-6">
        <BusinessCardPanel
          slug={slug}
          displayName={row.data.display_name ?? ""}
          primaryTrade={row.data.primary_trade ?? ""}
          city={row.data.city ?? ""}
          whatsapp={row.data.whatsapp ?? ""}
          tradingName={row.data.trading_name ?? null}
        />
      </section>

      {/* Trust Score panel — shows the live 0-100 gauge + the 8-item
          checklist + tip per unearned item. Sits at the top of the
          dashboard so it's the first thing the tradesperson sees and
          updates the moment any related field is saved. */}
      <TrustScorePanel
        listing={row.data}
        tier={tier === "app_trial" || tier === "app_paid" ? "paid" : "free"}
      />

      {/* Lead Alerts setup card — high in the dashboard because
          subscribing the tradesperson's phone is a critical setup
          task, not an add-on toggle. The card itself surfaces the
          upgrade CTA if they're not on a paid tier. */}
      <LeadAlertsSetupCard
        slug={slug}
        editToken={token}
        vapidPublicKey={process.env.NEXT_PUBLIC_XRATED_VAPID_PUBLIC_KEY ?? ""}
        isPaidTier={tier === "app_trial" || tier === "app_paid"}
        addonEnabled={isLeadAlertsOn(row.data)}
        upgradeHref={upgradeHref}
      />

      {showLeadsNudge && (
        <WhatsappLeadsNudge
          slug={slug}
          editToken={token}
          clickCount={whatsappClickCount}
          upgradeHref={upgradeAnnualHref}
        />
      )}

      {showLossPreview && (
        <section className="mx-auto max-w-3xl px-4 pb-6">
          <LossAversionPreview
            slug={slug}
            daysRemaining={trialDays as number}
            trialExpiresAt={row.data.trial_expires_at ?? null}
            upgradeAnnualHref={upgradeAnnualHref}
            previewHref={previewHref}
          />
        </section>
      )}

      {voucher && (
        <section className="mx-auto max-w-3xl px-4 pb-6">
          <WelcomeKnifeCard voucher={voucher} />
        </section>
      )}

      <section className="mx-auto max-w-3xl px-4 pb-6">
        <TierStatusCard
          tier={tier}
          trialDays={trialDays}
          upgradeHref={upgradeHref}
          billingWaUrl={billingWaUrl}
        />
      </section>

      <section className="mx-auto max-w-3xl px-4 pb-10">
        <TradeOffForm
          mode={{ kind: "edit", slug, editToken: token }}
          initial={initial}
        />
      </section>

      <section className="mx-auto max-w-3xl px-4 pb-10">
        <AddOnsHub listing={row.data} editToken={token} tier={tier} />
      </section>

      {/* Self-hosted intro video uploader. Bypasses YouTube — file
          uploads direct to Supabase Storage, no Vercel-body limits.
          Available on every tier; ≤60s, ≤30 MB, MP4/MOV/WebM. */}
      {(tier === "app_trial" || tier === "app_paid") && (
        <section className="mx-auto max-w-3xl px-4 pb-10">
          <VideoUploadInput
            listingId={row.data.id}
            editToken={token}
            initialVideoUrl={row.data.video_url}
            initialCaption={row.data.video_caption}
          />
        </section>
      )}

      <section className="mx-auto max-w-3xl px-4 pb-16">
        {tier === "app_trial" || tier === "app_paid" ? (
          <PremiumCustomisationPanel
            slug={slug}
            editToken={token}
            primaryTrade={
              typeof row.data.primary_trade === "string" ? row.data.primary_trade : null
            }
            initial={{
              theme_color: row.data.theme_color ?? "#FFB300",
              button_text_color: row.data.button_text_color ?? "#FFFFFF",
              cta_button_effect: row.data.cta_button_effect ?? "none",
              hero_text_line1: row.data.hero_text_line1 ?? "",
              hero_text_line2: row.data.hero_text_line2 ?? "",
              hero_text_line2_color: row.data.hero_text_line2_color ?? "#FFB300",
              hero_text_tagline: row.data.hero_text_tagline ?? "",
              hero_text_effect: row.data.hero_text_effect ?? "none",
              avatar_frame_style: row.data.avatar_frame_style ?? "none",
              profile_placement: row.data.profile_placement ?? "center",
              running_marquee: row.data.running_marquee ?? "",
              promo_text: row.data.promo_text ?? "",
              accepting_jobs: row.data.accepting_jobs ?? true,
              services_offered: Array.isArray(row.data.services_offered)
                ? row.data.services_offered
                : [],
              priced_services: Array.isArray(row.data.priced_services)
                ? row.data.priced_services.map((p: { name?: unknown; image_url?: unknown; price?: unknown; unit?: unknown; description?: unknown }) => ({
                    name: typeof p.name === "string" ? p.name : "",
                    image_url: typeof p.image_url === "string" ? p.image_url : "",
                    price: typeof p.price === "number" ? p.price : 0,
                    unit: typeof p.unit === "string" ? p.unit : "per project",
                    description: typeof p.description === "string" ? p.description : ""
                  }))
                : [],
              faq_items: Array.isArray(row.data.faq_items)
                ? row.data.faq_items
                : [],
              operating_hours:
                row.data.operating_hours && typeof row.data.operating_hours === "object"
                  ? row.data.operating_hours
                  : {},
              contact_form_enabled: row.data.contact_form_enabled ?? false,
              visit_us_enabled: row.data.visit_us_enabled ?? false,
              availability:
                row.data.availability === "now" ||
                row.data.availability === "tomorrow" ||
                row.data.availability === "this_week" ||
                row.data.availability === "next_week" ||
                row.data.availability === "two_weeks" ||
                row.data.availability === "later"
                  ? row.data.availability
                  : "",
              headline_rate:
                row.data.headline_rate &&
                typeof row.data.headline_rate === "object" &&
                typeof (row.data.headline_rate as { amount?: unknown }).amount === "number"
                  ? {
                      amount: (row.data.headline_rate as { amount: number }).amount,
                      unit:
                        typeof (row.data.headline_rate as { unit?: unknown }).unit === "string"
                          ? ((row.data.headline_rate as { unit: string }).unit)
                          : "per day",
                      currency:
                        typeof (row.data.headline_rate as { currency?: unknown }).currency === "string"
                          ? ((row.data.headline_rate as { currency: string }).currency)
                          : "GBP"
                    }
                  : { amount: 0, unit: "per day", currency: "GBP" },
              // Trust & logistics — null-safe coercion (legacy rows have
              // undefined for the trust columns until they save once).
              is_insured: row.data.is_insured === true,
              insurance_cover_gbp:
                typeof row.data.insurance_cover_gbp === "number"
                  ? row.data.insurance_cover_gbp
                  : null,
              qualifications: Array.isArray(row.data.qualifications)
                ? row.data.qualifications.filter((x: unknown): x is string => typeof x === "string")
                : [],
              trade_memberships: Array.isArray(row.data.trade_memberships)
                ? row.data.trade_memberships.filter((x: unknown): x is string => typeof x === "string")
                : [],
              dbs_checked: row.data.dbs_checked === true,
              has_own_transport: row.data.has_own_transport === true,
              has_own_tools: row.data.has_own_tools === true,
              minimum_job_gbp:
                typeof row.data.minimum_job_gbp === "number"
                  ? row.data.minimum_job_gbp
                  : null,
              free_site_visits: row.data.free_site_visits === true,
              quote_availability:
                typeof row.data.quote_availability === "string"
                  ? row.data.quote_availability
                  : "",
              quote_turnaround_hours:
                typeof row.data.quote_turnaround_hours === "number"
                  ? row.data.quote_turnaround_hours
                  : null,
              current_status_note:
                typeof row.data.current_status_note === "string"
                  ? row.data.current_status_note
                  : "",
              ready_date:
                typeof row.data.ready_date === "string" ? row.data.ready_date : "",
              recommendations: Array.isArray(row.data.recommendations)
                ? row.data.recommendations
                    .map((r: { slug?: unknown; note?: unknown }) => ({
                      slug: typeof r.slug === "string" ? r.slug : "",
                      note: typeof r.note === "string" ? r.note : ""
                    }))
                    .filter((r: { slug: string }) => r.slug.length > 0)
                : []
            }}
          />
        ) : (
          <div className="rounded-xl border border-brand-line bg-brand-surface p-5">
            <p className="text-xs font-bold uppercase tracking-widest text-brand-accent">
              Premium customisation
            </p>
            <p className="mt-2 text-sm text-brand-text">
              Upgrade to Xrated App to customise your theme colour, hero text
              animations, avatar frame and CTA effects.
            </p>
            <Link
              href={upgradeHref}
              className="mt-4 inline-flex h-11 items-center rounded-lg bg-brand-accent px-4 text-xs font-bold text-black transition hover:opacity-90"
            >
              See upgrade options →
            </Link>
          </div>
        )}
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
  tier: "standard" | "app_trial" | "app_paid" | "app_expired";
  trialDays: number | null;
  upgradeHref: string;
  billingWaUrl: string;
}) {
  if (tier === "app_trial") {
    return (
      <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/5 p-4">
        <p className="text-sm font-bold text-emerald-700">
          Xrated App — Trial active
          {trialDays !== null && ` · ${trialDays} day${trialDays === 1 ? "" : "s"} remaining`}
        </p>
        <p className="mt-1 text-xs text-brand-muted">
          You're on the premium tier free until the trial ends. Upgrade now to
          keep your custom theme, hero text and CTA effects live after that.
        </p>
        <Link
          href={upgradeHref}
          className="mt-3 inline-flex h-10 items-center rounded-lg bg-brand-accent px-4 text-xs font-bold text-black transition hover:opacity-90"
        >
          Upgrade to keep premium features →
        </Link>
      </div>
    );
  }
  if (tier === "app_paid") {
    return (
      <div className="rounded-xl border border-brand-accent bg-brand-accent/10 p-4">
        <p className="text-sm font-bold text-brand-accent">Xrated App — Paid</p>
        <p className="mt-1 text-xs text-brand-muted">
          Thanks for supporting Xrated Trades. All premium features are unlocked.
        </p>
        <a
          href={billingWaUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-flex h-10 items-center rounded-lg border border-brand-line bg-brand-surface px-4 text-xs font-bold text-brand-text transition hover:border-brand-accent hover:text-brand-accent"
        >
          Manage billing → WhatsApp
        </a>
      </div>
    );
  }
  if (tier === "app_expired") {
    return (
      <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4">
        <p className="text-sm font-bold text-amber-700">
          Trial expired · You're back on Standard
        </p>
        <p className="mt-1 text-xs text-brand-muted">
          Your premium customisations are paused. Upgrade to bring them back.
        </p>
        <Link
          href={upgradeHref}
          className="mt-3 inline-flex h-10 items-center rounded-lg bg-amber-400 px-4 text-xs font-bold text-black transition hover:opacity-90"
        >
          Upgrade now →
        </Link>
      </div>
    );
  }
  // standard
  return (
    <div className="rounded-xl border border-brand-line bg-brand-surface p-4">
      <p className="text-sm font-bold text-brand-text">Free standard listing</p>
      <p className="mt-1 text-xs text-brand-muted">
        Try the Xrated App tier free for 30 days — custom theme, hero text
        effects, avatar frame and a running marquee.
      </p>
      <Link
        href={upgradeHref}
        className="mt-3 inline-flex h-10 items-center rounded-lg border border-brand-accent bg-brand-accent/10 px-4 text-xs font-bold text-brand-accent transition hover:bg-brand-accent hover:text-black"
      >
        Start your 30-day free trial →
      </Link>
    </div>
  );
}

function WelcomeKnifeCard({ voucher }: { voucher: HammerexXratedVoucher }) {
  const expiresAt = (() => {
    const d = new Date(voucher.expires_at);
    if (!Number.isFinite(d.getTime())) return voucher.expires_at;
    return d.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "long",
      year: "numeric"
    });
  })();
  const STATUS_LABEL: Record<HammerexXratedVoucher["status"], string> = {
    unused: "Unused",
    redeemed: "Redeemed",
    expired: "Expired",
    revoked: "Revoked"
  };
  const STATUS_CLS: Record<HammerexXratedVoucher["status"], string> = {
    unused: "border-[#FFB300] bg-[#FFB300]/15 text-[#FFB300]",
    redeemed: "border-emerald-500/50 bg-emerald-500/10 text-emerald-300",
    expired: "border-brand-line bg-brand-surface text-brand-muted",
    revoked: "border-red-500/50 bg-red-500/10 text-red-300"
  };
  const isUnused = voucher.status === "unused";
  return (
    <div
      className={`rounded-xl border-2 p-4 ${
        isUnused ? "border-[#FFB300] bg-[#FFB300]/10" : "border-brand-line bg-brand-surface"
      }`}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-xs font-bold uppercase tracking-widest text-[#FFB300]">
          <span aria-hidden="true" className="mr-1">🎁</span>
          Welcome gift voucher
        </p>
        <span
          className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold uppercase tracking-widest ${STATUS_CLS[voucher.status]}`}
        >
          {STATUS_LABEL[voucher.status]}
        </span>
      </div>
      <p className="mt-2 text-sm font-bold text-brand-text">
        FREE Hammerex Folding Safety Cutting Knife
      </p>
      <div className="mt-3 break-all rounded-lg border border-[#FFB300]/50 bg-black/80 px-3 py-2 text-center font-mono text-base font-extrabold tracking-widest text-[#FFB300] sm:text-lg">
        {voucher.code}
      </div>
      {isUnused ? (
        <p className="mt-3 text-xs text-brand-muted">
          Use this code on your next Hammerex order. Add it in the
          &ldquo;Voucher / promo code&rdquo; field at checkout — we&rsquo;ll
          throw a free knife in your box. No minimum spend. Expires {expiresAt}.
        </p>
      ) : voucher.status === "redeemed" ? (
        <p className="mt-3 text-xs text-brand-muted">
          Redeemed
          {voucher.redeemed_order_ref ? ` on order ${voucher.redeemed_order_ref}` : ""}
          {voucher.redeemed_at
            ? ` on ${new Date(voucher.redeemed_at).toLocaleDateString("en-GB")}`
            : ""}
          . Thanks for shopping Hammerex.
        </p>
      ) : (
        <p className="mt-3 text-xs text-brand-muted">
          This voucher is no longer redeemable. Message Hammerex on WhatsApp
          if you think this is a mistake.
        </p>
      )}
    </div>
  );
}

function InvalidLink({ reason }: { reason: string }) {
  const wa = adminWhatsapp().replace(/\D/g, "");
  const msg = encodeURIComponent(
    "Hi Hammerex — I'm trying to edit my Trade Off profile but my link isn't working. Can you help?"
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
          The edit URL you used doesn't match a live profile. Double-check the
          link in your bookmarks — the token after <code>?token=</code> must be
          exact.
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
