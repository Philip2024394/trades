"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, X, ExternalLink, Loader2, FileText } from "lucide-react";
import type { Verification } from "@/lib/verification/engine";

const BRAND_GREEN = "#166534";
const BRAND_RED   = "#B91C1C";

const CREDENTIAL_LABEL: Record<string, string> = {
  gas_safe:        "Gas Safe",
  niceic:          "NICEIC",
  companies_house: "Companies House",
  vat:             "VAT",
  id:              "ID document",
  address:         "Address proof",
  age:             "Age verification",
  licence:         "Driving licence"
};

export function VerificationRow({ verification: v }: { verification: Verification }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [showReject, setShowReject] = useState(false);
  const [reason, setReason]         = useState("");
  const [error, setError]           = useState<string | null>(null);

  function fire(action: "approve" | "reject") {
    setError(null);
    if (action === "reject" && !showReject) { setShowReject(true); return; }
    startTransition(async () => {
      const res  = await fetch(`/api/admin/verifications/${v.id}`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ action, reason: action === "reject" ? reason : undefined })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setError(data.error || "Action failed"); return; }
      router.refresh();
    });
  }

  return (
    <li className="rounded-2xl border-2 bg-white p-4 shadow-sm" style={{ borderColor: "rgba(0,0,0,0.08)" }}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span
              className="rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wider"
              style={{ backgroundColor: "rgba(255,179,0,0.20)", color: "#7A4E00" }}
            >
              {CREDENTIAL_LABEL[v.credential_kind] || v.credential_kind}
            </span>
            <p className="truncate text-[13.5px] font-black text-neutral-900">
              {v.subject_display || v.subject_slug || `${v.subject_kind} · ${v.subject_id.slice(0, 8)}`}
            </p>
          </div>
          <p className="mt-1 text-[11.5px] text-neutral-600">
            {v.credential_value ? <><span className="font-black text-neutral-800">Value:</span> {v.credential_value} · </> : null}
            <span className="font-black text-neutral-800">Submitted:</span> {new Date(v.submitted_at).toLocaleString("en-GB")}
          </p>
          {v.credential_note && (
            <p className="mt-1 text-[11.5px] italic text-neutral-600">{v.credential_note}</p>
          )}
          {v.evidence_url && (
            <a
              href={v.evidence_url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 inline-flex items-center gap-1 text-[11px] font-black uppercase tracking-wider text-neutral-700 hover:text-neutral-900"
            >
              <FileText size={11}/> View evidence <ExternalLink size={10}/>
            </a>
          )}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-neutral-100 pt-3">
        <button
          type="button"
          onClick={() => fire("approve")}
          disabled={pending}
          className="inline-flex h-9 items-center gap-1.5 rounded-md px-3 text-[11px] font-black uppercase tracking-wider text-white shadow-sm hover:brightness-110 disabled:opacity-50"
          style={{ backgroundColor: BRAND_GREEN }}
        >
          {pending ? <Loader2 size={12} className="animate-spin"/> : <Check size={12}/>} Approve
        </button>

        <button
          type="button"
          onClick={() => fire("reject")}
          disabled={pending || (showReject && !reason.trim())}
          className="inline-flex h-9 items-center gap-1.5 rounded-md px-3 text-[11px] font-black uppercase tracking-wider text-white shadow-sm hover:brightness-110 disabled:opacity-50"
          style={{ backgroundColor: BRAND_RED }}
        >
          {pending ? <Loader2 size={12} className="animate-spin"/> : <X size={12}/>} {showReject ? "Confirm reject" : "Reject"}
        </button>

        {showReject && (
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Rejection reason (required)"
            className="h-9 w-64 rounded-md border border-red-200 bg-red-50 px-2 text-[11.5px] outline-none focus:border-red-400"
            autoFocus
          />
        )}

        {error && <p className="text-[10.5px] font-bold text-red-800">{error}</p>}
      </div>
    </li>
  );
}
