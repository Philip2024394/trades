// src/app/nex-native/settings/tier/page.tsx
//
// Bridge 56 · NEX Plans · seven-tier pricing surface · sealed 2026-09-29.
// -----------------------------------------------------------------------
// Full pricing surface for NEX themes + Bisnis. Priced for Indonesian
// mass market (daily wage Rp 60k reality) with a laddered structure:
//
//   1 · Gratis (free forever)                       · viral hook
//   2 · Try a theme       · Rp 5k / 7 days          · impulse trial
//   3 · Buy a theme       · Rp 25k one-time         · ownership psy
//   4 · Themes Ringan     · Rp 15k / month          · mass market
//   5 · Themes Plus       · Rp 39k / month          · middle class · MOST POPULAR
//   6 · Bisnis            · Rp 99k / month          · business + heavy fans
//   7 · Bisnis Custom     · Rp 3jt one-time         · bespoke brand theme
//
// Payments follow the sealed "NEX never handles payments" doctrine:
// every CTA opens the NEX1 support chat with a pre-filled purchase
// intent · NEX ops team confirms bank transfer / GoPay / DANA /
// ShopeePay / QRIS manually. No card checkout, no in-app charge.
//
// UI standards target: this is a paid-conversion surface, so it uses
// the premium NEX palette (dark navy + cyan + orange), serif headers
// for tier names, chip badges, MOST POPULAR callout, current-plan
// indicator, and mobile-first responsive grid.

import Link from "next/link";
import { redirect } from "next/navigation";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import { effectiveTier } from "@/lib/nex-native/account-service";
import { nexSupabaseAdmin } from "@/lib/nex-native/supabase-admin";
import { NexPageHeader } from "../../_page-header";
import type { NexAccountRow } from "@/lib/nex-native/types";
import { NEX_OFFICIAL_CHAT_HREF } from "@/lib/nex-native/nex-official";
import {
  hasUsedThemesTrial,
  isThemesTrialActive,
} from "@/lib/nex-native/account-service";
import { startThemesTrialAction } from "../../_actions";
import { SubscriptionSection } from "./_subscription-section";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NEX = {
  bg: "#020914",
  panel: "#03101D",
  panelSoft: "rgba(6, 15, 28, 0.72)",
  border: "rgba(139, 169, 209, 0.14)",
  borderStrong: "rgba(0, 175, 255, 0.35)",
  text: "#F4F7FC",
  textDim: "#8BA9D1",
  textMute: "#526B89",
  cyan: "#00AFFF",
  cyanSoft: "rgba(0, 175, 255, 0.5)",
  cyanFaint: "rgba(0, 175, 255, 0.12)",
  orange: "#FF7800",
  orangeSoft: "rgba(255, 120, 0, 0.55)",
  green: "#22E37A",
  greenFaint: "rgba(34, 227, 122, 0.14)",
  gold: "#FFD277",
};

const SERIF =
  "'Cormorant Garamond', 'EB Garamond', 'Playfair Display', Georgia, serif";

export interface TierOffer {
  id: string;
  eyebrow: string;
  name: string;
  price: string;
  priceUnit: string;
  /** Optional yearly billing · when present, the subscription
   *  section's Monthly/Yearly toggle swaps to these values. */
  yearlyPrice?: string;
  yearlyPriceUnit?: string;
  /** CTA label shown when the yearly toggle is active. */
  yearlyCtaLabel?: string;
  /** CTA intent shown when the yearly toggle is active. */
  yearlyCtaIntent?: string;
  tagline: string;
  target: string;
  features: string[];
  accent: "gray" | "cyan" | "orange" | "gold";
  ctaLabel: string;
  ctaIntent: string;
  popular?: boolean;
  currentIfEffective?: "gratis" | "bisnis";
}

