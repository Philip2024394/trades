// /admin/nex/review — Review Queue. Approve/reject/merge/archive.
// Fetches "current" state of target entries alongside so the diff view
// can show current vs proposed.

import Link from "next/link";
import { listReviews, countPending, readEntry } from "@/lib/nex/intelligence";
import { ReviewQueue, type CurrentEntryLookup } from "@/components/admin/nex/ReviewQueue";

export const dynamic = "force-dynamic";
export const metadata = { title: "Review Queue · Admin", robots: { index: false } };

export default async function Page({ searchParams }: { searchParams: Promise<{ status?: string; kind?: string; by?: string }> }) {
  const sp = await searchParams;
  const status = (sp.status as "pending" | "approved" | "rejected" | "merged" | "archived" | undefined) ?? "pending";

  const [items, pending] = await Promise.all([
    listReviews({
      status,
      kind: sp.kind as "create" | "edit" | "correction" | "delete" | "edge" | "teach" | undefined,
      submittedByKind: sp.by as "staff" | "merchant" | "ai" | "builder" | undefined,
      limit: 100
    }),
    countPending()
  ]);

  // For every review with a target_entry_id, fetch the current state so
  // the diff view can render current vs proposed side by side.
  const targetIds = Array.from(new Set(items.map((i) => i.target_entry_id).filter((x): x is string => !!x)));
  const targets = await Promise.all(targetIds.map((id) => readEntry(id)));
  const currentByEntry: CurrentEntryLookup = {};
  for (const t of targets) {
    if (t) currentByEntry[t.id] = { title: t.title, summary: t.summary, confidence: t.confidence, version: t.version };
  }

  return (
    <div className="min-h-screen bg-neutral-50 p-6">
      <div className="mx-auto max-w-6xl">
        <div className="mb-4 flex items-baseline justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-neutral-500">Nex Intelligence</p>
            <h1 className="mt-1 text-2xl font-black">Review queue <span className="ml-2 rounded-full bg-amber-500 px-2 py-0.5 align-middle text-[11px] text-white">{pending}</span></h1>
          </div>
          <div className="flex gap-2 text-[11px] font-black">
            <Link href="/admin/nex/knowledge" className="rounded-full border border-neutral-300 bg-white px-3 py-1.5 hover:border-neutral-900">Knowledge</Link>
            <Link href="/admin/nex/research"  className="rounded-full border border-neutral-300 bg-white px-3 py-1.5 hover:border-neutral-900">Research</Link>
            <Link href="/admin/nex/health"    className="rounded-full border border-neutral-300 bg-white px-3 py-1.5 hover:border-neutral-900">Health</Link>
          </div>
        </div>

        <ReviewQueue items={items} currentByEntry={currentByEntry} filters={{ status, kind: sp.kind ?? "", by: sp.by ?? "" }}/>
      </div>
    </div>
  );
}
