// /admin/users — homeowner list + search.
//
// The core user-support surface. Search by email/name/postcode.
// Suspended users highlighted. Click through to /admin/users/[id].

import Link from "next/link";
import { redirect } from "next/navigation";
import { Search, ShieldOff, ArrowRight, Users } from "lucide-react";
import { assertAdminRole } from "@/lib/admin/rbac";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

type Homeowner = {
  id: string; email: string; first_name: string | null;
  city: string | null; postcode: string | null;
  created_at: string; suspended_at: string | null; suspended_reason: string | null;
};

export default async function AdminUsersPage({
  searchParams
}: {
  searchParams: Promise<{ q?: string; suspended?: string }>;
}) {
  const auth = await assertAdminRole(["admin", "support"]);
  if (!auth.ok) redirect("/admin/login?next=/admin/users");

  const { q, suspended } = await searchParams;
  const query = (q || "").trim().toLowerCase();
  const onlySuspended = suspended === "1";

  let dbq = supabaseAdmin
    .from("hammerex_homeowners")
    .select("id, email, first_name, city, postcode, created_at, suspended_at, suspended_reason")
    .order("created_at", { ascending: false })
    .limit(200);
  if (onlySuspended) dbq = dbq.not("suspended_at", "is", null);
  if (query)         dbq = dbq.or(`email.ilike.%${query}%,first_name.ilike.%${query}%,postcode.ilike.%${query}%,city.ilike.%${query}%`);

  const res = await dbq;
  const rows = (res.data as Homeowner[]) ?? [];

  return (
    <main className="min-h-screen bg-neutral-50 p-6">
      <div className="mx-auto max-w-6xl">
        <div className="mb-5 flex items-baseline justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.28em] text-neutral-500">
              User centre
            </p>
            <h1 className="mt-1 flex items-center gap-2 text-[22px] font-black text-neutral-900">
              <Users size={20}/> Homeowners
              <span className="text-[13px] font-bold text-neutral-500 tabular-nums">{rows.length}</span>
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href={onlySuspended ? "/admin/users" : "/admin/users?suspended=1"}
              className="inline-flex h-8 items-center gap-1.5 rounded-md border px-3 text-[10.5px] font-black uppercase tracking-wider transition"
              style={{
                borderColor: onlySuspended ? "#B91C1C" : "rgba(0,0,0,0.12)",
                color:       onlySuspended ? "#B91C1C" : "#525252",
                backgroundColor: onlySuspended ? "rgba(220,38,38,0.08)" : "white"
              }}
            >
              <ShieldOff size={11}/> Suspended only
            </Link>
            <Link href="/admin" className="text-[11px] font-black uppercase tracking-wider text-neutral-500 hover:text-neutral-900">
              ← Network Health
            </Link>
          </div>
        </div>

        {/* Search */}
        <form className="mb-4 flex items-center gap-2">
          <div className="relative flex-1">
            <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400"/>
            <input
              type="search"
              name="q"
              defaultValue={query}
              placeholder="Search email / name / postcode / city…"
              className="h-10 w-full rounded-lg border border-neutral-300 bg-white pl-8 pr-3 text-[13px] outline-none focus:border-neutral-500"
            />
          </div>
          <button
            type="submit"
            className="inline-flex h-10 items-center gap-1 rounded-md bg-neutral-900 px-4 text-[11px] font-black uppercase tracking-wider text-white shadow-sm hover:brightness-110"
          >
            Search
          </button>
        </form>

        {/* List */}
        <div className="overflow-hidden rounded-2xl border-2 bg-white shadow-sm" style={{ borderColor: "rgba(0,0,0,0.08)" }}>
          {rows.length === 0 ? (
            <p className="p-8 text-center text-[13px] text-neutral-500">
              {query ? "No homeowners match your search." : onlySuspended ? "No suspended homeowners." : "No homeowners yet."}
            </p>
          ) : (
            <ul className="divide-y" style={{ borderColor: "rgba(0,0,0,0.06)" }}>
              {rows.map((h) => (
                <li key={h.id}>
                  <Link
                    href={`/admin/users/${h.id}`}
                    className="flex items-center gap-3 p-3 transition hover:bg-neutral-50"
                    style={h.suspended_at ? { backgroundColor: "rgba(220,38,38,0.04)" } : {}}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-2">
                        <p className="truncate text-[13px] font-black text-neutral-900">
                          {h.first_name || h.email.split("@")[0]}
                        </p>
                        {h.suspended_at && (
                          <span className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider" style={{ backgroundColor: "#FEE2E2", color: "#991B1B" }}>
                            <ShieldOff size={9}/> Suspended
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 truncate text-[11px] text-neutral-500">
                        {h.email} · {h.city || h.postcode || "no location"} · joined {new Date(h.created_at).toLocaleDateString("en-GB")}
                      </p>
                    </div>
                    <ArrowRight size={13} className="text-neutral-400"/>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </main>
  );
}
