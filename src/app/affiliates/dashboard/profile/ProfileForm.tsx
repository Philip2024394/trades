"use client";

// Affiliate profile editor.
//
// Sections, in render order:
//   1. Profile photo  — circular preview + Upload button. Posts to
//      /api/affiliates/dashboard/avatar, returns a public URL; the
//      route also stamps avatar_url onto the affiliate row so a hard
//      refresh keeps the new picture.
//   2. Identity       — first / last / company
//   3. Contact        — WhatsApp (read-only, it's the login ID) +
//                       email
//   4. Address        — line 1 / line 2 / city / postal / state +
//                       country (worldwide dropdown with flag prefix)
//   5. Bio            — single textarea, 280-char cap
//   6. Social handles — six platforms
//
// The Save button greys out until at least one field changed since
// the last successful save.
import { useEffect, useMemo, useRef, useState } from "react";

type Initial = {
  first_name?: string | null;
  last_name?: string | null;
  company_name?: string | null;
  country?: string | null;
  email?: string | null;
  whatsapp?: string | null;
  avatar_url?: string | null;
  address_line_1?: string | null;
  address_line_2?: string | null;
  city?: string | null;
  postal_code?: string | null;
  state_region?: string | null;
  bio?: string | null;
  website?: string | null;
  facebook?: string | null;
  instagram?: string | null;
  tiktok?: string | null;
  youtube?: string | null;
  twitter?: string | null;
  linkedin?: string | null;
} | null;

type CountryOption = { name: string; flag: string };

const BIO_MAX = 280;

function initialState(initial: Initial) {
  return {
    first_name: initial?.first_name ?? "",
    last_name: initial?.last_name ?? "",
    company_name: initial?.company_name ?? "",
    country: initial?.country ?? "",
    email: initial?.email ?? "",
    avatar_url: initial?.avatar_url ?? "",
    address_line_1: initial?.address_line_1 ?? "",
    address_line_2: initial?.address_line_2 ?? "",
    city: initial?.city ?? "",
    postal_code: initial?.postal_code ?? "",
    state_region: initial?.state_region ?? "",
    bio: initial?.bio ?? "",
    website: initial?.website ?? "",
    facebook: initial?.facebook ?? "",
    instagram: initial?.instagram ?? "",
    tiktok: initial?.tiktok ?? "",
    youtube: initial?.youtube ?? "",
    twitter: initial?.twitter ?? "",
    linkedin: initial?.linkedin ?? ""
  };
}

