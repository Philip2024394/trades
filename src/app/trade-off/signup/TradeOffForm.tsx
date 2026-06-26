"use client";

// Shared single-screen Trade Off form used by both /trade-off/signup and
// /trade-off/edit/[slug]. Vertical sections, real-time completeness banner,
// per-photo upload as you go. Submits to /api/trade-off/create (signup) or
// /api/trade-off/update (edit) depending on `mode`.
//
// Why single-screen instead of stepper: easier to debug, no state to lose
// between steps, and tradies on phones can scroll past sections they don't
// care about. The completeness banner at the top tells them what's still
// missing.

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  TRADE_OFF_REQUIRED_FIELDS,
  TRADE_OFF_TRADES,
  tradeLabel
} from "@/lib/tradeOff";
import { TRADE_SOCIAL_FIELDS } from "@/lib/tradeOffSocial";
import { SlugAvailabilityField } from "@/components/trade-off/SlugAvailabilityField";

type Mode =
  | { kind: "create" }
  | { kind: "edit"; slug: string; editToken: string };

export type TradeOffFormInitial = {
  display_name: string;
  trading_name: string;
  slug?: string;
  primary_trade: string;
  secondary_trades: string[];
  city: string;
  country: string;
  postcode_prefix: string;
  service_postcodes: string;
  whatsapp: string;
  phone: string;
  email: string;
  website: string;
  instagram: string;
  facebook: string;
  tiktok: string;
  youtube: string;
  twitter: string;
  snapchat: string;
  reddit: string;
  google: string;
  bio: string;
  years_in_trade: string;
  start_year: string;
  avatar_url: string;
  photos: string[];
};

const EMPTY_INITIAL: TradeOffFormInitial = {
  display_name: "",
  trading_name: "",
  slug: "",
  primary_trade: "",
  secondary_trades: [],
  city: "",
  country: "United Kingdom",
  postcode_prefix: "",
  service_postcodes: "",
  whatsapp: "",
  phone: "",
  email: "",
  website: "",
  instagram: "",
  facebook: "",
  tiktok: "",
  youtube: "",
  twitter: "",
  snapchat: "",
  reddit: "",
  google: "",
  bio: "",
  years_in_trade: "",
  start_year: "",
  avatar_url: "",
  photos: []
};

const FIELD_LABELS: Record<string, string> = {
  display_name: "Your name",
  primary_trade: "Primary trade",
  city: "City / town",
  whatsapp: "WhatsApp number",
  email: "Email",
  bio: "About you",
  photos: "At least one photo of your work"
};

