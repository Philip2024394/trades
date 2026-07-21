"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, EyeOff, Trash2, AlertCircle, Loader2, ExternalLink } from "lucide-react";
import type { ModerationFlag } from "@/lib/moderation/engine";

const BRAND_GREEN = "#166534";
const BRAND_RED   = "#B91C1C";
const BRAND_AMBER = "#F59E0B";

const FLAG_LABEL: Record<string, string> = {
  spam:          "Spam",
  offensive:     "Offensive",
  off_topic:     "Off topic",
  personal_info: "Personal info",
  copyright:     "Copyright",
  low_quality:   "Low quality",
  other:         "Other"
};

const SEVERITY_COLOUR: Record<string, string> = {
  critical: "#B91C1C",
  high:     "#F59E0B",
  normal:   "#166534",
  low:      "#6B7280"
};

export function ModerationRow({ flag, subjectLabel }: { flag: ModerationFlag; subjectLabel: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [note, setNote] = useState("");
  const [showNote, setShowNote] = useState<null | "hidden" | "removed" | "escalated">(null);
  const [error, setError] = useState<string | null>(null);

  function fire(status: "approved" | "hidden" | "removed" | "escalated") {
    setError(null);
    if (status !== "approved" && !showNote) { setShowNote(status); return; }
    startTransition(async () => {
      const res = await fetch(`/api/admin/moderation/${flag.id}`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ status, note: status !== "approved" ? note : undefined })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setError(data.error || "Failed"); return; }
      router.refresh();
    });
  }

  return (
    <li className="rounded-2xl border-2 bg-white p-4 shadow-sm" style={{ borderColor: "rgba(0,0,0,0.08)" }}>
      <div className="flex flex-wrap items-baseline gap-2">
        <span className="rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-white" style={{ backgroundColor: SEVERITY_COLOUR[flag.severity] }}>
          {flag.severity}
        </span>
        <span className="rounded-full bg-neutral-900 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-white">
          {subjectLabel}
        </span>
        <span className="rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wider" style={{ backgroundColor: "rgba(255,179,0,0.20)", color: "#7A4E00" }}>
          {FLAG_LABEL[flag.flag_kind] || flag.flag_kind}
        </span>
        <span className="text-[10.5px] text-neutral-500">via {flag.flag_source.replace(/_/g, " ")}</span>
      </div>

      <p className="mt-2 truncate text-[13.5px] font-black text-neutral-900">
        {flag.subject_display || `${flag.subject_kind} · ${flag.subject_id.slice(0, 8)}`}
      </p>
      <p className="mt-1 text-[10.5px] text-neutral-500 tabular-nums">
        Submitted {new Date(flag.created_at).toLocaleString("en-GB")}
      </p>
      {flag.flag_note && (
        <p className="mt-1 rounded-lg bg-neutral-50 p-2 text-[11.5px] italic text-neutral-700">"{flag.flag_note}"</p>
      )}
      {flag.subject_url && (
        <a href={flag.subject_url} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex items-center gap-1 text-[10.5px] font-black uppercase tracking-wider text-neutral-700 hover:text-neutral-900">
          View in context <ExternalLink size={10}/>
        </a>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-neutral-100 pt-3">
        <button
          type="button"
          onClick={() => fire("approved")}
          disabled={pending}
          className="inline-flex h-9 items-center gap-1.5 rounded-md px-3 text-[11px] font-black uppercase tracking-wider text-white shadow-sm hover:brightness-110 disabled:opacity-50"
          style={{ backgroundColor: BRAND_GREEN }}
        >
          {pending ? <Loader2 size={12} className="animate-spin"/> : <Check size={12}/>} Approve
        </button>
        <button
          type="button"
          onClick={() => fire("hidden")}
          disabled={pending}
          className="inline-flex h-9 items-center gap-1.5 rounded-md bg-neutral-900 px-3 text-[11px] font-black uppercase tracking-wider text-white shadow-sm hover:brightness-125 disabled:opacity-50"
        >
          <EyeOff size={12}/> {showNote === "hidden" ? "Confirm hide" : "Hide"}
        </button>
        <button
          type="button"
          onClick={() => fire("removed")}
          disabled={pending}
          className="inline-flex h-9 items-center gap-1.5 rounded-md px-3 text-[11px] font-black uppercase tracking-wider text-white shadow-sm hover:brightness-110 disabled:opacity-50"
          style={{ backgroundColor: BRAND_RED }}
        >
          <Trash2 size={12}/> {showNote === "removed" ? "Confirm remove" : "Remove"}
        </button>
        <button
          type="button"
          onClick={() => fire("escalated")}
          disabled={pending}
          className="inline-flex h-9 items-center gap-1.5 rounded-md px-3 text-[11px] font-black uppercase tracking-wider text-white shadow-sm hover:brightness-110 disabled:opacity-50"
          style={{ backgroundColor: BRAND_AMBER }}
        >
          <AlertCircle size={12}/> {showNote === "escalated" ? "Confirm escalate" : "Escalate"}
        </button>
        {showNote && (
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Resolution note"
            className="h-9 flex-1 rounded-md border border-neutral-200 px-2 text-[11.5px] outline-none focus:border-neutral-500"
            autoFocus
          />
        )}
        {error && <p className="text-[10.5px] font-bold text-red-800">{error}</p>}
      </div>
    </li>
  );
}
