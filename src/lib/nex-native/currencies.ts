// src/lib/nex-native/currencies.ts
//
// NEX currency library · sealed 2026-10-01.
// -----------------------------------------------------------------------------
// Static list of the currencies NEX supports at product-pricing level.
// Lives in TypeScript (not DB) because the set is small and stable
// and we don't need to query by currency metadata.
//
// Default = IDR (Indonesia launch · 2026-09-27 package doctrine).
// Full list covers SEA + major English-speaking markets so sellers
// can price for their local buyers from day one.

export interface NexCurrency {
  code: string;      // ISO 4217
  symbol: string;    // display prefix (e.g. "Rp", "£")
  label: string;     // human label for the dropdown
  /** Minor-unit multiplier · how many "cents" per major unit.
   *  IDR has no sub-units so sellers enter whole rupiah, but we
   *  still store × 100 in nex_product.price_pence for a uniform
   *  bigint-based money storage across the catalogue. */
  minorUnitPerMajor: number;
}

export const NEX_CURRENCIES: NexCurrency[] = [
  { code: "IDR", symbol: "Rp", label: "IDR · Indonesian Rupiah", minorUnitPerMajor: 100 },
  { code: "GBP", symbol: "£",  label: "GBP · British Pound",     minorUnitPerMajor: 100 },
  { code: "USD", symbol: "$",  label: "USD · US Dollar",         minorUnitPerMajor: 100 },
  { code: "EUR", symbol: "€",  label: "EUR · Euro",              minorUnitPerMajor: 100 },
  { code: "SGD", symbol: "S$", label: "SGD · Singapore Dollar",  minorUnitPerMajor: 100 },
  { code: "MYR", symbol: "RM", label: "MYR · Malaysian Ringgit", minorUnitPerMajor: 100 },
  { code: "THB", symbol: "฿",  label: "THB · Thai Baht",         minorUnitPerMajor: 100 },
  { code: "PHP", symbol: "₱",  label: "PHP · Philippine Peso",   minorUnitPerMajor: 100 },
  { code: "VND", symbol: "₫",  label: "VND · Vietnamese Dong",   minorUnitPerMajor: 100 },
  { code: "AUD", symbol: "A$", label: "AUD · Australian Dollar", minorUnitPerMajor: 100 },
];

export const DEFAULT_CURRENCY = "IDR";

export function findCurrency(code: string | null | undefined): NexCurrency | null {
  if (!code) return null;
  const want = code.toUpperCase();
  return NEX_CURRENCIES.find((c) => c.code === want) ?? null;
}

export function isSupportedCurrency(code: string): boolean {
  return NEX_CURRENCIES.some((c) => c.code === code.toUpperCase());
}
