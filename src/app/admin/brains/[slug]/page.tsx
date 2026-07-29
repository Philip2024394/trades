// /admin/brains/[slug] — Brain Control Centre
//
// Server component. Renders the top summary block + capability badges
// + 12 sections Philip specified. Data comes from
// /api/admin/brains/[slug]/detail in a single request.
//
// Uses native <details>/<summary> for tabbed navigation — no client
// JS required, mobile-friendly, keyboard-accessible.

import Link from "next/link";
import { headers } from "next/headers";
import { LoggedInUser } from "@/components/nex/LoggedInUser";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type DetailBundle = {
  ok: boolean;
  error?: string;
  brain?: {
    slug: string;
    namespace: string;
    display_name: string;
    description: string | null;
    category: string;
    trade: string | null;
    status: string;
    lifecycle_stage: string;
    certification_level: string;
    primary_country: string | null;
    primary_language: string;
    supported_countries: string[];
    languages: string[];
    maintainers: string[];
    capabilities: Record<string, boolean>;
    quality_score: number | null;
    coverage: number | null;
    confidence: number | null;
    last_review_at: string | null;
    review_frequency_days: number;
    package_id: string | null;
    installed_from_source: string | null;
    exportable: boolean;
    updated_at: string;
    readiness_score_json: { knowledge: number; coverage: number; testing: number; author_review: number; freshness: number; confidence: number; overall: number } | null;
    // Constitutional Identity (Philip 2026-07-28 HARD LAW)
    mission: string | null;
    principles: string[];
    promise: { will_do: string[]; will_not_do: string[] };
  };
  current_version?: {
    id: string; version_semver: string; brain_api_version: string;
    minimum_runtime_version: string; current_runtime_version: string | null;
    published_at: string | null; authored_by: string;
    package_checksum: string | null; package_signature: string | null;
    package_public_key_ref: string | null; portable: boolean;
    imported_from_package_id: string | null;
  } | null;
  versions?: Array<{ id: string; version_semver: string; authored_by: string; authored_at: string; published_at: string | null; retired_at: string | null }>;
  dependencies?: Array<{ id: string; child_brain_slug: string; relationship: string; min_child_semver: string | null; added_at: string }>;
  certifications?: Array<{ id: string; author_name: string; credentials_text: string; years_experience: number | null; certified_by: string | null; certified_at: string; expires_at: string | null; is_primary: boolean; status: string }>;
  review_actions?: Array<{ id: string; action: string; reviewer_id: string; reviewer_role: string; notes: string | null; occurred_at: string }>;
  recent_feedback?: Array<{ id: string; query_text: string; answer_kind: string; confidence: number; answered_at: string }>;
  unknown_queue?: Array<{ id: string; query_text: string; confidence: number; answered_at: string }>;
  audit_timeline?: Array<{ id: string; event_type: string; actor_id: string | null; actor_role: string | null; occurred_at: string; metadata: unknown }>;
  counts?: { answers_total: number; drafts_total: number; versions_total: number; dependencies_total: number; certifications_active: number };
  readiness?: {
    overall: number;
    axes: {
      knowledge_coverage: number; expert_certification: number; review_status: number;
      test_pass_rate: number | null; feedback_quality: number | null;
      runtime_health: number; dependency_health: number; freshness: number;
      explainability_coverage: number | null;
      factors: {
        v1_modules_authored: number; v1_modules_expected: number;
        active_primary_cert: boolean; days_since_review: number | null;
        review_frequency_days: number; days_since_last_version: number | null;
        answers_considered: number; answers_high_confidence: number;
        answers_with_evidence: number; unknown_questions: number;
        dependency_total: number; dependency_healthy: number;
        runtime_compatible: string;
      };
    };
  };
  // Phase 2 observability payloads
  maturity?: {
    current_level: number; current_level_name: string;
    next_level: number | null; next_level_name: string | null;
    requirements_for_next: Array<{ key: string; description: string; met: boolean; detail: string }> | null;
    reason_for_current_level: string;
    deferred_levels: Array<{ level: number; name: string; note: string }>;
  };
  maturity_catalogue?: Array<{
    level: number; name: string; status: "locked" | "tbd";
    requirements: Array<{ key: string; description: string; met: boolean; detail: string }> | null;
  }>;
  trust?: {
    headline: string;
    raisers: Array<{ key: string; label: string; direction: string; contribution: string; note: string; data_available: boolean }>;
    reducers: Array<{ key: string; label: string; direction: string; contribution: string; note: string; data_available: boolean }>;
    what_raises_it_next: string;
    score: number | null;
    band: "excellent" | "good" | "developing" | "insufficient_data";
    data_completeness: number;
  };
  coverage?: {
    overall_pct: number;
    authored_expected: number;
    expected_total: number;
    modules: Array<{
      module: string; is_expected: boolean; is_authored: boolean;
      coverage_pct: number; status: "excellent" | "good" | "developing" | "empty" | "missing";
      content_entries: number | null;
    }>;
  };
  improvement_queue?: {
    question_answered: string;
    items: Array<{
      rank: number; title: string; why: string; action: string;
      effort: string; potential_impact: string; signal_strength: string; source: string;
    }>;
  };
};

