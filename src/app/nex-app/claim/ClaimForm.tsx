"use client";

// Claim form · captures the owner's contact and POSTs a claim request.
// Flips lifecycle_status to "claim_requested" but never touches directory_state
// (only the full verification flow can move it to claimed / paid_member).

import { useState } from "react";
import { ArrowRight, Loader2 } from "lucide-react";

const ORANGE = "#F97316";

export function ClaimForm({
  listing_id,
  business_name,
  defaultEmail,
}: {
  listing_id: string;
  business_name: string;
  defaultEmail?: string;
}) {
  const [ownerName,  setOwnerName]  = useState("");
  const [ownerEmail, setOwnerEmail] = useState(defaultEmail ?? "");
  const [ownerPhone, setOwnerPhone] = useState("");
  const [note,       setNote]       = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error,      setError]      = useState<string | null>(null);
  const [success,    setSuccess]    = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/nex/claim/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          listing_id,
          owner_email: ownerEmail,
          owner_name:  ownerName || undefined,
          owner_phone: ownerPhone || undefined,
          note:        note || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Something went wrong");
      } else {
        setSuccess(true);
        // Refresh the page so the CTA switches to "claim request received" state.
        window.location.reload();
      }
    } catch {
      setError("Network error · please try again");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          const details = document.getElementById("claim-details");
          if (details) details.style.display = details.style.display === "none" ? "block" : "none";
        }}
        className="flex w-full items-center justify-center gap-2 rounded-full py-3 text-sm font-black uppercase tracking-wider text-white transition-transform active:scale-95"
        style={{ background: ORANGE, boxShadow: "0 6px 18px rgba(249,115,22,0.35)" }}
      >
        Claim this business
        <ArrowRight size={16} strokeWidth={2.5} />
      </button>

      <form id="claim-details" onSubmit={submit} className="mt-4 space-y-3" style={{ display: "none" }}>
        <div className="rounded-xl border border-black/10 bg-black/[0.02] p-4">
          <p className="mb-3 text-[12px] text-black/60">
            To claim <span className="font-semibold text-black/85">{business_name}</span>, tell us who you are. NEX will verify your ownership before confirming the claim.
          </p>
          <label className="mb-2 block text-[11px] font-semibold uppercase tracking-wider text-black/70">Your name</label>
          <input required value={ownerName} onChange={(e) => setOwnerName(e.target.value)} placeholder="Full name" className="mb-3 w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm" />

          <label className="mb-2 block text-[11px] font-semibold uppercase tracking-wider text-black/70">Your email <span className="text-orange-600">*</span></label>
          <input required type="email" value={ownerEmail} onChange={(e) => setOwnerEmail(e.target.value)} placeholder="you@yourbusiness.co.uk" className="mb-3 w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm" />

          <label className="mb-2 block text-[11px] font-semibold uppercase tracking-wider text-black/70">Your phone (optional)</label>
          <input value={ownerPhone} onChange={(e) => setOwnerPhone(e.target.value)} placeholder="0800 ..." className="mb-3 w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm" />

          <label className="mb-2 block text-[11px] font-semibold uppercase tracking-wider text-black/70">Anything else NEX should know? (optional)</label>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="e.g. best time to contact, your role in the business" className="w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm" />

          {error && <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</div>}
          {success && <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">Claim request received. NEX will be in touch.</div>}

          <button
            type="submit"
            disabled={submitting || !ownerEmail}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-full bg-black py-2.5 text-[13px] font-black uppercase tracking-wider text-white transition-transform active:scale-95 disabled:opacity-50"
          >
            {submitting ? (<><Loader2 size={14} strokeWidth={2.5} className="animate-spin" /> Sending…</>) : "Submit claim request"}
          </button>
        </div>
      </form>
    </div>
  );
}
