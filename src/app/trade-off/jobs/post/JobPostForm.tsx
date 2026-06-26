"use client";

// Xrated Trades — customer job post form.
// Single-screen flow mirroring the TradeOffForm styling: vertical sections,
// per-photo upload, inline validation, big submit at the bottom. POSTs to
// /api/trade-off/jobs/create (Agent B). Customer never needs an account —
// the WhatsApp number is the contact channel; admin moderation is gated
// on the server side.

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { TRADE_OFF_TRADES } from "@/lib/tradeOff";
import {
  XRATED_JOB_BUDGET_PRESETS,
  XRATED_JOBS_MAX_DESCRIPTION,
  XRATED_JOBS_MAX_PHOTOS,
  XRATED_JOBS_MIN_DESCRIPTION
} from "@/lib/xratedJobs";

type FormState = {
  trade_slug: string;
  city: string;
  postcode_prefix: string;
  description: string;
  budget_hint: string;
  photos: string[];
  customer_name: string;
  customer_whatsapp: string;
};

const EMPTY: FormState = {
  trade_slug: "",
  city: "",
  postcode_prefix: "",
  description: "",
  budget_hint: "",
  photos: [],
  customer_name: "",
  customer_whatsapp: ""
};

export function JobPostForm() {
  const router = useRouter();
  const [state, setState] = useState<FormState>(EMPTY);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const descLen = state.description.trim().length;
  const waDigits = useMemo(
    () => state.customer_whatsapp.replace(/\D/g, "").length,
    [state.customer_whatsapp]
  );

  const canSubmit = useMemo(
    () =>
      state.trade_slug.length > 0 &&
      state.city.trim().length >= 2 &&
      descLen >= XRATED_JOBS_MIN_DESCRIPTION &&
      descLen <= XRATED_JOBS_MAX_DESCRIPTION &&
      state.customer_name.trim().length >= 2 &&
      waDigits >= 8,
    [state.trade_slug, state.city, descLen, state.customer_name, waDigits]
  );

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setState((s) => ({ ...s, [key]: value }));
  }

  function toggleBudgetPreset(preset: string) {
    update("budget_hint", state.budget_hint === preset ? "" : preset);
  }

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setErr(null);
    setUploading(true);
    try {
      const remaining = XRATED_JOBS_MAX_PHOTOS - state.photos.length;
      const toUpload = Array.from(files).slice(0, remaining);
      for (const file of toUpload) {
        const fd = new FormData();
        fd.append("file", file);
        const res = await fetch("/api/trade-off/jobs/upload-photo", {
          method: "POST",
          body: fd
        });
        const body = (await res.json().catch(() => ({}))) as {
          ok?: boolean;
          url?: string;
          error?: string;
        };
        if (!body.ok || !body.url) {
          setErr(body.error || `Could not upload "${file.name}".`);
          break;
        }
        setState((s) => ({ ...s, photos: [...s.photos, body.url as string] }));
      }
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function removePhoto(idx: number) {
    setState((s) => ({ ...s, photos: s.photos.filter((_, i) => i !== idx) }));
  }

  async function submit() {
    if (!canSubmit) return;
    setErr(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/trade-off/jobs/create", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          trade_slug: state.trade_slug,
          city: state.city.trim(),
          postcode_prefix: state.postcode_prefix.trim() || null,
          description: state.description.trim(),
          budget_hint: state.budget_hint.trim() || null,
          photos: state.photos,
          customer_name: state.customer_name.trim(),
          customer_whatsapp: state.customer_whatsapp.trim()
        })
      });
      const body = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        slug?: string;
        error?: string;
      };
      if (!body.ok || !body.slug) {
        setErr(body.error || "Could not submit. Please try again.");
        return;
      }
      router.push(`/trade-off/jobs/post/done?slug=${encodeURIComponent(body.slug)}`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Network error.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-8">
      <Section title="About the job">
        <Field label="What trade do you need? *">
          <select
            value={state.trade_slug}
            onChange={(e) => update("trade_slug", e.target.value)}
            className="h-11 w-full rounded-lg border border-brand-line bg-brand-bg px-3 text-xs text-brand-text focus:border-[#FFB300] focus:outline-none"
          >
            <option value="">— Select a trade —</option>
            {TRADE_OFF_TRADES.map((t) => (
              <option key={t.slug} value={t.slug}>
                {t.label}
              </option>
            ))}
          </select>
        </Field>

        <Field label="City / town *">
          <Input
            value={state.city}
            onChange={(v) => update("city", v)}
            placeholder="e.g. Manchester"
            maxLength={80}
          />
        </Field>

        <Field label="Postcode prefix (optional)">
          <Input
            value={state.postcode_prefix}
            onChange={(v) => update("postcode_prefix", v)}
            placeholder="e.g. M14"
            maxLength={16}
          />
        </Field>

        <Field
          label={`Describe the job * (${descLen}/${XRATED_JOBS_MAX_DESCRIPTION} — ${XRATED_JOBS_MIN_DESCRIPTION} minimum)`}
        >
          <textarea
            value={state.description}
            onChange={(e) => update("description", e.target.value)}
            placeholder="What needs doing, where, any access notes, when you'd like it done. Plain words."
            maxLength={XRATED_JOBS_MAX_DESCRIPTION}
            rows={6}
            className="w-full rounded-lg border border-brand-line bg-brand-bg p-3 text-xs leading-relaxed text-brand-text focus:border-[#FFB300] focus:outline-none"
          />
          {state.description && descLen < XRATED_JOBS_MIN_DESCRIPTION && (
            <p className="mt-1 text-xs text-brand-muted">
              A bit more detail helps tradies quote accurately — {XRATED_JOBS_MIN_DESCRIPTION - descLen} more chars.
            </p>
          )}
        </Field>

        <Field label="Budget hint (optional — pick a band or write your own)">
          <div className="flex flex-wrap gap-2">
            {XRATED_JOB_BUDGET_PRESETS.map((p) => {
              const on = state.budget_hint === p;
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => toggleBudgetPreset(p)}
                  className={`h-11 rounded-full border px-4 text-xs font-semibold transition ${
                    on
                      ? "border-[#FFB300] bg-[#FFB300] text-white"
                      : "border-brand-line bg-brand-surface text-brand-text hover:border-[#FFB300]"
                  }`}
                >
                  {p}
                </button>
              );
            })}
          </div>
          <input
            type="text"
            value={state.budget_hint}
            onChange={(e) => update("budget_hint", e.target.value)}
            placeholder="Or type your own: e.g. £450 ish"
            maxLength={80}
            className="mt-3 h-11 w-full rounded-lg border border-brand-line bg-brand-bg px-3 text-xs text-brand-text placeholder:text-brand-muted focus:border-[#FFB300] focus:outline-none"
          />
        </Field>
      </Section>

      <Section title={`Photos (${state.photos.length}/${XRATED_JOBS_MAX_PHOTOS})`}>
        <p className="text-xs text-brand-muted">
          Optional but very helpful — a quick photo of the area / problem speeds up quotes.
        </p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {state.photos.map((url, i) => (
            <div
              key={url + i}
              className="relative overflow-hidden rounded-lg border border-brand-line bg-brand-surface"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt="" className="aspect-square w-full object-cover" />
              <button
                type="button"
                onClick={() => removePhoto(i)}
                className="absolute right-1 top-1 inline-flex h-9 min-w-9 items-center justify-center rounded-md bg-black/70 px-2 text-xs font-semibold text-white transition hover:bg-red-900/80"
                aria-label="Remove photo"
              >
                Remove
              </button>
            </div>
          ))}
          {state.photos.length < XRATED_JOBS_MAX_PHOTOS && (
            <label className="flex aspect-square cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-brand-line bg-brand-surface p-4 text-center text-xs text-brand-muted transition hover:border-[#FFB300] hover:text-[#FFB300]">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="sr-only"
                onChange={(e) => handleFiles(e.target.files)}
                disabled={uploading}
              />
              <span className="text-2xl">+</span>
              <span>{uploading ? "Uploading…" : "Add photo"}</span>
            </label>
          )}
        </div>
      </Section>

      <Section title="Your contact">
        <Field label="Your name *">
          <Input
            value={state.customer_name}
            onChange={(v) => update("customer_name", v)}
            placeholder="e.g. Sarah Wilson"
            maxLength={120}
          />
        </Field>
        <Field label="WhatsApp number * (digits or international format)">
          <Input
            value={state.customer_whatsapp}
            onChange={(v) => update("customer_whatsapp", v)}
            placeholder="+44 7700 900000"
            maxLength={40}
          />
          {state.customer_whatsapp && waDigits < 8 && (
            <p className="mt-1 text-xs text-brand-muted">Looks short — needs at least 8 digits.</p>
          )}
        </Field>
        <div className="rounded-lg border border-brand-line bg-brand-surface/60 p-3 text-xs leading-relaxed text-brand-muted">
          Your WhatsApp is only shown to verified tradespeople. We never sell your details.
        </div>
      </Section>

      {err && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700">
          {err}
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          onClick={submit}
          disabled={submitting || !canSubmit}
          className="h-12 flex-1 rounded-lg bg-[#FFB300] px-6 text-sm font-bold text-white shadow-lg transition hover:bg-[#E5A500] disabled:cursor-not-allowed disabled:opacity-40"
        >
          {submitting ? "Submitting…" : "Post my job"}
        </button>
      </div>
      <p className="text-xs text-brand-muted">
        We give your post a quick look before it goes live — usually within 24 hours.
        Posting is free, no commissions, no account required.
      </p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4 rounded-2xl border border-brand-line bg-brand-surface/40 p-5">
      <h2 className="text-xs font-bold uppercase tracking-widest text-[#FFB300]">{title}</h2>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-brand-text">{label}</span>
      {children}
    </label>
  );
}

function Input({
  value,
  onChange,
  placeholder,
  maxLength,
  type
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  maxLength?: number;
  type?: string;
}) {
  return (
    <input
      type={type ?? "text"}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      maxLength={maxLength}
      className="h-11 w-full rounded-lg border border-brand-line bg-brand-bg px-3 text-xs text-brand-text placeholder:text-brand-muted focus:border-[#FFB300] focus:outline-none"
    />
  );
}

export default JobPostForm;