async function fetchBundle(slug: string): Promise<DetailBundle> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3008";
  const proto = h.get("x-forwarded-proto") ?? "http";
  const res = await fetch(`${proto}://${host}/api/admin/brains/${slug}/detail`, { cache: "no-store" });
  return (await res.json()) as DetailBundle;
}

export default async function BrainControlCentrePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const b = await fetchBundle(slug);

  if (!b.ok || !b.brain) {
    return (
      <div className="p-8 font-sans text-neutral-900" style={{ color: "#171717" }}>
        <Link href="/admin/brains" className="text-sm text-neutral-500 hover:text-neutral-900">← All brains</Link>
        <h1 className="text-2xl font-semibold mt-4 mb-2">Brain not found</h1>
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-amber-900">
          {b.error === "brain_not_found" ? `No brain exists with slug '${slug}'.`
            : b.error === "supabase_unavailable" ? "Supabase unavailable · apply migrations + set service key."
            : `Failed to load brain: ${b.error ?? "unknown"}`}
        </div>
      </div>
    );
  }

  const brain = b.brain;
  const ready = b.readiness?.overall ?? 0;
  const readyBand =
    ready >= 90 ? { label: "Production Ready", color: "bg-green-100 text-green-800 border-green-300", dot: "🟢" } :
    ready >= 70 ? { label: "Nearly Ready", color: "bg-blue-100 text-blue-800 border-blue-300", dot: "🔵" } :
    ready >= 40 ? { label: "Under Development", color: "bg-amber-100 text-amber-800 border-amber-300", dot: "🟠" } :
                  { label: "Not Ready", color: "bg-neutral-100 text-neutral-700 border-neutral-300", dot: "⚪" };

  return (
    <div className="min-h-screen bg-neutral-50 font-sans text-sm text-neutral-900" style={{ color: "#171717" }}>
      <div className="sticky top-0 z-10 bg-white border-b border-neutral-200 px-6 py-3">
        <div className="flex items-center justify-between">
          <Link href="/admin/brains" className="text-xs text-neutral-500 hover:text-neutral-900">← All brains</Link>
          <LoggedInUser />
        </div>
        <div className="flex items-start justify-between gap-6 mt-2">
          <div>
            <h1 className="text-xl font-semibold flex items-center gap-2">
              <span>{readyBand.dot}</span>
              <span>{brain.display_name}</span>
              <span className="text-xs text-neutral-400 font-mono ml-2">{brain.namespace}</span>
            </h1>
            {brain.description && <p className="text-xs text-neutral-600 mt-1 max-w-2xl">{brain.description}</p>}
          </div>
          <span className={`text-xs px-3 py-1 rounded-md border font-medium ${readyBand.color}`}>
            {readyBand.label} · {ready}%
          </span>
        </div>
      </div>

      <div className="p-6 max-w-[1400px] mx-auto space-y-6">
        <IdentityPanel brain={brain} />
        <TopSummary brain={brain} bundle={b} readyPct={ready} />
        <CapabilityBadges caps={brain.capabilities} />

        {b.trust && (
          <Section title={`Trust Dashboard · ${b.trust.headline}`} defaultOpen>
            <TrustDashboardSection trust={b.trust} />
          </Section>
        )}
        {b.maturity && b.maturity_catalogue && (
          <Section title={`Maturity Ladder · Level ${b.maturity.current_level} · ${b.maturity.current_level_name}`} defaultOpen>
            <MaturityLadderSection maturity={b.maturity} catalogue={b.maturity_catalogue} />
          </Section>
        )}
        {b.improvement_queue && (
          <Section title={`Improvement Queue · ${b.improvement_queue.items.length} action${b.improvement_queue.items.length === 1 ? "" : "s"}`} defaultOpen>
            <ImprovementQueueSection queue={b.improvement_queue} />
          </Section>
        )}
        {b.coverage && (
          <Section title={`Coverage Map · ${b.coverage.authored_expected}/${b.coverage.expected_total} expected modules · ${b.coverage.overall_pct}% avg`}>
            <CoverageMapSection coverage={b.coverage} />
          </Section>
        )}

        <Section title="Overview">
          <OverviewSection brain={brain} counts={b.counts} />
        </Section>
        <Section title="Readiness (auto-computed · 9 axes)">
          <ReadinessSection readiness={b.readiness} />
        </Section>
        <Section title={`Versions (${b.counts?.versions_total ?? 0})`}>
          <VersionsSection versions={b.versions ?? []} currentId={b.current_version?.id ?? null} />
        </Section>
        <Section title={`Certifications (${b.counts?.certifications_active ?? 0} active)`}>
          <CertificationsSection certs={b.certifications ?? []} />
        </Section>
        <Section title={`Dependencies (${b.counts?.dependencies_total ?? 0})`}>
          <DependenciesSection deps={b.dependencies ?? []} />
        </Section>
        <Section title={`Drafts (${b.counts?.drafts_total ?? 0})`} defaultOpen>
          <div className="flex items-center justify-between">
            <div className="text-xs text-neutral-600">
              Author, edit, submit, review, publish and roll back versions in the Draft Workspace.
            </div>
            <Link href={`/admin/brains/${brain.slug}/drafts`}
              className="text-xs bg-neutral-900 text-white px-3 py-1.5 rounded hover:bg-neutral-700">
              Open Draft Workspace →
            </Link>
          </div>
        </Section>
        <Section title="Review Queue">
          <ReviewQueueSection actions={b.review_actions ?? []} />
        </Section>
        <Section title={`Feedback (last 20 answers · ${b.unknown_queue?.length ?? 0} unknown queued)`}>
          <FeedbackSection recent={b.recent_feedback ?? []} unknown={b.unknown_queue ?? []} />
        </Section>
        <Section title="Explainability">
          <ExplainabilitySection readiness={b.readiness} />
        </Section>
        <Section title="Package Export / Import">
          <PackageSection brain={brain} currentVersion={b.current_version} />
        </Section>
        <Section title="Runtime Health">
          <RuntimeHealthSection currentVersion={b.current_version} readiness={b.readiness} />
        </Section>
        <Section title="Audit Timeline">
          <AuditTimelineSection events={b.audit_timeline ?? []} />
        </Section>
      </div>
    </div>
  );
}

