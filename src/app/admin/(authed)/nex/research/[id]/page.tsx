// /admin/nex/research/[id] — one research pass, its sources, and the
// drafts it queued for review.

import Link from "next/link";
import { notFound } from "next/navigation";
import { getResearchReport, listReviews } from "@/lib/nex/intelligence";

export const dynamic = "force-dynamic";
export const metadata = { title: "Research report · Admin", robots: { index: false } };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const report = await getResearchReport(id);
  if (!report) return notFound();

  const reviews = await listReviews({ status: "pending", limit: 50 });
  const linked  = reviews.filter((r) => report.review_ids.includes(r.id));

  return (
    <div className="min-h-screen bg-neutral-50 p-6">
      <div className="mx-auto max-w-4xl">
        <Link href="/admin/nex/research" className="text-[11px] font-black uppercase tracking-wider text-neutral-500 hover:text-neutral-900">← Research history</Link>
        <h1 className="mt-3 text-2xl font-black">"{report.topic}"</h1>
        <p className="mt-1 text-[12px] text-neutral-600">
          {report.status === "complete" ? "Research complete." : `Status: ${report.status}`}
          {" "}Method: {report.method === "reasoning" ? "AI reasoning (needs verification)" : report.method}.
        </p>

        <div className={"mt-4 rounded-2xl border-2 p-4 " + (report.found_official ? "border-green-500 bg-green-50" : "border-amber-500 bg-amber-50")}>
          <p className="text-[13px] font-black">
            {report.found_official
              ? "Official guidance found."
              : "No official guidance found for this topic."}
          </p>
          <p className="mt-1 text-[11px] text-neutral-700">
            {report.found_official
              ? "Drafts below cite regulation-tier sources."
              : "Any drafts below come from industry / community sources. Do not treat as legislation."}
          </p>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Official"       value={report.tier_counts.official}    highlight={report.tier_counts.official    > 0 ? "green" : "grey"}/>
          <Stat label="Industry"       value={report.tier_counts.industry}    highlight={report.tier_counts.industry    > 0 ? "blue"  : "grey"}/>
          <Stat label="Educational"    value={report.tier_counts.educational} highlight="grey"/>
          <Stat label="Community"      value={report.tier_counts.community}   highlight={report.tier_counts.community   > 0 ? "amber" : "grey"}/>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Total drafts"   value={report.proposed_count} highlight="black"/>
          <Stat label="Changes"        value={report.changed_count}  highlight={report.changed_count  > 0 ? "amber" : "grey"}/>
          <Stat label="Conflicts"      value={report.conflict_count} highlight={report.conflict_count > 0 ? "red"   : "grey"}/>
          <Stat label="Confidence"     value={`${report.confidence}%`} highlight={report.confidence >= 80 ? "green" : "amber"}/>
        </div>

        <div className="mt-4 rounded-2xl border border-neutral-200 bg-white p-4">
          <p className="text-[10px] font-black uppercase tracking-wider text-neutral-500">Sources checked</p>
          <ul className="mt-2 space-y-1">
            {report.sources_checked.map((s, i) => (
              <li key={i} className="flex items-center gap-2 text-[12px]">
                <span className={"h-2 w-2 rounded-full " + (s.ok ? "bg-green-500" : "bg-neutral-300")}/>
                <span className="font-black">{s.name}</span>
                <span className="text-neutral-500">· {s.kind}</span>
                <span className="ml-auto text-[10px] text-neutral-500">{s.ok ? "used" : "not fetched (pass 2)"}</span>
              </li>
            ))}
          </ul>
          {report.method === "reasoning" && (
            <p className="mt-3 text-[11px] text-neutral-600">
              Pass 1 uses AI reasoning, not live web fetch. Read each draft carefully before approving.
            </p>
          )}
        </div>

        {report.summary_md && (
          <div className="mt-4 rounded-2xl border border-neutral-200 bg-white p-4">
            <p className="text-[10px] font-black uppercase tracking-wider text-neutral-500">Summary</p>
            <pre className="mt-2 whitespace-pre-wrap font-sans text-[13px] text-neutral-800">{report.summary_md}</pre>
            {report.estimated_review_minutes && (
              <p className="mt-2 text-[11px] text-neutral-500">Estimated review time: {report.estimated_review_minutes} min</p>
            )}
          </div>
        )}

        <div className="mt-4">
          <p className="mb-2 text-[11px] font-black uppercase tracking-wider text-neutral-500">
            Drafts queued for review ({linked.length} of {report.review_ids.length} still pending)
          </p>
          {linked.length === 0 && (
            <div className="rounded-2xl border border-neutral-200 bg-white p-4 text-[12px] text-neutral-500">
              All drafts from this report have been reviewed. <Link className="font-black text-neutral-900 underline" href="/admin/nex/review?status=approved">See approved →</Link>
            </div>
          )}
          <div className="space-y-2">
            {linked.map((r) => {
              const p = r.proposed_json as Record<string, unknown>;
              return (
                <Link key={r.id} href="/admin/nex/review" className="block rounded-xl border border-neutral-200 bg-white p-3 hover:border-neutral-900">
                  <p className="text-[13px] font-black">{String(p.title ?? "(untitled)")}</p>
                  {typeof p.summary === "string" && <p className="mt-0.5 line-clamp-2 text-[12px] text-neutral-600">{p.summary}</p>}
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string | number; highlight: "black" | "green" | "amber" | "red" | "blue" | "grey" }) {
  const cls =
    highlight === "black" ? "bg-neutral-900 text-white" :
    highlight === "green" ? "bg-green-100 text-green-800" :
    highlight === "amber" ? "bg-amber-100 text-amber-800" :
    highlight === "red"   ? "bg-red-100 text-red-800" :
    highlight === "blue"  ? "bg-blue-100 text-blue-800" :
                             "bg-neutral-100 text-neutral-700";
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-3">
      <p className="text-[10px] uppercase tracking-wider text-neutral-500">{label}</p>
      <p className={"mt-1 inline-block rounded-full px-2 py-0.5 text-[15px] font-black " + cls}>{value}</p>
    </div>
  );
}