const OFFERS: TierOffer[] = [
  {
    id: "gratis",
    eyebrow: "FREE FOREVER",
    name: "Gratis",
    price: "Rp 0",
    priceUnit: "always",
    tagline: "Chat with anyone · pick from 5 free themes",
    target: "Everyone on NEX",
    features: [
      "Unlimited peer chat + groups",
      "5 base themes (Default, Titanium, Pink, Gold, Night)",
      "Basic mascots (per-theme starter set)",
      "All chat effects (send + receive animations)",
      "Full read receipts + presence",
      "NEX1 support chat included",
    ],
    accent: "gray",
    ctaLabel: "You're on this plan",
    ctaIntent: "",
    currentIfEffective: "gratis",
  },
  {
    id: "buy",
    eyebrow: "OWN IT FOREVER",
    name: "Buy a theme",
    price: "Rp 25,000",
    priceUnit: "per theme · one time",
    tagline: "Pick a favourite · keep it forever",
    target: "One-and-done buyers",
    features: [
      "1 premium theme unlocked permanently",
      "Full theme with all its mascots + effects",
      "Never expires · yours forever",
      "Buy as many single themes as you like",
      "Pay once via GoPay / DANA / ShopeePay / QRIS / bank transfer",
    ],
    accent: "cyan",
    ctaLabel: "Buy a theme · Rp 25k",
    ctaIntent: "buy",
  },
  {
    id: "ringan",
    eyebrow: "MASS-MARKET FAVOURITE",
    name: "Themes Ringan",
    price: "Rp 15,000",
    priceUnit: "per month",
    yearlyPrice: "Rp 150,000",
    yearlyPriceUnit: "per year · Rp 12.5k/mo effective",
    yearlyCtaLabel: "Subscribe · Rp 150k/yr",
    yearlyCtaIntent: "ringan_yearly",
    tagline: "5 fresh premium themes rotated every month · never boring",
    target: "Everyday buyers",
    features: [
      "5 hand-picked premium themes each month",
      "Rotation refreshes 1st of every month",
      "Full mascot + send effects on every rotated theme",
      "Cancel any time",
      "Costs less than one Grab ride per month",
    ],
    accent: "cyan",
    ctaLabel: "Subscribe · Rp 15k/mo",
    ctaIntent: "ringan",
  },
  {
    id: "bisnis",
    eyebrow: "BISNIS",
    name: "Bisnis",
    price: "Rp 39,000",
    priceUnit: "per month",
    yearlyPrice: "Rp 390,000",
    yearlyPriceUnit: "per year · Rp 32.5k/mo effective",
    yearlyCtaLabel: "Subscribe · Rp 390k/yr",
    yearlyCtaIntent: "bisnis_yearly",
    tagline:
      "Everything unlocked · themes, mascots, effects, shop slider, verified handle",
    target: "Anyone who wants the full NEX",
    features: [
      "ALL premium themes (20+ and growing)",
      "ALL mascots across every theme",
      "ALL send effects (Confetti · Hearts · Fireworks · more)",
      "ALL custom bubble shapes (cloud · slate · frost · glass)",
      "Shop / Menu slider (share products or menu in every chat)",
      "20 boosted messages / month",
      "Priority Directory placement (when Phase 2 lands)",
      "First access to new limited-drop themes",
      "Priority support in NEX1 chat",
    ],
    accent: "gold",
    ctaLabel: "Subscribe · Rp 39k/mo",
    ctaIntent: "bisnis",
    currentIfEffective: "bisnis",
  },
  {
    id: "custom",
    eyebrow: "FOR BRANDS",
    name: "Own Theme Request",
    price: "Rp 1,000,000",
    priceUnit: "one time · lifetime unlock",
    tagline:
      "Your own specialised theme built for your business · full mascots + emoji + shop layout",
    target: "Cafes · cake shops · salons · agencies · brand accounts",
    features: [
      "Specialised theme designed around your business type",
      "Bakery gets a bakery theme · salon gets a salon theme · etc.",
      "Full mascot pack tuned to your brand personality",
      "Full custom emoji pack (bakery = cakes/coffee/croissants)",
      "Bespoke shop layout for your product / menu slider",
      "Your theme visible to every customer + friend who chats you",
      "1-on-1 design brief with the NEX design team",
      "Includes Bisnis subscription for 12 months",
      "Sticky retention: leaving NEX = losing your brand theme",
    ],
    accent: "gold",
    ctaLabel: "Request my own theme · Rp 1jt",
    ctaIntent: "custom",
  },
];

