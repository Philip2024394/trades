"use client";

// Xrated Trades — step-by-step signup wizard.
//
// 4 screens, one question at a time, big Next buttons. State lives in
// React useState and is mirrored to localStorage so a tradesperson can
// reload mid-flow and resume. Once the listing is created the wizard
// state is cleared so the next visitor starts fresh.
//
// Steps:
//   1. Pick your trade
//   2. Tell us about you (business name, city, WhatsApp, email, password, bio)
//   3. Hero photo (optional)
//   4. Live preview → Go Live
//
// Submission reuses the existing /api/trade-off/create endpoint and
// redirects to /trade-off/signup/done?slug=...&token=...&status=...
// — same contract as the legacy /trade-off/signup form.

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  TRADE_OFF_TRADES,
  MERCHANT_GRADE_TRADES,
  buildListingSlug,
  isReservedSlug,
  tradeLabel
} from "@/lib/tradeOff";
import { PhoneCountryInput } from "@/components/trade-off/PhoneCountryInput";
import { XRATED_BRAND } from "@/lib/xratedTrades";

// --- Wizard state ------------------------------------------------------

type WizardState = {
  step: 1 | 2 | 3 | 4;
  primary_trade: string;
  display_name: string;
  city: string;
  whatsapp: string;
  email: string;
  password: string;
  bio: string;
  hero_url: string;
  /** When the create call succeeds we stash the slug here so the
   *  on-mount restore knows to discard the cached state. */
  saved_slug: string | null;
};

const STORAGE_KEY = "xrated-signup-wizard";

const EMPTY_STATE: WizardState = {
  step: 1,
  primary_trade: "",
  display_name: "",
  city: "",
  whatsapp: "",
  email: "",
  password: "",
  bio: "",
  hero_url: "",
  saved_slug: null
};

const STEP_NAMES = ["Pick your trade", "About you", "Hero photo", "Go live"];

// --- Trade categorisation ----------------------------------------------
//
// The signup wizard groups the 100+ trade slugs into 5 buyer-friendly
// buckets. Anything not listed in MERCHANT / INSTALLER / MANUFACTURE /
// HIRE explicitly falls into "Trades & services" so a new slug added to
// TRADE_OFF_TRADES still shows up somewhere without code edits here.

const INSTALLER_SLUGS = new Set<string>([
  "kitchen-fitter",
  "stair-fitter",
  "window-fitter",
  "door-fitter",
  "bathroom-fitter",
  "flooring-installer",
  "conservatory-installer",
  "solar-installer",
  "ev-charger-installer",
  "heat-pump-installer",
  "smart-home-installer",
  "garage-door-installer",
  "gutter-installer",
  "driveway-installer",
  "fencing-installer",
  "shutter-installer",
  "aerial-satellite-installer",
  "garden-room-installer",
  "awning-installer",
  "security-installer",
  "insulation-installer"
]);

const MANUFACTURE_SLUGS = new Set<string>([
  "kitchen-manufacturer",
  "staircase-manufacturer",
  "door-manufacturer",
  "window-manufacturer",
  "flooring-manufacturer",
  "conservatory-manufacturer",
  "wardrobe-maker",
  "furniture-maker",
  "joinery-workshop",
  "worktop-manufacturer",
  "glass-manufacturer",
  "shed-manufacturer",
  "garden-room-manufacturer",
  "steel-fabricator"
]);

const HIRE_SLUGS = new Set<string>([
  "plant-hire",
  "skip-hire",
  "portaloo-hire",
  "scaffolding-hire",
  "generator-hire",
  "van-hire",
  "crane-hire",
  "waste-removal",
  "minidigger-hire",
  "storage-container-hire",
  "tool-hire"
]);

type Category = {
  key: string;
  label: string;
  desc: string;
  trades: typeof TRADE_OFF_TRADES;
};

