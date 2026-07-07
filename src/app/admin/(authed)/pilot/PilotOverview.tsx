// Pilot ops overview UI.

"use client";

import { useState } from "react";
import {
  Activity,
  Users,
  Clock,
  MessageSquare,
  Filter
} from "lucide-react";
import { SurfaceCard } from "@/platform/ui";
import type { FunnelSummary, PilotStage } from "@/lib/os/pilot/funnel";
import type { FrictionListItem } from "@/lib/os/pilot/friction";

type Participant = {
  id: string;
  merchantId: string;
  homeownerPartyId: string | null;
  merchantDisplayName: string | null;
  homeownerDisplayName: string | null;
  friendlyLabel: string | null;
  status: string;
  startedAt: string;
  completedAt: string | null;
};

const STAGE_ROWS: Array<{ group: string; stages: PilotStage[] }> = [
  {
    group: "Merchant onboarding",
    stages: [
      "merchant.onboarding_started",
      "merchant.trade_confirmed",
      "merchant.products_seeded",
      "merchant.scope_bound",
      "merchant.tile_published",
      "merchant.onboarding_completed"
    ]
  },
  {
    group: "Homeowner journey",
    stages: [
      "homeowner.tile_opened",
      "homeowner.contact_completed",
      "homeowner.render_completed",
      "homeowner.quote_received",
      "homeowner.quote_accepted",
      "homeowner.review_posted"
    ]
  },
  {
    group: "Merchant delivery",
    stages: [
      "merchant.quote_drafted",
      "merchant.quote_sent",
      "merchant.job_opened",
      "merchant.job_signed_off",
      "merchant.review_response"
    ]
  }
];

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