const PAYMENT_METHODS = [
  "🟢 GoPay",
  "🟣 DANA",
  "🟠 ShopeePay",
  "🔵 OVO",
  "⬛ QRIS",
  "🏦 Bank transfer",
];

export default async function TierPage() {
  const session = await resolveNexAppSessionFromContext();
  if (!session) redirect("/nex-native/sign-in?next=/nex-native/settings/tier");

  const row = await nexSupabaseAdmin
    .from("nex_account")
    .select(
      "tier, bisnis_expires_at, display_name, nex_handle, themes_trial_used_at",
    )
    .eq("id", session.account.id)
    .maybeSingle();
  if (row.error || !row.data) redirect("/nex-native/home");
  const account = row.data as Pick<
    NexAccountRow,
    | "tier"
    | "bisnis_expires_at"
    | "display_name"
    | "nex_handle"
    | "themes_trial_used_at"
  >;
  const effective = effectiveTier(account);
  const trialUsed = hasUsedThemesTrial(account);
  const trialActive = isThemesTrialActive(account);
  const isBisnis = effective === "bisnis" || effective === "pro";
  const expiresLabel =
    isBisnis && account.bisnis_expires_at
      ? new Date(account.bisnis_expires_at).toLocaleDateString("en-GB", {
          day: "numeric",
          month: "long",
          year: "numeric",
        })
      : null;

  return (
    <div style={{ minHeight: "100dvh", background: NEX.bg, color: NEX.text }}>
      <NexPageHeader
        title="NEX Plans"
        subtitle="Own your look · pay only for what you use"
      />

      <main
        style={{
          maxWidth: 1120,
          margin: "0 auto",
          padding: "clamp(20px, 4vw, 40px) clamp(16px, 4vw, 32px) 80px",
        }}
      >
        {/* Current-plan chip */}
        <CurrentPlanCard
          effective={effective}
          expiresLabel={expiresLabel}
          displayName={account.display_name}
        />

        {/* Hero copy */}
        <section style={{ marginTop: 28, marginBottom: 36 }}>
          <div
            style={{
              fontSize: 10,
              letterSpacing: "0.32em",
              textTransform: "uppercase",
              color: NEX.orange,
              fontWeight: 800,
              marginBottom: 12,
            }}
          >
            🎨 Themes · Mascots · Effects
          </div>
          <h1
            style={{
              margin: 0,
              fontFamily: SERIF,
              fontSize: "clamp(32px, 6vw, 52px)",
              lineHeight: 1.05,
              letterSpacing: "-0.015em",
              fontWeight: 500,
              maxWidth: 760,
            }}
          >
            Priced for Indonesia. Built for the world.
          </h1>
          <p
            style={{
              margin: "18px 0 0",
              fontSize: 15,
              lineHeight: 1.6,
              color: NEX.textDim,
              maxWidth: 640,
            }}
          >
            Start free. Try a theme for the cost of a bottle of water.
            Subscribe when you find your look. Own your favourite forever.
            Every plan is honest — cancel any time.
          </p>
        </section>

        {/* Gratis · big free tier card */}
        <FreeHeroCard
          offer={OFFERS[0]!}
          isCurrent={effective === "gratis"}
        />

        {/* Bridge 56e · single Packages row · Buy + Ringan + Bisnis
           on ONE row · Monthly/Yearly toggle inside the section only
           swaps the two subscription cards · Buy stays static
           (one-time purchase, no billing cycle). */}
        <SectionHeader
          title="Choose your package"
          subtitle="One-time or subscription · every package has a 7-day free trial"
        />
        <SubscriptionSection
          offers={[OFFERS[1]!, OFFERS[2]!, OFFERS[3]!]}
          currentEffective={effective}
          trialUsed={trialUsed}
          trialActive={trialActive}
          startTrialAction={startThemesTrialAction}
        />

        {/* Section 3 · brand tier */}
        <SectionHeader
          title="For brands"
          subtitle="Your own specialised theme · limited slots per month"
        />
        <div style={{ marginBottom: 44 }}>
          <BrandCard offer={OFFERS[4]!} />
        </div>

        {/* Payment methods · Bridge 56f · reframed as an online-
           safety feature per Founder direction 2026-09-29. */}
        <section
          style={{
            marginBottom: 40,
            padding: "20px 22px",
            borderRadius: 14,
            background:
              "linear-gradient(135deg, rgba(34,227,122,0.08) 0%, rgba(6,15,28,0.72) 100%)",
            border: "1px solid rgba(34,227,122,0.35)",
            boxShadow:
              "0 8px 22px rgba(0,0,0,0.35), 0 0 24px rgba(34,227,122,0.08)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              marginBottom: 8,
            }}
          >
            <span
              aria-hidden
              style={{
                display: "inline-grid",
                placeItems: "center",
                width: 28,
                height: 28,
                borderRadius: "50%",
                background: NEX.greenFaint,
                border: "1px solid rgba(34,227,122,0.4)",
                color: NEX.green,
                fontSize: 14,
              }}
            >
              🛡
            </span>
            <div
              style={{
                fontSize: 10,
                letterSpacing: "0.22em",
                textTransform: "uppercase",
                color: NEX.green,
                fontWeight: 800,
              }}
            >
              Online payment safety by design
            </div>
          </div>

          <div
            style={{
              fontFamily: SERIF,
              fontSize: 18,
              fontWeight: 500,
              color: NEX.text,
              lineHeight: 1.25,
              letterSpacing: "-0.005em",
              marginBottom: 10,
              maxWidth: 640,
            }}
          >
            Your card details never touch a NEX server.
          </div>

          <div
            style={{
              fontSize: 13,
              color: NEX.textDim,
              lineHeight: 1.6,
              marginBottom: 16,
              maxWidth: 640,
            }}
          >
            Every activation is processed by the NEX team as a
            personal safety + quality check. No online payment
            gateway · no stored card numbers · no data-breach
            surface. You pay via your own trusted rail below, and
            our team reviews + activates your plan within minutes of
            confirmation.
          </div>

          <div
            style={{
              fontSize: 10,
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              color: NEX.textMute,
              fontWeight: 700,
              marginBottom: 10,
            }}
          >
            Pay through your preferred rail
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {PAYMENT_METHODS.map((m) => (
              <span
                key={m}
                style={{
                  padding: "6px 12px",
                  borderRadius: 999,
                  background: NEX.cyanFaint,
                  border: `1px solid ${NEX.cyanSoft}`,
                  color: NEX.text,
                  fontSize: 12,
                  fontWeight: 600,
                  letterSpacing: "0.02em",
                }}
              >
                {m}
              </span>
            ))}
          </div>
        </section>

        {/* FAQ / trust footer */}
        <section
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: 16,
            marginBottom: 20,
          }}
        >
          <TrustBlock
            title="Cancel any time"
            body="Every subscription can be paused or cancelled from this page. You keep access to what you paid for through the end of the current period."
          />
          <TrustBlock
            title="No hidden fees"
            body="What you see is what you pay. NEX never charges card surcharges, processing fees, or auto-upgrade you to a higher tier."
          />
          <TrustBlock
            title="Refund within 7 days"
            body="Not happy in the first 7 days? Message NEX1 support for a full refund. No questions asked, no waiting."
          />
        </section>
      </main>
    </div>
  );
}