// ---------- Reusable pieces ----------

function IdentityPanel({ brain }: { brain: NonNullable<DetailBundle["brain"]> }) {
  const missing = !brain.mission || brain.principles.length === 0 || brain.promise.will_do.length === 0;
  return (
    <div className={`rounded-xl border p-5 ${missing ? "border-amber-300 bg-amber-50/40" : "border-neutral-200 bg-white"}`}>
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="text-xs uppercase tracking-wide text-neutral-500">Constitutional Identity</div>
          <div className="text-sm text-neutral-600">Mission · Principles · Promise · Philip 2026-07-28 HARD LAW</div>
        </div>
        {missing && (
          <span className="text-[11px] px-2 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300 font-medium">
            Required before lifecycle_stage = production
          </span>
        )}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div>
          <div className="text-xs uppercase tracking-wide text-neutral-500 mb-1">Mission</div>
          {brain.mission ? (
            <p className="text-sm text-neutral-900 leading-relaxed">{brain.mission}</p>
          ) : (
            <p className="text-xs text-neutral-500 italic">Not set. PATCH /api/admin/brains/{brain.slug}/identity {`{ mission }`}.</p>
          )}
        </div>
        <div>
          <div className="text-xs uppercase tracking-wide text-neutral-500 mb-1">Principles ({brain.principles.length})</div>
          {brain.principles.length > 0 ? (
            <ul className="text-sm text-neutral-900 space-y-1 list-disc pl-4">
              {brain.principles.map((p, i) => <li key={i}>{p}</li>)}
            </ul>
          ) : (
            <p className="text-xs text-neutral-500 italic">Not set. PATCH /identity {`{ principles: [...] }`}.</p>
          )}
        </div>
        <div>
          <div className="text-xs uppercase tracking-wide text-neutral-500 mb-1">Promise</div>
          {(brain.promise.will_do.length + brain.promise.will_not_do.length) > 0 ? (
            <>
              {brain.promise.will_do.length > 0 && (
                <>
                  <div className="text-[11px] text-neutral-500 mt-1">This brain will:</div>
                  <ul className="text-sm text-neutral-900 space-y-0.5">
                    {brain.promise.will_do.map((p, i) => <li key={i}>✓ {p}</li>)}
                  </ul>
                </>
              )}
              {brain.promise.will_not_do.length > 0 && (
                <>
                  <div className="text-[11px] text-neutral-500 mt-2">This brain will not:</div>
                  <ul className="text-sm text-neutral-900 space-y-0.5">
                    {brain.promise.will_not_do.map((p, i) => <li key={i}>✗ {p}</li>)}
                  </ul>
                </>
              )}
            </>
          ) : (
            <p className="text-xs text-neutral-500 italic">Not set. PATCH /identity {`{ promise: { will_do, will_not_do } }`}.</p>
          )}
        </div>
      </div>
    </div>
  );
}

function Section({ title, defaultOpen = false, children }: { title: string; defaultOpen?: boolean; children: React.ReactNode }) {
  return (
    <details className="rounded-xl border border-neutral-200 bg-white overflow-hidden" open={defaultOpen}>
      <summary className="px-5 py-3 font-medium cursor-pointer select-none hover:bg-neutral-50 flex items-center justify-between">
        <span>{title}</span>
        <span className="text-xs text-neutral-400">▼</span>
      </summary>
      <div className="p-5 border-t border-neutral-100">{children}</div>
    </details>
  );
}

function KV({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <>
      <span className="text-neutral-500">{k}</span>
      <span className="text-neutral-900 font-medium">{v}</span>
    </>
  );
}