export function PilotOverview({
  cohort,
  funnel,
  participants,
  unresolvedFriction,
  recentFriction
}: {
  cohort: string;
  funnel: FunnelSummary;
  participants: Participant[];
  unresolvedFriction: FrictionListItem[];
  recentFriction: FrictionListItem[];
}) {
  const [showAllFriction, setShowAllFriction] = useState(false);

  return (
    <div className="mx-auto max-w-6xl p-4 md:p-6">
      <header className="mb-6">
        <p className="text-[13px] font-semibold uppercase tracking-wide text-neutral-500">
          Admin · Pilot Ops
        </p>
        <h1 className="mt-1 text-2xl font-bold md:text-3xl">
          Cohort {cohort}
        </h1>
        <p className="mt-1 text-[14px] text-neutral-600">
          Every stage transition. Every friction report. One page.
        </p>
      </header>

      {/* FUNNEL */}
      <section className="mb-6">
        <h2 className="mb-2 flex items-center gap-2 text-[13px] font-semibold uppercase tracking-wide text-neutral-500">
          <Activity className="h-3.5 w-3.5" aria-hidden />
          Funnel
        </h2>
        <div className="space-y-3">
          {STAGE_ROWS.map((group) => (
            <SurfaceCard key={group.group} variant="primary" padding="md">
              <div className="mb-2 text-[13px] font-semibold text-neutral-700">
                {group.group}
              </div>
              <div className="grid grid-cols-2 gap-2 md:grid-cols-6">
                {group.stages.map((stage) => {
                  const count = funnel.countsByStage[stage] || 0;
                  return (
                    <div
                      key={stage}
                      className="rounded-lg border border-neutral-100 bg-neutral-50 p-2"
                    >
                      <div className="text-[13px] text-neutral-500">
                        {stage
                          .replace(/^[^.]+\./, "")
                          .replace(/_/g, " ")}
                      </div>
                      <div className="mt-1 text-xl font-bold">{count}</div>
                    </div>
                  );
                })}
              </div>
            </SurfaceCard>
          ))}
        </div>
      </section>

      {/* MEDIAN TIMES */}
      <section className="mb-6">
        <h2 className="mb-2 flex items-center gap-2 text-[13px] font-semibold uppercase tracking-wide text-neutral-500">
          <Clock className="h-3.5 w-3.5" aria-hidden />
          Median times
        </h2>
        <SurfaceCard variant="primary" padding="md">
          {Object.keys(funnel.medianTimes).length === 0 ? (
            <p className="text-[13px] text-neutral-500">
              Not enough completed transitions yet to compute medians.
            </p>
          ) : (
            <ul className="space-y-1 text-[14px]">
              {Object.entries(funnel.medianTimes).map(([key, ms]) => (
                <li key={key} className="flex items-baseline justify-between">
                  <span className="text-neutral-700">{key.replace("->", " → ")}</span>
                  <span className="font-mono font-bold">
                    {formatDuration(ms as number)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </SurfaceCard>
      </section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* PARTICIPANTS */}
        <section>
          <h2 className="mb-2 flex items-center gap-2 text-[13px] font-semibold uppercase tracking-wide text-neutral-500">
            <Users className="h-3.5 w-3.5" aria-hidden />
            Participants ({participants.length})
          </h2>
          <SurfaceCard variant="primary" padding="none">
            {participants.length === 0 ? (
              <div className="p-4 text-[13px] text-neutral-500">
                No pilot participants yet.
              </div>
            ) : (
              <ul className="divide-y divide-neutral-100">
                {participants.map((p) => (
                  <li key={p.id} className="p-3">
                    <div className="flex items-baseline justify-between gap-2">
                      <div>
                        <div className="text-[14px] font-semibold text-neutral-900">
                          {p.friendlyLabel || p.merchantDisplayName || "Unnamed"}
                        </div>
                        <div className="text-[13px] text-neutral-500">
                          started {new Date(p.startedAt).toLocaleDateString()}
                        </div>
                      </div>
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-[13px] font-semibold ${
                          p.status === "completed"
                            ? "bg-emerald-100 text-emerald-800"
                            : p.status === "abandoned"
                              ? "bg-red-100 text-red-800"
                              : "bg-neutral-100 text-neutral-800"
                        }`}
                      >
                        {p.status}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </SurfaceCard>
        </section>

        {/* FRICTION */}
        <section>
          <h2 className="mb-2 flex items-center gap-2 text-[13px] font-semibold uppercase tracking-wide text-neutral-500">
            <MessageSquare className="h-3.5 w-3.5" aria-hidden />
            Friction reports (
            {showAllFriction ? recentFriction.length : unresolvedFriction.length}
            )
            <button
              type="button"
              onClick={() => setShowAllFriction((v) => !v)}
              className="ml-auto inline-flex items-center gap-1 text-[13px] text-neutral-600 hover:text-neutral-900"
            >
              <Filter className="h-3 w-3" aria-hidden />
              {showAllFriction ? "Unresolved only" : "Show all"}
            </button>
          </h2>
          <SurfaceCard variant="primary" padding="none">
            {(showAllFriction ? recentFriction : unresolvedFriction).length === 0 ? (
              <div className="p-4 text-[13px] text-neutral-500">
                No friction reports.
              </div>
            ) : (
              <ul className="divide-y divide-neutral-100">
                {(showAllFriction ? recentFriction : unresolvedFriction).map(
                  (f) => (
                    <li key={f.id} className="p-3">
                      <div className="flex items-baseline justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span
                            className={`inline-flex rounded-full px-2 py-0.5 text-[13px] font-semibold ${
                              f.severity === "stuck"
                                ? "bg-red-100 text-red-800"
                                : f.severity === "confusion"
                                  ? "bg-amber-100 text-amber-800"
                                  : f.severity === "positive"
                                    ? "bg-emerald-100 text-emerald-800"
                                    : "bg-neutral-100 text-neutral-800"
                            }`}
                          >
                            {f.severity}
                          </span>
                          <span className="text-[13px] font-mono text-neutral-600">
                            {f.screenId}
                          </span>
                        </div>
                        <span className="text-[13px] text-neutral-500">
                          {new Date(f.createdAt).toLocaleString()}
                        </span>
                      </div>
                      <p className="mt-2 whitespace-pre-wrap text-[13px] text-neutral-800">
                        {f.body}
                      </p>
                      <div className="mt-1 text-[13px] text-neutral-500">
                        {f.actorKind}
                        {f.resolvedAt ? " · resolved" : null}
                      </div>
                    </li>
                  )
                )}
              </ul>
            )}
          </SurfaceCard>
        </section>
      </div>
    </div>
  );
}
