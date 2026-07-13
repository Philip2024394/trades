// YardDiyGuard — constitutional gate for /trade-off/yard/*.
//
// Yard is the trade-only social feed. DIY viewers must NEVER see it
// per feedback_trade_features_trade_only.md. Xrated Trades has its
// own auth model, but every account is created via the shared
// Supabase auth — so we can still probe /api/auth/trade/whoami to
// read the viewer_role from app_trade_profiles.
//
// If the caller is authed as DIY, redirect to /tc/trade-center with
// ?blocked= so the BlockedFeatureToast explains what happened. If not
// authed at all (Xrated's own guest state), we don't intervene — the
// Xrated auth flow handles that.

"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function YardDiyGuard() {
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/trade/whoami", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (cancelled || !json) return;
        if (json.authenticated && json.viewerRole === "diy") {
          router.replace(
            "/tc/trade-center?blocked=" + encodeURIComponent("/trade-off/yard")
          );
        }
      })
      .catch(() => null);
    return () => {
      cancelled = true;
    };
  }, [router]);

  return null;
}
