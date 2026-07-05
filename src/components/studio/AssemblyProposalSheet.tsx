"use client";

// AssemblyProposalSheet — inline "platform proposes, you decide" surface.
//
// Rendered inside InstallProgressModal (and any future install surface).
// Fetches /api/studio/assembly/preview for the given moduleId, shows one
// row per proposal with its rationale + accept/dismiss toggle, and
// exposes the current decision set via `onChange`. The parent decides
// when to POST to /decide (typically alongside the install action).
//
// Design invariants:
//   • Every proposal renders its own rationale — no black-box.
//   • Prior decisions from studio_assembly_decisions preselect the
//     matching state so re-install doesn't re-ask.
//   • Conflict losers render greyed out with their loss reason.
//   • If the module has NO assembly rules, the sheet self-hides and
//     calls onEmpty() so the parent can skip past the review UX.

import { useEffect, useState } from "react";
import type {
  AssemblyProposal,
  ResolvedAssemblyPlan
} from "@/lib/studio/assembly";

const YELLOW = "#FFB300";
const GREEN = "#10B981";
const RED = "#DC2626";
const AMBER = "#F59E0B";
const NEUTRAL = "#525252";

const ACTION_COLOUR: Record<string, string> = {
  "add-to-page": "#2563EB",
  "add-nav-item": AMBER,
  "add-cta": YELLOW,
  "insert-section": GREEN,
  "wire-to": "#7C3AED",
  "suggest-module": NEUTRAL
};

const TRIGGER_LABEL: Record<string, string> = {
  "on-install": "on install",
  "on-configure": "on configure",
  "on-usage-first": "on first use",
  "on-days-elapsed": "after N days",
  "on-conversion-below": "if conversion low"
};

type PreviewResponse =
  | {
      ok: true;
      plan: ResolvedAssemblyPlan;
      priorDecisions: Record<string, "accepted" | "dismissed">;
    }
  | { ok: false; error: string };

export type ProposalDecisions = {
  accepted: string[];
  dismissed: string[];
};