/* -------------------------------------------------------------- *
 * Current-plan indicator                                          *
 * -------------------------------------------------------------- */

function CurrentPlanCard({
  effective,
  expiresLabel,
  displayName,
}: {
  effective: "gratis" | "bisnis" | "pro";
  expiresLabel: string | null;
  displayName: string;
}) {
  const label =
    effective === "bisnis"
      ? "Bisnis"
      : effective === "pro"
        ? "Pro"
        : "Gratis";
  const isPaid = effective !== "gratis";
  return (
    <section
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexWrap: "wrap",
        gap: 12,
        padding: "14px 18px",
        borderRadius: 14,
        background: isPaid
          ? "linear-gradient(135deg, rgba(255,210,119,0.14) 0%, rgba(255,120,0,0.10) 100%)"
          : NEX.panelSoft,
        border: `1px solid ${isPaid ? NEX.orangeSoft : NEX.border}`,
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            fontSize: 10,
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            color: isPaid ? NEX.gold : NEX.textMute,
            fontWeight: 700,
            marginBottom: 4,
          }}
        >
          {displayName} · your current plan
        </div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
          <span
            style={{
              fontFamily: SERIF,
              fontSize: 22,
              fontWeight: 600,
              color: NEX.text,
            }}
          >
            {label}
          </span>
          {expiresLabel && (
            <span style={{ fontSize: 12, color: NEX.textDim }}>
              renews {expiresLabel}
            </span>
          )}
        </div>
      </div>
      {isPaid ? (
        <span
          style={{
            padding: "6px 12px",
            borderRadius: 999,
            background: NEX.greenFaint,
            border: "1px solid rgba(34,227,122,0.4)",
            color: NEX.green,
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
          }}
        >
          ✓ Active
        </span>
      ) : (
        <span
          style={{
            fontSize: 12,
            color: NEX.textDim,
            fontStyle: "italic",
          }}
        >
          Pick a plan below to unlock more
        </span>
      )}
    </section>
  );
}

