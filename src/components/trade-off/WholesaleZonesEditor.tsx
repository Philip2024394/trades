"use client";

// WholesaleZonesEditor — 3-zone delivery editor for the Wholesale Mode
// add-on. Merchants think in "Zone 1 (Inner) / Zone 2 (Mid) / Zone 3
// (Outer)" rather than free-radius + banded pricing[].
//
// Same DB row shape as before (free_radius_km + banded_pricing[]):
//   - Zone 1 FREE → free_radius_km = Zone1.km, banded_pricing = [Z2, Z3]
//   - Zone 1 PRICED → free_radius_km = 0, banded_pricing = [Z1, Z2, Z3]
//   - Zones beyond Zone 3 fold into Zone 3 on load (truncation toast).
//
// The merchant never sees "band" or "free radius" terminology — the
// mapping is opaque. Validation enforces strictly increasing km.

import { useEffect, useMemo, useState } from "react";
import type { HammerexXratedWholesaleZone } from "@/lib/supabase";

type ZoneSlot = {
  id: 1 | 2 | 3;
  // Empty string when the merchant has cleared the slot (= skip on save).
  km: string;
  // "free" | "priced" — "priced" requires price_pounds > 0.
  mode: "free" | "priced";
  price_pounds: string;
  min_order_pounds: string;
};

const ZONE_META: Array<{
  id: 1 | 2 | 3;
  name: string;
  sub: string;
  hint: string;
}> = [
  { id: 1, name: "Zone 1", sub: "Inner", hint: "Close to the yard" },
  { id: 2, name: "Zone 2", sub: "Mid", hint: "A short drive out" },
  { id: 3, name: "Zone 3", sub: "Outer", hint: "Far edge of your range" }
];

const DEFAULT_SLOTS: ZoneSlot[] = [
  { id: 1, km: "5", mode: "free", price_pounds: "", min_order_pounds: "" },
  { id: 2, km: "15", mode: "priced", price_pounds: "15.00", min_order_pounds: "" },
  { id: 3, km: "30", mode: "priced", price_pounds: "40.00", min_order_pounds: "" }
];

function poundsToPence(input: string): number {
  const n = Number(input);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n * 100);
}

function penceToPounds(p: number | null | undefined): string {
  if (p === null || p === undefined || !Number.isFinite(p)) return "";
  if (p === 0) return "";
  return (p / 100).toFixed(2);
}

