"use client";

// UserMenuDropdownClient — client-side fetcher for the dropdown.
// Renders nothing until context loads (avoids "Sign in" flash on
// slow networks for actually-signed-in visitors, matching the
// XratedHeader session-load pattern).
//
// Use this in client components (XratedHeader). Server components
// should use UserMenuDropdownMount for a flash-free first paint.

import { useEffect, useState } from "react";
import { UserMenuDropdown } from "./UserMenuDropdown";
import type { UserMenuContext } from "@/lib/userMenuContext";

export function UserMenuDropdownClient() {
  const [ctx, setCtx] = useState<UserMenuContext | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/user-menu-context", { credentials: "include", cache: "no-store" })
      .then((res) => res.ok ? res.json() : { ok: false })
      .then((body: { ok?: boolean; ctx?: UserMenuContext }) => {
        if (!cancelled && body.ok && body.ctx) setCtx(body.ctx);
      })
      .catch(() => { /* silent */ });
    return () => { cancelled = true; };
  }, []);

  if (!ctx) return null;
  return <UserMenuDropdown ctx={ctx}/>;
}
