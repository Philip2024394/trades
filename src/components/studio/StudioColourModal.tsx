"use client";

// StudioColourModal — pick a colour token override.
//
// Small modal opened from the Colour tool on any element toolbar. For
// Module 8 it targets the button's accent colour (color.accent) as a
// per-instance override, but reused as-is from text tools too — text
// tools override color.text on the same principle.
//
// Writes into SectionInstance.tokenOverrides. The StudioPageClient
// merges instance overrides on top of brand tokens before render, so
// the change scopes to this section only.

import { useEffect, useState } from "react";
import { DEFAULT_TOKENS } from "@/lib/studio/tokens";

const YELLOW = "#FFB300";

type Props = {
  instanceId: string;
  /** Which token key to override — e.g. "color.accent" for buttons,
   *  "color.text" for text elements. */
  tokenKey: string;
  currentValue: string;
  onSave: (value: string) => void;
  onClose: () => void;
};

/** A few starting palettes so merchants aren't staring at a blank
 *  picker. Ordered by trades-common patterns (yellow / red / green /
 *  navy / black). Merchants can still pick anything via the native
 *  color input. */
const PRESETS = [
  "#FFB300",
  "#DC2626",
  "#10B981",
  "#0EA5E9",
  "#0F172A",
  "#0A0A0A",
  "#7C3AED",
  "#F59E0B"
];

export function StudioColourModal({
  instanceId,
  tokenKey,
  currentValue,
  onSave,
  onClose
}: Props) {
  const initial =
    currentValue && /^#[0-9A-Fa-f]{6}$/.test(currentValue)
      ? currentValue
      : (DEFAULT_TOKENS[tokenKey] as string | undefined) ?? "#FFB300";
  const [value, setValue] = useState(initial);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const save = () => {
    if (/^#[0-9A-Fa-f]{6}$/.test(value)) onSave(value);
  };

  return (
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Colour"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="border-b border-neutral-200 p-5">
          <p
            className="text-[10px] font-extrabold uppercase tracking-widest"
            style={{ color: YELLOW }}
          >
            Colour
          </p>
          <h2 className="mt-1 text-[18px] font-extrabold text-neutral-900">
            Pick a colour
          </h2>
          <p className="mt-1 truncate text-[11px] font-mono text-neutral-400">
            {instanceId} · {tokenKey}
          </p>
        </header>

        <div className="space-y-4 p-5">
          <div className="flex items-center gap-3">
            <div
              className="h-16 w-16 shrink-0 rounded-xl border border-neutral-300"
              style={{ background: value }}
              aria-hidden="true"
            />
            <div className="min-w-0 flex-1">
              <input
                type="color"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                className="h-9 w-full cursor-pointer rounded-md border border-neutral-300 bg-white p-0.5"
              />
              <input
                type="text"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    save();
                  }
                }}
                className="mt-1 block h-8 w-full rounded-md border border-neutral-300 bg-white px-2 font-mono text-[12px] font-bold"
                placeholder="#FFB300"
              />
            </div>
          </div>

          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-widest text-neutral-500">
              Trade palette
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {PRESETS.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-label={c}
                  title={c}
                  onClick={() => setValue(c)}
                  className="h-9 w-9 rounded-md border border-neutral-300 transition hover:scale-110"
                  style={{
                    background: c,
                    outline:
                      value.toLowerCase() === c.toLowerCase()
                        ? `2px solid ${YELLOW}`
                        : "none",
                    outlineOffset: "2px"
                  }}
                />
              ))}
            </div>
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