/* -------------------------------------------------------------- *
 * Free hero card · full-width Gratis                              *
 * -------------------------------------------------------------- */

function FreeHeroCard({
  offer,
  isCurrent,
}: {
  offer: TierOffer;
  isCurrent: boolean;
}) {
  return (
    <section
      style={{
        marginBottom: 40,
        padding: "clamp(22px, 4vw, 36px)",
        borderRadius: 20,
        background:
          "linear-gradient(135deg, rgba(0,175,255,0.08) 0%, rgba(3,16,29,0.72) 100%)",
        border: `1px solid ${NEX.border}`,
        boxShadow: "0 12px 32px rgba(0,0,0,0.35)",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div style={{ display: "flex", flexWrap: "wrap", gap: 24, alignItems: "flex-end" }}>
        <div style={{ flex: "1 1 260px", minWidth: 0 }}>
          <div
            style={{
              fontSize: 10,
              letterSpacing: "0.28em",
              textTransform: "uppercase",
              color: NEX.cyan,
              fontWeight: 800,
              marginBottom: 8,
            }}
          >
            {offer.eyebrow}
          </div>
          <h2
            style={{
              margin: 0,
              fontFamily: SERIF,
              fontSize: "clamp(28px, 5vw, 40px)",
              lineHeight: 1.1,
              fontWeight: 500,
              letterSpacing: "-0.01em",
            }}
          >
            {offer.name}
          </h2>
          <p
            style={{
              margin: "10px 0 0",
              fontSize: 14,
              lineHeight: 1.6,
              color: NEX.textDim,
              maxWidth: 520,
            }}
          >
            {offer.tagline}
          </p>
        </div>
        <div style={{ flexShrink: 0 }}>
          <div
            style={{
              fontFamily: SERIF,
              fontSize: "clamp(38px, 6vw, 56px)",
              fontWeight: 500,
              color: NEX.text,
              lineHeight: 1,
              letterSpacing: "-0.015em",
            }}
          >
            {offer.price}
          </div>
          <div
            style={{
              fontSize: 12,
              color: NEX.textDim,
              marginTop: 6,
              textAlign: "right",
            }}
          >
            {offer.priceUnit}
          </div>
        </div>
      </div>
      <ul
        style={{
          listStyle: "none",
          padding: 0,
          margin: "24px 0 0",
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
          gap: 10,
        }}
      >
        {offer.features.map((f) => (
          <FeatureLine key={f} text={f} tone="cyan" />
        ))}
      </ul>
      <div style={{ marginTop: 22 }}>
        {isCurrent ? (
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "10px 18px",
              borderRadius: 999,
              background: NEX.greenFaint,
              border: "1px solid rgba(34,227,122,0.4)",
              color: NEX.green,
              fontSize: 12,
              fontWeight: 800,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
            }}
          >
            ✓ You&apos;re on Gratis
          </div>
        ) : (
          <div
            style={{
              fontSize: 12,
              color: NEX.textDim,
              fontStyle: "italic",
            }}
          >
            Always available · you can downgrade any time.
          </div>
        )}
      </div>
    </section>
  );
}

