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
import { TradeAreaMap, type DeliveryZone } from "@/components/trade-off/TradeAreaMap";

type ZoneVatMode = "inc" | "ex" | "pay_driver";

type ZoneSlot = {
  id: 1 | 2 | 3;
  // Empty string when the merchant has cleared the slot (= skip on save).
  km: string;
  // "free" | "priced" — "priced" requires price_pounds > 0.
  mode: "free" | "priced";
  price_pounds: string;
  min_order_pounds: string;
  /** Per-zone VAT treatment. "inc" = delivery price already includes VAT,
   *  "ex" = price is ex-VAT (cart adds VAT on top), "pay_driver" = customer
   *  pays the driver direct on delivery (no line on the cart). Defaults
   *  to "ex" — UK trade standard.
   *  NOTE: persistence pending a DB column; for now the value travels
   *  inside the banded_pricing JSON and is silently retained server-side. */
  vat_mode: ZoneVatMode;
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
  { id: 1, km: "5", mode: "free", price_pounds: "", min_order_pounds: "", vat_mode: "inc" },
  { id: 2, km: "15", mode: "priced", price_pounds: "15.00", min_order_pounds: "", vat_mode: "inc" },
  { id: 3, km: "30", mode: "priced", price_pounds: "40.00", min_order_pounds: "", vat_mode: "inc" }
];

function poundsToPence(input: string): number {
  const n = Number(input);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n * 100);
}

/** Read a per-band vat_mode from a stored banded_pricing row. The API
 *  currently doesn't have a typed column for this — for now we sniff
 *  whatever the API kept on the row (passed through as JSON). Defaults
 *  to "inc" — UK Price Marking Order 2004 requires consumer-facing
 *  prices to be VAT-inclusive, so the safer fallback is to assume the
 *  merchant has priced inc-VAT. */
function readVatMode(b: unknown): ZoneVatMode {
  if (b && typeof b === "object") {
    const v = (b as Record<string, unknown>).vat_mode;
    if (v === "inc" || v === "ex" || v === "pay_driver") return v;
  }
  return "inc";
}

const VAT_MODE_LABELS: Record<ZoneVatMode, string> = {
  inc: "Inc VAT",
  ex: "Ex VAT",
  pay_driver: "Pay driver"
};

