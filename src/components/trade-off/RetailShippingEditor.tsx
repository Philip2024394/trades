"use client";

// RetailShippingEditor — retail (per-listing) shipping config for the
// Shop Mode editor. Sister to WholesaleZonesEditor (which is bulk-order
// banded km pricing); this one is end-customer shipping.
//
// UK section: radio group — Free / Flat / Per-area. Per-area opens a
// list-builder. International section: toggle + list-builder. Per-field
// debounced save (250ms) hits /api/trade-off/listings/retail-shipping
// with the full shape (full-replace, not patch — matches the API's
// "empty arrays → NULL" semantics).
//
// 13px text floor preserved everywhere (`text-[13px]` / `text-xs` only
// for uppercase labels).

import { useEffect, useMemo, useRef, useState } from "react";
import type {
  RetailShippingArea,
  RetailShippingIntl
} from "@/lib/supabase";

type Mode = "free" | "uk_flat" | "uk_areas" | null;

type AreaRow = {
  // Local key so React can identify rows that have no DB id yet.
  key: string;
  area: string;
  price_pounds: string;
};

type IntlRow = {
  key: string;
  country_code: string;
  country_name: string;
  price_pounds: string;
  dispatch_days: string;
  delivery_days: string;
};

// Short curated country list — keeps the editor lightweight; covers the
// usual UK trade export targets without a 200-row dropdown.
const COUNTRY_OPTIONS: { code: string; name: string }[] = [
  { code: "IE", name: "Ireland" },
  { code: "FR", name: "France" },
  { code: "DE", name: "Germany" },
  { code: "ES", name: "Spain" },
  { code: "NL", name: "Netherlands" },
  { code: "BE", name: "Belgium" },
  { code: "IT", name: "Italy" },
  { code: "PT", name: "Portugal" },
  { code: "PL", name: "Poland" },
  { code: "SE", name: "Sweden" },
  { code: "NO", name: "Norway" },
  { code: "DK", name: "Denmark" },
  { code: "FI", name: "Finland" },
  { code: "AT", name: "Austria" },
  { code: "CH", name: "Switzerland" },
  { code: "US", name: "United States" },
  { code: "CA", name: "Canada" },
  { code: "AU", name: "Australia" },
  { code: "NZ", name: "New Zealand" },
  { code: "AE", name: "United Arab Emirates" },
  { code: "SA", name: "Saudi Arabia" },
  { code: "ZA", name: "South Africa" },
  { code: "JP", name: "Japan" },
  { code: "SG", name: "Singapore" },
  { code: "HK", name: "Hong Kong" }
];

let _keyCounter = 0;
function nextRowKey(prefix: string): string {
  _keyCounter += 1;
  return `${prefix}-${Date.now().toString(36)}-${_keyCounter}`;
}

function poundsToPence(input: string): number {
  const n = Number(input);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n * 100);
}

function penceToPounds(p: number | null | undefined): string {
  if (p === null || p === undefined || !Number.isFinite(p)) return "";
  return (p / 100).toFixed(2);
}

function intStr(v: number | null | undefined): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return "";
  return String(v);
}

