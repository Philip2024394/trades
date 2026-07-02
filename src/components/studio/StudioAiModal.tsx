"use client";

// StudioAiModal — AI Design Assistant for the selected section.
//
// Merchant picks a tone (or leaves blank for generic improve) → click
// Improve → POST /api/ai/complete with the client-built payload
// (registration prompt template + aiPromptable field list + current
// config + hints). Returned patch flows into a history mutation via
// onApply — Module 3 autosave picks it up.
//
// Design intent: AI never surprises the merchant. Preview panel shows
// the diff (old value → new value per field) BEFORE apply. Merchant
// clicks Apply or Discard. This is the "AI must preserve layout" rule
// from the master brief made concrete: merchant sees exactly what the
// AI changed and consents explicitly.

import { useEffect, useMemo, useState } from "react";

const YELLOW = "#FFB300";
const BLACK = "#0A0A0A";
const GREEN = "#10B981";
const RED = "#DC2626";
const BLUE = "#3B82F6";

type Tone =
  | ""
  | "trade-plain"
  | "reassuring"
  | "premium"
  | "friendly"
  | "urgent";

const TONE_OPTIONS: { value: Tone; label: string; hint: string }[] = [
  { value: "", label: "Improve (auto)", hint: "Tighten the copy without changing the voice." },
  { value: "trade-plain", label: "Trade-plain", hint: "UK site voice. Short. No fluff." },
  { value: "reassuring", label: "Reassuring", hint: "Safety-first. Insurance and guarantee forward." },
  { value: "premium", label: "Premium", hint: "Higher-end residential / commercial." },
  { value: "friendly", label: "Friendly", hint: "Warmer, first-name-basis." },
  { value: "urgent", label: "Urgent", hint: "Emergency callouts, 24/7 response." }
];

export type AiPromptableField = {
  key: string;
  label: string;
  type: string;
  maxLength?: number;
};

type Props = {
  instanceId: string;
  sectionId: string;
  sectionName: string;
  promptTemplate: string;
  currentConfig: Record<string, unknown>;
  aiPromptable: AiPromptableField[];
  onApply: (patch: Record<string, unknown>) => void;
  onClose: () => void;
};

type Phase =
  | { kind: "idle" }
  | { kind: "requesting" }
  | { kind: "preview"; patch: Record<string, unknown>; meta?: { provider: string; latencyMs: number } }
  | { kind: "error"; message: string };

export function StudioAiModal({
  instanceId,
  sectionId,
  sectionName,
  promptTemplate,
  currentConfig,
  aiPromptable,
  onApply,
  onClose
}: Props) {
  const [tone, setTone] = useState<Tone>("");
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function run() {
    setPhase({ kind: "requesting" });
    try {
      const task = tone ? "section.rewrite" : "section.improve";
      const res = await fetch("/api/ai/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          task,
          context: {
            sectionId,
            instanceId,
            payload: {
              promptTemplate,
              currentConfig,
              aiPromptable
            }
          },
          hints: tone ? { tone } : undefined,
          budget: { maxLatencyMs: 10_000, maxOutputTokens: 2000 }
        })
      });
      const json = (await res.json()) as
        | { ok: true; result: unknown; meta?: { provider: string; latencyMs: number } }
        | { ok: false; error: { code: string; message: string } };
      if (!res.ok || !json.ok) {
        setPhase({
          kind: "error",
          message:
            "error" in json
              ? `${json.error.code}: ${json.error.message}`
              : `HTTP ${res.status}`
        });
        return;
      }
      const raw = json.result as Record<string, unknown> | null;
      if (!raw || typeof raw !== "object") {
        setPhase({ kind: "error", message: "AI returned no patch." });
        return;
      }
      // Filter to allowed keys + enforce maxLength.
      const allowedKeys = new Set(aiPromptable.map((f) => f.key));
      const cleaned: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(raw)) {
        if (!allowedKeys.has(k)) continue;
        const spec = aiPromptable.find((f) => f.key === k);
        if (spec?.maxLength && typeof v === "string" && v.length > spec.maxLength) {
          cleaned[k] = v.slice(0, spec.maxLength);
        } else {
          cleaned[k] = v;
        }
      }
      if (Object.keys(cleaned).length === 0) {
        setPhase({ kind: "error", message: "AI didn't return any changes." });
        return;
      }
      setPhase({ kind: "preview", patch: cleaned, meta: json.meta });
    } catch (err) {
      setPhase({ kind: "error", message: (err as Error)?.message ?? "network" });
    }
  }

  const busy = phase.kind === "requesting";

  return (
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="AI Design Assistant"
      onClick={onClose}
    >
      <div
        className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="border-b border-neutral-200 p-5">
          <p
            className="text-[10px] font-extrabold uppercase tracking-widest"
            style={{ color: YELLOW }}
          >
            ✦ AI Design Assistant
          </p>
          <h2 className="mt-1 text-[18px] font-extrabold text-neutral-900">
            Improve {sectionName}
          </h2>
          <p className="mt-1 truncate text-[11px] font-mono text-neutral-400">
            {instanceId} · {sectionId}
          </p>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          {phase.kind === "preview" ? (
            <PreviewPanel patch={phase.patch} currentConfig={currentConfig} />
          ) : (
            <ChooseTonePanel tone={tone} onChange={setTone} disabled={busy} />
          )}

          {phase.kind === "error" && (
            <p
              role="alert"
              className="mt-4 rounded-xl px-3 py-2 text-[12px] font-bold"
              style={{ background: "rgba(220,38,38,0.08)", color: RED }}
            >
              {phase.message}
            </p>
          )}

          {phase.kind === "requesting" && (
            <p
              className="mt-4 rounded-xl px-3 py-2 text-[12px] font-bold"
              style={{ background: "rgba(59,130,246,0.08)", color: BLUE }}
            >
              Thinking… (Anthropic Claude Opus 4.7)
            </p>
          )}
        </div>

        <footer className="flex items-center justify-between gap-2 border-t border-neutral-200 p-4">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 items-center rounded-xl px-4 text-[12px] font-extrabold uppercase tracking-widest text-neutral-700 transition hover:bg-neutral-100"
          >
            {phase.kind === "preview" ? "Discard" : "Cancel"}
          </button>
          {phase.kind === "preview" ? (
            <button
              type="button"
              onClick={() => {
                onApply(phase.patch);
                onClose();
              }}
              className="inline-flex h-10 items-center rounded-xl px-4 text-[12px] font-extrabold uppercase tracking-widest text-white transition hover:brightness-110"
              style={{ background: GREEN }}
            >
              ✓ Apply patch
            </button>
          ) : (
            <button
              type="button"
              onClick={run}
              disabled={busy}
              className="inline-flex h-10 items-center rounded-xl px-4 text-[12px] font-extrabold uppercase tracking-widest text-white transition disabled:cursor-not-allowed disabled:opacity-50 hover:enabled:brightness-110"
              style={{ background: BLACK }}
            >
              {busy ? "Thinking…" : "✦ Improve →"}
            </button>
          )}
        </footer>
      </div>
    </div>
  );
}

