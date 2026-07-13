"use client";

// StudioPromptBar — persistent AI edit surface anchored bottom-right.
//
// Selection-aware: shows what the merchant is editing (or nudges them
// to pick a section). Submits to /api/studio/ai/mutate (Day 2 engine
// with prompt caching). Diff preview stays IN the bar — no modal — so
// the merchant can Apply/Discard without losing sight of the canvas.
//
// Patches flow through onApply → applyAiPatch → history/undo, matching
// the existing StudioAiModal contract.

import { useCallback, useEffect, useRef, useState } from "react";

const YELLOW = "#FFB300";
const BLACK = "#0A0A0A";
const GREEN = "#10B981";
const RED = "#DC2626";
const BLUE = "#3B82F6";

type SelectedContext = {
  instanceId: string;
  sectionId: string;
  sectionName: string;
  currentConfig: Record<string, unknown>;
};

type Props = {
  merchantSlug: string;
  token: string;
  selected: SelectedContext | null;
  onApply: (instanceId: string, patch: Record<string, unknown>) => void;
};

type Phase =
  | { kind: "idle" }
  | { kind: "requesting" }
  | {
      kind: "preview";
      instanceId: string;
      patch: Record<string, unknown>;
      note: string | null;
      rejected: string[];
      sourceConfig: Record<string, unknown>;
    }
  | { kind: "empty"; note: string | null }
  | { kind: "error"; message: string };

const SUGGESTED_PROMPTS = [
  "Make the headline shorter",
  "Sound more urgent",
  "Make it more premium",
  "Trades-plain voice, no fluff",
  "Add a stat about years on the tools"
];