export function RetailShippingEditor({
  slug,
  editToken,
  initialMode,
  initialUkPence,
  initialUkAreas,
  initialIntl
}: {
  slug: string;
  editToken: string;
  initialMode: Mode;
  initialUkPence: number | null;
  initialUkAreas: RetailShippingArea[] | null;
  initialIntl: RetailShippingIntl[] | null;
}) {
  const [mode, setMode] = useState<Mode>(initialMode);
  const [ukPounds, setUkPounds] = useState<string>(penceToPounds(initialUkPence));
  const [areas, setAreas] = useState<AreaRow[]>(
    (initialUkAreas ?? []).map((a) => ({
      key: nextRowKey("a"),
      area: a.area,
      price_pounds: penceToPounds(a.price_pence)
    }))
  );

  const [intlOn, setIntlOn] = useState<boolean>((initialIntl ?? []).length > 0);
  const [intlRows, setIntlRows] = useState<IntlRow[]>(
    (initialIntl ?? []).map((r) => ({
      key: nextRowKey("i"),
      country_code: r.country_code,
      country_name: r.country_name,
      price_pounds: penceToPounds(r.price_pence),
      dispatch_days: intStr(r.dispatch_days),
      delivery_days: intStr(r.delivery_days)
    }))
  );

  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const saveTimerRef = useRef<number | null>(null);

  // Build the wire payload from the current local state. Mode-aware
  // nulling mirrors the API — only the active mode's fields survive.
  const buildPayload = useMemo(() => {
    return () => ({
      slug,
      edit_token: editToken,
      mode,
      uk_pence: mode === "uk_flat" ? poundsToPence(ukPounds) : null,
      uk_areas:
        mode === "uk_areas"
          ? areas
              .map((a) => ({
                area: a.area.trim(),
                price_pence: poundsToPence(a.price_pounds)
              }))
              .filter((a) => a.area.length > 0)
          : [],
      international: intlOn
        ? intlRows
            .map((r) => {
              const opt = COUNTRY_OPTIONS.find((o) => o.code === r.country_code);
              const name = opt?.name ?? r.country_name;
              return {
                country_code: r.country_code,
                country_name: name,
                price_pence: poundsToPence(r.price_pounds),
                dispatch_days: Math.max(0, Math.floor(Number(r.dispatch_days) || 0)),
                delivery_days: Math.max(0, Math.floor(Number(r.delivery_days) || 0))
              };
            })
            .filter((r) => /^[A-Z]{2}$/.test(r.country_code))
        : []
    });
  }, [slug, editToken, mode, ukPounds, areas, intlOn, intlRows]);

  // Debounced save — 250ms after the latest local edit, push everything.
  function scheduleSave() {
    if (saveTimerRef.current !== null) {
      window.clearTimeout(saveTimerRef.current);
    }
    saveTimerRef.current = window.setTimeout(async () => {
      saveTimerRef.current = null;
      setSaving(true);
      setErr(null);
      try {
        const res = await fetch("/api/trade-off/listings/retail-shipping", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(buildPayload())
        });
        const json = await res.json();
        if (!json.ok) {
          setErr(json.error ?? "Save failed.");
          return;
        }
        setMsg("Delivery saved.");
      } catch {
        setErr("Network error — try again.");
      } finally {
        setSaving(false);
      }
    }, 250);
  }

  // Re-schedule a save whenever any local field changes after first mount.
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    scheduleSave();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, ukPounds, areas, intlOn, intlRows]);

  // Toast auto-clear.
  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => setMsg(null), 2400);
    return () => clearTimeout(t);
  }, [msg]);

  function addArea() {
    setAreas((rows) => [
      ...rows,
      { key: nextRowKey("a"), area: "", price_pounds: "" }
    ]);
  }
  function removeArea(key: string) {
    setAreas((rows) => rows.filter((r) => r.key !== key));
  }
  function patchArea(key: string, patch: Partial<AreaRow>) {
    setAreas((rows) => rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  function addIntl() {
    const used = new Set(intlRows.map((r) => r.country_code));
    const next = COUNTRY_OPTIONS.find((o) => !used.has(o.code)) ?? COUNTRY_OPTIONS[0];
    setIntlRows((rows) => [
      ...rows,
      {
        key: nextRowKey("i"),
        country_code: next.code,
        country_name: next.name,
        price_pounds: "",
        dispatch_days: "1",
        delivery_days: "7"
      }
    ]);
  }
  function removeIntl(key: string) {
    setIntlRows((rows) => rows.filter((r) => r.key !== key));
  }
  function patchIntl(key: string, patch: Partial<IntlRow>) {
    setIntlRows((rows) => rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  return (
    <div className="space-y-4 rounded-xl border border-brand-line bg-brand-surface p-5">
      <div>
        <h2 className="text-lg font-extrabold">Retail delivery</h2>
        <p className="mt-1 text-xs text-brand-muted">
          End-customer delivery — used on the product page. Wholesale Mode
          uses its own banded-distance config below.
        </p>
      </div>

      {err && (
        <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-[13px] font-semibold text-red-300">
          {err}
        </p>
      )}
      {msg && !err && (
        <p className="rounded-lg border border-brand-accent/40 bg-brand-accent/10 px-3 py-2 text-[13px] font-semibold text-brand-accent">
          {saving ? "Saving…" : msg}
        </p>
      )}

      {/* UK section. */}
      <fieldset className="space-y-3">
        <legend className="text-xs font-bold uppercase tracking-widest text-brand-muted">
          How do you charge for UK delivery?
        </legend>
        <div className="grid gap-2 sm:grid-cols-3">
          <ModeRadio
            label="Free delivery"
            checked={mode === "free"}
            onChange={() => setMode("free")}
          />
          <ModeRadio
            label="One flat UK price"
            checked={mode === "uk_flat"}
            onChange={() => setMode("uk_flat")}
          />
          <ModeRadio
            label="Different prices per UK area"
            checked={mode === "uk_areas"}
            onChange={() => setMode("uk_areas")}
          />
        </div>
        <p className="text-[13px] text-brand-muted">
          Not configured = customers see &ldquo;Delivery confirmed by WhatsApp&rdquo; on every product.
        </p>

        {mode === "uk_flat" && (
          <label className="block">
            <span className="mb-1 block text-xs font-bold uppercase tracking-widest text-brand-muted">
              UK price (£)
            </span>
            <div className="flex items-center gap-1">
              <span className="text-base font-bold text-brand-muted">£</span>
              <input
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                value={ukPounds}
                onChange={(e) => setUkPounds(e.target.value)}
                placeholder="0.00"
                className="block h-11 w-full max-w-[180px] rounded-md border border-brand-line bg-brand-bg px-3 text-[13px] text-brand-text outline-none focus:border-brand-accent"
              />
            </div>
          </label>
        )}

        {mode === "uk_areas" && (
          <div className="rounded-lg border border-brand-line bg-brand-bg p-3">
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-[10px] font-bold uppercase tracking-widest text-brand-muted">
                UK areas
              </p>
              <span className="text-[13px] text-brand-muted">
                {areas.length} area{areas.length === 1 ? "" : "s"}
              </span>
            </div>
            {areas.length === 0 ? (
              <p className="mt-2 text-[13px] text-brand-muted">
                No areas yet. Add one — for example &ldquo;M1, M2, M3 (Manchester central)&rdquo;.
              </p>
            ) : (
              <ul className="mt-3 space-y-2">
                {areas.map((row) => (
                  <li
                    key={row.key}
                    className="rounded-md border border-brand-line bg-brand-surface p-3"
                  >
                    <div className="grid gap-2 sm:grid-cols-[2fr,1fr,auto]">
                      <label className="block">
                        <span className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-brand-muted">
                          Area
                        </span>
                        <input
                          type="text"
                          value={row.area}
                          maxLength={80}
                          onChange={(e) => patchArea(row.key, { area: e.target.value })}
                          placeholder="M1, M2, M3 (Manchester central)"
                          className="block h-11 w-full rounded-md border border-brand-line bg-brand-bg px-3 text-[13px] text-brand-text outline-none focus:border-brand-accent"
                        />
                      </label>
                      <label className="block">
                        <span className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-brand-muted">
                          Price (£)
                        </span>
                        <div className="flex items-center gap-1">
                          <span className="text-base font-bold text-brand-muted">£</span>
                          <input
                            type="number"
                            inputMode="decimal"
                            step="0.01"
                            min="0"
                            value={row.price_pounds}
                            onChange={(e) => patchArea(row.key, { price_pounds: e.target.value })}
                            placeholder="0.00"
                            className="block h-11 w-full rounded-md border border-brand-line bg-brand-bg px-3 text-[13px] text-brand-text outline-none focus:border-brand-accent"
                          />
                        </div>
                      </label>
                      <div className="flex items-end">
                        <button
                          type="button"
                          onClick={() => removeArea(row.key)}
                          className="inline-flex h-11 items-center rounded-md border border-red-500/40 bg-red-500/5 px-3 text-[13px] font-bold text-red-300 transition hover:bg-red-500/15"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <button
              type="button"
              onClick={addArea}
              className="mt-3 inline-flex h-11 items-center rounded-lg border border-brand-line bg-brand-surface px-3 text-[13px] font-bold text-brand-text transition hover:border-brand-accent hover:text-brand-accent"
            >
              + Add area
            </button>
          </div>
        )}
      </fieldset>

      {/* International section. */}
      <fieldset className="space-y-3">
        <legend className="text-xs font-bold uppercase tracking-widest text-brand-muted">
          International shipping
        </legend>
        <label className="flex h-11 items-center gap-3 rounded-md border border-brand-line bg-brand-bg px-3">
          <input
            type="checkbox"
            checked={intlOn}
            onChange={(e) => setIntlOn(e.target.checked)}
            className="h-5 w-5 accent-brand-accent"
          />
          <span className="text-[13px] font-bold text-brand-text">
            Ship internationally
          </span>
        </label>

        {intlOn && (
          <div className="rounded-lg border border-brand-line bg-brand-bg p-3">
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-[10px] font-bold uppercase tracking-widest text-brand-muted">
                Countries
              </p>
              <span className="text-[13px] text-brand-muted">
                {intlRows.length} countr{intlRows.length === 1 ? "y" : "ies"}
              </span>
            </div>
            {intlRows.length === 0 ? (
              <p className="mt-2 text-[13px] text-brand-muted">
                No countries yet. Add one to start charging international shipping.
              </p>
            ) : (
              <ul className="mt-3 space-y-2">
                {intlRows.map((row) => (
                  <li
                    key={row.key}
                    className="rounded-md border border-brand-line bg-brand-surface p-3"
                  >
                    <div className="grid gap-2 sm:grid-cols-[1.4fr,1fr,1fr,1fr,auto]">
                      <label className="block">
                        <span className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-brand-muted">
                          Country
                        </span>
                        <select
                          value={row.country_code}
                          onChange={(e) => {
                            const opt = COUNTRY_OPTIONS.find((o) => o.code === e.target.value);
                            patchIntl(row.key, {
                              country_code: e.target.value,
                              country_name: opt?.name ?? row.country_name
                            });
                          }}
                          className="block h-11 w-full rounded-md border border-brand-line bg-brand-bg px-3 text-[13px] text-brand-text outline-none focus:border-brand-accent"
                        >
                          {COUNTRY_OPTIONS.map((o) => (
                            <option key={o.code} value={o.code}>
                              {o.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="block">
                        <span className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-brand-muted">
                          Price (£)
                        </span>
                        <div className="flex items-center gap-1">
                          <span className="text-base font-bold text-brand-muted">£</span>
                          <input
                            type="number"
                            inputMode="decimal"
                            step="0.01"
                            min="0"
                            value={row.price_pounds}
                            onChange={(e) => patchIntl(row.key, { price_pounds: e.target.value })}
                            placeholder="0.00"
                            className="block h-11 w-full rounded-md border border-brand-line bg-brand-bg px-3 text-[13px] text-brand-text outline-none focus:border-brand-accent"
                          />
                        </div>
                      </label>
                      <label className="block">
                        <span className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-brand-muted">
                          Dispatch (days)
                        </span>
                        <input
                          type="number"
                          inputMode="numeric"
                          step="1"
                          min="0"
                          value={row.dispatch_days}
                          onChange={(e) => patchIntl(row.key, { dispatch_days: e.target.value })}
                          placeholder="1"
                          className="block h-11 w-full rounded-md border border-brand-line bg-brand-bg px-3 text-[13px] text-brand-text outline-none focus:border-brand-accent"
                        />
                      </label>
                      <label className="block">
                        <span className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-brand-muted">
                          Delivery (days)
                        </span>
                        <input
                          type="number"
                          inputMode="numeric"
                          step="1"
                          min="0"
                          value={row.delivery_days}
                          onChange={(e) => patchIntl(row.key, { delivery_days: e.target.value })}
                          placeholder="7"
                          className="block h-11 w-full rounded-md border border-brand-line bg-brand-bg px-3 text-[13px] text-brand-text outline-none focus:border-brand-accent"
                        />
                      </label>
                      <div className="flex items-end">
                        <button
                          type="button"
                          onClick={() => removeIntl(row.key)}
                          className="inline-flex h-11 items-center rounded-md border border-red-500/40 bg-red-500/5 px-3 text-[13px] font-bold text-red-300 transition hover:bg-red-500/15"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <button
              type="button"
              onClick={addIntl}
              className="mt-3 inline-flex h-11 items-center rounded-lg border border-brand-line bg-brand-surface px-3 text-[13px] font-bold text-brand-text transition hover:border-brand-accent hover:text-brand-accent"
            >
              + Add country
            </button>
          </div>
        )}
      </fieldset>
    </div>
  );
}

function ModeRadio({
  label,
  checked,
  onChange
}: {
  label: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <label
      className={`flex h-11 cursor-pointer items-center gap-2 rounded-md border px-3 text-[13px] font-bold transition ${
        checked
          ? "border-brand-accent bg-brand-accent/10 text-brand-text"
          : "border-brand-line bg-brand-bg text-brand-muted hover:border-brand-accent"
      }`}
    >
      <input
        type="radio"
        name="retail_shipping_mode"
        checked={checked}
        onChange={onChange}
        className="h-4 w-4 accent-brand-accent"
      />
      <span>{label}</span>
    </label>
  );
}
