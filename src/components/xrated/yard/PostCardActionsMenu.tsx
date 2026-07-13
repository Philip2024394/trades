"use client";

// PostCardActionsMenu — the in-card 3-dots menu shown on the top-right
// of every Yard post card the signed-in merchant owns. Replaces the
// old /trade-off/yard/manage dashboard. Same pattern every merchant
// already knows from Facebook / LinkedIn / Instagram: dots on your own
// post, tap for action sheet.
//
// Actions match what the deleted YardManageList used to offer:
//   - View     — link to the public post detail page
//   - Boost    — link into the Yard page's ?boost= flow (Stripe)
//   - Archive  — PATCH { status: "archived" }  (or Unarchive for archived)
//   - Delete   — DELETE (confirm before firing, no undo)
//
// Auth: uses the signed-in session cookie via the yard posts API's
// cookie fallback path — no magic-link token needed.

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { MoreHorizontal, Eye, Rocket, Archive, ArchiveRestore, Trash2, Loader2, X } from "lucide-react";

type Status = "live" | "archived";

export function PostCardActionsMenu({
  postId,
  status,
  onArchived,
  onDeleted
}: {
  postId: string;
  status: Status;
  /** Fires after PATCH { status } succeeds so the parent can update
   *  local state. Receives the new status. */
  onArchived?: (next: Status) => void;
  /** Fires after DELETE succeeds so the parent can remove the card. */
  onDeleted?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<null | "archive" | "delete">(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Click-outside to close the menu (desktop dropdown). Mobile bottom
  // sheet has its own backdrop click handler.
  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  async function archiveOrRestore() {
    const next: Status = status === "live" ? "archived" : "live";
    setBusy("archive");
    setError(null);
    try {
      const res = await fetch(`/api/trade-off/yard/posts/${encodeURIComponent(postId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next })
      });
      const data = (await res.json()) as { ok: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Update failed.");
        return;
      }
      onArchived?.(next);
      setOpen(false);
    } catch {
      setError("Network error.");
    } finally {
      setBusy(null);
    }
  }

  async function deleteNow() {
    setBusy("delete");
    setError(null);
    try {
      const res = await fetch(`/api/trade-off/yard/posts/${encodeURIComponent(postId)}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({})
      });
      const data = (await res.json()) as { ok: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Delete failed.");
        return;
      }
      onDeleted?.();
      setConfirmingDelete(false);
      setOpen(false);
    } catch {
      setError("Network error.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div ref={containerRef} className="relative">
      {/* Pulse-animated 3-dot trigger. Subtle — not as loud as the
          Live Listing green dot. Signals "you can act on this" without
          shouting. */}
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Post actions"
        className="group relative inline-flex h-8 w-8 items-center justify-center rounded-full border border-neutral-200 bg-white/90 shadow-sm backdrop-blur transition hover:border-neutral-400 hover:bg-white active:scale-[0.95]"
      >
        <span
          aria-hidden
          className="absolute inset-0 rounded-full opacity-0 transition group-hover:opacity-100"
          style={{ boxShadow: "0 0 0 3px rgba(255,179,0,0.20)" }}
        />
        <span aria-hidden className="absolute -inset-1 animate-ping rounded-full opacity-40 group-hover:opacity-0" style={{ backgroundColor: "rgba(255,179,0,0.35)" }}/>
        <MoreHorizontal size={16} strokeWidth={2.4} className="relative text-neutral-700"/>
      </button>

      {/* Menu — mobile bottom sheet, desktop dropdown. Same content,
          different container. Tailwind breakpoint switch. */}
      {open && (
        <>
          {/* Mobile backdrop */}
          <div
            className="fixed inset-0 z-40 bg-black/40 md:hidden"
            onClick={() => setOpen(false)}
            aria-hidden
          />

          <div
            role="menu"
            aria-orientation="vertical"
            className="fixed inset-x-0 bottom-0 z-50 rounded-t-2xl border-t bg-white p-3 pb-6 shadow-2xl md:absolute md:bottom-auto md:left-auto md:right-0 md:top-full md:mt-1 md:w-56 md:rounded-xl md:border md:p-1.5 md:pb-1.5 md:shadow-lg"
            style={{ borderColor: "rgba(139,69,19,0.15)" }}
          >
            {/* Mobile sheet handle */}
            <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-neutral-300 md:hidden"/>

            {/* Mobile close row */}
            <div className="mb-2 flex items-center justify-between md:hidden">
              <span className="text-[11px] font-black uppercase tracking-[0.14em] text-neutral-500">
                Post actions
              </span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close actions"
                className="flex h-8 w-8 items-center justify-center rounded-full bg-neutral-100"
              >
                <X size={14} strokeWidth={2.4}/>
              </button>
            </div>

            <Link
              href={`/trade-off/yard/posts/${encodeURIComponent(postId)}`}
              role="menuitem"
              className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-[13px] font-bold text-neutral-800 hover:bg-neutral-100 md:py-2 md:text-[12px]"
              onClick={() => setOpen(false)}
            >
              <Eye size={15} strokeWidth={2.2} className="text-neutral-500"/>
              View post
            </Link>

            <Link
              href={`/trade-off/yard?boost=${encodeURIComponent(postId)}`}
              role="menuitem"
              className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-[13px] font-bold text-neutral-800 hover:bg-neutral-100 md:py-2 md:text-[12px]"
              onClick={() => setOpen(false)}
            >
              <Rocket size={15} strokeWidth={2.2} className="text-neutral-500"/>
              Boost post
            </Link>

            <button
              type="button"
              role="menuitem"
              disabled={busy !== null}
              onClick={archiveOrRestore}
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-[13px] font-bold text-neutral-800 hover:bg-neutral-100 disabled:opacity-50 md:py-2 md:text-[12px]"
            >
              {status === "live" ? (
                <>
                  <Archive size={15} strokeWidth={2.2} className="text-neutral-500"/>
                  {busy === "archive" ? "Archiving…" : "Archive"}
                </>
              ) : (
                <>
                  <ArchiveRestore size={15} strokeWidth={2.2} className="text-neutral-500"/>
                  {busy === "archive" ? "Restoring…" : "Restore to live"}
                </>
              )}
              {busy === "archive" && <Loader2 size={13} className="ml-auto animate-spin"/>}
            </button>

            {/* Divider */}
            <div className="my-1 h-px bg-neutral-200"/>

            {!confirmingDelete ? (
              <button
                type="button"
                role="menuitem"
                disabled={busy !== null}
                onClick={() => setConfirmingDelete(true)}
                className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-[13px] font-bold text-red-600 hover:bg-red-50 disabled:opacity-50 md:py-2 md:text-[12px]"
              >
                <Trash2 size={15} strokeWidth={2.2}/>
                Delete post
              </button>
            ) : (
              <div className="rounded-lg border border-red-200 bg-red-50 p-2.5">
                <p className="text-[12px] font-bold text-red-800">Delete this post?</p>
                <p className="mt-0.5 text-[11px] text-red-700">This cannot be undone.</p>
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={deleteNow}
                    disabled={busy !== null}
                    className="inline-flex flex-1 items-center justify-center gap-1 rounded-full bg-red-600 px-3 py-1.5 text-[11px] font-black uppercase tracking-wider text-white shadow-sm disabled:opacity-50"
                  >
                    {busy === "delete" && <Loader2 size={11} className="animate-spin"/>}
                    Delete
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmingDelete(false)}
                    disabled={busy !== null}
                    className="inline-flex flex-1 items-center justify-center rounded-full border border-red-300 bg-white px-3 py-1.5 text-[11px] font-black uppercase tracking-wider text-red-700 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {error && (
              <p className="mt-2 rounded-md bg-red-50 px-2 py-1.5 text-[11px] text-red-700">
                {error}
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
