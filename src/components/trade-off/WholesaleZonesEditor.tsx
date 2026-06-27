"use client";

// WholesaleZonesEditor — banded distance-based delivery editor for the
// Wholesale Mode add-on. Mirrors ShippingZonesEditor's vibe (list +
// inline form) but the row shape is different: free_radius_km +
// banded_pricing[] + min_order_pence + max_delivery_km.
//
// We keep ONE zone per listing in v1 — the table is multi-row-capable
// for future "named region" headroom but the editor surfaces only the
// first row. Save creates the row if it's missing and updates it
// otherwise.

import { useEffect, useMemo, useState } from "react";
import type { HammerexXratedWholesaleZone } from "@/lib/supabase";

type BandRow = {
  // Local key so React can identify rows that have no DB id yet.
  key: string;
  max_km: string;
  price_pounds: string;
  min_order_pounds: string;
};

let _keyCounter = 0;
function nextRowKey(): string {
  _keyCounter += 1;
  return `b-${Date.now().toString(36)}-${_keyCounter}`;
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

function numOrEmpty(v: number | null | undefined): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return "";
  return String(v);
}

function zoneToBands(zone: HammerexXratedWholesaleZone | null): BandRow[] {
  if (!zone || !Array.isArray(zone.banded_pricing)) return [];
  return zone.banded_pricing.map((b) => ({
    key: nextRowKey(),
    max_km: String(b.max_km ?? ""),
    price_pounds: penceToPounds(b.price_pence ?? 0),
    min_order_pounds: penceToPounds(b.min_order_pence ?? 0)
  }));
}

