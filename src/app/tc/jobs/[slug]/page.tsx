// /tc/jobs/[slug] — Job Cost Mode detail.
//
// Live margin bar at the top, cost breakdown left, payment schedule
// right, add-cost form at the bottom. Every cost line the trade adds
// re-renders margin instantly.

"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { notFound, useParams } from "next/navigation";
import { ArrowLeft, MapPin, Calendar, User, FileText, Route as RouteIcon } from "lucide-react";
import { TradeCenterHeader } from "@/apps/tradecenter/components/TradeCenterHeader";
import { MarginBar } from "@/apps/jobs/components/MarginBar";
import { JobCostBreakdown } from "@/apps/jobs/components/JobCostBreakdown";
import { PaymentStagesTracker } from "@/apps/jobs/components/PaymentStagesTracker";
import { AddCostForm } from "@/apps/jobs/components/AddCostForm";
import { FinishTheJobPanel } from "@/apps/completer/components/FinishTheJobPanel";
import {
  findJob,
  costLinesForJob,
  paymentStagesForJob,
  type JobCostLine
} from "@/apps/jobs/data/jobs";
import { computeMargin, formatGbp } from "@/apps/jobs/lib/margin";

export default function JobDetailPage() {
  const params = useParams<{ slug: string }>();
  const slug = params?.slug;
  const job = slug ? findJob(slug) : undefined;
  const [localLines, setLocalLines] = useState<JobCostLine[]>([]);

  if (!job) return notFound();

  const stages = paymentStagesForJob(job.id);
  const seed = costLinesForJob(job.id);
  const allLines = useMemo(() => [...seed, ...localLines], [seed, localLines]);
  const snapshot = useMemo(() => computeMargin(job, allLines), [job, allLines]);

  return (
    <div className="flex min-h-screen flex-col bg-[#FBF6EC]">
      <TradeCenterHeader activeCategorySlug={null}/>
      <main className="flex-1 px-4 py-6 md:px-8 md:py-8">
        {/* Back */}
        <Link
          href="/tc/jobs"
          className="inline-flex min-h-[44px] items-center gap-2 text-[11.5px] font-bold text-neutral-600 hover:text-neutral-900"
        >
          <ArrowLeft size={13}/>
          All jobs
        </Link>

        {/* Header */}
        <header className="mt-3 mb-6 md:mb-8">
          <div className="text-[10px] font-black uppercase tracking-[0.15em] text-neutral-500">
            Job Cost Mode · Private to you
          </div>
          <h1 className="mt-1 text-[22px] font-black leading-tight text-neutral-900 md:text-[28px]">
            {job.title}
          </h1>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-neutral-600">
            <span className="inline-flex items-center gap-1">
              <User size={11}/> {job.customerName}
            </span>
            <span className="inline-flex items-center gap-1">
              <MapPin size={11}/> {job.addressShort}
            </span>
            <span className="inline-flex items-center gap-1">
              <Calendar size={11}/> Started {new Date(job.startedAtIso).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
            </span>
            <span className="inline-flex items-center gap-1">
              <FileText size={11}/> Quote {formatGbp(job.quoteGbp)}
            </span>
          </div>
        </header>

        {/* Two-column layout: main + sidebar. Sidebar stacks below the
            margin bar on mobile so the "am I making money?" answer stays
            above the fold. */}
        <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
          <div className="flex flex-col gap-5">
            <MarginBar snapshot={snapshot}/>
            <JobCostBreakdown
              costLines={allLines}
              perCategory={snapshot.perCategory}
              overheadAllocationGbp={job.overheadAllocationGbp}
            />
            <FinishTheJobPanel
              existingMaterialNames={allLines
                .filter((c) => c.category === "materials")
                .map((c) => c.description)}
              tags={[...job.tags]}
              onAddMaterial={(name) => {
                setLocalLines((prev) => [
                  ...prev,
                  {
                    id: `c-completer-${Date.now()}`,
                    jobId: job.id,
                    category: "materials",
                    description: name,
                    totalGbp: 0,
                    incurredAtIso: new Date().toISOString(),
                    notes: "Added via Finish The Job — set the price when you order"
                  }
                ]);
              }}
            />
            <AddCostForm
              jobId={job.id}
              onAdd={(line) => setLocalLines((prev) => [...prev, line])}
            />
          </div>
          <aside className="flex flex-col gap-5">
            <PaymentStagesTracker stages={stages}/>

            {/* Route Optimiser CTA — for the trade's day-of-materials
                delivery + pickup planning. */}
            <div
              className="rounded-xl border p-4 shadow-sm"
              style={{ borderColor: "rgba(139,69,19,0.15)", backgroundColor: "#0A0A0A" }}
            >
              <div className="flex items-center gap-2" style={{ color: "#FFB300" }}>
                <RouteIcon size={12}/>
                <div className="text-[10px] font-black uppercase tracking-[0.15em]">
                  Route Optimiser
                </div>
              </div>
              <p className="mt-2 text-[11.5px] leading-snug text-white/80">
                See pickup vs delivery for every merchant on this job. Trade Center orders
                pickups by distance — no wasted miles.
              </p>
              <Link
                href="/tc/routes"
                className="mt-3 inline-flex min-h-[40px] items-center justify-center gap-1 rounded-full px-4 text-[10.5px] font-black uppercase tracking-wider shadow-sm"
                style={{ backgroundColor: "#FFB300", color: "#0A0A0A" }}
              >
                Plan the route
              </Link>
            </div>

            {/* Job-to-Confidence-Card handoff — after completion the trade
                can push the payment record into their Trade Center-native
                history that feeds R05. Zero regulated activity — it's
                their own record on their own customer. */}
            <div
              className="rounded-xl border p-4"
              style={{ borderColor: "rgba(22,101,52,0.35)", backgroundColor: "#F0FDF4" }}
            >
              <div className="text-[10px] font-black uppercase tracking-[0.15em] text-[#166534]">
                When this job is paid
              </div>
              <p className="mt-1 text-[11.5px] leading-snug text-neutral-700">
                Log the customer's payment timing to your private Trade Center payment
                history. It doesn't get published — it's yours. Future trades can only see
                it if this customer consents to share it with them.
              </p>
              <Link
                href="/tc/confidence"
                className="mt-3 inline-flex min-h-[40px] items-center justify-center gap-1 rounded-full px-4 text-[10.5px] font-black uppercase tracking-wider text-white shadow-sm"
                style={{ backgroundColor: "#166534" }}
              >
                About your private history
              </Link>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
