// src/lib/nex/i18n/supported-locales.ts
//
// Phase B.7 · NEX Universal Language Foundation.
// -----------------------------------------------
// Data-driven supported-locale registry · founder-sealed 2026-10-07.
//
// Architectural rule
// ------------------
// Adding a new NEX language = add an entry here + add a translation
// pack. ZERO database schema change required. The `nex_account.locale`
// column (migration 071) is validated against this registry at the
// resolver layer rather than relying on a DB CHECK, so the schema
// stays open for future locales without a migration ladder.
//
// Each entry is a plain data record with:
//   · `code`     · the canonical NEX locale tag used in URLs, in the
//                  account `locale` column, and as the key into the
//                  translation packs. Short, lowercase, no region.
//   · `label`    · the native-script name of the language · shown in
//                  pickers (always the user's own language's label,
//                  so they recognise it regardless of current locale).
//   · `pack`     · the matching translation pack module. Any new pack
//                  must exist in `./packs/<code>.ts` with every key
//                  from `I18N_KEYS` populated or TypeScript fails.
//
// Doctrine
//   · Country, language, and currency are SEPARATE axes. `"id"`
//     means Indonesian LANGUAGE here · it does NOT mean Indonesia
//     the country. A user in Japan selecting English is a legitimate
//     configuration. The country axis belongs elsewhere.
//   · The default locale (when a user has no explicit preference) is
//     `"id"` to match the pilot market. There must be ONE
//     authoritative fallback shared by client and server resolvers.

import { EN_PACK } from "./packs/en";
import { ID_PACK } from "./packs/id";
import type { I18nKey } from "./keys";

export interface SupportedLocale {
  code: string;
  label: string;
  pack: Record<I18nKey, string>;
}

/** The authoritative supported-locale set. Adding a new NEX language
 *  = append an entry here + ship `./packs/<code>.ts`. Mark `as const`
 *  so TypeScript derives the `Lang` union statically from the data. */
export const SUPPORTED_LOCALES = [
  { code: "id", label: "Bahasa Indonesia", pack: ID_PACK },
  { code: "en", label: "English",          pack: EN_PACK },
] as const satisfies readonly SupportedLocale[];

/** All codes supported today. Compile-time derived from the registry
 *  so a mismatch between the registry and the Lang union is
 *  impossible. */
export type Lang = (typeof SUPPORTED_LOCALES)[number]["code"];

/** Shorthand set used by resolvers for a cheap `.has()` check. */
export const SUPPORTED_LANG_CODES: ReadonlySet<string> = new Set(
  SUPPORTED_LOCALES.map((l) => l.code),
);

/** The single authoritative fallback used by BOTH the client resolver
 *  (`resolveClientLang`) and the server resolver (`resolveServerLocale`).
 *  Founder decision 2026-10-07 · pilot market default. */
export const DEFAULT_LANG: Lang = "id";

/** Map of locale code → translation pack. Resolvers index into this
 *  rather than importing per-pack modules so adding a locale touches
 *  only this file and the matching pack. */
export const PACKS: Record<Lang, Record<I18nKey, string>> = Object.fromEntries(
  SUPPORTED_LOCALES.map((l) => [l.code, l.pack]),
) as Record<Lang, Record<I18nKey, string>>;

/** Narrow an arbitrary string to a supported `Lang` · returns null if
 *  the input is not in the supported set. Pure · safe to call from
 *  anywhere. */
export function narrowToSupportedLang(input: string | null | undefined): Lang | null {
  if (!input) return null;
  const trimmed = input.toLowerCase().trim();
  if (SUPPORTED_LANG_CODES.has(trimmed)) return trimmed as Lang;
  return null;
}
