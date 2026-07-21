// /admin/gdpr — GDPR request queue (Art. 15 export + Art. 17 delete).
//
// Admin-only. Non-destructive Rule 3: every erasure snapshots the
// full subject state into the audit log first, so we can reconstruct
// if legal disputes the request.

import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, ShieldQuestion } from "lucide-react";
import { assertAdminRole } from "@/lib/admin/rbac";
import { loadPendingRequests } from "@/lib/gdpr/engine";
import { GdprRequestRow } from "./GdprRequestRow";
import { GdprCreateForm } from "./GdprCreateForm";

export const dynamic = "force-dynamic";

const BRAND_YELLOW = "#FFB300";

export default async function GdprPage() {
  const auth = await assertAdminRole(["admin"]);
  if (!auth.ok) redirect("/admin/login?next=/admin/gdpr");

  const pending = await loadPendingRequests();

  return (
    <main className="min-h-screen bg-neutral-50 p-6">
      <div className="mx-auto max-w-4xl">
        <Link href="/admin" className="inline-flex items-center gap-1 text-[11px] font-black uppercase tracking-wider text-neutral-500 hover:text-neutral-900">
          <ArrowLeft size={11}/> Network Health
        </Link>
        <div className="mt-3 mb-5">
          <p className="text-[10px] font-black uppercase tracking-[0.28em]" style={{ color: BRAND_YELLOW }}>GDPR Engine</p>
          <h1 className="mt-1 flex items-center gap-2 text-[24px] font-black text-neutral-900">
            <ShieldQuestion size={22}/> Data-subject requests
            <span className="text-[13px] font-bold text-neutral-500 tabular-nums">{pending.length}</span>
          </h1>
          <p className="mt-1 text-[12px] text-neutral-600">
            Art. 15 export + Art. 17 erasure. Deletion snapshots state to audit log first (Rule 3). 30-day statutory window.
          </p>
        </div>

        <section className="rounded-2xl border-2 bg-white p-4" style={{ borderColor: "rgba(0,0,0,0.08)" }}>
          <p className="mb-3 text-[11px] font-black uppercase tracking-[0.22em] text-neutral-700">Log a new request</p>
          <GdprCreateForm/>
        </section>

        <section className="mt-6">
          <p className="mb-2 text-[11px] font-black uppercase tracking-[0.22em] text-neutral-700">Pending</p>
          {pending.length === 0 ? (
            <div className="rounded-2xl border-2 border-dashed bg-white p-10 text-center" style={{ borderColor: "rgba(0,0,0,0.08)" }}>
              <ShieldQuestion size={22} className="mx-auto text-neutral-400"/>
              <p className="mt-2 text-[13px] font-black text-neutral-900">Nothing pending</p>
            </div>
          ) : (
            <ul className="space-y-3">
              {pending.map(r => <GdprRequestRow key={r.id} request={r}/>)}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
