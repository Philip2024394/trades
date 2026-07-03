"use client";

// Studio Design Presets — merchant-facing picker.
//
// Grid of preset cards. Hovering a card previews the token bundle on a
// live "sample" (headline + button + card) so the merchant sees the
// mood before applying. Clicking "Apply" POSTs every token in the
// preset to /api/studio/tokens; on success we fire onApplied() so the
// host page can refresh brand-token state.
//
// This picker only writes GLOBAL tokens — it never touches section
// config. Merchant content is untouched.

import { useMemo, useState } from "react";
import {
  DESIGN_PRESETS,
  presetToApiPayload,
  type DesignPreset,
  type DesignPresetCategory
} from "@/lib/studio/designPresets";
import { fetchWithRetry } from "@/lib/studio/fetchWithRetry";

const YELLOW = "#FFB300";
const BLACK = "#0A0A0A";
const GREEN = "#10B981";
const RED = "#DC2626";

const CATEGORIES: { id: DesignPresetCategory | "all"; label: string }[] = [
  { id: "all", label: "All" },
  { id: "corporate", label: "Corporate" },
  { id: "modern", label: "Modern" },
  { id: "luxury", label: "Luxury" },
  { id: "trade", label: "Trade" },
  { id: "minimal", label: "Minimal" },
  { id: "expressive", label: "Expressive" }
];

type ApplyState =
  | { kind: "idle" }
  | { kind: "applying"; presetId: string }
  | { kind: "success"; presetId: string }
  | { kind: "error"; presetId: string; message: string };

export function DesignPresetPicker({
  onApplied
}: {
  onApplied?: (preset: DesignPreset) => void;
}) {
  const [activeCategory, setActiveCategory] = useState<
    DesignPresetCategory | "all"
  >("all");
  const [preview, setPreview] = useState<DesignPreset | null>(null);
  const [applyState, setApplyState] = useState<ApplyState>({ kind: "idle" });

  const visible = useMemo(() => {
    if (activeCategory === "all") return DESIGN_PRESETS;
    return DESIGN_PRESETS.filter((p) => p.category === activeCategory);
  }, [activeCategory]);

  async function applyPreset(preset: DesignPreset) {
    setApplyState({ kind: "applying", presetId: preset.id });
    const payloads = presetToApiPayload(preset);
    try {
      // Fire the writes sequentially so a partial failure leaves a
      // coherent trail in studio_brand_tokens (some new, some old — the
      // merchant can always re-apply).
      for (const p of payloads) {
        const res = await fetchWithRetry("/api/studio/tokens", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(p)
        });
        const json = (await res.json()) as
          | { ok: true }
          | { ok: false; error: string };
        if (!json.ok) throw new Error(json.error);
      }
      setApplyState({ kind: "success", presetId: preset.id });
      onApplied?.(preset);
      // Reset banner after a beat.
      window.setTimeout(() => setApplyState({ kind: "idle" }), 2500);
    } catch (err) {
      setApplyState({
        kind: "error",
        presetId: preset.id,
        message: (err as Error).message ?? "network"
      });
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-10 sm:py-14">
      <p
        className="text-[10px] font-extrabold uppercase tracking-widest"
        style={{ color: YELLOW }}
      >
        Design Presets
      </p>
      <h1 className="mt-2 text-3xl font-extrabold leading-tight text-neutral-900 sm:text-4xl">
        Restyle everything, keep every word.
      </h1>
      <p className="mt-3 max-w-2xl text-[14px] leading-relaxed text-neutral-600">
        Presets change fonts, colours, corner radius, and weight —
        globally. Your headlines, buttons, and copy stay exactly as you
        wrote them. Hover a preset to preview; click Apply to commit.
      </p>

      {/* Category filter */}
      <div className="mt-8 flex flex-wrap gap-2 border-b border-neutral-200 pb-2">
        {CATEGORIES.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setActiveCategory(c.id)}
            className="rounded-full border px-3 py-1 text-[11px] font-extrabold uppercase tracking-widest transition"
            style={{
              background: activeCategory === c.id ? BLACK : "transparent",
              color: activeCategory === c.id ? "#FFFFFF" : "#525252",
              borderColor: activeCategory === c.id ? BLACK : "#D4D4D4"
            }}
          >
            {c.label}
          </button>
        ))}
      </div>

      {/* Grid */}
      <ul className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {visible.map((p) => {
          const state =
            applyState.kind !== "idle" && applyState.presetId === p.id
              ? applyState
              : null;
          return (
            <li key={p.id}>
              <PresetCard
                preset={p}
                onPreview={() => setPreview(p)}
                onLeave={() => setPreview((cur) => (cur?.id === p.id ? null : cur))}
                onApply={() => applyPreset(p)}
                state={state}
              />
            </li>
          );
        })}
      </ul>

      {/* Live sample rail */}
      <section className="mt-14">
        <p className="mb-3 text-[10px] font-extrabold uppercase tracking-widest text-neutral-500">
          Live sample
        </p>
        <PresetSample preset={preview ?? DESIGN_PRESETS[0]} />
        <p className="mt-2 text-[11px] italic text-neutral-500">
          Hover any preset above to preview it here.
        </p>
      </section>
    </div>
  );
}

