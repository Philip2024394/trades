"use client";

// src/app/nex-native/[businessSlug]/[productId]/direct/_view.tsx
//
// Bridge 49b · D6 Swiss NEX product view · LIVE data render.
// -----------------------------------------------------------
// Rendered by /[businessSlug]/[productId]/direct/page.tsx with real
// business + product + ladder + buyer-progress + compare-price data.
//
// Includes the founder-locked interactions:
//   · +/− quantity stepper (starts at 1 · max 99 · subtotal updates
//     live)
//   · Two CTAs · 🛒 Add to cart AND 💬 Checkout · chat side by side
//   · Share badges · 👤 friend / 👥 group (stub · opens contact
//     picker in Bridge 49b-next)
//   · Bauhaus numbered tier ladder with current position starred
//     and next unlock highlighted cyan
//   · "You save Rp X vs {compare_channel}" ticker

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { ShareToFriendPicker, type ActiveFriend } from "./_share-picker";

interface Business {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly location: string;
}

interface Product {
  readonly id: string;
  readonly name: string;
  readonly pricePence: number;
  readonly currency: string;
  readonly imageUrl: string | null;
  readonly description: string;
}

interface Ladder {
  readonly tiers: ReadonlyArray<{ order: number; discount: number; label: string }>;
  readonly maxCapPct: number;
  readonly shareFriendBonusPct: number;
  readonly shareGroupBonusPct: number;
  readonly shareExpiryHours: number;
  readonly compareChannel: string;
}

interface BuyerTier {
  readonly orderCount: number;
  readonly currentTierIndex: number;
  readonly currentDiscountPct: number;
  readonly currentLabel: string;
  readonly nextTierIndex: number | null;
  readonly nextTierOrder: number | null;
  readonly nextTierDiscount: number | null;
}

interface Compare {
  readonly markupPct: number;
  readonly comparePence: number;
  readonly savingPence: number;
}

interface Props {
  business: Business;
  product: Product;
  ladder: Ladder | null;
  buyerTier: BuyerTier;
  compare: Compare;
  classicHref: string;
  chatHref: string;
  signedIn: boolean;
  /** Bridge 49b-next · buyer's ACTIVE NEX friends (peer chat in last
   *  7 days) · empty when signed-out or nobody active. Picker uses. */
  activeFriends: ActiveFriend[];
  /** Server-action outcome banner · e.g. share_ok, share_cooldown_7d. */
  banner: { code: string; message: string } | null;
}

const NEX = {
  bg: "#020914",
  panel: "#03101D",
  panelHi: "#04101F",
  textPrimary: "#F2F5F8",
  textSecondary: "#7D9BC0",
  textMute: "rgba(125,155,192,0.65)",
  cyan: "#00AFFF",
  cyanSoft: "rgba(0, 175, 255, 0.35)",
  cyanFaint: "rgba(0, 175, 255, 0.12)",
  orange: "#FF7200",
  orangeStrong: "#FF9033",
  green: "#10B981",
};

function formatCurrency(pence: number, currency: string): string {
  const rupiah = pence / 100;
  const formatted = rupiah.toLocaleString("en-US", {
    maximumFractionDigits: 0,
  });
  const symbol = currency.toUpperCase() === "IDR" ? "Rp" : currency;
  return `${symbol} ${formatted}`;
}

