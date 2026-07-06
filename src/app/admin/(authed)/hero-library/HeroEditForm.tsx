// HeroEditForm — the shared form for both New + Edit pages. All 14
// fields represented; complex ones (theme_palette, text_zone,
// aspect_variants) use grouped inputs; array fields use comma-split
// helpers.
//
// Submits to POST /api/admin/hero-library (create) or PATCH
// /api/admin/hero-library/[id] (update). Redirect to list on success.

"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const RECOMMENDED_USE_OPTIONS = [
  "hero",
  "split-hero",
  "product-grid",
  "section-content"
] as const;

type HeroImageForm = {
  id: string;
  image_url: string;
  subject: string;
  keywords_strict: string; // comma-separated in the form; array on save
  excluded_trades: string;
  vibe: string;
  text_zone_json: string;
  theme_palette_primary: string;
  theme_palette_secondary: string;
  theme_palette_surface_warm: string;
  theme_palette_surface_deep: string;
  theme_palette_accent: string;
  aspect_variants_json: string;
  sibling_group_id: string;
  hero_use_case: string;
  burned_in_text: boolean;
  worker_visible: boolean;
  recommended_use: (typeof RECOMMENDED_USE_OPTIONS)[number];
  notes: string;
};

export type HeroEditFormProps = {
  mode: "new" | "edit";
  initial?: Partial<HeroImageForm> & Record<string, unknown>;
  existingId?: string;
};

const EMPTY_FORM: HeroImageForm = {
  id: "",
  image_url: "",
  subject: "",
  keywords_strict: "",
  excluded_trades: "",
  vibe: "",
  text_zone_json: '{ "primary": "top-left" }',
  theme_palette_primary: "#c9a670",
  theme_palette_secondary: "#5a3820",
  theme_palette_surface_warm: "#e5dcc9",
  theme_palette_surface_deep: "#1a1a1a",
  theme_palette_accent: "#e6c848",
  aspect_variants_json: '{ "16:9": "native", "1:1": "centre", "3:4": "left-anchor" }',
  sibling_group_id: "",
  hero_use_case: "",
  burned_in_text: false,
  worker_visible: false,
  recommended_use: "hero",
  notes: ""
};

function normaliseInitial(
  initial: HeroEditFormProps["initial"]
): HeroImageForm {
  if (!initial) return EMPTY_FORM;
  const palette = (initial.theme_palette as Record<string, string>) ?? {};
  const arr = (v: unknown) =>
    Array.isArray(v) ? (v as string[]).join(", ") : "";
  const jsonStr = (v: unknown) =>
    v && typeof v === "object" ? JSON.stringify(v, null, 2) : "{}";
  return {
    id: (initial.id as string) ?? "",
    image_url: (initial.image_url as string) ?? "",
    subject: (initial.subject as string) ?? "",
    keywords_strict: arr(initial.keywords_strict),
    excluded_trades: arr(initial.excluded_trades),
    vibe: (initial.vibe as string) ?? "",
    text_zone_json: jsonStr(initial.text_zone),
    theme_palette_primary: palette.primary ?? "#c9a670",
    theme_palette_secondary: palette.secondary ?? "#5a3820",
    theme_palette_surface_warm: palette.surface_warm ?? "#e5dcc9",
    theme_palette_surface_deep: palette.surface_deep ?? "#1a1a1a",
    theme_palette_accent: palette.accent ?? "#e6c848",
    aspect_variants_json: jsonStr(initial.aspect_variants),
    sibling_group_id: (initial.sibling_group_id as string) ?? "",
    hero_use_case: (initial.hero_use_case as string) ?? "",
    burned_in_text: Boolean(initial.burned_in_text),
    worker_visible: Boolean(initial.worker_visible),
    recommended_use:
      ((initial.recommended_use as string) as (typeof RECOMMENDED_USE_OPTIONS)[number]) ??
      "hero",
    notes: (initial.notes as string) ?? ""
  };
}

