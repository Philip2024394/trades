"use client";

// WholesaleDeliveryWidget — customer-side location picker + live
// banded delivery quote.
//
// Two ways to set the customer location:
//   1. "Use my location" → browser Geolocation API (no fallback to a
//      server; the merchant's permission UI handles that).
//   2. Postcode field → /api/trade-off/postcode-lookup → lat/lng.
//
// Once we have customer coords, POST to /api/trade-off/wholesale-quote
// with the cart total. The endpoint returns the matched band, the
// delivery price, and an outside_zone flag when distance > max_km.
//
// Maps in this widget reuse the same YardMapPreview SVG that the
// dashboard yard editor uses — yard pin, customer pin, banded rings.

import { useState } from "react";
import type {
  HammerexTradeOffListing,
  HammerexXratedWholesaleZone
} from "@/lib/supabase";
import { formatGbp } from "@/lib/xratedCart";
import { YardMapPreview } from "./YardMapPreview";

type QuoteResult =
  | {
      kind: "quoted";
      delivery_pence: number;
      eta_label: string | null;
      applied_band_km: number | null;
      distance_km: number;
      qualifies_for_min_order: boolean;
      min_order_pence?: number;
      qualifies_for_free: boolean;
    }
  | { kind: "outside_zone"; distance_km: number }
  | { kind: "error"; message: string };

