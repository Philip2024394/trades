// /admin/brains — Brain Dashboard (at-a-glance)
//
// Server component. Reads the list bundle from the API and renders
// one card per brain with the at-a-glance signals Philip specified.
// Works for any brain — nothing staircase-specific.

import Link from "next/link";
import { headers } from "next/headers";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type BrainListBundle = {
  ok: boolean;
  total?: number;
  brains?: Array<{
    brain: {
      slug: string;
      display_name: string;
      category: string;
      trade: string | null;
      status: string;
      lifecycle_stage: string;
      certification_level: string;
      primary_country: string | null;
      primary_language: string;
      capabilities: Record<string, boolean>;
    };
    readiness_overall: number;
    readiness_score: { knowledge: number; coverage: number; testing: number; author_review: number; freshness: number; confidence: number; overall: number } | null;
    current_version_semver: string | null;
    certified_author: { author_name: string; credentials_text: string; certified_at: string; expires_at: string | null } | null;
    answers_answered_total: number;
    unknown_questions: number;
    dependencies_healthy_pct: number;
  }>;
  error?: string;
};

async function fetchBundle(): Promise<BrainListBundle> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3008";
  const proto = h.get("x-forwarded-proto") ?? "http";
  const res = await fetch(`${proto}://${host}/api/admin/brains/list`, { cache: "no-store" });
  return (await res.json()) as BrainListBundle;
}

export default async function BrainDashboardPage() {
  const bundle = await fetchBundle();

  if (!bundle.ok) {
    return (
      <div className="p-8 font-sans text-neutral-900" style={{ color: "#171717" }}>
        <h1 className="text-2xl font-semibold mb-2">Brain Dashboard</h1>
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-amber-900">
          {bundle.error === "supabase_unavailable"
            ? "Supabase is not available. Apply the Living Brain migrations and set SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in .env.local."
            : `Failed to load brain list: ${bundle.error ?? "unknown error"}`}
        </div>
      </div>
    );
  }

  const brains = bundle.brains ?? [];

  return (
    <div className="min-h-screen bg-neutral-50 font-sans text-sm text-neutral-900" style={{ color: "#171717" }}>
      <div className="sticky top-0 z-10 bg-white border-b border-neutral-200 px-6 py-4 flex items-center gap-6">
        <div>
          <h1 className="text-xl font-semibold">Brain Dashboard</h1>
          <p className="text-xs text-neutral-500">{bundle.total ?? 0} brain{bundle.total === 1 ? "" : "s"} · sorted by Readiness</p>
        </div>
      </div>

      {brains.length === 0 && (
        <div className="p-8">
          <div className="rounded-xl border border-neutral-200 bg-white p-8 text-center">
            <h2 className="text-lg font-medium mb-2">No brains yet</h2>
            <p className="text-neutral-600">
              The <code>hammerex_nex_brains</code> table is empty. Create your first brain to see it here.
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 p-6">
        {brains.map((b) => <BrainCard key={b.brain.slug} bundle={b} />)}
      </div>
    </div>
  );
}

function BrainCard({ bundle }: { bundle: NonNullable<BrainListBundle["brains"]>[number] }) {
  const b = bundle.brain;
  const ready = bundle.readiness_overall;
  const readyBand =
    ready >= 90 ? { label: "Production Ready", color: "bg-green-100 text-green-800 border-green-300" } :
    ready >= 70 ? { label: "Nearly Ready",     color: "bg-blue-100 text-blue-800 border-blue-300" } :
    ready >= 40 ? { label: "Under Development", color: "bg-amber-100 text-amber-800 border-amber-300" } :
                  { label: "Not Ready",         color: "bg-neutral-100 text-neutral-700 border-neutral-300" };
  const dot =
    ready >= 90 ? "🟢" : ready >= 70 ? "🔵" : ready >= 40 ? "🟠" : "⚪";

  return (
    <Link
      href={`/admin/brains/${b.slug}`}
      className="rounded-xl border border-neutral-200 bg-white hover:border-neutral-400 shadow-sm p-5 flex flex-col gap-3 transition-colors"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-semibold text-base flex items-center gap-2">
            <span>{dot}</span>
            <span>{b.display_name}</span>
          </div>
          <div className="text-xs text-neutral-500 mt-0.5">{b.trade ? b.trade + " · " : ""}{b.category}</div>
        </div>
        <span className={`text-xs px-2 py-0.5 rounded-md border font-medium ${readyBand.color}`}>{readyBand.label}</span>
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
        <Row label="Overall Health"       value={`${ready}%`} />
        <Row label="Knowledge Coverage"   value={`${bundle.readiness_score?.knowledge ?? 0}%`} />
        <Row label="Expert Certified"     value={bundle.certified_author ? "Yes" : "No"} />
        <Row label="Confidence"           value={`${bundle.readiness_score?.confidence ?? 0}%`} />
        <Row label="Questions Answered"   value={bundle.answers_answered_total.toLocaleString()} />
        <Row label="Unknown Questions"    value={bundle.unknown_questions.toLocaleString()} />
        <Row label="Dependencies Healthy" value={`${bundle.dependencies_healthy_pct}%`} />
        <Row label="Latest Version"       value={bundle.current_version_semver ?? "—"} />
      </div>

      <div className="border-t border-neutral-100 pt-2 flex flex-wrap gap-1 text-xs">
        {Object.entries(b.capabilities).filter(([, v]) => v).map(([k]) => (
          <span key={k} className="px-2 py-0.5 rounded bg-neutral-100 text-neutral-700 border border-neutral-200">
            {k.replace(/^supports_/, "")}
          </span>
        ))}
        {Object.values(b.capabilities).every((v) => !v) && (
          <span className="text-neutral-400">No capabilities enabled</span>
        )}
      </div>

      <div className="flex items-center justify-between text-xs text-neutral-500 pt-1">
        <span>Status: <span className="text-neutral-800">{b.status}</span></span>
        <span>Lifecycle: <span className="text-neutral-800">{b.lifecycle_stage}</span></span>
        <span>Cert: <span className="text-neutral-800">{b.certification_level.replace(/_/g, " ")}</span></span>
      </div>
    </Link>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <>
      <span className="text-neutral-500">{label}</span>
      <span className="text-neutral-900 font-medium text-right">{value}</span>
    </>
  );
}