// ─── Panels ─────────────────────────────────────────────────

function ChooseTonePanel({
  tone,
  onChange,
  disabled
}: {
  tone: Tone;
  onChange: (t: Tone) => void;
  disabled: boolean;
}) {
  return (
    <>
      <p className="text-[10px] font-extrabold uppercase tracking-widest text-neutral-500">
        Pick a tone (optional)
      </p>
      <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {TONE_OPTIONS.map((opt) => {
          const active = tone === opt.value;
          return (
            <button
              key={opt.value || "auto"}
              type="button"
              onClick={() => onChange(opt.value)}
              disabled={disabled}
              className="flex flex-col items-start gap-1 rounded-xl border-2 p-3 text-left transition disabled:cursor-not-allowed disabled:opacity-40"
              style={{
                borderColor: active ? BLACK : "#E5E5E5",
                background: active ? "rgba(10,10,10,0.05)" : "#FFFFFF"
              }}
            >
              <span className="text-[13px] font-extrabold text-neutral-900">
                {opt.label}
              </span>
              <span className="text-[11px] leading-relaxed text-neutral-600">
                {opt.hint}
              </span>
            </button>
          );
        })}
      </div>
      <p className="mt-4 rounded-xl border border-neutral-200 bg-neutral-50 p-3 text-[11px] leading-relaxed text-neutral-600">
        The assistant only edits fields marked as AI-editable in the section
        registration. Layout, structure, buttons and links stay put. You&rsquo;ll
        see the exact diff before applying.
      </p>
    </>
  );
}

function PreviewPanel({
  patch,
  currentConfig
}: {
  patch: Record<string, unknown>;
  currentConfig: Record<string, unknown>;
}) {
  const rows = useMemo(() => Object.entries(patch), [patch]);
  return (
    <>
      <p className="text-[10px] font-extrabold uppercase tracking-widest text-neutral-500">
        Proposed changes · {rows.length} field{rows.length === 1 ? "" : "s"}
      </p>
      <ul className="mt-3 space-y-3">
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
              <div className="mt-2 space-y-2">
                <div>
                  <span
                    className="mr-2 inline-flex rounded-md px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-widest"
                    style={{
                      background: "rgba(220,38,38,0.08)",
                      color: RED
                    }}
                  >
                    Was
                  </span>
                  <span className="text-[12px] leading-relaxed text-neutral-500 line-through">
                    {formatValue(before)}
                  </span>
                </div>
                <div>
                  <span
                    className="mr-2 inline-flex rounded-md px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-widest"
                    style={{
                      background: "rgba(16,185,129,0.08)",
                      color: GREEN
                    }}
                  >
                    New
                  </span>
                  <span className="text-[13px] font-bold leading-relaxed text-neutral-900">
                    {formatValue(next)}
                  </span>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
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