/* -------------------------------------------------------------- *
 * Section header · consistent typographic block                   *
 * -------------------------------------------------------------- */

function SectionHeader({
  title,
  subtitle,
}: {
  title: string;
  subtitle: string;
}) {
  return (
    <header style={{ marginBottom: 18 }}>
      <div
        style={{
          fontSize: 10,
          letterSpacing: "0.22em",
          textTransform: "uppercase",
          color: NEX.orange,
          fontWeight: 800,
          marginBottom: 6,
        }}
      >
        {title}
      </div>
      <div
        style={{
          fontSize: 13,
          color: NEX.textDim,
          fontWeight: 500,
        }}
      >
        {subtitle}
      </div>
      <div
        style={{
          marginTop: 10,
          width: 40,
          height: 2,
          borderRadius: 2,
          background: NEX.orange,
        }}
      />
    </header>
  );
}

/* -------------------------------------------------------------- *
 * Tier card · used by both one-time and subscription offers       *
 * -------------------------------------------------------------- */

function TierCard({
  offer,
  highlightCurrent = false,
}: {
  offer: TierOffer;
  highlightCurrent?: boolean;
}) {
  const isPopular = !!offer.popular;
  const isGold = offer.accent === "gold";
  const accentColor = isGold ? NEX.gold : isPopular ? NEX.orange : NEX.cyan;
  const accentSoft = isGold ? "rgba(255,210,119,0.14)" : isPopular ? "rgba(255,120,0,0.14)" : NEX.cyanFaint;
  const accentBorder = isGold ? "rgba(255,210,119,0.45)" : isPopular ? NEX.orangeSoft : NEX.cyanSoft;
  const ctaHref = buildCtaHref(offer);
  return (
    <article
      style={{
        position: "relative",
        display: "flex",
        flexDirection: "column",
        padding: "clamp(20px, 3vw, 26px)",
        borderRadius: 18,
        background: isPopular
          ? "linear-gradient(180deg, rgba(255,120,0,0.10) 0%, rgba(3,16,29,0.92) 100%)"
          : NEX.panelSoft,
        border: `1px solid ${isPopular ? NEX.orangeSoft : NEX.border}`,
        boxShadow: isPopular
          ? "0 16px 36px rgba(255,120,0,0.2), 0 0 32px rgba(255,120,0,0.12)"
          : "0 8px 20px rgba(0,0,0,0.28)",
        transform: isPopular ? "translateY(-2px)" : undefined,
        transition: "transform 180ms ease, box-shadow 180ms ease",
      }}
    >
      {isPopular && (
        <span
          style={{
            position: "absolute",
            top: -14,
            left: "50%",
            transform: "translateX(-50%)",
            padding: "6px 14px",
            borderRadius: 999,
            background:
              "linear-gradient(135deg, #FF9033 0%, #FF7200 100%)",
            color: "#0B0F1A",
            fontSize: 10,
            fontWeight: 900,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            boxShadow: "0 6px 16px rgba(255,120,0,0.5)",
            whiteSpace: "nowrap",
          }}
        >
          ⭐ Most popular
        </span>
      )}
      {highlightCurrent && (
        <span
          style={{
            position: "absolute",
            top: -12,
            right: 16,
            padding: "4px 10px",
            borderRadius: 999,
            background: NEX.greenFaint,
            border: "1px solid rgba(34,227,122,0.5)",
            color: NEX.green,
            fontSize: 9,
            fontWeight: 900,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
          }}
        >
          ✓ Current
        </span>
      )}

      <div
        style={{
          fontSize: 9,
          letterSpacing: "0.22em",
          textTransform: "uppercase",
          color: accentColor,
          fontWeight: 800,
          marginBottom: 8,
        }}
      >
        {offer.eyebrow}
      </div>
      <h3
        style={{
          margin: 0,
          fontFamily: SERIF,
          fontSize: 26,
          fontWeight: 500,
          letterSpacing: "-0.005em",
          color: NEX.text,
        }}
      >
        {offer.name}
      </h3>
      <div
        style={{
          marginTop: 14,
          display: "flex",
          alignItems: "baseline",
          gap: 8,
          flexWrap: "wrap",
        }}
      >
        <span
          style={{
            fontFamily: SERIF,
            fontSize: 34,
            fontWeight: 500,
            color: NEX.text,
            letterSpacing: "-0.02em",
            lineHeight: 1,
          }}
        >
          {offer.price}
        </span>
        <span style={{ fontSize: 12, color: NEX.textDim }}>
          {offer.priceUnit}
        </span>
      </div>
      <p
        style={{
          margin: "12px 0 16px",
          fontSize: 13,
          color: NEX.textDim,
          lineHeight: 1.5,
        }}
      >
        {offer.tagline}
      </p>

      <ul
        style={{
          listStyle: "none",
          padding: 0,
          margin: "8px 0 20px",
          display: "grid",
          gap: 8,
        }}
      >
        {offer.features.map((f) => (
          <FeatureLine
            key={f}
            text={f}
            tone={isPopular ? "orange" : isGold ? "gold" : "cyan"}
          />
        ))}
      </ul>

      <div style={{ marginTop: "auto" }}>
        <div
          style={{
            fontSize: 10,
            color: NEX.textMute,
            marginBottom: 10,
            fontWeight: 600,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
          }}
        >
          For · {offer.target}
        </div>
        <Link
          href={ctaHref}
          style={{
            display: "block",
            width: "100%",
            padding: "14px 18px",
            borderRadius: 12,
            background: isPopular
              ? "linear-gradient(180deg, #FF9033 0%, #FF7200 100%)"
              : isGold
                ? "linear-gradient(180deg, #FFDF9B 0%, #FFB947 100%)"
                : accentSoft,
            border: `1px solid ${accentBorder}`,
            color: isPopular || isGold ? "#0B0F1A" : NEX.text,
            fontSize: 13,
            fontWeight: 800,
            letterSpacing: "0.04em",
            textAlign: "center",
            textDecoration: "none",
            boxShadow: isPopular
              ? "0 8px 20px rgba(255,120,0,0.4)"
              : isGold
                ? "0 8px 20px rgba(255,180,71,0.35)"
                : "none",
          }}
        >
          {offer.ctaLabel}
        </Link>
      </div>
    </article>
  );
}

