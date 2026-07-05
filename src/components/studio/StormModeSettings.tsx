"use client";

// Storm-mode banner settings.
//
// Merchant toggles the banner on with a message + auto-expiry. Every
// public page reads the state via loadActiveStormMode() and renders a
// dismissible ribbon at the top. Auto-expires so stale banners can't
// linger after the storm passes.
//
// Honest scope note: no automatic Met Office activation in v1. Met
// Office DataHub is paid + scraping the consumer feed is fragile.
// Manual toggle keeps this reliable + within ToS.

import { useEffect, useState } from "react";
import { fetchWithRetry } from "@/lib/studio/fetchWithRetry";

const YELLOW = "#FFB300";
const RED = "#DC2626";
const GREEN = "#10B981";

type StormRow = {
  enabled: boolean;
  message: string | null;
  cta_label: string | null;
  cta_href: string | null;
  expires_at: string | null;
};

const EMPTY: StormRow = {
  enabled: false,
  message: null,
  cta_label: null,
  cta_href: null,
  expires_at: null
};

// Preset expiry buttons — merchants set 2 / 6 / 24 / 72 hours ahead.
const EXPIRY_PRESETS: { label: string; hours: number }[] = [
  { label: "+2 hours", hours: 2 },
  { label: "+6 hours", hours: 6 },
  { label: "+24 hours", hours: 24 },
  { label: "+72 hours", hours: 72 }
];

