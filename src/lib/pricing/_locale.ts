// Locale + currency detection helpers.
//
// Two-tier detection:
//  1. Server-side: Accept-Language header + Cloudflare CF-IPCountry
//     (if present) → best-effort country + currency guess
//  2. Client-side: navigator.language + Intl formatter — the DualPrice
//     component uses this when hydrating so the local price shows
//     immediately without a network round-trip
//
// Never assumes: user can override by picking a country/currency in
// account settings once that surface exists.

// Country → currency map for the currencies our FX service covers.
export const COUNTRY_TO_CURRENCY: Record<string, string> = {
  GB: "GBP", UK: "GBP", IE: "EUR", FR: "EUR", DE: "EUR", ES: "EUR",
  IT: "EUR", NL: "EUR", BE: "EUR", PT: "EUR", AT: "EUR", FI: "EUR",
  GR: "EUR", LU: "EUR", MT: "EUR", CY: "EUR", EE: "EUR", LV: "EUR",
  LT: "EUR", SI: "EUR", SK: "EUR",
  US: "USD",
  CA: "CAD",
  AU: "AUD",
  NZ: "NZD",
  CH: "CHF",
  JP: "JPY",
  SG: "SGD",
  ID: "IDR",
  IN: "INR",
  AE: "AED",
  ZA: "ZAR",
  CN: "CNY"
};

// Language code → most common country (fallback when no CF-IPCountry)
const LANG_TO_COUNTRY: Record<string, string> = {
  en: "GB",
  fr: "FR",
  de: "DE",
  es: "ES",
  it: "IT",
  nl: "NL",
  pt: "PT",
  id: "ID",
  ja: "JP",
  zh: "CN",
  hi: "IN",
  ar: "AE"
};

export function currencyFor(country: string): string {
  return COUNTRY_TO_CURRENCY[country.toUpperCase()] ?? "GBP";
}

// Server-side detection from headers. Prefers CF-IPCountry (if the
// platform sits behind Cloudflare) then falls back to Accept-Language.
export function detectFromHeaders(headers: {
  acceptLanguage?: string | null;
  cfIpCountry?:    string | null;
}): { country: string; currency: string } {
  if (headers.cfIpCountry && COUNTRY_TO_CURRENCY[headers.cfIpCountry.toUpperCase()]) {
    const country = headers.cfIpCountry.toUpperCase();
    return { country, currency: COUNTRY_TO_CURRENCY[country] };
  }
  const acceptLang = headers.acceptLanguage ?? "";
  const primary = acceptLang.split(",")[0]?.split(";")[0]?.trim() ?? "en-GB";
  const [langPart, regionPart] = primary.split("-");
  const country = regionPart?.toUpperCase()
    ?? LANG_TO_COUNTRY[langPart.toLowerCase()]
    ?? "GB";
  return { country, currency: currencyFor(country) };
}

// Format a monetary value in a target currency using the browser's
// Intl.NumberFormat. Works both server + client (falls back to a
// simple concat on non-supporting environments).
export function formatMoney(amount: number, currency: string, locale?: string): string {
  try {
    return new Intl.NumberFormat(locale ?? undefined, {
      style: "currency",
      currency: currency,
      maximumFractionDigits: currency === "JPY" || currency === "IDR" ? 0 : 2
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}