export function WholesaleZonesEditor({
  slug,
  editToken,
  initialZone,
  allowPickup,
  onAllowPickupChange
}: {
  slug: string;
  editToken: string;
  initialZone: HammerexXratedWholesaleZone | null;
  /** Mirrors the listing-level wholesale_allow_pickup flag so the
   *  yard-origin editor and this one stay in sync. The actual save
   *  for allowPickup happens through the YardOriginEditor — this
   *  component only renders the toggle as a courtesy. */
  allowPickup: boolean;
  onAllowPickupChange: (next: boolean) => void;
}) {
  const [zoneId, setZoneId] = useState<string | null>(initialZone?.id ?? null);
  const [freeRadiusKm, setFreeRadiusKm] = useState<string>(numOrEmpty(initialZone?.free_radius_km));
  const [maxDeliveryKm, setMaxDeliveryKm] = useState<string>(numOrEmpty(initialZone?.max_delivery_km));
  const [minOrderPounds, setMinOrderPounds] = useState<string>(penceToPounds(initialZone?.min_order_pence ?? 0));
  const [bands, setBands] = useState<BandRow[]>(zoneToBands(initialZone));
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  function addBand() {
    setBands((rows) => [
      ...rows,
      {
        key: nextRowKey(),
        max_km: "",
        price_pounds: "",
        min_order_pounds: ""
      }
    ]);
  }
  function removeBand(key: string) {
    setBands((rows) => rows.filter((r) => r.key !== key));
  }
  function patchBand(key: string, patch: Partial<BandRow>) {
    setBands((rows) => rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  const bandsValid = useMemo(() => {
    if (bands.length === 0) return null;
    let prev = 0;
    for (const r of bands) {
      const mk = Number(r.max_km);
      if (!Number.isFinite(mk) || mk <= 0) return "Each band needs a positive max km.";
      if (mk <= prev) return "Band max km must ascend without overlap.";
      const pp = Number(r.price_pounds);
      if (!Number.isFinite(pp) || pp < 0) return "Each band needs a price (use 0 for free).";
      prev = mk;
    }
    return null;
  }, [bands]);

  async function save() {
    setErr(null);
    setMsg(null);
    if (bands.length === 0) {
      setErr("Add at least one delivery band.");
      return;
    }
    if (bandsValid) {
      setErr(bandsValid);
      return;
    }
    setSubmitting(true);
    try {
      const zonePayload = {
        ...(zoneId ? { id: zoneId } : {}),
        free_radius_km: freeRadiusKm.trim().length === 0 ? null : Number(freeRadiusKm),
        free_postcodes: [],
        banded_pricing: bands.map((r) => ({
          max_km: Number(r.max_km),
          price_pence: poundsToPence(r.price_pounds),
          min_order_pence: poundsToPence(r.min_order_pounds)
        })),
        min_order_pence: poundsToPence(minOrderPounds),
        max_delivery_km: maxDeliveryKm.trim().length === 0 ? null : Number(maxDeliveryKm),
        sort_order: 0
      };
      const res = await fetch("/api/trade-off/wholesale-zones/upsert", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ slug, edit_token: editToken, zone: zonePayload })
      });
      const json = await res.json();
      if (!json.ok) {
        setErr(json.error ?? "Save failed.");
        return;
      }
      const saved = json.zone as HammerexXratedWholesaleZone;
      setZoneId(saved.id);
      setMsg("Delivery zones saved.");
    } catch {
      setErr("Network error — try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function deleteZone() {
    if (!zoneId) return;
    if (!confirm("Delete this delivery zone? Customers will see 'WhatsApp for quote' instead.")) return;
    setErr(null);
    try {
      const res = await fetch("/api/trade-off/wholesale-zones/delete", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ slug, edit_token: editToken, zone_id: zoneId })
      });
      const json = await res.json();
      if (!json.ok) {
        setErr(json.error ?? "Delete failed.");
        return;
      }
      setZoneId(null);
      setBands([]);
      setFreeRadiusKm("");
      setMaxDeliveryKm("");
      setMinOrderPounds("0.00");
      setMsg("Zone removed.");
    } catch {
      setErr("Network error — try again.");
    }
  }

  // Auto-clear the "saved" toast after a few seconds.
  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => setMsg(null), 2400);
    return () => clearTimeout(t);
  }, [msg]);

  return (
    <div className="space-y-4 rounded-xl border border-brand-line bg-brand-surface p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h2 className="text-lg font-extrabold">Delivery zones</h2>
          <p className="mt-1 text-xs text-brand-muted">
            Free radius from your yard, banded pricing beyond it, and an
            outer cap where delivery stops (customers WhatsApp you instead).
          </p>
        </div>
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

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Free-delivery radius (km)">
          <input
            type="number"
            inputMode="decimal"
            step="0.1"
            min="0"
            value={freeRadiusKm}
            onChange={(e) => setFreeRadiusKm(e.target.value)}
            placeholder="e.g. 10"
            className="block h-11 w-full rounded-md border border-brand-line bg-brand-bg px-3 text-sm text-brand-text outline-none focus:border-brand-accent"
          />
        </Field>
        <Field label="Outer delivery cap (km)">
          <input
            type="number"
            inputMode="decimal"
            step="0.1"
            min="0"
            value={maxDeliveryKm}
            onChange={(e) => setMaxDeliveryKm(e.target.value)}
            placeholder="e.g. 100"
            className="block h-11 w-full rounded-md border border-brand-line bg-brand-bg px-3 text-sm text-brand-text outline-none focus:border-brand-accent"
          />
        </Field>
      </div>

      <Field label="Minimum order across the whole zone (£)">
        <div className="flex items-center gap-1">
          <span className="text-base font-bold text-brand-muted">£</span>
          <input
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0"
            value={minOrderPounds}
            onChange={(e) => setMinOrderPounds(e.target.value)}
            placeholder="0.00"
            className="block h-11 w-full rounded-md border border-brand-line bg-brand-bg px-3 text-sm text-brand-text outline-none focus:border-brand-accent"
          />
        </div>
      </Field>

      <div className="rounded-lg border border-brand-line bg-brand-bg p-3">
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-[10px] font-bold uppercase tracking-widest text-brand-muted">
            Distance bands
          </p>
          <span className="text-[13px] text-brand-muted">
            {bands.length} band{bands.length === 1 ? "" : "s"}
          </span>
        </div>
        {bands.length === 0 ? (
          <p className="mt-2 text-[13px] text-brand-muted">
            No bands yet. Add the first band to start charging beyond your free radius.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {bands.map((row, idx) => (
              <li
                key={row.key}
                className="rounded-md border border-brand-line bg-brand-surface p-3"
              >
                <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-brand-muted">
                  Band {idx + 1}
                </p>
                <div className="grid gap-2 sm:grid-cols-3">
                  <label className="block">
                    <span className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-brand-muted">
                      Up to (km)
                    </span>
                    <input
                      type="number"
                      inputMode="decimal"
                      step="0.1"
                      min="0"
                      value={row.max_km}
                      onChange={(e) => patchBand(row.key, { max_km: e.target.value })}
                      className="block h-11 w-full rounded-md border border-brand-line bg-brand-bg px-3 text-sm text-brand-text outline-none focus:border-brand-accent"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-brand-muted">
                      Price (£)
                    </span>
                    <input
                      type="number"
                      inputMode="decimal"
                      step="0.01"
                      min="0"
                      value={row.price_pounds}
                      onChange={(e) => patchBand(row.key, { price_pounds: e.target.value })}
                      className="block h-11 w-full rounded-md border border-brand-line bg-brand-bg px-3 text-sm text-brand-text outline-none focus:border-brand-accent"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-brand-muted">
                      Min order (£)
                    </span>
                    <input
                      type="number"
                      inputMode="decimal"
                      step="0.01"
                      min="0"
                      value={row.min_order_pounds}
                      onChange={(e) => patchBand(row.key, { min_order_pounds: e.target.value })}
                      className="block h-11 w-full rounded-md border border-brand-line bg-brand-bg px-3 text-sm text-brand-text outline-none focus:border-brand-accent"
                    />
                  </label>
                </div>
                <div className="mt-2 flex justify-end">
                  <button
                    type="button"
                    onClick={() => removeBand(row.key)}
                    className="inline-flex h-9 items-center rounded-md border border-red-500/40 bg-red-500/5 px-3 text-[13px] font-bold text-red-300 transition hover:bg-red-500/15"
                  >
                    Remove
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
        <button
          type="button"
          onClick={addBand}
          className="mt-3 inline-flex h-11 items-center rounded-lg border border-brand-line bg-brand-surface px-3 text-[13px] font-bold text-brand-text transition hover:border-brand-accent hover:text-brand-accent"
        >
          + Add band
        </button>
      </div>

      <label className="flex h-11 items-center gap-3 rounded-md border border-brand-line bg-brand-bg px-3">
        <input
          type="checkbox"
          checked={allowPickup}
          onChange={(e) => onAllowPickupChange(e.target.checked)}
          className="h-5 w-5 accent-brand-accent"
        />
        <span className="text-[13px] font-bold text-brand-text">
          Allow Click &amp; Collect (customer picks up at the yard)
        </span>
      </label>

      <div className="flex flex-wrap gap-2 pt-1">
        <button
          type="button"
          onClick={save}
          disabled={submitting}
          className="inline-flex h-11 items-center rounded-lg bg-brand-accent px-5 text-xs font-bold text-black transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? "Saving…" : "Save delivery zones"}
        </button>
        {zoneId && (
          <button
            type="button"
            onClick={deleteZone}
            className="inline-flex h-11 items-center rounded-lg border border-red-500/40 bg-red-500/5 px-4 text-xs font-bold text-red-300 transition hover:bg-red-500/15"
          >
            Remove zone
          </button>
        )}
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
