"use client";

// src/app/nex-native/settings/tier/_subscription-section.tsx
//
// Bridge 56b · Subscription section with page-level Monthly/Yearly
// toggle · sealed 2026-09-29.
// ------------------------------------------------------------------
// Renders the three subscription tiers (Ringan · Plus · Bisnis) in
// a responsive grid, with a single billing-cycle toggle above the
// grid. Toggle swaps every card's price + priceUnit + CTA label +
// CTA intent simultaneously. One-time offers (Try / Buy / Custom)
// are rendered elsewhere on the page and ignore this toggle.
//
// Yearly saves ~17% off monthly (WeTV / Canva discount convention).

import * as React from "react";
import Link from "next/link";
import { NEX_OFFICIAL_CHAT_HREF } from "@/lib/nex-native/nex-official";
import type { TierOffer } from "./page";

const NEX = {
  panel: "#03101D",
  panelSoft: "rgba(6, 15, 28, 0.72)",
  border: "rgba(139, 169, 209, 0.14)",
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

interface Props {
  offers: TierOffer[];
  currentEffective: "gratis" | "bisnis" | "pro";
  /** Bridge 56g · true when the buyer has ever consumed their
   *  lifetime 7-day trial. Hides the "Try 7 days free" pill on
   *  every card and swaps it for a small "Trial already used"
   *  note so the buyer understands why. */
  trialUsed: boolean;
  /** Bridge 56g · true when the buyer is currently inside their
   *  active 7-day window. Shows a "Trial active · N days left"
   *  chip instead of the trial button. */
  trialActive: boolean;
  /** Bridge 56g · server action bound to the trial button ·
   *  atomic write to themes_trial_used_at + redirect to theme
   *  picker on success. */
  startTrialAction: (
    formData: FormData,
  ) => Promise<never> | void | Promise<void>;
}

export function SubscriptionSection({
  offers,
  currentEffective,
  trialUsed,
  trialActive,
  startTrialAction,
}: Props) {
  const [cycle, setCycle] = React.useState<"monthly" | "yearly">("monthly");
  const isBisnis = currentEffective === "bisnis" || currentEffective === "pro";

  return (
    <div style={{ marginBottom: 44 }}>
      {/* Billing-cycle toggle */}
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          marginBottom: 22,
        }}
      >
        <div
          role="tablist"
          aria-label="Billing cycle"
          style={{
            display: "inline-flex",
            padding: 4,
            borderRadius: 999,
            background: NEX.panelSoft,
            border: `1px solid ${NEX.border}`,
            boxShadow: "0 4px 14px rgba(0,0,0,0.4)",
          }}
        >
          <CycleTab
            active={cycle === "monthly"}
            onClick={() => setCycle("monthly")}
            label="Monthly"
          />
          <CycleTab
            active={cycle === "yearly"}
            onClick={() => setCycle("yearly")}
            label={
              cycle === "yearly" ? (
                <>
                  Yearly
                  <span
                    style={{
                      marginLeft: 10,
                      fontSize: 14,
                      fontWeight: 900,
                      letterSpacing: "0.04em",
                      color: "#0B0F1A",
                      display: "inline-block",
                      animation:
                        "pd-heartbeat 1200ms cubic-bezier(.4,0,.6,1) infinite",
                      transformOrigin: "center",
                    }}
                  >
                    save 17%
                  </span>
                </>
              ) : (
                "Yearly"
              )
            }
          />
        </div>
      </div>

      {/* Bridge 56e · packages row · desktop = single row of 3 ·
         tablet = 2-up · mobile = stacked. Explicit media query
         so 3 cards ALWAYS sit on one row above 880px viewport. */}
      <div className="nex-packages-grid">
        {offers.map((o) => (
          <SubCard
            key={o.id}
            offer={o}
            cycle={cycle}
            highlightCurrent={o.id === "bisnis" && isBisnis}
            trialUsed={trialUsed}
            trialActive={trialActive}
            startTrialAction={startTrialAction}
          />
        ))}
      </div>
      <style>{`
        .nex-packages-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 16px;
        }
        @media (min-width: 640px) {
          .nex-packages-grid {
            grid-template-columns: repeat(2, 1fr);
          }
        }
        @media (min-width: 880px) {
          .nex-packages-grid {
            grid-template-columns: repeat(3, 1fr);
          }
        }
      `}</style>
    </div>
  );
}