function TopSummary({ brain, bundle, readyPct }: { brain: NonNullable<DetailBundle["brain"]>; bundle: DetailBundle; readyPct: number }) {
  const primary_cert = bundle.certifications?.find((c) => c.is_primary && c.status === "active");
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-5 grid grid-cols-1 md:grid-cols-3 gap-6">
      <div>
        <div className="text-xs uppercase tracking-wide text-neutral-500 mb-1">Ready Score</div>
        <div className="text-4xl font-semibold">{readyPct}%</div>
        <div className="text-xs text-neutral-500 mt-1">Status: <span className="text-neutral-800">{brain.status}</span> · Lifecycle: <span className="text-neutral-800">{brain.lifecycle_stage}</span></div>
      </div>
      <div className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1 text-xs">
        <KV k="Current Version" v={bundle.current_version?.version_semver ?? "—"} />
        <KV k="Certified Author" v={primary_cert ? primary_cert.author_name : <span className="text-amber-700">Uncertified</span>} />
        {primary_cert && <KV k="Credentials" v={primary_cert.credentials_text} />}
        <KV k="Certification Level" v={brain.certification_level.replace(/_/g, " ")} />
        <KV k="Last Review" v={brain.last_review_at ? new Date(brain.last_review_at).toLocaleDateString() : "Never"} />
      </div>
      <div className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1 text-xs">
        <KV k="Primary Country" v={brain.primary_country ?? "—"} />
        <KV k="Primary Language" v={brain.primary_language} />
        <KV k="Supported Countries" v={brain.supported_countries.join(", ") || "—"} />
        <KV k="Category" v={brain.category} />
        <KV k="Trade" v={brain.trade ?? "—"} />
      </div>
    </div>
  );
}

function CapabilityBadges({ caps }: { caps: Record<string, boolean> }) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4 flex flex-wrap gap-2">
      <span className="text-xs uppercase tracking-wide text-neutral-500 w-full mb-1">Capabilities</span>
      {Object.entries(caps).map(([k, v]) => (
        <span key={k} className={`text-xs px-3 py-1 rounded-md border ${v ? "bg-green-50 text-green-800 border-green-300 font-medium" : "bg-neutral-50 text-neutral-500 border-neutral-200 line-through"}`}>
          {k.replace(/^supports_/, "").replace(/^./, (c) => c.toUpperCase())}
        </span>
      ))}
    </div>
  );
}

function OverviewSection({ brain, counts }: { brain: NonNullable<DetailBundle["brain"]>; counts: DetailBundle["counts"] }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
      <div><div className="text-neutral-500">Answers served</div><div className="text-lg font-medium">{(counts?.answers_total ?? 0).toLocaleString()}</div></div>
      <div><div className="text-neutral-500">Draft workspaces</div><div className="text-lg font-medium">{counts?.drafts_total ?? 0}</div></div>
      <div><div className="text-neutral-500">Versions in history</div><div className="text-lg font-medium">{counts?.versions_total ?? 0}</div></div>
      <div><div className="text-neutral-500">Active dependencies</div><div className="text-lg font-medium">{counts?.dependencies_total ?? 0}</div></div>
      <div className="col-span-full pt-2 border-t border-neutral-100 text-neutral-500">
        Last updated: {new Date(brain.updated_at).toLocaleString()} · Slug: <code className="text-neutral-800">{brain.slug}</code>
      </div>
    </div>
  );
}

function ReadinessSection({ readiness }: { readiness: DetailBundle["readiness"] }) {
  if (!readiness) return <div className="text-neutral-500 text-xs">Readiness not computed yet.</div>;
  const axes = [
    ["Knowledge Coverage",      readiness.axes.knowledge_coverage],
    ["Expert Certification",    readiness.axes.expert_certification],
    ["Review Status",           readiness.axes.review_status],
    ["Test Pass Rate",          readiness.axes.test_pass_rate],
    ["Feedback Quality",        readiness.axes.feedback_quality],
    ["Runtime Health",          readiness.axes.runtime_health],
    ["Dependency Health",       readiness.axes.dependency_health],
    ["Freshness",               readiness.axes.freshness],
    ["Explainability Coverage", readiness.axes.explainability_coverage],
  ] as const;
  return (
    <div className="space-y-2">
      {axes.map(([label, v]) => (
        <div key={label} className="grid grid-cols-[220px_1fr_60px] items-center gap-3 text-xs">
          <span className="text-neutral-500">{label}</span>
          <div className="h-2 rounded bg-neutral-100 overflow-hidden">
            <div className={`h-full ${(v ?? 0) >= 90 ? "bg-green-500" : (v ?? 0) >= 70 ? "bg-blue-500" : (v ?? 0) >= 40 ? "bg-amber-500" : "bg-neutral-300"}`} style={{ width: `${v ?? 0}%` }} />
          </div>
          <span className="font-medium text-right">{v == null ? "—" : `${v}%`}</span>
        </div>
      ))}
      <div className="mt-3 pt-3 border-t border-neutral-100 grid grid-cols-2 gap-x-6 gap-y-1 text-xs text-neutral-500">
        <div>V1 modules: <span className="text-neutral-800">{readiness.axes.factors.v1_modules_authored}/{readiness.axes.factors.v1_modules_expected}</span></div>
        <div>Days since review: <span className="text-neutral-800">{readiness.axes.factors.days_since_review ?? "never"}</span></div>
        <div>Days since version: <span className="text-neutral-800">{readiness.axes.factors.days_since_last_version ?? "never"}</span></div>
        <div>Runtime compat: <span className="text-neutral-800">{readiness.axes.factors.runtime_compatible}</span></div>
        <div>Answers considered: <span className="text-neutral-800">{readiness.axes.factors.answers_considered}</span></div>
        <div>High-confidence: <span className="text-neutral-800">{readiness.axes.factors.answers_high_confidence}</span></div>
        <div>With evidence: <span className="text-neutral-800">{readiness.axes.factors.answers_with_evidence}</span></div>
        <div>Unknown queued: <span className="text-neutral-800">{readiness.axes.factors.unknown_questions}</span></div>
      </div>
    </div>
  );
}