// ─── Preset card ─────────────────────────────────────────────

function PresetCard({
  preset,
  onPreview,
  onLeave,
  onApply,
  state
}: {
  preset: DesignPreset;
  onPreview: () => void;
  onLeave: () => void;
  onApply: () => void;
  state: ApplyState | null;
}) {
  return (
    <article
      onMouseEnter={onPreview}
      onFocus={onPreview}
      onMouseLeave={onLeave}
      onBlur={onLeave}
      className="flex h-full flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm transition hover:border-neutral-400 hover:shadow-md"
    >
      <div
        className="relative flex h-32 items-center justify-center"
        style={{
          background: `linear-gradient(135deg, ${preset.thumbnail.from} 0%, ${preset.thumbnail.to} 100%)`
        }}
      >
        <span
          className="text-xl font-extrabold"
          style={{
            fontFamily: preset.tokens["font.heading"] as string | undefined,
            color: preset.thumbnail.ink
          }}
        >
          {preset.name}
        </span>
        <span
          className="absolute right-3 top-3 h-4 w-4 rounded-full"
          style={{
            background: preset.thumbnail.accent,
            boxShadow: "0 0 0 2px rgba(255,255,255,0.4)"
          }}
          aria-hidden="true"
        />
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <p
          className="text-[9px] font-extrabold uppercase tracking-widest"
          style={{ color: YELLOW }}
        >
          {preset.category}
        </p>
        <h3 className="text-[14px] font-extrabold text-neutral-900">
          {preset.name}
        </h3>
        <p className="text-[11px] leading-relaxed text-neutral-600 line-clamp-2">
          {preset.pitch}
        </p>
        <div className="mt-1 flex flex-wrap gap-1">
          {preset.bestFor.slice(0, 3).map((t) => (
            <span
              key={t}
              className="rounded-full px-2 py-0.5 text-[9px] text-neutral-500"
              style={{ background: "#F5F5F5" }}
            >
              {t}
            </span>
          ))}
        </div>
        <button
          type="button"
          onClick={onApply}
          disabled={state?.kind === "applying"}
          className="mt-3 inline-flex h-10 items-center justify-center rounded-lg px-3 text-[11px] font-extrabold uppercase tracking-widest text-neutral-900 transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
          style={{ background: YELLOW }}
        >
          {state?.kind === "applying"
            ? "Applying…"
            : state?.kind === "success"
              ? "Applied ✓"
              : "Apply preset →"}
        </button>
        {state?.kind === "error" && (
          <p
            role="alert"
            className="rounded-md px-2 py-1 text-[10px] font-bold"
            style={{ background: "rgba(220,38,38,0.08)", color: RED }}
          >
            {state.message}
          </p>
        )}
        {state?.kind === "success" && (
          <p
            className="rounded-md px-2 py-1 text-[10px] font-bold"
            style={{ background: "rgba(16,185,129,0.10)", color: GREEN }}
          >
            Tokens updated. Refresh any preview to see the change.
          </p>
        )}
      </div>
    </article>
  );
}

