// Indicative FX rates — surfaces in the UI labelled "indicative".
// Canonical Xrated Trades pricing is GBP. This module exposes
// cross-rates so the PDP can offer a customer-facing display-currency
// toggle (GBP / USD / EUR / AUD) — final charge is always GBP.
//
// Rates last verified against XE mid-market on 2026-06-23. Drift past
// ~2% should trigger a refresh from https://www.xe.com/currencyconverter/.
// Format mirrors the hammer (Hammerex) FX module so the conversion
// helpers in PriceDisplay.tsx work identically across repos.
export const FX_RATES_VERIFIED_AT = "2026-06-23";

export const FX = {
  // IDR is kept as the cross-rate denominator (perIDR) so the maths
  // matches the hammer repo line-for-line — we don't surface IDR in the
  // Xrated PDP UI.
  IDR: { code: "IDR", symbol: "Rp", perIDR: 1 },
  USD: { code: "USD", symbol: "$",  perIDR: 1 / 17753 },
  AUD: { code: "AUD", symbol: "A$", perIDR: 1 / 12578 },
  EUR: { code: "EUR", symbol: "€",  perIDR: 1 / 20619 },
  GBP: { code: "GBP", symbol: "£",  perIDR: 1 / 23827 }
} as const;

export type Currency = keyof typeof FX;

// Map an ISO-2 country code to the most natural display currency for
// that visitor. Used by the marketing pricing page to render an
// "approximate in your currency" row beneath the canonical GBP price.
// Anything not in the list defaults to GBP (i.e. we skip the approx
// row rather than guessing).
export function currencyForCountry(iso2: string | null | undefined): Currency | null {
  if (!iso2) return null;
  const cc = iso2.toUpperCase();
  // EUR zone — biggest official + de-facto users.
  const EUR_COUNTRIES = new Set([
    "AT","BE","CY","DE","EE","ES","FI","FR","GR","HR","IE","IT","LT","LU",
    "LV","MT","NL","PT","SI","SK",
    // De-facto / pegged users we treat as EUR for display only.
    "AD","MC","ME","SM","VA","XK"
  ]);
  if (cc === "GB" || cc === "IM" || cc === "JE" || cc === "GG") return "GBP";
  if (cc === "US" || cc === "PR" || cc === "VI" || cc === "GU" || cc === "AS" || cc === "MP" || cc === "EC" || cc === "SV") return "USD";
  if (cc === "AU" || cc === "NZ" || cc === "CK" || cc === "NR" || cc === "TV" || cc === "KI") return "AUD";
  if (EUR_COUNTRIES.has(cc)) return "EUR";
  return null;
}

// Convert a GBP amount (whole pounds, decimal) to the target currency
// using indicative FX rates. Returns null if target = GBP (caller is
// expected to skip the approximation row in that case).
export function convertGbpToCurrency(amountGbp: number, target: Currency): number {
  if (target === "GBP") return amountGbp;
  const gbpPerIdr = FX.GBP.perIDR;
  const targetPerIdr = FX[target].perIDR;
  const idr = amountGbp / gbpPerIdr;
  return idr * targetPerIdr;
}
