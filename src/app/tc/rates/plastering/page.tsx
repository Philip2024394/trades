// /tc/rates/plastering — the one-page plastering rates surface.
//
// Trade sees:
//   1. Facts panel — sourced references (ONS, CITB, material coverage)
//   2. Their own rate per catalog service (editable, saved locally)
//   3. Platform network median for that service (when aggregate exists)
//   4. Add-ons section — same structure
//   5. Custom services — trade adds their own name + rate
//
// Evidence-or-silence rule applies:
//   • Facts panel — every fact has a clickable source URL
//   • Platform median — only shown when the aggregate meets the
//     3+/3-month/<15% stdev rule; otherwise "no data yet"
//   • ONS baseline — link to raw dataset; no synthesised numbers
//   • Trade's own rate — evidence provided by the trade themselves
//     (they own the number)
//
// "Additional may apply" notice mandatory on every rate the trade
// exposes publicly. Buyer never surprised by extras.

"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Save,
  Plus,
  Info,
  ExternalLink,
  ShieldCheck,
  BookOpen,
  Trash2,
  Sparkles,
  TrendingUp
} from "lucide-react";
import { TradeCenterHeader } from "@/apps/tradecenter/components/TradeCenterHeader";
import {
  PLASTERING_SERVICES,
  PLASTERING_CATEGORIES,
  PLASTERING_ADDONS,
  PLASTERING_FACTS,
  loadSavedMenu,
  saveMenu,
  type RateUnit,
  type PlasteringService,
  type PlasteringAddOn,
  type CustomRate,
  type SavedPlasteringMenu
} from "@/lib/rates/plasteringCatalog";
import { NUTS1_REGIONS } from "@/lib/rates/taxonomy";
import { currentViewerTrade } from "@/apps/identity/data/tradeIdentities";

type NetworkMedian = {
  gbpMedian: number;
  gbpP25: number;
  gbpP75: number;
  sampleSize: number;
  contributorCount: number;
  scope: "city" | "region";
};

const UNIT_LABEL: Record<RateUnit, string> = {
  "sqm":           "£ / sqm",
  "linear-metre":  "£ / linear metre",
  "each":          "£ / each",
  "per-job":       "£ / job",
  "per-hour":      "£ / hour",
  "per-day":       "£ / day",
  "percent":       "%"
};