export function StudioPromptBar({
  merchantSlug,
  token,
  selected,
  onApply
}: Props) {
  const [open, setOpen] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  // When the merchant changes selection while the bar is open, reset
  // phase back to idle so the previous section's diff doesn't linger.
  useEffect(() => {
    if (phase.kind === "preview" && selected?.instanceId !== phase.instanceId) {
      setPhase({ kind: "idle" });
      setPrompt("");
    }
  }, [selected?.instanceId, phase]);

  // Cmd+/ opens the bar and focuses. Escape closes.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "/" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen(true);
        setTimeout(() => inputRef.current?.focus(), 20);
      }
      if (e.key === "Escape" && open) {
        // Only close if not typing — otherwise let textarea handle escape.
        const el = document.activeElement;
        if (el !== inputRef.current) setOpen(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const submit = useCallback(async () => {
    if (!selected || !prompt.trim()) return;
    setPhase({ kind: "requesting" });
    try {
      const res = await fetch("/api/studio/ai/mutate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: merchantSlug,
          edit_token: token,
          section_id: selected.sectionId,
          current_params: selected.currentConfig,
          prompt: prompt.trim()
        })
      });
      if (res.status === 429) {
        setPhase({
          kind: "error",
          message: "Slow down — 60 AI edits every 5 min. Try again shortly."
        });
        return;
      }
      const json = (await res.json()) as {
        ok?: boolean;
        error?: string;
        patch?: Record<string, unknown>;
        note?: string | null;
        rejected?: string[];
      };
      if (!res.ok || !json.ok) {
        setPhase({
          kind: "error",
          message: json.error ?? `HTTP ${res.status}`
        });
        return;
      }
      const patch = json.patch ?? {};
      const note = json.note ?? null;
      if (Object.keys(patch).length === 0) {
        setPhase({ kind: "empty", note });
        return;
      }
      setPhase({
        kind: "preview",
        instanceId: selected.instanceId,
        patch,
        note,
        rejected: json.rejected ?? [],
        sourceConfig: selected.currentConfig
      });
    } catch (err) {
      setPhase({
        kind: "error",
        message: (err as Error)?.message ?? "network"
      });
    }
  }, [merchantSlug, token, selected, prompt]);

  const apply = useCallback(() => {
    if (phase.kind !== "preview") return;
    onApply(phase.instanceId, phase.patch);
    setPhase({ kind: "idle" });
    setPrompt("");
  }, [phase, onApply]);

  const discard = useCallback(() => {
    setPhase({ kind: "idle" });
  }, []);

  const busy = phase.kind === "requesting";

  if (!open) {
    return (
      <div
        className="pointer-events-none fixed inset-x-0 bottom-0 z-[200] flex justify-end p-4"
        aria-hidden={false}
      >
        <button
          type="button"
          onClick={() => {
            setOpen(true);
            setTimeout(() => inputRef.current?.focus(), 20);
          }}
          className="pointer-events-auto inline-flex h-11 items-center gap-2 rounded-full px-4 text-[12px] font-extrabold uppercase tracking-widest text-white shadow-2xl transition hover:brightness-110"
          style={{ background: BLACK }}
          aria-label="Open AI prompt bar (Cmd/Ctrl+/)"
          title="Ask AI (Cmd/Ctrl+/)"
        >
          <span style={{ color: YELLOW }}>✦</span> Ask AI
        </button>
      </div>
    );
  }

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[200] flex justify-end p-4">
      <div
        className="pointer-events-auto flex w-full max-w-md flex-col overflow-hidden rounded-2xl bg-white shadow-2xl ring-2 ring-neutral-200"
        role="dialog"
        aria-label="AI prompt bar"
      >
        {/* Header */}
        <header
          className="flex items-center justify-between border-b border-neutral-200 px-4 py-3"
          style={{ background: "#FAFAFA" }}
        >
          <div className="min-w-0">
            <p
              className="text-[10px] font-extrabold uppercase tracking-widest"
              style={{ color: YELLOW }}
            >
              ✦ Ask AI
            </p>
            <p className="mt-0.5 truncate text-[13px] font-extrabold text-neutral-900">
              {selected
                ? `Editing ${selected.sectionName}`
                : "Pick a section to edit"}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close prompt bar"
            className="ml-2 inline-flex h-8 w-8 items-center justify-center rounded-full text-[16px] font-bold text-neutral-500 transition hover:bg-neutral-100"
          >
            ×
          </button>
        </header>

        {/* Body */}
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {!selected ? (
            <EmptySelectionHint />
          ) : phase.kind === "preview" ? (
            <PreviewInline
              patch={phase.patch}
              note={phase.note}
              rejected={phase.rejected}
              currentConfig={phase.sourceConfig}
            />
          ) : (
            <PromptInput
              value={prompt}
              onChange={setPrompt}
              onSubmit={submit}
              disabled={busy}
              inputRef={inputRef}
              suggestions={SUGGESTED_PROMPTS}
            />
          )}

          {phase.kind === "empty" && (
            <p
              className="mt-3 rounded-xl px-3 py-2 text-[12px] font-bold"
              style={{ background: "rgba(245,158,11,0.1)", color: "#B45309" }}
            >
              {phase.note ?? "AI didn't return any changes — try being more specific."}
            </p>
          )}

          {phase.kind === "error" && (
            <p
              role="alert"
              className="mt-3 rounded-xl px-3 py-2 text-[12px] font-bold"
              style={{ background: "rgba(220,38,38,0.08)", color: RED }}
            >
              {phase.message}
            </p>
          )}

          {phase.kind === "requesting" && (
            <p
              className="mt-3 rounded-xl px-3 py-2 text-[12px] font-bold"
              style={{ background: "rgba(59,130,246,0.08)", color: BLUE }}
            >
              Thinking…
            </p>
          )}
        </div>

        {/* Footer */}
        <footer className="flex items-center justify-between gap-2 border-t border-neutral-200 p-3">
          {phase.kind === "preview" ? (
            <>
              <button
                type="button"
                onClick={discard}
                className="inline-flex h-10 items-center rounded-xl px-4 text-[12px] font-extrabold uppercase tracking-widest text-neutral-700 transition hover:bg-neutral-100"
              >
                Discard
              </button>
              <button
                type="button"
                onClick={apply}
                className="inline-flex h-10 items-center rounded-xl px-4 text-[12px] font-extrabold uppercase tracking-widest text-white transition hover:brightness-110"
                style={{ background: GREEN }}
              >
                ✓ Apply
              </button>
            </>
          ) : (
            <>
              <p className="text-[10px] font-mono text-neutral-400">
                {selected ? `${selected.sectionId}` : "—"}
              </p>
              <button
                type="button"
                onClick={submit}
                disabled={busy || !selected || !prompt.trim()}
                className="inline-flex h-10 items-center rounded-xl px-4 text-[12px] font-extrabold uppercase tracking-widest text-white transition disabled:cursor-not-allowed disabled:opacity-40 hover:enabled:brightness-110"
                style={{ background: BLACK }}
              >
                {busy ? "Thinking…" : "✦ Send →"}
              </button>
            </>
          )}
        </footer>
      </div>
    </div>
  );
}

