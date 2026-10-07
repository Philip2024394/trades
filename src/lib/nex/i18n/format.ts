// src/lib/nex/i18n/format.ts
//
// Phase B.7 · NEX Universal Locale-Aware Formatter Foundation.
// -----------------------------------------------------------
// Founder-sealed 2026-10-07 · establishes the architecture · does
// NOT rewrite every existing timestamp or number in NEX.
//
// Scope · what this file is
// -------------------------
// The small, deterministic layer on top of the browser's `Intl` APIs
// that every NEX surface should consume for:
//
//   · date
//   · time
//   · date + time
//   · number
//   · relative time
//
// It takes a resolved NEX `Lang` and returns a localised string.
// There is no viewer-currency formatting here on purpose · currency
// stays a per-seller / per-product property per the sealed
// commercial doctrine. A later Bisnis-side phase can add a currency
// formatter if founder opens that axis.
//
// Scope · what this file is NOT
// -----------------------------
//   · Not a replacement for `safe-trade-strings.ts` or any legal
//     wording · the formatter emits machine-generated locale-aware
//     strings · translation packs still handle human-written copy.
//   · Not a whole-application timestamp rewrite · existing hard-
//     coded `toLocaleDateString("en-GB", ...)` call-sites remain
//     untouched by this commit. They migrate in a later phase once
//     the pipe is proven live.
//   · Not currency-aware · see above.
//
// Why Intl (and not a dedicated date library)
// -------------------------------------------
// `Intl.DateTimeFormat`, `Intl.NumberFormat`, and
// `Intl.RelativeTimeFormat` ship in every evergreen browser and
// every Node runtime we target · zero bundle cost, zero dependency,
// and locale coverage already matches the supported-locale registry
// without any extra data loaded. If the registry grows beyond the
// Intl common set we add a thin extension here, not another lib.
//
// Deterministic / server-safe
// ---------------------------
// Every function is a pure call on `Intl.*` with an explicit input
// locale · no `navigator.language` fallback, no timezone sniff
// (callers may pass `{ timeZone }` through the options object).
// This keeps SSR and CSR paths producing identical strings for the
// same input, so hydration never flashes.

import { DEFAULT_LANG, narrowToSupportedLang, type Lang } from "./supported-locales";

/** The Intl locale tag used for a given NEX `Lang`. Right now the
 *  NEX codes match the BCP-47 primary subtags 1:1 (`"id"` → `"id"`,
 *  `"en"` → `"en"`). If a future NEX code diverges (e.g. a `"zh-Hans"`
 *  variant) this is the single place that maps it. */
function intlLocaleFor(lang: Lang): string {
  // Narrow defensively so a caller passing an unknown value falls
  // back to the pilot-market default rather than to the host locale.
  return narrowToSupportedLang(lang) ?? DEFAULT_LANG;
}

/** Options shared by every formatter. Keep this small on purpose ·
 *  callers that need deep customisation can drop down to Intl
 *  directly. */
export interface FormatOptions {
  /** Optional IANA timezone override (e.g. `"Asia/Jakarta"`). When
   *  omitted the browser / Node default applies. */
  timeZone?: string;
}

// ─── date / time / dateTime ──────────────────────────────────────

/** Format a `Date` or ISO string as a locale-aware date (no time). */
export function formatDate(
  value: Date | string | number,
  lang: Lang,
  options: FormatOptions & Intl.DateTimeFormatOptions = {},
): string {
  const d = coerceDate(value);
  if (!d) return "";
  const fmt = new Intl.DateTimeFormat(intlLocaleFor(lang), {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: options.timeZone,
    ...stripBase(options),
  });
  return fmt.format(d);
}

/** Format a `Date` or ISO string as a locale-aware time (no date). */
export function formatTime(
  value: Date | string | number,
  lang: Lang,
  options: FormatOptions & Intl.DateTimeFormatOptions = {},
): string {
  const d = coerceDate(value);
  if (!d) return "";
  const fmt = new Intl.DateTimeFormat(intlLocaleFor(lang), {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: options.timeZone,
    ...stripBase(options),
  });
  return fmt.format(d);
}

