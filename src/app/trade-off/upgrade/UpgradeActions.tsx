"use client";

// Client island for the upgrade page — drives the real Stripe Checkout
// flow (POST /api/stripe/checkout → window.location to the returned URL)
// for monthly + annual plans. WhatsApp deep-link is kept as a secondary
// fallback in case Stripe is misconfigured / down.
//
// Also wires the optional "Start free trial" button for standard/expired
// listings (unchanged from the previous WhatsApp-only era — trial doesn't
// involve money).

import { useState } from "react";
import { XRATED_PRICING } from "@/lib/xratedTrades";

type Plan = "monthly" | "annual";

export function UpgradeActions({
  slug,
  token,
  canStartTrial
}: {
  slug: string;
  token: string;
  canStartTrial: boolean;
}) {
  const [busy, setBusy] = useState<null | Plan | "trial" | "wa">(null);
  const [err, setErr] = useState<string | null>(null);
  const [trialOk, setTrialOk] = useState<string | null>(null);

  async function payWithStripe(plan: Plan) {
    setBusy(plan);
    setErr(null);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          tier: "paid",
          billing: plan,
          listing_slug: slug,
          addon_slugs: []
        })
      });
      const json: { url?: string; error?: string } = await res.json();
      if (!res.ok || !json.url) {
        setErr(json.error ?? "Checkout failed — try the WhatsApp fallback below.");
        return;
      }
      window.location.href = json.url;
    } catch {
      setErr("Network error — try again or use the WhatsApp fallback.");
    } finally {
      // Note: if the redirect fires above we leave the page before this
      // hits — only matters when the request errors.
      setBusy(null);
    }
  }

  async function whatsappFallback(plan: Plan) {
    setBusy("wa");
    setErr(null);
    try {
      const res = await fetch("/api/trade-off/request-upgrade", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ slug, edit_token: token, plan })
      });
      const json = await res.json();
      if (!json.ok) {
        setErr(json.error ?? "Upgrade request failed.");
        return;
      }
      window.open(json.whatsapp_url, "_blank", "noopener");
    } catch {
      setErr("Network error — try again.");
    } finally {
      setBusy(null);
    }
  }

  async function startTrial() {
    setBusy("trial");
    setErr(null);
    try {
      const res = await fetch("/api/trade-off/start-trial", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ slug, edit_token: token })
      });
      const json = await res.json();
      if (!json.ok) {
        setErr(json.error ?? "Could not start trial.");
        return;
      }
      setTrialOk(json.trial_expires_at);
      // Reload so the tier card reflects the new state.
      setTimeout(() => window.location.reload(), 600);
    } catch {
      setErr("Network error — try again.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mt-6 grid gap-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => payWithStripe("monthly")}
          disabled={busy !== null}
          className="inline-flex h-12 items-center justify-center rounded-lg border border-brand-line bg-brand-surface px-5 text-sm font-bold text-brand-text transition hover:border-brand-accent hover:text-brand-accent disabled:opacity-50"
        >
          {busy === "monthly"
            ? "Processing…"
            : `Pay Monthly — £${XRATED_PRICING.monthlyGbp}/mo`}
        </button>
        <button
          type="button"
          onClick={() => payWithStripe("annual")}
          disabled={busy !== null}
          className="inline-flex h-12 items-center justify-center rounded-lg bg-brand-accent px-5 text-sm font-bold text-black transition hover:opacity-90 disabled:opacity-50"
        >
          {busy === "annual"
            ? "Processing…"
            : `Pay Annual — £${XRATED_PRICING.annualGbp}/yr`}
        </button>
      </div>

      {/* WhatsApp fallback — kept as a secondary path so a tradesperson
          can still upgrade if Stripe is misconfigured or the customer
          prefers to settle by bank transfer. Lower visual weight than
          the primary Pay buttons above. */}
      <div className="grid gap-2 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => whatsappFallback("monthly")}
          disabled={busy !== null}
          className="inline-flex h-10 items-center justify-center rounded-md border border-brand-line bg-transparent px-4 text-[12px] font-semibold text-brand-muted transition hover:border-brand-accent hover:text-brand-accent disabled:opacity-50"
        >
          {busy === "wa" ? "Opening WhatsApp…" : "Or request monthly via WhatsApp"}
        </button>
        <button
          type="button"
          onClick={() => whatsappFallback("annual")}
          disabled={busy !== null}
          className="inline-flex h-10 items-center justify-center rounded-md border border-brand-line bg-transparent px-4 text-[12px] font-semibold text-brand-muted transition hover:border-brand-accent hover:text-brand-accent disabled:opacity-50"
        >
          {busy === "wa" ? "Opening WhatsApp…" : "Or request annual via WhatsApp"}
        </button>
      </div>

      {canStartTrial && (
        <button
          type="button"
          onClick={startTrial}
          disabled={busy !== null}
          className="inline-flex h-11 items-center justify-center rounded-lg border border-brand-accent bg-transparent px-5 text-xs font-bold text-brand-accent transition hover:bg-brand-accent hover:text-black disabled:opacity-50"
        >
          {busy === "trial"
            ? "Starting…"
            : `Start your ${XRATED_PRICING.trialDays}-day free trial`}
        </button>
      )}

      {err && (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {err}
        </p>
      )}
      {trialOk && (
        <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
          Trial started — expires {new Date(trialOk).toLocaleDateString()}. Reloading…
        </p>
      )}
    </div>
  );
}