// Reverse-map a stored zone row into the 3-slot editor model. Returns
// `{ slots, mergedExtra }` — `mergedExtra` is true when there were more
// than 3 effective zones (we fold them into Zone 3 and toast).
function zoneToSlots(
  zone: HammerexXratedWholesaleZone | null
): { slots: ZoneSlot[]; mergedExtra: boolean } {
  if (!zone) {
    return { slots: DEFAULT_SLOTS.map((s) => ({ ...s })), mergedExtra: false };
  }
  const bands = Array.isArray(zone.banded_pricing) ? zone.banded_pricing : [];
  const freeKm =
    typeof zone.free_radius_km === "number" && zone.free_radius_km > 0
      ? zone.free_radius_km
      : null;

  const slots: ZoneSlot[] = [];

  if (freeKm !== null) {
    // Zone 1 = free at freeKm. Zone 2/3 = first two bands.
    slots.push({
      id: 1,
      km: String(freeKm),
      mode: "free",
      price_pounds: "",
      min_order_pounds: ""
    });
    for (let i = 0; i < Math.min(2, bands.length); i += 1) {
      const b = bands[i];
      slots.push({
        id: (slots.length + 1) as 1 | 2 | 3,
        km: String(b.max_km ?? ""),
        mode: "priced",
        price_pounds: penceToPounds(b.price_pence ?? 0),
        min_order_pounds: penceToPounds(b.min_order_pence ?? 0)
      });
    }
  } else {
    // No free radius — bands map directly into Zone 1/2/3.
    for (let i = 0; i < Math.min(3, bands.length); i += 1) {
      const b = bands[i];
      const pricePence = b.price_pence ?? 0;
      slots.push({
        id: (slots.length + 1) as 1 | 2 | 3,
        km: String(b.max_km ?? ""),
        mode: pricePence === 0 ? "free" : "priced",
        price_pounds: penceToPounds(pricePence),
        min_order_pounds: penceToPounds(b.min_order_pence ?? 0)
      });
    }
  }

  // Fold any extra bands (4+) into the last slot — keep the furthest km
  // and the highest price so the customer still pays for the long haul.
  let mergedExtra = false;
  const totalEffective =
    (freeKm !== null ? 1 : 0) + bands.length;
  if (totalEffective > 3) {
    mergedExtra = true;
    // Determine extras and merge into Zone 3.
    const startExtraIdx = freeKm !== null ? 2 : 3;
    let maxKm = 0;
    let maxPricePence = 0;
    let maxMinOrderPence = 0;
    for (let i = startExtraIdx; i < bands.length; i += 1) {
      const b = bands[i];
      if (typeof b.max_km === "number" && b.max_km > maxKm) maxKm = b.max_km;
      if (typeof b.price_pence === "number" && b.price_pence > maxPricePence) {
        maxPricePence = b.price_pence;
      }
      const mo = b.min_order_pence ?? 0;
      if (mo > maxMinOrderPence) maxMinOrderPence = mo;
    }
    if (slots.length === 3) {
      const last = slots[2];
      const lastKm = Number(last.km) || 0;
      const lastPrice = poundsToPence(last.price_pounds);
      last.km = String(Math.max(lastKm, maxKm));
      if (maxPricePence > lastPrice) {
        last.mode = maxPricePence > 0 ? "priced" : "free";
        last.price_pounds = penceToPounds(maxPricePence);
      }
      const lastMin = poundsToPence(last.min_order_pounds);
      if (maxMinOrderPence > lastMin) {
        last.min_order_pounds = penceToPounds(maxMinOrderPence);
      }
    }
  }

  // Pad to 3 slots so the UI always shows three cards (extras blank).
  while (slots.length < 3) {
    const id = (slots.length + 1) as 1 | 2 | 3;
    slots.push({
      id,
      km: "",
      mode: "priced",
      price_pounds: "",
      min_order_pounds: ""
    });
  }

  // Stamp ids 1/2/3 deterministically.
  slots.forEach((s, idx) => {
    s.id = (idx + 1) as 1 | 2 | 3;
  });

  return { slots, mergedExtra };
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
  const initial = useMemo(() => zoneToSlots(initialZone), [initialZone]);
  const [zoneId, setZoneId] = useState<string | null>(initialZone?.id ?? null);
  const [slots, setSlots] = useState<ZoneSlot[]>(initial.slots);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(initial.mergedExtra
    ? "Older configurations beyond 3 zones have been merged into Zone 3."
    : null);

  function patchSlot(id: 1 | 2 | 3, patch: Partial<ZoneSlot>) {
    setSlots((rows) => rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  // Returns the slots the merchant has actually filled in, in order.
  // A slot counts as "filled" if it has a positive km value.
  function activeSlots(rows: ZoneSlot[]): ZoneSlot[] {
    return rows.filter((r) => {
      const km = Number(r.km);
      return Number.isFinite(km) && km > 0;
    });
  }

  const validationError = useMemo<string | null>(() => {
    const active = activeSlots(slots);
    if (active.length === 0) return "Set at least one zone (or remove Wholesale Mode).";
    let prevKm = 0;
    for (const slot of active) {
      const km = Number(slot.km);
      if (!Number.isFinite(km) || km <= 0) {
        return `${labelFor(slot.id)} needs a positive km value.`;
      }
      if (km <= prevKm) {
        return `${labelFor(slot.id)} km must be greater than the previous zone.`;
      }
      if (slot.mode === "priced") {
        const pp = Number(slot.price_pounds);
        if (!Number.isFinite(pp) || pp <= 0) {
          return `${labelFor(slot.id)} is set to "Set a price" — enter a price above £0 (or switch to Free).`;
        }
      }
      prevKm = km;
    }
    return null;
  }, [slots]);

  async function save() {
    setErr(null);
    setMsg(null);
    if (validationError) {
      setErr(validationError);
      return;
    }
    setSubmitting(true);
    try {
      const active = activeSlots(slots);

      // Map slots → free_radius_km + banded_pricing[].
      let freeRadiusKm: number | null = null;
      const bandsOut: Array<{
        max_km: number;
        price_pence: number;
        min_order_pence: number;
      }> = [];

      const first = active[0];
      let bandStartIdx = 0;
      if (first && first.mode === "free") {
        freeRadiusKm = Number(first.km);
        bandStartIdx = 1;
      } else {
        freeRadiusKm = 0;
      }

      for (let i = bandStartIdx; i < active.length; i += 1) {
        const slot = active[i];
        bandsOut.push({
          max_km: Number(slot.km),
          price_pence:
            slot.mode === "free" ? 0 : poundsToPence(slot.price_pounds),
          min_order_pence: poundsToPence(slot.min_order_pounds)
        });
      }

      const maxDeliveryKm = Number(active[active.length - 1].km);

      const zonePayload = {
        ...(zoneId ? { id: zoneId } : {}),
        free_radius_km: freeRadiusKm,
        free_postcodes: [],
        banded_pricing: bandsOut,
        // Listing-wide minimum order is no longer surfaced in the new UI
        // — per-zone mins live on each band. Keep the column at 0 to
        // avoid double-gating.
        min_order_pence: 0,
        max_delivery_km: maxDeliveryKm,
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
    if (!confirm("Remove all delivery zones? Customers will see 'message us for a quote' instead.")) return;
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
      setSlots(DEFAULT_SLOTS.map((s) => ({ ...s })));
      setMsg("Delivery zones removed.");
    } catch {
      setErr("Network error — try again.");
    }
  }

  // Auto-clear the "saved" toast after a few seconds.
  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => setMsg(null), 3200);
    return () => clearTimeout(t);
  }, [msg]);

  return (
    <div className="space-y-4 rounded-xl border border-brand-line bg-brand-surface p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h2 className="text-lg font-extrabold">Delivery Zones</h2>
          <p className="mt-1 text-[13px] text-brand-muted">
            Set up to 3 delivery zones from your yard. Each zone has its
            own delivery price — or set it to FREE.
          </p>
        </div>
      </div>

      {err && (
        <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-[13px] font-semibold text-red-300">
          {err}
        </p>
      )}
      {msg && (
        <p className="rounded-lg border border-brand-accent/40 bg-brand-accent/10 px-3 py-2 text-[13px] font-semibold text-brand-accent">
          {msg}
        </p>
      )}

      <ul className="space-y-3">
        {ZONE_META.map((meta) => {
          const slot = slots.find((s) => s.id === meta.id);
          if (!slot) return null;
          return (
            <li
              key={meta.id}
              className="rounded-xl border border-brand-line bg-brand-bg p-4"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div>
                  <p className="text-[13px] font-extrabold text-brand-text">
                    {meta.name} <span className="text-brand-accent">·</span>{" "}
                    <span className="text-brand-muted">{meta.sub}</span>
                  </p>
                  <p className="text-[13px] text-brand-muted">{meta.hint}</p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    patchSlot(meta.id, {
                      km: "",
                      mode: "priced",
                      price_pounds: "",
                      min_order_pounds: ""
                    })
                  }
                  className="text-[13px] font-bold text-brand-muted underline-offset-4 hover:text-brand-accent hover:underline"
                >
                  Clear
                </button>
              </div>

              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1 block text-[13px] font-bold uppercase tracking-widest text-brand-muted">
                    Up to (km from yard)
                  </span>
                  <input
                    type="number"
                    inputMode="decimal"
                    step="0.1"
                    min="0"
                    value={slot.km}
                    onChange={(e) =>
                      patchSlot(meta.id, { km: e.target.value })
                    }
                    placeholder={meta.id === 1 ? "5" : meta.id === 2 ? "15" : "30"}
                    className="block h-11 w-full rounded-md border border-brand-line bg-brand-surface px-3 text-[13px] text-brand-text outline-none focus:border-brand-accent"
                  />
                </label>

                <div className="block">
                  <span className="mb-1 block text-[13px] font-bold uppercase tracking-widest text-brand-muted">
                    Delivery price
                  </span>
                  <div className="grid grid-cols-2 gap-2">
                    <label
                      className={`flex h-11 cursor-pointer items-center justify-center gap-2 rounded-md border px-2 text-[13px] font-bold transition ${
                        slot.mode === "free"
                          ? "border-brand-accent bg-brand-accent/10 text-brand-accent"
                          : "border-brand-line bg-brand-surface text-brand-text hover:border-brand-accent/60"
                      }`}
                    >
                      <input
                        type="radio"
                        name={`zone-mode-${meta.id}`}
                        className="sr-only"
                        checked={slot.mode === "free"}
                        onChange={() =>
                          patchSlot(meta.id, { mode: "free", price_pounds: "" })
                        }
                      />
                      Free
                    </label>
                    <label
                      className={`flex h-11 cursor-pointer items-center justify-center gap-2 rounded-md border px-2 text-[13px] font-bold transition ${
                        slot.mode === "priced"
                          ? "border-brand-accent bg-brand-accent/10 text-brand-accent"
                          : "border-brand-line bg-brand-surface text-brand-text hover:border-brand-accent/60"
                      }`}
                    >
                      <input
                        type="radio"
                        name={`zone-mode-${meta.id}`}
                        className="sr-only"
                        checked={slot.mode === "priced"}
                        onChange={() => patchSlot(meta.id, { mode: "priced" })}
                      />
                      Set a price
                    </label>
                  </div>
                </div>
              </div>

              {slot.mode === "priced" && (
                <label className="mt-3 block">
                  <span className="mb-1 block text-[13px] font-bold uppercase tracking-widest text-brand-muted">
                    Delivery price (£)
                  </span>
                  <div className="flex items-center gap-1">
                    <span className="text-base font-bold text-brand-muted">£</span>
                    <input
                      type="number"
                      inputMode="decimal"
                      step="0.01"
                      min="0"
                      value={slot.price_pounds}
                      onChange={(e) =>
                        patchSlot(meta.id, { price_pounds: e.target.value })
                      }
                      placeholder="0.00"
                      className="block h-11 w-full rounded-md border border-brand-line bg-brand-surface px-3 text-[13px] text-brand-text outline-none focus:border-brand-accent"
                    />
                  </div>
                </label>
              )}

              <label className="mt-3 block">
                <span className="mb-1 block text-[13px] font-bold uppercase tracking-widest text-brand-muted">
                  Minimum order for this zone (£, optional)
                </span>
                <div className="flex items-center gap-1">
                  <span className="text-base font-bold text-brand-muted">£</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    min="0"
                    value={slot.min_order_pounds}
                    onChange={(e) =>
                      patchSlot(meta.id, { min_order_pounds: e.target.value })
                    }
                    placeholder="0.00"
                    className="block h-11 w-full rounded-md border border-brand-line bg-brand-surface px-3 text-[13px] text-brand-text outline-none focus:border-brand-accent"
                  />
                </div>
              </label>
            </li>
          );
        })}
      </ul>

      <p className="rounded-lg border border-brand-line bg-brand-bg px-3 py-2 text-[13px] text-brand-muted">
        Beyond your furthest zone: customers see &ldquo;Outside our
        delivery zones &mdash; message us for a custom quote&rdquo;.
      </p>

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
          className="inline-flex h-11 items-center rounded-lg bg-brand-accent px-5 text-[13px] font-bold text-black transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? "Saving…" : "Save delivery zones"}
        </button>
        {zoneId && (
          <button
            type="button"
            onClick={deleteZone}
            className="inline-flex h-11 items-center rounded-lg border border-red-500/40 bg-red-500/5 px-4 text-[13px] font-bold text-red-300 transition hover:bg-red-500/15"
          >
            Remove all zones
          </button>
        )}
      </div>
    </div>
  );
}

function labelFor(id: 1 | 2 | 3): string {
  return id === 1 ? "Zone 1" : id === 2 ? "Zone 2" : "Zone 3";
}
