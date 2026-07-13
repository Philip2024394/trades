"use client";

// NotificationsPopover — the dropdown that opens when Mike taps the
// header bell. Reads /api/notebook/actions (same endpoint driving the
// red bell badge). Facebook-style: newest first, action pill on each
// item, "View all" footer link routing to the full notifications page.
//
// Two layouts share the same component:
//   - Desktop: absolute popover positioned by the parent bell
//   - Mobile:  slide-up bottom sheet
// The parent picks which mode by passing the `mode` prop.

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bell, X, ArrowRight } from "lucide-react";

export type NotebookAction = {
  id: string;
  kind: string;
  title: string;
  deadlineAt: string | null;
  actionLabel: string | null;
  actionHref: string | null;
};

export function NotificationsPopover({
  open,
  onClose,
  viewAllHref,
  mode
}: {
  open: boolean;
  onClose: () => void;
  /** Route the "View all" footer link uses. Usually the merchant's
   *  notifications page. */
  viewAllHref: string;
  mode: "desktop" | "mobile";
}) {
  const [actions, setActions] = useState<NotebookAction[]>([]);
  const [loading, setLoading] = useState(false);

  // Body scroll lock only for the mobile bottom sheet — desktop popover
  // sits inside the header and should let the page scroll behind it.
  useEffect(() => {
    if (!open || mode !== "mobile") return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open, mode]);

  // Fetch when the popover opens. Cache-busts with no-store so the
  // list is always fresh (badge count elsewhere polls every 60s).
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    fetch("/api/notebook/actions", { credentials: "include", cache: "no-store" })
      .then((r) => r.ok ? r.json() : { actions: [] })
      .then((data: { actions?: NotebookAction[] }) => {
        if (cancelled) return;
        setActions(Array.isArray(data?.actions) ? data.actions : []);
      })
      .catch(() => {
        if (!cancelled) setActions([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [open]);

  // Close on Escape.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const body = (
    <>
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#E5D9BD] px-4 py-3">
        <div className="flex items-center gap-2">
          <Bell size={15} strokeWidth={2.4} className="text-[#B8860B]"/>
          <span className="text-[13px] font-black text-[#1B1A17]">Notifications</span>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close notifications"
          className="flex h-7 w-7 items-center justify-center rounded-full text-[#1B1A17]/60 hover:bg-black/[0.05]"
        >
          <X size={14} strokeWidth={2.4}/>
        </button>
      </div>

      {/* List */}
      <div className="max-h-[60vh] overflow-y-auto md:max-h-[360px]">
        {loading && actions.length === 0 ? (
          <div className="px-4 py-8 text-center text-[12px] font-bold text-[#1B1A17]/50">
            Loading…
          </div>
        ) : actions.length === 0 ? (
          <div className="flex flex-col items-center gap-1.5 px-4 py-10 text-center">
            <span className="text-[24px]">🎉</span>
            <p className="text-[13px] font-black text-[#1B1A17]">You&apos;re all caught up.</p>
            <p className="text-[11.5px] text-[#1B1A17]/50">No pending actions right now.</p>
          </div>
        ) : (
          <ul className="divide-y divide-[#E5D9BD]/60">
            {actions.map((a) => (
              <li key={a.id}>
                <div className="flex items-start gap-3 px-4 py-3 transition hover:bg-[#FFF8E6]">
                  <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-[#FFF8E6]">
                    <Bell size={14} className="text-[#B8860B]" strokeWidth={2.4}/>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-black leading-tight text-[#1B1A17]">
                      {a.title}
                    </div>
                    {a.deadlineAt && (
                      <div className="mt-0.5 text-[10.5px] font-bold text-amber-700">
                        {formatDeadline(a.deadlineAt)}
                      </div>
                    )}
                  </div>
                  {a.actionHref && a.actionLabel && (
                    <Link
                      href={a.actionHref}
                      onClick={onClose}
                      className="inline-flex h-7 flex-shrink-0 items-center gap-1 rounded-full px-2.5 text-[10px] font-black uppercase tracking-wider text-[#0A0A0A] shadow-sm"
                      style={{ backgroundColor: "#FFB300" }}
                    >
                      {a.actionLabel}
                    </Link>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-[#E5D9BD]/60 px-3 py-2">
        <Link
          href={viewAllHref}
          onClick={onClose}
          className="flex items-center justify-center gap-1 rounded-full py-1.5 text-[11.5px] font-black uppercase tracking-wider text-[#B8860B] hover:bg-[#FFF8E6]"
        >
          View all notifications
          <ArrowRight size={11} strokeWidth={2.6}/>
        </Link>
      </div>
    </>
  );

  if (mode === "desktop") {
    return (
      <>
        {/* Click-outside catcher */}
        <div
          aria-hidden
          className="fixed inset-0 z-30"
          onClick={onClose}
        />
        {/* Popover — anchored below the bell by the parent */}
        <div
          role="dialog"
          aria-label="Notifications"
          className="absolute right-0 top-full z-40 mt-1.5 w-[340px] overflow-hidden rounded-xl border border-[#E5D9BD] bg-white shadow-2xl"
        >
          {body}
        </div>
      </>
    );
  }

  // Mobile — slide-up bottom sheet with a backdrop.
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Notifications"
      className="fixed inset-0 z-[80] flex items-end justify-center"
      onClick={onClose}
    >
      <div
        aria-hidden
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
      />
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative z-10 w-full max-w-md overflow-hidden rounded-t-2xl bg-white shadow-2xl"
      >
        {body}
      </div>
    </div>
  );
}

function formatDeadline(iso: string): string {
  const ms = Date.parse(iso) - Date.now();
  if (!Number.isFinite(ms)) return "";
  if (ms <= 0) return "Overdue";
  const hours = Math.round(ms / 3_600_000);
  if (hours < 24) return `Respond within ${hours}h`;
  const days = Math.round(hours / 24);
  return `Respond within ${days}d`;
}
