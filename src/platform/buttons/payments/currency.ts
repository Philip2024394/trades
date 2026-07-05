// Currency-aware amount handling.
//
// `amountMinor` is the ISO 4217 smallest unit — cents for USD, paise
// for INR, rupiah for IDR (yes, IDR has zero decimals — Rp 1,000 is
// stored as amountMinor: 1000, not 100000). Every processor needs to
// know how many decimals to divide by when they display or send an
// amount to a provider.
//
// Sources:
//   • ISO 4217 exponent table
//   • Stripe zero-decimal currency list
//     (https://stripe.com/docs/currencies#zero-decimal)
//   • BIS 3-decimal currency list
//
// Errors on the side of caution — if a currency isn't in the table we
// default to 2 decimals, matching what most Western currencies use.

const ZERO_DECIMAL = new Set([
  "BIF", "CLP", "DJF", "GNF", "IDR", "ISK", "JPY", "KMF", "KRW",
  "MGA", "PYG", "RWF", "UGX", "UYI", "VND", "VUV", "XAF", "XOF", "XPF"
]);

const THREE_DECIMAL = new Set([
  "BHD", "IQD", "JOD", "KWD", "LYD", "OMR", "TND"
]);

/** Return the ISO 4217 exponent (number of decimal places) for a
 *  currency code. Defaults to 2 for anything unrecognised. */
export function currencyDecimals(code: string): number {
  const c = code.toUpperCase();
  if (ZERO_DECIMAL.has(c)) return 0;
  if (THREE_DECIMAL.has(c)) return 3;
  return 2;
}

/** Convert amountMinor → the major-unit numeric value.
 *  amountMinor 4999 USD → 49.99
 *  amountMinor 100000 IDR → 100000 (IDR is zero-decimal)
 *  amountMinor 1234 BHD → 1.234
 */
export function amountToMajor(amountMinor: number, currency: string): number {
  const dp = currencyDecimals(currency);
  if (dp === 0) return amountMinor;
  return amountMinor / Math.pow(10, dp);
}

/** Reverse — take a major unit and convert to smallest units. Useful
 *  when a merchant types "49.99" and we need to store it. */
export function amountToMinor(amountMajor: number, currency: string): number {
  const dp = currencyDecimals(currency);
  if (dp === 0) return Math.round(amountMajor);
  return Math.round(amountMajor * Math.pow(10, dp));
}

/** Locale-aware Intl display. Falls back to a plain currency prefix
 *  if Intl doesn't know the currency (rare). */
export function formatMoney(
  amountMinor: number,
  currency: string,
  locale?: string
): string {
  const dp = currencyDecimals(currency);
  const value = amountToMajor(amountMinor, currency);
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      minimumFractionDigits: dp,
      maximumFractionDigits: dp
    }).format(value);
  } catch {
    return `${currency} ${value.toLocaleString(locale, {
      minimumFractionDigits: dp,
      maximumFractionDigits: dp
    })}`;
  }
}

/** Provider-facing: what to send in a request that expects a
 *  MAJOR-unit string like "49.99" (PayPal, Mollie, Coinbase Commerce). */
export function formatMajorString(
  amountMinor: number,
  currency: string
): string {
  const dp = currencyDecimals(currency);
  const value = amountToMajor(amountMinor, currency);
  return value.toFixed(dp);
}

/** Provider-facing: what to send when the provider expects the smallest
 *  currency unit (Stripe, Adyen, Klarna, Razorpay, Midtrans-for-IDR). */
export function formatMinorInt(amountMinor: number, _currency: string): number {
  return Math.round(amountMinor);
}