export function StormModeSettings() {
  const [state, setState] = useState<StormRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/studio/storm-mode");
        const json = (await res.json()) as
          | { ok: true; storm: StormRow }
          | { ok: false; error: string };
        if (!json.ok) throw new Error(json.error);
        setState(json.storm);
      } catch (err) {
        setError((err as Error).message ?? "network");
        setState(EMPTY);
      }
    })();
  }, []);

  async function save() {
    if (!state) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetchWithRetry("/api/studio/storm-mode", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(state)
      });
      const json = (await res.json()) as { ok: boolean; error?: string };
      if (!json.ok) throw new Error(json.error ?? "save-failed");
      setFlash(
        state.enabled ? "Storm banner is live on your site." : "Storm banner disabled."
      );
      window.setTimeout(() => setFlash(null), 3000);
    } catch (err) {
      setError((err as Error).message ?? "save-failed");
    } finally {
      setSaving(false);
    }
  }

  function update<K extends keyof StormRow>(key: K, value: StormRow[K]) {
    setState((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  function setExpiryPreset(hours: number) {
    const iso = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
    update("expires_at", iso);
  }

  if (state === null) {
    return <p className="p-8 text-center text-[13px] text-neutral-500">Loading…</p>;
  }

  const expiresIn = state.expires_at
    ? Math.round((new Date(state.expires_at).getTime() - Date.now()) / (60 * 60 * 1000))
    : null;
  const isLive =
    state.enabled &&
    (!state.expires_at || new Date(state.expires_at).getTime() > Date.now());

  return (
    <div className="mx-auto max-w-3xl px-6 py-10 sm:py-14">
      <p
        className="text-[10px] font-extrabold uppercase tracking-widest"
        style={{ color: YELLOW }}
      >
        Storm mode
      </p>
      <h1 className="mt-2 text-3xl font-extrabold leading-tight text-neutral-900 sm:text-4xl">
        Flip the banner on when the weather turns.
      </h1>
      <p className="mt-3 max-w-2xl text-[14px] leading-relaxed text-neutral-600">
        Roofers, plumbers, tree surgeons, fencers — Storm Mode lets you
        tell your customers you're on it, without editing the whole site.
        Set a message + expiry, the banner vanishes automatically when
        the window closes.
      </p>
      <p className="mt-2 max-w-2xl text-[11px] text-neutral-500">
        Manual toggle for now. Met Office DataHub is paid + scraping
        the consumer feed is unreliable — we'd rather keep this honest
        than fake automation.
      </p>

      {flash && (
        <p
          role="status"
          className="mt-6 rounded-lg bg-emerald-50 px-3 py-2 text-[12px] font-bold text-emerald-800"
        >
          {flash}
        </p>
      )}
      {error && (
        <p
          role="alert"
          className="mt-6 rounded-lg bg-red-50 px-3 py-2 text-[12px] font-bold text-red-700"
        >
          {error}
        </p>
      )}

      <div className="mt-8 rounded-2xl border border-neutral-200 bg-white p-5">
        {/* Live indicator */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[13px] font-extrabold text-neutral-900">
              Banner is currently{" "}
              <span style={{ color: isLive ? GREEN : "#525252" }}>
                {isLive ? "LIVE" : "off"}
              </span>
            </p>
            {isLive && expiresIn !== null && (
              <p className="text-[11px] text-neutral-500">
                Expires in ~{expiresIn}h
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={() => update("enabled", !state.enabled)}
            aria-pressed={state.enabled}
            className="relative inline-flex h-8 w-14 items-center rounded-full transition"
            style={{ background: state.enabled ? RED : "#D4D4D4" }}
          >
            <span
              className="absolute top-0.5 h-7 w-7 rounded-full bg-white shadow"
              style={{
                left: state.enabled ? 26 : 2,
                transition: "left 180ms cubic-bezier(0.4,0,0.2,1)"
              }}
            />
          </button>
        </div>

        <hr className="my-4 border-neutral-100" />

        <label className="text-[10px] font-extrabold uppercase tracking-widest text-neutral-500">
          Message
        </label>
        <textarea
          value={state.message ?? ""}
          onChange={(e) => update("message", e.target.value || null)}
          rows={2}
          placeholder="Storm response active — expect a 2-hour delay on new callouts. Emergency line still 24/7."
          className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-[13px] outline-none focus:border-neutral-900"
        />

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="text-[10px] font-extrabold uppercase tracking-widest text-neutral-500">
              CTA label (optional)
            </label>
            <input
              value={state.cta_label ?? ""}
              onChange={(e) => update("cta_label", e.target.value || null)}
              placeholder="Emergency call"
              className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-[13px] outline-none focus:border-neutral-900"
            />
          </div>
          <div>
            <label className="text-[10px] font-extrabold uppercase tracking-widest text-neutral-500">
              CTA link (optional)
            </label>
            <input
              value={state.cta_href ?? ""}
              onChange={(e) => update("cta_href", e.target.value || null)}
              placeholder="tel:+441234567890"
              className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-[13px] outline-none focus:border-neutral-900"
            />
          </div>
        </div>

        <div className="mt-4">
          <label className="text-[10px] font-extrabold uppercase tracking-widest text-neutral-500">
            Auto-expire
          </label>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {EXPIRY_PRESETS.map((p) => (
              <button
                key={p.hours}
                type="button"
                onClick={() => setExpiryPreset(p.hours)}
                className="rounded-full border border-neutral-300 bg-white px-3 py-1 text-[11px] font-bold text-neutral-700 transition hover:bg-neutral-50"
              >
                {p.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => update("expires_at", null)}
              className="rounded-full border border-neutral-300 bg-white px-3 py-1 text-[11px] font-bold text-neutral-600 transition hover:bg-neutral-50"
            >
              No expiry
            </button>
          </div>
          {state.expires_at && (
            <p className="mt-2 text-[10px] text-neutral-500">
              Expires{" "}
              {new Date(state.expires_at).toLocaleString(undefined, {
                weekday: "short",
                day: "2-digit",
                month: "short",
                hour: "2-digit",
                minute: "2-digit"
              })}
            </p>
          )}
        </div>

        <div className="mt-5 flex items-center justify-end gap-3 border-t border-neutral-100 pt-4">
          <button
            type="button"
            onClick={save}
            disabled={saving || (state.enabled && !state.message)}
            className="inline-flex h-10 items-center rounded-xl px-4 text-[11px] font-extrabold uppercase tracking-widest text-neutral-900 transition hover:brightness-95 disabled:opacity-40"
            style={{ background: YELLOW }}
          >
            {saving ? "Saving…" : "Save storm mode"}
          </button>
        </div>
      </div>

      {/* Live preview */}
      {state.enabled && state.message && (
        <div className="mt-8">
          <p
            className="mb-2 text-[10px] font-extrabold uppercase tracking-widest text-neutral-500"
          >
            Preview
          </p>
          <div
            className="flex items-center gap-3 rounded-lg px-4 py-3 text-white shadow-lg"
            style={{ background: RED }}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M13 2 3 14h7v8l10-12h-7V2z" />
            </svg>
            <p className="flex-1 text-[13px] font-bold">{state.message}</p>
            {state.cta_label && (
              <a
                href={state.cta_href || "#"}
                className="rounded-full border border-white/40 bg-white/10 px-3 py-1 text-[11px] font-extrabold uppercase tracking-widest text-white no-underline"
              >
                {state.cta_label}
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
