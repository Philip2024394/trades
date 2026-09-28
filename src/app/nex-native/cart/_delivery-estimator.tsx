"use client";

// src/app/nex-native/cart/_delivery-estimator.tsx
//
// Bridge 25c · Per-shop delivery-fare estimator on the /cart page.
// ----------------------------------------------------------------
// Renders one of three states per shop card:
//   1. FREE       · any dish in this shop's cart has the
//                    free_delivery perk · dish name shown as reason
//   2. ESTIMATE   · buyer tapped "Use my location" · we ran
//                    haversine + Rp 2,500/km rate and show fare
//   3. UNKNOWN    · buyer hasn't shared location or seller doesn't
//                    have lat/lng · "Confirm delivery in chat"
//
// Emits the resolved NexCartDeliveryQuote via `onQuote` so the cart
// client can attach it to the cart_payload · the seller sees the
// exact quote inside the cart_order bubble and can book their bike
// courier accordingly.

import { useEffect, useMemo, useState } from "react";
import {
  estimateBikeFareBetween,
  formatIdrPence,
  type BikeDeliveryEstimate,
  type NexCartDeliveryQuote,
} from "@/lib/nex-native/bike-delivery-service";

const NEX = {
  border: "rgba(139, 169, 209, 0.14)",
  borderStrong: "rgba(139, 169, 209, 0.24)",
  text: "#F4F7FC",
  textDim: "#8BA9D1",
  textMute: "#526B89",
  cyan: "#00AFFF",
  cyanSoft: "rgba(0,175,255,0.5)",
  orange: "#FF7200",
  green: "#16D66B",
  amber: "#F59E0B",
  red: "#FF3355",
};
const SANS =
  "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

export function DeliveryEstimator({
  shopId,
  shopDisplayName,
  shopLat,
  shopLng,
  freeReason,
  onQuote,
}: {
  shopId: string;
  shopDisplayName: string;
  shopLat: number | null;
  shopLng: number | null;
  /** When set, at least one line in this shop's cart has the
   *  free_delivery perk · the estimator jumps straight to FREE state
   *  and skips geolocation entirely. */
  freeReason?: string | null;
  onQuote: (shopId: string, quote: NexCartDeliveryQuote) => void;
}) {
  const [buyerLat, setBuyerLat] = useState<number | null>(null);
  const [buyerLng, setBuyerLng] = useState<number | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Compute the estimate from lat/lng.
  const estimate: BikeDeliveryEstimate | null = useMemo(() => {
    if (freeReason) return null;
    return estimateBikeFareBetween(buyerLat, buyerLng, shopLat, shopLng);
  }, [buyerLat, buyerLng, shopLat, shopLng, freeReason]);

  // Push the resolved quote up so the cart-client can bundle it.
  useEffect(() => {
    if (freeReason) {
      onQuote(shopId, { kind: "free", free_reason: freeReason });
      return;
    }
    if (estimate) {
      onQuote(shopId, {
        kind: "estimate",
        distance_km: estimate.distance_km,
        fare_pence: estimate.fare_pence,
        currency: "IDR",
        eta_minutes: estimate.eta_minutes,
      });
      return;
    }
    onQuote(shopId, { kind: "unknown" });
  }, [estimate, freeReason, shopId, onQuote]);

  function requestLocation() {
    setError(null);
    if (!("geolocation" in navigator)) {
      setError("Your browser doesn't support geolocation");
      return;
    }
    if (!shopLat || !shopLng) {
      setError(
        `${shopDisplayName} hasn't shared a pickup location · confirm delivery in chat`,
      );
      return;
    }
    setPending(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setBuyerLat(pos.coords.latitude);
        setBuyerLng(pos.coords.longitude);
        setPending(false);
      },
      (err) => {
        setPending(false);
        setError(
          err.code === err.PERMISSION_DENIED
            ? "Location permission denied · confirm delivery in chat"
            : "Couldn't get your location · try again or confirm in chat",
        );
      },
      { enableHighAccuracy: false, maximumAge: 60_000, timeout: 8_000 },
    );
  }

  /* --------------- Free state --------------- */
  if (freeReason) {
    return (
      <div style={containerStyle("free")}>
        <div>
          <div style={eyebrowStyle("free")}>🚚 Delivery</div>
          <div style={{ fontSize: 15, fontWeight: 800, color: "#B8F1CC" }}>
            FREE · included with {freeReason}
          </div>
          <div style={hintStyle}>
            Seller pays the courier · no extra fee for you.
          </div>
        </div>
      </div>
    );
  }

  /* --------------- Estimate state ---------- */
  if (estimate) {
    return (
      <div style={containerStyle("estimate")}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={eyebrowStyle("estimate")}>🚚 Delivery estimate</div>
          <div
            style={{
              fontSize: 15,
              fontWeight: 800,
              color: NEX.orange,
              marginTop: 2,
            }}
          >
            {formatIdrPence(estimate.fare_pence)}{" "}
            <span
              style={{
                fontSize: 11,
                color: NEX.textDim,
                fontWeight: 600,
                letterSpacing: "0.02em",
              }}
            >
              · {estimate.distance_km.toFixed(1)} km · ~{estimate.eta_minutes} min
            </span>
          </div>
          <div style={hintStyle}>
            Standard bike rate · matches GoSend / GrabExpress / Maxim ·
            seller books the courier · final fare confirmed by the
            driver.
          </div>
        </div>
        <button
          type="button"
          onClick={requestLocation}
          disabled={pending}
          style={smallButton}
          aria-label="Recalculate delivery"
        >
          {pending ? "…" : "↻"}
        </button>
      </div>
    );
  }

  /* --------------- Unknown state ----------- */
  return (
    <div style={containerStyle("unknown")}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={eyebrowStyle("unknown")}>🚚 Delivery</div>
        <div style={{ fontSize: 13, color: NEX.text, marginTop: 2 }}>
          {shopLat && shopLng
            ? "Share your location to see the bike-delivery estimate."
            : `${shopDisplayName} hasn't shared a pickup location · confirm delivery in chat.`}
        </div>
        {error && (
          <div
            role="alert"
            style={{
              marginTop: 6,
              fontSize: 11,
              color: "#FFB4C0",
            }}
          >
            {error}
          </div>
        )}
      </div>
      {shopLat && shopLng && (
        <button
          type="button"
          onClick={requestLocation}
          disabled={pending}
          style={primaryButton}
        >
          {pending ? "Locating…" : "Use my location"}
        </button>
      )}
    </div>
  );
}

