"use client";

// YardOriginEditor — captures the wholesale yard's physical address +
// postcode + lat/lng, plus the distance fudge factor and VAT defaults.
// "Locate" hits /api/trade-off/postcode-lookup which proxies postcodes.io
// (UK only, free, no key). The result is stamped into lat/lng and the
// inline static-SVG map preview redraws around the new pin.

import { useEffect, useState } from "react";
import { YardMapPreview } from "@/components/xrated/profile/YardMapPreview";

type State = {
  address: string;
  postcode: string;
  lat: number | null;
  lng: number | null;
  distance_fudge: string;
  allow_pickup: boolean;
  currency: string;
  prices_ex_vat: boolean;
};

export function YardOriginEditor({
  slug,
  editToken,
  initial,
  onAllowPickupChange
}: {
  slug: string;
  editToken: string;
  initial: State;
  /** Lifted up so the WholesaleZonesEditor's Click&Collect toggle and
   *  this one stay in sync. Persists to the listing row on save. */
  onAllowPickupChange: (next: boolean) => void;
}) {
  const [state, setState] = useState<State>(initial);
  const [busy, setBusy] = useState<"locate" | "save" | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  function patch<K extends keyof State>(key: K, value: State[K]) {
    setState((s) => ({ ...s, [key]: value }));
  }

  useEffect(() => {
    onAllowPickupChange(state.allow_pickup);
  }, [state.allow_pickup, onAllowPickupChange]);

  async function locate() {
    setErr(null);
    setMsg(null);
    const pc = state.postcode.trim();
    if (!pc) {
      setErr("Enter a postcode first.");
      return;
    }
    setBusy("locate");
    try {
      const res = await fetch(`/api/trade-off/postcode-lookup?postcode=${encodeURIComponent(pc)}`);
      const json = await res.json();
      if (!json.ok) {
        setErr(
          json.error === "not_found"
            ? "Postcode not found in postcodes.io (UK only)."
            : json.error === "invalid"
              ? "That doesn't look like a valid UK postcode."
              : "Lookup failed — try again."
        );
        return;
      }
      setState((s) => ({
        ...s,
        lat: typeof json.lat === "number" ? json.lat : s.lat,
        lng: typeof json.lng === "number" ? json.lng : s.lng,
        postcode: json.postcode ?? s.postcode
      }));
      setMsg(`Located: ${json.town ?? "UK"} (${json.country ?? "GB"})`);
    } catch {
      setErr("Network error — try again.");
    } finally {
      setBusy(null);
    }
  }

  // Parse lat/lng out of a Google Maps share URL. Handles the most common
  // long-form patterns:
  //   .../@53.7457,-0.4042,15z
  //   .../?q=53.7457,-0.4042
  //   .../?ll=53.7457,-0.4042
  //   .../!3d53.7457!4d-0.4042  (place page)
  //
  // Short links (goo.gl/maps/..., maps.app.goo.gl/...) and Apple/Bing
  // URLs are not handled — they require a server-side redirect-follow
  // we haven't built yet. Returns null when no coords were found.
  function parseMapsUrl(url: string): { lat: number; lng: number } | null {
    const trimmed = url.trim();
    if (trimmed.length === 0) return null;
    const patterns: RegExp[] = [
      /@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/,
      /[?&](?:q|ll|destination)=(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/,
      /!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/
    ];
    for (const re of patterns) {
      const m = trimmed.match(re);
      if (m) {
        const lat = Number(m[1]);
        const lng = Number(m[2]);
        if (
          Number.isFinite(lat) &&
          Number.isFinite(lng) &&
          lat >= -90 &&
          lat <= 90 &&
          lng >= -180 &&
          lng <= 180
        ) {
          return { lat, lng };
        }
      }
    }
    return null;
  }

  function applyMapsUrl(url: string) {
    setErr(null);
    setMsg(null);
    const parsed = parseMapsUrl(url);
    if (!parsed) {
      setErr(
        "Couldn't read coordinates from that URL. Open Google Maps, drop a pin, tap Share, choose 'Copy link', then paste the full link here."
      );
      return;
    }
    setState((s) => ({ ...s, lat: parsed.lat, lng: parsed.lng }));
    setMsg(`Pinned: ${parsed.lat.toFixed(5)}, ${parsed.lng.toFixed(5)}`);
  }

  async function save() {
    setErr(null);
    setMsg(null);
    setBusy("save");
    try {
      const res = await fetch("/api/trade-off/wholesale-origin/upsert", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          slug,
          edit_token: editToken,
          address: state.address.trim(),
          postcode: state.postcode.trim(),
          lat: state.lat,
          lng: state.lng,
          distance_fudge: Number(state.distance_fudge) || 1.4,
          allow_pickup: state.allow_pickup,
          currency: state.currency,
          prices_ex_vat: state.prices_ex_vat
        })
      });
      const json = await res.json();
      if (!json.ok) {
        setErr(json.error ?? "Save failed.");
        return;
      }
      setMsg("Yard saved.");
    } catch {
      setErr("Network error — try again.");
    } finally {
      setBusy(null);
    }
  }

  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => setMsg(null), 2400);
    return () => clearTimeout(t);
  }, [msg]);

  const hasCoords = state.lat !== null && state.lng !== null;

  return (
    <div className="space-y-4 rounded-xl border border-brand-line bg-brand-surface p-5">
      <div>
        <h2 className="text-lg font-extrabold">Merchant location</h2>
        <p className="mt-1 text-xs text-brand-muted">
          Paste your Google Maps location URL in the field below, or enter
          your postcode and tap &ldquo;Set my location&rdquo; to confirm
          your business location.
        </p>
      </div>

      {err && (
        <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-300">
          {err}
        </p>
      )}
      {msg && (
        <p className="rounded-lg border border-brand-accent/40 bg-brand-accent/10 px-3 py-2 text-xs font-semibold text-brand-accent">
          {msg}
        </p>
      )}

      <Field label="Google Maps location URL">
        <input
          type="url"
          inputMode="url"
          maxLength={600}
          onChange={(e) => {
            const v = e.target.value;
            if (v.trim().length > 0) applyMapsUrl(v);
          }}
          placeholder="https://www.google.com/maps/@53.7457,-0.4042,15z"
          className="block h-11 w-full rounded-md border border-brand-line bg-brand-bg px-3 text-sm text-brand-text outline-none focus:border-brand-accent"
        />
      </Field>

      <Field label="Yard address (street + town)">
        <input
          type="text"
          value={state.address}
          maxLength={240}
          onChange={(e) => patch("address", e.target.value)}
          placeholder="e.g. Unit 5, Trafford Park Way, Manchester"
          className="block h-11 w-full rounded-md border border-brand-line bg-brand-bg px-3 text-sm text-brand-text outline-none focus:border-brand-accent"
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
        <Field label="Postcode (UK)">
          <input
            type="text"
            value={state.postcode}
            maxLength={12}
            onChange={(e) => patch("postcode", e.target.value.toUpperCase())}
            placeholder="e.g. M17 1AE"
            className="block h-11 w-full rounded-md border border-brand-line bg-brand-bg px-3 text-sm font-bold uppercase tracking-widest text-brand-text outline-none focus:border-brand-accent"
          />
        </Field>
        <div className="flex items-end">
          <button
            type="button"
            onClick={locate}
            disabled={busy !== null}
            className="inline-flex h-11 items-center gap-2 rounded-lg px-4 text-xs font-bold text-white transition hover:opacity-90 disabled:opacity-60"
            style={{
              // Red until a yard pin exists, green once set. Tapping again
              // re-runs Locate (merchant can fix the postcode and reset).
              background: hasCoords ? "#0F5132" : "#991B1B"
            }}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
            {busy === "locate"
              ? "Locating…"
              : hasCoords
                ? "Location set — reset"
                : "Set my location"}
          </button>
        </div>
      </div>

      {/* Lat/lng inputs hidden — merchants don't need to see coordinates.
       *  Postcode + "Locate" fills the state automatically and the map
       *  preview below confirms the pin. State is still maintained so
       *  upsert sends valid coords. */}

      <Field label="Distance fudge factor (1.0 = pure straight-line, 1.4 = default road, 3.0 = mountainous detour)">
        <input
          type="number"
          inputMode="decimal"
          step="0.1"
          min="1"
          max="3"
          value={state.distance_fudge}
          onChange={(e) => patch("distance_fudge", e.target.value)}
          className="block h-11 w-full rounded-md border border-brand-line bg-brand-bg px-3 text-sm text-brand-text outline-none focus:border-brand-accent"
        />
      </Field>

      <div className="rounded-lg border border-brand-line bg-brand-bg p-3">
        <p className="text-[10px] font-bold uppercase tracking-widest text-brand-accent">
          Building Merchant Delivery Zone Preview
        </p>
        <div className="mt-3 overflow-hidden rounded-md border border-brand-line bg-brand-surface">
          {hasCoords ? (
            <YardMapPreview
              yardLat={state.lat as number}
              yardLng={state.lng as number}
            />
          ) : (
            <div className="flex h-40 items-center justify-center text-[13px] text-brand-muted">
              Locate a postcode to see the yard pin.
            </div>
          )}
        </div>
      </div>

      <fieldset className="rounded-lg border border-brand-line bg-brand-bg p-3">
        <legend className="px-1 text-[10px] font-bold uppercase tracking-widest text-brand-muted">
          VAT &amp; currency
        </legend>
        <div className="mt-2 space-y-2">
          <label className="flex h-11 items-center gap-3 rounded-md border border-brand-line bg-brand-surface px-3">
            <input
              type="radio"
              name="vat_mode"
              checked={state.prices_ex_vat}
              onChange={() => patch("prices_ex_vat", true)}
              className="h-5 w-5 accent-brand-accent"
            />
            <span className="text-[13px] font-bold text-brand-text">
              Prices ex VAT (trade standard — cart shows ex + VAT + inc)
            </span>
          </label>
          <label className="flex h-11 items-center gap-3 rounded-md border border-brand-line bg-brand-surface px-3">
            <input
              type="radio"
              name="vat_mode"
              checked={!state.prices_ex_vat}
              onChange={() => patch("prices_ex_vat", false)}
              className="h-5 w-5 accent-brand-accent"
            />
            <span className="text-[13px] font-bold text-brand-text">
              Prices inc VAT (cart shows the inc total only)
            </span>
          </label>
          <p className="text-[10px] uppercase tracking-widest text-brand-muted">
            Currency: GBP (v1 only)
          </p>
        </div>
      </fieldset>

      <label className="flex h-11 items-center gap-3 rounded-md border border-brand-line bg-brand-bg px-3">
        <input
          type="checkbox"
          checked={state.allow_pickup}
          onChange={(e) => patch("allow_pickup", e.target.checked)}
          className="h-5 w-5 accent-brand-accent"
        />
        <span className="text-[13px] font-bold text-brand-text">
          Customers can collect from the yard
        </span>
      </label>

      <div className="flex flex-wrap gap-2 pt-1">
        <button
          type="button"
          onClick={save}
          disabled={busy !== null}
          className="inline-flex h-11 items-center rounded-lg bg-brand-accent px-5 text-xs font-bold text-black transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy === "save" ? "Saving…" : "Save yard origin"}
        </button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-bold uppercase tracking-widest text-brand-muted">
        {label}
      </span>
      {children}
    </label>
  );
}
