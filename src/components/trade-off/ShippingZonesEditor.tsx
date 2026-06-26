"use client";

// ShippingZonesEditor — per-country air/sea pricing for the Shop Mode
// add-on. Adds, edits, and deletes zones via /api/trade-off/shipping-zones/*.

import { useMemo, useState } from "react";
import type { HammerexXratedShippingZone } from "@/lib/supabase";

type Mode = "list" | "create" | { kind: "edit"; zone: HammerexXratedShippingZone };

type FormState = {
  id: string;
  country_code: string;
  country_name: string;
  air_pounds: string;
  sea_pounds: string;
  eta_min: string;
  eta_max: string;
  sort_order: string;
};

const EMPTY_FORM: FormState = {
  id: "",
  country_code: "",
  country_name: "",
  air_pounds: "",
  sea_pounds: "",
  eta_min: "",
  eta_max: "",
  sort_order: "0"
};

// Curated short-list of common destinations. Tradies can also free-type
// any 2-letter ISO code via "Other country" — the API enforces /^[A-Z]{2}$/.
const COMMON_COUNTRIES: { code: string; name: string }[] = [
  { code: "GB", name: "United Kingdom" },
  { code: "US", name: "United States" },
  { code: "AU", name: "Australia" },
  { code: "CA", name: "Canada" },
  { code: "IE", name: "Ireland" },
  { code: "DE", name: "Germany" },
  { code: "FR", name: "France" },
  { code: "NL", name: "Netherlands" },
  { code: "ES", name: "Spain" },
  { code: "IT", name: "Italy" },
  { code: "AE", name: "United Arab Emirates" },
  { code: "SA", name: "Saudi Arabia" },
  { code: "ID", name: "Indonesia" },
  { code: "MY", name: "Malaysia" },
  { code: "SG", name: "Singapore" },
  { code: "NZ", name: "New Zealand" },
  { code: "JP", name: "Japan" },
  { code: "IN", name: "India" },
  { code: "ZA", name: "South Africa" },
  { code: "NG", name: "Nigeria" },
  { code: "KE", name: "Kenya" },
  { code: "BR", name: "Brazil" },
  { code: "MX", name: "Mexico" },
  { code: "NO", name: "Norway" },
  { code: "SE", name: "Sweden" },
  { code: "DK", name: "Denmark" },
  { code: "CH", name: "Switzerland" },
  { code: "BE", name: "Belgium" },
  { code: "PT", name: "Portugal" },
  { code: "PL", name: "Poland" }
];

function poundsToPenceOrNull(input: string): number | null {
  const t = input.trim();
  if (t.length === 0) return null;
  const n = Number(t);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
}

function penceToPoundsOrEmpty(p: number | null): string {
  if (p === null || p === undefined || !Number.isFinite(p)) return "";
  return (p / 100).toFixed(2);
}

function zoneToForm(z: HammerexXratedShippingZone): FormState {
  return {
    id: z.id,
    country_code: z.country_code ?? "",
    country_name: z.country_name ?? "",
    air_pounds: penceToPoundsOrEmpty(z.air_price_pence),
    sea_pounds: penceToPoundsOrEmpty(z.sea_price_pence),
    eta_min:
      z.eta_min_days === null || z.eta_min_days === undefined
        ? ""
        : String(z.eta_min_days),
    eta_max:
      z.eta_max_days === null || z.eta_max_days === undefined
        ? ""
        : String(z.eta_max_days),
    sort_order: typeof z.sort_order === "number" ? String(z.sort_order) : "0"
  };
}

