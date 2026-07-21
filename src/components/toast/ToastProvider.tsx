"use client";

// Global toast notification system.
//
// Bottom-left slide-up container that surfaces short confirmations,
// info messages, warnings, or errors from anywhere in the app. Any
// component can fire a toast via useToast().push(...) — no prop
// drilling needed.
//
// Use cases:
//   • "Post queued — landing on the Yard at 8am"      (info)
//   • "Cutout ready — 3/50 used this month"           (success)
//   • "Yard cap reached. Post lives in your canteen." (warning)
//   • "Schedule failed — try again"                   (error)
//
// Auto-dismisses after 6s (info/success) or 10s (warning/error).
// Manually dismissable via the × button. Non-blocking — the container
// has pointer-events:none except on the toast itself.

import { createContext, useContext, useState, useCallback, useEffect } from "react";
import { X, Info, CheckCircle2, AlertTriangle, AlertCircle } from "lucide-react";

const BRAND_YELLOW = "#FFB300";
const BRAND_BLACK  = "#0A0A0A";

export type ToastKind = "info" | "success" | "warning" | "error";

export type Toast = {
  id:     string;
  kind:   ToastKind;
  title:  string;
  body?:  string;
  /** Optional action link — appears as an underlined chevron the
   *  merchant can tap to jump somewhere related (e.g. the scheduled-
   *  posts dashboard). */
  action?: { label: string; href: string };
  /** ms before auto-dismiss. Defaults per kind. */
  ttlMs?:  number;
};

type ToastContextValue = {
  push:     (t: Omit<Toast, "id">) => string;
  dismiss:  (id: string) => void;
  clearAll: () => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const DEFAULT_TTL: Record<ToastKind, number> = {
  info:    6000,
  success: 6000,
  warning: 10_000,
  error:   10_000
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const push = useCallback((t: Omit<Toast, "id">): string => {
    const id = `t-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setToasts((cur) => [...cur, { id, ...t }]);
    return id;
  }, []);

  const dismiss = useCallback((id: string) => {
    setToasts((cur) => cur.filter((t) => t.id !== id));
  }, []);

  const clearAll = useCallback(() => {
    setToasts([]);
  }, []);

  return (
    <ToastContext.Provider value={{ push, dismiss, clearAll }}>
      {children}
      {/* Toast container — bottom-left, fixed. Container itself
          doesn't intercept clicks so the app underneath stays fully
          usable while a toast is visible. */}
      <div
        aria-live="polite"
        aria-atomic="true"
        className="pointer-events-none fixed inset-x-0 bottom-0 z-[200] flex flex-col-reverse gap-2 p-3 sm:inset-x-auto sm:left-4 sm:bottom-4 sm:max-w-sm sm:p-0"
      >
        {toasts.map((t) => (
          <ToastCard key={t.id} toast={t} onDismiss={() => dismiss(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    // Safe no-op fallback so a caller outside the provider doesn't
    // crash the app — useful in tests + shell-less admin pages.
    return {
      push:     () => "",
      dismiss:  () => {},
      clearAll: () => {}
    };
  }
  return ctx;
}

// ─── Card ─────────────────────────────────────────────────────

function ToastCard({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  const ttl = toast.ttlMs ?? DEFAULT_TTL[toast.kind];

  useEffect(() => {
    if (ttl <= 0) return;
    const t = window.setTimeout(onDismiss, ttl);
    return () => window.clearTimeout(t);
  }, [ttl, onDismiss]);

  const Icon = toast.kind === "success"  ? CheckCircle2
             : toast.kind === "warning"  ? AlertTriangle
             : toast.kind === "error"    ? AlertCircle
             :                             Info;

  // Colour palette per kind — brand consistent.
  const barColor =
    toast.kind === "success" ? "#166534"        // brand green (in-stock)
    : toast.kind === "warning" ? BRAND_YELLOW
    : toast.kind === "error"   ? "#B91C1C"
    : "#0F4C81";                                 // info blue

  return (
    <div
      role="status"
      className="pointer-events-auto flex w-full items-start gap-2 rounded-lg border bg-white p-3 shadow-lg transition"
      style={{
        borderColor: "rgba(139,69,19,0.10)",
        animation:   "toast-in 220ms cubic-bezier(0.2, 0.9, 0.35, 1)"
      }}
    >
      <div
        className="mt-0.5 flex h-6 w-6 flex-none items-center justify-center rounded-full text-white"
        style={{ backgroundColor: barColor }}
      >
        <Icon size={13} strokeWidth={2.4}/>
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-black leading-tight" style={{ color: BRAND_BLACK }}>
          {toast.title}
        </p>
        {toast.body && (
          <p className="mt-0.5 text-[11.5px] leading-tight text-neutral-600">
            {toast.body}
          </p>
        )}
        {toast.action && (
          <a
            href={toast.action.href}
            className="mt-1 inline-flex items-center gap-0.5 text-[11px] font-black uppercase tracking-wider text-neutral-700 underline underline-offset-2 hover:text-neutral-900"
          >
            {toast.action.label} →
          </a>
        )}
      </div>
      <button
        type="button"
        aria-label="Dismiss"
        onClick={onDismiss}
        className="flex h-6 w-6 flex-none items-center justify-center rounded-md text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-700"
      >
        <X size={13} strokeWidth={2.4}/>
      </button>
      {/* Toast slide-in animation is inline CSS so we don't force a
          globals.css edit + hot-reload. */}
      <style jsx>{`
        @keyframes toast-in {
          from { transform: translateY(20px); opacity: 0; }
          to   { transform: translateY(0);    opacity: 1; }
        }
      `}</style>
    </div>
  );
}
