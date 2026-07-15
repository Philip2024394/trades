// /tc/jobs — Job Cost Mode (R01), job list.
//
// Every job the trade has open, with headline live margin so they can
// see at a glance which jobs are healthy and which are eating them.
//
// Rock-solid element: the top strip aggregates ALL in-progress jobs so
// the trade sees their real-time weekly earning picture without
// clicking into anything.

import Link from "next/link";
import {
  Plus,
  Briefcase,
  Building2,
  Home,
  CheckCircle2,
  Clock,
  Archive
} from "lucide-react";
import { TradeCenterHeader } from "@/apps/tradecenter/components/TradeCenterHeader";
import { MarginBar } from "@/apps/jobs/components/MarginBar";
import { HowItWorksButton } from "@/apps/hub/components/HowItWorksButton";
import { PagePersonaBadge } from "@/apps/hub/components/PagePersonaBadge";
import {
  JOB_FIXTURES,
  costLinesForJob,
  paymentStagesForJob,
  type Job,
  type JobStatus
} from "@/apps/jobs/data/jobs";
import {
  computeMargin,
  receivedFromStages,
  outstandingFromStages,
  formatGbp
} from "@/apps/jobs/lib/margin";
import { currentViewerTrade } from "@/apps/identity/data/tradeIdentities";

export const dynamic = "force-dynamic";

function statusVisuals(status: JobStatus) {
  switch (status) {
    case "quoted":      return { Icon: Clock,        bg: "#DBEAFE", fg: "#1E40AF", label: "Quoted"      };
    case "in-progress": return { Icon: Briefcase,    bg: "#FEF3C7", fg: "#B45309", label: "In progress" };
    case "complete":    return { Icon: CheckCircle2, bg: "#DCFCE7", fg: "#166534", label: "Complete"    };
    case "archived":    return { Icon: Archive,      bg: "#F5F0E4", fg: "#525252", label: "Archived"    };
  }
}

