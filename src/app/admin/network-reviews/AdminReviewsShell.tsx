"use client";

// Admin reviews moderation UI. Filter by status, freeze/remove/verify
// with a required reason. Every action posts to the real endpoint.

import { useMemo, useState } from "react";
import Link from "next/link";
import { Star, Clock, ShieldAlert, ShieldCheck, Trash2, Filter, X } from "lucide-react";

type AdminReviewRow = {
  id: string;
  merchantSlug: string;
  reviewer: { displayName: string; tradeLabel: string; city: string };
  overall: number;
  body: string;
  status: string;
  publishAt: string | null;
  createdAt: string;
  adminAction: string | null;
  adminActionReason: string | null;
};

type StatusFilter = "all" | "pending" | "frozen";

export function AdminReviewsShell({ rows }: { rows: AdminReviewRow[] }) {
  const [filter, setFilter] = useState<StatusFilter>("all");
  const shown = useMemo(() => {
    if (filter === "all") return rows;
    return rows.filter((r) => r.status === filter);
  }, [rows, filter]);

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100">
      <div className="mx-auto max-w-4xl px-4 py-8">
        <div className="flex items-center gap-2">
          <ShieldCheck size={16} className="text-amber-400"/>
          <span className="text-[10px] font-black uppercase tracking-[0.28em] text-amber-400">Admin · reviews</span>
        </div>
        <h1 className="mt-2 text-[24px] font-black text-white">
          Moderation queue · {rows.length}
        </h1>
        <p className="mt-1 text-[13px] text-neutral-400">
          Every action here is publicly logged on the review row and via `hammerex_network_review_events`.
        </p>

        <div className="mt-5 flex items-center gap-2">
          <div className="flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-neutral-500">
            <Filter size={11}/>
            Status
          </div>
          <FilterChip active={filter === "all"} onClick={() => setFilter("all")} label="All"/>
          <FilterChip active={filter === "pending"} onClick={() => setFilter("pending")} label="Pending"/>
          <FilterChip active={filter === "frozen"} onClick={() => setFilter("frozen")} label="Frozen"/>
        </div>

        <ul className="mt-6 flex flex-col gap-3">
          {shown.length === 0 ? (
            <li className="rounded-2xl border border-neutral-800 bg-neutral-900 p-8 text-center text-[13px] text-neutral-400">
              Nothing in this bucket. The queue is clear.
            </li>
          ) : (
            shown.map((r) => (
              <li key={r.id}>
                <AdminRow row={r}/>
              </li>
            ))
          )}
        </ul>
      </div>
    </main>
  );
}

