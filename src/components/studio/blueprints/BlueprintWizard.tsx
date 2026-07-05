"use client";

// Blueprint Wizard — 5-step guided setup.
//
// PRD §8.1 · §21. Total elapsed target: 60 seconds.
//   1. Trade        — autocomplete against 108-slug taxonomy
//   2. Theme colour — curated palette dropdown; writes color.accent
//                     to studio_brand_tokens on submit
//   3. Coverage     — postcode + radius OR national
//   4. Trust        — scheme checkboxes + numbers (persisted unverified)
//   5. Style        — 6 design-variant cards, single-select
//
// Outcomes (previously step 2) are auto-picked per trade based on a
// sales-vs-presentation-vs-emergency bias. Merchants edit outcomes
// later in Studio if they want to override.
//
// On finish: POSTs to /api/studio/blueprints/wizard, receives ranked
// blueprint list, offers a one-tap install of the top pick.

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { TRADE_OFF_TRADES } from "@/lib/tradeOff";
import { fetchWithRetry } from "@/lib/studio/fetchWithRetry";
import { PublishLiveDialog } from "./PublishLiveDialog";

const YELLOW = "#FFB300";
const GREEN = "#10B981";
const RED = "#DC2626";
const NEUTRAL = "#525252";

// Curated theme palette — Linear × Stripe accent colours. Each entry
// carries a hex the storefront applies as `color.accent`. Merchants can
// override to any hex later in the Design surface.
const THEME_COLORS: {
  slug: string;
  name: string;
  hex: string;
  hint: string;
}[] = [
  { slug: "trade-yellow", name: "Trade Yellow", hex: "#FFB300", hint: "Default — high-visibility trade accent" },
  { slug: "steel-blue",   name: "Steel Blue",   hex: "#2563EB", hint: "Corporate, dependable, engineering-forward" },
  { slug: "cobalt",       name: "Cobalt",       hex: "#1D4ED8", hint: "Deeper corporate, banking-grade" },
  { slug: "sky",          name: "Sky",          hex: "#0EA5E9", hint: "Fresh, tech, HVAC + renewables" },
  { slug: "emerald",      name: "Emerald",      hex: "#10B981", hint: "Landscape, gardens, eco-installers" },
  { slug: "forest",       name: "Forest",       hex: "#047857", hint: "Grounded, landscaping premium" },
  { slug: "amber",        name: "Amber",        hex: "#F59E0B", hint: "Warmer than yellow, joinery + carpentry" },
  { slug: "coral",        name: "Coral",        hex: "#F97316", hint: "Energetic, painters + decorators" },
  { slug: "crimson",      name: "Crimson",      hex: "#DC2626", hint: "Emergency, 24/7 callout" },
  { slug: "magenta",      name: "Magenta",      hex: "#DB2777", hint: "Boutique showrooms, kitchens + bathrooms" },
  { slug: "violet",       name: "Violet",       hex: "#7C3AED", hint: "Modern SaaS, tech-forward tradespeople" },
  { slug: "graphite",     name: "Graphite",     hex: "#404040", hint: "Monochrome premium, architecture-adjacent" }
];

// Trade → primary + secondary outcome defaults. Kept small + inline so
// the wizard doesn't need a new API surface. Merchants can override in
// Studio later. Falls back to quote-requests + phone-calls for anything
// not explicitly mapped — the safe universal default.
type OutcomeBundle = { primary: string; secondaries: string[] };

const SALES_TRADES = new Set([
  "building-merchant", "builders-supplies", "timber-merchant",
  "tool-merchant", "workwear-supplier", "ppe-supplier",
  "aggregate-supplier", "concrete-supplier", "roofing-supplier",
  "plumbing-merchant", "electrical-wholesaler", "fixings-supplier",
  "trade-center"
]);

const HIRE_TRADES = new Set([
  "plant-hire", "excavator-hire", "dumper-hire", "telehandler-hire",
  "crane-hire", "access-platform-hire", "heavy-machinery",
  "skip-hire", "welfare-unit-hire", "commercial-vehicle-hire",
  "tool-hire", "training-provider"
]);

