// /admin/nex/knowledge — Knowledge Studio (internal).
// Staff creates, edits, and inspects knowledge entries. Every change
// files a review item; nothing publishes silently.

import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { KnowledgeStudio } from "@/components/admin/nex/KnowledgeStudio";

export const dynamic = "force-dynamic";
export const metadata = { title: "Knowledge Studio · Admin", robots: { index: false } };

export default async function Page({ searchParams }: { searchParams: Promise<{ trade?: string; status?: string; q?: string }> }) {
  const sp = await searchParams;
  const status = sp.status ?? "published";

  let q = supabaseAdmin
    .from("hammerex_nex_knowledge_entries")
    .select("id, trade, topic, title, summary, category, subcategory, difficulty, confidence, version, status, sources, updated_at");
  if (sp.trade)  q = q.eq("trade",  sp.trade);
  if (status)    q = q.eq("status", status);
  if (sp.q)      q = q.textSearch("search_tsv", sp.q, { type: "websearch" });

  const { data } = await q.order("updated_at", { ascending: false }).limit(200);
  const entries = (data ?? []).map((e) => ({ ...e, sources: (e.sources ?? []) as unknown[] }));

  const { data: tradesData } = await supabaseAdmin
    .from("hammerex_nex_knowledge_entries")
    .select("trade")
    .neq("trade", "");
  const trades = Array.from(new Set((tradesData ?? []).map((r) => r.trade))).sort();

  return (
    <div className="min-h-screen bg-neutral-50 p-6">
      <div className="mx-auto max-w-6xl">
        <div className="mb-4 flex items-baseline justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-neutral-500">Nex Intelligence</p>
            <h1 className="mt-1 text-2xl font-black">Knowledge Studio</h1>
          </div>
          <div className="flex gap-2 text-[11px] font-black">
            <Link href="/admin/nex/review"  className="rounded-full border border-neutral-300 bg-white px-3 py-1.5 hover:border-neutral-900">Review</Link>
            <Link href="/admin/nex/health"  className="rounded-full border border-neutral-300 bg-white px-3 py-1.5 hover:border-neutral-900">Health</Link>
            <Link href="/admin/nex/sources" className="rounded-full border border-neutral-300 bg-white px-3 py-1.5 hover:border-neutral-900">Sources</Link>
            <Link href="/admin/nex/teach"   className="rounded-full border border-neutral-300 bg-white px-3 py-1.5 hover:border-neutral-900">Teach</Link>
          </div>
        </div>

        <KnowledgeStudio entries={entries} trades={trades} filters={{ trade: sp.trade ?? "", status, q: sp.q ?? "" }}/>
      </div>
    </div>
  );
}
