"use client";

import { useState } from "react";

export function PayNowButton({ bookingReference }: { bookingReference: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const go = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await fetch("/api/plant-hire/create-payment-intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          booking_reference: bookingReference,
          origin: typeof window !== "undefined" ? window.location.origin : undefined
        })
      });
      const j = (await r.json()) as { ok?: boolean; url?: string; error?: string; message?: string };
      if (!r.ok || !j.url) throw new Error(j.message ?? j.error ?? "checkout error");
      window.location.href = j.url;
    } catch (e) {
      setError(e instanceof Error ? e.message : "checkout error");
      setBusy(false);
    }
  };

  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={go}
        disabled={busy}
        className={`inline-flex h-12 items-center rounded-xl px-5 text-[12px] font-extrabold uppercase tracking-widest transition ${
          busy
            ? "cursor-not-allowed bg-neutral-200 text-neutral-500"
            : "bg-neutral-900 text-white hover:bg-black"
        }`}
      >
        {busy ? "Opening Stripe…" : "Pay deposit by card →"}
      </button>
      {error && <p className="mt-2 text-[11px] font-bold text-red-600">{error}</p>}
    </div>
  );
}
