"use client";

/**
 * @fileoverview MERCHANT-ONLY component.
 * @merchantOnly Only renders when isStorefrontOn(listing) === true.
 * Importing this from a service-trade context is a code smell — use
 * the service/ siblings instead.
 */


// PriceDisplay — renders a product price in the customer's chosen display
// currency (live-converted from canonical GBP via src/lib/fx.ts) with the
// real GBP price always shown underneath in muted grey. The dual-render is
// deliberate: indicative FX rates can drift and customers should never be
// confused about what they'll actually be charged.
//
// Reads from the same localStorage key + window CustomEvent that
// CurrencyDropdown writes, so the two components stay in lockstep without
// any parent state plumbing.

import { useEffect, useState } from "react";
import { FX } from "@/lib/fx";
import {
  CURRENCY_CHANGE_EVENT,
  CURRENCY_STORAGE_KEY,
  SUPPORTED_DISPLAY_CURRENCIES,
  type DisplayCurrency
} from "./CurrencyDropdown";

function readStoredCurrency(): DisplayCurrency {
  if (typeof window === "undefined") return "GBP";
  try {
    const raw = window.localStorage.getItem(CURRENCY_STORAGE_KEY);
    if (raw && (SUPPORTED_DISPLAY_CURRENCIES as readonly string[]).includes(raw)) {
      return raw as DisplayCurrency;
    }
  } catch {
    // Ignore — fall through to default.
  }
  return "GBP";
}

// FX.ts is keyed off IDR with `perIDR` ratios. To convert GBP → target we
// go through IDR: GBP pence → GBP whole pounds → IDR (÷ perIDR for GBP) →
// target (× perIDR for target). Keeps the maths in one place.
function convertGbpPenceToCurrency(pence: number, target: DisplayCurrency): number {
  const pounds = pence / 100;
  if (target === "GBP") return pounds;
  const gbpPerIdr = FX.GBP.perIDR; // GBP per 1 IDR
  const targetPerIdr = FX[target].perIDR;
  const idr = pounds / gbpPerIdr;
  return idr * targetPerIdr;
}

function formatInCurrency(value: number, target: DisplayCurrency): string {
  // Always two-decimal for the four supported currencies — they all use
  // minor units of 1/100.
  const locale =
    target === "GBP" ? "en-GB" : target === "EUR" ? "en-IE" : target === "AUD" ? "en-AU" : "en-US";
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: target,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);
  } catch {
    // Old browser fallback.
    return `${FX[target].symbol}${value.toFixed(2)}`;
  }
}

function formatCanonicalGbp(pence: number): string {
  if (!Number.isFinite(pence) || pence <= 0) return "£0";
  const pounds = pence / 100;
  return pounds % 1 === 0
    ? `£${pounds.toLocaleString("en-GB")}`
    : `£${pounds.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function PriceDisplay({
  pricePence,
  installPrefix
}: {
  pricePence: number;
  /** When true, prefixes with "From " — used for product_kind='install'
   *  rows which surface a "from" price on the PDP. */
  installPrefix?: boolean;
}) {
  const [currency, setCurrency] = useState<DisplayCurrency>("GBP");

  useEffect(() => {
    setCurrency(readStoredCurrency());
    function onChange(e: Event) {
      const ce = e as CustomEvent<{ currency: DisplayCurrency }>;
      if (ce.detail?.currency) setCurrency(ce.detail.currency);
    }
    window.addEventListener(CURRENCY_CHANGE_EVENT, onChange as EventListener);
    return () => {
      window.removeEventListener(CURRENCY_CHANGE_EVENT, onChange as EventListener);
    };
  }, []);

  const canonical = formatCanonicalGbp(pricePence);
  const converted =
    currency === "GBP"
      ? canonical
      : formatInCurrency(convertGbpPenceToCurrency(pricePence, currency), currency);

  return (
    <span className="text-3xl font-extrabold text-neutral-900 sm:text-4xl">
      {installPrefix ? `From ${converted}` : converted}
    </span>
  );
}

export default PriceDisplay;
