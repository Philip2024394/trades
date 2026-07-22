"use client";

// Interactive gaps table — expands each row on click, shows the full
// sample reply, and offers three actions per gap: mark reviewed,
// promote to knowledge base (writes a draft entry admin can polish),
// or dismiss.

import { useState } from "react";
import { ChevronDown, ChevronRight, CheckCircle2, BookPlus, XCircle, Loader2 } from "lucide-react";

type GapRow = {
  id:                 string;
  surface:            string;
  sample_question:    string;
  sample_reply:       string;
  thumbs_down_count:  number;
  status:             string;
  first_flagged_at:   string;
  last_flagged_at:    string;
  notes:              string | null;
};

export function GapsTable({ rows }: { rows: GapRow[] }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  async function act(id: string, action: "reviewed" | "promoted" | "dismissed", notes?: string) {
    setBusyId(id);
    try {
      const res = await fetch("/api/admin/mate/gaps", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ id, action, notes })
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error ?? "action_failed");
      setDismissed((prev) => new Set(prev).add(id));
    } catch (e) {
      alert(e instanceof Error ? e.message : "Action failed");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white">
      {rows.map((r) => {
        if (dismissed.has(r.id)) return null;
        const isOpen = openId === r.id;
        const isBusy = busyId === r.id;
        return (
          <div key={r.id} className="border-b border-neutral-100 last:border-b-0">
            <button
              onClick={() => setOpenId(isOpen ? null : r.id)}
              className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-neutral-50"
            >
              {isOpen ? <ChevronDown size={14}/> : <ChevronRight size={14}/>}
              <span className="w-14 text-[10px] font-black uppercase tracking-wider text-neutral-500">{r.surface}</span>
              <span className="w-8 text-center text-[13px] font-black text-red-600">{r.thumbs_down_count}</span>
              <span className="flex-1 truncate text-[13px] font-semibold">{r.sample_question}</span>
              <span className="text-[10px] uppercase tracking-wider text-neutral-500">{r.status}</span>
            </button>
            {isOpen && (
              <div className="border-t border-neutral-100 bg-neutral-50 p-4">
                <div className="mb-3">
                  <p className="mb-1 text-[10px] font-black uppercase tracking-wider text-neutral-500">Question</p>
                  <p className="text-[13px]">{r.sample_question}</p>
                </div>
                <div className="mb-3">
                  <p className="mb-1 text-[10px] font-black uppercase tracking-wider text-neutral-500">Mate&rsquo;s reply (thumbs-down)</p>
                  <p className="whitespace-pre-wrap rounded-lg border border-neutral-200 bg-white p-2 text-[13px] text-neutral-800">{r.sample_reply}</p>
                </div>
                <div className="mb-3 text-[11px] text-neutral-500">
                  First flagged {new Date(r.first_flagged_at).toLocaleString()} · Last {new Date(r.last_flagged_at).toLocaleString()}
                </div>
                {r.status === "open" && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => act(r.id, "reviewed")}
                      disabled={isBusy}
                      className="flex items-center gap-1.5 rounded-full border border-neutral-300 bg-white px-3 py-1.5 text-[11px] font-black hover:bg-neutral-100 disabled:opacity-50"
                    >
                      {isBusy ? <Loader2 size={11} className="animate-spin"/> : <CheckCircle2 size={11}/>}
                      Mark reviewed
                    </button>
                    <button
                      onClick={() => act(r.id, "promoted")}
                      disabled={isBusy}
                      className="flex items-center gap-1.5 rounded-full bg-neutral-900 px-3 py-1.5 text-[11px] font-black text-white hover:bg-neutral-800 disabled:opacity-50"
                    >
                      {isBusy ? <Loader2 size={11} className="animate-spin"/> : <BookPlus size={11}/>}
                      Promote to knowledge base
                    </button>
                    <button
                      onClick={() => act(r.id, "dismissed")}
                      disabled={isBusy}
                      className="flex items-center gap-1.5 rounded-full border border-neutral-300 bg-white px-3 py-1.5 text-[11px] font-black text-neutral-500 hover:bg-neutral-100 disabled:opacity-50"
                    >
                      {isBusy ? <Loader2 size={11} className="animate-spin"/> : <XCircle size={11}/>}
                      Dismiss
                    </button>
                  </div>
                )}
                {r.notes && (
                  <p className="mt-2 text-[11px] text-neutral-500">Notes: {r.notes}</p>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