/* -------------------------------------------------------------- *
 * Brand card · Bisnis Custom Theme                                *
 * -------------------------------------------------------------- */

function BrandCard({ offer }: { offer: TierOffer }) {
  const ctaHref = buildCtaHref(offer);
  return (
    <article
      style={{
        padding: "clamp(22px, 4vw, 32px)",
        borderRadius: 20,
        background:
          "linear-gradient(135deg, rgba(255,210,119,0.10) 0%, rgba(255,120,0,0.08) 100%)",
        border: `1px solid rgba(255,210,119,0.35)`,
        boxShadow:
          "0 16px 40px rgba(255,120,0,0.14), 0 0 40px rgba(255,210,119,0.12)",
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr auto",
          gap: 20,
          alignItems: "flex-start",
          flexWrap: "wrap",
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontSize: 10,
              letterSpacing: "0.28em",
              textTransform: "uppercase",
              color: NEX.gold,
              fontWeight: 800,
              marginBottom: 8,
            }}
          >
            {offer.eyebrow}
          </div>
          <h3
            style={{
              margin: 0,
              fontFamily: SERIF,
              fontSize: "clamp(24px, 4vw, 32px)",
              fontWeight: 500,
              letterSpacing: "-0.01em",
            }}
          >
            {offer.name}
          </h3>
          <p
            style={{
              margin: "10px 0 0",
              fontSize: 14,
              color: NEX.textDim,
              lineHeight: 1.6,
              maxWidth: 640,
            }}
          >
            {offer.tagline}
          </p>
        </div>
        <div style={{ flexShrink: 0 }}>
          <div
            style={{
              fontFamily: SERIF,
              fontSize: "clamp(28px, 4vw, 40px)",
              fontWeight: 500,
              color: NEX.text,
              lineHeight: 1,
              letterSpacing: "-0.015em",
              textAlign: "right",
            }}
          >
            {offer.price}
          </div>
          <div
            style={{
              fontSize: 12,
              color: NEX.textDim,
              marginTop: 6,
              textAlign: "right",
            }}
          >
            {offer.priceUnit}
          </div>
        </div>
      </div>

      <ul
        style={{
          listStyle: "none",
          padding: 0,
          margin: "22px 0 22px",
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
          gap: 10,
        }}
      >
        {offer.features.map((f) => (
          <FeatureLine key={f} text={f} tone="gold" />
        ))}
      </ul>

      <Link
        href={ctaHref}
        style={{
          display: "inline-block",
          padding: "14px 24px",
          borderRadius: 12,
          background: "linear-gradient(180deg, #FFDF9B 0%, #FFB947 100%)",
          border: "1px solid rgba(255,210,119,0.55)",
          color: "#0B0F1A",
          fontSize: 13,
          fontWeight: 800,
          letterSpacing: "0.04em",
          textDecoration: "none",
          boxShadow: "0 10px 24px rgba(255,180,71,0.4)",
        }}
      >
        {offer.ctaLabel} →
      </Link>
    </article>
  );
}