const EMERGENCY_TRADES = new Set([
  "emergency-roofing", "roofing-emergency", "plumber-emergency",
  "emergency-callout", "locksmith", "recovery-service", "24hr-emergency"
]);

const PRESENTATION_TRADES = new Set([
  "electrician", "plumber", "gas-engineer", "heating-engineer",
  "roofer", "flat-roofing", "commercial-roofing",
  "carpenter", "joiner", "kitchen-fitter", "bathroom-fitter",
  "extension-builder", "extension-specialist", "landscaper",
  "landscape-gardener", "garden-designer", "painter", "decorator",
  "tiler", "wall-tiler", "floor-tiler", "plasterer",
  "solar-installer", "heat-pump-installer", "window-fitter",
  "damp-specialist", "asbestos-surveyor", "structural-engineer",
  "chartered-surveyor", "party-wall-surveyor",
  "kitchen-showroom", "bathroom-showroom", "premium-showroom",
  "handyman", "bricklayer", "fencer", "mobile-mechanic",
  "chimney-sweep", "fire-protection", "insulation-installer",
  "security-installer", "steel-fabricator", "tree-surgeon",
  "hvac-contractor", "driveway-specialist", "general-builder",
  "groundworker", "groundworks", "commercial-builder"
]);

function defaultOutcomeForTrade(tradeSlug: string): OutcomeBundle {
  if (EMERGENCY_TRADES.has(tradeSlug)) {
    return {
      primary: "emergency-callout",
      secondaries: ["phone-calls", "whatsapp-enquiries"]
    };
  }
  if (HIRE_TRADES.has(tradeSlug)) {
    return {
      primary: "equipment-hire",
      secondaries: ["quote-requests", "trade-account"]
    };
  }
  if (SALES_TRADES.has(tradeSlug)) {
    return {
      primary: "product-sales",
      secondaries: ["trade-account", "local-coverage"]
    };
  }
  if (PRESENTATION_TRADES.has(tradeSlug)) {
    return {
      primary: "project-showcase",
      secondaries: ["quote-requests", "whatsapp-enquiries"]
    };
  }
  // Universal fallback — trades not in the biased sets still lead with
  // quote requests + WhatsApp, the safest baseline for UK trades.
  return {
    primary: "quote-requests",
    secondaries: ["whatsapp-enquiries", "phone-calls"]
  };
}

const SCHEMES: { slug: string; label: string; help: string }[] = [
  { slug: "gas-safe", label: "Gas Safe", help: "Gas engineers — mandatory" },
  { slug: "niceic", label: "NICEIC", help: "Electrical Part P" },
  { slug: "napit", label: "NAPIT", help: "Electrical Part P alternative" },
  { slug: "mcs", label: "MCS", help: "Renewables — BUS grants require this" },
  { slug: "trustmark", label: "TrustMark", help: "Government-endorsed" },
  { slug: "fmb", label: "FMB", help: "Federation of Master Builders" },
  { slug: "chas", label: "CHAS", help: "SSIP contractor prequal" },
  { slug: "safecontractor", label: "SafeContractor", help: "SSIP contractor prequal" },
  { slug: "fensa", label: "FENSA", help: "Replacement windows" },
  { slug: "ipaf", label: "IPAF", help: "Access platform operator" },
  { slug: "pasma", label: "PASMA", help: "Mobile tower operator" },
  { slug: "waste-carrier", label: "Waste Carrier", help: "Mandatory for waste transport" },
  { slug: "companies-house", label: "Companies House", help: "Registered company number" },
  { slug: "vat", label: "VAT", help: "VAT registration number" },
  { slug: "public-liability", label: "Public Liability", help: "Insurance certificate" },
  { slug: "cscs", label: "CSCS", help: "Card-holder count" }
];