export function ProfileForm({
  countries,
  initial
}: {
  countries: CountryOption[];
  initial: Initial;
}) {
  const [baseline, setBaseline] = useState(() => initialState(initial));
  const [state, setState] = useState(() => initialState(initial));
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const whatsapp = initial?.whatsapp ?? "";

  function update<K extends keyof typeof state>(
    key: K,
    value: string
  ): void {
    setState((s) => ({ ...s, [key]: value }));
    if (saved) setSaved(false);
  }

  const dirty = useMemo(() => {
    return (Object.keys(state) as Array<keyof typeof state>).some(
      (k) => state[k] !== baseline[k]
    );
  }, [state, baseline]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErr(null);
    setSaved(false);
    setSubmitting(true);
    try {
      const res = await fetch("/api/affiliates/profile", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(state)
      });
      const body = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
      };
      if (!body.ok) {
        setErr(body.error || "Could not save profile.");
        return;
      }
      setBaseline(state);
      setSaved(true);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Network error.");
    } finally {
      setSubmitting(false);
    }
  }

  async function onAvatarPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarError(null);
    setAvatarUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/affiliates/dashboard/avatar", {
        method: "POST",
        body: form
      });
      const body = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        url?: string;
        error?: string;
      };
      if (!body.ok || !body.url) {
        setAvatarError(body.error || "Upload failed.");
        return;
      }
      // The route also persists avatar_url server-side. We mirror it
      // into local state + baseline so the form doesn't show "Save"
      // for a change that's already on the server.
      setState((s) => ({ ...s, avatar_url: body.url! }));
      setBaseline((b) => ({ ...b, avatar_url: body.url! }));
    } catch (e) {
      setAvatarError(e instanceof Error ? e.message : "Network error.");
    } finally {
      setAvatarUploading(false);
      // Clear the input so the same file can be re-picked.
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  // Re-sync the baseline whenever the `initial` prop changes (route
  // navigation or server-revalidation). Without this, navigating away
  // and back would leave the baseline stale.
  useEffect(() => {
    const next = initialState(initial);
    setBaseline(next);
    setState(next);
  }, [initial]);

  const bioLeft = BIO_MAX - state.bio.length;
  const saveDisabled = submitting || !dirty;

  return (
    <form onSubmit={onSubmit} className="space-y-8">
      {/* 1. Profile photo */}
      <Section
        title="Profile photo"
        caption="Front-facing photo. Shown on your leaderboard entry and white-label landing pages."
      >
        <div className="flex flex-wrap items-center gap-5">
          <AvatarPreview src={state.avatar_url} />
          <div className="flex flex-col gap-2">
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={onAvatarPick}
              className="hidden"
              id="affiliate-avatar-input"
            />
            <label
              htmlFor="affiliate-avatar-input"
              className="inline-flex h-10 cursor-pointer items-center justify-center rounded-lg border border-brand-line bg-brand-bg px-4 text-[13px] font-bold text-brand-text hover:bg-brand-line"
            >
              {avatarUploading
                ? "Uploading…"
                : state.avatar_url
                  ? "Change photo"
                  : "Upload photo"}
            </label>
            <p className="text-[13px] text-brand-muted">
              PNG, JPEG or WEBP. Max 5 MB.
            </p>
            {avatarError && (
              <p className="text-[13px] font-semibold text-red-400">
                {avatarError}
              </p>
            )}
          </div>
        </div>
      </Section>

      {/* 2. Identity */}
      <Section title="Identity">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field
            label="First name"
            value={state.first_name}
            onChange={(v) => update("first_name", v)}
          />
          <Field
            label="Last name"
            value={state.last_name}
            onChange={(v) => update("last_name", v)}
          />
          <Field
            label="Company name"
            value={state.company_name}
            onChange={(v) => update("company_name", v)}
          />
        </div>
      </Section>

      {/* 3. Contact */}
      <Section
        title="Contact"
        caption="WhatsApp is locked — it's how you log in. Change it from the forgot-password flow."
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-[13px] font-bold text-brand-text">
              WhatsApp (login)
            </span>
            <input
              type="text"
              value={whatsapp}
              readOnly
              className="mt-1 block h-12 w-full cursor-not-allowed rounded-xl border border-brand-line bg-brand-bg/60 px-3 text-[13px] text-brand-muted focus:outline-none"
            />
          </label>
          <Field
            label="Email"
            type="email"
            value={state.email}
            onChange={(v) => update("email", v)}
          />
        </div>
      </Section>

      {/* 4. Address */}
      <Section title="Address">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field
            label="Address line 1"
            value={state.address_line_1}
            onChange={(v) => update("address_line_1", v)}
          />
          <Field
            label="Address line 2"
            value={state.address_line_2}
            onChange={(v) => update("address_line_2", v)}
          />
          <Field
            label="City"
            value={state.city}
            onChange={(v) => update("city", v)}
          />
          <Field
            label="Postal / ZIP code"
            value={state.postal_code}
            onChange={(v) => update("postal_code", v)}
          />
          <Field
            label="State / region"
            value={state.state_region}
            onChange={(v) => update("state_region", v)}
          />
          <label className="block">
            <span className="text-[13px] font-bold text-brand-text">
              Country
            </span>
            <select
              value={state.country}
              onChange={(e) => update("country", e.target.value)}
              className="mt-1 block h-12 w-full rounded-xl border border-brand-line bg-brand-bg px-3 text-[13px] text-brand-text focus:border-brand-accent focus:outline-none"
            >
              <option value="">Choose…</option>
              {countries.map((c) => (
                <option key={c.name} value={c.name}>
                  {c.flag} {c.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      </Section>

      {/* 5. Bio */}
      <Section title="Bio">
        <label className="block">
          <span className="text-[13px] font-bold text-brand-text">
            Short bio
          </span>
          <textarea
            value={state.bio}
            onChange={(e) => update("bio", e.target.value.slice(0, BIO_MAX))}
            maxLength={BIO_MAX}
            rows={4}
            placeholder="Tell people who you are in 280 characters — visible on your leaderboard entry and white-label landing pages"
            className="mt-1 block w-full rounded-xl border border-brand-line bg-brand-bg px-3 py-3 text-[13px] leading-relaxed text-brand-text focus:border-brand-accent focus:outline-none"
          />
          <p
            className={`mt-1 text-[13px] ${
              bioLeft < 0
                ? "text-red-400"
                : bioLeft < 40
                  ? "text-brand-accent"
                  : "text-brand-muted"
            }`}
          >
            {bioLeft} characters left
          </p>
        </label>
      </Section>

      {/* 6. Social handles */}
      <Section
        title="Social handles"
        caption="Drop the full URL or just the handle — we'll resolve it when we render."
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field
            label="Website"
            value={state.website}
            onChange={(v) => update("website", v)}
          />
          <Field
            label="Facebook"
            value={state.facebook}
            onChange={(v) => update("facebook", v)}
          />
          <Field
            label="Instagram"
            value={state.instagram}
            onChange={(v) => update("instagram", v)}
          />
          <Field
            label="TikTok"
            value={state.tiktok}
            onChange={(v) => update("tiktok", v)}
          />
          <Field
            label="YouTube"
            value={state.youtube}
            onChange={(v) => update("youtube", v)}
          />
          <Field
            label="Twitter / X"
            value={state.twitter}
            onChange={(v) => update("twitter", v)}
          />
          <Field
            label="LinkedIn"
            value={state.linkedin}
            onChange={(v) => update("linkedin", v)}
          />
        </div>
      </Section>

      {err && <p className="text-[13px] font-semibold text-red-400">{err}</p>}
      {saved && (
        <p className="text-[13px] font-semibold text-green-400">
          Profile saved.
        </p>
      )}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={saveDisabled}
          className="inline-flex h-12 items-center justify-center rounded-xl bg-brand-accent px-6 text-[13px] font-bold text-black transition hover:opacity-90 disabled:cursor-not-allowed disabled:bg-brand-line disabled:text-brand-muted"
        >
          {submitting
            ? "Saving…"
            : dirty
              ? "Save profile"
              : "No changes to save"}
        </button>
      </div>
    </form>
  );
}

function Section({
  title,
  caption,
  children
}: {
  title: string;
  caption?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3 rounded-xl border border-brand-line bg-brand-surface p-5">
      <div>
        <h2 className="text-[13px] font-extrabold uppercase tracking-[0.22em] text-brand-accent">
          {title}
        </h2>
        {caption && (
          <p className="mt-1 text-[13px] leading-snug text-brand-muted">
            {caption}
          </p>
        )}
      </div>
      {children}
    </section>
  );
}

function AvatarPreview({ src }: { src: string | null | undefined }) {
  if (!src) {
    return (
      <div
        aria-hidden="true"
        className="flex h-24 w-24 items-center justify-center rounded-full border border-dashed border-brand-line bg-brand-bg text-[13px] text-brand-muted"
      >
        No photo
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt="Your profile photo"
      width={96}
      height={96}
      className="h-24 w-24 rounded-full border border-brand-line object-cover"
    />
  );
}

function Field({
  label,
  value,
  onChange,
  type
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="text-[13px] font-bold text-brand-text">{label}</span>
      <input
        type={type ?? "text"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 block h-12 w-full rounded-xl border border-brand-line bg-brand-bg px-3 text-[13px] text-brand-text focus:border-brand-accent focus:outline-none"
      />
    </label>
  );
}