/* -------------------------------------------------------------- *
 * Feature line · shared checkmark row                             *
 * -------------------------------------------------------------- */

function FeatureLine({
  text,
  tone,
}: {
  text: string;
  tone: "cyan" | "orange" | "gold";
}) {
  const color =
    tone === "orange" ? NEX.orange : tone === "gold" ? NEX.gold : NEX.cyan;
  return (
    <li
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 8,
        fontSize: 13,
        lineHeight: 1.5,
        color: NEX.text,
      }}
    >
      <span
        aria-hidden
        style={{
          flexShrink: 0,
          width: 16,
          height: 16,
          borderRadius: "50%",
          background: `${color}22`,
          border: `1px solid ${color}55`,
          color,
          display: "grid",
          placeItems: "center",
          fontSize: 10,
          fontWeight: 900,
          marginTop: 2,
        }}
      >
        ✓
      </span>
      <span>{text}</span>
    </li>
  );
}

/* -------------------------------------------------------------- *
 * Trust footer blocks                                             *
 * -------------------------------------------------------------- */

function TrustBlock({ title, body }: { title: string; body: string }) {
  return (
    <div
      style={{
        padding: "16px 18px",
        borderRadius: 12,
        background: NEX.panelSoft,
        border: `1px solid ${NEX.border}`,
      }}
    >
      <div
        style={{
          fontSize: 11,
          fontWeight: 800,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: NEX.cyan,
          marginBottom: 8,
        }}
      >
        {title}
      </div>
      <div style={{ fontSize: 12, color: NEX.textDim, lineHeight: 1.55 }}>
        {body}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------- *
 * CTA · route to NEX1 support chat with pre-filled intent         *
 * -------------------------------------------------------------- */

function buildCtaHref(offer: TierOffer): string {
  if (!offer.ctaIntent) return "#";
  // Route to the NEX1 support chat so ops can confirm bank transfer /
  // GoPay / DANA / ShopeePay / QRIS payment and activate the plan.
  // Adds a query hint so ops sees which offer the buyer picked.
  const params = new URLSearchParams({ intent: offer.ctaIntent });
  return `${NEX_OFFICIAL_CHAT_HREF}?${params.toString()}`;
}
