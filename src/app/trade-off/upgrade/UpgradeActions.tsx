"use client";

// Client island for the upgrade page — handles the POST to
// /api/trade-off/request-upgrade for monthly/annual plans and opens the
// returned wa.me URL in a new tab. Also wires the optional "Start free
// trial" button for standard/expired listings.

import { useState } from "react";

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
  const [busy, setBusy] = useState<null | Plan | "trial">(null);
  const [err, setErr] = useState<string | null>(null);
  const [trialOk, setTrialOk] = useState<string | null>(null);

  async function requestUpgrade(plan: Plan) {
    setBusy(plan);
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
          onClick={() => requestUpgrade("monthly")}
          disabled={busy !== null}
          className="inline-flex h-12 items-center justify-center rounded-lg border border-brand-line bg-brand-surface px-5 text-sm font-bold text-brand-text transition hover:border-brand-accent hover:text-brand-accent disabled:opacity-50"
        >
          {busy === "monthly" ? "Opening WhatsApp…" : "Request Monthly — £8/mo"}
        </button>
        <button
          type="button"
          onClick={() => requestUpgrade("annual")}
          disabled={busy !== null}
          className="inline-flex h-12 items-center justify-center rounded-lg bg-brand-accent px-5 text-sm font-bold text-black transition hover:opacity-90 disabled:opacity-50"
        >
          {busy === "annual" ? "Opening WhatsApp…" : "Request Annual — £80/yr"}
        </button>
      </div>

      {canStartTrial && (
        <button
          type="button"
          onClick={startTrial}
          disabled={busy !== null}
          className="inline-flex h-11 items-center justify-center rounded-lg border border-brand-accent bg-transparent px-5 text-xs font-bold text-brand-accent transition hover:bg-brand-accent hover:text-black disabled:opacity-50"
        >
          {busy === "trial" ? "Starting…" : "Start your 30-day free trial"}
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
