// /site-office/apps/job-diary — active jobs list.

import { redirect } from "next/navigation";
import Link from "next/link";
import {
  ClipboardCheck,
  ChevronRight,
  CheckCircle2,
  Clock,
  Sparkles
} from "lucide-react";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getMerchantIdFromRequest } from "@/lib/os/merchantSession";
import { SurfaceCard } from "@/platform/ui";

export const dynamic = "force-dynamic";

export default async function JobDiaryHomePage({
  searchParams
}: {
  searchParams: Promise<{ m?: string }>;
}) {
  const sp = await searchParams;
  const merchantId = await getMerchantIdFromRequest(sp.m || null);
  if (!merchantId) {
    redirect("/site-office?next=/site-office/apps/job-diary");
  }

  const { data: jobs } = await supabaseAdmin
    .from("app_job_diary_jobs")
    .select(
      "id, title, status, progress_percent, scheduled_start_date, actual_start_date, actual_end_date, updated_at, homeowner_id, property_id"
    )
    .eq("merchant_id", merchantId)
    .order("updated_at", { ascending: false })
    .limit(100);

  const homeownerIds = Array.from(
    new Set((jobs || []).map((j) => j.homeowner_id).filter((v): v is string => Boolean(v)))
  );
  const homeownerMap = new Map<string, { full_name: string; postcode: string }>();
  if (homeownerIds.length) {
    const { data: h } = await supabaseAdmin
      .from("app_ai_visualiser_homeowners")
      .select("id, full_name, postcode")
      .in("id", homeownerIds);
    (h || []).forEach((row) =>
      homeownerMap.set(row.id, {
        full_name: row.full_name,
        postcode: row.postcode
      })
    );
  }

  const active = (jobs || []).filter((j) =>
    ["open", "in_progress", "snagging"].includes(j.status)
  );
  const finished = (jobs || []).filter((j) =>
    ["signed_off", "closed"].includes(j.status)
  );

  return (
    <div className="mx-auto max-w-4xl p-4 md:p-6">
      <header className="mb-6">
        <p className="text-[13px] font-semibold uppercase tracking-wide text-neutral-500">
          Operations
        </p>
        <h1 className="mt-1 text-2xl font-bold md:text-3xl">Job Diary</h1>
        <p className="mt-1 text-[14px] text-neutral-600">
          Every accepted job — check-in from site, snap photos, hit
          sign-off. Homeowners see live progress on their Home page.
          Warranties auto-register at sign-off.
        </p>
      </header>

      {active.length === 0 && finished.length === 0 ? (
        <SurfaceCard variant="secondary" padding="lg">
          <div className="flex items-center gap-2 text-[13px] font-semibold text-neutral-600">
            <Sparkles className="h-4 w-4" aria-hidden />
            No jobs yet
          </div>
          <p className="mt-2 text-[13px] text-neutral-600">
            Jobs open automatically the moment a homeowner accepts one
            of your Quote Workspace quotes. Nothing to set up here.
          </p>
        </SurfaceCard>
      ) : null}

      {active.length > 0 ? (
        <section className="mb-6">
          <h2 className="mb-3 text-[13px] font-semibold uppercase tracking-wide text-neutral-500">
            Active ({active.length})
          </h2>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {active.map((j) => {
              const ho = j.homeowner_id ? homeownerMap.get(j.homeowner_id) : null;
              return (
                <Link
                  key={j.id}
                  href={`/site-office/apps/job-diary/${j.id}`}
                >
                  <SurfaceCard variant="primary" padding="md" interactive>
                    <div className="flex items-baseline justify-between gap-2">
                      <div className="text-[13px] font-semibold uppercase tracking-wide text-neutral-500 capitalize">
                        {j.status.replace(/_/g, " ")}
                      </div>
                      <ChevronRight className="h-4 w-4 text-neutral-400" aria-hidden />
                    </div>
                    <div className="mt-1 text-[16px] font-semibold text-neutral-900">
                      {j.title}
                    </div>
                    {ho ? (
                      <div className="mt-1 text-[13px] text-neutral-500">
                        {ho.full_name} · {ho.postcode}
                      </div>
                    ) : null}
                    <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-neutral-100">
                      <div
                        className="h-full bg-emerald-500"
                        style={{ width: `${j.progress_percent}%` }}
                      />
                    </div>
                    <div className="mt-1 flex items-center justify-between text-[13px] text-neutral-500">
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" aria-hidden />
                        {new Date(j.updated_at).toLocaleDateString(undefined, {
                          day: "numeric",
                          month: "short"
                        })}
                      </span>
                      <span>{j.progress_percent}%</span>
                    </div>
                  </SurfaceCard>
                </Link>
              );
            })}
          </div>
        </section>
      ) : null}

      {finished.length > 0 ? (
        <section>
          <h2 className="mb-3 text-[13px] font-semibold uppercase tracking-wide text-neutral-500">
            Finished ({finished.length})
          </h2>
          <ul className="divide-y divide-neutral-100 rounded-xl border border-neutral-200 bg-white">
            {finished.map((j) => {
              const ho = j.homeowner_id ? homeownerMap.get(j.homeowner_id) : null;
              return (
                <li key={j.id}>
                  <Link
                    href={`/site-office/apps/job-diary/${j.id}`}
                    className="flex items-center justify-between gap-2 p-3 text-[13px] hover:bg-neutral-50"
                  >
                    <div>
                      <div className="font-semibold text-neutral-900">
                        {j.title}
                      </div>
                      <div className="text-neutral-500">
                        {ho?.full_name || "—"} · signed off {j.actual_end_date}
                      </div>
                    </div>
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden />
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
