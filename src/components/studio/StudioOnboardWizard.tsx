"use client";

// StudioOnboardWizard — Philip's canonical 7-question onboard.
//
// Every question drives a structural decision. Q1 = business type,
// Q2 = trade, Q3 = products/services/both, Q4 = business description,
// Q5 = location + travel, Q6 = contact methods, Q7 = pages to include.
//
// Autosave to localStorage per merchant slug so a refresh doesn't
// wipe progress. On final submit, hits /api/studio/ai/orchestrate
// which fans out multiple compose calls to build the full profile.

import { useEffect, useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Loader2,
  Check
} from "lucide-react";

const YELLOW = "#FFB300";
const YELLOW_HOVER = "#E5A500";
const CREAM = "#FBF6EC";
const CARD_BORDER = "#EDE4CE";

type Answers = {
  businessType?:
    | "tradesperson"
    | "supplier"
    | "trade-company"
    | "manufacturer"
    | "equipment-hire"
    | "other";
  trade?: string;
  offering?: "services" | "products" | "both";
  description?: string;
  city?: string;
  travelDistance?: string;
  deliversNational?: boolean;
  contactMethods?: string[];
  pages?: string[];
};

const BUSINESS_TYPES: Array<{
  value: NonNullable<Answers["businessType"]>;
  label: string;
  hint: string;
}> = [
  { value: "tradesperson", label: "Tradesperson", hint: "Sole trader or small crew on the tools" },
  { value: "supplier", label: "Building Supplier", hint: "Merchant selling to trades + public" },
  { value: "trade-company", label: "Trade Company", hint: "Established firm with staff" },
  { value: "manufacturer", label: "Manufacturer", hint: "You make + sell your own products" },
  { value: "equipment-hire", label: "Equipment Hire", hint: "Plant, tool, or vehicle hire" },
  { value: "other", label: "Other", hint: "Doesn't quite fit — pick this to describe" }
];

const TRADE_SUGGESTIONS = [
  "Builder",
  "Electrician",
  "Plumber",
  "Carpenter",
  "Roofer",
  "Scaffolder",
  "Painter",
  "Landscaping",
  "Timber Merchant",
  "Plumbing Supplies",
  "Electrical Wholesaler",
  "Bricklayer",
  "Tiler",
  "Plasterer",
  "Groundworker",
  "Heat Pump Installer"
];

const OFFERINGS: Array<{
  value: NonNullable<Answers["offering"]>;
  label: string;
  hint: string;
}> = [
  { value: "services", label: "Services only", hint: "You do the work" },
  { value: "products", label: "Products only", hint: "You sell physical stock" },
  { value: "both", label: "Both", hint: "Products + services" }
];

const CONTACT_METHODS = [
  "Phone",
  "WhatsApp",
  "Email",
  "Website",
  "Facebook",
  "Instagram",
  "TikTok"
];

const PAGE_MODULES = [
  { id: "profile", label: "Company profile" },
  { id: "products", label: "Product catalogue" },
  { id: "services", label: "Service listings" },
  { id: "chat", label: "Instant chat" },
  { id: "quote", label: "Quote request form" },
  { id: "booking", label: "Appointment booking" },
  { id: "link-in-bio", label: "Link in Bio page" },
  { id: "gallery", label: "Photo gallery" },
  { id: "videos", label: "Videos" },
  { id: "reviews", label: "Customer reviews" },
  { id: "map", label: "Directions / Map" }
];

const STEPS: Array<{ id: number; title: string; hint: string }> = [
  { id: 1, title: "What best describes your business?", hint: "Sets the tone for everything." },
  { id: 2, title: "What trade or industry are you in?", hint: "Drives page copy + which apps auto-install." },
  { id: 3, title: "What do you offer?", hint: "Services, products, or both — decides the whole page order." },
  { id: 4, title: "Tell us about your business.", hint: "A short pitch we can weave through your profile." },
  { id: 5, title: "Where do you work or deliver?", hint: "Location + reach shape service area + WhatsApp intros." },
  { id: 6, title: "How can customers contact you?", hint: "Only these appear on your profile + sticky CTA." },
  { id: 7, title: "What would you like your app to include?", hint: "You pick the pages. We build them." }
];

const LS_KEY_PREFIX = "network.onboard.";