const VARIANTS = [
  { slug: "corporate", label: "Corporate", desc: "Clean, trust-forward, minimal colour." },
  { slug: "industrial", label: "Industrial", desc: "Dark surfaces, heavy type, warehouse feel." },
  { slug: "tradesman", label: "Tradesman", desc: "Warm yellow, plainspoken, workmanlike." },
  { slug: "premium", label: "Premium", desc: "Black + gold, photography-led, higher-ticket." },
  { slug: "emergency", label: "Emergency", desc: "Red urgency, sticky call bar, 24/7 promise." },
  { slug: "minimal", label: "Minimal", desc: "White, restrained, the copy does the talking." }
];

type RankedRow = {
  slug: string;
  name: string;
  tagline: string;
  score: { conversion: number; trust: number; mobile: number; seo: number };
  variant: string;
  rankScore: number;
  rankReasons: string[];
  browserCard: { oneLiner: string; estimatedBuildMinutes: number };
};

export function BlueprintWizard({
  currentSlug,
  displayName
}: {
  currentSlug: string;
  displayName: string;
}) {
  const [step, setStep] = useState(1);
  const [tradeSlug, setTradeSlug] = useState("");
  const [tradeQuery, setTradeQuery] = useState("");
  // Theme colour replaces the old outcome step. Outcomes are auto-picked
  // from the trade in submit(); merchants override later in Studio.
  const [themeColorSlug, setThemeColorSlug] = useState<string>("trade-yellow");
  const [coveragePostcode, setCoveragePostcode] = useState("");
  const [coverageRadius, setCoverageRadius] = useState(15);
  const [nationalCoverage, setNationalCoverage] = useState(false);
  const [ticked, setTicked] = useState<Record<string, string>>({});
  const [variant, setVariant] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ranked, setRanked] = useState<RankedRow[] | null>(null);
  const [publishingSlug, setPublishingSlug] = useState<string | null>(null);
  const [publishedUrl, setPublishedUrl] = useState<string | null>(null);

  // Deep-link from Studio home:
  //   /studio/blueprints/wizard
  //     ?trade=<slug>              trade cards
  //     &outcomes=<a>,<b>,<c>      business-discovery LLM
  //     &postcode=<pc>&radius=<mi> business-discovery LLM
  //     &national=1                business-discovery LLM
  const searchParams = useSearchParams();
  useEffect(() => {
    const preTrade = searchParams.get("trade");
    if (preTrade) {
      const match = TRADE_OFF_TRADES.find((t) => t.slug === preTrade);
      if (match) {
        setTradeSlug(match.slug);
        setTradeQuery(match.label);
        setStep((s) => (s === 1 ? 2 : s));
      }
    }
    const preTheme = searchParams.get("theme");
    if (preTheme && THEME_COLORS.some((t) => t.slug === preTheme)) {
      setThemeColorSlug(preTheme);
    }
    const prePostcode = searchParams.get("postcode");
    if (prePostcode) setCoveragePostcode(prePostcode);
    const preRadius = searchParams.get("radius");
    if (preRadius) {
      const n = Number(preRadius);
      if (!Number.isNaN(n) && n > 0 && n <= 100) setCoverageRadius(n);
    }
    if (searchParams.get("national") === "1") setNationalCoverage(true);
    // Intentionally run once on mount only — subsequent step changes
    // from user input shouldn't reset back to step 2.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const tradeMatches = useMemo(() => {
    const q = tradeQuery.trim().toLowerCase();
    if (!q) return TRADE_OFF_TRADES.slice(0, 12);
    return TRADE_OFF_TRADES.filter(
      (t) =>
        t.label.toLowerCase().includes(q) || t.slug.toLowerCase().includes(q)
    ).slice(0, 12);
  }, [tradeQuery]);

  function tickScheme(slug: string, number: string) {
    setTicked((prev) => {
      const copy = { ...prev };
      if (number.trim() === "" && slug in copy) {
        delete copy[slug];
      } else {
        copy[slug] = number;
      }
      return copy;
    });
  }

  async function submit() {
    if (!tradeSlug) return;
    setBusy(true);
    setError(null);
    try {
      // Persist credentials the merchant declared (unverified — cron
      // verifies later). Fire-and-forget; wizard doesn't wait on all
      // of them individually.
      const credWrites = Object.entries(ticked).map(([scheme, number]) =>
        fetchWithRetry("/api/studio/credentials", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ scheme, number: number.trim() || "pending" })
        }).catch(() => null)
      );

      // Apply the merchant's chosen theme colour to the brand tokens.
      // Storefront + Studio consumers read this via loadBrandTokens.
      const chosenTheme = THEME_COLORS.find((t) => t.slug === themeColorSlug);
      const themeWrite = chosenTheme
        ? fetchWithRetry("/api/studio/tokens", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              kind: "color",
              key: "accent",
              value: chosenTheme.hex
            })
          }).catch(() => null)
        : Promise.resolve(null);

      await Promise.all([...credWrites, themeWrite]);

      // Auto-pick outcomes from the trade. Merchant edits in Studio if
      // they want to override — one less step in the wizard.
      const { primary, secondaries } = defaultOutcomeForTrade(tradeSlug);

      // Persist wizard outcomes + get ranked blueprints
      const res = await fetchWithRetry(
        "/api/studio/blueprints/wizard",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            primaryOutcome: primary,
            secondaryOutcomes: secondaries,
            coveragePostcode: nationalCoverage
              ? null
              : coveragePostcode.trim() || null,
            coverageRadiusMi: nationalCoverage ? null : coverageRadius
          })
        }
      );
      const json = (await res.json()) as
        | { ok: true; ranked: RankedRow[] }
        | { ok: false; error: string };
      if (!json.ok) throw new Error(json.error);
      setRanked(json.ranked);
      setStep(6);
    } catch (err) {
      setError((err as Error).message ?? "wizard-failed");
    } finally {
      setBusy(false);
    }
  }

  function openPublishDialog(slug: string) {
    setError(null);
    setPublishingSlug(slug);
  }

  async function _legacyUnused_(slug: string) {
    setError(null);
    try {
      const res = await fetchWithRetry(
        `/api/studio/blueprints/${slug}/install`,
        { method: "POST", headers: { "Content-Type": "application/json" } }
      );
      const json = (await res.json()) as {
        ok: boolean;
        installedPages?: string[];
        error?: string;
      };
      if (!json.ok) throw new Error(json.error ?? "install-failed");
    } catch (err) {
      setError((err as Error).message ?? "install-failed");
    }
  }
  // Retain reference so TypeScript keeps the helper — deprecated in
  // favour of the Publish-Live atomic flow but useful if we need to
  // fallback to draft-only install.
  void _legacyUnused_;

  // ─── Step content ─────────────────────────────────────

  return (
    <div className="mx-auto max-w-3xl px-6 py-10 sm:py-14">
      <p
        className="text-[10px] font-extrabold uppercase tracking-widest"
        style={{ color: YELLOW }}
      >
        Setup wizard · Step {Math.min(step, 5)} of 5
      </p>
      <h1 className="mt-2 text-3xl font-extrabold leading-tight text-neutral-900 sm:text-4xl">
        {step === 1 && "Which trade are you in?"}
        {step === 2 && "Pick your theme colour."}
        {step === 3 && "Where do you work?"}
        {step === 4 && "Which schemes are you registered with?"}
        {step === 5 && "How should your site feel?"}
        {step === 6 && "Your ranked blueprints"}
      </h1>

      {/* Progress */}
      <div className="mt-6 flex gap-1">
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className="h-1 flex-1 rounded-full"
            style={{
              background: step > i ? GREEN : step === i ? YELLOW : "#E5E5E5"
            }}
          />
        ))}
      </div>

      {error && (
        <p
          role="alert"
          className="mt-6 rounded-lg bg-red-50 px-3 py-2 text-[12px] font-bold text-red-700"
        >
          {error}
        </p>
      )}

      {/* Step 1 — Trade */}
      {step === 1 && (
        <div className="mt-8 rounded-2xl border border-neutral-200 bg-white p-5">
          <input
            value={tradeQuery}
            onChange={(e) => {
              setTradeQuery(e.target.value);
              setTradeSlug("");
            }}
            placeholder="Type your trade… (carpenter, plumber, plant hire…)"
            className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-[14px] font-medium outline-none focus:border-neutral-900"
          />
          <ul className="mt-4 grid max-h-[300px] grid-cols-1 gap-1 overflow-y-auto sm:grid-cols-2">
            {tradeMatches.map((t) => (
              <li key={t.slug}>
                <button
                  type="button"
                  onClick={() => {
                    setTradeSlug(t.slug);
                    setTradeQuery(t.label);
                  }}
                  className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-[13px] transition"
                  style={{
                    background:
                      tradeSlug === t.slug ? "#FEF3C7" : "transparent",
                    color: tradeSlug === t.slug ? "#78350F" : "#171717",
                    fontWeight: tradeSlug === t.slug ? 800 : 500
                  }}
                >
                  {t.label}
                  {tradeSlug === t.slug && <span>✓</span>}
                </button>
              </li>
            ))}
            {tradeMatches.length === 0 && (
              <li className="col-span-2 rounded-lg bg-neutral-50 p-4 text-center text-[12px] text-neutral-500">
                No trades match — try a shorter search.
              </li>
            )}
          </ul>
        </div>
      )}

      {/* Step 2 — Theme colour */}
      {step === 2 && (
        <div className="mt-8 rounded-2xl border border-neutral-200 bg-white p-5">
          <p className="mb-4 text-[12px] leading-relaxed text-neutral-600">
            This becomes your site&rsquo;s accent — buttons, links, badges,
            highlights. You can override the exact hex any time in{" "}
            <strong className="font-extrabold text-neutral-900">Design</strong>.
          </p>

          {/* Currently-selected preview strip */}
          {(() => {
            const sel = THEME_COLORS.find((t) => t.slug === themeColorSlug);
            if (!sel) return null;
            return (
              <div
                className="mb-5 flex items-center gap-3 rounded-xl border p-3"
                style={{
                  borderColor: sel.hex,
                  background: `${sel.hex}12`
                }}
              >
                <span
                  className="inline-block h-8 w-8 shrink-0 rounded-full ring-2 ring-white"
                  style={{
                    background: sel.hex,
                    boxShadow: `0 6px 18px ${sel.hex}55`
                  }}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-extrabold text-neutral-900">
                    {sel.name}
                  </p>
                  <p className="mt-0.5 text-[11px] text-neutral-600">
                    {sel.hint}
                  </p>
                </div>
                <span
                  className="rounded-md bg-white px-2 py-1 font-mono text-[10px] font-bold uppercase text-neutral-700"
                  style={{ borderColor: sel.hex }}
                >
                  {sel.hex}
                </span>
              </div>
            );
          })()}

          {/* Grid of colour swatches (dropdown-adjacent — grid on mobile
              works better than a native select for previewing colour). */}
          <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {THEME_COLORS.map((t) => {
              const on = themeColorSlug === t.slug;
              return (
                <li key={t.slug}>
                  <button
                    type="button"
                    onClick={() => setThemeColorSlug(t.slug)}
                    aria-pressed={on}
                    aria-label={`Theme colour: ${t.name}`}
                    className="group flex w-full flex-col items-center gap-1.5 rounded-xl border-2 p-2.5 transition"
                    style={{
                      borderColor: on ? t.hex : "#E5E5E5",
                      background: on ? `${t.hex}0F` : "#FFFFFF"
                    }}
                  >
                    <span
                      className="inline-block h-9 w-9 rounded-full ring-2 ring-white transition group-hover:scale-105"
                      style={{
                        background: t.hex,
                        boxShadow: on
                          ? `0 6px 18px ${t.hex}66`
                          : "0 2px 6px rgba(0,0,0,0.08)"
                      }}
                    />
                    <span
                      className="text-[10px] font-extrabold uppercase tracking-widest"
                      style={{ color: on ? t.hex : "#171717" }}
                    >
                      {t.name}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>

          {tradeSlug && (
            <p className="mt-5 rounded-lg bg-neutral-50 p-3 text-[11px] leading-relaxed text-neutral-600">
              We&rsquo;ll pre-tune your site&rsquo;s outcomes for a{" "}
              <strong className="font-extrabold text-neutral-900">
                {tradeQuery || tradeSlug}
              </strong>
              . You can change them later in Studio.
            </p>
          )}
        </div>
      )}

      {/* Step 3 — Coverage */}
      {step === 3 && (
        <div className="mt-8 rounded-2xl border border-neutral-200 bg-white p-5">
          <div className="flex items-center justify-between border-b border-neutral-100 pb-4">
            <div>
              <p className="text-[13px] font-extrabold text-neutral-900">
                I work nationally
              </p>
              <p className="text-[11px] text-neutral-600">
                Skip postcode + radius, no coverage gate on the site.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setNationalCoverage((v) => !v)}
              aria-pressed={nationalCoverage}
              className="relative inline-flex h-7 w-12 items-center rounded-full transition"
              style={{
                background: nationalCoverage ? GREEN : "#D4D4D4"
              }}
            >
              <span
                className="absolute top-0.5 h-6 w-6 rounded-full bg-white shadow"
                style={{
                  left: nationalCoverage ? 22 : 2,
                  transition: "left 180ms cubic-bezier(0.4,0,0.2,1)"
                }}
              />
            </button>
          </div>

          {!nationalCoverage && (
            <div className="mt-4 space-y-4">
              <div>
                <label className="text-[10px] font-extrabold uppercase tracking-widest text-neutral-500">
                  Your postcode area
                </label>
                <input
                  value={coveragePostcode}
                  onChange={(e) => setCoveragePostcode(e.target.value)}
                  placeholder="e.g. NR1 or SW9"
                  className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-[14px] font-medium outline-none focus:border-neutral-900"
                />
                <p className="mt-1 text-[10px] text-neutral-500">
                  We generate coverage pages per postcode area — huge local
                  SEO win.
                </p>
              </div>
              <div>
                <label className="flex items-center justify-between text-[10px] font-extrabold uppercase tracking-widest text-neutral-500">
                  <span>Service radius</span>
                  <span
                    className="text-[13px] font-extrabold"
                    style={{ color: "#171717" }}
                  >
                    {coverageRadius} miles
                  </span>
                </label>
                <input
                  type="range"
                  min={1}
                  max={100}
                  step={1}
                  value={coverageRadius}
                  onChange={(e) => setCoverageRadius(Number(e.target.value))}
                  className="mt-2 w-full"
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Step 4 — Trust */}
      {step === 4 && (
        <div className="mt-8 rounded-2xl border border-neutral-200 bg-white p-5">
          <p className="text-[11px] text-neutral-500">
            Tick each scheme you hold. Enter your number if you have it —
            we'll verify daily and light the badge on your site the moment
            it's confirmed.
          </p>
          <ul className="mt-4 grid gap-2 sm:grid-cols-2">
            {SCHEMES.map((s) => {
              const on = s.slug in ticked;
              return (
                <li
                  key={s.slug}
                  className="rounded-lg border p-3 transition"
                  style={{
                    borderColor: on ? YELLOW : "#E5E5E5",
                    background: on ? "#FEF3C7" : "#FFFFFF"
                  }}
                >
                  <label className="flex items-start gap-2 text-[12px]">
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={() =>
                        setTicked((prev) => {
                          const copy = { ...prev };
                          if (on) {
                            delete copy[s.slug];
                          } else {
                            copy[s.slug] = "";
                          }
                          return copy;
                        })
                      }
                      className="mt-0.5"
                    />
                    <div className="flex-1">
                      <p className="font-extrabold text-neutral-900">
                        {s.label}
                      </p>
                      <p className="text-[10px] text-neutral-600">{s.help}</p>
                    </div>
                  </label>
                  {on && (
                    <input
                      value={ticked[s.slug] ?? ""}
                      onChange={(e) => tickScheme(s.slug, e.target.value)}
                      placeholder="Your number (add later if you don't have it)"
                      className="mt-2 w-full rounded-md border border-neutral-300 bg-white px-2 py-1 text-[11px] outline-none focus:border-neutral-900"
                    />
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Step 5 — Style */}
      {step === 5 && (
        <div className="mt-8">
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {VARIANTS.map((v) => {
              const on = variant === v.slug;
              return (
                <li key={v.slug}>
                  <button
                    type="button"
                    onClick={() => setVariant(v.slug)}
                    className="flex h-full w-full flex-col overflow-hidden rounded-2xl border-2 text-left transition"
                    style={{
                      borderColor: on ? YELLOW : "#E5E5E5",
                      background: on ? "#FFFBEB" : "#FFFFFF"
                    }}
                  >
                    <VariantPreview slug={v.slug} />
                    <div className="p-3">
                      <p className="text-[13px] font-extrabold text-neutral-900">
                        {v.label}
                      </p>
                      <p className="mt-1 text-[11px] text-neutral-600">
                        {v.desc}
                      </p>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Step 6 — Ranked results */}
      {step === 6 && ranked && (
        <div className="mt-8 space-y-3">
          {ranked.length === 0 && (
            <p className="rounded-2xl border-2 border-dashed border-neutral-300 bg-neutral-50 p-8 text-center text-[13px] font-bold text-neutral-500">
              No blueprints match yet — try broader outcomes or come back
              once more launch.
            </p>
          )}
          {ranked.map((r, idx) => (
            <div
              key={r.slug}
              className="flex flex-col gap-3 rounded-2xl border border-neutral-200 bg-white p-4 sm:flex-row sm:items-center"
            >
              <div className="flex-1">
                <p
                  className="text-[9px] font-extrabold uppercase tracking-widest"
                  style={{ color: idx === 0 ? GREEN : NEUTRAL }}
                >
                  {idx === 0 ? "Top pick" : `Rank ${idx + 1}`}
                </p>
                <p className="text-[15px] font-extrabold text-neutral-900">
                  {r.name}
                </p>
                <p className="text-[11px] text-neutral-600">
                  {r.browserCard.oneLiner}
                </p>
                {r.rankReasons.length > 0 && (
                  <p className="mt-1 text-[10px] font-bold text-amber-800">
                    Why: {r.rankReasons.join(" · ")}
                  </p>
                )}
                <p className="mt-1 text-[10px] text-neutral-500">
                  Conv {r.score.conversion} · Trust {r.score.trust} · Mob{" "}
                  {r.score.mobile} · SEO {r.score.seo} · ~
                  {r.browserCard.estimatedBuildMinutes} min build
                </p>
              </div>
              <div className="flex gap-2">
                <Link
                  href="/studio/blueprints"
                  className="inline-flex h-9 items-center rounded-lg border border-neutral-300 bg-white px-3 text-[11px] font-extrabold uppercase tracking-widest text-neutral-700 transition hover:bg-neutral-50"
                >
                  Preview
                </Link>
                {publishedUrl && publishingSlug === r.slug ? (
                  <a
                    href={publishedUrl}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="inline-flex h-9 items-center rounded-lg px-3 text-[11px] font-extrabold uppercase tracking-widest text-white no-underline"
                    style={{ background: GREEN }}
                  >
                    View live →
                  </a>
                ) : (
                  <button
                    type="button"
                    onClick={() => openPublishDialog(r.slug)}
                    className="inline-flex h-9 items-center rounded-lg px-3 text-[11px] font-extrabold uppercase tracking-widest text-neutral-900"
                    style={{ background: YELLOW }}
                  >
                    Publish live
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Nav */}
      {step !== 6 && (
        <div className="mt-8 flex items-center justify-between">
          <button
            type="button"
            onClick={() => setStep((s) => Math.max(1, s - 1))}
            disabled={step === 1}
            className="inline-flex h-10 items-center rounded-lg border border-neutral-300 bg-white px-4 text-[11px] font-extrabold uppercase tracking-widest text-neutral-700 disabled:opacity-40"
          >
            ← Back
          </button>
          <button
            type="button"
            onClick={() => {
              if (step === 5) {
                void submit();
                return;
              }
              setStep((s) => s + 1);
            }}
            disabled={
              busy ||
              (step === 1 && !tradeSlug) ||
              (step === 2 && !themeColorSlug) ||
              (step === 5 && !variant)
            }
            className="inline-flex h-10 items-center gap-2 rounded-lg px-4 text-[11px] font-extrabold uppercase tracking-widest text-neutral-900 disabled:opacity-40"
            style={{ background: YELLOW }}
          >
            {step === 5 ? (busy ? "Building…" : "Show my sites →") : "Next →"}
          </button>
        </div>
      )}

      {step === 6 && (
        <div className="mt-8 flex items-center justify-between">
          <button
            type="button"
            onClick={() => {
              setStep(1);
              setRanked(null);
              setPublishedUrl(null);
              setPublishingSlug(null);
            }}
            className="inline-flex h-10 items-center rounded-lg border border-neutral-300 bg-white px-4 text-[11px] font-extrabold uppercase tracking-widest text-neutral-700"
          >
            ← Start over
          </button>
          <Link
            href="/studio/blueprints"
            className="text-[11px] font-extrabold uppercase tracking-widest"
            style={{ color: NEUTRAL }}
          >
            Browse all blueprints →
          </Link>
        </div>
      )}

      <PublishLiveDialog
        open={publishingSlug !== null}
        blueprintSlug={publishingSlug}
        blueprintName={
          ranked?.find((r) => r.slug === publishingSlug)?.name ?? null
        }
        suggestedName={displayName}
        currentSlug={currentSlug}
        onClose={() => setPublishingSlug(null)}
        onPublished={(url) => setPublishedUrl(url)}
      />
    </div>
  );
}

// Minimal variant preview — the same style-token map used on
// BlueprintCard so the wizard preview matches what the merchant will
// see in the browser.
function VariantPreview({ slug }: { slug: string }) {
  const palette: Record<string, { bg: string; ink: string; accent: string }> = {
    corporate: { bg: "#F1F5F9", ink: "#0F172A", accent: "#2563EB" },
    industrial: { bg: "#111827", ink: "#F9FAFB", accent: "#FFB300" },
    tradesman: { bg: "#FFF7ED", ink: "#7C2D12", accent: "#FFB300" },
    premium: { bg: "#0A0A0A", ink: "#F5F5F5", accent: "#C9A24B" },
    emergency: { bg: "#FEE2E2", ink: "#7F1D1D", accent: "#DC2626" },
    minimal: { bg: "#FFFFFF", ink: "#171717", accent: "#0A0A0A" }
  };
  const p = palette[slug] ?? palette.minimal;
  return (
    <div
      className="relative flex aspect-[4/3] w-full flex-col justify-end p-4"
      style={{ background: p.bg, color: p.ink }}
    >
      <div
        className="mb-2 h-3 w-1/2 rounded"
        style={{ background: p.ink, opacity: 0.9 }}
      />
      <div
        className="mb-3 h-2 w-3/4 rounded"
        style={{ background: p.ink, opacity: 0.35 }}
      />
      <div
        className="inline-flex w-fit rounded-md px-2 py-1 text-[8px] font-extrabold uppercase tracking-widest"
        style={{ background: p.accent, color: p.bg === "#0A0A0A" || p.bg === "#111827" ? "#0A0A0A" : "#FFFFFF" }}
      >
        Call now
      </div>
    </div>
  );
}
