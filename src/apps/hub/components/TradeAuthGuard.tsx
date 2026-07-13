// TradeAuthGuard — client-side gate for /tc/* routes.
//
// On mount, probes /api/auth/trade/whoami. If the caller is not
// signed in AND the current route requires auth, redirects to
// /tc/sign-in with `?next=<current>` so they land back where they were.
// If signed in but `identity_complete === false`, pushes to
// /tc/complete-identity.
//
// Public /tc/* routes (sign-in, complete-identity, hub landing,
// merchant profile previews) skip the redirect but still hydrate the
// session for downstream consumers.

"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ensurePushSubscription } from "@/lib/notifications/registerPush";

const PUBLIC_PATH_PREFIXES = [
  "/tc/sign-in",
  "/tc/complete-identity",
  "/tc/hub",
  "/tc/trade-center",   // browse without auth
  "/tc/trade",         // public merchant profiles
  "/tc/trades",
  "/tc/deals",
  "/tc/identity",      // trade-identity verification landing
  "/tc/apply",
  "/tc/confidence"
];

// Constitutional gate: DIY viewers MUST never see these surfaces.
// See feedback_trade_features_trade_only.md. When a DIY-role account
// hits one of these paths we redirect to /tc/trade-center — the
// neutral browse landing they can safely use.
const TRADE_ONLY_PATH_PREFIXES = [
  "/tc/hub",              // trade dashboard (Universal Composer + social feed)
  "/tc/identity",         // Verified Trade Identity
  "/tc/apply",            // VTI application
  "/tc/confidence",       // VTI adjacent
  "/tc/deals",            // trade prices surface
  "/tc/trade-counter",    // peer classifieds — trade sanctum
  "/tc/merchant-admin",   // Studio + merchant tooling
  "/tc/job-board",        // trade jobs
  "/tc/jobs",             // trade jobs
  "/tc/post-job",         // trade posts jobs
  "/tc/rates",            // trade rates
  "/tc/routes"            // trade routes
];

function isPublic(pathname: string): boolean {
  return PUBLIC_PATH_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

function isTradeOnly(pathname: string): boolean {
  return TRADE_ONLY_PATH_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

export function TradeAuthGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "/";
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    async function check() {
      try {
        const res = await fetch("/api/auth/trade/whoami", { cache: "no-store" });
        if (!res.ok) return;
        const json = await res.json();
        if (cancelled) return;
        if (!json.authenticated) {
          if (!isPublic(pathname)) {
            router.replace(`/tc/sign-in?next=${encodeURIComponent(pathname)}`);
          }
          return;
        }
        // Signed in but identity incomplete → nudge to complete-identity
        if (!json.identityComplete && !pathname.startsWith("/tc/complete-identity")) {
          router.replace(`/tc/complete-identity?next=${encodeURIComponent(pathname)}`);
          return;
        }
        // Constitutional gate: DIY viewers redirected off trade-only
        // routes to the neutral browse landing. `blocked=` param lets
        // the destination render a friendly "that feature is trade-only"
        // toast if we add one later.
        const viewerRole = json.viewerRole === "diy" ? "diy" : "trade";
        if (viewerRole === "diy" && isTradeOnly(pathname)) {
          router.replace(`/tc/trade-center?blocked=${encodeURIComponent(pathname)}`);
          return;
        }
        // Fire-and-forget push subscription. Silently no-ops when the
        // user denies permission or the browser doesn't support it.
        ensurePushSubscription().catch(() => null);
      } catch {
        // silent — if the API is down, don't lock the user out.
      }
    }
    check();
    return () => {
      cancelled = true;
    };
  }, [pathname, router]);

  return <>{children}</>;
}
