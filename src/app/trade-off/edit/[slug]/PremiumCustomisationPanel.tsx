"use client";

// Premium customisation panel — only meaningful for app_trial / app_paid
// listings. Submits to /api/trade-off/update with the same edit_token used
// by the main form. Server gates whether this renders at all; the panel
// itself just collects + posts.

import { useMemo, useState } from "react";
import { InlinePhotoInput } from "@/components/trade-off/InlinePhotoInput";
import { HelpInfoButton } from "@/components/trade-off/HelpInfoButton";
import { AVAILABILITY_OPTIONS } from "@/lib/xratedAvailability";
import {
  PRICING_UNIT_OTHER_VALUE,
  unitsForTrade
} from "@/lib/tradePricingUnits";
import {
  INSURANCE_AMOUNTS,
  TRADE_MEMBERSHIPS,
  qualificationsForTrade
} from "@/lib/tradeCredentials";

type HoursSlot = { open: string; close: string } | null;
type HoursMap = Record<string, HoursSlot>;
type FaqItem = { q: string; a: string };
type PricedService = {
  name: string;
  image_url: string;
  /** Optional "before" image. When set, the public service-card View
   *  lightbox shows tabs that swap between After (image_url) and
   *  Before (this). Tradies see significantly higher engagement on
   *  before/after pairs than after-only cards. */
  before_image_url?: string;
  price: number;
  unit: string;
  description: string;
};

type HeadlineRate = {
  amount: number;
  unit: string;
  currency: string;
};

type Patch = {
  theme_color: string;
  button_text_color: string;
  cta_button_effect: "none" | "pulse" | "glow" | "shake";
  hero_text_line1: string;
  hero_text_line2: string;
  hero_text_line2_color: string;
  hero_text_tagline: string;
  hero_text_effect: "none" | "shimmer" | "dance" | "underline";
  avatar_frame_style: "none" | "ring" | "pulse" | "dance";
  profile_placement: "center" | "top-left" | "bottom-left";
  running_marquee: string;
  promo_text: string;
  accepting_jobs: boolean;
  phone_calls_enabled: boolean;
  services_offered: string[];
  priced_services: PricedService[];
  faq_items: FaqItem[];
  operating_hours: HoursMap;
  contact_form_enabled: boolean;
  visit_us_enabled: boolean;
  // "Trades On Standby" feed — empty string = not opted in.
  availability: "" | "now" | "tomorrow" | "this_week" | "next_week" | "two_weeks" | "later";
  headline_rate: HeadlineRate;
  // Trust & logistics — null for numeric "not set"; empty string for
  // text "not set" so the form binds cleanly to native HTML inputs.
  is_insured: boolean;
  insurance_cover_gbp: number | null;
  qualifications: string[];
  trade_memberships: string[];
  dbs_checked: boolean;
  has_own_transport: boolean;
  has_own_tools: boolean;
  minimum_job_gbp: number | null;
  free_site_visits: boolean;
  quote_availability: string;
  quote_turnaround_hours: number | null;
  current_status_note: string;
  ready_date: string;
  /** Trusted Trades — array of slugs the tradesperson vouches for,
   *  with an optional handwritten note. Capped at 12 by the API. */
  recommendations: { slug: string; note: string }[];
};

const DAY_ROW: { key: keyof HoursMap; label: string }[] = [
  { key: "mon", label: "Mon" },
  { key: "tue", label: "Tue" },
  { key: "wed", label: "Wed" },
  { key: "thu", label: "Thu" },
  { key: "fri", label: "Fri" },
  { key: "sat", label: "Sat" },
  { key: "sun", label: "Sun" }
];