export default function JobsListPage() {
  const trade = currentViewerTrade();
  const jobs = JOB_FIXTURES.filter((j) => j.ownerTradeSlug === trade.slug);

  // Weekly rollup — every in-progress + complete job in the last 30 days
  const activeJobs = jobs.filter((j) => j.status === "in-progress" || j.status === "complete");
  const totals = activeJobs.reduce(
    (acc, job) => {
      const snap = computeMargin(job, costLinesForJob(job.id));
      const stages = paymentStagesForJob(job.id);
      acc.quotes += snap.quoteGbp;
      acc.costs += snap.incurredCostsGbp;
      acc.margin += snap.netMarginGbp;
      acc.received += receivedFromStages(stages);
      acc.outstanding += outstandingFromStages(stages);
      return acc;
    },
    { quotes: 0, costs: 0, margin: 0, received: 0, outstanding: 0 }
  );
  const marginPct = totals.quotes > 0 ? (totals.margin / totals.quotes) * 100 : 0;

  return (
    <div className="flex min-h-screen flex-col bg-[#FBF6EC]">
      <TradeCenterHeader activeCategorySlug={null}/>
      <main className="flex-1 px-4 py-6 md:px-8 md:py-8">
        {/* Header */}
        <header className="mb-6 flex flex-col gap-3 md:mb-8 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="text-[10px] font-black uppercase tracking-[0.15em] text-neutral-500">
              Trade Center · Job Cost Mode
            </div>
            <h1 className="mt-1 text-[22px] font-black leading-tight text-neutral-900 md:text-[28px]">
              Your Jobs
            </h1>
            <p className="mt-1 text-[12px] leading-snug text-neutral-600 md:text-[13px]">
              Every job has a live P&amp;L. Materials, labour, and overhead in — margin out. Only you see this.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <HowItWorksButton topic="jobs"/>
            <PagePersonaBadge persona="trade" label="Jobs · Trade"/>
          </div>
          <button
            type="button"
            className="inline-flex min-h-[44px] items-center gap-2 rounded-full px-5 text-[11.5px] font-black uppercase tracking-wider text-white shadow-sm"
            style={{ backgroundColor: "#166534" }}
          >
            <Plus size={13}/>
            New Job
          </button>
        </header>

        {/* Weekly rollup */}
        <section
          className="mb-6 rounded-2xl border p-5 shadow-sm"
          style={{ borderColor: "rgba(139,69,19,0.15)", backgroundColor: "#0A0A0A" }}
        >
          <div className="text-[10px] font-black uppercase tracking-[0.15em]" style={{ color: "#FFB300" }}>
            Live across all active jobs
          </div>
          <div className="mt-2 grid grid-cols-2 gap-4 md:grid-cols-5">
            <RollupStat label="Quoted"      value={formatGbp(totals.quotes)}      accent/>
            <RollupStat label="Costs so far" value={formatGbp(totals.costs)}/>
            <RollupStat label="Margin"      value={formatGbp(totals.margin)}      big/>
            <RollupStat label="Margin %"    value={`${marginPct.toFixed(1)}%`}    big/>
            <RollupStat label="Outstanding" value={formatGbp(totals.outstanding)}/>
          </div>
        </section>

        {/* Job list */}
        <ul className="flex flex-col gap-3">
          {jobs.map((job) => (
            <JobRow key={job.id} job={job}/>
          ))}
        </ul>

        {/* Zero-state help */}
        {jobs.length === 0 && (
          <div
            className="rounded-xl border-2 border-dashed p-8 text-center"
            style={{ borderColor: "rgba(139,69,19,0.20)" }}
          >
            <div className="text-[13px] font-black text-neutral-900">No jobs yet</div>
            <p className="mx-auto mt-1 max-w-md text-[11.5px] text-neutral-600">
              Log your first job to see materials + labour + margin tracked live.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}

function RollupStat({
  label,
  value,
  big,
  accent
}: {
  label: string;
  value: string;
  big?: boolean;
  accent?: boolean;
}) {
  return (
    <div>
      <div className="text-[9.5px] font-black uppercase tracking-[0.14em]" style={{ color: "rgba(255,179,0,0.7)" }}>
        {label}
      </div>
      <div
        className={`mt-0.5 font-black ${big ? "text-[24px]" : "text-[16px]"}`}
        style={{ color: accent ? "#FFB300" : "#FFFFFF" }}
      >
        {value}
      </div>
    </div>
  );
}

function JobRow({ job }: { job: Job }) {
  const status = statusVisuals(job.status);
  const costLines = costLinesForJob(job.id);
  const snapshot = computeMargin(job, costLines);
  const stages = paymentStagesForJob(job.id);
  const received = receivedFromStages(stages);
  const outstanding = outstandingFromStages(stages);

  const isCommercial = job.tags.includes("commercial") || job.tags.includes("shop-fit");
  const TypeIcon = isCommercial ? Building2 : Home;

  return (
    <li>
      <Link
        href={`/tc/jobs/${job.slug}`}
        className="block rounded-xl border bg-white p-4 shadow-sm transition hover:shadow-md"
        style={{ borderColor: "rgba(139,69,19,0.15)" }}
      >
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:gap-5">
          {/* Left: identity */}
          <div className="flex flex-1 gap-3">
            <div
              className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg"
              style={{ backgroundColor: "#F5F0E4" }}
              aria-hidden
            >
              <TypeIcon size={22} className="text-neutral-500" strokeWidth={1.8}/>
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <div className="truncate text-[14px] font-black text-neutral-900">
                  {job.title}
                </div>
                <span
                  className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9.5px] font-black uppercase tracking-wider"
                  style={{ backgroundColor: status.bg, color: status.fg }}
                >
                  <status.Icon size={10} strokeWidth={2.5}/>
                  {status.label}
                </span>
              </div>
              <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-neutral-500">
                <span>{job.customerName}</span>
                <span>·</span>
                <span>{job.addressShort}</span>
                <span>·</span>
                <span>Quote {formatGbp(job.quoteGbp)}</span>
              </div>
              <div className="mt-2">
                <MarginBar snapshot={snapshot} compact/>
              </div>
            </div>
          </div>

          {/* Right: money summary */}
          <div className="grid grid-cols-3 gap-2 md:w-[320px] md:flex-shrink-0">
            <MicroStat label="Costs"       value={formatGbp(snapshot.incurredCostsGbp)}/>
            <MicroStat label="Received"    value={formatGbp(received)}/>
            <MicroStat label="Outstanding" value={formatGbp(outstanding)} muted={outstanding === 0}/>
          </div>
        </div>
      </Link>
    </li>
  );
}

function MicroStat({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div
      className="rounded-md p-2"
      style={{ backgroundColor: "#F5F0E4" }}
    >
      <div className="text-[9px] font-black uppercase tracking-wider text-neutral-500">
        {label}
      </div>
      <div className={`mt-0.5 text-[12px] font-black ${muted ? "text-neutral-400" : "text-neutral-900"}`}>
        {value}
      </div>
    </div>
  );
}
