// src/lib/nex/i18n/lang.ts
//
// Stage 3.33 · Phase 26 · Lightweight app-wide i18n (Philip 2026-08-31).
//
// Doctrine: no external i18n library (react-intl / next-intl / i18next
// are overkill for two languages + a few hundred keys). Custom React
// Context + typed key registry keeps the surface area small, the
// runtime cost zero, and the type safety at compile time.
//
// Storage model:
//   · Prefix picker on nex-sign-on writes `localStorage.nex_user_lang`
//     ("id" | "en") when the user selects a country prefix (Stage 3.31.a).
//   · When the auth backend lands, the user profile's `preferred_lang`
//     column (Stage 3.33 migration) becomes the durable source of truth.
//   · Order of precedence: URL query `?lang=` → localStorage → 'en' default.
//     'en' default because it's the least-surprising fallback for a user
//     without an explicit preference (matches Stage 3.31 accommodation
//     composer's "reply follows message" default).
//
// This is scoped to CLIENT-SIDE app chrome (button labels, nav, static
// microcopy). NOT for AI-generated content (that's handled per-vertical
// by the Brain composers — accommodation, commerce, etc.) NOT for
// user-to-user chat (that's ChatBubbleTranslated).

export type Lang = "en" | "id";

export const SUPPORTED_LANGS: readonly Lang[] = ["en", "id"] as const;

export const DEFAULT_LANG: Lang = "en";

/**
 * Read the user's preferred language on the client. Safe to call during
 * SSR — returns DEFAULT_LANG when window is undefined.
 *
 * Precedence:
 *   1. URL query `?lang=` (only when it's a supported code)
 *   2. localStorage `nex_user_lang`
 *   3. DEFAULT_LANG
 */
export function resolveClientLang(): Lang {
  if (typeof window === "undefined") return DEFAULT_LANG;
  try {
    const url = new URL(window.location.href);
    const q = url.searchParams.get("lang");
    if (q && (SUPPORTED_LANGS as readonly string[]).includes(q)) return q as Lang;
    const stored = window.localStorage.getItem("nex_user_lang");
    if (stored && (SUPPORTED_LANGS as readonly string[]).includes(stored)) return stored as Lang;
  } catch {
    // Private-mode / cross-origin frame — fall through.
  }
  return DEFAULT_LANG;
}

/**
 * Persist the user's language choice. Called by the sign-on prefix
 * picker and any future language-toggle UI. Silent on failure.
 */
export function writeClientLang(lang: Lang): void {
  if (typeof window === "undefined") return;
  try { window.localStorage.setItem("nex_user_lang", lang); } catch { /* noop */ }
}