// ─── Live sample rail — headline + button + card in the preset ─

function PresetSample({ preset }: { preset: DesignPreset }) {
  const t = preset.tokens;
  const surface = (t["color.surface"] as string) ?? "#FFFFFF";
  const ink = (t["color.text"] as string) ?? "#0A0A0A";
  const accent = (t["color.accent"] as string) ?? "#FFB300";
  const muted = (t["color.muted"] as string) ?? "#737373";
  const headingFont = (t["font.heading"] as string) ?? "inherit";
  const bodyFont = (t["font.body"] as string) ?? "inherit";
  const headingWeight = (t["font.heading.weight"] as number) ?? 800;
  const bodyWeight = (t["font.body.weight"] as number) ?? 500;
  const radiusLg = (t["radius.lg"] as number) ?? 16;
  const radiusMd = (t["radius.md"] as number) ?? 8;

  return (
    <div
      className="overflow-hidden border shadow-sm"
      style={{
        background: surface,
        color: ink,
        borderColor: "rgba(0,0,0,0.08)",
        borderRadius: radiusLg
      }}
    >
      <div className="grid grid-cols-1 gap-6 p-8 sm:grid-cols-[2fr_1fr] sm:p-10">
        <div>
          <p
            className="text-[10px] font-extrabold uppercase tracking-[0.28em]"
            style={{ color: accent, fontFamily: bodyFont, fontWeight: bodyWeight }}
          >
            {preset.name} preset
          </p>
          <h2
            className="mt-3 text-3xl leading-[1.05] sm:text-4xl"
            style={{
              fontFamily: headingFont,
              fontWeight: headingWeight,
              letterSpacing: "-0.01em"
            }}
          >
            Your headlines. In the mood of {preset.name}.
          </h2>
          <p
            className="mt-3 max-w-md text-[14px] leading-relaxed"
            style={{
              color: muted,
              fontFamily: bodyFont,
              fontWeight: bodyWeight
            }}
          >
            Every word you've written stays exactly as it was. Only the
            fonts, colours, radius, and weight change.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <span
              className="inline-flex h-11 items-center px-4 text-[12px] font-extrabold uppercase tracking-widest"
              style={{
                background: accent,
                color: ink,
                borderRadius: radiusMd,
                fontFamily: bodyFont
              }}
            >
              Primary button
            </span>
            <span
              className="inline-flex h-11 items-center border px-4 text-[12px] font-extrabold uppercase tracking-widest"
              style={{
                borderColor: ink,
                color: ink,
                borderRadius: radiusMd,
                fontFamily: bodyFont
              }}
            >
              Secondary
            </span>
          </div>
        </div>
        <div
          className="flex flex-col gap-2 p-5"
          style={{
            background: "rgba(0,0,0,0.04)",
            borderRadius: radiusMd
          }}
        >
          <p
            className="text-[10px] font-extrabold uppercase tracking-widest"
            style={{ color: accent, fontFamily: bodyFont }}
          >
            Card sample
          </p>
          <p
            className="text-[16px]"
            style={{
              fontFamily: headingFont,
              fontWeight: headingWeight,
              color: ink
            }}
          >
            Feature title
          </p>
          <p
            className="text-[12px] leading-relaxed"
            style={{ color: muted, fontFamily: bodyFont }}
          >
            Small supporting sentence that runs to about two short lines.
          </p>
        </div>
      </div>
    </div>
  );
}
