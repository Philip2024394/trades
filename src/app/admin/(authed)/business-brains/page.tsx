// Admin dashboard — Business Brains list view.
//
// Shows every registered business with its brain status, last-synced
// timestamp, page counts, and recent sync-job outcome. Row-click drills
// into the detail page. A "Run sync" button on each row POSTs to
// /api/admin/business-brains/[id]/sync to kick off a manual crawl.
//
// The dashboard is Philip's operations centre for the whole Business
// Brain product — the trades run their own brains from an owner-facing
// UI shipped separately, but the admin view is where the platform team
// keeps eyes on ingest health.

import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import RunSyncButton from "./RunSyncButton";
import AddBusinessForm from "./AddBusinessForm";

export const dynamic = "force-dynamic";

type Row = {
  business_id:      string;
  business_name:    string;
  primary_domain:   string;
  brain_id:         string | null;
  status:           string | null;
  sync_frequency:   string | null;
  last_synced_at:   string | null;
  next_sync_due_at: string | null;
  pages_indexed:    number | null;
  last_job_status:  string | null;
  last_job_at:      string | null;
};

async function loadBusinesses(): Promise<Row[]> {
  const { data: businesses, error } = await supabaseAdmin
    .from("business_brain_businesses")
    .select("id, name, primary_domain")
    .order("created_at", { ascending: false });
  if (error || !businesses) return [];

  const rows: Row[] = [];
  for (const b of businesses as Array<{ id: string; name: string; primary_domain: string }>) {
    const { data: brains } = await supabaseAdmin
      .from("business_brains")
      .select("id, status, sync_frequency, last_synced_at, next_sync_due_at, pages_indexed")
      .eq("business_id", b.id)
      .limit(1)
      .maybeSingle();

    const brain = brains as {
      id: string; status: string; sync_frequency: string;
      last_synced_at: string | null; next_sync_due_at: string | null;
      pages_indexed: number | null;
    } | null;

    let lastJobStatus: string | null = null;
    let lastJobAt: string | null = null;
    if (brain) {
      const { data: job } = await supabaseAdmin
        .from("brain_sync_jobs")
        .select("status, finished_at")
        .eq("brain_id", brain.id)
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      const j = job as { status: string; finished_at: string | null } | null;
      lastJobStatus = j?.status ?? null;
      lastJobAt     = j?.finished_at ?? null;
    }

    rows.push({
      business_id:      b.id,
      business_name:    b.name,
      primary_domain:   b.primary_domain,
      brain_id:         brain?.id ?? null,
      status:           brain?.status ?? null,
      sync_frequency:   brain?.sync_frequency ?? null,
      last_synced_at:   brain?.last_synced_at ?? null,
      next_sync_due_at: brain?.next_sync_due_at ?? null,
      pages_indexed:    brain?.pages_indexed ?? null,
      last_job_status:  lastJobStatus,
      last_job_at:      lastJobAt
    });
  }
  return rows;
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return `${d.toLocaleDateString("en-GB")} ${d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`;
}

function statusPill(status: string | null): string {
  switch (status) {
    case "active":     return "bg-green-100 text-green-800";
    case "syncing":    return "bg-blue-100 text-blue-800";
    case "failed":     return "bg-red-100 text-red-800";
    case "paused":     return "bg-amber-100 text-amber-800";
    case "provisioning": return "bg-slate-100 text-slate-700";
    default:           return "bg-slate-100 text-slate-500";
  }
}

export default async function BusinessBrainsAdminPage() {
  const rows = await loadBusinesses();

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <div className="mb-6 flex items-baseline justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Business Brains</h1>
          <p className="mt-1 text-sm text-slate-500">
            Every registered business + its knowledge crawl status. Trigger a manual
            sync or drill into a brain to review pages, products, services and FAQs.
          </p>
        </div>
        <div className="text-xs text-slate-500">
          {rows.length} business{rows.length === 1 ? "" : "es"}
        </div>
      </div>

      <div className="mb-4">
        <AddBusinessForm />
      </div>

      <div className="overflow-x-auto rounded border border-slate-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-2">Business</th>
              <th className="px-3 py-2">Domain</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Sync freq</th>
              <th className="px-3 py-2 text-right">Pages</th>
              <th className="px-3 py-2">Last sync</th>
              <th className="px-3 py-2">Next due</th>
              <th className="px-3 py-2">Last job</th>
              <th className="px-3 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length === 0 && (
              <tr>
                <td colSpan={9} className="px-3 py-8 text-center text-sm text-slate-500">
                  No businesses registered yet. Businesses appear here once an owner
                  creates a Brain from the merchant-facing setup.
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.business_id} className="hover:bg-slate-50">
                <td className="px-3 py-2">
                  {r.brain_id ? (
                    <Link
                      href={`/admin/business-brains/${r.brain_id}`}
                      className="font-medium text-blue-700 hover:underline"
                    >
                      {r.business_name}
                    </Link>
                  ) : (
                    <span className="text-slate-500">{r.business_name}</span>
                  )}
                </td>
                <td className="px-3 py-2 text-xs text-slate-600">{r.primary_domain}</td>
                <td className="px-3 py-2">
                  <span className={`inline-flex items-center rounded px-2 py-0.5 text-[11px] font-medium ${statusPill(r.status)}`}>
                    {r.status ?? "no brain"}
                  </span>
                </td>
                <td className="px-3 py-2 text-xs text-slate-600">{r.sync_frequency ?? "—"}</td>
                <td className="px-3 py-2 text-right text-xs tabular-nums">
                  {r.pages_indexed ?? "—"}
                </td>
                <td className="px-3 py-2 text-xs text-slate-600">{fmtDate(r.last_synced_at)}</td>
                <td className="px-3 py-2 text-xs text-slate-600">{fmtDate(r.next_sync_due_at)}</td>
                <td className="px-3 py-2 text-xs text-slate-600">
                  {r.last_job_status ? (
                    <span>
                      {r.last_job_status}
                      <span className="text-slate-400"> · {fmtDate(r.last_job_at)}</span>
                    </span>
                  ) : "—"}
                </td>
                <td className="px-3 py-2 text-right">
                  {r.brain_id && <RunSyncButton brainId={r.brain_id} />}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
