// /activity/[merchantId] — the trust bridge. Every business event
// alongside every projection that ran and every "held / skipped /
// failed" reason. Merchants scroll this to understand exactly what
// the platform did on their behalf.

import Link from "next/link";
import {
  AlertCircle,
  CheckCircle2,
  Circle,
  MessageSquare,
  PauseCircle,
  XCircle
} from "lucide-react";
import { loadActivity } from "@/lib/activity/loader";
import type { ProjectionStatus } from "@/lib/events/types";

type PageProps = { params: Promise<{ merchantId: string }> };

export const metadata = {
  title: "Activity · xrated studio",
  description:
    "Every automated action the platform ran on your behalf, and why."
};

export default async function ActivityPage({ params }: PageProps) {
  const { merchantId } = await params;
  const entries = await loadActivity(merchantId, 50);

  return (
    <main className="mx-auto min-h-screen max-w-3xl bg-neutral-50 px-4 py-8">
      <header className="mb-6">
        <div className="inline-flex items-center gap-1.5 rounded-full bg-neutral-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-neutral-700">
          Activity
        </div>
        <h1 className="mt-2 text-2xl font-bold text-neutral-900">
          What we did on your behalf
        </h1>
        <p className="mt-1 text-[13px] text-neutral-700">
          Every event, every action, every reason. Nothing runs silently.
        </p>
      </header>

      {entries.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-neutral-300 bg-white p-10 text-center text-[13px] text-neutral-600">
          Nothing to show yet. Head to{" "}
          <Link href="/capture" className="font-semibold underline">
            /capture
          </Link>{" "}
          to record your first business event.
        </div>
      ) : (
        <ol className="flex flex-col gap-3">
          {entries.map(({ event, projections }) => (
            <li
              key={event.id}
              className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm"
            >
              <div className="flex items-baseline justify-between gap-3">
                <div>
                  <div className="text-[13px] font-semibold text-neutral-900">
                    {eventLabel(event.eventType)}
                  </div>
                  <div className="mt-0.5 text-[11px] text-neutral-500">
                    {new Date(event.occurredAt).toLocaleString("en-GB", {
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit"
                    })}{" "}
                    · {event.source}
                  </div>
                </div>
                <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-medium text-neutral-600">
                  {event.eventType}
                </span>
              </div>

              {projections.length > 0 ? (
                <ul className="mt-3 flex flex-col gap-1.5">
                  {projections.map((p) => (
                    <li
                      key={p.id}
                      className="flex items-start gap-2 rounded-lg bg-neutral-50 px-2.5 py-1.5"
                    >
                      <StatusIcon status={p.status} />
                      <div className="min-w-0 flex-1">
                        <div className="text-[12px] font-medium text-neutral-900">
                          {projectionLabel(p.projectionType)}{" "}
                          <span
                            className={`ml-1 rounded px-1 py-0.5 text-[10px] font-semibold ${statusChipClass(p.status)}`}
                          >
                            {p.status}
                          </span>
                        </div>
                        {p.reason ? (
                          <div className="mt-0.5 text-[11px] text-neutral-600">
                            {p.reason}
                          </div>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="mt-3 rounded-lg bg-neutral-50 px-2.5 py-1.5 text-[11px] text-neutral-500">
                  No projections ran for this event.
                </div>
              )}
            </li>
          ))}
        </ol>
      )}
    </main>
  );
}

function StatusIcon({ status }: { status: ProjectionStatus }) {
  const cls = "h-3.5 w-3.5 shrink-0 mt-0.5";
  switch (status) {
    case "done":
      return <CheckCircle2 className={`${cls} text-emerald-600`} />;
    case "held":
      return <PauseCircle className={`${cls} text-amber-600`} />;
    case "failed":
      return <XCircle className={`${cls} text-red-600`} />;
    case "skipped":
      return <MessageSquare className={`${cls} text-neutral-400`} />;
    case "queued":
    case "running":
    default:
      return <Circle className={`${cls} text-blue-500`} />;
  }
}

function statusChipClass(status: ProjectionStatus): string {
  switch (status) {
    case "done":
      return "bg-emerald-100 text-emerald-800";
    case "held":
      return "bg-amber-100 text-amber-800";
    case "failed":
      return "bg-red-100 text-red-800";
    case "skipped":
      return "bg-neutral-200 text-neutral-700";
    default:
      return "bg-blue-100 text-blue-800";
  }
}

function eventLabel(eventType: string): string {
  const map: Record<string, string> = {
    work_captured: "Photos captured",
    job_completed: "Job completed",
    review_received: "Review received",
    testimonial_recorded: "Testimonial recorded",
    lead_received: "New lead",
    quote_sent: "Quote sent",
    quote_won: "Quote won",
    milestone_reached: "Milestone reached",
    certification_earned: "Certification earned",
    staff_joined: "Staff member joined",
    service_added: "Service added"
  };
  return map[eventType] ?? eventType.replace(/_/g, " ");
}

function projectionLabel(t: string): string {
  const map: Record<string, string> = {
    memory_write: "Added to your archive",
    website_update: "Website feed post",
    publication: "Social channel posts",
    gold_path_task: "Gold Path task",
    narrative_update: "Story arc updated",
    follow_up: "Follow-up scheduled",
    referral_request: "Referral request",
    maintenance_reminder: "Maintenance reminder",
    crm_update: "CRM update"
  };
  return map[t] ?? t.replace(/_/g, " ");
}
