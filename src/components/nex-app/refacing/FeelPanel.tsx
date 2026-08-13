"use client";

// FeelPanel — SEE UI · FEEL stage (spec §B).
//
// Two screens (B-1 always, B-2 conditional):
//   B-1: "How would you like your staircase to feel?" · 6 tiles multi-select
//        · "Not sure yet" clears + disables others
//   B-2: "Anything you'd definitely like to keep?" · conditional on B-1 !== "not-sure"
//        · tiles from visible_components filtered to MUST_REMAIN candidates
//        · "Nothing — start fresh" tile permitted (produces no entries)
//
// Advances Case status BASE_CONFIRMED → INTENT_DEFINED.

import { useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import type { RefacingCase, FeelingValue } from "@/lib/nex/refacing/case-schema";
import { FEELING_VALUES } from "@/lib/nex/refacing/case-schema";
import { submitIntent } from "@/lib/nex/refacing/use-case";

type Props = {
  refacingCase: RefacingCase;
  token: string;
  onIntentSubmitted: (updated: RefacingCase) => void;
};

const FEELING_LABELS: Record<FeelingValue, string> = {
  "more-modern":   "More modern",
  "more-natural":  "More natural",
  "more-elegant":  "More elegant",
  "more-dramatic": "More dramatic",
  "more-open":     "More open",
  "not-sure":      "Not sure yet",
};

const PRESERVE_ROLE_LABELS: Record<string, string> = {
  newel:    "Newel post",
  handrail: "Handrail",
  baluster: "Balusters",
  tread:    "Treads",
  riser:    "Risers",
  stringer: "Stringer",
};

export function FeelPanel({ refacingCase, token, onIntentSubmitted }: Props) {
  const [feelings, setFeelings] = useState<Set<FeelingValue>>(new Set());
  const [preserveItems, setPreserveItems] = useState<Set<string>>(new Set());
  const [screen, setScreen] = useState<"B1" | "B2">("B1");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // MUST_REMAIN candidates derived from visible_components at SHOW.
  const preserveCandidates = useMemo(() => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const c of refacingCase.existing_staircase.visible_components ?? []) {
      if (PRESERVE_ROLE_LABELS[c.component_role] && !seen.has(c.component_role)) {
        seen.add(c.component_role);
        out.push(c.component_role);
      }
    }
    return out;
  }, [refacingCase]);

  function toggleFeeling(f: FeelingValue) {
    setFeelings((prev) => {
      const next = new Set(prev);
      if (f === "not-sure") {
        // Clears others · exclusive selection
        return next.has("not-sure") ? new Set() : new Set(["not-sure"]);
      }
      // Non-not-sure tap clears not-sure
      next.delete("not-sure");
      if (next.has(f)) next.delete(f);
      else next.add(f);
      return next;
    });
  }

  function togglePreserve(role: string) {
    setPreserveItems((prev) => {
      const next = new Set(prev);
      if (next.has(role)) next.delete(role);
      else next.add(role);
      return next;
    });
  }

  function nextFromB1() {
    // Skip B-2 if not-sure was picked OR no preserve candidates exist
    if (feelings.has("not-sure") || preserveCandidates.length === 0) {
      submit();
    } else {
      setScreen("B2");
    }
  }

  async function submit() {
    setBusy(true);
    setErr(null);
    try {
      const { case: updated } = await submitIntent(
        refacingCase.refacing_case_id,
        token,
        Array.from(feelings),
        Array.from(preserveItems)
      );
      onIntentSubmitted(updated);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  }

  if (screen === "B1") {
    return (
      <div className="flex flex-col gap-4 px-5 pb-6">
        <div>
          <div
            className="text-[11px] font-semibold uppercase tracking-widest"
            style={{ color: "var(--nex-accent-500, #8B7355)" }}
          >
            Tell NEX what you want
          </div>
          <h2
            className="mt-1 text-[20px] font-semibold leading-tight"
            style={{ color: "var(--nex-neutral-900, #1a1a1a)" }}
          >
            How would you like your staircase to feel?
          </h2>
          <p
            className="mt-1 text-[13px]"
            style={{ color: "var(--nex-neutral-500, #6b6b6b)" }}
          >
            Pick as many as you like.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {(FEELING_VALUES as readonly FeelingValue[]).map((f) => {
            const active = feelings.has(f);
            return (
              <button
                key={f}
                type="button"
                onClick={() => toggleFeeling(f)}
                aria-pressed={active}
                className="flex min-h-[68px] flex-col items-center justify-center rounded-xl px-3 py-3 text-center text-[13px] font-semibold transition active:scale-95"
                style={{
                  background: active
                    ? "var(--nex-accent-50, #F1EBDD)"
                    : "var(--nex-cream-elev, #FFFFFF)",
                  color: active
                    ? "var(--nex-neutral-900, #1a1a1a)"
                    : "var(--nex-neutral-700, #3d3d3d)",
                  border: `1px solid ${active ? "var(--nex-accent-500, #8B7355)" : "var(--nex-neutral-200, #E7E1D2)"}`,
                }}
              >
                {FEELING_LABELS[f]}
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={nextFromB1}
          disabled={busy || feelings.size === 0}
          className="mt-2 flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-[14px] font-semibold transition active:scale-95 disabled:opacity-50"
          style={{
            background: "var(--nex-neutral-900, #1a1a1a)",
            color: "var(--nex-cream, #F7F2E8)",
          }}
        >
          {busy ? <Loader2 size={16} className="animate-spin" /> : null}
          Continue
        </button>

        {err && (
          <div className="rounded-lg px-3 py-2 text-[12px]"
               style={{ background: "#FEECEC", color: "#7A1F1F", border: "1px solid #F1BFBF" }}>
            {err}
          </div>
        )}
      </div>
    );
  }

  // Screen B-2 · preserve question
  return (
    <div className="flex flex-col gap-4 px-5 pb-6">
      <div>
        <div
          className="text-[11px] font-semibold uppercase tracking-widest"
          style={{ color: "var(--nex-accent-500, #8B7355)" }}
        >
          One more question
        </div>
        <h2
          className="mt-1 text-[20px] font-semibold leading-tight"
          style={{ color: "var(--nex-neutral-900, #1a1a1a)" }}
        >
          Anything you&apos;d definitely like to keep?
        </h2>
        <p
          className="mt-1 text-[13px]"
          style={{ color: "var(--nex-neutral-500, #6b6b6b)" }}
        >
          Tap what should stay as-is.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        {preserveCandidates.map((role) => {
          const active = preserveItems.has(role);
          return (
            <button
              key={role}
              type="button"
              onClick={() => togglePreserve(role)}
              aria-pressed={active}
              className="flex items-center justify-between rounded-xl px-4 py-3 text-left text-[14px] font-semibold transition active:scale-95"
              style={{
                background: active
                  ? "var(--nex-accent-50, #F1EBDD)"
                  : "var(--nex-cream-elev, #FFFFFF)",
                color: active
                  ? "var(--nex-neutral-900, #1a1a1a)"
                  : "var(--nex-neutral-700, #3d3d3d)",
                border: `1px solid ${active ? "var(--nex-accent-500, #8B7355)" : "var(--nex-neutral-200, #E7E1D2)"}`,
              }}
            >
              <span>{PRESERVE_ROLE_LABELS[role] ?? role}</span>
              {active && <span className="text-[16px]">✓</span>}
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => setPreserveItems(new Set())}
          aria-pressed={preserveItems.size === 0}
          className="flex items-center justify-between rounded-xl px-4 py-3 text-left text-[14px] font-semibold transition active:scale-95"
          style={{
            background: preserveItems.size === 0
              ? "var(--nex-accent-50, #F1EBDD)"
              : "var(--nex-cream-elev, #FFFFFF)",
            color: "var(--nex-neutral-700, #3d3d3d)",
            border: `1px solid ${preserveItems.size === 0 ? "var(--nex-accent-500, #8B7355)" : "var(--nex-neutral-200, #E7E1D2)"}`,
          }}
        >
          <span>Nothing — start fresh</span>
          {preserveItems.size === 0 && <span className="text-[16px]">✓</span>}
        </button>
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setScreen("B1")}
          disabled={busy}
          className="rounded-xl px-4 py-3 text-[13px] font-semibold transition active:scale-95"
          style={{
            background: "var(--nex-cream-elev, #FFFFFF)",
            color: "var(--nex-neutral-700, #3d3d3d)",
            border: "1px solid var(--nex-neutral-200, #E7E1D2)",
          }}
        >
          Back
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={busy}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-3 text-[14px] font-semibold transition active:scale-95"
          style={{
            background: "var(--nex-neutral-900, #1a1a1a)",
            color: "var(--nex-cream, #F7F2E8)",
          }}
        >
          {busy ? <Loader2 size={16} className="animate-spin" /> : null}
          Continue
        </button>
      </div>

      {err && (
        <div className="rounded-lg px-3 py-2 text-[12px]"
             style={{ background: "#FEECEC", color: "#7A1F1F", border: "1px solid #F1BFBF" }}>
          {err}
        </div>
      )}
    </div>
  );
}
