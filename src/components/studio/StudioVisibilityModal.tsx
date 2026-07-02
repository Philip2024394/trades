"use client";

// StudioVisibilityModal — per-breakpoint visibility for a section
// instance.
//
// Merchant ticks any combination of Mobile / Tablet / Desktop to hide
// the section on those breakpoints. A separate "Hide everywhere" toggle
// short-circuits all three (writes SectionInstance.hidden = true).
// Both signals persist through the same layout mutation — Module 3's
// autosave picks them up.

import { useEffect, useState } from "react";

const YELLOW = "#FFB300";
const BLACK = "#0A0A0A";
const RED = "#DC2626";

type Breakpoint = "mobile" | "tablet" | "desktop";

type Props = {
  instanceId: string;
  initialHidden: boolean;
  initialHiddenOn: Breakpoint[];
  onSave: (state: { hidden: boolean; hiddenOn: Breakpoint[] }) => void;
  onClose: () => void;
};

const BP_LABEL: Record<Breakpoint, string> = {
  mobile: "📱 Mobile",
  tablet: "📔 Tablet",
  desktop: "🖥️ Desktop"
};

const BP_HINT: Record<Breakpoint, string> = {
  mobile: "≤ 640px — most phones",
  tablet: "641 – 1023px — small laptops + tablets",
  desktop: "≥ 1024px — laptops + monitors"
};

export function StudioVisibilityModal({
  instanceId,
  initialHidden,
  initialHiddenOn,
  onSave,
  onClose
}: Props) {
  const [hidden, setHidden] = useState(initialHidden);
  const [hiddenOn, setHiddenOn] = useState<Breakpoint[]>(initialHiddenOn);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function toggleBp(bp: Breakpoint) {
    if (hidden) return; // masked by hidden-everywhere
    setHiddenOn((prev) =>
      prev.includes(bp) ? prev.filter((b) => b !== bp) : [...prev, bp]
    );
  }

  function save() {
    onSave({ hidden, hiddenOn });
  }

  return (
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Section visibility"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="border-b border-neutral-200 p-5">
          <p
            className="text-[10px] font-extrabold uppercase tracking-widest"
            style={{ color: YELLOW }}
          >
            Visibility
          </p>
          <h2 className="mt-1 text-[18px] font-extrabold text-neutral-900">
            Which devices should see this?
          </h2>
          <p className="mt-1 truncate text-[11px] font-mono text-neutral-400">
            {instanceId}
          </p>
        </header>

        <div className="space-y-3 p-5">
          {/* Global toggle */}
          <button
            type="button"
            onClick={() => setHidden((v) => !v)}
            className="flex w-full items-start gap-3 rounded-xl border-2 p-3 text-left transition"
            style={{
              borderColor: hidden ? RED : "#E5E5E5",
              background: hidden ? "rgba(220,38,38,0.06)" : "#FFFFFF"
            }}
          >
            <span
              aria-hidden="true"
              className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded border-2 text-[11px] font-extrabold"
              style={{
                borderColor: hidden ? RED : "#A3A3A3",
                background: hidden ? RED : "#FFFFFF",
                color: hidden ? "#FFFFFF" : "transparent"
              }}
            >
              ✓
            </span>
            <div className="flex-1">
              <p className="text-[13px] font-extrabold text-neutral-900">
                Hide everywhere
              </p>
              <p className="mt-0.5 text-[11px] leading-relaxed text-neutral-600">
                Section disappears on every device. Masks per-device toggles below.
              </p>
            </div>
          </button>

          {/* Per-BP toggles */}
          <p className="pt-2 text-[10px] font-extrabold uppercase tracking-widest text-neutral-500">
            Or hide on specific devices
          </p>
          {(["mobile", "tablet", "desktop"] as Breakpoint[]).map((bp) => {
            const on = hiddenOn.includes(bp);
            const masked = hidden;
            return (
              <button
                key={bp}
                type="button"
                onClick={() => toggleBp(bp)}
                disabled={masked}
                className="flex w-full items-start gap-3 rounded-xl border-2 p-3 text-left transition disabled:cursor-not-allowed disabled:opacity-40"
                style={{
                  borderColor: on ? BLACK : "#E5E5E5",
                  background: on ? "rgba(10,10,10,0.05)" : "#FFFFFF"
                }}
              >
                <span
                  aria-hidden="true"
                  className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded border-2 text-[11px] font-extrabold"
                  style={{
                    borderColor: on ? BLACK : "#A3A3A3",
                    background: on ? BLACK : "#FFFFFF",
                    color: on ? "#FFFFFF" : "transparent"
                  }}
                >
                  ✓
                </span>
                <div className="flex-1">
                  <p className="text-[13px] font-extrabold text-neutral-900">
                    Hide on {BP_LABEL[bp]}
                  </p>
                  <p className="mt-0.5 text-[11px] leading-relaxed text-neutral-600">
                    {BP_HINT[bp]}
                  </p>
                </div>
              </button>
            );
          })}
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
            style={{ background: BLACK }}
          >
            Apply →
          </button>
        </footer>
      </div>
    </div>
  );
}
