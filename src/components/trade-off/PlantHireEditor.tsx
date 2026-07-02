"use client";

// PlantHireEditor — everything on one page. Toggle each of 12 plant
// categories, set day/week/month + operator rates per row, enable/
// disable 4 fulfilment modes, edit trust bar, brands, waiver options,
// delivery zones, bulk tiers, trade customers, FAQ, promo banner,
// headings, and mode bodies.

import { useEffect, useRef, useState } from "react";
import {
  BULK_TIERS_PRESET,
  DELIVERY_ZONES_PRESET,
  FAQ_PRESET,
  PLANT_BRANDS_PRESET,
  PLANT_CATEGORIES,
  SECTIONS_META,
  TRADE_CUSTOMERS_PRESET,
  TRUST_BENEFITS_PRESET,
  WAIVER_OPTIONS_PRESET,
  formatPriceFrom,
  type HaulageTrailerBand,
  type PlantBrand,
  type PlantBreakdownService,
  type PlantBulkTier,
  type PlantCategorySlug,
  type PlantDeliveryZone,
  type PlantFaq,
  type PlantHaulageService,
  type PlantHireConfig,
  type PlantHireSectionsEnabled,
  type PlantReview,
  type PlantSpec,
  type PlantWaiverOption
} from "@/lib/plantHire";
import {
  BulkQuoteEditor,
  CdmPackEditor,
  ClosureCalendarEditor,
  ComplianceInfoEditor,
  DriverRecruitmentEditor,
  MachineFinderEditor,
  NotifyWhenFreeEditor,
  PartsCounterEditor,
  PaymentGatewaysEditor,
  RepeatLadderEditor,
  SiteCalculatorEditor,
  SubHireEditor,
  TeamEditor,
  TradeAccountsEditor,
  TrustSignalsEditor,
  VideoCenterEditor
} from "./PlantHireExtraEditors";
// Layout editing moved to Studio (/studio/pages/plant-hire).
// See the callout inside this editor's Layout card.

const RELATED_CATEGORY_PRESETS: string[] = [
  "safety_workwear",
  "hand_tools",
  "power_tools",
  "fuel_lubricants",
  "hire_consumables",
  "aggregates",
  "electrical"
];

export type PlantHirePreviewSnapshot = {
  display_name: string;
  trading_name: string;
  services_offered: string[];
  city: string;
  avatar_url: string;
  hero_url: string;
  trade_label: string;
};

