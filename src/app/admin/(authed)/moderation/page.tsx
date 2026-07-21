// /admin/moderation — unified moderation queue.
//
// One queue for every subject_kind: yard_post, sitebook_photo, review,
// chat_message, merchant_profile, trade_profile.
// Sorted by severity DESC, then oldest-first.

import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, ShieldAlert } from "lucide-react";
import { assertAdminRole } from "@/lib/admin/rbac";
import { loadPendingFlags } from "@/lib/moderation/engine";
import { ModerationRow } from "./ModerationRow";

export const dynamic = "force-dynamic";

const BRAND_YELLOW = "#FFB300";

const SUBJECT_LABEL: Record<string, string> = {
  yard_post:        "Yard post",
  sitebook_photo:   "SiteBook photo",
  review:           "Review",
  chat_message:     "Message",
  merchant_profile: "Merchant profile",
  trade_profile:    "Trade profile"
};

export default async function ModerationQueuePage() {
  const auth = await assertAdminRole(["admin", "moderator"]);
  if (!auth.ok) redirect("/admin/login?next=/admin/moderation");

  const flags = await loadPendingFlags(200);

  const bySeverity = {
    critical: flags.filter(f => f.severity === "critical").length,
    high:     flags.filter(f => f.severity === "high").length,
    normal:   flags.filter(f => f.severity === "normal").length,
    low:      flags.filter(f => f.severity === "low").length
  };

  return (
    <main className="min-h-screen bg-neutral-50 p-6">
      <div className="mx-auto max-w-4xl">
        <Link href="/admin" className="inline-flex items-center gap-1 text-[11px] font-black uppercase tracking-wider text-neutral-500 hover:text-neutral-900">
          <ArrowLeft size={11}/> Network Health
        </Link>
        <div className="mt-3 mb-5">
          <p className="text-[10px] font-black uppercase tracking-[0.28em]" style={{ color: BRAND_YELLOW }}>Moderation Engine</p>
          <h1 className="mt-1 flex items-center gap-2 text-[24px] font-black text-neutral-900">
            <ShieldAlert size={22}/> Pending queue
            <span className="text-[13px] font-bold text-neutral-500 tabular-nums">{flags.length}</span>
          </h1>
          <p className="mt-1 text-[12px] text-neutral-600">
            Every reported content lands here. Approve to leave it live, hide to soft-remove (Rule 3), escalate for legal review.
          </p>
        </div>

        <div className="mb-4 grid grid-cols-4 gap-2">
          <SeverityChip label="Critical" value={bySeverity.critical} colour="#B91C1C"/>
          <SeverityChip label="High"     value={bySeverity.high}     colour="#F59E0B"/>
          <SeverityChip label="Normal"   value={bySeverity.normal}   colour="#166534"/>
          <SeverityChip label="Low"      value={bySeverity.low}      colour="#6B7280"/>
        </div>

        {flags.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed bg-white p-10 text-center" style={{ borderColor: "rgba(0,0,0,0.08)" }}>
            <ShieldAlert size={22} className="mx-auto text-neutral-400"/>
            <p className="mt-2 text-[13px] font-black text-neutral-900">Queue is empty</p>
            <p className="mx-auto mt-1 max-w-md text-[11.5px] text-neutral-600">
              When a user reports a Yard post, a photo, a review, or a message — it lands here.
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {flags.map(f => (
              <ModerationRow key={f.id} flag={f} subjectLabel={SUBJECT_LABEL[f.subject_kind] || f.subject_kind}/>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}

function SeverityChip({ label, value, colour }: { label: string; value: number; colour: string }) {
  return (
    <div className="rounded-xl border-2 bg-white p-2 text-center" style={{ borderColor: "rgba(0,0,0,0.08)" }}>
      <p className="text-[9px] font-black uppercase tracking-[0.22em]" style={{ color: colour }}>{label}</p>
      <p className="mt-0.5 text-[16px] font-black tabular-nums text-neutral-900">{value}</p>
    </div>
  );
}
