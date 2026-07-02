"use client";

// StudioTypographyModal — per-instance font family + weight overrides.
//
// Opened from the mirror when tool-action arrives with tool="typography".
// Writes { "font.heading", "font.body", "font.heading.weight",
// "font.body.weight" } into the SectionInstance.tokenOverrides map.
// Sections merge those over the brand tokens before render, so the
// override applies to THIS instance only and never to the whole page.
//
// Keeps the vocabulary small on purpose — full typography scale (size,
// letter-spacing, line-height, transform) lands in Module 9 once
// container editing exists as a mental peer.

import { useEffect, useState } from "react";
import { DEFAULT_TOKENS } from "@/lib/studio/tokens";

const YELLOW = "#FFB300";

const FONT_STACKS: { label: string; value: string }[] = [
  {
    label: "System sans",
    value: DEFAULT_TOKENS["font.heading"] as string
  },
  {
    label: "System serif",
    value: "Georgia, Cambria, 'Times New Roman', Times, serif"
  },
  {
    label: "System mono",
    value: "ui-monospace, 'SF Mono', Menlo, Consolas, 'Courier New', monospace"
  },
  {
    label: "Inter",
    value: "'Inter', system-ui, -apple-system, sans-serif"
  },
  {
    label: "Roboto",
    value: "'Roboto', system-ui, -apple-system, sans-serif"
  }
];

const WEIGHT_OPTIONS = [400, 500, 600, 700, 800, 900];

type Props = {
  instanceId: string;
  currentOverrides: Record<string, unknown>;
  onSave: (overrides: Record<string, unknown>) => void;
  onClose: () => void;
};

export function StudioTypographyModal({
  instanceId,
  currentOverrides,
  onSave,
  onClose
}: Props) {
  const [headingFont, setHeadingFont] = useState<string>(
    (currentOverrides["font.heading"] as string) ??
      (DEFAULT_TOKENS["font.heading"] as string)
  );
  const [bodyFont, setBodyFont] = useState<string>(
    (currentOverrides["font.body"] as string) ??
      (DEFAULT_TOKENS["font.body"] as string)
  );
  const [headingWeight, setHeadingWeight] = useState<number>(
    (currentOverrides["font.heading.weight"] as number) ??
      (DEFAULT_TOKENS["font.heading.weight"] as number)
  );
  const [bodyWeight, setBodyWeight] = useState<number>(
    (currentOverrides["font.body.weight"] as number) ??
      (DEFAULT_TOKENS["font.body.weight"] as number)
  );

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const save = () => {
    onSave({
      "font.heading": headingFont,
      "font.body": bodyFont,
      "font.heading.weight": headingWeight,
      "font.body.weight": bodyWeight
    });
  };

  return (
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Typography"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center gap-4 border-b border-neutral-200 p-5">
          <div className="min-w-0 flex-1">
            <p
              className="text-[10px] font-extrabold uppercase tracking-widest"
              style={{ color: YELLOW }}
            >
              Style
            </p>
            <h2 className="mt-1 text-[18px] font-extrabold text-neutral-900">
              Typography
            </h2>
            <p className="mt-1 truncate text-[11px] font-mono text-neutral-400">
              instance {instanceId}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid h-9 w-9 place-items-center rounded-full text-[15px] font-extrabold text-neutral-500 transition hover:bg-neutral-100"
          >
            ✕
          </button>
        </header>

        <div className="space-y-4 p-5">
          <Field label="Heading font">
            <FontSelect value={headingFont} onChange={setHeadingFont} />
          </Field>
          <Field label="Heading weight">
            <WeightSelect value={headingWeight} onChange={setHeadingWeight} />
          </Field>

          <hr className="my-2 border-neutral-200" />

          <Field label="Body font">
            <FontSelect value={bodyFont} onChange={setBodyFont} />
          </Field>
          <Field label="Body weight">
            <WeightSelect value={bodyWeight} onChange={setBodyWeight} />
          </Field>

          {/* Live preview — shows the current selections at scale. */}
          <div className="mt-4 rounded-xl border border-neutral-200 bg-neutral-50 p-4">
            <p className="text-[10px] font-extrabold uppercase tracking-widest text-neutral-400">
              Preview
            </p>
            <p
              className="mt-1 text-2xl leading-tight text-neutral-900"
              style={{ fontFamily: headingFont, fontWeight: headingWeight }}
            >
              The quick brown fox
            </p>
            <p
              className="mt-1 text-[13px] leading-relaxed text-neutral-600"
              style={{ fontFamily: bodyFont, fontWeight: bodyWeight }}
            >
              Jumps over the lazy dog and pauses to check its work. Kerning,
              weight, and line-height all render live here.
            </p>
          </div>
        </div>

        <footer className="flex items-center justify-end gap-2 border-t border-neutral-200 p-4">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 items-center rounded-xl px-4 text-[12px] font-extrabold uppercase tracking-widest text-neutral-700 transition hover:bg-neutral-100"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={save}
            className="inline-flex h-10 items-center rounded-xl px-4 text-[12px] font-extrabold uppercase tracking-widest text-white transition hover:brightness-110"
            style={{ background: "#0A0A0A" }}
          >
            Apply →
          </button>
        </footer>
      </div>
    </div>
  );
}

function Field({
  label,
  children
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-[10px] font-extrabold uppercase tracking-widest text-neutral-500">
        {label}
      </span>
      <span className="mt-1 block">{children}</span>
    </label>
  );
}

function FontSelect({
  value,
  onChange
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const known = FONT_STACKS.find((s) => s.value === value)?.value;
  const [custom, setCustom] = useState(!known);
  return custom ? (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-9 w-full rounded-md border border-neutral-300 bg-white px-2 font-mono text-[11px]"
      placeholder="'Inter', system-ui, sans-serif"
    />
  ) : (
    <select
      value={value}
      onChange={(e) => {
        if (e.target.value === "__custom__") {
          setCustom(true);
        } else {
          onChange(e.target.value);
        }
      }}
      className="h-9 w-full rounded-md border border-neutral-300 bg-white px-2 text-[13px]"
    >
      {FONT_STACKS.map((s) => (
        <option key={s.label} value={s.value}>
          {s.label}
        </option>
      ))}
      <option value="__custom__">Custom…</option>
    </select>
  );
}

function WeightSelect({
  value,
  onChange
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className="h-9 w-full rounded-md border border-neutral-300 bg-white px-2 text-[13px]"
    >
      {WEIGHT_OPTIONS.map((w) => (
        <option key={w} value={w}>
          {w} · {weightLabel(w)}
        </option>
      ))}
    </select>
  );
}

function weightLabel(w: number): string {
  if (w <= 400) return "Regular";
  if (w <= 500) return "Medium";
  if (w <= 600) return "Semibold";
  if (w <= 700) return "Bold";
  if (w <= 800) return "Extrabold";
  return "Black";
}