export function AssemblyProposalSheet({
  moduleIds,
  onChange,
  onEmpty
}: {
  moduleIds: string[];
  onChange: (d: ProposalDecisions) => void;
  onEmpty?: () => void;
}) {
  const [plan, setPlan] = useState<ResolvedAssemblyPlan | null>(null);
  const [prior, setPrior] = useState<
    Record<string, "accepted" | "dismissed">
  >({});
  const [decisions, setDecisions] = useState<Record<string, "accepted" | "dismissed">>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/studio/assembly/preview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ moduleIds, includeInstalled: true })
        });
        const json = (await res.json()) as PreviewResponse;
        if (cancelled) return;
        if (!json.ok) {
          setError(json.error);
          setLoading(false);
          return;
        }
        setPlan(json.plan);
        setPrior(json.priorDecisions);

        // Seed decisions: accept everything by default UNLESS the merchant
        // previously dismissed it. Losers of conflicts are marked dismissed
        // so the merchant is never asked to accept a proposal that can't
        // apply.
        const loserIds = new Set(
          json.plan.conflicts.flatMap((c) => c.losers.map((l) => l.id))
        );
        const seeded: Record<string, "accepted" | "dismissed"> = {};
        for (const p of json.plan.proposals) {
          if (json.priorDecisions[p.id]) {
            seeded[p.id] = json.priorDecisions[p.id];
          } else if (loserIds.has(p.id)) {
            seeded[p.id] = "dismissed";
          } else {
            seeded[p.id] = "accepted";
          }
        }
        setDecisions(seeded);
        setLoading(false);

        if (json.plan.proposals.length === 0) onEmpty?.();
      } catch (err) {
        if (cancelled) return;
        setError((err as Error).message ?? "network");
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // moduleIds is a stable list from the parent — join for dep key.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moduleIds.join("|")]);

  useEffect(() => {
    const accepted: string[] = [];
    const dismissed: string[] = [];
    for (const [id, decision] of Object.entries(decisions)) {
      if (decision === "accepted") accepted.push(id);
      else dismissed.push(id);
    }
    onChange({ accepted, dismissed });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [decisions]);

  if (loading) {
    return (
      <p className="text-[12px] text-neutral-500">Loading proposed actions…</p>
    );
  }
  if (error) {
    return (
      <p
        role="alert"
        className="rounded-lg px-3 py-2 text-[12px] font-bold"
        style={{ background: "rgba(220,38,38,0.08)", color: RED }}
      >
        Couldn&rsquo;t load proposals: {error}
      </p>
    );
  }
  if (!plan || plan.proposals.length === 0) return null;

  const loserIds = new Set(
    plan.conflicts.flatMap((c) => c.losers.map((l) => l.id))
  );
  const loserReasonById: Record<string, string> = {};
  for (const c of plan.conflicts) {
    for (const l of c.losers) {
      loserReasonById[l.id] =
        `Slot "${c.slotId}" filled by ${c.winner.moduleName} (higher priority).`;
    }
  }

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3">
        <p
          className="text-[9px] font-extrabold uppercase tracking-widest"
          style={{ color: YELLOW }}
        >
          Platform proposes · you decide
        </p>
        <p className="mt-1 text-[11px] leading-relaxed text-neutral-700">
          Installing this will do the following. Uncheck anything you don&rsquo;t
          want — every proposal shows why it&rsquo;s here.
        </p>
      </div>

      {plan.conflicts.length > 0 && (
        <p
          className="rounded-lg px-3 py-2 text-[11px] font-bold"
          style={{ background: "rgba(245,158,11,0.10)", color: AMBER }}
        >
          {plan.conflicts.length} slot conflict{plan.conflicts.length === 1 ? "" : "s"} —
          losing proposals are already unchecked.
        </p>
      )}

      <ul className="space-y-2">
        {plan.proposals.map((p) => {
          const decision = decisions[p.id] ?? "accepted";
          const isLoser = loserIds.has(p.id);
          const priorLocked = prior[p.id];
          return (
            <li
              key={p.id}
              className={`rounded-lg border p-3 ${isLoser ? "opacity-60" : ""}`}
              style={{
                borderColor: decision === "accepted" ? YELLOW : "#E5E7EB",
                background: "#FFFFFF"
              }}
            >
              <label className="flex cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  checked={decision === "accepted"}
                  onChange={(e) =>
                    setDecisions((prev) => ({
                      ...prev,
                      [p.id]: e.target.checked ? "accepted" : "dismissed"
                    }))
                  }
                  className="mt-0.5 h-4 w-4 shrink-0 rounded border-neutral-300"
                  aria-label={`${decision === "accepted" ? "Dismiss" : "Accept"} proposal: ${p.moduleName} → ${p.action.target}`}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span
                      className="rounded-full px-1.5 py-0.5 text-[8px] font-extrabold uppercase tracking-widest text-white"
                      style={{
                        background:
                          ACTION_COLOUR[p.action.kind] ?? NEUTRAL
                      }}
                    >
                      {p.action.kind}
                    </span>
                    <span className="text-[9px] font-bold uppercase tracking-widest text-neutral-500">
                      p{p.action.priority}
                    </span>
                    <span className="text-[9px] font-bold uppercase tracking-widest text-neutral-400">
                      {TRIGGER_LABEL[p.trigger.kind] ?? p.trigger.kind}
                    </span>
                    {priorLocked && (
                      <span
                        className="text-[8px] font-extrabold uppercase tracking-widest"
                        style={{ color: NEUTRAL }}
                      >
                        · previously {priorLocked}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-[12px] font-extrabold text-neutral-900">
                    → <span className="font-mono">{p.action.target}</span>
                  </p>
                  <p className="mt-0.5 text-[11px] leading-relaxed text-neutral-600">
                    {p.rationale}
                  </p>
                  {isLoser && loserReasonById[p.id] && (
                    <p
                      className="mt-1 text-[10px] font-bold"
                      style={{ color: AMBER }}
                    >
                      {loserReasonById[p.id]}
                    </p>
                  )}
                </div>
              </label>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Small helper used by callers wiring their own accept/dismiss buttons.
 *  Callers still need to POST to /api/studio/assembly/decide themselves —
 *  see InstallProgressModal.install() for the reference wire-up. */
export function proposalCountsFor(plan: ResolvedAssemblyPlan): {
  toApply: number;
  pendingLater: number;
} {
  return {
    toApply: plan.meta.applicableProposals,
    pendingLater: plan.meta.pendingLaterTriggers
  };
}