export function PlantHireEditor({
  slug,
  token,
  initial,
  previewSnapshot
}: {
  slug: string;
  token: string;
  initial: PlantHireConfig;
  previewSnapshot?: PlantHirePreviewSnapshot;
}) {
  const [cfg, setCfg] = useState<PlantHireConfig>(initial);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const initialSnapshot = useRef(JSON.stringify(initial));
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    setDirty(JSON.stringify(cfg) !== initialSnapshot.current);
  }, [cfg]);

  useEffect(() => {
    function onBeforeUnload(e: BeforeUnloadEvent) {
      if (!dirty) return;
      e.preventDefault();
      e.returnValue = "";
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  function patch(p: Partial<PlantHireConfig>) {
    setCfg((prev) => ({ ...prev, ...p }));
  }

  function patchCategory(
    catSlug: PlantCategorySlug,
    p: Partial<{
      enabled: boolean;
      price_day_pence: number | null;
      price_week_pence: number | null;
      price_month_pence: number | null;
      operator_premium_day_pence: number | null;
      note: string;
      cart_enabled: boolean;
      sub_types: string[];
      image_url: string;
      gallery_urls: string[];
      video_url: string;
      brochure_pdf_url: string;
      loler_cert_url: string;
      dimension_diagram_url: string;
      running_text: string;
      compatible_attachments: string[];
      specs: PlantSpec;
      rating: { avg: number; count: number };
      reviews: PlantReview[];
      blocked_ranges: { from: string; to: string; note?: string }[];
      for_sale: boolean;
      sale_price_pence: number | null;
      sale_condition: "new" | "used" | "refurbished" | "ex_demo" | "";
      sale_year: number | null;
      sale_hours_used: number | null;
      sale_note: string;
      sale_stock_count: number | null;
    }>
  ) {
    setCfg((prev) => {
      const meta = PLANT_CATEGORIES.find((m) => m.slug === catSlug);
      const existing = prev.categories[catSlug] ?? {
        enabled: false,
        price_day_pence: meta?.default_day_pence ?? null,
        price_week_pence: meta?.default_week_pence ?? null,
        price_month_pence: meta?.default_month_pence ?? null,
        operator_premium_day_pence: meta?.default_operator_pence ?? null,
        note: "",
        sub_types: [],
        blocked_ranges: []
      };
      return {
        ...prev,
        categories: { ...prev.categories, [catSlug]: { ...existing, ...p } }
      };
    });
  }

  async function uploadImage(file: File, field: "banner_image_url" | "illustration_image_url") {
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/trade-off/upload-photo", { method: "POST", body: form });
      const j = (await res.json()) as { ok?: boolean; url?: string; error?: string };
      if (!res.ok || !j.ok || !j.url) {
        setToast(j.error ?? "Upload failed");
        return;
      }
      patch({ [field]: j.url } as Partial<PlantHireConfig>);
    } catch (e) {
      setToast((e as Error).message);
    } finally {
      setUploading(false);
      window.setTimeout(() => setToast(null), 2500);
    }
  }

  async function save() {
    setSaving(true);
    setToast(null);
    try {
      const res = await fetch("/api/trade-off/plant-hire/save", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ slug, token, config: cfg })
      });
      const j = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !j.ok) {
        setToast(j.error ?? "Save failed");
      } else {
        setToast("Saved.");
        initialSnapshot.current = JSON.stringify(cfg);
        setDirty(false);
      }
    } catch (e) {
      setToast((e as Error).message);
    } finally {
      setSaving(false);
      window.setTimeout(() => setToast(null), 3000);
    }
  }

  return (
    <section className="mx-auto max-w-3xl space-y-6 px-4 pb-24">
      {/* Readiness bar — shows what's configured and what's left, plus
       *  a one-click "Load demo template" that pre-fills empty fields
       *  with sensible starter content the merchant can then tweak. */}
      <PlantHireReadinessBar cfg={cfg} onLoadDemo={() => setCfg(applyDemoTemplate(cfg))} />

      {/* Master switch — hide the extended showcase from the merchant's
       *  home while keeping every sub-page + wizard operational. */}
      <Card title="Master switch — Show extended showcase on home">
        <p className="text-[12px] text-brand-muted">
          When enabled, your profile home renders the full plant hire showcase (featured
          machines, video centre, promos, trust signals, and every other section below).
          When disabled, none of it appears on the home — but every sub-page (
          <code>/plant-hire</code>, <code>/plant-hire/machines</code>, book, cart, parts, etc.)
          continues to work normally.
        </p>
        <label className="mt-2 flex items-center gap-2">
          <input
            type="checkbox"
            checked={cfg.showcase_enabled}
            onChange={(e) => patch({ showcase_enabled: e.target.checked })}
            className="h-4 w-4 rounded border-brand-line accent-brand-accent"
          />
          <span className="text-[12px] font-bold text-brand-text">
            Show plant hire showcase on my home page
          </span>
        </label>
      </Card>

      {/* Layout editing has moved to Studio — the pixel-perfect,
       *  postMessage-driven, iframe-mirrored editor lives at
       *  /studio/pages/plant-hire. This card is a permanent signpost
       *  until Module 20 (Publish) wires draft → customer route so
       *  merchants don't need to think about the split. */}
      <Card title="Layout — now in Studio">
        <div className="rounded-2xl border-2 border-brand-accent/40 bg-brand-surface p-4">
          <p className="text-[10px] font-extrabold uppercase tracking-widest text-brand-accent">
            Layout · Studio
          </p>
          <p className="mt-1 text-[14px] font-extrabold text-brand-text">
            Arrange your live page inside the new Studio editor.
          </p>
          <p className="mt-2 text-[12px] leading-relaxed text-brand-muted">
            The pixel-perfect editor lives at{" "}
            <span className="font-mono">/studio/pages/plant-hire</span> —
            same live components as the customer, no drift. Move
            sections, swap layouts, edit copy inline. Everything else on
            this page (categories, prices, delivery, waivers) stays here.
          </p>
          <a
            href="/studio/pages/plant-hire"
            className="mt-3 inline-flex h-11 items-center rounded-xl px-4 text-[12px] font-extrabold uppercase tracking-widest transition hover:brightness-95"
            style={{ background: "#FFB300", color: "#0A0A0A" }}
          >
            Open in Studio →
          </a>
        </div>
      </Card>

      {/* Sections — one toggle per feature. Same JSONB serves the Xrated
       *  Trades add-on and the future standalone Plant Hire app; both
       *  surfaces read these flags. */}
      <Card title="Sections — turn features on/off">
        <p className="text-[12px] text-brand-muted">
          Every plant-hire feature is a section you can enable. Same
          config drives your Xrated Trades profile <em>and</em> the future
          standalone Plant Hire app — configure once, both surfaces stay in
          sync.
        </p>
        <ul className="mt-3 space-y-2">
          {SECTIONS_META.map((meta) => (
            <li
              key={meta.key}
              className="flex items-start gap-3 rounded-xl border border-brand-line bg-brand-bg p-3"
              style={{ borderColor: cfg.sections_enabled[meta.key] ? "#FFB300" : undefined }}
            >
              <button
                type="button"
                onClick={() =>
                  patch({
                    sections_enabled: {
                      ...cfg.sections_enabled,
                      [meta.key]: !cfg.sections_enabled[meta.key]
                    }
                  })
                }
                aria-pressed={cfg.sections_enabled[meta.key]}
                className="inline-flex h-8 w-14 shrink-0 items-center rounded-full border border-brand-line transition"
                style={{ background: cfg.sections_enabled[meta.key] ? "#FFB300" : "transparent" }}
              >
                <span
                  className="inline-block h-6 w-6 rounded-full bg-white shadow transition"
                  style={{
                    transform: cfg.sections_enabled[meta.key]
                      ? "translateX(24px)"
                      : "translateX(2px)"
                  }}
                />
              </button>
              <div className="flex-1">
                <p className="text-[13px] font-extrabold text-brand-text">{meta.label}</p>
                <p className="text-[11px] text-brand-muted">{meta.description}</p>
              </div>
            </li>
          ))}
        </ul>
      </Card>

      {/* Banner + illustration + trust flags. */}
      <Card title="Banner + shop-front details">
        <label className="block">
          <span className="text-[11px] font-extrabold uppercase tracking-widest text-brand-muted">
            Banner image (top of the public /plant-hire page)
          </span>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
            <input
              type="url"
              value={cfg.banner_image_url}
              onChange={(e) => patch({ banner_image_url: e.target.value.trim() })}
              placeholder="Paste image URL"
              className="h-10 min-w-0 flex-1 rounded-md border border-brand-line bg-brand-bg px-3 font-mono text-[12px] text-brand-text outline-none focus:border-brand-accent"
            />
            <label className="inline-flex h-10 shrink-0 cursor-pointer items-center rounded-md border border-brand-line bg-brand-bg px-3 text-[11px] font-extrabold uppercase tracking-widest text-brand-muted transition hover:border-brand-accent hover:text-brand-text">
              {uploading ? "…" : "Upload"}
              <input
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) uploadImage(f, "banner_image_url");
                }}
              />
            </label>
          </div>
          {cfg.banner_image_url && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={cfg.banner_image_url}
              alt=""
              className="mt-3 h-32 w-full rounded-lg object-cover"
            />
          )}
        </label>

        <label className="mt-4 block">
          <span className="text-[11px] font-extrabold uppercase tracking-widest text-brand-muted">
            Title-row illustration (small graphic right of intro)
          </span>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
            <input
              type="url"
              value={cfg.illustration_image_url}
              onChange={(e) => patch({ illustration_image_url: e.target.value.trim() })}
              placeholder="Paste image URL — blank uses platform default"
              className="h-10 min-w-0 flex-1 rounded-md border border-brand-line bg-brand-bg px-3 font-mono text-[12px] text-brand-text outline-none focus:border-brand-accent"
            />
            <label className="inline-flex h-10 shrink-0 cursor-pointer items-center rounded-md border border-brand-line bg-brand-bg px-3 text-[11px] font-extrabold uppercase tracking-widest text-brand-muted transition hover:border-brand-accent hover:text-brand-text">
              {uploading ? "…" : "Upload"}
              <input
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) uploadImage(f, "illustration_image_url");
                }}
              />
            </label>
          </div>
          {cfg.illustration_image_url && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={cfg.illustration_image_url}
              alt=""
              className="mt-3 h-24 w-auto rounded-lg object-contain"
            />
          )}
        </label>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="text-[11px] font-extrabold uppercase tracking-widest text-brand-muted">Years hiring plant</span>
            <input
              type="number"
              min={0}
              max={100}
              value={cfg.years_hiring ?? ""}
              onChange={(e) => {
                const v = e.target.value;
                patch({ years_hiring: v === "" ? null : Number(v) });
              }}
              className="mt-2 h-10 w-full rounded-md border border-brand-line bg-brand-bg px-3 text-[13px] text-brand-text outline-none focus:border-brand-accent"
            />
          </label>
          <label className="block">
            <span className="text-[11px] font-extrabold uppercase tracking-widest text-brand-muted">Turnaround pill (optional)</span>
            <input
              type="text"
              value={cfg.turnaround_text}
              onChange={(e) => patch({ turnaround_text: e.target.value })}
              placeholder="e.g. Same-day delivery"
              className="mt-2 h-10 w-full rounded-md border border-brand-line bg-brand-bg px-3 text-[13px] text-brand-text outline-none focus:border-brand-accent"
              maxLength={40}
            />
          </label>
        </div>

        <label className="mt-4 block">
          <span className="text-[11px] font-extrabold uppercase tracking-widest text-brand-muted">Depot postcode (for the delivery calculator)</span>
          <input
            type="text"
            value={cfg.depot_postcode}
            onChange={(e) => patch({ depot_postcode: e.target.value.toUpperCase().slice(0, 12) })}
            placeholder="HU8 8DZ"
            className="mt-2 h-10 w-full rounded-md border border-brand-line bg-brand-bg px-3 font-mono text-[13px] text-brand-text outline-none focus:border-brand-accent"
            maxLength={12}
          />
          <p className="mt-1 text-[10px] text-brand-muted">
            Used by the postcode delivery calculator on each machine tile. Blank hides the calculator.
          </p>
        </label>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <ToggleRow label="CPA T&Cs applied" value={cfg.cpa_terms} onChange={(v) => patch({ cpa_terms: v })} />
          <ToggleRow label="Hired-in insured" value={cfg.hired_in_insured} onChange={(v) => patch({ hired_in_insured: v })} />
          <ToggleRow label="CPCS-carded operators" value={cfg.cpcs_operators} onChange={(v) => patch({ cpcs_operators: v })} />
          <ToggleRow label="HSE-audited fleet" value={cfg.hse_audited} onChange={(v) => patch({ hse_audited: v })} />
        </div>
      </Card>

      {/* Categories. */}
      <Card title="What we hire">
        <p className="text-[12px] text-brand-muted">
          Toggle a category on to advertise it. Set day/week/month prices in pence + an operator day-rate premium. Add sub-model chips (e.g. &ldquo;Kubota U10-5, JCB 8018&rdquo;) and an optional note per row.
        </p>
        <ul className="mt-3 space-y-2">
          {PLANT_CATEGORIES.map((meta) => {
            const c = cfg.categories[meta.slug] ?? {
              enabled: false,
              price_day_pence: meta.default_day_pence,
              price_week_pence: meta.default_week_pence,
              price_month_pence: meta.default_month_pence,
              operator_premium_day_pence: meta.default_operator_pence,
              note: ""
            };
            return (
              <li
                key={meta.slug}
                className="rounded-xl border border-brand-line bg-brand-bg p-3"
                style={{ borderColor: c.enabled ? "#FFB300" : undefined }}
              >
                <div className="flex items-start gap-3">
                  <button
                    type="button"
                    onClick={() => patchCategory(meta.slug, { enabled: !c.enabled })}
                    aria-pressed={c.enabled}
                    className="inline-flex h-8 w-14 shrink-0 items-center rounded-full border border-brand-line transition"
                    style={{ background: c.enabled ? "#FFB300" : "transparent" }}
                  >
                    <span
                      className="inline-block h-6 w-6 rounded-full bg-white shadow transition"
                      style={{ transform: c.enabled ? "translateX(24px)" : "translateX(2px)" }}
                    />
                  </button>
                  <div className="flex-1">
                    <p className="text-[13px] font-extrabold text-brand-text">
                      <span className="mr-2 text-[16px]">{meta.emoji}</span>
                      {meta.label}
                    </p>
                    <p className="mt-0.5 text-[11px] text-brand-muted">{meta.short_desc}</p>
                  </div>
                </div>
                {c.enabled && (
                  <div className="mt-3 space-y-3">
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                      <PriceField
                        label="Day (pence)"
                        value={c.price_day_pence}
                        placeholder={String(meta.default_day_pence)}
                        onChange={(v) => patchCategory(meta.slug, { price_day_pence: v })}
                      />
                      <PriceField
                        label="Week (pence)"
                        value={c.price_week_pence}
                        placeholder={String(meta.default_week_pence)}
                        onChange={(v) => patchCategory(meta.slug, { price_week_pence: v })}
                      />
                      <PriceField
                        label="Month (pence)"
                        value={c.price_month_pence}
                        placeholder={String(meta.default_month_pence)}
                        onChange={(v) => patchCategory(meta.slug, { price_month_pence: v })}
                      />
                      <PriceField
                        label="+ Operator/day (pence)"
                        value={c.operator_premium_day_pence}
                        placeholder={String(meta.default_operator_pence)}
                        onChange={(v) => patchCategory(meta.slug, { operator_premium_day_pence: v })}
                      />
                    </div>
                    <p className="text-[10px] text-brand-muted">
                      Displays as &ldquo;{formatPriceFrom(c.price_day_pence)}&rdquo;. Set operator premium to 0 for self-drive-only categories (MEWPs, generators).
                    </p>
                    <label className="block">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-brand-muted">
                        Note (optional)
                      </span>
                      <input
                        type="text"
                        value={c.note}
                        onChange={(e) => patchCategory(meta.slug, { note: e.target.value })}
                        placeholder="e.g. Bring CPCS card. £500 deposit."
                        className="mt-1 h-9 w-full rounded-md border border-brand-line bg-brand-bg px-2 text-[12px] text-brand-text outline-none focus:border-brand-accent"
                        maxLength={240}
                      />
                    </label>
                    <label className="block">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-brand-muted">
                        Category tile image (optional)
                      </span>
                      <div className="mt-1 flex flex-col gap-2 sm:flex-row sm:items-center">
                        <input
                          type="url"
                          value={c.image_url ?? ""}
                          onChange={(e) => patchCategory(meta.slug, { image_url: e.target.value.trim() })}
                          placeholder="Paste image URL — blank shows emoji"
                          className="h-9 min-w-0 flex-1 rounded-md border border-brand-line bg-brand-bg px-2 font-mono text-[11px] text-brand-text outline-none focus:border-brand-accent"
                        />
                        <label className="inline-flex h-9 shrink-0 cursor-pointer items-center rounded-md border border-brand-line bg-brand-bg px-3 text-[10px] font-extrabold uppercase tracking-widest text-brand-muted transition hover:border-brand-accent hover:text-brand-text">
                          {uploading ? "…" : "Upload"}
                          <input
                            type="file"
                            accept="image/*"
                            className="sr-only"
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              if (!f) return;
                              (async () => {
                                const form = new FormData();
                                form.append("file", f);
                                const res = await fetch("/api/trade-off/upload-photo", {
                                  method: "POST",
                                  body: form
                                });
                                const j = (await res.json()) as { ok?: boolean; url?: string };
                                if (j.ok && j.url) {
                                  patchCategory(meta.slug, { image_url: j.url });
                                }
                              })();
                            }}
                          />
                        </label>
                      </div>
                      {c.image_url && (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={c.image_url}
                          alt=""
                          className="mt-2 h-16 w-16 rounded-md object-cover"
                        />
                      )}
                    </label>
                    <label className="block">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-brand-muted">
                        Sub-model chips (comma-separated, max 20)
                      </span>
                      <input
                        type="text"
                        value={(c.sub_types ?? []).join(", ")}
                        onChange={(e) => {
                          const arr = e.target.value
                            .split(",")
                            .map((s) => s.trim())
                            .filter((s) => s.length > 0)
                            .slice(0, 20);
                          patchCategory(meta.slug, { sub_types: arr });
                        }}
                        placeholder={
                          meta.slug === "mini_excavator"
                            ? "e.g. Kubota U10-5, JCB 8018, Takeuchi TB216"
                            : meta.slug === "telehandler"
                              ? "e.g. Manitou MT625, Merlo 25.6, JCB 525-60"
                              : "e.g. specific machine names customers search for"
                        }
                        className="mt-1 h-9 w-full rounded-md border border-brand-line bg-brand-bg px-2 text-[12px] text-brand-text outline-none focus:border-brand-accent"
                      />
                    </label>
                    <label className="flex items-start gap-2 rounded-md border border-brand-line bg-brand-surface p-2">
                      <input
                        type="checkbox"
                        checked={
                          c.cart_enabled === undefined ? meta.cart_default_on : c.cart_enabled
                        }
                        onChange={(e) => patchCategory(meta.slug, { cart_enabled: e.target.checked })}
                        className="mt-0.5 h-4 w-4 shrink-0 accent-[#FFB300]"
                      />
                      <span className="text-[11px] leading-relaxed text-brand-text">
                        <span className="font-extrabold">Show enquire card on this tile</span>
                        <span className="text-brand-muted">
                          {" — "}
                          Customer sees a start-date + duration picker + WhatsApp CTA under the rate table.
                        </span>
                      </span>
                    </label>

                    <div className="rounded-md border border-brand-line bg-brand-surface p-2">
                      <p className="text-[11px] font-extrabold text-brand-text">
                        Availability calendar — block out dates when this machine is on hire, in service or reserved
                      </p>
                      <p className="mt-0.5 text-[10px] text-brand-muted">
                        Customers see the blocked ranges under this tile + get an inline warning if they pick a date inside a block.
                      </p>
                      <BlockedDatesEditor
                        ranges={c.blocked_ranges ?? []}
                        onChange={(next) => patchCategory(meta.slug, { blocked_ranges: next })}
                      />
                    </div>

                    <details className="rounded-md border border-brand-line bg-brand-surface p-2">
                      <summary className="cursor-pointer text-[11px] font-extrabold text-brand-text">
                        Machine detail — specs, gallery, video, docs, reviews
                      </summary>
                      <div className="mt-3 space-y-3">
                        <SpecsEditor
                          specs={c.specs ?? {}}
                          onChange={(next) => patchCategory(meta.slug, { specs: next })}
                        />
                        <GalleryEditor
                          urls={c.gallery_urls ?? []}
                          onChange={(next) => patchCategory(meta.slug, { gallery_urls: next })}
                        />
                        <VideoUploadField
                          value={c.video_url ?? ""}
                          onChange={(v) => patchCategory(meta.slug, { video_url: v })}
                        />
                        <UrlField
                          label="Brochure / spec sheet PDF"
                          value={c.brochure_pdf_url ?? ""}
                          placeholder="https://.../brochure.pdf"
                          onChange={(v) => patchCategory(meta.slug, { brochure_pdf_url: v })}
                        />
                        <UrlField
                          label="LOLER certificate PDF"
                          value={c.loler_cert_url ?? ""}
                          placeholder="https://.../loler.pdf"
                          onChange={(v) => patchCategory(meta.slug, { loler_cert_url: v })}
                        />
                        <UrlField
                          label="Dimension diagram image (Size & Access modal)"
                          value={c.dimension_diagram_url ?? ""}
                          placeholder="https://.../mini-excavator-dimensions.png"
                          onChange={(v) => patchCategory(meta.slug, { dimension_diagram_url: v })}
                        />
                        <label className="block">
                          <span className="text-[10px] font-bold uppercase tracking-widest text-brand-muted">
                            Running announcement banner (under hero on the machine detail page)
                          </span>
                          <input
                            type="text"
                            value={c.running_text ?? ""}
                            onChange={(e) =>
                              patchCategory(meta.slug, { running_text: e.target.value })
                            }
                            placeholder="e.g. New 3.5T mini digger arriving Wednesday — hire from Friday with nationwide delivery"
                            maxLength={240}
                            className="mt-1 h-9 w-full rounded-md border border-brand-line bg-brand-bg px-2 text-[12px] text-brand-text outline-none focus:border-brand-accent"
                          />
                          <p className="mt-1 text-[10px] text-brand-muted">
                            Blank = no banner. Scrolls right-to-left under the hero for that machine only.
                          </p>
                        </label>
                        <label className="block">
                          <span className="text-[10px] font-bold uppercase tracking-widest text-brand-muted">
                            Compatible attachments (comma-separated category slugs, max 12)
                          </span>
                          <input
                            type="text"
                            value={(c.compatible_attachments ?? []).join(", ")}
                            onChange={(e) => {
                              const arr = e.target.value
                                .split(",")
                                .map((s) => s.trim().toLowerCase())
                                .filter((s) => s.length > 0)
                                .slice(0, 12);
                              patchCategory(meta.slug, { compatible_attachments: arr });
                            }}
                            placeholder="e.g. breaker, attachments"
                            className="mt-1 h-9 w-full rounded-md border border-brand-line bg-brand-bg px-2 font-mono text-[11px] text-brand-text outline-none focus:border-brand-accent"
                          />
                        </label>
                        <ReviewsEditor
                          rating={c.rating ?? { avg: 0, count: 0 }}
                          reviews={c.reviews ?? []}
                          onRatingChange={(next) => patchCategory(meta.slug, { rating: next })}
                          onReviewsChange={(next) => patchCategory(meta.slug, { reviews: next })}
                        />

                        {/* BUY-NOW block — merchant can also list this
                         *  machine for sale. Toggling on reveals the
                         *  sale-price + condition + year + hours fields
                         *  and surfaces a green "Buy Now" CTA on the
                         *  public tile modal. */}
                        <div className="rounded-md border border-brand-line bg-brand-bg p-3">
                          <label className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={c.for_sale === true}
                              onChange={(e) =>
                                patchCategory(meta.slug, { for_sale: e.target.checked })
                              }
                              className="h-4 w-4 accent-[#FFB300]"
                            />
                            <span className="text-[12px] font-extrabold text-brand-text">
                              Also available to buy (used / ex-fleet / new)
                            </span>
                          </label>
                          {c.for_sale && (
                            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                              <PriceField
                                label="Sale price (pence)"
                                value={c.sale_price_pence ?? null}
                                placeholder="1250000"
                                onChange={(v) => patchCategory(meta.slug, { sale_price_pence: v })}
                              />
                              <label className="block">
                                <span className="text-[10px] font-bold uppercase tracking-widest text-brand-muted">
                                  Condition
                                </span>
                                <select
                                  value={c.sale_condition ?? ""}
                                  onChange={(e) =>
                                    patchCategory(meta.slug, {
                                      sale_condition: e.target.value as
                                        | "new"
                                        | "used"
                                        | "refurbished"
                                        | "ex_demo"
                                        | ""
                                    })
                                  }
                                  className="mt-1 h-9 w-full rounded-md border border-brand-line bg-brand-bg px-2 text-[11px] text-brand-text outline-none focus:border-brand-accent"
                                >
                                  <option value="">—</option>
                                  <option value="new">New</option>
                                  <option value="used">Used</option>
                                  <option value="refurbished">Refurbished</option>
                                  <option value="ex_demo">Ex-demo</option>
                                </select>
                              </label>
                              <PriceField
                                label="Year"
                                value={c.sale_year ?? null}
                                placeholder="2022"
                                onChange={(v) => patchCategory(meta.slug, { sale_year: v })}
                              />
                              <PriceField
                                label="Hours"
                                value={c.sale_hours_used ?? null}
                                placeholder="1450"
                                onChange={(v) => patchCategory(meta.slug, { sale_hours_used: v })}
                              />
                              <PriceField
                                label="Stock (units)"
                                value={c.sale_stock_count ?? null}
                                placeholder="1"
                                onChange={(v) => patchCategory(meta.slug, { sale_stock_count: v })}
                              />
                              <label className="col-span-2 block sm:col-span-3">
                                <span className="text-[10px] font-bold uppercase tracking-widest text-brand-muted">
                                  Sale note
                                </span>
                                <input
                                  type="text"
                                  value={c.sale_note ?? ""}
                                  onChange={(e) =>
                                    patchCategory(meta.slug, { sale_note: e.target.value })
                                  }
                                  placeholder="e.g. Full service history, 2 new tyres, ready to work"
                                  maxLength={300}
                                  className="mt-1 h-9 w-full rounded-md border border-brand-line bg-brand-bg px-2 text-[11px] text-brand-text outline-none focus:border-brand-accent"
                                />
                              </label>
                            </div>
                          )}
                        </div>
                      </div>
                    </details>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </Card>

      {/* Fulfilment modes. */}
      <Card title="How customers hire from you">
        <p className="text-[12px] text-brand-muted">
          Enable any combination. Collect + delivery are the standard pair; add operator hire and long-term contracts if you offer them.
        </p>
        <div className="mt-3 space-y-2">
          <ModeRow
            title="Collect from yard (self-drive)"
            body="Customer picks up from your yard with valid ID + deposit."
            enabled={cfg.modes.collect}
            onChange={(v) => patch({ modes: { ...cfg.modes, collect: v } })}
          />
          <ModeRow
            title="Delivery"
            body="You deliver + collect. Configure zones + per-mile pricing below."
            enabled={cfg.modes.delivery}
            onChange={(v) => patch({ modes: { ...cfg.modes, delivery: v } })}
          />
          <ModeRow
            title="With operator"
            body="You supply a CPCS-carded operator at the day-rate premium set per category."
            enabled={cfg.modes.operator}
            onChange={(v) => patch({ modes: { ...cfg.modes, operator: v } })}
          />
          <ModeRow
            title="Long-term contract"
            body="2+ week hires with tier discount. Configure tiers below."
            enabled={cfg.modes.long_term}
            onChange={(v) => patch({ modes: { ...cfg.modes, long_term: v } })}
          />
        </div>

        <div className="mt-4 space-y-3 rounded-xl border border-brand-line bg-brand-bg p-3">
          <p className="text-[10px] font-bold uppercase tracking-widest text-brand-muted">Yard address (customer collects from here)</p>
          <textarea
            value={cfg.yard_address}
            onChange={(e) => patch({ yard_address: e.target.value })}
            rows={3}
            className="w-full rounded-md border border-brand-line bg-brand-bg px-3 py-2 text-[13px] text-brand-text outline-none focus:border-brand-accent"
            placeholder="Stuart Kingsley Building Merchant\nBilton Way\nHull HU8 8DZ"
            maxLength={400}
          />
          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <span className="text-[10px] font-bold uppercase tracking-widest text-brand-muted">Yard open from</span>
              <input
                type="text"
                value={cfg.yard_open_from}
                onChange={(e) => patch({ yard_open_from: e.target.value })}
                placeholder="07:00"
                className="mt-1 h-9 w-full rounded-md border border-brand-line bg-brand-bg px-2 font-mono text-[12px] text-brand-text outline-none focus:border-brand-accent"
                maxLength={10}
              />
            </label>
            <label className="block">
              <span className="text-[10px] font-bold uppercase tracking-widest text-brand-muted">Yard open to</span>
              <input
                type="text"
                value={cfg.yard_open_to}
                onChange={(e) => patch({ yard_open_to: e.target.value })}
                placeholder="17:00"
                className="mt-1 h-9 w-full rounded-md border border-brand-line bg-brand-bg px-2 font-mono text-[12px] text-brand-text outline-none focus:border-brand-accent"
                maxLength={10}
              />
            </label>
          </div>
        </div>
      </Card>

      {/* Fuel + policies. */}
      <Card title="Fuel + policies">
        <div className="space-y-3">
          <label className="block">
            <span className="text-[10px] font-bold uppercase tracking-widest text-brand-muted">Fuel policy</span>
            <select
              value={cfg.fuel_policy}
              onChange={(e) => patch({ fuel_policy: e.target.value as PlantHireConfig["fuel_policy"] })}
              className="mt-1 h-10 w-full rounded-md border border-brand-line bg-brand-bg px-3 text-[13px] text-brand-text outline-none focus:border-brand-accent"
            >
              <option value="refuel_on_return">Refuel on return</option>
              <option value="pay_refuel_charge">Pay refuel charge (£/L)</option>
              <option value="diesel_included">Diesel included</option>
              <option value="electric_only">Electric fleet — charge included</option>
            </select>
          </label>
          {cfg.fuel_policy === "pay_refuel_charge" && (
            <PriceField
              label="Refuel charge (pence/L)"
              value={cfg.fuel_refuel_pence_per_litre}
              placeholder="200"
              onChange={(v) => patch({ fuel_refuel_pence_per_litre: v })}
            />
          )}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <PriceField
              label="Weekend % of day rate"
              value={cfg.weekend_rate_percent}
              placeholder="100"
              onChange={(v) => patch({ weekend_rate_percent: v })}
            />
            <PriceField
              label="Bank holiday surcharge %"
              value={cfg.bank_holiday_surcharge_percent}
              placeholder="0"
              onChange={(v) => patch({ bank_holiday_surcharge_percent: v })}
            />
            <PriceField
              label="Deposit (pence)"
              value={cfg.deposit_pence}
              placeholder="50000"
              onChange={(v) => patch({ deposit_pence: v })}
            />
            <PriceField
              label="Min operator age"
              value={cfg.min_operator_age}
              placeholder="21"
              onChange={(v) => patch({ min_operator_age: v })}
            />
          </div>
          <ToggleRow
            label="Require CPCS/NPORS card upload on enquiry"
            value={cfg.cpcs_required}
            onChange={(v) => patch({ cpcs_required: v })}
          />
        </div>
      </Card>

      {/* Trust & benefits. */}
      <Card title="Trust & Benefits (button strip)">
        <p className="text-[12px] text-brand-muted">
          Buttons shown on your public page — each can link to a relevant page (careers, trade
          accounts, breakdown, compliance PDF etc.). Leave URL blank for a static badge.
        </p>
        <TrustBenefitsEditor
          items={cfg.trust_benefits}
          onChange={(next) => patch({ trust_benefits: next })}
        />
      </Card>

      {/* Brands. */}
      <Card title="Fleet brands">
        <p className="text-[12px] text-brand-muted">
          The plant brands you hire. Renders as a logo row on your public page (or text pill if no logo).
        </p>
        <PlantBrandsEditor
          brands={cfg.plant_brands}
          onChange={(next) => patch({ plant_brands: next })}
          presets={PLANT_BRANDS_PRESET}
        />
      </Card>

      {/* Damage waiver options. */}
      <Card title="Damage waiver options">
        <p className="text-[12px] text-brand-muted">
          The cover options you offer at hire. Customer picks one at enquiry.
        </p>
        <WaiverOptionsEditor
          items={cfg.waiver_options}
          onChange={(next) => patch({ waiver_options: next })}
          presets={WAIVER_OPTIONS_PRESET}
        />
      </Card>

      {/* Delivery zones. */}
      <Card title="Delivery zones">
        <p className="text-[12px] text-brand-muted">
          Free radius + per-mile pricing beyond. Add tiers for local / regional / national.
        </p>
        <DeliveryZonesEditor
          items={cfg.delivery_zones}
          onChange={(next) => patch({ delivery_zones: next })}
          presets={DELIVERY_ZONES_PRESET}
        />
      </Card>

      {/* Bulk tiers. */}
      <Card title="Long-term / bulk hire tiers">
        <p className="text-[12px] text-brand-muted">
          Discount tiers for longer hires. Empty = hides the whole Bulk section.
        </p>
        <BulkTiersEditor
          tiers={cfg.bulk_tiers}
          onChange={(next) => patch({ bulk_tiers: next })}
          presets={BULK_TIERS_PRESET}
        />
      </Card>

      {/* Trade customers. */}
      <Card title="Trade & commercial customers we serve">
        <ChipListEditor
          items={cfg.trade_customers}
          onChange={(next) => patch({ trade_customers: next })}
          presets={TRADE_CUSTOMERS_PRESET}
          max={30}
          placeholder="e.g. Groundworkers"
        />
      </Card>

      {/* FAQ. */}
      <Card title="Frequently asked questions">
        <FaqEditor
          faqs={cfg.faq}
          onChange={(next) => patch({ faq: next })}
          preset={FAQ_PRESET}
        />
      </Card>

      {/* Promo. */}
      <Card title="Promotional banner (optional)">
        <div className="space-y-3">
          <label className="flex items-center gap-2 rounded-md border border-brand-line bg-brand-bg p-2">
            <input
              type="checkbox"
              checked={cfg.promo_banner.enabled}
              onChange={(e) => patch({ promo_banner: { ...cfg.promo_banner, enabled: e.target.checked } })}
              className="h-4 w-4 accent-[#FFB300]"
            />
            <span className="text-[12px] font-extrabold text-brand-text">Show promotional banner</span>
          </label>
          <label className="block">
            <span className="text-[10px] font-bold uppercase tracking-widest text-brand-muted">Banner text</span>
            <input
              type="text"
              value={cfg.promo_banner.text}
              onChange={(e) => patch({ promo_banner: { ...cfg.promo_banner, text: e.target.value } })}
              placeholder="e.g. Free weekend hire on all mini diggers this month"
              maxLength={200}
              className="mt-1 h-10 w-full rounded-md border border-brand-line bg-brand-bg px-3 text-[13px] text-brand-text outline-none focus:border-brand-accent"
            />
          </label>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <label className="block">
              <span className="text-[10px] font-bold uppercase tracking-widest text-brand-muted">CTA label</span>
              <input
                type="text"
                value={cfg.promo_banner.cta_label}
                onChange={(e) => patch({ promo_banner: { ...cfg.promo_banner, cta_label: e.target.value } })}
                placeholder="e.g. Reserve now"
                maxLength={40}
                className="mt-1 h-10 w-full rounded-md border border-brand-line bg-brand-bg px-3 text-[13px] text-brand-text outline-none focus:border-brand-accent"
              />
            </label>
            <label className="block">
              <span className="text-[10px] font-bold uppercase tracking-widest text-brand-muted">CTA link</span>
              <input
                type="text"
                value={cfg.promo_banner.cta_href}
                onChange={(e) => patch({ promo_banner: { ...cfg.promo_banner, cta_href: e.target.value } })}
                placeholder="https://... or #anchor"
                maxLength={400}
                className="mt-1 h-10 w-full rounded-md border border-brand-line bg-brand-bg px-3 font-mono text-[12px] text-brand-text outline-none focus:border-brand-accent"
              />
            </label>
          </div>
        </div>
      </Card>

      {/* Headlines + section titles. */}
      <Card title="Headline & section titles (optional)">
        <div className="space-y-3">
          <HeadingField label="H1 headline" placeholder="Every Machine You Need. On Your Site." value={cfg.headline_text} onChange={(v) => patch({ headline_text: v })} max={120} />
          <HeadingField label="Trust & Benefits heading" placeholder="Why customers hire from us" value={cfg.section_headings.trust_benefits} onChange={(v) => patch({ section_headings: { ...cfg.section_headings, trust_benefits: v } })} />
          <HeadingField label="Brands heading" placeholder="Fleet brands" value={cfg.section_headings.brands} onChange={(v) => patch({ section_headings: { ...cfg.section_headings, brands: v } })} />
          <HeadingField label="What we hire heading" placeholder="What we hire" value={cfg.section_headings.what_we_hire} onChange={(v) => patch({ section_headings: { ...cfg.section_headings, what_we_hire: v } })} />
          <HeadingField label="How to hire heading" placeholder="How to hire from us" value={cfg.section_headings.how_to_hire} onChange={(v) => patch({ section_headings: { ...cfg.section_headings, how_to_hire: v } })} />
          <HeadingField label="Delivery heading" placeholder="Delivery zones + rates" value={cfg.section_headings.delivery} onChange={(v) => patch({ section_headings: { ...cfg.section_headings, delivery: v } })} />
          <HeadingField label="Damage waiver heading" placeholder="Damage waiver options" value={cfg.section_headings.waivers} onChange={(v) => patch({ section_headings: { ...cfg.section_headings, waivers: v } })} />
          <HeadingField label="Bulk section heading" placeholder="Long-term & bulk hires" value={cfg.section_headings.bulk} onChange={(v) => patch({ section_headings: { ...cfg.section_headings, bulk: v } })} />
          <HeadingField label="Trade customers heading" placeholder="Trade customers we serve" value={cfg.section_headings.trade_customers} onChange={(v) => patch({ section_headings: { ...cfg.section_headings, trade_customers: v } })} />
          <HeadingField label="Related products heading" placeholder="While you're here" value={cfg.section_headings.related_products} onChange={(v) => patch({ section_headings: { ...cfg.section_headings, related_products: v } })} />
          <HeadingField label="FAQ heading" placeholder="Frequently asked questions" value={cfg.section_headings.faq} onChange={(v) => patch({ section_headings: { ...cfg.section_headings, faq: v } })} />
        </div>
      </Card>

      {/* Mode body overrides. */}
      <Card title="Fulfilment mode descriptions (optional)">
        <p className="text-[12px] text-brand-muted">Blank = platform default.</p>
        <div className="mt-3 space-y-3">
          <ModeBodyField label="Collect body" value={cfg.mode_bodies.collect} placeholder="Collect from our yard 7am–5pm Mon–Fri..." onChange={(v) => patch({ mode_bodies: { ...cfg.mode_bodies, collect: v } })} />
          <ModeBodyField label="Delivery body" value={cfg.mode_bodies.delivery} placeholder="Same-day delivery across HU postcodes..." onChange={(v) => patch({ mode_bodies: { ...cfg.mode_bodies, delivery: v } })} />
          <ModeBodyField label="Operator body" value={cfg.mode_bodies.operator} placeholder="CPCS-carded operators on request. 24-hour advance booking." onChange={(v) => patch({ mode_bodies: { ...cfg.mode_bodies, operator: v } })} />
          <ModeBodyField label="Long-term body" value={cfg.mode_bodies.long_term} placeholder="2-week+ contracts get tier discount. Message us for a quote." onChange={(v) => patch({ mode_bodies: { ...cfg.mode_bodies, long_term: v } })} />
        </div>
      </Card>

      {/* Explanatory paragraphs. */}
      <Card title="Explanatory paragraphs under 'What we hire' (optional)">
        <ParagraphsEditor
          items={cfg.explanatory_paragraphs}
          onChange={(next) => patch({ explanatory_paragraphs: next })}
        />
      </Card>

      {/* Related products cross-sell. */}
      <Card title="Related products cross-sell (optional)">
        <p className="text-[12px] text-brand-muted">
          Which merchant_category slugs drive the &ldquo;While you&rsquo;re here&rdquo; section. Empty = platform defaults.
        </p>
        <ChipListEditor
          items={cfg.related_product_categories}
          onChange={(next) => patch({ related_product_categories: next })}
          presets={RELATED_CATEGORY_PRESETS}
          max={20}
          placeholder="e.g. safety_workwear"
        />
      </Card>

      {/* Breakdown service. */}
      <Card title="24/7 Breakdown service">
        <p className="text-[12px] text-brand-muted">
          Configure the /plant-hire/breakdown report page. Every field controls what the customer
          sees on the form. Off = the customer-facing page falls back to a &ldquo;WhatsApp us&rdquo;
          card instead of the full form.
        </p>
        <BreakdownServiceEditor
          value={cfg.breakdown_service}
          onChange={(next) => patch({ breakdown_service: next })}
        />
      </Card>

      {/* Haulage service. */}
      <Card title="Machine haulage (hire + third-party moves)">
        <p className="text-[12px] text-brand-muted">
          Powers /plant-hire/haulage — the wizard your customers use to book a hire delivery from
          your fleet, OR to have you haul a machine they own. Off = falls back to a WhatsApp card.
        </p>
        <HaulageServiceEditor
          value={cfg.haulage_service}
          onChange={(next) => patch({ haulage_service: next })}
        />
      </Card>

      {/* Video centre. */}
      <Card title="Video centre">
        <p className="text-[12px] text-brand-muted">
          YouTube video tiles under your plant hire home page. Optionally tag each video to a
          machine — a &ldquo;View this machine →&rdquo; button appears in the modal.
        </p>
        <VideoCenterEditor
          value={cfg.video_center}
          onChange={(next) => patch({ video_center: next })}
        />
      </Card>

      {/* Meet the team. */}
      <Card title="Meet the team">
        <p className="text-[12px] text-brand-muted">
          Direct-line team cards — customers skip the switchboard. Each member can have their own
          phone/extension, WhatsApp and email.
        </p>
        <TeamEditor value={cfg.team} onChange={(next) => patch({ team: next })} />
      </Card>

      {/* Trade accounts. */}
      <Card title="Trade accounts (credit)">
        <p className="text-[12px] text-brand-muted">
          Application card on your plant hire home page. Two paths — WhatsApp application or PDF
          form download. Set credit limits and turnaround here.
        </p>
        <TradeAccountsEditor
          value={cfg.trade_accounts}
          onChange={(next) => patch({ trade_accounts: next })}
        />
      </Card>

      {/* Drivers wanted. */}
      <Card title="Drivers wanted (recruitment)">
        <p className="text-[12px] text-brand-muted">
          Recruitment card visible on your plant hire home page. Configure which positions are
          open, benefits, and application paths.
        </p>
        <DriverRecruitmentEditor
          value={cfg.driver_recruitment}
          onChange={(next) => patch({ driver_recruitment: next })}
        />
      </Card>

      {/* Parts counter. */}
      <Card title="Spare parts trade counter">
        <p className="text-[12px] text-brand-muted">
          Dark banner section with counter phone, hours, category cards + manuals, and an optional
          full manual library link.
        </p>
        <PartsCounterEditor
          value={cfg.parts_counter}
          onChange={(next) => patch({ parts_counter: next })}
        />
      </Card>

      {/* Compliance / wide load. */}
      <Card title="Wide load & nationwide compliance">
        <p className="text-[12px] text-brand-muted">
          Info card explaining wide-load process, nationwide coverage, route surveys and
          credentials. Draws haulage licence + goods-in-transit auto from the Haulage section.
        </p>
        <ComplianceInfoEditor
          value={cfg.compliance_info}
          onChange={(next) => patch({ compliance_info: next })}
        />
      </Card>

      {/* Trust signals. */}
      <Card title="Trust signals (accreditations + reviews + insurance)">
        <p className="text-[12px] text-brand-muted">
          Third-party trust badges — SafeContractor, CHAS, ISO, FORS. Plus Google/TrustPilot embed,
          insurance cert PDF, awards.
        </p>
        <TrustSignalsEditor
          value={cfg.trust_signals}
          onChange={(next) => patch({ trust_signals: next })}
        />
      </Card>

      {/* CDM pack. */}
      <Card title="CDM 2015 risk-assessment pack">
        <p className="text-[12px] text-brand-muted">
          Auto-generated site safety pack. £10 add-on or free above a threshold.
        </p>
        <CdmPackEditor value={cfg.cdm_pack} onChange={(next) => patch({ cdm_pack: next })} />
      </Card>

      {/* Machine finder. */}
      <Card title="Machine finder wizard (/plant-hire/finder)">
        <p className="text-[12px] text-brand-muted">
          5-question decision tree that recommends machines from your fleet.
        </p>
        <MachineFinderEditor
          value={cfg.machine_finder}
          onChange={(next) => patch({ machine_finder: next })}
        />
      </Card>

      {/* Site calculator. */}
      <Card title="Site services calculator">
        <p className="text-[12px] text-brand-muted">
          Aggregate / concrete / hardcore volume-to-tonnage calculator with material presets.
        </p>
        <SiteCalculatorEditor
          value={cfg.site_calculator}
          onChange={(next) => patch({ site_calculator: next })}
        />
      </Card>

      {/* Repeat ladder. */}
      <Card title="Repeat customer discount ladder">
        <p className="text-[12px] text-brand-muted">
          Loyalty tiers that unlock automatic day-rate discounts.
        </p>
        <RepeatLadderEditor
          value={cfg.repeat_ladder}
          onChange={(next) => patch({ repeat_ladder: next })}
        />
      </Card>

      {/* Notify when free. */}
      <Card title="Notify-when-free promo card">
        <p className="text-[12px] text-brand-muted">
          Small teaser card pointing customers to the bell icon on individual machines.
        </p>
        <NotifyWhenFreeEditor
          value={cfg.notify_when_free}
          onChange={(next) => patch({ notify_when_free: next })}
        />
      </Card>

      {/* Bulk quote. */}
      <Card title="Bulk / project hire quote">
        <p className="text-[12px] text-brand-muted">
          Card for multi-machine, multi-week hires. Submits via WhatsApp.
        </p>
        <BulkQuoteEditor value={cfg.bulk_quote} onChange={(next) => patch({ bulk_quote: next })} />
      </Card>

      {/* Closure calendar. */}
      <Card title="Yard closure calendar">
        <p className="text-[12px] text-brand-muted">
          Bank holidays and planned closures shown up top so customers book around locked gates.
        </p>
        <ClosureCalendarEditor
          value={cfg.closure_calendar}
          onChange={(next) => patch({ closure_calendar: next })}
        />
      </Card>

      {/* Sub-hire. */}
      <Card title="Sub-hire network">
        <p className="text-[12px] text-brand-muted">
          Partner list shown when your fleet's out — trust signal + covert supply guarantee.
        </p>
        <SubHireEditor value={cfg.sub_hire} onChange={(next) => patch({ sub_hire: next })} />
      </Card>

      {/* Payment gateways add-on. */}
      <Card title="Payment methods (add-on)">
        <p className="text-[12px] text-brand-muted">
          Opt-in — activate the payment methods you accept. Customers see the strip on cart +
          booking. WhatsApp-first stays default; this is layered on top so a customer can pay
          via your Stripe link / PayPal / GoCardless / BACS after we confirm.
        </p>
        <PaymentGatewaysEditor
          value={cfg.payment_gateways}
          onChange={(next) => patch({ payment_gateways: next })}
        />
      </Card>

      {/* Custom copy. */}
      <Card title="Custom copy (optional)">
        <label className="block">
          <span className="text-[10px] font-bold uppercase tracking-widest text-brand-muted">
            Extra sentence rendered under the hero
          </span>
          <textarea
            value={cfg.custom_note}
            onChange={(e) => patch({ custom_note: e.target.value })}
            rows={3}
            placeholder="e.g. Family-run yard on the outskirts of Hull. 24/7 breakdown line on every hire."
            className="mt-1 w-full rounded-md border border-brand-line bg-brand-bg px-3 py-2 text-[13px] text-brand-text outline-none focus:border-brand-accent"
            maxLength={800}
          />
        </label>
      </Card>

      {/* Save. */}
      <div className="flex items-center gap-3 border-t border-brand-line pt-4">
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="inline-flex h-12 items-center rounded-xl px-6 text-[13px] font-extrabold uppercase tracking-widest text-black transition hover:opacity-90 disabled:opacity-60"
          style={{ background: "#FFB300" }}
        >
          {saving ? "Saving…" : "Save plant hire"}
        </button>
        {toast && <p className="text-[12px] font-bold text-brand-muted">{toast}</p>}
      </div>
    </section>
  );
}

function PlantHireReadinessBar({
  cfg,
  onLoadDemo
}: {
  cfg: PlantHireConfig;
  onLoadDemo: () => void;
}) {
  // Simple, honest scoring — 15 concrete checks the merchant can complete.
  const enabledCats = Object.values(cfg.categories).filter((c) => c?.enabled).length;
  const checks: { key: string; label: string; done: boolean }[] = [
    { key: "cats", label: "At least 3 machine categories enabled", done: enabledCats >= 3 },
    { key: "modes", label: "Delivery / collect / operator mode picked", done: cfg.modes.delivery || cfg.modes.collect || cfg.modes.operator },
    { key: "zones", label: "Delivery zones added", done: cfg.delivery_zones.length > 0 },
    { key: "banner", label: "Banner image uploaded", done: cfg.banner_image_url.length > 0 },
    { key: "note", label: "Custom copy set", done: cfg.custom_note.length > 20 },
    { key: "breakdown", label: "24/7 breakdown service enabled", done: cfg.breakdown_service.enabled },
    { key: "haulage", label: "Haulage wizard enabled", done: cfg.haulage_service.enabled },
    { key: "team", label: "Meet-the-team enabled", done: cfg.team.enabled && cfg.team.members.length > 0 },
    { key: "trust", label: "Trust signals + accreditations set", done: cfg.trust_signals.enabled && cfg.trust_signals.accreditations.length > 0 },
    { key: "parts", label: "Trade counter enabled", done: cfg.parts_counter.enabled },
    { key: "trade_acc", label: "Trade accounts enabled", done: cfg.trade_accounts.enabled },
    { key: "careers", label: "Careers / We're hiring enabled", done: cfg.driver_recruitment.enabled },
    { key: "video", label: "Video centre — at least 1 video", done: cfg.video_center.enabled && cfg.video_center.videos.length > 0 },
    { key: "calc", label: "Site services calculator enabled", done: cfg.site_calculator.enabled },
    { key: "finder", label: "Machine finder wizard enabled", done: cfg.machine_finder.enabled }
  ];
  const doneCount = checks.filter((c) => c.done).length;
  const total = checks.length;
  const pct = Math.round((doneCount / total) * 100);
  const rating =
    pct >= 90 ? "Live-ready" : pct >= 70 ? "Nearly there" : pct >= 40 ? "Coming along" : "Just starting";
  const barColor = pct >= 90 ? "#10B981" : pct >= 70 ? "#FFB300" : pct >= 40 ? "#F59E0B" : "#DC2626";
  return (
    <div className="rounded-2xl border-2 border-brand-line bg-brand-surface p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-brand-accent">
            Go-live readiness · {rating}
          </p>
          <p className="mt-1 text-[16px] font-extrabold text-brand-text">
            {doneCount} of {total} sections configured · {pct}%
          </p>
          <p className="mt-1 text-[11px] text-brand-muted">
            Every section is optional — tick as many as suit your yard. New here? Load our demo
            template to pre-fill sensible defaults, then edit anything you want.
          </p>
        </div>
        <button
          type="button"
          onClick={onLoadDemo}
          className="inline-flex h-10 items-center rounded-lg bg-brand-accent px-3 text-[11px] font-extrabold uppercase tracking-widest text-black transition hover:brightness-95"
        >
          ⚡ Load demo template
        </button>
      </div>
      <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-brand-line">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${pct}%`, background: barColor }}
        />
      </div>
      <details className="mt-3">
        <summary className="cursor-pointer text-[10px] font-extrabold uppercase tracking-widest text-brand-muted hover:text-brand-text">
          Show checklist
        </summary>
        <ul className="mt-2 grid grid-cols-1 gap-1 sm:grid-cols-2">
          {checks.map((c) => (
            <li
              key={c.key}
              className={`flex items-start gap-2 rounded-md px-2 py-1 text-[11px] ${
                c.done ? "text-brand-text" : "text-brand-muted"
              }`}
            >
              <span
                aria-hidden="true"
                className={`mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full text-[9px] font-extrabold ${
                  c.done ? "bg-emerald-500 text-white" : "bg-brand-line text-brand-muted"
                }`}
              >
                {c.done ? "✓" : "○"}
              </span>
              {c.label}
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}

function applyDemoTemplate(cfg: PlantHireConfig): PlantHireConfig {
  // Fill empty fields with sensible starter content the merchant can
  // edit. Never overwrites values the merchant has already set.
  const setIfEmpty = (v: string, fallback: string) => (v && v.length > 0 ? v : fallback);
  return {
    ...cfg,
    custom_note: setIfEmpty(
      cfg.custom_note,
      "Family-run yard on the outskirts of town. Same-day local delivery, 24/7 breakdown line on every hire."
    ),
    trust_benefits:
      cfg.trust_benefits.length > 0
        ? cfg.trust_benefits
        : TRUST_BENEFITS_PRESET.map((b) => ({ ...b })),
    delivery_zones:
      cfg.delivery_zones.length > 0
        ? cfg.delivery_zones
        : DELIVERY_ZONES_PRESET.map((z) => ({ ...z })),
    waiver_options:
      cfg.waiver_options.length > 0
        ? cfg.waiver_options
        : WAIVER_OPTIONS_PRESET.map((w) => ({ ...w })),
    bulk_tiers:
      cfg.bulk_tiers.length > 0 ? cfg.bulk_tiers : BULK_TIERS_PRESET.map((t) => ({ ...t })),
    trade_customers:
      cfg.trade_customers.length > 0
        ? cfg.trade_customers
        : TRADE_CUSTOMERS_PRESET.slice(),
    plant_brands:
      cfg.plant_brands.length > 0
        ? cfg.plant_brands
        : PLANT_BRANDS_PRESET.map((b) => ({ ...b })),
    faq: cfg.faq.length > 0 ? cfg.faq : FAQ_PRESET.map((f) => ({ ...f })),
    breakdown_service: {
      ...cfg.breakdown_service,
      enabled: true
    },
    haulage_service: {
      ...cfg.haulage_service,
      enabled: true,
      own_fleet_enabled: true
    },
    machine_finder: {
      ...cfg.machine_finder,
      enabled: true
    },
    site_calculator: {
      ...cfg.site_calculator,
      enabled: true
    },
    repeat_ladder: {
      ...cfg.repeat_ladder,
      enabled: true
    },
    notify_when_free: {
      ...cfg.notify_when_free,
      enabled: true
    },
    trust_signals: {
      ...cfg.trust_signals,
      enabled: true
    },
    trade_accounts: {
      ...cfg.trade_accounts,
      enabled: true
    },
    driver_recruitment: {
      ...cfg.driver_recruitment,
      enabled: true
    },
    parts_counter: {
      ...cfg.parts_counter,
      enabled: true
    },
    compliance_info: {
      ...cfg.compliance_info,
      enabled: true
    },
    cdm_pack: {
      ...cfg.cdm_pack,
      enabled: true
    },
    sub_hire: {
      ...cfg.sub_hire,
      enabled: true
    },
    team: {
      ...cfg.team,
      enabled: true
    },
    closure_calendar: {
      ...cfg.closure_calendar,
      enabled: true
    },
    bulk_quote: {
      ...cfg.bulk_quote,
      enabled: true
    }
  };
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-brand-line bg-brand-surface p-4 sm:p-5">
      <h2 className="text-[15px] font-extrabold text-brand-text">{title}</h2>
      <div className="mt-3">{children}</div>
    </div>
  );
}

function ToggleRow({
  label,
  value,
  onChange
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div
      className="flex items-center gap-3 rounded-xl border border-brand-line bg-brand-bg p-3"
      style={{ borderColor: value ? "#FFB300" : undefined }}
    >
      <button
        type="button"
        onClick={() => onChange(!value)}
        aria-pressed={value}
        className="inline-flex h-8 w-14 shrink-0 items-center rounded-full border border-brand-line transition"
        style={{ background: value ? "#FFB300" : "transparent" }}
      >
        <span
          className="inline-block h-6 w-6 rounded-full bg-white shadow transition"
          style={{ transform: value ? "translateX(24px)" : "translateX(2px)" }}
        />
      </button>
      <span className="text-[12px] font-extrabold text-brand-text">{label}</span>
    </div>
  );
}

function ModeRow({
  title,
  body,
  enabled,
  onChange
}: {
  title: string;
  body: string;
  enabled: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div
      className="flex items-start gap-3 rounded-xl border border-brand-line bg-brand-bg p-3"
      style={{ borderColor: enabled ? "#FFB300" : undefined }}
    >
      <button
        type="button"
        onClick={() => onChange(!enabled)}
        aria-pressed={enabled}
        className="inline-flex h-8 w-14 shrink-0 items-center rounded-full border border-brand-line transition"
        style={{ background: enabled ? "#FFB300" : "transparent" }}
      >
        <span
          className="inline-block h-6 w-6 rounded-full bg-white shadow transition"
          style={{ transform: enabled ? "translateX(24px)" : "translateX(2px)" }}
        />
      </button>
      <div>
        <p className="text-[13px] font-extrabold text-brand-text">{title}</p>
        <p className="text-[11px] text-brand-muted">{body}</p>
      </div>
    </div>
  );
}

function PriceField({
  label,
  value,
  placeholder,
  onChange
}: {
  label: string;
  value: number | null;
  placeholder: string;
  onChange: (v: number | null) => void;
}) {
  return (
    <label className="block">
      <span className="text-[10px] font-bold uppercase tracking-widest text-brand-muted">{label}</span>
      <input
        type="number"
        min={0}
        value={value ?? ""}
        onChange={(e) => {
          const v = e.target.value;
          onChange(v === "" ? null : Number(v));
        }}
        placeholder={placeholder}
        className="mt-1 h-9 w-full rounded-md border border-brand-line bg-brand-bg px-2 font-mono text-[12px] text-brand-text outline-none focus:border-brand-accent"
      />
    </label>
  );
}

function ChipListEditor({
  items,
  onChange,
  presets,
  max,
  placeholder
}: {
  items: string[];
  onChange: (next: string[]) => void;
  presets: string[];
  max: number;
  placeholder: string;
}) {
  const [draft, setDraft] = useState("");
  function add(v: string) {
    const t = v.trim();
    if (!t || items.includes(t)) return;
    if (items.length >= max) return;
    onChange([...items, t]);
    setDraft("");
  }
  function remove(v: string) {
    onChange(items.filter((x) => x !== v));
  }
  const available = presets.filter((p) => !items.includes(p));
  return (
    <div className="mt-2 space-y-3">
      <ul className="flex flex-wrap gap-1.5">
        {items.map((it) => (
          <li
            key={it}
            className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-extrabold text-black"
            style={{ background: "#FFB300" }}
          >
            {it}
            <button
              type="button"
              onClick={() => remove(it)}
              aria-label={`Remove ${it}`}
              className="text-[13px] leading-none"
            >
              ×
            </button>
          </li>
        ))}
        {items.length === 0 && (
          <li className="text-[11px] text-brand-muted">No items yet — add one below.</li>
        )}
      </ul>
      <div className="flex gap-2">
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add(draft);
            }
          }}
          placeholder={placeholder}
          className="h-9 flex-1 rounded-md border border-brand-line bg-brand-bg px-2 text-[12px] text-brand-text outline-none focus:border-brand-accent"
        />
        <button
          type="button"
          onClick={() => add(draft)}
          disabled={items.length >= max || draft.trim().length === 0}
          className="inline-flex h-9 items-center rounded-md border border-brand-line bg-brand-surface px-3 text-[11px] font-extrabold uppercase tracking-widest text-brand-text transition hover:border-brand-accent disabled:opacity-40"
        >
          Add
        </button>
      </div>
      {available.length > 0 && (
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-brand-muted">
            Suggestions — tap to add
          </p>
          <ul className="mt-1.5 flex flex-wrap gap-1.5">
            {available.map((p) => (
              <li key={p}>
                <button
                  type="button"
                  onClick={() => add(p)}
                  disabled={items.length >= max}
                  className="inline-flex items-center rounded-full border border-brand-line bg-brand-bg px-2.5 py-1 text-[11px] font-bold text-brand-text transition hover:border-brand-accent disabled:opacity-40"
                >
                  + {p}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function BulkTiersEditor({
  tiers,
  onChange,
  presets
}: {
  tiers: PlantBulkTier[];
  onChange: (next: PlantBulkTier[]) => void;
  presets: PlantBulkTier[];
}) {
  function update(idx: number, patch: Partial<PlantBulkTier>) {
    onChange(tiers.map((t, i) => (i === idx ? { ...t, ...patch } : t)));
  }
  function remove(idx: number) {
    onChange(tiers.filter((_, i) => i !== idx));
  }
  function add() {
    onChange([...tiers, { min_period_days: 14, label: "5% off 2wk+" }]);
  }
  function loadPreset() {
    onChange(presets);
  }
  return (
    <div className="mt-2 space-y-2">
      <ul className="space-y-2">
        {tiers.map((t, i) => (
          <li
            key={i}
            className="grid grid-cols-[100px_1fr_auto] gap-2 rounded-xl border border-brand-line bg-brand-bg p-2"
          >
            <input
              type="number"
              min={1}
              value={t.min_period_days}
              onChange={(e) => update(i, { min_period_days: Number(e.target.value) || 1 })}
              className="h-9 w-full rounded-md border border-brand-line bg-brand-bg px-2 text-[12px] text-brand-text outline-none focus:border-brand-accent"
              aria-label="Minimum days"
            />
            <input
              type="text"
              value={t.label}
              onChange={(e) => update(i, { label: e.target.value })}
              placeholder="e.g. 5% off 2wk+"
              className="h-9 w-full rounded-md border border-brand-line bg-brand-bg px-2 text-[12px] text-brand-text outline-none focus:border-brand-accent"
              maxLength={60}
              aria-label="Discount label"
            />
            <button
              type="button"
              onClick={() => remove(i)}
              className="inline-flex h-9 items-center rounded-md border border-brand-line px-2 text-[10px] font-extrabold uppercase tracking-widest text-red-500 hover:text-red-300"
            >
              Delete
            </button>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={add}
          disabled={tiers.length >= 10}
          className="inline-flex h-9 items-center rounded-md border-2 border-dashed border-brand-line px-3 text-[11px] font-extrabold uppercase tracking-widest text-brand-muted hover:border-brand-accent hover:text-brand-text disabled:opacity-40"
        >
          + Add tier
        </button>
        {tiers.length === 0 && (
          <button
            type="button"
            onClick={loadPreset}
            className="inline-flex h-9 items-center rounded-md border border-brand-line bg-brand-surface px-3 text-[11px] font-extrabold uppercase tracking-widest text-brand-text hover:border-brand-accent"
          >
            Load standard tiers
          </button>
        )}
      </div>
    </div>
  );
}

function FaqEditor({
  faqs,
  onChange,
  preset
}: {
  faqs: PlantFaq[];
  onChange: (next: PlantFaq[]) => void;
  preset: PlantFaq[];
}) {
  function update(idx: number, patch: Partial<PlantFaq>) {
    onChange(faqs.map((f, i) => (i === idx ? { ...f, ...patch } : f)));
  }
  function remove(idx: number) {
    onChange(faqs.filter((_, i) => i !== idx));
  }
  function add() {
    onChange([...faqs, { q: "", a: "" }]);
  }
  function loadPreset() {
    onChange(preset);
  }
  return (
    <div className="mt-2 space-y-3">
      <ul className="space-y-2">
        {faqs.map((f, i) => (
          <li key={i} className="rounded-xl border border-brand-line bg-brand-bg p-3">
            <div className="flex items-start gap-2">
              <div className="flex-1 space-y-2">
                <input
                  type="text"
                  value={f.q}
                  onChange={(e) => update(i, { q: e.target.value })}
                  placeholder="Question"
                  className="h-9 w-full rounded-md border border-brand-line bg-brand-bg px-2 text-[13px] font-extrabold text-brand-text outline-none focus:border-brand-accent"
                  maxLength={200}
                />
                <textarea
                  value={f.a}
                  onChange={(e) => update(i, { a: e.target.value })}
                  placeholder="Answer"
                  rows={3}
                  className="w-full rounded-md border border-brand-line bg-brand-bg px-2 py-2 text-[12px] text-brand-text outline-none focus:border-brand-accent"
                  maxLength={1200}
                />
              </div>
              <button
                type="button"
                onClick={() => remove(i)}
                className="text-[10px] font-extrabold uppercase tracking-widest text-red-500 hover:text-red-300"
              >
                Delete
              </button>
            </div>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={add}
          disabled={faqs.length >= 20}
          className="inline-flex h-9 items-center rounded-md border-2 border-dashed border-brand-line px-3 text-[11px] font-extrabold uppercase tracking-widest text-brand-muted hover:border-brand-accent hover:text-brand-text disabled:opacity-40"
        >
          + Add FAQ
        </button>
        {faqs.length === 0 && (
          <button
            type="button"
            onClick={loadPreset}
            className="inline-flex h-9 items-center rounded-md border border-brand-line bg-brand-surface px-3 text-[11px] font-extrabold uppercase tracking-widest text-brand-text hover:border-brand-accent"
          >
            Load 10 preset questions
          </button>
        )}
      </div>
    </div>
  );
}

function PlantBrandsEditor({
  brands,
  onChange,
  presets
}: {
  brands: PlantBrand[];
  onChange: (next: PlantBrand[]) => void;
  presets: PlantBrand[];
}) {
  const [uploadingIdx, setUploadingIdx] = useState<number | null>(null);

  function update(idx: number, patch: Partial<PlantBrand>) {
    onChange(brands.map((b, i) => (i === idx ? { ...b, ...patch } : b)));
  }
  function remove(idx: number) {
    onChange(brands.filter((_, i) => i !== idx));
  }
  function add(brand?: PlantBrand) {
    if (brand) {
      if (brands.some((b) => b.name.toLowerCase() === brand.name.toLowerCase())) return;
      onChange([...brands, brand]);
    } else {
      onChange([...brands, { name: "", logo_url: null }]);
    }
  }
  function loadPreset() {
    onChange(presets);
  }
  async function upload(idx: number, file: File) {
    setUploadingIdx(idx);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/trade-off/upload-photo", { method: "POST", body: form });
      const j = (await res.json()) as { ok?: boolean; url?: string };
      if (j.ok && j.url) update(idx, { logo_url: j.url });
    } finally {
      setUploadingIdx(null);
    }
  }
  const available = presets.filter(
    (p) => !brands.some((b) => b.name.toLowerCase() === p.name.toLowerCase())
  );
  return (
    <div className="mt-2 space-y-3">
      <ul className="space-y-2">
        {brands.map((b, idx) => (
          <li
            key={idx}
            className="grid grid-cols-[64px_1fr_auto] items-center gap-2 rounded-xl border border-brand-line bg-brand-bg p-2"
          >
            <span className="grid h-14 w-14 place-items-center overflow-hidden rounded-lg border border-brand-line bg-white">
              {b.logo_url ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={b.logo_url} alt="" className="max-h-full max-w-full object-contain" />
              ) : (
                <span className="text-[9px] font-extrabold uppercase tracking-widest text-brand-muted">
                  {b.name.slice(0, 3) || "?"}
                </span>
              )}
            </span>
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <input
                type="text"
                value={b.name}
                onChange={(e) => update(idx, { name: e.target.value })}
                placeholder="Brand name"
                className="h-9 w-full rounded-md border border-brand-line bg-brand-bg px-2 text-[12px] font-extrabold text-brand-text outline-none focus:border-brand-accent"
                maxLength={40}
              />
              <div className="flex gap-1">
                <input
                  type="url"
                  value={b.logo_url ?? ""}
                  onChange={(e) => update(idx, { logo_url: e.target.value.trim() || null })}
                  placeholder="Logo URL"
                  className="h-8 min-w-0 flex-1 rounded-md border border-brand-line bg-brand-bg px-2 font-mono text-[10px] text-brand-text outline-none focus:border-brand-accent"
                />
                <label className="inline-flex h-8 shrink-0 cursor-pointer items-center rounded-md border border-brand-line bg-brand-surface px-2 text-[9px] font-extrabold uppercase tracking-widest text-brand-muted hover:border-brand-accent hover:text-brand-text">
                  {uploadingIdx === idx ? "…" : "Upload"}
                  <input
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) upload(idx, f);
                    }}
                  />
                </label>
              </div>
            </div>
            <button
              type="button"
              onClick={() => remove(idx)}
              className="text-[10px] font-extrabold uppercase tracking-widest text-red-500 hover:text-red-300"
            >
              Delete
            </button>
          </li>
        ))}
        {brands.length === 0 && (
          <li className="text-[11px] text-brand-muted">No brands yet — tap &ldquo;Load standard brands&rdquo; or add your own.</li>
        )}
      </ul>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => add()}
          disabled={brands.length >= 20}
          className="inline-flex h-9 items-center rounded-md border-2 border-dashed border-brand-line px-3 text-[11px] font-extrabold uppercase tracking-widest text-brand-muted hover:border-brand-accent hover:text-brand-text disabled:opacity-40"
        >
          + Add brand
        </button>
        {brands.length === 0 && (
          <button
            type="button"
            onClick={loadPreset}
            className="inline-flex h-9 items-center rounded-md border border-brand-line bg-brand-surface px-3 text-[11px] font-extrabold uppercase tracking-widest text-brand-text hover:border-brand-accent"
          >
            Load standard brands
          </button>
        )}
      </div>
      {available.length > 0 && (
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-brand-muted">
            Suggestions — tap to add
          </p>
          <ul className="mt-1.5 flex flex-wrap gap-1.5">
            {available.map((p) => (
              <li key={p.name}>
                <button
                  type="button"
                  onClick={() => add(p)}
                  disabled={brands.length >= 20}
                  className="inline-flex items-center gap-1 rounded-full border border-brand-line bg-brand-bg px-2.5 py-1 text-[11px] font-bold text-brand-text hover:border-brand-accent disabled:opacity-40"
                >
                  {p.logo_url && (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={p.logo_url} alt="" className="h-4 w-4 object-contain" />
                  )}
                  + {p.name}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function WaiverOptionsEditor({
  items,
  onChange,
  presets
}: {
  items: PlantWaiverOption[];
  onChange: (next: PlantWaiverOption[]) => void;
  presets: PlantWaiverOption[];
}) {
  function update(idx: number, patch: Partial<PlantWaiverOption>) {
    onChange(items.map((w, i) => (i === idx ? { ...w, ...patch } : w)));
  }
  function remove(idx: number) {
    onChange(items.filter((_, i) => i !== idx));
  }
  function add() {
    onChange([...items, { slug: "", label: "", price_day_pence: null, excess_pence: null, note: "" }]);
  }
  function loadPreset() {
    onChange(presets);
  }
  return (
    <div className="mt-2 space-y-2">
      <ul className="space-y-2">
        {items.map((w, i) => (
          <li key={i} className="rounded-xl border border-brand-line bg-brand-bg p-3">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <label className="block">
                <span className="text-[10px] font-bold uppercase tracking-widest text-brand-muted">Slug (internal)</span>
                <input
                  type="text"
                  value={w.slug}
                  onChange={(e) => update(i, { slug: e.target.value.replace(/[^a-z0-9_]/gi, "_").toLowerCase() })}
                  placeholder="theft_only"
                  className="mt-1 h-9 w-full rounded-md border border-brand-line bg-brand-bg px-2 font-mono text-[11px] text-brand-text outline-none focus:border-brand-accent"
                  maxLength={40}
                />
              </label>
              <label className="block">
                <span className="text-[10px] font-bold uppercase tracking-widest text-brand-muted">Label</span>
                <input
                  type="text"
                  value={w.label}
                  onChange={(e) => update(i, { label: e.target.value })}
                  placeholder="Theft-only cover"
                  className="mt-1 h-9 w-full rounded-md border border-brand-line bg-brand-bg px-2 text-[12px] text-brand-text outline-none focus:border-brand-accent"
                  maxLength={80}
                />
              </label>
              <label className="block">
                <span className="text-[10px] font-bold uppercase tracking-widest text-brand-muted">Price (pence/day)</span>
                <input
                  type="number"
                  min={0}
                  value={w.price_day_pence ?? ""}
                  onChange={(e) => {
                    const v = e.target.value;
                    update(i, { price_day_pence: v === "" ? null : Number(v) });
                  }}
                  className="mt-1 h-9 w-full rounded-md border border-brand-line bg-brand-bg px-2 font-mono text-[12px] text-brand-text outline-none focus:border-brand-accent"
                />
              </label>
              <label className="block">
                <span className="text-[10px] font-bold uppercase tracking-widest text-brand-muted">Excess (pence)</span>
                <input
                  type="number"
                  min={0}
                  value={w.excess_pence ?? ""}
                  onChange={(e) => {
                    const v = e.target.value;
                    update(i, { excess_pence: v === "" ? null : Number(v) });
                  }}
                  className="mt-1 h-9 w-full rounded-md border border-brand-line bg-brand-bg px-2 font-mono text-[12px] text-brand-text outline-none focus:border-brand-accent"
                />
              </label>
            </div>
            <label className="mt-2 block">
              <span className="text-[10px] font-bold uppercase tracking-widest text-brand-muted">Note</span>
              <textarea
                value={w.note}
                onChange={(e) => update(i, { note: e.target.value })}
                rows={2}
                className="mt-1 w-full rounded-md border border-brand-line bg-brand-bg px-2 py-1.5 text-[12px] text-brand-text outline-none focus:border-brand-accent"
                maxLength={300}
              />
            </label>
            <div className="mt-2 flex justify-end">
              <button
                type="button"
                onClick={() => remove(i)}
                className="text-[10px] font-extrabold uppercase tracking-widest text-red-500 hover:text-red-300"
              >
                Delete
              </button>
            </div>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={add}
          disabled={items.length >= 6}
          className="inline-flex h-9 items-center rounded-md border-2 border-dashed border-brand-line px-3 text-[11px] font-extrabold uppercase tracking-widest text-brand-muted hover:border-brand-accent hover:text-brand-text disabled:opacity-40"
        >
          + Add waiver option
        </button>
        {items.length === 0 && (
          <button
            type="button"
            onClick={loadPreset}
            className="inline-flex h-9 items-center rounded-md border border-brand-line bg-brand-surface px-3 text-[11px] font-extrabold uppercase tracking-widest text-brand-text hover:border-brand-accent"
          >
            Load 3 standard options
          </button>
        )}
      </div>
    </div>
  );
}

function DeliveryZonesEditor({
  items,
  onChange,
  presets
}: {
  items: PlantDeliveryZone[];
  onChange: (next: PlantDeliveryZone[]) => void;
  presets: PlantDeliveryZone[];
}) {
  function update(idx: number, patch: Partial<PlantDeliveryZone>) {
    onChange(items.map((z, i) => (i === idx ? { ...z, ...patch } : z)));
  }
  function remove(idx: number) {
    onChange(items.filter((_, i) => i !== idx));
  }
  function add() {
    onChange([...items, { label: "", free_radius_miles: null, price_per_mile_pence: null, fixed_price_pence: null, note: "" }]);
  }
  function loadPreset() {
    onChange(presets);
  }
  return (
    <div className="mt-2 space-y-2">
      <ul className="space-y-2">
        {items.map((z, i) => (
          <li key={i} className="rounded-xl border border-brand-line bg-brand-bg p-3">
            <label className="block">
              <span className="text-[10px] font-bold uppercase tracking-widest text-brand-muted">Zone label</span>
              <input
                type="text"
                value={z.label}
                onChange={(e) => update(i, { label: e.target.value })}
                placeholder="e.g. Local (10 miles from yard)"
                className="mt-1 h-9 w-full rounded-md border border-brand-line bg-brand-bg px-2 text-[12px] text-brand-text outline-none focus:border-brand-accent"
                maxLength={80}
              />
            </label>
            <div className="mt-2 grid grid-cols-3 gap-2">
              <PriceField
                label="Free radius (miles)"
                value={z.free_radius_miles}
                placeholder="10"
                onChange={(v) => update(i, { free_radius_miles: v })}
              />
              <PriceField
                label="Per mile (pence)"
                value={z.price_per_mile_pence}
                placeholder="250"
                onChange={(v) => update(i, { price_per_mile_pence: v })}
              />
              <PriceField
                label="Fixed price (pence)"
                value={z.fixed_price_pence}
                placeholder="0"
                onChange={(v) => update(i, { fixed_price_pence: v })}
              />
            </div>
            <label className="mt-2 block">
              <span className="text-[10px] font-bold uppercase tracking-widest text-brand-muted">Note</span>
              <input
                type="text"
                value={z.note}
                onChange={(e) => update(i, { note: e.target.value })}
                placeholder="e.g. Free within 10 miles both ways"
                className="mt-1 h-9 w-full rounded-md border border-brand-line bg-brand-bg px-2 text-[12px] text-brand-text outline-none focus:border-brand-accent"
                maxLength={200}
              />
            </label>
            <div className="mt-2 flex justify-end">
              <button
                type="button"
                onClick={() => remove(i)}
                className="text-[10px] font-extrabold uppercase tracking-widest text-red-500 hover:text-red-300"
              >
                Delete
              </button>
            </div>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={add}
          disabled={items.length >= 8}
          className="inline-flex h-9 items-center rounded-md border-2 border-dashed border-brand-line px-3 text-[11px] font-extrabold uppercase tracking-widest text-brand-muted hover:border-brand-accent hover:text-brand-text disabled:opacity-40"
        >
          + Add zone
        </button>
        {items.length === 0 && (
          <button
            type="button"
            onClick={loadPreset}
            className="inline-flex h-9 items-center rounded-md border border-brand-line bg-brand-surface px-3 text-[11px] font-extrabold uppercase tracking-widest text-brand-text hover:border-brand-accent"
          >
            Load 3 standard zones
          </button>
        )}
      </div>
    </div>
  );
}

function HeadingField({
  label,
  placeholder,
  value,
  onChange,
  max = 80
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  max?: number;
}) {
  return (
    <label className="block">
      <span className="text-[10px] font-bold uppercase tracking-widest text-brand-muted">{label}</span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        maxLength={max}
        className="mt-1 h-10 w-full rounded-md border border-brand-line bg-brand-bg px-3 text-[13px] text-brand-text outline-none focus:border-brand-accent"
      />
    </label>
  );
}

function ModeBodyField({
  label,
  value,
  placeholder,
  onChange
}: {
  label: string;
  value: string;
  placeholder: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-[10px] font-bold uppercase tracking-widest text-brand-muted">{label}</span>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={2}
        placeholder={placeholder}
        className="mt-1 w-full rounded-md border border-brand-line bg-brand-bg px-3 py-2 text-[12px] text-brand-text outline-none focus:border-brand-accent"
        maxLength={400}
      />
    </label>
  );
}

function SpecsEditor({
  specs,
  onChange
}: {
  specs: PlantSpec;
  onChange: (next: PlantSpec) => void;
}) {
  function upd(patch: Partial<PlantSpec>) {
    onChange({ ...specs, ...patch });
  }
  const fields: {
    key: keyof PlantSpec;
    label: string;
    unit: string;
    max?: number;
  }[] = [
    { key: "weight_kg", label: "Operating weight", unit: "kg" },
    { key: "hp", label: "Horsepower", unit: "hp" },
    { key: "dig_depth_mm", label: "Max dig depth", unit: "mm" },
    { key: "reach_mm", label: "Max reach", unit: "mm" },
    { key: "bucket_l", label: "Bucket capacity", unit: "L" },
    { key: "transport_length_mm", label: "Transport length", unit: "mm" },
    { key: "transport_width_mm", label: "Transport width", unit: "mm" },
    { key: "transport_height_mm", label: "Transport height", unit: "mm" }
  ];
  return (
    <div className="rounded-md border border-brand-line bg-brand-bg p-2">
      <p className="text-[10px] font-extrabold uppercase tracking-widest text-brand-muted">Technical specs</p>
      <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {fields.map((f) => (
          <label key={f.key} className="block">
            <span className="text-[9px] font-bold uppercase tracking-widest text-brand-muted">
              {f.label} ({f.unit})
            </span>
            <input
              type="number"
              min={0}
              value={(specs[f.key] as number | null | undefined) ?? ""}
              onChange={(e) => {
                const v = e.target.value;
                upd({ [f.key]: v === "" ? null : Number(v) } as Partial<PlantSpec>);
              }}
              className="mt-1 h-8 w-full rounded-md border border-brand-line bg-brand-bg px-2 font-mono text-[11px] text-brand-text outline-none focus:border-brand-accent"
            />
          </label>
        ))}
        <label className="block">
          <span className="text-[9px] font-bold uppercase tracking-widest text-brand-muted">Fuel type</span>
          <select
            value={specs.fuel_type ?? ""}
            onChange={(e) => upd({ fuel_type: e.target.value as PlantSpec["fuel_type"] })}
            className="mt-1 h-8 w-full rounded-md border border-brand-line bg-brand-bg px-2 text-[11px] text-brand-text outline-none focus:border-brand-accent"
          >
            <option value="">—</option>
            <option value="diesel">Diesel</option>
            <option value="petrol">Petrol</option>
            <option value="electric">Electric</option>
            <option value="hybrid">Hybrid</option>
          </select>
        </label>
        <label className="block">
          <span className="text-[9px] font-bold uppercase tracking-widest text-brand-muted">Emission standard</span>
          <select
            value={specs.emission ?? ""}
            onChange={(e) => upd({ emission: e.target.value as PlantSpec["emission"] })}
            className="mt-1 h-8 w-full rounded-md border border-brand-line bg-brand-bg px-2 text-[11px] text-brand-text outline-none focus:border-brand-accent"
          >
            <option value="">—</option>
            <option value="stage_v">Stage V</option>
            <option value="stage_iiib">Stage IIIB</option>
            <option value="euro_6">Euro 6</option>
          </select>
        </label>
      </div>
    </div>
  );
}

function GalleryEditor({
  urls,
  onChange
}: {
  urls: string[];
  onChange: (next: string[]) => void;
}) {
  const [uploadingIdx, setUploadingIdx] = useState<number | null>(null);
  function upd(idx: number, v: string) {
    onChange(urls.map((u, i) => (i === idx ? v : u)));
  }
  function remove(idx: number) {
    onChange(urls.filter((_, i) => i !== idx));
  }
  function add() {
    onChange([...urls, ""]);
  }
  async function upload(idx: number, file: File) {
    setUploadingIdx(idx);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/trade-off/upload-photo", { method: "POST", body: form });
      const j = (await res.json()) as { ok?: boolean; url?: string };
      if (j.ok && j.url) upd(idx, j.url);
    } finally {
      setUploadingIdx(null);
    }
  }
  return (
    <div className="rounded-md border border-brand-line bg-brand-bg p-2">
      <p className="text-[10px] font-extrabold uppercase tracking-widest text-brand-muted">
        Gallery images (max 5) — extra shots beyond the cover
      </p>
      <ul className="mt-2 space-y-2">
        {urls.map((u, i) => (
          <li key={i} className="grid grid-cols-[80px_1fr_auto] items-center gap-2">
            <span className="grid h-16 w-16 place-items-center overflow-hidden rounded-md border border-brand-line bg-white">
              {u ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={u} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="text-[9px] font-extrabold uppercase text-brand-muted">Empty</span>
              )}
            </span>
            <div className="flex flex-col gap-1">
              <input
                type="url"
                value={u}
                onChange={(e) => upd(i, e.target.value.trim())}
                placeholder="Paste image URL"
                className="h-8 w-full rounded-md border border-brand-line bg-brand-bg px-2 font-mono text-[10px] text-brand-text outline-none focus:border-brand-accent"
              />
              <label className="inline-flex h-7 w-fit cursor-pointer items-center rounded-md border border-brand-line bg-brand-surface px-2 text-[9px] font-extrabold uppercase tracking-widest text-brand-muted hover:border-brand-accent hover:text-brand-text">
                {uploadingIdx === i ? "…" : "Upload"}
                <input
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) upload(i, f);
                  }}
                />
              </label>
            </div>
            <button
              type="button"
              onClick={() => remove(i)}
              className="text-[10px] font-extrabold uppercase tracking-widest text-red-500 hover:text-red-300"
            >
              Del
            </button>
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={add}
        disabled={urls.length >= 5}
        className="mt-2 inline-flex h-8 items-center rounded-md border-2 border-dashed border-brand-line px-2 text-[10px] font-extrabold uppercase tracking-widest text-brand-muted hover:border-brand-accent hover:text-brand-text disabled:opacity-40"
      >
        + Add image slot
      </button>
    </div>
  );
}

function UrlField({
  label,
  value,
  placeholder,
  onChange
}: {
  label: string;
  value: string;
  placeholder: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-[10px] font-bold uppercase tracking-widest text-brand-muted">{label}</span>
      <input
        type="url"
        value={value}
        onChange={(e) => onChange(e.target.value.trim())}
        placeholder={placeholder}
        className="mt-1 h-9 w-full rounded-md border border-brand-line bg-brand-bg px-2 font-mono text-[11px] text-brand-text outline-none focus:border-brand-accent"
        maxLength={800}
      />
    </label>
  );
}

function VideoUploadField({
  value,
  onChange
}: {
  value: string;
  onChange: (url: string) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [duration, setDuration] = useState<number | null>(null);

  async function onFile(file: File) {
    setError(null);
    setUploading(true);
    try {
      // Client-side duration check — Supabase can't ffprobe.
      const objectUrl = URL.createObjectURL(file);
      const vid = document.createElement("video");
      vid.preload = "metadata";
      const meta = await new Promise<{ ok: true; seconds: number } | { ok: false; error: string }>(
        (resolve) => {
          const timeout = window.setTimeout(
            () => resolve({ ok: false, error: "Couldn't read video metadata." }),
            10000
          );
          vid.onloadedmetadata = () => {
            window.clearTimeout(timeout);
            resolve({ ok: true, seconds: vid.duration });
          };
          vid.onerror = () => {
            window.clearTimeout(timeout);
            resolve({ ok: false, error: "Video file couldn't be read." });
          };
          vid.src = objectUrl;
        }
      );
      URL.revokeObjectURL(objectUrl);
      if (!meta.ok) {
        setError(meta.error);
        setUploading(false);
        return;
      }
      setDuration(meta.seconds);
      if (meta.seconds > 62) {
        setError(
          `Video is ${Math.round(meta.seconds)}s — trim to 60s or less before uploading.`
        );
        setUploading(false);
        return;
      }
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/trade-off/upload-video", { method: "POST", body: form });
      const j = (await res.json()) as { ok?: boolean; url?: string; error?: string };
      if (!res.ok || !j.ok || !j.url) {
        setError(j.error ?? "Upload failed");
        setUploading(false);
        return;
      }
      onChange(j.url);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="rounded-md border border-brand-line bg-brand-bg p-2">
      <span className="text-[10px] font-bold uppercase tracking-widest text-brand-muted">
        Walkaround video (max 60s, hosted on our Supabase)
      </span>
      <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
        <label className="inline-flex h-9 shrink-0 cursor-pointer items-center gap-1 rounded-md border border-brand-line bg-brand-surface px-3 text-[10px] font-extrabold uppercase tracking-widest text-brand-muted transition hover:border-brand-accent hover:text-brand-text">
          {uploading ? "Uploading…" : "Upload video"}
          <input
            type="file"
            accept="video/mp4,video/quicktime,video/webm"
            className="sr-only"
            disabled={uploading}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onFile(f);
            }}
          />
        </label>
        <input
          type="url"
          value={value}
          onChange={(e) => onChange(e.target.value.trim())}
          placeholder="…or paste a public URL"
          className="h-9 min-w-0 flex-1 rounded-md border border-brand-line bg-brand-bg px-2 font-mono text-[11px] text-brand-text outline-none focus:border-brand-accent"
          maxLength={800}
        />
      </div>
      {value && (
        <p className="mt-2 truncate text-[10px] font-mono text-brand-muted">✓ {value}</p>
      )}
      {duration !== null && !error && (
        <p className="mt-1 text-[10px] text-brand-muted">
          Uploaded video: {Math.round(duration)}s.
        </p>
      )}
      {error && (
        <p className="mt-1 rounded-md bg-red-50 px-2 py-1 text-[10px] font-bold text-red-700">
          {error}
        </p>
      )}
      <p className="mt-1 text-[10px] text-brand-muted">
        MP4 / MOV / WebM. Max 60 seconds, 30MB. Server rejects longer/larger files.
      </p>
    </div>
  );
}

function BreakdownServiceEditor({
  value,
  onChange
}: {
  value: PlantBreakdownService;
  onChange: (next: PlantBreakdownService) => void;
}) {
  function patch(p: Partial<PlantBreakdownService>) {
    onChange({ ...value, ...p });
  }
  function patchPay(p: Partial<PlantBreakdownService["payment_options"]>) {
    onChange({ ...value, payment_options: { ...value.payment_options, ...p } });
  }

  return (
    <div className="mt-3 space-y-4">
      <ToggleRow
        label="Enable breakdown service"
        value={value.enabled}
        onChange={(v) => patch({ enabled: v })}
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <ToggleRow
          label="Support customer's own machine"
          value={value.own_machine_supported}
          onChange={(v) => patch({ own_machine_supported: v })}
        />
        <ToggleRow
          label="Support 3rd-party machines on-site"
          value={value.third_party_supported}
          onChange={(v) => patch({ third_party_supported: v })}
        />
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <PriceField
          label="Callout fee (pence)"
          value={value.callout_fee_pence}
          placeholder="12500"
          onChange={(v) => patch({ callout_fee_pence: v })}
        />
        <PriceField
          label="Hourly rate (pence)"
          value={value.hourly_rate_pence}
          placeholder="8500"
          onChange={(v) => patch({ hourly_rate_pence: v })}
        />
        <PriceField
          label="Minimum hours"
          value={value.minimum_callout_hours}
          placeholder="1"
          onChange={(v) => patch({ minimum_callout_hours: v })}
        />
        <PriceField
          label="Parts markup %"
          value={value.parts_markup_percent}
          placeholder="15"
          onChange={(v) => patch({ parts_markup_percent: v })}
        />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <PriceField
          label="Local SLA (hours)"
          value={value.sla_local_hours}
          placeholder="4"
          onChange={(v) => patch({ sla_local_hours: v })}
        />
        <PriceField
          label="National SLA (hours)"
          value={value.sla_national_hours}
          placeholder="24"
          onChange={(v) => patch({ sla_national_hours: v })}
        />
      </div>

      <div>
        <p className="text-[11px] font-extrabold uppercase tracking-widest text-brand-muted">
          Payment methods you accept
        </p>
        <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <ToggleRow
            label="Card pre-auth before dispatch"
            value={value.payment_options.card_before_dispatch}
            onChange={(v) => patchPay({ card_before_dispatch: v })}
          />
          <ToggleRow
            label="Card payment after fix"
            value={value.payment_options.card_after_fix}
            onChange={(v) => patchPay({ card_after_fix: v })}
          />
          <ToggleRow
            label="Cash on completion"
            value={value.payment_options.cash_on_fix}
            onChange={(v) => patchPay({ cash_on_fix: v })}
          />
          <ToggleRow
            label="Trade account (30 days)"
            value={value.payment_options.trade_account}
            onChange={(v) => patchPay({ trade_account: v })}
          />
        </div>
      </div>

      <label className="block">
        <span className="text-[10px] font-bold uppercase tracking-widest text-brand-muted">
          Terms of service (shown before submit — max 2000 chars)
        </span>
        <textarea
          value={value.terms_of_service}
          onChange={(e) => patch({ terms_of_service: e.target.value })}
          rows={6}
          placeholder="e.g. By submitting this report you accept the following: (1) our technician will attend within the SLA shown; (2) chargeable work is billed at the hourly rate + minimum callout, plus parts at cost + markup; (3) hire customers within warranty pay nothing subject to fair-use; (4) operator misuse (out of fuel, ignored warnings) is chargeable regardless of hire status."
          className="mt-1 w-full rounded-md border border-brand-line bg-brand-bg px-3 py-2 text-[12px] text-brand-text outline-none focus:border-brand-accent"
          maxLength={2000}
        />
      </label>
    </div>
  );
}

function TrustBenefitsEditor({
  items,
  onChange
}: {
  items: { label: string; url: string }[];
  onChange: (next: { label: string; url: string }[]) => void;
}) {
  function upd(idx: number, p: Partial<{ label: string; url: string }>) {
    onChange(items.map((b, i) => (i === idx ? { ...b, ...p } : b)));
  }
  function remove(idx: number) {
    onChange(items.filter((_, i) => i !== idx));
  }
  function addFrom(preset: { label: string; url: string }) {
    if (items.length >= 16) return;
    onChange([...items, preset]);
  }
  return (
    <div className="space-y-3">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-brand-muted">
          Presets — tap to add
        </p>
        <div className="mt-1 flex flex-wrap gap-1">
          {TRUST_BENEFITS_PRESET.map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={() => addFrom({ label: p.label, url: "" })}
              className="inline-flex h-7 items-center rounded-full border border-brand-line bg-brand-bg px-2 text-[10px] font-bold text-brand-muted hover:bg-brand-accent hover:text-black"
            >
              + {p.label}
            </button>
          ))}
        </div>
      </div>
      <ul className="space-y-2">
        {items.map((b, i) => (
          <li key={i} className="rounded-md border border-brand-line bg-brand-bg p-2">
            <div className="mb-1 flex items-center justify-between">
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-brand-muted">
                Benefit #{i + 1}
              </span>
              <button
                type="button"
                onClick={() => remove(i)}
                className="text-[10px] font-extrabold uppercase tracking-widest text-red-500 hover:text-red-300"
              >
                Del
              </button>
            </div>
            <label className="block">
              <span className="text-[10px] font-bold uppercase tracking-widest text-brand-muted">
                Label
              </span>
              <input
                type="text"
                value={b.label}
                onChange={(e) => upd(i, { label: e.target.value })}
                maxLength={60}
                className="mt-1 h-9 w-full rounded-md border border-brand-line bg-brand-bg px-2 text-[12px] text-brand-text outline-none focus:border-brand-accent"
              />
            </label>
            <label className="mt-1 block">
              <span className="text-[10px] font-bold uppercase tracking-widest text-brand-muted">
                Link URL (optional)
              </span>
              <input
                type="text"
                value={b.url}
                onChange={(e) => upd(i, { url: e.target.value })}
                maxLength={800}
                placeholder="/plant-hire/breakdown  or  https://…"
                className="mt-1 h-9 w-full rounded-md border border-brand-line bg-brand-bg px-2 text-[12px] text-brand-text outline-none focus:border-brand-accent"
              />
            </label>
          </li>
        ))}
      </ul>
      {items.length === 0 && (
        <p className="text-[11px] text-brand-muted">No benefits yet — tap a preset above.</p>
      )}
    </div>
  );
}

function HaulageServiceEditor({
  value,
  onChange
}: {
  value: PlantHaulageService;
  onChange: (next: PlantHaulageService) => void;
}) {
  function patch(p: Partial<PlantHaulageService>) {
    onChange({ ...value, ...p });
  }
  function patchBand(idx: number, p: Partial<HaulageTrailerBand>) {
    onChange({
      ...value,
      trailer_bands: value.trailer_bands.map((b, i) => (i === idx ? { ...b, ...p } : b))
    });
  }
  return (
    <div className="mt-3 space-y-4">
      <ToggleRow
        label="Enable haulage wizard"
        value={value.enabled}
        onChange={(v) => patch({ enabled: v })}
      />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <ToggleRow
          label="Product A — hire + delivery"
          value={value.own_fleet_enabled}
          onChange={(v) => patch({ own_fleet_enabled: v })}
        />
        <ToggleRow
          label="Product B — third-party moves"
          value={value.third_party_enabled}
          onChange={(v) => patch({ third_party_enabled: v })}
        />
      </div>

      <div>
        <p className="text-[11px] font-extrabold uppercase tracking-widest text-brand-muted">
          Product A — hire delivery rates
        </p>
        <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
          <PriceField
            label="First-mile fee (pence)"
            value={value.delivery_first_mile_pence}
            placeholder="5000"
            onChange={(v) => patch({ delivery_first_mile_pence: v })}
          />
          <PriceField
            label="Per-mile (pence)"
            value={value.delivery_per_mile_pence}
            placeholder="250"
            onChange={(v) => patch({ delivery_per_mile_pence: v })}
          />
          <PriceField
            label="Minimum charge (pence)"
            value={value.delivery_minimum_pence}
            placeholder="15000"
            onChange={(v) => patch({ delivery_minimum_pence: v })}
          />
        </div>
      </div>

      <div>
        <p className="text-[11px] font-extrabold uppercase tracking-widest text-brand-muted">
          Product B — trailer bands (auto-picked by machine weight)
        </p>
        <ul className="mt-2 space-y-2">
          {value.trailer_bands.map((b, i) => (
            <li key={b.slug + i} className="rounded-md border border-brand-line bg-brand-bg p-2">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[11px] font-extrabold text-brand-text">{b.label}</span>
                <span className="text-[10px] text-brand-muted">
                  {b.weight_from_kg}–{b.weight_to_kg} kg
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <PriceField
                  label="Fixed (pence)"
                  value={b.fixed_pence}
                  placeholder="25000"
                  onChange={(v) => patchBand(i, { fixed_pence: v })}
                />
                <PriceField
                  label="Per mile (pence)"
                  value={b.per_mile_pence}
                  placeholder="200"
                  onChange={(v) => patchBand(i, { per_mile_pence: v })}
                />
                <ToggleRow
                  label="Quote only"
                  value={b.quote_only}
                  onChange={(v) => patchBand(i, { quote_only: v })}
                />
                <label className="block">
                  <span className="text-[9px] font-bold uppercase tracking-widest text-brand-muted">
                    Trailer photo URL
                  </span>
                  <input
                    type="text"
                    value={b.image_url}
                    onChange={(e) => patchBand(i, { image_url: e.target.value })}
                    placeholder="https://…"
                    className="mt-1 h-8 w-full rounded-md border border-brand-line bg-brand-bg px-2 text-[11px] text-brand-text outline-none focus:border-brand-accent"
                  />
                </label>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <div>
        <p className="text-[11px] font-extrabold uppercase tracking-widest text-brand-muted">
          Surcharges + regulation handling
        </p>
        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
          <PriceField
            label="Non-runner surcharge (pence)"
            value={value.non_runner_surcharge_pence}
            placeholder="30000"
            onChange={(v) => patch({ non_runner_surcharge_pence: v })}
          />
          <PriceField
            label="Escort per day (pence)"
            value={value.escort_per_day_pence}
            placeholder="35000"
            onChange={(v) => patch({ escort_per_day_pence: v })}
          />
          <PriceField
            label="Police notification (pence)"
            value={value.police_escort_notification_pence}
            placeholder="25000"
            onChange={(v) => patch({ police_escort_notification_pence: v })}
          />
          <PriceField
            label="Weekend multiplier %"
            value={value.weekend_multiplier_percent}
            placeholder="150"
            onChange={(v) => patch({ weekend_multiplier_percent: v })}
          />
          <PriceField
            label="Overnight standby (pence)"
            value={value.overnight_standby_pence}
            placeholder="30000"
            onChange={(v) => patch({ overnight_standby_pence: v })}
          />
          <PriceField
            label="Insurance % × 10 (50 = 0.5%)"
            value={value.insurance_percent}
            placeholder="50"
            onChange={(v) => patch({ insurance_percent: v })}
          />
        </div>
        <div className="mt-2">
          <ToggleRow
            label="We handle STGO / VR1 / bridge notifications for the customer"
            value={value.handles_notifications}
            onChange={(v) => patch({ handles_notifications: v })}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="text-[10px] font-bold uppercase tracking-widest text-brand-muted">
            Operator&rsquo;s licence number (public trust signal)
          </span>
          <input
            type="text"
            value={value.operators_licence_number}
            onChange={(e) => patch({ operators_licence_number: e.target.value })}
            placeholder="e.g. OB1234567"
            className="mt-1 h-9 w-full rounded-md border border-brand-line bg-brand-bg px-2 text-[12px] text-brand-text outline-none focus:border-brand-accent"
            maxLength={40}
          />
        </label>
        <PriceField
          label="Goods-in-transit cover (pence)"
          value={value.goods_in_transit_cover_pence}
          placeholder="25000000"
          onChange={(v) => patch({ goods_in_transit_cover_pence: v })}
        />
      </div>

      <label className="block">
        <span className="text-[10px] font-bold uppercase tracking-widest text-brand-muted">
          Haulage terms of service (customer must accept before submit — max 2500 chars)
        </span>
        <textarea
          value={value.terms_of_service}
          onChange={(e) => patch({ terms_of_service: e.target.value })}
          rows={6}
          placeholder="e.g. By submitting this haulage request you accept: (1) rates shown are estimates confirmed by us within 30 minutes; (2) customer is responsible for accurate dimensions + weight — machines that exceed declared dims may be refused at pickup with a wasted-journey charge; (3) escort requirements are indicative — final routing decisions rest with the haulier; (4) STGO/VR1 notifications are handled by us where the toggle is set, otherwise the customer must provide proof of notification; (5) all machines must be presented for loading in the condition declared."
          className="mt-1 w-full rounded-md border border-brand-line bg-brand-bg px-3 py-2 text-[12px] text-brand-text outline-none focus:border-brand-accent"
          maxLength={2500}
        />
      </label>
    </div>
  );
}

function ReviewsEditor({
  rating,
  reviews,
  onRatingChange,
  onReviewsChange
}: {
  rating: { avg: number; count: number };
  reviews: PlantReview[];
  onRatingChange: (next: { avg: number; count: number }) => void;
  onReviewsChange: (next: PlantReview[]) => void;
}) {
  function updRv(idx: number, patch: Partial<PlantReview>) {
    onReviewsChange(reviews.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  }
  function removeRv(idx: number) {
    onReviewsChange(reviews.filter((_, i) => i !== idx));
  }
  function addRv() {
    onReviewsChange([
      ...reviews,
      { author: "", rating: 5, text: "", date: new Date().toISOString().slice(0, 10) }
    ]);
  }
  return (
    <div className="rounded-md border border-brand-line bg-brand-bg p-2">
      <p className="text-[10px] font-extrabold uppercase tracking-widest text-brand-muted">Reviews</p>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <label className="block">
          <span className="text-[9px] font-bold uppercase tracking-widest text-brand-muted">
            Aggregate avg (0–5)
          </span>
          <input
            type="number"
            step={0.1}
            min={0}
            max={5}
            value={rating.avg}
            onChange={(e) => onRatingChange({ ...rating, avg: Number(e.target.value) || 0 })}
            className="mt-1 h-8 w-full rounded-md border border-brand-line bg-brand-bg px-2 font-mono text-[11px] text-brand-text outline-none focus:border-brand-accent"
          />
        </label>
        <label className="block">
          <span className="text-[9px] font-bold uppercase tracking-widest text-brand-muted">Aggregate count</span>
          <input
            type="number"
            min={0}
            value={rating.count}
            onChange={(e) => onRatingChange({ ...rating, count: Number(e.target.value) || 0 })}
            className="mt-1 h-8 w-full rounded-md border border-brand-line bg-brand-bg px-2 font-mono text-[11px] text-brand-text outline-none focus:border-brand-accent"
          />
        </label>
      </div>
      <ul className="mt-2 space-y-2">
        {reviews.map((r, i) => (
          <li key={i} className="rounded-md border border-brand-line bg-brand-surface p-2">
            <div className="grid grid-cols-[1fr_60px_auto] gap-2">
              <input
                type="text"
                value={r.author}
                onChange={(e) => updRv(i, { author: e.target.value })}
                placeholder="Author"
                className="h-8 rounded-md border border-brand-line bg-brand-bg px-2 text-[11px] text-brand-text outline-none focus:border-brand-accent"
                maxLength={60}
              />
              <input
                type="number"
                step={0.5}
                min={1}
                max={5}
                value={r.rating}
                onChange={(e) => updRv(i, { rating: Number(e.target.value) || 5 })}
                className="h-8 rounded-md border border-brand-line bg-brand-bg px-2 font-mono text-[11px] text-brand-text outline-none focus:border-brand-accent"
              />
              <button
                type="button"
                onClick={() => removeRv(i)}
                className="text-[10px] font-extrabold uppercase tracking-widest text-red-500 hover:text-red-300"
              >
                Del
              </button>
            </div>
            <textarea
              value={r.text}
              onChange={(e) => updRv(i, { text: e.target.value })}
              rows={2}
              placeholder="Review text"
              className="mt-2 w-full rounded-md border border-brand-line bg-brand-bg px-2 py-1 text-[11px] text-brand-text outline-none focus:border-brand-accent"
              maxLength={400}
            />
            <input
              type="date"
              value={r.date}
              onChange={(e) => updRv(i, { date: e.target.value })}
              className="mt-1 h-7 rounded-md border border-brand-line bg-brand-bg px-2 text-[11px] text-brand-text outline-none focus:border-brand-accent"
            />
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={addRv}
        disabled={reviews.length >= 20}
        className="mt-2 inline-flex h-8 items-center rounded-md border-2 border-dashed border-brand-line px-2 text-[10px] font-extrabold uppercase tracking-widest text-brand-muted hover:border-brand-accent hover:text-brand-text disabled:opacity-40"
      >
        + Add review
      </button>
    </div>
  );
}

function BlockedDatesEditor({
  ranges,
  onChange
}: {
  ranges: { from: string; to: string; note?: string }[];
  onChange: (next: { from: string; to: string; note?: string }[]) => void;
}) {
  function update(idx: number, patch: Partial<{ from: string; to: string; note: string }>) {
    onChange(
      ranges.map((r, i) => {
        if (i !== idx) return r;
        const next = { ...r, ...patch };
        if (!next.note) delete (next as { note?: string }).note;
        return next;
      })
    );
  }
  function remove(idx: number) {
    onChange(ranges.filter((_, i) => i !== idx));
  }
  function add() {
    const today = new Date().toISOString().slice(0, 10);
    onChange([...ranges, { from: today, to: today }]);
  }
  function fmtSummary(r: { from: string; to: string }) {
    const f = new Date(r.from);
    const t = new Date(r.to);
    const days = Math.max(1, Math.round((+t - +f) / 86400000) + 1);
    return `${days} day${days > 1 ? "s" : ""}`;
  }
  return (
    <div className="mt-2 space-y-2">
      {ranges.length === 0 && (
        <p className="text-[10px] text-brand-muted">
          No blocked dates — machine shows as available all year.
        </p>
      )}
      <ul className="space-y-2">
        {ranges.map((r, i) => (
          <li
            key={i}
            className="grid grid-cols-[1fr_1fr_auto] gap-2 rounded-md border border-brand-line bg-brand-bg p-2"
          >
            <label className="block">
              <span className="text-[9px] font-bold uppercase tracking-widest text-brand-muted">
                From
              </span>
              <input
                type="date"
                value={r.from}
                onChange={(e) => update(i, { from: e.target.value })}
                className="mt-1 h-8 w-full rounded-md border border-brand-line bg-brand-bg px-2 text-[11px] text-brand-text outline-none focus:border-brand-accent"
              />
            </label>
            <label className="block">
              <span className="text-[9px] font-bold uppercase tracking-widest text-brand-muted">
                To (inclusive)
              </span>
              <input
                type="date"
                min={r.from}
                value={r.to}
                onChange={(e) => update(i, { to: e.target.value })}
                className="mt-1 h-8 w-full rounded-md border border-brand-line bg-brand-bg px-2 text-[11px] text-brand-text outline-none focus:border-brand-accent"
              />
            </label>
            <button
              type="button"
              onClick={() => remove(i)}
              className="mt-[15px] inline-flex h-8 items-center rounded-md border border-brand-line px-2 text-[9px] font-extrabold uppercase tracking-widest text-red-500 hover:text-red-300"
            >
              Del
            </button>
            <label className="col-span-3 block">
              <span className="text-[9px] font-bold uppercase tracking-widest text-brand-muted">
                Note (optional) — {fmtSummary(r)}
              </span>
              <input
                type="text"
                value={r.note ?? ""}
                onChange={(e) => update(i, { note: e.target.value })}
                placeholder="e.g. On hire — Smith Groundworks"
                maxLength={120}
                className="mt-1 h-8 w-full rounded-md border border-brand-line bg-brand-bg px-2 text-[11px] text-brand-text outline-none focus:border-brand-accent"
              />
            </label>
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={add}
        disabled={ranges.length >= 50}
        className="inline-flex h-8 items-center rounded-md border-2 border-dashed border-brand-line px-2 text-[10px] font-extrabold uppercase tracking-widest text-brand-muted hover:border-brand-accent hover:text-brand-text disabled:opacity-40"
      >
        + Block a date range
      </button>
    </div>
  );
}

function ParagraphsEditor({
  items,
  onChange
}: {
  items: string[];
  onChange: (next: string[]) => void;
}) {
  function update(idx: number, v: string) {
    onChange(items.map((p, i) => (i === idx ? v : p)));
  }
  function remove(idx: number) {
    onChange(items.filter((_, i) => i !== idx));
  }
  function add() {
    onChange([...items, ""]);
  }
  return (
    <div className="mt-3 space-y-2">
      <ul className="space-y-2">
        {items.map((p, i) => (
          <li key={i} className="rounded-xl border border-brand-line bg-brand-bg p-3">
            <textarea
              value={p}
              onChange={(e) => update(i, e.target.value)}
              rows={3}
              placeholder="Paragraph text..."
              className="w-full rounded-md border border-brand-line bg-brand-bg px-2 py-2 text-[12px] text-brand-text outline-none focus:border-brand-accent"
              maxLength={800}
            />
            <div className="mt-2 flex justify-end">
              <button
                type="button"
                onClick={() => remove(i)}
                className="text-[10px] font-extrabold uppercase tracking-widest text-red-500 hover:text-red-300"
              >
                Delete
              </button>
            </div>
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={add}
        disabled={items.length >= 6}
        className="inline-flex h-9 items-center rounded-md border-2 border-dashed border-brand-line px-3 text-[11px] font-extrabold uppercase tracking-widest text-brand-muted hover:border-brand-accent hover:text-brand-text disabled:opacity-40"
      >
        + Add paragraph
      </button>
    </div>
  );
}
