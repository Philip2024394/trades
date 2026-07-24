"use client";

// Review Queue — approve / reject / archive / merge.
// Every action calls /api/admin/nex/review/[id] then reloads the row.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, XCircle, Archive, GitMerge, Loader2 } from "lucide-react";

type ReviewItem = {
  id: string; kind: string; target_entry_id: string | null; proposed_json: Record<string, unknown>;
  merchant_context: Record<string, unknown> | null;
  submitted_by: string; submitted_by_kind: string; submitted_at: string;
  status: string; reviewer_id: string | null; reviewed_at: string | null; review_notes: string | null;
};

export type CurrentEntryLookup = Record<string, { title: string; summary: string; confidence: number; version: number }>;

const STATUSES = ["pending", "approved", "rejected", "merged", "archived"];
const KINDS    = ["", "create", "edit", "correction", "delete", "edge", "teach"];
const KIND_LABEL = KINDS.reduce<Record<string, string>>((acc, k) => {
  acc[k] = k === "" ? "All" : k[0].toUpperCase() + k.slice(1);
  return acc;
}, {});

export function ReviewQueue({ items, currentByEntry, filters }: { items: ReviewItem[]; currentByEntry?: CurrentEntryLookup; filters: { status: string; kind: string; by: string } }) {
  const router = useRouter();
  return (
    <>
      <form className="mb-4 flex flex-wrap gap-2" action="/admin/nex/review">
        <select name="status" defaultValue={filters.status} className="rounded-lg border border-neutral-300 bg-white px-2 py-1.5 text-[12px]">
          {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select name="kind" defaultValue={filters.kind} className="rounded-lg border border-neutral-300 bg-white px-2 py-1.5 text-[12px]">
          {KINDS.map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
        </select>
        <select name="by" defaultValue={filters.by} className="rounded-lg border border-neutral-300 bg-white px-2 py-1.5 text-[12px]">
          <option value="">Any submitter</option>
          <option value="staff">Staff</option>
          <option value="merchant">Merchant</option>
          <option value="ai">AI</option>
          <option value="builder">Builder</option>
        </select>
        <button className="rounded-lg bg-neutral-900 px-3 py-1.5 text-[12px] font-black text-white">Filter</button>
      </form>

      {items.length === 0 && (
        <div className="rounded-2xl border border-neutral-200 bg-white p-8 text-center text-[13px] text-neutral-500">
          No items match. Nothing to review right now.
        </div>
      )}

      <div className="space-y-3">
        {items.map((it) => <ReviewCard key={it.id} item={it} current={it.target_entry_id ? currentByEntry?.[it.target_entry_id] : undefined} onDone={() => router.refresh()}/>)}
      </div>
    </>
  );
}

function ReviewCard({ item, current, onDone }: { item: ReviewItem; current?: CurrentEntryLookup[string]; onDone: () => void }) {
  const [busy, setBusy] = useState<"approve" | "reject" | "archive" | "merge" | null>(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function act(action: "approve" | "reject" | "archive" | "merge") {
    if (action === "reject" && !note.trim()) { setError("Rejection requires a note"); return; }
    setBusy(action); setError(null);
    try {
      const res = await fetch(`/api/admin/nex/review/${item.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, notes: note.trim() || undefined })
      });
      const json = await res.json();
      if (json.ok) onDone();
      else setError(json.error ?? `${action} failed`);
    } catch (e) {
      setError(e instanceof Error ? e.message : `${action} failed`);
    } finally { setBusy(null); }
  }

  const proposed = item.proposed_json as Record<string, unknown>;
  const isPending = item.status === "pending";

  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-4">
      <div className="mb-2 flex items-center gap-2 text-[10px] font-black uppercase tracking-wider">
        <span className="rounded-full bg-neutral-900 px-2 py-0.5 text-white">{item.kind}</span>
        <span className="rounded-full border border-neutral-300 px-2 py-0.5 text-neutral-700">from {item.submitted_by_kind}: {item.submitted_by}</span>
        <span className="ml-auto text-neutral-500">{new Date(item.submitted_at).toLocaleString("en-GB")}</span>
      </div>

      {item.kind === "edit" && current ? (
        <div className="mb-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <div className="rounded-lg bg-neutral-50 p-2 text-[12px]">
            <p className="text-[9px] font-black uppercase tracking-wider text-neutral-500">Current · v{current.version}</p>
            <p className="mt-1 font-black">{current.title}</p>
            <p className="mt-1 text-neutral-700">{current.summary}</p>
            <p className="mt-1 text-[10px] text-neutral-500">Confidence {current.confidence}%</p>
          </div>
          <div className="rounded-lg bg-green-50 p-2 text-[12px]">
            <p className="text-[9px] font-black uppercase tracking-wider text-green-800">Proposed</p>
            {typeof proposed.title === "string" && <p className="mt-1 font-black">{String(proposed.title)}</p>}
            {typeof proposed.summary === "string" && <p className="mt-1 text-neutral-800">{String(proposed.summary)}</p>}
            {typeof proposed.confidence === "number" && <p className="mt-1 text-[10px] text-neutral-500">Confidence {String(proposed.confidence)}%</p>}
            {typeof proposed.change_summary === "string" && (
              <p className="mt-1 text-[10px] italic text-neutral-600">Reason: {String(proposed.change_summary)}</p>
            )}
          </div>
        </div>
      ) : (
        <>
          {typeof proposed.title === "string" && <p className="text-[14px] font-black">{String(proposed.title)}</p>}
          {typeof proposed.summary === "string" && <p className="mt-1 text-[12px] text-neutral-700">{String(proposed.summary)}</p>}
        </>
      )}
      {typeof proposed.correction === "string" && (
        <div className="mt-2 rounded-lg bg-amber-50 p-2 text-[12px] text-amber-900">
          <span className="font-black">Correction:</span> {String(proposed.correction)}
        </div>
      )}
      {Array.isArray(proposed.sources) && proposed.sources.length > 0 && (
        <div className="mt-2 space-y-1">
          <p className="text-[10px] font-black uppercase tracking-wider text-neutral-500">Sources</p>
          {(proposed.sources as Array<Record<string, unknown>>).map((s, i) => {
            const tier = typeof s.tier === "string" ? s.tier : "unverified";
            const cls =
              tier === "official"    ? "bg-green-100 text-green-800" :
              tier === "industry"    ? "bg-blue-100 text-blue-800" :
              tier === "educational" ? "bg-purple-100 text-purple-800" :
              tier === "community"   ? "bg-amber-100 text-amber-800" :
                                        "bg-red-100 text-red-800";
            return (
              <div key={i} className="flex flex-wrap items-center gap-1.5 text-[11px]">
                <span className={"rounded-full px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider " + cls}>
                  {tier}
                </span>
                <span className="font-black text-neutral-800">{String(s.title ?? "(untitled)")}</span>
                {typeof s.url === "string" && s.url && (
                  <a href={s.url} target="_blank" rel="noreferrer" className="text-[10px] text-blue-700 underline">link</a>
                )}
                {typeof s.date_published === "string" && (
                  <span className="text-[10px] text-neutral-500">({String(s.date_published)})</span>
                )}
                {typeof s.verification_note === "string" && (
                  <span className="text-[10px] italic text-neutral-500">{String(s.verification_note)}</span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {item.merchant_context && (
        <details className="mt-2 rounded-lg bg-neutral-50 p-2 text-[11px]">
          <summary className="cursor-pointer font-black text-neutral-700">Merchant context</summary>
          <pre className="mt-1 whitespace-pre-wrap text-neutral-600">{JSON.stringify(item.merchant_context, null, 2)}</pre>
        </details>
      )}

      {item.status !== "pending" && (
        <p className="mt-2 text-[11px] text-neutral-500">
          {item.status} by {item.reviewer_id} · {item.review_notes ? `"${item.review_notes}"` : "no notes"}
        </p>
      )}

      {isPending && (
        <>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Optional note (required for reject)"
            className="mt-3 w-full rounded-lg border border-neutral-300 bg-white px-2 py-1.5 text-[12px]"
          />
          {error && <p className="mt-1 text-[11px] font-black text-red-700">{error}</p>}
          <div className="mt-2 flex flex-wrap gap-1.5">
            <ActionButton kind="approve"  busy={busy} icon={<CheckCircle2 size={12}/>} onClick={() => act("approve")}/>
            <ActionButton kind="reject"   busy={busy} icon={<XCircle size={12}/>}       onClick={() => act("reject")}/>
            <ActionButton kind="archive"  busy={busy} icon={<Archive size={12}/>}       onClick={() => act("archive")}/>
            <ActionButton kind="merge"    busy={busy} icon={<GitMerge size={12}/>}      onClick={() => alert("Use the row's Merge action once we ship the two-item merge picker")}/>
          </div>
        </>
      )}
    </div>
  );
}

function ActionButton({ kind, busy, icon, onClick }: { kind: string; busy: string | null; icon: React.ReactNode; onClick: () => void }) {
  const isBusy = busy === kind;
  const anyBusy = busy !== null;
  return (
    <button
      onClick={onClick}
      disabled={anyBusy}
      className={"inline-flex items-center gap-1 rounded-full border px-3 py-1 text-[11px] font-black transition disabled:opacity-40 " +
        (kind === "approve" ? "border-green-600 bg-green-50 text-green-800 hover:bg-green-100" :
         kind === "reject"  ? "border-red-600 bg-red-50 text-red-800 hover:bg-red-100" :
                              "border-neutral-300 bg-white text-neutral-700 hover:border-neutral-900")}
    >
      {isBusy ? <Loader2 size={12} className="animate-spin"/> : icon} {kind}
    </button>
  );
}
