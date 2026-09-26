// src/lib/nex-native/nex-address.ts
//
// Wave 4 · NEX Address helpers · sealed 2026-09-25.
// -------------------------------------------------
// Founder-sealed doctrine (see doctrine_nex_chat_is_the_product / _presence_builder):
//   The public "NEX Address" (cakeshopjogja.nex · philip.nex) is the human-
//   readable doorway. The DISPLAY is future-proofed for real .nex-namespace
//   ambitions; the CURRENT URL routes through the existing in-app slug
//   handler at /nex-native/[businessSlug] (Slice 15a shipped).
//
// This module is a boundary: callers pass in a business (or an account)
// and get back a stable { stem, display, url } record. If NEX later ships
// real DNS/TLD support, only this file changes — everything upstream stays
// intact. That matches the Founder directive "design the architecture so
// the address itself isn't trapped inside the implementation."

/** A NEX Address triple · the same identity presented three ways. */
export interface NexAddress {
  /** The address stem · e.g. "cakeshopjogja" or "philip". Never has ".nex". */
  stem: string;
  /** Human-readable public form for sharing · e.g. "cakeshopjogja.nex".
   *  This is what the owner puts in their Instagram bio. */
  display: string;
  /** The current working URL that resolves the address · e.g.
   *  "/nex-native/cakeshopjogja". Full or path-relative depending on
   *  the caller. Never expose this to owners as their "share this" copy. */
  url: string;
  /** Whether we consider this address a "beautiful" address (a real slug
   *  suitable for public sharing) vs a fallback (nex-XXXXX handle). */
  is_polished: boolean;
}

interface BusinessLike {
  slug: string | null | undefined;
}

interface AccountLike {
  nex_handle: string | null | undefined;
  /** Optional future column · Wave 4K roadmap. */
  public_handle?: string | null | undefined;
}

/** Compute the NEX Address for a business. Always polished if slug present. */
export function nexAddressForBusiness(business: BusinessLike): NexAddress | null {
  const stem = (business.slug ?? "").trim().toLowerCase();
  if (!stem) return null;
  return {
    stem,
    display: `${stem}.nex`,
    url: `/nex-native/${stem}`,
    is_polished: true,
  };
}

/** Compute the NEX Address for a person account.
 *  Prefers public_handle · falls back to nex_handle · nex-XXXXX is
 *  considered unpolished (still works, but owner should upgrade to a
 *  human-readable handle for real sharing). */
export function nexAddressForAccount(account: AccountLike): NexAddress | null {
  const pub = (account.public_handle ?? "").trim().toLowerCase();
  if (pub) {
    return { stem: pub, display: `${pub}.nex`, url: `/nex-native/u/${pub}`, is_polished: true };
  }
  const raw = (account.nex_handle ?? "").trim().toLowerCase();
  if (!raw) return null;
  // nex-XXXXX handles work as an address but aren't a real "share this in
  // your bio" address · flagged unpolished so the UI can nudge upgrade.
  return {
    stem: raw,
    display: `${raw}.nex`,
    url: `/nex-native/u/${raw}`,
    is_polished: false,
  };
}

/** Turn a NexAddress into the full sharing URL a visitor can paste into a
 *  browser today. Uses NEX_PUBLIC_BASE_URL if provided (production origin)
 *  or falls back to a bare path (relative for dev). */
export function shareableUrl(address: NexAddress, opts?: { baseUrl?: string }): string {
  const base = (opts?.baseUrl ?? process.env.NEXT_PUBLIC_NEX_BASE_URL ?? "").replace(/\/$/, "");
  return base ? `${base}${address.url}` : address.url;
}
