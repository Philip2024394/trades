"use client";

// Studio-wide toast notifier.
//
// Mounted once inside StudioShell. Any client component under the shell
// can call useNotify() to push a toast — success / warning / error / info.
// Each toast auto-dismisses after 5s (10s for errors so they can be
// read), stacks bottom-right, and supports one action button per toast.
//
// Toasts are the "receipt" for every mutation the merchant runs from
// modals. When a modal closes after a successful install/uninstall the
// toast persists on screen so the merchant sees confirmation even after
// the modal is gone.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode
} from "react";

const YELLOW = "#FFB300";
const BLACK = "#0A0A0A";
const GREEN = "#10B981";
const RED = "#DC2626";
const AMBER = "#F59E0B";
const BLUE = "#2563EB";

type ToastKind = "success" | "warning" | "error" | "info";

type ToastAction = {
  label: string;
  onClick: () => void;
};

type Toast = {
  id: string;
  kind: ToastKind;
  title: string;
  detail?: string;
  action?: ToastAction;
};

type NotifyPayload = Omit<Toast, "id" | "kind">;

type NotifyApi = {
  success: (t: NotifyPayload) => void;
  warning: (t: NotifyPayload) => void;
  error: (t: NotifyPayload) => void;
  info: (t: NotifyPayload) => void;
  dismiss: (id: string) => void;
};

const NotifyContext = createContext<NotifyApi | null>(null);

export function useNotify(): NotifyApi {
  const ctx = useContext(NotifyContext);
  if (!ctx) {
    // Fallback — if the shell hasn't mounted (e.g. rendering outside
    // Studio), no-op so callers don't crash. Warn once in dev.
    if (process.env.NODE_ENV !== "production") {
      // eslint-disable-next-line no-console
      console.warn("useNotify called outside <StudioToaster />");
    }
    return {
      success: () => {},
      warning: () => {},
      error: () => {},
      info: () => {},
      dismiss: () => {}
    };
  }
  return ctx;
}

export function StudioToaster({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timers = useRef<Map<string, number>>(new Map());

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      window.clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const push = useCallback(
    (kind: ToastKind, payload: NotifyPayload) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const toast: Toast = { id, kind, ...payload };
      setToasts((prev) => [...prev, toast]);
      const ttl = kind === "error" ? 10000 : 5000;
      const timer = window.setTimeout(() => dismiss(id), ttl);
      timers.current.set(id, timer);
    },
    [dismiss]
  );

  useEffect(() => {
    return () => {
      for (const t of timers.current.values()) window.clearTimeout(t);
      timers.current.clear();
    };
  }, []);

  const api = useMemo<NotifyApi>(
    () => ({
      success: (p) => push("success", p),
      warning: (p) => push("warning", p),
      error: (p) => push("error", p),
      info: (p) => push("info", p),
      dismiss
    }),
    [push, dismiss]
  );

  return (
    <NotifyContext.Provider value={api}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="false"
        className="pointer-events-none fixed inset-x-0 bottom-4 z-[500] flex flex-col items-center gap-2 px-4 sm:bottom-6 sm:right-6 sm:left-auto sm:items-end sm:px-0"
      >
        {toasts.map((t) => (
          <ToastCard key={t.id} toast={t} onDismiss={() => dismiss(t.id)} />
        ))}
      </div>
    </NotifyContext.Provider>
  );
}

function ToastCard({
  toast,
  onDismiss
}: {
  toast: Toast;
  onDismiss: () => void;
}) {
  const { accent, tint, icon, label } = STYLE[toast.kind];
  return (
    <div
      role={toast.kind === "error" ? "alert" : "status"}
      className="pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl border bg-white p-3 shadow-lg"
      style={{ borderColor: accent }}
    >
      <span
        className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full text-[13px] font-extrabold text-white"
        style={{ background: accent }}
        aria-hidden="true"
      >
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p
          className="text-[9px] font-extrabold uppercase tracking-widest"
          style={{ color: accent }}
        >
          {label}
        </p>
        <p className="mt-0.5 text-[13px] font-extrabold text-neutral-900">
          {toast.title}
        </p>
        {toast.detail && (
          <p className="mt-0.5 text-[12px] leading-relaxed text-neutral-600">
            {toast.detail}
          </p>
        )}
        {toast.action && (
          <button
            type="button"
            onClick={() => {
              toast.action?.onClick();
              onDismiss();
            }}
            className="mt-2 inline-flex h-8 items-center rounded-lg px-3 text-[11px] font-extrabold uppercase tracking-widest text-neutral-900 transition hover:brightness-95"
            style={{ background: YELLOW }}
          >
            {toast.action.label} →
          </button>
        )}
      </div>
      <button
        type="button"
        aria-label="Dismiss notification"
        onClick={onDismiss}
        className="ml-1 grid h-7 w-7 shrink-0 place-items-center rounded-lg text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-700"
        style={{ background: tint }}
      >
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>
  );
}

const STYLE: Record<
  ToastKind,
  { accent: string; tint: string; icon: string; label: string }
> = {
  success: {
    accent: GREEN,
    tint: "rgba(16,185,129,0.10)",
    icon: "✓",
    label: "Done"
  },
  warning: {
    accent: AMBER,
    tint: "rgba(245,158,11,0.10)",
    icon: "!",
    label: "Heads up"
  },
  error: {
    accent: RED,
    tint: "rgba(220,38,38,0.10)",
    icon: "×",
    label: "Blocked"
  },
  info: {
    accent: BLUE,
    tint: "rgba(37,99,235,0.10)",
    icon: "i",
    label: "Note"
  }
};

// Expose black so cards that need to match footer treatment can import
// without duplicating the constant.
export { BLACK as _BLACK };
