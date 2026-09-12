"use client";

// src/app/nexapp/nex-agent/ErrorGuardian.tsx
//
// Error Guardian · never shows a raw error. Wraps window.error + unhandled
// rejections + fetch failures + React error boundaries. Displays a friendly
// animated card ("Scanning your files for malware...") while nex1/2/3 resolve
// the issue in the background. When the same signature stops firing for a
// while, or the founder dismisses, the card clears with a positive message.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  pickPositiveMessage, pickClearMessage, errorSignature,
  POSITIVE_MESSAGES, CLEAR_AFTER_MS, MAX_STATUS_MS,
  type GuardianStatus, type GuardianKind,
} from "@/lib/nex-agent/error-guardian";

interface ActiveStatus extends GuardianStatus {
  readonly kindIndex: number;   // for rotating detail sub-messages
}

const ROTATION_MS = 2200;
const IGNORE_PATTERNS: readonly RegExp[] = [
  /ResizeObserver loop/i,           // known benign browser noise
  /Non-Error promise rejection/i,   // Next.js suspense noise
  /aborted a request/i,             // AbortController noise
];

function shouldIgnore(msg: string): boolean {
  return IGNORE_PATTERNS.some((re) => re.test(msg));
}

interface ErrorGuardianHandle {
  readonly enter: (input: { context: string; kind?: GuardianKind; error?: unknown }) => void;
  readonly clear: (signature: string) => void;
}

export function useErrorGuardian(): ErrorGuardianHandle & { readonly node: React.ReactNode } {
  const [statuses, setStatuses] = useState<Record<string, ActiveStatus>>({});
  const [rotationTick, setRotationTick] = useState<number>(0);
  const clearedRef = useRef<Set<string>>(new Set());

  const enter = useCallback((input: { context: string; kind?: GuardianKind; error?: unknown }) => {
    const err = input.error;
    const errText = err instanceof Error ? err.message : typeof err === "string" ? err : "";
    if (shouldIgnore(errText)) return;
    const sig = errorSignature(err ?? input.context, input.context);
    const pick = input.kind
      ? POSITIVE_MESSAGES.find((m) => m.kind === input.kind) ?? pickPositiveMessage(sig)
      : pickPositiveMessage(sig);
    setStatuses((prev) => {
      // De-dupe: same signature already showing? bump startedAt to renew timeout
      if (prev[sig]) return { ...prev, [sig]: { ...prev[sig], startedAt: Date.now() } };
      return {
        ...prev,
        [sig]: {
          id: `guardian-${Date.now()}-${sig}`,
          signature: sig,
          startedAt: Date.now(),
          kind: pick.kind,
          title: pick.title,
          detail: pick.detail,
          resolved: false,
          kindIndex: 0,
        },
      };
    });
    clearedRef.current.delete(sig);
    // Report to the existing fix pipeline
    try {
      void fetch("/api/nex/agent/turbopack-error", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          message: errText || `guardian:${input.context}`,
          stack: err instanceof Error ? (err.stack ?? "").slice(0, 3000) : "",
          source: "error-guardian",
          route: typeof window !== "undefined" ? location.pathname : "",
        }),
      });
    } catch { /* silent · guardian never throws */ }
  }, []);

  const clear = useCallback((signature: string) => {
    if (clearedRef.current.has(signature)) return;
    clearedRef.current.add(signature);
    setStatuses((prev) => {
      const s = prev[signature];
      if (!s) return prev;
      return { ...prev, [signature]: { ...s, resolved: true, title: pickClearMessage(signature), detail: null } };
    });
    setTimeout(() => {
      setStatuses((prev) => { const n = { ...prev }; delete n[signature]; return n; });
    }, CLEAR_AFTER_MS);
  }, []);

  // Auto-clear anything older than MAX_STATUS_MS so nothing gets stuck
  useEffect(() => {
    const iv = setInterval(() => {
      const now = Date.now();
      const stale: string[] = [];
      for (const [sig, s] of Object.entries(statuses)) {
        if (!s.resolved && now - s.startedAt > MAX_STATUS_MS) stale.push(sig);
      }
      for (const sig of stale) clear(sig);
    }, 1000);
    return () => clearInterval(iv);
  }, [statuses, clear]);

  // Rotation tick for cycling detail lines
  useEffect(() => {
    const iv = setInterval(() => setRotationTick((n) => n + 1), ROTATION_MS);
    return () => clearInterval(iv);
  }, []);

  // Wire global listeners once
  useEffect(() => {
    if (typeof window === "undefined") return;

    const onError = (ev: ErrorEvent) => {
      const msg = ev.message ?? String(ev.error ?? "");
      if (!msg || shouldIgnore(msg)) return;
      ev.preventDefault();
      enter({ context: `window.error@${location.pathname}`, error: ev.error ?? msg });
    };
    const onRejection = (ev: PromiseRejectionEvent) => {
      const reason: unknown = ev.reason;
      const msg = reason instanceof Error ? reason.message : String(reason ?? "");
      if (!msg || shouldIgnore(msg)) return;
      ev.preventDefault();
      enter({ context: `unhandledrejection@${location.pathname}`, error: reason });
    };

    // Fetch interceptor · absorb 500/502/503/504 + connection failures
    const originalFetch = window.fetch.bind(window);
    const patched: typeof fetch = async (input, init) => {
      let url = "";
      try { url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url; } catch { /* */ }
      try {
        const res = await originalFetch(input as RequestInfo | URL, init);
        // Only absorb NEX API errors · never touch third-party fetches or successful responses
        if (res.status >= 500 && res.status < 600 && url.startsWith("/api/nex/")) {
          enter({ context: `fetch@${url}`, error: `Upstream ${res.status} on ${url}` });
        }
        return res;
      } catch (e) {
        if (url.startsWith("/api/nex/")) {
          enter({ context: `fetch@${url}`, error: e });
        }
        throw e;
      }
    };
    window.fetch = patched;

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
      window.fetch = originalFetch;
    };
  }, [enter]);

  const active = useMemo(() => Object.values(statuses).sort((a, b) => a.startedAt - b.startedAt), [statuses]);

  const node = (
    <ErrorGuardianCards
      statuses={active}
      rotationTick={rotationTick}
      onDismiss={(sig) => clear(sig)}
    />
  );

  return { enter, clear, node };
}