function VersionsSection({ versions, currentId }: { versions: NonNullable<DetailBundle["versions"]>; currentId: string | null }) {
  if (versions.length === 0) return <div className="text-neutral-500 text-xs">No versions published yet.</div>;
  return (
    <table className="w-full text-xs">
      <thead className="text-neutral-500 border-b border-neutral-100"><tr><th className="text-left py-1">Version</th><th className="text-left">Authored by</th><th className="text-left">Authored</th><th className="text-left">Published</th><th className="text-left">Status</th></tr></thead>
      <tbody>
        {versions.map((v) => (
          <tr key={v.id} className={`border-b border-neutral-100 ${v.id === currentId ? "bg-green-50/50" : ""}`}>
            <td className="py-2 font-mono">{v.version_semver}{v.id === currentId && <span className="ml-2 text-green-700 text-[10px] font-medium">CURRENT</span>}</td>
            <td>{v.authored_by}</td>
            <td>{new Date(v.authored_at).toLocaleDateString()}</td>
            <td>{v.published_at ? new Date(v.published_at).toLocaleDateString() : <span className="text-neutral-400">draft</span>}</td>
            <td>{v.retired_at ? <span className="text-neutral-400">retired</span> : <span className="text-green-700">live</span>}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function CertificationsSection({ certs }: { certs: NonNullable<DetailBundle["certifications"]> }) {
  if (certs.length === 0) return <div className="text-neutral-500 text-xs">No certifications on file. Add a primary author certification to gain trust.</div>;
  return (
    <div className="space-y-3">
      {certs.map((c) => (
        <div key={c.id} className="rounded-lg border border-neutral-200 p-3 text-xs">
          <div className="flex items-center justify-between">
            <div className="font-medium text-sm">{c.author_name}</div>
            <div className="flex items-center gap-2">
              {c.is_primary && <span className="text-[10px] px-2 py-0.5 bg-green-100 text-green-800 rounded border border-green-300">PRIMARY</span>}
              <span className={`text-[10px] px-2 py-0.5 rounded border ${c.status === "active" ? "bg-green-100 text-green-800 border-green-300" : c.status === "expired" ? "bg-amber-100 text-amber-800 border-amber-300" : "bg-red-100 text-red-800 border-red-300"}`}>{c.status.toUpperCase()}</span>
            </div>
          </div>
          <div className="text-neutral-600 mt-1">{c.credentials_text}</div>
          <div className="text-neutral-400 mt-1">
            {c.years_experience ? `${c.years_experience} years · ` : ""}Certified by {c.certified_by ?? "self"} · {new Date(c.certified_at).toLocaleDateString()}
            {c.expires_at && ` · Expires ${new Date(c.expires_at).toLocaleDateString()}`}
          </div>
        </div>
      ))}
    </div>
  );
}

function DependenciesSection({ deps }: { deps: NonNullable<DetailBundle["dependencies"]> }) {
  if (deps.length === 0) return <div className="text-neutral-500 text-xs">No dependencies declared.</div>;
  return (
    <table className="w-full text-xs">
      <thead className="text-neutral-500 border-b border-neutral-100"><tr><th className="text-left py-1">Child brain</th><th className="text-left">Relationship</th><th className="text-left">Min version</th><th className="text-left">Added</th></tr></thead>
      <tbody>
        {deps.map((d) => (
          <tr key={d.id} className="border-b border-neutral-100">
            <td className="py-2"><Link href={`/admin/brains/${d.child_brain_slug}`} className="text-blue-700 hover:underline">{d.child_brain_slug}</Link></td>
            <td>{d.relationship}</td>
            <td className="font-mono">{d.min_child_semver ?? "any"}</td>
            <td>{new Date(d.added_at).toLocaleDateString()}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function ReviewQueueSection({ actions }: { actions: NonNullable<DetailBundle["review_actions"]> }) {
  if (actions.length === 0) return <div className="text-neutral-500 text-xs">No review actions yet.</div>;
  return (
    <div className="space-y-2">
      {actions.slice(0, 20).map((a) => (
        <div key={a.id} className="text-xs border-l-2 border-neutral-200 pl-3">
          <div className="flex items-center gap-2">
            <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${a.action === "approve" ? "bg-green-100 text-green-800" : a.action === "reject" ? "bg-red-100 text-red-800" : a.action === "request_changes" ? "bg-amber-100 text-amber-800" : "bg-neutral-100 text-neutral-700"}`}>{a.action.replace(/_/g, " ").toUpperCase()}</span>
            <span className="text-neutral-500">{a.reviewer_role} · {a.reviewer_id}</span>
            <span className="text-neutral-400 ml-auto">{new Date(a.occurred_at).toLocaleString()}</span>
          </div>
          {a.notes && <div className="mt-1 text-neutral-700">{a.notes}</div>}
        </div>
      ))}
    </div>
  );
}

function FeedbackSection({ recent, unknown }: { recent: NonNullable<DetailBundle["recent_feedback"]>; unknown: NonNullable<DetailBundle["unknown_queue"]> }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div>
        <div className="text-xs uppercase tracking-wide text-neutral-500 mb-2">Recent Answers</div>
        {recent.length === 0 ? <div className="text-neutral-500 text-xs">No runtime answers logged yet.</div> :
          recent.slice(0, 10).map((f) => (
            <div key={f.id} className="text-xs py-1 border-b border-neutral-100 flex items-center gap-2">
              <span className={`px-1.5 py-0.5 rounded text-[10px] ${f.answer_kind === "direct" ? "bg-green-100 text-green-800" : f.answer_kind === "unknown" ? "bg-amber-100 text-amber-800" : "bg-neutral-100 text-neutral-700"}`}>{f.confidence.toFixed(2)}</span>
              <span className="truncate flex-1">{f.query_text}</span>
            </div>
          ))
        }
      </div>
      <div>
        <div className="text-xs uppercase tracking-wide text-neutral-500 mb-2">Unknown Queue (author review needed)</div>
        {unknown.length === 0 ? <div className="text-neutral-500 text-xs">No unknown queries yet.</div> :
          unknown.slice(0, 10).map((u) => (
            <div key={u.id} className="text-xs py-1 border-b border-neutral-100 flex items-center gap-2">
              <span className="px-1.5 py-0.5 rounded text-[10px] bg-amber-100 text-amber-800">{u.confidence.toFixed(2)}</span>
              <span className="truncate flex-1">{u.query_text}</span>
            </div>
          ))
        }
      </div>
    </div>
  );
}

function ExplainabilitySection({ readiness }: { readiness: DetailBundle["readiness"] }) {
  const pct = readiness?.axes.explainability_coverage ?? null;
  return (
    <div className="text-xs space-y-2">
      <div>Explainability coverage: <span className="font-medium">{pct == null ? "no answers logged yet" : `${pct}%`}</span></div>
      <div className="text-neutral-500">Every answer must carry an evidence array + trade rule + reason + confidence + brain_version. Explainability coverage measures the % of answers over the last {readiness?.axes.factors.answers_considered ?? 0} runs that shipped a non-empty evidence array.</div>
      <div className="text-neutral-500">This is the mechanism that makes NEX visibly different from a generic chatbot — the user sees provenance under every answer.</div>
    </div>
  );
}

function PackageSection({ brain, currentVersion }: { brain: NonNullable<DetailBundle["brain"]>; currentVersion: DetailBundle["current_version"] }) {
  return (
    <div className="text-xs space-y-3">
      <div className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1">
        <KV k="Exportable" v={brain.exportable ? "Yes" : "No"} />
        <KV k="Package ID" v={brain.package_id ?? <span className="text-neutral-400">not installed from a package</span>} />
        <KV k="Installed from" v={brain.installed_from_source ?? <span className="text-neutral-400">original build</span>} />
        <KV k="Portable current version" v={currentVersion?.portable ? "Yes" : "No"} />
        <KV k="Package checksum" v={currentVersion?.package_checksum ? <code className="text-[10px]">{currentVersion.package_checksum.slice(0, 24)}…</code> : <span className="text-neutral-400">not signed</span>} />
        <KV k="Package signature" v={currentVersion?.package_signature ? <code className="text-[10px]">present</code> : <span className="text-neutral-400">not signed</span>} />
        <KV k="Public key ref" v={currentVersion?.package_public_key_ref ?? <span className="text-neutral-400">—</span>} />
        <KV k="Imported from" v={currentVersion?.imported_from_package_id ?? <span className="text-neutral-400">—</span>} />
      </div>
      <div className="pt-3 border-t border-neutral-100 text-neutral-500">
        Package export / import / verify / install workflows ship in a later phase. The schema is already ready — every field above will populate once the signing pipeline ships.
      </div>
    </div>
  );
}

function RuntimeHealthSection({ currentVersion, readiness }: { currentVersion: DetailBundle["current_version"]; readiness: DetailBundle["readiness"] }) {
  if (!currentVersion) return <div className="text-neutral-500 text-xs">No published version yet.</div>;
  return (
    <div className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1 text-xs">
      <KV k="Brain API version" v={<code>{currentVersion.brain_api_version}</code>} />
      <KV k="Minimum runtime version" v={<code>{currentVersion.minimum_runtime_version}</code>} />
      <KV k="Published under runtime" v={<code>{currentVersion.current_runtime_version ?? "unknown"}</code>} />
      <KV k="Compatibility now" v={readiness?.axes.factors.runtime_compatible ?? "unknown"} />
    </div>
  );
}

function TrustDashboardSection({ trust }: { trust: NonNullable<DetailBundle["trust"]> }) {
  const bandColor =
    trust.band === "excellent" ? "bg-green-100 text-green-800 border-green-300" :
    trust.band === "good"      ? "bg-blue-100 text-blue-800 border-blue-300" :
    trust.band === "developing" ? "bg-amber-100 text-amber-800 border-amber-300" :
                                  "bg-neutral-100 text-neutral-700 border-neutral-300";
  return (
    <div className="space-y-4">
      {/* Explanation is PRIMARY (ADR-0040 · Philip 2026-07-28) */}
      <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
        <div className="text-xs uppercase tracking-wide text-blue-700 mb-1">Next action</div>
        <div className="text-sm text-blue-900 font-medium">{trust.what_raises_it_next}</div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <div className="text-xs uppercase tracking-wide text-neutral-500 mb-2">What raises trust ({trust.raisers.length})</div>
          {trust.raisers.length === 0 ? <div className="text-neutral-500 text-xs italic">No positive factors yet.</div> :
            <ul className="space-y-2">
              {trust.raisers.map((f) => (
                <li key={f.key} className="text-xs border-l-2 border-green-400 pl-3">
                  <div className="font-medium text-green-900">{f.label}</div>
                  <div className="text-green-800">{f.contribution}</div>
                  <div className="text-neutral-600 mt-0.5">{f.note}</div>
                </li>
              ))}
            </ul>
          }
        </div>
        <div>
          <div className="text-xs uppercase tracking-wide text-neutral-500 mb-2">What reduces trust ({trust.reducers.length})</div>
          {trust.reducers.length === 0 ? <div className="text-neutral-500 text-xs italic">No reducers.</div> :
            <ul className="space-y-2">
              {trust.reducers.map((f) => (
                <li key={f.key} className="text-xs border-l-2 border-amber-400 pl-3">
                  <div className="font-medium text-amber-900">{f.label}</div>
                  <div className="text-amber-800">{f.contribution}</div>
                  <div className="text-neutral-600 mt-0.5">{f.note}</div>
                </li>
              ))}
            </ul>
          }
        </div>
      </div>

      {/* Number is footnote — deliberately small (ADR-0040) */}
      <div className="pt-3 border-t border-neutral-100 flex items-center justify-between text-xs">
        <span className="text-neutral-500">
          Trust score · <span className="text-neutral-800 font-medium">{trust.score == null ? "insufficient data" : `${trust.score}/100`}</span>
          <span className={`ml-2 px-2 py-0.5 rounded border ${bandColor}`}>{trust.band}</span>
        </span>
        <span className="text-neutral-400">Data completeness: {Math.round(trust.data_completeness * 100)}%</span>
      </div>
    </div>
  );
}

function MaturityLadderSection({
  maturity, catalogue,
}: {
  maturity: NonNullable<DetailBundle["maturity"]>;
  catalogue: NonNullable<DetailBundle["maturity_catalogue"]>;
}) {
  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3 text-xs text-neutral-700">
        {maturity.reason_for_current_level}
      </div>

      <ol className="space-y-2">
        {catalogue.map((lvl) => {
          const isCurrent = lvl.level === maturity.current_level;
          const isPast = lvl.level < maturity.current_level;
          const isNext = lvl.level === maturity.next_level;
          const isTbd = lvl.status === "tbd";
          const requirements = isNext ? maturity.requirements_for_next : lvl.requirements;

          return (
            <li key={lvl.level} className={`rounded-lg border p-3 ${
              isCurrent ? "border-green-400 bg-green-50/40" :
              isPast    ? "border-neutral-200 bg-neutral-50" :
              isNext    ? "border-blue-300 bg-blue-50/40" :
              isTbd     ? "border-dashed border-neutral-300 bg-neutral-50/40" :
                          "border-neutral-200"
            }`}>
              <div className="flex items-center gap-3">
                <span className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                  isCurrent ? "bg-green-600 text-white" :
                  isPast    ? "bg-neutral-400 text-white" :
                  isNext    ? "bg-blue-500 text-white" :
                              "bg-neutral-200 text-neutral-500"
                }`}>{lvl.level}</span>
                <div className="flex-1">
                  <div className="text-sm font-medium">
                    {lvl.name}
                    {isCurrent && <span className="ml-2 text-[10px] text-green-700 uppercase font-semibold">Current</span>}
                    {isPast    && <span className="ml-2 text-[10px] text-neutral-500 uppercase">Achieved</span>}
                    {isNext    && <span className="ml-2 text-[10px] text-blue-700 uppercase font-semibold">Next</span>}
                    {isTbd     && <span className="ml-2 text-[10px] text-neutral-500 uppercase font-semibold">Criteria TBD</span>}
                  </div>
                  {isTbd && (
                    <div className="text-xs text-neutral-500 italic mt-1">
                      Criteria will be defined based on real-world experience with the Staircase Brain.
                    </div>
                  )}
                </div>
              </div>

              {requirements && !isTbd && (
                <ul className="mt-3 space-y-1 text-xs">
                  {requirements.map((r) => (
                    <li key={r.key} className="grid grid-cols-[16px_1fr_max-content] gap-2 items-start">
                      <span className={r.met ? "text-green-600" : "text-neutral-400"}>{r.met ? "✓" : "○"}</span>
                      <span className={r.met ? "text-neutral-800" : "text-neutral-600"}>{r.description}</span>
                      <span className="text-neutral-400 text-[10px]">{r.detail}</span>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function ImprovementQueueSection({ queue }: { queue: NonNullable<DetailBundle["improvement_queue"]> }) {
  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3 text-xs">
        <span className="text-neutral-500">Question this queue answers: </span>
        <span className="text-neutral-900 font-medium">{queue.question_answered}</span>
      </div>
      {queue.items.length === 0 ? (
        <div className="text-neutral-500 text-xs italic">Nothing queued right now — either the brain is fully populated or Supabase has no data yet.</div>
      ) : (
        <ol className="space-y-2">
          {queue.items.map((it) => (
            <li key={it.rank} className="rounded-lg border border-neutral-200 bg-white p-3 text-xs">
              <div className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-neutral-900 text-white flex items-center justify-center text-[11px] font-bold">{it.rank}</span>
                <div className="flex-1">
                  <div className="text-sm font-medium text-neutral-900">{it.title}</div>
                  <div className="text-neutral-600 mt-1">{it.why}</div>
                  <div className="mt-2 text-neutral-800"><span className="text-neutral-500">Action · </span>{it.action}</div>
                  <div className="mt-2 flex flex-wrap gap-2 text-[10px]">
                    <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-800 border border-blue-300">{it.potential_impact}</span>
                    <span className="px-2 py-0.5 rounded bg-neutral-100 text-neutral-700 border border-neutral-300">effort: {it.effort}</span>
                    <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200">signal: {it.signal_strength}</span>
                    <span className="px-2 py-0.5 rounded bg-neutral-50 text-neutral-500 border border-neutral-200">source: {it.source}</span>
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function CoverageMapSection({ coverage }: { coverage: NonNullable<DetailBundle["coverage"]> }) {
  const statusStyle: Record<string, string> = {
    excellent:  "bg-green-500",
    good:       "bg-blue-500",
    developing: "bg-amber-500",
    empty:      "bg-neutral-300",
    missing:    "bg-red-300",
  };
  return (
    <div className="space-y-2">
      {coverage.modules.map((m) => (
        <div key={m.module} className="grid grid-cols-[180px_1fr_60px_max-content] items-center gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-neutral-800 font-medium">{m.module}</span>
            {!m.is_expected && <span className="text-[10px] text-neutral-400">(extra)</span>}
          </div>
          <div className="h-2 rounded bg-neutral-100 overflow-hidden">
            <div className={`h-full ${statusStyle[m.status]}`} style={{ width: `${Math.max(m.coverage_pct, 2)}%` }} />
          </div>
          <span className="text-right font-medium">{m.coverage_pct}%</span>
          <span className={`text-[10px] px-2 py-0.5 rounded border ${
            m.status === "excellent"  ? "bg-green-50 text-green-800 border-green-200" :
            m.status === "good"       ? "bg-blue-50 text-blue-800 border-blue-200" :
            m.status === "developing" ? "bg-amber-50 text-amber-800 border-amber-200" :
            m.status === "empty"      ? "bg-neutral-50 text-neutral-500 border-neutral-200" :
                                        "bg-red-50 text-red-800 border-red-200"
          }`}>{m.status}</span>
        </div>
      ))}
    </div>
  );
}

function AuditTimelineSection({ events }: { events: NonNullable<DetailBundle["audit_timeline"]> }) {
  if (events.length === 0) return <div className="text-neutral-500 text-xs">No events yet. Every future mutation writes here.</div>;
  return (
    <div className="space-y-1">
      {events.slice(0, 40).map((e) => (
        <div key={e.id} className="text-xs py-1 border-b border-neutral-100 grid grid-cols-[max-content_max-content_1fr_max-content] gap-3 items-center">
          <span className="text-neutral-400 font-mono text-[10px]">{new Date(e.occurred_at).toLocaleString()}</span>
          <span className={`px-2 py-0.5 rounded text-[10px] bg-neutral-100 text-neutral-700 border border-neutral-200`}>{e.event_type}</span>
          <span className="text-neutral-700">{e.actor_role ?? "system"} · {e.actor_id ?? "—"}</span>
          <span className="text-neutral-400 text-[10px]">{e.id.slice(0, 8)}</span>
        </div>
      ))}
    </div>
  );
}
