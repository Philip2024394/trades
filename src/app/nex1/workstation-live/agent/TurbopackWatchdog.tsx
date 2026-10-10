"use client";

// src/app/nexapp/nex-agent/TurbopackWatchdog.tsx
//
// Watches for Turbopack / Next.js compile errors and pipes them into the NEX1
// queue as fix tasks. Master AI Engineer + Claude then review NEX1's fix.
//
// Detection sources (three complementary signals):
//   1. window.error listener · JS runtime errors caught at the window level.
//   2. window.unhandledrejection · async promise rejections.
//   3. Fetch interceptor · watches responses to /api/nex/* endpoints for
//      500-status responses whose body contains a compile-error signature
//      ("Failed to compile" · "SyntaxError" · Turbopack error strings).
//
// Every detection posts to /api/nex/agent/turbopack-error which dedupes by
// signature (5-min window) before submitting a new NEX1 task. Rate-limited
// client-side too (max 1 fetch every 8 seconds).

import { useEffect } from "react";

const COMPILE_SIGNATURES = [
  "Failed to compile",
  "Module not found",
  "SyntaxError",
  "Unexpected token",
  "ParseError",
  "Turbopack",
  "TurbopackInternalError",
  "TypeError:",
];

const CLIENT_MIN_INTERVAL_MS = 8000;
let lastReportAt = 0;

async function report(payload: { message: string; stack?: string; source: string; route?: string; file?: string }) {
  const now = Date.now();
  if (now - lastReportAt < CLIENT_MIN_INTERVAL_MS) return;
  lastReportAt = now;
  try {
    await fetch("/api/nex/agent/turbopack-error", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch { /* silent · never let watchdog itself throw */ }
}

function looksLikeCompileError(text: string): boolean {
  if (!text) return false;
  const lowered = text.toLowerCase();
  return COMPILE_SIGNATURES.some((s) => lowered.includes(s.toLowerCase()));
}

export function TurbopackWatchdog() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    // 1 · window.error
    const onError = (ev: ErrorEvent) => {
      const msg = ev.message ?? String(ev.error ?? "");
      if (!msg) return;
      const stack = (ev.error as Error | undefined)?.stack ?? "";
      // Only escalate obvious compile-style errors (skip transient runtime bugs
      // that would create noise). But also let genuine TypeErrors through since
      // those are usually from bad refactors.
      if (looksLikeCompileError(msg) || looksLikeCompileError(stack)) {
        void report({ message: msg, stack, source: "window.error", route: location.pathname, file: ev.filename ?? "" });
      }
    };
    window.addEventListener("error", onError);

    // 2 · unhandled rejections
    const onRejection = (ev: PromiseRejectionEvent) => {
      const reason: unknown = ev.reason;
      const msg = reason instanceof Error ? reason.message : String(reason ?? "unhandled rejection");
      const stack = reason instanceof Error ? (reason.stack ?? "") : "";
      if (looksLikeCompileError(msg) || looksLikeCompileError(stack)) {
        void report({ message: msg, stack, source: "unhandledrejection", route: location.pathname });
      }
    };
    window.addEventListener("unhandledrejection", onRejection);

    // 3 · fetch interceptor · watch NEX API 500s for compile-error bodies
    const originalFetch = window.fetch.bind(window);
    const patched: typeof fetch = async (input, init) => {
      const res = await originalFetch(input as RequestInfo | URL, init);
      try {
        const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
        if (res.status === 500 && url.startsWith("/api/nex/")) {
          const clone = res.clone();
          const text = await clone.text();
          if (looksLikeCompileError(text)) {
            const shortText = text.slice(0, 600);
            void report({ message: `500 at ${url}`, stack: shortText, source: "fetch-500", route: location.pathname, file: "" });
          }
        }
      } catch { /* never break the fetch chain */ }
      return res;
    };
    window.fetch = patched;

    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
      window.fetch = originalFetch;
    };
  }, []);

  return null;
}