/* ---------- Styles ---------- */

function containerStyle(kind: "free" | "estimate" | "unknown"): React.CSSProperties {
  const map: Record<
    "free" | "estimate" | "unknown",
    { bg: string; border: string }
  > = {
    free: {
      bg: "rgba(22,214,107,0.10)",
      border: "rgba(22,214,107,0.35)",
    },
    estimate: {
      bg: "rgba(255,120,0,0.10)",
      border: "rgba(255,120,0,0.35)",
    },
    unknown: {
      bg: "rgba(139,169,209,0.08)",
      border: NEX.borderStrong,
    },
  };
  const c = map[kind];
  return {
    display: "flex",
    alignItems: "flex-start",
    gap: 12,
    padding: "12px 14px",
    borderRadius: 12,
    background: c.bg,
    border: `1px solid ${c.border}`,
    fontFamily: SANS,
  };
}

function eyebrowStyle(
  kind: "free" | "estimate" | "unknown",
): React.CSSProperties {
  const map = {
    free: NEX.green,
    estimate: NEX.orange,
    unknown: NEX.cyan,
  };
  return {
    fontSize: 10,
    letterSpacing: "0.22em",
    textTransform: "uppercase",
    color: map[kind],
    fontWeight: 700,
    marginBottom: 2,
  };
}

const hintStyle: React.CSSProperties = {
  fontSize: 11,
  color: NEX.textMute,
  lineHeight: 1.5,
  marginTop: 4,
};

const primaryButton: React.CSSProperties = {
  padding: "8px 14px",
  borderRadius: 999,
  background: "rgba(0,175,255,0.14)",
  border: `1px solid ${NEX.cyanSoft}`,
  color: NEX.text,
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  cursor: "pointer",
  fontFamily: SANS,
  whiteSpace: "nowrap",
  flexShrink: 0,
};

const smallButton: React.CSSProperties = {
  width: 32,
  height: 32,
  borderRadius: 999,
  background: "rgba(0,0,0,0.35)",
  border: `1px solid ${NEX.borderStrong}`,
  color: NEX.text,
  fontSize: 15,
  fontWeight: 800,
  lineHeight: 1,
  cursor: "pointer",
  fontFamily: SANS,
  flexShrink: 0,
};
