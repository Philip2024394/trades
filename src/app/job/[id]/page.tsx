// /job/[id] — Job dashboard.
//
// Renders the Job Engine primitive. Reads by id or share_token,
// permission-scopes what the caller sees. Timeline · materials ·
// health · cited KB · recommended merchants + trades · Ask AI
// scoped to this job.
//
// Role-adaptive layout (Phase 2 detail — for now homeowner-first
// render with visibility rules).

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ShieldCheck, PoundSterling, Ruler, Wrench, Clock, AlertTriangle, BookOpen, Store, UserCheck, Share2, ExternalLink, Sparkles } from "lucide-react";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { SeoSiteHeader } from "@/components/seo/SeoSiteHeader";

export const dynamic  = "force-dynamic";
export const revalidate = 0;

type PageParams = { id: string };

export async function generateMetadata({ params }: { params: Promise<PageParams> }): Promise<Metadata> {
  const { id } = await params;
  const { data: job } = await supabaseAdmin
    .from("hammerex_jobs")
    .select("title, job_type_slug, preset_slug")
    .or(`id.eq.${id},share_token.eq.${id}`)
    .maybeSingle();
  if (!job) return { title: "Job not found" };
  return {
    title:       `${job.title} — Networkers Job`,
    description: `Full spec, materials, and local trades for ${job.title.toLowerCase()}.`,
    robots:      { index: false, follow: false }   // jobs are private by default
  };
}

