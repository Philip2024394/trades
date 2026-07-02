"use client";

// StudioSaveComponentModal — save current section as a reusable component.
//
// Merchant selects a section, clicks Save on the toolbar → this modal
// prompts for a name → POSTs to /api/studio/saved-components → row
// lands in studio_saved_components with the current registration id,
// config, and tokenOverrides. Module 12 will render the merchant
// library UI that lets them drop the saved component into any page.

import { useEffect, useState } from "react";

const YELLOW = "#FFB300";
const GREEN = "#10B981";
const RED = "#DC2626";

type Props = {
  instanceId: string;
  kind: string;
  sourceRegistrationId: string;
  config: Record<string, unknown>;
  tokenOverrides: Record<string, unknown>;
  suggestedName: string;
  onSaved: () => void;
  onClose: () => void;
};

type SaveState =
  | { kind: "idle" }
  | { kind: "saving" }
  | { kind: "saved"; name: string }
  | { kind: "error"; message: string };

export function StudioSaveComponentModal({
  instanceId,
  kind,
  sourceRegistrationId,
  config,
  tokenOverrides,
  suggestedName,
  onSaved,
  onClose
}: Props) {
  const [name, setName] = useState(suggestedName);
  const [state, setState] = useState<SaveState>({ kind: "idle" });

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function save() {
    const trimmed = name.trim();
    if (!trimmed) {
      setState({ kind: "error", message: "Please give it a name." });
      return;
    }
    setState({ kind: "saving" });
    try {
      const res = await fetch("/api/studio/saved-components", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind,
          name: trimmed,
          sourceRegistrationId,
          config,
          tokenOverrides
        })
      });
      const json = (await res.json()) as { ok: boolean; error?: string };
      if (!res.ok || !json.ok) {
        setState({ kind: "error", message: json.error ?? "save-failed" });
        return;
      }
      setState({ kind: "saved", name: trimmed });
      window.setTimeout(() => {
        onSaved();
      }, 900);
    } catch (err) {
      setState({
        kind: "error",
        message: (err as Error)?.message ?? "network"
      });
    }
  }

  return (
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Save section as component"
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
            Save as component
          </p>
          <h2 className="mt-1 text-[18px] font-extrabold text-neutral-900">
            Add to your library
          </h2>
          <p className="mt-1 truncate text-[11px] font-mono text-neutral-400">
            {instanceId} · {sourceRegistrationId}
          </p>
        </header>

        <div className="space-y-4 p-5">
          <label className="block">
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-neutral-500">
              Name
            </span>
            <input
              type="text"
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void save();
                }
              }}
              className="mt-1 block h-10 w-full rounded-md border border-neutral-300 bg-white px-3 text-[14px] font-bold text-neutral-900 focus:border-neutral-500 focus:outline-none"
              placeholder="Winter promo hero"
            />
          </label>

          <p className="rounded-xl border border-neutral-200 bg-neutral-50 p-3 text-[11px] leading-relaxed text-neutral-600">
            Your saved copy — including any text you&rsquo;ve edited, image
            you&rsquo;ve replaced, or colour override — will appear in your
            merchant library. Drop it into any page from there without
            recreating it.
          </p>

          {state.kind === "error" && (
            <p
              role="alert"
              className="rounded-xl px-3 py-2 text-[12px] font-bold"
              style={{ background: "rgba(220,38,38,0.08)", color: RED }}
            >
              {state.message}
            </p>
          )}
          {state.kind === "saved" && (
            <p
              className="rounded-xl px-3 py-2 text-[12px] font-bold"
              style={{ background: "rgba(16,185,129,0.08)", color: GREEN }}
            >
              ✓ Saved &ldquo;{state.name}&rdquo; to your library.
            </p>
          )}
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
            disabled={state.kind === "saving" || state.kind === "saved"}
            className="inline-flex h-10 items-center rounded-xl px-4 text-[12px] font-extrabold uppercase tracking-widest text-white transition disabled:cursor-not-allowed disabled:opacity-50 hover:enabled:brightness-110"
            style={{ background: "#0A0A0A" }}
          >
            {state.kind === "saving"
              ? "Saving…"
              : state.kind === "saved"
                ? "✓ Saved"
                : "Save →"}
          </button>
        </footer>
      </div>
    </div>
  );
}
