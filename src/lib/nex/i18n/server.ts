// src/lib/nex/i18n/server.ts
//
// Phase B.7 · NEX Universal Language Foundation · server-side resolver.
// --------------------------------------------------------------------
// Founder-sealed 2026-10-07 · the authoritative server-side helper
// that lets Server Components, Route Handlers, and Server Actions
// resolve a NEX locale and translate keys through the SAME registry +
// SAME translation packs the client-side `useT` hook uses.
//
// Why this module exists
// ----------------------
// `useT` is `"use client"`. A server component cannot call a hook.
// Previously, server-rendered copy was localised via an unrelated
// map at `src/lib/nex-native/i18n/safe-trade-strings.ts` which does
// not use the typed key registry. That created a two-system drift
// risk. This module closes the gap:
//
//     client  useT(key)   → PACKS[lang][key]
//     server  t(key, lang) → PACKS[lang][key]
//
// Same keys, same packs, same fallback. Call-sites of
// `safe-trade-strings` are NOT touched in this phase · the legal
// wording there is sealed and migrates in a later phase.
//
// Locale resolution precedence
// ----------------------------
//   1. URL query `?lang=<code>` (when the code is in the registry)
//   2. `nex_account.locale`     (durable account preference)
//   3. `Accept-Language` header (browser hint · DETECTION ONLY ·
//                                never silently overrides an explicit
//                                account preference)
//   4. DEFAULT_LANG             (`"id"` · pilot-market default ·
//                                shared with client resolver)
//
// Note: unlike the sealed `resolveLocale` at
// `src/lib/nex-native/i18n/safe-trade-strings.ts`, this resolver
// uses the shared `DEFAULT_LANG` constant from
// `./supported-locales` so client and server resolve the SAME
// language. The historical server resolver kept its own default of
// `"id"` and the historical client resolver defaulted to `"en"` ·
// that split is now closed.

import type { I18nKey } from "./keys";
import { PACKS, DEFAULT_LANG, narrowToSupportedLang, type Lang } from "./supported-locales";
import { EN_PACK } from "./packs/en";

export interface ServerLocaleInput {
  /** Request-time override · typically from `url.searchParams.get("lang")`. */
  urlParam?: string | null;
  /** Durable preference from `nex_account.locale` · migration 071. */
  accountLocale?: string | null;
  /** `Accept-Language` header from the incoming request. Detection
   *  only · never silently overrides an explicit `accountLocale`.
   *  Any value here is parsed to a short code (`en-US` → `en`) and
   *  narrowed to the supported-locale set before use. */
  acceptLanguage?: string | null;
}

/** Resolve a server-side locale with precedence: URL → account →
 *  Accept-Language → DEFAULT_LANG. Pure function · safe to call
 *  from any server context. */
export function resolveServerLocale(input: ServerLocaleInput): Lang {
  const urlNarrowed = narrowToSupportedLang(input.urlParam);
  if (urlNarrowed) return urlNarrowed;

  const accountNarrowed = narrowToSupportedLang(input.accountLocale);
  if (accountNarrowed) return accountNarrowed;

  const headerLang = parseAcceptLanguagePrimary(input.acceptLanguage);
  const headerNarrowed = narrowToSupportedLang(headerLang);
  if (headerNarrowed) return headerNarrowed;

  return DEFAULT_LANG;
}

/** Server-side translate · the counterpart to the client `useT`
 *  hook. Same key registry, same packs, same fallback behaviour:
 *  the resolved locale pack is tried first, then the `EN_PACK` as a
 *  safety net, then the key itself as the last-ditch render-safe
 *  value. Pure · safe to call from any server context. */
export function t(key: I18nKey, locale: Lang): string {
  const pack = PACKS[locale] ?? PACKS[DEFAULT_LANG] ?? EN_PACK;
  return pack[key] ?? EN_PACK[key] ?? key;
}

/** Build a `(key) => string` closure bound to a resolved locale.
 *  Convenient inside a single render pass where the locale has
 *  already been resolved up front. */
export function tFor(locale: Lang): (key: I18nKey) => string {
  return (key) => t(key, locale);
}

// ─── internal helpers ────────────────────────────────────────────

/** Extract the primary language tag from an `Accept-Language`
 *  header value (e.g. `"en-US,en;q=0.9,id;q=0.8"` → `"en"`). Returns
 *  null for an empty or malformed header · the caller still runs
 *  the narrower against the supported-locale registry. */
function parseAcceptLanguagePrimary(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const first = raw.split(",")[0]?.split(";")[0]?.trim();
  if (!first) return null;
  // Keep only the primary subtag · "en-US" → "en" · "zh-Hans-CN" → "zh"
  const primary = first.split("-")[0]?.toLowerCase();
  return primary ?? null;
}
