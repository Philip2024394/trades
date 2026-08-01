"use client";

// Client-side response recorder for the Supplier Responses admin page.
// POSTs to /api/admin/nex/supplier-response · reloads on success.

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

type Supplier = { supplier_id: string; name: string };

type Props = {
  enquiryId:           string;
  suppliers:           Supplier[];
  matchedSupplierIds:  string[];
};

const RESPONSE_TYPES: Array<{ value: string; label: string; needsReason?: boolean }> = [
  { value: "accepted",    label: "Accepted" },
  { value: "quoted",      label: "Quoted" },
  { value: "declined",    label: "Declined", needsReason: true },
  { value: "completed",   label: "Completed" },
  { value: "no_response", label: "No response" },
];

export function RecordResponseForm({ enquiryId, suppliers, matchedSupplierIds }: Props) {
  const router = useRouter();
  const preferred = matchedSupplierIds[0] ?? suppliers[0]?.supplier_id ?? "";

  const [supplierId, setSupplierId]   = useState(preferred);
  const [responseType, setResponseType] = useState("accepted");
  const [declineReason, setDeclineReason] = useState("");
  const [adminNotes, setAdminNotes]   = useState("");
  const [submitting, setSubmitting]   = useState(false);
  const [error, setError]             = useState<string | null>(null);
  const [success, setSuccess]         = useState(false);

  const needsReason = RESPONSE_TYPES.find((t) => t.value === responseType)?.needsReason;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null); setSuccess(false); setSubmitting(true);
    try {
      const res = await fetch("/api/admin/nex/supplier-response", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enquiry_id:     enquiryId,
          supplier_id:    supplierId,
          response_type:  responseType,
          decline_reason: declineReason.trim() || undefined,
          admin_notes:    adminNotes.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error ?? "request_failed");
      } else {
        setSuccess(true);
        // Refresh the page so the enquiry status/badge updates
        setTimeout(() => router.refresh(), 400);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} className="grid grid-cols-1 gap-3 md:grid-cols-4">
      <label className="text-[11px]">
        <div className="mb-1 font-semibold text-neutral-600">Supplier</div>
        <select
          value={supplierId}
          onChange={(e) => setSupplierId(e.target.value)}
          className="w-full rounded-md border border-neutral-300 bg-white px-2 py-1.5 text-[12px]"
          required
        >
          {suppliers.map((s) => (
            <option key={s.supplier_id} value={s.supplier_id}>
              {matchedSupplierIds.includes(s.supplier_id) ? "★ " : ""}{s.name}
            </option>
          ))}
        </select>
      </label>

      <label className="text-[11px]">
        <div className="mb-1 font-semibold text-neutral-600">Response</div>
        <select
          value={responseType}
          onChange={(e) => setResponseType(e.target.value)}
          className="w-full rounded-md border border-neutral-300 bg-white px-2 py-1.5 text-[12px]"
        >
          {RESPONSE_TYPES.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
      </label>

      <label className="text-[11px]">
        <div className="mb-1 font-semibold text-neutral-600">
          Decline reason {needsReason ? "" : "(optional)"}
        </div>
        <input
          type="text"
          value={declineReason}
          onChange={(e) => setDeclineReason(e.target.value)}
          placeholder={needsReason ? "why the supplier declined" : "—"}
          className="w-full rounded-md border border-neutral-300 bg-white px-2 py-1.5 text-[12px]"
        />
      </label>

      <label className="text-[11px]">
        <div className="mb-1 font-semibold text-neutral-600">Admin notes (internal)</div>
        <input
          type="text"
          value={adminNotes}
          onChange={(e) => setAdminNotes(e.target.value)}
          placeholder="—"
          className="w-full rounded-md border border-neutral-300 bg-white px-2 py-1.5 text-[12px]"
        />
      </label>

      <div className="md:col-span-4 flex items-center gap-2">
        <button
          type="submit"
          disabled={submitting || !supplierId}
          className="rounded-full bg-neutral-900 px-4 py-2 text-[11px] font-black text-white disabled:opacity-50"
        >
          {submitting ? "Recording…" : "Record"}
        </button>
        {error && <div className="text-[11px] text-red-600">✗ {error}</div>}
        {success && <div className="text-[11px] text-green-700">✓ Recorded</div>}
      </div>
    </form>
  );
}