/** Format a `Date` or ISO string as a locale-aware date + time. */
export function formatDateTime(
  value: Date | string | number,
  lang: Lang,
  options: FormatOptions & Intl.DateTimeFormatOptions = {},
): string {
  const d = coerceDate(value);
  if (!d) return "";
  const fmt = new Intl.DateTimeFormat(intlLocaleFor(lang), {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: options.timeZone,
    ...stripBase(options),
  });
  return fmt.format(d);
}

// ─── number ──────────────────────────────────────────────────────

/** Format a number using the resolved locale's grouping / decimal
 *  separators. Deliberately NOT currency-aware · currency formatting
 *  is a separate concern (sealed per-product commercial model). */
export function formatNumber(
  value: number,
  lang: Lang,
  options: Intl.NumberFormatOptions = {},
): string {
  if (!Number.isFinite(value)) return "";
  return new Intl.NumberFormat(intlLocaleFor(lang), options).format(value);
}

// ─── relative time ───────────────────────────────────────────────

/** The granularity options Intl.RelativeTimeFormat accepts. */
export type RelativeTimeUnit = Intl.RelativeTimeFormatUnit;

/** Format a signed integer offset in a given unit as a locale-aware
 *  relative-time phrase. `formatRelativeTime(-5, "minute", "en")`
 *  → `"5 minutes ago"`. */
export function formatRelativeTime(
  value: number,
  unit: RelativeTimeUnit,
  lang: Lang,
  options: Intl.RelativeTimeFormatOptions = {},
): string {
  if (!Number.isFinite(value)) return "";
  return new Intl.RelativeTimeFormat(intlLocaleFor(lang), {
    numeric: "auto",
    ...options,
  }).format(Math.trunc(value), unit);
}

/** Convenience: given a `Date` or ISO value and a `now` reference
 *  (defaulting to the current moment), choose a sensible unit and
 *  return a locale-aware relative-time phrase. Picks the largest
 *  granularity that keeps the magnitude under 90 (so "yesterday"
 *  instead of "24 hours ago" where possible). */
export function formatRelativeFrom(
  value: Date | string | number,
  lang: Lang,
  now: Date = new Date(),
): string {
  const d = coerceDate(value);
  if (!d) return "";
  const diffMs = d.getTime() - now.getTime();
  const sign = Math.sign(diffMs);
  const abs = Math.abs(diffMs);
  const SECOND = 1000;
  const MINUTE = 60 * SECOND;
  const HOUR = 60 * MINUTE;
  const DAY = 24 * HOUR;
  const WEEK = 7 * DAY;
  const MONTH = 30 * DAY; // calendar-approx · acceptable at this
  const YEAR = 365 * DAY; // granularity for relative phrasing.

  let value_: number;
  let unit: RelativeTimeUnit;
  if (abs < MINUTE) { value_ = sign * Math.round(abs / SECOND); unit = "second"; }
  else if (abs < HOUR) { value_ = sign * Math.round(abs / MINUTE); unit = "minute"; }
  else if (abs < DAY)  { value_ = sign * Math.round(abs / HOUR);   unit = "hour"; }
  else if (abs < WEEK) { value_ = sign * Math.round(abs / DAY);    unit = "day"; }
  else if (abs < MONTH){ value_ = sign * Math.round(abs / WEEK);   unit = "week"; }
  else if (abs < YEAR) { value_ = sign * Math.round(abs / MONTH);  unit = "month"; }
  else                 { value_ = sign * Math.round(abs / YEAR);   unit = "year"; }

  return formatRelativeTime(value_, unit, lang);
}

// ─── helpers ─────────────────────────────────────────────────────

function coerceDate(value: Date | string | number): Date | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Strip the FormatOptions-only keys so they don't leak into the
 *  Intl options object (Intl silently ignores unknown keys but we
 *  prefer to be explicit). */
function stripBase<T extends FormatOptions>(opts: T): Omit<T, "timeZone"> {
  // `timeZone` IS a valid Intl.DateTimeFormatOptions key · we keep
  // it when the formatter accepts it (date / time / dateTime). For
  // number / relativeTime it would be ignored anyway. We leave the
  // key in the merged object so callers can share one options bag
  // across formatters without surprises.
  return opts;
}
