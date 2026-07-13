"use client";

// LeadStatusActions — per-row status controls for the install-leads
// inbox. Renders four pill buttons (open / follow_up / won / lost)
// plus an optional note textarea that appears when a status is being
// changed. POSTs to /api/trade-off/install-leads/status and reflects
// the returned status inline without a full page refresh.
//
// Server passes the CURRENT status + note so the row hydrates
// correctly on first paint; client state takes over after any user
// action.

import { useState } from "react";
import { CheckCircle2, XCircle, Circle, Clock, Loader2 } from "lucide-react";

type LeadStatus = "open" | "follow_up" | "won" | "lost";

const STATUS_META: Record<LeadStatus, { label: string; classes: string }> = {
  open: {
    label: "Open",
    classes: "bg-[#1B1A17]/8 text-[#1B1A17]/70"
  },
  follow_up: {
    label: "Follow up",
    classes: "bg-amber-100 text-amber-800"
  },
  won: {
    label: "Won",
    classes: "bg-emerald-100 text-emerald-800"
  },
  lost: {
    label: "Lost",
    classes: "bg-red-100 text-red-800"
  }
};

export function LeadStatusActions({
  leadId,
  slug,
  editToken,
  initialStatus,
  initialNote
}: {
  leadId: string;
  slug: string;
  editToken: string;
  initialStatus: LeadStatus;
  initialNote: string | null;
}) {
  const [status, setStatus] = useState<LeadStatus>(initialStatus);
  const [note, setNote] = useState<string>(initialNote ?? "");
  const [expanded, setExpanded] = useState(false);
  const [saving, setSaving] = useState<LeadStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function updateStatus(nextStatus: LeadStatus) {
    setSaving(nextStatus);
    setError(null);
    try {
      const res = await fetch("/api/trade-off/install-leads/status", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          slug,
          edit_token: editToken,
          lead_id: leadId,
          lead_status: nextStatus,
          note: note.trim().length > 0 ? note.trim() : null
        })
      });
      const json = (await res.json()) as
        | { ok: true; status: LeadStatus }
        | { ok: false; error: string };
      if (!json.ok) {
        setError(
          json.error === "unauthorised"
            ? "Sign-in expired."
            : json.error === "not_your_lead"
              ? "You don't own this lead."
              : "Couldn't save the status."
        );
        return;
      }
      setStatus(json.status);
      setExpanded(false);
    } catch {
      setError("Network error.");
    } finally {
      setSaving(null);
    }
  }

  const current = STATUS_META[status];

  return (
    <div className="mt-3 border-t border-[#1B1A17]/8 pt-3">
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-black uppercase tracking-[0.14em] ${current.classes}`}
        >
          {status === "won" && <CheckCircle2 className="h-3 w-3" aria-hidden />}
          {status === "lost" && <XCircle className="h-3 w-3" aria-hidden />}
          {status === "follow_up" && <Clock className="h-3 w-3" aria-hidden />}
          {status === "open" && <Circle className="h-3 w-3" aria-hidden />}
          {current.label}
        </span>
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="text-[11.5px] font-semibold text-[#1B1A17]/55 hover:text-[#1B1A17]"
        >
          {expanded ? "Cancel" : "Update"}
        </button>
      </div>

      {expanded && (
        <div className="mt-2 space-y-2">
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value.slice(0, 500))}
            placeholder="Optional note — what happened, next step, follow-up date…"
            rows={2}
            className="block w-full resize-y rounded-lg border border-[#1B1A17]/10 bg-white px-2 py-1.5 text-[12.5px] leading-[1.45] text-[#1B1A17] outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-300/40"
          />
          <div className="flex flex-wrap gap-1.5">
            {(Object.keys(STATUS_META) as LeadStatus[]).map((s) => {
              const active = s === status;
              const busy = saving === s;
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => updateStatus(s)}
                  disabled={saving !== null}
                  className={`inline-flex min-h-[32px] items-center gap-1 rounded-full border px-3 text-[11.5px] font-black transition ${
                    active
                      ? "border-[#1B1A17] bg-[#1B1A17] text-white"
                      : "border-[#1B1A17]/15 bg-white text-[#1B1A17]/75 hover:border-[#1B1A17]/40"
                  } ${saving !== null && !busy ? "opacity-50" : ""}`}
                >
                  {busy && <Loader2 className="h-3 w-3 animate-spin" aria-hidden />}
                  {STATUS_META[s].label}
                </button>
              );
            })}
          </div>
          {error && (
            <p role="alert" className="text-[11.5px] font-semibold text-red-700">
              {error}
            </p>
          )}
        </div>
      )}

      {!expanded && initialNote && (
        <p className="mt-1.5 line-clamp-2 text-[11.5px] italic leading-snug text-[#1B1A17]/60">
          &ldquo;{initialNote}&rdquo;
        </p>
      )}
    </div>
  );
}