function buildCategories(): Category[] {
  const merchant = TRADE_OFF_TRADES.filter((t) =>
    MERCHANT_GRADE_TRADES.has(t.slug) ||
    // Sales-side slugs that aren't in MERCHANT_GRADE_TRADES but read as
    // suppliers to a buyer.
    t.slug.endsWith("-merchant") ||
    t.slug.endsWith("-showroom") ||
    t.slug.endsWith("-supplies") ||
    t.slug.endsWith("-wholesaler") ||
    t.slug === "ironmongery" ||
    t.slug === "ppe-supplier" ||
    t.slug === "tool-shop" ||
    t.slug === "tile-shop" ||
    t.slug === "flooring-shop" ||
    t.slug === "aggregate-supplier" ||
    t.slug === "landscape-supplies"
  );
  const installers = TRADE_OFF_TRADES.filter((t) =>
    INSTALLER_SLUGS.has(t.slug)
  );
  const manufacture = TRADE_OFF_TRADES.filter((t) =>
    MANUFACTURE_SLUGS.has(t.slug)
  );
  const hire = TRADE_OFF_TRADES.filter((t) => HIRE_SLUGS.has(t.slug));

  // Trades & services = everything else.
  const claimed = new Set<string>([
    ...merchant.map((t) => t.slug),
    ...installers.map((t) => t.slug),
    ...manufacture.map((t) => t.slug),
    ...hire.map((t) => t.slug)
  ]);
  const services = TRADE_OFF_TRADES.filter((t) => !claimed.has(t.slug));

  return [
    {
      key: "services",
      label: "Trades & services",
      desc: "On-the-tools work — electricians, plumbers, plasterers, roofers.",
      trades: services
    },
    {
      key: "installers",
      label: "Installation specialists",
      desc: "Kitchens, EV chargers, solar, heat pumps, smart-home kit.",
      trades: installers
    },
    {
      key: "manufacture",
      label: "Manufacture & workshops",
      desc: "Joinery, steel fab, bespoke furniture, kitchen makers.",
      trades: manufacture
    },
    {
      key: "merchant",
      label: "Building merchants & suppliers",
      desc: "Builders' merchants, showrooms, wholesalers, hardware stores.",
      trades: merchant
    },
    {
      key: "hire",
      label: "Hire & rental",
      desc: "Plant, skip, scaffolding, tool, van — anything by the day.",
      trades: hire
    }
  ];
}

// --- Component ---------------------------------------------------------