function CycleTab({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "8px 18px",
        borderRadius: 999,
        border: "none",
        background: active
          ? "linear-gradient(135deg, #00AFFF, #0091DB)"
          : "transparent",
        color: active ? "#0B0F1A" : NEX.textDim,
        fontSize: 12,
        fontWeight: active ? 800 : 700,
        letterSpacing: "0.04em",
        cursor: "pointer",
        fontFamily: "inherit",
        boxShadow: active ? "0 4px 12px rgba(0,175,255,0.35)" : "none",
        transition: "background 160ms ease, color 160ms ease",
      }}
    >
      {label}
    </button>
  );
}

function SubCard({
  offer,
  cycle,
  highlightCurrent,
  trialUsed,
  trialActive,
  startTrialAction,
}: {
  offer: TierOffer;
  cycle: "monthly" | "yearly";
  highlightCurrent: boolean;
  trialUsed: boolean;
  trialActive: boolean;
  startTrialAction: (
    formData: FormData,
  ) => Promise<never> | void | Promise<void>;
}) {
  const isYearly = cycle === "yearly" && !!offer.yearlyPrice;
  const price = isYearly ? offer.yearlyPrice! : offer.price;
  const priceUnit = isYearly ? offer.yearlyPriceUnit! : offer.priceUnit;
  const ctaLabel = isYearly && offer.yearlyCtaLabel ? offer.yearlyCtaLabel : offer.ctaLabel;
  const ctaIntent = isYearly && offer.yearlyCtaIntent ? offer.yearlyCtaIntent : offer.ctaIntent;

  const isPopular = !!offer.popular;
  const isGold = offer.accent === "gold";
  const accentColor = isGold ? NEX.gold : isPopular ? NEX.orange : NEX.cyan;
  const accentSoft = isGold
    ? "rgba(255,210,119,0.14)"
    : isPopular
      ? "rgba(255,120,0,0.14)"
      : NEX.cyanFaint;
  const accentBorder = isGold
    ? "rgba(255,210,119,0.45)"
    : isPopular
      ? NEX.orangeSoft
      : NEX.cyanSoft;

  const ctaHref = ctaIntent
    ? `${NEX_OFFICIAL_CHAT_HREF}?intent=${encodeURIComponent(ctaIntent)}`
    : "#";

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

      {/* Price with animated swap · same slot both cycles */}
      <div
        key={cycle}
        style={{
          marginTop: 14,
          display: "flex",
          alignItems: "baseline",
          gap: 8,
          flexWrap: "wrap",
          animation: "pd-price-swap 220ms cubic-bezier(.2,.7,.2,1) both",
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
          {price}
        </span>
        <span style={{ fontSize: 12, color: NEX.textDim }}>{priceUnit}</span>
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
          {ctaLabel}
        </Link>
        {/* Bridge 56g · Try 7 days free · gated by account state.
           Three states:
             1. No trial used → orange server-action button
             2. Trial currently active → green "Trial active" chip
             3. Trial already consumed → dim "Trial already used" note
        */}
        {trialActive ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              marginTop: 10,
              padding: "10px 14px",
              borderRadius: 10,
              background: NEX.greenFaint,
              border: "1px solid rgba(34,227,122,0.4)",
              color: NEX.green,
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
            }}
          >
            ✓ Trial active
          </div>
        ) : trialUsed ? (
          <div
            style={{
              marginTop: 10,
              padding: "10px 14px",
              borderRadius: 10,
              background: "rgba(139,169,209,0.06)",
              border: "1px solid rgba(139,169,209,0.18)",
              color: NEX.textMute,
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              textAlign: "center",
            }}
          >
            Trial already used
          </div>
        ) : (
          <form action={startTrialAction} style={{ marginTop: 10 }}>
            <input type="hidden" name="package_id" value={offer.id} />
            <button
              type="submit"
              style={{
                display: "block",
                width: "100%",
                padding: "10px 14px",
                borderRadius: 10,
                background:
                  "linear-gradient(180deg, #FF9033 0%, #FF7200 100%)",
                border: `1px solid ${NEX.orangeSoft}`,
                color: "#0B0F1A",
                fontSize: 11,
                fontWeight: 800,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                cursor: "pointer",
                fontFamily: "inherit",
                boxShadow: "0 6px 14px rgba(255,120,0,0.35)",
              }}
            >
              Try 7 days free
            </button>
          </form>
        )}
      </div>

      <style>{`
        @keyframes pd-price-swap {
          from { opacity: 0.3; transform: translateY(-4px); }
          to   { opacity: 1;   transform: translateY(0); }
        }
        @keyframes pd-heartbeat {
          0%, 100% { transform: scale(1);    opacity: 1; }
          14%      { transform: scale(1.14); opacity: 1; }
          28%      { transform: scale(1);    opacity: 0.92; }
          42%      { transform: scale(1.10); opacity: 1; }
          70%      { transform: scale(1);    opacity: 1; }
        }
      `}</style>
    </article>
  );
}

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
