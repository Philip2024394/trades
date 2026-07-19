"use client";

// Client — shows "Member · Manage" pill when the visitor has an
// active si-member cookie. Fetches membership state on mount so we
// don't need to server-render this into the layout. Clicking
// "Manage" opens the Stripe Customer Portal.

import { useEffect, useState } from "react";

export function MemberBadge() {
  const [state, setState] = useState<"idle" | "checking" | "active" | "none">("checking");
  const [busy, setBusy]   = useState(false);

  useEffect(() => {
    fetch("/api/store/me", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setState(d?.active ? "active" : "none"))
      .catch(() => setState("none"));
  }, []);

  if (state !== "active") return null;

  async function openPortal() {
    setBusy(true);
    try {
      const r = await fetch("/api/store/portal", { method: "POST" });
      const d = await r.json();
      if (d?.ok && d.redirect) window.location.href = d.redirect;
      else alert(`Couldn't open the customer portal: ${d?.error ?? "unknown"}`);
    } finally { setBusy(false); }
  }

  return (
    <button
      type="button"
      onClick={openPortal}
      disabled={busy}
      className="inline-flex h-8 items-center gap-1 rounded-md border px-3 text-[10px] font-black uppercase tracking-wider text-green-700 transition hover:bg-green-50 disabled:opacity-50"
      style={{ borderColor: "rgba(22,101,52,0.30)", backgroundColor: "#F0FDF4" }}
      title="Manage your unlimited membership"
    >
      <span aria-hidden>✓</span> Member · {busy ? "Opening…" : "Manage"}
    </button>
  );
}
