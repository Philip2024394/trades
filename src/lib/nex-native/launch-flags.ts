// src/lib/nex-native/launch-flags.ts
//
// Bridge 55 · Phase 1 launch mode gate · sealed 2026-09-29.
// --------------------------------------------------------
// Founder direction: launch NEX as a chat + themes product first
// (WhatsApp / iMessage killer with beautiful themes and Bisnis
// monetization). All commerce features stay in the codebase but
// are HIDDEN behind this flag so:
//   · we can flip it back on for admin/dev testing at any time
//   · Phase 2 launch is one flag change, not a re-implementation
//   · nothing built during Bridges 22-54 is thrown away
//
// Rule: EVERY commerce surface (cart icon, shop icon, cart page,
// shop landing, direct-price, share-to-earn, ladder, orders,
// manage/*, discovery) must gate on NEX_COMMERCE_ENABLED before
// rendering or after resolving a route. Chat, themes, settings,
// profile, friends, contacts, NEX1 support stay always-on.
//
// Toggling for a dev session: set the env var
//   NEX_COMMERCE_ENABLED=1
// in .env.local · a boolean-parsed truthy value flips this on.

/** True when commerce surfaces (shop slider, cart, orders, direct
 *  price, share-to-earn, ladder, /cart, /orders, /[businessSlug],
 *  /manage/*) should render for regular users. Defaults to FALSE
 *  for the Phase 1 chat-only launch. */
export const NEX_COMMERCE_ENABLED: boolean = (() => {
  const raw =
    typeof process !== "undefined" && process.env
      ? process.env.NEX_COMMERCE_ENABLED
      : undefined;
  if (raw === undefined || raw === null || raw === "") return false;
  const normalized = String(raw).trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes";
})();

/** Admin bypass · when a request carries ?commerce=1 in the query,
 *  commerce surfaces still render even if the flag is off. Lets
 *  admins keep testing the whole commerce loop while regular users
 *  see only chat + themes. Caller responsibility to check the
 *  search-params BEFORE gating. */
export function commerceEnabledForRequest(
  searchParams: URLSearchParams | Record<string, string | string[] | undefined> | null | undefined,
): boolean {
  if (NEX_COMMERCE_ENABLED) return true;
  if (!searchParams) return false;
  if (searchParams instanceof URLSearchParams) {
    const v = searchParams.get("commerce");
    return v === "1" || v === "true";
  }
  const v = searchParams.commerce;
  if (typeof v === "string") return v === "1" || v === "true";
  if (Array.isArray(v)) return v.some((x) => x === "1" || x === "true");
  return false;
}

// ─── NEX Search Phase 1 narrow launch gate · sealed 2026-10-04 ────
//
// Founder-sealed scope boundary: NEX Search gets its own launch flag
// INDEPENDENT of the commerce gate above. Flipping NEX_SEARCH_ENABLED
// un-gates ONLY the /nex-native/search surface · never shop pages,
// cart, orders, business chats, manage/*, onboarding, home nav tile
// swap or Capabilities Menu tiles. Those remain gated by the broader
// NEX_COMMERCE_ENABLED flag.
//
// This flag exists because NEX_COMMERCE_ENABLED is a wholesale
// commerce launch gate (gates 7+ surfaces simultaneously, see Bridge
// 55). Phase 1 of the Universal Search redesign needs a narrower
// release path · see MASTER BUILD PROMPT · NEX SEARCH + Phase 1
// acceptance evidence 2026-10-04.
//
// Toggling for a dev session: set the env var
//   NEX_SEARCH_ENABLED=1
// in .env.local. Query-param dev bypass is `?search=1` (NOT ?commerce=1
// · intentional separation so the bypasses can't accidentally conflate).

/** True when NEX Search surfaces should render for regular users.
 *  Defaults to FALSE until the Phase 1 universal-search landing +
 *  results redesign is reviewed and approved. */
export const NEX_SEARCH_ENABLED: boolean = (() => {
  const raw =
    typeof process !== "undefined" && process.env
      ? process.env.NEX_SEARCH_ENABLED
      : undefined;
  if (raw === undefined || raw === null || raw === "") return false;
  const normalized = String(raw).trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes";
})();

/** Admin bypass · when a request carries ?search=1 in the query,
 *  the NEX Search surface renders even if the flag is off. Separate
 *  from ?commerce=1 on purpose · they do not share state and must
 *  not accidentally un-gate each other. */
export function searchEnabledForRequest(
  searchParams: URLSearchParams | Record<string, string | string[] | undefined> | null | undefined,
): boolean {
  if (NEX_SEARCH_ENABLED) return true;
  if (!searchParams) return false;
  if (searchParams instanceof URLSearchParams) {
    const v = searchParams.get("search");
    return v === "1" || v === "true";
  }
  const v = searchParams.search;
  if (typeof v === "string") return v === "1" || v === "true";
  if (Array.isArray(v)) return v.some((x) => x === "1" || x === "true");
  return false;
}