const VAT_MODE_HINTS: Record<ZoneVatMode, string> = {
  inc: "Delivery price already includes VAT — cart shows the inc total. Safest for any merchant serving the public (UK Price Marking Order 2004).",
  ex: "Use only if your customers are all VAT-registered businesses — UK consumer law requires VAT-inclusive prices for retail. Cart will show ex + inc figures.",
  pay_driver:
    "Customer pays the driver direct on delivery — no delivery line on the cart. You still owe HMRC the VAT on the delivery fee."
};

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
      min_order_pounds: "",
      vat_mode: "inc"
    });
    for (let i = 0; i < Math.min(2, bands.length); i += 1) {
      const b = bands[i];
      slots.push({
        id: (slots.length + 1) as 1 | 2 | 3,
        km: String(b.max_km ?? ""),
        mode: "priced",
        price_pounds: penceToPounds(b.price_pence ?? 0),
        min_order_pounds: penceToPounds(b.min_order_pence ?? 0),
        vat_mode: readVatMode(b)
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
        min_order_pounds: penceToPounds(b.min_order_pence ?? 0),
        vat_mode: readVatMode(b)
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
      min_order_pounds: "",
      vat_mode: "inc"
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
  yardLat: yardLatInitial,
  yardLng: yardLngInitial,
  yardPostcode: yardPostcodeInitial,
  yardAddress,
  yardDistanceFudge,
  yardCurrency,
  yardPricesExVat,
  yardPickupFrom: yardPickupFromInitial,
  yardPickupTo: yardPickupToInitial,
  yardCity,
  merchantName,
  allowPickup,
  onAllowPickupChange
}: {
  slug: string;
  editToken: string;
  initialZone: HammerexXratedWholesaleZone | null;
  /** Saved yard coordinates — drives the live preview map at the top of
   *  the editor. Null until the merchant has saved a yard location. */
  yardLat: number | null;
  yardLng: number | null;
  yardPostcode: string;
  yardAddress: string;
  yardDistanceFudge: number;
  yardCurrency: string;
  yardPricesExVat: boolean;
  /** Saved pickup window — "HH:MM:SS" from Postgres TIME or null when
   *  the merchant confirms collection per order. */
  yardPickupFrom: string | null;
  yardPickupTo: string | null;
  yardCity: string;
  merchantName: string;
  /** Mirrors the listing-level wholesale_allow_pickup flag. Save happens
   *  inline below now that the YardOriginEditor section is removed. */
  allowPickup: boolean;
  onAllowPickupChange: (next: boolean) => void;
}) {
  // Inline location state — replaces the deleted YardOriginEditor.
  const [yardLat, setYardLat] = useState<number | null>(yardLatInitial);
  const [yardLng, setYardLng] = useState<number | null>(yardLngInitial);
  const [yardPostcode, setYardPostcode] = useState<string>(yardPostcodeInitial);
  const [yardMapsUrl, setYardMapsUrl] = useState<string>("");
  const [locating, setLocating] = useState(false);
  const [savingLocation, setSavingLocation] = useState(false);
  const [locationErr, setLocationErr] = useState<string | null>(null);
  const [locationMsg, setLocationMsg] = useState<string | null>(null);
  const hasYardCoords = yardLat !== null && yardLng !== null;

  // Pickup time window — persisted to wholesale_pickup_from /
  // wholesale_pickup_to. Postgres TIME comes back as "HH:MM:SS"; the
  // <input type="time"> expects "HH:MM" so we trim the seconds on hydrate.
  const [pickupFrom, setPickupFrom] = useState<string>(
    yardPickupFromInitial ? yardPickupFromInitial.slice(0, 5) : ""
  );
  const [pickupTo, setPickupTo] = useState<string>(
    yardPickupToInitial ? yardPickupToInitial.slice(0, 5) : ""
  );

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
    setLocationErr(null);
    setLocationMsg(null);
    const parsed = parseMapsUrl(url);
    if (!parsed) {
      setLocationErr(
        "Couldn't read coordinates from that URL. Use Google Maps → Share → Copy link, then paste the full long-form link here."
      );
      return;
    }
    setYardLat(parsed.lat);
    setYardLng(parsed.lng);
    setLocationMsg(
      `Pinned: ${parsed.lat.toFixed(5)}, ${parsed.lng.toFixed(5)} — tap "Save merchant location" to confirm.`
    );
  }

  async function locate() {
    setLocationErr(null);
    setLocationMsg(null);
    const pc = yardPostcode.trim();
    if (!pc) {
      setLocationErr("Enter a postcode first.");
      return;
    }
    setLocating(true);
    try {
      const res = await fetch(
        `/api/trade-off/postcode-lookup?postcode=${encodeURIComponent(pc)}`
      );
      const json = await res.json();
      if (!json.ok) {
        setLocationErr(
          json.error === "not_found"
            ? "Postcode not found in postcodes.io (UK only)."
            : json.error === "invalid"
              ? "That doesn't look like a valid UK postcode."
              : "Lookup failed — try again."
        );
        return;
      }
      if (typeof json.lat === "number") setYardLat(json.lat);
      if (typeof json.lng === "number") setYardLng(json.lng);
      if (typeof json.postcode === "string") setYardPostcode(json.postcode);
      setLocationMsg(
        `Located: ${json.town ?? "UK"} — tap "Save merchant location" to confirm.`
      );
    } catch {
      setLocationErr("Network error — try again.");
    } finally {
      setLocating(false);
    }
  }

  async function saveLocation() {
    setLocationErr(null);
    setLocationMsg(null);
    if (yardLat === null || yardLng === null) {
      setLocationErr("Set a location first (postcode or Google Maps URL).");
      return;
    }
    setSavingLocation(true);
    try {
      const res = await fetch("/api/trade-off/wholesale-origin/upsert", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          slug,
          edit_token: editToken,
          address: yardAddress,
          postcode: yardPostcode.trim(),
          lat: yardLat,
          lng: yardLng,
          distance_fudge: yardDistanceFudge,
          allow_pickup: allowPickup,
          currency: yardCurrency,
          prices_ex_vat: yardPricesExVat,
          pickup_from: pickupFrom,
          pickup_to: pickupTo
        })
      });
      const json = await res.json();
      if (!json.ok) {
        setLocationErr(json.error ?? "Save failed.");
        return;
      }
      setLocationMsg("Merchant location saved.");
    } catch {
      setLocationErr("Network error — try again.");
    } finally {
      setSavingLocation(false);
    }
  }

  useEffect(() => {
    if (!locationMsg) return;
    const t = setTimeout(() => setLocationMsg(null), 3200);
    return () => clearTimeout(t);
  }, [locationMsg]);
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

      // Map slots → free_radius_km + banded_pricing[]. Per-zone vat_mode
      // is included as an extra field on each band — the API's sanitiser
      // strips unknown keys today, so this travels round-trip silently
      // until the DB column lands. Tracking issue: per-zone VAT migration.
      let freeRadiusKm: number | null = null;
      const bandsOut: Array<{
        max_km: number;
        price_pence: number;
        min_order_pence: number;
        vat_mode?: ZoneVatMode;
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
          min_order_pence: poundsToPence(slot.min_order_pounds),
          vat_mode: slot.vat_mode
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

  // Convert the merchant's current (unsaved) zone slots into the
  // DeliveryZone shape TradeAreaMap consumes — so the live preview
  // redraws the moment a km value or price changes.
  const previewZones = useMemo<DeliveryZone[]>(() => {
    return activeSlots(slots).map((slot) => {
      const km = Number(slot.km);
      const priceLabel =
        slot.mode === "free"
          ? "FREE"
          : Number(slot.price_pounds) > 0
            ? `£${Number(slot.price_pounds).toFixed(2)}`
            : undefined;
      return { idx: slot.id, km, priceLabel };
    });
  }, [slots]);

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

      {/* Live preview + inline location setter — same TradeAreaMap
       *  component customers see on the public profile. Updates as the
       *  merchant edits zone km / prices below. */}
      <div className="rounded-xl border border-brand-line bg-brand-bg p-3">
        <p className="text-[10px] font-bold uppercase tracking-widest text-brand-accent">
          Live customer view — your storefront map
        </p>
        <p className="mt-1 text-[12px] text-brand-muted">
          This is exactly what your customers will see on your storefront.
          Adjust the zones below and the map updates in real time.
        </p>

        {/* Inline location setter (replaces the deleted YardOriginEditor).
         *  Three input paths: Google Maps URL paste, postcode → Set my
         *  location button, or a final "Save merchant location" submit. */}
        <div className="mt-3 space-y-3 rounded-md border border-brand-line bg-brand-surface p-3">
          {locationErr && (
            <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-[12px] font-semibold text-red-300">
              {locationErr}
            </p>
          )}
          {locationMsg && (
            <p className="rounded-lg border border-brand-accent/40 bg-brand-accent/10 px-3 py-2 text-[12px] font-semibold text-brand-accent">
              {locationMsg}
            </p>
          )}

          <label className="block">
            <span className="mb-1 block text-[11px] font-bold uppercase tracking-widest text-brand-muted">
              Google Maps location URL
            </span>
            <input
              type="url"
              inputMode="url"
              maxLength={600}
              value={yardMapsUrl}
              onChange={(e) => {
                const v = e.target.value;
                setYardMapsUrl(v);
                if (v.trim().length > 0) applyMapsUrl(v);
              }}
              placeholder="https://www.google.com/maps/@53.7457,-0.4042,15z"
              className="block h-11 w-full rounded-md border border-brand-line bg-brand-bg px-3 text-sm text-brand-text outline-none focus:border-brand-accent"
            />
          </label>

          <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
            <label className="block">
              <span className="mb-1 block text-[11px] font-bold uppercase tracking-widest text-brand-muted">
                Postcode (UK)
              </span>
              <input
                type="text"
                value={yardPostcode}
                maxLength={12}
                onChange={(e) => setYardPostcode(e.target.value.toUpperCase())}
                placeholder="e.g. HU3 4SA"
                className="block h-11 w-full rounded-md border border-brand-line bg-brand-bg px-3 text-sm font-bold uppercase tracking-widest text-brand-text outline-none focus:border-brand-accent"
              />
            </label>
            <div className="flex items-end">
              <button
                type="button"
                onClick={locate}
                disabled={locating || savingLocation}
                className="inline-flex h-11 items-center gap-2 rounded-lg px-4 text-xs font-bold text-white transition hover:opacity-90 disabled:opacity-60"
                style={{
                  background: hasYardCoords ? "#0F5132" : "#991B1B"
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
                {locating
                  ? "Locating…"
                  : hasYardCoords
                    ? "Location set — reset"
                    : "Set my location"}
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={saveLocation}
            disabled={savingLocation || !hasYardCoords}
            className="inline-flex h-11 items-center rounded-lg bg-brand-accent px-4 text-[13px] font-bold text-black transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {savingLocation ? "Saving…" : "Save merchant location"}
          </button>
        </div>

        <div className="mt-3 overflow-hidden rounded-md border border-brand-line bg-brand-surface">
          {hasYardCoords ? (
            <TradeAreaMap
              lat={yardLat}
              lng={yardLng}
              city={yardCity}
              servicePostcodes={[]}
              zones={previewZones.length > 0 ? previewZones : undefined}
              merchantName={merchantName}
              enableLocationPicker={false}
              height={320}
            />
          ) : (
            <div className="flex h-40 items-center justify-center px-4 text-center text-[13px] text-brand-muted">
              Set your merchant location above — the preview will draw
              around your yard pin.
            </div>
          )}
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
                          ? "text-white"
                          : "bg-transparent hover:opacity-90"
                      }`}
                      style={{
                        borderColor: "#0F5132",
                        background:
                          slot.mode === "free" ? "#0F5132" : "transparent",
                        color: slot.mode === "free" ? "#fff" : "#0F5132"
                      }}
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
                          ? "border-brand-accent bg-brand-accent text-black"
                          : "border-brand-accent bg-transparent text-brand-accent hover:bg-brand-accent/10"
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

              {/* Per-zone VAT treatment — 3 options. Survives in the
               *  band's JSON; full DB column + cart-side honouring is a
               *  follow-up migration. */}
              <div className="mt-3">
                <span className="mb-1 block text-[13px] font-bold uppercase tracking-widest text-brand-muted">
                  VAT on delivery price
                </span>
                <div className="grid grid-cols-3 gap-2">
                  {(["inc", "ex", "pay_driver"] as ZoneVatMode[]).map((mode) => (
                    <label
                      key={mode}
                      className={`flex h-11 cursor-pointer items-center justify-center gap-2 rounded-md border px-2 text-[13px] font-bold transition ${
                        slot.vat_mode === mode
                          ? "border-brand-accent bg-brand-accent text-black"
                          : "border-brand-line bg-brand-surface text-brand-text hover:border-brand-accent/60"
                      }`}
                    >
                      <input
                        type="radio"
                        name={`zone-vat-${meta.id}`}
                        className="sr-only"
                        checked={slot.vat_mode === mode}
                        onChange={() => patchSlot(meta.id, { vat_mode: mode })}
                      />
                      {VAT_MODE_LABELS[mode]}
                    </label>
                  ))}
                </div>
                <p className="mt-1 text-[11px] text-brand-muted">
                  {VAT_MODE_HINTS[slot.vat_mode]}
                </p>
              </div>
            </li>
          );
        })}
      </ul>

      <p className="rounded-lg border border-brand-line bg-brand-bg px-3 py-2 text-[13px] text-brand-muted">
        Beyond your furthest zone: customers see &ldquo;Outside our
        delivery zones &mdash; message us for a custom quote&rdquo;.
      </p>

      {/* Allow Click & Collect — pickup option with optional time window.
       *  Pickup hours are held in state for now; persistence pending
       *  wholesale_pickup_from / wholesale_pickup_to DB columns. */}
      <div className="rounded-md border border-brand-line bg-brand-bg p-3">
        <label className="flex items-center gap-3">
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

        {allowPickup && (
          <>
            <p className="mt-2 text-[12px] text-brand-muted">
              Set the daily window when customers can collect their order
              from your yard. We show this on the cart so they know when
              to turn up — e.g. <span className="font-bold text-brand-text">08:00</span> to{" "}
              <span className="font-bold text-brand-text">17:00</span>. Leave blank if you'll
              confirm a pick-up time per order over WhatsApp.
            </p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-[11px] font-bold uppercase tracking-widest text-brand-muted">
                  Suitable pick-up from
                </span>
                <input
                  type="time"
                  value={pickupFrom}
                  onChange={(e) => setPickupFrom(e.target.value)}
                  className="block h-11 w-full rounded-md border border-brand-line bg-brand-surface px-3 text-sm text-brand-text outline-none focus:border-brand-accent"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-[11px] font-bold uppercase tracking-widest text-brand-muted">
                  Suitable pick-up to
                </span>
                <input
                  type="time"
                  value={pickupTo}
                  onChange={(e) => setPickupTo(e.target.value)}
                  className="block h-11 w-full rounded-md border border-brand-line bg-brand-surface px-3 text-sm text-brand-text outline-none focus:border-brand-accent"
                />
              </label>
            </div>
          </>
        )}
      </div>

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