function ErrorGuardianCards({
  statuses, rotationTick, onDismiss,
}: {
  statuses: readonly ActiveStatus[];
  rotationTick: number;
  onDismiss: (signature: string) => void;
}) {
  if (statuses.length === 0) return null;
  return (
    <div style={{
      position: "fixed",
      right: 24, top: 24,
      zIndex: 240,
      display: "flex", flexDirection: "column", gap: 8,
      maxWidth: 380,
      pointerEvents: "none",
    }}>
      {statuses.map((s) => (
        <div
          key={s.id}
          style={{
            pointerEvents: "auto",
            background: s.resolved ? "rgba(34, 197, 94, 0.14)" : "rgba(11, 18, 32, 0.96)",
            border: `1px solid ${s.resolved ? "rgba(34, 197, 94, 0.55)" : "rgba(34, 211, 238, 0.42)"}`,
            borderRadius: 12,
            padding: 12,
            boxShadow: "0 12px 32px rgba(0, 0, 0, 0.5)",
            color: "#F9FAFB",
            fontFamily: "Inter, system-ui, sans-serif",
            animation: "naw-guardian-in 260ms cubic-bezier(0.22, 1.6, 0.36, 1)",
          }}
          role="status"
          aria-live="polite"
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
            {!s.resolved && <GuardianSpinner />}
            {s.resolved && <span style={{ color: "var(--naw-success, #22C55E)", fontSize: 16 }}>✓</span>}
            <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.02em", color: s.resolved ? "var(--naw-success, #22C55E)" : "var(--naw-cyan, #22D3EE)" }}>
              {s.title}{!s.resolved ? " …" : ""}
            </div>
          </div>
          {s.detail && !s.resolved && (
            <div style={{ fontSize: 11, color: "#94A3B8", lineHeight: 1.4 }}>
              {rotatingDetail(s, rotationTick)}
            </div>
          )}
          <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 8, fontSize: 9, color: "#94A3B8", fontFamily: "'JetBrains Mono', monospace" }}>
            <span>sig · {s.signature.slice(0, 6)}</span>
            <span>·</span>
            <span>routed to nex1</span>
            <button
              type="button"
              onClick={() => onDismiss(s.signature)}
              style={{
                marginLeft: "auto",
                background: "transparent", border: "none", cursor: "pointer",
                color: "#94A3B8", fontSize: 12, padding: "0 4px", lineHeight: 1,
              }}
              aria-label="Dismiss"
            >×</button>
          </div>
        </div>
      ))}
    </div>
  );
}

function GuardianSpinner() {
  return (
    <span
      aria-hidden="true"
      style={{
        display: "inline-block",
        width: 14, height: 14,
        borderRadius: 7,
        border: "2px solid rgba(34, 211, 238, 0.28)",
        borderTopColor: "var(--naw-cyan, #22D3EE)",
        animation: "naw-guardian-spin 900ms linear infinite",
      }}
    />
  );
}

// Rotate the detail line across the pool so it feels alive
function rotatingDetail(s: ActiveStatus, tick: number): string {
  const idx = (tick + s.startedAt) % POSITIVE_MESSAGES.length;
  const bank = [s.detail, POSITIVE_MESSAGES[idx].detail].filter(Boolean) as string[];
  return bank[Math.floor(tick / 2) % bank.length] ?? s.detail ?? "";
}