type ComposeResult = {
  slot: string;
  library: string;
  proposal: {
    sectionId: string;
    reasoning: string;
    params: Record<string, unknown>;
  } | null;
  catalogEntry?: {
    id: string;
    name: string;
    library: string;
    description: string;
  } | null;
};

type OrchestrateResponse = {
  ok: boolean;
  results?: ComposeResult[];
  totalUsage?: {
    inputTokens: number;
    outputTokens: number;
    cacheReadTokens: number;
    cacheCreationTokens: number;
  };
  error?: string;
};

export function StudioOnboardWizard() {
  const [auth, setAuth] = useState<{ slug: string; token: string } | null>(null);
  const [step, setStep] = useState(1);
  const [answers, setAnswers] = useState<Answers>({});
  const [generating, setGenerating] = useState(false);
  const [results, setResults] = useState<ComposeResult[] | null>(null);
  const [totalUsage, setTotalUsage] = useState<OrchestrateResponse["totalUsage"] | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Pick up magic-link auth + rehydrate saved answers.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const sp = new URLSearchParams(window.location.search);
    const slug = sp.get("slug");
    const token = sp.get("token");
    if (slug && token) {
      setAuth({ slug, token });
      try {
        const raw = window.localStorage.getItem(`${LS_KEY_PREFIX}${slug}`);
        if (raw) setAnswers(JSON.parse(raw) as Answers);
      } catch {}
    }
  }, []);

  // Autosave to localStorage per slug so a refresh doesn't wipe progress.
  useEffect(() => {
    if (!auth) return;
    try {
      window.localStorage.setItem(
        `${LS_KEY_PREFIX}${auth.slug}`,
        JSON.stringify(answers)
      );
    } catch {}
  }, [auth, answers]);

  const canProceed = useMemo(() => {
    switch (step) {
      case 1:
        return !!answers.businessType;
      case 2:
        return !!answers.trade?.trim();
      case 3:
        return !!answers.offering;
      case 4:
        return (answers.description ?? "").trim().length >= 10;
      case 5:
        return !!answers.city?.trim();
      case 6:
        return (answers.contactMethods ?? []).length > 0;
      case 7:
        return (answers.pages ?? []).length > 0;
      default:
        return true;
    }
  }, [step, answers]);

  async function generate() {
    if (!auth || generating) return;
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch("/api/studio/ai/orchestrate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: auth.slug,
          edit_token: auth.token,
          answers
        })
      });
      const data = (await res.json()) as OrchestrateResponse;
      if (!res.ok || !data.ok || !data.results) {
        setError(data.error ?? `Generate failed (${res.status})`);
        return;
      }
      setResults(data.results);
      setTotalUsage(data.totalUsage ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error");
    } finally {
      setGenerating(false);
    }
  }

  if (!auth) {
    return (
      <div className="flex min-h-screen items-center justify-center" style={{ background: CREAM }}>
        <div
          className="max-w-md rounded-2xl border bg-white p-6 text-center"
          style={{ borderColor: CARD_BORDER }}
        >
          <p className="text-[13px] font-medium text-neutral-700">
            Add your magic-link params to the URL to sign in:
            <br />
            <code className="text-[12px] text-neutral-500">?slug=…&token=…</code>
          </p>
        </div>
      </div>
    );
  }

  if (results) {
    return (
      <ReviewProfile
        results={results}
        totalUsage={totalUsage}
        onStartOver={() => {
          setResults(null);
          setStep(1);
        }}
      />
    );
  }

  return (
    <div className="min-h-screen" style={{ background: CREAM }}>
      <header
        className="border-b bg-white"
        style={{ borderColor: CARD_BORDER }}
      >
        <div className="mx-auto max-w-2xl px-4 py-4">
          <div className="flex items-center gap-2">
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{ background: YELLOW }}
              aria-hidden="true"
            />
            <p className="text-[12px] font-black uppercase tracking-[0.22em] text-neutral-900">
              Thenetworkers
            </p>
            <span className="ml-auto text-[11px] font-bold text-neutral-500">
              Step {step} of 7
            </span>
          </div>
          <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-neutral-100">
            <div
              className="h-full transition-all duration-300"
              style={{
                width: `${(step / 7) * 100}%`,
                background: YELLOW
              }}
            />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-6">
        <div
          className="rounded-2xl border bg-white p-5"
          style={{ borderColor: CARD_BORDER }}
        >
          <h1 className="text-[20px] font-black leading-tight text-neutral-900">
            {STEPS[step - 1].title}
          </h1>
          <p className="mt-1 text-[12px] font-medium text-neutral-500">
            {STEPS[step - 1].hint}
          </p>

          <div className="mt-5">
            {step === 1 && (
              <StepBusinessType
                value={answers.businessType}
                onChange={(v) => setAnswers({ ...answers, businessType: v })}
              />
            )}
            {step === 2 && (
              <StepTrade
                value={answers.trade}
                onChange={(v) => setAnswers({ ...answers, trade: v })}
              />
            )}
            {step === 3 && (
              <StepOffering
                value={answers.offering}
                onChange={(v) => setAnswers({ ...answers, offering: v })}
              />
            )}
            {step === 4 && (
              <StepDescription
                value={answers.description}
                onChange={(v) => setAnswers({ ...answers, description: v })}
              />
            )}
            {step === 5 && (
              <StepLocation
                city={answers.city}
                distance={answers.travelDistance}
                national={answers.deliversNational}
                offering={answers.offering}
                onCity={(v) => setAnswers({ ...answers, city: v })}
                onDistance={(v) => setAnswers({ ...answers, travelDistance: v })}
                onNational={(v) => setAnswers({ ...answers, deliversNational: v })}
              />
            )}
            {step === 6 && (
              <StepContact
                value={answers.contactMethods}
                onChange={(v) => setAnswers({ ...answers, contactMethods: v })}
              />
            )}
            {step === 7 && (
              <StepPages
                value={answers.pages}
                offering={answers.offering}
                onChange={(v) => setAnswers({ ...answers, pages: v })}
              />
            )}
          </div>

          {error && (
            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[12px] font-bold text-red-800">
              {error}
            </div>
          )}

          <div className="mt-6 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => setStep((s) => Math.max(1, s - 1))}
              disabled={step === 1}
              className="inline-flex h-10 items-center gap-1.5 rounded-full border bg-white px-4 text-[13px] font-bold text-neutral-700 disabled:opacity-40"
              style={{ borderColor: CARD_BORDER }}
            >
              <ChevronLeft size={14} aria-hidden="true" />
              Back
            </button>
            {step < 7 ? (
              <button
                type="button"
                onClick={() => setStep((s) => s + 1)}
                disabled={!canProceed}
                className="inline-flex h-10 items-center gap-1.5 rounded-full px-5 text-[13px] font-black text-neutral-900 shadow-sm transition active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40"
                style={{ background: YELLOW }}
              >
                Next
                <ChevronRight size={14} aria-hidden="true" />
              </button>
            ) : (
              <button
                type="button"
                onClick={generate}
                disabled={!canProceed || generating}
                className="inline-flex h-10 items-center gap-1.5 rounded-full px-5 text-[13px] font-black text-neutral-900 shadow-sm transition active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40"
                style={{ background: YELLOW }}
              >
                {generating ? (
                  <Loader2 size={14} className="animate-spin" aria-hidden="true" />
                ) : (
                  <Sparkles size={14} aria-hidden="true" />
                )}
                {generating ? "Generating your profile…" : "Generate my profile"}
              </button>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

// ─── STEP COMPONENTS ───────────────────────────────────────────────

function StepBusinessType({
  value,
  onChange
}: {
  value: Answers["businessType"];
  onChange: (v: NonNullable<Answers["businessType"]>) => void;
}) {
  return (
    <ul className="grid gap-2 sm:grid-cols-2">
      {BUSINESS_TYPES.map((bt) => {
        const active = value === bt.value;
        return (
          <li key={bt.value}>
            <button
              type="button"
              onClick={() => onChange(bt.value)}
              className={
                "w-full rounded-xl border p-3 text-left transition " +
                (active ? "bg-amber-50" : "bg-white hover:bg-neutral-50")
              }
              style={{
                borderColor: active ? YELLOW : CARD_BORDER,
                boxShadow: active ? `0 0 0 2px ${YELLOW}33` : undefined
              }}
            >
              <p className="text-[13px] font-black text-neutral-900">
                {bt.label}
              </p>
              <p className="mt-0.5 text-[11px] font-medium text-neutral-500">
                {bt.hint}
              </p>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function StepTrade({
  value,
  onChange
}: {
  value: string | undefined;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <input
        type="text"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        list="trade-suggestions"
        placeholder="e.g. Electrician, Timber Merchant, Roofer"
        className="w-full rounded-xl border bg-white p-3 text-[14px] font-medium text-neutral-900"
        style={{ borderColor: CARD_BORDER }}
      />
      <datalist id="trade-suggestions">
        {TRADE_SUGGESTIONS.map((t) => (
          <option key={t} value={t} />
        ))}
      </datalist>
      <p className="mt-2 text-[11px] text-neutral-500">
        Type or pick from the list. Autocompletes as you type.
      </p>
    </div>
  );
}

function StepOffering({
  value,
  onChange
}: {
  value: Answers["offering"];
  onChange: (v: NonNullable<Answers["offering"]>) => void;
}) {
  return (
    <ul className="space-y-2">
      {OFFERINGS.map((o) => {
        const active = value === o.value;
        return (
          <li key={o.value}>
            <button
              type="button"
              onClick={() => onChange(o.value)}
              className={
                "flex w-full items-center gap-3 rounded-xl border p-3 text-left transition " +
                (active ? "bg-amber-50" : "bg-white hover:bg-neutral-50")
              }
              style={{
                borderColor: active ? YELLOW : CARD_BORDER,
                boxShadow: active ? `0 0 0 2px ${YELLOW}33` : undefined
              }}
            >
              <span
                className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border"
                style={{
                  borderColor: active ? YELLOW : CARD_BORDER,
                  background: active ? YELLOW : "white"
                }}
              >
                {active && <Check size={12} className="text-neutral-900" aria-hidden="true" />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-black text-neutral-900">
                  {o.label}
                </p>
                <p className="mt-0.5 text-[11px] font-medium text-neutral-500">
                  {o.hint}
                </p>
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function StepDescription({
  value,
  onChange
}: {
  value: string | undefined;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <textarea
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        rows={4}
        maxLength={400}
        placeholder="e.g. Family-run roofing firm in Manchester. 12 years on the tools. Slate + tile, insurance-approved."
        className="w-full resize-none rounded-xl border bg-white p-3 text-[14px] leading-[1.5] text-neutral-900"
        style={{ borderColor: CARD_BORDER }}
      />
      <p className="mt-1 text-right text-[11px] text-neutral-500">
        {(value ?? "").length} / 400
      </p>
    </div>
  );
}

function StepLocation({
  city,
  distance,
  national,
  offering,
  onCity,
  onDistance,
  onNational
}: {
  city: string | undefined;
  distance: string | undefined;
  national: boolean | undefined;
  offering: Answers["offering"];
  onCity: (v: string) => void;
  onDistance: (v: string) => void;
  onNational: (v: boolean) => void;
}) {
  return (
    <div className="space-y-4">
      <label className="block">
        <span className="text-[12px] font-black text-neutral-700">
          Town or city
        </span>
        <input
          type="text"
          value={city ?? ""}
          onChange={(e) => onCity(e.target.value)}
          placeholder="e.g. Manchester"
          className="mt-1 w-full rounded-xl border bg-white p-3 text-[14px] text-neutral-900"
          style={{ borderColor: CARD_BORDER }}
        />
      </label>
      <label className="block">
        <span className="text-[12px] font-black text-neutral-700">
          How far do you travel?
        </span>
        <select
          value={distance ?? ""}
          onChange={(e) => onDistance(e.target.value)}
          className="mt-1 w-full rounded-xl border bg-white px-3 py-3 text-[14px] text-neutral-900"
          style={{ borderColor: CARD_BORDER }}
        >
          <option value="">— pick one —</option>
          <option value="local-5">Local — up to 5 miles</option>
          <option value="local-15">Local — up to 15 miles</option>
          <option value="regional">Regional — up to 50 miles</option>
          <option value="national">National — anywhere UK</option>
        </select>
      </label>
      {(offering === "products" || offering === "both") && (
        <label className="flex cursor-pointer items-start gap-3 rounded-xl border p-3" style={{ borderColor: CARD_BORDER }}>
          <input
            type="checkbox"
            checked={national ?? false}
            onChange={(e) => onNational(e.target.checked)}
            className="mt-0.5 h-5 w-5 accent-amber-500"
          />
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-black text-neutral-900">
              I deliver products nationally
            </p>
            <p className="mt-0.5 text-[11px] font-medium text-neutral-500">
              Shows a UK-wide delivery badge + nation-scoped service copy.
            </p>
          </div>
        </label>
      )}
    </div>
  );
}

function StepContact({
  value,
  onChange
}: {
  value: string[] | undefined;
  onChange: (v: string[]) => void;
}) {
  const set = new Set(value ?? []);
  function toggle(m: string) {
    const next = new Set(set);
    if (next.has(m)) next.delete(m);
    else next.add(m);
    onChange(Array.from(next));
  }
  return (
    <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {CONTACT_METHODS.map((m) => {
        const active = set.has(m);
        return (
          <li key={m}>
            <button
              type="button"
              onClick={() => toggle(m)}
              className={
                "flex w-full items-center gap-2 rounded-xl border px-3 py-3 text-left transition " +
                (active ? "bg-amber-50" : "bg-white hover:bg-neutral-50")
              }
              style={{
                borderColor: active ? YELLOW : CARD_BORDER,
                boxShadow: active ? `0 0 0 2px ${YELLOW}33` : undefined
              }}
            >
              <span
                className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded border"
                style={{
                  borderColor: active ? YELLOW : CARD_BORDER,
                  background: active ? YELLOW : "white"
                }}
              >
                {active && <Check size={10} className="text-neutral-900" aria-hidden="true" />}
              </span>
              <span className="text-[13px] font-bold text-neutral-800">{m}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function StepPages({
  value,
  offering,
  onChange
}: {
  value: string[] | undefined;
  offering: Answers["offering"];
  onChange: (v: string[]) => void;
}) {
  const set = new Set(value ?? []);
  function toggle(m: string) {
    const next = new Set(set);
    if (next.has(m)) next.delete(m);
    else next.add(m);
    onChange(Array.from(next));
  }
  // Products page hidden if merchant only offers services; services hidden if products only
  const visible = PAGE_MODULES.filter((m) => {
    if (m.id === "products" && offering === "services") return false;
    if (m.id === "services" && offering === "products") return false;
    return true;
  });
  return (
    <ul className="grid gap-2 sm:grid-cols-2">
      {visible.map((m) => {
        const active = set.has(m.id);
        return (
          <li key={m.id}>
            <button
              type="button"
              onClick={() => toggle(m.id)}
              className={
                "flex w-full items-center gap-2.5 rounded-xl border px-3 py-3 text-left transition " +
                (active ? "bg-amber-50" : "bg-white hover:bg-neutral-50")
              }
              style={{
                borderColor: active ? YELLOW : CARD_BORDER,
                boxShadow: active ? `0 0 0 2px ${YELLOW}33` : undefined
              }}
            >
              <span
                className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded border"
                style={{
                  borderColor: active ? YELLOW : CARD_BORDER,
                  background: active ? YELLOW : "white"
                }}
              >
                {active && <Check size={10} className="text-neutral-900" aria-hidden="true" />}
              </span>
              <span className="text-[13px] font-bold text-neutral-800">
                {m.label}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

// ─── REVIEW ────────────────────────────────────────────────────────

function ReviewProfile({
  results,
  totalUsage,
  onStartOver
}: {
  results: ComposeResult[];
  totalUsage: OrchestrateResponse["totalUsage"] | null | undefined;
  onStartOver: () => void;
}) {
  const [publishing, setPublishing] = useState(false);
  const [publishResult, setPublishResult] = useState<{
    ok: boolean;
    liveUrl?: string;
    error?: string;
  } | null>(null);

  async function publish() {
    if (publishing) return;
    setPublishing(true);
    setPublishResult(null);
    try {
      const sp = new URLSearchParams(window.location.search);
      const slug = sp.get("slug");
      const token = sp.get("token");
      const res = await fetch("/api/studio/ai/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug,
          edit_token: token,
          sections: results,
          page_id: "home"
        })
      });
      const data = (await res.json()) as {
        ok: boolean;
        liveUrl?: string;
        error?: string;
      };
      if (!res.ok || !data.ok) {
        setPublishResult({ ok: false, error: data.error ?? `HTTP ${res.status}` });
        return;
      }
      setPublishResult({ ok: true, liveUrl: data.liveUrl });
    } catch (e) {
      setPublishResult({
        ok: false,
        error: e instanceof Error ? e.message : "Network error"
      });
    } finally {
      setPublishing(false);
    }
  }
  const totalCostUsd = useMemo(() => {
    if (!totalUsage) return 0;
    return (
      (totalUsage.inputTokens / 1_000_000) * 3 +
      (totalUsage.outputTokens / 1_000_000) * 15 +
      (totalUsage.cacheReadTokens / 1_000_000) * 0.3 +
      (totalUsage.cacheCreationTokens / 1_000_000) * 3.75
    );
  }, [totalUsage]);

  return (
    <div className="min-h-screen" style={{ background: CREAM }}>
      <header
        className="border-b bg-white"
        style={{ borderColor: CARD_BORDER }}
      >
        <div className="mx-auto max-w-3xl px-4 py-4">
          <div className="flex items-center gap-2">
            <Check
              size={16}
              className="text-emerald-600"
              aria-hidden="true"
            />
            <p className="text-[13px] font-black text-neutral-900">
              Profile generated — review + publish
            </p>
            <span className="ml-auto text-[11px] font-bold text-neutral-500">
              ${totalCostUsd.toFixed(4)} · {results.length} sections
            </span>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-3xl space-y-3 px-4 py-6">
        <p className="text-[13px] text-neutral-700">
          We composed <span className="font-black">{results.length}</span>{" "}
          sections from your answers. Review each, mutate by prompt if you
          want to tweak, then publish.
        </p>
        <ul className="space-y-3">
          {results.map((r) => (
            <li
              key={r.slot}
              className="rounded-2xl border bg-white p-4"
              style={{ borderColor: CARD_BORDER }}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-neutral-500">
                    {r.slot} · {r.library}
                  </p>
                  <h3 className="mt-1 text-[15px] font-black text-neutral-900">
                    {r.catalogEntry?.name ??
                      r.proposal?.sectionId ??
                      "Unknown"}
                  </h3>
                  {r.proposal?.reasoning && (
                    <p className="mt-1 text-[12px] italic text-neutral-600">
                      Why: {r.proposal.reasoning}
                    </p>
                  )}
                </div>
              </div>
              {r.proposal?.params && (
                <details className="mt-3">
                  <summary className="cursor-pointer text-[11px] font-bold text-neutral-500 hover:text-neutral-800">
                    Show params
                  </summary>
                  <pre
                    className="mt-2 max-h-[280px] overflow-auto rounded-lg p-3 text-[11px] leading-[1.5]"
                    style={{ background: "#0A0A0A", color: "#E5E5E5" }}
                  >
                    {JSON.stringify(r.proposal.params, null, 2)}
                  </pre>
                </details>
              )}
            </li>
          ))}
        </ul>
        {publishResult?.ok && publishResult.liveUrl && (
          <div className="mt-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
            <p className="text-[13px] font-black text-emerald-900">
              Published — your profile is live.
            </p>
            <p className="mt-1 text-[12px] text-emerald-800">
              Visit{" "}
              <a
                href={publishResult.liveUrl}
                className="font-black underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                {publishResult.liveUrl}
              </a>{" "}
              to see it.
            </p>
          </div>
        )}
        {publishResult && !publishResult.ok && (
          <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[12px] font-bold text-red-800">
            Publish failed: {publishResult.error}
          </div>
        )}
        <div className="flex items-center justify-between pt-2">
          <button
            type="button"
            onClick={onStartOver}
            className="text-[12px] font-bold text-neutral-500 hover:text-neutral-800"
          >
            ← Start over
          </button>
          <button
            type="button"
            onClick={publish}
            disabled={publishing || publishResult?.ok}
            className="inline-flex h-10 items-center gap-1.5 rounded-full px-5 text-[13px] font-black text-neutral-900 shadow-sm transition active:scale-[0.97] disabled:opacity-50"
            style={{ background: YELLOW }}
          >
            {publishing ? (
              <Loader2 size={14} className="animate-spin" aria-hidden="true" />
            ) : publishResult?.ok ? (
              <Check size={14} aria-hidden="true" />
            ) : (
              <Sparkles size={14} aria-hidden="true" />
            )}
            {publishing
              ? "Publishing…"
              : publishResult?.ok
                ? "Published"
                : "Publish"}
          </button>
        </div>
      </main>
    </div>
  );
}

export default StudioOnboardWizard;