export function SignupWizard() {
  const router = useRouter();
  const [state, setState] = useState<WizardState>(EMPTY_STATE);
  const [hydrated, setHydrated] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitErr, setSubmitErr] = useState<string | null>(null);
  const [openCategory, setOpenCategory] = useState<string>("services");
  const savedFlashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const categories = useMemo(() => buildCategories(), []);

  // Restore from localStorage on mount. Skip restore if the cached state
  // already carries a saved_slug — that means the wizard was completed
  // and we don't want to drop the user back into a stale flow.
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<WizardState> | null;
        if (parsed && typeof parsed === "object") {
          if (parsed.saved_slug) {
            window.localStorage.removeItem(STORAGE_KEY);
          } else {
            setState((s) => ({ ...s, ...parsed }));
          }
        }
      }
    } catch {
      /* corrupt localStorage — start fresh */
    } finally {
      setHydrated(true);
    }
  }, []);

  // Persist on every change (but only after hydration so we don't blow
  // away the restored value with the EMPTY_STATE we mounted with).
  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      setSavedFlash(true);
      if (savedFlashTimer.current) clearTimeout(savedFlashTimer.current);
      savedFlashTimer.current = setTimeout(() => setSavedFlash(false), 800);
    } catch {
      /* quota / private-mode — silently skip */
    }
  }, [state, hydrated]);

  function update<K extends keyof WizardState>(key: K, value: WizardState[K]) {
    setState((s) => ({ ...s, [key]: value }));
  }

  function goToStep(next: WizardState["step"]) {
    setState((s) => ({ ...s, step: next }));
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  // --- Derived validation ---------------------------------------------

  const emailValid = useMemo(
    () => /.+@.+\..+/.test(state.email.trim()),
    [state.email]
  );
  const whatsappDigits = useMemo(
    () => state.whatsapp.replace(/\D/g, "").length,
    [state.whatsapp]
  );
  const passwordValid = state.password.length >= 6;
  const bioValid = state.bio.trim().length >= 60;
  const step2Valid =
    state.display_name.trim().length > 0 &&
    state.city.trim().length > 0 &&
    whatsappDigits >= 7 &&
    emailValid &&
    passwordValid &&
    bioValid;

  // Live URL preview — use the same buildListingSlug logic as the API
  // so what the user sees here matches what they get on the done page.
  // If the auto-slug is reserved, append a 4-char random tail.
  const previewSlug = useMemo(() => {
    if (!state.display_name.trim() || !state.city.trim()) return "";
    const base = buildListingSlug(state.display_name, state.city);
    if (!base) return "";
    if (isReservedSlug(base)) {
      const tail = Math.random().toString(36).slice(2, 6);
      return `${base}-${tail}`;
    }
    return base;
  }, [state.display_name, state.city]);

  // --- Submit ---------------------------------------------------------

  async function goLive() {
    setSubmitErr(null);
    setSubmitting(true);
    try {
      const payload = {
        display_name: state.display_name.trim(),
        primary_trade: state.primary_trade,
        city: state.city.trim(),
        whatsapp: state.whatsapp.trim(),
        email: state.email.trim(),
        password: state.password,
        bio: state.bio.trim(),
        photos: state.hero_url ? [state.hero_url] : [],
        country: "United Kingdom"
      };
      const res = await fetch("/api/trade-off/create", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload)
      });
      const body = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        slug?: string;
        edit_token?: string;
        status?: string;
        voucher_code?: string | null;
        error?: string;
      };
      if (!body.ok || !body.slug || !body.edit_token) {
        setSubmitErr(body.error || "Could not save. Please try again.");
        return;
      }
      // Mark the wizard as completed so a reload doesn't drop the user
      // back into the form. Clear immediately too.
      try {
        window.localStorage.removeItem(STORAGE_KEY);
      } catch {
        /* ignore */
      }
      const voucherSuffix = body.voucher_code
        ? `&voucher=${encodeURIComponent(body.voucher_code)}`
        : "";
      router.push(
        `/trade-off/signup/done?slug=${encodeURIComponent(body.slug)}&token=${encodeURIComponent(body.edit_token)}&status=${encodeURIComponent(body.status ?? "draft")}${voucherSuffix}`
      );
    } catch (e) {
      setSubmitErr(e instanceof Error ? e.message : "Network error.");
    } finally {
      setSubmitting(false);
    }
  }

  // --- Render ---------------------------------------------------------

  const progressPct = (state.step / 4) * 100;
  const selectedTradeLabel = state.primary_trade
    ? tradeLabel(state.primary_trade)
    : "";

  return (
    <div className="relative">
      {/* Saved indicator — bottom-right while the localStorage flush is fresh. */}
      <div
        aria-hidden={!savedFlash}
        className={`pointer-events-none fixed bottom-4 right-4 z-40 rounded-full bg-black/80 px-3 py-1.5 text-[12px] font-semibold text-white shadow-lg transition-opacity ${savedFlash ? "opacity-100" : "opacity-0"}`}
      >
        Saved
      </div>

      {/* Progress bar */}
      <div className="mb-1.5 h-1 w-full overflow-hidden rounded-full bg-neutral-200">
        <div
          className="h-full rounded-full bg-[#FFB300] transition-[width] duration-300"
          style={{ width: `${progressPct}%` }}
        />
      </div>
      <p className="mb-5 text-[12px] font-semibold text-brand-muted">
        Step {state.step} of 4 · {STEP_NAMES[state.step - 1]}
      </p>

      {/* Back button — hidden on Step 1, no data loss between steps */}
      {state.step > 1 && (
        <button
          type="button"
          onClick={() => goToStep((state.step - 1) as WizardState["step"])}
          className="mb-4 inline-flex h-9 items-center gap-1 rounded-lg border border-brand-line bg-brand-surface px-3 text-[13px] font-semibold text-brand-text transition hover:border-[#FFB300]"
        >
          <span aria-hidden="true">←</span>
          Back
        </button>
      )}

      <div key={`step-${state.step}`} className="animate-wizard-step">
        {/* --- Step 1: Pick your trade ----------------------------------- */}
        {state.step === 1 && (
          <section>
            <h1 className="text-2xl font-extrabold leading-tight text-brand-text sm:text-3xl">
              What&apos;s your trade?
            </h1>
            <p className="mt-2 text-[13px] text-brand-muted sm:text-sm">
              Pick the one that best describes what you do. You can add a
              second trade later from your dashboard.
            </p>

            <div className="mt-6 space-y-3">
              {categories.map((cat) => {
                const open = openCategory === cat.key;
                return (
                  <div
                    key={cat.key}
                    className="overflow-hidden rounded-xl border border-brand-line bg-brand-surface/40"
                  >
                    <button
                      type="button"
                      onClick={() =>
                        setOpenCategory((cur) => (cur === cat.key ? "" : cat.key))
                      }
                      aria-expanded={open}
                      className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left transition hover:bg-brand-surface"
                    >
                      <div className="min-w-0">
                        <p className="text-[14px] font-bold text-brand-text">
                          {cat.label}
                          <span className="ml-2 text-[12px] font-semibold text-brand-muted">
                            ({cat.trades.length})
                          </span>
                        </p>
                        <p className="mt-0.5 text-[12px] text-brand-muted">
                          {cat.desc}
                        </p>
                      </div>
                      <span
                        aria-hidden="true"
                        className={`shrink-0 text-brand-muted transition-transform ${open ? "rotate-180" : ""}`}
                      >
                        ▾
                      </span>
                    </button>
                    {open && (
                      <div className="grid grid-cols-2 gap-2 border-t border-brand-line px-3 py-3 sm:grid-cols-3">
                        {cat.trades.map((t) => {
                          const selected = state.primary_trade === t.slug;
                          return (
                            <button
                              key={t.slug}
                              type="button"
                              onClick={() => update("primary_trade", t.slug)}
                              aria-pressed={selected}
                              className={`min-h-[44px] rounded-lg border px-3 py-2 text-left text-[13px] font-semibold transition ${
                                selected
                                  ? "border-[#FFB300] bg-[#FFB300]/15 text-brand-text"
                                  : "border-brand-line bg-white text-brand-text hover:border-[#FFB300]"
                              }`}
                            >
                              {t.label}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="sticky bottom-0 left-0 right-0 mt-6 -mx-4 border-t border-brand-line bg-brand-bg px-4 py-4">
              <button
                type="button"
                disabled={!state.primary_trade}
                onClick={() => goToStep(2)}
                className="flex h-12 w-full items-center justify-center rounded-xl bg-[#FFB300] text-[14px] font-bold text-black transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {state.primary_trade
                  ? `Next — ${selectedTradeLabel} →`
                  : "Pick a trade to continue"}
              </button>
            </div>
          </section>
        )}

        {/* --- Step 2: Tell us about you --------------------------------- */}
        {state.step === 2 && (
          <section>
            <h1 className="text-2xl font-extrabold leading-tight text-brand-text sm:text-3xl">
              Tell us about you
            </h1>
            <p className="mt-2 text-[13px] text-brand-muted sm:text-sm">
              The basics — name, where you work, how customers reach you.
              Everything else (photos, portfolio, hours) can be added from
              your dashboard later.
            </p>

            <div className="mt-6 space-y-4">
              <Field
                label="Your name or business name"
                hint="Max 80 characters."
              >
                <input
                  type="text"
                  value={state.display_name}
                  onChange={(e) =>
                    update("display_name", e.target.value.slice(0, 80))
                  }
                  placeholder="e.g. Dave's Electrical or Dave Smith"
                  maxLength={80}
                  autoComplete="organization"
                  className="h-12 w-full rounded-xl border border-brand-line bg-brand-bg px-3 text-[14px] text-brand-text placeholder:text-brand-muted focus:border-[#FFB300] focus:outline-none"
                />
              </Field>

              <Field label="City / town you work in" hint="Max 60 characters.">
                <input
                  type="text"
                  value={state.city}
                  onChange={(e) => update("city", e.target.value.slice(0, 60))}
                  placeholder="e.g. Manchester"
                  maxLength={60}
                  autoComplete="address-level2"
                  className="h-12 w-full rounded-xl border border-brand-line bg-brand-bg px-3 text-[14px] text-brand-text placeholder:text-brand-muted focus:border-[#FFB300] focus:outline-none"
                />
              </Field>

              <Field
                label="WhatsApp number"
                hint="How customers contact you. Include country code."
              >
                <PhoneCountryInput
                  value={state.whatsapp}
                  onChange={(v) => update("whatsapp", v)}
                  placeholder="7700 900000"
                />
                {state.whatsapp && whatsappDigits < 7 && (
                  <p className="mt-1 text-[12px] font-semibold text-red-600">
                    That doesn&apos;t look like enough digits.
                  </p>
                )}
              </Field>

              <Field label="Email" hint="Where we send your edit link.">
                <input
                  type="email"
                  value={state.email}
                  onChange={(e) =>
                    update("email", e.target.value.slice(0, 160))
                  }
                  placeholder="you@example.com"
                  maxLength={160}
                  autoComplete="email"
                  className="h-12 w-full rounded-xl border border-brand-line bg-brand-bg px-3 text-[14px] text-brand-text placeholder:text-brand-muted focus:border-[#FFB300] focus:outline-none"
                />
                {state.email && !emailValid && (
                  <p className="mt-1 text-[12px] font-semibold text-red-600">
                    That doesn&apos;t look like a valid email.
                  </p>
                )}
              </Field>

              <Field
                label="Password"
                hint="At least 6 characters. You&apos;ll use this to log back in."
              >
                <input
                  type="password"
                  value={state.password}
                  onChange={(e) =>
                    update("password", e.target.value.slice(0, 120))
                  }
                  placeholder="Pick something memorable"
                  maxLength={120}
                  autoComplete="new-password"
                  className="h-12 w-full rounded-xl border border-brand-line bg-brand-bg px-3 text-[14px] text-brand-text placeholder:text-brand-muted focus:border-[#FFB300] focus:outline-none"
                />
                {state.password && !passwordValid && (
                  <p className="mt-1 text-[12px] font-semibold text-red-600">
                    At least 6 characters.
                  </p>
                )}
              </Field>

              <Field
                label="A short bio"
                hint="A line or two about what you do. 60+ characters."
              >
                <textarea
                  value={state.bio}
                  onChange={(e) => update("bio", e.target.value.slice(0, 1200))}
                  placeholder="e.g. 12 years rewiring kitchens and bathrooms across Greater Manchester. Tidy, on-time, fixed-price."
                  maxLength={1200}
                  rows={4}
                  className="w-full rounded-xl border border-brand-line bg-brand-bg px-3 py-2.5 text-[14px] text-brand-text placeholder:text-brand-muted focus:border-[#FFB300] focus:outline-none"
                />
                <p
                  className={`mt-1 text-[12px] font-semibold ${
                    bioValid ? "text-brand-muted" : "text-red-600"
                  }`}
                >
                  {state.bio.trim().length}/60 characters
                </p>
              </Field>

              {/* Live URL preview */}
              {previewSlug && (
                <div className="rounded-xl border border-[#FFB300]/40 bg-[#FFB300]/5 px-3 py-2.5">
                  <p className="text-[12px] font-bold uppercase tracking-widest text-[#FFB300]">
                    Your profile URL
                  </p>
                  <p className="mt-1 break-all font-mono text-[14px] font-bold text-brand-text">
                    {XRATED_BRAND.domain}/{previewSlug}
                  </p>
                </div>
              )}
            </div>

            <div className="sticky bottom-0 left-0 right-0 mt-6 -mx-4 border-t border-brand-line bg-brand-bg px-4 py-4">
              <button
                type="button"
                disabled={!step2Valid}
                onClick={() => goToStep(3)}
                className="flex h-12 w-full items-center justify-center rounded-xl bg-[#FFB300] text-[14px] font-bold text-black transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Next →
              </button>
            </div>
          </section>
        )}

        {/* --- Step 3: Hero photo (optional) ----------------------------- */}
        {state.step === 3 && (
          <HeroPhotoStep
            value={state.hero_url}
            onChange={(url) => update("hero_url", url)}
            onSkip={() => goToStep(4)}
            onNext={() => goToStep(4)}
          />
        )}

        {/* --- Step 4: Live preview → Go Live --------------------------- */}
        {state.step === 4 && (
          <section>
            <h1 className="text-2xl font-extrabold leading-tight text-brand-text sm:text-3xl">
              Looks good?
            </h1>
            <p className="mt-2 text-[13px] text-brand-muted sm:text-sm">
              Almost there — quick sanity check, then we&apos;ll publish your
              profile.
            </p>

            <div className="mt-6 overflow-hidden rounded-2xl border border-brand-line bg-brand-surface/40">
              {state.hero_url && (
                <div className="relative aspect-[16/9] w-full overflow-hidden bg-black">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={state.hero_url}
                    alt=""
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                </div>
              )}
              <div className="space-y-2 p-5">
                {state.primary_trade && (
                  <span className="inline-block rounded-full bg-[#FFB300] px-3 py-1 text-[12px] font-bold text-black">
                    {selectedTradeLabel}
                  </span>
                )}
                <h2 className="text-xl font-extrabold text-brand-text">
                  {state.display_name || "Your name"}
                </h2>
                <p className="text-[13px] text-brand-muted">
                  {state.city || "Your city"}
                </p>
                {state.bio && (
                  <p className="pt-1 text-[13px] text-brand-text">
                    {state.bio}
                  </p>
                )}
                {previewSlug && (
                  <p className="pt-2 font-mono text-[12px] font-semibold text-brand-muted">
                    Your URL: {XRATED_BRAND.domain}/{previewSlug}
                  </p>
                )}
              </div>
            </div>

            {submitErr && (
              <div className="mt-4 rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-[13px] font-semibold text-red-700">
                {submitErr}
              </div>
            )}

            <div className="mt-6 grid gap-3 sm:grid-cols-[auto_1fr]">
              <button
                type="button"
                onClick={() => goToStep(2)}
                disabled={submitting}
                className="inline-flex h-12 items-center justify-center rounded-xl border border-brand-line bg-brand-surface px-5 text-[13px] font-bold text-brand-text transition hover:border-[#FFB300] disabled:opacity-40"
              >
                ← Edit details
              </button>
              <button
                type="button"
                onClick={goLive}
                disabled={submitting}
                className="inline-flex h-12 items-center justify-center rounded-xl bg-[#FFB300] px-5 text-[14px] font-bold text-black transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {submitting ? "Publishing…" : "Save & Go Live →"}
              </button>
            </div>
            <p className="mt-4 text-center text-[12px] text-brand-muted">
              Almost there — free for life, no commission, no review system.
            </p>
          </section>
        )}
      </div>

      {/* Inline CSS for the per-step slide-in animation. Lives here so
          we don't have to touch tailwind.config or globals.css for one
          tiny animation. */}
      <style jsx>{`
        .animate-wizard-step {
          animation: wizardStepIn 200ms ease-out;
        }
        @keyframes wizardStepIn {
          from {
            opacity: 0;
            transform: translateY(8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}

// --- Sub-components ----------------------------------------------------

function Field({
  label,
  hint,
  children
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[13px] font-bold text-brand-text">
        {label}
      </span>
      {children}
      {hint && (
        <span className="mt-1 block text-[12px] text-brand-muted">{hint}</span>
      )}
    </label>
  );
}

function HeroPhotoStep({
  value,
  onChange,
  onSkip,
  onNext
}: {
  value: string;
  onChange: (url: string) => void;
  onSkip: () => void;
  onNext: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setErr(null);
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", files[0]);
      const res = await fetch("/api/trade-off/upload-photo", {
        method: "POST",
        body: fd
      });
      const body = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        url?: string;
        error?: string;
      };
      if (!body.ok || !body.url) {
        setErr(body.error || "Upload failed");
        return;
      }
      onChange(body.url);
    } catch {
      setErr("Upload error");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <section>
      <h1 className="text-2xl font-extrabold leading-tight text-brand-text sm:text-3xl">
        Upload a hero photo
        <span className="ml-2 text-[14px] font-semibold text-brand-muted">
          (optional)
        </span>
      </h1>
      <p className="mt-2 text-[13px] text-brand-muted sm:text-sm">
        A photo of you, your van, your work, or your shopfront. You can
        change this any time from your dashboard.
      </p>

      <div className="mt-6">
        {value ? (
          <div className="space-y-3">
            <div className="relative aspect-[16/9] w-full overflow-hidden rounded-2xl border border-brand-line bg-black">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={value}
                alt=""
                className="absolute inset-0 h-full w-full object-cover"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <label className="inline-flex h-11 cursor-pointer items-center justify-center rounded-xl border border-brand-line bg-white px-4 text-[13px] font-bold text-brand-text transition hover:border-[#FFB300]">
                <input
                  ref={inputRef}
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={(e) => handleFiles(e.target.files)}
                  disabled={busy}
                />
                {busy ? "Uploading…" : "Replace"}
              </label>
              <button
                type="button"
                onClick={() => onChange("")}
                className="inline-flex h-11 items-center justify-center rounded-xl border border-brand-line bg-white px-4 text-[13px] font-bold text-red-600 transition hover:border-red-300"
              >
                Remove
              </button>
            </div>
          </div>
        ) : (
          <label className="flex aspect-[16/9] w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-brand-line bg-brand-surface/40 px-4 text-center transition hover:border-[#FFB300]">
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={(e) => handleFiles(e.target.files)}
              disabled={busy}
            />
            <span aria-hidden="true" className="text-3xl">
              📷
            </span>
            <span className="text-[14px] font-bold text-brand-text">
              {busy ? "Uploading…" : "Tap to take a photo or choose file"}
            </span>
            <span className="text-[12px] text-brand-muted">
              5 MB max · JPG, PNG, HEIC, WEBP
            </span>
          </label>
        )}
        {err && (
          <p className="mt-2 text-[13px] font-semibold text-red-600">{err}</p>
        )}
      </div>

      <div className="sticky bottom-0 left-0 right-0 mt-6 -mx-4 border-t border-brand-line bg-brand-bg px-4 py-4">
        <button
          type="button"
          onClick={onNext}
          className="flex h-12 w-full items-center justify-center rounded-xl bg-[#FFB300] text-[14px] font-bold text-black transition hover:opacity-90"
        >
          {value ? "Next →" : "Continue without a photo →"}
        </button>
        {!value && (
          <button
            type="button"
            onClick={onSkip}
            className="mx-auto mt-3 block text-[13px] font-semibold text-brand-muted underline-offset-2 hover:underline"
          >
            Skip for now
          </button>
        )}
      </div>
    </section>
  );
}