function buildPayload(form: HeroImageForm) {
  const arr = (s: string) =>
    s
      .split(",")
      .map((k) => k.trim())
      .filter(Boolean);
  const parseJson = (s: string, fallback: unknown) => {
    try {
      return JSON.parse(s);
    } catch {
      return fallback;
    }
  };
  return {
    id: form.id.trim(),
    image_url: form.image_url.trim(),
    subject: form.subject.trim(),
    keywords_strict: arr(form.keywords_strict),
    excluded_trades: arr(form.excluded_trades),
    vibe: form.vibe.trim(),
    text_zone: parseJson(form.text_zone_json, { primary: "top-left" }),
    theme_palette: {
      primary: form.theme_palette_primary,
      secondary: form.theme_palette_secondary,
      surface_warm: form.theme_palette_surface_warm,
      surface_deep: form.theme_palette_surface_deep,
      accent: form.theme_palette_accent
    },
    aspect_variants: parseJson(form.aspect_variants_json, {}),
    sibling_group_id: form.sibling_group_id.trim() || null,
    hero_use_case: form.hero_use_case.trim(),
    burned_in_text: form.burned_in_text,
    worker_visible: form.worker_visible,
    recommended_use: form.recommended_use,
    notes: form.notes.trim() || null
  };
}

function Field({
  label,
  children,
  hint
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-neutral-600">
        {label}
      </span>
      {children}
      {hint ? (
        <span className="text-[10px] text-neutral-500">{hint}</span>
      ) : null}
    </label>
  );
}

const inputCls =
  "rounded-md border border-neutral-300 bg-white px-2.5 py-1.5 text-[12px] focus:border-neutral-900 focus:outline-none";
const textareaCls = inputCls + " font-mono";

