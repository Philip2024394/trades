"use client";

// Client shell for /admin/image-submissions.
//
// One-image-at-a-time review pattern (right pane) with a thumbnail
// strip (left pane) so admin can jump around the queue but has a
// full-fidelity focused view of whatever they're deciding on.
//
// Keyboard shortcuts (visible in the footer bar):
//   A         approve current
//   R         reject current  (opens note field first)
//   S / →     skip to next
//   ← / ↑     previous
//   /         focus search filter
//
// Every decision hits the API then removes the row from the local
// queue (optimistic). On failure the row bounces back.

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, X, ChevronLeft, ChevronRight, Filter, AlertTriangle, Image as ImageIcon, Loader2 } from "lucide-react";
import type { ImageSubmission } from "@/lib/imageSubmissions";

const CREAM = "#FBF6EC";
const BRAND_BLACK = "#0A0A0A";
const BRAND_YELLOW = "#FFB300";
const GREEN = "#166534";
const RED = "#B91C1C";

export function AdminImageSubmissionsShell({
  initialSubmissions
}: {
  initialSubmissions: ImageSubmission[];
}) {
  const [queue, setQueue] = useState<ImageSubmission[]>(initialSubmissions);
  const [index, setIndex] = useState(0);
  const [filter, setFilter] = useState("");
  const [pendingDecision, setPendingDecision] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [noteOpen, setNoteOpen] = useState(false);
  const [note, setNote] = useState("");

  const filtered = useMemo(() => {
    const q = filter.toLowerCase().trim();
    if (!q) return queue;
    return queue.filter(
      (s) =>
        s.submitterSlug.toLowerCase().includes(q) ||
        (s.submitterDisplay ?? "").toLowerCase().includes(q) ||
        (s.tradeSlug ?? "").toLowerCase().includes(q) ||
        s.keywords.some((k) => k.toLowerCase().includes(q)) ||
        s.qualityFlags.some((f) => f.toLowerCase().includes(q))
    );
  }, [queue, filter]);

  const current = filtered[Math.min(index, filtered.length - 1)] ?? null;

  const goto = useCallback(
    (next: number) => {
      if (filtered.length === 0) return;
      const bounded = ((next % filtered.length) + filtered.length) % filtered.length;
      setIndex(bounded);
      setNoteOpen(false);
      setNote("");
      setError(null);
    },
    [filtered.length]
  );

  const removeAndAdvance = useCallback(
    (id: string) => {
      setQueue((prev) => prev.filter((s) => s.id !== id));
      setNoteOpen(false);
      setNote("");
      // Stay at the same visual index — the row that was there gets
      // replaced by the next one. Clamp when we run past the end.
      setIndex((i) => (i >= filtered.length - 1 ? Math.max(0, filtered.length - 2) : i));
    },
    [filtered.length]
  );

  const submitDecision = useCallback(
    async (decision: "approve" | "reject", withNote?: string) => {
      if (!current || pendingDecision) return;
      setPendingDecision(current.id);
      setError(null);
      try {
        const res = await fetch(
          `/api/admin/image-submissions/${encodeURIComponent(current.id)}/moderate`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ decision, note: withNote ?? note ?? null })
          }
        );
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.ok) {
          setError(data.error ?? "moderation-failed");
          return;
        }
        removeAndAdvance(current.id);
      } catch {
        setError("network-error");
      } finally {
        setPendingDecision(null);
      }
    },
    [current, pendingDecision, note, removeAndAdvance]
  );

  // ─── Keyboard shortcuts ────────────────────────────────────
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      // Don't hijack the keyboard when the user is typing into an
      // input or textarea (search filter, note field).
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable)) {
        if (e.key === "Escape") (el as HTMLElement).blur();
        return;
      }
      if (e.key === "a" || e.key === "A") {
        e.preventDefault();
        submitDecision("approve");
      } else if (e.key === "r" || e.key === "R") {
        e.preventDefault();
        setNoteOpen(true);
      } else if (e.key === "s" || e.key === "S" || e.key === "ArrowRight" || e.key === "ArrowDown") {
        e.preventDefault();
        goto(index + 1);
      } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        goto(index - 1);
      } else if (e.key === "/") {
        e.preventDefault();
        const search = document.getElementById("admin-img-filter") as HTMLInputElement | null;
        search?.focus();
        search?.select();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goto, index, submitDecision]);

  return (
    <main className="min-h-screen" style={{ backgroundColor: CREAM }}>
      <header className="border-b bg-white" style={{ borderColor: "rgba(139,69,19,0.15)" }}>
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 md:px-6">
          <div className="flex items-center gap-3">
            <Link
              href="/admin"
              className="inline-flex items-center gap-1 text-[11px] font-black uppercase tracking-wider text-neutral-500 hover:text-neutral-900"
            >
              <ArrowLeft size={12}/>
              Admin
            </Link>
            <span className="text-neutral-300">/</span>
            <h1 className="text-[15px] font-black text-neutral-900">Image submissions</h1>
            <span className="rounded-full bg-neutral-900 px-2 py-0.5 text-[10px] font-black text-white">
              {filtered.length} to review
            </span>
          </div>
          <div className="relative w-full max-w-xs">
            <Filter
              size={12}
              strokeWidth={2.4}
              className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-400"
            />
            <input
              id="admin-img-filter"
              type="search"
              value={filter}
              onChange={(e) => {
                setFilter(e.target.value);
                setIndex(0);
              }}
              placeholder="Filter by trade / keyword / flag (press /)"
              className="w-full rounded-full border py-1.5 pl-7 pr-3 text-[12px] text-neutral-800 placeholder:text-neutral-400 focus:outline-none focus:ring-2"
              style={{ borderColor: "rgba(139,69,19,0.15)" }}
            />
          </div>
        </div>
      </header>

      {filtered.length === 0 ? (
        <div className="mx-auto max-w-3xl px-4 py-16 text-center md:px-6">
          <div
            className="mx-auto flex h-16 w-16 items-center justify-center rounded-full"
            style={{ backgroundColor: `${BRAND_YELLOW}22` }}
          >
            <ImageIcon size={24} strokeWidth={2.2} style={{ color: BRAND_YELLOW }}/>
          </div>
          <h2 className="mt-4 text-[20px] font-black text-neutral-900">Queue empty.</h2>
          <p className="mt-1 text-[13px] leading-relaxed text-neutral-600">
            No pending or auto-approved images awaiting review. When a trade submits from a live-feed post, they land here.
          </p>
        </div>
      ) : (
        <div className="mx-auto grid max-w-7xl gap-4 px-4 py-6 md:grid-cols-[minmax(0,240px)_minmax(0,1fr)] md:px-6">
          {/* Thumbnail strip */}
          <aside className="max-h-[calc(100vh-140px)] overflow-y-auto rounded-2xl border bg-white p-2" style={{ borderColor: "rgba(139,69,19,0.15)" }}>
            <ul className="flex flex-col gap-1">
              {filtered.map((s, i) => (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => setIndex(i)}
                    className="flex w-full items-center gap-2 rounded-lg p-1.5 text-left transition"
                    style={{
                      backgroundColor: i === index ? "rgba(184,134,11,0.12)" : "transparent",
                      borderLeft: i === index ? `3px solid ${BRAND_YELLOW}` : "3px solid transparent"
                    }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={s.imageUrl}
                      alt=""
                      loading="lazy"
                      className="h-12 w-12 flex-shrink-0 rounded-md object-cover"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[11px] font-black text-neutral-900">
                        {s.submitterDisplay ?? s.submitterSlug}
                      </div>
                      <div className="flex items-center gap-1 text-[9.5px] font-bold uppercase tracking-wider text-neutral-500">
                        <StatusPip status={s.status}/>
                        {s.tradeSlug ?? "no trade"}
                      </div>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          </aside>

          {/* Focused reviewer */}
          <section
            className="flex min-h-[calc(100vh-140px)] flex-col rounded-2xl border bg-white p-4 shadow-sm md:p-6"
            style={{ borderColor: "rgba(139,69,19,0.15)" }}
          >
            {current && (
              <>
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => goto(index - 1)}
                      className="flex h-8 w-8 items-center justify-center rounded-full border hover:bg-neutral-50"
                      style={{ borderColor: "rgba(139,69,19,0.15)" }}
                      aria-label="Previous"
                    >
                      <ChevronLeft size={14}/>
                    </button>
                    <span className="text-[11px] font-black uppercase tracking-wider text-neutral-500">
                      {index + 1} / {filtered.length}
                    </span>
                    <button
                      type="button"
                      onClick={() => goto(index + 1)}
                      className="flex h-8 w-8 items-center justify-center rounded-full border hover:bg-neutral-50"
                      style={{ borderColor: "rgba(139,69,19,0.15)" }}
                      aria-label="Next"
                    >
                      <ChevronRight size={14}/>
                    </button>
                  </div>
                  <StatusPill status={current.status}/>
                </div>

                {/* Image + metadata split */}
                <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,280px)]">
                  <div className="overflow-hidden rounded-xl border bg-neutral-100" style={{ borderColor: "rgba(139,69,19,0.15)" }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={current.imageUrl}
                      alt={current.altText ?? ""}
                      className="block h-full max-h-[70vh] w-full object-contain"
                    />
                  </div>

                  <div className="flex flex-col gap-3 text-[12.5px]">
                    <MetaRow label="Submitter" value={current.submitterDisplay ?? current.submitterSlug}/>
                    <MetaRow label="Slug"      value={current.submitterSlug} mono/>
                    <MetaRow label="Trade"     value={current.tradeSlug ?? "—"}/>
                    <MetaRow label="Alt text"  value={current.altText ?? "— missing —"}/>
                    <div>
                      <div className="text-[9.5px] font-black uppercase tracking-[0.14em] text-neutral-500">Keywords</div>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {current.keywords.length === 0 && (
                          <span className="text-[11.5px] text-neutral-400">none</span>
                        )}
                        {current.keywords.map((k) => (
                          <span key={k} className="rounded-full bg-neutral-100 px-2 py-0.5 text-[10.5px] font-bold text-neutral-700">
                            {k}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div>
                      <div className="text-[9.5px] font-black uppercase tracking-[0.14em] text-neutral-500">Quality</div>
                      <div className="mt-1 flex items-center gap-2">
                        <div className="h-2 flex-1 overflow-hidden rounded-full bg-neutral-100">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${current.qualityScore}%`,
                              backgroundColor:
                                current.qualityScore >= 80 ? GREEN
                                : current.qualityScore >= 50 ? BRAND_YELLOW
                                : RED
                            }}
                          />
                        </div>
                        <span className="text-[11px] font-mono tabular-nums text-neutral-700">{current.qualityScore}</span>
                      </div>
                      {current.qualityFlags.length > 0 && (
                        <ul className="mt-1.5 flex flex-wrap gap-1">
                          {current.qualityFlags.map((f) => (
                            <li key={f} className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-red-700">
                              <AlertTriangle size={9} strokeWidth={2.6}/>
                              {f.replace(/_/g, " ")}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                    <MetaRow label="Submitted" value={new Date(current.createdAt).toLocaleString()}/>
                    {current.sourceCanteenId && (
                      <MetaRow
                        label="Source"
                        value={current.sourcePostId
                          ? `canteen ${current.sourceCanteenId.slice(0, 8)}… · post ${current.sourcePostId.slice(0, 8)}…`
                          : `canteen ${current.sourceCanteenId.slice(0, 8)}…`}
                        mono
                      />
                    )}
                  </div>
                </div>

                {/* Reject note field — hidden until R pressed */}
                {noteOpen && (
                  <div className="mt-4 rounded-xl border-2 border-dashed p-3" style={{ borderColor: `${RED}55` }}>
                    <div className="text-[10px] font-black uppercase tracking-[0.14em]" style={{ color: RED }}>
                      Reject with note (optional)
                    </div>
                    <textarea
                      value={note}
                      onChange={(e) => setNote(e.target.value.slice(0, 500))}
                      placeholder="Why is this being rejected? Visible to admins only."
                      rows={2}
                      autoFocus
                      className="mt-1 w-full resize-none rounded-lg border bg-white px-3 py-2 text-[12.5px] leading-snug text-neutral-800 focus:outline-none focus:ring-2"
                      style={{ borderColor: "rgba(139,69,19,0.15)" }}
                    />
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <span className="text-[10.5px] text-neutral-500">{note.length}/500</span>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => { setNoteOpen(false); setNote(""); }}
                          className="rounded-full border px-3 py-1.5 text-[10.5px] font-black uppercase tracking-wider text-neutral-700 hover:bg-neutral-50"
                          style={{ borderColor: "rgba(139,69,19,0.15)" }}
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={() => submitDecision("reject")}
                          disabled={pendingDecision === current.id}
                          className="inline-flex items-center gap-1 rounded-full px-4 py-1.5 text-[10.5px] font-black uppercase tracking-wider text-white shadow-sm"
                          style={{ backgroundColor: RED }}
                        >
                          {pendingDecision === current.id ? <Loader2 size={11} className="animate-spin"/> : <X size={11} strokeWidth={2.6}/>}
                          Confirm reject
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {error && (
                  <div className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-[11.5px] font-black text-red-700">
                    {error}
                  </div>
                )}

                {/* Decision bar — sticky feel via mt-auto */}
                <div className="mt-auto flex flex-col gap-3 pt-4 md:flex-row md:items-center md:justify-between">
                  <div className="flex flex-wrap items-center gap-2 text-[10px] font-black uppercase tracking-wider text-neutral-500">
                    <KeyHint k="A" label="Approve"/>
                    <KeyHint k="R" label="Reject"/>
                    <KeyHint k="S / →" label="Skip"/>
                    <KeyHint k="←" label="Back"/>
                    <KeyHint k="/" label="Filter"/>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => goto(index + 1)}
                      className="inline-flex items-center gap-1 rounded-full border px-4 py-2 text-[11px] font-black uppercase tracking-wider text-neutral-700 hover:bg-neutral-50"
                      style={{ borderColor: "rgba(139,69,19,0.15)" }}
                    >
                      Skip
                      <ChevronRight size={12} strokeWidth={2.6}/>
                    </button>
                    <button
                      type="button"
                      onClick={() => setNoteOpen(true)}
                      className="inline-flex items-center gap-1 rounded-full px-4 py-2 text-[11px] font-black uppercase tracking-wider text-white shadow-sm"
                      style={{ backgroundColor: RED }}
                    >
                      <X size={12} strokeWidth={2.6}/>
                      Reject
                    </button>
                    <button
                      type="button"
                      onClick={() => submitDecision("approve")}
                      disabled={pendingDecision === current.id}
                      className="inline-flex items-center gap-1 rounded-full px-5 py-2 text-[11px] font-black uppercase tracking-wider text-white shadow-md"
                      style={{ backgroundColor: GREEN }}
                    >
                      {pendingDecision === current.id ? <Loader2 size={12} className="animate-spin"/> : <Check size={12} strokeWidth={2.6}/>}
                      Approve
                    </button>
                  </div>
                </div>
              </>
            )}
          </section>
        </div>
      )}
    </main>
  );
}

// ─── Small helpers ────────────────────────────────────────────

function StatusPip({ status }: { status: ImageSubmission["status"] }) {
  const color = status === "auto_approved" ? GREEN : BRAND_YELLOW;
  return <span aria-hidden className="inline-block h-1.5 w-1.5 flex-shrink-0 rounded-full" style={{ backgroundColor: color }}/>;
}

function StatusPill({ status }: { status: ImageSubmission["status"] }) {
  const label = status === "auto_approved" ? "Auto-approved · spot check" : "Pending review";
  const color = status === "auto_approved" ? GREEN : BRAND_YELLOW;
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wider"
      style={{ backgroundColor: `${color}18`, color }}
    >
      <span aria-hidden className="inline-block h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }}/>
      {label}
    </span>
  );
}

function MetaRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div className="text-[9.5px] font-black uppercase tracking-[0.14em] text-neutral-500">{label}</div>
      <div className={`mt-0.5 text-[12.5px] text-neutral-800 ${mono ? "font-mono text-[11.5px]" : ""}`}>{value}</div>
    </div>
  );
}

function KeyHint({ k, label }: { k: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <kbd className="rounded border bg-white px-1.5 py-0.5 font-mono text-[10px] font-bold text-neutral-800" style={{ borderColor: "rgba(139,69,19,0.20)" }}>{k}</kbd>
      {label}
    </span>
  );
}
