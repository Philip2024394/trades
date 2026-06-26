"use client";

// Premium customisation panel — only meaningful for app_trial / app_paid
// listings. Submits to /api/trade-off/update with the same edit_token used
// by the main form. Server gates whether this renders at all; the panel
// itself just collects + posts.

import { useMemo, useState } from "react";
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
  initial
}: {
  slug: string;
  editToken: string;
  // The tradie picks their primary_trade in the main form above this panel —
  // we just read it to tailor the pricing-unit dropdown. Null falls back to
  // the generic unit set.
  primaryTrade: string | null;
  initial: Patch;
}) {
  const [state, setState] = useState<Patch>(initial);
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
      const payload = {
        ...state,
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
      }
    } catch {
      setErr("Network error — try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4 rounded-xl border border-brand-line bg-brand-surface p-5">
      <div>
        <h2 className="text-lg font-extrabold">Premium customisation</h2>
        <p className="mt-1 text-xs text-brand-muted">
          Visual tweaks for your Xrated App profile. Saved changes go live on
          your public page immediately.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {/* Theme colour picker removed — all tradies are locked to the
            Hammerex brand yellow (#FFB300). The DB column stays so existing
            data doesn't break, but the form no longer exposes it. */}
        <Field label="Button text colour">
          <input
            type="color"
            value={state.button_text_color || "#FFFFFF"}
            onChange={(e) => set("button_text_color", e.target.value)}
            className="h-11 w-full cursor-pointer rounded-md border border-brand-line bg-brand-bg p-1"
          />
        </Field>

        <Field label="CTA button effect">
          <Select
            value={state.cta_button_effect}
            onChange={(v) => set("cta_button_effect", v as Patch["cta_button_effect"])}
            options={["none", "pulse", "glow", "shake"]}
          />
        </Field>
        <Field label="Hero text effect">
          <Select
            value={state.hero_text_effect}
            onChange={(v) => set("hero_text_effect", v as Patch["hero_text_effect"])}
            options={["none", "shimmer", "dance", "underline"]}
          />
        </Field>

        <Field label="Hero line 1">
          <Text
            value={state.hero_text_line1}
            onChange={(v) => set("hero_text_line1", v)}
            placeholder="e.g. Drywall done right."
          />
        </Field>
        <Field label="Hero line 2">
          <Text
            value={state.hero_text_line2}
            onChange={(v) => set("hero_text_line2", v)}
            placeholder="e.g. Manchester · since 2014"
          />
        </Field>

        <Field label="Hero line 2 colour">
          <input
            type="color"
            value={state.hero_text_line2_color || "#FFB300"}
            onChange={(e) => set("hero_text_line2_color", e.target.value)}
            className="h-11 w-full cursor-pointer rounded-md border border-brand-line bg-brand-bg p-1"
          />
        </Field>
        <Field label="Hero tagline">
          <Text
            value={state.hero_text_tagline}
            onChange={(v) => set("hero_text_tagline", v)}
            placeholder="One short pitch line"
          />
        </Field>

        <Field label="Avatar frame style">
          <Select
            value={state.avatar_frame_style}
            onChange={(v) => set("avatar_frame_style", v as Patch["avatar_frame_style"])}
            options={["none", "ring", "pulse", "dance"]}
          />
        </Field>
        <Field label="Profile placement">
          <Select
            value={state.profile_placement}
            onChange={(v) => set("profile_placement", v as Patch["profile_placement"])}
            options={["center", "top-left", "bottom-left"]}
          />
        </Field>

        <Field label="Running marquee text" full>
          <Text
            value={state.running_marquee}
            onChange={(v) => set("running_marquee", v)}
            placeholder="e.g. Booking July · Manchester · 07xxx xxx xxx"
          />
        </Field>

        <Field label="Promo text (footer scroll)" full>
          <Text
            value={state.promo_text}
            onChange={(v) => set("promo_text", v)}
            placeholder="e.g. Free same-week site visits across Greater Manchester"
          />
        </Field>

        <Field label="Accepting new jobs" full>
          <label className="inline-flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={state.accepting_jobs}
              onChange={(e) => set("accepting_jobs", e.target.checked)}
              className="h-4 w-4 accent-brand-accent"
            />
            <span>{state.accepting_jobs ? "Yes — show as accepting" : "No — show as paused"}</span>
          </label>
        </Field>
      </div>

      {/* ─── Trust & logistics ─── */}
      <div className="space-y-3 rounded-lg border border-brand-line bg-brand-bg/40 p-4">
        <div>
          <h3 className="text-xs font-bold uppercase tracking-widest text-brand-muted">
            Trust & logistics
          </h3>
          <p className="mt-1 text-[11px] text-brand-muted">
            What UK customers want to know before they message — insurance,
            transport, qualifications, minimum job size and your current
            availability.
          </p>
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
              className="h-11 w-full rounded-md border border-brand-line bg-brand-bg px-3 text-sm text-brand-text focus:border-brand-accent focus:outline-none"
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
                className="mt-2 h-11 w-full rounded-md border border-brand-line bg-brand-bg px-3 text-sm text-brand-text placeholder:text-brand-muted focus:border-brand-accent focus:outline-none"
              />
            )}
          </Field>
        )}

        {/* Qualifications chips */}
        <Field label="Qualifications" full>
          <p className="mb-1.5 text-[11px] text-brand-muted">
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
              className="h-11 flex-1 rounded-md border border-brand-line bg-brand-bg px-3 text-sm text-brand-text placeholder:text-brand-muted focus:border-brand-accent focus:outline-none"
            />
            <button
              type="button"
              onClick={() => {
                addCustomChip("qualifications", qualificationInput);
                setQualificationInput("");
              }}
              className="inline-flex h-11 items-center rounded-md border border-brand-accent bg-brand-accent/10 px-3 text-[11px] font-bold text-brand-accent transition hover:bg-brand-accent hover:text-black"
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
              className="h-11 flex-1 rounded-md border border-brand-line bg-brand-bg px-3 text-sm text-brand-text placeholder:text-brand-muted focus:border-brand-accent focus:outline-none"
            />
            <button
              type="button"
              onClick={() => {
                addCustomChip("trade_memberships", membershipInput);
                setMembershipInput("");
              }}
              className="inline-flex h-11 items-center rounded-md border border-brand-accent bg-brand-accent/10 px-3 text-[11px] font-bold text-brand-accent transition hover:bg-brand-accent hover:text-black"
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
              className="h-11 w-full rounded-md border border-brand-line bg-brand-bg px-3 text-sm text-brand-text placeholder:text-brand-muted focus:border-brand-accent focus:outline-none"
            />
          </Field>
          <Field label="Quote turnaround (hours)">
            <input
              type="number"
              min={0}
              step={1}
              value={state.quote_turnaround_hours ?? ""}
              onChange={(e) =>
                set(
                  "quote_turnaround_hours",
                  e.target.value === "" ? null : Number(e.target.value) || 0
                )
              }
              placeholder="e.g. 24"
              className="h-11 w-full rounded-md border border-brand-line bg-brand-bg px-3 text-sm text-brand-text placeholder:text-brand-muted focus:border-brand-accent focus:outline-none"
            />
          </Field>
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
            className="w-full rounded-md border border-brand-line bg-brand-bg px-3 py-2 text-sm text-brand-text placeholder:text-brand-muted focus:border-brand-accent focus:outline-none"
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
            className="h-11 w-full rounded-md border border-brand-line bg-brand-bg px-3 text-sm text-brand-text focus:border-brand-accent focus:outline-none"
          />
        </Field>
      </div>

      {/* ─── Trades On Standby ─── */}
      <div className="space-y-3 rounded-lg border border-brand-line bg-brand-bg/40 p-4">
        <div>
          <h3 className="text-xs font-bold uppercase tracking-widest text-brand-muted">
            Trades On Standby
          </h3>
          <p className="mt-1 text-[11px] text-brand-muted">
            Show on the landing-page standby feed. Pick when you're free to
            start and your headline starting rate. Leave availability blank
            to stay out of the feed.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Availability">
            <select
              value={state.availability}
              onChange={(e) =>
                set("availability", e.target.value as Patch["availability"])
              }
              className="h-11 w-full rounded-md border border-brand-line bg-brand-bg px-3 text-sm text-brand-text focus:border-brand-accent focus:outline-none"
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
              className="h-11 w-full rounded-md border border-brand-line bg-brand-bg px-3 text-sm text-brand-text placeholder:text-brand-muted focus:border-brand-accent focus:outline-none"
            />
          </Field>
          <Field label="Headline rate unit">
            <p className="mb-1.5 text-[11px] text-brand-muted">
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
              className="h-11 w-full rounded-md border border-brand-line bg-brand-bg px-3 text-sm text-brand-text focus:border-brand-accent focus:outline-none"
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
                className="mt-2 h-11 w-full rounded-md border border-brand-line bg-brand-bg px-3 text-sm text-brand-text placeholder:text-brand-muted focus:border-brand-accent focus:outline-none"
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
              className="h-11 w-full rounded-md border border-brand-line bg-brand-bg/60 px-3 text-sm text-brand-text opacity-70 focus:outline-none"
            >
              <option value="GBP">GBP (£)</option>
            </select>
          </Field>
        </div>
      </div>

      {/* ─── Services offered ─── */}
      <div className="space-y-2 rounded-lg border border-brand-line bg-brand-bg/40 p-4">
        <h3 className="text-xs font-bold uppercase tracking-widest text-brand-muted">
          Services offered
        </h3>
        <p className="text-[11px] text-brand-muted">
          Comma-separated. e.g. <em>Skim coat, Knife taping, Mud-pan finish</em>.
        </p>
        <textarea
          rows={2}
          value={servicesText}
          onChange={(e) => setServicesText(e.target.value)}
          placeholder="Service 1, Service 2, Service 3"
          className="w-full rounded-md border border-brand-line bg-brand-bg px-3 py-2 text-sm text-brand-text placeholder:text-brand-muted focus:border-brand-accent focus:outline-none"
        />
      </div>

      {/* ─── Priced services (carousel) ─── */}
      <div className="space-y-2 rounded-lg border border-brand-line bg-brand-bg/40 p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-widest text-brand-muted">
            Priced services
          </h3>
          <button
            type="button"
            onClick={addPriced}
            className="inline-flex h-9 items-center rounded-md border border-brand-accent bg-brand-accent/10 px-3 text-[11px] font-bold text-brand-accent transition hover:bg-brand-accent hover:text-black"
          >
            + Add service
          </button>
        </div>
        <p className="text-[11px] text-brand-muted">
          Shown as a swipeable carousel on your profile. Unit is free-text — e.g.{" "}
          <em>per project</em>, <em>per m²</em>, <em>per hour</em>, <em>from</em>.
        </p>
        {state.priced_services.length === 0 ? (
          <p className="text-[11px] text-brand-muted">
            No priced services yet — add one above.
          </p>
        ) : (
          <ul className="space-y-3">
            {state.priced_services.map((p, i) => (
              <li
                key={i}
                className="space-y-2 rounded-md border border-brand-line bg-brand-surface/40 p-3"
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
                <div className="grid gap-2 sm:grid-cols-2">
                  <Text
                    value={p.name}
                    onChange={(v) => updatePriced(i, { name: v })}
                    placeholder="Service name (e.g. Skim coat)"
                  />
                  <Text
                    value={p.image_url}
                    onChange={(v) => updatePriced(i, { image_url: v })}
                    placeholder="After-image URL (https://…)"
                  />
                </div>
                {/* Optional "before" image — shown in the View-card
                    lightbox tabs alongside the After. Skip if the trade
                    is install-only (no meaningful before). */}
                <div className="rounded-md border border-dashed border-brand-line bg-brand-bg/30 p-2.5">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-[11px] font-bold uppercase tracking-widest text-brand-muted">
                      Before image
                    </span>
                    <span className="text-[10px] uppercase tracking-widest text-brand-accent">
                      Optional · +2× engagement
                    </span>
                  </div>
                  <Text
                    value={p.before_image_url ?? ""}
                    onChange={(v) => updatePriced(i, { before_image_url: v })}
                    placeholder="Before-image URL (https://…)"
                  />
                  <p className="mt-1 text-[10px] leading-relaxed text-brand-muted">
                    Adds a Before/After tab to the View-card popup. Skip for install-only trades or services without a clear "before".
                  </p>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <input
                    type="number"
                    min={0}
                    step={1}
                    value={p.price || ""}
                    onChange={(e) =>
                      updatePriced(i, { price: Number(e.target.value) || 0 })
                    }
                    placeholder="Price (£)"
                    className="h-11 w-full rounded-md border border-brand-line bg-brand-bg px-3 text-sm text-brand-text placeholder:text-brand-muted focus:border-brand-accent focus:outline-none"
                  />
                  <Text
                    value={p.unit}
                    onChange={(v) => updatePriced(i, { unit: v })}
                    placeholder="Unit (e.g. per m², per project, from)"
                  />
                </div>
                <div>
                  <textarea
                    rows={3}
                    value={p.description ?? ""}
                    onChange={(e) =>
                      updatePriced(i, { description: e.target.value.slice(0, 500) })
                    }
                    placeholder="Short description — what's included, who it's for"
                    maxLength={500}
                    className="w-full rounded-md border border-brand-line bg-brand-bg px-3 py-2 text-sm text-brand-text placeholder:text-brand-muted focus:border-brand-accent focus:outline-none"
                  />
                  <p className="mt-1 text-right text-[10px] text-brand-muted">
                    {(p.description ?? "").length}/500
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* ─── Operating hours ─── */}
      <div className="space-y-2 rounded-lg border border-brand-line bg-brand-bg/40 p-4">
        <h3 className="text-xs font-bold uppercase tracking-widest text-brand-muted">
          Operating hours
        </h3>
        <p className="text-[11px] text-brand-muted">
          Leave blank or tick "Closed" for days you're off.
        </p>
        <ul className="space-y-2">
          {DAY_ROW.map(({ key, label }) => {
            const slot = state.operating_hours?.[key] ?? null;
            const closed = !slot;
            return (
              <li key={key} className="grid grid-cols-12 items-center gap-2">
                <span className="col-span-2 text-xs font-bold text-brand-text">{label}</span>
                <label className="col-span-2 inline-flex items-center gap-1.5 text-[11px] text-brand-muted">
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
                  className="col-span-4 h-10 rounded-md border border-brand-line bg-brand-bg px-2 text-xs text-brand-text disabled:opacity-40 focus:border-brand-accent focus:outline-none"
                />
                <input
                  type="time"
                  disabled={closed}
                  value={slot?.close ?? ""}
                  onChange={(e) =>
                    setHoursSlot(key, { open: slot?.open ?? "09:00", close: e.target.value })
                  }
                  className="col-span-4 h-10 rounded-md border border-brand-line bg-brand-bg px-2 text-xs text-brand-text disabled:opacity-40 focus:border-brand-accent focus:outline-none"
                />
              </li>
            );
          })}
        </ul>
      </div>

      {/* ─── FAQ items ─── */}
      <div className="space-y-2 rounded-lg border border-brand-line bg-brand-bg/40 p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-widest text-brand-muted">
            FAQ items
          </h3>
          <button
            type="button"
            onClick={addFaq}
            className="inline-flex h-9 items-center rounded-md border border-brand-accent bg-brand-accent/10 px-3 text-[11px] font-bold text-brand-accent transition hover:bg-brand-accent hover:text-black"
          >
            + Add FAQ
          </button>
        </div>
        {state.faq_items.length === 0 ? (
          <p className="text-[11px] text-brand-muted">No FAQ items yet — add one above.</p>
        ) : (
          <ul className="space-y-3">
            {state.faq_items.map((f, i) => (
              <li key={i} className="space-y-1.5 rounded-md border border-brand-line bg-brand-surface/40 p-3">
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
                  className="w-full rounded-md border border-brand-line bg-brand-bg px-3 py-2 text-sm text-brand-text placeholder:text-brand-muted focus:border-brand-accent focus:outline-none"
                />
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* ─── My Trusted Trades ─── */}
      <div className="space-y-3 rounded-lg border border-brand-line bg-brand-bg/40 p-4">
        <div>
          <h3 className="text-xs font-bold uppercase tracking-widest text-brand-muted">
            My Trusted Trades
          </h3>
          <p className="mt-1 text-[11px] leading-relaxed text-brand-muted">
            Recommend other Xrated tradespeople your customers can trust. Each one becomes a card on your profile that links to their URL. Up to 12 — they should be on Xrated already.
          </p>
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
          className="inline-flex h-9 items-center gap-1.5 rounded-md bg-brand-accent px-3 text-[11px] font-bold text-black transition active:scale-[0.97] disabled:opacity-50"
        >
          + Add a recommendation
        </button>
        {(state.recommendations ?? []).length === 0 ? (
          <p className="text-[11px] text-brand-muted">No trades recommended yet.</p>
        ) : (
          <ul className="space-y-3">
            {(state.recommendations ?? []).map((r, i) => (
              <li
                key={i}
                className="space-y-2 rounded-md border border-brand-line bg-brand-surface/40 p-3"
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
                    className="mt-1 h-11 w-full rounded-md border border-brand-line bg-brand-bg px-3 text-sm text-brand-text placeholder:text-brand-muted focus:border-brand-accent focus:outline-none"
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
                    className="mt-1 w-full rounded-md border border-brand-line bg-brand-bg px-3 py-2 text-sm text-brand-text placeholder:text-brand-muted focus:border-brand-accent focus:outline-none"
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
      <div className="grid gap-3 rounded-lg border border-brand-line bg-brand-bg/40 p-4 sm:grid-cols-2">
        <label className="inline-flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            checked={state.contact_form_enabled}
            onChange={(e) => set("contact_form_enabled", e.target.checked)}
            className="mt-0.5 h-4 w-4 accent-brand-accent"
          />
          <span>
            <span className="block font-semibold">Contact form</span>
            <span className="block text-[11px] text-brand-muted">
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
            <span className="block text-[11px] text-brand-muted">
              Shows a "Get directions" button using your map pin.
            </span>
          </span>
        </label>
      </div>

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
  children
}: {
  label: string;
  full?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className={`block ${full ? "sm:col-span-2" : ""}`}>
      <span className="text-xs font-bold uppercase tracking-widest text-brand-muted">
        {label}
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
      className="h-11 w-full rounded-md border border-brand-line bg-brand-bg px-3 text-sm text-brand-text placeholder:text-brand-muted focus:border-brand-accent focus:outline-none"
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
      className="h-11 w-full rounded-md border border-brand-line bg-brand-bg px-3 text-sm text-brand-text focus:border-brand-accent focus:outline-none"
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
    <label className="inline-flex items-center gap-2 rounded-md border border-brand-line bg-brand-bg/40 px-3 py-2 text-sm">
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