// ─── Panels ─────────────────────────────────────────────────

function EmptySelectionHint() {
  return (
    <div className="rounded-xl border border-dashed border-neutral-300 bg-neutral-50 p-4 text-center">
      <p className="text-[11px] font-extrabold uppercase tracking-widest text-neutral-500">
        No section selected
      </p>
      <p className="mt-2 text-[12px] leading-relaxed text-neutral-600">
        Click any section on the canvas, then come back here to describe
        the change in plain English.
      </p>
    </div>
  );
}

function PromptInput({
  value,
  onChange,
  onSubmit,
  disabled,
  inputRef,
  suggestions
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  disabled: boolean;
  inputRef: React.RefObject<HTMLTextAreaElement | null>;
  suggestions: string[];
}) {
  return (
    <>
      <textarea
        ref={inputRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          // Cmd+Enter → submit. Plain Enter keeps newline for multi-line
          // prompts ("make the headline shorter AND add urgency").
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            onSubmit();
          }
        }}
        disabled={disabled}
        rows={3}
        placeholder="Describe the change… e.g. 'make it darker and add a 24/7 badge'"
        className="w-full resize-none rounded-xl border-2 border-neutral-200 bg-white p-3 text-[13px] leading-relaxed text-neutral-900 placeholder:text-neutral-400 focus:border-neutral-900 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
      />
      <div className="mt-3 flex flex-wrap gap-1.5">
        {suggestions.map((s) => (
          <button
            key={s}
            type="button"
            disabled={disabled}
            onClick={() => onChange(s)}
            className="inline-flex items-center rounded-full border border-neutral-200 bg-white px-2.5 py-1 text-[11px] font-bold text-neutral-600 transition hover:border-neutral-900 hover:text-neutral-900 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {s}
          </button>
        ))}
      </div>
    </>
  );
}

function PreviewInline({
  patch,
  note,
  rejected,
  currentConfig
}: {
  patch: Record<string, unknown>;
  note: string | null;
  rejected: string[];
  currentConfig: Record<string, unknown>;
}) {
  const rows = Object.entries(patch);
  return (
    <>
      <p className="text-[10px] font-extrabold uppercase tracking-widest text-neutral-500">
        Proposed changes · {rows.length} field{rows.length === 1 ? "" : "s"}
      </p>
      <ul className="mt-2 space-y-2">
        {rows.map(([key, next]) => {
          const before = currentConfig[key];
          return (
            <li
              key={key}
              className="rounded-xl border border-neutral-200 bg-white p-3"
            >
              <p className="font-mono text-[10px] font-bold text-neutral-500">
                {key}
              </p>
              <div className="mt-1.5 space-y-1.5">
                <div>
                  <span
                    className="mr-1.5 inline-flex rounded-md px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-widest"
                    style={{ background: "rgba(220,38,38,0.08)", color: RED }}
                  >
                    Was
                  </span>
                  <span className="text-[12px] leading-relaxed text-neutral-500 line-through">
                    {formatValue(before)}
                  </span>
                </div>
                <div>
                  <span
                    className="mr-1.5 inline-flex rounded-md px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-widest"
                    style={{ background: "rgba(16,185,129,0.08)", color: GREEN }}
                  >
                    New
                  </span>
                  <span className="text-[12px] font-bold leading-relaxed text-neutral-900">
                    {formatValue(next)}
                  </span>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
      {note && (
        <p
          className="mt-3 rounded-xl px-3 py-2 text-[11px] font-medium italic leading-relaxed"
          style={{ background: "rgba(255,179,0,0.08)", color: "#7C4A03" }}
        >
          &ldquo;{note}&rdquo;
        </p>
      )}
      {rejected.length > 0 && (
        <p className="mt-2 text-[10px] font-bold text-neutral-500">
          Skipped: {rejected.join(", ")}
        </p>
      )}
    </>
  );
}

function formatValue(v: unknown): string {
  if (v === undefined || v === null) return "—";
  if (typeof v === "string") return v || "—";
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}