export function DirectPriceView(props: Props) {
  const [qty, setQty] = useState(1);
  const [pickerOpen, setPickerOpen] = useState(false);

  const priceAfterTier = useMemo(() => {
    const pct = props.buyerTier.currentDiscountPct;
    return Math.round(props.product.pricePence * (1 - pct / 100));
  }, [props.buyerTier.currentDiscountPct, props.product.pricePence]);

  const subtotal = useMemo(() => priceAfterTier * qty, [priceAfterTier, qty]);
  const compareTotal = useMemo(() => props.compare.comparePence * qty, [props.compare.comparePence, qty]);
  const savingTotal = useMemo(() => Math.max(0, compareTotal - subtotal), [compareTotal, subtotal]);
  const savingPct = compareTotal > 0 ? Math.round((savingTotal / compareTotal) * 100) : 0;

  const onShare = useCallback((kind: "friend" | "group") => {
    if (!props.ladder) return;
    if (kind === "friend") {
      if (!props.signedIn) {
        alert("Sign in to share products with friends and earn bonus rewards.");
        return;
      }
      setPickerOpen(true);
      return;
    }
    // Group share picker is Bridge 49b-next-2 · needs the NEX groups
    // service which doesn't ship yet (groups exist as a shell in
    // /nex-native/chat but the backend lands with Bridge 47+).
    alert(
      `Group share · +${props.ladder.shareGroupBonusPct}% for you + every group member · ${props.ladder.shareExpiryHours}hr window · group picker opens once NEX groups ship.`,
    );
  }, [props.ladder, props.signedIn]);

  const noLadder = props.ladder === null;
  const tiers = props.ladder?.tiers ?? [];

  return (
    <div
      style={{
        minHeight: "100dvh",
        background: NEX.bg,
        color: NEX.textPrimary,
        fontFamily:
          "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
        display: "flex",
        flexDirection: "column",
      }}
      data-nex-direct-price
    >
      {/* Server action outcome banner · share_ok / share_cooldown_7d
          / share_recipient_inactive etc. Bridge 49b-next. */}
      {props.banner && (
        <div
          role="status"
          data-nex-share-banner={props.banner.code}
          style={{
            position: "sticky",
            top: 0,
            zIndex: 40,
            padding: "10px 14px",
            background:
              props.banner.code === "share_ok"
                ? "rgba(16,185,129,0.15)"
                : "rgba(239,68,68,0.15)",
            borderBottom: `1px solid ${
              props.banner.code === "share_ok" ? NEX.green : "#EF4444"
            }55`,
            color:
              props.banner.code === "share_ok" ? NEX.green : "#FFB989",
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: "0.02em",
            textAlign: "center",
            lineHeight: 1.4,
          }}
        >
          {props.banner.code === "share_ok" ? "✓ " : "· "}
          {props.banner.message}
        </div>
      )}

      {/* NEX contact picker · rendered only when the user taps
          the friend-share chip · handles its own submit. */}
      {props.ladder && (
        <ShareToFriendPicker
          businessId={props.business.id}
          productId={props.product.id}
          productName={props.product.name}
          friendBonusPct={props.ladder.shareFriendBonusPct}
          expiryHours={props.ladder.shareExpiryHours}
          activeFriends={props.activeFriends}
          open={pickerOpen}
          onClose={() => setPickerOpen(false)}
        />
      )}

      {/* Top strip · seller pill + × close (to classic view) · thick
          cyan rule beneath */}
      <div
        style={{
          padding: "44px 16px 12px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          borderBottom: `2px solid ${NEX.cyan}`,
        }}
      >
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "4px 12px 4px 4px",
            borderRadius: 999,
            background: "rgba(0,0,0,0.42)",
            border: `1px solid ${NEX.cyanFaint}`,
          }}
        >
          <span
            aria-hidden
            style={{
              width: 26,
              height: 26,
              borderRadius: "50%",
              background: `linear-gradient(135deg, ${NEX.orangeStrong}, ${NEX.orange})`,
              display: "grid",
              placeItems: "center",
              fontSize: 13,
            }}
          >
            🛍
          </span>
          <div style={{ lineHeight: 1.1, color: "#fff" }}>
            <div style={{ fontSize: 11, fontWeight: 700 }}>{props.business.name}</div>
            {props.business.location && (
              <div style={{ fontSize: 9, opacity: 0.85 }}>📍 {props.business.location}</div>
            )}
          </div>
        </div>
        <Link
          href={props.classicHref}
          style={{
            width: 32,
            height: 32,
            borderRadius: "50%",
            background: NEX.panel,
            color: NEX.textPrimary,
            border: `1px solid ${NEX.cyanSoft}`,
            fontSize: 16,
            display: "grid",
            placeItems: "center",
            textDecoration: "none",
          }}
          aria-label="Close · back to classic view"
        >
          ×
        </Link>
      </div>

      {/* Bauhaus headline */}
      <div style={{ padding: "16px 18px 12px" }}>
        <div
          style={{
            fontSize: 9,
            letterSpacing: "0.28em",
            textTransform: "uppercase",
            fontWeight: 800,
            color: NEX.cyan,
          }}
        >
          NEX Direct · {props.business.name}
        </div>
        <h1
          style={{
            margin: "6px 0 4px",
            fontSize: 28,
            fontWeight: 900,
            letterSpacing: "-0.03em",
            lineHeight: 0.98,
            textTransform: "uppercase",
            color: NEX.textPrimary,
          }}
        >
          {props.product.name}
        </h1>
        {props.product.description && (
          <div
            style={{
              fontSize: 11,
              color: NEX.textSecondary,
              letterSpacing: "0.02em",
              lineHeight: 1.5,
            }}
          >
            {props.product.description.split(/\r?\n/)[0]}
          </div>
        )}
      </div>

      {/* Product image thumb · small square · sits on the left of the
          share row · Swiss discipline (image is a supporting element,
          not the hero of a swipe-page here) */}
      {props.product.imageUrl && (
        <div style={{ padding: "0 18px" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={props.product.imageUrl}
            alt={props.product.name}
            style={{
              width: "100%",
              aspectRatio: "16/9",
              objectFit: "cover",
              borderRadius: 0,
              border: `1px solid ${NEX.cyanFaint}`,
            }}
          />
        </div>
      )}

      {/* Share row · only when ladder is active */}
      {props.ladder && (
        <div
          style={{
            margin: "12px 18px 0",
            borderTop: `1px solid ${NEX.cyanFaint}`,
            borderBottom: `1px solid ${NEX.cyanFaint}`,
            padding: "10px 0",
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 8,
          }}
        >
          <button
            type="button"
            onClick={() => onShare("friend")}
            style={shareButtonStyle()}
          >
            <span aria-hidden style={shareValueStyle()}>
              −{props.ladder.shareFriendBonusPct}%
            </span>
            <div style={{ minWidth: 0 }}>
              <div style={shareLabelStyle()}>Share · friend</div>
              <div style={shareHintStyle()}>you + they · {props.ladder.shareExpiryHours}hr</div>
            </div>
          </button>
          <button
            type="button"
            onClick={() => onShare("group")}
            style={shareButtonStyle()}
          >
            <span aria-hidden style={shareValueStyle()}>
              −{props.ladder.shareGroupBonusPct}%
            </span>
            <div style={{ minWidth: 0 }}>
              <div style={shareLabelStyle()}>Share · group</div>
              <div style={shareHintStyle()}>you + all · {props.ladder.shareExpiryHours}hr</div>
            </div>
          </button>
        </div>
      )}

      {/* Loyalty ladder · when active */}
      {props.ladder ? (
        <div style={{ padding: "14px 18px 12px" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "baseline",
              paddingBottom: 6,
              borderBottom: `2px solid ${NEX.orange}`,
              marginBottom: 6,
            }}
          >
            <div
              style={{
                fontSize: 11,
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                fontWeight: 900,
                color: NEX.orange,
              }}
            >
              Loyalty ladder
            </div>
            <div
              style={{
                fontSize: 9,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: NEX.textSecondary,
                fontWeight: 700,
              }}
            >
              Max {props.ladder.maxCapPct}% · seller-set
            </div>
          </div>
          {tiers.map((t, i) => {
            const isCurrent = i === props.buyerTier.currentTierIndex;
            const isNext = i === props.buyerTier.nextTierIndex;
            const isPast = i < props.buyerTier.currentTierIndex;
            const isLocked = i > props.buyerTier.currentTierIndex && !isNext;
            const accent = isCurrent
              ? NEX.orange
              : isNext
                ? NEX.cyan
                : isPast
                  ? NEX.textSecondary
                  : NEX.textMute;
            return (
              <div
                key={`${t.order}-${i}`}
                style={{
                  display: "grid",
                  gridTemplateColumns: "34px 1fr auto",
                  gap: 10,
                  alignItems: "center",
                  padding: "8px 0",
                  borderBottom: i === tiers.length - 1 ? "none" : `1px solid ${NEX.cyanFaint}`,
                  opacity: isLocked ? 0.5 : 1,
                }}
              >
                <div
                  style={{
                    fontSize: 22,
                    fontWeight: 900,
                    letterSpacing: "-0.04em",
                    color: accent,
                    lineHeight: 1,
                  }}
                >
                  {String(t.order).padStart(2, "0")}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 800,
                      letterSpacing: "-0.005em",
                      textTransform: "uppercase",
                      color: isCurrent ? NEX.textPrimary : NEX.textSecondary,
                    }}
                  >
                    {t.label}
                  </div>
                  <div
                    style={{
                      fontSize: 9,
                      letterSpacing: "0.14em",
                      textTransform: "uppercase",
                      color: NEX.textMute,
                      fontWeight: 700,
                    }}
                  >
                    {isCurrent ? "★ you are here" : isNext ? "next unlock" : isPast ? "done" : "locked"}
                  </div>
                </div>
                <div
                  style={{
                    fontSize: 20,
                    fontWeight: 900,
                    letterSpacing: "-0.03em",
                    color: accent,
                  }}
                >
                  {t.discount === 0 ? "Normal" : `−${t.discount}%`}
                </div>
              </div>
            );
          })}
          {!props.signedIn && (
            <p
              style={{
                marginTop: 8,
                fontSize: 10,
                color: NEX.textSecondary,
                lineHeight: 1.5,
              }}
            >
              Sign in to see your position on the ladder + earn discounts as you order more.
            </p>
          )}
        </div>
      ) : (
        <div style={{ padding: "18px 18px 6px" }}>
          <div
            style={{
              padding: "12px 14px",
              background: NEX.panel,
              border: `1px dashed ${NEX.cyanSoft}`,
              borderRadius: 10,
              color: NEX.textSecondary,
              fontSize: 12,
              lineHeight: 1.5,
            }}
          >
            🎯 <strong style={{ color: NEX.textPrimary }}>NEX Direct Price</strong> ·
            not enabled for this shop yet. The seller can turn on tier
            rewards + share bonuses at /manage/ladder.
          </div>
        </div>
      )}

      {/* Savings + price row */}
      <div
        style={{
          marginTop: "auto",
          padding: "12px 18px 12px",
          borderTop: `1px solid ${NEX.cyan}`,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
            gap: 10,
          }}
        >
          <div>
            <div
              style={{
                fontSize: 9,
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                color: NEX.textSecondary,
                fontWeight: 700,
              }}
            >
              {props.ladder?.compareChannel ?? "typical delivery app"}
            </div>
            <div
              style={{
                fontSize: 15,
                color: NEX.textSecondary,
                textDecoration: "line-through",
                letterSpacing: "-0.01em",
              }}
            >
              {formatCurrency(compareTotal, props.product.currency)}
            </div>
            {savingTotal > 0 && (
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 800,
                  color: NEX.green,
                  letterSpacing: "0.10em",
                  textTransform: "uppercase",
                  marginTop: 2,
                }}
              >
                −{formatCurrency(savingTotal, props.product.currency)} · −{savingPct}%
              </div>
            )}
          </div>
          <div style={{ textAlign: "right" }}>
            <div
              style={{
                fontSize: 9,
                letterSpacing: "0.24em",
                textTransform: "uppercase",
                color: NEX.orange,
                fontWeight: 900,
              }}
            >
              NEX Direct
            </div>
            <div
              style={{
                fontSize: 32,
                fontWeight: 900,
                color: NEX.orange,
                letterSpacing: "-0.03em",
                lineHeight: 0.95,
              }}
            >
              {formatCurrency(subtotal, props.product.currency)}
            </div>
            {props.buyerTier.currentDiscountPct > 0 && (
              <div style={{ fontSize: 9, color: NEX.orange, letterSpacing: "0.10em", textTransform: "uppercase", fontWeight: 800, marginTop: 2 }}>
                includes −{props.buyerTier.currentDiscountPct}% loyalty
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Quantity stepper · Bauhaus square-edged */}
      <div
        style={{
          margin: "0 18px",
          padding: "10px 0",
          borderTop: `1px solid ${NEX.cyanFaint}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <div>
          <div
            style={{
              fontSize: 9,
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              color: NEX.textSecondary,
              fontWeight: 800,
            }}
          >
            Quantity
          </div>
          <div style={{ marginTop: 4, display: "inline-flex", border: `1px solid ${NEX.cyan}` }}>
            <button
              type="button"
              onClick={() => setQty((q) => Math.max(1, q - 1))}
              aria-label="Decrease quantity"
              style={{
                width: 38,
                height: 38,
                background: NEX.panel,
                color: NEX.cyan,
                border: "none",
                borderRight: `1px solid ${NEX.cyan}`,
                fontSize: 18,
                fontWeight: 900,
                cursor: qty > 1 ? "pointer" : "not-allowed",
                opacity: qty > 1 ? 1 : 0.5,
                lineHeight: 1,
              }}
            >
              −
            </button>
            <div
              style={{
                minWidth: 44,
                height: 38,
                display: "grid",
                placeItems: "center",
                background: NEX.panelHi,
                color: NEX.textPrimary,
                fontSize: 15,
                fontWeight: 800,
                fontFamily: "ui-monospace, monospace",
              }}
            >
              {qty}
            </div>
            <button
              type="button"
              onClick={() => setQty((q) => Math.min(99, q + 1))}
              aria-label="Increase quantity"
              style={{
                width: 38,
                height: 38,
                background: NEX.panel,
                color: NEX.cyan,
                border: "none",
                borderLeft: `1px solid ${NEX.cyan}`,
                fontSize: 18,
                fontWeight: 900,
                cursor: "pointer",
                lineHeight: 1,
              }}
            >
              +
            </button>
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div
            style={{
              fontSize: 9,
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              color: NEX.textSecondary,
              fontWeight: 800,
            }}
          >
            Subtotal
          </div>
          <div
            style={{
              marginTop: 4,
              fontSize: 22,
              fontWeight: 900,
              color: NEX.orange,
              letterSpacing: "-0.02em",
              lineHeight: 1,
            }}
          >
            {formatCurrency(subtotal, props.product.currency)}
          </div>
        </div>
      </div>

      {/* Two CTA row · every product/menu page carries BOTH · Founder rule */}
      <div style={{ padding: "0 18px 20px", display: "flex", gap: 8 }}>
        <button
          type="button"
          onClick={() =>
            alert(
              `Add to cart · ${qty} × ${props.product.name} · ${formatCurrency(subtotal, props.product.currency)} · wire in Bridge 22c pattern`,
            )
          }
          style={ctaPrimaryStyle()}
        >
          <span>🛒 Add to cart</span>
          <span style={ctaSubStyle()}>{formatCurrency(subtotal, props.product.currency)}</span>
        </button>
        <Link
          href={props.chatHref}
          style={ctaSecondaryStyle()}
        >
          <span>💬 Checkout · chat</span>
          <span style={ctaSubStyle({ dim: true })}>Direct to seller</span>
        </Link>
      </div>
    </div>
  );
}

function shareButtonStyle(): React.CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "8px 10px",
    background: "transparent",
    border: `1px solid ${NEX.cyan}`,
    color: NEX.cyan,
    cursor: "pointer",
    textAlign: "left",
    fontFamily: "inherit",
  };
}
function shareValueStyle(): React.CSSProperties {
  return {
    fontSize: 20,
    fontWeight: 900,
    letterSpacing: "-0.03em",
    color: NEX.cyan,
    lineHeight: 1,
    minWidth: 40,
    textAlign: "center",
  };
}
function shareLabelStyle(): React.CSSProperties {
  return {
    fontSize: 9,
    letterSpacing: "0.14em",
    textTransform: "uppercase",
    fontWeight: 800,
    color: NEX.cyan,
  };
}
function shareHintStyle(): React.CSSProperties {
  return {
    fontSize: 9,
    color: NEX.textSecondary,
    letterSpacing: "0.02em",
  };
}
function ctaPrimaryStyle(): React.CSSProperties {
  return {
    flex: 1,
    minHeight: 52,
    background: `linear-gradient(180deg, ${NEX.orangeStrong}, ${NEX.orange})`,
    color: "#0B0F1A",
    border: "none",
    fontSize: 12,
    fontWeight: 900,
    letterSpacing: "0.14em",
    textTransform: "uppercase",
    cursor: "pointer",
    boxShadow: `0 10px 26px rgba(255,114,0,0.45)`,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
    fontFamily: "inherit",
  };
}
function ctaSecondaryStyle(): React.CSSProperties {
  return {
    flex: 1,
    minHeight: 52,
    background: NEX.panel,
    color: NEX.cyan,
    border: `1px solid ${NEX.cyan}`,
    fontSize: 12,
    fontWeight: 900,
    letterSpacing: "0.14em",
    textTransform: "uppercase",
    cursor: "pointer",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
    textDecoration: "none",
  };
}
function ctaSubStyle(opts: { dim?: boolean } = {}): React.CSSProperties {
  return {
    fontSize: 10,
    letterSpacing: "0.10em",
    opacity: opts.dim ? 0.75 : 0.85,
    fontWeight: 700,
  };
}
