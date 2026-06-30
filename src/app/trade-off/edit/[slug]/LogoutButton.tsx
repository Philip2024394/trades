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
      className="inline-flex h-9 items-center rounded-lg px-3 text-[13px] font-bold text-white transition hover:opacity-90 disabled:opacity-60"
      style={{ background: "#991B1B" }}
    >
      {busy ? "Logging out…" : "Log out"}
    </button>
  );
}
