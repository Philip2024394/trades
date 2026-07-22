// /admin/mate/gaps — knowledge gap triage. Highest-flagged first.
// Actions: mark reviewed, promote to KB (stub for now — writes a
// draft entry to the knowledge base), dismiss.
//
// Every thumbs-down on a Mate reply lands here via src/lib/mate/gaps.ts.

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { GapsTable } from "./GapsTable";

export const dynamic = "force-dynamic";
export const metadata = { title: "Mate gaps — Admin" };

type GapRow = {
  id:                 string;
  surface:            string;
  sample_question:    string;
  sample_reply:       string;
  thumbs_down_count:  number;
  status:             string;
  first_flagged_at:   string;
  last_flagged_at:    string;
  notes:              string | null;
};

export default async function MateGapsPage({
  searchParams
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status = "open" } = await searchParams;

  const query = supabaseAdmin
    .from("hammerex_mate_gaps")
    .select("id, surface, sample_question, sample_reply, thumbs_down_count, status, first_flagged_at, last_flagged_at, notes")
    .order("thumbs_down_count", { ascending: false })
    .order("last_flagged_at",   { ascending: false })
    .limit(100);

  const { data } = status === "all" ? await query : await query.eq("status", status);
  const rows = (data ?? []) as GapRow[];

  const counts = await supabaseAdmin
    .from("hammerex_mate_gaps")
    .select("status", { count: "exact" });
  const byStatus: Record<string, number> = {};
  for (const r of counts.data ?? []) {
    byStatus[r.status as string] = (byStatus[r.status as string] ?? 0) + 1;
  }

  return (
    <div className="mx-auto max-w-6xl p-6">
      <div className="mb-6 flex items-baseline justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black">Mate — Knowledge gaps</h1>
          <p className="mt-1 text-[12px] text-neutral-500">
            Every question Mate answered badly. Highest-signal at the top. Promote to knowledge base to teach me.
          </p>
        </div>
        <a href="/admin/mate" className="text-[12px] font-black text-neutral-500 hover:text-neutral-800">
          ← Back to observatory
        </a>
      </div>

      <div className="mb-4 flex gap-2 text-[11px] font-black uppercase tracking-wider">
        {["open", "reviewed", "promoted", "dismissed", "all"].map((s) => (
          <a
            key={s}
            href={`?status=${s}`}
            className={"rounded-full border px-2.5 py-1 " + (status === s ? "border-neutral-900 bg-neutral-900 text-white" : "border-neutral-200 hover:bg-neutral-100")}
          >
            {s} {s !== "all" && byStatus[s] ? `(${byStatus[s]})` : ""}
          </a>
        ))}
      </div>

      {rows.length === 0 ? (
        <div className="rounded-2xl border border-neutral-200 bg-white p-8 text-center text-[13px] text-neutral-500">
          No gaps in this bucket.
        </div>
      ) : (
        <GapsTable rows={rows}/>
      )}
    </div>
  );
}
