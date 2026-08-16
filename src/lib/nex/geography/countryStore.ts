// NEX geography · country selection store.
//
// SSR-safe read/write for the customer's selected market. localStorage is
// the source of truth on the client; a cookie mirror is written so future
// SSR reads can pre-render the correct market. Not yet consumed server-side.
//
// Priority chain (documented; consumers assemble it themselves):
//   1. URL ?country=<code>   (marketing deep-link · does not persist)
//   2. localStorage          (previous user choice)
//   3. IP default            (resolved once, persisted to localStorage)
//   4. "all"                 (final fallback)
//
// This module deliberately does NOT resolve the IP default. IP resolution
// belongs to whichever surface first mounts the picker; it fires once, then
// writes the result via `setSelectedCountry` so this file remains the single
// read path.

import type { CountryCode } from "./countries";
import { findCountryByCode } from "./countries";

export type SelectedCountry = CountryCode | "all";

const STORAGE_KEY = "nex_selected_country";
const COOKIE_MAX_AGE_DAYS = 365;

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof document !== "undefined";
}

function readCookie(name: string): string | null {
  if (!isBrowser()) return null;
  const match = document.cookie.match(new RegExp("(?:^|; )" + name + "=([^;]*)"));
  return match ? decodeURIComponent(match[1]) : null;
}

function writeCookie(name: string, value: string, days: number): void {
  if (!isBrowser()) return;
  const maxAge = days * 24 * 60 * 60;
  document.cookie = `${name}=${encodeURIComponent(value)}; Max-Age=${maxAge}; Path=/; SameSite=Lax`;
}

function normalise(raw: string | null | undefined): SelectedCountry | null {
  if (!raw) return null;
  if (raw === "all") return "all";
  return findCountryByCode(raw)?.code ?? null;
}

export function getSelectedCountry(): SelectedCountry | null {
  if (!isBrowser()) return null;
  try {
    const ls = window.localStorage.getItem(STORAGE_KEY);
    const fromLs = normalise(ls);
    if (fromLs) return fromLs;
    return normalise(readCookie(STORAGE_KEY));
  } catch {
    return null;
  }
}

export function setSelectedCountry(value: SelectedCountry): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, value);
  } catch {
    /* private mode · fall through to cookie */
  }
  writeCookie(STORAGE_KEY, value, COOKIE_MAX_AGE_DAYS);
}

export function clearSelectedCountry(): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
  writeCookie(STORAGE_KEY, "", 0);
}