export function HeroEditForm({ mode, initial, existingId }: HeroEditFormProps) {
  const router = useRouter();
  const [form, setForm] = useState<HeroImageForm>(normaliseInitial(initial));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const patch = <K extends keyof HeroImageForm>(k: K, v: HeroImageForm[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    const payload = buildPayload(form);
    if (!payload.id || !payload.image_url || !payload.subject || !payload.vibe) {
      setErr("id, image_url, subject, and vibe are required.");
      setBusy(false);
      return;
    }
    try {
      const isEdit = mode === "edit" && existingId;
      const res = await fetch(
        isEdit
          ? `/api/admin/hero-library/${encodeURIComponent(existingId as string)}`
          : "/api/admin/hero-library",
        {
          method: isEdit ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        }
      );
      if (!res.ok) {
        const text = await res.text();
        setErr(text || `Save failed (${res.status})`);
        setBusy(false);
        return;
      }
      router.push("/admin/hero-library");
      router.refresh();
    } catch (e2) {
      setErr((e2 as Error).message);
      setBusy(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-4xl px-4 py-6">
      <div className="mb-6">
        <h1 className="text-[20px] font-bold text-neutral-900">
          {mode === "new" ? "Add hero image" : `Edit ${existingId}`}
        </h1>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Field label="ID (slug)" hint="Unique. Use kebab-case + date suffix.">
          <input
            type="text"
            required
            disabled={mode === "edit"}
            value={form.id}
            onChange={(e) => patch("id", e.currentTarget.value)}
            className={inputCls}
          />
        </Field>
        <Field label="Recommended use">
          <select
            value={form.recommended_use}
            onChange={(e) =>
              patch(
                "recommended_use",
                e.currentTarget.value as (typeof RECOMMENDED_USE_OPTIONS)[number]
              )
            }
            className={inputCls}
          >
            {RECOMMENDED_USE_OPTIONS.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <div className="mt-4">
        <Field label="Image URL">
          <input
            type="url"
            required
            value={form.image_url}
            onChange={(e) => patch("image_url", e.currentTarget.value)}
            className={inputCls}
          />
        </Field>
      </div>

      {form.image_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={form.image_url}
          alt="preview"
          className="mt-2 max-h-48 rounded-lg border border-neutral-200"
        />
      ) : null}

      <div className="mt-4">
        <Field label="Subject" hint="One-line description of what's in the image.">
          <textarea
            required
            rows={2}
            value={form.subject}
            onChange={(e) => patch("subject", e.currentTarget.value)}
            className={inputCls}
          />
        </Field>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <Field label="Vibe" hint="e.g. 'documentary / real worker'">
          <input
            type="text"
            required
            value={form.vibe}
            onChange={(e) => patch("vibe", e.currentTarget.value)}
            className={inputCls}
          />
        </Field>
        <Field label="Sibling group id" hint="Optional. Links related images.">
          <input
            type="text"
            value={form.sibling_group_id}
            onChange={(e) => patch("sibling_group_id", e.currentTarget.value)}
            className={inputCls}
          />
        </Field>
      </div>

      <div className="mt-4">
        <Field
          label="Keywords (strict)"
          hint="Comma-separated. These are the ONLY search terms that surface this image."
        >
          <textarea
            required
            rows={2}
            value={form.keywords_strict}
            onChange={(e) => patch("keywords_strict", e.currentTarget.value)}
            className={inputCls}
          />
        </Field>
      </div>

      <div className="mt-4">
        <Field
          label="Excluded trades"
          hint="Comma-separated. Trades the image should NEVER surface for."
        >
          <textarea
            rows={2}
            value={form.excluded_trades}
            onChange={(e) => patch("excluded_trades", e.currentTarget.value)}
            className={inputCls}
          />
        </Field>
      </div>

      <div className="mt-4">
        <Field label="Hero use case">
          <textarea
            rows={2}
            value={form.hero_use_case}
            onChange={(e) => patch("hero_use_case", e.currentTarget.value)}
            className={inputCls}
          />
        </Field>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-5">
        {(
          [
            ["theme_palette_primary", "Primary"],
            ["theme_palette_secondary", "Secondary"],
            ["theme_palette_surface_warm", "Surface warm"],
            ["theme_palette_surface_deep", "Surface deep"],
            ["theme_palette_accent", "Accent"]
          ] as const
        ).map(([key, label]) => (
          <Field key={key} label={label}>
            <div className="flex items-center gap-1">
              <input
                type="color"
                value={form[key]}
                onChange={(e) => patch(key, e.currentTarget.value)}
                className="h-8 w-10 cursor-pointer rounded border border-neutral-300"
              />
              <input
                type="text"
                value={form[key]}
                onChange={(e) => patch(key, e.currentTarget.value)}
                className={inputCls + " flex-1 font-mono text-[11px]"}
              />
            </div>
          </Field>
        ))}
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <Field label="Text zone (JSON)" hint='{ "primary": "top-left", "container_required": false }'>
          <textarea
            rows={4}
            value={form.text_zone_json}
            onChange={(e) => patch("text_zone_json", e.currentTarget.value)}
            className={textareaCls}
          />
        </Field>
        <Field
          label="Aspect variants (JSON)"
          hint='{ "16:9": "native", "1:1": "centre" }'
        >
          <textarea
            rows={4}
            value={form.aspect_variants_json}
            onChange={(e) => patch("aspect_variants_json", e.currentTarget.value)}
            className={textareaCls}
          />
        </Field>
      </div>

      <div className="mt-4 flex flex-wrap gap-4">
        <label className="flex items-center gap-2 text-[12px]">
          <input
            type="checkbox"
            checked={form.burned_in_text}
            onChange={(e) => patch("burned_in_text", e.currentTarget.checked)}
          />
          Burned-in text
        </label>
        <label className="flex items-center gap-2 text-[12px]">
          <input
            type="checkbox"
            checked={form.worker_visible}
            onChange={(e) => patch("worker_visible", e.currentTarget.checked)}
          />
          Worker visible
        </label>
      </div>

      <div className="mt-4">
        <Field label="Notes" hint="Optional. Anything odd about this image.">
          <textarea
            rows={2}
            value={form.notes}
            onChange={(e) => patch("notes", e.currentTarget.value)}
            className={inputCls}
          />
        </Field>
      </div>

      {err ? (
        <div className="mt-4 rounded-md bg-red-50 px-3 py-2 text-[12px] text-red-800">
          {err}
        </div>
      ) : null}

      <div className="mt-6 flex justify-end gap-2">
        <button
          type="button"
          onClick={() => router.push("/admin/hero-library")}
          className="rounded-md border border-neutral-300 bg-white px-4 py-2 text-[12px] font-medium text-neutral-700 transition hover:bg-neutral-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={busy}
          className="rounded-md bg-neutral-900 px-4 py-2 text-[12px] font-medium text-white transition hover:bg-neutral-800 disabled:opacity-60"
        >
          {busy ? "Saving…" : mode === "new" ? "Create image" : "Save changes"}
        </button>
      </div>
    </form>
  );
}
