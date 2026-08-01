// /admin/nex/authoring — Paste knowledge · auto-check · goes live · review later.
//
// Live counts + review inbox rendered server-side.
// Interactive paste / edit / approve UI is the AuthoringClient component.

import { listAllSections, computeDashboardStats } from "@/lib/nex/authoring/reader";
import { getIndexStats } from "@/lib/nex/staircase-advisor/truth-index";
import { loadTopGaps } from "@/lib/nex/authoring/gaps";
import { computeKnowledgeHealth } from "@/lib/nex/authoring/health";
import { computeCoverageReport } from "@/lib/nex/authoring/coverage";
import Link from "next/link";
import { AuthoringClient } from "./AuthoringClient";
import { AuthorModeClient } from "./AuthorModeClient";
import { InboxActionsWirer } from "./InboxActions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Nex — Authoring" };

export default async function NexAuthoringPage() {
  const stats = computeDashboardStats();
  const allSections = listAllSections();

  // Advisor-index stats (how many Nex is actually indexing right now)
  let indexStats: { approved_files: number; total_snippets: number; built_at: string } | null = null;
  try {
    indexStats = getIndexStats();
  } catch {
    indexStats = null;
  }

  // Review inbox · unreviewed sections sorted newest-first (later: sort by traffic)
  const inbox = allSections
    .filter((s) => s.status === "unreviewed")
    .sort((a, b) => (b.auto_published_at ?? "").localeCompare(a.auto_published_at ?? ""))
    .slice(0, 20);

  const blocked = allSections.filter((s) => s.status === "blocked").slice(0, 10);

  // Customer questions that fell through to composer · what to author next
  let gaps: Awaited<ReturnType<typeof loadTopGaps>> = [];
  try {
    gaps = await loadTopGaps(15, 30);
  } catch {
    gaps = [];
  }

  // Knowledge health · one-glance state of the Brain
  const health = computeKnowledgeHealth();
  const coverage = computeCoverageReport();

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <InboxActionsWirer />
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black">Nex · Authoring</h1>
          <p className="text-[13px] text-neutral-600">
            Paste knowledge · auto-check · goes live · review when you have time.
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/admin/nex"
            className="rounded-full border border-neutral-300 px-3 py-1.5 text-[11px] font-black text-neutral-700 hover:bg-neutral-50"
          >
            ← Observatory
          </Link>
          <Link
            href="/admin/nex/knowledge"
            className="rounded-full border border-neutral-300 px-3 py-1.5 text-[11px] font-black text-neutral-700 hover:bg-neutral-50"
          >
            Knowledge
          </Link>
        </div>
      </div>

      {/* ═══ STATS ═══ */}
      <section className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Live on Nex" value={indexStats?.total_snippets ?? 0} sub={`${indexStats?.approved_files ?? 0} files indexed`} color="green" />
        <StatCard label="Approved sections" value={stats.approved} sub={stats.total_files ? `${Math.round((stats.approved / (stats.approved + stats.unreviewed || 1)) * 100)}% of authored` : "0%"} color="green" />
        <StatCard label="Unreviewed inbox" value={stats.unreviewed} sub="waiting for you" color="amber" />
        <StatCard label="Blocked (not live)" value={stats.blocked} sub="need edit before live" color="red" />
      </section>

      {/* ═══ AUTHOR MODE · primary surface for Philip ═══ */}
      <AuthorModeClient />

      {/* ═══ KNOWLEDGE HEALTH DASHBOARD (Philip 2026-08-01) ═══ */}
      <section className="mt-6 rounded-2xl border bg-white p-5 shadow-sm">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-[11px] font-black uppercase tracking-[0.14em] text-neutral-500">
            Knowledge health · state of the Brain
          </h2>
          <span className="text-[10px] text-neutral-400">generated live · per request</span>
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <HealthCell label="Total files" value={health.total_files} />
          <HealthCell label="Indexed by Advisor" value={health.indexed_files} color="green" />
          <HealthCell label="Correctly excluded" value={health.excluded_files} color="neutral" />
          <HealthCell label="Candidates waiting" value={health.candidate_files} color={health.candidate_files > 0 ? "amber" : "green"} />
          <HealthCell label="Total sections" value={health.indexed_sections} color="green" />
          <HealthCell label="Empty sections (<100 chars)" value={health.empty_sections} color={health.empty_sections > 0 ? "amber" : "green"} />
          <HealthCell label="Semantic index" value={health.semantic_ready ? health.semantic_snippet_count : 0} color={health.semantic_ready ? "green" : "red"} sub={health.semantic_ready ? "ready" : "needs OPENAI_API_KEY + rebuild"} />
          <HealthCell label="Wider corpus (Runtime Core)" value={health.runtime_core_files} color="neutral" />
        </div>

        {/* Line coverage */}
        <div className="mt-4 grid grid-cols-1 gap-2 md:grid-cols-3">
          <div className="rounded-xl border border-neutral-200 p-3">
            <p className="text-[10px] font-black uppercase tracking-wider text-neutral-500">Line coverage</p>
            <p className="mt-1 text-[13px] text-neutral-800">
              <span className="font-black">{health.indexed_lines.toLocaleString()}</span> of {health.total_lines.toLocaleString()} lines indexed
              <span className="text-neutral-500"> ({Math.round(health.indexed_lines / Math.max(1, health.total_lines) * 100)}%)</span>
            </p>
          </div>
          <div className="rounded-xl border border-neutral-200 p-3">
            <p className="text-[10px] font-black uppercase tracking-wider text-neutral-500">File coverage</p>
            <p className="mt-1 text-[13px] text-neutral-800">
              <span className="font-black">{health.indexed_files}</span> of {health.total_files} files
              <span className="text-neutral-500"> ({Math.round(health.indexed_files / Math.max(1, health.total_files) * 100)}%)</span>
            </p>
          </div>
          <div className="rounded-xl border border-neutral-200 p-3">
            <p className="text-[10px] font-black uppercase tracking-wider text-neutral-500">Semantic status</p>
            <p className="mt-1 text-[13px] text-neutral-800">
              {health.semantic_ready
                ? <>Ready · <span className="font-black">{health.semantic_snippet_count}</span> vectors cached</>
                : <span className="text-red-800">Not built · add OPENAI_API_KEY and POST to <code className="rounded bg-neutral-100 px-1">/api/admin/nex/authoring/embed-brain</code></span>}
            </p>
          </div>
        </div>

        {health.candidate_files > 0 && (
          <details className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-3">
            <summary className="cursor-pointer text-[11px] font-black uppercase tracking-wider text-amber-900">
              ⚠ {health.candidate_files} candidate files waiting for indexing decision
            </summary>
            <ul className="mt-2 space-y-1 font-mono text-[11px] text-neutral-700">
              {health.candidates.map((c, i) => (
                <li key={i}>• {c}</li>
              ))}
            </ul>
          </details>
        )}
      </section>

      {/* ═══ COVERAGE REPORT (Philip 2026-08-01) ═══ */}
      <section className="mt-6 rounded-2xl border bg-white p-5 shadow-sm">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-[11px] font-black uppercase tracking-[0.14em] text-neutral-500">
            Coverage report · knowledge depth by topic
          </h2>
          <span className="text-[10px] text-neutral-400">
            {coverage.strongest ? `strongest: ${coverage.strongest.topic} (${coverage.strongest.count} sections)` : "no coverage yet"}
          </span>
        </div>
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-3">
          {coverage.entries.map((e) => (
            <div key={e.topic} className="flex items-center justify-between rounded-xl border border-neutral-200 p-2.5">
              <span className="text-[12px] text-neutral-800">{e.topic}</span>
              <span className={`font-black tracking-widest ${e.stars === 0 ? "text-neutral-300" : e.stars <= 2 ? "text-red-600" : e.stars === 3 ? "text-amber-600" : "text-green-700"}`}>
                {"★".repeat(e.stars)}{"☆".repeat(5 - e.stars)}
                <span className="ml-2 text-[10px] font-normal text-neutral-400">
                  ({e.section_count})
                </span>
              </span>
            </div>
          ))}
        </div>

        {coverage.thinnest.length > 0 && (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50/50 p-3">
            <p className="text-[10px] font-black uppercase tracking-wider text-red-800">
              Thinnest coverage · topics Philip could author next
            </p>
            <p className="mt-1 text-[12px] text-neutral-700">
              {coverage.thinnest.map((t) => t.topic).join(" · ")}
            </p>
          </div>
        )}
      </section>

      {/* ═══ REVIEW MODE · legacy paste + parse + approve (for other contributors) ═══ */}
      <details className="mt-6 rounded-2xl border bg-neutral-50 p-4">
        <summary className="cursor-pointer text-[11px] font-black uppercase tracking-wider text-neutral-500">
          Review Mode · manual parse + section-by-section approval (for other contributors)
        </summary>
        <div className="mt-4">
          <AuthoringClient />
        </div>
      </details>

      {/* ═══ REVIEW INBOX ═══ */}
      <section className="mt-8 rounded-2xl border bg-white p-5 shadow-sm">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-[11px] font-black uppercase tracking-[0.14em] text-neutral-500">
            Review inbox · unreviewed sections
          </h2>
          <span className="text-[11px] font-black text-neutral-600">{stats.unreviewed} total</span>
        </div>

        {inbox.length === 0 ? (
          <p className="py-6 text-center text-[12px] text-neutral-400">
            Nothing to review · every section is either approved, in edit, or blocked.
          </p>
        ) : (
          <ul className="space-y-3">
            {inbox.map((s) => (
              <li key={`${s.file_slug}::${s.section_id}`} className="rounded-xl border border-neutral-200 p-3">
                <div className="flex items-baseline justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-black uppercase text-amber-900">Unreviewed</span>
                      <span className="text-[11px] font-black text-neutral-500">{s.file_title}</span>
                    </div>
                    <p className="mt-1 text-[13px] font-black text-neutral-900">{s.heading}</p>
                    <p className="mt-1 text-[12px] text-neutral-600">{s.preview}…</p>
                    {s.issues.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {s.issues.slice(0, 4).map((i, ix) => (
                          <span
                            key={ix}
                            className={
                              i.severity === "block"
                                ? "rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-black text-red-800"
                                : i.severity === "warn"
                                  ? "rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-black text-amber-900"
                                  : "rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-black text-neutral-700"
                            }
                          >
                            {i.message.length > 45 ? i.message.slice(0, 45) + "…" : i.message}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <SectionActions fileSlug={s.file_slug} sectionId={s.section_id} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ═══ CUSTOMER GAPS ═══ */}
      <section className="mt-8 rounded-2xl border bg-white p-5 shadow-sm">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-[11px] font-black uppercase tracking-[0.14em] text-neutral-500">
            Customer gaps · questions Nex couldn't answer from her library
          </h2>
          <span className="text-[11px] font-black text-neutral-600">
            {gaps.length === 0 ? "no gaps yet" : `top ${gaps.length} · last 30 days`}
          </span>
        </div>
        <p className="mb-3 text-[11px] text-neutral-500">
          These are real customer questions where Advisor and Runtime Core both missed. Author content that covers these to shrink the LLM fallback.
        </p>
        {gaps.length === 0 ? (
          <p className="py-6 text-center text-[12px] text-neutral-400">
            No gaps recorded yet · either Nex has good coverage or no customer traffic has hit composer path.
          </p>
        ) : (
          <ul className="space-y-2">
            {gaps.map((g, i) => {
              const suggestedTopic = suggestTopicFromGap(g.message);
              return (
                <li key={i} className="rounded-xl border border-neutral-200 p-3">
                  <div className="flex items-baseline justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="rounded-full bg-neutral-900 px-2 py-0.5 text-[10px] font-black uppercase text-white">
                          {g.count} asked
                        </span>
                        <span className="text-[11px] text-neutral-500">
                          last seen {new Date(g.last_seen_at).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="mt-1 text-[13px] text-neutral-900">"{g.message}"</p>
                    </div>
                    <button
                      type="button"
                      className="shrink-0 rounded-full bg-neutral-900 px-3 py-1.5 text-[11px] font-black text-white hover:bg-neutral-800"
                      data-gap-author="1"
                      data-gap-topic={suggestedTopic}
                      data-gap-heading={g.message}
                    >
                      Author for this →
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* ═══ BLOCKED ═══ */}
      {blocked.length > 0 && (
        <section className="mt-6 rounded-2xl border border-red-200 bg-red-50/40 p-5">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="text-[11px] font-black uppercase tracking-[0.14em] text-red-800">
              Blocked · not live · resolve to publish
            </h2>
            <span className="text-[11px] font-black text-red-800">{blocked.length}</span>
          </div>
          <ul className="space-y-2">
            {blocked.map((s) => (
              <li key={`${s.file_slug}::${s.section_id}`} className="rounded-xl border border-red-200 bg-white p-3">
                <div className="flex items-baseline justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-black uppercase text-red-800">Blocked</span>
                      <span className="text-[11px] font-black text-neutral-500">{s.file_title}</span>
                    </div>
                    <p className="mt-1 text-[13px] font-black text-neutral-900">{s.heading}</p>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {s.issues.filter((i) => i.severity === "block").map((i, ix) => (
                        <span key={ix} className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-black text-red-800">
                          {i.message}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

// Convert a raw customer question into a suggested topic name for authoring.
// Strips question words · capitalises · trims to ~60 chars.
function suggestTopicFromGap(message: string): string {
  let t = message.toLowerCase()
    .replace(/^(what|how|when|why|who|which|can|is|are|do|does|should|could|would)\s+(is|are|do|does|can|should|about|the|a)?\s*/i, "")
    .replace(/[?!.]+$/, "")
    .trim();
  if (t.length > 60) t = t.slice(0, 57) + "...";
  return t.charAt(0).toUpperCase() + t.slice(1);
}

function HealthCell({ label, value, color, sub }: {
  label: string; value: number; color?: "green" | "amber" | "red" | "neutral"; sub?: string;
}) {
  const cls =
    color === "green"  ? "text-green-800"  :
    color === "amber"  ? "text-amber-900"  :
    color === "red"    ? "text-red-800"    :
                         "text-neutral-800";
  return (
    <div className="rounded-xl border bg-neutral-50 p-3">
      <p className="text-[10px] font-black uppercase tracking-wider text-neutral-500">{label}</p>
      <p className={`mt-1 text-xl font-black ${cls}`}>{value.toLocaleString()}</p>
      {sub && <p className="mt-0.5 text-[10px] text-neutral-500">{sub}</p>}
    </div>
  );
}

function StatCard({ label, value, sub, color }: {
  label: string; value: number; sub: string; color: "green" | "amber" | "red" | "neutral";
}) {
  const chipCls =
    color === "green"  ? "text-green-800"  :
    color === "amber"  ? "text-amber-900"  :
    color === "red"    ? "text-red-800"    :
                         "text-neutral-700";
  return (
    <div className="rounded-2xl border bg-white p-4 shadow-sm">
      <p className="text-[10.5px] font-black uppercase tracking-wider text-neutral-500">{label}</p>
      <p className={`mt-1 text-2xl font-black ${chipCls}`}>{value.toLocaleString()}</p>
      <p className="mt-0.5 text-[11px] text-neutral-500">{sub}</p>
    </div>
  );
}

function SectionActions({ fileSlug, sectionId }: { fileSlug: string; sectionId: string }) {
  return (
    <form className="flex shrink-0 gap-1.5">
      <ActionButton fileSlug={fileSlug} sectionId={sectionId} action="approve" label="Approve" tone="primary" />
      <ActionButton fileSlug={fileSlug} sectionId={sectionId} action="needs_edit" label="Flag" tone="neutral" />
      <ActionButton fileSlug={fileSlug} sectionId={sectionId} action="reject" label="Reject" tone="danger" />
    </form>
  );
}

function ActionButton({ fileSlug, sectionId, action, label, tone }: {
  fileSlug: string; sectionId: string; action: string; label: string; tone: "primary" | "neutral" | "danger";
}) {
  const cls =
    tone === "primary" ? "rounded-full bg-neutral-900 px-3 py-1.5 text-[11px] font-black text-white hover:bg-neutral-800"
    : tone === "danger"  ? "rounded-full border border-red-300 px-3 py-1.5 text-[11px] font-black text-red-700 hover:bg-red-50"
                         : "rounded-full border border-neutral-300 px-3 py-1.5 text-[11px] font-black text-neutral-700 hover:bg-neutral-50";
  return (
    <button
      type="button"
      className={cls}
      data-authoring-action={action}
      data-file-slug={fileSlug}
      data-section-id={sectionId}
    >
      {label}
    </button>
  );
}
