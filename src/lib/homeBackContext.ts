// homeBackContext — server-side resolver for the HomeBackPill.
//
// HOMEOWNERS ONLY (Philip 2026-07-19). Trades / merchants use the
// UserMenuDropdown in the header to get back to their canteen — no
// need for a floating pill on their surfaces. The pill exists purely
// for the homeowner invite loop (SiteBook → directory → canteen →
// back to SiteBook) where the round-trip is unfamiliar UX.
//
// Returns null when: anonymous, merchant-only session, OR homeowner
// already on any /sitebook route.

import { getHomeownerFromCookie } from "@/lib/homeowners/auth";

export type HomeBackContext = {
  label: string;
  href:  string;
  kind:  "homeowner";
};

export async function resolveHomeBackContext(currentPath: string): Promise<HomeBackContext | null> {
  const homeowner = await getHomeownerFromCookie();
  if (!homeowner) return null;
  if (currentPath === "/sitebook" || currentPath.startsWith("/sitebook/")) return null;
  return {
    label: "Back to my SiteBook",
    href:  "/sitebook",
    kind:  "homeowner"
  };
}
