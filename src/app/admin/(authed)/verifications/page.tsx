// /admin/verifications — verification review queue.
//
// Admin + moderator review pending credential submissions.
// Approve or reject inline. Every action audit-logged.

import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, ShieldCheck, ExternalLink, FileText } from "lucide-react";
import { assertAdminRole } from "@/lib/admin/rbac";
import { loadPendingVerifications } from "@/lib/verification/engine";
import { VerificationRow } from "./VerificationRow";

export const dynamic = "force-dynamic";

const BRAND_YELLOW = "#FFB300";

export default async function AdminVerificationsPage() {
  const auth = await assertAdminRole(["admin", "moderator"]);
  if (!auth.ok) redirect("/admin/login?next=/admin/verifications");

  const pending = await loadPendingVerifications(200);

  return (
    <main className="min-h-screen bg-neutral-50 p-6">
      <div className="mx-auto max-w-4xl">
        <Link href="/admin" className="inline-flex items-center gap-1 text-[11px] font-black uppercase tracking-wider text-neutral-500 hover:text-neutral-900">
          <ArrowLeft size={11}/> Network Health
        </Link>
        <div className="mt-3 mb-5">
          <p className="text-[10px] font-black uppercase tracking-[0.28em]" style={{ color: BRAND_YELLOW }}>Verification Engine</p>
          <h1 className="mt-1 flex items-center gap-2 text-[24px] font-black text-neutral-900">
            <ShieldCheck size={22}/> Pending queue
            <span className="text-[13px] font-bold text-neutral-500 tabular-nums">{pending.length}</span>
          </h1>
          <p className="mt-1 text-[12px] text-neutral-600">
            Manual review of trade + merchant credentials. Approve grants a verified badge on the public profile. Rejection is reason-required.
          </p>
        </div>

        {pending.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed bg-white p-10 text-center" style={{ borderColor: "rgba(0,0,0,0.08)" }}>
            <ShieldCheck size={22} className="mx-auto text-neutral-400"/>
            <p className="mt-2 text-[13px] font-black text-neutral-900">Queue is empty</p>
            <p className="mx-auto mt-1 max-w-md text-[11.5px] text-neutral-600">
              When a trade submits a Gas Safe or NICEIC number (or a merchant submits Companies House / VAT), it lands here.
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {pending.map((v) => (
              <VerificationRow
                key={v.id}
                verification={v}
              />
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
