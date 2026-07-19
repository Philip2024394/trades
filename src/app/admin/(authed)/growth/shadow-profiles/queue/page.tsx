// /admin/growth/shadow-profiles/queue — the scrape queue.
//
// Shows the latest 200 scraped/queued rows. Filter by status +
// trade + city. Click through to single-profile inspector.

import { redirect } from "next/navigation";
import Link from "next/link";
import { isAdminAuthed } from "@/lib/adminAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

type SP = { status?: string; trade?: string; city?: string; q?: string };

export default async function ShadowProfilesQueuePage({
  searchParams
}: {
  searchParams: Promise<SP>;
}) {
  if (!(await isAdminAuthed())) {
    redirect("/admin/login?next=/admin/growth/shadow-profiles/queue");
  }
  const sp = await searchParams;
  const statusFilter = sp.status || "queued";
  const tradeFilter  = sp.trade  || "";
  const cityFilter   = sp.city   || "";
  const qFilter      = sp.q      || "";

  let query = supabaseAdmin
    .from("hammerex_shadow_merchants")
    .select("id, business_name, reserved_slug, status, trade_type, city, email, next_step_index, next_step_due_at, last_step_sent_at, scraped_at, claimed_at")
    .order("scraped_at", { ascending: false })
    .limit(200);

  if (statusFilter && statusFilter !== "all") query = query.eq("status", statusFilter);
  if (tradeFilter)                            query = query.eq("trade_type", tradeFilter);
  if (cityFilter)                             query = query.ilike("city", `%${cityFilter}%`);
  if (qFilter)                                query = query.ilike("business_name", `%${qFilter}%`);

  const { data: rows, error } = await query;

  return (
    <main className="min-h-screen bg-neutral-50 pb-16">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <div className="flex items-baseline justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-neutral-500">Admin · Growth · Shadow scraper</p>
            <h1 className="mt-1 text-2xl font-black text-neutral-900">Queue</h1>
          </div>
          <Link href="/admin/growth/shadow-profiles" className="rounded-full border border-neutral-300 bg-white px-3 py-1.5 text-[11px] font-black uppercase tracking-wider hover:bg-neutral-100">← Overview</Link>
        </div>

        {/* Filters */}
        <form className="mt-6 flex flex-wrap items-end gap-2 rounded-2xl border border-neutral-200 bg-white p-4">
          <Field label="Status">
            <select name="status" defaultValue={statusFilter} className="rounded-md border border-neutral-300 px-2 py-1.5 text-[12px]">
              <option value="all">All</option>
              <option value="scraped">Scraped</option>
              <option value="queued">Queued</option>
              <option value="sending">Sending</option>
              <option value="claimed">Claimed</option>
              <option value="suppressed">Suppressed</option>
              <option value="released">Released</option>
            </select>
          </Field>
          <Field label="Trade">
            <input name="trade" defaultValue={tradeFilter} placeholder="e.g. plumber" className="rounded-md border border-neutral-300 px-2 py-1.5 text-[12px]"/>
          </Field>
          <Field label="City">
            <input name="city" defaultValue={cityFilter} placeholder="e.g. Manchester" className="rounded-md border border-neutral-300 px-2 py-1.5 text-[12px]"/>
          </Field>
          <Field label="Business name">
            <input name="q" defaultValue={qFilter} placeholder="search" className="rounded-md border border-neutral-300 px-2 py-1.5 text-[12px]"/>
          </Field>
          <button type="submit" className="rounded-md bg-neutral-900 px-4 py-1.5 text-[11px] font-black uppercase tracking-wider text-white">Filter</button>
        </form>

        {/* Table */}
        <div className="mt-6 overflow-x-auto rounded-2xl border border-neutral-200 bg-white">
          <table className="w-full min-w-[900px] border-collapse text-[11.5px]">
            <thead className="bg-neutral-100">
              <tr>
                <Th>Business</Th>
                <Th>Trade / City</Th>
                <Th>Slug</Th>
                <Th>Email</Th>
                <Th>Status</Th>
                <Th>Next step</Th>
                <Th>Due</Th>
                <Th>Scraped</Th>
              </tr>
            </thead>
            <tbody>
              {error && (
                <tr><td colSpan={8} className="p-4 text-red-800">Load failed: {error.message}</td></tr>
              )}
              {(rows ?? []).length === 0 && !error && (
                <tr><td colSpan={8} className="p-4 text-center text-[12px] text-neutral-500">No rows match — try widening the filter.</td></tr>
              )}
              {(rows ?? []).map((r) => (
                <tr key={r.id} className="border-t border-neutral-100 hover:bg-neutral-50">
                  <Td>
                    <Link href={`/admin/growth/shadow-profiles/${r.id}`} className="font-black text-neutral-900 hover:underline">
                      {r.business_name}
                    </Link>
                  </Td>
                  <Td>{r.trade_type || "—"} · {r.city || "—"}</Td>
                  <Td><code className="rounded bg-neutral-100 px-1 text-[10.5px]">{r.reserved_slug}</code></Td>
                  <Td className="max-w-[220px] truncate">{r.email || <span className="text-neutral-400">—</span>}</Td>
                  <Td><StatusBadge status={r.status as string}/></Td>
                  <Td>{r.next_step_index ?? 0} / 6</Td>
                  <Td>{fmt(r.next_step_due_at)}</Td>
                  <Td className="text-neutral-500">{fmt(r.scraped_at)}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}

function fmt(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[9.5px] font-black uppercase tracking-wider text-neutral-500">{label}</span>
      {children}
    </label>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-3 py-2 text-left text-[10px] font-black uppercase tracking-wider text-neutral-600">{children}</th>;
}

function Td({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-3 py-2 align-top text-[11.5px] text-neutral-800 ${className}`}>{children}</td>;
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; fg: string }> = {
    scraped:    { bg: "bg-neutral-100", fg: "text-neutral-700" },
    queued:     { bg: "bg-blue-100",    fg: "text-blue-800"    },
    sending:    { bg: "bg-amber-100",   fg: "text-amber-800"   },
    claimed:    { bg: "bg-green-100",   fg: "text-green-800"   },
    suppressed: { bg: "bg-red-100",     fg: "text-red-800"     },
    released:   { bg: "bg-neutral-100", fg: "text-neutral-500" }
  };
  const s = map[status] || map.scraped;
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wider ${s.bg} ${s.fg}`}>{status}</span>;
}
