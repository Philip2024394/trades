// src/lib/nex/directoryCountry.ts
//
// Country Foundation Step 5 · directory-country normalisation · 2026-08-22.
//
// Server-side pages read `?country=XX` from URL searchParams; this helper
// normalises the raw value to a validated ISO 3166-1 alpha-2 code.
//
// Per Philip 2026-08-22 Step 5 decisions:
//   · Query param `?country=XX` is the SERVER's source of "current market"
//     (per Four-Country doctrine · distinguishes user country / current market
//     / directory country / business country).
//   · Invalid params (lowercase, malformed, etc.) → SILENT FALLBACK to 'ID'
//     with a console.warn. Bookmarks / accidental typos don't crash the page.
//   · Default when absent → 'ID' (currently the only country with inventory).
//   · Valid but-empty-inventory countries (e.g. 'GB') pass through verbatim
//     and return an honest empty result set (never silently swapped to 'ID').
//
// Cross-refs:
//   project_nex_country_foundation_phased_plan_2026_08_22 (Step 5)
//   project_nex_country_scope_from_phone_country_code_2026_08_22 (Four-Country doctrine)
//   project_nex_truth_invariant_2026_08_22

/** Default current market when no country param is provided.
 *  Currently 'ID' because all inventory is Yogyakarta. Will be replaced by an
 *  identity-derived current market when client-side identity→URL bridging ships. */
export const DEFAULT_MARKET = "ID";

/** Normalise a raw searchParams country value to a valid ISO 3166-1 alpha-2 code.
 *  - `undefined` / `null` / empty → DEFAULT_MARKET
 *  - `string[]` (Next.js repeated params) → first element re-normalised
 *  - Valid ISO-2 (`^[A-Z]{2}$`) → returned verbatim
 *  - Anything else → console.warn + DEFAULT_MARKET fallback
 */
export function normalizeDirectoryCountry(raw: unknown): string {
  if (raw == null) return DEFAULT_MARKET;
  if (Array.isArray(raw)) return normalizeDirectoryCountry(raw[0]);
  if (typeof raw !== "string" || raw.length === 0) {
    // eslint-disable-next-line no-console
    console.warn(`[nex-directory] Invalid country param ${JSON.stringify(raw)} — falling back to '${DEFAULT_MARKET}'`);
    return DEFAULT_MARKET;
  }
  if (!/^[A-Z]{2}$/.test(raw)) {
    // eslint-disable-next-line no-console
    console.warn(`[nex-directory] Invalid country param ${JSON.stringify(raw)} — falling back to '${DEFAULT_MARKET}'`);
    return DEFAULT_MARKET;
  }
  return raw;
}