export function ShippingZonesEditor({
  slug,
  editToken,
  initialZones
}: {
  slug: string;
  editToken: string;
  initialZones: HammerexXratedShippingZone[];
}) {
  const [zones, setZones] = useState<HammerexXratedShippingZone[]>(initialZones);
  const [mode, setMode] = useState<Mode>("list");
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const usedCodes = useMemo(
    () => new Set(zones.map((z) => z.country_code)),
    [zones]
  );

  function startCreate() {
    setForm({ ...EMPTY_FORM, sort_order: String(zones.length) });
    setErr(null);
    setMode("create");
  }
  function startEdit(z: HammerexXratedShippingZone) {
    setForm(zoneToForm(z));
    setErr(null);
    setMode({ kind: "edit", zone: z });
  }
  function cancel() {
    setForm(EMPTY_FORM);
    setErr(null);
    setMode("list");
  }
  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function pickCountry(code: string, name: string) {
    setForm((f) => ({ ...f, country_code: code, country_name: name }));
  }

  async function submit() {
    setErr(null);
    const cc = form.country_code.trim().toUpperCase();
    if (!/^[A-Z]{2}$/.test(cc)) {
      setErr("Country code must be 2 letters (e.g. GB, US).");
      return;
    }
    if (!form.country_name.trim()) {
      setErr("Country name is required.");
      return;
    }
    setSubmitting(true);
    try {
      const air = poundsToPenceOrNull(form.air_pounds);
      const sea = poundsToPenceOrNull(form.sea_pounds);
      const etaMin = form.eta_min.trim().length === 0 ? null : Number(form.eta_min);
      const etaMax = form.eta_max.trim().length === 0 ? null : Number(form.eta_max);
      const sortN = Number(form.sort_order);
      const zone = {
        ...(form.id ? { id: form.id } : {}),
        country_code: cc,
        country_name: form.country_name.trim().slice(0, 80),
        air_price_pence: air,
        sea_price_pence: sea,
        eta_min_days:
          etaMin === null || !Number.isFinite(etaMin) || etaMin < 0
            ? null
            : Math.round(etaMin),
        eta_max_days:
          etaMax === null || !Number.isFinite(etaMax) || etaMax < 0
            ? null
            : Math.round(etaMax),
        sort_order: Number.isFinite(sortN) && sortN >= 0 ? Math.round(sortN) : 0
      };
      const res = await fetch("/api/trade-off/shipping-zones/upsert", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ slug, edit_token: editToken, zone })
      });
      const json = await res.json();
      if (!json.ok) {
        setErr(json.error ?? "Save failed.");
        return;
      }
      const saved = json.zone as HammerexXratedShippingZone;
      setZones((prev) => {
        const idx = prev.findIndex((z) => z.id === saved.id);
        if (idx === -1) return [...prev, saved];
        const next = [...prev];
        next[idx] = saved;
        return next;
      });
      setForm(EMPTY_FORM);
      setMode("list");
    } catch {
      setErr("Network error — try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function remove(z: HammerexXratedShippingZone) {
    if (!confirm(`Remove ${z.country_name} from your shipping list?`)) return;
    setErr(null);
    try {
      const res = await fetch("/api/trade-off/shipping-zones/delete", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ slug, edit_token: editToken, zone_id: z.id })
      });
      const json = await res.json();
      if (!json.ok) {
        setErr(json.error ?? "Delete failed.");
        return;
      }
      setZones((prev) => prev.filter((x) => x.id !== z.id));
    } catch {
      setErr("Network error — try again.");
    }
  }

  return (
    <div className="space-y-4 rounded-xl border border-brand-line bg-brand-surface p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h2 className="text-lg font-extrabold">Shipping zones</h2>
          <p className="mt-1 text-xs text-brand-muted">
            Set air and sea prices per country. Leave a column blank if you
            don&rsquo;t ship by that route.
          </p>
        </div>
        {mode === "list" && (
          <button
            type="button"
            onClick={startCreate}
            className="inline-flex h-11 items-center rounded-lg bg-brand-accent px-4 text-xs font-bold text-black transition hover:opacity-90"
          >
            + Add country
          </button>
        )}
      </div>

      {err && (
        <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-300">
          {err}
        </p>
      )}

      {mode === "list" ? (
        zones.length === 0 ? (
          <p className="rounded-lg border border-dashed border-brand-line bg-brand-bg px-4 py-6 text-center text-xs text-brand-muted">
            No countries yet. Add at least one so customers know where you ship.
          </p>
        ) : (
          <ul className="space-y-2">
            {zones.map((z) => (
              <li
                key={z.id}
                className="flex flex-wrap items-center gap-3 rounded-lg border border-brand-line bg-brand-bg p-3"
              >
                <span className="inline-flex h-9 items-center rounded-md border border-brand-accent/40 bg-brand-accent/10 px-2 text-xs font-extrabold uppercase tracking-widest text-brand-accent">
                  {z.country_code}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-brand-text">
                    {z.country_name}
                  </p>
                  <p className="text-xs text-brand-muted">
                    Air:{" "}
                    {z.air_price_pence === null
                      ? "—"
                      : `£${penceToPoundsOrEmpty(z.air_price_pence)}`}{" "}
                    · Sea:{" "}
                    {z.sea_price_pence === null
                      ? "—"
                      : `£${penceToPoundsOrEmpty(z.sea_price_pence)}`}
                    {z.eta_min_days !== null && z.eta_max_days !== null
                      ? ` · ${z.eta_min_days}-${z.eta_max_days} days`
                      : ""}
                  </p>
                </div>
                <div className="flex w-full gap-2 sm:w-auto">
                  <button
                    type="button"
                    onClick={() => startEdit(z)}
                    className="inline-flex h-11 flex-1 items-center justify-center rounded-lg border border-brand-line bg-brand-surface px-3 text-xs font-bold text-brand-text transition hover:border-brand-accent hover:text-brand-accent sm:flex-none"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(z)}
                    className="inline-flex h-11 flex-1 items-center justify-center rounded-lg border border-red-500/40 bg-red-500/5 px-3 text-xs font-bold text-red-300 transition hover:bg-red-500/15 sm:flex-none"
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )
      ) : (
        <ZoneForm
          form={form}
          update={update}
          onPickCountry={pickCountry}
          usedCodes={usedCodes}
          submitting={submitting}
          onCancel={cancel}
          onSubmit={submit}
          mode={mode === "create" ? "create" : "edit"}
        />
      )}
    </div>
  );
}

function ZoneForm({
  form,
  update,
  onPickCountry,
  usedCodes,
  submitting,
  onCancel,
  onSubmit,
  mode
}: {
  form: FormState;
  update: <K extends keyof FormState>(key: K, value: FormState[K]) => void;
  onPickCountry: (code: string, name: string) => void;
  usedCodes: Set<string>;
  submitting: boolean;
  onCancel: () => void;
  onSubmit: () => void;
  mode: "create" | "edit";
}) {
  return (
    <div className="space-y-4 rounded-lg border border-brand-line bg-brand-bg p-4">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-sm font-extrabold uppercase tracking-widest text-brand-accent">
          {mode === "create" ? "New shipping zone" : "Edit shipping zone"}
        </h3>
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex h-9 items-center rounded-md px-2 text-xs font-bold text-brand-muted transition hover:text-brand-text"
        >
          Cancel
        </button>
      </div>

      {mode === "create" && (
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-widest text-brand-muted">
            Pick a country
          </p>
          <div className="flex flex-wrap gap-2">
            {COMMON_COUNTRIES.map((c) => {
              const taken = usedCodes.has(c.code);
              const picked = form.country_code === c.code;
              return (
                <button
                  key={c.code}
                  type="button"
                  disabled={taken && !picked}
                  onClick={() => onPickCountry(c.code, c.name)}
                  className={`inline-flex h-11 items-center rounded-full border px-3 text-xs font-bold transition ${
                    picked
                      ? "border-brand-accent bg-brand-accent/15 text-brand-accent"
                      : taken
                        ? "border-brand-line bg-brand-surface text-brand-muted opacity-60"
                        : "border-brand-line bg-brand-bg text-brand-text hover:border-brand-accent hover:text-brand-accent"
                  }`}
                >
                  {c.code} · {c.name}
                  {taken && !picked ? " (added)" : ""}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Country code (ISO 2)">
          <input
            type="text"
            value={form.country_code}
            maxLength={2}
            onChange={(e) =>
              update("country_code", e.target.value.toUpperCase().slice(0, 2))
            }
            placeholder="GB"
            className="block h-11 w-full rounded-md border border-brand-line bg-brand-surface px-3 text-sm font-bold uppercase tracking-widest text-brand-text outline-none focus:border-brand-accent"
          />
        </Field>
        <Field label="Country name">
          <input
            type="text"
            value={form.country_name}
            maxLength={80}
            onChange={(e) => update("country_name", e.target.value)}
            placeholder="United Kingdom"
            className="block h-11 w-full rounded-md border border-brand-line bg-brand-surface px-3 text-sm text-brand-text outline-none focus:border-brand-accent"
          />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Air £ (blank = no air option)">
          <div className="flex items-center gap-1">
            <span className="text-base font-bold text-brand-muted">£</span>
            <input
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              value={form.air_pounds}
              onChange={(e) => update("air_pounds", e.target.value)}
              placeholder="—"
              className="block h-11 w-full rounded-md border border-brand-line bg-brand-surface px-3 text-sm text-brand-text outline-none focus:border-brand-accent"
            />
          </div>
        </Field>
        <Field label="Sea £ (blank = no sea option)">
          <div className="flex items-center gap-1">
            <span className="text-base font-bold text-brand-muted">£</span>
            <input
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              value={form.sea_pounds}
              onChange={(e) => update("sea_pounds", e.target.value)}
              placeholder="—"
              className="block h-11 w-full rounded-md border border-brand-line bg-brand-surface px-3 text-sm text-brand-text outline-none focus:border-brand-accent"
            />
          </div>
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="ETA min days">
          <input
            type="number"
            inputMode="numeric"
            min="0"
            value={form.eta_min}
            onChange={(e) => update("eta_min", e.target.value)}
            placeholder="e.g. 3"
            className="block h-11 w-full rounded-md border border-brand-line bg-brand-surface px-3 text-sm text-brand-text outline-none focus:border-brand-accent"
          />
        </Field>
        <Field label="ETA max days">
          <input
            type="number"
            inputMode="numeric"
            min="0"
            value={form.eta_max}
            onChange={(e) => update("eta_max", e.target.value)}
            placeholder="e.g. 7"
            className="block h-11 w-full rounded-md border border-brand-line bg-brand-surface px-3 text-sm text-brand-text outline-none focus:border-brand-accent"
          />
        </Field>
      </div>

      <Field label="Sort order">
        <input
          type="number"
          inputMode="numeric"
          min="0"
          value={form.sort_order}
          onChange={(e) => update("sort_order", e.target.value)}
          className="block h-11 w-full rounded-md border border-brand-line bg-brand-surface px-3 text-sm text-brand-text outline-none focus:border-brand-accent"
        />
      </Field>

      <div className="flex flex-wrap gap-2 pt-2">
        <button
          type="button"
          onClick={onSubmit}
          disabled={submitting}
          className="inline-flex h-11 items-center rounded-lg bg-brand-accent px-5 text-xs font-bold text-black transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? "Saving…" : mode === "create" ? "Add zone" : "Save changes"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex h-11 items-center rounded-lg border border-brand-line bg-brand-bg px-4 text-xs font-bold text-brand-text transition hover:border-brand-accent hover:text-brand-accent"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function Field({
  label,
  children
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-bold uppercase tracking-widest text-brand-muted">
        {label}
      </span>
      {children}
    </label>
  );
}
