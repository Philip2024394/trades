"use client";

// Client-side Approve / Reject buttons for the claim review admin page.
// Calls POST /api/nex/claim/admin-action then reloads the page.

import { useState } from "react";
import { Check, X, Loader2, ExternalLink } from "lucide-react";
import Link from "next/link";

export function ClaimReviewActions({
  claimRequestId,
  businessName,
  listingSlug,
}: {
  claimRequestId: string;
  businessName: string;
  listingSlug: string | null;
}) {
  const [submitting, setSubmitting] = useState<"approve" | "reject" | null>(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [showNoteInput, setShowNoteInput] = useState(false);

  async function performAction(action: "approve" | "reject") {
    if (!confirm(`${action.toUpperCase()} claim for "${businessName}"?`)) return;
    setSubmitting(action);
    setError(null);
    try {
      const res = await fetch("/api/nex/claim/admin-action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          claim_request_id: claimRequestId,
          action,
          admin_note: note || undefined,
          reviewed_by: "admin",
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error ?? `Failed to ${action}`);
      } else {
        window.location.reload();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error");
    } finally {
      setSubmitting(null);
    }
  }

  return (
    <div className="flex flex-col items-end gap-2 min-w-[200px]">
      {listingSlug && (
        <Link
          href={`/nex-app/trade/${encodeURIComponent(listingSlug)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[11px] text-black/50 hover:text-orange-600 inline-flex items-center gap-1"
        >
          View public profile
          <ExternalLink size={10} strokeWidth={2} />
        </Link>
      )}

      {!showNoteInput ? (
        <button
          type="button"
          onClick={() => setShowNoteInput(true)}
          className="text-[11px] text-black/50 hover:text-black underline decoration-dotted"
        >
          Add admin note
        </button>
      ) : (
        <textarea
          value={note}
          onChange={e => setNote(e.target.value)}
          placeholder="Optional note (e.g. why approved/rejected)"
          rows={2}
          className="w-full rounded-md border border-black/10 bg-white px-2 py-1 text-[12px] resize-none"
        />
      )}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => performAction("reject")}
          disabled={!!submitting}
          className="inline-flex items-center gap-1 rounded-md border border-red-200 bg-white px-3 py-1.5 text-[12px] font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
        >
          {submitting === "reject" ? <Loader2 size={12} strokeWidth={2.5} className="animate-spin" /> : <X size={12} strokeWidth={2.5} />}
          Reject
        </button>
        <button
          type="button"
          onClick={() => performAction("approve")}
          disabled={!!submitting}
          className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-3 py-1.5 text-[12px] font-black uppercase tracking-wider text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          {submitting === "approve" ? <Loader2 size={12} strokeWidth={2.5} className="animate-spin" /> : <Check size={12} strokeWidth={2.5} />}
          Approve
        </button>
      </div>

      {error && (
        <div className="text-[11px] text-red-700 max-w-[200px] text-right">{error}</div>
      )}
    </div>
  );
}
