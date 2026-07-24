// /admin/nex/sources — Source Library.
// Every source cited by any entry, aggregated. Staff sees load-bearing
// sources (high entry_count) and orphan sources instantly.

import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";
export const metadata = { title: "Source Library · Admin", robots: { index: false } };

type SourceRow = {
  source_key:    string;
  title:         string | null;
  url:           string | null;
  kind:          string | null;
  entry_count:   number;
  trades:        string[];
  entry_ids:     string[];
  last_cited_at: string;
};

export default async function Page() {
  const { data } = await supabaseAdmin
    .from("v_nex_source_library")
    .select("*")
    .order("entry_count", { ascending: false });
  const rows = (data as SourceRow[] | null) ?? [];

  return (
    <div className="min-h-screen bg-neutral-50 p-6">
      <div className="mx-auto max-w-5xl">
        <div className="mb-4 flex items-baseline justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-neutral-500">Nex Intelligence</p>
            <h1 className="mt-1 text-2xl font-black">Source library</h1>
            <p className="mt-1 text-[12px] text-neutral-600">
              Every regulation, manufacturer guide and reference Nex cites. Big numbers = load-bearing sources.
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
            No sources yet. Every knowledge entry must cite at least one.
          </div>
        )}

        <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white">
          <table className="w-full text-[12px]">
            <thead className="bg-neutral-50 text-left text-[10px] font-black uppercase tracking-wider text-neutral-500">
              <tr>
                <th className="px-3 py-2">Source</th>
                <th className="px-3 py-2">Kind</th>
                <th className="px-3 py-2">Cited by</th>
                <th className="px-3 py-2">Trades</th>
                <th className="px-3 py-2">Last used</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.source_key} className="border-t border-neutral-100 hover:bg-neutral-50">
                  <td className="px-3 py-2">
                    <p className="font-black">{r.title ?? "(untitled)"}</p>
                    {r.url && <a href={r.url} target="_blank" rel="noreferrer" className="text-[10px] text-neutral-500 underline">{r.url}</a>}
                  </td>
                  <td className="px-3 py-2 text-neutral-600 capitalize">{r.kind ?? "other"}</td>
                  <td className="px-3 py-2">
                    <span className={"rounded-full px-2 py-0.5 text-[10px] font-black " + (r.entry_count >= 5 ? "bg-neutral-900 text-white" : r.entry_count === 1 ? "bg-amber-100 text-amber-800" : "bg-neutral-100 text-neutral-700")}>
                      {r.entry_count} {r.entry_count === 1 ? "entry" : "entries"}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-[11px] text-neutral-600">{r.trades.join(" · ")}</td>
                  <td className="px-3 py-2 text-[10px] text-neutral-500">{new Date(r.last_cited_at).toLocaleDateString("en-GB")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="mt-4 text-[11px] text-neutral-500">
          A source cited by 1 entry is an orphan. Either cite it more or archive the entry.
        </p>
      </div>
    </div>
  );
}