export function PremiumCustomisationPanel({
  slug,
  editToken,
  primaryTrade,
  initial,
  essentialsComplete = false,
  isMerchantTrade = false
}: {
  slug: string;
  editToken: string;
  // The tradie picks their primary_trade in the main form above this panel —
  // we just read it to tailor the pricing-unit dropdown. Null falls back to
  // the generic unit set.
  primaryTrade: string | null;
  initial: Patch;
  /** Computed server-side from the listing record. When false (Day-1
   *  tradespeople who haven't filled the basics yet), advanced sections
   *  (Trust, Standby, FAQ, Trusted Trades, Visibility) are collapsed
   *  behind a single "Show advanced settings" toggle so the dashboard
   *  doesn't overwhelm. Once they pass the threshold, the toggle opens
   *  by default and the panel shows everything. */
  essentialsComplete?: boolean;
  /** Computed server-side from `isMerchantGradeTrade(primary_trade)`.
   *  When true (Building Merchant, Builders Supplies, Tool Hire, Heavy
   *  Machinery, Kitchen / Stair / Window / Security fitter), this is a
   *  PRODUCT-SELLING listing — we hide service-only sections (Services
   *  offered, Priced services, Trades On Standby) and surface a
   *  "Manage products" CTA pointing at the Shop Mode editor instead. */
  isMerchantTrade?: boolean;
}) {
  const [state, setState] = useState<Patch>(initial);
  // Progressive disclosure — start collapsed for incomplete listings so
  // a first-time tradesperson sees a calm Essentials-first dashboard.
  // Once they pass the bar (or click to expand), the advanced layer
  // unlocks and they can polish freely.
  const [showAdvanced, setShowAdvanced] = useState<boolean>(essentialsComplete);
  // Trade-aware pricing units. When the saved unit isn't in the curated list,
  // we render an "Other (custom)" sentinel and let the tradie type freely so
  // existing data is never silently dropped.
  const unitOptions = useMemo(() => unitsForTrade(primaryTrade), [primaryTrade]);
  const initialUnit = (initial.headline_rate.unit || "").trim();
  const initialUnitIsCurated = unitOptions.some((o) => o.value === initialUnit);
  const [unitSentinel, setUnitSentinel] = useState<string>(
    initialUnit.length === 0
      ? unitOptions[0]?.value ?? PRICING_UNIT_OTHER_VALUE
      : initialUnitIsCurated
        ? initialUnit
        : PRICING_UNIT_OTHER_VALUE
  );
  const [customUnit, setCustomUnit] = useState<string>(
    initialUnitIsCurated ? "" : initialUnit
  );
  // Services editor binds to a single comma-separated string for ergonomics.
  const [servicesText, setServicesText] = useState<string>(
    (initial.services_offered ?? []).join(", ")
  );
  // Trust & logistics — curated chip option lists.
  const qualificationOptions = useMemo(
    () => qualificationsForTrade(primaryTrade),
    [primaryTrade]
  );
  const [qualificationInput, setQualificationInput] = useState<string>("");
  const [membershipInput, setMembershipInput] = useState<string>("");
  // Insurance amount uses a sentinel-driven dropdown + a "custom" input,
  // mirroring the headline-rate pattern. We keep the raw string text in
  // a custom field so the user can type "750000" without forcing a NaN.
  const initialInsuranceAmount = initial.insurance_cover_gbp;
  const initialInsuranceCurated =
    typeof initialInsuranceAmount === "number" &&
    INSURANCE_AMOUNTS.some((o) => o.value === initialInsuranceAmount);
  const [insuranceSentinel, setInsuranceSentinel] = useState<string>(
    typeof initialInsuranceAmount !== "number"
      ? ""
      : initialInsuranceCurated
        ? String(initialInsuranceAmount)
        : "__other"
  );
  const [customInsurance, setCustomInsurance] = useState<string>(
    typeof initialInsuranceAmount === "number" && !initialInsuranceCurated
      ? String(initialInsuranceAmount)
      : ""
  );
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  function toggleChip(field: "qualifications" | "trade_memberships", value: string) {
    setState((s) => {
      const existing = s[field];
      const next = existing.includes(value)
        ? existing.filter((x) => x !== value)
        : [...existing, value];
      return { ...s, [field]: next.slice(0, 20) };
    });
  }
  function addCustomChip(field: "qualifications" | "trade_memberships", raw: string) {
    const value = raw.trim().slice(0, 80);
    if (!value) return;
    setState((s) => {
      if (s[field].includes(value)) return s;
      return { ...s, [field]: [...s[field], value].slice(0, 20) };
    });
  }
  function removeChip(field: "qualifications" | "trade_memberships", value: string) {
    setState((s) => ({ ...s, [field]: s[field].filter((x) => x !== value) }));
  }

  function set<K extends keyof Patch>(key: K, value: Patch[K]) {
    setState((s) => ({ ...s, [key]: value }));
  }

  function setHoursSlot(day: string, slot: HoursSlot) {
    setState((s) => ({
      ...s,
      operating_hours: { ...s.operating_hours, [day]: slot }
    }));
  }

  function updateFaq(i: number, patch: Partial<FaqItem>) {
    setState((s) => {
      const next = [...s.faq_items];
      next[i] = { ...next[i], ...patch };
      return { ...s, faq_items: next };
    });
  }
  function addFaq() {
    setState((s) => ({ ...s, faq_items: [...s.faq_items, { q: "", a: "" }] }));
  }
  function removeFaq(i: number) {
    setState((s) => ({ ...s, faq_items: s.faq_items.filter((_, idx) => idx !== i) }));
  }

  function updatePriced(i: number, patch: Partial<PricedService>) {
    setState((s) => {
      const next = [...s.priced_services];
      next[i] = { ...next[i], ...patch };
      return { ...s, priced_services: next };
    });
  }
  function addPriced() {
    setState((s) => ({
      ...s,
      priced_services: [
        ...s.priced_services,
        { name: "", image_url: "", before_image_url: "", price: 0, unit: "per project", description: "" }
      ]
    }));
  }
  function removePriced(i: number) {
    setState((s) => ({
      ...s,
      priced_services: s.priced_services.filter((_, idx) => idx !== i)
    }));
  }

  async function save() {
    setBusy(true);
    setMsg(null);
    setErr(null);
    try {
      // Translate the services free-text into a clean array on save.
      const services_offered = servicesText
        .split(/[,\n]/)
        .map((x) => x.trim())
        .filter((x) => x.length > 0)
        .slice(0, 30);
      // Drop empty FAQ rows.
      const faq_items = state.faq_items.filter(
        (f) => f.q.trim().length > 0 && f.a.trim().length > 0
      );
      // Drop empty priced-service rows (must have a name + a positive price).
      const priced_services = state.priced_services
        .map((p) => {
          const before = (p.before_image_url ?? "").trim();
          return {
            name: p.name.trim(),
            image_url: p.image_url.trim(),
            // Only persist before_image_url when set — saves clutter on
            // services where the tradesperson didn't add a before pair.
            ...(before ? { before_image_url: before } : {}),
            price: Number(p.price) || 0,
            unit: p.unit.trim() || "per project",
            description: (p.description ?? "").trim().slice(0, 500)
          };
        })
        .filter((p) => p.name.length > 0 && p.price > 0);
      // Headline rate: only persist when amount > 0 AND unit is set.
      // Null tells the server "clear it", so the standby card omits the
      // price column rather than rendering "£0 per day".
      const headlineAmount = Number(state.headline_rate.amount) || 0;
      const headlineUnit = (state.headline_rate.unit || "").trim();
      const headline_rate =
        headlineAmount > 0 && headlineUnit.length > 0
          ? {
              amount: headlineAmount,
              unit: headlineUnit,
              currency: state.headline_rate.currency || "GBP"
            }
          : null;
      // Trust & logistics — only persist the insurance amount when the
      // tradie has marked themselves insured AND given a positive number;
      // the API also enforces positive-int + cap. Memberships and quals
      // already enforce their own caps via the chip helpers.
      const insurance_cover_gbp = state.is_insured
        ? (() => {
            const n = Number(state.insurance_cover_gbp);
            return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
          })()
        : null;
      const minimum_job_gbp = (() => {
        const n = Number(state.minimum_job_gbp);
        return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
      })();
      const quote_turnaround_hours = (() => {
        const n = Number(state.quote_turnaround_hours);
        return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
      })();
      // Strip visual customisation fields from the payload — those are
      // now owned by the App Studio sub-page (/app-studio). Including
      // them here would clobber whatever the tradesperson just edited
      // there with the stale `initial` snapshot this panel was mounted
      // with. Operational fields (accepting_jobs, phone_calls_enabled,
      // hours, services, trust etc.) stay on this panel.
      const {
        theme_color: _theme_color,
        button_text_color: _button_text_color,
        cta_button_effect: _cta_button_effect,
        hero_text_line1: _hero_text_line1,
        hero_text_line2: _hero_text_line2,
        hero_text_line2_color: _hero_text_line2_color,
        hero_text_tagline: _hero_text_tagline,
        hero_text_effect: _hero_text_effect,
        avatar_frame_style: _avatar_frame_style,
        profile_placement: _profile_placement,
        running_marquee: _running_marquee,
        promo_text: _promo_text,
        ...operationalState
      } = state;
      void _theme_color;
      void _button_text_color;
      void _cta_button_effect;
      void _hero_text_line1;
      void _hero_text_line2;
      void _hero_text_line2_color;
      void _hero_text_tagline;
      void _hero_text_effect;
      void _avatar_frame_style;
      void _profile_placement;
      void _running_marquee;
      void _promo_text;
      const payload = {
        ...operationalState,
        services_offered,
        faq_items,
        priced_services,
        // The API treats empty-string strings as "set to null", which is
        // exactly the semantics we want for availability (opt-out).
        availability: state.availability,
        headline_rate,
        // Pass through the trust & logistics fields. The API sanitises
        // each (positive ints, max-len strings, chip cap, ISO date).
        is_insured: state.is_insured,
        insurance_cover_gbp,
        qualifications: state.qualifications,
        trade_memberships: state.trade_memberships,
        dbs_checked: state.dbs_checked,
        has_own_transport: state.has_own_transport,
        has_own_tools: state.has_own_tools,
        minimum_job_gbp,
        free_site_visits: state.free_site_visits,
        quote_availability: state.quote_availability.trim().slice(0, 500),
        quote_turnaround_hours,
        current_status_note: state.current_status_note.trim().slice(0, 500),
        ready_date: state.ready_date || null,
        // Trusted Trades — clamp to 12, drop empty slugs, trim notes.
        recommendations: (state.recommendations ?? [])
          .map((r) => ({
            slug: (r.slug ?? "").trim().toLowerCase(),
            note: (r.note ?? "").trim().slice(0, 200)
          }))
          .filter((r) => r.slug.length >= 5)
          .slice(0, 12)
      };

      const res = await fetch("/api/trade-off/update", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          slug,
          edit_token: editToken,
          fields: payload
        })
      });
      const json = await res.json();
      if (!json.ok) {
        setErr(json.error ?? "Save failed.");
      } else {
        setMsg("Saved.");
        // Tell any LivePreviewIframe on the page to refresh — same
        // contract as App Studio so we don't need a second event name.
        window.dispatchEvent(new CustomEvent("appstudio:saved"));
      }
    } catch {
      setErr("Network error — try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      {/* Profile dashboard header + App Studio handoff card removed
          per design — the App Details page header at the top of the
          edit page already sets the context, and App Studio is reachable
          from the side drawer. Keeping this surface free of nav clutter
          so the user only sees fields to edit. */}

      <div className="grid gap-4 sm:grid-cols-2">
        {/* "Accepting new jobs" toggle removed per design — accepting
            is the default, and the pause state isn't a setting most
            tradespeople reach for from this page. accepting_jobs
            column stays in the DB; surfaced from Insights / status
            controls in a future pass if needed. */}

        {/* "Receive phone calls" toggle hidden for merchant trades —
            a shop's phone number lives on the storefront naturally and
            the call/WhatsApp split doesn't apply the same way. Service
            trades still see the toggle. */}
        {!isMerchantTrade && (
        <Field
          label="Receive phone calls"
          full
          help="A visible phone number measurably lifts contact rates from over-50 buyers who prefer to call. Turn OFF only if you're WhatsApp-only by choice — your Business Card and Contact page will hide the number cleanly."
        >
          <label className="inline-flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={state.phone_calls_enabled}
              onChange={(e) => set("phone_calls_enabled", e.target.checked)}
              className="h-4 w-4 accent-brand-accent"
            />
            <span>
              {state.phone_calls_enabled
                ? "Yes — show phone on Business Card + Call Now on contact page"
                : "No — WhatsApp & email only (phone hidden)"}
            </span>
          </label>
        </Field>
        )}
      </div>

      {/* "Your shop" handoff CTA removed — the new inline 4-product
          editor in TradeOffForm + the "Add-ons" / Shop Mode drawer
          link cover the same path without doubling up.

          Advanced settings expander is hidden for merchant trades —
          Trust & logistics flags (DBS, transport, tools, site visits,
          qualifications, trade memberships) are tradesperson-specific
          and don't apply to a shop. Service trades still see it. */}
      {!isMerchantTrade && (
      <button
        type="button"
        onClick={() => setShowAdvanced((s) => !s)}
        aria-expanded={showAdvanced}
        className="flex w-full items-center justify-between gap-4 rounded-2xl border border-neutral-200 bg-white p-5 text-left shadow-sm transition hover:border-neutral-400 sm:p-6"
      >
        <span className="min-w-0">
          <p
            className="text-[10px] font-extrabold uppercase tracking-[0.22em]"
            style={{ color: "var(--trade-accent, #FFB300)" }}
          >
            {showAdvanced ? "Polish settings (open)" : "Polish settings (5 hidden)"}
          </p>
          <p className="mt-1 text-base font-extrabold text-neutral-900 sm:text-lg">
            {showAdvanced
              ? "Hide advanced settings"
              : "Show advanced settings"}
          </p>
          <p className="mt-0.5 text-[13px] leading-snug text-neutral-500">
            {showAdvanced
              ? "Trust signals, standby feed, FAQ, trusted trades and visibility toggles are open below."
              : "Get the basics live first. Trust signals, FAQ, trusted trades, and visibility toggles all live here when you're ready."}
          </p>
        </span>
        <span
          aria-hidden="true"
          className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-neutral-900 transition ${showAdvanced ? "rotate-180" : ""}`}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="m6 9 6 6 6-6" />
          </svg>
        </span>
      </button>
      )}

      {!isMerchantTrade && showAdvanced && (
        <>
      {/* ─── Trust & logistics ─── */}
      <div className="space-y-3 rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex items-center gap-2">
          <h3 className="text-xl font-extrabold text-neutral-900">
            Trust & logistics
          </h3>
          <HelpInfoButton
            title="Trust & logistics"
            body="Every badge here removes a reason for a buyer to hesitate. Insurance, qualifications and minimum job size answer the silent questions that stop hesitant buyers from messaging — each one ticked typically lifts contact-to-quote conversion."
          />
        </div>
        {/* Yes/no flag grid */}
        <div className="grid gap-2 sm:grid-cols-2">
          <TrustFlag
            label="Insured (public liability)"
            checked={state.is_insured}
            onChange={(v) => set("is_insured", v)}
          />
          <TrustFlag
            label="Own transport"
            checked={state.has_own_transport}
            onChange={(v) => set("has_own_transport", v)}
          />
          <TrustFlag
            label="Own tools"
            checked={state.has_own_tools}
            onChange={(v) => set("has_own_tools", v)}
          />
          <TrustFlag
            label="DBS checked"
            checked={state.dbs_checked}
            onChange={(v) => set("dbs_checked", v)}
          />
          <TrustFlag
            label="Free site visits"
            checked={state.free_site_visits}
            onChange={(v) => set("free_site_visits", v)}
          />
        </div>

        {/* Insurance amount — only when insured is on */}
        {state.is_insured && (
          <Field label="Public liability cover">
            <select
              value={insuranceSentinel}
              onChange={(e) => {
                const next = e.target.value;
                setInsuranceSentinel(next);
                if (next === "") {
                  set("insurance_cover_gbp", null);
                } else if (next === "__other") {
                  const n = Number(customInsurance);
                  set(
                    "insurance_cover_gbp",
                    Number.isFinite(n) && n > 0 ? Math.round(n) : null
                  );
                } else {
                  set("insurance_cover_gbp", Number(next));
                }
              }}
              className="h-11 w-full rounded-xl border border-brand-line bg-brand-bg px-3 text-sm text-brand-text focus:border-brand-accent focus:outline-none"
            >
              <option value="">— Not specified —</option>
              {INSURANCE_AMOUNTS.map((opt) => (
                <option key={opt.value} value={String(opt.value)}>
                  {opt.label}
                </option>
              ))}
              <option value="__other">Other (£) …</option>
            </select>
            {insuranceSentinel === "__other" && (
              <input
                type="number"
                min={0}
                step={1000}
                value={customInsurance}
                onChange={(e) => {
                  const next = e.target.value;
                  setCustomInsurance(next);
                  const n = Number(next);
                  set(
                    "insurance_cover_gbp",
                    Number.isFinite(n) && n > 0 ? Math.round(n) : null
                  );
                }}
                placeholder="e.g. 750000"
                className="mt-2 h-11 w-full rounded-xl border border-brand-line bg-brand-bg px-3 text-sm text-brand-text placeholder:text-brand-muted focus:border-brand-accent focus:outline-none"
              />
            )}
          </Field>
        )}

        {/* Qualifications chips */}
        <Field label="Qualifications" full>
          <p className="mb-1.5 text-[13px] leading-snug text-neutral-500">
            Tap to select. Custom certs can be typed in — press Enter to add.
          </p>
          <ChipMultiSelect
            options={qualificationOptions}
            selected={state.qualifications}
            onToggle={(v) => toggleChip("qualifications", v)}
            onRemove={(v) => removeChip("qualifications", v)}
          />
          <div className="mt-2 flex gap-2">
            <input
              type="text"
              value={qualificationInput}
              onChange={(e) => setQualificationInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addCustomChip("qualifications", qualificationInput);
                  setQualificationInput("");
                }
              }}
              placeholder="Add a custom cert (e.g. WaterSafe)"
              maxLength={80}
              className="h-11 flex-1 rounded-xl border border-brand-line bg-brand-bg px-3 text-sm text-brand-text placeholder:text-brand-muted focus:border-brand-accent focus:outline-none"
            />
            <button
              type="button"
              onClick={() => {
                addCustomChip("qualifications", qualificationInput);
                setQualificationInput("");
              }}
              className="inline-flex h-11 items-center rounded-xl border border-brand-accent bg-brand-accent/10 px-3 text-[11px] font-bold text-brand-accent transition hover:bg-brand-accent hover:text-black"
            >
              Add
            </button>
          </div>
        </Field>

        {/* Memberships chips */}
        <Field label="Trade memberships" full>
          <ChipMultiSelect
            options={TRADE_MEMBERSHIPS}
            selected={state.trade_memberships}
            onToggle={(v) => toggleChip("trade_memberships", v)}
            onRemove={(v) => removeChip("trade_memberships", v)}
          />
          <div className="mt-2 flex gap-2">
            <input
              type="text"
              value={membershipInput}
              onChange={(e) => setMembershipInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addCustomChip("trade_memberships", membershipInput);
                  setMembershipInput("");
                }
              }}
              placeholder="Add a custom membership"
              maxLength={80}
              className="h-11 flex-1 rounded-xl border border-brand-line bg-brand-bg px-3 text-sm text-brand-text placeholder:text-brand-muted focus:border-brand-accent focus:outline-none"
            />
            <button
              type="button"
              onClick={() => {
                addCustomChip("trade_memberships", membershipInput);
                setMembershipInput("");
              }}
              className="inline-flex h-11 items-center rounded-xl border border-brand-accent bg-brand-accent/10 px-3 text-[11px] font-bold text-brand-accent transition hover:bg-brand-accent hover:text-black"
            >
              Add
            </button>
          </div>
        </Field>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Minimum job (£)">
            <input
              type="number"
              min={0}
              step={10}
              value={state.minimum_job_gbp ?? ""}
              onChange={(e) =>
                set(
                  "minimum_job_gbp",
                  e.target.value === "" ? null : Number(e.target.value) || 0
                )
              }
              placeholder="e.g. 150"
              className="h-11 w-full rounded-xl border border-brand-line bg-brand-bg px-3 text-sm text-brand-text placeholder:text-brand-muted focus:border-brand-accent focus:outline-none"
            />
          </Field>
          {/* "Quote turnaround (hours)" removed per design — duplicated
              the "Quote availability" text field and confused users
              into thinking it was required. */}
        </div>

        <Field label="Quote availability" full>
          <Text
            value={state.quote_availability}
            onChange={(v) => set("quote_availability", v)}
            placeholder="e.g. Weekday evenings + Saturdays"
          />
        </Field>

        <Field label="Current status note" full>
          <textarea
            rows={2}
            value={state.current_status_note}
            onChange={(e) =>
              set("current_status_note", e.target.value.slice(0, 500))
            }
            placeholder="e.g. Finishing extension in Salford — ready 14 Nov"
            maxLength={500}
            className="w-full rounded-xl border border-brand-line bg-brand-bg px-3 py-2 text-sm text-brand-text placeholder:text-brand-muted focus:border-brand-accent focus:outline-none"
          />
          <p className="mt-1 text-right text-[10px] text-brand-muted">
            {state.current_status_note.length}/500
          </p>
        </Field>

        <Field label="Ready date (optional)">
          <input
            type="date"
            value={state.ready_date || ""}
            onChange={(e) => set("ready_date", e.target.value)}
            className="h-11 w-full rounded-xl border border-brand-line bg-brand-bg px-3 text-sm text-brand-text focus:border-brand-accent focus:outline-none"
          />
        </Field>
      </div>

      {/* Trades On Standby — service-trade only; hidden for merchant
          listings since they sell stocked products with dispatch days,
          not on-demand labour. */}
      {!isMerchantTrade && (
      <div className="space-y-3 rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex items-center gap-2">
          <h3 className="text-xl font-extrabold text-neutral-900">
            Trades On Standby
          </h3>
          <HelpInfoButton
            title="Trades On Standby"
            body="The fastest way to win same-week work. Setting an availability window puts you on the landing-page standby feed where buyers with urgent jobs message standby trades first. Leave blank when you're booked solid to stay off the feed."
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Availability">
            <select
              value={state.availability}
              onChange={(e) =>
                set("availability", e.target.value as Patch["availability"])
              }
              className="h-11 w-full rounded-xl border border-brand-line bg-brand-bg px-3 text-sm text-brand-text focus:border-brand-accent focus:outline-none"
            >
              <option value="">— Not on standby —</option>
              {AVAILABILITY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Headline rate amount (£)">
            <input
              type="number"
              min={0}
              step={1}
              value={state.headline_rate.amount || ""}
              onChange={(e) =>
                set("headline_rate", {
                  ...state.headline_rate,
                  amount: Number(e.target.value) || 0
                })
              }
              placeholder="e.g. 280"
              className="h-11 w-full rounded-xl border border-brand-line bg-brand-bg px-3 text-sm text-brand-text placeholder:text-brand-muted focus:border-brand-accent focus:outline-none"
            />
          </Field>
          <Field label="Headline rate unit">
            <p className="mb-1.5 text-[13px] leading-snug text-neutral-500">
              Pricing units common in your trade — pick the closest or use
              &lsquo;Other&rsquo;.
            </p>
            <select
              value={unitSentinel}
              onChange={(e) => {
                const next = e.target.value;
                setUnitSentinel(next);
                if (next === PRICING_UNIT_OTHER_VALUE) {
                  set("headline_rate", {
                    ...state.headline_rate,
                    unit: customUnit.trim()
                  });
                } else {
                  set("headline_rate", {
                    ...state.headline_rate,
                    unit: next
                  });
                }
              }}
              className="h-11 w-full rounded-xl border border-brand-line bg-brand-bg px-3 text-sm text-brand-text focus:border-brand-accent focus:outline-none"
            >
              {unitOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
              <option value={PRICING_UNIT_OTHER_VALUE}>Other (custom)…</option>
            </select>
            {unitSentinel === PRICING_UNIT_OTHER_VALUE && (
              <input
                type="text"
                value={customUnit}
                onChange={(e) => {
                  const next = e.target.value;
                  setCustomUnit(next);
                  set("headline_rate", {
                    ...state.headline_rate,
                    unit: next.trim()
                  });
                }}
                placeholder="e.g. per fitting, per visit"
                maxLength={30}
                className="mt-2 h-11 w-full rounded-xl border border-brand-line bg-brand-bg px-3 text-sm text-brand-text placeholder:text-brand-muted focus:border-brand-accent focus:outline-none"
              />
            )}
          </Field>
          <Field label="Currency">
            {/* v1: GBP only — the column accepts any 3-letter code so the
                field is wired for future expansion, but the picker stays
                locked to keep the standby card consistent. */}
            <select
              value={state.headline_rate.currency}
              disabled
              className="h-11 w-full rounded-xl border border-brand-line bg-brand-bg/60 px-3 text-sm text-brand-text opacity-70 focus:outline-none"
            >
              <option value="GBP">GBP (£)</option>
            </select>
          </Field>
        </div>
      </div>
      )}
        </>
      )}

      {/* Services offered + Priced services — service-trade only. For
          merchant trades (Building Supplies, Tool Hire etc.) the
          catalogue lives in Shop Mode and these two text-list editors
          would just confuse the picture. */}
      {!isMerchantTrade && (
        <>
      {/* ─── Services offered ─── */}
      <div className="space-y-2 rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex items-center gap-2">
          <h3 className="text-xl font-extrabold text-neutral-900">
            Services offered
          </h3>
          <HelpInfoButton
            title="Services offered"
            body={`The labels search and filters use to surface you. The more specific the keywords, the more qualified the buyers who land on your profile — generic terms pull tyre-kickers; precise ones pull customers ready to message.\n\nExample: "Skim coat, Knife taping, Mud-pan finish".`}
          />
        </div>
        <textarea
          rows={2}
          value={servicesText}
          onChange={(e) => setServicesText(e.target.value)}
          placeholder="Service 1, Service 2, Service 3"
          className="w-full rounded-xl border border-brand-line bg-brand-bg px-3 py-2 text-sm text-brand-text placeholder:text-brand-muted focus:border-brand-accent focus:outline-none"
        />
      </div>

      {/* ─── Priced services (carousel) ─── */}
      <div className="space-y-2 rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <h3 className="text-xl font-extrabold text-neutral-900">
              Priced services
            </h3>
            <HelpInfoButton
              title="Priced services"
              body={`Visible prices anchor the conversation. Buyers who see a number message faster than buyers who have to ask — and they arrive pre-warmed, expecting the figure they read.\n\nShown as a swipeable carousel on your profile. Unit is free-text — e.g. "per project", "per m²", "per hour", "from".`}
            />
          </div>
          <button
            type="button"
            onClick={addPriced}
            className="inline-flex h-9 items-center rounded-xl border border-brand-accent bg-brand-accent/10 px-3 text-[11px] font-bold text-brand-accent transition hover:bg-brand-accent hover:text-black"
          >
            + Add service
          </button>
        </div>
        {state.priced_services.length === 0 ? (
          <p className="text-[13px] leading-snug text-neutral-500">
            No priced services yet — add one above.
          </p>
        ) : (
          <ul className="space-y-3">
            {state.priced_services.map((p, i) => (
              <li
                key={i}
                className="space-y-2 rounded-xl border border-brand-line bg-brand-surface/40 p-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-bold uppercase tracking-widest text-brand-muted">
                    Service {i + 1}
                  </span>
                  <button
                    type="button"
                    onClick={() => removePriced(i)}
                    className="text-[11px] font-semibold text-red-600 hover:text-red-700"
                  >
                    Remove
                  </button>
                </div>
                <Field
                  label="Service name *"
                  help="What buyers will see at the top of the card. Keep it short — &ldquo;Skim coat&rdquo;, &ldquo;Roof valley repair&rdquo;, &ldquo;Oak chopping board&rdquo;."
                >
                  <Text
                    value={p.name}
                    onChange={(v) => updatePriced(i, { name: v })}
                    placeholder="e.g. Skim coat"
                  />
                </Field>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <span className="block text-[11px] font-bold uppercase tracking-widest text-brand-muted">
                      Card image *
                    </span>
                    <span className="mt-1 block text-[13px] leading-snug text-brand-muted">
                      The photo on this service&rsquo;s card. Upload your
                      best finished shot — that&rsquo;s what sells.
                    </span>
                    <div className="mt-1.5">
                      <InlinePhotoInput
                        value={p.image_url}
                        onChange={(url) => updatePriced(i, { image_url: url })}
                        label="Add card image"
                      />
                    </div>
                  </div>
                  <div>
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-[11px] font-bold uppercase tracking-widest text-brand-muted">
                        Before image
                      </span>
                      <span
                        className="text-[10px] uppercase tracking-widest"
                        style={{ color: "var(--trade-accent, #FFB300)" }}
                      >
                        Optional
                      </span>
                    </div>
                    <span className="mt-1 block text-[13px] leading-snug text-brand-muted">
                      Adds a Before/After tab to the card popup. Pair
                      photos lift engagement on transformation work.
                    </span>
                    <div className="mt-1.5">
                      <InlinePhotoInput
                        value={p.before_image_url ?? ""}
                        onChange={(url) => updatePriced(i, { before_image_url: url })}
                        label="Add before photo"
                      />
                    </div>
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field
                    label="Price (£) *"
                    help="Buyers who see a number message faster than buyers who have to ask. Round numbers (£180, £350) read cleaner than precise ones."
                  >
                    <input
                      type="number"
                      min={0}
                      step={1}
                      value={p.price || ""}
                      onChange={(e) =>
                        updatePriced(i, { price: Number(e.target.value) || 0 })
                      }
                      placeholder="180"
                      className="h-11 w-full rounded-xl border border-brand-line bg-brand-bg px-3 text-sm text-brand-text placeholder:text-brand-muted focus:border-brand-accent focus:outline-none"
                    />
                  </Field>
                  <Field
                    label="Unit *"
                    help="Anchors the price. e.g. per m², per project, per hour, from."
                  >
                    <Text
                      value={p.unit}
                      onChange={(v) => updatePriced(i, { unit: v })}
                      placeholder="per project"
                    />
                  </Field>
                </div>

                <Field
                  label="Description"
                  help="One or two short sentences a buyer reads before tapping Contact — what's included, who it's for, the typical job."
                >
                  <textarea
                    rows={3}
                    value={p.description ?? ""}
                    onChange={(e) =>
                      updatePriced(i, { description: e.target.value.slice(0, 500) })
                    }
                    placeholder="Two coats of finishing plaster on clean walls. Includes mixing, application, and clean-up. Best for rooms up to 25 m²."
                    maxLength={500}
                    className="w-full rounded-xl border border-brand-line bg-brand-bg px-3 py-2 text-sm text-brand-text placeholder:text-brand-muted focus:border-brand-accent focus:outline-none"
                  />
                  <p className="mt-1 text-right text-[10px] text-brand-muted">
                    {(p.description ?? "").length}/500
                  </p>
                </Field>
              </li>
            ))}
          </ul>
        )}
      </div>
        </>
      )}

      {/* ─── Operating hours ─── */}
      <div className="space-y-2 rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex items-center gap-2">
          <h3 className="text-xl font-extrabold text-neutral-900">
            Operating hours
          </h3>
          <HelpInfoButton
            title="Operating hours"
            body="Knowing when you reply stops customers bouncing to a competitor who looks more active. Setting hours measurably cuts dead-air messages and sets the right expectation for response time. Pick a preset to start, then tweak any day."
          />
        </div>
        {/* Quick presets — most tradies have predictable patterns, so a
            one-tap fill saves them seven manual time pickers. They can
            still override individual days afterwards. */}
        <div className="flex flex-wrap gap-1.5 pt-1">
          <button
            type="button"
            onClick={() =>
              setState((s) => ({
                ...s,
                operating_hours: Object.fromEntries(
                  DAY_ROW.map(({ key }) => [key, { open: "09:00", close: "17:00" }])
                )
              }))
            }
            className="inline-flex h-8 items-center rounded-xl border border-brand-line bg-brand-bg px-2.5 text-[11px] font-bold text-brand-text transition hover:border-brand-accent"
          >
            Every day 9–5
          </button>
          <button
            type="button"
            onClick={() =>
              setState((s) => ({
                ...s,
                operating_hours: Object.fromEntries(
                  DAY_ROW.map(({ key }) => [
                    key,
                    key === "sat" || key === "sun" ? null : { open: "09:00", close: "17:00" }
                  ])
                )
              }))
            }
            className="inline-flex h-8 items-center rounded-xl border border-brand-line bg-brand-bg px-2.5 text-[11px] font-bold text-brand-text transition hover:border-brand-accent"
          >
            Weekdays only
          </button>
          <button
            type="button"
            onClick={() =>
              setState((s) => ({
                ...s,
                operating_hours: Object.fromEntries(
                  DAY_ROW.map(({ key }) => [
                    key,
                    key === "sun" ? null : { open: "09:00", close: "17:00" }
                  ])
                )
              }))
            }
            className="inline-flex h-8 items-center rounded-xl border border-brand-line bg-brand-bg px-2.5 text-[11px] font-bold text-brand-text transition hover:border-brand-accent"
          >
            Mon–Sat 9–5
          </button>
          <button
            type="button"
            onClick={() =>
              setState((s) => ({
                ...s,
                operating_hours: Object.fromEntries(
                  DAY_ROW.map(({ key }) => [
                    key,
                    key === "sat" || key === "sun" ? null : { open: "08:00", close: "18:00" }
                  ])
                )
              }))
            }
            className="inline-flex h-8 items-center rounded-xl border border-brand-line bg-brand-bg px-2.5 text-[11px] font-bold text-brand-text transition hover:border-brand-accent"
          >
            Trade hours 8–6
          </button>
          <button
            type="button"
            onClick={() =>
              setState((s) => ({
                ...s,
                operating_hours: Object.fromEntries(
                  DAY_ROW.map(({ key }) => [key, null])
                )
              }))
            }
            className="inline-flex h-8 items-center rounded-xl border border-brand-line bg-brand-bg px-2.5 text-[11px] font-bold text-brand-muted transition hover:border-red-300 hover:text-red-600"
          >
            Clear all
          </button>
        </div>
        <ul className="space-y-2">
          {DAY_ROW.map(({ key, label }) => {
            const slot = state.operating_hours?.[key] ?? null;
            const closed = !slot;
            return (
              <li key={key} className="grid grid-cols-12 items-center gap-2">
                <span className="col-span-2 text-xs font-bold text-brand-text">{label}</span>
                <label className="col-span-2 inline-flex items-center gap-1.5 text-[13px] leading-snug text-neutral-500">
                  <input
                    type="checkbox"
                    checked={closed}
                    onChange={(e) =>
                      setHoursSlot(key, e.target.checked ? null : { open: "09:00", close: "17:00" })
                    }
                    className="h-3.5 w-3.5 accent-brand-accent"
                  />
                  Closed
                </label>
                <input
                  type="time"
                  disabled={closed}
                  value={slot?.open ?? ""}
                  onChange={(e) =>
                    setHoursSlot(key, { open: e.target.value, close: slot?.close ?? "17:00" })
                  }
                  className="col-span-4 h-10 rounded-xl border border-brand-line bg-brand-bg px-2 text-xs text-brand-text disabled:opacity-40 focus:border-brand-accent focus:outline-none"
                />
                <input
                  type="time"
                  disabled={closed}
                  value={slot?.close ?? ""}
                  onChange={(e) =>
                    setHoursSlot(key, { open: slot?.open ?? "09:00", close: e.target.value })
                  }
                  className="col-span-4 h-10 rounded-xl border border-brand-line bg-brand-bg px-2 text-xs text-brand-text disabled:opacity-40 focus:border-brand-accent focus:outline-none"
                />
              </li>
            );
          })}
        </ul>
      </div>

      {!isMerchantTrade && showAdvanced && (
        <>
      {/* ─── FAQ items ─── */}
      <div className="space-y-2 rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <h3 className="text-xl font-extrabold text-neutral-900">
              FAQ items
            </h3>
            <HelpInfoButton
              title="FAQ items"
              body="Pre-answering a common question removes a tap-and-type barrier before a buyer messages — they self-serve, then commit to contact faster. Each FAQ also cuts repeat-DMs you'd otherwise have to answer manually. Start with your top 3."
            />
          </div>
          <button
            type="button"
            onClick={addFaq}
            className="inline-flex h-9 items-center rounded-xl border border-brand-accent bg-brand-accent/10 px-3 text-[11px] font-bold text-brand-accent transition hover:bg-brand-accent hover:text-black"
          >
            + Add FAQ
          </button>
        </div>
        {state.faq_items.length === 0 ? (
          <p className="text-[13px] leading-snug text-neutral-500">No FAQ items yet — add one above.</p>
        ) : (
          <ul className="space-y-3">
            {state.faq_items.map((f, i) => (
              <li key={i} className="space-y-1.5 rounded-xl border border-brand-line bg-brand-surface/40 p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-bold uppercase tracking-widest text-brand-muted">
                    Q{i + 1}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeFaq(i)}
                    className="text-[11px] font-semibold text-red-600 hover:text-red-700"
                  >
                    Remove
                  </button>
                </div>
                <Text
                  value={f.q}
                  onChange={(v) => updateFaq(i, { q: v })}
                  placeholder="Question — e.g. Do you offer free quotes?"
                />
                <textarea
                  rows={3}
                  value={f.a}
                  onChange={(e) => updateFaq(i, { a: e.target.value })}
                  placeholder="Answer"
                  className="w-full rounded-xl border border-brand-line bg-brand-bg px-3 py-2 text-sm text-brand-text placeholder:text-brand-muted focus:border-brand-accent focus:outline-none"
                />
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* ─── My Trusted Trades ─── */}
      <div className="space-y-3 rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex items-center gap-2">
          <h3 className="text-xl font-extrabold text-neutral-900">
            My Trusted Trades
          </h3>
          <HelpInfoButton
            title="My Trusted Trades"
            body="Buyers trust trades who vouch for each other. Recommending other Xrated tradespeople signals you're part of a network — and the favour gets returned: cross-recommendations measurably lift onward contact volume for both profiles. Up to 12."
          />
        </div>
        <button
          type="button"
          onClick={() =>
            setState((s) => ({
              ...s,
              recommendations: [
                ...(s.recommendations ?? []),
                { slug: "", note: "" }
              ].slice(0, 12)
            }))
          }
          disabled={(state.recommendations ?? []).length >= 12}
          className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-brand-accent px-3 text-[11px] font-bold text-black transition active:scale-[0.97] disabled:opacity-50"
        >
          + Add a recommendation
        </button>
        {(state.recommendations ?? []).length === 0 ? (
          <p className="text-[13px] leading-snug text-neutral-500">No trades recommended yet.</p>
        ) : (
          <ul className="space-y-3">
            {(state.recommendations ?? []).map((r, i) => (
              <li
                key={i}
                className="space-y-2 rounded-xl border border-brand-line bg-brand-surface/40 p-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-bold uppercase tracking-widest text-brand-muted">
                    Recommendation {i + 1}
                  </span>
                  <div className="inline-flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() =>
                        setState((s) => {
                          if (i === 0) return s;
                          const next = [...(s.recommendations ?? [])];
                          [next[i - 1], next[i]] = [next[i], next[i - 1]];
                          return { ...s, recommendations: next };
                        })
                      }
                      disabled={i === 0}
                      aria-label="Move up"
                      className="inline-flex h-7 w-7 items-center justify-center rounded text-[14px] text-brand-muted hover:text-brand-text disabled:opacity-30"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setState((s) => {
                          const arr = s.recommendations ?? [];
                          if (i >= arr.length - 1) return s;
                          const next = [...arr];
                          [next[i], next[i + 1]] = [next[i + 1], next[i]];
                          return { ...s, recommendations: next };
                        })
                      }
                      disabled={i >= (state.recommendations ?? []).length - 1}
                      aria-label="Move down"
                      className="inline-flex h-7 w-7 items-center justify-center rounded text-[14px] text-brand-muted hover:text-brand-text disabled:opacity-30"
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setState((s) => ({
                          ...s,
                          recommendations: (s.recommendations ?? []).filter(
                            (_, idx) => idx !== i
                          )
                        }))
                      }
                      className="text-[11px] font-semibold text-red-600 hover:text-red-700"
                    >
                      Remove
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-brand-muted">
                    Their xratedtrade.com slug
                  </label>
                  <input
                    type="text"
                    value={r.slug}
                    onChange={(e) =>
                      setState((s) => {
                        const next = [...(s.recommendations ?? [])];
                        next[i] = { ...next[i], slug: e.target.value.toLowerCase() };
                        return { ...s, recommendations: next };
                      })
                    }
                    placeholder="e.g. tom-carpenter-leeds"
                    className="mt-1 h-11 w-full rounded-xl border border-brand-line bg-brand-bg px-3 text-sm text-brand-text placeholder:text-brand-muted focus:border-brand-accent focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-brand-muted">
                    Why you recommend them (optional)
                  </label>
                  <textarea
                    rows={2}
                    value={r.note}
                    onChange={(e) =>
                      setState((s) => {
                        const next = [...(s.recommendations ?? [])];
                        next[i] = { ...next[i], note: e.target.value.slice(0, 200) };
                        return { ...s, recommendations: next };
                      })
                    }
                    placeholder="e.g. Worked with Tom on 12 extensions — never a complaint."
                    maxLength={200}
                    className="mt-1 w-full rounded-xl border border-brand-line bg-brand-bg px-3 py-2 text-sm text-brand-text placeholder:text-brand-muted focus:border-brand-accent focus:outline-none"
                  />
                  <p className="mt-1 text-right text-[10px] text-brand-muted">
                    {(r.note ?? "").length}/200
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* ─── Visibility toggles ─── */}
      <div className="grid gap-3 rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm sm:p-6 sm:grid-cols-2">
        <label className="inline-flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            checked={state.contact_form_enabled}
            onChange={(e) => set("contact_form_enabled", e.target.checked)}
            className="mt-0.5 h-4 w-4 accent-brand-accent"
          />
          <span>
            <span className="block font-semibold">Contact form</span>
            <span className="block text-[13px] leading-snug text-neutral-500">
              Adds an email contact form to your profile.
            </span>
          </span>
        </label>
        <label className="inline-flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            checked={state.visit_us_enabled}
            onChange={(e) => set("visit_us_enabled", e.target.checked)}
            className="mt-0.5 h-4 w-4 accent-brand-accent"
          />
          <span>
            <span className="block font-semibold">Visit us</span>
            <span className="block text-[13px] leading-snug text-neutral-500">
              Shows a "Get directions" button using your map pin.
            </span>
          </span>
        </label>
      </div>
        </>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={busy}
          className="inline-flex h-11 items-center rounded-lg bg-brand-accent px-5 text-xs font-bold text-black transition hover:opacity-90 disabled:opacity-50"
        >
          {busy ? "Saving…" : "Save customisation"}
        </button>
        {msg && <span className="text-xs text-brand-success">{msg}</span>}
        {err && <span className="text-xs text-red-600">{err}</span>}
      </div>
    </div>
  );
}

function Field({
  label,
  full,
  help,
  children
}: {
  label: string;
  full?: boolean;
  /** Long-form explanation. When set, an (i) icon appears next to the
   *  label that opens a popup with this body — keeps the form compact
   *  while still teaching non-technical tradespeople what each option
   *  does. */
  help?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={`block ${full ? "sm:col-span-2" : ""}`}>
      <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-brand-muted">
        {label}
        {help && <HelpInfoButton title={label} body={help} />}
      </span>
      <div className="mt-1.5">{children}</div>
    </label>
  );
}

function Text({
  value,
  onChange,
  placeholder
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="h-11 w-full rounded-xl border border-brand-line bg-brand-bg px-3 text-sm text-brand-text placeholder:text-brand-muted focus:border-brand-accent focus:outline-none"
    />
  );
}

function Select({
  value,
  onChange,
  options
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-11 w-full rounded-xl border border-brand-line bg-brand-bg px-3 text-sm text-brand-text focus:border-brand-accent focus:outline-none"
    >
      {options.map((opt) => (
        <option key={opt} value={opt}>
          {opt}
        </option>
      ))}
    </select>
  );
}

function TrustFlag({
  label,
  checked,
  onChange
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="inline-flex items-center gap-2 rounded-xl border border-brand-line bg-brand-bg/40 px-3 py-2 text-sm">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 accent-brand-accent"
      />
      <span>{label}</span>
    </label>
  );
}

function ChipMultiSelect({
  options,
  selected,
  onToggle,
  onRemove
}: {
  options: { value: string; label: string }[];
  selected: string[];
  onToggle: (v: string) => void;
  onRemove: (v: string) => void;
}) {
  // Render every curated option as a toggleable chip — selected chips get
  // the brand-accent fill; unselected stay outlined. Custom-typed entries
  // that aren't in `options` render as removable selected chips below.
  const customSelected = selected.filter(
    (v) => !options.some((o) => o.value === v)
  );
  return (
    <div className="space-y-2">
      <ul className="flex flex-wrap gap-1.5">
        {options.map((opt) => {
          const isOn = selected.includes(opt.value);
          return (
            <li key={opt.value}>
              <button
                type="button"
                onClick={() => onToggle(opt.value)}
                className={
                  "inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-semibold transition " +
                  (isOn
                    ? "border-brand-accent bg-brand-accent text-black"
                    : "border-brand-line bg-brand-bg text-brand-text hover:border-brand-accent")
                }
              >
                {opt.label}
              </button>
            </li>
          );
        })}
      </ul>
      {customSelected.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {customSelected.map((v) => (
            <li key={v}>
              <span className="inline-flex items-center gap-1 rounded-full border border-brand-accent bg-brand-accent/10 px-3 py-1 text-[11px] font-semibold text-brand-accent">
                {v}
                <button
                  type="button"
                  onClick={() => onRemove(v)}
                  aria-label={`Remove ${v}`}
                  className="ml-0.5 text-[11px] text-brand-accent/70 hover:text-brand-accent"
                >
                  ×
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