function AdminRow({ row }: { row: AdminReviewRow }) {
  const [action, setAction] = useState<null | "freeze" | "remove" | "verify">(null);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [completed, setCompleted] = useState<null | "freeze" | "remove" | "verify">(null);

  const remaining = row.publishAt ? formatRemaining(row.publishAt) : null;

  async function submit() {
    if (!action) return;
    if (reason.trim().length < 10) {
      setError("Reason must be at least 10 characters");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/reviews/${row.id}/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, reason: reason.trim() })
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error ?? "unknown-error");
        return;
      }
      setCompleted(action);
      setAction(null);
      setReason("");
    } finally {
      setSubmitting(false);
    }
  }

  const isPending = row.status === "pending";
  const isFrozen = row.status === "frozen";

  return (
    <article className="rounded-2xl border border-neutral-800 bg-neutral-900 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <Star size={13} fill="#FFB300" color="#FFB300" strokeWidth={0}/>
            <span className="text-[16px] font-black tabular-nums text-white">{row.overall.toFixed(1)}</span>
            <span className="text-[11px] font-black uppercase tracking-wider text-neutral-500">
              from {row.reviewer.displayName}
            </span>
          </div>
          <div className="mt-0.5 text-[11px] text-neutral-500">
            {row.reviewer.tradeLabel}{row.reviewer.city ? ` · ${row.reviewer.city}` : ""} → <Link href={`/trade/${row.merchantSlug}/reviews`} className="text-amber-400 hover:underline">{row.merchantSlug}</Link>
          </div>
        </div>
        <span
          className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-black uppercase tracking-wider"
          style={{
            backgroundColor: isFrozen ? "#7f1d1d" : isPending ? "#7A5300" : "#166534",
            color: "#FFFFFF"
          }}
        >
          {isPending && <><Clock size={10} strokeWidth={2.5}/> {remaining ?? "pending"}</>}
          {isFrozen && <><ShieldAlert size={10} strokeWidth={2.5}/> frozen</>}
          {!isPending && !isFrozen && row.status}
        </span>
      </div>

      <p className="mt-3 rounded-lg border border-neutral-800 bg-neutral-950 p-3 text-[13px] leading-relaxed text-neutral-200">
        "{row.body}"
      </p>

      {row.adminActionReason && (
        <div className="mt-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-2 text-[11px] text-amber-200">
          <span className="font-black uppercase tracking-wider">Prior admin note:</span> {row.adminActionReason}
        </div>
      )}

      {completed && (
        <div className="mt-3 rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-2 text-[11px] font-black uppercase tracking-wider text-emerald-300">
          <ShieldCheck size={11} strokeWidth={2.5} className="mr-1 inline"/>
          Applied: {completed}
        </div>
      )}

      {action ? (
        <div className="mt-3 rounded-lg border border-neutral-800 bg-neutral-950 p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-[0.22em] text-neutral-400">
              Reason for {action}
            </span>
            <button type="button" onClick={() => { setAction(null); setError(null); }} className="text-neutral-500 hover:text-neutral-300" aria-label="Cancel">
              <X size={13}/>
            </button>
          </div>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value.slice(0, 500))}
            rows={2}
            placeholder="Publicly-visible reason. Reviewer + merchant see this."
            className="w-full rounded border border-neutral-800 bg-neutral-950 p-2 text-[13px] text-neutral-100 focus:outline-none focus:border-amber-400"
          />
          {error && <div className="mt-2 text-[11px] text-red-400">{error}</div>}
          <button
            type="button"
            disabled={submitting || reason.trim().length < 10}
            onClick={submit}
            className="mt-2 inline-flex h-9 items-center gap-1.5 rounded-full px-4 text-[11px] font-black uppercase tracking-wider text-neutral-950 shadow-sm disabled:cursor-not-allowed disabled:opacity-50"
            style={{
              backgroundColor: action === "verify" ? "#4ade80" : action === "freeze" ? "#facc15" : "#f87171"
            }}
          >
            {submitting ? "Applying..." : `Confirm ${action}`}
          </button>
        </div>
      ) : (
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setAction("verify")}
            className="inline-flex h-9 items-center gap-1.5 rounded-full border border-emerald-500/40 px-3 text-[11px] font-black uppercase tracking-wider text-emerald-300 hover:bg-emerald-500/10"
          >
            <ShieldCheck size={11} strokeWidth={2.5}/>
            Verify
          </button>
          {!isFrozen && (
            <button
              type="button"
              onClick={() => setAction("freeze")}
              className="inline-flex h-9 items-center gap-1.5 rounded-full border border-amber-500/40 px-3 text-[11px] font-black uppercase tracking-wider text-amber-300 hover:bg-amber-500/10"
            >
              <ShieldAlert size={11} strokeWidth={2.5}/>
              Freeze
            </button>
          )}
          <button
            type="button"
            onClick={() => setAction("remove")}
            className="inline-flex h-9 items-center gap-1.5 rounded-full border border-red-500/40 px-3 text-[11px] font-black uppercase tracking-wider text-red-300 hover:bg-red-500/10"
          >
            <Trash2 size={11} strokeWidth={2.5}/>
            Remove
          </button>
        </div>
      )}
    </article>
  );
}

function FilterChip({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-7 items-center rounded-full border px-3 text-[11px] font-black uppercase tracking-wider transition"
      style={
        active
          ? { backgroundColor: "#FFB300", borderColor: "#FFB300", color: "#0A0A0A" }
          : { backgroundColor: "transparent", borderColor: "#525252", color: "#a3a3a3" }
      }
    >
      {label}
    </button>
  );
}

function formatRemaining(iso: string): string {
  const ms = Date.parse(iso) - Date.now();
  if (ms <= 0) return "publishes now";
  const hours = Math.floor(ms / (60 * 60 * 1000));
  if (hours < 1) return `${Math.floor(ms / 60000)}m left`;
  if (hours < 24) return `${hours}h left`;
  return `${Math.floor(hours / 24)}d left`;
}
