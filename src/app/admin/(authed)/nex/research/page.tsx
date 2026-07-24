// /admin/nex/research — every research pass Nex has run.

import Link from "next/link";
import { listResearchReports } from "@/lib/nex/intelligence";

export const dynamic = "force-dynamic";
export const metadata = { title: "Research · Admin", robots: { index: false } };

export default async function Page() {
  const rows = await listResearchReports(50);
  return (
    <div className="min-h-screen bg-neutral-50 p-6">
      <div className="mx-auto max-w-5xl">
        <div className="mb-4 flex items-baseline justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-neutral-500">Nex Intelligence</p>
            <h1 className="mt-1 text-2xl font-black">Research history</h1>
            <p className="mt-1 text-[12px] text-neutral-600">
              Every topic Nex has researched. Drafts land in Review. Nothing becomes knowledge without approval.
            </p>
          </div>
          <div className="flex gap-2 text-[11px] font-black">
            <Link href="/admin/nex/knowledge" className="rounded-full border border-neutral-300 bg-white px-3 py-1.5 hover:border-neutral-900">Knowledge</Link>
            <Link href="/admin/nex/review"    className="rounded-full border border-neutral-300 bg-white px-3 py-1.5 hover:border-neutral-900">Review</Link>
            <Link href="/admin/nex/health"    className="rounded-full border border-neutral-300 bg-white px-3 py-1.5 hover:border-neutral-900">Health</Link>
          </div>
        </div>

        {rows.length === 0 && (
          <div className="rounded-2xl border border-neutral-200 bg-white p-8 text-center text-[13px] text-neutral-500">
            No research yet. Ask Nex: <span className="font-mono">"Nex, research UK staircase guidance."</span>
          </div>
        )}

        <div className="space-y-2">
          {rows.map((r) => {
            const status = r.status;
            const statusCls =
              status === "complete" ? "bg-green-100 text-green-800" :
              status === "running"  ? "bg-amber-100 text-amber-800" :
                                       "bg-red-100 text-red-800";
            return (
              <Link key={r.id} href={`/admin/nex/research/${r.id}`}
                    className="block rounded-2xl border border-neutral-200 bg-white p-3 hover:border-neutral-900">
                <div className="flex items-center gap-2">
                  <p className="flex-1 truncate text-[14px] font-black">{r.topic}</p>
                  <span className={"rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wider " + statusCls}>{status}</span>
                  <span className="rounded-full bg-neutral-900 px-2 py-0.5 text-[10px] font-black text-white">{r.proposed_count} drafts</span>
                </div>
                <p className="mt-1 text-[10px] text-neutral-500">
                  {r.requested_by_kind}:{r.requested_by} · {new Date(r.created_at).toLocaleString("en-GB")}
                  {r.changed_count  > 0 && ` · ${r.changed_count} changes`}
                  {r.conflict_count > 0 && ` · ${r.conflict_count} conflicts`}
                </p>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