export default function PlasteringRatesPage() {
  const viewer = currentViewerTrade();
  const tradeId = viewer.slug;

  const [rates, setRates]     = useState<Record<string, number>>({});
  const [addOnRates, setAddOnRates] = useState<Record<string, number>>({});
  const [custom, setCustom]   = useState<CustomRate[]>([]);
  const [saved, setSaved]     = useState(false);
  const [loaded, setLoaded]   = useState(false);
  const [regionCode, setRegionCode] = useState<string>("UKD"); // default North West
  const [networkMedians, setNetworkMedians] = useState<Record<string, NetworkMedian>>({});

  // Load on mount — try server first, fall back to localStorage.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/rates/menu?discipline=plastering", { cache: "no-store" });
        if (res.ok) {
          const json = await res.json();
          if (cancelled) return;
          const entries = Array.isArray(json.entries) ? json.entries : [];
          const serviceRates: Record<string, number> = {};
          const addOnRatesLoaded: Record<string, number> = {};
          for (const e of entries as Array<{ serviceSlug: string; gbpAmount: number }>) {
            if (PLASTERING_ADDONS.some((a) => a.slug === e.serviceSlug)) {
              addOnRatesLoaded[e.serviceSlug] = e.gbpAmount;
            } else {
              serviceRates[e.serviceSlug] = e.gbpAmount;
            }
          }
          if (Object.keys(serviceRates).length > 0 || Object.keys(addOnRatesLoaded).length > 0) {
            setRates(serviceRates);
            setAddOnRates(addOnRatesLoaded);
            setLoaded(true);
            return;
          }
        }
      } catch {
        /* fall through to localStorage */
      }
      const stored = loadSavedMenu(tradeId);
      if (stored && !cancelled) {
        setRates(Object.fromEntries(stored.services.map((s) => [s.slug, s.gbpAmount])));
        setAddOnRates(Object.fromEntries(stored.addons.map((s) => [s.slug, s.gbpAmount])));
        setCustom(stored.custom ?? []);
      }
      if (!cancelled) setLoaded(true);
    })();
    return () => { cancelled = true; };
  }, [tradeId]);

  // Fetch network medians per service in a batch.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const slugs = PLASTERING_SERVICES.map((s) => s.slug);
        const res = await fetch(
          `/api/rates/market?trade=plastering&region=${encodeURIComponent(regionCode)}&services=${encodeURIComponent(slugs.join(","))}`,
          { cache: "no-store" }
        );
        if (!res.ok) return;
        const json = await res.json();
        if (cancelled) return;
        setNetworkMedians(json.medians ?? {});
      } catch {
        /* silent — honest empty state per row */
      }
    })();
    return () => { cancelled = true; };
  }, [regionCode]);

  function updateRate(slug: string, value: string) {
    const n = Number(value);
    if (!Number.isFinite(n) || n <= 0) {
      const copy = { ...rates };
      delete copy[slug];
      setRates(copy);
      return;
    }
    setRates({ ...rates, [slug]: n });
  }

  function updateAddOn(slug: string, value: string) {
    const n = Number(value);
    if (!Number.isFinite(n) || n <= 0) {
      const copy = { ...addOnRates };
      delete copy[slug];
      setAddOnRates(copy);
      return;
    }
    setAddOnRates({ ...addOnRates, [slug]: n });
  }

  async function persist() {
    // Persist to localStorage as offline fallback.
    const menu: SavedPlasteringMenu = {
      services: Object.entries(rates).map(([slug, gbpAmount]) => ({ slug, gbpAmount })),
      addons:   Object.entries(addOnRates).map(([slug, gbpAmount]) => ({ slug, gbpAmount })),
      custom,
      updatedAt: new Date().toISOString()
    };
    saveMenu(tradeId, menu);

    // Persist to server so it counts in the network aggregation.
    const entries: Array<{ serviceSlug: string; rateType: string; gbpAmount: number }> = [];
    for (const [slug, gbpAmount] of Object.entries(rates)) {
      const s = PLASTERING_SERVICES.find((x) => x.slug === slug);
      if (s) entries.push({ serviceSlug: slug, rateType: s.unit, gbpAmount });
    }
    for (const [slug, gbpAmount] of Object.entries(addOnRates)) {
      const a = PLASTERING_ADDONS.find((x) => x.slug === slug);
      if (a) entries.push({ serviceSlug: slug, rateType: a.unit, gbpAmount });
    }
    try {
      await fetch("/api/rates/menu", {
        method:  "PUT",
        headers: { "content-type": "application/json" },
        body:    JSON.stringify({
          discipline: "plastering",
          regionCode,
          entries
        })
      });
    } catch {
      /* offline — localStorage already saved */
    }
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2500);
  }

  const filledServiceCount = Object.keys(rates).length;
  const totalServiceCount = PLASTERING_SERVICES.length;
  const completeness = totalServiceCount === 0
    ? 0
    : Math.round((filledServiceCount / totalServiceCount) * 100);

  return (
    <div className="flex min-h-screen flex-col bg-[#FBF6EC]">
      <TradeCenterHeader activeCategorySlug={null}/>
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-6 md:px-6 md:py-8">
        {/* Nav pills */}
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/tc/rates"
            className="inline-flex h-9 items-center gap-1.5 rounded-full border bg-white px-3 text-[11px] font-black uppercase tracking-wider text-neutral-800 shadow-sm transition hover:bg-neutral-50"
            style={{ borderColor: "rgba(139,69,19,0.15)" }}
          >
            <ArrowLeft size={12}/>
            Back to my rate card
          </Link>
          <Link
            href="/tc/rates/network?trade=plastering"
            className="inline-flex h-9 items-center gap-1.5 rounded-full border bg-white px-3 text-[11px] font-bold text-neutral-700 shadow-sm transition hover:bg-neutral-50"
            style={{ borderColor: "rgba(139,69,19,0.15)" }}
          >
            <TrendingUp size={12}/>
            Network rates
          </Link>
        </div>

        {/* Header */}
        <header>
          <div className="text-[10px] font-black uppercase tracking-[0.15em] text-neutral-500">
            Trade Center · Plastering rates
          </div>
          <h1 className="mt-1 text-[22px] font-black leading-tight text-neutral-900 md:text-[28px]">
            Plastering — your service menu
          </h1>
          <p className="mt-1 max-w-3xl text-[12px] leading-snug text-neutral-600 md:text-[13px]">
            Fill in your rate for the services you offer. Empty fields = you don&apos;t offer that service — honest silence. Filled fields feed the verified market benchmarks that help every plasterer on the network price fairly. Add your own services at the bottom if the catalog is missing something.
          </p>
        </header>

        {/* Completeness meter */}
        <section
          className="rounded-2xl border p-4 shadow-sm"
          style={{ backgroundColor: "#FEF3C7", borderColor: "rgba(255,179,0,0.4)" }}
        >
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div className="text-[10px] font-black uppercase tracking-[0.15em] text-neutral-700">
              Menu completeness
            </div>
            <div className="text-[11px] text-neutral-600">
              {filledServiceCount} of {totalServiceCount} services · {custom.length} custom · {Object.keys(addOnRates).length} add-ons
            </div>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full" style={{ backgroundColor: "rgba(139,69,19,0.12)" }}>
            <div
              className="h-full transition-all"
              style={{ width: `${completeness}%`, backgroundColor: "#166534" }}
            />
          </div>
        </section>

        {/* Facts panel */}
        <FactsPanel/>

        {/* Region picker — determines which network median we compare
            the trade's own rate against. */}
        <section
          className="flex flex-wrap items-center gap-3 rounded-2xl border bg-white p-4 shadow-sm"
          style={{ borderColor: "rgba(139,69,19,0.15)" }}
        >
          <label className="flex items-center gap-2 text-[11px] font-bold text-neutral-700">
            <span>Compare against network in:</span>
            <select
              value={regionCode}
              onChange={(e) => setRegionCode(e.target.value)}
              className="min-h-[36px] rounded-md border bg-white px-3 text-[12px] text-neutral-900"
              style={{ borderColor: "rgba(139,69,19,0.18)" }}
            >
              {NUTS1_REGIONS.map((r) => (
                <option key={r.code} value={r.code}>{r.label}</option>
              ))}
            </select>
          </label>
          <div className="text-[10.5px] text-neutral-500">
            Median rates below reflect verified plasterers in the selected region.
          </div>
        </section>

        {/* Services by category */}
        {loaded && PLASTERING_CATEGORIES.map((cat) => {
          const services = PLASTERING_SERVICES.filter((s) => s.category === cat.slug);
          if (services.length === 0) return null;
          return (
            <ServiceCategory
              key={cat.slug}
              title={cat.label}
              services={services}
              rates={rates}
              networkMedians={networkMedians}
              onChange={updateRate}
            />
          );
        })}

        {/* Add-ons */}
        <AddOnsSection
          addons={PLASTERING_ADDONS}
          rates={addOnRates}
          onChange={updateAddOn}
        />

        {/* Custom rates */}
        <CustomRatesSection
          custom={custom}
          onChange={setCustom}
        />

        {/* Mandatory "additional may apply" reminder */}
        <TransparencyNotice/>

        {/* Save bar */}
        <div className="sticky bottom-4 z-20 flex items-center justify-end gap-2">
          {saved && (
            <span className="rounded-full bg-neutral-900 px-3 py-1.5 text-[11px] font-black uppercase tracking-wider text-white shadow-lg">
              Saved
            </span>
          )}
          <button
            type="button"
            onClick={persist}
            className="inline-flex h-11 items-center gap-2 rounded-full px-5 text-[12px] font-black uppercase tracking-wider text-white shadow-lg transition hover:brightness-105"
            style={{ backgroundColor: "#166534" }}
          >
            <Save size={14}/>
            Save my menu
          </button>
        </div>
      </main>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────

function FactsPanel() {
  return (
    <section
      className="rounded-2xl border bg-white p-5 shadow-sm"
      style={{ borderColor: "rgba(139,69,19,0.15)" }}
    >
      <div className="mb-3 flex items-center gap-2">
        <BookOpen size={14} className="text-neutral-700"/>
        <div className="text-[10px] font-black uppercase tracking-[0.15em] text-neutral-600">
          Facts + sources for plastering
        </div>
      </div>
      <ul className="flex flex-col gap-2">
        {PLASTERING_FACTS.map((fact) => (
          <li
            key={fact.label}
            className="flex items-start gap-3 rounded-lg border p-3"
            style={{ borderColor: "rgba(139,69,19,0.10)" }}
          >
            <Info size={14} className="mt-0.5 flex-shrink-0 text-neutral-500"/>
            <div className="min-w-0 flex-1">
              <div className="text-[11px] font-black uppercase tracking-wider text-neutral-500">
                {fact.label}
              </div>
              <div className="mt-0.5 text-[12.5px] font-bold text-neutral-900">
                {fact.value}
              </div>
              <a
                href={fact.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 inline-flex items-center gap-1 text-[10.5px] font-black uppercase tracking-wider text-neutral-600 hover:underline"
              >
                <ExternalLink size={10}/>
                {fact.source}
              </a>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function ServiceCategory({
  title,
  services,
  rates,
  networkMedians,
  onChange
}: {
  title: string;
  services: PlasteringService[];
  rates: Record<string, number>;
  networkMedians: Record<string, NetworkMedian>;
  onChange: (slug: string, value: string) => void;
}) {
  return (
    <section>
      <div className="mb-3 flex items-center gap-2">
        <div className="text-[10px] font-black uppercase tracking-[0.15em] text-neutral-500">
          {title}
        </div>
      </div>
      <div className="flex flex-col gap-2">
        {services.map((s) => (
          <ServiceRow
            key={s.slug}
            service={s}
            value={rates[s.slug] ?? ""}
            networkMedian={networkMedians[s.slug]}
            onChange={onChange}
          />
        ))}
      </div>
    </section>
  );
}

function ServiceRow({
  service,
  value,
  networkMedian,
  onChange
}: {
  service: PlasteringService;
  value: number | "";
  networkMedian?: NetworkMedian;
  onChange: (slug: string, value: string) => void;
}) {
  return (
    <div
      className="grid gap-3 rounded-2xl border bg-white p-4 shadow-sm md:grid-cols-[minmax(0,1fr)_180px_180px]"
      style={{ borderColor: "rgba(139,69,19,0.15)" }}
    >
      <div className="min-w-0">
        <div className="text-[13px] font-black leading-tight text-neutral-900">
          {service.label}
        </div>
        <p className="mt-1 text-[11.5px] leading-snug text-neutral-600">
          {service.description}
        </p>
        <div className="mt-2 grid grid-cols-1 gap-1 text-[11px] leading-snug sm:grid-cols-2">
          <div>
            <span className="font-black text-neutral-700">Included:</span>
            <span className="ml-1 text-neutral-600">{service.included}</span>
          </div>
          <div>
            <span className="font-black text-neutral-700">Not included:</span>
            <span className="ml-1 text-neutral-600">{service.excluded}</span>
          </div>
        </div>
        {service.factsBlurb && (
          <div className="mt-2 flex items-start gap-1.5 rounded-md p-2 text-[10.5px] leading-snug text-neutral-700" style={{ backgroundColor: "#F5F0E4" }}>
            <Sparkles size={11} className="mt-0.5 flex-shrink-0" style={{ color: "#B45309" }}/>
            <span>{service.factsBlurb}</span>
          </div>
        )}
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-[10px] font-black uppercase tracking-wider text-neutral-600">
          Your rate ({UNIT_LABEL[service.unit]})
        </label>
        <input
          type="number"
          step="0.01"
          min="0"
          value={value}
          onChange={(e) => onChange(service.slug, e.target.value)}
          placeholder="—"
          className="min-h-[42px] w-full rounded-md border bg-white px-3 text-[13px] font-black text-neutral-900"
          style={{ borderColor: "rgba(139,69,19,0.18)" }}
        />
        <div className="text-[9.5px] text-neutral-500">
          Empty = not offered
        </div>
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-[10px] font-black uppercase tracking-wider text-neutral-600">
          Network median
        </label>
        {networkMedian ? (
          <div className="min-h-[42px] rounded-md border border-dashed p-2" style={{ borderColor: "rgba(22,101,52,0.35)" }}>
            <div className="text-[13px] font-black text-neutral-900">
              £{networkMedian.gbpMedian.toFixed(2)}
            </div>
            <div className="text-[9.5px] text-neutral-600">
              £{networkMedian.gbpP25.toFixed(2)}-£{networkMedian.gbpP75.toFixed(2)} · {networkMedian.sampleSize} rates
            </div>
          </div>
        ) : (
          <div className="min-h-[42px] rounded-md border border-dashed p-2 text-[10.5px] leading-snug text-neutral-500" style={{ borderColor: "rgba(139,69,19,0.15)" }}>
            Not enough verified rates yet in this region
          </div>
        )}
      </div>
    </div>
  );
}

function AddOnsSection({
  addons,
  rates,
  onChange
}: {
  addons: PlasteringAddOn[];
  rates: Record<string, number>;
  onChange: (slug: string, value: string) => void;
}) {
  return (
    <section>
      <div className="mb-3 flex items-center gap-2">
        <Plus size={14} className="text-neutral-700"/>
        <div className="text-[10px] font-black uppercase tracking-[0.15em] text-neutral-500">
          Add-ons — attach to any service
        </div>
      </div>
      <div
        className="rounded-2xl border bg-white p-4 shadow-sm"
        style={{ borderColor: "rgba(139,69,19,0.15)" }}
      >
        <ul className="divide-y" style={{ borderColor: "rgba(139,69,19,0.08)" }}>
          {addons.map((a) => (
            <li key={a.slug} className="grid gap-3 py-3 first:pt-0 last:pb-0 md:grid-cols-[minmax(0,1fr)_180px]">
              <div>
                <div className="text-[12.5px] font-black text-neutral-900">{a.label}</div>
                <div className="mt-0.5 text-[11px] text-neutral-600">{a.description}</div>
                <div className="mt-1 text-[10.5px] italic text-neutral-500">Apply when: {a.applyWhen}</div>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-black uppercase tracking-wider text-neutral-600">
                  Your rate ({UNIT_LABEL[a.unit]})
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={rates[a.slug] ?? ""}
                  onChange={(e) => onChange(a.slug, e.target.value)}
                  placeholder="—"
                  className="min-h-[38px] w-full rounded-md border bg-white px-3 text-[12.5px] font-black text-neutral-900"
                  style={{ borderColor: "rgba(139,69,19,0.18)" }}
                />
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function CustomRatesSection({
  custom,
  onChange
}: {
  custom: CustomRate[];
  onChange: (next: CustomRate[]) => void;
}) {
  const [newLabel, setNewLabel]   = useState("");
  const [newUnit, setNewUnit]     = useState<RateUnit>("sqm");
  const [newAmount, setNewAmount] = useState("");
  const [newNotes, setNewNotes]   = useState("");

  function add() {
    const amount = Number(newAmount);
    if (!newLabel.trim() || !Number.isFinite(amount) || amount <= 0) return;
    const slug = `custom-${Date.now()}`;
    onChange([
      ...custom,
      {
        slug,
        label: newLabel.trim(),
        unit: newUnit,
        gbpAmount: amount,
        notes: newNotes.trim() || undefined
      }
    ]);
    setNewLabel("");
    setNewAmount("");
    setNewNotes("");
  }

  function remove(slug: string) {
    onChange(custom.filter((c) => c.slug !== slug));
  }

  return (
    <section>
      <div className="mb-3 flex items-center gap-2">
        <Plus size={14} className="text-neutral-700"/>
        <div className="text-[10px] font-black uppercase tracking-[0.15em] text-neutral-500">
          Your custom services
        </div>
      </div>
      <div
        className="flex flex-col gap-3 rounded-2xl border bg-white p-4 shadow-sm"
        style={{ borderColor: "rgba(139,69,19,0.15)" }}
      >
        {custom.length > 0 && (
          <ul className="flex flex-col gap-2">
            {custom.map((c) => (
              <li
                key={c.slug}
                className="flex items-start gap-3 rounded-lg border p-3"
                style={{ borderColor: "rgba(139,69,19,0.10)" }}
              >
                <div className="min-w-0 flex-1">
                  <div className="text-[12.5px] font-black text-neutral-900">{c.label}</div>
                  <div className="mt-0.5 text-[11px] text-neutral-600">
                    £{c.gbpAmount.toFixed(2)} {UNIT_LABEL[c.unit]}
                  </div>
                  {c.notes && (
                    <div className="mt-0.5 text-[10.5px] italic text-neutral-500">{c.notes}</div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => remove(c.slug)}
                  aria-label={`Remove ${c.label}`}
                  className="flex h-8 w-8 items-center justify-center rounded-full text-neutral-400 hover:bg-red-50 hover:text-red-600"
                >
                  <Trash2 size={13}/>
                </button>
              </li>
            ))}
          </ul>
        )}

        {/* Add form */}
        <div
          className="grid gap-2 rounded-lg border-2 border-dashed p-3 md:grid-cols-2"
          style={{ borderColor: "rgba(139,69,19,0.20)" }}
        >
          <label className="flex flex-col gap-1">
            <span className="text-[10px] font-black uppercase tracking-wider text-neutral-600">
              Service name
            </span>
            <input
              type="text"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              placeholder="e.g. Textured spatter finish"
              className="min-h-[38px] rounded-md border bg-white px-3 text-[12.5px] text-neutral-900"
              style={{ borderColor: "rgba(139,69,19,0.18)" }}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[10px] font-black uppercase tracking-wider text-neutral-600">
              Unit
            </span>
            <select
              value={newUnit}
              onChange={(e) => setNewUnit(e.target.value as RateUnit)}
              className="min-h-[38px] rounded-md border bg-white px-3 text-[12.5px] text-neutral-900"
              style={{ borderColor: "rgba(139,69,19,0.18)" }}
            >
              {(Object.keys(UNIT_LABEL) as RateUnit[]).map((u) => (
                <option key={u} value={u}>{UNIT_LABEL[u]}</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[10px] font-black uppercase tracking-wider text-neutral-600">
              Amount
            </span>
            <input
              type="number"
              step="0.01"
              min="0"
              value={newAmount}
              onChange={(e) => setNewAmount(e.target.value)}
              placeholder="e.g. 28.50"
              className="min-h-[38px] rounded-md border bg-white px-3 text-[12.5px] text-neutral-900"
              style={{ borderColor: "rgba(139,69,19,0.18)" }}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[10px] font-black uppercase tracking-wider text-neutral-600">
              What&apos;s included / notes (optional)
            </span>
            <input
              type="text"
              value={newNotes}
              onChange={(e) => setNewNotes(e.target.value)}
              placeholder="e.g. 3-coat spatter, pre-tinted, prep separate"
              className="min-h-[38px] rounded-md border bg-white px-3 text-[12.5px] text-neutral-900"
              style={{ borderColor: "rgba(139,69,19,0.18)" }}
            />
          </label>
          <button
            type="button"
            onClick={add}
            disabled={!newLabel.trim() || Number(newAmount) <= 0}
            className="col-span-full inline-flex h-10 items-center justify-center gap-1.5 rounded-full text-[11px] font-black uppercase tracking-wider text-white shadow-sm disabled:opacity-40"
            style={{ backgroundColor: "#0A0A0A" }}
          >
            <Plus size={13}/>
            Add custom service
          </button>
        </div>
      </div>
    </section>
  );
}

function TransparencyNotice() {
  return (
    <section
      className="rounded-2xl border p-4 shadow-sm"
      style={{ backgroundColor: "#F0FDF4", borderColor: "rgba(22,101,52,0.35)" }}
    >
      <div className="flex items-start gap-3">
        <div
          className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full"
          style={{ backgroundColor: "#166534", color: "#FFFFFF" }}
        >
          <ShieldCheck size={16} strokeWidth={2.5}/>
        </div>
        <div>
          <div className="text-[13px] font-black" style={{ color: "#166534" }}>
            Additional services may apply upon inspection
          </div>
          <p className="mt-1 text-[11.5px] leading-snug text-neutral-700">
            Every rate you publish here carries this notice publicly by default — so customers understand extras like corner beads, scaffolding, or high ceilings may be quoted after seeing the job. Honest pricing is your moat. If you want to override for a specific service (e.g. fixed-price all-in), you&apos;ll be able to at the per-service level in the next update.
          </p>
        </div>
      </div>
    </section>
  );
}
