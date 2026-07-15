// thenetworkers.app Trade Off — edit flow
// Server shell that validates the magic-link token, loads the listing,
// and hands it to the shared TradeOffForm in "edit" mode.
//
// If the token is missing or invalid, we render a friendly error with a
// WhatsApp escape hatch — not a 404, so tradies who fat-finger the URL
// still get a useful page.

import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { DashboardHeader } from "@/components/trade-off/DashboardHeader";
import { DashboardFooter } from "@/components/trade-off/DashboardFooter";
import { DashboardDrawer } from "@/components/trade-off/DashboardDrawer";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { adminWhatsapp } from "@/lib/whatsapp";
import { isMerchantGradeTrade, tradeLabel, whatsappDigits } from "@/lib/tradeOff";
import { effectiveTier, trialDaysRemaining, XRATED_PRICING } from "@/lib/xratedTrades";
import { loadWasherBag } from "@/lib/washers";
import { maybeExpireListingTier } from "@/lib/xratedTier";
import {
  TRADE_SESSION_COOKIE_NAME,
  verifyTradeSession
} from "@/lib/tradeSession";
import { TradeOffForm, type TradeOffFormInitial } from "../../signup/TradeOffForm";
import { PremiumCustomisationPanel } from "./PremiumCustomisationPanel";
import { ManageSubscriptionCard } from "./ManageSubscriptionCard";
import { LogoutButton } from "./LogoutButton";
import { NotificationsBell } from "./NotificationsBell";
import { supabaseAdmin as supabaseAdminForNotifs } from "@/lib/supabaseAdmin";
import type { HammerexXratedVoucher } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Edit your thenetworkers.app profile | thenetworkers.app",
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
  const urlToken = typeof rawToken === "string" ? rawToken.trim() : "";

  if (!slug) redirect("/trade-off/login");

  // Auth precedence:
  //   1. URL ?token=<edit_token>  → magic-link / recovery entry. We
  //      verify it, mint a session, and continue (legacy fallback).
  //   2. xrated_trade_session cookie → primary day-2+ auth.
  //   3. neither → bounce to /trade-off/login.
  //
  // The token-in-URL path stays first so that share-with-yourself
  // links from the old email keep working forever; we just upgrade
  // the session in passing.
  const jar = await cookies();
  const sessionRaw = jar.get(TRADE_SESSION_COOKIE_NAME)?.value;
  const session = verifyTradeSession(sessionRaw);

  const row = await supabaseAdmin
    .from("hammerex_trade_off_listings")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();

  if (!row.data) {
    if (urlToken) return <InvalidLink reason="not-found" />;
    redirect("/trade-off/login");
  }

  // Token-in-URL path — verify and use as authority. We don't drop the
  // token from the URL automatically (we'd need a client redirect or
  // middleware); next time the user lands without ?token the session
  // cookie alone will let them in.
  let token: string;
  if (urlToken) {
    if (row.data.edit_token !== urlToken) {
      return <InvalidLink reason="bad-token" />;
    }
    token = urlToken;
  } else if (session && session.slug === slug) {
    // Session-only path. We don't have the edit_token in the URL, so
    // hand the dashboard the canonical one from the DB — every existing
    // API consumer reads from props.editToken / search params, so we
    // keep the contract identical.
    token = row.data.edit_token;
  } else {
    // No URL token AND no matching session → bounce to login.
    redirect("/trade-off/login");
  }

  // From here onwards `token` is the verified edit_token for the
  // requested slug (whether obtained via session lookup or URL param).

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

  // Load washer bag balance for the compact widget. Gracefully degrades
  // when the washer tables aren't yet applied — widget then shows a
  // dash instead of a hard-coded 47.
  let washerBalance: number | null = null;
  try {
    const bag = await loadWasherBag(slug);
    washerBalance = bag?.balance ?? null;
  } catch {
    washerBalance = null;
  }

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
    service_radius_km:
      typeof row.data.service_radius_km === "number"
        ? String(row.data.service_radius_km)
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
    custom_app_hero_url: row.data.custom_app_hero_url ?? "",
    video_url: row.data.video_url ?? "",
    starter_products: [
      { name: "", image_url: "", gallery_urls: [], price_pounds: "", description: "", multi_buy: [], variants_axis: "", variants_axis_label: "", variants_rows: [], faq: [] },
      { name: "", image_url: "", gallery_urls: [], price_pounds: "", description: "", multi_buy: [], variants_axis: "", variants_axis_label: "", variants_rows: [], faq: [] },
      { name: "", image_url: "", gallery_urls: [], price_pounds: "", description: "", multi_buy: [], variants_axis: "", variants_axis_label: "", variants_rows: [], faq: [] },
      { name: "", image_url: "", gallery_urls: [], price_pounds: "", description: "", multi_buy: [], variants_axis: "", variants_axis_label: "", variants_rows: [], faq: [] }
    ],
    retail_shipping_mode: (() => {
      const m = row.data.retail_shipping_mode;
      if (m === "pickup" || m === "free" || m === "uk_flat" || m === "uk_over_threshold") {
        return m;
      }
      return "";
    })(),
    retail_shipping_uk_pounds:
      typeof row.data.retail_shipping_uk_pence === "number" && row.data.retail_shipping_uk_pence > 0
        ? (row.data.retail_shipping_uk_pence / 100).toString()
        : "",
    retail_shipping_international: Array.isArray(row.data.retail_shipping_international)
      ? row.data.retail_shipping_international.map(
          (r: { country_code?: string; country_name?: string; price_pence?: number; dispatch_days?: number; delivery_days?: number }) => ({
            country_code: typeof r.country_code === "string" ? r.country_code : "",
            country_name: typeof r.country_name === "string" ? r.country_name : "",
            price_pounds:
              typeof r.price_pence === "number" ? (r.price_pence / 100).toString() : "",
            dispatch_days:
              typeof r.dispatch_days === "number" ? String(r.dispatch_days) : "1",
            delivery_days:
              typeof r.delivery_days === "number" ? String(r.delivery_days) : "5"
          })
        )
      : [],
    photos: Array.isArray(row.data.photos) ? row.data.photos : [],
    // Password is signup-only and the field is hidden on edit. We pass
    // an empty string so the type matches; nothing reads this on the
    // edit dashboard.
    password: ""
  };

  // Live unread-notification count for the bell — small standalone
  // query, cheap enough to run inline on every dashboard render.
  const { count: unreadCount } = await supabaseAdminForNotifs
    .from("hammerex_yard_targeted_notifications")
    .select("id", { count: "exact", head: true })
    .eq("recipient_listing_id", row.data.id)
    .eq("is_read", false)
    .gt("expires_at", new Date().toISOString());

  return (
    <main className="min-h-screen bg-brand-bg text-brand-text">
      <DashboardHeader />
      <DashboardDrawer slug={slug} token={token} current="profile" />
      <section className="mx-auto max-w-3xl px-4 pb-6 pt-10">
        <div className="flex items-start justify-between gap-3">
          <p
            className="text-[10px] font-extrabold uppercase tracking-[0.22em]"
            style={{ color: "var(--trade-accent, #FFB300)" }}
          >
            {row.data.primary_trade
              ? `Step 1 · ${tradeLabel(row.data.primary_trade)}`
              : "Step 1"}
          </p>
          <div className="flex items-center gap-2">
            <NotificationsBell
              slug={slug}
              token={token}
              unreadCount={unreadCount ?? 0}
            />
            <LogoutButton />
          </div>
        </div>
        <h1 className="mt-1 text-3xl font-extrabold leading-tight sm:text-4xl">
          App Details
        </h1>
        <p className="mt-2 text-[13px] leading-snug text-neutral-500 sm:text-sm">
          Less than 5 minutes and your new app is live.
        </p>
        {row.data.status !== "live" && (
          <p className="mt-3 text-[12px] text-neutral-500">
            Status:{" "}
            <span className="font-semibold text-neutral-900">
              {row.data.status.toUpperCase()}
            </span>
            {row.data.status === "hidden" && (
              <span className="ml-2 text-neutral-500">
                (hidden — message us on WhatsApp to appeal)
              </span>
            )}
          </p>
        )}
      </section>
      {/* "Manage your verified work" link removed from the top per
          design — verified-projects management lives at its own
          sub-route and shouldn't sit above the data-input form. */}

      {/* First-run checklist + The Yard nav + standalone Operating
          Hours nav card were all removed from this upload-profile
          page per design — they don't belong on a focused data-input
          page (the checklist also misleadingly claimed "your profile
          is N% set up" when a user was just exploring a template).
          Operating Hours editing still lives inside the Profile
          dashboard panel below where it logically belongs. */}

      {/* Score widgets, upsell nudges, tier-status cards and the
          notification-subscribe card were removed from this page in
          favour of a focused "edit your app data" experience. They
          live in dedicated drawer-accessible surfaces (Insights,
          Add-ons, Billing) so a tradesperson editing their profile
          isn't distracted by reports or promos while they type. */}

      {/* Profile customisation panel renders FIRST (Operating Hours,
          Trust signals, FAQ for service trades) so the TradeOffForm
          below it owns the final "Save changes (go live) / Save as
          draft" actions — those are the bottom-of-page CTA. */}

      {/* Essentials-complete heuristic — drives whether the Profile
          panel's advanced sections default open or stay collapsed.
          We're deliberately permissive: a listing only needs the
          basics (bio, avatar, ≥1 service or product, ≥1 day of hours)
          to count as "past day one". Power users see everything by
          default; first-timers get a calm view. */}
      {/* Washer bag widget — verified WA leads balance. Reads real
          balance from the DB via loadWasherBag(); falls back to a
          dash when the washer tables aren't yet applied. */}
      <section className="mx-auto max-w-3xl px-4 pb-6">
        <a
          href={`/trade-off/edit/${slug}/washers`}
          className="group flex items-center gap-3 rounded-2xl border p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
          style={{ borderColor: "#FFB300", backgroundColor: "#0A0A0A", color: "#FFFFFF" }}
        >
          <span
            aria-hidden
            className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full"
            style={{ backgroundColor: "#FFB300", color: "#0A0A0A" }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <circle cx="12" cy="12" r="9"/>
              <circle cx="12" cy="12" r="3"/>
            </svg>
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-[10px] font-black uppercase tracking-[0.16em] text-white/60">
              Washer bag · verified WA leads
            </div>
            <div className="mt-0.5 flex items-baseline gap-1.5">
              <span
                className="text-[24px] font-black leading-none tabular-nums"
                style={{ color: "#FFB300" }}
              >
                {washerBalance !== null ? washerBalance : "—"}
              </span>
              <span className="text-[10px] font-black uppercase tracking-wider text-white/60">
                {washerBalance !== null ? "washers left" : "not yet enabled"}
              </span>
            </div>
          </div>
          <span className="flex-shrink-0 text-[10px] font-black uppercase tracking-[0.14em] text-white/70 group-hover:text-white">
            Manage →
          </span>
        </a>
      </section>

      {/* Manage subscription — only renders when Stripe has stamped a
          customer ID on this listing (i.e. the tradesperson has paid via
          Checkout at least once). For free / standby / WhatsApp-billed
          rows this section is invisible. Placed up here near the top of
          the editor so subscribers can find self-service quickly. */}
      {row.data.stripe_customer_id && (
        <section className="mx-auto max-w-3xl px-4 pb-6">
          <ManageSubscriptionCard slug={slug} token={token} />
        </section>
      )}

      <section className="mx-auto max-w-3xl px-4 pb-10">
        {tier === "app_trial" || tier === "app_paid" || tier === "app_verified" ? (
          <PremiumCustomisationPanel
            slug={slug}
            editToken={token}
            isMerchantTrade={
              typeof row.data.primary_trade === "string" &&
              isMerchantGradeTrade(row.data.primary_trade)
            }
            essentialsComplete={
              (row.data.bio ?? "").trim().length >= 50 &&
              !!row.data.avatar_url &&
              ((Array.isArray(row.data.priced_services) &&
                row.data.priced_services.length > 0) ||
                (Array.isArray(row.data.hammerex_standard_products) &&
                  row.data.hammerex_standard_products.length > 0)) &&
              Object.values(row.data.operating_hours ?? {}).some(
                (slot) => slot && typeof slot === "object"
              )
            }
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
              phone_calls_enabled: row.data.phone_calls_enabled ?? true,
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

      {/* TradeOffForm lives last on the page so its trailing "Save
          changes (go live) / Save as draft" CTA is the final action
          the tradesperson sees — no scrolling past hidden options to
          find the save. */}
      <section className="mx-auto max-w-3xl px-4 pb-16">
        <TradeOffForm
          mode={{
            kind: "edit",
            slug,
            editToken: token,
            listingId: row.data.id
          }}
          initial={initial}
        />
      </section>
      <DashboardFooter />
    </main>
  );
}

function TierStatusCard({
  tier,
  trialDays,
  upgradeHref,
  billingWaUrl
}: {
  tier: "standard" | "app_trial" | "app_paid" | "app_expired" | "app_verified";
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
  if (tier === "app_paid" || tier === "app_verified") {
    const verified = tier === "app_verified";
    return (
      <div className="rounded-xl border border-brand-accent bg-brand-accent/10 p-4">
        <p className="text-sm font-bold text-brand-accent">
          {verified ? "Xrated App — Verified" : "Xrated App — Paid"}
        </p>
        <p className="mt-1 text-xs text-brand-muted">
          {verified
            ? "Thanks for going Verified. Every paid feature is unlocked plus the verified badge on your public profile."
            : "Thanks for supporting Xrated Trades. All premium features are unlocked."}
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
        Try the Xrated App tier free for {XRATED_PRICING.trialDays} days —
        custom theme, hero text effects, avatar frame and a running marquee.
      </p>
      <Link
        href={upgradeHref}
        className="mt-3 inline-flex h-10 items-center rounded-lg border border-brand-accent bg-brand-accent/10 px-4 text-xs font-bold text-brand-accent transition hover:bg-brand-accent hover:text-black"
      >
        Start your {XRATED_PRICING.trialDays}-day free trial →
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
    "Hi thenetworkers.app — I'm trying to edit my thenetworkers.app profile but my link isn't working. Can you help?"
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
          Message us on WhatsApp
        </a>
      </section>
      <DashboardFooter />
    </main>
  );
}
