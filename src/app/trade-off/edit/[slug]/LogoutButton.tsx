"use client";

// Dashboard "Log out" button. POSTs to /api/trade-off/logout to clear
// the session cookie, then hard-navigates to '/' so the next request
// reflects the cleared state.

import { useState } from "react";

export function LogoutButton() {
  const [busy, setBusy] = useState(false);

  async function onClick() {
    setBusy(true);
    try {
      await fetch("/api/trade-off/logout", { method: "POST" });
    } catch {
      // Ignore — we hard-navigate either way so the user sees a logged
      // -out page on the next request.
    } finally {
      window.location.href = "/";
    }
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className="inline-flex h-9 items-center rounded-lg border border-brand-line bg-brand-surface px-3 text-[13px] font-bold text-brand-text transition hover:border-brand-accent hover:text-brand-accent disabled:opacity-60"
    >
      {busy ? "Logging out…" : "Log out"}
    </button>
  );
}
