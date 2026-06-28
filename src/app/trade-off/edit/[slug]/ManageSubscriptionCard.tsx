"use client";

// Manage Subscription card — renders on the listing's edit page when
// the row has a `stripe_customer_id` (i.e. the tradesperson has
// already paid through Stripe at least once). Clicking the button
// POSTs to /api/stripe/portal which mints a Billing Portal session
// and returns the URL we redirect to.
//
// Only renders when the parent decides a customer ID is on file —
// keeping the conditional in the server component (page.tsx) means
// this island doesn't ship to free-tier listings at all.

import { useState } from "react";

export function ManageSubscriptionCard({
  slug,
  token
}: {
  slug: string;
  token: string;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function openPortal() {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/stripe/portal", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ listing_slug: slug, edit_token: token })
      });
      const json: { url?: string; error?: string } = await res.json();
      if (!res.ok || !json.url) {
        setErr(json.error ?? "Could not open the billing portal — try again.");
        return;
      }
      window.location.href = json.url;
    } catch {
      setErr("Network error — try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-brand-accent/40 bg-brand-accent/5 p-4">
      <p className="text-[11px] font-bold uppercase tracking-widest text-brand-accent">
        Subscription
      </p>
      <p className="mt-1 text-sm font-semibold text-brand-text">
        Manage your Xrated App subscription
      </p>
      <p className="mt-1 text-[12px] text-brand-muted">
        Update your card, swap plan, download invoices or cancel — handled
        directly by Stripe's secure customer portal.
      </p>
      <button
        type="button"
        onClick={openPortal}
        disabled={busy}
        className="mt-3 inline-flex h-10 items-center rounded-lg bg-brand-accent px-4 text-xs font-bold text-black transition hover:opacity-90 disabled:opacity-50"
      >
        {busy ? "Opening portal…" : "Manage subscription →"}
      </button>
      {err && (
        <p className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-700">
          {err}
        </p>
      )}
    </div>
  );
}