export function TradeOffForm({
  mode,
  initial
}: {
  mode: Mode;
  initial?: Partial<TradeOffFormInitial>;
}) {
  const router = useRouter();
  const [state, setState] = useState<TradeOffFormInitial>({
    ...EMPTY_INITIAL,
    ...initial
  });
  const [uploading, setUploading] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const isEmailValid = useMemo(
    () => /.+@.+\..+/.test(state.email.trim()),
    [state.email]
  );
  const waDigitCount = useMemo(
    () => state.whatsapp.replace(/\D/g, "").length,
    [state.whatsapp]
  );
  const bioLen = state.bio.trim().length;

  const missing = useMemo(() => {
    const list: string[] = [];
    for (const f of TRADE_OFF_REQUIRED_FIELDS) {
      const v = (state as Record<string, unknown>)[f];
      if (typeof v !== "string" || v.trim().length === 0) list.push(f);
    }
    if (state.photos.length < 1) list.push("photos");
    if (state.email && !isEmailValid && !list.includes("email")) list.push("email");
    if (state.whatsapp && waDigitCount < 7 && !list.includes("whatsapp")) list.push("whatsapp");
    if (state.bio && bioLen < 60 && !list.includes("bio")) list.push("bio");
    return list;
  }, [state, isEmailValid, waDigitCount, bioLen]);

  const wouldBeLive = missing.length === 0;

  function update<K extends keyof TradeOffFormInitial>(key: K, value: TradeOffFormInitial[K]) {
    setState((s) => ({ ...s, [key]: value }));
  }

  function toggleSecondary(slug: string) {
    setState((s) => {
      const has = s.secondary_trades.includes(slug);
      if (has) return { ...s, secondary_trades: s.secondary_trades.filter((x) => x !== slug) };
      if (s.secondary_trades.length >= 3) return s;
      return { ...s, secondary_trades: [...s.secondary_trades, slug] };
    });
  }

  async function handleAvatarFile(files: FileList | null) {
    if (!files || files.length === 0) return;
    setErr(null);
    setUploadingAvatar(true);
    try {
      const file = files[0];
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/trade-off/upload-photo", { method: "POST", body: fd });
      const body = (await res.json().catch(() => ({}))) as { ok?: boolean; url?: string; error?: string };
      if (!body.ok || !body.url) {
        setErr(body.error || "Could not upload your profile photo.");
        return;
      }
      setState((s) => ({ ...s, avatar_url: body.url as string }));
    } finally {
      setUploadingAvatar(false);
      if (avatarInputRef.current) avatarInputRef.current.value = "";
    }
  }

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setErr(null);
    setUploading(true);
    try {
      const remaining = 6 - state.photos.length;
      const toUpload = Array.from(files).slice(0, remaining);
      for (const file of toUpload) {
        const fd = new FormData();
        fd.append("file", file);
        const res = await fetch("/api/trade-off/upload-photo", { method: "POST", body: fd });
        const body = (await res.json().catch(() => ({}))) as { ok?: boolean; url?: string; error?: string };
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

  function movePhoto(idx: number, dir: -1 | 1) {
    setState((s) => {
      const arr = [...s.photos];
      const j = idx + dir;
      if (j < 0 || j >= arr.length) return s;
      [arr[idx], arr[j]] = [arr[j], arr[idx]];
      return { ...s, photos: arr };
    });
  }

  function removePhoto(idx: number) {
    setState((s) => ({ ...s, photos: s.photos.filter((_, i) => i !== idx) }));
  }

  function buildPayload() {
    return {
      display_name: state.display_name.trim(),
      trading_name: state.trading_name.trim(),
      slug: (state.slug ?? "").trim(),
      primary_trade: state.primary_trade.trim(),
      secondary_trades: state.secondary_trades,
      city: state.city.trim(),
      country: state.country.trim(),
      postcode_prefix: state.postcode_prefix.trim(),
      service_postcodes: state.service_postcodes
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      whatsapp: state.whatsapp.trim(),
      phone: state.phone.trim(),
      email: state.email.trim(),
      website: state.website.trim(),
      instagram: state.instagram.trim(),
      facebook: state.facebook.trim(),
      tiktok: state.tiktok.trim(),
      youtube: state.youtube.trim(),
      twitter: state.twitter.trim(),
      snapchat: state.snapchat.trim(),
      reddit: state.reddit.trim(),
      google: state.google.trim(),
      bio: state.bio.trim(),
      years_in_trade: state.years_in_trade.trim() || null,
      start_year: state.start_year.trim() || null,
      avatar_url: state.avatar_url.trim(),
      photos: state.photos
    };
  }

  async function submit(forceDraft: boolean) {
    setErr(null);
    setSubmitting(true);
    try {
      const payload = buildPayload();
      if (mode.kind === "create") {
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
          setErr(body.error || "Could not save. Please try again.");
          return;
        }
        const voucherSuffix = body.voucher_code
          ? `&voucher=${encodeURIComponent(body.voucher_code)}`
          : "";
        router.push(
          `/trade-off/signup/done?slug=${encodeURIComponent(body.slug)}&token=${encodeURIComponent(body.edit_token)}&status=${encodeURIComponent(body.status ?? "draft")}${voucherSuffix}`
        );
      } else {
        const res = await fetch("/api/trade-off/update", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            slug: mode.slug,
            edit_token: mode.editToken,
            fields: payload
          })
        });
        const body = (await res.json().catch(() => ({}))) as { ok?: boolean; status?: string; slug?: string; error?: string };
        if (!body.ok) {
          setErr(body.error || "Could not save changes.");
          return;
        }
        const finalSlug = body.slug || mode.slug;
        router.push(
          `/trade-off/signup/done?slug=${encodeURIComponent(finalSlug)}&token=${encodeURIComponent(mode.editToken)}&status=${encodeURIComponent(body.status ?? "draft")}&edit=1`
        );
      }
      // suppress unused-var lint on forceDraft — we use the same endpoint, status
      // is derived server-side. forceDraft is just a UX label.
      void forceDraft;
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Network error.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-8">
      {/* Live / Draft banner */}
      <div
        className={`rounded-lg border px-4 py-3 text-xs ${
          wouldBeLive
            ? "border-brand-success/40 bg-brand-success/10 text-brand-success"
            : "border-brand-line bg-brand-surface text-brand-muted"
        }`}
      >
        {wouldBeLive ? (
          <span className="font-semibold">Ready to go live — submit when you're happy.</span>
        ) : (
          <>
            <span className="font-semibold text-brand-text">
              Almost there — {missing.length} field{missing.length === 1 ? "" : "s"} left.
            </span>
            <ul className="mt-2 list-disc space-y-0.5 pl-5">
              {missing.map((m) => (
                <li key={m}>
                  <span className="text-brand-text">{FIELD_LABELS[m] ?? m}</span>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-brand-muted">
              You can save as a draft now and finish later using your edit link.
            </p>
          </>
        )}
      </div>

      {/* Identity */}
      <Section title="Identity">
        <Field label="Your name *">
          <Input
            value={state.display_name}
            onChange={(v) => update("display_name", v)}
            placeholder="e.g. Tom Wright"
            maxLength={120}
          />
        </Field>
        <Field label="Trading name (optional)">
          <Input
            value={state.trading_name}
            onChange={(v) => update("trading_name", v)}
            placeholder="e.g. Wright Plastering Ltd"
            maxLength={160}
          />
        </Field>
        <Field label="Your Trade Off URL (optional)">
          <SlugAvailabilityField
            value={state.slug ?? ""}
            onChange={(v) => update("slug", v)}
            selfSlug={mode.kind === "edit" ? mode.slug : undefined}
            placeholder="your-trade-name"
          />
          {mode.kind === "edit" && state.slug && state.slug !== mode.slug && (
            <p className="mt-1 text-xs text-[#FFB300]">
              Heads up — changing your URL will break any links or QR codes you've already shared.
            </p>
          )}
        </Field>
        <Field label="Profile photo / logo (optional)">
          <div className="flex items-center gap-4">
            <div className="h-24 w-24 shrink-0 overflow-hidden rounded-full border border-brand-line bg-brand-surface">
              {state.avatar_url ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={state.avatar_url} alt="Profile" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-2xl font-bold text-[#FFB300]">
                  {(state.display_name.trim().charAt(0) || "?").toUpperCase()}
                </div>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <label className="inline-flex h-11 cursor-pointer items-center justify-center rounded-lg border border-brand-line bg-brand-surface px-4 text-xs font-semibold text-brand-text transition hover:border-[#FFB300] hover:text-[#FFB300]">
                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={(e) => handleAvatarFile(e.target.files)}
                  disabled={uploadingAvatar}
                />
                {uploadingAvatar ? "Uploading…" : state.avatar_url ? "Replace photo" : "Upload photo"}
              </label>
              {state.avatar_url && (
                <button
                  type="button"
                  onClick={() => update("avatar_url", "")}
                  className="text-xs text-brand-muted underline-offset-2 hover:text-red-300 hover:underline"
                >
                  Remove
                </button>
              )}
              <p className="text-xs text-brand-muted">
                Round portrait shot or a clean logo works best.
              </p>
            </div>
          </div>
        </Field>
        <Field label="Primary trade *">
          <select
            value={state.primary_trade}
            onChange={(e) => update("primary_trade", e.target.value)}
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
        <Field label={`Secondary trades (up to 3) — ${state.secondary_trades.length}/3`}>
          <div className="flex flex-wrap gap-2">
            {TRADE_OFF_TRADES.filter((t) => t.slug !== state.primary_trade).map((t) => {
              const on = state.secondary_trades.includes(t.slug);
              return (
                <button
                  key={t.slug}
                  type="button"
                  onClick={() => toggleSecondary(t.slug)}
                  className={`h-11 rounded-full border px-4 text-xs font-semibold transition ${
                    on
                      ? "border-[#FFB300] bg-[#FFB300] text-white"
                      : "border-brand-line bg-brand-surface text-brand-text hover:border-[#FFB300]"
                  }`}
                >
                  {t.label}
                </button>
              );
            })}
          </div>
        </Field>
      </Section>

      {/* Location */}
      <Section title="Location">
        <Field label="City / town *">
          <Input
            value={state.city}
            onChange={(v) => update("city", v)}
            placeholder="e.g. Manchester"
            maxLength={80}
          />
        </Field>
        <Field label="Country">
          <Input
            value={state.country}
            onChange={(v) => update("country", v)}
            placeholder="United Kingdom"
            maxLength={80}
          />
        </Field>
        <Field label="Postcode prefix (optional, e.g. M14)">
          <Input
            value={state.postcode_prefix}
            onChange={(v) => update("postcode_prefix", v)}
            placeholder="M14"
            maxLength={16}
          />
        </Field>
        <Field label="Service postcodes (comma-separated, optional)">
          <Input
            value={state.service_postcodes}
            onChange={(v) => update("service_postcodes", v)}
            placeholder="M1, M2, M14, M19"
            maxLength={400}
          />
        </Field>
      </Section>

      {/* Contact */}
      <Section title="Contact">
        <Field label="WhatsApp number * (digits only or international format)">
          <Input
            value={state.whatsapp}
            onChange={(v) => update("whatsapp", v)}
            placeholder="+44 7700 900000"
            maxLength={40}
          />
          {state.whatsapp && waDigitCount < 7 && (
            <p className="mt-1 text-xs text-brand-muted">Looks short — needs at least 7 digits.</p>
          )}
        </Field>
        <Field label="Phone (optional)">
          <Input
            value={state.phone}
            onChange={(v) => update("phone", v)}
            placeholder=""
            maxLength={40}
          />
        </Field>
        <Field label="Email *">
          <Input
            value={state.email}
            onChange={(v) => update("email", v)}
            placeholder="you@example.co.uk"
            maxLength={160}
            type="email"
          />
          {state.email && !isEmailValid && (
            <p className="mt-1 text-xs text-brand-muted">That email doesn't look right.</p>
          )}
        </Field>
        {TRADE_SOCIAL_FIELDS.map((f) => (
          <Field key={f.key} label={`${f.label} (optional)`}>
            <Input
              value={state[f.key]}
              onChange={(v) => update(f.key, v)}
              placeholder={f.placeholder}
              maxLength={240}
            />
          </Field>
        ))}
      </Section>

      {/* About */}
      <Section title="About you">
        <Field label={`About your work * (${bioLen} chars — 60 minimum, ~300–500 recommended)`}>
          <textarea
            value={state.bio}
            onChange={(e) => update("bio", e.target.value)}
            placeholder="What you do, who you work for, what you take pride in. Plain words. No salesy fluff."
            maxLength={1200}
            rows={6}
            className="w-full rounded-lg border border-brand-line bg-brand-bg p-3 text-xs leading-relaxed text-brand-text focus:border-[#FFB300] focus:outline-none"
          />
        </Field>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Years in trade (optional)">
            <Input
              value={state.years_in_trade}
              onChange={(v) => update("years_in_trade", v)}
              placeholder="e.g. 12"
              maxLength={3}
              type="number"
            />
          </Field>
          <Field label="Year you started (optional)">
            <Input
              value={state.start_year}
              onChange={(v) => update("start_year", v)}
              placeholder="e.g. 2013"
              maxLength={4}
              type="number"
            />
          </Field>
        </div>
      </Section>

      {/* Photos */}
      <Section title={`Photos of your work * (${state.photos.length}/6)`}>
        <p className="text-xs text-brand-muted">
          The first photo is your cover. Drag-reorder coming soon — use the arrows for now.
        </p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {state.photos.map((url, i) => (
            <div
              key={url + i}
              className="relative overflow-hidden rounded-lg border border-brand-line bg-brand-surface"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt="" className="aspect-square w-full object-cover" />
              {i === 0 && (
                <span className="absolute left-2 top-2 rounded-full bg-[#FFB300] px-2 py-0.5 text-[11px] font-bold text-black">
                  Cover
                </span>
              )}
              <div className="flex items-center justify-between gap-1 border-t border-brand-line bg-neutral-50 p-1">
                <button
                  type="button"
                  onClick={() => movePhoto(i, -1)}
                  disabled={i === 0}
                  className="h-11 flex-1 rounded text-xs text-brand-text hover:bg-brand-bg disabled:opacity-30"
                  aria-label="Move left"
                >
                  ←
                </button>
                <button
                  type="button"
                  onClick={() => movePhoto(i, 1)}
                  disabled={i === state.photos.length - 1}
                  className="h-11 flex-1 rounded text-xs text-brand-text hover:bg-brand-bg disabled:opacity-30"
                  aria-label="Move right"
                >
                  →
                </button>
                <button
                  type="button"
                  onClick={() => removePhoto(i)}
                  className="h-11 flex-1 rounded text-xs text-brand-text hover:bg-red-900/40"
                  aria-label="Remove photo"
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
          {state.photos.length < 6 && (
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

      {err && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700">
          {err}
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          onClick={() => submit(false)}
          disabled={submitting || !wouldBeLive}
          className="h-11 flex-1 rounded-lg bg-[#FFB300] px-6 text-xs font-bold text-black transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {submitting
            ? "Saving…"
            : mode.kind === "edit"
              ? "Save changes (go live)"
              : "Publish my profile"}
        </button>
        <button
          type="button"
          onClick={() => submit(true)}
          disabled={submitting}
          className="h-11 flex-1 rounded-lg border border-brand-line bg-brand-surface px-6 text-xs font-semibold text-brand-text transition hover:border-[#FFB300] disabled:opacity-40"
        >
          {submitting ? "Saving…" : "Save as draft"}
        </button>
      </div>
      <p className="text-xs text-brand-muted">
        Trade Off is free for life. Customers contact you on WhatsApp — Hammerex never takes a cut.
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
