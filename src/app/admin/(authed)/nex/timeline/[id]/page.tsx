// /admin/nex/timeline/[id] — version history for one knowledge entry.
// Every change ever made. Reverse chronological.

import Link from "next/link";
import { notFound } from "next/navigation";
import { readEntry, readVersionHistory } from "@/lib/nex/intelligence";

export const dynamic = "force-dynamic";
export const metadata = { title: "Timeline · Admin", robots: { index: false } };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [entry, versions] = await Promise.all([readEntry(id), readVersionHistory(id)]);
  if (!entry) return notFound();

  return (
    <div className="min-h-screen bg-neutral-50 p-6">
      <div className="mx-auto max-w-3xl">
        <Link href="/admin/nex/knowledge" className="text-[11px] font-black uppercase tracking-wider text-neutral-500 hover:text-neutral-900">← Knowledge Studio</Link>
        <h1 className="mt-3 text-2xl font-black">{entry.title}</h1>
        <p className="mt-1 text-[12px] text-neutral-600">
          {entry.trade} · {entry.topic} · v{entry.version} · confidence {entry.confidence}%
        </p>
        <p className="mt-2 text-[10px] text-neutral-500">
          <span className="font-black">minor</span> = wording tweak · <span className="font-black">major</span> = new facts · <span className="font-black">correction</span> = merchant flagged it wrong
        </p>

        <div className="mt-6 space-y-3">
          {versions.map((v) => (
            <div key={v.id} className="rounded-2xl border border-neutral-200 bg-white p-4">
              <div className="mb-2 flex items-center gap-2 text-[10px] font-black uppercase tracking-wider">
                <span className={"rounded-full px-2 py-0.5 " + (v.version === entry.version ? "bg-neutral-900 text-white" : "bg-neutral-100 text-neutral-700")}>
                  v{v.version}
                </span>
                <span className="rounded-full border border-neutral-300 px-2 py-0.5 text-neutral-700">{v.change_kind}</span>
                <span className="ml-auto text-neutral-500">{new Date(v.approved_at).toLocaleString("en-GB")}</span>
              </div>
              <p className="text-[13px] font-black">{v.change_summary ?? "(no change summary)"}</p>
              <p className="mt-1 text-[11px] text-neutral-600">
                Proposed by <span className="font-black">{v.proposed_by_kind}:{v.proposed_by}</span> · approved by <span className="font-black">{v.approved_by}</span>
              </p>
              <details className="mt-2">
                <summary className="cursor-pointer text-[11px] font-black text-neutral-700">Content at v{v.version}</summary>
                <div className="mt-2 rounded-lg bg-neutral-50 p-2 text-[11px]">
                  <p className="font-black">{v.title}</p>
                  <p className="mt-1 text-neutral-700">{v.summary}</p>
                </div>
              </details>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
