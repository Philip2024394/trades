"use client";

// Assembly Plan preview — one-page inspection of what the platform
// would do if the merchant accepted every proposal.
//
// This is the "we propose, you decide" surface. Every proposal has
// its rationale rendered inline. Conflicts show the resolution + why
// the winner won. No black-box.

import { useEffect, useState } from "react";
import type {
  AssemblyProposal,
  ResolvedAssemblyPlan
} from "@/lib/studio/assembly";

const YELLOW = "#FFB300";
const GREEN = "#10B981";
const RED = "#DC2626";
const AMBER = "#F59E0B";
const BLUE = "#2563EB";
const NEUTRAL = "#525252";

type Response =
  | { ok: true; plan: ResolvedAssemblyPlan }
  | { ok: false; error: string };

const ACTION_COLOUR: Record<string, string> = {
  "add-to-page": BLUE,
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

export function AssemblyPlanView() {
  const [plan, setPlan] = useState<ResolvedAssemblyPlan | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/studio/assembly/plan");
        const json = (await res.json()) as Response;
        if (!json.ok) throw new Error(json.error);
        setPlan(json.plan);
      } catch (err) {
        setError((err as Error).message ?? "network");
      }
    })();
  }, []);

  if (error) {
    return (
      <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-[12px] font-bold text-red-700">
        {error}
      </p>
    );
  }
  if (!plan) return <p className="text-[13px] text-neutral-500">Resolving plan…</p>;

  return (
    <div className="mx-auto max-w-4xl px-6 py-10 sm:py-14">
      <p className="text-[10px] font-extrabold uppercase tracking-widest" style={{ color: YELLOW }}>
        Assembly Rule Runtime
      </p>
      <h1 className="mt-2 text-3xl font-extrabold leading-tight text-neutral-900 sm:text-4xl">
        The platform proposes. You decide.
      </h1>
      <p className="mt-3 max-w-2xl text-[14px] leading-relaxed text-neutral-600">
        Every Business Module with full DNA declares Assembly Rules —
        trigger + action + rationale. This preview walks every rule
        across every migrated module and shows exactly what the platform
        would propose to the merchant on install. Nothing runs
        automatically; every rule is surfaced with its rationale first.
      </p>

      {/* Meta strip */}
      <div className="mt-6 grid grid-cols-2 gap-3 rounded-2xl border border-neutral-200 bg-white p-4 sm:grid-cols-4">
        <MetaCell label="Proposals" value={String(plan.meta.totalProposals)} />
        <MetaCell
          label="Will apply"
          value={String(plan.meta.applicableProposals)}
          accent={GREEN}
        />
        <MetaCell
          label="Slots touched"
          value={String(plan.meta.slotsTouched.length)}
        />
        <MetaCell
          label="Pending later"
          value={String(plan.meta.pendingLaterTriggers)}
          accent={NEUTRAL}
        />
      </div>

      {plan.moduleIdsSkipped.length > 0 && (
        <p className="mt-3 text-[11px] text-amber-800">
          Skipped (not registered): {plan.moduleIdsSkipped.join(", ")}
        </p>
      )}

      {/* Conflicts first — merchants should see problems before proposals */}
      {plan.conflicts.length > 0 && (
        <section className="mt-8">
          <h2 className="text-[14px] font-extrabold uppercase tracking-widest text-neutral-900">
            Conflicts ({plan.conflicts.length})
          </h2>
          <ul className="mt-3 space-y-3">
            {plan.conflicts.map((c) => (
              <li
                key={c.slotId}
                className="rounded-2xl border-2 border-amber-300 bg-amber-50 p-4"
              >
                <p className="text-[9px] font-extrabold uppercase tracking-widest" style={{ color: AMBER }}>
                  Slot conflict · {c.slotId}
                </p>
                <p className="mt-1 text-[12px] leading-relaxed text-amber-900">
                  {c.resolutionReason}
                </p>
                <div className="mt-3 space-y-2">
                  <div>
                    <p className="text-[10px] font-bold text-emerald-800">
                      Winner (priority {c.winner.action.priority})
                    </p>
                    <ProposalRow proposal={c.winner} />
                  </div>
                  {c.losers.map((l) => (
                    <div key={l.id}>
                      <p className="text-[10px] font-bold text-red-700">
                        Lost (priority {l.action.priority})
                      </p>
                      <ProposalRow proposal={l} muted />
                    </div>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* All proposals grouped by target */}
      <section className="mt-8">
        <h2 className="text-[14px] font-extrabold uppercase tracking-widest text-neutral-900">
          Proposals by target
        </h2>
        <ul className="mt-3 space-y-3">
          {Object.entries(plan.proposalsByTarget).map(([key, proposals]) => (
            <li
              key={key}
              className="rounded-2xl border border-neutral-200 bg-white p-4"
            >
              <p className="text-[10px] font-extrabold uppercase tracking-widest text-neutral-500">
                {key} · {proposals.length} proposal{proposals.length === 1 ? "" : "s"}
              </p>
              <ul className="mt-2 space-y-2">
                {proposals.map((p) => (
                  <li key={p.id}>
                    <ProposalRow proposal={p} />
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function MetaCell({
  label,
  value,
  accent
}: {
  label: string;
  value: string;
  accent?: string;
}) {
  return (
    <div>
      <p className="text-[9px] font-extrabold uppercase tracking-widest" style={{ color: accent ?? NEUTRAL }}>
        {label}
      </p>
      <p className="mt-0.5 text-[18px] font-extrabold text-neutral-900">
        {value}
      </p>
    </div>
  );
}

function ProposalRow({
  proposal,
  muted
}: {
  proposal: AssemblyProposal;
  muted?: boolean;
}) {
  const triggerKind = proposal.trigger.kind;
  return (
    <div
      className={`flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-start ${muted ? "opacity-60" : ""}`}
      style={{ borderColor: "#E5E7EB", background: "#FFFFFF" }}
    >
      <div className="flex items-center gap-2">
        <span
          className="rounded-full px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-widest text-white"
          style={{ background: ACTION_COLOUR[proposal.action.kind] ?? NEUTRAL }}
        >
          {proposal.action.kind}
        </span>
        <span className="text-[9px] font-bold uppercase tracking-widest text-neutral-500">
          p{proposal.action.priority}
        </span>
        <span className="text-[9px] font-bold uppercase tracking-widest" style={{ color: NEUTRAL }}>
          {TRIGGER_LABEL[triggerKind] ?? triggerKind}
        </span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[12px] font-extrabold text-neutral-900">
          {proposal.moduleName}
          <span className="mx-1 text-neutral-400">→</span>
          <span className="font-mono text-neutral-700">{proposal.action.target}</span>
        </p>
        <p className="mt-0.5 text-[11px] leading-relaxed text-neutral-600">
          {proposal.rationale}
        </p>
      </div>
    </div>
  );
}