export function WholesaleDeliveryWidget({
  listing,
  wholesaleZone,
  cartTotalPence,
  firstName,
  onQuoteChange
}: {
  listing: HammerexTradeOffListing;
  wholesaleZone: HammerexXratedWholesaleZone;
  cartTotalPence: number;
  firstName: string;
  onQuoteChange: (quote: QuoteResult | null) => void;
}) {
  const [postcode, setPostcode] = useState<string>("");
  const [customerLat, setCustomerLat] = useState<number | null>(null);
  const [customerLng, setCustomerLng] = useState<number | null>(null);
  const [customerLabel, setCustomerLabel] = useState<string | null>(null);
  const [busy, setBusy] = useState<"geo" | "postcode" | "quote" | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [quote, setQuote] = useState<QuoteResult | null>(null);

  const yardLat = listing.wholesale_origin_lat;
  const yardLng = listing.wholesale_origin_lng;

  async function fetchQuote(lat: number, lng: number, label?: string | null) {
    setBusy("quote");
    setErr(null);
    try {
      const res = await fetch("/api/trade-off/wholesale-quote", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          slug: listing.slug,
          customer_lat: lat,
          customer_lng: lng,
          cart_total_pence: cartTotalPence
        })
      });
      const json = await res.json();
      if (!json.ok) {
        const e: QuoteResult = { kind: "error", message: json.error ?? "Quote failed." };
        setQuote(e);
        onQuoteChange(e);
        return;
      }
      if (json.error === "outside_zone") {
        const e: QuoteResult = {
          kind: "outside_zone",
          distance_km: Number(json.distance_km) || 0
        };
        setQuote(e);
        onQuoteChange(e);
        if (label) setCustomerLabel(label);
        return;
      }
      const q: QuoteResult = {
        kind: "quoted",
        delivery_pence: Number(json.delivery_pence) || 0,
        eta_label: json.eta_label ?? null,
        applied_band_km:
          typeof json.applied_band_km === "number" ? json.applied_band_km : null,
        distance_km: Number(json.distance_km) || 0,
        qualifies_for_free: Boolean(json.qualifies_for_free),
        qualifies_for_min_order: Boolean(json.qualifies_for_min_order),
        min_order_pence: typeof json.min_order_pence === "number" ? json.min_order_pence : undefined
      };
      setQuote(q);
      onQuoteChange(q);
      if (label) setCustomerLabel(label);
    } catch {
      const e: QuoteResult = { kind: "error", message: "Network error — try again." };
      setQuote(e);
      onQuoteChange(e);
    } finally {
      setBusy(null);
    }
  }

  async function useGeo() {
    setErr(null);
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setErr("This browser can't share your location.");
      return;
    }
    setBusy("geo");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCustomerLat(pos.coords.latitude);
        setCustomerLng(pos.coords.longitude);
        setCustomerLabel("You");
        fetchQuote(pos.coords.latitude, pos.coords.longitude, "You");
      },
      (e) => {
        setBusy(null);
        setErr(
          e.code === e.PERMISSION_DENIED
            ? "Location permission denied — enter a postcode instead."
            : "Could not read your location."
        );
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 60_000 }
    );
  }

  async function useUkPostcode() {
    setErr(null);
    const pc = postcode.trim();
    if (!pc) {
      setErr("Enter a postcode first.");
      return;
    }
    setBusy("postcode");
    try {
      const res = await fetch(
        `/api/trade-off/postcode-lookup?postcode=${encodeURIComponent(pc)}`
      );
      const json = await res.json();
      if (!json.ok) {
        setBusy(null);
        setErr(
          json.error === "not_found"
            ? "Postcode not found (UK only)."
            : json.error === "invalid"
              ? "That doesn't look like a valid UK postcode."
              : "Lookup failed — try again."
        );
        return;
      }
      setCustomerLat(json.lat);
      setCustomerLng(json.lng);
      setCustomerLabel(pc.toUpperCase());
      await fetchQuote(json.lat, json.lng, pc.toUpperCase());
    } catch {
      setBusy(null);
      setErr("Network error — try again.");
    }
  }

  if (typeof yardLat !== "number" || typeof yardLng !== "number") {
    return (
      <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
        <p className="text-[13px] text-neutral-500">
          {firstName} hasn&rsquo;t set their yard location yet — message them
          on WhatsApp for a delivery quote.
        </p>
      </div>
    );
  }

  const bands = Array.isArray(wholesaleZone.banded_pricing)
    ? wholesaleZone.banded_pricing.map((b) => ({
        max_km: b.max_km,
        price_pence: b.price_pence
      }))
    : [];

  return (
    <div className="space-y-3 rounded-2xl border border-neutral-200 bg-white p-4 sm:p-5">
      <div>
        <p
          className="text-[10px] font-extrabold uppercase tracking-[0.22em]"
          style={{ color: "#FFB300" }}
        >
          Where are we delivering to?
        </p>
        <p className="mt-1 text-[13px] text-neutral-500">
          {firstName} delivers from a yard. Set your location to see the
          delivery cost.
        </p>
      </div>

      <button
        type="button"
        onClick={useGeo}
        disabled={busy !== null}
        className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg border-2 border-neutral-300 bg-white px-4 text-[13px] font-extrabold uppercase tracking-wider text-neutral-700 transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 2v3" />
          <path d="M12 19v3" />
          <path d="M2 12h3" />
          <path d="M19 12h3" />
          <circle cx="12" cy="12" r="6" />
          <circle cx="12" cy="12" r="2" fill="currentColor" />
        </svg>
        {busy === "geo" ? "Reading…" : "Use my location"}
      </button>

      <div className="flex flex-col gap-1.5">
        <label className="text-[10px] font-extrabold uppercase tracking-widest text-neutral-500">
          Or enter your postcode
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            value={postcode}
            maxLength={12}
            onChange={(e) => setPostcode(e.target.value.toUpperCase())}
            placeholder="e.g. M16 0RA"
            className="block h-11 w-full rounded-lg border border-neutral-200 bg-white px-3 text-[13px] font-bold uppercase tracking-widest text-neutral-900 outline-none focus:border-[#FFB300]"
          />
          <button
            type="button"
            onClick={useUkPostcode}
            disabled={busy !== null}
            className="inline-flex h-11 items-center rounded-lg px-4 text-[13px] font-extrabold uppercase tracking-wider text-neutral-900 transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
            style={{ background: "#FFB300" }}
          >
            {busy === "postcode" ? "…" : "Set"}
          </button>
        </div>
      </div>

      {err && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[13px] font-semibold text-red-700">
          {err}
        </p>
      )}

      <div className="overflow-hidden rounded-xl border border-neutral-200 bg-neutral-50">
        <YardMapPreview
          yardLat={yardLat}
          yardLng={yardLng}
          customerLat={customerLat ?? undefined}
          customerLng={customerLng ?? undefined}
          freeRadiusKm={wholesaleZone.free_radius_km ?? undefined}
          bands={bands}
          appliedBandKm={
            quote && quote.kind === "quoted" ? quote.applied_band_km ?? undefined : undefined
          }
          yardLabel={`${firstName}'s yard`}
          customerLabel={customerLabel ?? "You"}
        />
      </div>

      {quote && quote.kind === "quoted" && (
        <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-3">
          <p className="text-[13px] font-extrabold text-neutral-900">
            {quote.delivery_pence === 0
              ? "Free delivery"
              : `Delivery: ${formatGbp(quote.delivery_pence)}`}
          </p>
          <p className="mt-1 text-[13px] text-neutral-500">
            {quote.distance_km.toFixed(1)} km from yard
            {quote.applied_band_km !== null
              ? ` (within ${quote.applied_band_km} km band)`
              : ""}
          </p>
          {quote.eta_label && (
            <p className="text-[13px] text-neutral-500">{quote.eta_label}</p>
          )}
          {!quote.qualifies_for_min_order && quote.min_order_pence ? (
            <p className="mt-1 text-[13px] font-bold text-orange-600">
              Minimum order for this band: {formatGbp(quote.min_order_pence)}.
            </p>
          ) : null}
        </div>
      )}

      {quote && quote.kind === "outside_zone" && (
        <div className="rounded-xl border border-orange-200 bg-orange-50 p-3">
          <p className="text-[13px] font-extrabold text-orange-900">
            Outside delivery area &mdash; WhatsApp for custom quote
          </p>
          <p className="mt-1 text-[13px] text-orange-800">
            {quote.distance_km.toFixed(1)} km from {firstName}&rsquo;s yard
            &mdash; beyond the standard delivery cap.
          </p>
        </div>
      )}

      {quote && quote.kind === "error" && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3">
          <p className="text-[13px] font-bold text-red-700">{quote.message}</p>
        </div>
      )}

      {listing.wholesale_allow_pickup && (
        <p className="text-[13px] text-neutral-500">
          Or collect at the yard&mdash;mention &ldquo;Click &amp; Collect&rdquo;
          in your WhatsApp message.
        </p>
      )}
    </div>
  );
}