export default async function JobPage({ params }: { params: Promise<PageParams> }) {
  const { id } = await params;

  const { data: job } = await supabaseAdmin
    .from("hammerex_jobs")
    .select("*")
    .or(`id.eq.${id},share_token.eq.${id}`)
    .maybeSingle();

  if (!job) notFound();

  const [{ data: actors }, { data: health }, { data: events }, { data: template }] = await Promise.all([
    supabaseAdmin.from("hammerex_job_actors").select("*").eq("job_id", job.id).is("removed_at", null),
    supabaseAdmin.from("hammerex_job_health").select("*").eq("job_id", job.id).maybeSingle(),
    supabaseAdmin.from("hammerex_job_events").select("*").eq("job_id", job.id).order("created_at", { ascending: false }).limit(20),
    supabaseAdmin.from("hammerex_job_templates").select("*").eq("slug", job.job_type_slug).maybeSingle()
  ]);

  const calc = job.calculated_json ?? {};
  const spec = calc?.ok ? calc : null;

  const healthLevel = health?.level ?? "green";
  const healthDot   = healthLevel === "green" ? "🟢" : healthLevel === "amber" ? "🟠" : "🔴";
  const healthColor = healthLevel === "green" ? "#166534" : healthLevel === "amber" ? "#B45309" : "#B91C1C";

  return (
    <main className="min-h-screen bg-[#FBF6EC]">
      <SeoSiteHeader/>

      <div className="mx-auto max-w-[1200px] px-4 py-6 md:px-6 md:py-8">
        <Link
          href="/videos"
          className="inline-flex items-center gap-1 text-[11px] font-black uppercase tracking-wider text-neutral-500 hover:text-neutral-900"
        >
          <ArrowLeft size={11}/> Back
        </Link>

        {/* Header */}
        <header className="mt-3 rounded-2xl border-2 bg-white p-5 shadow-sm md:p-6" style={{ borderColor: "rgba(139,69,19,0.10)" }}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.28em]" style={{ color: "#FFB300" }}>
                {template?.display_name ?? job.job_type_slug} · {job.preset_slug ?? "custom"}
              </p>
              <h1 className="mt-1 text-[26px] font-black leading-tight text-neutral-900 md:text-[32px]">
                {job.title}
              </h1>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] font-black uppercase tracking-wider text-neutral-500">
                <span className="inline-flex items-center gap-1" style={{ color: healthColor }}>
                  {healthDot} {healthLevel === "green" ? "Ready" : healthLevel === "amber" ? "Attention" : "Blocked"}
                </span>
                <span aria-hidden>·</span>
                <span>{job.status}</span>
                <span aria-hidden>·</span>
                <span>{job.country_code}{job.postcode ? ` ${job.postcode}` : ""}</span>
              </div>
              {health?.summary && (
                <p className="mt-2 text-[12.5px] text-neutral-700">{health.summary}</p>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="inline-flex h-9 items-center gap-1 rounded-md border-2 bg-white px-3 text-[11px] font-black uppercase tracking-wider text-neutral-900 hover:-translate-y-0.5 transition"
                style={{ borderColor: "rgba(0,0,0,0.15)" }}
              >
                <Share2 size={11}/> Share
              </button>
              <button
                type="button"
                className="inline-flex h-9 items-center gap-1 rounded-md px-3 text-[11px] font-black uppercase tracking-wider text-neutral-900 shadow-sm active:scale-[0.97]"
                style={{ backgroundColor: "#FFB300" }}
              >
                <Sparkles size={11}/> Request 3 quotes
              </button>
            </div>
          </div>

          {/* Stat row */}
          {spec && (
            <div className="mt-5 grid grid-cols-2 gap-2 md:grid-cols-4">
              <StatChip label="Volume"    value={`${spec.volume_m3} m³`}         icon={<Ruler size={11}/>}/>
              <StatChip label="Strength"  value={spec.strength_class}             icon={<Wrench size={11}/>}/>
              <StatChip label="Time"      value={`${spec.estimated_duration_hours} h`} icon={<Clock size={11}/>}/>
              <StatChip label="Est cost"  value={`£${(spec.cost_estimate_pence.low/100).toFixed(0)} – £${(spec.cost_estimate_pence.high/100).toFixed(0)}`} icon={<PoundSterling size={11}/>}/>
            </div>
          )}
        </header>

        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
          {/* LEFT · main dashboard */}
          <div className="space-y-4 lg:col-span-2">
            {/* Materials */}
            {spec?.materials && (
              <section className="rounded-2xl border-2 bg-white p-5 shadow-sm" style={{ borderColor: "rgba(139,69,19,0.10)" }}>
                <h2 className="text-[10px] font-black uppercase tracking-[0.22em] text-neutral-500">Materials</h2>
                <ul className="mt-2 space-y-1.5">
                  {spec.materials.map((m: any, i: number) => (
                    <li key={i} className="flex items-baseline justify-between gap-3 border-b py-2 last:border-b-0" style={{ borderColor: "rgba(0,0,0,0.06)" }}>
                      <div>
                        <p className="text-[12.5px] font-black text-neutral-900">{m.display_name}</p>
                        <p className="text-[10.5px] font-black uppercase tracking-wider text-neutral-500">{m.category} · {m.merchant_category}</p>
                        {m.notes && <p className="mt-0.5 text-[10.5px] italic text-neutral-500">{m.notes}</p>}
                      </div>
                      <div className="text-right">
                        <p className="text-[13px] font-black text-neutral-900 tabular-nums">{m.quantity} {m.unit}</p>
                        {m.estimated_price_pence && (
                          <p className="text-[10.5px] font-black text-neutral-500">~£{(m.estimated_price_pence/100).toFixed(0)}</p>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* Additional items */}
            {spec?.additional_items?.length > 0 && (
              <section className="rounded-2xl border-2 bg-white p-5 shadow-sm" style={{ borderColor: "rgba(139,69,19,0.10)" }}>
                <h2 className="text-[10px] font-black uppercase tracking-[0.22em] text-neutral-500">You'll also need</h2>
                <ul className="mt-2 space-y-0.5">
                  {spec.additional_items.map((a: string, i: number) => (
                    <li key={i} className="text-[12px] text-neutral-800">· {a}</li>
                  ))}
                </ul>
              </section>
            )}

            {/* Tools */}
            {spec?.tools_required?.length > 0 && (
              <section className="rounded-2xl border-2 bg-white p-5 shadow-sm" style={{ borderColor: "rgba(139,69,19,0.10)" }}>
                <h2 className="text-[10px] font-black uppercase tracking-[0.22em] text-neutral-500">Tools</h2>
                <ul className="mt-2 flex flex-wrap gap-1.5">
                  {spec.tools_required.map((t: string, i: number) => (
                    <li key={i} className="inline-flex items-center gap-1 rounded-full border-2 bg-white px-3 py-1 text-[11px] font-black text-neutral-800" style={{ borderColor: "rgba(0,0,0,0.15)" }}>
                      <Wrench size={9}/> {t}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* Warnings */}
            {spec?.warnings?.length > 0 && (
              <section className="rounded-2xl border-2 p-5" style={{ borderColor: "#F59E0B", backgroundColor: "#FFFBEB" }}>
                <div className="flex items-start gap-2">
                  <AlertTriangle size={13} className="mt-0.5 shrink-0 text-amber-700"/>
                  <div>
                    <p className="text-[11px] font-black uppercase tracking-wider text-amber-800">Important — estimates only</p>
                    <ul className="mt-2 space-y-1">
                      {spec.warnings.map((w: string, i: number) => (
                        <li key={i} className="text-[12px] text-amber-900">· {w}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </section>
            )}
          </div>

          {/* RIGHT · sidebar */}
          <aside className="space-y-4">
            {/* Sub-base + reinforcement spec */}
            {spec && (
              <section className="rounded-2xl border-2 bg-white p-5 shadow-sm" style={{ borderColor: "rgba(139,69,19,0.10)" }}>
                <h2 className="text-[10px] font-black uppercase tracking-[0.22em] text-neutral-500">Spec</h2>
                <dl className="mt-2 space-y-2 text-[12px]">
                  <div>
                    <dt className="text-[9.5px] font-black uppercase tracking-wider text-neutral-500">Mix ratio</dt>
                    <dd className="mt-0.5 font-black text-neutral-900">{spec.mix_ratio} · {spec.strength_class}</dd>
                  </div>
                  <div>
                    <dt className="text-[9.5px] font-black uppercase tracking-wider text-neutral-500">Slump</dt>
                    <dd className="mt-0.5 font-black text-neutral-900">{spec.slump_class}</dd>
                  </div>
                  {spec.reinforcement_spec && (
                    <div>
                      <dt className="text-[9.5px] font-black uppercase tracking-wider text-neutral-500">Reinforcement</dt>
                      <dd className="mt-0.5 text-neutral-800">{spec.reinforcement_spec}</dd>
                    </div>
                  )}
                  <div>
                    <dt className="text-[9.5px] font-black uppercase tracking-wider text-neutral-500">Sub-base</dt>
                    <dd className="mt-0.5 text-neutral-800">{spec.sub_base_spec}</dd>
                  </div>
                  <div>
                    <dt className="text-[9.5px] font-black uppercase tracking-wider text-neutral-500">Difficulty · DIY?</dt>
                    <dd className="mt-0.5 font-black text-neutral-900 capitalize">{spec.difficulty} · {spec.diy_friendly ? "yes" : "hire a trade"}</dd>
                  </div>
                  {spec.building_control_required && (
                    <div className="rounded-lg bg-amber-50 p-2">
                      <p className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-amber-800">
                        <ShieldCheck size={9}/> Building Control notifiable
                      </p>
                    </div>
                  )}
                </dl>
              </section>
            )}

            {/* Timeline */}
            {events && events.length > 0 && (
              <section className="rounded-2xl border-2 bg-white p-5 shadow-sm" style={{ borderColor: "rgba(139,69,19,0.10)" }}>
                <h2 className="text-[10px] font-black uppercase tracking-[0.22em] text-neutral-500">Timeline</h2>
                <ol className="mt-2 space-y-2">
                  {events.map((e: any) => (
                    <li key={e.id} className="border-l-2 pl-2.5" style={{ borderColor: "#FFB300" }}>
                      <p className="text-[9px] font-black uppercase tracking-wider text-neutral-500">
                        {new Date(e.created_at).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })} · {e.event_kind.replace(/_/g, " ")}
                      </p>
                      {e.renderable_summary && (
                        <p className="text-[11.5px] text-neutral-800">{e.renderable_summary}</p>
                      )}
                    </li>
                  ))}
                </ol>
              </section>
            )}

            {/* Placeholders for next-sprint plugins */}
            <section className="rounded-2xl border-2 border-dashed p-4" style={{ borderColor: "rgba(139,69,19,0.20)" }}>
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-neutral-500">Coming soon</p>
              <ul className="mt-2 space-y-1 text-[11px] text-neutral-600">
                <li>· Nearby merchants + trades</li>
                <li>· Ask AI about this job</li>
                <li>· Related videos</li>
                <li>· Weather + pour window</li>
                <li>· Photos + progress</li>
                <li>· AI Job Journal</li>
                <li>· Downloadable ZIP</li>
              </ul>
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
}

function StatChip({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="rounded-xl border-2 bg-white p-3" style={{ borderColor: "rgba(0,0,0,0.08)" }}>
      <p className="inline-flex items-center gap-1 text-[9.5px] font-black uppercase tracking-wider text-neutral-500">
        {icon} {label}
      </p>
      <p className="mt-0.5 text-[14px] font-black text-neutral-900 tabular-nums">{value}</p>
    </div>
  );
}
